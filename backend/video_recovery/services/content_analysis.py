"""Visual content assessment — detect when original scene data no longer exists."""

from __future__ import annotations

from typing import Any


def _green_ratio(img) -> float:
    try:
        import cv2
        import numpy as np
    except ImportError:
        return 0.0
    if img is None or img.size == 0:
        return 0.0
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, (35, 40, 40), (85, 255, 255))
    return float(np.count_nonzero(mask)) / max(1, img.shape[0] * img.shape[1])


def _sample_paths(paths: list[str], max_samples: int = 24) -> list[str]:
    if not paths:
        return []
    if len(paths) <= max_samples:
        return list(paths)
    step = max(1, len(paths) // max_samples)
    return [paths[i] for i in range(0, len(paths), step)][:max_samples]


def _mean_green_ratio(paths: list[str]) -> float:
    try:
        import cv2
    except ImportError:
        return 0.0
    ratios: list[float] = []
    for path in _sample_paths(paths):
        img = cv2.imread(path)
        if img is not None:
            ratios.append(_green_ratio(img))
    return sum(ratios) / len(ratios) if ratios else 0.0


def assess_visual_recovery(
    source_frame_paths: list[str],
    output_frame_paths: list[str],
    damage_counts: dict[str, int] | None = None,
) -> dict[str, Any]:
    """
    Determine whether the original scene was preserved or permanently destroyed.
    Full green replacement videos decode fine but contain no recoverable scene.
    """
    counts = damage_counts or {}
    total_frames = sum(int(v) for v in counts.values()) or max(len(source_frame_paths), 1)
    valid_frames = int(counts.get("valid", 0))
    damaged_frames = int(counts.get("damaged_recoverable", 0))
    original_content_ratio = round(valid_frames / total_frames, 3)

    source_green = _mean_green_ratio(source_frame_paths)
    output_green = _mean_green_ratio(output_frame_paths)

    total_visual_loss = (
        source_green >= 0.85
        and output_green >= 0.75
        and valid_frames == 0
        and damaged_frames >= max(1, total_frames - 1)
    )

    scene_recovered = original_content_ratio >= 0.05 and not total_visual_loss

    warnings: list[str] = []
    if total_visual_loss:
        warnings.append(
            "Original scene data was destroyed in this file (e.g. entire video replaced with "
            "a solid color). Recovery cannot recreate the real footage — the output only "
            "re-processes the pixels that remain."
        )
    elif original_content_ratio < 0.05 and damaged_frames > 0:
        warnings.append(
            "Almost no original valid frames were found. Visual recovery is very limited "
            "without a reference copy of the source video."
        )

    return {
        "original_content_ratio": original_content_ratio,
        "source_green_ratio": round(source_green, 3),
        "output_green_ratio": round(output_green, 3),
        "total_visual_loss": total_visual_loss,
        "scene_recovered": scene_recovered,
        "warnings": warnings,
        "recommendation": (
            "Use partial corruption (truncated or middle-damaged file) from the original "
            "camera3feed.mp4 — not a full green re-encode — to test real recovery."
            if total_visual_loss
            else ""
        ),
    }
