from __future__ import annotations

import logging
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime

import cv2
import numpy as np
from django.conf import settings
from django.db import close_old_connections

from config.db import release_db

from recognition.models import FaceEnrollment
from recognition.services.face_engine import get_face_engine
from recognition.services.rtsp_utils import open_rtsp_capture
from recognition.services.snapshot_saver import save_detection_snapshot, snapshot_to_dict

logger = logging.getLogger(__name__)

MIN_FACE_PX = 40
MIN_DET_SCORE = 0.55
UPSCALE_BELOW_PX = 110
UPSCALE_FACTOR = 2.5


def _match_cooldown() -> int:
    return max(30, int(getattr(settings, "ATTENDANCE_CAMERA_MARK_COOLDOWN_SECONDS", 120)))


def _cctv_infer_max_width() -> int:
    return max(0, int(getattr(settings, "ATTENDANCE_VIDEO_WIDTH", 3840)))


def _cctv_use_shared_session() -> bool:
    """Prefer ML Camera Session frames (one decode) over a second OpenCV RTSP."""
    return str(getattr(settings, "ATTENDANCE_CCTV_FRAME_SOURCE", "shared")).strip().lower() in (
        "shared",
        "ml",
        "session",
        "1",
        "true",
        "yes",
    )


def _decode_jpeg_bgr(jpeg: bytes):
    if not jpeg:
        return None
    arr = np.frombuffer(jpeg, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def _fetch_shared_session_frame(camera_id: int, stream_key: str, rtsp_url: str):
    """Pull one BGR frame from the shared ML Camera Session (no extra FFmpeg)."""
    import requests
    from urllib.parse import urlencode

    from cameras.models import Camera
    from ml.client import (
        MLServiceError,
        ml_live_jpeg_raw_url_for_camera,
        ml_service_enabled,
        require_camera_ml_url,
    )

    if not ml_service_enabled():
        return None, "ML service disabled"

    camera = Camera.objects.filter(pk=camera_id).select_related("nvr", "ml_server").first()
    if camera is None:
        return None, f"Camera {camera_id} not found"

    urls: list[str] = []
    try:
        base = require_camera_ml_url(camera)
        key = (stream_key or camera.stream_key or f"cam-{camera_id}").strip()
        width = _cctv_infer_max_width() or 1280
        params = {"width": str(max(640, min(4096, int(width))))}
        if rtsp_url:
            params["rtsp_url"] = rtsp_url
        urls.append(f"{base}/live/cam/{key}/jpeg/attendance?{urlencode(params)}")
        urls.append(ml_live_jpeg_raw_url_for_camera(camera))
    except (MLServiceError, Exception) as exc:
        return None, str(exc)

    last_err = "No ML JPEG URL"
    for url in urls:
        if not url:
            continue
        try:
            resp = requests.get(url, timeout=(2.0, 4.0))
            if resp.status_code != 200 or not resp.content:
                last_err = f"HTTP {resp.status_code}"
                continue
            frame = _decode_jpeg_bgr(resp.content)
            if frame is None:
                last_err = "JPEG decode failed"
                continue
            return frame, ""
        except requests.RequestException as exc:
            last_err = str(exc)
            continue
    return None, last_err

def _emit_attendance_realtime(*, throttle_sec: float = 1.5) -> None:
    """Push monitor/dashboard refresh when in-memory CCTV runtime changes."""
    try:
        from realtime.sio_app import emit_invalidate

        emit_invalidate(
            ["attendance", "recognition", "hr"],
            throttle_sec=throttle_sec,
        )
    except Exception:
        logger.debug("[cctv] realtime emit skipped", exc_info=True)


def _cctv_threshold() -> float:
    return float(getattr(settings, "ATTENDANCE_CCTV_SIMILARITY_THRESHOLD", 0.38))


@dataclass
class CameraRuntimeState:
    camera_id: int
    name: str
    running: bool = False
    connected: bool = False
    last_error: str = ""
    last_frame_at: str | None = None
    frames_processed: int = 0
    gallery_size: int = 0
    last_events: deque = field(default_factory=lambda: deque(maxlen=30))
    last_jpeg: bytes | None = None
    thread: threading.Thread | None = None
    stop_event: threading.Event = field(default_factory=threading.Event)
    match_cooldown: dict = field(default_factory=dict)


class CCTVWorkerManager:
    _gallery_lock = threading.Lock()
    _gallery_cache: dict[str, list[float]] = {}
    _gallery_at = 0.0
    _GALLERY_TTL = 30.0

    def __init__(self):
        self._lock = threading.Lock()
        self._cameras: dict[int, CameraRuntimeState] = {}
        self._scan_interval = 1.5
        self._frame_skip = 8

    def list_status(self) -> list[dict]:
        with self._lock:
            return [self._status_dict(state) for state in self._cameras.values()]

    def get_status(self, camera_id: int) -> dict | None:
        with self._lock:
            state = self._cameras.get(camera_id)
            return self._status_dict(state) if state else None

    def get_snapshot_jpeg(self, camera_id: int) -> bytes | None:
        with self._lock:
            state = self._cameras.get(camera_id)
            return state.last_jpeg if state else None

    def get_events(self, camera_id: int | None = None, limit: int = 40) -> list[dict]:
        with self._lock:
            if camera_id is not None:
                state = self._cameras.get(camera_id)
                if not state:
                    return []
                return list(state.last_events)[:limit]

            events = []
            for state in self._cameras.values():
                events.extend(state.last_events)
            events.sort(key=lambda e: e.get("time", ""), reverse=True)
            return events[:limit]

    def start_camera(
        self,
        camera_id: int,
        name: str,
        rtsp_url: str,
        start_delay: float = 0.0,
        stream_key: str = "",
    ) -> dict:
        with self._lock:
            existing = self._cameras.get(camera_id)
            if existing and existing.running:
                return self._status_dict(existing)

            stop_event = threading.Event()
            state = CameraRuntimeState(
                camera_id=camera_id,
                name=name,
                stop_event=stop_event,
            )
            thread = threading.Thread(
                target=self._run_camera,
                args=(state, rtsp_url, start_delay, stream_key or f"cam-{camera_id}"),
                name=f"cctv-attendance-{camera_id}",
                daemon=True,
            )
            state.thread = thread
            state.running = True
            self._cameras[camera_id] = state
            thread.start()
            return self._status_dict(state)

    def stop_camera(self, camera_id: int) -> dict | None:
        with self._lock:
            state = self._cameras.get(camera_id)
            if not state:
                return None
            state.stop_event.set()
            state.running = False
            thread = state.thread

        if thread and thread.is_alive():
            thread.join(timeout=5)

        with self._lock:
            state.connected = False
            return self._status_dict(state)

    def start_all(self, cameras: list[dict]) -> list[dict]:
        return [
            self.start_camera(
                c["id"],
                c["name"],
                c["rtsp_url"],
                start_delay=i * 2.5,
                stream_key=str(c.get("stream_key") or f"cam-{c['id']}"),
            )
            for i, c in enumerate(cameras)
        ]

    def stop_all(self) -> list[dict]:
        with self._lock:
            ids = list(self._cameras.keys())
        results = []
        for cid in ids:
            status = self.stop_camera(cid)
            if status:
                results.append(status)
        return results

    def _status_dict(self, state: CameraRuntimeState) -> dict:
        return {
            "camera_id": state.camera_id,
            "name": state.name,
            "running": state.running,
            "connected": state.connected,
            "last_error": state.last_error,
            "last_frame_at": state.last_frame_at,
            "frames_processed": state.frames_processed,
            "gallery_size": state.gallery_size,
            "recent_events": list(state.last_events)[:8],
            "has_snapshot": state.last_jpeg is not None,
        }

    def _shared_gallery(self) -> dict[str, list[float]]:
        now = time.time()
        with self._gallery_lock:
            if self._gallery_cache and now - self._gallery_at < self._GALLERY_TTL:
                return self._gallery_cache
            gallery = self._build_gallery()
            type(self)._gallery_cache = gallery
            type(self)._gallery_at = now
            return gallery

    def _build_gallery(self) -> dict[str, list[float]]:
        close_old_connections()
        gallery = {}
        try:
            enrollments = FaceEnrollment.objects.filter(
                is_trained=True,
                embedding__isnull=False,
            ).select_related("staff")
            for enrollment in enrollments:
                gallery[enrollment.gallery_key] = enrollment.embedding
            return gallery
        finally:
            release_db()

    def _face_bbox_size(self, face) -> tuple[int, int]:
        bbox = getattr(face, "bbox", None)
        if bbox is None:
            return 0, 0
        x1, y1, x2, y2 = [int(v) for v in bbox]
        return max(x2 - x1, 0), max(y2 - y1, 0)

    def _refine_embedding(self, engine, frame, face):
        bbox = getattr(face, "bbox", None)
        if bbox is None:
            return face.embedding, self._face_bbox_size(face)

        x1, y1, x2, y2 = [int(v) for v in bbox]
        face_w, face_h = max(x2 - x1, 0), max(y2 - y1, 0)
        if face_w >= UPSCALE_BELOW_PX and face_h >= UPSCALE_BELOW_PX:
            return face.embedding, (face_w, face_h)

        h, w = frame.shape[:2]
        pad = int(max(face_w, face_h) * 0.45)
        cx1 = max(0, x1 - pad)
        cy1 = max(0, y1 - pad)
        cx2 = min(w, x2 + pad)
        cy2 = min(h, y2 + pad)
        crop = frame[cy1:cy2, cx1:cx2]
        if crop.size == 0:
            return face.embedding, (face_w, face_h)

        up = cv2.resize(
            crop,
            None,
            fx=UPSCALE_FACTOR,
            fy=UPSCALE_FACTOR,
            interpolation=cv2.INTER_CUBIC,
        )
        refined = engine.detect_faces(up)
        if not refined:
            return face.embedding, (face_w, face_h)

        best = max(refined, key=lambda f: float(getattr(f, "det_score", 0.0)))
        if float(getattr(best, "det_score", 0.0)) < MIN_DET_SCORE:
            return face.embedding, (face_w, face_h)
        return best.embedding, (face_w, face_h)

    def _process_tracked_faces(self, state, engine, tracker, frame_infer, faces, now, cooldown, camera_zone):
        """Same punch path as AI Attendance: track, upscale, match, then confirm."""
        from recognition.services.match_confirm import CONFIRM_CCTV
        from recognition.services.reviews import enqueue_match_review, record_spoof, record_unknown
        from users.attendance_service import AttendanceDecisionEngine
        from users.models import Attendance, Staff

        usable = []
        dets = []
        for face in faces:
            det_score = float(getattr(face, "det_score", 0.0))
            face_w, face_h = self._face_bbox_size(face)
            if det_score < 0.30 or face_w < MIN_FACE_PX or face_h < MIN_FACE_PX:
                continue
            bbox = [float(v) for v in face.bbox]
            usable.append(face)
            dets.append([bbox[0], bbox[1], bbox[2], bbox[3], det_score])

        tracks = tracker.update(np.array(dets, dtype=np.float32) if dets else np.zeros((0, 5), dtype=np.float32))
        for track in tracks:
            if track.det_index is None or track.det_index >= len(usable):
                continue
            face = usable[track.det_index]
            bbox = getattr(face, "bbox", None)
            face_w, face_h = self._face_bbox_size(face)

            if track.staff_id:
                staff_id = track.staff_id
                confidence = float(track.identity_confidence or 0.0)
                gallery_key = f"staff-{staff_id}"
                matched = True
                message = f"Track #{track.track_id} · staff-{staff_id}"
            else:
                live = engine.check_liveness(frame_infer, face, source="cctv")
                if not live.get("passed", True) and not live.get("skipped"):
                    record_spoof(
                        source="cctv",
                        camera_id=state.camera_id,
                        message=live.get("message") or "Spoof",
                    )
                    state.last_events.appendleft({
                        "time": datetime.now().strftime("%H:%M:%S"),
                        "camera_id": state.camera_id,
                        "camera_name": state.name,
                        "matched": False,
                        "staff_id": None,
                        "confidence": 0.0,
                        "message": live.get("message") or "Spoof detected",
                        "track_id": track.track_id,
                        "face_size": f"{face_w}x{face_h}",
                    })
                    continue

                embedding, (face_w, face_h) = self._refine_embedding(engine, frame_infer, face)
                if embedding is None:
                    continue
                match = engine.match_probe(embedding, source="cctv")
                gallery_key = match.get("gallery_key")
                confidence = float(match.get("confidence") or 0.0)
                if gallery_key:
                    staff_id = int(str(gallery_key).replace("staff-", ""))
                    track.staff_id = staff_id
                    track.identity_confidence = confidence
                    matched = True
                    message = f"Track #{track.track_id} identified"
                else:
                    if match.get("ambiguous") or match.get("soft_miss"):
                        if not track.review_queued:
                            track.review_queued = True
                            enqueue_match_review(
                                confidence=confidence,
                                source="cctv",
                                camera_id=state.camera_id,
                                message="Ambiguous match" if match.get("ambiguous") else "Soft miss",
                            )
                        message = "Ambiguous face — not marked" if match.get("ambiguous") else "Possible match held for review"
                    else:
                        record_unknown(
                            confidence=confidence,
                            source="cctv",
                            camera_id=state.camera_id,
                            message="Unknown face",
                        )
                        message = "Unknown face"
                    if confidence >= 0.28 or match.get("ambiguous") or match.get("soft_miss"):
                        state.last_events.appendleft({
                            "time": datetime.now().strftime("%H:%M:%S"),
                            "camera_id": state.camera_id,
                            "camera_name": state.name,
                            "matched": False,
                            "staff_id": None,
                            "confidence": round(confidence, 4),
                            "message": message,
                            "track_id": track.track_id,
                            "face_size": f"{face_w}x{face_h}",
                            "hits": track.hits,
                        })
                    continue

            event = {
                "time": datetime.now().strftime("%H:%M:%S"),
                "camera_id": state.camera_id,
                "camera_name": state.name,
                "matched": matched,
                "staff_id": staff_id,
                "gallery_key": gallery_key,
                "confidence": round(confidence, 4),
                "message": message,
                "face_size": f"{face_w}x{face_h}",
                "track_id": track.track_id,
                "hits": track.hits,
            }
            if track.hits < CONFIRM_CCTV:
                event["message"] = f"Tracking #{track.track_id} ({track.hits}/{CONFIRM_CCTV})"
                event["attendance"] = {
                    "action": "pending",
                    "message": f"Tracking ({track.hits}/{CONFIRM_CCTV})",
                    "status": "",
                }
                state.last_events.appendleft(event)
                continue
            if track.attendance_written:
                state.last_events.appendleft(event)
                continue

            last_match = state.match_cooldown.get(gallery_key, 0.0)
            if now - last_match < cooldown:
                event["message"] = f"Track #{track.track_id} (cooldown)"
                event["attendance"] = {
                    "action": "ignored",
                    "message": "Duplicate recognition within cooldown",
                    "status": "",
                }
                state.last_events.appendleft(event)
                continue

            state.match_cooldown[gallery_key] = now
            close_old_connections()
            staff = Staff.objects.filter(pk=staff_id).select_related("user").first()
            if not staff:
                release_db()
                continue
            decision = AttendanceDecisionEngine.process_recognition(
                staff=staff,
                confidence=confidence,
                source=Attendance.SOURCE_CCTV,
                camera_zone=camera_zone,
            )
            track.attendance_written = True
            event["attendance"] = {
                "action": decision["action"],
                "message": decision["message"],
                "status": decision["record"].status if decision["record"] else "",
            }
            snapshot = save_detection_snapshot(
                staff=staff,
                camera_id=state.camera_id,
                camera_name=state.name,
                frame=frame_infer,
                confidence=confidence,
                attendance_action=decision["action"],
                attendance_record=(
                    decision["record"]
                    if decision["action"] in ("check_in", "check_out")
                    else None
                ),
                bbox=bbox.tolist() if bbox is not None else None,
            )
            if snapshot:
                event["snapshot"] = snapshot_to_dict(snapshot)
                event["message"] = f"Detected on {state.name or 'Camera'}"
            _emit_attendance_realtime(throttle_sec=1.0)
            logger.info(
                "Camera %s track %s: staff-%s -> %s (%.2f)",
                state.camera_id,
                track.track_id,
                staff_id,
                decision["action"],
                confidence,
            )
            release_db()
            state.last_events.appendleft(event)

    def _run_camera(
        self,
        state: CameraRuntimeState,
        rtsp_url: str,
        start_delay: float = 0.0,
        stream_key: str = "",
    ):
        if start_delay > 0:
            state.last_error = f"Waiting {start_delay:.0f}s before connect…"
            if state.stop_event.wait(start_delay):
                state.running = False
                return

        engine = get_face_engine()
        from recognition.services.byte_tracker import BYTETracker
        from recognition.services.gallery_index import get_gallery_index
        from recognition.services.preprocess import apply_clahe_bgr
        from users.attendance_service import camera_attendance_zone

        tracker = BYTETracker()
        camera_zone = "mixed"
        try:
            from cameras.models import Camera

            close_old_connections()
            cam = Camera.objects.filter(pk=state.camera_id).only("zone", "passage_role").first()
            camera_zone = camera_attendance_zone(cam)
        finally:
            release_db()
        gallery_refresh_at = 0.0
        gallery: dict[str, list[float]] = {}
        gallery_warned = False
        cap = None
        frame_index = 0
        reconnect_delay = 5
        cooldown = _match_cooldown()
        last_infer_at = 0.0
        use_shared = _cctv_use_shared_session()
        key = (stream_key or f"cam-{state.camera_id}").strip()

        logger.info(
            "Starting CCTV attendance worker for camera %s (%s) frame_source=%s",
            state.camera_id,
            state.name,
            "shared-session" if use_shared else "rtsp",
        )

        while not state.stop_event.is_set():
            try:
                frame = None
                if use_shared:
                    close_old_connections()
                    frame, err = _fetch_shared_session_frame(state.camera_id, key, rtsp_url)
                    release_db()
                    if frame is None:
                        state.connected = False
                        state.last_error = err or "Waiting for shared Camera Session…"
                        time.sleep(reconnect_delay)
                        continue
                else:
                    if cap is None or not cap.isOpened():
                        if cap is not None:
                            cap.release()
                            cap = None
                        state.connected = False
                        state.last_error = "Connecting to RTSP…"
                        cap, info = open_rtsp_capture(rtsp_url)
                        if cap is None:
                            state.last_error = info or "Cannot open RTSP stream"
                            logger.warning("Camera %s RTSP failed: %s", state.camera_id, state.last_error)
                            time.sleep(reconnect_delay)
                            continue
                        state.connected = True
                        state.last_error = ""
                        logger.info("Camera %s connected (%s)", state.camera_id, info)

                    ok, frame = cap.read()
                    if not ok or frame is None:
                        state.connected = False
                        state.last_error = "Frame read failed — reconnecting"
                        cap.release()
                        cap = None
                        time.sleep(reconnect_delay)
                        continue

                state.connected = True
                state.last_error = ""
                state.last_frame_at = datetime.now().isoformat(timespec="seconds")
                frame_index += 1

                if frame_index % 3 == 0:
                    small = cv2.resize(frame, (640, 360))
                    ok_jpg, buf = cv2.imencode(".jpg", small, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
                    if ok_jpg:
                        state.last_jpeg = buf.tobytes()

                # Shared session: pace by scan interval (no RTSP buffer to drain).
                # Legacy RTSP: drain continuously; only pace inference.
                now = time.time()
                if now - last_infer_at < self._scan_interval:
                    if use_shared:
                        time.sleep(min(0.2, self._scan_interval))
                    continue
                last_infer_at = now
                from config.worker_throttle import maybe_pause_for_cpu

                maybe_pause_for_cpu(logger, label=f"cctv-{state.camera_id}")
                if now - gallery_refresh_at > 30:
                    gallery = get_gallery_index()
                    gallery_refresh_at = now
                    state.gallery_size = len(gallery)

                if not gallery:
                    state.gallery_size = 0
                    if not gallery_warned:
                        state.last_events.appendleft({
                            "time": datetime.now().strftime("%H:%M:%S"),
                            "camera_id": state.camera_id,
                            "camera_name": state.name,
                            "matched": False,
                            "staff_id": None,
                            "confidence": 0.0,
                            "message": "No trained face gallery — enroll & train staff first",
                        })
                        gallery_warned = True
                    continue

                gallery_warned = False

                h, w = frame.shape[:2]
                max_w = _cctv_infer_max_width()
                if max_w <= 0 or w <= max_w:
                    frame_infer = frame
                else:
                    scale = max_w / w
                    frame_infer = cv2.resize(frame, (max_w, int(h * scale)))

                faces = engine.detect_faces(frame_infer)
                if not faces:
                    faces = engine.detect_faces(apply_clahe_bgr(frame_infer))
                state.frames_processed += 1
                self._process_tracked_faces(
                    state,
                    engine,
                    tracker,
                    frame_infer,
                    faces,
                    now,
                    cooldown,
                    camera_zone,
                )

            except Exception as exc:
                logger.exception("Camera %s error: %s", state.camera_id, exc)
                state.last_error = str(exc)
                state.connected = False
                if cap is not None:
                    cap.release()
                    cap = None
                release_db()
                time.sleep(reconnect_delay)

        if cap is not None:
            cap.release()
        release_db()
        state.running = False
        state.connected = False
        logger.info("Stopped CCTV attendance worker for camera %s", state.camera_id)


_manager: CCTVWorkerManager | None = None
_manager_lock = threading.Lock()


def get_cctv_manager() -> CCTVWorkerManager:
    global _manager
    if _manager is None:
        with _manager_lock:
            if _manager is None:
                _manager = CCTVWorkerManager()
    return _manager
