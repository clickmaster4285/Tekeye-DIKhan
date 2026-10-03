"""Per-camera person journey pipeline: YOLO + ByteTrack + Face + ReID."""

from __future__ import annotations

import logging
import os
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any

import cv2
import numpy as np

from camera_byte_tracker import CameraByteTrackerPool
from face_recognizer import KnownFaceDB
from inference_engine import (
    WEAPON_MIN_CONF,
    get_face_db,
    get_yolo_coco_model,
    get_yolo_custom_model,
    get_yolo_weapon_model,
    gpu_predict_lock,
    resolve_ml_device,
)
from live_stream import get_live_manager
from reid_extractor import extract_reid_embedding

logger = logging.getLogger(__name__)

_WEAPON_CLASSES = frozenset(
    {"weapon", "gun", "knife", "pistol", "rifle", "firearm", "sword", "machete"}
)


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


@dataclass
class TrackedPersonState:
    track_id: int
    first_seen: float = 0.0
    last_seen: float = 0.0
    finished: bool = False
    last_posted: float = 0.0
    posted: bool = False
    face_embedding: list[float] = field(default_factory=list)
    reid_embedding: list[float] = field(default_factory=list)
    # Recent good-quality ReID crops; the track's identity embedding is their normalized mean.
    reid_samples: deque = field(default_factory=lambda: deque(maxlen=10))
    face_label: str = ""
    face_match_score: float | None = None

    def add_reid(self, emb: list[float]) -> None:
        self.reid_samples.append(np.asarray(emb, dtype=np.float32))
        mean = np.mean(np.stack(self.reid_samples), axis=0)
        norm = float(np.linalg.norm(mean))
        if norm > 0:
            self.reid_embedding = [float(v) for v in (mean / norm)]


def _reid_crop_ok(bbox: list[int], frame_w: int, frame_h: int) -> bool:
    """Only whole, reasonably sized people: tiny or edge-clipped crops give misleading appearance vectors."""
    x1, y1, x2, y2 = bbox
    w, h = x2 - x1, y2 - y1
    if h < _env_int("JOURNEY_REID_MIN_HEIGHT", 96) or w < 32 or h < 1.2 * w:
        return False
    margin = 3
    return x1 > margin and x2 < frame_w - margin


class JourneyCameraPipeline:
    """YOLO person tracking with ByteTrack on frames from the shared live RTSP session."""

    def __init__(
        self,
        *,
        camera_key: str,
        camera_id: int | None,
        rtsp_url: str,
        zone: str = "",
        name: str = "",
    ):
        self.camera_key = camera_key
        self.camera_id = camera_id
        self.rtsp_url = rtsp_url
        self.zone = zone
        self.name = name
        self._conf = _env_float("JOURNEY_CONF", 0.35)
        self._iou = _env_float("JOURNEY_IOU", 0.5)
        self._infer_interval = _env_float("JOURNEY_INFER_INTERVAL_SEC", 0.5)
        self._track_ttl = _env_float("JOURNEY_TRACK_TTL_SEC", 3.0)
        self._post_interval = _env_float("JOURNEY_POST_INTERVAL_SEC", 1.5)
        # Identity is decided on the first post: wait for a few ReID samples (or this long) first.
        self._min_reid_samples = _env_int("JOURNEY_MIN_REID_SAMPLES", 3)
        self._first_post_max_wait = _env_float("JOURNEY_FIRST_POST_MAX_WAIT_SEC", 4.0)
        self._imgsz = _env_int("JOURNEY_IMGSZ", 640)
        self._coco = get_yolo_coco_model()
        self._custom = get_yolo_custom_model()
        self._weapon = get_yolo_weapon_model()
        self._device = resolve_ml_device()
        self._weapon_conf = _env_float("ML_WEAPON_CONF", WEAPON_MIN_CONF)
        self._face_db: KnownFaceDB = get_face_db()
        self._tracks: dict[int, TrackedPersonState] = {}
        self._running = False
        self._live = get_live_manager()
        # Per-pipeline ByteTrack — never call Ultralytics model.track() on the shared YOLO.
        self._byte_trackers = CameraByteTrackerPool(track_buffer=90)

    def _read_frame(self) -> np.ndarray | None:
        """Reuse shared Camera Session — never open a second RTSP/ffmpeg per camera."""
        self._live.ensure_started()
        if not self._live.ensure_camera(self.camera_key, self.rtsp_url):
            return None
        # Prefer CameraSessionManager (same underlying FFmpeg as LiveStreamManager).
        try:
            from camera_session import get_camera_session_manager

            frame = get_camera_session_manager().get_latest_frame(self.camera_key)
            if frame is not None:
                return frame
        except Exception:
            pass
        frame = self._live.get_raw_frame(self.camera_key)
        if frame is None:
            logger.debug("[journey] No frame yet for %s", self.camera_key)
        return frame

    def _detect_person_tracks(self, frame: np.ndarray) -> list[dict[str, Any]]:
        if self._coco is None:
            return []

        # predict() + local ByteTrack keeps the shared YOLO singleton stable across cameras.
        with gpu_predict_lock():
            results = self._coco.predict(
                frame,
                conf=self._conf,
                iou=self._iou,
                imgsz=self._imgsz,
                device=self._device,
                classes=[0],
                verbose=False,
            )
        dets: list[dict[str, Any]] = []
        if not results:
            return dets
        r0 = results[0]
        boxes = r0.boxes
        if boxes is None:
            return dets
        for box in boxes:
            xyxy = box.xyxy[0].tolist()
            conf = float(box.conf[0].item()) if box.conf is not None else 0.0
            dets.append(
                {
                    "bbox": [int(v) for v in xyxy],
                    "confidence": conf,
                    "class_name": "person",
                    "class_id": 0,
                    "label": "person",
                }
            )
        tracked = self._byte_trackers.assign_track_ids(self.camera_key, dets, frame)
        out: list[dict[str, Any]] = []
        for det in tracked:
            tid = det.get("track_id")
            if tid is None:
                continue
            out.append(
                {
                    "track_id": int(tid),
                    "bbox": det["bbox"],
                    "confidence": float(det.get("confidence") or 0.0),
                    "class_name": "person",
                }
            )
        return out

    @staticmethod
    def _weapons_near(weapons: list[dict[str, Any]], person_bbox: list[int]) -> list[dict[str, Any]]:
        px1, py1, px2, py2 = person_bbox
        return [
            w for w in weapons
            if not (w["bbox"][2] < px1 or w["bbox"][0] > px2 or w["bbox"][3] < py1 or w["bbox"][1] > py2)
        ]

    def _detect_weapons(self, frame: np.ndarray) -> list[dict[str, Any]]:
        """One weapon inference per frame (previously one full-frame inference per person)."""
        model = self._weapon if self._weapon is not None else self._custom
        if model is None:
            return []
        conf = self._weapon_conf if self._weapon is not None else self._conf
        with gpu_predict_lock():
            results = model.predict(
                frame,
                conf=conf,
                iou=self._iou,
                imgsz=self._imgsz,
                device=self._device,
                verbose=False,
            )
        alerts: list[dict[str, Any]] = []
        if not results:
            return alerts
        for box in results[0].boxes or []:
            cls_id = int(box.cls[0].item()) if box.cls is not None else -1
            name = str(results[0].names.get(cls_id, "")).lower() or "weapon"
            if self._weapon is None and name not in _WEAPON_CLASSES:
                continue
            xyxy = [int(v) for v in box.xyxy[0].tolist()]
            alerts.append(
                {
                    "class_name": name,
                    "label": name,
                    "confidence": float(box.conf[0].item()) if box.conf is not None else 0.0,
                    "bbox": xyxy,
                    "alert": True,
                }
            )
        return alerts

    def _ensure_face_identity(
        self,
        frame: np.ndarray,
        bbox: list[int],
        track_id: int,
    ) -> tuple[list[float], str, float | None]:
        """Recognize once per track; reuse cached identity until re-verification."""
        x1, y1, x2, y2 = bbox
        h, w = frame.shape[:2]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            return [], "", None

        result = self._face_db.recognize_track(
            crop,
            camera_key=self.camera_key,
            track_id=track_id,
            bbox=bbox,
        )
        if result.identity in {"", "unknown"} and not result.embedding:
            # Retry on this person's own head region, upscaled — never the whole frame, where the largest
            # face may belong to somebody else and would be stored in this person's gallery.
            head = crop[: max(1, int(crop.shape[0] * 0.4)), :]
            if head.size and head.shape[1] < 160:
                scale = 160.0 / max(1, head.shape[1])
                head = cv2.resize(head, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
            if head.size:
                alt = self._face_db.recognize_track(
                    head,
                    camera_key=self.camera_key,
                    track_id=track_id,
                    force=True,
                )
                if alt.embedding:
                    result = alt

        face_score = float(result.score) if result.is_known else None
        if result.is_unknown_temp:
            face_score = None
        return result.embedding, result.identity, face_score

    def process_once(self) -> list[dict[str, Any]]:
        frame = self._read_frame()
        if frame is None:
            return []

        now = time.time()
        active_ids: set[int] = set()
        observations: list[dict[str, Any]] = []
        frame_h, frame_w = frame.shape[:2]
        people = self._detect_person_tracks(frame)
        frame_weapons = self._detect_weapons(frame) if people else []

        for det in people:
            track_id = det["track_id"]
            active_ids.add(track_id)
            bbox = det["bbox"]
            state = self._tracks.get(track_id)
            if state is None:
                state = TrackedPersonState(track_id=track_id, first_seen=now)
                self._tracks[track_id] = state

            state.last_seen = now
            state.finished = False

            face_emb, face_label, face_score = self._ensure_face_identity(frame, bbox, track_id)
            if face_emb:
                state.face_embedding = face_emb
            if face_label and face_label.lower() not in {"person", "face", ""}:
                state.face_label = face_label
                state.face_match_score = face_score

            x1, y1, x2, y2 = [int(v) for v in bbox]
            if _reid_crop_ok([x1, y1, x2, y2], frame_w, frame_h):
                person_crop = frame[max(0, y1):y2, max(0, x1):x2]
                reid_emb = extract_reid_embedding(person_crop)
                if reid_emb:
                    state.add_reid(reid_emb)

            weapons = self._weapons_near(frame_weapons, bbox)

            if not state.posted:
                # The first post decides the global identity — only with a stable, averaged appearance.
                enough = len(state.reid_samples) >= self._min_reid_samples or bool(state.face_embedding)
                waited = now - state.first_seen >= self._first_post_max_wait and len(state.reid_samples) > 0
                if not (enough or waited or weapons):
                    continue
            if now - state.last_posted >= self._post_interval:
                state.last_posted = now
                state.posted = True
                observations.append(
                    {
                        "camera_id": self.camera_id,
                        "camera_key": self.camera_key,
                        "track_id": track_id,
                        "track_status": "active",
                        "bbox": bbox,
                        "confidence": det["confidence"],
                        "face_embedding": state.face_embedding,
                        "reid_embedding": state.reid_embedding,
                        "face_label": state.face_label,
                        "face_match_score": state.face_match_score,
                        "detections": weapons,
                        "zone": self.zone,
                        "camera_name": self.name,
                    }
                )

        for track_id, state in list(self._tracks.items()):
            if track_id in active_ids:
                continue
            if state.finished:
                continue
            if now - state.last_seen > self._track_ttl:
                state.finished = True
                if not state.posted:
                    del self._tracks[track_id]
                    self._face_db.track_cache.drop(self.camera_key, track_id)
                    continue
                observations.append(
                    {
                        "camera_id": self.camera_id,
                        "camera_key": self.camera_key,
                        "track_id": track_id,
                        "track_status": "finished",
                        "bbox": [],
                        "confidence": 0.0,
                        "face_embedding": state.face_embedding,
                        "reid_embedding": state.reid_embedding,
                        "face_label": state.face_label,
                        "face_match_score": state.face_match_score,
                        "detections": [],
                        "zone": self.zone,
                        "camera_name": self.name,
                    }
                )
                del self._tracks[track_id]
                self._face_db.track_cache.drop(self.camera_key, track_id)

        self._face_db.track_cache.prune_inactive(self.camera_key, active_ids)

        return observations

    def stop(self):
        self._running = False
        try:
            self._byte_trackers.reset(self.camera_key)
        except Exception:
            pass
        try:
            self._face_db.track_cache.prune_inactive(self.camera_key, set())
        except Exception:
            pass
