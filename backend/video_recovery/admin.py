from django.contrib import admin

from .models import VideoRecoveryJob


@admin.register(VideoRecoveryJob)
class VideoRecoveryJobAdmin(admin.ModelAdmin):
    list_display = ("id", "original_filename", "status", "current_stage", "created_at", "completed_at")
    list_filter = ("status", "current_stage")
    search_fields = ("id", "original_filename")
    readonly_fields = ("created_at", "updated_at", "completed_at")
