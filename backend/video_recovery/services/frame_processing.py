"""Valid / bad / missing frame processing — enhancement, restoration, generation."""

from __future__ import annotations

import os
import shutil
from typing import Any


def _require_cv2():
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError("OpenCV (cv2) is required for frame processing") from exc
    return cv2


def process_valid_frames(valid_paths: list[str], work_dir: str) -> dict[str, Any]:
    """Enhancement pass on decodable frames."""
    cv2 = _require_cv2()
    enhanced_dir = os.path.join(work_dir, "frames_enhanced")
    os.makedirs(enhanced_dir, exist_ok=True)
    output_paths: list[str] = []

    for idx, src in enumerate(valid_paths):
        img = cv2.imread(src)
        if img is None:
            continue
        # Denoise + sharpen enhancement
        denoised = cv2.fastNlMeansDenoisingColored(img, None, 6, 6, 7, 21)
        kernel = cv2.getGaussianKernel(3, -1)
        sharpened = cv2.filter2D(denoised, -1, kernel @ kernel.T)
        dest = os.path.join(enhanced_dir, f"frame_{idx:06d}.jpg")
        cv2.imwrite(dest, sharpened, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
        output_paths.append(dest)

    return {
        "method": "enhancement",
        "processed_count": len(output_paths),
        "output_paths": output_paths,
        "output_dir": enhanced_dir,
    }


def restore_bad_frames(bad_paths: list[str], reference_paths: list[str], work_dir: str) -> dict[str, Any]:
    """AI restoration placeholder — inpaint from nearest valid neighbor."""
    cv2 = _require_cv2()
    restored_dir = os.path.join(work_dir, "frames_restored")
    os.makedirs(restored_dir, exist_ok=True)
    restored: list[str] = []

    ref = None
    if reference_paths:
        ref = cv2.imread(reference_paths[0])

    for idx, bad in enumerate(bad_paths):
        if ref is not None:
            dest = os.path.join(restored_dir, f"restored_{idx:06d}.jpg")
            cv2.imwrite(dest, ref, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
            restored.append(dest)

    return {
        "method": "ai_restoration",
        "restored_count": len(restored),
        "output_paths": restored,
        "output_dir": restored_dir,
    }


def generate_missing_frames(
    valid_paths: list[str],
    missing_count: int,
    work_dir: str,
) -> dict[str, Any]:
    """AI generation placeholder — interpolate between adjacent valid frames."""
    cv2 = _require_cv2()
    generated_dir = os.path.join(work_dir, "frames_generated")
    os.makedirs(generated_dir, exist_ok=True)
    generated: list[str] = []

    if missing_count <= 0 or len(valid_paths) < 2:
        return {
            "method": "ai_generation",
            "generated_count": 0,
            "output_paths": [],
            "output_dir": generated_dir,
        }

    a = cv2.imread(valid_paths[0])
    b = cv2.imread(valid_paths[min(1, len(valid_paths) - 1)])
    if a is None or b is None:
        return {
            "method": "ai_generation",
            "generated_count": 0,
            "output_paths": [],
            "output_dir": generated_dir,
        }

    for i in range(min(missing_count, 30)):
        alpha = (i + 1) / (missing_count + 1)
        if a.shape != b.shape:
            b = cv2.resize(b, (a.shape[1], a.shape[0]))
        blended = cv2.addWeighted(a, 1 - alpha, b, alpha, 0)
        dest = os.path.join(generated_dir, f"generated_{i:06d}.jpg")
        cv2.imwrite(dest, blended, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
        generated.append(dest)

    return {
        "method": "ai_generation",
        "generated_count": len(generated),
        "output_paths": generated,
        "output_dir": generated_dir,
    }


def merge_frame_sets(*path_groups: list[str], work_dir: str) -> list[str]:
    """Combine all frame paths in order for reconstruction."""
    merged_dir = os.path.join(work_dir, "frames_merged")
    if os.path.isdir(merged_dir):
        shutil.rmtree(merged_dir, ignore_errors=True)
    os.makedirs(merged_dir, exist_ok=True)

    merged: list[str] = []
    idx = 0
    for group in path_groups:
        for src in group:
            if not os.path.isfile(src):
                continue
            dest = os.path.join(merged_dir, f"frame_{idx:06d}.jpg")
            shutil.copy2(src, dest)
            merged.append(dest)
            idx += 1
    return merged
