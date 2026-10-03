from django.contrib import admin
from .models import (
    MobileAccessSession,
    MobileAlert,
    MobileDevice,
    MobileEventReceipt,
    MobilePhoneSession,
    UserActivityLog,
)


@admin.register(UserActivityLog)
class UserActivityLogAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "ip_address",
        "country",
        "city",
        "device",
        "os",
        "browser",
        "action",
        "time",
    )


@admin.register(MobileDevice)
class MobileDeviceAdmin(admin.ModelAdmin):
    list_display = ("user", "device_uuid", "status", "is_revoked", "last_seen_at", "last_gps_at")
    search_fields = ("device_uuid", "user__username", "user__full_name")
    list_filter = ("status", "is_revoked")


@admin.register(MobileAccessSession)
class MobileAccessSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "session_id", "status", "started_at", "ended_at")
    list_filter = ("status",)


@admin.register(MobileAlert)
class MobileAlertAdmin(admin.ModelAdmin):
    list_display = ("alert_type", "severity", "user", "is_active", "detected_at")
    list_filter = ("alert_type", "severity", "is_active")


@admin.register(MobilePhoneSession)
class MobilePhoneSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "state", "started_at", "ended_at", "duration_seconds")


@admin.register(MobileEventReceipt)
class MobileEventReceiptAdmin(admin.ModelAdmin):
    list_display = ("event_id", "event_type", "user", "created_at")
