"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
"""
from django.contrib import admin
from django.urls import include, path, re_path

from config.media_views import protected_media

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("users.urls")),
    path("api/", include("visitors.urls")),
    path("api/", include("logs.urls")),
    path("api/", include("detentions.urls")),
    path("api/", include("seizure_management.urls")),
    path("api/", include("cameras.urls")),
    path("api/", include("warehouse.urls")),
    path("api/", include("ml.urls")),
    path("api/", include("person_journey.urls")),
    path("api/", include("object_tracking.urls")),
    path("api/recognition/", include("recognition.urls")),
    path("api/", include("ops_central.urls")),
    path("api/", include("gps_tracking.urls")),
    path("api/", include("video_recovery.urls")),
    # Detection clips, staff photos, attendance video, etc. — login required.
    re_path(r"^media/(?P<path>.*)$", protected_media, name="protected_media"),
]
