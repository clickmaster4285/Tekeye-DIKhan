import sys

from django.apps import AppConfig
from django.conf import settings


class RecognitionConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "recognition"
    verbose_name = "Face Recognition Attendance"

    def ready(self):
        if not getattr(settings, "ATTENDANCE_CCTV_AUTOSTART", True):
            return

        # Skip management commands (migrate, shell, test, ...) — only start
        # with a real server process. runserver stays HTTP-only; CCTV boots
        # from `run_background_workers` instead.
        argv = " ".join(sys.argv).lower()
        is_wsgi_server = any(k in argv for k in ("gunicorn", "daphne", "uvicorn", "waitress"))
        if "runserver" in argv or not is_wsgi_server:
            return

        from recognition.services.autostart import schedule_autostart

        schedule_autostart(delay_seconds=3.0)
