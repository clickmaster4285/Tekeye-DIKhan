"""Re-sync camera streams to ML when camera/NVR records change."""

from __future__ import annotations

import logging
import threading

from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Camera, Nvr

logger = logging.getLogger(__name__)
_sync_timer: threading.Timer | None = None
_sync_lock = threading.Lock()


def _schedule_ml_camera_sync() -> None:
    global _sync_timer

    def _run() -> None:
        try:
            from ml.camera_sync import sync_cameras_to_ml

            sync_cameras_to_ml()
        except Exception:
            logger.exception("[camera-sync] Deferred sync failed")

    with _sync_lock:
        if _sync_timer is not None:
            _sync_timer.cancel()
        _sync_timer = threading.Timer(2.0, _run)
        _sync_timer.daemon = True
        _sync_timer.start()


def _camera_delete_cleanup(
    *,
    camera_id: int,
    stream_key: str,
    ml_base_url: str,
) -> None:
    """Stop workers / unregister ML / re-sync — runs after HTTP delete returns."""
    try:
        from recognition.services.attendance_cameras import stop_camera_attendance_worker

        stop_camera_attendance_worker(camera_id)
    except Exception:
        logger.exception(
            "[camera-sync] Could not stop attendance worker for camera %s",
            camera_id,
        )

    try:
        from ml.client import ml_service_enabled, ml_unregister_camera_at

        if ml_service_enabled() and ml_base_url and stream_key:
            ml_unregister_camera_at(ml_base_url, stream_key, timeout=(2.0, 8.0))
            import requests

            try:
                requests.delete(f"{ml_base_url}/journey/cam/{stream_key}", timeout=5)
            except Exception:
                pass
    except Exception:
        logger.exception("[camera-sync] Could not unregister camera %s from ML", camera_id)

    _schedule_ml_camera_sync()

    try:
        from person_journey.journey_worker import sync_cameras_to_journey_ml

        sync_cameras_to_journey_ml()
    except Exception:
        logger.exception("[camera-sync] Journey re-sync after delete failed")


@receiver(post_save, sender=Camera)
def camera_saved_sync_ml(sender, instance: Camera, created: bool = False, **kwargs) -> None:
    _schedule_ml_camera_sync()
    try:
        from config.runtime import skip_embedded_background_workers

        if skip_embedded_background_workers():
            return
    except Exception:
        import sys

        if "runserver" in sys.argv:
            return
    # Auto-start / sync InsightFace attendance worker for this camera (WSGI / worker process only)
    try:
        from recognition.services.attendance_cameras import sync_camera_attendance_worker

        def _run():
            try:
                sync_camera_attendance_worker(instance, created=created)
            except Exception:
                logger.exception(
                    "[camera-sync] Attendance worker sync failed for camera %s",
                    instance.pk,
                )

        threading.Thread(
            target=_run,
            name=f"attendance-cam-sync-{instance.pk}",
            daemon=True,
        ).start()
    except Exception:
        logger.exception("[camera-sync] Could not schedule attendance worker sync")


@receiver(post_delete, sender=Camera)
def camera_deleted_sync_ml(sender, instance: Camera, **kwargs) -> None:
    """DB row is already gone — queue ML/worker cleanup after commit so DELETE returns fast."""
    camera_id = int(instance.pk)
    stream_key = (instance.stream_key or f"cam-{camera_id}").strip()
    ml_base_url = ""
    try:
        server = getattr(instance, "ml_server", None)
        if instance.ml_server_id and server is not None:
            ml_base_url = (server.resolved_ml_base_url() or "").strip().rstrip("/")
    except Exception:
        ml_base_url = ""

    def _queue_cleanup() -> None:
        threading.Thread(
            target=_camera_delete_cleanup,
            kwargs={
                "camera_id": camera_id,
                "stream_key": stream_key,
                "ml_base_url": ml_base_url,
            },
            name=f"camera-delete-cleanup-{camera_id}",
            daemon=True,
        ).start()

    transaction.on_commit(_queue_cleanup)


@receiver(post_save, sender=Nvr)
def nvr_saved_sync_ml(sender, instance: Nvr, **kwargs) -> None:
    _schedule_ml_camera_sync()
