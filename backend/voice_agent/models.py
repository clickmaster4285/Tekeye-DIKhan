"""TekEye voice agent — conversation sessions, tool audit trail, incidents."""

import uuid

from django.conf import settings
from django.db import models


class SessionStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    CLOSED = "closed", "Closed"


class SessionMode(models.TextChoices):
    VOICE = "voice", "Voice"
    CHAT = "chat", "Chat"


class VoiceSession(models.Model):
    """One agent conversation — a spoken "Hello Customs" session or a typed assistant chat.

    history is the LLM provider's native message list; transcript is the officer-facing view of it.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="voice_sessions",
    )
    status = models.CharField(
        max_length=16,
        choices=SessionStatus.choices,
        default=SessionStatus.ACTIVE,
        db_index=True,
    )
    mode = models.CharField(max_length=8, choices=SessionMode.choices, default=SessionMode.VOICE, db_index=True)
    title = models.CharField(max_length=120, blank=True, default="")
    provider = models.CharField(max_length=32, default="")
    history = models.JSONField(default=list, blank=True)
    # [{role: user|assistant, text, at, tools?, reports?, pending?}] — what the chat UI shows.
    transcript = models.JSONField(default=list, blank=True)
    # Operational context: focused camera, last listed results, etc. ("here", "the second one")
    context = models.JSONField(default=dict, blank=True)
    # A prepared write operation awaiting the officer's explicit yes/no.
    pending_action = models.JSONField(null=True, blank=True, default=None)
    turn_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.user} — {self.status} ({self.created_at:%Y-%m-%d %H:%M})"


class AgentActionLog(models.Model):
    """Audit row for every tool the agent attempted (allowed or denied)."""

    session = models.ForeignKey(
        VoiceSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="actions",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="voice_agent_actions",
    )
    utterance = models.TextField(blank=True, default="")
    tool = models.CharField(max_length=64, db_index=True)
    access = models.CharField(max_length=16, default="read")
    tool_input = models.JSONField(default=dict, blank=True)
    allowed = models.BooleanField(default=True)
    outcome = models.CharField(max_length=32, default="ok")
    summary = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.tool} ({self.outcome}) @ {self.created_at:%Y-%m-%d %H:%M:%S}"


class IncidentSeverity(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"
    CRITICAL = "critical", "Critical"


class IncidentStatus(models.TextChoices):
    OPEN = "open", "Open"
    INVESTIGATING = "investigating", "Investigating"
    CLOSED = "closed", "Closed"


class Incident(models.Model):
    """Officially recorded incident. Created by the voice agent only after explicit confirmation."""

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    severity = models.CharField(
        max_length=16,
        choices=IncidentSeverity.choices,
        default=IncidentSeverity.MEDIUM,
    )
    status = models.CharField(
        max_length=16,
        choices=IncidentStatus.choices,
        default=IncidentStatus.OPEN,
        db_index=True,
    )
    location = models.CharField(max_length=64, blank=True, default="", db_index=True)
    camera = models.ForeignKey(
        "cameras.Camera",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incidents",
    )
    detection_event = models.ForeignKey(
        "cameras.DetectionEvent",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incidents",
    )
    evidence = models.JSONField(default=dict, blank=True)
    source = models.CharField(max_length=20, default="voice_agent")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incidents_created",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"INC-{self.pk} {self.title}"


class AgentReport(models.Model):
    """A report the agent compiled from TekEye records; downloadable as PDF / Excel."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        VoiceSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reports",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="agent_reports",
    )
    title = models.CharField(max_length=200)
    summary = models.TextField(blank=True, default="")
    # [{heading, dataset, description, total, criteria, counts_by, counts, columns, rows, truncated, notes}]
    sections = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.created_at:%Y-%m-%d %H:%M})"
