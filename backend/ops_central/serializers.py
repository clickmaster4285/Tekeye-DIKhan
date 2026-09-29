from rest_framework import serializers

from .models import ConnectionMode, RemoteServer
from .utils import ensure_http_url, ensure_ml_url


class RemoteServerSerializer(serializers.ModelSerializer):
    auth_token_set = serializers.SerializerMethodField()
    created_by_username = serializers.SerializerMethodField()
    assigned_count = serializers.SerializerMethodField()
    available_slots = serializers.SerializerMethodField()
    site_code = serializers.CharField(source="site.code", read_only=True, default="")
    site_name = serializers.CharField(source="site.name", read_only=True, default="")
    resolved_ml_base_url = serializers.SerializerMethodField()

    class Meta:
        model = RemoteServer
        fields = [
            "id",
            "name",
            "location_code",
            "connection_mode",
            "base_url",
            "ml_base_url",
            "resolved_ml_base_url",
            "auth_token",
            "auth_token_set",
            "is_active",
            "notes",
            "site",
            "site_code",
            "site_name",
            "gpu",
            "max_cameras",
            "assigned_count",
            "available_slots",
            "last_seen_at",
            "last_health",
            "last_error",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "last_seen_at",
            "last_health",
            "last_error",
            "created_by",
            "created_at",
            "updated_at",
            "auth_token_set",
            "created_by_username",
            "assigned_count",
            "available_slots",
            "site_code",
            "site_name",
            "resolved_ml_base_url",
        ]
        extra_kwargs = {
            "auth_token": {"write_only": True, "required": False, "allow_blank": True},
            "base_url": {"required": False, "allow_blank": True},
            "ml_base_url": {"required": False, "allow_blank": True},
            "site": {"required": False, "allow_null": True},
            "gpu": {"required": False, "allow_blank": True},
            "max_cameras": {"required": False},
        }

    def get_auth_token_set(self, obj: RemoteServer) -> bool:
        return bool((obj.auth_token or "").strip())

    def get_created_by_username(self, obj: RemoteServer) -> str:
        if obj.created_by_id and obj.created_by:
            return obj.created_by.username
        return ""

    def get_assigned_count(self, obj: RemoteServer) -> int:
        if hasattr(obj, "assigned_count") and obj.assigned_count is not None:
            try:
                return int(obj.assigned_count)
            except (TypeError, ValueError):
                pass
        return obj.assigned_camera_count

    def get_available_slots(self, obj: RemoteServer):
        max_cam = int(obj.max_cameras or 0)
        if not max_cam:
            return None
        return max(0, max_cam - self.get_assigned_count(obj))

    def get_resolved_ml_base_url(self, obj: RemoteServer) -> str:
        return obj.resolved_ml_base_url()

    def validate_base_url(self, value: str) -> str:
        return ensure_http_url(value, default_port=8000) if (value or "").strip() else ""

    def validate_ml_base_url(self, value: str) -> str:
        return ensure_ml_url(value) if (value or "").strip() else ""

    def validate_max_cameras(self, value: int) -> int:
        if value is not None and int(value) < 1:
            raise serializers.ValidationError("Maximum cameras must be at least 1.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        mode = attrs.get("connection_mode") or (
            self.instance.connection_mode if self.instance else ConnectionMode.ML
        )
        ml = attrs.get("ml_base_url") if "ml_base_url" in attrs else None
        if ml is None and self.instance:
            ml = self.instance.ml_base_url
        base = attrs.get("base_url") if "base_url" in attrs else None
        if base is None and self.instance:
            base = self.instance.base_url

        if mode == ConnectionMode.ML:
            if not (ml or "").strip():
                raise serializers.ValidationError(
                    {"ml_base_url": "ML server URL is required (e.g. 192.168.199.12:8100)."}
                )
            if not (base or "").strip():
                attrs["base_url"] = ml or attrs.get("ml_base_url") or ""
        else:
            if not (base or "").strip():
                raise serializers.ValidationError(
                    {"base_url": "Django server URL is required in django mode."}
                )
        return attrs

    def update(self, instance, validated_data):
        if "auth_token" in validated_data and not (validated_data.get("auth_token") or "").strip():
            validated_data.pop("auth_token")
        return super().update(instance, validated_data)


class QuickConnectSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, allow_blank=True, default="")
    connection_mode = serializers.ChoiceField(
        choices=ConnectionMode.choices,
        required=False,
        default=ConnectionMode.ML,
    )
    base_url = serializers.CharField(required=False, allow_blank=True, default="")
    auth_token = serializers.CharField(allow_blank=True, required=False, default="")
    ml_base_url = serializers.CharField(required=False, allow_blank=True, default="")
    save = serializers.BooleanField(required=False, default=True)
    site = serializers.IntegerField(required=False, allow_null=True)
    gpu = serializers.CharField(required=False, allow_blank=True, default="")
    max_cameras = serializers.IntegerField(required=False, min_value=1, default=25)

    def validate_base_url(self, value: str) -> str:
        return ensure_http_url(value, default_port=8000) if (value or "").strip() else ""

    def validate_ml_base_url(self, value: str) -> str:
        return ensure_ml_url(value) if (value or "").strip() else ""

    def validate(self, attrs):
        attrs = super().validate(attrs)
        mode = attrs.get("connection_mode") or ConnectionMode.ML
        if mode == ConnectionMode.ML:
            if not (attrs.get("ml_base_url") or "").strip():
                if (attrs.get("base_url") or "").strip():
                    attrs["ml_base_url"] = ensure_ml_url(
                        attrs["base_url"].replace(":8000", ":8100")
                        if ":8000" in attrs["base_url"]
                        else attrs["base_url"]
                    )
                else:
                    raise serializers.ValidationError(
                        {"ml_base_url": "ML server URL is required (host:8100)."}
                    )
        else:
            if not (attrs.get("base_url") or "").strip():
                raise serializers.ValidationError({"base_url": "Django server URL is required."})
        return attrs


class AssignCameraSerializer(serializers.Serializer):
    camera_id = serializers.IntegerField(min_value=1)
    ml_server_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    enforce_capacity = serializers.BooleanField(required=False, default=True)


class AutoDistributeSerializer(serializers.Serializer):
    site_id = serializers.IntegerField(required=False, allow_null=True)
    location_code = serializers.CharField(required=False, allow_blank=True, default="")
    dry_run = serializers.BooleanField(required=False, default=False)
    apply = serializers.BooleanField(required=False, default=True)
