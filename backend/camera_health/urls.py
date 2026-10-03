from django.urls import path

from .views import (
    CameraHealthAlertListAPIView,
    CameraHealthAlertResolveAPIView,
    CameraHealthDashboardAPIView,
    CameraHealthScanAPIView,
    CameraHealthSnapshotListAPIView,
    CameraHealthSummaryAPIView,
)

urlpatterns = [
    path("camera-health/dashboard/", CameraHealthDashboardAPIView.as_view(), name="camera-health-dashboard"),
    path("camera-health/summary/", CameraHealthSummaryAPIView.as_view(), name="camera-health-summary"),
    path("camera-health/snapshots/", CameraHealthSnapshotListAPIView.as_view(), name="camera-health-snapshots"),
    path("camera-health/alerts/", CameraHealthAlertListAPIView.as_view(), name="camera-health-alerts"),
    path(
        "camera-health/alerts/<int:alert_id>/resolve/",
        CameraHealthAlertResolveAPIView.as_view(),
        name="camera-health-alert-resolve",
    ),
    path("camera-health/scan/", CameraHealthScanAPIView.as_view(), name="camera-health-scan"),
]
