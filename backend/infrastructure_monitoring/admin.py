from django.contrib import admin

from .models import (
    InfraAlert,
    InfraAlertRule,
    InfraDevice,
    InfraEvent,
    InfraNvrLog,
    InfraServerLog,
    InfraSite,
)


@admin.register(InfraSite)
class InfraSiteAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "location", "is_active", "updated_at")
    list_filter = ("is_active", "location")
    search_fields = ("code", "name")


@admin.register(InfraDevice)
class InfraDeviceAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "device_type",
        "ip_address",
        "primary_protocol",
        "status",
        "is_active",
        "site",
    )
    list_filter = ("device_type", "status", "primary_protocol", "is_active")
    search_fields = ("name", "manufacturer", "model_number", "ip_address", "serial_number")
    raw_id_fields = ("site",)


@admin.register(InfraAlertRule)
class InfraAlertRuleAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "device_type",
        "metric_key",
        "operator",
        "threshold_value",
        "severity",
        "is_active",
    )
    list_filter = ("device_type", "severity", "is_active")


@admin.register(InfraAlert)
class InfraAlertAdmin(admin.ModelAdmin):
    list_display = ("title", "severity", "device", "resolved", "acknowledged", "last_detected")
    list_filter = ("severity", "resolved", "acknowledged")
    search_fields = ("title", "message")


@admin.register(InfraEvent)
class InfraEventAdmin(admin.ModelAdmin):
    list_display = ("event_type", "title", "device", "actor", "created_at")
    list_filter = ("event_type",)
    search_fields = ("title", "message", "actor")


@admin.register(InfraNvrLog)
class InfraNvrLogAdmin(admin.ModelAdmin):
    list_display = (
        "log_time",
        "device",
        "major_type",
        "subtype",
        "channel_no",
        "local_remote_user",
        "remote_host_ip",
    )
    list_filter = ("major_type",)
    search_fields = ("subtype", "description", "channel_no", "remote_host_ip")
    raw_id_fields = ("device",)


@admin.register(InfraServerLog)
class InfraServerLogAdmin(admin.ModelAdmin):
    list_display = (
        "log_time",
        "device",
        "category",
        "level",
        "source",
        "event_id",
        "user",
        "remote_host",
    )
    list_filter = ("category", "level")
    search_fields = ("message", "source", "event_id", "user", "remote_host")
    raw_id_fields = ("device",)
