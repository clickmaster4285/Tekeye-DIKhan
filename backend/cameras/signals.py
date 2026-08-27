"""Re-sync camera streams to ML when camera/NVR records change."""

from __future__ import annotations

import logging
import threading

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


@receiver(post_save, sender=Camera)
def camera_saved_sync_ml(sender, instance: Camera, created: bool = False, **kwargs) -> None:
    _schedule_ml_camera_sync()
    # Auto-start / sync InsightFace attendance worker for this camera
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
    try:
        from recognition.services.attendance_cameras import stop_camera_attendance_worker

        stop_camera_attendance_worker(instance.pk)
    except Exception:
        logger.exception(
            "[camera-sync] Could not stop attendance worker for camera %s",
            instance.pk,
        )
    try:
        from ml.client import ml_service_enabled, ml_unregister_camera

        if ml_service_enabled():
            ml_unregister_camera(instance.stream_key)
            # Also stop person-journey pipeline for this camera
            import requests
            from django.conf import settings

            base = getattr(settings, "ML_SERVICE_URL", "").rstrip("/")
            if base:
                requests.delete(f"{base}/journey/cam/{instance.stream_key}", timeout=5)
    except Exception:
        logger.exception("[camera-sync] Could not unregister camera %s from ML", instance.pk)
    _schedule_ml_camera_sync()
    try:
        from person_journey.journey_worker import sync_cameras_to_journey_ml

        sync_cameras_to_journey_ml()
    except Exception:
        logger.exception("[camera-sync] Journey re-sync after delete failed")


@receiver(post_save, sender=Nvr)
def nvr_saved_sync_ml(sender, instance: Nvr, **kwargs) -> None:
    _schedule_ml_camera_sync()
