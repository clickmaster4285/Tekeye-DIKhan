"""Global object identity — ByteTrack local id + ReID → stable PostgreSQL identity."""

from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone


class ObjectType(models.TextChoices):
    PERSON = "person", "Person"
    VEHICLE = "vehicle", "Vehicle"
    OBJECT = "object", "Object"


class TrackStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    FINISHED = "finished", "Finished"


class VisitStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    EXITED = "exited", "Exited"


class GlobalObject(models.Model):
    """Stable identity across leave/return (ReID) and cameras."""

    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    code = models.CharField(max_length=32, unique=True, db_index=True)
    object_type = models.CharField(
        max_length=16,
        choices=ObjectType.choices,
        default=ObjectType.OBJECT,
        db_index=True,
    )
    class_name = models.CharField(max_length=80, blank=True, default="")
    label = models.CharField(max_length=120, blank=True, default="")
    reid_embedding = models.JSONField(default=list, blank=True)
    first_seen_at = models.DateTimeField(default=timezone.now, db_index=True)
    last_seen_at = models.DateTimeField(default=timezone.now, db_index=True)
    entry_at = models.DateTimeField(default=timezone.now)
    exit_at = models.DateTimeField(null=True, blank=True)
    latest_camera = models.ForeignKey(
        "cameras.Camera",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tracked_objects_latest",
    )
    camera_history = models.JSONField(default=list, blank=True)
    track_history = models.JSONField(default=list, blank=True)
    snapshot_path = models.CharField(max_length=512, blank=True, default="")
    first_detection_event_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_seen_at", "-created_at"]
        indexes = [
            models.Index(fields=["object_type", "class_name", "-last_seen_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.code} ({self.class_name or self.object_type})"

    @property
    def duration_seconds(self) -> float:
        end = self.exit_at or self.last_seen_at or timezone.now()
        start = self.entry_at or self.first_seen_at
        if not start or not end:
            return 0.0
        return max(0.0, (end - start).total_seconds())


class ObjectCameraTrack(models.Model):
    """ByteTrack session on one camera linked to a global object."""

    global_object = models.ForeignKey(
        GlobalObject,
        on_delete=models.CASCADE,
        related_name="tracks",
    )
    camera = models.ForeignKey(
        "cameras.Camera",
        on_delete=models.CASCADE,
        related_name="object_tracks",
    )
    local_track_id = models.PositiveIntegerField()
    status = models.CharField(
        max_length=16,
        choices=TrackStatus.choices,
        default=TrackStatus.ACTIVE,
        db_index=True,
    )
    started_at = models.DateTimeField(db_index=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    last_bbox = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["camera", "local_track_id", "status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["camera", "local_track_id", "started_at"],
                name="object_tracking_unique_cam_track_start",
            ),
        ]

    def __str__(self) -> str:
        return f"Track {self.local_track_id} @ cam {self.camera_id} → {self.global_object.code}"


class ObjectVisit(models.Model):
    """One presence session: entry → last_seen updates → exit → duration. Re-entry = new row."""

    global_object = models.ForeignKey(
        GlobalObject,
        on_delete=models.CASCADE,
        related_name="visits",
    )
    camera = models.ForeignKey(
        "cameras.Camera",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="object_visits",
    )
    local_track_id = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=16,
        choices=VisitStatus.choices,
        default=VisitStatus.ACTIVE,
        db_index=True,
    )
    entry_at = models.DateTimeField(db_index=True)
    last_seen_at = models.DateTimeField(db_index=True)
    exit_at = models.DateTimeField(null=True, blank=True, db_index=True)
    duration_seconds = models.FloatField(default=0.0)
    detection_event_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    snapshot_path = models.CharField(max_length=512, blank=True, default="")
    bbox = models.JSONField(default=list, blank=True)
    confidence = models.FloatField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-entry_at"]
        indexes = [
            models.Index(fields=["status", "-last_seen_at"]),
            models.Index(fields=["global_object", "-entry_at"]),
        ]

    def __str__(self) -> str:
        return f"Visit {self.pk} {self.global_object_id} [{self.status}]"

    def finalize_exit(self, exited_at=None) -> None:
        end = exited_at or timezone.now()
        self.exit_at = end
        self.last_seen_at = max(self.last_seen_at, end) if self.last_seen_at else end
        self.status = VisitStatus.EXITED
        start = self.entry_at or self.last_seen_at
        self.duration_seconds = max(0.0, (end - start).total_seconds()) if start else 0.0
