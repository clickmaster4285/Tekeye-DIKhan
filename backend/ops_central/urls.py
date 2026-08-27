from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
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
