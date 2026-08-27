from django.apps import AppConfig


class PersonJourneyConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "person_journey"
    verbose_name = "Person Journey"

    def ready(self):
        from . import signals  # noqa: F401

        try:
            from config.runtime import skip_embedded_background_workers

            if skip_embedded_background_workers():
                return
        except Exception:
            import sys

            if "runserver" in sys.argv:
                return

        if self._journey_worker_enabled():
            self._start_journey_worker()
        self._start_live_ingest()

    def _start_live_ingest(self):
        from .live_worker import start_live_ingest_worker

        start_live_ingest_worker()

    def _journey_worker_enabled(self) -> bool:
        from django.conf import settings

        return bool(getattr(settings, "PERSON_JOURNEY_WORKER_ENABLED", False))

    def _start_journey_worker(self):
        from .journey_worker import start_journey_worker_thread

        start_journey_worker_thread()
