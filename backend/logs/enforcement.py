"""CIIS mobile device / access-session enforcement.

Lock/unlock stretches stay on MobilePhoneSession.
Login identity lives on MobileDevice + MobileAccessSession.
"""

from __future__ import annotations

import logging
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import connection, transaction
from django.db.utils import OperationalError, ProgrammingError
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from logs.middleware import create_activity_log, get_ip
from logs.models import (
    MobileAccessSession,
    MobileAlert,
    MobileDevice,
    MobileEventReceipt,
)
from users.permissions import can_view_all_staff, get_location_scope

logger = logging.getLogger(__name__)
_missing_mobile_table_warned = False

DESK_ROLES = frozenset(
    {
        "ADMIN",
        "IT_SUPERADMIN",
        "LOCATION_ADMIN",
        "IT_ADMIN",
        "HR",
        "AUDITOR",
        "PRAL",
        "RECEPTIONIST",
    }
)

MANAGE_DEVICE_ROLES = frozenset(
    {
        "ADMIN",
        "IT_SUPERADMIN",
        "LOCATION_ADMIN",
        "IT_ADMIN",
        "HR",
        "OPERATION_MANAGER",
        "COLLECTOR",
        "DEPUTY_COLLECTOR",
        "ASSISTANT_COLLECTOR",
    }
)

ALERT_VIEW_ROLES = MANAGE_DEVICE_ROLES

CAPABILITIES = (
    "can_view_live_gps",
    "can_view_gps_history",
    "can_view_attendance",
    "can_view_activity_logs",
    "can_view_mobile_devices",
    "can_manage_mobile_devices",
    "can_acknowledge_alerts",
    "can_view_security_alerts",
    "can_manage_roles",
)


def user_capabilities(user) -> dict[str, bool]:
    role = (getattr(user, "role", None) or "").upper()
    overview = can_view_all_staff(user)
    manage = role in MANAGE_DEVICE_ROLES
    return {
        "can_view_live_gps": overview,
        "can_view_gps_history": overview,
        "can_view_attendance": overview,
        "can_view_activity_logs": overview,
        "can_view_mobile_devices": overview or manage,
        "can_manage_mobile_devices": manage,
        "can_acknowledge_alerts": manage,
        "can_view_security_alerts": manage,
        "can_manage_roles": role in {"ADMIN", "IT_SUPERADMIN"},
    }


def can_view_mobile_devices(user) -> bool:
    return user_capabilities(user)["can_view_mobile_devices"]


def can_manage_mobile_devices(user) -> bool:
    return user_capabilities(user)["can_manage_mobile_devices"]


def can_acknowledge_alerts(user) -> bool:
    return user_capabilities(user)["can_acknowledge_alerts"]


def can_view_security_alerts(user) -> bool:
    return user_capabilities(user)["can_view_security_alerts"]


def should_track_location(user) -> bool:
    role = (getattr(user, "role", None) or "").upper()
    if not role:
        return True
    return role not in DESK_ROLES


def _setting(name: str, default):
    return getattr(settings, name, default)


def scoped_user_ids(actor):
    from users.models import User

    qs = User.objects.filter(is_deleted=False)
    scope = get_location_scope(actor)
    if scope:
        qs = qs.filter(location=scope)
    if not can_view_all_staff(actor):
        qs = qs.filter(pk=actor.pk)
    return qs


def assert_staff_in_scope(actor, target_user):
    if actor.pk == target_user.pk:
        return
    if not can_view_all_staff(actor):
        raise PermissionDenied("Not found.")
    scope = get_location_scope(actor)
    if scope and (getattr(target_user, "location", None) or "") != scope:
        raise PermissionDenied("Not found.")


def _log(user, request, action: str):
    if request is None:
        from logs.models import UserActivityLog

        UserActivityLog.objects.create(user=user, action=action[:255], source="mobile")
        return
    create_activity_log(user, request, action[:255], source="mobile")


def raise_or_create_alert(
    *,
    user,
    device=None,
    session=None,
    alert_type: str,
    severity: str,
    message: str,
    metadata=None,
):
    now = timezone.now()
    qs = MobileAlert.objects.filter(user=user, alert_type=alert_type, is_active=True)
    if device:
        qs = qs.filter(device=device)
    existing = qs.first()
    if existing:
        return existing, False
    alert = MobileAlert.objects.create(
        user=user,
        device=device,
        session=session,
        alert_type=alert_type,
        severity=severity,
        message=message[:255],
        detected_at=now,
        metadata=metadata or {},
    )
    return alert, True


def resolve_alerts(*, user, device=None, alert_types: list[str]):
    now = timezone.now()
    qs = MobileAlert.objects.filter(user=user, is_active=True, alert_type__in=alert_types)
    if device:
        qs = qs.filter(device=device)
    qs.update(is_active=False, resolved_at=now)


def remember_event_id(user, event_id: str | None, event_type: str) -> bool:
    """Return True if this event_id is new; False if duplicate."""
    if not event_id:
        return True
    _, created = MobileEventReceipt.objects.get_or_create(
        event_id=str(event_id)[:64],
        defaults={"event_type": event_type[:40], "user": user},
    )
    return created


class SessionRevoked(Exception):
    code = "SESSION_REVOKED"


class DeviceRevoked(Exception):
    code = "DEVICE_REVOKED"


def get_active_session(user, session_id: str | None, device_uuid: str | None) -> MobileAccessSession | None:
    qs = MobileAccessSession.objects.select_related("device", "user").filter(user=user)
    if session_id:
        return qs.filter(session_id=session_id).first()
    open_statuses = (MobileAccessSession.STATUS_ACTIVE, MobileAccessSession.STATUS_STALE)
    if device_uuid:
        return (
            qs.filter(device__device_uuid=device_uuid, status__in=open_statuses)
            .order_by("-started_at")
            .first()
        )
    return qs.filter(status__in=open_statuses).order_by("-started_at").first()


def require_active_mobile_session(user, session_id: str | None, device_uuid: str | None) -> MobileAccessSession:
    session = get_active_session(user, session_id, device_uuid)
    if not session:
        raise SessionRevoked("No active CIIS mobile session.")
    if session.user_id != user.pk:
        raise PermissionDenied("Not found.")
    device = session.device
    if device.is_revoked or not device.mobile_access_enabled:
        raise DeviceRevoked("This CIIS device has been revoked.")
    if session.status == MobileAccessSession.STATUS_REVOKED:
        raise SessionRevoked("Your CIIS mobile session has been revoked by an administrator.")
    if session.status in (MobileAccessSession.STATUS_LOGGED_OUT, MobileAccessSession.STATUS_EXPIRED):
        raise SessionRevoked("Your CIIS mobile session is no longer active.")
    # STALE sessions may heartbeat/GPS again; the monitor will mark them ACTIVE.
    return session


def register_or_update_device(user, payload: dict, request=None) -> tuple[MobileDevice, bool]:
    device_uuid = (payload.get("device_uuid") or "").strip()
    if not device_uuid:
        raise ValidationError({"device_uuid": "Required for mobile login."})
    now = timezone.now()
    ip = get_ip(request) if request is not None else None
    defaults = {
        "user": user,
        "device_name": (payload.get("device_name") or "")[:120],
        "platform": (payload.get("platform") or "")[:40],
        "browser": (payload.get("browser") or "")[:80],
        "os_version": (payload.get("os_version") or "")[:80],
        "app_version": (payload.get("app_version") or "")[:40],
        "pwa_version": (payload.get("pwa_version") or "")[:40],
        "last_seen_at": now,
        "last_heartbeat_at": now,
        "last_ip": ip or None,
        "is_active": True,
        "status": MobileDevice.STATUS_ACTIVE,
    }
    device = MobileDevice.objects.filter(device_uuid=device_uuid).first()
    created = False
    if device is None:
        device = MobileDevice.objects.create(device_uuid=device_uuid, **defaults)
        created = True
    else:
        if device.user_id != user.pk:
            raise ValidationError({"device_uuid": "This device is registered to another account."})
        if device.is_revoked or not device.mobile_access_enabled:
            raise DeviceRevoked("This CIIS device has been revoked.")
        for key, value in defaults.items():
            if key == "user":
                continue
            setattr(device, key, value)
        device.is_revoked = False
        device.save()
    return device, created


def start_mobile_session(user, device: MobileDevice, request=None, created_device=False) -> MobileAccessSession:
    now = timezone.now()
    policy = str(_setting("CIIS_MULTI_DEVICE_POLICY", "ALLOW_WITH_ALERT")).upper()
    max_devices = int(_setting("CIIS_MAX_ACTIVE_MOBILE_DEVICES", 1))
    others = MobileDevice.objects.filter(user=user, is_active=True, is_revoked=False).exclude(pk=device.pk)
    if others.exists():
        raise_or_create_alert(
            user=user,
            device=device,
            alert_type=MobileAlert.TYPE_MULTIPLE_DEVICE_LOGIN,
            severity=MobileAlert.SEVERITY_WARNING,
            message=f"{getattr(user, 'full_name', None) or user.username} logged in from another device",
        )
        if policy == "BLOCK" and others.count() >= max_devices:
            raise ValidationError(
                {"detail": "This account is already signed in on another CIIS device. Ask an administrator to revoke it."}
            )
        if policy == "REVOKE_OLD":
            for other in others:
                revoke_device(other, actor=user, request=request, reason="Replaced by a new device login")

    if created_device:
        raise_or_create_alert(
            user=user,
            device=device,
            alert_type=MobileAlert.TYPE_NEW_DEVICE,
            severity=MobileAlert.SEVERITY_INFO,
            message=f"New CIIS device registered for {getattr(user, 'full_name', None) or user.username}",
        )
        _log(user, request, "DEVICE_REGISTERED")

    with transaction.atomic():
        open_rows = list(
            MobileAccessSession.objects.select_for_update().filter(
                device=device, status=MobileAccessSession.STATUS_ACTIVE
            )
        )
        for row in open_rows:
            row.status = MobileAccessSession.STATUS_LOGGED_OUT
            row.ended_at = now
            row.save(update_fields=["status", "ended_at", "updated_at"])
        session = MobileAccessSession.objects.create(
            user=user,
            device=device,
            session_id=uuid.uuid4().hex,
            status=MobileAccessSession.STATUS_ACTIVE,
            started_at=now,
            last_heartbeat_at=now,
        )
    _log(user, request, "SESSION_STARTED")
    resolve_alerts(
        user=user,
        device=device,
        alert_types=[
            MobileAlert.TYPE_DEVICE_OFFLINE,
            MobileAlert.TYPE_DEVICE_OFFLINE_EXTENDED,
            MobileAlert.TYPE_SESSION_EXPIRED,
        ],
    )
    return session


def end_mobile_session(user, session: MobileAccessSession | None, request=None, status=None, log_logout=True):
    now = timezone.now()
    if not session:
        return
    session.status = status or MobileAccessSession.STATUS_LOGGED_OUT
    session.ended_at = now
    session.save(update_fields=["status", "ended_at", "updated_at"])
    if log_logout:
        _log(user, request, "SESSION_ENDED")
        _log(user, request, "LOGOUT")
        _log(user, request, "GPS_STOPPED")


def revoke_session(session: MobileAccessSession, actor, request=None, revoke_device=False):
    assert_staff_in_scope(actor, session.user)
    end_mobile_session(session.user, session, request=request, status=MobileAccessSession.STATUS_REVOKED, log_logout=False)
    _log(actor, request, f"SESSION_REVOKED {session.session_id[:8]}")
    raise_or_create_alert(
        user=session.user,
        device=session.device,
        session=session,
        alert_type=MobileAlert.TYPE_SESSION_REVOKED,
        severity=MobileAlert.SEVERITY_CRITICAL,
        message="CIIS mobile session revoked by an administrator",
    )
    if revoke_device:
        revoke_device_obj(session.device, actor, request=request)


def revoke_device_obj(device: MobileDevice, actor, request=None, reason=""):
    assert_staff_in_scope(actor, device.user)
    now = timezone.now()
    device.is_revoked = True
    device.is_active = False
    device.mobile_access_enabled = False
    device.status = MobileDevice.STATUS_REVOKED
    device.save(update_fields=["is_revoked", "is_active", "mobile_access_enabled", "status", "updated_at"])
    MobileAccessSession.objects.filter(device=device, status=MobileAccessSession.STATUS_ACTIVE).update(
        status=MobileAccessSession.STATUS_REVOKED, ended_at=now
    )
    _log(actor, request, f"DEVICE_REVOKED {device.device_uuid[:8]} {reason}".strip())
    raise_or_create_alert(
        user=device.user,
        device=device,
        alert_type=MobileAlert.TYPE_DEVICE_REVOKED,
        severity=MobileAlert.SEVERITY_CRITICAL,
        message=reason or "CIIS device revoked by an administrator",
    )


def revoke_device(device, actor, request=None, reason=""):
    revoke_device_obj(device, actor, request=request, reason=reason)


def touch_heartbeat(session: MobileAccessSession, payload: dict, request=None):
    now = timezone.now()
    device = session.device
    was_offline = device.status in (MobileDevice.STATUS_STALE, MobileDevice.STATUS_OFFLINE)
    device.last_seen_at = now
    device.last_heartbeat_at = now
    device.status = MobileDevice.STATUS_ACTIVE
    device.is_active = True
    battery = payload.get("battery_level")
    if battery is not None:
        device.battery_level = battery
    gps_status = (payload.get("gps_status") or "")[:32]
    if gps_status:
        device.last_gps_status = gps_status
    if request is not None:
        device.last_ip = get_ip(request)
    device.save()
    session.last_heartbeat_at = now
    if session.status == MobileAccessSession.STATUS_STALE:
        session.status = MobileAccessSession.STATUS_ACTIVE
    session.save(update_fields=["last_heartbeat_at", "status", "updated_at"])
    if was_offline:
        resolve_alerts(
            user=session.user,
            device=device,
            alert_types=[
                MobileAlert.TYPE_DEVICE_OFFLINE,
                MobileAlert.TYPE_DEVICE_OFFLINE_EXTENDED,
            ],
        )
        raise_or_create_alert(
            user=session.user,
            device=device,
            session=session,
            alert_type=MobileAlert.TYPE_DEVICE_RECONNECTED,
            severity=MobileAlert.SEVERITY_INFO,
            message="CIIS device reconnected",
        )
        _log(session.user, request, "DEVICE_RECONNECTED")
    if gps_status in ("active", "GPS_ACTIVE"):
        resolve_alerts(
            user=session.user,
            device=device,
            alert_types=[MobileAlert.TYPE_GPS_OFFLINE, MobileAlert.TYPE_GPS_PROBLEM],
        )


def touch_gps(session: MobileAccessSession, lat, lng, accuracy, battery=None):
    now = timezone.now()
    device = session.device
    device.last_gps_at = now
    device.last_latitude = lat
    device.last_longitude = lng
    device.last_accuracy = accuracy
    device.last_seen_at = now
    if battery is not None:
        device.battery_level = battery
    device.last_gps_status = "active"
    device.status = MobileDevice.STATUS_ACTIVE
    device.save()
    session.last_gps_at = now
    session.last_heartbeat_at = now
    session.save(update_fields=["last_gps_at", "last_heartbeat_at", "updated_at"])
    resolve_alerts(
        user=session.user,
        device=device,
        alert_types=[
            MobileAlert.TYPE_GPS_OFFLINE,
            MobileAlert.TYPE_GPS_PROBLEM,
            MobileAlert.TYPE_GPS_PERMISSION_DENIED,
        ],
    )


def record_mobile_event(user, event: str, request=None, session=None, device=None):
    mapping = {
        "GPS_PERMISSION_DENIED": (MobileAlert.TYPE_GPS_PERMISSION_DENIED, MobileAlert.SEVERITY_WARNING, "GPS permission denied"),
        "GPS_PERMISSION_REVOKED": (MobileAlert.TYPE_GPS_PERMISSION_REVOKED, MobileAlert.SEVERITY_WARNING, "CIIS location access has been disabled"),
        "GPS_STARTED": None,
        "GPS_STOPPED": None,
        "GPS_OFFLINE": (MobileAlert.TYPE_GPS_OFFLINE, MobileAlert.SEVERITY_WARNING, "GPS unavailable"),
        "GPS_RESTORED": None,
        "APP_OPEN": None,
        "APP_BACKGROUND": None,
        "LOGIN": None,
        "LOGOUT": None,
    }
    _log(user, request, event)
    spec = mapping.get(event)
    if spec:
        raise_or_create_alert(
            user=user,
            device=device,
            session=session,
            alert_type=spec[0],
            severity=spec[1],
            message=spec[2],
        )
    if event in ("GPS_RESTORED", "GPS_STARTED"):
        if device:
            resolve_alerts(
                user=user,
                device=device,
                alert_types=[
                    MobileAlert.TYPE_GPS_OFFLINE,
                    MobileAlert.TYPE_GPS_PERMISSION_DENIED,
                    MobileAlert.TYPE_GPS_PERMISSION_REVOKED,
                    MobileAlert.TYPE_GPS_PROBLEM,
                ],
            )


def session_payload(session: MobileAccessSession) -> dict:
    device = session.device
    return {
        "session_id": session.session_id,
        "status": session.status,
        "started_at": session.started_at.isoformat(),
        "device_uuid": device.device_uuid,
        "device_id": device.pk,
        "device_status": device.status,
        "gps_required": should_track_location(session.user),
    }


def device_payload(device: MobileDevice) -> dict:
    session = (
        MobileAccessSession.objects.filter(device=device).order_by("-started_at").first()
    )
    user = device.user
    return {
        "id": device.pk,
        "user_id": user.pk,
        "staff_name": (getattr(user, "full_name", None) or user.username),
        "username": user.username,
        "device_uuid": device.device_uuid,
        "device_name": device.device_name,
        "platform": device.platform,
        "browser": device.browser,
        "os_version": device.os_version,
        "app_version": device.app_version,
        "pwa_version": device.pwa_version,
        "is_active": device.is_active,
        "is_revoked": device.is_revoked,
        "mobile_access_enabled": device.mobile_access_enabled,
        "status": device.status,
        "registered_at": device.registered_at.isoformat() if device.registered_at else None,
        "last_seen_at": device.last_seen_at.isoformat() if device.last_seen_at else None,
        "last_gps_at": device.last_gps_at.isoformat() if device.last_gps_at else None,
        "last_heartbeat_at": device.last_heartbeat_at.isoformat() if device.last_heartbeat_at else None,
        "last_ip": device.last_ip,
        "last_latitude": device.last_latitude,
        "last_longitude": device.last_longitude,
        "last_accuracy": device.last_accuracy,
        "battery_level": device.battery_level,
        "last_gps_status": device.last_gps_status,
        "session_status": session.status if session else None,
        "session_id": session.session_id if session else None,
        "logged_in": bool(session and session.status == MobileAccessSession.STATUS_ACTIVE),
        "installed": True,
    }


def monitor_mobile_devices():
    global _missing_mobile_table_warned

    # Skip quietly until CIIS mobile migrations have been applied.
    table = MobileDevice._meta.db_table
    try:
        existing = set(connection.introspection.table_names())
        if table not in existing:
            if not _missing_mobile_table_warned:
                logger.warning(
                    "CIIS mobile monitor skipped: table %s is missing. "
                    "Run: python manage.py migrate logs",
                    table,
                )
                _missing_mobile_table_warned = True
            return
    except Exception:
        pass

    now = timezone.now()
    stale_after = timedelta(seconds=int(_setting("CIIS_DEVICE_STALE_AFTER", 180)))
    offline_after = timedelta(seconds=int(_setting("CIIS_DEVICE_OFFLINE_ALERT_AFTER", 300)))
    extended_after = timedelta(seconds=int(_setting("CIIS_DEVICE_OFFLINE_EXTENDED_AFTER", 600)))
    gps_problem_after = timedelta(seconds=int(_setting("CIIS_GPS_OFFLINE_AFTER", 300)))

    try:
        device_list = list(
            MobileDevice.objects.filter(is_revoked=False, is_active=True).select_related("user")
        )
    except (ProgrammingError, OperationalError):
        if not _missing_mobile_table_warned:
            logger.warning(
                "CIIS mobile monitor skipped: database error querying %s. "
                "Run: python manage.py migrate logs",
                table,
            )
            _missing_mobile_table_warned = True
        return

    for device in device_list:
        last = device.last_heartbeat_at or device.last_seen_at or device.registered_at
        if not last:
            continue
        age = now - last
        session = (
            MobileAccessSession.objects.filter(
                device=device,
                status__in=(MobileAccessSession.STATUS_ACTIVE, MobileAccessSession.STATUS_STALE),
            )
            .order_by("-started_at")
            .first()
        )
        if not session:
            continue
        if age >= stale_after and session:
            session.status = MobileAccessSession.STATUS_STALE
            session.save(update_fields=["status", "updated_at"])
            device.status = MobileDevice.STATUS_STALE
            device.save(update_fields=["status", "updated_at"])
        if age >= offline_after:
            device.status = MobileDevice.STATUS_OFFLINE
            device.save(update_fields=["status", "updated_at"])
            raise_or_create_alert(
                user=device.user,
                device=device,
                session=session,
                alert_type=MobileAlert.TYPE_DEVICE_OFFLINE,
                severity=MobileAlert.SEVERITY_CRITICAL,
                message=f"{getattr(device.user, 'full_name', None) or device.user.username} device offline",
            )
            if age >= extended_after:
                raise_or_create_alert(
                    user=device.user,
                    device=device,
                    session=session,
                    alert_type=MobileAlert.TYPE_DEVICE_OFFLINE_EXTENDED,
                    severity=MobileAlert.SEVERITY_CRITICAL,
                    message=f"{getattr(device.user, 'full_name', None) or device.user.username} device offline (extended)",
                )
            continue
        gps_at = device.last_gps_at
        heartbeat_ok = age < offline_after
        gps_missing = (not gps_at) or (now - gps_at) >= gps_problem_after
        if heartbeat_ok and gps_missing and should_track_location(device.user) and session:
            raise_or_create_alert(
                user=device.user,
                device=device,
                session=session,
                alert_type=MobileAlert.TYPE_GPS_PROBLEM,
                severity=MobileAlert.SEVERITY_WARNING,
                message=f"{getattr(device.user, 'full_name', None) or device.user.username} GPS unavailable",
            )
            raise_or_create_alert(
                user=device.user,
                device=device,
                session=session,
                alert_type=MobileAlert.TYPE_GPS_OFFLINE,
                severity=MobileAlert.SEVERITY_WARNING,
                message=f"{getattr(device.user, 'full_name', None) or device.user.username} GPS offline",
            )
