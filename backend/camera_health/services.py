"""Run camera health analysis and persist snapshots / alerts."""

from __future__ import annotations

import io
import json
import logging
import sys
from pathlib import Path
from typing import Any

import requests
from django.conf import settings
from django.utils import timezone

from cameras.models import Camera
from ml.client import (
    MLServiceError,
    known_ml_base_urls,
    ml_live_jpeg_raw_url_for_camera,
    ml_service_enabled,
)

from .models import CameraHealthAlert, CameraHealthSnapshot, HealthStatus

logger = logging.getLogger(__name__)


def _ml_services_on_path() -> None:
    root = Path(getattr(settings, "BASE_DIR", Path.cwd())).parent
    ml_dir = root / "ml_services"
    if ml_dir.is_dir():
        path = str(ml_dir)
        if path not in sys.path:
            sys.path.insert(0, path)


def _analyze_local(
    frame_bytes: bytes | None,
    *,
    purposes: list[str],
    roi: dict | None,
    detections: list | None,
    previous_fingerprint: list | None,
    rtsp_available: bool,
    fps: float | None,
    frame_age_sec: float | None,
) -> dict[str, Any]:
    # ml_services/cam_health — must not collide with Django app package `camera_health`
    _ml_services_on_path()
    from cam_health.analyzer import analyze_camera_health, decode_image_bytes

    frame = decode_image_bytes(frame_bytes) if frame_bytes else None
    return analyze_camera_health(
        frame,
        purposes=purposes,
        roi=roi,
        detections=detections,
        previous_fingerprint=previous_fingerprint,
        rtsp_available=rtsp_available,
        fps=fps,
        frame_age_sec=frame_age_sec,
    )


def _analyze_via_ml(
    frame_bytes: bytes | None,
    *,
    purposes: list[str],
    roi: dict | None,
    detections: list | None,
    previous_fingerprint: list | None,
    rtsp_available: bool,
    fps: float | None,
    frame_age_sec: float | None,
    camera_key: str,
) -> dict[str, Any]:
    urls = known_ml_base_urls()
    if not urls:
        raise MLServiceError("No ML service URL", 503)
    base = urls[0]
    files = {}
    if frame_bytes:
        files["image"] = ("frame.jpg", io.BytesIO(frame_bytes), "image/jpeg")
    data = {
        "purposes": ",".join(purposes),
        "roi_json": json.dumps(roi or {}),
        "detections_json": json.dumps(detections or []),
        "previous_fingerprint_json": json.dumps(previous_fingerprint or []),
        "rtsp_available": "true" if rtsp_available else "false",
        "camera_key": camera_key,
    }
    if fps is not None:
        data["fps"] = str(fps)
    if frame_age_sec is not None:
        data["frame_age_sec"] = str(frame_age_sec)
    timeout = int(getattr(settings, "ML_SERVICE_TIMEOUT", 60))
    res = requests.post(
        f"{base}/camera-health/analyze",
        data=data,
        files=files or None,
        timeout=timeout,
    )
    if res.status_code >= 400:
        raise MLServiceError(f"Camera health analyze failed ({res.status_code})", res.status_code)
    return res.json()


def _fetch_frame_bytes(camera: Camera) -> tuple[bytes | None, bool]:
    if not ml_service_enabled():
        return None, False
    urls: list[str] = []
    try:
        urls.append(ml_live_jpeg_raw_url_for_camera(camera))
    except Exception as exc:
        logger.debug("[camera-health] assigned jpeg url failed cam=%s: %s", camera.pk, exc)
    try:
        from ml.client import ml_live_jpeg_raw_url

        key = str(getattr(camera, "stream_key", None) or camera.code or camera.pk)
        rtsp = ""
        try:
            rtsp = camera.effective_stream_url() or ""
        except Exception:
            rtsp = ""
        urls.append(ml_live_jpeg_raw_url(key, rtsp or None))
    except Exception:
        pass

    seen: set[str] = set()
    for url in urls:
        if not url or url in seen:
            continue
        seen.add(url)
        try:
            res = requests.get(url, timeout=(3.0, 12.0))
            if res.status_code == 200 and res.content and len(res.content) > 100:
                return res.content, True
        except requests.RequestException as exc:
            logger.debug("[camera-health] jpeg fetch failed cam=%s url=%s: %s", camera.pk, url, exc)
    return None, False


def _offline_result(message: str) -> dict[str, Any]:
    return {
        "image": {
            "sharpness": 0,
            "brightness": 0,
            "contrast": 0,
            "dark_ratio": 1.0,
            "bright_ratio": 0.0,
            "overexposure": 0.0,
            "noise": 0,
            "glare": 0,
            "color_abnormality": 0,
            "resolution": {"width": 0, "height": 0, "megapixels": 0},
            "fingerprint": [],
        },
        "stream": {
            "rtsp_available": False,
            "fps": None,
            "dropped_frames": None,
            "freeze_score": 1.0,
            "stream_latency": None,
            "frame_arrival_delay": None,
        },
        "visibility": {},
        "scores": {
            "image_score": 0,
            "stream_score": 0,
            "visibility_score": 0,
            "overall_score": 0,
            "status": HealthStatus.OFFLINE,
        },
        "alerts": [
            {
                "alert_type": "rtsp_unavailable",
                "severity": "critical",
                "message": message,
                "recommendation": "Ensure the camera is assigned to an ML server, RTSP is reachable, and click Scan again.",
            }
        ],
        "overall_score": 0,
        "status": HealthStatus.OFFLINE,
    }


def _fetch_detections(camera: Camera) -> list[dict]:
    try:
        from ml.client import ml_live_detections_for_camera

        data = ml_live_detections_for_camera(camera)
        dets = data.get("detections") if isinstance(data, dict) else None
        return dets if isinstance(dets, list) else []
    except Exception:
        return []


def _previous_fingerprint(camera: Camera) -> list | None:
    last = (
        CameraHealthSnapshot.objects.filter(camera=camera)
        .order_by("-timestamp")
        .values_list("fingerprint", flat=True)
        .first()
    )
    return last if isinstance(last, list) else None


def analyze_and_store(camera: Camera) -> CameraHealthSnapshot:
    purposes = camera.purpose_list()
    roi = getattr(camera, "health_roi", None)
    if not isinstance(roi, dict):
        roi = None

    frame_bytes, got_frame = _fetch_frame_bytes(camera)
    detections = _fetch_detections(camera) if got_frame else []
    prev_fp = _previous_fingerprint(camera)

    fps = None
    try:
        fps = float(str(camera.frame_rate).split()[0])
    except (TypeError, ValueError):
        fps = None

    # Prefer local OpenCV analyzer (avoids depending on ML server restart for new routes).
    try:
        result = _analyze_local(
            frame_bytes,
            purposes=purposes,
            roi=roi,
            detections=detections,
            previous_fingerprint=prev_fp,
            rtsp_available=got_frame,
            fps=fps,
            frame_age_sec=None,
        )
    except Exception as local_exc:
        logger.info("[camera-health] local analyze failed cam=%s: %s", camera.pk, local_exc)
        try:
            result = _analyze_via_ml(
                frame_bytes,
                purposes=purposes,
                roi=roi,
                detections=detections,
                previous_fingerprint=prev_fp,
                rtsp_available=got_frame,
                fps=fps,
                frame_age_sec=None,
                camera_key=str(getattr(camera, "stream_key", None) or camera.code or camera.pk),
            )
        except Exception as ml_exc:
            logger.exception("[camera-health] ML analyze also failed cam=%s: %s", camera.pk, ml_exc)
            result = _offline_result(
                f"Could not analyze camera frame ({type(local_exc).__name__})"
                if got_frame
                else "No live frame available from ML server"
            )

    image = result.get("image") or {}
    stream = result.get("stream") or {}
    visibility = result.get("visibility") or {}
    scores = result.get("scores") or {}
    alerts = result.get("alerts") or []

    status = str(scores.get("status") or result.get("status") or HealthStatus.UNKNOWN)
    if status not in {c.value for c in HealthStatus}:
        status = HealthStatus.UNKNOWN

    snap = CameraHealthSnapshot.objects.create(
        camera=camera,
        brightness=float(image.get("brightness") or 0),
        contrast=float(image.get("contrast") or 0),
        sharpness=float(image.get("sharpness") or 0),
        noise=float(image.get("noise") or 0),
        exposure=float(image.get("brightness") or 0),
        glare=float(image.get("glare") or 0),
        dark_ratio=float(image.get("dark_ratio") or 0),
        bright_ratio=float(image.get("bright_ratio") or 0),
        fps=stream.get("fps"),
        freeze_score=float(stream.get("freeze_score") or 0),
        stream_latency=stream.get("stream_latency"),
        rtsp_available=bool(stream.get("rtsp_available", got_frame)),
        person_visibility=float(visibility.get("person_visibility") or 0),
        vehicle_visibility=float(visibility.get("vehicle_visibility") or 0),
        plate_visibility=float(visibility.get("plate_visibility") or 0),
        face_visibility=float(visibility.get("face_visibility") or 0),
        obstruction_score=0.0,
        overall_score=float(scores.get("overall_score") or result.get("overall_score") or 0),
        status=status,
        image_score=float(scores.get("image_score") or 0),
        stream_score=float(scores.get("stream_score") or 0),
        visibility_score=float(scores.get("visibility_score") or 0),
        fingerprint=image.get("fingerprint") or [],
        details={
            "visibility": visibility,
            "resolution": image.get("resolution"),
            "roi_applied": result.get("roi_applied"),
            "frame_diff": result.get("frame_diff"),
            "color_abnormality": image.get("color_abnormality"),
        },
        recommendations=alerts if isinstance(alerts, list) else [],
    )

    _upsert_alerts(camera, snap, alerts if isinstance(alerts, list) else [])
    return snap


def _upsert_alerts(camera: Camera, snap: CameraHealthSnapshot, alerts: list[dict]) -> None:
    now = timezone.now()
    active_types: set[str] = set()
    for row in alerts:
        alert_type = str(row.get("alert_type") or "").strip()
        if not alert_type or alert_type == "healthy":
            continue
        active_types.add(alert_type)
        severity = str(row.get("severity") or "medium")
        message = str(row.get("message") or alert_type)[:512]
        recommendation = str(row.get("recommendation") or "")
        existing = (
            CameraHealthAlert.objects.filter(
                camera=camera, alert_type=alert_type, resolved=False
            )
            .order_by("-last_detected")
            .first()
        )
        if existing:
            existing.severity = severity
            existing.message = message
            existing.recommendation = recommendation
            existing.snapshot = snap
            existing.last_detected = now
            existing.save(
                update_fields=[
                    "severity",
                    "message",
                    "recommendation",
                    "snapshot",
                    "last_detected",
                ]
            )
        else:
            CameraHealthAlert.objects.create(
                camera=camera,
                alert_type=alert_type,
                severity=severity,
                message=message,
                recommendation=recommendation,
                snapshot=snap,
            )

    # Resolve alerts no longer present (except info/healthy)
    CameraHealthAlert.objects.filter(camera=camera, resolved=False).exclude(
        alert_type__in=active_types
    ).exclude(alert_type="healthy").update(resolved=True, resolved_at=now)


def scan_all_cameras(*, limit: int | None = None) -> dict[str, Any]:
    qs = Camera.objects.filter(is_active=True).select_related("nvr", "nvr__site")
    if limit:
        qs = qs[: int(limit)]
    ok = 0
    failed = 0
    snapshots = []
    for cam in qs:
        try:
            snap = analyze_and_store(cam)
            snapshots.append(snap.id)
            ok += 1
        except Exception:
            logger.exception("[camera-health] scan failed cam=%s", cam.pk)
            failed += 1
    return {"ok": ok, "failed": failed, "snapshot_ids": snapshots}


def latest_summaries() -> list[dict[str, Any]]:
    cameras = Camera.objects.filter(is_active=True).select_related("nvr", "nvr__site")
    rows = []
    for cam in cameras:
        latest = (
            CameraHealthSnapshot.objects.filter(camera=cam).order_by("-timestamp").first()
        )
        open_alerts = CameraHealthAlert.objects.filter(camera=cam, resolved=False).count()
        top_rec = ""
        if latest and isinstance(latest.recommendations, list) and latest.recommendations:
            first = latest.recommendations[0]
            if isinstance(first, dict):
                top_rec = str(first.get("recommendation") or first.get("message") or "")
        rows.append(
            {
                "camera_id": cam.id,
                "code": cam.code or str(cam.id),
                "name": cam.name,
                "zone": cam.zone or "",
                "location": cam.location or "",
                "purposes": cam.purpose_list(),
                "health_roi": getattr(cam, "health_roi", None) or None,
                "status": latest.status if latest else HealthStatus.UNKNOWN,
                "overall_score": float(latest.overall_score) if latest else 0.0,
                "last_checked": latest.timestamp if latest else None,
                "open_alerts": open_alerts,
                "top_recommendation": top_rec,
                "latest": latest,
            }
        )
    rows.sort(key=lambda r: (0 if r["status"] == "critical" else 1 if r["status"] == "degraded" else 2, r["overall_score"]))
    return rows
