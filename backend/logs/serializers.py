from rest_framework import serializers
from django.utils import timezone
from .models import UserActivityLog, MobilePhoneSession


class ActivityLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(read_only=True, allow_null=True, default=None)

    class Meta:
        model = UserActivityLog
        fields = [
            "id",
            "username",
            "ip_address",
            "country",
            "city",
            "device",
            "os",
            "browser",
            "action",
            "source",
            "time",
        ]


class MobilePhoneSessionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    name = serializers.SerializerMethodField()
    live_seconds = serializers.SerializerMethodField()

    class Meta:
        model = MobilePhoneSession
        fields = [
            "id",
            "user_id",
            "username",
            "name",
            "state",
            "started_at",
            "ended_at",
            "duration_seconds",
            "live_seconds",
        ]

    def get_name(self, obj):
        full = (getattr(obj.user, "full_name", None) or "").strip()
        return full or obj.user.username

    def get_live_seconds(self, obj):
        if obj.ended_at is not None:
            return obj.duration_seconds or 0
        started = obj.started_at
        if not started:
            return 0
        return max(0, int((timezone.now() - started).total_seconds()))
