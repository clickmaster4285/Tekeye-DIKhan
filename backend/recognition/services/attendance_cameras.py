"""Shared helpers for InsightFace CCTV attendance cameras."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Purposes that should auto-run attendance face matching.
ATTENDANCE_WORKER_PURPOSES = (
    "attendance",
    "face_recognition",
)


def attendance_camera_queryset(*, for_workers: bool = False):
    """
    Cameras shown / started on Attendance Monitor.

    Listing: every active camera (so all connected cams appear).
    Workers: prefer attendance-capable purposes; if none exist, fall back to
    all active cameras so newly connected cams still auto-start.
    """
    from cameras.models import Camera, CameraPurpose

    qs = Camera.objects.filter(is_active=True).select_related("nvr").order_by("code", "id")
    if not for_workers:
        return qs

    purpose_values = [
        CameraPurpose.ATTENDANCE,
        CameraPurpose.FACE_RECOGNITION,
    ]
    # Prefer cameras that list any attendance-capable purpose (JSON or primary)
    preferred_ids = [
        cam.pk
        for cam in qs
        if set(cam.purpose_list()) & set(purpose_values)
    ]
    preferred = qs.filter(pk__in=preferred_ids)
    if preferred.exists():
        return preferred
    # No dedicated attendance cams yet — start every active connected camera.
    return qs


def camera_rtsp_payload(cam) -> dict[str, Any] | None:
    try:
        url = cam.effective_stream_url()
    except Exception as exc:
        logger.warning("Attendance camera %s has no stream URL: %s", cam.id, exc)
        return None
    if not url:
        return None
    return {
        "id": cam.id,
        "name": cam.name or cam.code or f"Camera {cam.id}",
        "rtsp_url": url,
    }


def collect_attendance_camera_payloads(*, for_workers: bool = True) -> list[dict[str, Any]]:
    cameras: list[dict[str, Any]] = []
    for cam in attendance_camera_queryset(for_workers=for_workers):
        payload = camera_rtsp_payload(cam)
        if payload:
            cameras.append(payload)
    return cameras


def is_attendance_capable(cam) -> bool:
    """Any active camera with a stream can run on Attendance Monitor."""
    return bool(getattr(cam, "is_active", False))


def sync_camera_attendance_worker(cam, *, created: bool = False) -> None:
    """Start the InsightFace worker when a camera is created/updated (active)."""
    from recognition.services.cctv_worker import get_cctv_manager

    manager = get_cctv_manager()
    if not is_attendance_capable(cam):
        manager.stop_camera(cam.id)
        return

    payload = camera_rtsp_payload(cam)
    if not payload:
        manager.stop_camera(cam.id)
        return

    existing = manager.get_status(cam.id)
    if existing and existing.get("running"):
        # Already running — leave it (avoid reconnect storm on unrelated saves)
        return
    manager.start_camera(payload["id"], payload["name"], payload["rtsp_url"])
    logger.info(
        "Attendance CCTV worker %s for camera %s (%s)",
        "started" if created else "synced",
        cam.id,
        cam.name,
    )


def stop_camera_attendance_worker(camera_id: int) -> None:
    from recognition.services.cctv_worker import get_cctv_manager

    get_cctv_manager().stop_camera(int(camera_id))
