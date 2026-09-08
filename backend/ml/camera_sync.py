"""Push active camera RTSP URLs to the correct ML node(s).

Cameras with ``ml_server`` set are registered only on that node's ML URL.
Unassigned cameras still sync to the default ``ML_SERVICE_URL`` (legacy).
"""

from __future__ import annotations

import logging
from collections import defaultdict

from django.conf import settings
from django.db import close_old_connections

logger = logging.getLogger(__name__)


def _camera_entry(camera) -> dict | None:
    rtsp_url = (camera.effective_stream_url() or "").strip()
    if not rtsp_url:
        return None
    return {
        "key": camera.stream_key,
        "rtsp_url": rtsp_url,
        "purpose": camera.purpose,
        "purposes": camera.purpose_list(),
    }


def collect_active_camera_entries() -> list[dict[str, str]]:
    """Legacy helper: all active cameras (used by CLI / default sync callers)."""
    from cameras.models import Camera
    from config.db import release_db

    close_old_connections()
    try:
        rows = (
            Camera.objects.filter(
                is_active=True,
                nvr__is_active=True,
                nvr__site__is_active=True,
            )
            .select_related("nvr", "nvr__site", "ml_server")
            .order_by("id")
        )
        entries: list[dict[str, str]] = []
        for camera in rows:
            entry = _camera_entry(camera)
            if entry:
                entries.append(entry)
        return entries
    finally:
        release_db()


def _default_ml_url() -> str:
    return (getattr(settings, "ML_SERVICE_URL", "") or "").strip().rstrip("/")


def collect_entries_by_ml_url() -> dict[str, list[dict]]:
    """Group active camera register payloads by target ML base URL."""
    from cameras.models import Camera
    from config.db import release_db

    close_old_connections()
    try:
        rows = (
            Camera.objects.filter(
                is_active=True,
                nvr__is_active=True,
                nvr__site__is_active=True,
            )
            .select_related("nvr", "nvr__site", "ml_server")
            .order_by("id")
        )
        by_url: dict[str, list[dict]] = defaultdict(list)
        default_url = _default_ml_url()
        for camera in rows:
            entry = _camera_entry(camera)
            if not entry:
                continue
            if camera.ml_server_id:
                target = (camera.ml_server.resolved_ml_base_url() or "").strip()
                if not target:
                    logger.warning(
                        "[camera-sync] Camera %s assigned to ML server %s with empty URL — skip",
                        camera.pk,
                        camera.ml_server_id,
                    )
                    continue
                by_url[target].append(entry)
            elif default_url:
                by_url[default_url].append(entry)
        return dict(by_url)
    finally:
        release_db()


def sync_cameras_to_ml(*, retries: int = 3) -> dict | None:
    from .client import MLServiceError, ml_register_cameras_bulk_at, ml_service_enabled

    default_url = _default_ml_url()
    by_url = collect_entries_by_ml_url()
    if not by_url:
        if not ml_service_enabled() and not by_url:
            logger.debug("[camera-sync] No ML targets / cameras — skip")
            return None
        logger.info("[camera-sync] No active cameras to register")
        return {"registered": 0, "total": 0, "by_server": {}}

    totals = {"registered": 0, "total": 0, "by_server": {}}
    for base_url, entries in by_url.items():
        last_exc: Exception | None = None
        result = None
        for attempt in range(1, max(1, retries) + 1):
            try:
                result = ml_register_cameras_bulk_at(base_url, entries)
                break
            except MLServiceError as exc:
                last_exc = exc
                logger.warning(
                    "[camera-sync] %s attempt %s/%s failed: %s",
                    base_url,
                    attempt,
                    retries,
                    exc,
                )
        if result is None:
            logger.error("[camera-sync] Could not sync to %s: %s", base_url, last_exc)
            totals["by_server"][base_url] = {"error": str(last_exc), "total": len(entries)}
            continue
        registered = int(result.get("registered", 0) or 0)
        total = int(result.get("total", len(entries)) or len(entries))
        totals["registered"] += registered
        totals["total"] += total
        totals["by_server"][base_url] = {"registered": registered, "total": total}
        logger.info(
            "[camera-sync] Registered %s/%s on %s%s",
            registered,
            total,
            base_url,
            " (default)" if base_url == default_url else "",
        )
    return totals


def route_camera_to_ml_server(camera, *, old_server=None) -> dict:
    """Unregister from previous ML node (if any) and register on the assigned node."""
    from .client import (
        MLServiceError,
        ml_register_cameras_bulk_at,
        ml_unregister_camera_at,
    )

    stream_key = camera.stream_key
    warnings: list[str] = []
    default_url = _default_ml_url()
    old_url = ""
    if old_server is not None:
        old_url = (old_server.resolved_ml_base_url() or "").strip()
    elif default_url:
        # Was unassigned — may still be registered on the hub default ML
        old_url = default_url

    new_url = ""
    if camera.ml_server_id and camera.ml_server:
        new_url = (camera.ml_server.resolved_ml_base_url() or "").strip()
    elif not camera.ml_server_id:
        new_url = default_url

    if old_url and old_url != new_url:
        try:
            ml_unregister_camera_at(old_url, stream_key, timeout=(2.0, 8.0))
        except MLServiceError as exc:
            warnings.append(f"unregister@{old_url}: {exc}")
            logger.warning("[camera-route] Unregister %s from %s failed: %s", stream_key, old_url, exc)

    if not camera.is_active or not camera.nvr_id:
        return {"registered": False, "warnings": warnings, "ml_url": new_url}

    entry = _camera_entry(camera)
    if not entry or not new_url:
        return {"registered": False, "warnings": warnings, "ml_url": new_url}

    try:
        ml_register_cameras_bulk_at(new_url, [entry], timeout=(2.0, 8.0))
        return {"registered": True, "warnings": warnings, "ml_url": new_url}
    except MLServiceError as exc:
        warnings.append(f"register@{new_url}: {exc}")
        logger.warning("[camera-route] Register %s on %s failed: %s", stream_key, new_url, exc)
        return {"registered": False, "warnings": warnings, "ml_url": new_url}
