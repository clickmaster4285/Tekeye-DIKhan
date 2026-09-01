from rest_framework import serializers

from .models import (
    CAMERA_PURPOSE_OPTIONS,
    DEFAULT_CAMERA_PURPOSES,
    Camera,
    CameraPurpose,
    DetectionEvent,
    Nvr,
    NvrBrand,
    Site,
)


class SiteSerializer(serializers.ModelSerializer):
    nvr_count = serializers.SerializerMethodField()
    camera_count = serializers.SerializerMethodField()

    class Meta:
        model = Site
        fields = [
            "id",
            "code",
            "name",
            "description",
            "is_active",
            "nvr_count",
            "camera_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "nvr_count", "camera_count"]

    def get_nvr_count(self, obj: Site) -> int:
        return obj.nvrs.filter(is_active=True).count()

    def get_camera_count(self, obj: Site) -> int:
        return Camera.objects.filter(nvr__site=obj, is_active=True).count()


class NvrSerializer(serializers.ModelSerializer):
    site_code = serializers.CharField(source="site.code", read_only=True)
    site_name = serializers.CharField(source="site.name", read_only=True)
    brand_label = serializers.CharField(source="get_brand_display", read_only=True)
    password_set = serializers.SerializerMethodField()
    camera_count = serializers.SerializerMethodField()

    class Meta:
        model = Nvr
        fields = [
            "id",
            "site",
            "site_code",
            "site_name",
            "name",
            "ip_address",
            "port",
            "username",
            "password",
            "password_set",
            "brand",
            "brand_label",
            "stream_path_template",
            "is_active",
            "camera_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "site_code", "site_name", "brand_label", "camera_count"]
        extra_kwargs = {"password": {"write_only": True, "required": False, "allow_blank": True}}

    def get_password_set(self, obj: Nvr) -> bool:
        return bool(obj.password)

    def get_camera_count(self, obj: Nvr) -> int:
        return obj.cameras.filter(is_active=True).count()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data.pop("password", None)
        return data

    def update(self, instance, validated_data):
        if validated_data.get("password") == "":
            validated_data.pop("password")
        return super().update(instance, validated_data)


class CameraSerializer(serializers.ModelSerializer):
    ml_enabled = serializers.BooleanField(read_only=True)
    is_rtsp = serializers.BooleanField(read_only=True)
    ml_stream_key = serializers.CharField(source="stream_key", read_only=True)
    ml_live_stream_url = serializers.SerializerMethodField()
    raw_stream_url = serializers.SerializerMethodField()
    purpose_label = serializers.SerializerMethodField()
    purpose_labels = serializers.SerializerMethodField()
    site_code = serializers.CharField(source="nvr.site.code", read_only=True)
    site_name = serializers.CharField(source="nvr.site.name", read_only=True)
    nvr_name = serializers.CharField(source="nvr.name", read_only=True)
    nvr_ip = serializers.CharField(source="nvr.ip_address", read_only=True)
    channel_label = serializers.SerializerMethodField()

    class Meta:
        model = Camera
        fields = [
            "id",
            "code",
            "name",
            "nvr",
            "channel",
            "channel_label",
            "site_code",
            "site_name",
            "nvr_name",
            "nvr_ip",
            "location",
            "zone",
            "purpose",
            "purposes",
            "purpose_label",
            "purpose_labels",
            "status",
            "passage_role",
            "is_active",
            "ml_enabled",
            "is_rtsp",
            "ml_stream_key",
            "ml_live_stream_url",
            "raw_stream_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "code",
            "location",
            "created_at",
            "updated_at",
            "ml_enabled",
            "is_rtsp",
            "ml_stream_key",
            "purpose_label",
            "purpose_labels",
        ]

    def get_channel_label(self, obj: Camera) -> str:
        return f"Ch {obj.channel}"

    def get_purpose_label(self, obj: Camera) -> str:
        return obj.purpose_label

    def get_purpose_labels(self, obj: Camera) -> list[str]:
        return obj.purpose_labels()

    def get_ml_live_stream_url(self, obj: Camera) -> str:
        if not obj.is_active or not obj.nvr_id:
            return ""
        from ml.client import ml_live_mjpeg_public_url

        return ml_live_mjpeg_public_url(
            obj.stream_key,
            rtsp_url=obj.effective_stream_url(),
            purpose=obj.purpose,
            purposes=obj.purpose_list(),
        )

    def get_raw_stream_url(self, obj: Camera) -> str:
        if not obj.is_active or not obj.nvr_id:
            return ""
        from ml.client import ml_live_mjpeg_raw_public_url

        return ml_live_mjpeg_raw_public_url(
            obj.stream_key,
            rtsp_url=obj.effective_stream_url(),
            purpose=obj.purpose,
            purposes=obj.purpose_list(),
        )


class CameraWriteSerializer(serializers.ModelSerializer):
    purposes = serializers.ListField(
        child=serializers.ChoiceField(choices=CameraPurpose.choices),
        allow_empty=False,
        required=False,
    )
    purpose = serializers.ChoiceField(choices=CameraPurpose.choices, required=False)

    class Meta:
        model = Camera
        fields = ["name", "nvr", "channel", "zone", "purpose", "purposes", "status", "passage_role", "is_active"]

    def validate_channel(self, value: int) -> int:
        if value < 1:
            raise serializers.ValidationError("Channel must be at least 1.")
        return value

    def validate(self, attrs):
        nvr = attrs.get("nvr") or (self.instance.nvr if self.instance else None)
        channel = attrs.get("channel") or (self.instance.channel if self.instance else None)
        if nvr and channel:
            qs = Camera.objects.filter(nvr=nvr, channel=channel)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"channel": f"Channel {channel} already exists on this NVR."}
                )

        purposes = attrs.get("purposes")
        purpose = attrs.get("purpose")
        if purposes is not None:
            attrs["purposes"] = Camera.normalize_purposes(purposes)
            attrs["purpose"] = attrs["purposes"][0]
        elif purpose:
            attrs["purposes"] = Camera.normalize_purposes([purpose])
            attrs["purpose"] = attrs["purposes"][0]
        elif not self.instance:
            attrs["purposes"] = list(DEFAULT_CAMERA_PURPOSES)
            attrs["purpose"] = attrs["purposes"][0]
        return attrs


class BulkCameraCreateSerializer(serializers.Serializer):
    channel_count = serializers.IntegerField(min_value=1, max_value=64)
    name_prefix = serializers.CharField(max_length=80, required=False, default="Camera")
    zone = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    purposes = serializers.ListField(
        child=serializers.ChoiceField(choices=CameraPurpose.choices),
        allow_empty=False,
        required=False,
    )
    purpose = serializers.ChoiceField(choices=CameraPurpose.choices, required=False)

    def validate(self, attrs):
        purposes = attrs.get("purposes")
        purpose = attrs.get("purpose")
        if purposes is not None:
            attrs["purposes"] = Camera.normalize_purposes(purposes)
        elif purpose:
            attrs["purposes"] = Camera.normalize_purposes([purpose])
        else:
            attrs["purposes"] = list(DEFAULT_CAMERA_PURPOSES)
        attrs["purpose"] = attrs["purposes"][0]
        return attrs


def purpose_options():
    return [{"value": c.value, "label": c.label} for c in CAMERA_PURPOSE_OPTIONS]


def nvr_brand_options():
    return [{"value": c.value, "label": c.label} for c in NvrBrand]


class DetectionEventSerializer(serializers.ModelSerializer):
    camera_code = serializers.CharField(source="camera.code", read_only=True)
    name = serializers.CharField(source="camera.name", read_only=True)
    site_code = serializers.CharField(source="camera.nvr.site.code", read_only=True)
    site_name = serializers.CharField(source="camera.nvr.site.name", read_only=True)
    nvr_name = serializers.CharField(source="camera.nvr.name", read_only=True)
    nvr_ip = serializers.CharField(source="camera.nvr.ip_address", read_only=True)
    channel = serializers.IntegerField(source="camera.channel", read_only=True)
    zone = serializers.CharField(source="camera.zone", read_only=True)
    purpose = serializers.CharField(source="camera.purpose", read_only=True)
    purpose_label = serializers.SerializerMethodField()
    clip_url = serializers.SerializerMethodField()

    class Meta:
        model = DetectionEvent
        fields = [
            "id",
            "camera",
            "camera_code",
            "name",
            "site_code",
            "site_name",
            "nvr_name",
            "nvr_ip",
            "channel",
            "zone",
            "purpose",
            "purpose_label",
            "class_name",
            "label",
            "employee_name",
            "personal_number",
            "confidence",
            "bbox",
            "is_alert",
            "clip_status",
            "clip_url",
            "created_at",
        ]

    def get_purpose_label(self, obj: DetectionEvent) -> str:
        return obj.camera.purpose_label

    def get_clip_url(self, obj: DetectionEvent) -> str:
        if not obj.clip:
            return ""
        return obj.clip.url
