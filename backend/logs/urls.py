from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .device_views import (
    MobileAlertAcknowledgeView,
    MobileAlertListView,
    MobileDeviceDetailView,
    MobileDeviceDisableView,
    MobileDeviceListView,
    MobileDeviceRevokeView,
    MobileDeviceTerminateView,
    MobileEventsView,
    MobileHeartbeatView,
    MobileSessionRevokeView,
)
from .views import (
    ActivityLogViewSet,
    ReportActivityView,
    MobileSessionTransitionView,
    MobileSessionEndView,
    MobileSessionListView,
)

router = DefaultRouter()
router.register(r"activity-logs", ActivityLogViewSet, basename="activity-log")

urlpatterns = [
    path("activity-logs/report/", ReportActivityView.as_view(), name="activity-log-report"),
    path("mobile-sessions/", MobileSessionListView.as_view(), name="mobile-session-list"),
    path("mobile-sessions/transition/", MobileSessionTransitionView.as_view(), name="mobile-session-transition"),
    path("mobile-sessions/end/", MobileSessionEndView.as_view(), name="mobile-session-end"),
    path("mobile-sessions/revoke/", MobileSessionRevokeView.as_view(), name="mobile-session-revoke"),
    path("mobile/heartbeat/", MobileHeartbeatView.as_view(), name="mobile-heartbeat"),
    path("mobile-events/", MobileEventsView.as_view(), name="mobile-events"),
    path("mobile-devices/", MobileDeviceListView.as_view(), name="mobile-device-list"),
    path("mobile-devices/<int:pk>/", MobileDeviceDetailView.as_view(), name="mobile-device-detail"),
    path("mobile-devices/<int:pk>/revoke/", MobileDeviceRevokeView.as_view(), name="mobile-device-revoke"),
    path("mobile-devices/<int:pk>/terminate-session/", MobileDeviceTerminateView.as_view(), name="mobile-device-terminate"),
    path("mobile-devices/<int:pk>/disable-access/", MobileDeviceDisableView.as_view(), name="mobile-device-disable"),
    path("mobile-alerts/", MobileAlertListView.as_view(), name="mobile-alert-list"),
    path("mobile-alerts/<int:pk>/acknowledge/", MobileAlertAcknowledgeView.as_view(), name="mobile-alert-ack"),
    path("", include(router.urls)),
]
