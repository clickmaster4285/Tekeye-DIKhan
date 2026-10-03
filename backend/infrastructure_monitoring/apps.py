from django.apps import AppConfig


class InfrastructureMonitoringConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "infrastructure_monitoring"
    verbose_name = "Infrastructure Monitoring"

    def ready(self):
        import sys

        if "migrate" in sys.argv or "makemigrations" in sys.argv:
            return
        try:
            from config.runtime import skip_embedded_background_workers

            if skip_embedded_background_workers():
                return
        except Exception:
            pass
        try:
            from .worker import maybe_start_infra_worker

            maybe_start_infra_worker()
        except Exception:
            import logging

            logging.getLogger(__name__).exception(
                "[infra-monitor] Could not start worker"
            )
