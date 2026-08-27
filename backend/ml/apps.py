import logging
import os
import sys
import threading

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class MlConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "ml"

    def ready(self):
        # runserver autoreload parent — skip; gunicorn / worker have no RUN_MAIN
        if "runserver" in sys.argv and os.environ.get("RUN_MAIN") != "true":
            return
        if "migrate" in sys.argv or "makemigrations" in sys.argv:
            return

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
                        "[face-sync] ML known faces loaded: %s (%s from DB)",
                        result.get("known_faces", 0),
                        result.get("db_embeddings", 0),
                    )
                from .camera_sync import sync_cameras_to_ml

                sync_cameras_to_ml()
            except Exception:
                logger.exception("[face-sync] Could not push face embeddings to ML")
            finally:
                from config.db import release_db

                release_db()

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
