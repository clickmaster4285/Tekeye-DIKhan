"""Combine image / stream / visibility into overall score + status."""

from __future__ import annotations

from typing import Any


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def score_health(
    image: dict[str, Any],
    stream: dict[str, Any],
    visibility: dict[str, Any],
    purposes: list[str] | None = None,
) -> dict[str, Any]:
    purposes_l = [str(p).strip().lower() for p in (purposes or []) if str(p).strip()]

    # Image subscore
    sharp = float(image.get("sharpness") or 0)
    sharp_s = min(100.0, (sharp / 120.0) * 100.0)
    bright = float(image.get("brightness") or 0)
    bright_s = 100.0 - min(100.0, abs(bright - 128.0) / 128.0 * 100.0)
    contrast = float(image.get("contrast") or 0)
    contrast_s = min(100.0, (contrast / 60.0) * 100.0)
    dark = float(image.get("dark_ratio") or 0)
    bright_r = float(image.get("bright_ratio") or 0)
    exposure_penalty = (dark * 80.0) + (bright_r * 80.0)
    image_score = _clamp((0.4 * sharp_s + 0.3 * bright_s + 0.3 * contrast_s) - exposure_penalty)

    # Stream subscore
    if not stream.get("rtsp_available", True):
        stream_score = 0.0
    else:
        freeze = float(stream.get("freeze_score") or 0)
        fps = stream.get("fps")
        fps_s = 100.0 if fps is None else min(100.0, (float(fps) / 12.0) * 100.0)
        latency = stream.get("stream_latency")
        lat_s = 100.0 if latency is None else max(0.0, 100.0 - float(latency) * 40.0)
        stream_score = _clamp(0.5 * fps_s + 0.3 * lat_s + 0.2 * (100.0 - freeze * 100.0))

    # Visibility subscore — purpose weighted; empty scene does not tank score hard
    vis_parts: list[float] = []
    if visibility.get("expects_plate"):
        if visibility.get("plate_detected"):
            readable = str(visibility.get("plate_readable") or "POOR")
            base = float(visibility.get("plate_visibility") or 0) * 100.0
            if readable == "POOR":
                base *= 0.55
            elif readable == "FAIR":
                base *= 0.8
            vis_parts.append(base)
        else:
            # No plate in frame — mild penalty only (scene may be empty)
            vis_parts.append(70.0)
    if visibility.get("expects_face"):
        vis_parts.append(float(visibility.get("face_visibility") or 0) * 100.0 if visibility.get("face_detected") else 70.0)
    if visibility.get("expects_person") and "anpr" not in purposes_l:
        vis_parts.append(float(visibility.get("person_visibility") or 0) * 100.0 if visibility.get("person_detected") else 75.0)
    if visibility.get("expects_vehicle"):
        vis_parts.append(float(visibility.get("vehicle_visibility") or 0) * 100.0 if visibility.get("vehicle_detected") else 75.0)
    visibility_score = _clamp(sum(vis_parts) / len(vis_parts)) if vis_parts else 80.0

    overall = _clamp(0.45 * image_score + 0.30 * stream_score + 0.25 * visibility_score)

    if not stream.get("rtsp_available", True):
        status = "offline"
    elif overall >= 75:
        status = "healthy"
    elif overall >= 50:
        status = "degraded"
    else:
        status = "critical"

    return {
        "image_score": round(image_score, 1),
        "stream_score": round(stream_score, 1),
        "visibility_score": round(visibility_score, 1),
        "overall_score": round(overall, 1),
        "status": status,
    }
