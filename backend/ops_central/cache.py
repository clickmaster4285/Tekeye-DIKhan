"""Central Ops camera cache helpers."""

from __future__ import annotations

import logging

from .models import RemoteServer

logger = logging.getLogger(__name__)


def parse_camera_id(value) -> int | None:
    if value is None or value == "":
        return None
    try:
        parsed = int(value)
        return parsed if parsed > 0 else None
    except (TypeError, ValueError):
        return None


def resolve_stream_key(stream_key: str, camera_id, code: str) -> str:
    key = (stream_key or "").strip()
    if key:
        return key
    cid = parse_camera_id(camera_id)
    if cid:
        return f"cam-{cid}"
    code = (code or "").strip()
    if code:
        return code if code.startswith("cam-") else f"cam-{code}"
    return ""


def camera_matches_entry(
    cam: dict,
    *,
    stream_key: str,
    camera_id: int | None,
    code: str,
) -> bool:
    if stream_key and (cam.get("ml_stream_key") or cam.get("code") or "") == stream_key:
        return True
    if camera_id is not None and cam.get("id") == camera_id:
        return True
    if code and (cam.get("code") or "") == code:
        return True
    if stream_key.startswith("cam-"):
        sid = stream_key[4:]
        if sid.isdigit() and cam.get("id") == int(sid):
            return True
    return False


def prune_server_camera_cache(
    server: RemoteServer,
    *,
    stream_key: str,
    camera_id: int | None,
    code: str,
) -> list[dict]:
    cached = list(server.cached_cameras or [])
    if not cached:
        return cached
    pruned = [
        cam
        for cam in cached
        if isinstance(cam, dict)
        and not camera_matches_entry(
            cam,
            stream_key=stream_key,
            camera_id=camera_id,
            code=code,
        )
    ]
    if len(pruned) != len(cached):
        server.cached_cameras = pruned
        server.save(update_fields=["cached_cameras", "updated_at"])
    return pruned


def prune_camera_from_all_server_caches(
    *,
    camera_id: int | None,
    stream_key: str = "",
    code: str = "",
) -> int:
    """Remove a camera from every RemoteServer cache. Returns number of servers updated."""
    key = resolve_stream_key(stream_key, camera_id, code)
    updated = 0
    for server in RemoteServer.objects.all():
        before = len(server.cached_cameras or [])
        after = len(
            prune_server_camera_cache(
                server,
                stream_key=key,
                camera_id=camera_id,
                code=code,
            )
        )
        if after != before:
            updated += 1
    if updated:
        logger.info(
            "[ops-cache] Pruned camera id=%s stream_key=%s from %s server cache(s)",
            camera_id,
            key,
            updated,
        )
    return updated
