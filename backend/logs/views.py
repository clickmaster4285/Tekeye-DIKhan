from datetime import datetime, time, timedelta

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import viewsets, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.request import Request

from users.permissions import can_view_all_staff, get_location_scope

from .models import UserActivityLog, MobilePhoneSession
from .serializers import ActivityLogSerializer, MobilePhoneSessionSerializer
from .middleware import create_activity_log

MOBILE_EVENTS = {
    "open": "Opened the mobile app",
    "unlock": "Returned to the app",
    "background": "Left the app or locked the screen",
    "login": "Signed in on mobile",
    "logout": "Signed out of the mobile app",
    "view_home": "Viewed reports home",
    "view_logs": "Viewed mobile logs",
    "view_location": "Viewed staff location",
    "view_attendance": "Viewed attendance",
    "standalone": "Using installed home-screen app",
}


class ActivityLogPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """List and retrieve user activity logs. Newest first. Requires authentication."""
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = ActivityLogPagination

    def get_queryset(self):
        qs = UserActivityLog.objects.all().select_related("user").order_by("-time")
        source = (self.request.query_params.get("source") or "").strip()
        username = (self.request.query_params.get("username") or "").strip()
        if source:
            qs = qs.filter(source=source)
        if username:
            qs = qs.filter(user__username__icontains=username)
        if not can_view_all_staff(self.request.user):
            qs = qs.filter(user=self.request.user)
        else:
            scope = get_location_scope(self.request.user)
            if scope:
                qs = qs.filter(user__location=scope)
        day = parse_date((self.request.query_params.get("date") or "").strip())
        if day:
            start = datetime.combine(day, time.min)
            if timezone.is_naive(start):
                start = timezone.make_aware(start, timezone.get_current_timezone())
            qs = qs.filter(time__gte=start, time__lt=start + timedelta(days=1))
        return qs


class ReportActivityView(APIView):
    """POST /api/activity-logs/report/ with { \"action\" } or mobile { \"event\": \"unlock\" }."""
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        event = (request.data.get("event") or "").strip()
        if event:
            action = MOBILE_EVENTS.get(event)
            if not action:
                return Response({"detail": "Unknown mobile event"}, status=status.HTTP_400_BAD_REQUEST)
            create_activity_log(request.user, request, action, source="mobile")
            return Response({"ok": True, "action": action}, status=status.HTTP_201_CREATED)

        action = (request.data.get("action") or "").strip()
        if not action:
            return Response({"detail": "action is required"}, status=status.HTTP_400_BAD_REQUEST)
        source = (request.data.get("source") or "web").strip() or "web"
        create_activity_log(request.user, request, action[:255], source=source)
        return Response({"ok": True}, status=status.HTTP_201_CREATED)


def _close_open_session(user, now):
    row = (
        MobilePhoneSession.objects.select_for_update()
        .filter(user=user, ended_at__isnull=True)
        .order_by("-started_at")
        .first()
    )
    if not row:
        return None
    row.ended_at = now
    row.duration_seconds = max(0, int((now - row.started_at).total_seconds()))
    row.save(update_fields=["ended_at", "duration_seconds"])
    return row


def _human_duration(seconds: int) -> str:
    seconds = max(0, int(seconds))
    if seconds < 60:
        return f"{seconds}s"
    minutes = seconds // 60
    hours = minutes // 60
    rest = minutes % 60
    if hours == 0:
        return f"{minutes}m"
    if rest == 0:
        return f"{hours}h"
    return f"{hours}h {rest}m"


class MobileSessionTransitionView(APIView):
    """POST { \"state\": \"using\" | \"locked\" } — closes the previous stretch and starts a new one."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        state = (request.data.get("state") or "").strip().lower()
        if state not in (MobilePhoneSession.STATE_USING, MobilePhoneSession.STATE_LOCKED):
            return Response({"detail": "state must be using or locked"}, status=status.HTTP_400_BAD_REQUEST)
        now = timezone.now()
        with transaction.atomic():
            open_row = (
                MobilePhoneSession.objects.select_for_update()
                .filter(user=request.user, ended_at__isnull=True)
                .order_by("-started_at")
                .first()
            )
            if open_row and open_row.state == state:
                return Response(MobilePhoneSessionSerializer(open_row).data, status=status.HTTP_200_OK)
            previous = None
            if open_row:
                open_row.ended_at = now
                open_row.duration_seconds = max(0, int((now - open_row.started_at).total_seconds()))
                open_row.save(update_fields=["ended_at", "duration_seconds"])
                previous = open_row
            current = MobilePhoneSession.objects.create(
                user=request.user,
                state=state,
                started_at=now,
            )
        if previous:
            verb = "Used the app" if previous.state == MobilePhoneSession.STATE_USING else "Phone was locked"
            create_activity_log(
                request.user,
                request,
                f"{verb} for {_human_duration(previous.duration_seconds or 0)}",
                source="mobile",
            )
        return Response(MobilePhoneSessionSerializer(current).data, status=status.HTTP_201_CREATED)


class MobileSessionEndView(APIView):
    """POST — close the current stretch (logout)."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        now = timezone.now()
        with transaction.atomic():
            previous = _close_open_session(request.user, now)
        if previous:
            verb = "Used the app" if previous.state == MobilePhoneSession.STATE_USING else "Phone was locked"
            create_activity_log(
                request.user,
                request,
                f"{verb} for {_human_duration(previous.duration_seconds or 0)}",
                source="mobile",
            )
        return Response({"ok": True})


class MobileSessionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        qs = MobilePhoneSession.objects.select_related("user").order_by("-started_at")
        if not can_view_all_staff(request.user):
            qs = qs.filter(user=request.user)
        else:
            scope = get_location_scope(request.user)
            if scope:
                qs = qs.filter(user__location=scope)
        username = (request.query_params.get("username") or "").strip()
        if username:
            qs = qs.filter(user__username__icontains=username)
        day = parse_date((request.query_params.get("date") or "").strip())
        if day:
            start = datetime.combine(day, time.min)
            if timezone.is_naive(start):
                start = timezone.make_aware(start, timezone.get_current_timezone())
            end = start + timedelta(days=1)
            qs = qs.filter(started_at__gte=start, started_at__lt=end)

        rows = list(qs[:80])
        using = 0
        locked = 0
        now = timezone.now()
        for row in qs[:2000]:
            seconds = row.duration_seconds
            if seconds is None:
                seconds = max(0, int((now - row.started_at).total_seconds()))
            if row.state == MobilePhoneSession.STATE_USING:
                using += seconds
            else:
                locked += seconds

        return Response(
            {
                "results": MobilePhoneSessionSerializer(rows, many=True).data,
                "count": qs.count(),
                "totals": {"using_seconds": using, "locked_seconds": locked},
            }
        )
