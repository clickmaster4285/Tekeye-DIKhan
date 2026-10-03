from rest_framework import serializers

from .models import CameraTrack, JourneyEvent, JourneyPerson
from .snapshot_utils import journey_person_latest_snapshot_url


class JourneyPersonListSerializer(serializers.ModelSerializer):
    """Global person only — never expose camera track ids as person identity."""

    person_id = serializers.CharField(source="code", read_only=True)
    identity_state = serializers.CharField(read_only=True)
    latest_camera_name = serializers.CharField(source="latest_camera.name", read_only=True, default="")
    staff_name = serializers.CharField(source="staff.full_name", read_only=True, default="")
    visitor_name = serializers.CharField(source="visitor.full_name", read_only=True, default="")
    latest_snapshot_url = serializers.SerializerMethodField()
    active_tracklet_count = serializers.SerializerMethodField()
    tracklet_ids = serializers.SerializerMethodField()
    name_locked = serializers.SerializerMethodField()

    class Meta:
        model = JourneyPerson
        fields = [
            "uuid",
            "person_id",
            "code",
            "person_type",
            "identity_state",
            "display_name",
            "name_locked",
            "staff_name",
            "visitor_name",
            "latest_camera_name",
            "latest_zone",
            "latest_seen_at",
            "latest_snapshot_url",
            "status",
            "created_at",
            "active_tracklet_count",
            "tracklet_ids",
        ]

    def get_name_locked(self, obj: JourneyPerson) -> bool:
        meta = obj.metadata if isinstance(obj.metadata, dict) else {}
        return bool(meta.get("name_locked"))


    def get_latest_snapshot_url(self, obj: JourneyPerson) -> str:
        cached = getattr(obj, "_latest_snapshot_url", None)
        if cached is not None:
            return cached
        return journey_person_latest_snapshot_url(obj)

    def get_active_tracklet_count(self, obj: JourneyPerson) -> int:
        cached = getattr(obj, "_active_tracklet_count", None)
        if cached is not None:
            return cached
        prefetched = getattr(obj, "_prefetched_objects_cache", {})
        if "tracks" in prefetched:
            return sum(1 for t in obj.tracks.all() if t.status == "active")
        return obj.tracks.filter(status="active").count()

    def get_tracklet_ids(self, obj: JourneyPerson) -> list[str]:
        cached = getattr(obj, "_tracklet_ids", None)
        if cached is not None:
            return cached
        ids: list[str] = []
        for t in obj.tracks.all()[:40]:
            label = (t.tracklet_id or "").strip()
            if label and label not in ids:
                ids.append(label)
        return ids


class JourneyPersonNameUpdateSerializer(serializers.Serializer):
    """Operator-assigned name for a journey person."""

    display_name = serializers.CharField(max_length=200, allow_blank=False, trim_whitespace=True)


class JourneyEventSerializer(serializers.ModelSerializer):
    camera_name = serializers.CharField(source="camera.name", read_only=True, default="")
    camera_code = serializers.CharField(source="camera.code", read_only=True, default="")
    snapshot_url = serializers.SerializerMethodField()
    person_id = serializers.CharField(source="journey_person.code", read_only=True, default="")
    person_code = serializers.CharField(source="journey_person.code", read_only=True, default="")
    person_name = serializers.CharField(source="journey_person.display_name", read_only=True, default="")
    tracklet_id = serializers.SerializerMethodField()
    local_track_id = serializers.SerializerMethodField()

    class Meta:
        model = JourneyEvent
        fields = [
            "id",
            "event_type",
            "title",
            "description",
            "camera_name",
            "camera_code",
            "camera",
            "zone",
            "gate",
            "confidence",
            "match_score",
            "bbox",
            "snapshot_path",
            "snapshot_url",
            "person_id",
            "person_code",
            "person_name",
            "tracklet_id",
            "local_track_id",
            "metadata",
            "created_at",
        ]

    def get_snapshot_url(self, obj: JourneyEvent) -> str:
        path = (obj.snapshot_path or "").strip()
        if path:
            return path
        clip_map: dict[int, str] | None = self.context.get("detection_clip_map")
        if clip_map is not None and obj.detection_event_id:
            return clip_map.get(obj.detection_event_id) or ""
        return ""

    def get_tracklet_id(self, obj: JourneyEvent) -> str:
        track = getattr(obj, "track", None)
        if track is not None:
            return (track.tracklet_id or "").strip()
        meta = obj.metadata or {}
        return str(meta.get("tracklet_id") or "").strip()

    def get_local_track_id(self, obj: JourneyEvent) -> int | None:
        track = getattr(obj, "track", None)
        if track is not None:
            return track.track_id
        meta = obj.metadata or {}
        raw = meta.get("track_id")
        try:
            return int(raw) if raw is not None else None
        except (TypeError, ValueError):
            return None


class CameraTrackSerializer(serializers.ModelSerializer):
    """Per-camera tracklet — distinct from global person_id."""

    camera_name = serializers.CharField(source="camera.name", read_only=True, default="")
    camera_zone = serializers.CharField(source="camera.zone", read_only=True, default="")
    person_id = serializers.CharField(source="journey_person.code", read_only=True, default="")

    class Meta:
        model = CameraTrack
        fields = [
            "id",
            "tracklet_id",
            "track_id",
            "person_id",
            "camera_name",
            "camera_zone",
            "status",
            "started_at",
            "ended_at",
            "start_bbox",
            "end_bbox",
            "last_bbox",
            "movement_direction",
            "entry_zone",
            "exit_zone",
            "quality",
        ]


class JourneyPersonDetailSerializer(JourneyPersonListSerializer):
    events = JourneyEventSerializer(many=True, read_only=True)
    tracks = CameraTrackSerializer(many=True, read_only=True)

    class Meta(JourneyPersonListSerializer.Meta):
        fields = JourneyPersonListSerializer.Meta.fields + [
            "face_embedding",
            "reid_embedding",
            "metadata",
            "events",
            "tracks",
        ]


class IngestObservationSerializer(serializers.Serializer):
    camera_id = serializers.IntegerField(required=False, allow_null=True)
    camera_key = serializers.CharField(required=False, allow_blank=True, default="")
    track_id = serializers.IntegerField(min_value=0)
    track_status = serializers.ChoiceField(choices=["active", "finished"], default="active")
    bbox = serializers.ListField(child=serializers.FloatField(), required=False, default=list)
    confidence = serializers.FloatField(required=False, default=0.0)
    face_embedding = serializers.ListField(child=serializers.FloatField(), required=False, default=list)
    reid_embedding = serializers.ListField(child=serializers.FloatField(), required=False, default=list)
    face_label = serializers.CharField(required=False, allow_blank=True, default="")
    face_match_score = serializers.FloatField(required=False, allow_null=True)
    detections = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    snapshot_path = serializers.CharField(required=False, allow_blank=True, default="")


class MergeVisitorSerializer(serializers.Serializer):
    person_uuid = serializers.UUIDField()
    visitor_id = serializers.IntegerField(min_value=1)
    face_match_score = serializers.FloatField(required=False, allow_null=True)
