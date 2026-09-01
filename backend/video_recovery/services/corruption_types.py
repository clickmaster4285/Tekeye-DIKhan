"""12-type corruption taxonomy — detection, routing, and reporting."""

from __future__ import annotations

import os
from typing import Any

# Catalog aligned with forensic recovery + regeneration design
CORRUPTION_CATALOG: list[dict[str, Any]] = [
    {
        "id": 1,
        "key": "container_header",
        "name": "Container/Header corruption",
        "symptom": "Video won't open, invalid MP4/MOV",
        "primary_technique": "recovery",
    },
    {
        "id": 2,
        "key": "missing_index",
        "name": "Missing index / metadata",
        "symptom": "Duration/seek broken, file appears invalid",
        "primary_technique": "recovery",
    },
    {
        "id": 3,
        "key": "truncated",
        "name": "Truncated video",
        "symptom": "Video stops early",
        "primary_technique": "recovery_then_regeneration",
    },
    {
        "id": 4,
        "key": "packet_corruption",
        "name": "Packet corruption/loss",
        "symptom": "Decode errors, jumps, missing sections",
        "primary_technique": "recovery_then_regeneration",
    },
    {
        "id": 5,
        "key": "missing_frames",
        "name": "Missing frames",
        "symptom": "Playback jumps/freezes",
        "primary_technique": "interpolation",
    },
    {
        "id": 6,
        "key": "undecodable_frames",
        "name": "Undecodable frames",
        "symptom": "Decoder errors, corrupted images",
        "primary_technique": "recovery_then_regeneration",
    },
    {
        "id": 7,
        "key": "green_screen",
        "name": "Green-screen corruption",
        "symptom": "Green frames/regions",
        "primary_technique": "restoration",
    },
    {
        "id": 8,
        "key": "black_white",
        "name": "Black/white frame corruption",
        "symptom": "Blank frames",
        "primary_technique": "restoration",
    },
    {
        "id": 9,
        "key": "block_pixel",
        "name": "Block/pixel corruption",
        "symptom": "Macroblocks, pixelation, broken regions",
        "primary_technique": "restoration",
    },
    {
        "id": 10,
        "key": "blur_noise",
        "name": "Blur/noise/compression damage",
        "symptom": "Very poor visual quality",
        "primary_technique": "ai_restoration",
    },
    {
        "id": 11,
        "key": "frozen_duplicate",
        "name": "Frozen/duplicate frames",
        "symptom": "Same image repeated",
        "primary_technique": "interpolation",
    },
    {
        "id": 12,
        "key": "audio_sync",
        "name": "Audio/timestamp sync corruption",
        "symptom": "Audio missing, drifting, or out of sync",
        "primary_technique": "audio_timeline_recovery",
    },
]

_CATALOG_BY_KEY = {item["key"]: item for item in CORRUPTION_CATALOG}


def catalog_entry(key: str) -> dict[str, Any]:
    return dict(_CATALOG_BY_KEY.get(key, {}))


def detect_file_level_types(
    path: str,
    forensic: dict[str, Any],
    stream: dict[str, Any],
    damage: dict[str, Any],
) -> list[str]:
    """Detect corruption types 1–4 and hints for 3/12 at file/stream level."""
    detected: list[str] = []
    corruption = forensic.get("corruption_detection") or {}
    issues_text = " ".join(str(i).lower() for i in (corruption.get("issues") or []))
    container = forensic.get("container_analysis") or {}
    fmt_name = str(container.get("format_name") or "")
    duration = float(container.get("duration_seconds") or 0)

    with open(path, "rb") as fh:
        header = fh.read(512)

    if not fmt_name or corruption.get("corruption_detected"):
        if any(k in issues_text for k in ("format", "header", "container", "invalid")):
            detected.append("container_header")
        if header[:4] != b"\x00\x00\x00\x00" and len(header) >= 8:
            if header[4:8] != b"ftyp" and b"ftyp" not in header[:32]:
                if "container_header" not in detected:
                    detected.append("container_header")

    if any(k in issues_text for k in ("moov", "index", "metadata", "duration")):
        detected.append("missing_index")
    if duration <= 0:
        if "missing_index" not in detected:
            detected.append("missing_index")

    if any(k in issues_text for k in ("moov", "truncat")):
        detected.append("truncated")
    if b"moov" not in _read_tail(path, 65536) and b"mdat" in header:
        if "truncated" not in detected:
            detected.append("truncated")

    packet = stream.get("packet_inspection") or {}
    if not packet.get("decodable"):
        detected.append("packet_corruption")
    if damage.get("stream_damage"):
        if "packet_corruption" not in detected:
            detected.append("packet_corruption")

    return _unique(detected)


def _read_tail(path: str, n: int) -> bytes:
    try:
        size = os.path.getsize(path)
        with open(path, "rb") as fh:
            fh.seek(max(0, size - n))
            return fh.read()
    except OSError:
        return b""


def classify_frame_corruption(img) -> dict[str, Any]:
    """
    Classify visual frame damage — types 7–10.
    Returns status + corruption_type for regeneration routing.
    """
    VALID = "valid"
    DAMAGED_RECOVERABLE = "damaged_recoverable"
    MISSING = "missing"

    try:
        import cv2
        import numpy as np
    except ImportError:
        return {"status": VALID, "corruption_type": None}

    if img is None or img.size == 0:
        return {"status": MISSING, "corruption_type": "missing_frames"}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mean = float(gray.mean())
    std = float(gray.std())
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    green_mask = cv2.inRange(hsv, (35, 40, 40), (85, 255, 255))
    green_ratio = float(np.count_nonzero(green_mask)) / max(1, img.shape[0] * img.shape[1])

    if green_ratio > 0.45:
        return {"status": DAMAGED_RECOVERABLE, "corruption_type": "green_screen"}
    if mean < 12:
        return {"status": DAMAGED_RECOVERABLE, "corruption_type": "black_white"}
    if mean > 248 and std < 8:
        return {"status": DAMAGED_RECOVERABLE, "corruption_type": "black_white"}

    # Block / macroblock artifacts — high local variance spikes on 8px grid
    if _has_block_artifacts(gray):
        return {"status": DAMAGED_RECOVERABLE, "corruption_type": "block_pixel"}

    if lap_var < 35 and std > 4:
        return {"status": DAMAGED_RECOVERABLE, "corruption_type": "blur_noise"}
    if std < 4:
        return {"status": DAMAGED_RECOVERABLE, "corruption_type": "blur_noise"}

    return {"status": VALID, "corruption_type": None}


def _has_block_artifacts(gray) -> bool:
    try:
        import cv2
        import numpy as np
    except ImportError:
        return False
    h, w = gray.shape[:2]
    if h < 64 or w < 64:
        return False
    block = 8
    vars_: list[float] = []
    for y in range(0, h - block, block * 4):
        for x in range(0, w - block, block * 4):
            patch = gray[y : y + block, x : x + block]
            vars_.append(float(patch.std()))
    if len(vars_) < 8:
        return False
    arr = np.array(vars_)
    return float(arr.max()) > 40 and float(arr.std()) > 15


def mark_frozen_duplicate_frames(entries: list[dict[str, Any]], *, threshold: float = 2.0) -> list[dict[str, Any]]:
    """Type 11 — detect consecutive near-duplicate frames and mark for interpolation."""
    try:
        import cv2
        import numpy as np
    except ImportError:
        return entries

    from .damage_map import MISSING

    prev_img = None
    out: list[dict[str, Any]] = []
    for entry in entries:
        path = entry.get("path")
        if not path or entry.get("status") == MISSING:
            out.append(entry)
            prev_img = None
            continue
        img = cv2.imread(str(path))
        if img is None:
            out.append(entry)
            continue
        if prev_img is not None and prev_img.shape == img.shape:
            diff = float(np.mean(cv2.absdiff(prev_img, img)))
            if diff < threshold:
                out.append(
                    {
                        **entry,
                        "status": MISSING,
                        "corruption_type": "frozen_duplicate",
                        "original_path": path,
                        "path": None,
                    }
                )
                continue
        out.append(entry)
        prev_img = img
    return out


def count_frame_corruption_types(entries: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for entry in entries:
        key = entry.get("corruption_type")
        if not key:
            status = entry.get("status")
            if status == "missing":
                key = "missing_frames"
            elif status == "unrecoverable":
                key = "undecodable_frames"
        if key:
            counts[key] = counts.get(key, 0) + 1
    return counts


def build_corruption_report(
    *,
    file_level: list[str],
    frame_counts: dict[str, int],
    regen_stats: dict[str, Any] | None = None,
    audio_report: dict[str, Any] | None = None,
    recovery_levels: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build full 12-type report with detected flags and applied techniques."""
    regen_stats = regen_stats or {}
    audio_report = audio_report or {}
    detected_keys: set[str] = set(file_level)

    for key, count in frame_counts.items():
        if count > 0:
            detected_keys.add(key)

    if int(regen_stats.get("interpolated") or 0) > 0:
        detected_keys.add("missing_frames")
    if int(regen_stats.get("generated") or 0) > 0:
        detected_keys.add("missing_frames")
    if int(regen_stats.get("restored") or 0) > 0:
        detected_keys.update({"green_screen", "black_white", "block_pixel", "blur_noise"})

    if recovery_levels and recovery_levels.get("level_1_mdat_salvage", {}).get("success"):
        detected_keys.add("truncated")

    if not audio_report.get("audio_present"):
        detected_keys.add("audio_sync")
    elif not audio_report.get("synchronized"):
        detected_keys.add("audio_sync")
    elif audio_report.get("sync_drift_seconds"):
        detected_keys.add("audio_sync")

    types_out: list[dict[str, Any]] = []
    for item in CORRUPTION_CATALOG:
        key = item["key"]
        frame_count = frame_counts.get(key, 0)
        detected = key in detected_keys
        applied = _technique_applied(key, detected, regen_stats, audio_report, recovery_levels)
        types_out.append(
            {
                **item,
                "detected": detected,
                "frame_count": frame_count,
                "technique_applied": applied,
            }
        )

    return {
        "types": types_out,
        "detected_count": sum(1 for t in types_out if t["detected"]),
        "catalog_size": len(CORRUPTION_CATALOG),
    }


def _technique_applied(
    key: str,
    detected: bool,
    regen_stats: dict[str, Any],
    audio_report: dict[str, Any],
    recovery_levels: dict[str, Any] | None,
) -> str:
    if not detected:
        return "none"
    if key == "audio_sync":
        if audio_report.get("generated_audio_labeled"):
            return "audio_fill_labeled"
        if audio_report.get("synchronized"):
            return "audio_timeline_recovery"
        return "audio_recovery"
    if key in ("container_header", "missing_index"):
        if recovery_levels and recovery_levels.get("level_1_container", {}).get("success"):
            return "container_recovery"
        return "recovery"
    if key == "truncated":
        if recovery_levels and recovery_levels.get("level_1_mdat_salvage", {}).get("success"):
            return "mdat_salvage"
        return "recovery"
    if key == "packet_corruption":
        return "stream_recovery"
    if key == "missing_frames":
        if int(regen_stats.get("generated") or 0) > 0:
            return "video_generation"
        return "frame_interpolation"
    if key == "undecodable_frames":
        return "recovery_then_regeneration"
    if key == "frozen_duplicate":
        return "frame_interpolation"
    if key in ("green_screen", "black_white", "block_pixel"):
        return "ai_restoration"
    if key == "blur_noise":
        return "ai_restoration"
    return catalog_entry(key).get("primary_technique", "recovery")


def _unique(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out
