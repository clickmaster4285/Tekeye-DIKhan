"""Crop analysis to optional ROI (normalized 0–1 or absolute pixels)."""

from __future__ import annotations

from typing import Any


def normalize_roi(roi: dict[str, Any] | None, width: int, height: int) -> tuple[int, int, int, int] | None:
    if not roi or width <= 0 or height <= 0:
        return None
    try:
        x1 = float(roi.get("x1", 0))
        y1 = float(roi.get("y1", 0))
        x2 = float(roi.get("x2", 1))
        y2 = float(roi.get("y2", 1))
    except (TypeError, ValueError):
        return None

    # Normalized coordinates when all values are within 0..1.5
    if max(abs(x1), abs(y1), abs(x2), abs(y2)) <= 1.5:
        ax1 = int(round(x1 * width))
        ay1 = int(round(y1 * height))
        ax2 = int(round(x2 * width))
        ay2 = int(round(y2 * height))
    else:
        ax1, ay1, ax2, ay2 = int(x1), int(y1), int(x2), int(y2)

    ax1 = max(0, min(ax1, width - 1))
    ay1 = max(0, min(ay1, height - 1))
    ax2 = max(ax1 + 1, min(ax2, width))
    ay2 = max(ay1 + 1, min(ay2, height))
    return ax1, ay1, ax2, ay2


def apply_roi(frame, roi: dict[str, Any] | None):
    if frame is None or getattr(frame, "size", 0) == 0:
        return frame, None
    h, w = frame.shape[:2]
    box = normalize_roi(roi, w, h)
    if box is None:
        return frame, None
    x1, y1, x2, y2 = box
    return frame[y1:y2, x1:x2].copy(), box
