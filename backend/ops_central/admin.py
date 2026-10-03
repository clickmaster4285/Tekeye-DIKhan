from django.contrib import admin

from .models import RemoteServer


@admin.register(RemoteServer)
class RemoteServerAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "location_code",
        "ml_base_url",
        "gpu",
        "gpu_device",
        "max_cameras",
        "is_active",
        "last_health",
        "last_seen_at",
    )
    list_filter = ("is_active", "last_health", "location_code", "gpu_device")
    search_fields = ("name", "base_url", "ml_base_url", "location_code", "gpu")
    readonly_fields = ("last_seen_at", "last_health", "last_error", "created_at", "updated_at")
