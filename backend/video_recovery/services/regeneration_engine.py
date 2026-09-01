"""Regeneration engine — restore, interpolate, and generate when original data is lost."""

from __future__ import annotations

import os
from typing import Any

from .corruption_types import classify_frame_corruption, mark_frozen_duplicate_frames
from .damage_map import (
    DAMAGED_RECOVERABLE,
    GENERATED,
    MISSING,
    RESTORED,
    UNRECOVERABLE,
    VALID,
    frame_needs_regeneration,
)
from .gpu_utils import (
    get_torch_device,
    gpu_batch_size,
    gpu_info,
    interpolate_frames_batch,
    restore_damaged_frames_batch,
)


def _require_cv2():
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError("OpenCV required for regeneration") from exc
    return cv2


def restore_damaged_frame(img, cv2) -> tuple[Any, bool]:
    """Technique A — CPU fallback for single-frame restoration."""
    if img is None:
        return None, False
    try:
        results = restore_damaged_frames_batch([img])
        if results:
            return results[0], True
        denoised = cv2.fastNlMeansDenoisingColored(img, None, 8, 8, 7, 21)
        gray = cv2.cvtColor(denoised, cv2.COLOR_BGR2GRAY)
        hsv = cv2.cvtColor(denoised, cv2.COLOR_BGR2HSV)
        green_mask = cv2.inRange(hsv, (35, 40, 40), (85, 255, 255))
        black_mask = cv2.inRange(gray, 0, 12)
        damage_mask = cv2.bitwise_or(green_mask, black_mask)
        if cv2.countNonZero(damage_mask) > 0:
            restored = cv2.inpaint(denoised, damage_mask, 3, cv2.INPAINT_TELEA)
        else:
            kernel = cv2.getGaussianKernel(3, -1)
            restored = cv2.filter2D(denoised, -1, kernel @ kernel.T)
        return restored, True
    except Exception:
        return img, False


def _process_damaged_batch(
    batch: list[tuple[int, dict[str, Any]]],
    *,
    cv2,
    reg_dir: str,
    output_entries: list[dict[str, Any]],
    stats: dict[str, int],
    paths_cache: dict[int, Any],
) -> None:
    imgs: list[Any] = []
    valid_batch: list[tuple[int, dict[str, Any]]] = []
    for idx, entry in batch:
        path = entry.get("path")
        if not path:
            continue
        img = paths_cache.get(idx)
        if img is None:
            img = cv2.imread(str(path))
            paths_cache[idx] = img
        if img is None:
            continue
        imgs.append(img)
        valid_batch.append((idx, entry))

    if not imgs:
        return

    restored_list = restore_damaged_frames_batch(imgs)
    if not restored_list:
        restored_list = []
        for img in imgs:
            restored, _ = restore_damaged_frame(img, cv2)
            restored_list.append(restored if restored is not None else img)

    for (idx, entry), restored in zip(valid_batch, restored_list):
        out_path = os.path.join(reg_dir, f"restored_{idx:06d}.jpg")
        cv2.imwrite(out_path, restored, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
        corruption_type = entry.get("corruption_type") or "blur_noise"
        technique_map = {
            "green_screen": "green_restoration",
            "black_white": "blank_frame_restoration",
            "block_pixel": "block_restoration",
            "blur_noise": "ai_restoration",
        }
        output_entries.append(
            {
                "index": idx,
                "path": out_path,
                "status": RESTORED,
                "source": "recovered",
                "technique": technique_map.get(corruption_type, "ai_restoration"),
                "corruption_type": corruption_type,
            }
        )
        stats["restored"] += 1
        paths_cache[idx] = restored


def interpolate_frames(frame_a, frame_b, count: int, cv2) -> list:
    """Technique B — optical flow / blend interpolation for short gaps."""
    if frame_a is None or frame_b is None or count <= 0:
        return []

    gpu_out = interpolate_frames_batch(frame_a, frame_b, count)
    if gpu_out:
        return gpu_out

    if frame_a.shape != frame_b.shape:
        frame_b = cv2.resize(frame_b, (frame_a.shape[1], frame_a.shape[0]))

    out = []
    try:
        gray_a = cv2.cvtColor(frame_a, cv2.COLOR_BGR2GRAY)
        gray_b = cv2.cvtColor(frame_b, cv2.COLOR_BGR2GRAY)
        flow = cv2.calcOpticalFlowFarneback(gray_a, gray_b, None, 0.5, 3, 15, 3, 5, 1.2, 0)
    except Exception:
        flow = None

    for i in range(count):
        alpha = (i + 1) / (count + 1)
        if flow is not None:
            h, w = flow.shape[:2]
            mx, my = flow[..., 0] * alpha, flow[..., 1] * alpha
            grid_x, grid_y = np_mesh(w, h, mx, my, cv2)
            warped = cv2.remap(frame_a, grid_x, grid_y, cv2.INTER_LINEAR)
            blended = cv2.addWeighted(warped, 1 - alpha, frame_b, alpha, 0)
            out.append(blended)
        else:
            out.append(cv2.addWeighted(frame_a, 1 - alpha, frame_b, alpha, 0))
    return out


def np_mesh(w, h, mx, my, cv2):
    import numpy as np

    x, y = np.meshgrid(np.arange(w), np.arange(h))
    return (x + mx).astype(np.float32), (y + my).astype(np.float32)


def generate_long_gap(prev_frames: list, next_frame, gap_size: int, cv2) -> list:
    """Technique C — scene-aware generation for long missing segments."""
    if not prev_frames or next_frame is None or gap_size <= 0:
        return []
    anchor = prev_frames[-1]
    if anchor.shape != next_frame.shape:
        next_frame = cv2.resize(next_frame, (anchor.shape[1], anchor.shape[0]))
    return interpolate_frames(anchor, next_frame, min(gap_size, 60), cv2)


def run_regeneration_engine(
    frame_entries: list[dict[str, Any]],
    work_dir: str,
    *,
    short_gap_max: int = 8,
    long_gap_min: int = 9,
) -> dict[str, Any]:
    """
    Process frame entries in timeline order.
    Recovery-first for damaged frames; regeneration for lost/missing.
    """
    cv2 = _require_cv2()
    reg_dir = os.path.join(work_dir, "regeneration")
    os.makedirs(reg_dir, exist_ok=True)

    output_entries: list[dict[str, Any]] = []
    stats = {
        "restored": 0,
        "interpolated": 0,
        "generated": 0,
        "kept_original": 0,
    }
    batch_size = gpu_batch_size() if get_torch_device() else 1

    paths_cache: dict[int, Any] = {}

    def load_img(entry: dict) -> Any:
        path = entry.get("path")
        if not path:
            return None
        idx = entry.get("index", -1)
        if idx in paths_cache:
            return paths_cache[idx]
        img = cv2.imread(str(path))
        paths_cache[idx] = img
        return img

    i = 0
    while i < len(frame_entries):
        entry = frame_entries[i]
        status = entry.get("status", VALID)
        path = entry.get("path")
        idx = entry.get("index", i)

        if status == VALID and path:
            output_entries.append({**entry, "source": "original", "technique": "none"})
            stats["kept_original"] += 1
            i += 1
            continue

        if status == RESTORED and path:
            output_entries.append({**entry, "source": "recovered", "technique": "recovery"})
            stats["kept_original"] += 1
            i += 1
            continue

        if status == DAMAGED_RECOVERABLE and path:
            batch: list[tuple[int, dict[str, Any]]] = []
            while i < len(frame_entries) and frame_entries[i].get("status") == DAMAGED_RECOVERABLE:
                e = frame_entries[i]
                if e.get("path"):
                    batch.append((int(e.get("index", i)), e))
                i += 1
                if len(batch) >= batch_size:
                    _process_damaged_batch(
                        batch,
                        cv2=cv2,
                        reg_dir=reg_dir,
                        output_entries=output_entries,
                        stats=stats,
                        paths_cache=paths_cache,
                    )
                    batch = []
            if batch:
                _process_damaged_batch(
                    batch,
                    cv2=cv2,
                    reg_dir=reg_dir,
                    output_entries=output_entries,
                    stats=stats,
                    paths_cache=paths_cache,
                )
            continue

        if frame_needs_regeneration(status) or status == UNRECOVERABLE:
            gap_start = i
            while i < len(frame_entries) and frame_entries[i].get("status") in (
                MISSING,
                UNRECOVERABLE,
            ):
                i += 1
            gap_size = i - gap_start

            prev_img = None
            for j in range(gap_start - 1, -1, -1):
                prev_img = load_img(frame_entries[j])
                if prev_img is not None:
                    break
            next_img = None
            if i < len(frame_entries):
                next_img = load_img(frame_entries[i])

            if prev_img is None and next_img is not None:
                prev_img = next_img
            if next_img is None and prev_img is not None:
                next_img = prev_img

            if prev_img is None or next_img is None:
                i = gap_start + gap_size
                continue

            if gap_size <= short_gap_max:
                generated = interpolate_frames(prev_img, next_img, gap_size, cv2)
                technique = "frame_interpolation"
                stats["interpolated"] += gap_size
            else:
                prev_list = [prev_img]
                generated = generate_long_gap(prev_list, next_img, gap_size, cv2)
                technique = "video_generation"
                stats["generated"] += len(generated)

            gap_type = frame_entries[gap_start].get("corruption_type") if gap_start < len(frame_entries) else None
            if gap_type == "frozen_duplicate":
                technique = "frozen_frame_interpolation"

            for g_idx, g_img in enumerate(generated):
                out_path = os.path.join(reg_dir, f"gen_{gap_start + g_idx:06d}.jpg")
                cv2.imwrite(out_path, g_img, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
                output_entries.append(
                    {
                        "index": gap_start + g_idx,
                        "path": out_path,
                        "status": GENERATED,
                        "source": "generated",
                        "technique": technique,
                        "corruption_type": gap_type or "missing_frames",
                    }
                )
            continue

        if path:
            output_entries.append({**entry, "source": "original", "technique": "none"})
        i += 1

    return {
        "output_entries": output_entries,
        "stats": stats,
        "output_dir": reg_dir,
        "gpu": gpu_info(),
    }


def classify_extracted_frames(
    valid_paths: list[str],
    bad_paths: list[str],
    *,
    missing_count: int = 0,
) -> list[dict[str, Any]]:
    """Build classified frame timeline from recovery extraction results."""
    cv2 = _require_cv2()
    entries: list[dict[str, Any]] = []
    idx = 0
    for path in valid_paths:
        img = cv2.imread(path)
        detail = classify_frame_corruption(img)
        entries.append(
            {
                "index": idx,
                "path": path,
                "status": detail.get("status", VALID),
                "corruption_type": detail.get("corruption_type"),
            }
        )
        idx += 1
    for path in bad_paths:
        img = cv2.imread(path)
        if img is not None:
            detail = classify_frame_corruption(img)
            entries.append(
                {
                    "index": idx,
                    "path": path,
                    "status": detail.get("status", DAMAGED_RECOVERABLE),
                    "corruption_type": detail.get("corruption_type") or "undecodable_frames",
                }
            )
        else:
            entries.append(
                {
                    "index": idx,
                    "path": path,
                    "status": UNRECOVERABLE,
                    "corruption_type": "undecodable_frames",
                }
            )
        idx += 1
    for _ in range(missing_count):
        entries.append(
            {
                "index": idx,
                "path": None,
                "status": MISSING,
                "corruption_type": "missing_frames",
            }
        )
        idx += 1
    entries.sort(key=lambda e: e["index"])
    entries = mark_frozen_duplicate_frames(entries)
    return entries
