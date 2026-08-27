"""Shared helpers for Central Ops."""

from __future__ import annotations

from urllib.parse import urlparse, urlunparse

from rest_framework.authtoken.models import Token


def ensure_http_url(value: str | None, *, default_port: int | None = 8000) -> str:
    """
    Accept host, host:port, or full URL.
    - Adds http:// if scheme is missing
    - If default_port is set and the URL has no port, appends that port
      (Django API default 8000). Pass default_port=None to leave bare host as :80.
    """
    value = (value or "").strip().rstrip("/")
    if not value:
        return ""

    if "://" not in value:
        value = f"http://{value}"

    parsed = urlparse(value)
    if not parsed.hostname:
        return value.rstrip("/")

    # Already has an explicit port
    if parsed.port is not None:
        return value.rstrip("/")

    # https without port → leave as 443; http without port → apply default_port
    if parsed.scheme == "https":
        return value.rstrip("/")

    if default_port is None:
        return value.rstrip("/")

    netloc = parsed.hostname
    if parsed.username:
        userinfo = parsed.username
        if parsed.password:
            userinfo += f":{parsed.password}"
        netloc = f"{userinfo}@{netloc}"
    netloc = f"{netloc}:{default_port}"
    return urlunparse((parsed.scheme, netloc, parsed.path or "", "", "", "")).rstrip("/")


def ensure_ml_url(value: str | None) -> str:
    """Normalize ML service URL; default port 8100 when omitted."""
    return ensure_http_url(value, default_port=8100)


def token_for_user(user) -> str:
    if not user or not getattr(user, "is_authenticated", False):
        return ""
    token, _ = Token.objects.get_or_create(user=user)
    return token.key


def resolve_remote_token(request, explicit: str | None = None) -> str:
    """Prefer explicit token; otherwise use the logged-in user's API token."""
    explicit = (explicit or "").strip()
    if explicit:
        return explicit
    return token_for_user(getattr(request, "user", None))


def ensure_default_remote_server(user) -> None:
    """Create one default local ML server if the registry is empty."""
    from .models import ConnectionMode, RemoteServer

    if RemoteServer.objects.exists():
        return
    RemoteServer.objects.create(
        name="Local ML",
        location_code="LOCAL",
        connection_mode=ConnectionMode.ML,
        base_url="http://127.0.0.1:8100",
        ml_base_url="http://127.0.0.1:8100",
        auth_token="ml-only",
        is_active=True,
        notes="Default ML node (auto-created)",
        cached_cameras=[],
        created_by=user if getattr(user, "is_authenticated", False) else None,
    )
