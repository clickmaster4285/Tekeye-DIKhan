from django.conf import settings
from django.db import models


class ConnectionMode(models.TextChoices):
    ML = "ml", "ML service only"
    DJANGO = "django", "Full Tekeye (Django + ML)"


class RemoteServer(models.Model):
    """Remote location for Central Ops — ML node or full Tekeye Django."""

    name = models.CharField(max_length=150, help_text="Display name e.g. DI Khan ML")
    location_code = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Optional site code e.g. DI_KHAN",
    )
    connection_mode = models.CharField(
        max_length=16,
        choices=ConnectionMode.choices,
        default=ConnectionMode.ML,
        help_text="ml = cameras from that ML /live/status; django = full remote API",
    )
    base_url = models.URLField(
        max_length=500,
        blank=True,
        default="",
        help_text="Django API root (django mode). Optional in ml mode.",
    )
    ml_base_url = models.URLField(
        max_length=500,
        blank=True,
        default="",
        help_text="ML service root e.g. http://192.168.199.12:8100",
    )
    auth_token = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="DRF Token for remote Django (django mode). Unused for ml mode.",
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")
    cached_cameras = models.JSONField(blank=True, default=list)
    cameras_fetched_at = models.DateTimeField(blank=True, null=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    last_health = models.CharField(max_length=32, blank=True, default="")
    last_error = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="remote_servers_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ops_central_remote_server"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.connection_mode})"

    def normalized_base_url(self) -> str:
        return (self.base_url or "").rstrip("/")

    def resolved_ml_base_url(self) -> str:
        explicit = (self.ml_base_url or "").strip().rstrip("/")
        if explicit:
            return explicit
        base = self.normalized_base_url()
        if not base:
            return ""
        from urllib.parse import urlparse, urlunparse

        parsed = urlparse(base)
        if parsed.port == 8000 and parsed.hostname:
            return urlunparse((parsed.scheme, f"{parsed.hostname}:8100", "", "", "", ""))
        return base

    def is_ml_mode(self) -> bool:
        return (self.connection_mode or ConnectionMode.ML) == ConnectionMode.ML
