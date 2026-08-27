"""Per-camera person journey pipeline: YOLO + ByteTrack + Face + ReID."""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from face_recognizer import KnownFaceDB
from inference_engine import (
    WEAPON_MIN_CONF,
    get_face_db,
    get_yolo_coco_model,
    get_yolo_custom_model,
    get_yolo_weapon_model,
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
    last_seen: float = 0.0
    finished: bool = False
    last_posted: float = 0.0
    face_embedding: list[float] = field(default_factory=list)
    reid_embedding: list[float] = field(default_factory=list)
    face_label: str = ""
    face_match_score: float | None = None


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

    def _read_frame(self) -> np.ndarray | None:
        """Reuse the live stream reader — avoids a second RTSP/ffmpeg connection per camera."""
        self._live.ensure_started()
        if not self._live.ensure_camera(self.camera_key, self.rtsp_url):
            return None
        frame = self._live.get_raw_frame(self.camera_key)
        if frame is None:
            logger.debug("[journey] No frame yet for %s", self.camera_key)
        return frame

    def _detect_person_tracks(self, frame: np.ndarray) -> list[dict[str, Any]]:
        if self._coco is None:
            return []

        results = self._coco.track(
            frame,
            persist=True,
            conf=self._conf,
            iou=self._iou,
            imgsz=self._imgsz,
            device=self._device,
            classes=[0],
            tracker="bytetrack.yaml",
            verbose=False,
        )
        out: list[dict[str, Any]] = []
        if not results:
            return out
        r0 = results[0]
        boxes = r0.boxes
        if boxes is None:
            return out
        for box in boxes:
            tid = box.id
            if tid is None:
                continue
            track_id = int(tid.item())
            xyxy = box.xyxy[0].tolist()
            conf = float(box.conf[0].item()) if box.conf is not None else 0.0
            out.append(
                {
                    "track_id": track_id,
                    "bbox": [int(v) for v in xyxy],
                    "confidence": conf,
                    "class_name": "person",
                }
            )
        return out

    def _detect_weapons_near_person(self, frame: np.ndarray, person_bbox: list[int]) -> list[dict[str, Any]]:
        model = self._weapon if self._weapon is not None else self._custom
        if model is None:
            return []
        conf = self._weapon_conf if self._weapon is not None else self._conf
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
        px1, py1, px2, py2 = person_bbox
        for box in results[0].boxes or []:
            cls_id = int(box.cls[0].item()) if box.cls is not None else -1
            name = str(results[0].names.get(cls_id, "")).lower() or "weapon"
            if self._weapon is None and name not in _WEAPON_CLASSES:
                continue
            xyxy = [int(v) for v in box.xyxy[0].tolist()]
            x1, y1, x2, y2 = xyxy
            if x2 < px1 or x1 > px2 or y2 < py1 or y1 > py2:
                continue
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
        if result.identity in {"", "unknown"} and crop.size > 0:
            alt = self._face_db.recognize_track(
                frame,
                camera_key=self.camera_key,
                track_id=track_id,
                bbox=bbox,
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

        for det in self._detect_person_tracks(frame):
            track_id = det["track_id"]
            active_ids.add(track_id)
            bbox = det["bbox"]
            state = self._tracks.get(track_id)
            if state is None:
                state = TrackedPersonState(track_id=track_id)
                self._tracks[track_id] = state

            state.last_seen = now
            state.finished = False

            face_emb, face_label, face_score = self._ensure_face_identity(frame, bbox, track_id)
            if face_emb:
                state.face_embedding = face_emb
            if face_label and face_label.lower() not in {"person", "face", ""}:
                state.face_label = face_label
                state.face_match_score = face_score

            x1, y1, x2, y2 = bbox
            person_crop = frame[y1:y2, x1:x2]
            reid_emb = extract_reid_embedding(person_crop)
            if reid_emb:
                state.reid_embedding = reid_emb

            weapons = self._detect_weapons_near_person(frame, bbox)

            if now - state.last_posted >= self._post_interval:
                state.last_posted = now
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
