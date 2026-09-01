from django.urls import path, include
from rest_framework.routers import DefaultRouter
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
    path("", include(router.urls)),
]
