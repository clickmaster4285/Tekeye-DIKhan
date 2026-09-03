from django.apps import AppConfig


class OpsCentralConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "ops_central"
    verbose_name = "Central Ops (Remote Servers)"

    def ready(self) -> None:
        from . import signals  # noqa: F401
