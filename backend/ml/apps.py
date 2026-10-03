import logging
import os
import sys
import threading

from django.apps import AppConfig

logger = logging.getLogger(__name__)

# ML service state (which cameras it should serve) lives only in that process's
# memory — a restart/reload of ml_services wipes it silently, leaving Django
# thinking a camera is "allocated" while the ML node has no idea. Re-pushing on
# this interval means any such drift self-heals within one cycle instead of
# needing a manual `sync_ml_cameras` run.
_CAMERA_SYNC_INTERVAL_SEC = max(15, int(os.getenv("ML_CAMERA_SYNC_INTERVAL_SEC", "45")))


class MlConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "ml"

    def ready(self):
        # runserver autoreload parent — skip; gunicorn / worker have no RUN_MAIN
        if "runserver" in sys.argv and os.environ.get("RUN_MAIN") != "true":
            return
        if "migrate" in sys.argv or "makemigrations" in sys.argv:
            return

        def _periodic_camera_sync() -> None:
            try:
                from django.db import close_old_connections

                close_old_connections()
                from .camera_sync import sync_cameras_to_ml

                sync_cameras_to_ml()
            except Exception:
                logger.exception("[camera-sync] Periodic re-sync failed")
            finally:
                from config.db import release_db

                release_db()
                _schedule_periodic_camera_sync()

        def _schedule_periodic_camera_sync() -> None:
            try:
                timer = threading.Timer(_CAMERA_SYNC_INTERVAL_SEC, _periodic_camera_sync)
                timer.daemon = True
                timer.start()
            except Exception:
                logger.exception("[camera-sync] Could not schedule periodic camera sync")

        def _deferred_face_reload() -> None:
            try:
                from django.db import close_old_connections

                close_old_connections()
                from .face_sync import enroll_missing_staff_faces, push_face_embeddings_to_ml

                enrolled, skipped = enroll_missing_staff_faces(push_ml=False)
                if enrolled:
                    logger.info("[face-sync] Auto-enrolled %s staff face(s) on startup (skipped %s)", enrolled, skipped)
                result = push_face_embeddings_to_ml()
                if result:
                    logger.info(
                        "[face-sync] ML known faces loaded on %s/%s node(s) (%s embeddings): %s",
                        result.get("ok_count", 0),
                        result.get("total", 0),
                        result.get("db_embeddings", result.get("known_faces", 0)),
                        list((result.get("by_server") or {}).keys()),
                    )
                from .camera_sync import sync_cameras_to_ml

                sync_cameras_to_ml()
            except Exception:
                logger.exception("[face-sync] Could not push face embeddings to ML")
            finally:
                from config.db import release_db

                release_db()
                _schedule_periodic_camera_sync()

        try:
            from config.runtime import skip_embedded_background_workers

            if skip_embedded_background_workers() and "run_background_workers" not in sys.argv:
                return
        except Exception:
            if "runserver" in sys.argv:
                return

        try:
            threading.Timer(5.0, _deferred_face_reload).start()
        except Exception:
            logger.exception("[face-sync] Could not schedule ML face reload")
