from django.db import models
from django.conf import settings
from django.db.models import Q, UniqueConstraint


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


class MobileDevice(models.Model):
    """One physical/browser install of the CIIS PWA."""

    STATUS_ACTIVE = "ACTIVE"
    STATUS_STALE = "STALE"
    STATUS_OFFLINE = "OFFLINE"
    STATUS_REVOKED = "REVOKED"
    STATUS_CHOICES = (
        (STATUS_ACTIVE, "Active"),
        (STATUS_STALE, "Stale"),
        (STATUS_OFFLINE, "Offline"),
        (STATUS_REVOKED, "Revoked"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mobile_devices",
    )
    device_uuid = models.CharField(max_length=64, unique=True, db_index=True)
    device_name = models.CharField(max_length=120, blank=True, default="")
    platform = models.CharField(max_length=40, blank=True, default="")
    browser = models.CharField(max_length=80, blank=True, default="")
    os_version = models.CharField(max_length=80, blank=True, default="")
    app_version = models.CharField(max_length=40, blank=True, default="")
    pwa_version = models.CharField(max_length=40, blank=True, default="")
    push_token = models.CharField(max_length=255, null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    is_revoked = models.BooleanField(default=False, db_index=True)
    mobile_access_enabled = models.BooleanField(default=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_ACTIVE, db_index=True)
    registered_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_gps_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_heartbeat_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_ip = models.GenericIPAddressField(null=True, blank=True)
    last_latitude = models.FloatField(null=True, blank=True)
    last_longitude = models.FloatField(null=True, blank=True)
    last_accuracy = models.FloatField(null=True, blank=True)
    battery_level = models.PositiveSmallIntegerField(null=True, blank=True)
    last_gps_status = models.CharField(max_length=32, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "-last_seen_at"]),
            models.Index(fields=["is_revoked", "is_active"]),
        ]

    def __str__(self):
        return f"{self.user_id} {self.device_uuid[:8]}"


class MobileAccessSession(models.Model):
    """Authoritative CIIS PWA login session (separate from lock/unlock stretches)."""

    STATUS_ACTIVE = "ACTIVE"
    STATUS_LOGGED_OUT = "LOGGED_OUT"
    STATUS_EXPIRED = "EXPIRED"
    STATUS_REVOKED = "REVOKED"
    STATUS_STALE = "STALE"
    STATUS_CHOICES = (
        (STATUS_ACTIVE, "Active"),
        (STATUS_LOGGED_OUT, "Logged out"),
        (STATUS_EXPIRED, "Expired"),
        (STATUS_REVOKED, "Revoked"),
        (STATUS_STALE, "Stale"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mobile_access_sessions",
    )
    device = models.ForeignKey(
        MobileDevice,
        on_delete=models.CASCADE,
        related_name="access_sessions",
    )
    session_id = models.CharField(max_length=64, unique=True, db_index=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_ACTIVE, db_index=True)
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    last_heartbeat_at = models.DateTimeField(null=True, blank=True)
    last_gps_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["device", "status"]),
        ]
        constraints = [
            UniqueConstraint(
                fields=["device"],
                condition=Q(status="ACTIVE"),
                name="uniq_active_mobile_access_session_per_device",
            ),
        ]

    def __str__(self):
        return f"{self.user_id} {self.status} {self.session_id[:8]}"


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
    device = models.ForeignKey(
        MobileDevice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lock_sessions",
    )
    access_session = models.ForeignKey(
        MobileAccessSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lock_sessions",
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


class MobileAlert(models.Model):
    SEVERITY_INFO = "INFO"
    SEVERITY_WARNING = "WARNING"
    SEVERITY_CRITICAL = "CRITICAL"
    SEVERITY_CHOICES = (
        (SEVERITY_INFO, "Info"),
        (SEVERITY_WARNING, "Warning"),
        (SEVERITY_CRITICAL, "Critical"),
    )

    TYPE_DEVICE_OFFLINE = "DEVICE_OFFLINE"
    TYPE_DEVICE_OFFLINE_EXTENDED = "DEVICE_OFFLINE_EXTENDED"
    TYPE_GPS_OFFLINE = "GPS_OFFLINE"
    TYPE_GPS_PERMISSION_DENIED = "GPS_PERMISSION_DENIED"
    TYPE_GPS_PERMISSION_REVOKED = "GPS_PERMISSION_REVOKED"
    TYPE_SESSION_EXPIRED = "SESSION_EXPIRED"
    TYPE_SESSION_REVOKED = "SESSION_REVOKED"
    TYPE_MULTIPLE_DEVICE_LOGIN = "MULTIPLE_DEVICE_LOGIN"
    TYPE_NEW_DEVICE = "NEW_DEVICE"
    TYPE_DEVICE_REVOKED = "DEVICE_REVOKED"
    TYPE_APP_VERSION_OUTDATED = "APP_VERSION_OUTDATED"
    TYPE_SUSPICIOUS_LOCATION_JUMP = "SUSPICIOUS_LOCATION_JUMP"
    TYPE_ATTENDANCE_WITHOUT_GPS = "ATTENDANCE_WITHOUT_GPS"
    TYPE_GPS_WITHOUT_ACTIVE_SESSION = "GPS_WITHOUT_ACTIVE_SESSION"
    TYPE_DEVICE_RECONNECTED = "DEVICE_RECONNECTED"
    TYPE_GPS_PROBLEM = "GPS_PROBLEM"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mobile_alerts",
    )
    device = models.ForeignKey(
        MobileDevice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="alerts",
    )
    session = models.ForeignKey(
        MobileAccessSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="alerts",
    )
    alert_type = models.CharField(max_length=48, db_index=True)
    severity = models.CharField(max_length=16, choices=SEVERITY_CHOICES, default=SEVERITY_WARNING, db_index=True)
    message = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    detected_at = models.DateTimeField()
    resolved_at = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="acknowledged_mobile_alerts",
    )
    is_active = models.BooleanField(default=True, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "alert_type", "is_active"]),
            models.Index(fields=["-detected_at"]),
        ]

    def __str__(self):
        return f"{self.alert_type} {self.user_id}"


class MobileEventReceipt(models.Model):
    """Idempotency keys for GPS/heartbeat/offline uploads."""

    event_id = models.CharField(max_length=64, unique=True)
    event_type = models.CharField(max_length=40)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mobile_event_receipts",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.event_id
