"""Sync TekEye cameras/NVRs into Infrastructure Monitoring + evaluate alerts."""

from __future__ import annotations

import logging
from typing import Any

from django.db import transaction
from django.utils import timezone

from .models import (
    AlertSeverity,
    DeviceStatus,
    DeviceType,
    InfraAlert,
    InfraAlertRule,
    InfraDevice,
    InfraEvent,
    InfraSite,
    ProtocolType,
)

logger = logging.getLogger(__name__)


def _ensure_site_from_camera_site(cam_site) -> InfraSite | None:
    if not cam_site:
        return None
    site, _ = InfraSite.objects.get_or_create(
        code=cam_site.code,
        defaults={
            "name": cam_site.name,
            "location": cam_site.code,
            "description": getattr(cam_site, "description", "") or "",
            "is_active": getattr(cam_site, "is_active", True),
        },
    )
    return site


def sync_cameras_and_nvrs() -> dict[str, int]:
    """
    Auto-import active NVRs and Cameras from the cameras app so they appear
    in Infrastructure Monitoring without manual re-entry.
    """
    created = updated = 0
    try:
        from cameras.models import Camera, Nvr
    except Exception as exc:
        logger.warning("cameras app unavailable for sync: %s", exc)
        return {"created": 0, "updated": 0, "skipped": 1}

    # NVRs
    for nvr in Nvr.objects.select_related("site").filter(is_active=True):
        key = f"cameras.nvr:{nvr.id}"
        site = _ensure_site_from_camera_site(nvr.site)
        defaults = {
            "site": site,
            "device_type": DeviceType.NVR,
            "name": nvr.name,
            "manufacturer": (nvr.brand or "").title(),
            "model_number": nvr.brand or "",
            "ip_address": nvr.ip_address,
            "port": nvr.port or 554,
            "username": nvr.username or "",
            "primary_protocol": ProtocolType.SNMP,
            "secondary_protocol": ProtocolType.RTSP,
            "supports_snmp": True,
            "supports_rtsp": True,
            "channel_count": nvr.cameras.count(),
            "is_active": True,
            "poll_interval_sec": 60,
            "notes": "Auto-synced from Camera Management",
            "metadata": {"brand": nvr.brand, "source": "cameras.nvr"},
            "onvif_port": 80,  # HTTP/ISAPI management port
        }
        obj = InfraDevice.objects.filter(source_key=key).first()
        if obj is None:
            if nvr.password:
                defaults["password"] = nvr.password
            InfraDevice.objects.create(source_key=key, **defaults)
            created += 1
            InfraEvent.objects.create(
                device=InfraDevice.objects.filter(source_key=key).first(),
                event_type="auto_sync",
                title=f"NVR imported: {nvr.name}",
                message="Synced from Camera Management",
                actor="system",
            )
        else:
            for field, value in defaults.items():
                if field == "password":
                    continue
                setattr(obj, field, value)
            if nvr.password:
                obj.password = nvr.password
            obj.save()
            updated += 1

    # Cameras
    for cam in Camera.objects.select_related("nvr", "nvr__site").filter(nvr__is_active=True):
        key = f"cameras.camera:{cam.id}"
        site = _ensure_site_from_camera_site(cam.nvr.site if cam.nvr_id else None)
        ip = cam.nvr.ip_address if cam.nvr_id else None
        defaults = {
            "site": site,
            "device_type": DeviceType.CAMERA,
            "name": cam.name or cam.code or f"Camera {cam.id}",
            "manufacturer": (cam.nvr.brand if cam.nvr_id else "") or "",
            "model_number": getattr(cam, "camera_type", "") or "",
            "ip_address": ip,
            "port": cam.nvr.port if cam.nvr_id else 554,
            "install_location": cam.zone or cam.location or "",
            "username": cam.nvr.username if cam.nvr_id else "",
            "primary_protocol": ProtocolType.ICMP,
            "secondary_protocol": ProtocolType.RTSP,
            "supports_rtsp": True,
            "supports_onvif": False,
            "is_active": True,
            "poll_interval_sec": 60,
            "asset_tag": cam.code or "",
            "notes": "Auto-synced from Camera Management",
            "metadata": {
                "channel": cam.channel,
                "camera_code": cam.code,
                "source": "cameras.camera",
                "nvr_id": cam.nvr_id,
            },
        }
        # Seed status from camera record until first poll
        cam_status = (cam.status or "").lower()
        seed_status = (
            DeviceStatus.ONLINE
            if cam_status == "online"
            else DeviceStatus.OFFLINE
            if cam_status == "offline"
            else DeviceStatus.UNKNOWN
        )
        obj = InfraDevice.objects.filter(source_key=key).first()
        if obj is None:
            if cam.nvr_id and cam.nvr.password:
                defaults["password"] = cam.nvr.password
            defaults["status"] = seed_status
            InfraDevice.objects.create(source_key=key, **defaults)
            created += 1
        else:
            for field, value in defaults.items():
                setattr(obj, field, value)
            obj.save()
            updated += 1

    return {"created": created, "updated": updated, "skipped": 0}


def _compare(op: str, left: float, right: float) -> bool:
    op = (op or "lt").lower()
    if op == "lt":
        return left < right
    if op == "lte":
        return left <= right
    if op == "gt":
        return left > right
    if op == "gte":
        return left >= right
    if op == "eq":
        return left == right
    if op == "neq":
        return left != right
    return False


def evaluate_alert_rules(device: InfraDevice) -> int:
    """Create/update open alerts from active rules vs last_metrics / status."""
    raised = 0
    metrics = device.last_metrics or {}
    rules = InfraAlertRule.objects.filter(is_active=True)
    for rule in rules:
        if rule.device_type and rule.device_type != device.device_type:
            continue
        key = (rule.metric_key or "").strip()
        if not key:
            continue

        # Special: offline
        if key in ("offline", "status_offline"):
            triggered = device.status == DeviceStatus.OFFLINE
            metric_value = 1.0 if triggered else 0.0
        elif key in ("fault", "status_fault"):
            triggered = device.status == DeviceStatus.FAULT
            metric_value = 1.0 if triggered else 0.0
        else:
            raw = metrics.get(key)
            if raw is None:
                continue
            try:
                metric_value = float(raw)
            except (TypeError, ValueError):
                continue
            if rule.threshold_value is None:
                continue
            triggered = _compare(rule.operator, metric_value, float(rule.threshold_value))

        alert_type = f"rule:{rule.id}:{key}"
        existing = (
            InfraAlert.objects.filter(
                device=device, alert_type=alert_type, resolved=False
            )
            .order_by("-last_detected")
            .first()
        )
        if triggered:
            title = rule.message_template or f"{device.name}: {key} alert"
            if existing:
                existing.metric_value = metric_value
                existing.message = title
                existing.save(update_fields=["metric_value", "message", "last_detected"])
            else:
                InfraAlert.objects.create(
                    device=device,
                    alert_type=alert_type,
                    severity=rule.severity or AlertSeverity.MEDIUM,
                    title=title[:200],
                    message=title,
                    metric_key=key,
                    metric_value=metric_value,
                )
                raised += 1
                InfraEvent.objects.create(
                    device=device,
                    event_type="alert_raised",
                    title=title[:200],
                    message=f"{key}={metric_value}",
                    actor="system",
                )
        elif existing:
            existing.resolved = True
            existing.resolved_at = timezone.now()
            existing.save(update_fields=["resolved", "resolved_at", "last_detected"])
            InfraEvent.objects.create(
                device=device,
                event_type="alert_cleared",
                title=f"Cleared: {existing.title}",
                actor="system",
            )
    return raised


@transaction.atomic
def apply_probe_result(device: InfraDevice, result: dict[str, Any]) -> InfraDevice:
    old_status = device.status
    device.status = result["status"]
    device.last_metrics = result.get("metrics") or {}
    device.last_error = (result.get("error") or "")[:512]
    device.last_polled_at = timezone.now()
    if result.get("reachable"):
        device.last_seen_at = device.last_polled_at
    device.save(
        update_fields=[
            "status",
            "last_metrics",
            "last_error",
            "last_polled_at",
            "last_seen_at",
            "updated_at",
        ]
    )
    if old_status != device.status:
        InfraEvent.objects.create(
            device=device,
            event_type="status_change",
            title=f"{device.name}: {old_status} → {device.status}",
            message=device.last_error,
            actor="poller",
            payload={"from": old_status, "to": device.status},
        )
    evaluate_alert_rules(device)
    return device


def poll_all_devices(*, limit: int | None = None) -> dict[str, int]:
    from .poller import probe_device

    qs = InfraDevice.objects.filter(is_active=True).order_by("id")
    if limit:
        qs = qs[:limit]
    online = offline = degraded = fault = errors = 0
    for device in qs:
        try:
            result = probe_device(device)
            apply_probe_result(device, result)
            st = result["status"]
            if st == DeviceStatus.ONLINE:
                online += 1
            elif st == DeviceStatus.OFFLINE:
                offline += 1
            elif st == DeviceStatus.DEGRADED:
                degraded += 1
            elif st == DeviceStatus.FAULT:
                fault += 1
        except Exception as exc:
            errors += 1
            logger.exception("probe failed for device %s: %s", device.id, exc)
            device.status = DeviceStatus.UNKNOWN
            device.last_error = str(exc)[:512]
            device.last_polled_at = timezone.now()
            device.save(update_fields=["status", "last_error", "last_polled_at", "updated_at"])
    return {
        "polled": online + offline + degraded + fault + errors,
        "online": online,
        "offline": offline,
        "degraded": degraded,
        "fault": fault,
        "errors": errors,
    }


def sync_and_poll() -> dict[str, Any]:
    sync_stats = sync_cameras_and_nvrs()
    poll_stats = poll_all_devices()
    return {"sync": sync_stats, "poll": poll_stats}
