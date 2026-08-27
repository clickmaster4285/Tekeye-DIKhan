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
_MAX_CROP_WORKERS = 2
_MAX_CROP_QUEUE = 40
_SNAPSHOT_KIND_CROP = "person_crop"


def _release_db() -> None:
    try:
        connection.close()
    except Exception:
        pass


def _ensure_db_connection() -> None:
    close_old_connections()


def _journey_jpeg_quality() -> int:
    return max(90, min(100, int(getattr(settings, "JOURNEY_SNAPSHOT_JPEG_QUALITY", 98))))


def _keep_full_frame() -> bool:
    """Keep an annotated full-scene JPEG in metadata (UI still shows the person crop)."""
    return bool(getattr(settings, "JOURNEY_SNAPSHOT_FULL_FRAME", True))


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
    return _event_metadata(journey_event).get("snapshot_kind") == _SNAPSHOT_KIND_CROP


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
            from ml.client import ml_live_detections, ml_service_enabled

            if allow_live_infer and camera and ml_service_enabled():
                payload = ml_live_detections(
                    camera.stream_key,
                    rtsp_url=camera.effective_stream_url(),
                )
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
    person = journey_event.journey_person
    meta = journey_event.metadata or {}
    if isinstance(meta, dict):
        face_label = str(meta.get("face_label") or meta.get("label") or "").strip()
        if face_label and face_label.lower() not in {"unknown", "person", "face", ""}:
            return face_label[:80]
    if person:
        return (person.display_name or person.code or "Person")[:80]
    return "Person"


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


def _extract_display_crop(frame, crop_box: list[int] | None, *, min_side: int = 16):
    """Padded person crop for the UI — extra headroom so the face stays visible."""
    import cv2

    if crop_box is None or frame is None:
        return None
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in crop_box]
    box_w = max(x2 - x1, 1)
    box_h = max(y2 - y1, 1)
    pad_x = int(0.18 * box_w)
    pad_bottom = int(0.12 * box_h)
    pad_top = int(0.32 * box_h)
    x1 = max(0, x1 - pad_x)
    y1 = max(0, y1 - pad_top)
    x2 = min(w, x2 + pad_x)
    y2 = min(h, y2 + pad_bottom)
    if x2 - x1 < min_side or y2 - y1 < min_side:
        return None
    crop = frame[y1:y2, x1:x2].copy()
    ch, cw = crop.shape[:2]
    target = 220
    if max(cw, ch) < target:
        scale = target / max(cw, ch)
        crop = cv2.resize(
            crop,
            (max(1, int(cw * scale)), max(1, int(ch * scale))),
            interpolation=cv2.INTER_CUBIC,
        )
    return crop


def _annotate_crop(crop, label: str):
    import cv2

    output = crop.copy()
    h, w = output.shape[:2]
    text = (label or "Person")[:28]
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = max(0.38, min(0.7, w / 280))
    thickness = max(1, int(font_scale * 1.6))
    (_tw, th), baseline = cv2.getTextSize(text, font, font_scale, thickness)
    bar_h = th + baseline + 10
    cv2.rectangle(output, (0, max(0, h - bar_h)), (w, h), (0, 0, 0), -1)
    cv2.putText(
        output,
        text,
        (6, h - 6),
        font,
        font_scale,
        (255, 255, 255),
        thickness,
        cv2.LINE_AA,
    )
    return output


def _encode_jpeg(frame, quality: int) -> bytes:
    import cv2

    ok, encoded = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
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


def capture_journey_crop_sync(journey_event_id: int) -> str:
    """Save a close-up person crop as the journey snapshot (full scene kept in metadata)."""
    _ensure_db_connection()
    try:
        import cv2
    except ImportError:
        logger.warning("OpenCV not available for journey snapshot capture")
        return ""

    try:
        from cameras.clip_capture import draw_journey_snapshot_on_frame, read_journey_hd_frame
        from cameras.models import DetectionEvent

        from .models import JourneyEvent

        journey_event = (
            JourneyEvent.objects.select_related("camera", "camera__nvr", "journey_person")
            .filter(pk=journey_event_id)
            .first()
        )
        if journey_event is None or journey_event.camera_id is None:
            return ""

        existing = (journey_event.snapshot_path or "").strip()
        if existing and _is_person_crop(journey_event):
            return existing

        detection = None
        if journey_event.detection_event_id:
            detection = DetectionEvent.objects.filter(pk=journey_event.detection_event_id).first()

        camera = journey_event.camera
        bbox = journey_event.bbox or (detection.bbox if detection else []) or []
        person_label = _person_label(journey_event)
        confidence = journey_event.confidence
        camera_name = (camera.name or camera.zone or "").strip() if camera else ""
        journey_person = journey_event.journey_person
        event_meta = _event_metadata(journey_event)

        frame = _read_detection_clip_frame(detection)
        if frame is None and existing:
            frame = _read_frame_from_storage(existing)
        used_live_grab = False
        if frame is None:
            _release_db()
            frame = read_journey_hd_frame(camera)
            used_live_grab = True
        else:
            _release_db()

        if frame is None:
            return existing

        h, w = frame.shape[:2]
        crop_box = _resolve_crop_box(
            bbox, w, h, camera, detection, allow_live_infer=used_live_grab
        )
        display_crop = _extract_display_crop(frame, crop_box)
        if display_crop is None:
            if existing and not used_live_grab:
                return existing
            display_crop = frame

        output = _annotate_crop(display_crop, person_label)
        jpeg_q = _journey_jpeg_quality()
        jpeg_bytes = _encode_jpeg(output, jpeg_q)
        if not jpeg_bytes:
            return existing

        today = timezone.localdate()
        rel_path = f"journey_snapshots/{today:%Y/%m/%d}/je_{journey_event_id}_crop.jpg"
        url = _save_jpeg(rel_path, jpeg_bytes)

        full_url = (event_meta.get("full_snapshot_path") or "").strip()
        if (
            not full_url
            and existing
            and "journey_snapshots/" in existing
            and "_crop" not in existing
        ):
            full_url = existing
        if _keep_full_frame() and not full_url:
            full_frame = draw_journey_snapshot_on_frame(
                frame,
                bbox=crop_box,
                person_label=person_label,
                camera_name=camera_name,
                confidence=confidence,
            )
            full_bytes = _encode_jpeg(full_frame, jpeg_q)
            if full_bytes:
                full_rel = f"journey_snapshots/{today:%Y/%m/%d}/je_{journey_event_id}_full.jpg"
                full_url = _save_jpeg(full_rel, full_bytes)

        event_meta["snapshot_kind"] = _SNAPSHOT_KIND_CROP
        if full_url:
            event_meta["full_snapshot_path"] = full_url

        JourneyEvent.objects.filter(pk=journey_event_id).update(
            snapshot_path=url,
            metadata=event_meta,
        )

        if journey_event.journey_person_id:
            from .unknown_resolution import update_person_embeddings_from_crop

            person = journey_person or journey_event.journey_person
            reid_crop = _extract_person_crop(frame, crop_box)
            reid_source = reid_crop if reid_crop is not None else display_crop
            ok_crop, crop_encoded = cv2.imencode(
                ".jpg", reid_source, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_q]
            )
            if ok_crop and crop_encoded is not None:
                update_person_embeddings_from_crop(person, crop_encoded.tobytes())
            ch, cw = display_crop.shape[:2]
            _store_person_thumbnail(person, url, cw * ch)

        logger.info(
            "Saved journey person crop for event %s (%s, %sx%s)",
            journey_event_id,
            rel_path,
            output.shape[1],
            output.shape[0],
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


def _enqueue_journey_crop(journey_event_id: int) -> None:
    global _crop_workers
    dropped = None
    spawn = False
    with _crop_guard:
        if journey_event_id in _crop_queued:
            return
        if len(_crop_queue) >= _MAX_CROP_QUEUE:
            dropped = _crop_queue.popleft()
            _crop_queued.discard(dropped)
        _crop_queue.append(journey_event_id)
        _crop_queued.add(journey_event_id)
        spawn = _crop_workers < _MAX_CROP_WORKERS
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
