import uuid

from django.conf import settings
from django.db import models


class RecoveryStage(models.TextChoices):
    UPLOAD = "upload", "Video Upload"
    VALIDATE = "validate_upload", "Upload Validation"
    PRESERVE = "preserve", "Preserve Original"
    DAMAGE_ANALYSIS = "damage_analysis", "Deep Damage Analysis"
    DAMAGE_MAP = "damage_map", "Damage Map"
    RECOVERY = "recovery", "Recovery Engine"
    REGENERATION = "regeneration", "Regeneration Engine"
    HYBRID_MERGE = "hybrid_merge", "Hybrid Merger"
    FORENSIC = "forensic", "File Forensic Analyzer"
    CONTAINER = "container", "Container Recovery"
    STREAM = "stream", "Stream Analysis"
    FRAMES = "frames", "Frame Recovery Engine"
    VALID_FRAMES = "valid_frames", "Valid Frame Processing"
    BAD_FRAMES = "bad_frames", "Bad Frame Restoration"
    MISSING_FRAMES = "missing_frames", "Missing Frame Generation"
    TEMPORAL = "temporal", "Temporal Consistency AI"
    AUDIO = "audio", "Audio Recovery"
    RECONSTRUCT = "reconstruct", "Video Reconstruction"
    VALIDATE_OUT = "validate", "Quality Validation"
    COMPLETED = "completed", "Final Output"


class JobStatus(models.TextChoices):
    UPLOADED = "uploaded", "Uploaded"
    PROCESSING = "processing", "Processing"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"


class VideoRecoveryJob(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    original_filename = models.CharField(max_length=255, blank=True, default="")
    original_file = models.FileField(upload_to="video_recovery/uploads/%Y/%m/%d/")
    recovered_file = models.FileField(
        upload_to="video_recovery/recovered/%Y/%m/%d/",
        blank=True,
    )
    status = models.CharField(
        max_length=20,
        choices=JobStatus.choices,
        default=JobStatus.UPLOADED,
    )
    current_stage = models.CharField(
        max_length=32,
        choices=RecoveryStage.choices,
        default=RecoveryStage.UPLOAD,
    )
    stage_logs = models.JSONField(default=list, blank=True)
    forensic_report = models.JSONField(default=dict, blank=True)
    damage_map = models.JSONField(default=dict, blank=True)
    hybrid_report = models.JSONField(default=dict, blank=True)
    quality_report = models.JSONField(default=dict, blank=True)
    original_sha256 = models.CharField(max_length=64, blank=True, default="")
    preserved_path = models.CharField(max_length=512, blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="video_recovery_jobs",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"VideoRecoveryJob {self.id} ({self.status})"
