"""
Person Journey observation gallery + global association.

Architecture:
  Detection → Local Track (ByteTrack) → Tracklet → Observations (gallery)
           → Global Associator → JourneyPerson (PJ-#####) → Journey timeline

Never collapse many observations into a single averaged embedding.
"""

from __future__ import annotations

import logging
import math
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .identities import format_tracklet_id
from .models import (
    CameraTopologyEdge,
    CameraTrack,
    IdentityState,
    JourneyEvent,
    JourneyEventType,
    JourneyPerson,
    PersonObservation,
    PersonStatus,
    PersonTransition,
    PersonType,
    TrackStatus,
)

logger = logging.getLogger(__name__)

_MAX_GALLERY_PER_KIND = 150
# The ML side already sends a track-averaged embedding; saving it every 1.5 s only filled the gallery with
# near-identical copies (and pushed older, more varied views of the person out of the 150 cap).
_OBSERVATION_MIN_INTERVAL_SEC = 10.0


def _settings_float(key: str, default: float) -> float:
    try:
        return float(getattr(settings, key, default))
    except (TypeError, ValueError):
        return default


def compute_movement_direction(trajectory: list) -> str:
    """Coarse movement direction from trajectory points [[x,y], ...] or bboxes."""
    pts: list[tuple[float, float]] = []
    for item in trajectory or []:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            try:
                if len(item) >= 4:
                    # bbox → center
                    pts.append(((float(item[0]) + float(item[2])) / 2.0, (float(item[1]) + float(item[3])) / 2.0))
                else:
                    pts.append((float(item[0]), float(item[1])))
            except (TypeError, ValueError):
                continue
    if len(pts) < 2:
        return ""
    dx = pts[-1][0] - pts[0][0]
    dy = pts[-1][1] - pts[0][1]
    if abs(dx) < 8 and abs(dy) < 8:
        return "stationary"
    angle = math.degrees(math.atan2(dy, dx))  # 0 = east, 90 = south (image y down)
    if -45 <= angle < 45:
        return "east"
    if 45 <= angle < 135:
        return "south"
    if angle >= 135 or angle < -135:
        return "west"
    return "north"


def topology_travel_score(
    from_camera_id: int | None,
    to_camera_id: int | None,
    travel_seconds: float,
) -> tuple[float, bool]:
    """
    Score 0–1 for camera hop plausibility. Returns (score, impossible).
    Uses CameraTopologyEdge when configured; otherwise soft travel-time prior.
    """
    if from_camera_id is None or to_camera_id is None:
        return 0.5, False
    if from_camera_id == to_camera_id:
        return 1.0, False

    edge = (
        CameraTopologyEdge.objects.filter(
            from_camera_id=from_camera_id,
            to_camera_id=to_camera_id,
            is_active=True,
        )
        .order_by("typical_min_sec")
        .first()
    )
    if edge is None:
        # Reverse edge still useful
        edge = (
            CameraTopologyEdge.objects.filter(
                from_camera_id=to_camera_id,
                to_camera_id=from_camera_id,
                is_active=True,
            )
            .order_by("typical_min_sec")
            .first()
        )
        if edge is not None and not edge.bidirectional:
            edge = None

    if edge is not None:
        lo = float(edge.typical_min_sec)
        hi = float(edge.typical_max_sec)
        hard_max = float(edge.hard_max_sec or (hi * 2.5))
        if travel_seconds < 0:
            return 0.0, True
        if travel_seconds > hard_max:
            return 0.0, True
        if lo <= travel_seconds <= hi:
            return 1.0, False
        if travel_seconds < lo:
            # Too fast for this hop
            ratio = travel_seconds / max(lo, 1.0)
            if ratio < 0.25:
                return 0.05, True
            return max(0.1, ratio), False
        # Slower than typical but under hard max
        over = (travel_seconds - hi) / max(hard_max - hi, 1.0)
        return max(0.15, 1.0 - over), False

    # No topology: soft prior — same site hops up to MAX_TRAVEL_SECONDS
    max_sec = float(getattr(settings, "JOURNEY_MAX_TRAVEL_SECONDS", 300))
    if travel_seconds < 0 or travel_seconds > max_sec:
        return 0.0, travel_seconds > max_sec * 1.5
    return max(0.2, 1.0 - (travel_seconds / max(max_sec, 1.0))), False


def find_best_global_match(
    *,
    face_embedding: list[float] | None,
    reid_embedding: list[float] | None,
    camera_id: int | None,
    person_type_hint: str | None = None,
    staff_id: int | None = None,
    visitor_id: int | None = None,
    direction: str = "",
    track_id: int | None = None,
) -> tuple[JourneyPerson | None, dict[str, Any]]:
    """Known staff/visitor ids are definitive; otherwise the calibrated re-identification engine decides."""
    from .identity import identify

    active = JourneyPerson.objects.filter(status=PersonStatus.ACTIVE)
    if staff_id:
        hit = active.filter(staff_id=staff_id).first()
        if hit:
            return hit, {"decision": "match", "reason": "staff_id"}
    if visitor_id:
        hit = active.filter(visitor_id=visitor_id).first()
        if hit:
            return hit, {"decision": "match", "reason": "visitor_id"}
    result = identify(
        face_embedding=face_embedding,
        reid_embedding=reid_embedding,
        camera_id=camera_id,
        track_id=track_id,
        person_type=person_type_hint,
    )
    return result.person, result.as_dict()


@transaction.atomic
def record_tracklet_observation(
    *,
    track: CameraTrack,
    person: JourneyPerson,
    bbox: list | None = None,
    confidence: float | None = None,
    face_embedding: list[float] | None = None,
    reid_embedding: list[float] | None = None,
    snapshot_path: str = "",
    quality: float = 0.5,
    metadata: dict | None = None,
    now=None,
) -> list[PersonObservation]:
    """Append gallery observations for this tracklet (face + reid separately)."""
    now = now or timezone.now()
    created: list[PersonObservation] = []

    # Update track trajectory / direction
    traj = list(track.trajectory or [])
    if bbox and len(bbox) >= 4:
        traj.append([float(v) for v in bbox[:4]] + [now.isoformat()])
        if len(traj) > 80:
            traj = traj[-80:]
        track.trajectory = traj
        track.last_bbox = bbox
        track.movement_direction = compute_movement_direction(traj)
        if not track.start_bbox:
            track.start_bbox = bbox
        track.end_bbox = bbox
        track.save(
            update_fields=[
                "trajectory",
                "last_bbox",
                "movement_direction",
                "start_bbox",
                "end_bbox",
            ]
        )

    def _should_add(kind: str) -> bool:
        last = (
            PersonObservation.objects.filter(tracklet=track, kind=kind)
            .order_by("-captured_at")
            .only("captured_at")
            .first()
        )
        if last and last.captured_at and (now - last.captured_at).total_seconds() < _OBSERVATION_MIN_INTERVAL_SEC:
            return False
        return True

    def _trim(kind: str) -> None:
        ids = list(
            PersonObservation.objects.filter(journey_person=person, kind=kind)
            .order_by("-quality", "-captured_at")
            .values_list("id", flat=True)[_MAX_GALLERY_PER_KIND:]
        )
        if ids:
            PersonObservation.objects.filter(id__in=ids).delete()

    if face_embedding and _should_add("face"):
        obs = PersonObservation.objects.create(
            tracklet=track,
            journey_person=person,
            kind="face",
            embedding=face_embedding,
            bbox=bbox or [],
            confidence=confidence,
            quality=quality,
            snapshot_path=snapshot_path,
            captured_at=now,
            metadata=metadata or {},
        )
        created.append(obs)
        _trim("face")
        # Keep legacy field as latest for compatibility
        person.face_embedding = face_embedding
        person.save(update_fields=["face_embedding", "updated_at"])

    if reid_embedding and _should_add("reid"):
        obs = PersonObservation.objects.create(
            tracklet=track,
            journey_person=person,
            kind="reid",
            embedding=reid_embedding,
            bbox=bbox or [],
            confidence=confidence,
            quality=quality,
            snapshot_path=snapshot_path,
            captured_at=now,
            metadata=metadata or {},
        )
        created.append(obs)
        _trim("reid")
        person.reid_embedding = reid_embedding
        person.save(update_fields=["reid_embedding", "updated_at"])

    return created


def maybe_record_transition(
    *,
    person: JourneyPerson,
    to_track: CameraTrack,
    scores: dict[str, Any] | None = None,
) -> PersonTransition | None:
    """When a person hops cameras, create an auditable transition edge."""
    if to_track.camera_id is None:
        return None
    prev = (
        CameraTrack.objects.filter(journey_person=person)
        .exclude(pk=to_track.pk)
        .exclude(camera_id=to_track.camera_id)
        .order_by("-started_at")
        .first()
    )
    if prev is None:
        return None
    if PersonTransition.objects.filter(from_tracklet=prev, to_tracklet=to_track).exists():
        return None

    exit_time = prev.ended_at or prev.started_at
    entry_time = to_track.started_at
    travel = max(0.0, (entry_time - exit_time).total_seconds()) if exit_time and entry_time else 0.0
    scores = scores or {}
    return PersonTransition.objects.create(
        journey_person=person,
        from_tracklet=prev,
        to_tracklet=to_track,
        from_camera_id=prev.camera_id,
        to_camera_id=to_track.camera_id,
        exit_time=exit_time,
        entry_time=entry_time,
        travel_time_sec=travel,
        reid_score=scores.get("reid_score"),
        face_score=scores.get("face_score"),
        topology_score=scores.get("topology_score"),
        direction_score=scores.get("direction_score"),
        time_score=scores.get("topology_score"),
        confidence=scores.get("combined"),
        decision=scores.get("decision") or "match",
        metadata={"from_tracklet_id": prev.tracklet_id, "to_tracklet_id": to_track.tracklet_id},
    )


def set_identity_state(person: JourneyPerson, state: str) -> None:
    if state in IdentityState.values and person.identity_state != state:
        person.identity_state = state
        person.save(update_fields=["identity_state", "updated_at"])
