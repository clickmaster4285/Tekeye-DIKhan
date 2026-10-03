from rest_framework import serializers

from cameras.models import Camera

from .models import CameraHealthAlert, CameraHealthSnapshot


class CameraHealthSnapshotSerializer(serializers.ModelSerializer):
    camera_code = serializers.CharField(source="camera.code", read_only=True)
    camera_name = serializers.CharField(source="camera.name", read_only=True)
    camera_zone = serializers.CharField(source="camera.zone", read_only=True)
    camera_location = serializers.CharField(source="camera.location", read_only=True)
    purposes = serializers.SerializerMethodField()

    class Meta:
        model = CameraHealthSnapshot
        fields = [
            "id",
            "camera",
            "camera_code",
            "camera_name",
            "camera_zone",
            "camera_location",
            "purposes",
            "timestamp",
            "brightness",
            "contrast",
            "sharpness",
            "noise",
            "exposure",
            "glare",
            "dark_ratio",
            "bright_ratio",
            "fps",
            "freeze_score",
            "stream_latency",
            "rtsp_available",
            "person_visibility",
            "vehicle_visibility",
            "plate_visibility",
            "face_visibility",
            "obstruction_score",
            "overall_score",
            "status",
            "image_score",
            "stream_score",
            "visibility_score",
            "details",
            "recommendations",
        ]

    def get_purposes(self, obj):
        return obj.camera.purpose_list() if obj.camera_id else []


class CameraHealthAlertSerializer(serializers.ModelSerializer):
    camera_code = serializers.CharField(source="camera.code", read_only=True)
    camera_name = serializers.CharField(source="camera.name", read_only=True)

    class Meta:
        model = CameraHealthAlert
        fields = [
            "id",
            "camera",
            "camera_code",
            "camera_name",
            "alert_type",
            "severity",
            "message",
            "recommendation",
            "first_detected",
            "last_detected",
            "resolved",
            "resolved_at",
            "snapshot",
        ]


class CameraHealthSummarySerializer(serializers.Serializer):
    camera_id = serializers.IntegerField()
    code = serializers.CharField()
    name = serializers.CharField()
    zone = serializers.CharField(allow_blank=True)
    location = serializers.CharField(allow_blank=True)
    purposes = serializers.ListField(child=serializers.CharField())
    health_roi = serializers.DictField(allow_null=True)
    status = serializers.CharField()
    overall_score = serializers.FloatField()
    last_checked = serializers.DateTimeField(allow_null=True)
    open_alerts = serializers.IntegerField()
    top_recommendation = serializers.CharField(allow_blank=True)
    latest = CameraHealthSnapshotSerializer(allow_null=True)
