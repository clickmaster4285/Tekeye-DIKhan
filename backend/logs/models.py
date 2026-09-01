from django.db import models
from django.conf import settings


class UserActivityLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    country = models.CharField(max_length=100, null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    device = models.CharField(max_length=50, null=True, blank=True)
    os = models.CharField(max_length=50, null=True, blank=True)
    browser = models.CharField(max_length=50, null=True, blank=True)
    action = models.CharField(max_length=255)
    source = models.CharField(max_length=20, default="web", db_index=True)
    time = models.DateTimeField(auto_now_add=True)

    @property
    def username(self):
        return self.user.username if self.user_id else None

    def __str__(self):
        return f"{self.user} - {self.action}"


class MobilePhoneSession(models.Model):
    """One stretch of phone use or phone lock, with duration when it ends."""

    STATE_USING = "using"
    STATE_LOCKED = "locked"
    STATE_CHOICES = (
        (STATE_USING, "Using"),
        (STATE_LOCKED, "Locked"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mobile_phone_sessions",
    )
    state = models.CharField(max_length=16, choices=STATE_CHOICES)
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "-started_at"]),
            models.Index(fields=["ended_at"]),
        ]

    def __str__(self):
        return f"{self.user} {self.state} {self.started_at}"