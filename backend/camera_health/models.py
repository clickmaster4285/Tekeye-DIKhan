from django.db import models


class HealthStatus(models.TextChoices):
    HEALTHY = "healthy", "Healthy"
    DEGRADED = "degraded", "Degraded"
    CRITICAL = "critical", "Critical"
    OFFLINE = "offline", "Offline"
    UNKNOWN = "unknown", "Unknown"


class AlertSeverity(models.TextChoices):
    INFO = "info", "Info"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"
    CRITICAL = "critical", "Critical"


class CameraHealthSnapshot(models.Model):
    camera = models.ForeignKey(
        "cameras.Camera",
        on_delete=models.CASCADE,
        related_name="health_snapshots",
    )
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    brightness = models.FloatField(default=0)
    contrast = models.FloatField(default=0)
    sharpness = models.FloatField(default=0)
    noise = models.FloatField(default=0)
    exposure = models.FloatField(default=0, help_text="Mean brightness proxy")
    glare = models.FloatField(default=0)
    dark_ratio = models.FloatField(default=0)
    bright_ratio = models.FloatField(default=0)

    fps = models.FloatField(null=True, blank=True)
    freeze_score = models.FloatField(default=0)
    stream_latency = models.FloatField(null=True, blank=True)
    rtsp_available = models.BooleanField(default=True)

    person_visibility = models.FloatField(default=0)
    vehicle_visibility = models.FloatField(default=0)
    plate_visibility = models.FloatField(default=0)
    face_visibility = models.FloatField(default=0)

    obstruction_score = models.FloatField(default=0)
    overall_score = models.FloatField(default=0)
    status = models.CharField(
        max_length=16,
        choices=HealthStatus.choices,
        default=HealthStatus.UNKNOWN,
        db_index=True,
    )

    image_score = models.FloatField(default=0)
    stream_score = models.FloatField(default=0)
    visibility_score = models.FloatField(default=0)
    fingerprint = models.JSONField(default=list, blank=True)
    details = models.JSONField(default=dict, blank=True)
    recommendations = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["camera", "-timestamp"]),
            models.Index(fields=["status", "-timestamp"]),
        ]

    def __str__(self) -> str:
        return f"Health cam={self.camera_id} score={self.overall_score} @ {self.timestamp}"


class CameraHealthAlert(models.Model):
    camera = models.ForeignKey(
        "cameras.Camera",
        on_delete=models.CASCADE,
        related_name="health_alerts",
    )
    alert_type = models.CharField(max_length=64, db_index=True)
    severity = models.CharField(
        max_length=16,
        choices=AlertSeverity.choices,
        default=AlertSeverity.MEDIUM,
        db_index=True,
    )
    message = models.CharField(max_length=512)
    recommendation = models.TextField(blank=True, default="")
    first_detected = models.DateTimeField(auto_now_add=True)
    last_detected = models.DateTimeField(auto_now=True)
    resolved = models.BooleanField(default=False, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    snapshot = models.ForeignKey(
        CameraHealthSnapshot,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="alerts",
    )

    class Meta:
        ordering = ["-last_detected"]
        indexes = [
            models.Index(fields=["camera", "resolved", "-last_detected"]),
            models.Index(fields=["alert_type", "resolved"]),
        ]

    def __str__(self) -> str:
        return f"{self.alert_type} cam={self.camera_id} ({self.severity})"
