"""Persist ML detection readings with light deduplication."""

from __future__ import annotations

import logging
import os
import threading
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from .clip_capture import schedule_attendance_snapshot, schedule_detection_clip
from .models import Camera, CameraPurpose, ClipStatus, DetectionEvent

logger = logging.getLogger(__name__)

DEFAULT_MIN_CONFIDENCE = 0.45
_GENERIC_EMPLOYEE_LABELS = frozenset({"unknown", "person", "face", ""})
_ANPR_CLASS_NAMES = frozenset(
    {
        "car",
        "truck",
        "bus",
        "motorcycle",
        "bicycle",
        "vehicle",
        "license plate",
        "license_plate",
        "number plate",
        "number_plate",
        "plate",
    }
)
_VEHICLE_CLASS_NAMES = frozenset({"car", "truck", "bus", "motorcycle", "vehicle"})
_SMOKE_FIRE_NAMES = frozenset({"smoke", "fire", "flame", "burning"})
_WEAPON_NAMES = frozenset(
    {
        "weapon",
        "gun",
        "pistol",
        "rifle",
        "firearm",
        "knife",
        "knife_weapon",
        "sword",
        "machete",
        "heavy-weapon",
    }
)
# Must match ml_services/inference_engine.py ALLOWED_COCO_CLASS_NAMES (yolo26l allowlist).
# Extra COCO classes are dropped at ML inference; this is a safety net when saving events.
_ALLOWED_COCO_CLASS_NAMES = frozenset(
    {
        # High priority
        "person",
        "car",
        "truck",
        "bus",
        "motorcycle",
        "backpack",
        "handbag",
        "suitcase",
        "cell phone",
        "laptop",
        "knife",
        # Medium priority
        "bicycle",
        "bench",
        "chair",
        "dining table",
        "bottle",
    }
)
_SPECIALIST_MODEL_TAGS = frozenset({"custom", "smoke", "weapon", "plate"})

# Crowd alert state: camera_id → currently in a crowd episode (above threshold).
_crowd_active: dict[int, bool] = {}
_crowd_lock = threading.Lock()

# Specialist / class alerts (fire, smoke, weapon, …): (camera_id, alert_key) → active.
_alert_active: dict[tuple[int, str], bool] = {}
_alert_lock = threading.Lock()


def _coco_max_class_id() -> int:
    try:
        return int(os.getenv("ML_COCO_MAX_CLASS_ID", "79"))
    except (TypeError, ValueError):
        return 79


def _model_tag(det: dict[str, Any]) -> str:
    return str(det.get("model_tag") or det.get("model") or "").strip().lower()


def is_coco_detection(det: dict[str, Any]) -> bool:
    """True for generic COCO model hits — not custom / smoke / weapon specialists."""
    tag = _model_tag(det)
    if tag in _SPECIALIST_MODEL_TAGS:
        return False
    if tag == "coco":
        return True
    try:
        cls_id = int(det.get("class_id", -1))
    except (TypeError, ValueError):
        cls_id = -1
    return 0 <= cls_id <= _coco_max_class_id()


def is_allowed_coco_class(det: dict[str, Any]) -> bool:
    """True when a COCO detection is in the high/medium priority allowlist."""
    cls = str(det.get("class_name") or det.get("label") or "").strip().lower()
    return cls in _ALLOWED_COCO_CLASS_NAMES


def filter_detections_for_camera(camera: Camera, detections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep only detections for models selected on this camera (strict 1:1)."""
    purposes = set(camera.purpose_list())
    kept: list[dict[str, Any]] = []
    seen: set[int] = set()

    for idx, det in enumerate(detections or []):
        if det.get("alert"):
            # Alerts still must match a selected specialist model
            tag = _model_tag(det)
            cls = str(det.get("class_name") or det.get("label") or "").strip().lower()
            if CameraPurpose.SMOKE_FIRE in purposes and (tag == "smoke" or cls in _SMOKE_FIRE_NAMES):
                kept.append(det)
                seen.add(idx)
            elif CameraPurpose.WEAPON in purposes and (tag == "weapon" or cls in _WEAPON_NAMES):
                kept.append(det)
                seen.add(idx)
            elif CameraPurpose.ANPR in purposes and (tag == "plate" or cls in _ANPR_CLASS_NAMES):
                kept.append(det)
                seen.add(idx)
            continue

        cls = str(det.get("class_name") or det.get("label") or "").strip().lower()
        tag = _model_tag(det)
        keep = False

        if CameraPurpose.GENERAL_OBJECTS in purposes:
            if (
                is_coco_detection(det)
                and is_allowed_coco_class(det)
                and cls not in _VEHICLE_CLASS_NAMES
            ):
                keep = True

        if CameraPurpose.CUSTOM_OBJECTS in purposes and tag == "custom":
            keep = True

        if CameraPurpose.SMOKE_FIRE in purposes and (
            tag == "smoke" or cls in _SMOKE_FIRE_NAMES
        ):
            keep = True

        if CameraPurpose.WEAPON in purposes and (
            tag == "weapon" or cls in _WEAPON_NAMES
        ):
            keep = True

        if purposes & {CameraPurpose.FACE_RECOGNITION, CameraPurpose.ATTENDANCE}:
            if cls in ("person", "face"):
                keep = True

        if CameraPurpose.ANPR in purposes:
            if tag == "plate" and not det.get("accepted", False):
                pass
            elif cls in _ANPR_CLASS_NAMES or tag == "plate":
                keep = True

        if keep and idx not in seen:
            kept.append(det)
            seen.add(idx)

    return kept


def resolve_employee_name(label: str, class_name: str) -> str:
    """Map ML face-recognition label to employee_name for person/face detections."""
    employee_name, _ = resolve_staff_identity(label, class_name)
    return employee_name


def resolve_staff_identity(label: str, class_name: str) -> tuple[str, str]:
    """Return (employee_name, personal_number) for recognized person/face detections."""
    lbl = (label or "").strip()
    cls = (class_name or "").strip().lower()
    if cls not in ("person", "face") or lbl.lower() in _GENERIC_EMPLOYEE_LABELS:
        return "", ""

    from users.models import Staff

    staff = (
        Staff.objects.filter(
            Q(face_identity_label__iexact=lbl)
            | Q(user__username__iexact=lbl)
            | Q(full_name__iexact=lbl)
        )
        .select_related("user")
        .first()
    )

    if staff is None:
        return lbl[:150], ""

    employee_name = (staff.full_name or lbl).strip()[:150]
    personal_number = (staff.personal_number or "").strip()[:50]
    return employee_name, personal_number


def _dedup_seconds() -> int:
    raw = getattr(settings, "DETECTION_DEDUP_SECONDS", 5)
    try:
        return max(0, int(raw))
    except (TypeError, ValueError):
        return 5


def _crowd_threshold() -> int:
    try:
        return max(1, int(getattr(settings, "CROWD_ALERT_THRESHOLD", 10)))
    except (TypeError, ValueError):
        return 10


def _crowd_min_confidence() -> float:
    try:
        return float(getattr(settings, "CROWD_ALERT_MIN_CONFIDENCE", 0.25))
    except (TypeError, ValueError):
        return 0.25


def _alert_min_confidence() -> float:
    try:
        return float(getattr(settings, "ALERT_EPISODE_MIN_CONFIDENCE", 0.25))
    except (TypeError, ValueError):
        return 0.25


def count_persons(detections: list[dict[str, Any]], *, min_confidence: float | None = None) -> int:
    """Count YOLO person boxes (class_name=person). Faces are ignored to avoid double-counting."""
    conf_floor = _crowd_min_confidence() if min_confidence is None else float(min_confidence)
    total = 0
    for det in detections or []:
        cls = str(det.get("class_name") or "").strip().lower()
        if cls != "person":
            continue
        try:
            confidence = float(det.get("confidence", 0))
        except (TypeError, ValueError):
            continue
        if confidence < conf_floor:
            continue
        total += 1
    return total


def _classify_alert_key(det: dict[str, Any]) -> str | None:
    """Map a detection to an episode alert key, or None if not an alert class.

    Only covers specialist fire/smoke/weapon (excluded from identity saves) and
    other detections already flagged alert from custom/smoke/weapon models —
    so existing COCO object saves (e.g. knife) stay unchanged.
    """
    cls = str(det.get("class_name") or det.get("label") or "").strip().lower()
    tag = _model_tag(det)

    if tag == "smoke" or cls in _SMOKE_FIRE_NAMES or "fire" in cls or "smoke" in cls or "flame" in cls:
        if cls == "smoke" or "smoke" in cls:
            return "smoke"
        return "fire"

    if tag == "weapon" or cls in {"weapon", "gun", "pistol", "rifle", "firearm", "knife_weapon", "heavy-weapon"}:
        return "weapon"

    # Custom-model alert flags (not COCO identity path)
    if bool(det.get("alert")) and tag in ("custom", "smoke", "weapon"):
        if cls and cls not in ("person", "face", "crowd"):
            return f"alert:{cls[:40]}"
    return None


def _create_alert_detection_event(
    camera: Camera,
    *,
    class_name: str,
    label: str,
    confidence: float,
    bbox: list[Any] | None = None,
    track_event: str = "alert",
) -> DetectionEvent:
    clip_enabled = bool(getattr(settings, "DETECTION_CLIP_ENABLED", True))
    event = DetectionEvent.objects.create(
        camera=camera,
        class_name=class_name[:80],
        label=label[:120],
        employee_name="",
        personal_number="",
        confidence=float(confidence),
        bbox=bbox or [],
        is_alert=True,
        clip_status=ClipStatus.PENDING if clip_enabled else ClipStatus.SKIPPED,
        track_event=track_event[:16],
    )
    if clip_enabled:
        schedule_detection_clip(camera.pk, event.pk)
    try:
        from realtime.sio_app import emit_invalidate

        emit_invalidate(["cameras", "detections", "alerts"], throttle_sec=0.5)
    except Exception:
        logger.debug("Alert realtime emit failed", exc_info=True)
    return event


def maybe_emit_crowd_alert(camera: Camera, detections: list[dict[str, Any]]) -> int:
    """Create one Crowd DetectionEvent + realtime notify when person_count > threshold.

    State machine (per camera):
      > threshold and not active → SAVE + notify, mark active
      > threshold and active     → no-op (same crowd episode)
      ≤ threshold and active     → clear episode (no row)
      ≤ threshold and not active → no-op

    Next time count goes above threshold again → SAVE + notify again.
    """
    if not bool(getattr(settings, "CROWD_ALERT_ENABLED", True)):
        return 0

    threshold = _crowd_threshold()
    person_count = count_persons(detections)
    cam_id = int(camera.pk)
    should_create = False

    with _crowd_lock:
        active = bool(_crowd_active.get(cam_id, False))
        if person_count > threshold:
            if not active:
                _crowd_active[cam_id] = True
                should_create = True
        elif active:
            _crowd_active[cam_id] = False
            logger.info(
                "Crowd cleared camera=%s name=%s zone=%s people=%s threshold=%s",
                cam_id,
                camera.name,
                camera.zone or "",
                person_count,
                threshold,
            )

    if not should_create:
        return 0

    zone = (camera.zone or "").strip() or "—"
    cam_name = (camera.name or camera.code or f"cam-{cam_id}").strip()
    label = f"Crowd Detected: {person_count} people @ {cam_name} / {zone}"[:120]

    event = _create_alert_detection_event(
        camera,
        class_name="crowd",
        label=label,
        confidence=1.0,
        bbox=[],
        track_event="crowd",
    )

    logger.warning(
        "Crowd alert saved event=%s camera=%s zone=%s people=%s threshold=%s",
        event.pk,
        cam_name,
        zone,
        person_count,
        threshold,
    )
    return 1


def maybe_emit_specialist_alerts(camera: Camera, detections: list[dict[str, Any]]) -> int:
    """Same episode technique as crowd for fire / smoke / weapon / other alert flags.

    Does not change the normal person/object save loop. Smoke & weapon stay excluded
    from ReID identity capture; this only writes one alert DetectionEvent per episode.
    """
    if not bool(getattr(settings, "ALERT_EPISODE_ENABLED", True)):
        return 0

    conf_floor = _alert_min_confidence()
    cam_id = int(camera.pk)
    zone = (camera.zone or "").strip() or "—"
    cam_name = (camera.name or camera.code or f"cam-{cam_id}").strip()

    # Best detection per alert key this frame (highest confidence).
    present: dict[str, dict[str, Any]] = {}
    for det in detections or []:
        key = _classify_alert_key(det)
        if not key:
            continue
        try:
            confidence = float(det.get("confidence", 0))
        except (TypeError, ValueError):
            continue
        if confidence < conf_floor:
            continue
        prev = present.get(key)
        if prev is None or confidence >= float(prev.get("confidence") or 0):
            present[key] = det

    saved = 0
    # Keys that were active but are gone this frame → clear episode.
    with _alert_lock:
        previously_active = [k for (cid, k), on in _alert_active.items() if cid == cam_id and on]

    for key in previously_active:
        if key in present:
            continue
        with _alert_lock:
            _alert_active[(cam_id, key)] = False
        logger.info(
            "Alert cleared key=%s camera=%s name=%s zone=%s",
            key,
            cam_id,
            cam_name,
            zone,
        )

    for key, det in present.items():
        should_create = False
        with _alert_lock:
            state_key = (cam_id, key)
            if not _alert_active.get(state_key, False):
                _alert_active[state_key] = True
                should_create = True
        if not should_create:
            continue

        cls = str(det.get("class_name") or det.get("label") or key).strip() or key
        try:
            confidence = float(det.get("confidence", 0))
        except (TypeError, ValueError):
            confidence = 0.0
        title = {
            "fire": "Fire Detected",
            "smoke": "Smoke Detected",
            "weapon": "Weapon Detected",
        }.get(key, f"Alert: {cls}")
        label = f"{title} @ {cam_name} / {zone}"[:120]
        class_name = {
            "fire": "fire",
            "smoke": "smoke",
            "weapon": "weapon",
        }.get(key, cls[:80])

        event = _create_alert_detection_event(
            camera,
            class_name=class_name,
            label=label,
            confidence=confidence,
            bbox=det.get("bbox") or [],
            track_event="alert",
        )
        logger.warning(
            "Alert saved key=%s event=%s camera=%s zone=%s conf=%.3f",
            key,
            event.pk,
            cam_name,
            zone,
            confidence,
        )
        saved += 1

    return saved


def evaluate_camera_alerts(camera: Camera, detections: list[dict[str, Any]]) -> int:
    """Run all episode-based alerts (crowd + fire/smoke/weapon). Additive only."""
    total = 0
    try:
        total += maybe_emit_crowd_alert(camera, detections)
    except Exception:
        logger.exception("Crowd alert evaluation failed for camera %s", camera.pk)
    try:
        total += maybe_emit_specialist_alerts(camera, detections)
    except Exception:
        logger.exception("Specialist alert evaluation failed for camera %s", camera.pk)
    return total


def save_detection_batch(
    camera: Camera,
    detections: list[dict[str, Any]],
    *,
    min_confidence: float = DEFAULT_MIN_CONFIDENCE,
    dedup_seconds: int | None = None,
) -> int:
    """Save detections from a live ML poll. Returns number of new rows created.

    Uses ByteTrack local track id + ReID global object id so the same object is
    captured once (smoke/fire/weapon are excluded from this identity flow).
    """
    detections = filter_detections_for_camera(camera, detections or [])

    alert_saved = evaluate_camera_alerts(camera, detections)

    if not detections:
        return alert_saved

    from object_tracking.services import (
        finalize_missing_tracks,
        finalize_stale_visits_globally,
        is_excluded_detection,
        mark_detection_captured,
        upsert_global_object,
    )

    dedup_window = _dedup_seconds() if dedup_seconds is None else max(0, dedup_seconds)
    since = timezone.now() - timedelta(seconds=max(1, dedup_window)) if dedup_window > 0 else None
    saved = alert_saved
    active_track_ids: set[int] = set()

    for det in detections:
        if is_excluded_detection(det):
            continue

        label = str(det.get("label") or det.get("class_name") or "").strip()
        class_name = str(det.get("class_name") or label or "object").strip()
        if not label:
            continue
        try:
            confidence = float(det.get("confidence", 0))
        except (TypeError, ValueError):
            continue
        if confidence < min_confidence:
            continue

        track_id = det.get("track_id")
        try:
            track_id_i = int(track_id) if track_id is not None else None
        except (TypeError, ValueError):
            track_id_i = None
        if track_id_i is not None:
            active_track_ids.add(track_id_i)

        clip_enabled = bool(getattr(settings, "DETECTION_CLIP_ENABLED", True))
        employee_name, personal_number = resolve_staff_identity(label, class_name)

        from users.attendance_service import try_mark_attendance_from_detection

        try:
            action, attendance_record = try_mark_attendance_from_detection(
                camera, label, class_name, confidence
            )
            if action in ("check_in", "check_out") and attendance_record is not None:
                logger.info(
                    "Attendance %s via camera %s for %s",
                    action,
                    camera.code,
                    employee_name or label,
                )
                schedule_attendance_snapshot(
                    camera.pk,
                    attendance_record.pk,
                    label=label,
                    employee_name=employee_name,
                    class_name=class_name,
                    bbox=det.get("bbox") or [],
                    confidence=confidence,
                    action=action,
                    infer_frame_w=int(det.get("frame_width") or 0),
                    infer_frame_h=int(det.get("frame_height") or 0),
                )
        except Exception:
            logger.exception("Attendance mark failed for camera %s", camera.pk)

        global_obj = None
        visit = None
        should_capture = False
        try:
            global_obj, visit, should_capture = upsert_global_object(camera, det)
        except Exception:
            logger.exception("Global object upsert failed for camera %s", camera.pk)
            should_capture = False

        if not should_capture:
            continue

        # Fallback short-window dedupe when tracker/ReID did not assign an identity yet
        if global_obj is None and since is not None and DetectionEvent.objects.filter(
            camera=camera,
            label=label,
            class_name=class_name,
            created_at__gte=since,
        ).exists():
            continue

        if track_id_i is not None and visit is None and DetectionEvent.objects.filter(
            camera=camera,
            local_track_id=track_id_i,
            class_name=class_name[:80],
        ).exists():
            continue

        global_code = (global_obj.code if global_obj is not None else str(det.get("global_object_id") or ""))[:32]

        try:
            infer_w = int(det.get("frame_width") or 0) or None
        except (TypeError, ValueError):
            infer_w = None
        try:
            infer_h = int(det.get("frame_height") or 0) or None
        except (TypeError, ValueError):
            infer_h = None

        event = DetectionEvent.objects.create(
            camera=camera,
            class_name=class_name[:80],
            label=label[:120],
            employee_name=employee_name,
            personal_number=personal_number,
            confidence=confidence,
            bbox=det.get("bbox") or [],
            infer_frame_width=infer_w,
            infer_frame_height=infer_h,
            is_alert=bool(det.get("alert")),
            clip_status=ClipStatus.PENDING if clip_enabled else ClipStatus.SKIPPED,
            local_track_id=track_id_i,
            person_qr=global_code,
            track_event="enter",
        )
        if global_obj is not None:
            try:
                mark_detection_captured(global_obj, event.pk, visit=visit)
            except Exception:
                logger.exception("Failed to mark global object %s captured", global_obj.code)
        schedule_detection_clip(camera.pk, event.pk)
        saved += 1

    try:
        finalize_missing_tracks(camera, active_track_ids)
        finalize_stale_visits_globally(limit=50)
    except Exception:
        logger.exception("Failed to finalize exited object tracks for camera %s", camera.pk)

    return saved
