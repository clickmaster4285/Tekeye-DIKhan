from django.conf import settings
from django.db import models


class OfficerGpsLatest(models.Model):
    """One row per officer — latest GPS fix for the live map."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="gps_latest",
    )
    latitude = models.FloatField()
    longitude = models.FloatField()
    accuracy_m = models.FloatField(null=True, blank=True)
    speed_kmh = models.FloatField(null=True, blank=True)
    heading_deg = models.FloatField(null=True, blank=True)
    altitude_m = models.FloatField(null=True, blank=True)
    recorded_at = models.DateTimeField(db_index=True)
    on_duty = models.BooleanField(default=False, db_index=True)
    duty_started_at = models.DateTimeField(null=True, blank=True)
    battery_pct = models.PositiveSmallIntegerField(null=True, blank=True)
    location = models.CharField(max_length=32, blank=True, default="", db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-recorded_at"]

    def __str__(self):
        name = getattr(self.user, "username", self.user_id)
        return f"{name} ({self.latitude:.5f}, {self.longitude:.5f})"


class OfficerGpsHistory(models.Model):
    """Trail of GPS pings for path / audit (keep recent days only)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="gps_history",
    )
    latitude = models.FloatField()
    longitude = models.FloatField()
    accuracy_m = models.FloatField(null=True, blank=True)
    speed_kmh = models.FloatField(null=True, blank=True)
    heading_deg = models.FloatField(null=True, blank=True)
    altitude_m = models.FloatField(null=True, blank=True)
    recorded_at = models.DateTimeField(db_index=True)
    battery_pct = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-recorded_at"]
        indexes = [
            models.Index(fields=["user", "-recorded_at"]),
        ]

    def __str__(self):
        return f"{self.user_id} @ {self.recorded_at}"
