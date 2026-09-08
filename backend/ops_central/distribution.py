"""IT Super Admin camera ↔ ML server assignment and auto-distribution."""

from __future__ import annotations

import logging
from typing import Iterable

from django.db import transaction
from django.db.models import Count, Q

logger = logging.getLogger(__name__)


def _active_cameras_qs(site_id: int | None = None, location_code: str = ""):
    from cameras.models import Camera

    qs = Camera.objects.filter(
        is_active=True,
        nvr__is_active=True,
        nvr__site__is_active=True,
    ).select_related("nvr", "nvr__site", "ml_server")
    if site_id:
        qs = qs.filter(nvr__site_id=site_id)
    code = (location_code or "").strip()
    if code:
        qs = qs.filter(Q(nvr__site__code__iexact=code) | Q(location__iexact=code))
    return qs.order_by("id")


def _ml_servers_qs(site_id: int | None = None, location_code: str = ""):
    from ops_central.models import RemoteServer

    qs = RemoteServer.objects.filter(is_active=True).select_related("site")
    if site_id:
        qs = qs.filter(Q(site_id=site_id) | Q(site__isnull=True))
    code = (location_code or "").strip()
    if code:
        qs = qs.filter(
            Q(site__code__iexact=code)
            | Q(location_code__iexact=code)
            | Q(site__isnull=True, location_code="")
        )
    return qs.annotate(
        assigned_count=Count("assigned_cameras", filter=Q(assigned_cameras__is_active=True))
    ).order_by("name")


def camera_row(camera) -> dict:
    server = camera.ml_server
    return {
        "id": camera.id,
        "code": camera.code,
        "name": camera.name,
        "channel": camera.channel,
        "nvr_id": camera.nvr_id,
        "nvr_name": camera.nvr.name if camera.nvr_id else "",
        "site_id": camera.nvr.site_id if camera.nvr_id else None,
        "site_code": camera.nvr.site.code if camera.nvr_id else camera.location,
        "site_name": camera.nvr.site.name if camera.nvr_id else "",
        "ml_server_id": camera.ml_server_id,
        "ml_server_name": server.name if server else "",
        "status": camera.status,
        "is_active": camera.is_active,
    }


def server_row(server) -> dict:
    assigned = int(getattr(server, "assigned_count", None) or server.assigned_camera_count)
    max_cam = int(server.max_cameras or 0)
    health = (server.last_health or "").strip().lower()
    if health in ("ok", "healthy", "up", "online"):
        status = "healthy"
    elif health in ("error", "down", "unreachable", "offline"):
        status = "unhealthy"
    elif health:
        status = health
    else:
        status = "unknown"
    return {
        "id": server.id,
        "name": server.name,
        "ml_base_url": server.resolved_ml_base_url(),
        "location_code": server.location_code or "",
        "site_id": server.site_id,
        "site_code": server.site.code if server.site_id else "",
        "site_name": server.site.name if server.site_id else "",
        "gpu": server.gpu or "",
        "max_cameras": max_cam,
        "assigned_count": assigned,
        "available_slots": max(0, max_cam - assigned) if max_cam else None,
        "status": status,
        "last_health": server.last_health or "",
        "last_error": server.last_error or "",
        "last_seen_at": server.last_seen_at.isoformat() if server.last_seen_at else None,
        "is_active": server.is_active,
    }


def build_distribution_board(*, site_id: int | None = None, location_code: str = "") -> dict:
    cameras = list(_active_cameras_qs(site_id=site_id, location_code=location_code))
    servers = list(_ml_servers_qs(site_id=site_id, location_code=location_code))

    if (site_id or location_code) and not servers:
        servers = list(_ml_servers_qs())

    unassigned = [camera_row(c) for c in cameras if not c.ml_server_id]
    by_server: dict[int, list] = {s.id: [] for s in servers}
    orphan_assigned: list[dict] = []
    server_ids = set(by_server)
    for cam in cameras:
        if not cam.ml_server_id:
            continue
        row = camera_row(cam)
        if cam.ml_server_id in server_ids:
            by_server[cam.ml_server_id].append(row)
        else:
            orphan_assigned.append(row)

    return {
        "site_id": site_id,
        "location_code": location_code or "",
        "total_cameras": len(cameras),
        "unassigned_count": len(unassigned),
        "ml_server_count": len(servers),
        "unassigned": unassigned,
        "servers": [
            {
                **server_row(s),
                "cameras": by_server.get(s.id, []),
            }
            for s in servers
        ],
        "orphan_assigned": orphan_assigned,
    }


def assign_camera_to_server(
    camera_id: int,
    ml_server_id: int | None,
    *,
    enforce_capacity: bool = True,
) -> dict:
    from cameras.models import Camera
    from ml.camera_sync import route_camera_to_ml_server
    from ops_central.models import RemoteServer

    with transaction.atomic():
        # Do not select_related() nullable ml_server with select_for_update —
        # that creates an outer join and raises NotSupportedError on Postgres/SQLite.
        camera = (
            Camera.objects.select_related("nvr", "nvr__site")
            .select_for_update()
            .get(pk=camera_id)
        )
        old_server = None
        if camera.ml_server_id:
            old_server = RemoteServer.objects.filter(pk=camera.ml_server_id).first()

        new_server = None
        if ml_server_id is not None:
            new_server = RemoteServer.objects.select_for_update().get(
                pk=ml_server_id, is_active=True
            )
            if enforce_capacity and new_server.max_cameras:
                current = (
                    new_server.assigned_cameras.filter(is_active=True)
                    .exclude(pk=camera.pk)
                    .count()
                )
                if current >= int(new_server.max_cameras):
                    raise ValueError(
                        f"{new_server.name} is at capacity ({new_server.max_cameras} cameras)."
                    )
        camera.ml_server = new_server
        camera.save(update_fields=["ml_server", "updated_at"])

    camera = Camera.objects.select_related("nvr", "nvr__site", "ml_server").get(pk=camera_id)
    route_result = route_camera_to_ml_server(camera, old_server=old_server)
    return {
        "camera": camera_row(camera),
        "previous_ml_server_id": old_server.id if old_server else None,
        "ml_server_id": camera.ml_server_id,
        "routing": route_result,
    }


def preview_auto_distribute(*, site_id: int | None = None, location_code: str = "") -> dict:
    cameras = list(_active_cameras_qs(site_id=site_id, location_code=location_code))
    servers = list(_ml_servers_qs(site_id=site_id, location_code=location_code))
    if (site_id or location_code) and not servers:
        servers = list(_ml_servers_qs())
    if not servers:
        raise ValueError("No active ML servers available for distribution.")
    if not cameras:
        raise ValueError("No active cameras to distribute.")

    n_servers = len(servers)
    n_cams = len(cameras)
    plan: dict[int, list[int]] = {s.id: [] for s in servers}
    capacities = {
        s.id: (int(s.max_cameras) if s.max_cameras else n_cams) for s in servers
    }
    cam_ids = [c.id for c in cameras]
    for cam_id in cam_ids:
        candidates = sorted(
            servers,
            key=lambda s: (
                len(plan[s.id]) / max(capacities[s.id], 1),
                len(plan[s.id]),
                s.id,
            ),
        )
        placed = False
        for s in candidates:
            if len(plan[s.id]) < capacities[s.id]:
                plan[s.id].append(cam_id)
                placed = True
                break
        if not placed:
            s = min(servers, key=lambda x: (len(plan[x.id]), x.id))
            plan[s.id].append(cam_id)

    recommended = []
    for s in servers:
        ids = plan[s.id]
        recommended.append(
            {
                "ml_server_id": s.id,
                "ml_server_name": s.name,
                "max_cameras": s.max_cameras,
                "camera_count": len(ids),
                "camera_ids": ids,
            }
        )
    return {
        "total_cameras": n_cams,
        "ml_server_count": n_servers,
        "strategy": "balanced_capacity",
        "recommended": recommended,
    }


def apply_auto_distribute(
    *,
    site_id: int | None = None,
    location_code: str = "",
    camera_ids: Iterable[int] | None = None,
    dry_run: bool = False,
) -> dict:
    preview = preview_auto_distribute(site_id=site_id, location_code=location_code)
    if dry_run:
        return {**preview, "applied": False, "moved": 0}

    allowed = None
    if camera_ids is not None:
        allowed = {int(x) for x in camera_ids}

    moved = 0
    results = []
    warnings: list[str] = []
    for block in preview["recommended"]:
        server_id = block["ml_server_id"]
        for cam_id in block["camera_ids"]:
            if allowed is not None and cam_id not in allowed:
                continue
            try:
                result = assign_camera_to_server(cam_id, server_id, enforce_capacity=False)
                moved += 1
                results.append(
                    {
                        "camera_id": cam_id,
                        "ml_server_id": server_id,
                        "routing": result.get("routing"),
                    }
                )
                for w in (result.get("routing") or {}).get("warnings") or []:
                    warnings.append(w)
            except Exception as exc:
                warnings.append(f"camera {cam_id}: {exc}")
                logger.exception("[distribution] Failed assigning camera %s", cam_id)

    return {
        **preview,
        "applied": True,
        "moved": moved,
        "results": results,
        "warnings": warnings,
    }
