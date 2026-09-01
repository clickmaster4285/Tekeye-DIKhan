from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from users.permissions import can_view_all_staff, get_effective_location, get_location_scope

from .models import OfficerGpsHistory, OfficerGpsLatest
from .serializers import GpsDutySerializer, GpsPingSerializer, latest_to_dict, me_payload

MAX_ACCURACY_M = 500
HISTORY_KEEP_DAYS = 14
MAX_HISTORY_POINTS = 400


def _user_location(user) -> str:
    return (getattr(user, "location", None) or "").strip()


class GpsMeAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        row = OfficerGpsLatest.objects.filter(user=request.user).first()
        return Response(me_payload(request.user, row))


class GpsDutyAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = GpsDutySerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        action = ser.validated_data["action"]
        now = timezone.now()
        row, _created = OfficerGpsLatest.objects.get_or_create(
            user=request.user,
            defaults={
                "latitude": 0,
                "longitude": 0,
                "recorded_at": now,
                "on_duty": False,
                "location": _user_location(request.user),
            },
        )
        if action == "start":
            if not row.on_duty or not row.duty_started_at:
                row.duty_started_at = now
            row.on_duty = True
            row.location = _user_location(request.user)
            row.save(update_fields=["on_duty", "duty_started_at", "location", "updated_at"])
        else:
            row.on_duty = False
            row.save(update_fields=["on_duty", "updated_at"])
        return Response(me_payload(request.user, row))


class GpsHeartbeatAPIView(APIView):
    """Refresh presence for an officer who is already on duty. Never starts duty."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        row = OfficerGpsLatest.objects.filter(user=request.user).first()
        if not row:
            return Response(me_payload(request.user, None))
        row.location = _user_location(request.user) or row.location
        row.save(update_fields=["location", "updated_at"])
        return Response(me_payload(request.user, row))


class GpsPingAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = GpsPingSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        data = ser.validated_data
        accuracy = data.get("accuracy")
        if accuracy is not None and accuracy > MAX_ACCURACY_M:
            return Response(
                {"detail": "GPS accuracy is too low. Use a phone with location on, outdoors — not Wi‑Fi/IP city location."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        lat = data["latitude"]
        lng = data["longitude"]
        if lat == 0 and lng == 0:
            return Response({"detail": "Invalid GPS coordinates."}, status=status.HTTP_400_BAD_REQUEST)
        # City-level IP fixes (e.g. Islamabad 33.72, 73.06) are ~2 decimal places, not real GPS.
        if abs(lat - round(lat, 2)) < 1e-5 and abs(lng - round(lng, 2)) < 1e-5:
            if accuracy is None or accuracy > 40:
                return Response(
                    {"detail": "This looks like network/city location, not GPS. Open the PWA on a phone with GPS."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        recorded_at = data.get("recordedAt") or timezone.now()
        battery = data.get("batteryPct")
        speed = data.get("speedKmh")
        heading = data.get("headingDeg")
        altitude = data.get("altitudeM")
        loc = _user_location(request.user)

        with transaction.atomic():
            row, _created = OfficerGpsLatest.objects.select_for_update().get_or_create(
                user=request.user,
                defaults={
                    "latitude": lat,
                    "longitude": lng,
                    "recorded_at": recorded_at,
                    "on_duty": True,
                    "duty_started_at": recorded_at,
                    "location": loc,
                },
            )
            if not row.on_duty:
                row.on_duty = True
                if not row.duty_started_at:
                    row.duty_started_at = timezone.now()
            row.latitude = lat
            row.longitude = lng
            row.accuracy_m = accuracy
            row.speed_kmh = speed
            row.heading_deg = heading
            row.altitude_m = altitude
            row.recorded_at = recorded_at
            row.battery_pct = battery
            row.location = loc
            row.save(
                update_fields=[
                    "latitude",
                    "longitude",
                    "accuracy_m",
                    "speed_kmh",
                    "heading_deg",
                    "altitude_m",
                    "recorded_at",
                    "battery_pct",
                    "location",
                    "on_duty",
                    "duty_started_at",
                    "updated_at",
                ]
            )
            OfficerGpsHistory.objects.create(
                user=request.user,
                latitude=lat,
                longitude=lng,
                accuracy_m=accuracy,
                speed_kmh=speed,
                heading_deg=heading,
                altitude_m=altitude,
                recorded_at=recorded_at,
                battery_pct=battery,
            )
            cutoff = timezone.now() - timedelta(days=HISTORY_KEEP_DAYS)
            OfficerGpsHistory.objects.filter(user=request.user, recorded_at__lt=cutoff).delete()

        return Response(me_payload(request.user, row))


class GpsLiveAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = OfficerGpsLatest.objects.select_related("user")
        if not can_view_all_staff(request.user):
            qs = qs.filter(user=request.user)
        else:
            include_off = (request.query_params.get("include_off_duty") or "").lower() in (
                "1",
                "true",
                "yes",
            )
            if not include_off:
                qs = qs.filter(on_duty=True)
            raw_loc = (request.query_params.get("location") or "").strip()
            if raw_loc.lower() in ("", "all"):
                loc = get_location_scope(request.user)
            else:
                loc = get_effective_location(request.user, raw_loc)
            if loc:
                qs = qs.filter(location=loc)
        officers = [latest_to_dict(row) for row in qs]
        return Response({"officers": officers, "count": len(officers)})


class GpsHistoryAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id: int):
        if not can_view_all_staff(request.user) and request.user.pk != user_id:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        scope = get_location_scope(request.user)
        qs = OfficerGpsHistory.objects.filter(user_id=user_id)
        if scope:
            latest = OfficerGpsLatest.objects.filter(user_id=user_id).first()
            if not latest or (latest.location or "") != scope:
                if request.user.pk != user_id:
                    return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        hours = int(request.query_params.get("hours") or 24)
        hours = max(1, min(hours, 72))
        since = timezone.now() - timedelta(hours=hours)
        points = list(
            qs.filter(recorded_at__gte=since)
            .order_by("-recorded_at")
            .values("latitude", "longitude", "accuracy_m", "recorded_at")[:MAX_HISTORY_POINTS]
        )
        points.reverse()
        payload = [
            {
                "latitude": p["latitude"],
                "longitude": p["longitude"],
                "accuracy": p["accuracy_m"],
                "recordedAt": p["recorded_at"].isoformat() if p["recorded_at"] else None,
            }
            for p in points
        ]
        return Response({"userId": user_id, "points": payload})
