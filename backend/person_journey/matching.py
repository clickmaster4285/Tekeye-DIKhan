"""Person matching engine — face + appearance + travel-time scoring."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from .models import JourneyPerson, PersonStatus, PersonType


def _env_float(key: str, default: float) -> float:
    try:
        return float(getattr(settings, key, default))
    except (TypeError, ValueError):
        return default


def _env_int(key: str, default: int) -> int:
    try:
        return int(getattr(settings, key, default))
    except (TypeError, ValueError):
        return default


FACE_MATCH_THRESHOLD = _env_float("JOURNEY_FACE_MATCH_THRESHOLD", 0.72)
REID_MATCH_THRESHOLD = _env_float("JOURNEY_REID_MATCH_THRESHOLD", 0.80)
# Legacy name; cross-camera hops now use the same calibrated bar (see identity.py).
REID_CROSS_CAMERA_THRESHOLD = _env_float("JOURNEY_REID_CROSS_CAMERA_THRESHOLD", 0.80)
COMBINED_MATCH_THRESHOLD = _env_float("JOURNEY_COMBINED_MATCH_THRESHOLD", 0.70)
MAX_TRAVEL_SECONDS = _env_int("JOURNEY_MAX_TRAVEL_SECONDS", 300)
RECENT_WINDOW_SECONDS = _env_int("JOURNEY_RECENT_WINDOW_SECONDS", 900)


def cosine_similarity(a: list[float] | None, b: list[float] | None) -> float:
    if not a or not b:
        return 0.0
    n = min(len(a), len(b))
    if n == 0:
        return 0.0
    dot = sum(float(a[i]) * float(b[i]) for i in range(n))
    na = math.sqrt(sum(float(a[i]) ** 2 for i in range(n)))
    nb = math.sqrt(sum(float(b[i]) ** 2 for i in range(n)))
    if na <= 0 or nb <= 0:
        return 0.0
    return max(0.0, min(1.0, dot / (na * nb)))


def _travel_time_valid(
    *,
    from_camera_id: int | None,
    to_camera_id: int | None,
    seconds_elapsed: float,
) -> bool:
    if from_camera_id is None or to_camera_id is None:
        return True
    if from_camera_id == to_camera_id:
        return True
    return 0 <= seconds_elapsed <= MAX_TRAVEL_SECONDS


def _connected_cameras(from_camera_id: int | None, to_camera_id: int | None) -> bool:
    if from_camera_id is None or to_camera_id is None:
        return True
    if from_camera_id == to_camera_id:
        return True
    try:
        from cameras.models import Camera

        c1 = Camera.objects.filter(pk=from_camera_id).values("location", "zone").first()
        c2 = Camera.objects.filter(pk=to_camera_id).values("location", "zone").first()
        if not c1 or not c2:
            return True
        if c1["location"] and c1["location"] == c2["location"]:
            return True
        if c1["zone"] and c2["zone"] and c1["zone"] == c2["zone"]:
            return True
    except Exception:
        return True
    return True


@dataclass
class MatchCandidate:
    person: JourneyPerson
    face_score: float
    reid_score: float
    travel_score: float
    combined_score: float


def score_candidate(
    person: JourneyPerson,
    *,
    face_embedding: list[float] | None,
    reid_embedding: list[float] | None,
    camera_id: int | None,
    now,
) -> MatchCandidate | None:
    face_score = cosine_similarity(face_embedding, person.face_embedding or [])
    reid_score = cosine_similarity(reid_embedding, person.reid_embedding or [])

    travel_score = 0.0
    if person.latest_seen_at and person.latest_camera_id:
        elapsed = (now - person.latest_seen_at).total_seconds()
        if _travel_time_valid(
            from_camera_id=person.latest_camera_id,
            to_camera_id=camera_id,
            seconds_elapsed=elapsed,
        ) and _connected_cameras(person.latest_camera_id, camera_id):
            travel_score = max(0.0, 1.0 - (elapsed / max(1, MAX_TRAVEL_SECONDS)))
        else:
            travel_score = 0.0

    has_face = bool(face_embedding and person.face_embedding)
    has_reid = bool(reid_embedding and person.reid_embedding)

    if has_face and has_reid:
        combined = face_score * 0.5 + reid_score * 0.3 + travel_score * 0.2
    elif has_face:
        combined = face_score * 0.7 + travel_score * 0.3
    elif has_reid:
        combined = reid_score * 0.7 + travel_score * 0.3
    else:
        combined = travel_score

    return MatchCandidate(
        person=person,
        face_score=face_score,
        reid_score=reid_score,
        travel_score=travel_score,
        combined_score=combined,
    )


def find_best_match(
    *,
    face_embedding: list[float] | None,
    reid_embedding: list[float] | None,
    camera_id: int | None,
    person_type_hint: str | None = None,
    staff_id: int | None = None,
    visitor_id: int | None = None,
) -> MatchCandidate | None:
    """Legacy entry point — delegates to the single calibrated engine in identity.identify()."""
    from .association import find_best_global_match

    person, detail = find_best_global_match(
        face_embedding=face_embedding,
        reid_embedding=reid_embedding,
        camera_id=camera_id,
        person_type_hint=person_type_hint,
        staff_id=staff_id,
        visitor_id=visitor_id,
    )
    if person is None or detail.get("decision") != "match":
        return None
    return MatchCandidate(
        person=person,
        face_score=float(detail.get("face_score") or 0.0),
        reid_score=float(detail.get("reid_score") or 0.0),
        travel_score=float(detail.get("topology_score") or 0.0),
        combined_score=float(detail.get("combined") or 0.0),
    )


def resolve_staff_from_face_label(label: str) -> tuple[int | None, str]:
    from users.models import Staff
    from django.db.models import Q

    lbl = (label or "").strip()
    low = lbl.lower()
    if not lbl or low in {"unknown", "person", "face", ""}:
        return None, ""
    if low.startswith(("gp", "go", "gv")) and low[2:].isdigit():
        return None, ""
    if low.startswith("t") and low[1:].isdigit():
        return None, ""
    if low.startswith("unknown"):
        return None, ""

    staff = (
        Staff.objects.filter(
            Q(face_identity_label__iexact=lbl)
            | Q(full_name__iexact=lbl)
            | Q(user__username__iexact=lbl)
        )
        .select_related("user")
        .first()
    )
    if staff is None:
        return None, lbl
    return staff.pk, (staff.full_name or lbl).strip()


def resolve_visitor_from_face_label(label: str) -> tuple[int | None, str]:
    """Map a recognized face label to an on-site visitor, if one exists."""
    from visitors.models import Visitor
    from django.db.models import Q

    lbl = (label or "").strip()
    low = lbl.lower()
    if not lbl or low in {"unknown", "person", "face", ""}:
        return None, ""
    if low.startswith(("gp", "go", "gv", "unknown")):
        return None, ""
    if low.startswith("t") and low[1:].isdigit():
        return None, ""

    visitor = Visitor.objects.filter(Q(full_name__iexact=lbl)).order_by("-id").first()
    if visitor is None:
        person = (
            JourneyPerson.objects.filter(
                person_type=PersonType.VISITOR,
                status=PersonStatus.ACTIVE,
                display_name__iexact=lbl,
            )
            .order_by("-latest_seen_at")
            .first()
        )
        if person and person.visitor_id:
            return person.visitor_id, person.display_name or lbl
        return None, lbl
    return visitor.pk, (visitor.full_name or lbl).strip()


def resolve_visitor_from_embedding(embedding) -> tuple[int | None, str, float]:
    """Match a probe embedding against the visitor face gallery (not staff attendance)."""
    from visitors.face_gallery import search_visitor_gallery

    hit = search_visitor_gallery(embedding)
    if not hit:
        return None, "", 0.0
    return (
        int(hit["visitor_id"]),
        str(hit.get("visitor_name") or ""),
        float(hit.get("confidence") or 0.0),
    )
