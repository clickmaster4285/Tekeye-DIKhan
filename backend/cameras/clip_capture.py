"""Capture a snapshot image (with detection overlay) when a detection event is saved."""

from __future__ import annotations

import logging
import os
import subprocess
import threading
import time
from collections import deque
from typing import TYPE_CHECKING

import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django.db import close_old_connections, connection

from .stream_utils import ffmpeg_path, gpu_aware_vf, hwaccel_input_flags

if TYPE_CHECKING:
    from .models import Camera, DetectionEvent

logger = logging.getLogger(__name__)

_camera_clip_locks: dict[int, threading.Lock] = {}
_locks_guard = threading.Lock()
_queue_guard = threading.Lock()
_clip_jobs: deque[tuple[int, int]] = deque()
_clip_job_ids: set[int] = set()
_clip_workers = 0

_attendance_jobs: deque[dict] = deque()
_attendance_workers = 0
_MAX_ATTENDANCE_WORKERS = 1
_MAX_ATTENDANCE_QUEUE = 20

_ml_fail_until: dict[int, float] = {}
_ML_COOLDOWN_SEC = 30.0


def _release_db() -> None:
    """Drop this thread's Postgres connection so long ffmpeg/HTTP waits do not hold a slot."""
    try:
        connection.close()
    except Exception:
        pass


def _safe_snapshot_url(url: str) -> str:
    """Log path only — RTSP credentials often sit in the query string."""
    text = (url or "").strip()
    if not text:
        return ""
    return text.split("?", 1)[0]


def _ml_on_cooldown(camera_id: int) -> bool:
    return bool(camera_id) and time.monotonic() < _ml_fail_until.get(int(camera_id), 0.0)


def _mark_ml_fail(camera_id: int | None) -> None:
    if not camera_id:
        return
    _ml_fail_until[int(camera_id)] = time.monotonic() + _ML_COOLDOWN_SEC


def _clip_enabled() -> bool:
    return bool(getattr(settings, "DETECTION_CLIP_ENABLED", True))


def _link_journey_snapshot(detection_event_id: int) -> None:
    """Queue person-crop snapshots for linked journey events (additive hook)."""
    try:
        from person_journey.models import JourneyEvent
        from person_journey.snapshot_capture import _enqueue_journey_crop

        for journey_event_id in JourneyEvent.objects.filter(
            detection_event_id=detection_event_id,
            snapshot_path="",
        ).values_list("pk", flat=True):
            _enqueue_journey_crop(journey_event_id)
    except Exception:
        logger.debug("Journey snapshot link skipped for detection %s", detection_event_id)


def _link_object_tracking_snapshot(detection_event_id: int) -> None:
    """Attach DetectionEvent clip path onto GlobalObject / ObjectVisit after capture."""
    try:
        from object_tracking.models import GlobalObject, ObjectVisit

        from .models import DetectionEvent

        event = DetectionEvent.objects.filter(pk=detection_event_id).only("clip", "person_qr").first()
        if event is None or not event.clip:
            return
        clip_name = str(event.clip.name or "").replace("\\", "/").strip()
        if not clip_name:
            return

        ObjectVisit.objects.filter(detection_event_id=detection_event_id).exclude(
            snapshot_path=clip_name
        ).update(snapshot_path=clip_name)

        code = (event.person_qr or "").strip()
        if code:
            GlobalObject.objects.filter(code=code, snapshot_path="").update(snapshot_path=clip_name)
        GlobalObject.objects.filter(
            first_detection_event_id=detection_event_id,
            snapshot_path="",
        ).update(snapshot_path=clip_name)
    except Exception:
        logger.debug("Object tracking snapshot link skipped for detection %s", detection_event_id)


def _update_clip_status(event_id: int, status: str) -> None:
    close_old_connections()
    from .models import DetectionEvent

    DetectionEvent.objects.filter(pk=event_id).update(clip_status=status)
    _release_db()


def _camera_lock(camera_id: int) -> threading.Lock:
    with _locks_guard:
        lock = _camera_clip_locks.get(camera_id)
        if lock is None:
            lock = threading.Lock()
            _camera_clip_locks[camera_id] = lock
        return lock


def _ml_raw_mjpeg_url(camera) -> str | None:
    try:
        from ml.client import MLServiceError, ml_live_mjpeg_raw_url_for_camera, ml_service_enabled
    except ImportError:
        return None
    if not ml_service_enabled() or not getattr(camera, "ml_server_id", None):
        return None
    try:
        return ml_live_mjpeg_raw_url_for_camera(camera)
    except MLServiceError:
        return None


def _ml_attendance_mjpeg_url(camera, *, target_width: int) -> str | None:
    """HD frames from ML main-stream session (avoids NVR substream on 2nd RTSP connection)."""
    try:
        from ml.client import (
            MLServiceError,
            ml_live_mjpeg_attendance_url_for_camera,
            ml_service_enabled,
        )
    except ImportError:
        return None
    if not ml_service_enabled() or not getattr(camera, "ml_server_id", None):
        return None
    try:
        return ml_live_mjpeg_attendance_url_for_camera(camera, width=target_width)
    except MLServiceError:
        return None


def _max_clip_workers() -> int:
    return max(1, min(4, int(getattr(settings, "DETECTION_CLIP_MAX_WORKERS", 1))))


def _max_clip_queue() -> int:
    return max(10, int(getattr(settings, "DETECTION_CLIP_MAX_QUEUE", 50)))


_ffmpeg_spawn_lock = threading.Lock()
_last_ffmpeg_spawn = 0.0

# Same-frame evidence JPEG from ML (camera_id -> (monotonic_ts, jpeg_bytes))
_evidence_guard = threading.Lock()
_pending_evidence: dict[int, tuple[float, bytes]] = {}
_EVIDENCE_TTL_SEC = 20.0


def stash_evidence_jpeg(camera_id: int, jpeg_bytes: bytes) -> None:
    """Cache ML same-frame evidence for pending detection snapshot jobs."""
    if not jpeg_bytes or camera_id is None:
        return
    with _evidence_guard:
        _pending_evidence[int(camera_id)] = (time.monotonic(), jpeg_bytes)


def _take_stashed_evidence(camera_id: int) -> bytes | None:
    with _evidence_guard:
        item = _pending_evidence.get(int(camera_id))
        if not item:
            return None
        ts, data = item
        if time.monotonic() - ts > _EVIDENCE_TTL_SEC:
            _pending_evidence.pop(int(camera_id), None)
            return None
        return data


def _ml_evidence_jpeg_url(camera) -> str | None:
    try:
        from ml.client import MLServiceError, ml_live_jpeg_evidence_url_for_camera, ml_service_enabled
    except ImportError:
        return None
    if not ml_service_enabled() or not getattr(camera, "ml_server_id", None):
        return None
    try:
        return ml_live_jpeg_evidence_url_for_camera(camera)
    except MLServiceError:
        return None


def _decode_jpeg_bytes(data: bytes):
    import cv2
    import numpy as np

    if not data:
        return None
    arr = np.frombuffer(data, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return frame


def _read_ml_evidence_frame(camera) -> object | None:
    """Fetch the YOLO infer-frame JPEG (same frame as current detections)."""
    stashed = _take_stashed_evidence(getattr(camera, "pk", 0) or 0)
    if stashed:
        frame = _decode_jpeg_bytes(stashed)
        if frame is not None:
            return frame
    url = _ml_evidence_jpeg_url(camera)
    if not url:
        return None
    try:
        resp = requests.get(url, timeout=(2.0, 4.0))
    except requests.RequestException:
        return None
    if resp.status_code != 200 or not resp.content:
        return None
    return _decode_jpeg_bytes(resp.content)


def _ffmpeg_spawn_interval_sec() -> float:
    raw = os.getenv("FFMPEG_SNAPSHOT_MIN_INTERVAL_SEC", "2")
    try:
        return max(0.5, float(raw))
    except (TypeError, ValueError):
        return 2.0


def _throttle_ffmpeg_spawn() -> None:
    """Space out short-lived RTSP→JPEG ffmpeg processes."""
    global _last_ffmpeg_spawn
    gap = _ffmpeg_spawn_interval_sec()
    with _ffmpeg_spawn_lock:
        now = time.monotonic()
        wait = gap - (now - _last_ffmpeg_spawn)
        if wait > 0:
            time.sleep(wait)
        _last_ffmpeg_spawn = time.monotonic()


def _rtsp_input_extra() -> list[str]:
    timeout_us = os.getenv("FFMPEG_STIMEOUT_US", "10000000").strip() or "10000000"
    timeout_flag = os.getenv("FFMPEG_TIMEOUT_FLAG", "timeout").strip().lstrip("-") or "timeout"
    threads = os.getenv("FFMPEG_THREADS", "1").strip() or "1"
    return [
        "-threads",
        threads,
        "-rtsp_transport",
        "tcp",
        f"-{timeout_flag}",
        timeout_us,
        "-fflags",
        "+discardcorrupt+genpts",
        "-flags",
        "low_delay",
        "-err_detect",
        "ignore_err",
    ]


def _display_class(event: DetectionEvent) -> str:
    return (event.class_name or event.label or "object").strip()


def _snapshot_label(event: DetectionEvent) -> str:
    """Prefer '{global_id} {name}' on annotated snapshots."""
    gid = (getattr(event, "person_qr", None) or "").strip()
    employee = (getattr(event, "employee_name", None) or "").strip()
    label = (event.label or "").strip()
    cls = (event.class_name or "").strip()
    generic = {"", "unknown", "person", "face"}

    if employee:
        name = employee
    elif cls.lower() in ("person", "face") and label.lower() not in generic and not _is_global_id_label(label):
        name = label
    elif label and not _is_global_id_label(label) and label.lower() not in generic:
        name = label
    else:
        name = cls or _display_class(event)

    # Avoid "GP12 GP12" when label was previously overwritten with the ID
    if gid and name and gid.lower() == name.lower():
        name = cls or "person"
    if gid and name and gid.lower() not in name.lower():
        return f"{gid} {name}"[:80]
    if gid:
        return gid[:80]
    return (name or _display_class(event))[:80]


def _is_global_id_label(value: str) -> bool:
    import re

    return bool(re.match(r"^(?:gp|go|gv|t)\d+$", (value or "").strip(), re.IGNORECASE))


def _fit_bbox_to_frame(bbox: list, frame_w: int, frame_h: int) -> list[int] | None:
    if not isinstance(bbox, (list, tuple)) or len(bbox) < 4:
        return None
    try:
        x1, y1, x2, y2 = (float(v) for v in bbox[:4])
    except (TypeError, ValueError):
        return None
    if x2 <= x1 or y2 <= y1:
        return None

    x1 = int(max(0, min(x1, frame_w - 1)))
    y1 = int(max(0, min(y1, frame_h - 1)))
    x2 = int(max(x1 + 1, min(x2, frame_w)))
    y2 = int(max(y1 + 1, min(y2, frame_h)))
    return [x1, y1, x2, y2]


def _map_bbox_to_capture_frame(
    bbox: list,
    src_w: int,
    src_h: int,
    dst_w: int,
    dst_h: int,
) -> list[int] | None:
    """Map detection bbox from inference resolution to captured clip frame size."""
    if not isinstance(bbox, (list, tuple)) or len(bbox) < 4:
        return None
    if src_w <= 0 or src_h <= 0 or dst_w <= 0 or dst_h <= 0:
        return _fit_bbox_to_frame(bbox, dst_w, dst_h)
    try:
        x1, y1, x2, y2 = (float(v) for v in bbox[:4])
    except (TypeError, ValueError):
        return None
    sx = dst_w / float(src_w)
    sy = dst_h / float(src_h)
    return _fit_bbox_to_frame([x1 * sx, y1 * sy, x2 * sx, y2 * sy], dst_w, dst_h)


def _labels_match_staff(det: dict, label: str, employee_name: str) -> bool:
    det_label = str(det.get("label") or "").strip().lower()
    if not det_label or det_label in _GENERIC_EMPLOYEE_LABELS:
        return False
    targets = {label.strip().lower(), employee_name.strip().lower()}
    targets.discard("")
    return det_label in targets


_GENERIC_EMPLOYEE_LABELS = frozenset({"unknown", "person", "face", ""})


def _staff_bbox_from_ml(
    camera,
    label: str,
    employee_name: str,
    frame_w: int,
    frame_h: int,
    fallback_bbox: list,
    *,
    fallback_confidence: float = 0.0,
    infer_frame_w: int = 0,
    infer_frame_h: int = 0,
) -> tuple[list[int] | None, float]:
    """Resolve staff bbox from live ML detections, mapped to the captured frame size."""
    try:
        from ml.client import ml_live_detections_for_camera, ml_service_enabled
    except ImportError:
        fitted = _fit_bbox_to_frame(fallback_bbox, frame_w, frame_h)
        return fitted, fallback_confidence

    if not ml_service_enabled() or not getattr(camera, "ml_server_id", None):
        fitted = _fit_bbox_to_frame(fallback_bbox, frame_w, frame_h)
        return fitted, fallback_confidence

    try:
        payload = ml_live_detections_for_camera(camera)
    except Exception:
        fitted = _fit_bbox_to_frame(fallback_bbox, frame_w, frame_h)
        return fitted, fallback_confidence

    infer_w = int(payload.get("frame_width") or infer_frame_w or 0)
    infer_h = int(payload.get("frame_height") or infer_frame_h or 0)

    for det in payload.get("detections") or []:
        cls = str(det.get("class_name") or det.get("label") or "").strip().lower()
        if cls not in ("person", "face"):
            continue
        if not _labels_match_staff(det, label, employee_name):
            continue
        src_w = int(det.get("frame_width") or infer_w or frame_w)
        src_h = int(det.get("frame_height") or infer_h or frame_h)
        fitted = _map_bbox_to_capture_frame(det.get("bbox") or [], src_w, src_h, frame_w, frame_h)
        if fitted:
            try:
                conf = float(det.get("confidence", fallback_confidence))
            except (TypeError, ValueError):
                conf = fallback_confidence
            return fitted, conf

    src_w = infer_w or frame_w
    src_h = infer_h or frame_h
    fitted = _map_bbox_to_capture_frame(fallback_bbox, src_w, src_h, frame_w, frame_h)
    return fitted, fallback_confidence


def _draw_attendance_staff_on_frame(
    frame,
    *,
    bbox: list[int] | None,
    display_name: str,
    confidence: float,
):
    """Draw only the attendance staff box + label (no top-left banner)."""
    import cv2

    output = frame.copy()
    if not bbox:
        return output

    h, w = output.shape[:2]
    x1, y1, x2, y2 = bbox
    color = (0, 220, 0)
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = max(0.45, h / 720 * 0.45)
    thickness = max(1, int(font_scale * 1.5))
    box_thickness = max(2, int(font_scale * 1.2))

    cv2.rectangle(output, (x1, y1), (x2, y2), color, box_thickness)
    label = f"{display_name} {confidence:.2f}".strip()
    (text_w, text_h), baseline = cv2.getTextSize(label, font, font_scale, thickness)
    text_x = int(x1)
    text_y = max(text_h + 4, int(y1) - 4)
    cv2.rectangle(
        output,
        (text_x, text_y - text_h - 3),
        (text_x + text_w + 4, text_y + baseline + 2),
        (0, 0, 0),
        -1,
    )
    cv2.putText(
        output,
        label,
        (text_x + 2, text_y),
        font,
        font_scale,
        color,
        thickness,
        cv2.LINE_AA,
    )
    return output


def _infer_size_for_event(event: DetectionEvent, frame_w: int, frame_h: int, camera=None) -> tuple[int, int]:
    """Resolve the resolution the event bbox was measured in."""
    try:
        infer_w = int(getattr(event, "infer_frame_width", 0) or 0)
        infer_h = int(getattr(event, "infer_frame_height", 0) or 0)
    except (TypeError, ValueError):
        infer_w = infer_h = 0

    if infer_w <= 0 or infer_h <= 0:
        try:
            from ml.client import ml_live_detections_for_camera, ml_service_enabled

            if camera is not None and getattr(camera, "ml_server_id", None) and ml_service_enabled():
                payload = ml_live_detections_for_camera(camera)
                infer_w = int(payload.get("frame_width") or 0)
                infer_h = int(payload.get("frame_height") or 0)
        except Exception:
            pass

    bbox = event.bbox or []
    try:
        x2 = float(bbox[2]) if len(bbox) >= 3 else 0.0
        y2 = float(bbox[3]) if len(bbox) >= 4 else 0.0
    except (TypeError, ValueError, IndexError):
        x2 = y2 = 0.0

    if infer_w <= 0 or infer_h <= 0:
        # Common ML scaled sizes when bbox clearly isn't in native capture coords.
        for cand_w, cand_h in ((1280, 720), (1920, 1080), (960, 540)):
            if x2 > 0 and y2 > 0 and x2 <= cand_w * 1.02 and y2 <= cand_h * 1.02:
                if frame_w > cand_w * 1.25 or frame_h > cand_h * 1.25:
                    infer_w, infer_h = cand_w, cand_h
                    break

    if infer_w <= 0 or infer_h <= 0:
        if x2 > frame_w or y2 > frame_h:
            infer_w = max(int(x2 * 1.05), frame_w)
            infer_h = max(int(y2 * 1.05), frame_h)
        else:
            infer_w, infer_h = frame_w, frame_h

    return infer_w, infer_h


def _event_bbox_on_frame(event: DetectionEvent, frame_w: int, frame_h: int, camera=None) -> list[int] | None:
    """Map detection bbox from ML infer resolution onto the captured frame."""
    bbox = event.bbox or []
    infer_w, infer_h = _infer_size_for_event(event, frame_w, frame_h, camera=camera)
    if abs(infer_w - frame_w) > 8 or abs(infer_h - frame_h) > 8:
        return _map_bbox_to_capture_frame(bbox, infer_w, infer_h, frame_w, frame_h)
    return _fit_bbox_to_frame(bbox, frame_w, frame_h)


def _draw_detection_on_frame(frame, event: DetectionEvent, camera=None):
    import cv2

    output = frame.copy()
    h, w = output.shape[:2]
    label = _snapshot_label(event)
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = max(0.32, h / 1400)
    thickness = max(1, int(font_scale * 1.4))
    box_thickness = max(1, int(font_scale * 1.6))

    color = (0, 0, 255) if event.is_alert else (0, 220, 0)

    (banner_w, banner_h), baseline = cv2.getTextSize(label, font, font_scale, thickness)
    pad = 5
    cv2.rectangle(
        output,
        (8, 8),
        (14 + banner_w + pad, 14 + banner_h + baseline + pad),
        (0, 0, 0),
        -1,
    )
    cv2.putText(
        output,
        label,
        (12, 14 + banner_h),
        font,
        font_scale,
        (255, 255, 255),
        thickness,
        cv2.LINE_AA,
    )

    cam = camera if camera is not None else getattr(event, "camera", None)
    fitted = _event_bbox_on_frame(event, w, h, camera=cam)
    if fitted:
        x1, y1, x2, y2 = fitted
        cv2.rectangle(output, (x1, y1), (x2, y2), color, box_thickness)
        box_font_scale = max(0.28, h / 1600)
        box_thickness_text = max(1, int(box_font_scale * 1.4))
        (text_w, text_h), text_base = cv2.getTextSize(label, font, box_font_scale, box_thickness_text)
        text_x = x1
        text_y = max(text_h + 6, y1 - 6)
        cv2.rectangle(
            output,
            (text_x, text_y - text_h - 4),
            (text_x + text_w + 6, text_y + text_base + 3),
            (0, 0, 0),
            -1,
        )
        cv2.putText(
            output,
            label,
            (text_x + 3, text_y),
            font,
            box_font_scale,
            color,
            box_thickness_text,
            cv2.LINE_AA,
        )

    return output


def _mjpeg_url_to_jpeg_url(url: str) -> str | None:
    """Map continuous MJPEG paths to single-frame JPEG (same query string)."""
    text = (url or "").strip()
    if not text:
        return None
    for old, new in (
        ("/mjpeg/attendance", "/jpeg/attendance"),
        ("/mjpeg/raw", "/jpeg/raw"),
        ("/mjpeg", "/jpeg"),
    ):
        if old in text:
            return text.replace(old, new, 1)
    if "/jpeg" in text:
        return text
    return None


def _read_jpeg_snapshot(jpeg_url: str, *, timeout_sec: float = 4.0) -> object | None:
    """Fetch one JPEG from ML. Fail fast so snapshot threads do not hold DB slots."""
    try:
        import cv2
        import numpy as np
    except ImportError:
        logger.warning("OpenCV not available for snapshot capture")
        return None

    deadline = time.monotonic() + max(1.0, min(6.0, float(timeout_sec)))
    last_status = None
    attempts = 0
    while time.monotonic() < deadline and attempts < 2:
        attempts += 1
        remaining = max(0.8, deadline - time.monotonic())
        try:
            resp = requests.get(jpeg_url, timeout=(1.5, min(3.5, remaining)))
        except requests.Timeout:
            last_status = "timeout"
            break
        except requests.RequestException as exc:
            logger.warning("ML snapshot capture failed: %s", exc)
            return None
        last_status = resp.status_code
        if resp.status_code == 404:
            logger.warning(
                "ML snapshot camera not registered: %s",
                _safe_snapshot_url(jpeg_url),
            )
            return None
        if resp.status_code == 503 or resp.status_code != 200 or not resp.content:
            time.sleep(0.2)
            continue
        arr = np.frombuffer(resp.content, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is not None:
            return frame
        time.sleep(0.15)
    logger.warning(
        "ML snapshot not ready after %.0fs (%s): %s",
        timeout_sec,
        last_status,
        _safe_snapshot_url(jpeg_url),
    )
    return None


def _read_mjpeg_snapshot(mjpeg_url: str, *, timeout_sec: float = 4.0) -> object | None:
    """Read one JPEG frame. Prefers /jpeg so workers do not hang on the live MJPEG stream."""
    jpeg_url = _mjpeg_url_to_jpeg_url(mjpeg_url)
    if jpeg_url:
        return _read_jpeg_snapshot(jpeg_url, timeout_sec=float(timeout_sec))
    return None


def _read_rtsp_snapshot(stream_url: str) -> object | None:
    """Grab one frame from RTSP via ffmpeg."""
    try:
        import cv2
    except ImportError:
        return None

    temp_dir = os.path.join(settings.MEDIA_ROOT, "detection_clips", "_tmp")
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, f"snap_{int(time.time() * 1000)}.jpg")
    cmd = [
        ffmpeg_path(),
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        *hwaccel_input_flags(),
        *_rtsp_input_extra(),
        "-i",
        stream_url,
        "-frames:v",
        "1",
    ]
    vf = gpu_aware_vf(None)
    if vf:
        cmd += ["-vf", vf]
    cmd += [
        "-q:v",
        "2",
        "-y",
        
        temp_path,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=10)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        logger.warning("RTSP snapshot ffmpeg failed: %s", exc)
        return None

    frame = None
    try:
        if os.path.isfile(temp_path) and os.path.getsize(temp_path) > 0:
            frame = cv2.imread(temp_path)
    finally:
        try:
            if os.path.isfile(temp_path):
                os.remove(temp_path)
        except OSError:
            pass

    if proc.returncode != 0 or frame is None:
        return None
    return frame


def _warm_ml_stream(camera) -> None:
    """Kick the ML RTSP session without blocking on a full JPEG poll."""
    camera_id = getattr(camera, "pk", None)
    if _ml_on_cooldown(int(camera_id or 0)):
        return
    raw_url = _ml_raw_mjpeg_url(camera)
    jpeg_url = _mjpeg_url_to_jpeg_url(raw_url or "")
    if jpeg_url:
        try:
            requests.get(jpeg_url, timeout=(1.0, 1.2))
        except requests.RequestException:
            pass
        return
    try:
        from ml.client import ml_live_detections_for_camera, ml_service_enabled
    except ImportError:
        return
    if not ml_service_enabled() or not getattr(camera, "ml_server_id", None):
        return
    try:
        ml_live_detections_for_camera(camera)
    except Exception:
        pass


def capture_detection_clip_sync(camera_id: int, event_id: int) -> None:
    """Capture one annotated snapshot for this detection event."""
    from .models import Camera, ClipStatus, DetectionEvent

    if not _clip_enabled():
        _update_clip_status(event_id, ClipStatus.SKIPPED)
        return

    close_old_connections()

    try:
        camera = Camera.objects.select_related("nvr").get(pk=camera_id)
        event = DetectionEvent.objects.get(pk=event_id)
    except (Camera.DoesNotExist, DetectionEvent.DoesNotExist):
        _release_db()
        return

    if event.clip_status == ClipStatus.SKIPPED:
        _release_db()
        return

    if event.clip:
        _update_clip_status(event_id, ClipStatus.READY)
        _link_journey_snapshot(event_id)
        _link_object_tracking_snapshot(event_id)
        _release_db()
        return

    _update_clip_status(event_id, ClipStatus.RECORDING)

    try:
        import cv2
    except ImportError:
        _update_clip_status(event_id, ClipStatus.FAILED)
        return

    stream_url = camera.effective_stream_url()
    _release_db()

    # Prefer ML same-frame evidence (YOLO frame) — avoids stale bbox on a later RTSP grab.
    frame = _read_ml_evidence_frame(camera)

    if frame is None and stream_url and _allow_direct_rtsp():
        frame = _read_rtsp_snapshot(stream_url)

    if frame is None and not _ml_on_cooldown(camera_id):
        raw_mjpeg_url = _ml_raw_mjpeg_url(camera)
        if raw_mjpeg_url:
            frame = _read_mjpeg_snapshot(raw_mjpeg_url, timeout_sec=4.0)
            if frame is None:
                _mark_ml_fail(camera_id)

    if frame is None:
        if not stream_url and not _ml_raw_mjpeg_url(camera):
            _update_clip_status(event_id, ClipStatus.SKIPPED)
        else:
            _update_clip_status(event_id, ClipStatus.FAILED)
        return

    annotated = _draw_detection_on_frame(frame, event, camera=camera)
    ok, encoded = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
    if not ok or encoded is None:
        logger.warning("JPEG encode failed for detection event %s", event_id)
        _update_clip_status(event_id, ClipStatus.FAILED)
        return

    try:
        event.refresh_from_db(fields=["clip", "clip_status"])
        if event.clip:
            _update_clip_status(event_id, ClipStatus.READY)
            _link_journey_snapshot(event_id)
            _link_object_tracking_snapshot(event_id)
            return

        filename = f"event_{event_id}.jpg"
        event.clip.save(filename, ContentFile(encoded.tobytes()), save=True)
        _update_clip_status(event_id, ClipStatus.READY)
        _link_journey_snapshot(event_id)
        _link_object_tracking_snapshot(event_id)
        logger.info(
            "Saved detection snapshot for event %s (%s) class=%s",
            event_id,
            event.clip.name,
            _snapshot_label(event),
        )
    except Exception:
        logger.exception("Failed to save snapshot for detection event %s", event_id)
        _update_clip_status(event_id, ClipStatus.FAILED)
    finally:
        _release_db()


def _process_clip_jobs() -> None:
    global _clip_workers
    while True:
        with _queue_guard:
            if not _clip_jobs:
                _clip_workers -= 1
                return
            camera_id, event_id = _clip_jobs.popleft()
            _clip_job_ids.discard(event_id)
        try:
            with _camera_lock(camera_id):
                capture_detection_clip_sync(camera_id, event_id)
        except Exception:
            logger.exception(
                "Detection snapshot worker failed camera=%s event=%s",
                camera_id,
                event_id,
            )
        finally:
            _release_db()


def _enqueue_clip(camera_id: int, event_id: int) -> None:
    global _clip_workers
    dropped = None
    spawn = False
    with _queue_guard:
        if event_id in _clip_job_ids:
            return
        if len(_clip_jobs) >= _max_clip_queue():
            dropped = _clip_jobs.popleft()
            _clip_job_ids.discard(dropped[1])
        _clip_jobs.append((camera_id, event_id))
        _clip_job_ids.add(event_id)
        spawn = _clip_workers < _max_clip_workers()
        if spawn:
            _clip_workers += 1
    if dropped:
        logger.warning(
            "Detection snapshot queue full; dropped event %s",
            dropped[1],
        )
    if spawn:
        threading.Thread(
            target=_process_clip_jobs,
            daemon=True,
            name="det-snapshot-worker",
        ).start()


def requeue_pending_clips(*, limit: int = 200) -> int:
    """Enqueue pending snapshots left from a previous run."""
    from .models import ClipStatus, DetectionEvent

    close_old_connections()
    DetectionEvent.objects.filter(
        clip_status=ClipStatus.RECORDING,
        clip="",
    ).update(clip_status=ClipStatus.PENDING)

    rows = list(
        DetectionEvent.objects.filter(clip_status=ClipStatus.PENDING, clip="")
        .order_by("created_at")
        .values_list("camera_id", "id")[:limit]
    )
    _release_db()
    for camera_id, event_id in rows:
        _enqueue_clip(camera_id, event_id)
    if rows:
        logger.info("[snapshot-capture] Re-queued %s pending snapshot(s)", len(rows))
    return len(rows)


def schedule_detection_clip(camera_id: int, event_id: int) -> None:
    """Queue snapshot capture for a detection event."""
    from .models import ClipStatus

    if not _clip_enabled():
        _update_clip_status(event_id, ClipStatus.SKIPPED)
        return

    _enqueue_clip(camera_id, event_id)


def _ml_annotated_mjpeg_url(camera) -> str | None:
    try:
        from ml.client import MLServiceError, ml_live_mjpeg_url_for_camera, ml_service_enabled
    except ImportError:
        return None
    if not ml_service_enabled() or not getattr(camera, "ml_server_id", None):
        return None
    try:
        return ml_live_mjpeg_url_for_camera(camera)
    except MLServiceError:
        return None


def _attendance_video_seconds() -> float:
    return max(1.0, float(getattr(settings, "ATTENDANCE_VIDEO_SECONDS", 5)))


def _attendance_video_fps() -> int:
    return max(4, min(25, int(getattr(settings, "ATTENDANCE_VIDEO_FPS", 10))))


def _attendance_video_width() -> int:
    return max(0, min(4096, int(getattr(settings, "ATTENDANCE_VIDEO_WIDTH", 3840))))


def _attendance_jpeg_quality() -> int:
    return max(80, min(100, int(getattr(settings, "ATTENDANCE_VIDEO_JPEG_QUALITY", 95))))


def _attendance_video_crf() -> int:
    return max(15, min(28, int(getattr(settings, "ATTENDANCE_VIDEO_CRF", 18))))


def _journey_snapshot_width() -> int:
    """Target width in pixels; 0 = keep native camera resolution."""
    try:
        value = int(getattr(settings, "JOURNEY_SNAPSHOT_WIDTH", 3840))
    except (TypeError, ValueError):
        value = 3840
    if value <= 0:
        return 0
    return max(640, min(4096, value))


def _journey_snapshot_native() -> bool:
    return bool(getattr(settings, "JOURNEY_SNAPSHOT_NATIVE", False))


def _allow_direct_rtsp() -> bool:
    """When False, snapshots must use the shared ML Camera Session (no second FFmpeg)."""
    return bool(getattr(settings, "CLIP_ALLOW_DIRECT_RTSP", False))


def _journey_jpeg_quality() -> int:
    return max(95, min(100, int(getattr(settings, "JOURNEY_SNAPSHOT_JPEG_QUALITY", 98))))


def _journey_snapshot_full_frame() -> bool:
    return bool(getattr(settings, "JOURNEY_SNAPSHOT_FULL_FRAME", True))


def _upscale_frame_to_hd(frame, target_width: int):
    upscaled = _upscale_frames_to_hd([frame], target_width)
    return upscaled[0] if upscaled else frame


def _read_rtsp_native_snapshot(stream_url: str) -> object | None:
    """Grab one frame at the camera's native main-stream resolution (no scaling)."""
    try:
        import cv2
    except ImportError:
        return None

    _throttle_ffmpeg_spawn()
    temp_dir = os.path.join(settings.MEDIA_ROOT, "detection_clips", "_tmp")
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, f"journey_native_{int(time.time() * 1000)}.jpg")
    cmd = [
        ffmpeg_path(),
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        *hwaccel_input_flags(),
        *_rtsp_input_extra(),
        "-i",
        stream_url,
        "-frames:v",
        "1",
    ]
    vf = gpu_aware_vf(None)
    if vf:
        cmd += ["-vf", vf]
    cmd += [
        "-q:v",
        "1",
        "-y",
        temp_path,
    ]
    try:
        timeout = max(5, int(os.getenv("FFMPEG_SNAPSHOT_TIMEOUT_SEC", "12")))
        proc = subprocess.run(cmd, capture_output=True, timeout=timeout)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        logger.warning("Journey native RTSP snapshot failed: %s", exc)
        return None

    frame = None
    try:
        if os.path.isfile(temp_path) and os.path.getsize(temp_path) > 0:
            frame = cv2.imread(temp_path)
    finally:
        try:
            if os.path.isfile(temp_path):
                os.remove(temp_path)
        except OSError:
            pass

    if proc.returncode != 0 or frame is None:
        return None
    return frame


def _read_rtsp_hd_snapshot(stream_url: str, *, target_width: int) -> object | None:
    """Grab one frame from RTSP, scaling to target_width when the stream is smaller."""
    if target_width <= 0:
        return _read_rtsp_native_snapshot(stream_url)
    try:
        import cv2
    except ImportError:
        return None

    temp_dir = os.path.join(settings.MEDIA_ROOT, "detection_clips", "_tmp")
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, f"journey_hd_{int(time.time() * 1000)}.jpg")
    cmd = [
        ffmpeg_path(),
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        *hwaccel_input_flags(),
        *_rtsp_input_extra(),
        "-i",
        stream_url,
        "-frames:v",
        "1",
        "-vf",
        gpu_aware_vf(f"scale='min(iw,{target_width})':-2:flags=lanczos"),
        "-q:v",
        "1",
        "-y",
        temp_path,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=10)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        logger.warning("Journey HD RTSP snapshot failed: %s", exc)
        return None

    frame = None
    try:
        if os.path.isfile(temp_path) and os.path.getsize(temp_path) > 0:
            frame = cv2.imread(temp_path)
    finally:
        try:
            if os.path.isfile(temp_path):
                os.remove(temp_path)
        except OSError:
            pass

    if proc.returncode != 0 or frame is None:
        return None
    return frame


def read_journey_hd_frame(camera: Camera) -> object | None:
    """Full-resolution frame for journey snapshots — shared ML session first."""
    target_width = _journey_snapshot_width()
    prefer_native = _journey_snapshot_native() or target_width <= 0
    stream_url = camera.effective_stream_url() if camera else ""
    camera_id = getattr(camera, "pk", None)
    allow_rtsp = _allow_direct_rtsp()

    # 1) Shared Camera Session (same decode as live / YOLO) — preferred.
    if not _ml_on_cooldown(int(camera_id or 0)):
        ml_width = target_width if target_width > 0 else 3840
        attendance_url = _ml_attendance_mjpeg_url(camera, target_width=ml_width)
        if attendance_url:
            frame = _read_mjpeg_snapshot(attendance_url, timeout_sec=4.0)
            if frame is not None:
                if target_width > 0:
                    return _upscale_frame_to_hd(frame, target_width)
                return frame
            _mark_ml_fail(camera_id)

        raw_url = _ml_raw_mjpeg_url(camera)
        if raw_url and not _ml_on_cooldown(int(camera_id or 0)):
            frame = _read_mjpeg_snapshot(raw_url, timeout_sec=4.0)
            if frame is None:
                _mark_ml_fail(camera_id)
            elif target_width > 0:
                return _upscale_frame_to_hd(frame, target_width)
            else:
                return frame

    # 2) Optional direct RTSP (disabled under shared-session architecture).
    if allow_rtsp and stream_url and prefer_native:
        frame = _read_rtsp_native_snapshot(stream_url)
        if frame is not None:
            h, w = frame.shape[:2]
            logger.debug("Journey snapshot native RTSP %sx%s from camera %s", w, h, camera.pk)
            if target_width <= 0 or w >= target_width:
                return frame
            return _upscale_frame_to_hd(frame, target_width)

    if allow_rtsp and stream_url and target_width > 0:
        frame = _read_rtsp_hd_snapshot(stream_url, target_width=target_width)
        if frame is not None:
            return frame

    if allow_rtsp and stream_url:
        frame = _read_rtsp_snapshot(stream_url)
        if frame is not None:
            if target_width > 0:
                return _upscale_frame_to_hd(frame, target_width)
            return frame

    return None


def read_journey_detect_frame(camera: Camera) -> object | None:
    """
    Frame in the SAME resolution as live ML detections (no HD upscale).

    Upscaling after grab misplaces bboxes onto empty wall/floor. Person crops
    must use this path so track boxes line up with the pixels we crop.
    """
    camera_id = getattr(camera, "pk", None)
    if _ml_on_cooldown(int(camera_id or 0)):
        return None

    # Raw YOLO / session frame — matches detection coordinates 1:1.
    raw_url = _ml_raw_mjpeg_url(camera)
    if raw_url:
        frame = _read_mjpeg_snapshot(raw_url, timeout_sec=4.0)
        if frame is not None:
            return frame
        _mark_ml_fail(camera_id)

    return None


def draw_journey_snapshot_on_frame(
    frame,
    *,
    bbox: list[int] | None,
    person_label: str = "",
    camera_name: str = "",
    confidence: float | None = None,
):
    """Annotate a full camera frame with only the person bounding box (no text labels)."""
    import cv2

    output = frame.copy()
    if not bbox:
        return output

    h, w = output.shape[:2]
    font_scale = max(0.7, h / 1080 * 0.75)
    box_thickness = max(3, int(font_scale * 2.0))

    x1, y1, x2, y2 = [int(v) for v in bbox]
    color = (0, 220, 0)
    cv2.rectangle(output, (x1, y1), (x2, y2), color, box_thickness)
    return output


def _upscale_frames_to_hd(frames: list, target_width: int) -> list:
    """Upscale frames to HD width when the capture source was lower resolution."""
    try:
        import cv2
    except ImportError:
        return frames
    if not frames:
        return frames
    h, w = frames[0].shape[:2]
    if w >= target_width:
        return frames
    scale = target_width / float(w)
    new_w = target_width
    new_h = max(1, int(h * scale))
    return [cv2.resize(f, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4) for f in frames]


def _read_rtsp_clip(
    stream_url: str,
    *,
    duration_sec: float,
    max_fps: int,
    target_width: int,
    on_frame=None,
) -> list:
    """Capture HD frames directly from RTSP via ffmpeg (best quality for attendance clips)."""
    try:
        import cv2
        import glob
        import shutil
    except ImportError:
        return []

    temp_dir = os.path.join(
        settings.MEDIA_ROOT,
        "attendance",
        "videos",
        "_tmp",
        f"rtsp_{int(time.time() * 1000)}",
    )
    os.makedirs(temp_dir, exist_ok=True)
    pattern = os.path.join(temp_dir, "frame_%04d.jpg")

    cmd = [
        ffmpeg_path(),
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        *hwaccel_input_flags(),
        *_rtsp_input_extra(),
        "-i",
        stream_url,
        "-t",
        f"{duration_sec:.2f}",
    ]
    vf = gpu_aware_vf(f"scale='min(iw,{target_width})':-2:flags=lanczos" if target_width > 0 else None)
    if vf:
        cmd += ["-vf", vf]
    cmd += [
        "-r",
        str(max(4, max_fps)),
        "-q:v",
        "2",
        pattern,
    ]
    frames: list = []
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=int(duration_sec) + 60)
        if proc.returncode != 0:
            logger.warning("RTSP clip ffmpeg failed: %s", (proc.stderr or b"")[:300])
            return []
        for path in sorted(glob.glob(os.path.join(temp_dir, "frame_*.jpg"))):
            frame = cv2.imread(path)
            if frame is None:
                continue
            if on_frame is not None:
                frame = on_frame(frame)
            frames.append(frame)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        logger.warning("RTSP clip capture failed: %s", exc)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
    return frames


def _read_mjpeg_clip(
    mjpeg_url: str,
    *,
    duration_sec: float,
    max_fps: int = 10,
    on_frame=None,
) -> list:
    """Collect frames from MJPEG for the full wall-clock duration."""
    try:
        import cv2
        import numpy as np
    except ImportError:
        return []

    frames: list = []
    end_time = time.monotonic() + duration_sec
    min_interval = 1.0 / max(1, max_fps)
    last_saved = 0.0

    try:
        with requests.get(
            mjpeg_url,
            stream=True,
            timeout=(5, max(30, int(duration_sec) + 15)),
        ) as resp:
            if resp.status_code != 200:
                return []
            buffer = b""
            for chunk in resp.iter_content(chunk_size=8192):
                if time.monotonic() >= end_time:
                    break
                if not chunk:
                    time.sleep(0.01)
                    continue
                buffer += chunk
                while True:
                    start = buffer.find(b"\xff\xd8")
                    end = buffer.find(b"\xff\xd9")
                    if start == -1 or end == -1 or end < start:
                        break
                    jpg = buffer[start : end + 2]
                    buffer = buffer[end + 2 :]
                    arr = np.frombuffer(jpg, dtype=np.uint8)
                    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                    if frame is None:
                        continue
                    now = time.monotonic()
                    if now - last_saved < min_interval:
                        continue
                    last_saved = now
                    if on_frame is not None:
                        frame = on_frame(frame)
                    frames.append(frame)
    except requests.RequestException as exc:
        logger.warning("MJPEG clip capture failed: %s", exc)
    return frames


def _encode_frames_to_mp4(frames: list, dest_path: str, *, duration_sec: float, nominal_fps: int) -> bool:
    if not frames:
        return False
    try:
        import cv2
    except ImportError:
        return False

    import tempfile

    h, w = frames[0].shape[:2]
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    output_fps = max(1.0, len(frames) / max(0.5, float(duration_sec)))
    jpeg_q = _attendance_jpeg_quality()
    crf = _attendance_video_crf()

    with tempfile.TemporaryDirectory(prefix="att_clip_") as tmp:
        for idx, frame in enumerate(frames):
            path = os.path.join(tmp, f"frame_{idx:04d}.jpg")
            if not cv2.imwrite(path, frame, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_q]):
                return False

        cmd = [
            ffmpeg_path(),
            "-y",
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-framerate",
            f"{output_fps:.3f}",
            "-i",
            os.path.join(tmp, "frame_%04d.jpg"),
            "-c:v",
            "libx264",
            "-crf",
            str(crf),
            "-preset",
            "medium",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            dest_path,
        ]
        try:
            proc = subprocess.run(cmd, capture_output=True, timeout=90)
        except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
            logger.warning("ffmpeg MP4 encode failed: %s", exc)
            return False

        if proc.returncode == 0 and os.path.isfile(dest_path) and os.path.getsize(dest_path) > 0:
            return True

        # Fallback codec when libx264 is unavailable.
        cmd[cmd.index("libx264")] = "mpeg4"
        try:
            proc = subprocess.run(cmd, capture_output=True, timeout=90)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False
        return proc.returncode == 0 and os.path.isfile(dest_path) and os.path.getsize(dest_path) > 0


def _attendance_overlay(label: str, employee_name: str, class_name: str, bbox: list):
    from types import SimpleNamespace

    display_name = (employee_name or label or "staff").strip()[:80]
    return SimpleNamespace(
        label=(label or "")[:120],
        class_name=(class_name or "person")[:80],
        employee_name=display_name,
        bbox=bbox or [],
        is_alert=False,
    )


def _attendance_snapshot_enabled() -> bool:
    return bool(getattr(settings, "ATTENDANCE_SNAPSHOT_ENABLED", True))


def capture_attendance_snapshot_sync(
    camera_id: int,
    attendance_id: int,
    *,
    label: str,
    employee_name: str,
    class_name: str,
    bbox: list,
    confidence: float,
    action: str,
    infer_frame_w: int = 0,
    infer_frame_h: int = 0,
) -> None:
    """Capture one annotated JPEG snapshot for the attendance record (no video)."""
    from users.models import Attendance

    if not _attendance_snapshot_enabled():
        return

    close_old_connections()

    try:
        from .models import Camera

        camera = Camera.objects.select_related("nvr").get(pk=camera_id)
        attendance = Attendance.objects.get(pk=attendance_id)
    except (Camera.DoesNotExist, Attendance.DoesNotExist):
        _release_db()
        return

    try:
        import cv2
    except ImportError:
        logger.warning("OpenCV not available for attendance snapshot capture")
        _release_db()
        return

    hd_width = _attendance_video_width()
    jpeg_q = _attendance_jpeg_quality()
    display_name = (employee_name or label or "staff").strip()[:80]
    stream_url = camera.effective_stream_url()
    skip_ml = _ml_on_cooldown(camera_id)
    _release_db()

    frame = None

    if not skip_ml:
        _warm_ml_stream(camera)

    # 1) Single HD frame from ML attendance JPEG/MJPEG endpoint
    attendance_url = None if skip_ml else _ml_attendance_mjpeg_url(camera, target_width=hd_width)
    if attendance_url:
        frame = _read_mjpeg_snapshot(attendance_url, timeout_sec=6.0)

    # 2) Raw MJPEG / JPEG
    if frame is None and not skip_ml:
        raw_url = _ml_raw_mjpeg_url(camera)
        if raw_url:
            frame = _read_mjpeg_snapshot(raw_url, timeout_sec=6.0)
            if frame is not None and hd_width > 0:
                upscaled = _upscale_frames_to_hd([frame], hd_width)
                frame = upscaled[0] if upscaled else frame

    # 3) Direct RTSP one-shot (only when shared-session RTSP fallback is enabled)
    if frame is None and stream_url and _allow_direct_rtsp():
        if hd_width > 0:
            frame = _read_rtsp_hd_snapshot(stream_url, target_width=hd_width)
        if frame is None:
            frame = _read_rtsp_snapshot(stream_url)
            if frame is not None and hd_width > 0:
                upscaled = _upscale_frames_to_hd([frame], hd_width)
                frame = upscaled[0] if upscaled else frame

    if frame is None:
        logger.warning("Could not capture attendance snapshot for record %s", attendance_id)
        return

    h, w = frame.shape[:2]
    fitted, conf = _staff_bbox_from_ml(
        camera,
        label,
        employee_name,
        w,
        h,
        bbox or [],
        fallback_confidence=confidence,
        infer_frame_w=int(infer_frame_w or 0),
        infer_frame_h=int(infer_frame_h or 0),
    )
    annotated = _draw_attendance_staff_on_frame(
        frame,
        bbox=fitted,
        display_name=display_name,
        confidence=conf,
    )

    try:
        attendance.refresh_from_db(fields=["image", "video"])
        ok, encoded = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_q])
        if not ok or encoded is None:
            logger.warning("Failed to encode attendance JPEG for record %s", attendance_id)
            return

        attendance.image.save(
            f"attendance_{attendance_id}_{action}.jpg",
            ContentFile(encoded.tobytes()),
            save=False,
        )
        # Snapshots only — do not create or keep new video clips.
        if attendance.video:
            try:
                attendance.video.delete(save=False)
            except Exception:
                attendance.video = None
        attendance.save(update_fields=["image", "video"])
        logger.info(
            "Saved attendance snapshot for record %s image=%s action=%s size=%sx%s",
            attendance_id,
            attendance.image.name if attendance.image else "none",
            action,
            w,
            h,
        )
    except Exception:
        logger.exception("Failed to save attendance snapshot for record %s", attendance_id)
    finally:
        _release_db()


def _process_attendance_jobs() -> None:
    global _attendance_workers
    while True:
        with _queue_guard:
            if not _attendance_jobs:
                _attendance_workers -= 1
                return
            payload = _attendance_jobs.popleft()
        camera_id = int(payload.get("camera_id") or 0)
        try:
            with _camera_lock(camera_id):
                capture_attendance_snapshot_sync(**payload)
        except Exception:
            logger.exception(
                "Attendance snapshot worker failed camera=%s attendance=%s",
                camera_id,
                payload.get("attendance_id"),
            )
        finally:
            _release_db()


def schedule_attendance_snapshot(
    camera_id: int,
    attendance_id: int,
    *,
    label: str,
    employee_name: str,
    class_name: str,
    bbox: list,
    confidence: float,
    action: str,
    infer_frame_w: int = 0,
    infer_frame_h: int = 0,
) -> None:
    """Queue a single attendance proof snapshot (JPEG only)."""
    global _attendance_workers
    if not _attendance_snapshot_enabled():
        return

    payload = {
        "camera_id": camera_id,
        "attendance_id": attendance_id,
        "label": label,
        "employee_name": employee_name,
        "class_name": class_name,
        "bbox": bbox,
        "confidence": confidence,
        "action": action,
        "infer_frame_w": infer_frame_w,
        "infer_frame_h": infer_frame_h,
    }

    spawn = False
    with _queue_guard:
        if len(_attendance_jobs) >= _MAX_ATTENDANCE_QUEUE:
            dropped = _attendance_jobs.popleft()
            logger.warning(
                "Attendance snapshot queue full; dropped record %s",
                dropped.get("attendance_id"),
            )
        _attendance_jobs.append(payload)
        spawn = _attendance_workers < _MAX_ATTENDANCE_WORKERS
        if spawn:
            _attendance_workers += 1
    if spawn:
        threading.Thread(
            target=_process_attendance_jobs,
            daemon=True,
            name="attendance-snapshot-worker",
        ).start()
