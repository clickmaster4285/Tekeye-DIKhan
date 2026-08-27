from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from .models import OfficerGpsHistory, OfficerGpsLatest

LIVE_SECONDS = 120
OFFLINE_AFTER_SECONDS = 1800


def _age_seconds(*values) -> float | None:
    now = timezone.now()
    ages = []
    for value in values:
        if value is None:
            continue
        ages.append((now - value).total_seconds())
    return min(ages) if ages else None


def gps_status(row: OfficerGpsLatest | None) -> str:
    if not row or not row.on_duty:
        return "offline"
    # Presence (app open / heartbeat) must not be confused with the last GPS fix.
    presence_age = _age_seconds(row.updated_at, row.duty_started_at, row.recorded_at)
    gps_age = _age_seconds(row.recorded_at) if not (row.latitude == 0 and row.longitude == 0) else None
    if gps_age is not None and gps_age <= LIVE_SECONDS:
        return "live"
    if presence_age is not None and presence_age <= LIVE_SECONDS:
        return "live"
    if presence_age is None or presence_age > OFFLINE_AFTER_SECONDS:
        return "offline"
    return "stale"


def officer_display_name(user) -> str:
    full = (getattr(user, "full_name", None) or "").strip()
    if full:
        return full
    return (getattr(user, "username", None) or str(user.pk)).strip()


class GpsPingSerializer(serializers.Serializer):
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    accuracy = serializers.FloatField(required=False, allow_null=True, min_value=0)
    recordedAt = serializers.DateTimeField(required=False, allow_null=True)
    batteryPct = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=100)
    speedKmh = serializers.FloatField(required=False, allow_null=True, min_value=0)
    headingDeg = serializers.FloatField(required=False, allow_null=True, min_value=0, max_value=360)
    altitudeM = serializers.FloatField(required=False, allow_null=True)


class GpsDutySerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["start", "stop"])


def _employee_id(user) -> str:
    code = (getattr(user, "employee_id", None) or "").strip()
    if code:
        return code
    return f"CM-{user.pk:04d}"


def latest_to_dict(row: OfficerGpsLatest) -> dict:
    user = row.user
    return {
        "userId": user.pk,
        "username": user.username,
        "name": officer_display_name(user),
        "role": getattr(user, "role", "") or "",
        "employeeId": _employee_id(user),
        "location": row.location or getattr(user, "location", "") or "",
        "latitude": row.latitude,
        "longitude": row.longitude,
        "accuracy": row.accuracy_m,
        "speedKmh": row.speed_kmh,
        "headingDeg": row.heading_deg,
        "altitudeM": row.altitude_m,
        "recordedAt": row.recorded_at.isoformat() if row.recorded_at else None,
        "onDuty": bool(row.on_duty),
        "dutyStartedAt": row.duty_started_at.isoformat() if row.duty_started_at else None,
        "batteryPct": row.battery_pct,
        "status": gps_status(row),
    }


def me_payload(user, row: OfficerGpsLatest | None) -> dict:
    data = {
        "userId": user.pk,
        "username": user.username,
        "name": officer_display_name(user),
        "role": getattr(user, "role", "") or "",
        "employeeId": _employee_id(user),
        "location": getattr(user, "location", "") or "",
        "onDuty": bool(row and row.on_duty),
        "status": gps_status(row),
        "latitude": row.latitude if row else None,
        "longitude": row.longitude if row else None,
        "accuracy": row.accuracy_m if row else None,
        "speedKmh": row.speed_kmh if row else None,
        "headingDeg": row.heading_deg if row else None,
        "altitudeM": row.altitude_m if row else None,
        "recordedAt": row.recorded_at.isoformat() if row and row.recorded_at else None,
        "dutyStartedAt": row.duty_started_at.isoformat() if row and row.duty_started_at else None,
        "batteryPct": row.battery_pct if row else None,
    }
    return data


class GpsHistoryPointSerializer(serializers.ModelSerializer):
    recordedAt = serializers.DateTimeField(source="recorded_at")
    accuracy = serializers.FloatField(source="accuracy_m")

    class Meta:
        model = OfficerGpsHistory
        fields = ("latitude", "longitude", "accuracy", "recordedAt")
