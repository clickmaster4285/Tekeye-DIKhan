"""Socket.IO realtime bus for Tekeye (WSGI/ASGI compatible)."""

from __future__ import annotations

import logging
import os
from typing import Any

import socketio

logger = logging.getLogger(__name__)

_cors = os.getenv("SOCKETIO_CORS_ORIGINS", "*").strip()
_cors_origins: list[str] | str = "*" if _cors in ("", "*") else [o.strip() for o in _cors.split(",") if o.strip()]

# threading + Django WSGI (runserver / gunicorn sync) cannot upgrade to WebSocket
# (wsgiref has no raw socket → "Cannot obtain socket from WSGI environment").
# Stay on Engine.IO long-polling unless SOCKETIO_ALLOW_WEBSOCKET=true and a
# websocket-capable server (eventlet/gevent) is used.
_allow_ws = os.getenv("SOCKETIO_ALLOW_WEBSOCKET", "").strip().lower() in ("1", "true", "yes")

sio = socketio.Server(
    async_mode="threading",
    cors_allowed_origins=_cors_origins,
    logger=False,
    engineio_logger=False,
    allow_upgrades=_allow_ws,
    # Explicit: polling always; websocket only when upgrades enabled.
    transports=["polling", "websocket"] if _allow_ws else ["polling"],
)


@sio.event
def connect(sid, environ, auth=None):  # noqa: ARG001
    logger.info("[realtime] client connected %s", sid)
    sio.emit("realtime:hello", {"ok": True}, to=sid)


@sio.event
def disconnect(sid):
    logger.info("[realtime] client disconnected %s", sid)


@sio.on("subscribe")
def on_subscribe(sid, data):
    """Client may join topic rooms: { rooms: ['vms', 'cameras', ...] }."""
    rooms = []
    if isinstance(data, dict):
        raw = data.get("rooms") or data.get("topics") or []
        if isinstance(raw, str):
            rooms = [raw]
        elif isinstance(raw, (list, tuple)):
            rooms = [str(r).strip() for r in raw if str(r).strip()]
    for room in rooms:
        sio.enter_room(sid, room)
    sio.emit("realtime:subscribed", {"rooms": rooms}, to=sid)


_last_emit_at: dict[str, float] = {}


def emit_invalidate(
    domains: list[str] | tuple[str, ...] | str,
    *,
    payload: dict[str, Any] | None = None,
    throttle_sec: float = 0.0,
) -> None:
    """Broadcast a data-domain invalidation to all connected browsers."""
    import time

    if isinstance(domains, str):
        domain_list = [domains]
    else:
        domain_list = [str(d).strip() for d in domains if str(d).strip()]
    if not domain_list:
        return
    if throttle_sec > 0:
        key = ",".join(sorted(domain_list))
        now = time.monotonic()
        last = _last_emit_at.get(key, 0.0)
        if now - last < throttle_sec:
            return
        _last_emit_at[key] = now
    body = {"domains": domain_list, **(payload or {})}
    try:
        sio.emit("realtime:invalidate", body)
        for domain in domain_list:
            sio.emit("realtime:invalidate", body, room=domain)
    except Exception:
        logger.debug("[realtime] emit failed domains=%s", domain_list, exc_info=True)


def wrap_wsgi(django_app):
    return socketio.WSGIApp(sio, django_app)


def wrap_asgi(django_app):
    # ASGI wrap uses a separate AsyncServer; for unified emit we keep threading WSGI primary.
    # Prefer running gunicorn/uvicorn with the WSGI app that includes Socket.IO.
    return socketio.WSGIApp(sio, django_app)
