"""
TekEye capabilities exposed to the voice agent.

The agent never touches the database, NVRs or the ML service directly: each tool is a
controlled capability with a JSON schema, an access class (read / control / write),
and a policy capability that is checked before it runs. Write tools never write —
they prepare a pending action that only executes after the officer says yes.
"""

from __future__ import annotations

import dataclasses
import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any, Callable

from django.contrib.postgres.search import TrigramWordSimilarity
from django.db.models import Count, Q
from django.db.models.functions import Greatest
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from . import actions as agent_actions
from . import policy
from .records import (
    DATASETS,
    FUZZY_MIN_SIMILARITY,
    RecordsError,
    dataset_catalog,
    mentions_time,
    search_records,
)

logger = logging.getLogger(__name__)

MAX_LIST = 25
PENDING_ACTION_TTL_SEC = 120
# Typed chats show Confirm / Cancel buttons; give the officer time to read what will change.
CHAT_PENDING_ACTION_TTL_SEC = 900


class ToolError(Exception):
    """Raised by a tool for an expected failure (not found, forbidden). Shown to the model."""


@dataclass
class ToolContext:
    user: Any
    session: Any
    utterance: str = ""
    ui_actions: list[dict] = field(default_factory=list)
    reports: list[str] = field(default_factory=list)
    end_session: bool = False


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict
    access: str  # read | control | write
    capability: str
    handler: Callable[[ToolContext, dict], dict]


def _local(dt) -> str:
    if not dt:
        return ""
    return timezone.localtime(dt).strftime("%Y-%m-%d %H:%M:%S")


def _clamp(value, default: int, lo: int, hi: int) -> int:
    try:
        return max(lo, min(int(value), hi))
    except (TypeError, ValueError):
        return default


def fuzzy_filter(qs, text: str, cols: tuple[str, ...]):
    """Typo-tolerant fallback (pg_trgm): every word must resemble a word in one of cols. Best match first."""
    words = [w for w in re.findall(r"\w+", (text or "").lower()) if len(w) >= 3]
    if not words:
        return qs.none()
    order = []
    for i, word in enumerate(words):
        sims = [TrigramWordSimilarity(word, c) for c in cols]
        name = f"_fz{i}"
        qs = qs.annotate(**{name: Greatest(*sims) if len(sims) > 1 else sims[0]}).filter(
            **{f"{name}__gte": FUZZY_MIN_SIMILARITY}
        )
        order.append(f"-{name}")
    return qs.order_by(*order)


def _parse_time(raw: str):
    raw = (raw or "").strip()
    if not raw:
        return None
    dt = parse_datetime(raw.replace(" ", "T", 1) if " " in raw and "T" not in raw else raw)
    if dt is None and len(raw) == 10:
        dt = parse_datetime(f"{raw}T00:00:00")
    if dt is None:
        raise ToolError(f"Could not parse time '{raw}'. Use ISO format, e.g. 2026-09-28T14:30.")
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt)
    return dt


def _pending_expiry(ctx: ToolContext) -> str:
    ttl = CHAT_PENDING_ACTION_TTL_SEC if getattr(ctx.session, "mode", "") == "chat" else PENDING_ACTION_TTL_SEC
    return (timezone.now() + timedelta(seconds=ttl)).isoformat()


def _set_focus_camera(ctx: ToolContext, camera) -> None:
    ctx.session.context = {
        **(ctx.session.context or {}),
        "focus_camera": {"id": camera.pk, "name": camera.name, "code": camera.code},
    }


# ---------------------------------------------------------------- cameras


def _scoped_cameras(user):
    from cameras.models import Camera

    return (
        Camera.objects.filter(is_active=True)
        .select_related("nvr__site")
        .filter(policy.camera_scope_q(user))
    )


def _get_camera(user, camera_id):
    try:
        cam_pk = int(camera_id)
    except (TypeError, ValueError):
        raise ToolError(f"Invalid camera id: {camera_id!r}")
    cam = _scoped_cameras(user).filter(pk=cam_pk).first()
    if cam is None:
        raise ToolError(f"Camera {cam_pk} not found or not in your authorised location.")
    return cam


# Words that describe *a camera* rather than *which* camera; they would make an all-words match fail.
_CAMERA_STOPWORDS = {
    "camera", "cameras", "cam", "cams", "kamera", "the", "a", "an", "at", "in", "of", "on", "for", "to",
    "show", "open", "view", "live", "karo", "dikhao", "ka", "ki", "ke", "wala", "wali", "area",
    "کیمرہ", "کیمرے", "کا", "کی", "کے", "میں", "دکھاؤ", "کھولو",
}
# Safety net when the model passes Urdu place words straight through (camera names are English).
_URDU_PLACE_WORDS = {
    "پشاور": "peshawar", "بیشاور": "peshawar", "ہیڈ": "head", "ہیڈن": "head", "آفس": "office", "آفیس": "office",
    "دفتر": "office", "کنٹرول": "control", "روم": "room", "گیٹ": "gate", "مین": "main", "فائر": "fire",
    "گن": "gun", "زون": "zone", "فرنٹ": "front", "بیک": "back", "گودام": "warehouse", "ویئر": "warehouse",
}


def _camera_q(word: str) -> Q:
    return (
        Q(name__icontains=word)
        | Q(code__icontains=word)
        | Q(zone__icontains=word)
        | Q(location__icontains=word)
        | Q(passage_role__icontains=word)
        | Q(nvr__site__name__icontains=word)
        | Q(nvr__name__icontains=word)
    )


def _query_words(query: str) -> list[str]:
    words = []
    for raw in re.findall(r"\w+", (query or "").lower()):
        word = _URDU_PLACE_WORDS.get(raw, raw)
        if word not in _CAMERA_STOPWORDS:
            words.append(word)
    return words


def _match_cameras(user, query: str):
    """Cameras matching every place word; if none do, the cameras matching the most words."""
    qs = _scoped_cameras(user)
    words = _query_words(query)
    if not words:
        return qs
    strict = qs
    for word in words:
        strict = strict.filter(_camera_q(word))
    if strict.exists():
        return strict
    hits: dict[int, int] = {}
    for word in words:
        for pk in qs.filter(_camera_q(word)).values_list("pk", flat=True):
            hits[pk] = hits.get(pk, 0) + 1
    best = max(hits.values(), default=0)
    if best:
        return qs.filter(pk__in=[pk for pk, n in hits.items() if n == best])
    # Misspelt place names ("peshwar gat", "contrl room"): closest camera names.
    return fuzzy_filter(qs, " ".join(words), ("name", "zone", "location", "nvr__site__name"))


def _resolve_camera(user, args: dict):
    """A camera from 'camera_id' or, failing that, from a 'camera' name — so the model never has to guess ids."""
    raw_id = args.get("camera_id")
    if raw_id not in (None, ""):
        try:
            cam = _scoped_cameras(user).filter(pk=int(raw_id)).first()
        except (TypeError, ValueError):
            cam = None
        if cam is not None:
            return cam
    name = str(args.get("camera") or "").strip()
    if not name:
        if raw_id not in (None, ""):
            raise ToolError(
                f"Camera id {raw_id} does not exist. Never guess ids: pass the camera's name as 'camera', "
                "or call search_cameras."
            )
        raise ToolError("Give the camera's name as 'camera' (or a camera_id returned by a tool).")
    matches = list(_match_cameras(user, name)[:6])
    if not matches:
        raise ToolError(f"No camera matches '{name}'.")
    if len(matches) > 1:
        options = ", ".join(f"{c.name} (id {c.pk})" for c in matches[:5])
        raise ToolError(f"Several cameras match '{name}': {options}. Ask the officer which one.")
    return matches[0]


def _camera_row(cam) -> dict:
    return {
        "id": cam.pk,
        "code": cam.code,
        "name": cam.name,
        "site": cam.nvr.site.name if cam.nvr_id else cam.location,
        "location": cam.location,
        "zone": cam.zone,
        "status": cam.status,
        "ai_purposes": cam.purpose_labels(),
    }


def search_cameras(ctx: ToolContext, args: dict) -> dict:
    qs = _match_cameras(ctx.user, args.get("query", ""))
    status = (args.get("status") or "").strip().capitalize()
    if status in ("Online", "Offline"):
        qs = qs.filter(status=status)
    limit = _clamp(args.get("limit"), 20, 1, MAX_LIST)
    total = qs.count()
    return {
        "total_matches": total,
        "cameras": [_camera_row(c) for c in qs[:limit]],
        "truncated": total > limit,
    }


def camera_details(ctx: ToolContext, args: dict) -> dict:
    from camera_health.models import CameraHealthSnapshot
    from cameras.models import DetectionEvent

    cam = _resolve_camera(ctx.user, args)
    _set_focus_camera(ctx, cam)
    since = timezone.now() - timedelta(minutes=30)
    recent = (
        DetectionEvent.objects.filter(camera=cam, created_at__gte=since)
        .values("class_name")
        .annotate(n=Count("id"))
        .order_by("-n")
    )
    health = CameraHealthSnapshot.objects.filter(camera=cam).order_by("-timestamp").first()
    out = {
        **_camera_row(cam),
        "nvr": cam.nvr.name if cam.nvr_id else "",
        "channel": cam.channel,
        "recording": cam.recording,
        "detections_last_30_min": {r["class_name"]: r["n"] for r in recent},
    }
    if health:
        out["health"] = {
            "status": health.status,
            "overall_score": round(health.overall_score, 1),
            "rtsp_available": health.rtsp_available,
            "fps": health.fps,
            "checked_at": _local(health.timestamp),
            "recommendations": (health.recommendations or [])[:3],
        }
    return out


# ---------------------------------------------------------------- detections


def search_detections(ctx: ToolContext, args: dict) -> dict:
    from cameras.models import DetectionEvent

    qs = DetectionEvent.objects.select_related("camera").filter(
        policy.camera_scope_q(ctx.user, prefix="camera__"), camera__is_active=True
    )
    camera_ids = [c for c in (args.get("camera_ids") or []) if str(c).strip()]
    if camera_ids:
        qs = qs.filter(camera_id__in=[_get_camera(ctx.user, c).pk for c in camera_ids])
    elif (args.get("area_query") or "").strip():
        cams = list(_match_cameras(ctx.user, args["area_query"]).values_list("pk", flat=True))
        if not cams:
            return {"total": 0, "note": f"No cameras match '{args['area_query']}'."}
        qs = qs.filter(camera_id__in=cams)

    classes = [c.strip().lower() for c in (args.get("class_names") or []) if str(c).strip()]
    if classes:
        cq = Q()
        for c in classes:
            cq |= Q(class_name__iexact=c) | Q(label__icontains=c)
        qs = qs.filter(cq)
    if (args.get("text") or "").strip():
        t = args["text"].strip()
        qs = qs.filter(
            Q(label__icontains=t)
            | Q(employee_name__icontains=t)
            | Q(personal_number__icontains=t)
            | Q(person_qr__iexact=t)
        )
    if args.get("alerts_only"):
        qs = qs.filter(is_alert=True)

    start = _parse_time(args.get("start_time", ""))
    end = _parse_time(args.get("end_time", ""))
    if not start and not end:
        start = timezone.now() - timedelta(minutes=_clamp(args.get("last_minutes"), 60, 1, 60 * 24 * 31))
    if start:
        qs = qs.filter(created_at__gte=start)
    if end:
        qs = qs.filter(created_at__lte=end)

    limit = _clamp(args.get("limit"), 15, 1, MAX_LIST)
    by_class = qs.values("class_name").annotate(n=Count("id")).order_by("-n")[:15]
    by_camera = qs.values("camera_id", "camera__name").annotate(n=Count("id")).order_by("-n")[:15]
    events = [
        {
            "event_id": e.pk,
            "time": _local(e.created_at),
            "camera_id": e.camera_id,
            "camera": e.camera.name,
            "class": e.class_name,
            "label": e.label,
            "identified_staff": e.employee_name or None,
            "person_code": e.person_qr or None,
            "confidence": round(e.confidence, 2),
            "is_alert": e.is_alert,
            "has_snapshot": bool(e.clip),
        }
        for e in qs.order_by("-created_at")[:limit]
    ]
    return {
        "window": {"from": _local(start), "to": _local(end) or "now"},
        "total": qs.count(),
        "counts_by_class": {r["class_name"]: r["n"] for r in by_class},
        "counts_by_camera": [
            {"camera_id": r["camera_id"], "camera": r["camera__name"], "count": r["n"]} for r in by_camera
        ],
        "latest_events": events,
    }


# ---------------------------------------------------------------- ANPR / vehicles


def _allowed_camera_keys(user) -> set[str] | None:
    if not policy.location_scope(user):
        return None
    return {f"cam-{pk}" for pk in _scoped_cameras(user).values_list("pk", flat=True)}


def search_vehicles(ctx: ToolContext, args: dict) -> dict:
    from cameras.plate_captures import load_vehicle_journey, load_vehicle_journeys

    allowed = _allowed_camera_keys(ctx.user)
    date_from = (args.get("date_from") or "").strip()
    date_to = (args.get("date_to") or "").strip()
    plate = (args.get("plate") or "").strip()

    if plate:
        journey = load_vehicle_journey(plate)
        if not journey:
            return {"found": False, "plate": plate, "note": "No ANPR sightings for this plate."}
        path = journey.get("path") or []
        if allowed is not None:
            path = [p for p in path if str(p.get("camera_key") or "").lower() in allowed]
        if date_from or date_to:
            lo = _parse_time(date_from)
            hi = _parse_time(date_to)
            if hi and len(date_to) == 10:
                hi = hi + timedelta(days=1)

            def _in_range(p):
                ts = _parse_time(str(p.get("timestamp") or ""))
                return ts is not None and (not lo or ts >= lo) and (not hi or ts < hi)

            path = [p for p in path if _in_range(p)]
        if not path:
            return {"found": False, "plate": plate, "note": "No sightings in your location / time range."}
        return {
            "found": True,
            "plate_number": journey["plate_number"],
            "plate_key": journey["plate_key"],
            "ocr_variants": journey.get("ocr_variants", [])[:5],
            "sighting_count": len(path),
            "sightings": [
                {
                    "time": p["timestamp"],
                    "camera": p["camera_name"] or p["camera_key"],
                    "camera_key": p["camera_key"],
                    "location": p["location"],
                    "zone": p["zone"],
                }
                for p in path[:40]
            ],
        }

    data = load_vehicle_journeys(
        page=1,
        page_size=100,
        q=(args.get("query") or "").strip(),
        min_passes=1,
        date_from=date_from,
        date_to=date_to,
    )
    rows = data.get("results") or []
    if allowed is not None:
        rows = [r for r in rows if any(str(c.get("camera_key") or "").lower() in allowed for c in r.get("cameras") or [])]
    limit = _clamp(args.get("limit"), 10, 1, MAX_LIST)
    return {
        "total_vehicles": len(rows),
        "vehicles": [
            {
                "plate_number": r["plate_number"],
                "plate_key": r["plate_key"],
                "sightings": r["sighting_count"],
                "passes": r["pass_count"],
                "first_seen": r["first_seen"],
                "last_seen": r["last_seen"],
                "route": r.get("route", [])[:8],
            }
            for r in rows[:limit]
        ],
    }


# ---------------------------------------------------------------- people / journeys


def search_people(ctx: ToolContext, args: dict) -> dict:
    from person_journey.models import JourneyPerson

    qs = JourneyPerson.objects.filter(merged_into__isnull=True).select_related("latest_camera", "staff")
    if policy.location_scope(ctx.user):
        qs = qs.filter(policy.camera_scope_q(ctx.user, prefix="latest_camera__"))
    q = (args.get("query") or "").strip()
    fuzzy = False
    if q:
        exact = qs.filter(Q(code__iexact=q) | Q(display_name__icontains=q))
        if exact.exists():
            qs = exact
        else:
            qs = fuzzy_filter(qs, q, ("display_name", "staff__full_name"))
            fuzzy = True
    ptype = (args.get("person_type") or "").strip().lower()
    if ptype in ("staff", "visitor", "unknown"):
        qs = qs.filter(person_type=ptype)
    minutes = args.get("seen_in_last_minutes")
    if minutes:
        qs = qs.filter(latest_seen_at__gte=timezone.now() - timedelta(minutes=_clamp(minutes, 60, 1, 60 * 24 * 31)))
    limit = _clamp(args.get("limit"), 10, 1, MAX_LIST)
    total = qs.count()
    extra: dict = {}
    if fuzzy and total:
        extra = {"match": "fuzzy", "note": f"No exact match for '{q}'; these are close spellings."}
    if q and not total and policy.has_capability(ctx.user, "staff.view"):
        # Officers say "find staff member X" meaning the employee directory, not camera tracking.
        staff = search_records(ctx.user, {"dataset": "staff", "text": q, "limit": 5}, fallback=False)
        if staff["total"]:
            extra = {"staff_directory": staff, "note": "Not tracked on cameras, but found in the staff directory."}
    return {
        "total": total,
        **extra,
        "people": [
            {
                "code": p.code,
                "uuid": str(p.uuid),
                "type": p.person_type,
                "name": p.display_name or None,
                "status": p.status,
                "last_seen": _local(p.latest_seen_at),
                "last_camera_id": p.latest_camera_id,
                "last_camera": p.latest_camera.name if p.latest_camera_id else None,
                "last_zone": p.latest_zone or None,
            }
            for p in qs[:limit]
        ],
    }


def person_journey(ctx: ToolContext, args: dict) -> dict:
    from person_journey.models import JourneyEvent, JourneyPerson

    key = (args.get("person") or "").strip()
    match = Q(code__iexact=key)
    try:
        match |= Q(uuid=uuid.UUID(key))
    except ValueError:
        pass
    person = JourneyPerson.objects.filter(match).first()
    if person is None:
        raise ToolError(f"No person with code '{key}'. Use search_people first.")
    events = JourneyEvent.objects.filter(journey_person=person).select_related("camera")
    if policy.location_scope(ctx.user):
        events = events.filter(policy.camera_scope_q(ctx.user, prefix="camera__"))
    start = _parse_time(args.get("start_time", ""))
    if start:
        events = events.filter(created_at__gte=start)
    limit = _clamp(args.get("limit"), 25, 1, 50)
    rows = list(events.order_by("-created_at")[:limit])
    rows.reverse()
    return {
        "code": person.code,
        "uuid": str(person.uuid),
        "name": person.display_name or None,
        "type": person.person_type,
        "timeline": [
            {
                "time": _local(e.created_at),
                "event": e.event_type,
                "title": e.title,
                "camera_id": e.camera_id,
                "camera": e.camera.name if e.camera_id else None,
                "zone": e.zone or None,
                "gate": e.gate or None,
            }
            for e in rows
        ],
    }


# ---------------------------------------------------------------- GPS


def officer_locations(ctx: ToolContext, args: dict) -> dict:
    from gps_tracking.models import OfficerGpsLatest

    qs = OfficerGpsLatest.objects.select_related("user")
    scope = policy.location_scope(ctx.user)
    if scope:
        qs = qs.filter(location=scope)
    if args.get("on_duty_only", True):
        qs = qs.filter(on_duty=True)
    q = (args.get("officer") or "").strip()
    if q:
        exact = qs.filter(
            Q(user__username__icontains=q) | Q(user__full_name__icontains=q) | Q(user__employee_id__iexact=q)
        )
        qs = exact if exact.exists() else fuzzy_filter(qs, q, ("user__full_name", "user__username"))
    limit = _clamp(args.get("limit"), 15, 1, MAX_LIST)
    return {
        "total": qs.count(),
        "officers": [
            {
                "officer": row.user.full_name or row.user.username,
                "role": row.user.role,
                "on_duty": row.on_duty,
                "latitude": round(row.latitude, 6),
                "longitude": round(row.longitude, 6),
                "last_fix": _local(row.recorded_at),
                "battery_pct": row.battery_pct,
                "location": row.location,
            }
            for row in qs[:limit]
        ],
    }


# ---------------------------------------------------------------- incidents


def _incident_row(inc) -> dict:
    return {
        "incident_id": inc.pk,
        "reference": f"INC-{inc.pk}",
        "title": inc.title,
        "severity": inc.severity,
        "status": inc.status,
        "location": inc.location,
        "camera": inc.camera.name if inc.camera_id else None,
        "created_at": _local(inc.created_at),
        "created_by": inc.created_by.username if inc.created_by_id else None,
    }


def create_incident(ctx: ToolContext, args: dict) -> dict:
    """Prepare only. Execution happens in execute_pending_action after the officer says yes."""
    from cameras.models import DetectionEvent

    title = (args.get("title") or "").strip()[:200]
    if not title:
        raise ToolError("An incident title is required.")
    severity = (args.get("severity") or "medium").strip().lower()
    if severity not in ("low", "medium", "high", "critical"):
        severity = "medium"

    camera = None
    event = None
    if args.get("detection_event_id"):
        event = (
            DetectionEvent.objects.select_related("camera")
            .filter(policy.camera_scope_q(ctx.user, prefix="camera__"), pk=args["detection_event_id"])
            .first()
        )
        if event is None:
            raise ToolError("Detection event not found or not in your authorised location.")
        camera = event.camera
    if args.get("camera_id"):
        camera = _get_camera(ctx.user, args["camera_id"])

    location = (camera.location if camera else "") or policy.location_scope(ctx.user) or ""
    params = {
        "title": title,
        "description": (args.get("description") or "").strip()[:4000],
        "severity": severity,
        "camera_id": camera.pk if camera else None,
        "detection_event_id": event.pk if event else None,
        "location": location,
    }
    summary = f"Create a {severity}-severity incident '{title}'"
    if camera:
        summary += f" for camera {camera.name}"
    if event:
        summary += f" with detection event {event.pk} ({event.class_name} at {_local(event.created_at)}) as evidence"
    ctx.session.pending_action = {
        "type": "create_incident",
        "params": params,
        "summary": summary,
        "expires_at": _pending_expiry(ctx),
    }
    return {
        "status": "awaiting_officer_confirmation",
        "prepared": summary,
        "instruction": "Nothing has been created yet. In your reply, state this change in one sentence and ask the officer to confirm (yes / no).",
    }


def execute_pending_action(user, session, pending: dict) -> tuple[dict, str]:
    """Run the confirmed write. Called by the agent only after a deterministic 'yes' from the officer.

    Returns (result, what to tell the officer).
    """
    from .models import Incident

    kind = (pending or {}).get("type")
    if kind == "action":
        try:
            result = agent_actions.execute(user, pending["params"])
        except agent_actions.ActionError as exc:
            raise ToolError(str(exc)) from exc
        ref = next((result[k] for k in ("reference", "case_no", "note_sheet_no") if result.get(k)), "")
        return result, f"Done: {pending['summary']}." + (f" Reference {ref}." if ref else "")
    if kind != "create_incident":
        raise ToolError("No pending action.")
    if not policy.has_capability(user, "incidents.create"):
        raise ToolError("You are not authorised to create incidents.")
    params = pending["params"]
    if params.get("camera_id"):
        _get_camera(user, params["camera_id"])  # re-verify scope at execution time
    inc = Incident.objects.create(
        title=params["title"],
        description=params["description"],
        severity=params["severity"],
        location=params["location"],
        camera_id=params.get("camera_id"),
        detection_event_id=params.get("detection_event_id"),
        evidence={"source_session": str(session.pk)},
        created_by=user,
    )
    row = _incident_row(inc)
    return {"created": True, **row}, f"Done. Incident {row['reference']} has been created."


def perform_action(ctx: ToolContext, args: dict) -> dict:
    """Prepare only — executes after the officer confirms, exactly like create_incident."""
    try:
        params = agent_actions.prepare(
            ctx.user, str(args.get("action") or ""), str(args.get("target") or ""), args.get("fields") or {}
        )
    except agent_actions.ActionError as exc:
        raise ToolError(str(exc)) from exc
    ctx.session.pending_action = {
        "type": "action",
        "params": params,
        "summary": params["summary"],
        "expires_at": _pending_expiry(ctx),
    }
    return {
        "status": "awaiting_officer_confirmation",
        "prepared": params["summary"],
        "instruction": "Nothing has been changed yet. In your reply, state this change in one sentence and ask the officer to confirm (yes / no).",
    }


def generate_report(ctx: ToolContext, args: dict) -> dict:
    from .reports import ReportError, build_report, report_digest

    args = dict(args)
    if not mentions_time(ctx.utterance):
        for spec in args.get("sections") or []:
            if isinstance(spec, dict):
                for key in ("last_days", "date_from", "date_to"):
                    spec.pop(key, None)
    try:
        report = build_report(ctx.user, ctx.session, args)
    except ReportError as exc:
        raise ToolError(str(exc)) from exc
    ctx.ui_actions.append({"type": "report", "report_id": str(report.pk), "title": report.title})
    ctx.reports.append(str(report.pk))
    return report_digest(report)


# ---------------------------------------------------------------- UI control

UI_PAGES = {
    "dashboard": "/",
    "live_cameras": "/analytics/live-camera-grid",
    "all_cities_cameras": "/all-cities-cameras",
    "camera_management": "/camera-management",
    "person_journey": "/person-journey",
    "person_journey_detail": "/person-journey/{id}",
    "vehicle_journey": "/vehicle-journey",
    "vehicle_journey_detail": "/vehicle-journey/{id}",
    "vehicle_detection": "/vehicle-detection",
    "object_tracking": "/object-tracking",
    "gps_tracking": "/gps-tracking",
    "visitor_management": "/visitor-management",
    "seizure_management": "/seizure-management",
    "note_sheets": "/seizure-management/note-sheet",
    "detention_memo": "/seizure-management/detention-memo",
    "assessments": "/seizure-management/assessment",
    "recovery_memos": "/seizure-management/recovery-memo",
    "employees": "/employees",
    "attendance": "/attendance",
    "leave_management": "/leave-management",
    "incident_management": "/incident-management",
    "infrastructure": "/infrastructure",
    "infrastructure_alerts": "/infrastructure/alerts",
    "anpr_vehicle_tracking": "/anpr-vehicle-tracking",
    "assistant": "/assistant",
}


def ui_navigate(ctx: ToolContext, args: dict) -> dict:
    page = (args.get("page") or "").strip()
    template = UI_PAGES.get(page)
    if not template:
        raise ToolError(f"Unknown page '{page}'.")
    if "{id}" in template:
        ident = str(args.get("id") or "").strip()
        if not ident:
            raise ToolError(f"Page '{page}' needs an id (person uuid or vehicle plate_key).")
        template = template.replace("{id}", ident)
    ctx.ui_actions.append({"type": "navigate", "path": template})
    return {"navigated_to": page}


def ui_open_camera(ctx: ToolContext, args: dict) -> dict:
    cam = _resolve_camera(ctx.user, args)
    _set_focus_camera(ctx, cam)
    ctx.ui_actions.append(
        {"type": "navigate", "path": f"/analytics/live-camera-grid?cameraId={cam.pk}", "camera_id": cam.pk}
    )
    return {"opened_camera": cam.name, "camera_id": cam.pk}


def search_records_tool(ctx: ToolContext, args: dict) -> dict:
    args = dict(args)
    if not mentions_time(ctx.utterance):
        # Small models add "last 7 days" on their own, turning "how many staff…" into a wrong zero.
        for key in ("last_days", "date_from", "date_to"):
            args.pop(key, None)
    try:
        return search_records(ctx.user, args)
    except RecordsError as exc:
        raise ToolError(str(exc)) from exc


def end_conversation(ctx: ToolContext, args: dict) -> dict:
    ctx.end_session = True
    return {"session": "will close after this reply"}


# ---------------------------------------------------------------- registry


def _schema(props: dict, required: list[str] | None = None) -> dict:
    return {"type": "object", "properties": props, "required": required or [], "additionalProperties": False}


_LIMIT = {"type": "integer", "description": "Max rows to return."}
_ISO = "ISO local time (Asia/Karachi), e.g. 2026-09-28T14:30"
_CAMERA_REF = {
    "camera": {"type": "string", "description": "Camera name or place in English, e.g. 'SWH front side'."},
    "camera_id": {"type": "integer", "description": "Only an id returned by an earlier tool result."},
}

TOOLS: list[Tool] = [
    Tool(
        "search_cameras",
        "Find cameras by free-text place/name (e.g. 'main gate', 'warehouse'), code, zone or site, optionally by Online/Offline status. Use this to resolve places the officer mentions into camera ids.",
        _schema({"query": {"type": "string"}, "status": {"type": "string", "enum": ["", "Online", "Offline"]}, "limit": _LIMIT}),
        "read",
        "cameras.view",
        search_cameras,
    ),
    Tool(
        "camera_details",
        "Details for one camera: site, status, stream health, and detection counts in the last 30 minutes. Also marks it as the camera currently in focus. Pass the camera's name as 'camera' (English), or a camera_id returned by a tool.",
        _schema(_CAMERA_REF),
        "read",
        "cameras.view",
        camera_details,
    ),
    Tool(
        "search_detections",
        "AI detection events (persons, vehicles, weapons, fire/smoke, faces, plates). Filter by camera ids OR a free-text area, class names, identified staff/person text, alerts only, and a time window (default last 60 minutes). Returns totals, counts by class and by camera, and the latest events.",
        _schema(
            {
                "camera_ids": {"type": "array", "items": {"type": "integer"}},
                "area_query": {"type": "string", "description": "Place words used to find cameras, e.g. 'main gate'."},
                "class_names": {"type": "array", "items": {"type": "string"}, "description": "e.g. person, car, truck, weapon, fire"},
                "text": {"type": "string", "description": "Staff name, personal number or person code."},
                "alerts_only": {"type": "boolean"},
                "last_minutes": {"type": "integer"},
                "start_time": {"type": "string", "description": _ISO},
                "end_time": {"type": "string", "description": _ISO},
                "limit": _LIMIT,
            }
        ),
        "read",
        "detections.view",
        search_detections,
    ),
    Tool(
        "search_vehicles",
        "ANPR licence-plate data. With 'plate', returns every sighting of that vehicle (time, camera, location) — tolerant to OCR variants. Without 'plate', lists vehicles seen, optionally filtered by query/date.",
        _schema(
            {
                "plate": {"type": "string"},
                "query": {"type": "string"},
                "date_from": {"type": "string", "description": "YYYY-MM-DD or " + _ISO},
                "date_to": {"type": "string", "description": "YYYY-MM-DD or " + _ISO},
                "limit": _LIMIT,
            }
        ),
        "read",
        "vehicles.view",
        search_vehicles,
    ),
    Tool(
        "search_people",
        "People tracked by cameras (person-journey: staff, visitors, unknowns): find by code (P100/V55/U300) or name, type, or recently seen. For the employee directory (designation, phone, posting) use search_records with dataset 'staff'.",
        _schema(
            {
                "query": {"type": "string"},
                "person_type": {"type": "string", "enum": ["", "staff", "visitor", "unknown"]},
                "seen_in_last_minutes": {"type": "integer"},
                "limit": _LIMIT,
            }
        ),
        "read",
        "people.view",
        search_people,
    ),
    Tool(
        "person_journey",
        "Movement timeline of one tracked person across cameras (where they went). Takes the person code or uuid from search_people / detection results.",
        _schema({"person": {"type": "string"}, "start_time": {"type": "string", "description": _ISO}, "limit": _LIMIT}, ["person"]),
        "read",
        "people.view",
        person_journey,
    ),
    Tool(
        "officer_locations",
        "Latest GPS position of field officers (on duty by default), optionally for one officer by name/username/employee id.",
        _schema({"officer": {"type": "string"}, "on_duty_only": {"type": "boolean"}, "limit": _LIMIT}),
        "read",
        "gps.view",
        officer_locations,
    ),
    Tool(
        "create_incident",
        "PREPARE an official incident record (optionally linked to a camera and/or a detection event as evidence). This does not create anything: it returns a summary you must read back, and the system creates it only after the officer explicitly confirms.",
        _schema(
            {
                "title": {"type": "string"},
                "description": {"type": "string"},
                "severity": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
                "camera_id": {"type": "integer"},
                "detection_event_id": {"type": "integer"},
            },
            ["title"],
        ),
        "write",
        "incidents.create",
        create_incident,
    ),
    Tool(
        "ui_navigate",
        "Open a TekEye screen on the officer's display. Detail pages need 'id' (person uuid or vehicle plate_key).",
        _schema({"page": {"type": "string", "enum": sorted(UI_PAGES)}, "id": {"type": "string"}}, ["page"]),
        "control",
        "ui.control",
        ui_navigate,
    ),
    Tool(
        "ui_open_camera",
        "Show one camera's live view on the officer's display and make it the camera in focus ('here', 'this camera'). Pass the camera's name as 'camera' (English, e.g. 'control room 1'), or a camera_id returned by a tool.",
        _schema(_CAMERA_REF),
        "control",
        "cameras.view",
        ui_open_camera,
    ),
    Tool(
        "search_records",
        "Search, count and group any other TekEye records — staff, cases, seizures, goods, warehouse, visitors, "
        "camera health, tracked objects, infrastructure, logs. Use it for any question the other tools don't cover. "
        "'text' matches names, numbers, case/FIR/reference numbers, CNIC, descriptions, etc. (English). "
        "Use group_by for 'how many per …' questions; 'total' is the full match count. Datasets:\n"
        + dataset_catalog(),
        _schema(
            {
                "dataset": {"type": "string", "enum": sorted(DATASETS)},
                "text": {"type": "string", "description": "Words to search for, e.g. a name, case no, FIR no, product."},
                "filters": {"type": "object", "description": "Exact field filters, e.g. {\"status\": \"pending\"}. The error lists allowed fields."},
                "group_by": {"type": "string", "description": "Field to count by, e.g. 'status', 'designation', 'device_type'."},
                "last_days": {"type": "integer"},
                "date_from": {"type": "string", "description": "YYYY-MM-DD"},
                "date_to": {"type": "string", "description": "YYYY-MM-DD"},
                "limit": {"type": "integer", "description": "Rows to return (0 for counts only, max 25)."},
            },
            ["dataset"],
        ),
        "read",
        "records.view",
        search_records_tool,
    ),
    Tool(
        "perform_action",
        "PREPARE a change in TekEye: register/approve/deny visitors, file/approve/reject leave, create/update "
        "detention memos and note sheets, submit/approve/reject note sheets, assessments and recovery memos, "
        "acknowledge/resolve alerts, update incidents. Nothing changes until the officer says yes: read the returned "
        "summary back and ask them to confirm. 'target' names the existing record (name, case no, number) — "
        "omit it for create actions. 'fields' holds the values; * marks required ones — ask the officer for any "
        "that are missing instead of inventing them. Actions:\n{catalog}",
        _schema(
            {
                "action": {"type": "string", "enum": sorted(agent_actions.ACTIONS)},
                "target": {"type": "string", "description": "Which existing record, e.g. 'DM-2026-014', 'Ahmed Khan'."},
                "fields": {"type": "object", "description": "Field values in English, e.g. {\"reason\": \"incomplete documents\"}."},
            },
            ["action"],
        ),
        "write",
        "actions.perform",
        perform_action,
    ),
    Tool(
        "generate_report",
        "Compile a formal report (PDF + Excel download) from TekEye records. Each section is a search_records-style "
        "query: {heading, dataset, text?, filters?, group_by?, date_from?, date_to?, last_days?, limit? (rows, max 500)}. "
        "Use group_by for breakdowns (they become charts). Optional 'summary' is a short narrative for the top of the "
        "document. The real figures come back so you can summarise them.",
        _schema(
            {
                "title": {"type": "string"},
                "summary": {"type": "string"},
                "sections": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "heading": {"type": "string"},
                            "dataset": {"type": "string", "enum": sorted(DATASETS)},
                            "text": {"type": "string"},
                            "filters": {"type": "object"},
                            "group_by": {"type": "string"},
                            "date_from": {"type": "string", "description": "YYYY-MM-DD"},
                            "date_to": {"type": "string", "description": "YYYY-MM-DD"},
                            "last_days": {"type": "integer"},
                            "limit": {"type": "integer"},
                        },
                        "required": ["dataset"],
                    },
                },
            },
            ["title", "sections"],
        ),
        "read",
        "reports.create",
        generate_report,
    ),
    Tool(
        "end_conversation",
        "Call when the officer is finished (e.g. 'that's all', 'thank you', 'bas', 'shukriya'). The session returns to wake-word mode after your reply.",
        _schema({}),
        "control",
        "ui.control",
        end_conversation,
    ),
]

TOOLS_BY_NAME = {t.name: t for t in TOOLS}


def tools_for_user(user, mode: str = "voice") -> list[Tool]:
    """Tool discovery: only capabilities this officer is authorised for are offered to the model."""
    out = []
    for t in TOOLS:
        if not policy.has_capability(user, t.capability):
            continue
        if mode == "chat" and t.name == "end_conversation":
            continue  # typed chats stay open; the officer just stops typing
        if t.name == "perform_action":
            allowed = agent_actions.actions_for_user(user)
            schema = {**t.input_schema, "properties": {**t.input_schema["properties"]}}
            schema["properties"]["action"] = {"type": "string", "enum": [a.name for a in allowed]}
            t = dataclasses.replace(
                t, description=t.description.replace("{catalog}", agent_actions.action_catalog(allowed)), input_schema=schema
            )
        out.append(t)
    return out
