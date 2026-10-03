from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    InfraAlertRuleViewSet,
    InfraAlertViewSet,
    InfraDeviceViewSet,
    InfraEventViewSet,
    InfraOverviewView,
    InfraRefreshView,
    InfraReportView,
    InfraSiteViewSet,
)

router = DefaultRouter()
router.register(r"infra/sites", InfraSiteViewSet, basename="infra-site")
router.register(r"infra/devices", InfraDeviceViewSet, basename="infra-device")
router.register(r"infra/alert-rules", InfraAlertRuleViewSet, basename="infra-alert-rule")
router.register(r"infra/alerts", InfraAlertViewSet, basename="infra-alert")
router.register(r"infra/events", InfraEventViewSet, basename="infra-event")

urlpatterns = [
    path("infra/overview/", InfraOverviewView.as_view(), name="infra-overview"),
    path("infra/reports/", InfraReportView.as_view(), name="infra-reports"),
    path("infra/refresh/", InfraRefreshView.as_view(), name="infra-refresh"),
    path("", include(router.urls)),
]
