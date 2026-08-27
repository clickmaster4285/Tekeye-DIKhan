from django.urls import path

from .views import (
    GlobalObjectDetailAPIView,
    GlobalObjectListAPIView,
    ObjectTrackingLiveAPIView,
    ObjectTrackingSummaryAPIView,
    ObjectVisitListAPIView,
)

urlpatterns = [
    path("object-tracking/summary/", ObjectTrackingSummaryAPIView.as_view(), name="object-tracking-summary"),
    path("object-tracking/live/", ObjectTrackingLiveAPIView.as_view(), name="object-tracking-live"),
    path("object-tracking/objects/", GlobalObjectListAPIView.as_view(), name="object-tracking-objects"),
    path(
        "object-tracking/objects/<uuid:uuid>/",
        GlobalObjectDetailAPIView.as_view(),
        name="object-tracking-object-detail",
    ),
    path("object-tracking/visits/", ObjectVisitListAPIView.as_view(), name="object-tracking-visits"),
]
