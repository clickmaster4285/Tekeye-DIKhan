from django.contrib import admin

from .models import RemoteServer


@admin.register(RemoteServer)
class RemoteServerAdmin(admin.ModelAdmin):
    list_display = ("name", "location_code", "base_url", "is_active", "last_health", "last_seen_at")
    list_filter = ("is_active", "last_health", "location_code")
    search_fields = ("name", "base_url", "location_code")
    readonly_fields = ("last_seen_at", "last_health", "last_error", "created_at", "updated_at")
