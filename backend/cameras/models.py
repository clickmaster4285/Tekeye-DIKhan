from django.db import models


class CameraPurpose(models.TextChoices):
    """Each value maps to one ML model (or one focused pipeline). Multi-select = union."""

    GENERAL_OBJECTS = "general_objects", "General Objects (YOLO)"
    CUSTOM_OBJECTS = "custom_objects", "Custom Objects"
    SMOKE_FIRE = "smoke_fire", "Fire & Smoke"
    WEAPON = "weapon", "Weapon Detection"
    FACE_RECOGNITION = "face_recognition", "Face Recognition"
    ATTENDANCE = "attendance", "Attendance Check-in"
    ANPR = "anpr", "ANPR / License Plates"
    # Legacy codes kept so existing DB rows remain valid until normalized on save
    OBJECT_DETECTION = "object_detection", "General Objects (YOLO)"
    SURVEILLANCE = "surveillance", "General Objects (YOLO)"
    ZONE_MONITORING = "zone_monitoring", "General Objects (YOLO)"
    THERMAL = "thermal", "Fire & Smoke"


# Map old purpose codes → current model-centric codes
PURPOSE_ALIASES: dict[str, str] = {
    "object_detection": CameraPurpose.GENERAL_OBJECTS,
    "surveillance": CameraPurpose.GENERAL_OBJECTS,
    "zone_monitoring": CameraPurpose.GENERAL_OBJECTS,
    "thermal": CameraPurpose.SMOKE_FIRE,
}

# Purposes exposed in the camera UI (hide legacy duplicates)
CAMERA_PURPOSE_OPTIONS: tuple[CameraPurpose, ...] = (
    CameraPurpose.GENERAL_OBJECTS,
    CameraPurpose.CUSTOM_OBJECTS,
    CameraPurpose.SMOKE_FIRE,
    CameraPurpose.WEAPON,
    CameraPurpose.FACE_RECOGNITION,
    CameraPurpose.ATTENDANCE,
    CameraPurpose.ANPR,
)

DEFAULT_CAMERA_PURPOSES: list[str] = [CameraPurpose.GENERAL_OBJECTS]


class CameraType(models.TextChoices):
    PTZ = "PTZ", "PTZ"
    FIXED = "Fixed", "Fixed"
    THERMAL = "Thermal", "Thermal"
    THREE_SIXTY = "360", "360°"


class CameraStatus(models.TextChoices):
    ONLINE = "Online", "Online"
    OFFLINE = "Offline", "Offline"


class NvrBrand(models.TextChoices):
    HIKVISION = "hikvision", "Hikvision"
    DAHUA = "dahua", "Dahua"
    UNIVIEW = "uniview", "Uniview"
    GENERIC = "generic", "Generic RTSP"


class Site(models.Model):
    """Physical location (city, branch, facility)."""

    code = models.CharField(max_length=64, unique=True, help_text="Short code e.g. PESHAWAR")
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cameras_site"
        ordering = ["name"]

    def __str__(self):
        return f"{self.code} — {self.name}"


class Nvr(models.Model):
    """Network Video Recorder — credentials stored here only."""

    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="nvrs")
    name = models.CharField(max_length=150)
    ip_address = models.CharField(max_length=45)
    port = models.PositiveIntegerField(default=554)
    username = models.CharField(max_length=64, default="admin")
    password = models.CharField(max_length=128, blank=True, default="")
    brand = models.CharField(max_length=32, choices=NvrBrand.choices, default=NvrBrand.HIKVISION)
    stream_path_template = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Optional path template with {channel}, e.g. /Streaming/Channels/{channel}",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cameras_nvrdevice"
        ordering = ["site__name", "name"]
        verbose_name = "NVR"
        verbose_name_plural = "NVRs"

    def __str__(self):
        return f"{self.name} @ {self.ip_address}"


class Camera(models.Model):
    """Camera channel on an NVR — no credentials or RTSP URLs stored."""

    nvr = models.ForeignKey(Nvr, on_delete=models.CASCADE, related_name="cameras")
    channel = models.PositiveSmallIntegerField(
        db_column="rtsp_channel",
        help_text="NVR channel number (1–32+, or Hikvision stream ID e.g. 101)",
    )
    code = models.CharField(max_length=32, unique=True, blank=True)
    name = models.CharField(max_length=150, help_text="User-defined label e.g. Main Gate")
    location = models.CharField(max_length=64, help_text="Denormalized site code")
    zone = models.CharField(max_length=64, blank=True, default="")
    camera_type = models.CharField(max_length=16, choices=CameraType.choices, default=CameraType.FIXED)
    purpose = models.CharField(
        max_length=32,
        choices=CameraPurpose.choices,
        default=CameraPurpose.GENERAL_OBJECTS,
        help_text="Primary AI purpose (first entry of purposes).",
    )
    purposes = models.JSONField(
        default=list,
        blank=True,
        help_text="AI purposes enabled on this camera (multiple models allowed).",
    )
    resolution = models.CharField(max_length=32, blank=True, default="1920x1080")
    frame_rate = models.CharField(max_length=8, blank=True, default="25")
    status = models.CharField(max_length=16, choices=CameraStatus.choices, default=CameraStatus.ONLINE)
    passage_role = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="Optional passage role for camera routing and grouping.",
    )
    recording = models.BooleanField(default=True)
    storage_path = models.CharField(max_length=255, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nvr__site__name", "nvr__name", "channel"]
        unique_together = [("nvr", "channel")]

    def __str__(self):
        return f"{self.code or self.pk} — {self.name} (Ch {self.channel})"

    @staticmethod
    def normalize_purposes(values) -> list[str]:
        """Dedupe, alias legacy codes, and validate; always return at least one model."""
        allowed = {c.value for c in CAMERA_PURPOSE_OPTIONS}
        out: list[str] = []
        for raw in values or []:
            code = str(raw or "").strip().lower()
            code = PURPOSE_ALIASES.get(code, code)
            if code in allowed and code not in out:
                out.append(code)
        if not out:
            out = list(DEFAULT_CAMERA_PURPOSES)
        return out

    def purpose_list(self) -> list[str]:
        values = self.purposes if isinstance(self.purposes, list) else []
        normalized = self.normalize_purposes(values)
        if self.purpose and self.purpose not in normalized:
            # Legacy rows may only have the single purpose column filled
            return self.normalize_purposes([self.purpose, *normalized])
        return normalized

    def has_purpose(self, code: str) -> bool:
        return str(code or "").strip().lower() in self.purpose_list()

    def purpose_labels(self) -> list[str]:
        label_map = {c.value: c.label for c in CameraPurpose}
        return [label_map.get(p, p) for p in self.purpose_list()]

    @property
    def purpose_label(self) -> str:
        return " · ".join(self.purpose_labels())

    @property
    def ml_enabled(self) -> bool:
        return self.is_active

    @property
    def stream_key(self) -> str:
        return f"cam-{self.pk}"

    def effective_stream_url(self) -> str:
        """Main-stream RTSP URL (not substream). Used for ML registration."""
        from .rtsp_utils import build_rtsp_url_from_nvr

        return build_rtsp_url_from_nvr(self.nvr, self.channel)

    @property
    def is_rtsp(self) -> bool:
        return bool(self.nvr_id)

    def save(self, *args, **kwargs):
        if self.nvr_id and not self.location:
            self.location = self.nvr.site.code
        # Keep purposes list + primary purpose column in sync
        normalized = self.normalize_purposes(
            self.purposes if isinstance(self.purposes, list) and self.purposes else [self.purpose]
        )
        self.purposes = normalized
        self.purpose = normalized[0]
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and not self.code:
            self.code = f"CAM-{self.pk:04d}"
            super().save(update_fields=["code"])


class ClipStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    RECORDING = "recording", "Recording"
    READY = "ready", "Ready"
    FAILED = "failed", "Failed"
    SKIPPED = "skipped", "Skipped"


class DetectionEvent(models.Model):
    camera = models.ForeignKey(Camera, on_delete=models.CASCADE, related_name="detection_events")
    class_name = models.CharField(max_length=80)
    label = models.CharField(max_length=120)
    employee_name = models.CharField(
        max_length=150,
        blank=True,
        default="",
        help_text="Recognized staff name when a person/face is identified; empty for other objects.",
    )
    personal_number = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Recognized staff personal number when a person/face is identified.",
    )
    confidence = models.FloatField()
    bbox = models.JSONField(default=list)
    is_alert = models.BooleanField(default=False)
    clip = models.FileField(
        upload_to="detection_clips/%Y/%m/%d/",
        blank=True,
        help_text="JPEG snapshot captured when this detection was saved.",
    )
    clip_status = models.CharField(
        max_length=16,
        choices=ClipStatus.choices,
        default=ClipStatus.PENDING,
    )
    # Journey / tracking columns (required by DB schema for cross-camera person linking)
    local_track_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="ByteTrack ID on this camera frame.",
    )
    person_qr = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="Linked journey person code (P100, U300, V55) when identified.",
    )
    track_event = models.CharField(
        max_length=16,
        blank=True,
        default="detection",
        help_text="Track lifecycle: detection, enter, exit, etc.",
    )
    person_identity_id = models.BigIntegerField(
        null=True,
        blank=True,
        help_text="Optional FK to person_journey.JourneyPerson pk when linked.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.camera.code} {self.label} @ {self.created_at:%Y-%m-%d %H:%M}"
