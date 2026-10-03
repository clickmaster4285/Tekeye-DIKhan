"""Capture person-crop snapshots for journey tracking (unknowns, visitors, staff)."""

from __future__ import annotations

import logging
import threading
from collections import deque

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import close_old_connections, connection, transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

_crop_queue: deque[int] = deque()
_crop_queued: set[int] = set()
_crop_guard = threading.Lock()
_crop_workers = 0


def _max_crop_workers() -> int:
    return max(1, min(4, int(getattr(settings, "JOURNEY_SNAPSHOT_MAX_WORKERS", 1))))


def _max_crop_queue() -> int:
    return max(10, int(getattr(settings, "JOURNEY_SNAPSHOT_MAX_QUEUE", 40)))


def _snapshot_task_timeout_sec() -> float:
    return max(5.0, float(getattr(settings, "JOURNEY_SNAPSHOT_TASK_TIMEOUT_SEC", 30)))


_SNAPSHOT_KIND_CROP = "person_crop"


def _release_db() -> None:
    try:
        connection.close()
    except Exception:
        pass


def _ensure_db_connection() -> None:
    close_old_connections()


def _journey_jpeg_quality() -> int:
    return max(95, min(100, int(getattr(settings, "JOURNEY_SNAPSHOT_JPEG_QUALITY", 98))))


def _keep_full_frame() -> bool:
    """Keep an annotated full-scene JPEG in metadata (UI still shows the person crop)."""
    return bool(getattr(settings, "JOURNEY_SNAPSHOT_FULL_FRAME", True))


def _crop_min_side() -> int:
    return max(480, int(getattr(settings, "JOURNEY_SNAPSHOT_CROP_MIN_SIDE", 720)))


def _crop_max_side() -> int:
    return max(_crop_min_side(), int(getattr(settings, "JOURNEY_SNAPSHOT_CROP_MAX_SIDE", 1600)))


def link_detection_clip_to_journey(detection_event_id: int, clip_url: str) -> int:
    """Legacy hook — only fill journey rows that still have no dedicated snapshot."""
    url = (clip_url or "").strip()
    if not detection_event_id or not url:
        return 0
    from .models import JourneyEvent

    return JourneyEvent.objects.filter(
        detection_event_id=detection_event_id,
        snapshot_path="",
    ).update(snapshot_path=url)


def _event_metadata(journey_event) -> dict:
    meta = journey_event.metadata
    return dict(meta) if isinstance(meta, dict) else {}


def _is_person_crop(journey_event) -> bool:
    kind = _event_metadata(journey_event).get("snapshot_kind")
    return kind in (_SNAPSHOT_KIND_CROP, "full_frame")


def _crop_looks_empty(crop) -> bool:
    """True when crop is mostly flat (ground/sky) with no person-like content."""
    import cv2
    import numpy as np

    if crop is None or getattr(crop, "size", 0) == 0:
        return True
    h, w = crop.shape[:2]
    if h < 24 or w < 16:
        return True
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if len(crop.shape) == 3 else crop
    edges = cv2.Canny(gray, 40, 120)
    edge_ratio = float(np.count_nonzero(edges)) / float(gray.size)
    std = float(np.std(gray))
    return edge_ratio < 0.012 and std < 28.0


def _needs_snapshot_recapture(journey_event) -> bool:
    meta = _event_metadata(journey_event)
    if meta.get("empty_crop") or meta.get("force_recapture"):
        return True
    # Force upgrade from old person_crop to full labeled frame
    if meta.get("snapshot_kind") == _SNAPSHOT_KIND_CROP:
        return True
    if meta.get("snapshot_kind") == "full_frame" and not meta.get("person_labeled"):
        return True
    return False


def _media_url_to_storage_name(url: str) -> str:
    raw = (url or "").strip().split("?", 1)[0]
    if not raw:
        return ""
    marker = "/media/"
    if marker in raw:
        return raw.split(marker, 1)[1].lstrip("/")
    if raw.startswith("media/"):
        return raw[6:].lstrip("/")
    return raw.lstrip("/")


def _read_frame_from_storage(url_or_name: str):
    import cv2
    import numpy as np

    name = _media_url_to_storage_name(url_or_name)
    if not name:
        return None
    try:
        if not default_storage.exists(name):
            return None
        with default_storage.open(name, "rb") as handle:
            data = handle.read()
        arr = np.frombuffer(data, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return frame
    except Exception:
        logger.debug("Could not load snapshot %s", name, exc_info=True)
        return None


def _read_detection_clip_frame(detection):
    if detection is None or not getattr(detection, "clip", None):
        return None
    try:
        name = detection.clip.name or ""
        if name:
            frame = _read_frame_from_storage(name)
            if frame is not None:
                return frame
        url = detection.clip.url or ""
        if url:
            return _read_frame_from_storage(url)
    except Exception:
        logger.debug("Could not load detection clip", exc_info=True)
    return None


def _resolve_crop_box(
    bbox,
    frame_w: int,
    frame_h: int,
    camera,
    detection,
    *,
    allow_live_infer: bool = False,
) -> list[int] | None:
    """Map detection bbox to captured frame coordinates."""
    from cameras.clip_capture import _fit_bbox_to_frame, _map_bbox_to_capture_frame

    if not bbox or len(bbox) < 4:
        return None

    try:
        x2 = float(bbox[2])
        y2 = float(bbox[3])
    except (TypeError, ValueError):
        return None

    infer_w = infer_h = 0
    if detection is not None:
        meta = getattr(detection, "metadata", None) or {}
        if isinstance(meta, dict):
            infer_w = int(meta.get("frame_width") or 0)
            infer_h = int(meta.get("frame_height") or 0)
        if infer_w <= 0 or infer_h <= 0:
            try:
                infer_w = int(getattr(detection, "infer_frame_width", 0) or 0)
                infer_h = int(getattr(detection, "infer_frame_height", 0) or 0)
            except (TypeError, ValueError):
                pass

    if infer_w <= 0 or infer_h <= 0:
        try:
            from ml.client import ml_live_detections_for_camera, ml_service_enabled

            if allow_live_infer and camera and getattr(camera, "ml_server_id", None) and ml_service_enabled():
                payload = ml_live_detections_for_camera(camera)
                infer_w = int(payload.get("frame_width") or 0)
                infer_h = int(payload.get("frame_height") or 0)
        except Exception:
            pass

    if infer_w > 0 and infer_h > 0 and (abs(infer_w - frame_w) > 8 or abs(infer_h - frame_h) > 8):
        return _map_bbox_to_capture_frame(bbox, infer_w, infer_h, frame_w, frame_h)

    if x2 > frame_w or y2 > frame_h:
        if infer_w <= 0 or infer_h <= 0:
            infer_w = max(int(x2 * 1.05), frame_w)
            infer_h = max(int(y2 * 1.05), frame_h)
        return _map_bbox_to_capture_frame(bbox, infer_w, infer_h, frame_w, frame_h)

    return _fit_bbox_to_frame(bbox, frame_w, frame_h)


def _person_label(journey_event) -> str:
    """Clear human-readable label: PJ-00042 · Name (optionally with tracklet)."""
    person = journey_event.journey_person
    meta = journey_event.metadata if isinstance(journey_event.metadata, dict) else {}
    code = (person.code or "").strip() if person else ""
    name = ""
    if person:
        name = (person.display_name or "").strip()
    if not name or name.lower() in {"unknown", "person", "face"}:
        face_label = str(meta.get("face_label") or meta.get("label") or "").strip()
        if face_label and face_label.lower() not in {"unknown", "person", "face", ""}:
            name = face_label
    if name and code and name.lower().startswith("unknown"):
        # Prefer "Unknown — PJ-00042" style already on display_name; keep code primary
        name = ""
    tracklet = ""
    if journey_event.track_id and getattr(journey_event, "track", None):
        tracklet = (journey_event.track.tracklet_id or "").strip()
    if not tracklet:
        tracklet = str(meta.get("tracklet_id") or "").strip()

    parts: list[str] = []
    if code:
        parts.append(code)
    if name and (not code or code.lower() not in name.lower()):
        parts.append(name)
    label = " · ".join(parts) if parts else "Person"
    if tracklet and tracklet not in label:
        label = f"{label}  [{tracklet}]"
    return label[:96]


def _extract_person_crop(frame, crop_box: list[int] | None):
    """Tight person crop used for ReID embedding."""
    if crop_box is None:
        return None
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = crop_box
    pad = int(0.08 * max(x2 - x1, y2 - y1, 1))
    x1 = max(0, x1 - pad)
    y1 = max(0, y1 - pad)
    x2 = min(w, x2 + pad)
    y2 = min(h, y2 + pad)
    if x2 <= x1 or y2 <= y1:
        return None
    return frame[y1:y2, x1:x2].copy()


def _extract_display_crop(frame, crop_box: list[int] | None, *, min_side: int = 24):
    """
    Full-body person crop for the UI.

    Generous padding so head-to-toe stays visible, then upscaled for clarity.
    """
    import cv2

    if crop_box is None or frame is None:
        return None
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in crop_box]
    box_w = max(x2 - x1, 1)
    box_h = max(y2 - y1, 1)
    # Full person: wide side padding + headroom + feet room
    pad_x = int(0.35 * box_w)
    pad_top = int(0.40 * box_h)
    pad_bottom = int(0.28 * box_h)
    x1 = max(0, x1 - pad_x)
    y1 = max(0, y1 - pad_top)
    x2 = min(w, x2 + pad_x)
    y2 = min(h, y2 + pad_bottom)
    if x2 - x1 < min_side or y2 - y1 < min_side:
        return None
    crop = frame[y1:y2, x1:x2].copy()
    ch, cw = crop.shape[:2]
    # Upscale small crops so the person stays sharp in the UI
    target = _crop_min_side()
    if max(cw, ch) < target:
        scale = target / max(cw, ch)
        crop = cv2.resize(
            crop,
            (max(1, int(cw * scale)), max(1, int(ch * scale))),
            interpolation=cv2.INTER_CUBIC,
        )
    # Cap extremely large crops for storage, keep high detail
    max_side = _crop_max_side()
    ch, cw = crop.shape[:2]
    if max(cw, ch) > max_side:
        scale = max_side / max(cw, ch)
        crop = cv2.resize(
            crop,
            (max(1, int(cw * scale)), max(1, int(ch * scale))),
            interpolation=cv2.INTER_AREA,
        )
    return crop


def _annotate_crop(crop, label: str):
    """Draw a clear multi-line identity banner on the full-person crop."""
    import cv2

    output = crop.copy()
    h, w = output.shape[:2]
    raw = (label or "Person").strip() or "Person"
    # Split long labels onto two lines at · or [
    lines: list[str] = []
    if "  [" in raw:
        main, rest = raw.split("  [", 1)
        lines.append(main.strip()[:42])
        lines.append(("[" + rest)[:42])
    elif " · " in raw and len(raw) > 28:
        left, right = raw.split(" · ", 1)
        lines.append(left.strip()[:42])
        lines.append(right.strip()[:42])
    else:
        lines.append(raw[:48])

    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = max(0.55, min(1.05, w / 420))
    thickness = max(2, int(font_scale * 2.0))
    line_sizes = [cv2.getTextSize(t, font, font_scale, thickness) for t in lines]
    line_gap = 6
    bar_pad = 10
    bar_h = bar_pad * 2 + sum(sz[0][1] + sz[1] for sz in line_sizes) + line_gap * (len(lines) - 1)
    bar_h = min(bar_h, max(36, h // 3))

    # Solid top banner for readability
    cv2.rectangle(output, (0, 0), (w, bar_h), (0, 0, 0), -1)
    # Accent strip
    cv2.rectangle(output, (0, bar_h - 3), (w, bar_h), (0, 200, 255), -1)

    y = bar_pad
    for text, ((tw, th), baseline) in zip(lines, line_sizes):
        y += th
        cv2.putText(
            output,
            text,
            (10, y),
            font,
            font_scale,
            (255, 255, 255),
            thickness,
            cv2.LINE_AA,
        )
        y += baseline + line_gap

    # Thin green border so the person crop reads as a labeled card
    cv2.rectangle(output, (0, 0), (w - 1, h - 1), (0, 200, 80), max(2, int(w / 200)))
    return output


def _encode_jpeg(frame, quality: int) -> bytes:
    import cv2

    # IMWRITE_JPEG_OPTIMIZE + high chroma quality for sharper person crops
    ok, encoded = cv2.imencode(
        ".jpg",
        frame,
        [
            int(cv2.IMWRITE_JPEG_QUALITY),
            quality,
            int(cv2.IMWRITE_JPEG_OPTIMIZE),
            1,
        ],
    )
    if not ok or encoded is None:
        return b""
    return encoded.tobytes()


def _save_jpeg(rel_path: str, jpeg_bytes: bytes) -> str:
    saved_path = default_storage.save(rel_path, ContentFile(jpeg_bytes))
    return default_storage.url(saved_path)


def _store_person_thumbnail(person, crop_url: str, crop_area: int) -> None:
    if person is None or not crop_url:
        return
    from .models import JourneyPerson

    meta = dict(person.metadata or {}) if isinstance(person.metadata, dict) else {}
    prev_area = int(meta.get("thumbnail_area") or 0)
    if meta.get("thumbnail_url") and crop_area < prev_area:
        return
    meta["thumbnail_url"] = crop_url
    meta["thumbnail_area"] = crop_area
    JourneyPerson.objects.filter(pk=person.pk).update(metadata=meta)


def _bbox_area(bb: list[int] | None) -> float:
    if not bb or len(bb) < 4:
        return 0.0
    return max(0, bb[2] - bb[0]) * max(0, bb[3] - bb[1])


def _person_like_bbox(bb: list[int] | None, frame_w: int, frame_h: int) -> bool:
    """Reject tiny / absurd boxes that usually map to wall or ground patches."""
    if not bb or len(bb) < 4:
        return False
    w = max(0, bb[2] - bb[0])
    h = max(0, bb[3] - bb[1])
    if w < 20 or h < 40:
        return False
    area = w * h
    frame_area = max(1, frame_w * frame_h)
    # Too small (<0.15% of frame) or huge almost-fullscreen noise
    if area < frame_area * 0.0015 or area > frame_area * 0.65:
        return False
    aspect = h / max(1.0, float(w))
    # Standing/sitting people are usually taller than wide; allow some side views
    if aspect < 0.55 or aspect > 5.5:
        return False
    return True


def _list_live_person_boxes(
    camera,
    frame_w: int,
    frame_h: int,
) -> list[tuple[list[int], float, int | None]]:
    """Return mapped live person/face boxes on the captured frame."""
    from cameras.clip_capture import _fit_bbox_to_frame, _map_bbox_to_capture_frame

    try:
        from ml.client import ml_live_detections_for_camera, ml_service_enabled
    except ImportError:
        return []

    if not camera or not ml_service_enabled() or not getattr(camera, "ml_server_id", None):
        return []

    try:
        payload = ml_live_detections_for_camera(camera)
    except Exception:
        return []

    dets = payload.get("detections") or []
    infer_w = int(payload.get("frame_width") or 0)
    infer_h = int(payload.get("frame_height") or 0)

    people: list[tuple[list[int], float, int | None]] = []
    for det in dets:
        cls = str(det.get("class_name") or det.get("label") or "").strip().lower()
        label = str(det.get("label") or "").strip().lower()
        object_type = str(det.get("object_type") or "").strip().lower()
        if object_type in ("vehicle", "object"):
            continue
        if cls in {
            "car", "truck", "bus", "motorcycle", "bicycle", "weapon", "gun",
            "knife", "rifle", "pistol", "bag", "backpack", "handbag", "chair",
        }:
            continue
        is_person = cls in ("person", "face") or label in ("person", "face") or object_type == "person"
        if not is_person:
            # Named face / staff label
            if not label or label in {"unknown", "object", ""}:
                continue
            if cls and cls not in ("", "person", "face"):
                continue
        bbox = det.get("bbox") or []
        if not bbox or len(bbox) < 4:
            continue
        try:
            conf = float(det.get("confidence") or 0)
        except (TypeError, ValueError):
            conf = 0.0
        if conf < 0.25:
            continue
        tid = det.get("track_id")
        try:
            tid = int(tid) if tid is not None else None
        except (TypeError, ValueError):
            tid = None
        if infer_w > 0 and infer_h > 0 and (abs(infer_w - frame_w) > 8 or abs(infer_h - frame_h) > 8):
            mapped = _map_bbox_to_capture_frame(bbox, infer_w, infer_h, frame_w, frame_h)
        else:
            mapped = _fit_bbox_to_frame(bbox, frame_w, frame_h)
        if mapped and _person_like_bbox(mapped, frame_w, frame_h):
            people.append((mapped, conf, tid))
    return people


def _refresh_bbox_from_live_ml(
    camera,
    frame_w: int,
    frame_h: int,
    *,
    track_id=None,
    fallback_bbox: list | None = None,
) -> tuple[list[int] | None, bool]:
    """
    Re-locate the person on a freshly grabbed frame.

    Returns (bbox, verified). verified=True only when a live person detection
    backs the box — never crop empty wall/ground from a stale event bbox.
    """
    from cameras.clip_capture import _fit_bbox_to_frame

    people = _list_live_person_boxes(camera, frame_w, frame_h)
    if not people:
        return None, False

    # 1) Same ByteTrack id still active
    if track_id is not None:
        try:
            want = int(track_id)
        except (TypeError, ValueError):
            want = None
        if want is not None:
            for bb, _conf, tid in people:
                if tid == want:
                    return bb, True

    # 2) Best IoU with previous bbox (only if overlap is real)
    from .unknown_resolution import bbox_iou

    fb = _fit_bbox_to_frame(fallback_bbox or [], frame_w, frame_h)
    best_iou = 0.0
    best_mapped = None
    if fb:
        for bb, conf, _tid in people:
            iou = bbox_iou(fb, bb)
            score = iou + conf * 0.05
            if score > best_iou:
                best_iou = score
                best_mapped = bb
        if best_mapped and best_iou >= 0.15:
            return best_mapped, True

    # 3) No reliable match to the event — do NOT guess largest person
    #    (that often crops a different subject / wall). Caller should use full frame.
    return None, False



def _discard_empty_unknown_journey(journey_event) -> bool:
    """
    Delete an unknown JourneyPerson that has no verified person-labeled snapshot.

    Stops empty Fire-cam / wall frames from remaining as PJ-##### journeys.
    """
    person = getattr(journey_event, "journey_person", None)
    if person is None:
        return False
    from .models import CameraTrack, JourneyEvent, JourneyPerson, PersonObservation, PersonStatus, PersonType

    if person.person_type != PersonType.UNKNOWN or person.status != PersonStatus.ACTIVE:
        return False
    # A snapshot can miss the person for ordinary reasons (they walked out of frame before the grab, the ML
    # frame timed out). Only a one-off detection with nothing else behind it is junk: a person with saved
    # appearance/face embeddings, several sightings or several tracks is real — deleting it broke open
    # journey pages ("Person not found") and wiped the gallery used to re-identify them later.
    if PersonObservation.objects.filter(journey_person=person).exclude(embedding=[]).exists():
        return False
    if JourneyEvent.objects.filter(journey_person=person).count() > 1:
        return False
    if CameraTrack.objects.filter(journey_person=person).count() > 1:
        return False
    # Keep if any event already has a labeled person
    for ev in JourneyEvent.objects.filter(journey_person=person).only("metadata", "snapshot_path"):
        meta = ev.metadata if isinstance(ev.metadata, dict) else {}
        if meta.get("person_labeled") or meta.get("person_verified"):
            return False
        # Staff/visitor linked later
    if person.staff_id or person.visitor_id:
        return False

    code = person.code
    JourneyPerson.objects.filter(pk=person.pk).delete()
    logger.info("Deleted empty unknown journey %s (no person in captures)", code)
    return True


def capture_journey_crop_sync(journey_event_id: int) -> str:
    """
    Save a FULL camera frame with the detected person labeled (bbox + PJ / tracklet).

    Never publish a tight person crop as the primary journey image.
    """
    _ensure_db_connection()
    try:
        import cv2  # noqa: F401
    except ImportError:
        logger.warning("OpenCV not available for journey snapshot capture")
        return ""

    try:
        from cameras.clip_capture import (
            draw_journey_snapshot_on_frame,
            read_journey_detect_frame,
            read_journey_hd_frame,
        )
        from cameras.models import DetectionEvent

        from .models import JourneyEvent

        journey_event = (
            JourneyEvent.objects.select_related(
                "camera", "camera__nvr", "journey_person", "track"
            )
            .filter(pk=journey_event_id)
            .first()
        )
        if journey_event is None or journey_event.camera_id is None:
            return ""

        existing = (journey_event.snapshot_path or "").strip()
        event_meta = _event_metadata(journey_event)
        if (
            existing
            and event_meta.get("snapshot_kind") == "full_frame"
            and event_meta.get("person_labeled")
            and not _needs_snapshot_recapture(journey_event)
        ):
            return existing

        detection = None
        if journey_event.detection_event_id:
            detection = DetectionEvent.objects.filter(pk=journey_event.detection_event_id).first()

        camera = journey_event.camera
        bbox = journey_event.bbox or (detection.bbox if detection else []) or []
        person_label = _person_label(journey_event)
        confidence = journey_event.confidence
        camera_name = (camera.name or camera.zone or "").strip() if camera else ""
        local_track_id = None
        if journey_event.track_id and journey_event.track:
            local_track_id = journey_event.track.track_id
        if local_track_id is None:
            raw_tid = event_meta.get("track_id")
            try:
                local_track_id = int(raw_tid) if raw_tid is not None else None
            except (TypeError, ValueError):
                local_track_id = None

        frame = _read_detection_clip_frame(detection)
        used_live_grab = False
        if frame is None:
            _release_db()
            frame = read_journey_detect_frame(camera)
            if frame is None:
                frame = read_journey_hd_frame(camera)
            used_live_grab = True
        else:
            _release_db()

        if frame is None:
            return existing

        h, w = frame.shape[:2]
        # Always try to place a detection box:
        # 1) live-verified person box (best)
        # 2) original event/detection bbox mapped onto this frame
        event_box = _resolve_crop_box(
            bbox, w, h, camera, detection, allow_live_infer=used_live_grab
        )
        live_box = None
        verified = False
        if used_live_grab:
            live_box, verified = _refresh_bbox_from_live_ml(
                camera,
                w,
                h,
                track_id=local_track_id,
                fallback_bbox=bbox,
            )
        else:
            verified = bool(event_box)

        label_box = live_box if (verified and live_box) else event_box

        # Full scene + person label; draw box whenever we have coordinates.
        output = draw_journey_snapshot_on_frame(
            frame,
            bbox=label_box,
            person_label=person_label,
            camera_name=camera_name,
            confidence=confidence,
        )
        jpeg_q = _journey_jpeg_quality()
        jpeg_bytes = _encode_jpeg(output, jpeg_q)
        if not jpeg_bytes:
            return existing

        today = timezone.localdate()
        rel_path = f"journey_snapshots/{today:%Y/%m/%d}/je_{journey_event_id}_full.jpg"
        url = _save_jpeg(rel_path, jpeg_bytes)

        event_meta["snapshot_kind"] = "full_frame"
        event_meta["person_labeled"] = bool(label_box)
        event_meta["snapshot_live_refresh"] = used_live_grab
        event_meta["person_verified"] = bool(verified and label_box)
        event_meta["full_snapshot_path"] = url
        event_meta.pop("empty_crop", None)
        event_meta.pop("crop_rejected_reason", None)

        JourneyEvent.objects.filter(pk=journey_event_id).update(
            snapshot_path=url,
            metadata=event_meta,
        )

        # Discard unknowns that have no detection box to label.
        if not label_box:
            discarded = _discard_empty_unknown_journey(journey_event)
            if discarded:
                logger.info(
                    "Discarded empty unknown journey for event %s (no detection box)",
                    journey_event_id,
                )
                return ""

        if journey_event.journey_person_id and label_box:
            from .unknown_resolution import update_person_embeddings_from_crop
            import cv2

            person = journey_event.journey_person
            reid_crop = _extract_person_crop(frame, label_box)
            if reid_crop is not None and not _crop_looks_empty(reid_crop):
                ok_crop, crop_encoded = cv2.imencode(
                    ".jpg", reid_crop, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_q]
                )
                if ok_crop and crop_encoded is not None:
                    update_person_embeddings_from_crop(person, crop_encoded.tobytes())
            _store_person_thumbnail(person, url, w * h)

        logger.info(
            "Saved journey FULL labeled frame for event %s (%s, %sx%s, labeled=%s)",
            journey_event_id,
            rel_path,
            output.shape[1],
            output.shape[0],
            verified,
        )
        return url
    except Exception:
        logger.exception("Journey snapshot capture failed for event %s", journey_event_id)
        return ""
    finally:
        _release_db()



def _process_crop_queue() -> None:
    global _crop_workers
    while True:
        with _crop_guard:
            if not _crop_queue:
                _crop_workers -= 1
                return
            journey_event_id = _crop_queue.popleft()
            _crop_queued.discard(journey_event_id)
        try:
            capture_journey_crop_sync(journey_event_id)
        except Exception:
            logger.exception("Journey snapshot worker failed for event %s", journey_event_id)
        finally:
            _release_db()
            from config.worker_throttle import maybe_pause_for_cpu

            maybe_pause_for_cpu(logger, label="journey-snapshot")


def _enqueue_journey_crop(journey_event_id: int) -> None:
    global _crop_workers
    dropped = None
    spawn = False
    with _crop_guard:
        if journey_event_id in _crop_queued:
            return
        if len(_crop_queue) >= _max_crop_queue():
            dropped = _crop_queue.popleft()
            _crop_queued.discard(dropped)
        _crop_queue.append(journey_event_id)
        _crop_queued.add(journey_event_id)
        spawn = _crop_workers < _max_crop_workers()
        if spawn:
            _crop_workers += 1
    if dropped:
        logger.warning("Journey snapshot queue full; dropped event %s", dropped)
    if spawn:
        threading.Thread(
            target=_process_crop_queue,
            daemon=True,
            name="journey-snapshot-worker",
        ).start()


def enqueue_latest_crops_for_persons(persons, *, per_person: int = 1) -> int:
    """Queue person-crop recapture for live unknowns without blocking the API."""
    from .models import JourneyEvent, PersonType

    queued = 0
    unknown_ids = [
        p.pk
        for p in persons
        if getattr(p, "person_type", None) == PersonType.UNKNOWN
    ]
    if not unknown_ids:
        return 0

    from django.db.models import Max

    latest = (
        JourneyEvent.objects.filter(
            journey_person_id__in=unknown_ids,
            camera_id__isnull=False,
        )
        .values("journey_person_id")
        .annotate(max_id=Max("id"))
    )
    event_ids = [row["max_id"] for row in latest if row.get("max_id")]
    if not event_ids:
        return 0

    for ev in JourneyEvent.objects.filter(pk__in=event_ids).only("id", "metadata"):
        if _is_person_crop(ev):
            continue
        _enqueue_journey_crop(ev.pk)
        queued += 1
        if queued >= max(1, per_person) * len(unknown_ids):
            break
    return queued


def capture_and_attach_snapshot_sync(
    journey_event_id: int,
    detection_event_id: int,
    camera_id: int,
) -> str:
    """Capture a person-crop journey snapshot for this event."""
    del detection_event_id, camera_id
    return capture_journey_crop_sync(journey_event_id)


def schedule_journey_snapshot(
    journey_event_id: int,
    detection_event_id: int | None,
    camera_id: int | None,
) -> None:
    """Queue a snapshot capture after the DB transaction commits."""
    if not camera_id:
        return

    def _on_commit() -> None:
        _enqueue_journey_crop(journey_event_id)
        if detection_event_id:
            try:
                from cameras.clip_capture import schedule_detection_clip

                schedule_detection_clip(camera_id, detection_event_id)
            except Exception:
                logger.debug("Detection clip queue skipped for det %s", detection_event_id)

    transaction.on_commit(_on_commit)


def _events_needing_crop(qs, *, limit: int) -> list[int]:
    rows = list(qs.order_by("-created_at").values_list("id", "snapshot_path", "metadata")[: max(limit * 3, limit)])
    ids: list[int] = []
    for pk, path, meta in rows:
        kind = meta.get("snapshot_kind") if isinstance(meta, dict) else None
        if not (path or "").strip() or kind != _SNAPSHOT_KIND_CROP:
            ids.append(pk)
        if len(ids) >= limit:
            break
    return ids


def capture_missing_for_person(
    person,
    *,
    since=None,
    limit: int = 20,
    timeout: float = 60.0,
) -> int:
    """Capture or recrop snapshots so the person photo is a close-up, not the full scene."""
    from concurrent.futures import ThreadPoolExecutor, as_completed

    from .models import JourneyEvent

    qs = JourneyEvent.objects.filter(
        journey_person=person,
        camera__isnull=False,
    )
    if since is not None:
        qs = qs.filter(created_at__gte=since)
    jobs = _events_needing_crop(qs, limit=limit)
    if not jobs:
        return 0

    done = 0
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(capture_journey_crop_sync, ev_id) for ev_id in jobs]
        try:
            for fut in as_completed(futures, timeout=timeout):
                try:
                    if fut.result():
                        done += 1
                except Exception:
                    logger.exception("Parallel journey snapshot failed")
        except TimeoutError:
            logger.warning("Journey snapshot batch timed out after %ss", timeout)
    return done


def capture_all_missing_events(*, limit: int = 100) -> int:
    """Capture snapshots for any journey events missing person crops."""
    from .models import JourneyEvent

    jobs = _events_needing_crop(
        JourneyEvent.objects.filter(camera__isnull=False),
        limit=limit,
    )
    done = 0
    for ev_id in jobs:
        if capture_journey_crop_sync(ev_id):
            done += 1
    return done
