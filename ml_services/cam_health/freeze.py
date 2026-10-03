"""Freeze / stream continuity helpers."""

from __future__ import annotations

from typing import Any

from .metrics import frame_diff_score


def freeze_score(diff: float, fps: float | None = None) -> float:
    """
    Higher = more frozen.
    diff near 0 means consecutive health samples look identical.
    """
    base = max(0.0, min(1.0, 1.0 - float(diff)))
    if fps is not None and fps < 1.0:
        base = max(base, 0.85)
    return round(base, 4)


def stream_metrics(
    *,
    rtsp_available: bool,
    fps: float | None,
    frame_age_sec: float | None,
    dropped_frames: int | None,
    freeze: float,
) -> dict[str, Any]:
    latency = None if frame_age_sec is None else round(float(frame_age_sec), 3)
    return {
        "rtsp_available": bool(rtsp_available),
        "fps": None if fps is None else round(float(fps), 2),
        "dropped_frames": dropped_frames,
        "freeze_score": freeze,
        "stream_latency": latency,
        "frame_arrival_delay": latency,
    }
