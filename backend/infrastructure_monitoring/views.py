from django.db.models import Count, Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    DeviceStatus,
    DeviceType,
    InfraAlert,
    InfraAlertRule,
    InfraDevice,
    InfraEvent,
    InfraSite,
)
from .permissions import IsInfraAdmin
from .serializers import (
    InfraAlertRuleSerializer,
    InfraAlertSerializer,
    InfraDeviceSerializer,
    InfraEventSerializer,
    InfraSiteSerializer,
)


def _actor_name(request) -> str:
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return ""
    return getattr(user, "username", "") or getattr(user, "email", "") or str(user.pk)


def _log_event(*, device, event_type, title, message="", actor="", payload=None):
    InfraEvent.objects.create(
        device=device,
        event_type=event_type,
        title=title,
        message=message,
        actor=actor,
        payload=payload or {},
    )


class InfraSiteViewSet(viewsets.ModelViewSet):
    queryset = InfraSite.objects.all()
    serializer_class = InfraSiteSerializer
    permission_classes = [IsInfraAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["is_active", "location"]
    search_fields = ["code", "name", "location"]
    ordering_fields = ["name", "code", "created_at"]


class InfraDeviceViewSet(viewsets.ModelViewSet):
    queryset = InfraDevice.objects.select_related("site").all()
    serializer_class = InfraDeviceSerializer
    permission_classes = [IsInfraAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        "device_type",
        "is_active",
        "status",
        "site",
        "primary_protocol",
        "supports_snmp",
        "supports_modbus",
    ]
    search_fields = [
        "name",
        "manufacturer",
        "model_number",
        "serial_number",
        "ip_address",
        "asset_tag",
        "install_location",
    ]
    ordering_fields = ["name", "device_type", "status", "created_at", "last_seen_at"]

    def perform_create(self, serializer):
        device = serializer.save()
        _log_event(
            device=device,
            event_type="device_created",
            title=f"Device created: {device.name}",
            message=f"{device.get_device_type_display()} registered",
            actor=_actor_name(self.request),
            payload={"device_type": device.device_type},
        )

    def perform_update(self, serializer):
        device = serializer.save()
        _log_event(
            device=device,
            event_type="device_updated",
            title=f"Device updated: {device.name}",
            actor=_actor_name(self.request),
        )

    def perform_destroy(self, instance):
        name = instance.name
        dtype = instance.device_type
        _log_event(
            device=None,
            event_type="device_deleted",
            title=f"Device deleted: {name}",
            message=f"Removed {dtype}",
            actor=_actor_name(self.request),
            payload={"device_type": dtype, "name": name},
        )
        instance.delete()

    @action(detail=True, methods=["get"])
    def nvr_detail(self, request, pk=None):
        """Structured NVR health detail (system / storage / network / channels)."""
        from .models import DeviceType
        from .nvr_health import build_nvr_detail_payload, enrich_nvr_metrics
        from .poller import probe_device
        from .services import apply_probe_result

        device = self.get_object()
        if device.device_type != DeviceType.NVR:
            return Response(
                {"detail": "This endpoint is only for NVR devices."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        refresh = (request.query_params.get("refresh") or "").lower() in (
            "1",
            "true",
            "yes",
        )
        if refresh:
            result = probe_device(device)
            # Ensure NVR enrich even if probe path skipped it
            try:
                result["metrics"] = {
                    **(result.get("metrics") or {}),
                    **enrich_nvr_metrics(device),
                }
            except Exception:
                pass
            apply_probe_result(device, result)
            device.refresh_from_db()
        return Response(build_nvr_detail_payload(device))

    @action(detail=True, methods=["get"])
    def camera_detail(self, request, pk=None):
        """Structured camera health detail (SNMP/ISAPI, RTSP, image quality)."""
        from .camera_health import build_camera_detail_payload, enrich_camera_metrics
        from .models import DeviceType
        from .poller import probe_device
        from .services import apply_probe_result

        device = self.get_object()
        if device.device_type != DeviceType.CAMERA:
            return Response(
                {"detail": "This endpoint is only for camera devices."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        refresh = (request.query_params.get("refresh") or "").lower() in (
            "1",
            "true",
            "yes",
        )
        if refresh:
            result = probe_device(device)
            try:
                result["metrics"] = {
                    **(result.get("metrics") or {}),
                    **enrich_camera_metrics(device),
                }
            except Exception:
                pass
            apply_probe_result(device, result)
            device.refresh_from_db()
        elif not (device.last_metrics or {}).get("camera_probe"):
            # First open: enrich without requiring explicit refresh
            try:
                slim = {**(device.last_metrics or {}), **enrich_camera_metrics(device)}
                device.last_metrics = slim
                device.save(update_fields=["last_metrics", "updated_at"])
                device.refresh_from_db()
            except Exception:
                pass
        return Response(build_camera_detail_payload(device))

    @action(detail=True, methods=["get"])
    def server_detail(self, request, pk=None):
        """Structured server health (CPU / RAM / disk / GPU / services / logs)."""
        from .models import DeviceType
        from .poller import probe_device
        from .server_health import build_server_detail_payload, enrich_server_metrics
        from .services import apply_probe_result

        device = self.get_object()
        if device.device_type != DeviceType.SERVER:
            return Response(
                {"detail": "This endpoint is only for server devices."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        refresh = (request.query_params.get("refresh") or "").lower() in (
            "1",
            "true",
            "yes",
        )
        if refresh or (
            not (device.last_metrics or {}).get("cpu_percent")
            and not (device.last_metrics or {}).get("memory_percent")
        ):
            # probe_device already runs enrich_server_metrics for SERVER — do not SSH twice
            result = probe_device(device)
            apply_probe_result(device, result)
            device.refresh_from_db()
        return Response(build_server_detail_payload(device))

    @action(detail=True, methods=["get", "post", "delete"])
    def server_logs(self, request, pk=None):
        """
        List / refresh / delete server logs.
        GET    — stored logs (optional ?category=)
        POST   — re-enrich from agent then return stored set
        DELETE — clear stored logs (Super Admin only; optional ?category=)
        """
        from .models import DeviceType, InfraServerLog
        from .server_health import enrich_server_metrics, load_stored_server_logs
        from users.permissions import is_global_admin

        device = self.get_object()
        if device.device_type != DeviceType.SERVER:
            return Response(
                {"detail": "This endpoint is only for server devices."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        category = (request.query_params.get("category") or "").strip() or None
        if isinstance(request.data, dict) and not category:
            category = (request.data.get("category") or "").strip() or None

        if request.method == "DELETE":
            if not is_global_admin(request.user):
                return Response(
                    {"detail": "Only Super Admin can delete server logs."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            qs = InfraServerLog.objects.filter(device=device)
            if category:
                qs = qs.filter(category=category)
            deleted, _ = qs.delete()
            return Response({"ok": True, "deleted": deleted, "category": category or "all"})

        if request.method == "POST":
            metrics = enrich_server_metrics(device)
            slim = {**(device.last_metrics or {}), **metrics}
            slim["server_logs"] = []
            device.last_metrics = slim
            device.save(update_fields=["last_metrics", "updated_at"])

        limit = 2000
        try:
            limit = min(10000, max(100, int(request.query_params.get("limit") or 2000)))
        except (TypeError, ValueError):
            pass
        logs = load_stored_server_logs(device, limit=limit, category=category)
        return Response({"count": len(logs), "results": logs})

    @action(detail=True, methods=["get", "post", "delete"])
    def nvr_logs(self, request, pk=None):
        """
        List / refresh / delete NVR logs.
        GET    — stored logs from DB
        POST   — pull latest from NVR then return stored set
        DELETE — clear stored logs (Super Admin only)
        """
        from .models import DeviceType, InfraNvrLog
        from .nvr_health import enrich_nvr_metrics, load_stored_nvr_logs
        from users.permissions import is_global_admin

        device = self.get_object()
        if device.device_type != DeviceType.NVR:
            return Response(
                {"detail": "This endpoint is only for NVR devices."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.method == "DELETE":
            if not is_global_admin(request.user):
                return Response(
                    {"detail": "Only Super Admin can delete NVR logs."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            deleted, _ = InfraNvrLog.objects.filter(device=device).delete()
            return Response({"ok": True, "deleted": deleted})

        if request.method == "POST":
            metrics = enrich_nvr_metrics(device)
            slim = {**(device.last_metrics or {}), **metrics}
            slim["nvr_logs"] = []
            slim["nvr_logs_count"] = metrics.get("nvr_logs_count") or 0
            device.last_metrics = slim
            device.save(update_fields=["last_metrics", "updated_at"])

        limit = 5000
        try:
            limit = min(10000, max(100, int(request.query_params.get("limit") or 5000)))
        except (TypeError, ValueError):
            pass
        logs = load_stored_nvr_logs(device, limit=limit)
        return Response({"count": len(logs), "results": logs})

    @action(detail=True, methods=["post"])
    def probe(self, request, pk=None):
        """Live-probe this device (ICMP / Modbus / ports) and update status."""
        from .poller import probe_device
        from .services import apply_probe_result

        device = self.get_object()
        result = probe_device(device)
        apply_probe_result(device, result)
        device.refresh_from_db()
        return Response(InfraDeviceSerializer(device).data)

    @action(detail=True, methods=["post"])
    def update_metrics(self, request, pk=None):
        """Optional external poller push for metrics (status still derived)."""
        from .server_health import persist_server_logs
        from .services import apply_probe_result, evaluate_alert_rules

        device = self.get_object()
        metrics = request.data.get("metrics")
        if not isinstance(metrics, dict):
            return Response(
                {"detail": "metrics must be an object."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Optional top-level logs array (server agent)
        logs = request.data.get("logs")
        if isinstance(logs, list):
            metrics = {**metrics, "server_logs": logs}
        elif isinstance(metrics.get("server_logs"), list):
            pass

        if isinstance(metrics.get("server_logs"), list):
            try:
                created = persist_server_logs(device, metrics.get("server_logs") or [])
                metrics = {**metrics, "server_logs": [], "server_logs_saved": created}
                from .models import InfraServerLog

                metrics["server_logs_count"] = InfraServerLog.objects.filter(
                    device=device
                ).count()
            except Exception:
                metrics = {**metrics, "server_logs": []}

        merged = {**(device.last_metrics or {}), **metrics}
        # Re-derive status from reachability + metrics hints
        status_hint = DeviceStatus.ONLINE
        if merged.get("inverter_fault") in (1, True, "1", "true"):
            status_hint = DeviceStatus.FAULT
        apply_probe_result(
            device,
            {
                "status": status_hint,
                "reachable": True,
                "metrics": merged,
                "error": "",
                "protocol_ok": True,
            },
        )
        evaluate_alert_rules(device)
        device.refresh_from_db()
        return Response(InfraDeviceSerializer(device).data)


class InfraRefreshView(APIView):
    """Sync cameras/NVRs from Camera Management and poll all device statuses."""

    permission_classes = [IsInfraAdmin]

    def post(self, request):
        from .services import sync_and_poll

        stats = sync_and_poll()
        return Response({"detail": "Sync and poll completed.", **stats})

    def get(self, request):
        # Same as POST for convenience from the UI refresh button
        return self.post(request)


class InfraAlertRuleViewSet(viewsets.ModelViewSet):
    queryset = InfraAlertRule.objects.all()
    serializer_class = InfraAlertRuleSerializer
    permission_classes = [IsInfraAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["device_type", "is_active", "severity", "metric_key"]
    search_fields = ["name", "metric_key"]


class InfraAlertViewSet(viewsets.ModelViewSet):
    queryset = InfraAlert.objects.select_related("device").all()
    serializer_class = InfraAlertSerializer
    permission_classes = [IsInfraAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["severity", "resolved", "acknowledged", "alert_type", "device"]
    search_fields = ["title", "message", "alert_type"]
    ordering_fields = ["last_detected", "severity", "first_detected"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    @action(detail=True, methods=["post"])
    def acknowledge(self, request, pk=None):
        alert = self.get_object()
        alert.acknowledged = True
        alert.acknowledged_at = timezone.now()
        alert.save(update_fields=["acknowledged", "acknowledged_at"])
        return Response(InfraAlertSerializer(alert).data)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        alert = self.get_object()
        alert.resolved = True
        alert.resolved_at = timezone.now()
        alert.acknowledged = True
        if not alert.acknowledged_at:
            alert.acknowledged_at = timezone.now()
        alert.save(
            update_fields=[
                "resolved",
                "resolved_at",
                "acknowledged",
                "acknowledged_at",
            ]
        )
        return Response(InfraAlertSerializer(alert).data)


class InfraEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = InfraEvent.objects.select_related("device").all()
    serializer_class = InfraEventSerializer
    permission_classes = [IsInfraAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["event_type", "device"]
    search_fields = ["title", "message", "actor"]
    ordering_fields = ["created_at"]


class InfraOverviewView(APIView):
    permission_classes = [IsInfraAdmin]

    def get(self, request):
        devices = InfraDevice.objects.filter(is_active=True)
        by_type = {
            row["device_type"]: row["c"]
            for row in devices.values("device_type").annotate(c=Count("id"))
        }
        by_status = {
            row["status"]: row["c"]
            for row in devices.values("status").annotate(c=Count("id"))
        }
        open_alerts = InfraAlert.objects.filter(resolved=False).count()
        critical_alerts = InfraAlert.objects.filter(
            resolved=False, severity="critical"
        ).count()
        recent_events = InfraEventSerializer(
            InfraEvent.objects.select_related("device").all()[:10],
            many=True,
        ).data
        recent_alerts = InfraAlertSerializer(
            InfraAlert.objects.select_related("device")
            .filter(resolved=False)
            .order_by("-last_detected")[:10],
            many=True,
        ).data

        power_devices = devices.filter(
            device_type__in=[DeviceType.UPS, DeviceType.INVERTER]
        )
        power_summary = []
        for d in power_devices[:50]:
            metrics = d.last_metrics or {}
            power_summary.append(
                {
                    "id": d.id,
                    "name": d.name,
                    "device_type": d.device_type,
                    "status": d.status,
                    "battery_percent": metrics.get("battery_percent"),
                    "solar_kw": metrics.get("solar_kw") or metrics.get("pv_power_kw"),
                    "load_kw": metrics.get("load_kw"),
                    "grid_available": metrics.get("grid_available"),
                }
            )

        return Response(
            {
                "totals": {
                    "sites": InfraSite.objects.filter(is_active=True).count(),
                    "devices": devices.count(),
                    "online": by_status.get(DeviceStatus.ONLINE, 0),
                    "offline": by_status.get(DeviceStatus.OFFLINE, 0),
                    "degraded": by_status.get(DeviceStatus.DEGRADED, 0),
                    "fault": by_status.get(DeviceStatus.FAULT, 0),
                    "unknown": by_status.get(DeviceStatus.UNKNOWN, 0),
                    "open_alerts": open_alerts,
                    "critical_alerts": critical_alerts,
                },
                "by_type": {
                    "camera": by_type.get(DeviceType.CAMERA, 0),
                    "nvr": by_type.get(DeviceType.NVR, 0),
                    "ups": by_type.get(DeviceType.UPS, 0),
                    "inverter": by_type.get(DeviceType.INVERTER, 0),
                    "network": by_type.get(DeviceType.NETWORK, 0),
                    "server": by_type.get(DeviceType.SERVER, 0),
                },
                "by_status": by_status,
                "power_summary": power_summary,
                "recent_alerts": recent_alerts,
                "recent_events": recent_events,
            }
        )


class InfraReportView(APIView):
    permission_classes = [IsInfraAdmin]

    def get(self, request):
        devices = InfraDevice.objects.select_related("site").filter(is_active=True)
        availability = []
        for dtype, _label in DeviceType.choices:
            qs = devices.filter(device_type=dtype)
            total = qs.count()
            online = qs.filter(status=DeviceStatus.ONLINE).count()
            availability.append(
                {
                    "device_type": dtype,
                    "total": total,
                    "online": online,
                    "offline": qs.filter(status=DeviceStatus.OFFLINE).count(),
                    "availability_pct": round((online / total) * 100, 1) if total else 0,
                }
            )

        alert_counts = (
            InfraAlert.objects.filter(resolved=False)
            .values("severity")
            .annotate(c=Count("id"))
        )
        return Response(
            {
                "generated_at": timezone.now().isoformat(),
                "availability_by_type": availability,
                "open_alerts_by_severity": {
                    row["severity"]: row["c"] for row in alert_counts
                },
                "devices_without_ip": devices.filter(
                    Q(ip_address__isnull=True) | Q(ip_address="")
                ).count(),
                "devices_without_protocol": devices.filter(
                    primary_protocol="none"
                ).count(),
                "modbus_devices": devices.filter(
                    Q(primary_protocol="modbus_tcp")
                    | Q(primary_protocol="modbus_rtu")
                    | Q(supports_modbus=True)
                ).count(),
                "snmp_devices": devices.filter(
                    Q(primary_protocol="snmp") | Q(supports_snmp=True)
                ).count(),
            }
        )
