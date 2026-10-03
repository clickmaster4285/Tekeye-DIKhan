from django.contrib import admin

from .models import AgentActionLog, Incident, VoiceSession


@admin.register(VoiceSession)
class VoiceSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "status", "provider", "turn_count", "created_at", "updated_at")
    list_filter = ("status", "provider")
    search_fields = ("user__username",)
    readonly_fields = ("history", "context", "pending_action")


@admin.register(AgentActionLog)
class AgentActionLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "tool", "access", "allowed", "outcome")
    list_filter = ("tool", "access", "allowed", "outcome")
    search_fields = ("user__username", "utterance", "summary")


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "severity", "status", "location", "camera", "created_by", "created_at")
    list_filter = ("severity", "status", "location", "source")
    search_fields = ("title", "description")
