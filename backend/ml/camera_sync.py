"""Push active camera RTSP URLs to the correct ML node(s).

Strict policy:
  - ml_server_id set  → register ONLY on that node's ML URL
  - ml_server_id NULL → do NOT register anywhere (idle until assigned)
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


def _default_ml_url() -> str:
    """Hub default ML URL — used only for non-camera services (health, faces), never for unassigned cams."""
    return (getattr(settings, "ML_SERVICE_URL", "") or "").strip().rstrip("/")


def collect_active_camera_entries() -> list[dict[str, str]]:
    """Assigned active cameras only (CLI / diagnostics)."""
    from cameras.models import Camera
    from config.db import release_db

    close_old_connections()
    try:
        rows = (
            Camera.objects.filter(
                is_active=True,
                nvr__is_active=True,
                nvr__site__is_active=True,
                ml_server_id__isnull=False,
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


def collect_entries_by_ml_url() -> dict[str, list[dict]]:
    """Group assigned cameras by target ML base URL. Unassigned are skipped."""
    from cameras.models import Camera
    from config.db import release_db

    close_old_connections()
    try:
        rows = (
            Camera.objects.filter(
                is_active=True,
                nvr__is_active=True,
                nvr__site__is_active=True,
                ml_server_id__isnull=False,
            )
            .select_related("nvr", "nvr__site", "ml_server")
            .order_by("id")
        )
        by_url: dict[str, list[dict]] = defaultdict(list)
        for camera in rows:
            entry = _camera_entry(camera)
            if not entry:
                continue
            target = (camera.ml_server.resolved_ml_base_url() or "").strip()
            if not target:
                logger.warning(
                    "[camera-sync] Camera %s assigned to ML server %s with empty URL — skip",
                    camera.pk,
                    camera.ml_server_id,
                )
                continue
            by_url[target].append(entry)
        return dict(by_url)
    finally:
        release_db()


def sync_cameras_to_ml(*, retries: int = 3) -> dict | None:
    from .client import MLServiceError, ml_register_cameras_bulk_at, ml_service_enabled

    by_url = collect_entries_by_ml_url()
    # Include every known ML node so replace=True can clear orphans / unassigned leftovers.
    targets: dict[str, list[dict]] = {url: list(entries) for url, entries in by_url.items()}
    try:
        from .client import known_ml_base_urls

        for url in known_ml_base_urls():
            if url not in targets:
                targets[url] = []
    except Exception:
        logger.debug("[camera-sync] Could not enumerate known ML URLs", exc_info=True)

    if not targets:
        if not ml_service_enabled():
            logger.debug("[camera-sync] ML disabled and no assigned cameras — skip")
            return None
        logger.info("[camera-sync] No assigned cameras / ML nodes to sync (unassigned stay idle)")
        return {"registered": 0, "total": 0, "removed": 0, "by_server": {}}

    totals = {"registered": 0, "total": 0, "removed": 0, "by_server": {}}
    for base_url, entries in targets.items():
        last_exc: Exception | None = None
        result = None
        for attempt in range(1, max(1, retries) + 1):
            try:
                result = ml_register_cameras_bulk_at(base_url, entries, replace=True)
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
        removed = int(result.get("removed", 0) or 0)
        totals["registered"] += registered
        totals["total"] += total
        totals["removed"] += removed
        totals["by_server"][base_url] = {
            "registered": registered,
            "total": total,
            "removed": removed,
        }
        logger.info(
            "[camera-sync] Registered %s/%s on %s (removed %s orphans)",
            registered,
            total,
            base_url,
            removed,
        )
    return totals


def route_camera_to_ml_server(camera, *, old_server=None) -> dict:
    """Unregister from previous ML node; register on assigned node or nowhere if unassigned."""
    from .client import (
        MLServiceError,
        ml_register_cameras_bulk_at,
        ml_unregister_camera_at,
    )

    stream_key = camera.stream_key
    warnings: list[str] = []
    old_url = ""
    if old_server is not None:
        old_url = (old_server.resolved_ml_base_url() or "").strip()

    new_url = ""
    if camera.ml_server_id and camera.ml_server:
        new_url = (camera.ml_server.resolved_ml_base_url() or "").strip()

    # Unassign or move: drop from previous node
    if old_url and old_url != new_url:
        try:
            ml_unregister_camera_at(old_url, stream_key, timeout=(2.0, 8.0))
        except MLServiceError as exc:
            warnings.append(f"unregister@{old_url}: {exc}")
            logger.warning(
                "[camera-route] Unregister %s from %s failed: %s",
                stream_key,
                old_url,
                exc,
            )

    # Unassigned → idle (no register on any ML)
    if not camera.ml_server_id:
        logger.info("[camera-route] %s unassigned — not registered on any ML", stream_key)
        return {"registered": False, "warnings": warnings, "ml_url": ""}

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
