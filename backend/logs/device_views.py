from __future__ import annotations

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from logs.enforcement import (
    DeviceRevoked,
    SessionRevoked,
    can_acknowledge_alerts,
    can_manage_mobile_devices,
    can_view_mobile_devices,
    can_view_security_alerts,
    device_payload,
    end_mobile_session,
    get_active_session,
    record_mobile_event,
    remember_event_id,
    require_active_mobile_session,
    revoke_device_obj,
    revoke_session,
    scoped_user_ids,
    session_payload,
    touch_heartbeat,
    user_capabilities,
)
from logs.models import MobileAccessSession, MobileAlert, MobileDevice
from users.permissions import get_location_scope


def _auth_error(exc):
    if isinstance(exc, SessionRevoked):
        return Response({"detail": str(exc), "code": "SESSION_REVOKED"}, status=status.HTTP_401_UNAUTHORIZED)
    if isinstance(exc, DeviceRevoked):
        return Response({"detail": str(exc), "code": "DEVICE_REVOKED"}, status=status.HTTP_403_FORBIDDEN)
    raise exc


class MobileHeartbeatView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            session = require_active_mobile_session(
                request.user,
                request.data.get("session_id"),
                request.data.get("device_uuid"),
            )
        except (SessionRevoked, DeviceRevoked) as exc:
            return _auth_error(exc)
        event_id = request.data.get("event_id")
        if event_id and not remember_event_id(request.user, event_id, "heartbeat"):
            return Response({"ok": True, "duplicate": True, "session": session_payload(session)})
        touch_heartbeat(session, request.data, request=request)
        return Response({"ok": True, "session": session_payload(session)})


class MobileEventsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        event = (request.data.get("event") or request.data.get("event_type") or "").strip()
        if not event:
            return Response({"detail": "event is required"}, status=status.HTTP_400_BAD_REQUEST)
        event_id = request.data.get("event_id")
        if event_id and not remember_event_id(request.user, event_id, event):
            return Response({"ok": True, "duplicate": True})
        session = get_active_session(
            request.user, request.data.get("session_id"), request.data.get("device_uuid")
        )
        device = session.device if session else None
        record_mobile_event(request.user, event, request=request, session=session, device=device)
        return Response({"ok": True})


class MobileDeviceListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not can_view_mobile_devices(request.user):
            qs = MobileDevice.objects.filter(user=request.user)
        else:
            ids = scoped_user_ids(request.user)
            qs = MobileDevice.objects.filter(user__in=ids)
        username = (request.query_params.get("username") or "").strip()
        if username:
            qs = qs.filter(user__username__icontains=username)
        user_id = (request.query_params.get("user_id") or "").strip()
        if user_id.isdigit():
            qs = qs.filter(user_id=int(user_id))
        rows = [device_payload(d) for d in qs.select_related("user").order_by("-last_seen_at")[:200]]
        return Response({"results": rows, "count": len(rows)})


class MobileDeviceDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk: int):
        device = MobileDevice.objects.select_related("user").filter(pk=pk).first()
        if not device:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if device.user_id != request.user.pk and not can_view_mobile_devices(request.user):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        scope = get_location_scope(request.user)
        if scope and device.user_id != request.user.pk and (device.user.location or "") != scope:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(device_payload(device))


class MobileDeviceRevokeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int):
        if not can_manage_mobile_devices(request.user):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
        device = MobileDevice.objects.select_related("user").filter(pk=pk).first()
        if not device:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        revoke_device_obj(device, request.user, request=request, reason=(request.data.get("reason") or ""))
        return Response({"ok": True})


class MobileDeviceTerminateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int):
        if not can_manage_mobile_devices(request.user):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
        device = MobileDevice.objects.select_related("user").filter(pk=pk).first()
        if not device:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        session = (
            MobileAccessSession.objects.filter(
                device=device,
                status__in=(MobileAccessSession.STATUS_ACTIVE, MobileAccessSession.STATUS_STALE),
            )
            .order_by("-started_at")
            .first()
        )
        if session:
            revoke_session(session, request.user, request=request, revoke_device=False)
        return Response({"ok": True})


class MobileDeviceDisableView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int):
        if not can_manage_mobile_devices(request.user):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
        device = MobileDevice.objects.select_related("user").filter(pk=pk).first()
        if not device:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        revoke_device_obj(
            device,
            request.user,
            request=request,
            reason=(request.data.get("reason") or "Mobile access disabled"),
        )
        return Response({"ok": True})


class MobileSessionRevokeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not can_manage_mobile_devices(request.user):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
        session_id = (request.data.get("session_id") or "").strip()
        session = MobileAccessSession.objects.select_related("user", "device").filter(session_id=session_id).first()
        if not session:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        revoke_session(
            session,
            request.user,
            request=request,
            revoke_device=bool(request.data.get("revoke_device")),
        )
        return Response({"ok": True})


class MobileAlertListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not can_view_security_alerts(request.user):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
        ids = scoped_user_ids(request.user)
        qs = MobileAlert.objects.select_related("user", "user__staff_profile", "device", "session").filter(user__in=ids)
        if (request.query_params.get("active") or "1") in ("1", "true", "yes"):
            qs = qs.filter(is_active=True)
        severity = (request.query_params.get("severity") or "").strip().upper()
        if severity:
            qs = qs.filter(severity=severity)
        rows = []
        for alert in qs.order_by("-detected_at")[:200]:
            device = alert.device
            rows.append(
                {
                    "id": alert.pk,
                    "alert_type": alert.alert_type,
                    "severity": alert.severity,
                    "message": alert.message,
                    "staff_name": getattr(alert.user, "full_name", None) or alert.user.username,
                    "user_id": alert.user_id,
                    "staff_id": getattr(getattr(alert.user, "staff_profile", None), "pk", None),
                    "device_id": device.pk if device else None,
                    "device_uuid": device.device_uuid if device else None,
                    "device_name": device.device_name if device else None,
                    "created_at": alert.created_at.isoformat(),
                    "detected_at": alert.detected_at.isoformat(),
                    "is_active": alert.is_active,
                    "last_gps_at": device.last_gps_at.isoformat() if device and device.last_gps_at else None,
                    "last_heartbeat_at": device.last_heartbeat_at.isoformat() if device and device.last_heartbeat_at else None,
                    "last_latitude": device.last_latitude if device else None,
                    "last_longitude": device.last_longitude if device else None,
                    "battery_level": device.battery_level if device else None,
                    "device_status": device.status if device else None,
                    "session_status": alert.session.status if alert.session else None,
                }
            )
        return Response({"results": rows, "count": len(rows), "capabilities": user_capabilities(request.user)})


class MobileAlertAcknowledgeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int):
        if not can_acknowledge_alerts(request.user):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
        alert = MobileAlert.objects.select_related("user").filter(pk=pk).first()
        if not alert:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        from django.utils import timezone

        alert.acknowledged_at = timezone.now()
        alert.acknowledged_by = request.user
        alert.is_active = False
        alert.resolved_at = alert.resolved_at or timezone.now()
        alert.save()
        return Response({"ok": True})


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        session = get_active_session(
            request.user, request.data.get("session_id"), request.data.get("device_uuid")
        )
        event_id = request.data.get("event_id")
        if event_id:
            remember_event_id(request.user, event_id, "LOGOUT")
        end_mobile_session(request.user, session, request=request)
        return Response({"ok": True})
