"""Track state snapshot + motion prediction for smooth live overlays.

Inference corrects boxes into a per-camera snapshot.
Render predicts current boxes from velocity × elapsed time.

Goals:
  - Box follows the person between YOLO frames
  - Brief misses do not flicker the label off
  - Abandoned / ID-switched tracks do not leave ghost boxes behind
"""

from __future__ import annotations

import math
import os
import threading
import time
from dataclasses import dataclass, field
from typing import Any


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


# Keep drawing a track this long after last YOLO hit (seconds).
MAX_PREDICT_AGE_SEC = _env_float("ML_TRACK_PREDICT_MAX_AGE", 0.8)
# Soft-clamp velocity (pixels/sec).
MAX_VELOCITY_PX = _env_float("ML_TRACK_MAX_VELOCITY", 1800.0)
# EMA for velocity smoothing.
VELOCITY_EMA = _env_float("ML_TRACK_VELOCITY_EMA", 0.55)
# Decay velocity while coasting without a detection.
COAST_VEL_DECAY = _env_float("ML_TRACK_COAST_DECAY", 0.9)
# Drop coasting track if it overlaps a live detection at this IoU.
GHOST_IOU = _env_float("ML_TRACK_GHOST_IOU", 0.3)
# Weak tracks (few hits) expire faster while coasting.
WEAK_TRACK_MAX_AGE = _env_float("ML_TRACK_WEAK_MAX_AGE", 0.3)
# Suppress duplicate overlay boxes at this IoU.
DEDUP_IOU = _env_float("ML_TRACK_DEDUP_IOU", 0.45)

_PERSON_LIKE = frozenset({"person", "face"})
_VEHICLE_LIKE = frozenset({"car", "truck", "bus", "motorcycle", "bicycle", "vehicle"})
_GENERIC_LABELS = frozenset(
    {"", "person", "face", "car", "truck", "bus", "motorcycle", "bicycle", "object", "vehicle", "unknown"}
)


@dataclass
class TrackState:
    track_id: int
    bbox: list[float]  # x1,y1,x2,y2 at `timestamp`
    vx: float = 0.0
    vy: float = 0.0
    vw: float = 0.0
    vh: float = 0.0
    timestamp: float = field(default_factory=time.time)
    frame_seq: int = 0
    class_name: str = ""
    label: str = ""
    confidence: float = 0.0
    class_id: int | None = None
    alert: bool = False
    model: str = ""
    model_tag: str = ""
    object_type: str = ""
    global_object_id: str = ""
    face_identity_key: str = ""
    reid_embedding: list[float] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)
    hits: int = 1


def _center_wh(bbox: list[float]) -> tuple[float, float, float, float]:
    x1, y1, x2, y2 = [float(v) for v in bbox[:4]]
    w = max(1.0, x2 - x1)
    h = max(1.0, y2 - y1)
    return x1 + w * 0.5, y1 + h * 0.5, w, h


def _xyxy_from_cwh(cx: float, cy: float, w: float, h: float) -> list[float]:
    hw, hh = w * 0.5, h * 0.5
    return [cx - hw, cy - hh, cx + hw, cy + hh]


def _clamp_vel(v: float) -> float:
    if not math.isfinite(v):
        return 0.0
    return max(-MAX_VELOCITY_PX, min(MAX_VELOCITY_PX, v))


def _center_dist(a: list[float], b: list[float]) -> float:
    acx, acy, _, _ = _center_wh(a)
    bcx, bcy, _, _ = _center_wh(b)
    return math.hypot(acx - bcx, acy - bcy)


def _iou(a: list[float], b: list[float]) -> float:
    ax1, ay1, ax2, ay2 = [float(v) for v in a[:4]]
    bx1, by1, bx2, by2 = [float(v) for v in b[:4]]
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def _is_ghost_of_live(
    predicted: list[float],
    fam: str,
    live_boxes: list[tuple[list[float], str]],
) -> bool:
    """True when a coasting track is superseded by a nearby live detection."""
    pcx, pcy, pw, ph = _center_wh(predicted)
    for live_box, live_cls in live_boxes:
        if fam in {"person", "vehicle"} and _class_family(live_cls) != fam:
            continue
        if _iou(predicted, live_box) >= GHOST_IOU:
            return True
        # ID-switch: person walked ahead — old box no longer overlaps but is nearby.
        lcx, lcy, lw, lh = _center_wh(live_box)
        dist = math.hypot(pcx - lcx, pcy - lcy)
        near = max(pw, ph, lw, lh) * 0.85
        if dist <= near:
            return True
    return False


def _class_family(name: str) -> str:
    n = (name or "").strip().lower()
    if n in _PERSON_LIKE or n.startswith("unknown"):
        return "person"
    if n in _VEHICLE_LIKE:
        return "vehicle"
    return n or "object"


def _advance_bbox(st: TrackState, dt: float) -> list[float]:
    """Coast bbox forward by velocity × dt (motion, not frozen ghost)."""
    if dt <= 1e-4:
        return list(st.bbox)
    cx, cy, w, h = _center_wh(st.bbox)
    cx += st.vx * dt
    cy += st.vy * dt
    w = max(4.0, w + st.vw * dt)
    h = max(4.0, h + st.vh * dt)
    return _xyxy_from_cwh(cx, cy, w, h)


def _state_from_det(
    det: dict[str, Any],
    *,
    tid: int,
    box: list[float],
    now: float,
    frame_seq: int,
    vx: float,
    vy: float,
    vw: float,
    vh: float,
    hits: int,
    prev: TrackState | None = None,
) -> TrackState:
    label = str(det.get("label") or det.get("class_name") or "")
    class_name = str(det.get("class_name") or "")
    if prev is not None:
        prev_label = (prev.label or "").strip()
        new_low = label.strip().lower()
        if prev_label and new_low in _GENERIC_LABELS:
            if prev_label.lower() not in _GENERIC_LABELS and not prev_label.lower().startswith("unknown"):
                label = prev_label
        if not class_name and prev.class_name:
            class_name = prev.class_name

    return TrackState(
        track_id=tid,
        bbox=box,
        vx=vx,
        vy=vy,
        vw=vw,
        vh=vh,
        timestamp=now,
        frame_seq=int(frame_seq or 0),
        class_name=class_name or (prev.class_name if prev else ""),
        label=label or class_name or (prev.label if prev else "object"),
        confidence=float(det.get("confidence") or (prev.confidence if prev else 0.0)),
        class_id=int(det["class_id"])
        if det.get("class_id") is not None
        else (prev.class_id if prev else None),
        alert=bool(det.get("alert") or (prev.alert if prev else False)),
        model=str(det.get("model") or (prev.model if prev else "")),
        model_tag=str(det.get("model_tag") or (prev.model_tag if prev else "")),
        object_type=str(det.get("object_type") or (prev.object_type if prev else "")),
        global_object_id=str(
            det.get("global_object_id") or (prev.global_object_id if prev else "")
        ),
        face_identity_key=str(
            det.get("face_identity_key") or (prev.face_identity_key if prev else "")
        ),
        reid_embedding=list(det.get("reid_embedding") or [])
        if isinstance(det.get("reid_embedding"), list) and det.get("reid_embedding")
        else list(prev.reid_embedding if prev else []),
        extra={
            k: v
            for k, v in det.items()
            if k
            not in {
                "bbox",
                "track_id",
                "class_name",
                "label",
                "confidence",
                "class_id",
                "alert",
                "model",
                "model_tag",
                "object_type",
                "global_object_id",
                "face_identity_key",
                "reid_embedding",
            }
        }
        or dict(prev.extra if prev else {}),
        hits=hits,
    )


def _dedup_overlays(dets: list[dict[str, Any]], iou_thresh: float = DEDUP_IOU) -> list[dict[str, Any]]:
    """Keep newer / higher-confidence box when same-class overlays overlap."""
    if len(dets) <= 1:
        return dets
    ranked = sorted(
        dets,
        key=lambda d: (
            float(d.get("confidence") or 0.0),
            -float(d.get("predict_age") or 0.0),
            1 if d.get("track_id") is not None else 0,
        ),
        reverse=True,
    )
    kept: list[dict[str, Any]] = []
    for det in ranked:
        box = det.get("bbox") or []
        if len(box) < 4:
            continue
        fam = _class_family(str(det.get("class_name") or det.get("label") or ""))
        conflict = False
        for other in kept:
            ofam = _class_family(str(other.get("class_name") or other.get("label") or ""))
            if fam != ofam:
                continue
            if _iou(box, other.get("bbox") or []) >= iou_thresh:
                conflict = True
                break
        if not conflict:
            kept.append(det)
    return kept


class TrackSnapshotStore:
    """Thread-safe per-camera track gallery for live overlay prediction."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._by_camera: dict[str, dict[int, TrackState]] = {}
        self._untracked: dict[str, list[TrackState]] = {}

    def clear(self, camera_key: str = "") -> None:
        with self._lock:
            if camera_key:
                self._by_camera.pop(camera_key, None)
                self._untracked.pop(camera_key, None)
            else:
                self._by_camera.clear()
                self._untracked.clear()

    def update_from_detections(
        self,
        camera_key: str,
        detections: list[dict[str, Any]],
        *,
        timestamp: float | None = None,
        frame_seq: int = 0,
    ) -> None:
        """
        Merge ByteTrack detections into the snapshot.

        Missing tracks coast with motion. Ghosts that overlap a live detection
        (typical ByteTrack ID switch) are dropped.
        """
        key = (camera_key or "").strip() or "_default"
        now = float(timestamp if timestamp is not None else time.time())
        age_limit = MAX_PREDICT_AGE_SEC

        with self._lock:
            prev_map = dict(self._by_camera.get(key, {}))
            merged: dict[int, TrackState] = {}
            seen_ids: set[int] = set()
            live_boxes: list[tuple[list[float], str]] = []
            fresh_untracked: list[TrackState] = []

            for det in detections or []:
                bbox = det.get("bbox") or []
                if len(bbox) < 4:
                    continue
                try:
                    box = [float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])]
                except (TypeError, ValueError):
                    continue
                if box[2] <= box[0] or box[3] <= box[1]:
                    continue

                tid_raw = det.get("track_id")
                try:
                    tid = int(tid_raw) if tid_raw is not None else None
                except (TypeError, ValueError):
                    tid = None

                cls_name = str(det.get("class_name") or det.get("label") or "")
                live_boxes.append((box, cls_name))

                cx, cy, w, h = _center_wh(box)
                vx = vy = vw = vh = 0.0
                prev = prev_map.get(tid) if tid is not None else None
                hits = 1
                if prev is not None:
                    hits = prev.hits + 1
                    dt = max(1e-3, now - prev.timestamp)
                    # Motion from last stored bbox (already at prev.timestamp).
                    pcx, pcy, pw, ph = _center_wh(prev.bbox)
                    a = max(0.0, min(1.0, VELOCITY_EMA))
                    vx = _clamp_vel(a * ((cx - pcx) / dt) + (1.0 - a) * prev.vx)
                    vy = _clamp_vel(a * ((cy - pcy) / dt) + (1.0 - a) * prev.vy)
                    vw = _clamp_vel(a * ((w - pw) / dt) + (1.0 - a) * prev.vw)
                    vh = _clamp_vel(a * ((h - ph) / dt) + (1.0 - a) * prev.vh)

                if tid is not None:
                    seen_ids.add(tid)
                    merged[tid] = _state_from_det(
                        det,
                        tid=tid,
                        box=box,
                        now=now,
                        frame_seq=frame_seq,
                        vx=vx,
                        vy=vy,
                        vw=vw,
                        vh=vh,
                        hits=hits,
                        prev=prev,
                    )
                else:
                    fresh_untracked.append(
                        _state_from_det(
                            det,
                            tid=-1,
                            box=box,
                            now=now,
                            frame_seq=frame_seq,
                            vx=0.0,
                            vy=0.0,
                            vw=0.0,
                            vh=0.0,
                            hits=1,
                            prev=None,
                        )
                    )

            decay = max(0.0, min(1.0, COAST_VEL_DECAY))
            for tid, prev in prev_map.items():
                if tid in seen_ids:
                    continue
                age = now - prev.timestamp
                # Weak one-shot tracks expire quickly (stops unknown ghosts).
                if prev.hits < 2 and age > WEAK_TRACK_MAX_AGE:
                    continue
                if age > age_limit:
                    continue

                # Where the box would be now (motion coast — not a frozen ghost).
                predicted = _advance_bbox(prev, age)
                fam = _class_family(prev.class_name or prev.label)

                # Anti-ghost: live detection already covers this object → drop old ID.
                if _is_ghost_of_live(predicted, fam, live_boxes):
                    continue

                merged[tid] = TrackState(
                    track_id=prev.track_id,
                    bbox=list(prev.bbox),  # predict() advances from last hit time
                    vx=prev.vx * decay,
                    vy=prev.vy * decay,
                    vw=prev.vw * decay,
                    vh=prev.vh * decay,
                    timestamp=prev.timestamp,
                    frame_seq=prev.frame_seq,
                    class_name=prev.class_name,
                    label=prev.label,
                    confidence=prev.confidence,
                    class_id=prev.class_id,
                    alert=prev.alert,
                    model=prev.model,
                    model_tag=prev.model_tag,
                    object_type=prev.object_type,
                    global_object_id=prev.global_object_id,
                    face_identity_key=prev.face_identity_key,
                    reid_embedding=list(prev.reid_embedding),
                    extra=dict(prev.extra),
                    hits=prev.hits,
                )

            if fresh_untracked:
                kept_untracked = fresh_untracked
            else:
                kept_untracked = [
                    st
                    for st in self._untracked.get(key, [])
                    if (now - st.timestamp) <= age_limit
                ]

            self._by_camera[key] = merged
            self._untracked[key] = kept_untracked

    def set_untracked(
        self,
        camera_key: str,
        detections: list[dict[str, Any]],
        *,
        timestamp: float | None = None,
        frame_seq: int = 0,
    ) -> None:
        """Refresh static overlays (plates, etc.) without clearing tracked boxes."""
        key = (camera_key or "").strip() or "_default"
        now = float(timestamp if timestamp is not None else time.time())
        fresh: list[TrackState] = []
        for det in detections or []:
            if det.get("track_id") is not None:
                continue
            bbox = det.get("bbox") or []
            if len(bbox) < 4:
                continue
            try:
                box = [float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])]
            except (TypeError, ValueError):
                continue
            if box[2] <= box[0] or box[3] <= box[1]:
                continue
            fresh.append(
                _state_from_det(
                    det,
                    tid=-1,
                    box=box,
                    now=now,
                    frame_seq=frame_seq,
                    vx=0.0,
                    vy=0.0,
                    vw=0.0,
                    vh=0.0,
                    hits=1,
                )
            )
        with self._lock:
            if fresh:
                self._untracked[key] = fresh
            else:
                self._untracked[key] = [
                    st
                    for st in self._untracked.get(key, [])
                    if (now - st.timestamp) <= MAX_PREDICT_AGE_SEC
                ]

    def patch_labels(self, camera_key: str, detections: list[dict[str, Any]]) -> None:
        """Update labels / identity fields without resetting velocity (heavy AI return)."""
        key = (camera_key or "").strip() or "_default"
        with self._lock:
            tracked = self._by_camera.get(key)
            if not tracked:
                return
            for det in detections or []:
                tid_raw = det.get("track_id")
                try:
                    tid = int(tid_raw) if tid_raw is not None else None
                except (TypeError, ValueError):
                    tid = None
                if tid is None or tid not in tracked:
                    continue
                st = tracked[tid]
                if det.get("label"):
                    new_label = str(det.get("label")).strip()
                    if new_label:
                        st.label = new_label
                if det.get("class_name"):
                    st.class_name = str(det.get("class_name"))
                if det.get("confidence") is not None:
                    try:
                        st.confidence = float(det.get("confidence"))
                    except (TypeError, ValueError):
                        pass
                if det.get("global_object_id"):
                    st.global_object_id = str(det.get("global_object_id"))
                if det.get("face_identity_key"):
                    st.face_identity_key = str(det.get("face_identity_key"))
                if det.get("object_type"):
                    st.object_type = str(det.get("object_type"))
                if isinstance(det.get("reid_embedding"), list) and det.get("reid_embedding"):
                    st.reid_embedding = list(det.get("reid_embedding"))

    def predict_detections(
        self,
        camera_key: str,
        *,
        now: float | None = None,
        frame_width: int = 0,
        frame_height: int = 0,
        max_age: float | None = None,
    ) -> list[dict[str, Any]]:
        """Return overlay detections with bboxes predicted to ``now``."""
        key = (camera_key or "").strip() or "_default"
        t_now = float(now if now is not None else time.time())
        age_limit = float(max_age if max_age is not None else MAX_PREDICT_AGE_SEC)
        out: list[dict[str, Any]] = []

        with self._lock:
            alive = {
                tid: st
                for tid, st in self._by_camera.get(key, {}).items()
                if (t_now - st.timestamp) <= age_limit
                and not (st.hits < 2 and (t_now - st.timestamp) > WEAK_TRACK_MAX_AGE)
            }
            self._by_camera[key] = alive
            self._untracked[key] = [
                st
                for st in self._untracked.get(key, [])
                if (t_now - st.timestamp) <= age_limit
            ]
            tracked = list(alive.values())
            untracked = list(self._untracked[key])

        for st in tracked + untracked:
            age = t_now - st.timestamp
            if age < -0.05:
                age = 0.0
            if age > age_limit:
                continue
            if st.hits < 2 and age > WEAK_TRACK_MAX_AGE:
                continue

            if st.track_id >= 0 and age > 1e-4:
                box = _advance_bbox(st, age)
            else:
                box = list(st.bbox)

            if frame_width > 0 and frame_height > 0:
                box[0] = max(0.0, min(float(frame_width - 1), box[0]))
                box[1] = max(0.0, min(float(frame_height - 1), box[1]))
                box[2] = max(0.0, min(float(frame_width), box[2]))
                box[3] = max(0.0, min(float(frame_height), box[3]))
                if box[2] - box[0] < 2 or box[3] - box[1] < 2:
                    continue

            label = st.label or st.class_name or "object"
            if st.global_object_id and label.lower() in _GENERIC_LABELS:
                label = st.global_object_id

            det: dict[str, Any] = {
                "bbox": [int(round(v)) for v in box],
                "label": label,
                "class_name": st.class_name or st.label or "object",
                "confidence": st.confidence,
                "alert": st.alert,
                "track_id": st.track_id if st.track_id >= 0 else None,
                "model": st.model,
                "model_tag": st.model_tag,
                "object_type": st.object_type,
                "global_object_id": st.global_object_id,
                "face_identity_key": st.face_identity_key,
                "predicted": age > 0.02,
                "predict_age": round(age, 3),
            }
            if st.class_id is not None:
                det["class_id"] = st.class_id
            if st.reid_embedding:
                det["reid_embedding"] = st.reid_embedding
            if st.extra:
                for k, v in st.extra.items():
                    if str(k).startswith("_"):
                        continue
                    det.setdefault(k, v)
            out.append(det)

        return _dedup_overlays(out)


_store: TrackSnapshotStore | None = None
_store_lock = threading.Lock()


def get_track_snapshot_store() -> TrackSnapshotStore:
    global _store
    with _store_lock:
        if _store is None:
            _store = TrackSnapshotStore()
        return _store
