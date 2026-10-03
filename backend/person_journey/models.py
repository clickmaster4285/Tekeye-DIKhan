"""Tek Eye Person Journey — enterprise cross-camera person tracking."""

from __future__ import annotations

import uuid

from django.db import models


class PersonType(models.TextChoices):
    STAFF = "staff", "Staff"
    VISITOR = "visitor", "Visitor"
    UNKNOWN = "unknown", "Unknown"


class PersonStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    FINISHED = "finished", "Finished"
    MERGED = "merged", "Merged"


class IdentityState(models.TextChoices):
    NEW = "new", "New"
    TRACKING = "tracking", "Tracking"
    CANDIDATE_MATCH = "candidate_match", "Candidate Match"
    CONFIRMED = "confirmed", "Confirmed"
    CONTINUOUS = "continuous", "Continuous Tracking"
    OCCLUDED = "occluded", "Occluded"
    REIDENTIFICATION = "reidentification", "Re-identification"
    TRANSITION = "transition", "Camera Transition"
    EXITED = "exited", "Exited"


class TrackStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    FINISHED = "finished", "Finished"
    OCCLUDED = "occluded", "Occluded"


class JourneyEventType(models.TextChoices):
    CAMERA_DETECTION = "camera_detection", "Camera Detection"
    STAFF_RECOGNIZED = "staff_recognized", "Staff Recognized"
    ATTENDANCE_CHECK_IN = "attendance_check_in", "Attendance Check-In"
    ATTENDANCE_CHECK_OUT = "attendance_check_out", "Attendance Check-Out"
    ZONE_ENTRY = "zone_entry", "Zone Entry"
    ZONE_EXIT = "zone_exit", "Zone Exit"
    WEAPON_DETECTED = "weapon_detected", "Weapon Detected"
    WATCHLIST = "watchlist", "Watchlist"
    PANIC = "panic", "Panic"
    UNKNOWN_CREATED = "unknown_created", "Unknown Person Created"
    PERSON_MERGED = "person_merged", "Person Merged"
    FACE_MATCHED = "face_matched", "Face Matched"
    ALERT = "alert", "Alert"


class JourneyPerson(models.Model):
    """
    Global cross-camera person identity.

    ``code`` is always a global person ID (PJ-00042). Person type (staff /
    visitor / unknown) is metadata — never encoded into the person ID.
    Camera-local ByteTrack sessions live on CameraTrack.tracklet_id.
    """

    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    code = models.CharField(
        max_length=32,
        unique=True,
        db_index=True,
        help_text="Global person ID, e.g. PJ-00042. Not a camera track id.",
    )
    person_type = models.CharField(
        max_length=16,
        choices=PersonType.choices,
        default=PersonType.UNKNOWN,
        db_index=True,
    )
    display_name = models.CharField(max_length=200, blank=True, default="")
    staff = models.ForeignKey(
        "users.Staff",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="journey_persons",
    )
    visitor = models.ForeignKey(
        "visitors.Visitor",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="journey_persons",
    )
    face_embedding = models.JSONField(default=list, blank=True)
    reid_embedding = models.JSONField(default=list, blank=True)
    latest_camera = models.ForeignKey(
        "cameras.Camera",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="journey_persons_latest",
    )
    latest_zone = models.CharField(max_length=64, blank=True, default="")
    latest_seen_at = models.DateTimeField(null=True, blank=True, db_index=True)
    status = models.CharField(
        max_length=16,
        choices=PersonStatus.choices,
        default=PersonStatus.ACTIVE,
        db_index=True,
    )
    identity_state = models.CharField(
        max_length=24,
        choices=IdentityState.choices,
        default=IdentityState.NEW,
        db_index=True,
        help_text="Lifecycle state machine for the global person.",
    )
    merged_into = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="merged_from",
    )
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-latest_seen_at", "-created_at"]
        indexes = [
            models.Index(fields=["person_type", "status", "-latest_seen_at"]),
        ]

    @property
    def person_id(self) -> str:
        """Alias for the global person code (PJ-#####)."""
        return self.code

    def __str__(self):
        label = self.display_name or self.code
        return f"{label} ({self.person_type})"


class CameraTrack(models.Model):
    """
    Per-camera tracklet (ByteTrack session).

    Hierarchy:
      JourneyPerson PJ-00042
          └── CameraTrack tracklet_id=C01-T18492  (camera 1, local track 18492)
          └── CameraTrack tracklet_id=C02-T93281  (camera 2, local track 93281)
    """

    journey_person = models.ForeignKey(
        JourneyPerson,
        on_delete=models.CASCADE,
        related_name="tracks",
    )
    camera = models.ForeignKey(
        "cameras.Camera",
        on_delete=models.CASCADE,
        related_name="journey_tracks",
    )
    track_id = models.PositiveIntegerField(
        help_text="Local ByteTrack id on this camera only — not a global person id.",
    )
    tracklet_id = models.CharField(
        max_length=64,
        blank=True,
        default="",
        db_index=True,
        help_text="Stable tracklet label, e.g. C01-T18492.",
    )
    status = models.CharField(
        max_length=16,
        choices=TrackStatus.choices,
        default=TrackStatus.ACTIVE,
        db_index=True,
    )
    started_at = models.DateTimeField(db_index=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    # Last observation on this camera — two tracks live at the same moment are two different people.
    last_seen_at = models.DateTimeField(null=True, blank=True, db_index=True)
    start_bbox = models.JSONField(default=list, blank=True)
    end_bbox = models.JSONField(default=list, blank=True)
    last_bbox = models.JSONField(default=list, blank=True)
    trajectory = models.JSONField(
        default=list,
        blank=True,
        help_text="Recent bbox centers / boxes for direction estimation.",
    )
    movement_direction = models.CharField(max_length=32, blank=True, default="")
    entry_zone = models.CharField(max_length=64, blank=True, default="")
    exit_zone = models.CharField(max_length=64, blank=True, default="")
    quality = models.FloatField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["camera", "track_id", "status"]),
            models.Index(fields=["tracklet_id", "status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["camera", "track_id", "started_at"],
                name="person_journey_unique_camera_track_start",
            ),
        ]

    def ensure_tracklet_id(self) -> str:
        """Compute and persist C##-T##### if missing."""
        from .identities import format_tracklet_id

        label = format_tracklet_id(self.camera_id, self.track_id)
        if label and self.tracklet_id != label:
            self.tracklet_id = label
        return self.tracklet_id

    def save(self, *args, **kwargs):
        if self.camera_id and self.track_id is not None:
            from .identities import format_tracklet_id

            self.tracklet_id = format_tracklet_id(self.camera_id, self.track_id)
        super().save(*args, **kwargs)

    def __str__(self):
        label = self.tracklet_id or f"T{self.track_id}@{self.camera_id}"
        return f"{label} → {self.journey_person.code}"


class JourneyEvent(models.Model):
    """Timeline entry for a person journey."""

    journey_person = models.ForeignKey(
        JourneyPerson,
        on_delete=models.CASCADE,
        related_name="events",
    )
    event_type = models.CharField(max_length=32, choices=JourneyEventType.choices, db_index=True)
    title = models.CharField(max_length=255, blank=True, default="")
    description = models.TextField(blank=True, default="")
    camera = models.ForeignKey(
        "cameras.Camera",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="journey_events",
    )
    zone = models.CharField(max_length=64, blank=True, default="")
    gate = models.CharField(max_length=64, blank=True, default="")
    track = models.ForeignKey(
        CameraTrack,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events",
    )
    detection_event_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    zone_access_log_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    attendance_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    confidence = models.FloatField(null=True, blank=True)
    match_score = models.FloatField(null=True, blank=True)
    bbox = models.JSONField(default=list, blank=True)
    snapshot_path = models.CharField(max_length=512, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["journey_person", "-created_at"]),
            models.Index(fields=["event_type", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.journey_person.code} — {self.event_type} @ {self.created_at:%H:%M:%S}"


class PersonObservation(models.Model):
    """
    One embedding sample in the person's gallery (face or ReID).

    Never average these into a single vector — match against the gallery.
    """

    class Kind(models.TextChoices):
        FACE = "face", "Face"
        REID = "reid", "Body ReID"
        APPEARANCE = "appearance", "Appearance"

    tracklet = models.ForeignKey(
        CameraTrack,
        on_delete=models.CASCADE,
        related_name="observations",
    )
    journey_person = models.ForeignKey(
        JourneyPerson,
        on_delete=models.CASCADE,
        related_name="observations",
    )
    kind = models.CharField(max_length=16, choices=Kind.choices, db_index=True)
    embedding = models.JSONField(default=list, blank=True)
    bbox = models.JSONField(default=list, blank=True)
    confidence = models.FloatField(null=True, blank=True)
    quality = models.FloatField(default=0.5)
    snapshot_path = models.CharField(max_length=512, blank=True, default="")
    captured_at = models.DateTimeField(db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-captured_at"]
        indexes = [
            models.Index(fields=["journey_person", "kind", "-captured_at"]),
            models.Index(fields=["tracklet", "kind", "-captured_at"]),
        ]

    def __str__(self):
        return f"{self.kind} @ {self.tracklet.tracklet_id} → {self.journey_person.code}"


class CameraTopologyEdge(models.Model):
    """Directed camera hop with expected travel-time window (site graph)."""

    from_camera = models.ForeignKey(
        "cameras.Camera",
        on_delete=models.CASCADE,
        related_name="topology_out",
    )
    to_camera = models.ForeignKey(
        "cameras.Camera",
        on_delete=models.CASCADE,
        related_name="topology_in",
    )
    typical_min_sec = models.PositiveIntegerField(default=5)
    typical_max_sec = models.PositiveIntegerField(default=60)
    hard_max_sec = models.PositiveIntegerField(default=180)
    expected_exit_direction = models.CharField(max_length=32, blank=True, default="")
    expected_entry_direction = models.CharField(max_length=32, blank=True, default="")
    from_exit_zone = models.CharField(max_length=64, blank=True, default="")
    to_entry_zone = models.CharField(max_length=64, blank=True, default="")
    bidirectional = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = [("from_camera", "to_camera")]
        indexes = [
            models.Index(fields=["from_camera", "to_camera", "is_active"]),
        ]

    def __str__(self):
        return f"C{self.from_camera_id} → C{self.to_camera_id} ({self.typical_min_sec}-{self.typical_max_sec}s)"


class PersonTransition(models.Model):
    """Auditable edge between two tracklets of the same global person."""

    journey_person = models.ForeignKey(
        JourneyPerson,
        on_delete=models.CASCADE,
        related_name="transitions",
    )
    from_tracklet = models.ForeignKey(
        CameraTrack,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transitions_from",
    )
    to_tracklet = models.ForeignKey(
        CameraTrack,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transitions_to",
    )
    from_camera = models.ForeignKey(
        "cameras.Camera",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    to_camera = models.ForeignKey(
        "cameras.Camera",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    exit_time = models.DateTimeField(null=True, blank=True)
    entry_time = models.DateTimeField(null=True, blank=True)
    travel_time_sec = models.FloatField(null=True, blank=True)
    reid_score = models.FloatField(null=True, blank=True)
    face_score = models.FloatField(null=True, blank=True)
    appearance_score = models.FloatField(null=True, blank=True)
    direction_score = models.FloatField(null=True, blank=True)
    topology_score = models.FloatField(null=True, blank=True)
    time_score = models.FloatField(null=True, blank=True)
    confidence = models.FloatField(null=True, blank=True)
    decision = models.CharField(max_length=16, blank=True, default="match")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["journey_person", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.journey_person.code}: {self.from_camera_id}→{self.to_camera_id}"
