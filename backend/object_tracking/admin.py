from django.contrib import admin

from .models import GlobalObject, ObjectCameraTrack, ObjectVisit


@admin.register(GlobalObject)
class GlobalObjectAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "object_type",
        "class_name",
        "first_seen_at",
        "last_seen_at",
        "entry_at",
        "exit_at",
        "latest_camera",
        "first_detection_event_id",
    )
    list_filter = ("object_type",)
    search_fields = ("code", "class_name", "label")


@admin.register(ObjectCameraTrack)
class ObjectCameraTrackAdmin(admin.ModelAdmin):
    list_display = ("local_track_id", "camera", "global_object", "status", "started_at", "ended_at")
    list_filter = ("status",)


@admin.register(ObjectVisit)
class ObjectVisitAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "global_object",
        "camera",
        "local_track_id",
        "status",
        "entry_at",
        "last_seen_at",
        "exit_at",
        "duration_seconds",
    )
    list_filter = ("status",)
    search_fields = ("global_object__code",)
