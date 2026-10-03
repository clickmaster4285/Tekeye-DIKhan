"""Journey ingestion — assign Person UUID, tracks, and timeline events."""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from cameras.models import Camera

from .identities import format_person_code, format_tracklet_id, parse_person_code_seq
from .matching import (
    resolve_staff_from_face_label,
    resolve_visitor_from_embedding,
    resolve_visitor_from_face_label,
)
from .models import (
    CameraTrack,
    JourneyEvent,
    JourneyEventType,
    JourneyPerson,
    PersonStatus,
    PersonType,
    TrackStatus,
)

logger = logging.getLogger(__name__)


def _allocate_code_lock() -> None:
    """Serialize global PJ- code generation across concurrent ingest workers."""
    from django.db import connection

    if connection.vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", ["journey_person_code:PJ"])
        return

    JourneyPerson.objects.select_for_update().order_by("-id").first()


def _max_code_seq() -> int:
    """Highest numeric sequence across PJ-##### and legacy P/V/U codes."""
    max_seq = 0
    for code in JourneyPerson.objects.values_list("code", flat=True):
        n = parse_person_code_seq(code)
        if n is not None:
            max_seq = max(max_seq, n)
    return max_seq


def _next_code(person_type: str | None = None) -> str:
    """Allocate the next global person ID PJ-##### (person_type is unused metadata)."""
    _ = person_type  # kept for call-site compatibility
    _allocate_code_lock()
    return format_person_code(_max_code_seq() + 1)


def ensure_camera_track(
    *,
    person: JourneyPerson,
    camera,
    track_id: int | None,
    now,
    bbox: list | None = None,
    track_status: str = "active",
    metadata: dict | None = None,
) -> CameraTrack | None:
    """
    Bind a per-camera tracklet to a global person.

    Camera 1 → tracklet C01-T18492 → JourneyPerson PJ-00042
    Camera 2 → tracklet C02-T93281 → same JourneyPerson PJ-00042

    Returns None when track_id is missing (no tracklet without a local track).
    """
    if not camera or track_id is None:
        return None
    try:
        track_id = int(track_id)
    except (TypeError, ValueError):
        return None
    if track_id < 0:
        return None

    finished = str(track_status or "active").strip().lower() == "finished"
    tracklet_id = format_tracklet_id(camera.pk, track_id)

    track = (
        CameraTrack.objects.filter(
            camera=camera,
            track_id=track_id,
            status=TrackStatus.ACTIVE,
            journey_person=person,
        )
        .order_by("-started_at")
        .first()
    )
    if track is None:
        # Reuse active tracklet on this camera even if person was re-matched
        # to the same identity via a different code path.
        track = (
            CameraTrack.objects.filter(
                camera=camera,
                track_id=track_id,
                status=TrackStatus.ACTIVE,
                journey_person__status=PersonStatus.ACTIVE,
            )
            .select_related("journey_person")
            .order_by("-started_at")
            .first()
        )
        if track and track.journey_person_id != person.pk:
            # Local track already bound — keep the tracklet, do not reassign mid-session
            # unless it was an unknown that just upgraded to this person.
            if track.journey_person.person_type == PersonType.UNKNOWN and person.person_type != PersonType.UNKNOWN:
                track.journey_person = person
                track.tracklet_id = tracklet_id
                track.last_bbox = bbox or track.last_bbox
                meta = dict(track.metadata or {})
                if metadata:
                    meta.update(metadata)
                track.metadata = meta
                track.last_seen_at = now
                track.save(update_fields=["journey_person", "tracklet_id", "last_bbox", "metadata", "last_seen_at"])
            # else: return existing track as-is (same camera track session)
            return track

    if track is None:
        track = CameraTrack.objects.create(
            journey_person=person,
            camera=camera,
            track_id=track_id,
            tracklet_id=tracklet_id,
            status=TrackStatus.FINISHED if finished else TrackStatus.ACTIVE,
            started_at=now,
            ended_at=now if finished else None,
            last_seen_at=now,
            last_bbox=bbox or [],
            metadata={**(metadata or {}), "tracklet_id": tracklet_id},
        )
        return track

    updates = ["last_bbox", "tracklet_id", "last_seen_at"]
    track.last_bbox = bbox or track.last_bbox
    track.tracklet_id = tracklet_id
    track.last_seen_at = now
    if finished:
        track.status = TrackStatus.FINISHED
        track.ended_at = now
        updates.extend(["status", "ended_at"])
    if metadata:
        meta = dict(track.metadata or {})
        meta.update(metadata)
        track.metadata = meta
        updates.append("metadata")
    track.save(update_fields=list(dict.fromkeys(updates)))
    return track


def _person_like_bbox(bbox: list | None, *, min_w: int = 24, min_h: int = 48) -> bool:
    """Reject tiny / absurd boxes that are usually false positives (wall, shadow)."""
    if not bbox or len(bbox) < 4:
        return False
    try:
        x1, y1, x2, y2 = (float(v) for v in bbox[:4])
    except (TypeError, ValueError):
        return False
    w = x2 - x1
    h = y2 - y1
    if w < min_w or h < min_h:
        return False
    aspect = h / max(w, 1.0)
    if aspect < 0.7 or aspect > 5.5:
        return False
    return True


def _can_create_unknown_person(
    *,
    bbox: list | None,
    confidence: float,
    face_embedding: list | None,
    reid_embedding: list | None,
) -> bool:
    """
    Do not invent a JourneyPerson from empty/noise detections.

    Unknowns need a person-shaped box plus appearance evidence (ReID/face)
    or very high confidence (snapshot must still verify later).
    """
    if not _person_like_bbox(bbox):
        return False
    if face_embedding and len(face_embedding) >= 64:
        return True
    if reid_embedding and len(reid_embedding) >= 64:
        return True
    return confidence >= float(getattr(settings, "JOURNEY_UNKNOWN_MIN_CONFIDENCE", 0.88))


def create_journey_person(*, person_type: str, max_attempts: int = 12, **fields) -> JourneyPerson:
    """Create a journey person, retrying if two workers race on the same code."""
    import time

    from django.db import IntegrityError

    if "code" in fields:
        return JourneyPerson.objects.create(person_type=person_type, **fields)

    last_exc: IntegrityError | None = None
    for attempt in range(max_attempts):
        try:
            create_fields = {**fields, "code": _next_code(person_type)}
            return JourneyPerson.objects.create(person_type=person_type, **create_fields)
        except IntegrityError as exc:
            last_exc = exc
            err = str(exc).lower()
            if "code" not in err and "journeyperson" not in err:
                raise
            if attempt >= max_attempts - 1:
                raise
            logger.warning(
                "Journey person code collision (attempt %s/%s, type=%s): %s",
                attempt + 1,
                max_attempts,
                person_type,
                exc,
            )
            time.sleep(0.025 * (attempt + 1))
    raise RuntimeError("Could not allocate unique journey person code") from last_exc


def _camera_zone(camera: Camera | None) -> str:
    if camera is None:
        return ""
    return (camera.zone or camera.name or "").strip()


@transaction.atomic
def _visit_last_seen(event: JourneyEvent):
    from django.utils.dateparse import parse_datetime

    raw = (event.metadata or {}).get("last_seen_at")
    parsed = parse_datetime(raw) if isinstance(raw, str) else None
    return parsed or event.created_at


def _open_visit(person: JourneyPerson, camera, now) -> JourneyEvent | None:
    """
    The person's current visit to this camera, if it is still open.

    Open = last seen here within JOURNEY_VISIT_GAP_SECONDS, and they have not started a visit on another
    camera since (going A → B → A makes a new A visit; overlapping cameras seeing them at once do not).
    """
    if camera is None:
        return None
    gap = float(getattr(settings, "JOURNEY_VISIT_GAP_SECONDS", 120))
    camera_event_types = [
        JourneyEventType.CAMERA_DETECTION,
        JourneyEventType.STAFF_RECOGNIZED,
        JourneyEventType.FACE_MATCHED,
        JourneyEventType.UNKNOWN_CREATED,
    ]
    visit = (
        JourneyEvent.objects.filter(
            journey_person=person,
            camera=camera,
            event_type__in=camera_event_types,
            created_at__gte=now - timedelta(hours=12),
        )
        .order_by("-created_at")
        .first()
    )
    if visit is None:
        return None
    last_seen = _visit_last_seen(visit)
    away = (now - last_seen).total_seconds()
    if away > gap:
        return None
    if away <= float(getattr(settings, "JOURNEY_VISIT_OVERLAP_SECONDS", 15)):
        # Still in view here — overlapping cameras seeing them at the same moment is not "moving away".
        return visit
    moved_away = (
        JourneyEvent.objects.filter(
            journey_person=person,
            created_at__gt=last_seen,
            event_type__in=camera_event_types,
        )
        .exclude(camera=camera)
        .exists()
    )
    return None if moved_away else visit


def _extend_visit(visit: JourneyEvent, *, now, track, track_id, confidence) -> None:
    import json

    from django.db.models.expressions import RawSQL

    meta = visit.metadata or {}
    duration = max(0, int((now - visit.created_at).total_seconds()))
    patch: dict[str, Any] = {
        "last_seen_at": now.isoformat(),
        "duration_seconds": duration,
        "sightings": int(meta.get("sightings") or 1) + 1,
    }
    if track_id and track_id not in (meta.get("track_ids") or []):
        patch["track_ids"] = [*(meta.get("track_ids") or []), track_id][-20:]
    retry_snapshot = not visit.snapshot_path and not meta.get("snapshot_retried") and duration >= 10
    if retry_snapshot:
        patch["snapshot_retried"] = True
    minutes, seconds = divmod(duration, 60)
    stay = f"{minutes}m {seconds}s" if minutes else f"{seconds}s"
    name = visit.camera.name if visit.camera_id else "camera"
    updates: dict[str, Any] = {
        # Merge keys into the stored JSON (the snapshot job writes snapshot keys to the same field concurrently).
        "metadata": RawSQL("COALESCE(metadata, '{}'::jsonb) || %s::jsonb", (json.dumps(patch),)),
        "description": f"On {name} for {stay} ({patch['sightings']} sightings)",
    }
    if confidence and (visit.confidence or 0) < confidence:
        updates["confidence"] = confidence
    JourneyEvent.objects.filter(pk=visit.pk).update(**updates)
    # One snapshot per visit; retry once if the first capture produced nothing (person had left the frame).
    if retry_snapshot:
        from .snapshot_capture import schedule_journey_snapshot

        schedule_journey_snapshot(visit.pk, None, visit.camera_id)


def ingest_track_observation(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Process one tracked person observation from the ML journey pipeline.

    Expected payload keys:
      camera_id, camera_key, track_id, track_status, bbox, confidence,
      face_embedding, reid_embedding, face_label, face_match_score,
      detections (list of extra class detections e.g. weapon),
      snapshot_path, frame_timestamp

    If the camera no longer exists (deleted / not synced), returns ignored=True
    without writing tracks — CameraTrack.camera is NOT NULL.
    """
    camera_id = payload.get("camera_id")
    camera_key = str(payload.get("camera_key") or "").strip()
    track_id = int(payload.get("track_id") or 0)
    track_status = str(payload.get("track_status") or "active").strip().lower()
    bbox = payload.get("bbox") or []
    confidence = float(payload.get("confidence") or 0)
    face_embedding = payload.get("face_embedding") or []
    reid_embedding = payload.get("reid_embedding") or []
    face_label = str(payload.get("face_label") or "").strip()
    face_match_score = payload.get("face_match_score")
    snapshot_path = str(payload.get("snapshot_path") or "").strip()
    now = timezone.now()

    camera = _resolve_camera(camera_id, camera_key)
    if camera is None:
        logger.info(
            "Journey ingest ignored — camera not found (camera_id=%s camera_key=%s track_id=%s)",
            camera_id,
            camera_key,
            track_id,
        )
        return {
            "ignored": True,
            "reason": "camera_not_found",
            "camera_id": camera_id,
            "camera_key": camera_key,
            "track_id": track_id,
        }

    staff_id, staff_name = resolve_staff_from_face_label(face_label)
    visitor_id, visitor_name = (None, "")
    if not staff_id and face_embedding:
        visitor_id, visitor_name, _conf = resolve_visitor_from_embedding(face_embedding)
    if not staff_id and not visitor_id:
        visitor_id, visitor_name = resolve_visitor_from_face_label(face_label)
    if staff_id:
        person_type_hint = PersonType.STAFF
    elif visitor_id:
        person_type_hint = PersonType.VISITOR
    else:
        person_type_hint = PersonType.UNKNOWN

    person: JourneyPerson | None = None
    created_person = False

    if track_id:
        active_track = (
            CameraTrack.objects.filter(
                camera=camera,
                track_id=track_id,
                status=TrackStatus.ACTIVE,
                journey_person__status=PersonStatus.ACTIVE,
            )
            .select_related("journey_person")
            .order_by("-started_at")
            .first()
        )
        stale_after = float(getattr(settings, "JOURNEY_TRACK_STALE_SECONDS", 60))
        last = active_track.last_seen_at or active_track.started_at if active_track else None
        if active_track and last and (now - last).total_seconds() > stale_after:
            # Local ByteTrack ids get reused (ML restart, long gaps): an old track id is a NEW person.
            active_track.status = TrackStatus.FINISHED
            active_track.ended_at = last
            active_track.save(update_fields=["status", "ended_at"])
            active_track = None
        if active_track:
            person = active_track.journey_person

    match = None
    match_detail: dict = {}
    if person is None:
        from .association import find_best_global_match

        matched_person, match_detail = find_best_global_match(
            face_embedding=face_embedding or None,
            reid_embedding=reid_embedding or None,
            camera_id=camera.pk,
            # Search every person type: an unknown track may be a staff member seen earlier by face.
            person_type_hint=None,
            staff_id=staff_id,
            visitor_id=visitor_id,
            track_id=track_id or None,
        )
        person = matched_person if match_detail.get("decision") == "match" else None
        if person is not None:
            for dup_id in match_detail.get("merge_duplicates") or []:
                dup = JourneyPerson.objects.filter(pk=dup_id, status=PersonStatus.ACTIVE).first()
                if dup is not None and dup.person_type == PersonType.UNKNOWN:
                    merge_journey_person(dup, person, reason="same person split earlier (ambiguous ReID)")
            match = type(
                "MatchInfo",
                (),
                {
                    "combined_score": match_detail.get("combined"),
                    "face_score": match_detail.get("face_score"),
                    "reid_score": match_detail.get("reid_score"),
                },
            )()
        # No legacy fallback: an uncertain or ambiguous track gets its own ID rather than someone else's.

    if person is None and staff_id:
        person = JourneyPerson.objects.filter(staff_id=staff_id, status=PersonStatus.ACTIVE).first()
    if person is None and visitor_id:
        person = JourneyPerson.objects.filter(visitor_id=visitor_id, status=PersonStatus.ACTIVE).first()
        if person is None:
            from visitors.models import Visitor

            visitor = Visitor.objects.filter(pk=visitor_id).first()
            if visitor:
                person = register_visitor_journey_person(visitor)

    if person is None:
        if staff_id:
            person_type = PersonType.STAFF
        elif visitor_id:
            person_type = PersonType.VISITOR
        else:
            person_type = PersonType.UNKNOWN
            if not _can_create_unknown_person(
                bbox=bbox,
                confidence=confidence,
                face_embedding=face_embedding or None,
                reid_embedding=reid_embedding or None,
            ):
                logger.info(
                    "Journey ingest ignored — no verified person evidence "
                    "(camera=%s track=%s conf=%.2f bbox=%s face=%s reid=%s)",
                    camera.pk,
                    track_id,
                    confidence,
                    bool(bbox),
                    bool(face_embedding),
                    bool(reid_embedding),
                )
                return {
                    "ignored": True,
                    "reason": "no_person_evidence",
                    "camera_id": camera.pk,
                    "track_id": track_id,
                    "confidence": confidence,
                }
        display = staff_name or visitor_name or face_label or f"Unknown — {track_id}"
        if person_type == PersonType.UNKNOWN:
            display = "Unknown"
        person = create_journey_person(
            person_type=person_type,
            display_name=display,
            staff_id=staff_id,
            visitor_id=visitor_id or None,
            face_embedding=face_embedding or [],
            reid_embedding=reid_embedding or [],
            latest_camera=camera,
            latest_zone=_camera_zone(camera),
            latest_seen_at=now,
            status=PersonStatus.ACTIVE,
            identity_state="new",
        )
        if person_type == PersonType.UNKNOWN:
            person.display_name = f"Unknown — {person.code}"
            person.save(update_fields=["display_name", "updated_at"])
        created_person = True
        from .association import set_identity_state
        from .models import IdentityState

        set_identity_state(person, IdentityState.TRACKING)
        # No separate "created" record: the first camera visit below is the person's first timeline entry.
    else:
        updates: list[str] = ["latest_seen_at", "updated_at", "latest_camera", "latest_zone"]
        person.latest_seen_at = now
        person.latest_camera = camera
        person.latest_zone = _camera_zone(camera)
        if face_embedding and (not person.face_embedding or staff_id):
            person.face_embedding = face_embedding
            updates.append("face_embedding")
        if reid_embedding:
            person.reid_embedding = reid_embedding
            updates.append("reid_embedding")
        name_locked = bool((person.metadata or {}).get("name_locked")) if isinstance(person.metadata, dict) else False
        if staff_id and person.staff_id is None:
            person.staff_id = staff_id
            person.person_type = PersonType.STAFF
            updates.extend(["staff_id", "person_type"])
            if staff_name and not name_locked:
                person.display_name = staff_name
                updates.append("display_name")
        if visitor_id and person.visitor_id is None and person.person_type != PersonType.STAFF:
            person.visitor_id = visitor_id
            person.person_type = PersonType.VISITOR
            updates.extend(["visitor_id", "person_type"])
            if visitor_name and not name_locked:
                person.display_name = visitor_name
                updates.append("display_name")
        person.save(update_fields=list(dict.fromkeys(updates)))

    track = ensure_camera_track(
        person=person,
        camera=camera,
        track_id=track_id or None,
        now=now,
        bbox=bbox,
        track_status=track_status,
        metadata={"camera_key": camera_key or getattr(camera, "stream_key", ""), "source": "journey_pipeline"},
    )
    tracklet_id = track.tracklet_id if track else format_tracklet_id(camera.pk, track_id)

    if track is not None:
        from .association import (
            maybe_record_transition,
            record_tracklet_observation,
            set_identity_state,
        )
        from .models import IdentityState

        record_tracklet_observation(
            track=track,
            person=person,
            bbox=bbox,
            confidence=confidence,
            face_embedding=face_embedding or None,
            reid_embedding=reid_embedding or None,
            snapshot_path=snapshot_path,
            quality=float(confidence or 0.5),
            metadata={"source": "journey_pipeline", "face_label": face_label},
            now=now,
        )
        maybe_record_transition(person=person, to_track=track, scores=match_detail or None)
        if created_person:
            set_identity_state(person, IdentityState.TRACKING)
        elif match_detail.get("decision") == "match":
            set_identity_state(person, IdentityState.CONTINUOUS)
        else:
            set_identity_state(person, IdentityState.TRACKING)

    event_type = JourneyEventType.CAMERA_DETECTION
    title = f"Seen at {camera.name}"
    if staff_id:
        event_type = JourneyEventType.STAFF_RECOGNIZED
        title = f"Recognized: {staff_name}"
    elif visitor_id:
        event_type = JourneyEventType.FACE_MATCHED
        title = f"Visitor: {visitor_name or person.display_name}"
    elif created_person:
        event_type = JourneyEventType.UNKNOWN_CREATED
        title = f"First seen at {camera.name}"

    # One timeline record per camera visit (default): extend while they stay; new row when they leave
    # longer than JOURNEY_VISIT_GAP_SECONDS or appear on another camera. Set JOURNEY_KEEP_ALL_EVENTS=True
    # only if every heartbeat should be its own row.
    keep_all = bool(getattr(settings, "JOURNEY_KEEP_ALL_EVENTS", False))
    create_event = True
    if keep_all:
        dedup_seconds = float(getattr(settings, "PERSON_JOURNEY_INGEST_DEDUP_SECONDS", 3))
        if JourneyEvent.objects.filter(
            journey_person=person,
            camera=camera,
            created_at__gte=now - timedelta(seconds=max(0.5, dedup_seconds)),
            metadata__source="journey_pipeline",
        ).exists():
            create_event = False
    else:
        visit = _open_visit(person, camera, now)
        if visit is not None:
            _extend_visit(visit, now=now, track=track, track_id=track_id, confidence=confidence)
            create_event = False

    if create_event:
        detection_event = JourneyEvent.objects.create(
            journey_person=person,
            event_type=event_type,
            title=title,
            description=(
                f"On {camera.name} (1 sighting)"
                if tracklet_id
                else f"Sighting → {person.code} on {camera.name}"
            ),
            camera=camera,
            zone=_camera_zone(camera),
            track=track,
            confidence=confidence,
            match_score=match.combined_score if match else face_match_score,
            bbox=bbox,
            snapshot_path=snapshot_path,
            metadata={
                "track_id": track_id,
                "tracklet_id": tracklet_id,
                "person_id": person.code,
                "track_status": track_status,
                "face_label": face_label,
                "face_match_score": face_match_score,
                "match_face": match.face_score if match else None,
                "match_reid": match.reid_score if match else None,
                # Why this sighting got this ID: decision, threshold applied, runner-up, gap since last seen.
                "identity": match_detail or None,
                "created_person": created_person,
                "source": "journey_pipeline",
                "visit_start": now.isoformat(),
                "last_seen_at": now.isoformat(),
                "duration_seconds": 0,
                "sightings": 1,
                "track_ids": [track_id] if track_id else [],
            },
        )
        from .snapshot_capture import schedule_journey_snapshot

        schedule_journey_snapshot(detection_event.pk, None, camera.pk)

    return {
        "ignored": False,
        "person_uuid": str(person.uuid),
        "person_id": person.code,
        "person_code": person.code,
        "person_type": person.person_type,
        "display_name": person.display_name,
        "track_id": track_id,
        "tracklet_id": tracklet_id,
        "created_person": created_person,
        "match_score": match.combined_score if match else None,
    }


def _resolve_camera(camera_id: Any, camera_key: str) -> Camera | None:
    """Resolve Camera from ML payload. Prefer pk; fall back to cam-<id> stream key."""
    camera: Camera | None = None
    try:
        if camera_id is not None and str(camera_id).strip() != "":
            camera = Camera.objects.filter(pk=int(camera_id)).first()
    except (TypeError, ValueError):
        camera = None

    if camera is None and camera_key:
        key = camera_key.strip()
        # stream_key format: cam-<pk>
        suffix = key.replace("cam-", "") if key.lower().startswith("cam-") else key
        if suffix.isdigit():
            camera = Camera.objects.filter(pk=int(suffix)).first()
        if camera is None:
            # Rare: match by exact code if ML sent something else
            camera = Camera.objects.filter(code__iexact=key).first()
    return camera


@transaction.atomic
def merge_journey_person(source: JourneyPerson, target: JourneyPerson, *, reason: str = "") -> JourneyPerson:
    """
    Fold ``source`` into ``target`` (same real-world person, duplicate global IDs).

    Moves tracks + events; marks source as merged. Keeps target's PJ-##### code.
    """
    if source.pk == target.pk:
        return target
    if target.status == PersonStatus.MERGED and target.merged_into_id:
        target = target.merged_into

    from .models import PersonObservation, PersonTransition

    CameraTrack.objects.filter(journey_person=source).update(journey_person=target)
    JourneyEvent.objects.filter(journey_person=source).update(journey_person=target)
    # The duplicate's saved embeddings become part of the survivor's gallery (that is what re-identifies them).
    PersonObservation.objects.filter(journey_person=source).update(journey_person=target)
    PersonTransition.objects.filter(journey_person=source).update(journey_person=target)

    updates = ["status", "merged_into", "updated_at"]
    source.status = PersonStatus.MERGED
    source.merged_into = target
    source.save(update_fields=updates)

    # Prefer non-empty embeddings / display on the survivor
    t_updates: list[str] = ["updated_at", "metadata"]
    history = list((target.metadata or {}).get("merged_from") or [])
    history.append({"code": source.code, "reason": reason, "at": timezone.now().isoformat()})
    target.metadata = {**(target.metadata or {}), "merged_from": history[-50:]}
    if (not target.reid_embedding) and source.reid_embedding:
        target.reid_embedding = source.reid_embedding
        t_updates.append("reid_embedding")
    if (not target.face_embedding) and source.face_embedding:
        target.face_embedding = source.face_embedding
        t_updates.append("face_embedding")
    if source.latest_seen_at and (
        not target.latest_seen_at or source.latest_seen_at > target.latest_seen_at
    ):
        target.latest_seen_at = source.latest_seen_at
        target.latest_camera = source.latest_camera
        target.latest_zone = source.latest_zone
        t_updates.extend(["latest_seen_at", "latest_camera", "latest_zone"])
    target.save(update_fields=list(dict.fromkeys(t_updates)))
    # Merge history lives on target.metadata["merged_from"] — not as extra timeline records.
    # Do not fold/delete timeline logs when keeping all events.
    if not bool(getattr(settings, "JOURNEY_KEEP_ALL_EVENTS", False)):
        collapse_visits(target)
    return target


def collapse_visits(person: JourneyPerson) -> int:
    """
    Rebuild a person's timeline as one record per camera visit: consecutive/overlapping visit records on the
    same camera become one; only the very first record says "First seen".
    Disabled when JOURNEY_KEEP_ALL_EVENTS is True.
    """
    if bool(getattr(settings, "JOURNEY_KEEP_ALL_EVENTS", False)):
        return 0
    gap = float(getattr(settings, "JOURNEY_VISIT_GAP_SECONDS", 120))
    camera_event_types = [
        JourneyEventType.CAMERA_DETECTION,
        JourneyEventType.STAFF_RECOGNIZED,
        JourneyEventType.FACE_MATCHED,
        JourneyEventType.UNKNOWN_CREATED,
    ]
    visits = list(
        JourneyEvent.objects.filter(journey_person=person, event_type__in=camera_event_types)
        .select_related("camera")
        .order_by("created_at")
    )
    folded = 0
    open_by_camera: dict[int, tuple[JourneyEvent, Any]] = {}
    last_camera_switch: dict[int, Any] = {}
    for i, ev in enumerate(visits):
        start, end = ev.created_at, _visit_last_seen(ev)
        current = open_by_camera.get(ev.camera_id)
        if current is not None:
            keep, keep_end = current
            left_for_other = last_camera_switch.get(ev.camera_id)
            continuous = (start - keep_end).total_seconds() <= gap and not (left_for_other and left_for_other > keep_end)
            if start <= keep_end or continuous:
                meta = dict(keep.metadata or {})
                new_end = max(keep_end, end)
                meta["last_seen_at"] = new_end.isoformat()
                meta["duration_seconds"] = int((new_end - keep.created_at).total_seconds())
                meta["sightings"] = int(meta.get("sightings") or 1) + int((ev.metadata or {}).get("sightings") or 1)
                meta["track_ids"] = list(dict.fromkeys([*(meta.get("track_ids") or []), *((ev.metadata or {}).get("track_ids") or [])]))[-20:]
                keep.metadata = meta
                if not keep.snapshot_path and ev.snapshot_path:
                    keep.snapshot_path = ev.snapshot_path
                minutes, seconds = divmod(meta["duration_seconds"], 60)
                stay = f"{minutes}m {seconds}s" if minutes else f"{seconds}s"
                keep.description = f"On {keep.camera.name if keep.camera_id else 'camera'} for {stay} ({meta['sightings']} sightings)"
                keep.save(update_fields=["metadata", "snapshot_path", "description"])
                ev.delete()
                folded += 1
                open_by_camera[ev.camera_id] = (keep, new_end)
                continue
        open_by_camera[ev.camera_id] = (ev, end)
        for cam in open_by_camera:
            if cam != ev.camera_id:
                last_camera_switch[cam] = start
    # Titles: "First seen" only on the earliest remaining visit.
    remaining = list(
        JourneyEvent.objects.filter(journey_person=person, event_type__in=camera_event_types)
        .select_related("camera")
        .order_by("created_at")
    )
    for n, ev in enumerate(remaining):
        name = ev.camera.name if ev.camera_id else "camera"
        if ev.event_type in (JourneyEventType.UNKNOWN_CREATED, JourneyEventType.CAMERA_DETECTION):
            want_type = JourneyEventType.UNKNOWN_CREATED if n == 0 else JourneyEventType.CAMERA_DETECTION
            want_title = f"First seen at {name}" if n == 0 else f"Seen at {name}"
            if ev.event_type != want_type or ev.title != want_title:
                JourneyEvent.objects.filter(pk=ev.pk).update(event_type=want_type, title=want_title)
    return folded


def try_merge_unknown_duplicates(person: JourneyPerson) -> JourneyPerson:
    """
    Merge this unknown into an earlier person only when the calibrated engine is confident
    (fixes Cam1→PJ-A and Cam2→PJ-B for one individual) — never two people who were on camera together.
    """
    from .identity import identify, persons_were_simultaneous

    if person.person_type != PersonType.UNKNOWN or person.status != PersonStatus.ACTIVE:
        return person
    if not person.reid_embedding and not person.face_embedding:
        return person
    result = identify(
        face_embedding=person.face_embedding or None,
        reid_embedding=person.reid_embedding or None,
        camera_id=person.latest_camera_id,
        exclude_person_ids={person.pk},
    )
    other = result.person
    if result.decision != "match" or other is None or persons_were_simultaneous(person.pk, other.pk):
        return person
    target, source = (person, other) if (person.created_at, person.pk) < (other.created_at, other.pk) else (other, person)
    return merge_journey_person(
        source,
        target,
        reason=f"{result.reason} similarity {max(result.face_score, result.reid_score):.3f}",
    )


@transaction.atomic
def merge_person_to_visitor(
    person_uuid: str,
    visitor_id: int,
    *,
    face_match_score: float | None = None,
) -> JourneyPerson | None:
    """Step 15 — link unknown journey person to a registered visitor."""
    from visitors.models import Visitor

    person = JourneyPerson.objects.filter(uuid=person_uuid).select_for_update().first()
    if person is None:
        return None
    visitor = Visitor.objects.filter(pk=visitor_id).first()
    if visitor is None:
        return None

    old_code = person.code
    person.visitor_id = visitor.pk
    person.person_type = PersonType.VISITOR
    person.display_name = visitor.full_name
    # Keep global PJ-##### id — type change does not rewrite person identity.
    person.save(update_fields=["visitor_id", "person_type", "display_name", "updated_at"])

    JourneyEvent.objects.create(
        journey_person=person,
        event_type=JourneyEventType.PERSON_MERGED,
        title=f"Linked to visitor {visitor.full_name}",
        description=f"Person {old_code} linked to visitor record #{visitor.pk}",
        confidence=face_match_score,
        match_score=face_match_score,
        metadata={"previous_code": old_code, "person_id": person.code, "visitor_id": visitor.pk},
    )
    return person


@transaction.atomic
def register_staff_journey_person(staff) -> JourneyPerson:
    """Ensure a staff member has a journey person registry entry (global PJ- id)."""
    existing = JourneyPerson.objects.filter(staff_id=staff.pk, status=PersonStatus.ACTIVE).first()
    if existing:
        return existing

    face_emb = []
    if isinstance(staff.face_embedding, list):
        face_emb = staff.face_embedding

    return create_journey_person(
        person_type=PersonType.STAFF,
        display_name=staff.full_name or "",
        staff_id=staff.pk,
        face_embedding=face_emb,
        status=PersonStatus.ACTIVE,
    )


@transaction.atomic
def register_visitor_journey_person(visitor) -> JourneyPerson:
    """Ensure a registered visitor has a journey person entry (global PJ- id)."""
    existing = JourneyPerson.objects.filter(visitor_id=visitor.pk, status=PersonStatus.ACTIVE).first()
    if existing:
        return existing
    return create_journey_person(
        person_type=PersonType.VISITOR,
        display_name=visitor.full_name or "",
        visitor_id=visitor.pk,
        status=PersonStatus.ACTIVE,
    )
