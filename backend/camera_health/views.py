from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from cameras.models import Camera

from .models import CameraHealthAlert, CameraHealthSnapshot
from .serializers import (
    CameraHealthAlertSerializer,
    CameraHealthSnapshotSerializer,
    CameraHealthSummarySerializer,
)
from .services import analyze_and_store, latest_summaries, scan_all_cameras


class CameraHealthSummaryAPIView(APIView):
    """List each active camera with latest health score + open alert count."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        data = latest_summaries()
        return Response(CameraHealthSummarySerializer(data, many=True).data)


class CameraHealthSnapshotListAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = CameraHealthSnapshot.objects.select_related("camera").all()
        camera_id = request.query_params.get("camera_id")
        if camera_id:
            qs = qs.filter(camera_id=camera_id)
        limit = min(int(request.query_params.get("limit") or 50), 200)
        qs = qs[:limit]
        return Response(CameraHealthSnapshotSerializer(qs, many=True).data)


class CameraHealthAlertListAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = CameraHealthAlert.objects.select_related("camera").all()
        if request.query_params.get("open") in {"1", "true", "yes"}:
            qs = qs.filter(resolved=False)
        camera_id = request.query_params.get("camera_id")
        if camera_id:
            qs = qs.filter(camera_id=camera_id)
        limit = min(int(request.query_params.get("limit") or 100), 300)
        return Response(CameraHealthAlertSerializer(qs[:limit], many=True).data)


class CameraHealthAlertResolveAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, alert_id: int):
        from django.utils import timezone

        try:
            alert = CameraHealthAlert.objects.get(pk=alert_id)
        except CameraHealthAlert.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        alert.resolved = True
        alert.resolved_at = timezone.now()
        alert.save(update_fields=["resolved", "resolved_at"])
        return Response(CameraHealthAlertSerializer(alert).data)


class CameraHealthScanAPIView(APIView):
    """Trigger a health scan (one camera or all)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        camera_id = request.data.get("camera_id")
        if camera_id:
            try:
                cam = Camera.objects.get(pk=camera_id, is_active=True)
            except Camera.DoesNotExist:
                return Response({"detail": "Camera not found"}, status=status.HTTP_404_NOT_FOUND)
            snap = analyze_and_store(cam)
            return Response(CameraHealthSnapshotSerializer(snap).data)
        limit = request.data.get("limit")
        result = scan_all_cameras(limit=int(limit) if limit else None)
        return Response(result)


class CameraHealthDashboardAPIView(APIView):
    """Aggregate counts for the AI Suggestions dashboard."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        summaries = latest_summaries()
        open_alerts = CameraHealthAlert.objects.filter(resolved=False).count()
        by_status = {"healthy": 0, "degraded": 0, "critical": 0, "offline": 0, "unknown": 0}
        for row in summaries:
            key = str(row.get("status") or "unknown")
            by_status[key] = by_status.get(key, 0) + 1
        suggestions = (
            CameraHealthAlert.objects.filter(resolved=False)
            .exclude(alert_type="healthy")
            .select_related("camera")
            .order_by("-last_detected")[:30]
        )
        return Response(
            {
                "camera_count": len(summaries),
                "open_alerts": open_alerts,
                "by_status": by_status,
                "cameras": CameraHealthSummarySerializer(summaries, many=True).data,
                "suggestions": CameraHealthAlertSerializer(suggestions, many=True).data,
            }
        )
