from django.apps import AppConfig


class RealtimeConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "realtime"
    label = "realtime"
    verbose_name = "Realtime (Socket.IO)"

    def ready(self):
        # Register model → socket emitters
        from . import signals  # noqa: F401
