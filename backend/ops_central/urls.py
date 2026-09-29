from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .distribution_views import AssignCameraAPIView, AutoDistributeAPIView, DistributionBoardAPIView
from .views import (
    AllCitiesCameraSelectionAPIView,
    AllCitiesStreamsAPIView,
    EphemeralMjpegProxyView,
    QuickConnectView,
    RemoteMjpegProxyView,
    RemoteServerViewSet,
)

router = DefaultRouter()
router.register(r"ops/servers", RemoteServerViewSet, basename="ops-remote-server")

urlpatterns = [
    path("ops/quick-connect/", QuickConnectView.as_view(), name="ops-quick-connect"),
    path(
        "ops/all-cities-streams/",
        AllCitiesStreamsAPIView.as_view(),
        name="ops-all-cities-streams",
    ),
    path(
        "ops/all-cities-selection/",
        AllCitiesCameraSelectionAPIView.as_view(),
        name="ops-all-cities-selection",
    ),
    path(
        "ops/distribution/",
        DistributionBoardAPIView.as_view(),
        name="ops-distribution-board",
    ),
    path(
        "ops/distribution/assign/",
        AssignCameraAPIView.as_view(),
        name="ops-distribution-assign",
    ),
    path(
        "ops/distribution/auto/",
        AutoDistributeAPIView.as_view(),
        name="ops-distribution-auto",
    ),
    path(
        "ops/servers/<int:pk>/mjpeg/",
        RemoteMjpegProxyView.as_view(),
        name="ops-remote-mjpeg",
    ),
    path(
        "ops/ephemeral-mjpeg/",
        EphemeralMjpegProxyView.as_view(),
        name="ops-ephemeral-mjpeg",
    ),
    path("", include(router.urls)),
]
