from __future__ import annotations

from datetime import datetime, time, timedelta
from math import asin, cos, radians, sin, sqrt

from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from users.permissions import can_view_all_staff, get_effective_location, get_location_scope

from .models import OfficerGpsHistory, OfficerGpsLatest
from .serializers import GpsDutySerializer, GpsPingSerializer, latest_to_dict, me_payload
from .geocode import coord_key, reverse_geocode_batch

MAX_ACCURACY_M = 500
HISTORY_KEEP_DAYS = 45
MAX_HISTORY_POINTS = 800
MOVING_SPEED_KMH = 1.5
MOVING_DISTANCE_M = 25


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6_371_000.0
    p1, p2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlmb = radians(lng2 - lng1)
    a = sin(dphi / 2) ** 2 + cos(p1) * cos(p2) * sin(dlmb / 2) ** 2
    return 2 * r * asin(sqrt(a))


def _motion_label(speed_kmh, prev, cur) -> str:
    if speed_kmh is not None:
        return "Moving" if float(speed_kmh) >= MOVING_SPEED_KMH else "Stationary"
    if prev and cur:
        dist = _haversine_m(prev["latitude"], prev["longitude"], cur["latitude"], cur["longitude"])
        dt = (cur["recorded_at"] - prev["recorded_at"]).total_seconds() if prev.get("recorded_at") and cur.get("recorded_at") else 0
        if dt > 0 and dist >= MOVING_DISTANCE_M:
            return "Moving"
    return "Stationary"


def _point_dict(p: dict, *, motion: str | None = None) -> dict:
    lat = p["latitude"]
    lng = p["longitude"]
    return {
        "latitude": lat,
        "longitude": lng,
        "accuracy": p.get("accuracy_m"),
        "speedKmh": p.get("speed_kmh"),
        "recordedAt": p["recorded_at"].isoformat() if p.get("recorded_at") else None,
        "status": motion or "Stationary",
        "locationName": "",
        "mapsUrl": f"https://www.google.com/maps?q={lat},{lng}",
    }


def _attach_location_names(points: list[dict]) -> None:
    """Fill locationName on each history point via cached reverse-geocode."""
    if not points:
        return
    try:
        results = reverse_geocode_batch(points)
    except Exception:
        return
    by_key = {
        r["key"]: (r.get("locationName") or "").strip()
        for r in results
        if r.get("key")
    }
    for point in points:
        try:
            key = coord_key(float(point["latitude"]), float(point["longitude"]))
        except (TypeError, ValueError, KeyError):
            continue
        point["locationName"] = by_key.get(key) or ""


def _parse_report_date(raw: str):
    try:
        return datetime.strptime(raw.strip(), "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def _parse_at_time(raw: str):
    text = (raw or "").strip()
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(text, fmt).time()
        except ValueError:
            continue
    return None


def _day_bounds(day):
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(day, time.min), tz)
    end = start + timedelta(days=1)
    return start, end


def _week_bounds(day):
    """Monday-start week containing `day`."""
    monday = day - timedelta(days=day.weekday())
    sunday = monday + timedelta(days=6)
    start, _ = _day_bounds(monday)
    _, end = _day_bounds(sunday)
    return start, end, monday, sunday


def _month_bounds(day):
    first = day.replace(day=1)
    if first.month == 12:
        next_month = first.replace(year=first.year + 1, month=1, day=1)
    else:
        next_month = first.replace(month=first.month + 1, day=1)
    last = next_month - timedelta(days=1)
    start, _ = _day_bounds(first)
    _, end = _day_bounds(last)
    return start, end, first, last


def _downsample_rows(rows: list, max_points: int) -> list:
    n = len(rows)
    if n <= max_points:
        return rows
    if max_points < 2:
        return rows[:max_points]
    # Always keep first and last; spread the rest evenly.
    indexes = {0, n - 1}
    inner = max_points - 2
    for i in range(inner):
        idx = 1 + int(round(i * (n - 3) / max(1, inner - 1))) if inner > 1 else n // 2
        indexes.add(min(n - 2, max(1, idx)))
    return [rows[i] for i in sorted(indexes)][:max_points]


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

        from logs.enforcement import (
            DeviceRevoked,
            SessionRevoked,
            remember_event_id,
            require_active_mobile_session,
            touch_gps,
        )
        from logs.models import MobileAccessSession

        event_id = (data.get("event_id") or request.data.get("event_id") or "").strip() or None
        if event_id and not remember_event_id(request.user, event_id, "gps"):
            row = OfficerGpsLatest.objects.filter(user=request.user).first()
            return Response({**me_payload(request.user, row), "duplicate": True})

        session_id = (data.get("session_id") or "").strip() or None
        device_uuid = (data.get("device_uuid") or "").strip() or None
        has_sessions = MobileAccessSession.objects.filter(user=request.user).exists()
        session = None
        if session_id or device_uuid or has_sessions:
            try:
                session = require_active_mobile_session(request.user, session_id, device_uuid)
            except SessionRevoked as exc:
                return Response(
                    {"detail": str(exc), "code": "SESSION_REVOKED"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            except DeviceRevoked as exc:
                return Response(
                    {"detail": str(exc), "code": "DEVICE_REVOKED"},
                    status=status.HTTP_403_FORBIDDEN,
                )

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

        recorded_at = data.get("recordedAt") or data.get("client_timestamp") or timezone.now()
        battery = data.get("batteryPct")
        if battery is None:
            battery = data.get("battery_level")
        speed = data.get("speedKmh")
        if speed is None:
            speed = data.get("speed")
        heading = data.get("headingDeg")
        if heading is None:
            heading = data.get("heading")
        altitude = data.get("altitudeM")
        loc = _user_location(request.user)
        server_now = timezone.now()

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
                event_id=event_id,
                device_uuid=device_uuid or "",
                session_id=session_id or (session.session_id if session else ""),
                client_timestamp=data.get("client_timestamp") or recorded_at,
                server_timestamp=server_now,
            )
            cutoff = timezone.now() - timedelta(days=HISTORY_KEEP_DAYS)
            OfficerGpsHistory.objects.filter(user=request.user, recorded_at__lt=cutoff).delete()

        if session:
            touch_gps(session, lat, lng, accuracy, battery)

        return Response(me_payload(request.user, row))


class GpsLiveAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = OfficerGpsLatest.objects.select_related("user", "user__staff_profile")
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

        date_raw = (request.query_params.get("date") or "").strip()
        date_from_raw = (request.query_params.get("date_from") or "").strip()
        date_to_raw = (request.query_params.get("date_to") or "").strip()
        at_raw = (request.query_params.get("at") or "").strip()
        period_raw = (request.query_params.get("period") or "").strip().lower()
        report_day = _parse_report_date(date_raw) if date_raw else None
        date_from = _parse_report_date(date_from_raw) if date_from_raw else None
        date_to = _parse_report_date(date_to_raw) if date_to_raw else None
        at_time = _parse_at_time(at_raw) if at_raw else None
        period = period_raw if period_raw in ("day", "week", "month") else None

        if date_raw and report_day is None:
            return Response({"detail": "Invalid date. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
        if date_from_raw and date_from is None:
            return Response({"detail": "Invalid date_from. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
        if date_to_raw and date_to is None:
            return Response({"detail": "Invalid date_to. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
        if at_raw and at_time is None:
            return Response({"detail": "Invalid time. Use HH:MM or HH:MM:SS."}, status=status.HTTP_400_BAD_REQUEST)
        if period_raw and period is None:
            return Response(
                {"detail": "Invalid period. Use day, week, or month."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if at_time is not None and report_day is None and date_from is None:
            report_day = timezone.localdate()
        if period and report_day is None and date_from is None:
            report_day = timezone.localdate()

        sampled = False
        total_count = 0

        if date_from is not None or date_to is not None or period or report_day is not None:
            if date_from is not None or date_to is not None:
                start_day = date_from or date_to
                end_day = date_to or date_from
                if start_day > end_day:
                    start_day, end_day = end_day, start_day
                start, _ = _day_bounds(start_day)
                _, end = _day_bounds(end_day)
                period_meta = {
                    "period": period or "custom",
                    "dateFrom": start_day.isoformat(),
                    "dateTo": end_day.isoformat(),
                    "start": start.isoformat(),
                    "end": (end - timedelta(seconds=1)).isoformat(),
                }
            elif period == "week":
                start, end, monday, sunday = _week_bounds(report_day)
                period_meta = {
                    "period": "week",
                    "date": report_day.isoformat(),
                    "dateFrom": monday.isoformat(),
                    "dateTo": sunday.isoformat(),
                    "start": start.isoformat(),
                    "end": (end - timedelta(seconds=1)).isoformat(),
                }
            elif period == "month":
                start, end, first, last = _month_bounds(report_day)
                period_meta = {
                    "period": "month",
                    "date": report_day.isoformat(),
                    "dateFrom": first.isoformat(),
                    "dateTo": last.isoformat(),
                    "start": start.isoformat(),
                    "end": (end - timedelta(seconds=1)).isoformat(),
                }
            else:
                start, end = _day_bounds(report_day)
                period_meta = {
                    "period": "day",
                    "date": report_day.isoformat(),
                    "dateFrom": report_day.isoformat(),
                    "dateTo": report_day.isoformat(),
                    "start": start.isoformat(),
                    "end": (end - timedelta(seconds=1)).isoformat(),
                }

            full_rows = list(
                qs.filter(recorded_at__gte=start, recorded_at__lt=end)
                .order_by("recorded_at")
                .values("latitude", "longitude", "accuracy_m", "speed_kmh", "recorded_at")
            )
            total_count = len(full_rows)
            rows = _downsample_rows(full_rows, MAX_HISTORY_POINTS)
            sampled = total_count > len(rows)
            period = period_meta
        else:
            try:
                hours = int(request.query_params.get("hours") or 24)
            except (TypeError, ValueError):
                hours = 24
            hours = max(1, min(hours, 72))
            since = timezone.now() - timedelta(hours=hours)
            rows = list(
                qs.filter(recorded_at__gte=since)
                .order_by("-recorded_at")
                .values("latitude", "longitude", "accuracy_m", "speed_kmh", "recorded_at")[:MAX_HISTORY_POINTS]
            )
            rows.reverse()
            total_count = len(rows)
            period = {"hours": hours, "since": since.isoformat()}

        payload = []
        for i, row in enumerate(rows):
            prev = rows[i - 1] if i > 0 else None
            motion = _motion_label(row.get("speed_kmh"), prev, row)
            payload.append(_point_dict(row, motion=motion))

        closest = None
        closest_day = report_day
        if at_time is not None:
            if closest_day is None and date_from is not None:
                closest_day = date_from
            if closest_day is not None:
                tz = timezone.get_current_timezone()
                target = timezone.make_aware(datetime.combine(closest_day, at_time), tz)
                best = None
                best_delta = None
                for row in rows:
                    recorded = row.get("recorded_at")
                    if not recorded:
                        continue
                    delta = abs((recorded - target).total_seconds())
                    if best_delta is None or delta < best_delta:
                        best_delta = delta
                        best = row
                if best is not None:
                    idx = rows.index(best)
                    prev = rows[idx - 1] if idx > 0 else None
                    closest = {
                        **_point_dict(best, motion=_motion_label(best.get("speed_kmh"), prev, best)),
                        "requestedAt": target.isoformat(),
                        "deltaSeconds": int(best_delta or 0),
                    }

        # Resolve street/area names once for the report (cached after first hit).
        to_name = list(payload)
        if closest is not None:
            to_name.append(closest)
        _attach_location_names(to_name)

        return Response(
            {
                "userId": user_id,
                "period": period,
                "points": payload,
                "closest": closest,
                "count": len(payload),
                "totalCount": total_count,
                "sampled": sampled,
            }
        )


class GpsReverseGeocodeAPIView(APIView):
    """Batch reverse-geocode for GPS history location names (OSM via Photon)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        raw = request.data.get("points")
        if not isinstance(raw, list):
            return Response({"detail": "points must be a list of {latitude, longitude}."}, status=status.HTTP_400_BAD_REQUEST)
        results = reverse_geocode_batch(raw)
        return Response({"results": results, "count": len(results)})
