from __future__ import annotations

from datetime import timedelta

from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import GlobalObject, ObjectVisit, VisitStatus
from .serializers import (
    GlobalObjectDetailSerializer,
    GlobalObjectListSerializer,
    ObjectVisitSerializer,
)
from .services import finalize_stale_visits_globally


class ObjectTrackingPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response(self, data):
        page_size = self.get_page_size(self.request) or self.page_size
        return Response(
            {
                "count": self.page.paginator.count,
                "page": self.page.number,
                "page_size": page_size,
                "total_pages": self.page.paginator.num_pages or 1,
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
                "results": data,
            }
        )


def _parse_page_params(request, default_size: int = 25, max_size: int = 100) -> tuple[int, int]:
    try:
        page = int(request.query_params.get("page") or 1)
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = int(
            request.query_params.get("page_size")
            or request.query_params.get("limit")
            or default_size
        )
    except (TypeError, ValueError):
        page_size = default_size
    page = max(1, page)
    page_size = min(max(page_size, 1), max_size)
    return page, page_size


class ObjectTrackingSummaryAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        finalize_stale_visits_globally(limit=100)
        now = timezone.now()
        day_ago = now - timedelta(hours=24)
        objects = GlobalObject.objects.all()
        visits = ObjectVisit.objects.all()
        payload = {
            "objects_total": objects.count(),
            "present_now": objects.filter(exit_at__isnull=True).count(),
            "active_visits": visits.filter(status=VisitStatus.ACTIVE).count(),
            "visits_24h": visits.filter(entry_at__gte=day_ago).count(),
            "exits_24h": visits.filter(exit_at__gte=day_ago).count(),
            "by_type": {
                row["object_type"]: row["c"]
                for row in objects.values("object_type").annotate(c=Count("id"))
            },
        }
        return Response(payload)


class GlobalObjectListAPIView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = GlobalObjectListSerializer
    pagination_class = ObjectTrackingPagination

    def get_queryset(self):
        finalize_stale_visits_globally(limit=50)
        qs = GlobalObject.objects.select_related("latest_camera").annotate(
            visit_count=Count("visits")
        )
        object_type = self.request.query_params.get("object_type", "").strip()
        if object_type:
            qs = qs.filter(object_type=object_type)
        present = self.request.query_params.get("present")
        if present and str(present).lower() in ("1", "true", "yes"):
            qs = qs.filter(exit_at__isnull=True)
        elif present and str(present).lower() in ("0", "false", "no"):
            qs = qs.filter(exit_at__isnull=False)
        q = self.request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(code__icontains=q)
                | Q(class_name__icontains=q)
                | Q(label__icontains=q)
            )
        return qs.order_by("-last_seen_at", "-created_at")


class GlobalObjectDetailAPIView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = GlobalObjectDetailSerializer
    lookup_field = "uuid"

    def get_queryset(self):
        return GlobalObject.objects.select_related("latest_camera").prefetch_related(
            Prefetch("visits", queryset=ObjectVisit.objects.select_related("camera").order_by("-entry_at")),
            "tracks",
        )


class ObjectVisitListAPIView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ObjectVisitSerializer
    pagination_class = ObjectTrackingPagination

    def get_queryset(self):
        finalize_stale_visits_globally(limit=50)
        qs = ObjectVisit.objects.select_related("global_object", "camera")
        status_param = self.request.query_params.get("status", "").strip()
        if status_param:
            qs = qs.filter(status=status_param)
        object_type = self.request.query_params.get("object_type", "").strip()
        if object_type:
            qs = qs.filter(global_object__object_type=object_type)
        code = self.request.query_params.get("code", "").strip()
        if code:
            qs = qs.filter(global_object__code__iexact=code)
        q = self.request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(global_object__code__icontains=q)
                | Q(global_object__class_name__icontains=q)
                | Q(global_object__label__icontains=q)
                | Q(camera__name__icontains=q)
            )
        return qs.order_by("-entry_at")


class ObjectTrackingLiveAPIView(APIView):
    """Active visits currently present (professional live board)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        finalize_stale_visits_globally(limit=100)
        page, page_size = _parse_page_params(request, default_size=15, max_size=100)
        qs = (
            ObjectVisit.objects.filter(status=VisitStatus.ACTIVE)
            .select_related("global_object", "camera")
            .order_by("-last_seen_at")
        )
        total = qs.count()
        total_pages = max(1, (total + page_size - 1) // page_size) if total else 1
        if page > total_pages:
            page = total_pages
        offset = (page - 1) * page_size
        visits = qs[offset : offset + page_size]
        return Response(
            {
                "count": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "results": ObjectVisitSerializer(
                    visits, many=True, context={"request": request}
                ).data,
            }
        )
