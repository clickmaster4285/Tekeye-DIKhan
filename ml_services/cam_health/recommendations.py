"""Rule-engine recommendations for camera health issues."""

from __future__ import annotations

from typing import Any


def build_recommendations(
    image: dict[str, Any],
    stream: dict[str, Any],
    visibility: dict[str, Any],
    scores: dict[str, Any],
) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []

    def add(alert_type: str, severity: str, message: str, recommendation: str) -> None:
        out.append(
            {
                "alert_type": alert_type,
                "severity": severity,
                "message": message,
                "recommendation": recommendation,
            }
        )

    if not stream.get("rtsp_available", True):
        add(
            "rtsp_unavailable",
            "critical",
            "Camera stream is not available",
            "Check NVR power, network route, and RTSP credentials / channel mapping.",
        )
        return out

    sharp = float(image.get("sharpness") or 0)
    if sharp < 40:
        add(
            "blur",
            "high" if sharp < 25 else "medium",
            f"Image is soft / blurry (sharpness {sharp:.0f})",
            "Clean the lens, check focus, and verify the dome cover is dry and unscratched.",
        )

    bright = float(image.get("brightness") or 0)
    dark_r = float(image.get("dark_ratio") or 0)
    bright_r = float(image.get("bright_ratio") or 0)
    if dark_r > 0.35 or bright < 50:
        add(
            "low_light",
            "high" if dark_r > 0.55 else "medium",
            "Scene is too dark for reliable AI detection",
            "Enable IR / increase lux, adjust exposure, or add lighting in the monitored zone.",
        )
    if bright_r > 0.25 or bright > 200:
        add(
            "overexposure",
            "high" if bright_r > 0.4 else "medium",
            "Scene is overexposed / washed out",
            "Reduce exposure/gain, avoid pointing at strong light sources, enable WDR if available.",
        )

    contrast = float(image.get("contrast") or 0)
    if contrast < 18:
        add(
            "low_contrast",
            "medium",
            "Low contrast reduces object separation",
            "Adjust camera contrast/WDR and avoid heavy fog or dirty covers.",
        )

    freeze = float(stream.get("freeze_score") or 0)
    if freeze >= 0.85:
        add(
            "frozen_frame",
            "critical",
            "Stream appears frozen (identical frames)",
            "Restart the camera channel on the NVR and verify uplink bandwidth.",
        )

    fps = stream.get("fps")
    if fps is not None and float(fps) < 5:
        add(
            "low_fps",
            "high",
            f"Low stream FPS ({fps})",
            "Reduce camera resolution/bitrate or improve network capacity to the ML server.",
        )

    latency = stream.get("stream_latency")
    if latency is not None and float(latency) > 3.0:
        add(
            "high_latency",
            "medium",
            f"Frame arrival delay is high ({float(latency):.1f}s)",
            "Check network jitter and ML server load; prefer a closer ML node for this camera.",
        )

    if visibility.get("expects_plate"):
        if not visibility.get("plate_detected"):
            add(
                "plate_visibility",
                "medium",
                "No license plate detected in the health sample",
                "Confirm ROI covers the lane, camera angle shows plates clearly, and ANPR purpose is assigned.",
            )
        elif str(visibility.get("plate_readable") or "") == "POOR":
            size = visibility.get("plate_size") or {}
            add(
                "plate_too_small",
                "high",
                f"Plate detected but too small for reliable OCR ({size.get('width', 0)}×{size.get('height', 0)})",
                "Zoom optically / move camera closer / tighten ROI on the capture zone.",
            )

    if visibility.get("expects_face") and not visibility.get("face_detected") and float(scores.get("image_score") or 0) < 60:
        add(
            "face_visibility",
            "medium",
            "Face recognition camera has poor image quality and no face in sample",
            "Improve lighting at the doorway and ensure the face enters the ROI at usable size.",
        )

    glare = float(image.get("glare") or 0)
    if glare > 0.08:
        add(
            "glare",
            "medium",
            "Specular glare detected in the frame",
            "Re-angle the camera or shade glass/floor reflections that wash out the scene.",
        )

    if not out and float(scores.get("overall_score") or 0) >= 75:
        add(
            "healthy",
            "info",
            "Camera health looks good for AI use",
            "No action required. Continue periodic monitoring.",
        )

    return out
