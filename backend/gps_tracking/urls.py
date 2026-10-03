from django.urls import path

from .views import (
    GpsDutyAPIView,
    GpsHeartbeatAPIView,
    GpsHistoryAPIView,
    GpsLiveAPIView,
    GpsMeAPIView,
    GpsPingAPIView,
    GpsReverseGeocodeAPIView,
)

urlpatterns = [
    path("gps/me/", GpsMeAPIView.as_view(), name="gps-me"),
    path("gps/duty/", GpsDutyAPIView.as_view(), name="gps-duty"),
    path("gps/heartbeat/", GpsHeartbeatAPIView.as_view(), name="gps-heartbeat"),
    path("gps/ping/", GpsPingAPIView.as_view(), name="gps-ping"),
    path("mobile/gps/", GpsPingAPIView.as_view(), name="mobile-gps"),
    path("gps/live/", GpsLiveAPIView.as_view(), name="gps-live"),
    path("gps/history/<int:user_id>/", GpsHistoryAPIView.as_view(), name="gps-history"),
    path("gps/reverse-geocode/", GpsReverseGeocodeAPIView.as_view(), name="gps-reverse-geocode"),
]
