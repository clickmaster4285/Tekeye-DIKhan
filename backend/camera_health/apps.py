from django.apps import AppConfig


class CameraHealthConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "camera_health"
    verbose_name = "Camera Health & AI Suggestions"

    def ready(self):
        import sys

        if "migrate" in sys.argv or "makemigrations" in sys.argv:
            return
        try:
            from config.runtime import skip_embedded_background_workers

            if skip_embedded_background_workers():
                return
        except Exception:
            if "runserver" in sys.argv:
                # Still allow worker under runserver unless explicitly skipped
                pass
        try:
            from .worker import maybe_start_health_worker

            maybe_start_health_worker()
        except Exception:
            import logging

            logging.getLogger(__name__).exception("[camera-health] Could not start worker")
