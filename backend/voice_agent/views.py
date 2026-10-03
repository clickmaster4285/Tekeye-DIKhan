"""Voice agent API: sessions, conversation turns, and on-prem speech-to-text proxy."""

from __future__ import annotations

import difflib
import logging
import re

import requests
from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import policy
from .agent import CHAT_GREETING, GREETING, AgentUnavailable, close_session, run_turn, start_session
from .models import AgentReport, SessionMode, SessionStatus, VoiceSession
from .reports import render_pdf, render_xlsx, report_filename, report_payload

logger = logging.getLogger(__name__)

WAKE_PHRASES = ("hello customs", "hallo customs", "helo customs", "hello custom", "ہیلو کسٹمز", "ہیلو کسٹم")
# Biases Whisper toward spelling the wake phrase correctly.
STT_PROMPT = "Hello Customs. TekEye, camera, main gate, ANPR, incident."


class CanUseVoiceAgent(permissions.BasePermission):
    message = "Your role is not enabled for the TekEye voice agent."

    def has_permission(self, request, view):
        return policy.can_use_voice_agent(request.user)


def _stt_base_url() -> str:
    explicit = (getattr(settings, "VOICE_STT_URL", "") or "").strip().rstrip("/")
    if explicit:
        return explicit
    from ml.client import known_ml_base_urls

    urls = known_ml_base_urls()
    return urls[0].rstrip("/") if urls else ""


def match_wake_phrase(text: str) -> tuple[bool, str]:
    """Fuzzy-match 'Hello Customs' at the start of a transcript. Returns (woke, remainder)."""
    raw = text or ""
    tokens = list(re.finditer(r"\w+", raw))
    for n in (2, 3):
        if len(tokens) < n:
            break
        head = " ".join(t.group(0).lower() for t in tokens[:n])
        if any(difflib.SequenceMatcher(None, head, p).ratio() >= 0.8 for p in WAKE_PHRASES):
            remainder = raw[tokens[n - 1].end():].lstrip(" ,.!?،۔").strip()
            return True, remainder
    return False, ""


class VoiceAgentStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "enabled": policy.can_use_voice_agent(request.user),
                "provider": (getattr(settings, "VOICE_AGENT_PROVIDER", "") or "anthropic"),
                "stt_configured": bool(_stt_base_url()),
                "idle_timeout_sec": int(getattr(settings, "VOICE_AGENT_IDLE_TIMEOUT_SEC", 45)),
                "greeting": GREETING,
            }
        )


def _session_row(session: VoiceSession) -> dict:
    return {
        "session_id": str(session.pk),
        "title": session.title or "New chat",
        "mode": session.mode,
        "status": session.status,
        "turn_count": session.turn_count,
        "updated_at": timezone.localtime(session.updated_at).isoformat(timespec="seconds"),
    }


class VoiceSessionCreateView(APIView):
    """POST: start a session ({"mode": "chat"} for the typed assistant). GET: the officer's past chats."""

    permission_classes = [permissions.IsAuthenticated, CanUseVoiceAgent]

    def get(self, request):
        mode = request.query_params.get("mode") or SessionMode.CHAT
        sessions = VoiceSession.objects.filter(user=request.user, mode=mode, turn_count__gt=0)[:100]
        return Response({"sessions": [_session_row(s) for s in sessions]})

    def post(self, request):
        mode = SessionMode.CHAT if request.data.get("mode") == SessionMode.CHAT else SessionMode.VOICE
        try:
            session = start_session(request.user, mode)
        except AgentUnavailable as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        greeting = CHAT_GREETING if mode == SessionMode.CHAT else GREETING
        return Response({**_session_row(session), "greeting": greeting}, status=status.HTTP_201_CREATED)


class VoiceSessionDetailView(APIView):
    """GET one conversation's transcript (for reopening a past chat); PATCH {"title"} renames it."""

    permission_classes = [permissions.IsAuthenticated, CanUseVoiceAgent]

    def get(self, request, session_id):
        session = get_object_or_404(VoiceSession, pk=session_id, user=request.user)
        pending = session.pending_action or {}
        return Response(
            {
                **_session_row(session),
                "transcript": session.transcript or [],
                "awaiting_confirmation": bool(pending),
                "pending_summary": pending.get("summary"),
            }
        )

    def patch(self, request, session_id):
        session = get_object_or_404(VoiceSession, pk=session_id, user=request.user)
        title = str(request.data.get("title") or "").strip()[:120]
        if title:
            session.title = title
            session.save(update_fields=["title", "updated_at"])
        return Response(_session_row(session))


class VoiceSessionTurnView(APIView):
    permission_classes = [permissions.IsAuthenticated, CanUseVoiceAgent]

    def post(self, request, session_id):
        session = get_object_or_404(VoiceSession, pk=session_id, user=request.user)
        if session.status != SessionStatus.ACTIVE:
            if session.mode != SessionMode.CHAT:
                return Response({"detail": "Session is closed. Say Hello Customs to start again."}, status=status.HTTP_409_CONFLICT)
            session.status, session.closed_at = SessionStatus.ACTIVE, None  # reopening a past chat continues it
        text = str(request.data.get("text") or "").strip()[:8000]
        if not text:
            return Response({"detail": "text is required."}, status=status.HTTP_400_BAD_REQUEST)
        screen = request.data.get("screen") if isinstance(request.data.get("screen"), dict) else {}
        try:
            result = run_turn(session, request.user, text, screen=screen)
        except AgentUnavailable as exc:
            return Response({"detail": str(exc), "reply": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(result)


class VoiceSessionCloseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, session_id):
        session = get_object_or_404(VoiceSession, pk=session_id, user=request.user)
        close_session(session)
        return Response({"session_status": session.status})


class VoiceTranscribeView(APIView):
    """Forward a short WAV utterance to the on-prem Whisper service. mode=wake checks for 'Hello Customs'."""

    permission_classes = [permissions.IsAuthenticated, CanUseVoiceAgent]

    def post(self, request):
        audio = request.FILES.get("audio")
        if audio is None:
            return Response({"detail": "audio file is required."}, status=status.HTTP_400_BAD_REQUEST)
        if audio.size > 5 * 1024 * 1024:
            return Response({"detail": "Audio clip too long."}, status=status.HTTP_400_BAD_REQUEST)
        base = _stt_base_url()
        if not base:
            return Response({"detail": "Speech service is not configured (VOICE_STT_URL / ML_SERVICE_URL)."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        data = {"prompt": STT_PROMPT}
        language = (request.data.get("language") or "").strip()
        if language:
            data["language"] = language
        try:
            resp = requests.post(
                f"{base}/voice/transcribe",
                files={"audio": ("utterance.wav", audio.read(), audio.content_type or "audio/wav")},
                data=data,
                timeout=(5, 60),
            )
        except requests.RequestException as exc:
            logger.warning("[voice_agent] STT unreachable at %s: %s", base, exc)
            return Response({"detail": "Speech service is unreachable."}, status=status.HTTP_502_BAD_GATEWAY)
        if resp.status_code != 200:
            return Response({"detail": f"Speech service error (HTTP {resp.status_code})."}, status=status.HTTP_502_BAD_GATEWAY)

        result = resp.json()
        text = (result.get("text") or "").strip()
        out = {
            "text": text,
            "language": result.get("language") or "",
            "confidence": result.get("confidence"),
        }
        if (request.data.get("mode") or "") == "wake":
            woke, remainder = match_wake_phrase(text)
            out["wake"] = woke
            out["remainder"] = remainder
        return Response(out)


def _get_report(request, report_id) -> AgentReport:
    qs = AgentReport.objects.select_related("user")
    if not getattr(request.user, "role", "") == "ADMIN":
        qs = qs.filter(user=request.user)
    return get_object_or_404(qs, pk=report_id)


class AgentReportView(APIView):
    permission_classes = [permissions.IsAuthenticated, CanUseVoiceAgent]

    def get(self, request, report_id):
        return Response(report_payload(_get_report(request, report_id)))


class AgentReportFileView(APIView):
    """GET …/pdf/ or …/xlsx/ — the compiled report as a download."""

    permission_classes = [permissions.IsAuthenticated, CanUseVoiceAgent]
    FORMATS = {
        "pdf": ("application/pdf", render_pdf),
        "xlsx": ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", render_xlsx),
    }

    def get(self, request, report_id, fmt):
        if fmt not in self.FORMATS:
            return Response({"detail": "Format must be pdf or xlsx."}, status=status.HTTP_404_NOT_FOUND)
        report = _get_report(request, report_id)
        content_type, render = self.FORMATS[fmt]
        response = HttpResponse(render(report), content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{report_filename(report, fmt)}"'
        return response
