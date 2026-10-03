from django.contrib import admin

from .models import CameraHealthAlert, CameraHealthSnapshot


@admin.register(CameraHealthSnapshot)
class CameraHealthSnapshotAdmin(admin.ModelAdmin):
    list_display = ("id", "camera", "status", "overall_score", "timestamp")
    list_filter = ("status",)
    search_fields = ("camera__code", "camera__name")


@admin.register(CameraHealthAlert)
class CameraHealthAlertAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "camera",
        "alert_type",
        "severity",
        "resolved",
        "last_detected",
    )
    list_filter = ("severity", "resolved", "alert_type")
    search_fields = ("camera__code", "message")
