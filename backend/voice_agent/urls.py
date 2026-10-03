from django.urls import path

from .views import (
    AgentReportFileView,
    AgentReportView,
    VoiceAgentStatusView,
    VoiceSessionCloseView,
    VoiceSessionCreateView,
    VoiceSessionDetailView,
    VoiceSessionTurnView,
    VoiceTranscribeView,
)

urlpatterns = [
    path("voice-agent/status/", VoiceAgentStatusView.as_view(), name="voice-agent-status"),
    path("voice-agent/sessions/", VoiceSessionCreateView.as_view(), name="voice-agent-session-create"),
    path("voice-agent/sessions/<uuid:session_id>/", VoiceSessionDetailView.as_view(), name="voice-agent-session"),
    path("voice-agent/sessions/<uuid:session_id>/turn/", VoiceSessionTurnView.as_view(), name="voice-agent-turn"),
    path("voice-agent/sessions/<uuid:session_id>/close/", VoiceSessionCloseView.as_view(), name="voice-agent-close"),
    path("voice-agent/transcribe/", VoiceTranscribeView.as_view(), name="voice-agent-transcribe"),
    path("voice-agent/reports/<uuid:report_id>/", AgentReportView.as_view(), name="voice-agent-report"),
    path(
        "voice-agent/reports/<uuid:report_id>/<str:fmt>/",
        AgentReportFileView.as_view(),
        name="voice-agent-report-file",
    ),
]
