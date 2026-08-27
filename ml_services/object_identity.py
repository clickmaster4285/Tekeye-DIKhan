"""Local track → face (persons) → strict ReID → stable global object id."""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from reid_extractor import extract_reid_embedding

VEHICLE_CLASSES = frozenset(
    {
        "car",
        "truck",
        "bus",
        "motorcycle",
        "bicycle",
        "vehicle",
    }
)
PERSON_CLASSES = frozenset({"person", "face"})
EXCLUDED_MODELS = frozenset({"smoke", "weapon"})
EXCLUDED_CLASS_NAMES = frozenset(
    {
        "smoke",
        "fire",
        "flame",
        "weapon",
        "gun",
        "pistol",
        "rifle",
    }
)

# Tight thresholds — prefer new IDs over wrong merges (was 0.85).
def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


REID_MATCH_THRESHOLD = _env_float("ML_REID_MATCH_THRESHOLD", 0.94)
PERSON_REID_MATCH_THRESHOLD = _env_float("ML_PERSON_REID_MATCH_THRESHOLD", 0.95)
VEHICLE_REID_MATCH_THRESHOLD = _env_float("ML_VEHICLE_REID_MATCH_THRESHOLD", 0.93)
# Only blend embeddings when the match was this strong (stops polluted gallery).
REID_EMA_MIN_SCORE = _env_float("ML_REID_EMA_MIN_SCORE", 0.96)
GALLERY_TTL_SEC = 6 * 60 * 60
TRACK_EXIT_SEC = 8.0


def object_type_for_class(class_name: str) -> str:
    name = (class_name or "").strip().lower()
    if name in PERSON_CLASSES:
        return "person"
    if name in VEHICLE_CLASSES:
        return "vehicle"
    return "object"


def _same_identity_class(stored_class: str, new_class: str) -> bool:
    a = (stored_class or "").strip().lower()
    b = (new_class or "").strip().lower()
    if not a or not b:
        return False
    if a == b:
        return True
    aliases = {"face": "person", "vehicle": "car"}
    return aliases.get(a, a) == aliases.get(b, b)


def is_identity_detection(det: dict[str, Any]) -> bool:
    model = str(det.get("model") or det.get("model_tag") or "").strip().lower()
    if model in EXCLUDED_MODELS:
        return False
    cls = str(det.get("class_name") or det.get("label") or "").strip().lower()
    if cls in EXCLUDED_CLASS_NAMES:
        return False
    if "smoke" in cls or "fire" in cls or "flame" in cls:
        return False
    return True


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    va = np.asarray(a, dtype=np.float32)
    vb = np.asarray(b, dtype=np.float32)
    na = float(np.linalg.norm(va))
    nb = float(np.linalg.norm(vb))
    if na <= 0 or nb <= 0:
        return 0.0
    return float(np.dot(va / na, vb / nb))


def _crop(frame: np.ndarray, bbox: list[int]) -> np.ndarray | None:
    if frame is None or frame.size == 0 or len(bbox) < 4:
        return None
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in bbox[:4]]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    if x2 <= x1 or y2 <= y1:
        return None
    crop = frame[y1:y2, x1:x2]
    return crop if crop.size else None


def _reid_threshold(object_type: str) -> float:
    if object_type == "person":
        return PERSON_REID_MATCH_THRESHOLD
    if object_type == "vehicle":
        return VEHICLE_REID_MATCH_THRESHOLD
    return REID_MATCH_THRESHOLD


def _normalize_face_key(identity: str | None) -> str:
    """Stable gallery key from face recognizer identity (staff or unknown-* cache)."""
    raw = (identity or "").strip()
    if not raw:
        return ""
    low = raw.lower()
    if low in {"unknown", "person", "face"}:
        return ""
    # Bare "unknown" rejected; "unknown-12" / staff names kept.
    if low == "unknown":
        return ""
    return f"face:{low}"


def _resolve_face_identity(face_db: Any, frame: np.ndarray, bbox: list, class_name: str) -> tuple[str, float, list[float]]:
    """Return (face_key, score, face_embedding) for person/face boxes."""
    if face_db is None or frame is None or frame.size == 0 or len(bbox) < 4:
        return "", 0.0, []
    try:
        cls_id = 0 if (class_name or "").lower() == "person" else 80
        if hasattr(face_db, "label_detection_detail"):
            meta = face_db.label_detection_detail(frame, cls_id, class_name or "person", bbox)
            identity = str(meta.get("label") or "")
            score = float(meta.get("face_match_score") or 0.0)
            emb = meta.get("face_embedding") or []
            key = _normalize_face_key(identity)
            if key:
                return key, score, list(emb) if isinstance(emb, list) else []
            return "", score, list(emb) if isinstance(emb, list) else []
        if hasattr(face_db, "recognize_person"):
            identity = str(face_db.recognize_person(frame, bbox) or "")
            return _normalize_face_key(identity), 0.0, []
    except Exception:
        return "", 0.0, []
    return "", 0.0, []


@dataclass
class GlobalObjectState:
    global_id: str
    object_type: str
    class_name: str
    reid_embedding: list[float] = field(default_factory=list)
    face_key: str = ""
    first_seen: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)
    entry_time: float = field(default_factory=time.time)
    exit_time: float | None = None
    camera_history: list[str] = field(default_factory=list)
    active: bool = True


@dataclass
class LocalTrackBind:
    global_id: str
    last_seen: float


class ObjectIdentityRegistry:
    """In-memory global IDs; PostgreSQL remains the durable source of truth on save."""

    def __init__(self):
        self._lock = threading.Lock()
        self._globals: dict[str, GlobalObjectState] = {}
        self._track_bind: dict[tuple[str, int], LocalTrackBind] = {}
        self._face_index: dict[str, str] = {}  # face_key → global_id
        self._counters = {"person": 0, "vehicle": 0, "object": 0}

    def _next_code(self, object_type: str) -> str:
        prefix = {"person": "GP", "vehicle": "GV", "object": "GO"}.get(object_type, "GO")
        self._counters[object_type] = self._counters.get(object_type, 0) + 1
        return f"{prefix}{self._counters[object_type]}"

    def _prune(self, now: float) -> None:
        ttl_cut = now - GALLERY_TTL_SEC
        stale_gids = [gid for gid, st in self._globals.items() if st.last_seen < ttl_cut]
        for gid in stale_gids:
            st = self._globals.pop(gid, None)
            if st and st.face_key and self._face_index.get(st.face_key) == gid:
                self._face_index.pop(st.face_key, None)
        stale_tracks = [k for k, b in self._track_bind.items() if b.last_seen < now - GALLERY_TTL_SEC]
        for k in stale_tracks:
            self._track_bind.pop(k, None)

    def _match_face(self, face_key: str) -> GlobalObjectState | None:
        if not face_key:
            return None
        gid = self._face_index.get(face_key)
        if not gid:
            return None
        return self._globals.get(gid)

    def _match_reid(
        self,
        object_type: str,
        class_name: str,
        embedding: list[float],
    ) -> tuple[GlobalObjectState | None, float]:
        if not embedding:
            return None, 0.0
        threshold = _reid_threshold(object_type)
        best: GlobalObjectState | None = None
        best_score = threshold
        for state in self._globals.values():
            if state.object_type != object_type:
                continue
            if not _same_identity_class(state.class_name, class_name):
                continue
            # If both sides have different face keys, never merge on clothing alone.
            if state.face_key:
                # leave/return without face this frame is OK; conflicting faces blocked at bind time
                pass
            score = _cosine(embedding, state.reid_embedding)
            if score >= best_score:
                best_score = score
                best = state
        return best, (best_score if best is not None else 0.0)

    def _bind_face(self, state: GlobalObjectState, face_key: str) -> None:
        if not face_key:
            return
        # Face key already owned by another global → keep existing stronger identity
        owner = self._face_index.get(face_key)
        if owner and owner != state.global_id:
            return
        state.face_key = face_key
        self._face_index[face_key] = state.global_id

    def _close_inactive_tracks(self, camera_key: str, active_ids: set[int], now: float) -> None:
        prefix = (camera_key or "").strip()
        for (cam, tid), bind in list(self._track_bind.items()):
            if cam != prefix:
                continue
            if tid in active_ids:
                continue
            if now - bind.last_seen < TRACK_EXIT_SEC:
                continue
            state = self._globals.get(bind.global_id)
            if state is not None:
                state.active = False
                state.exit_time = bind.last_seen
            self._track_bind.pop((cam, tid), None)

    def _update_reid(self, state: GlobalObjectState, embedding: list[float], match_score: float) -> None:
        if not embedding:
            return
        # Only EMA when confident — avoids blending two different people into one vector.
        if state.reid_embedding and len(state.reid_embedding) == len(embedding):
            if match_score >= REID_EMA_MIN_SCORE:
                merged = [
                    0.85 * float(a) + 0.15 * float(b)
                    for a, b in zip(state.reid_embedding, embedding)
                ]
                norm = float(np.linalg.norm(np.asarray(merged, dtype=np.float32)))
                state.reid_embedding = (
                    [float(v) / norm for v in merged] if norm > 0 else list(embedding)
                )
            # Weak match: keep prior gallery vector
        else:
            state.reid_embedding = list(embedding)

    def enrich_detections(
        self,
        camera_key: str,
        frame: np.ndarray,
        detections: list[dict[str, Any]],
        face_db: Any = None,
    ) -> list[dict[str, Any]]:
        """Add reid_embedding, face keys, object_type, global_object_id."""
        now = time.time()
        cam = (camera_key or "").strip()
        out: list[dict[str, Any]] = []
        active_ids: set[int] = set()

        with self._lock:
            self._prune(now)

            for det in detections or []:
                if not is_identity_detection(det):
                    model = str(det.get("model") or det.get("model_tag") or "").strip().lower()
                    cls = str(det.get("class_name") or det.get("label") or "").strip().lower()
                    if model in EXCLUDED_MODELS or cls in EXCLUDED_CLASS_NAMES:
                        continue
                    if "smoke" in cls or "fire" in cls or "flame" in cls:
                        continue
                    out.append(dict(det))
                    continue

                enriched = dict(det)
                class_name = str(enriched.get("class_name") or enriched.get("label") or "object")
                object_type = object_type_for_class(class_name)
                enriched["object_type"] = object_type

                bbox = enriched.get("bbox") or []
                bbox_list = bbox if isinstance(bbox, list) else list(bbox)
                crop = _crop(frame, bbox_list)
                embedding = extract_reid_embedding(crop) if crop is not None else []
                if embedding:
                    enriched["reid_embedding"] = embedding

                face_key = ""
                face_score = 0.0
                if object_type == "person":
                    face_key, face_score, face_emb = _resolve_face_identity(
                        face_db, frame, bbox_list, class_name
                    )
                    if face_key:
                        enriched["face_identity_key"] = face_key
                        enriched["face_match_score"] = face_score
                    if face_emb:
                        enriched["face_embedding"] = face_emb

                track_id = enriched.get("track_id")
                try:
                    track_id_i = int(track_id) if track_id is not None else None
                except (TypeError, ValueError):
                    track_id_i = None

                state: GlobalObjectState | None = None
                match_score = 0.0

                # 1) Active local ByteTrack bind
                if track_id_i is not None:
                    active_ids.add(track_id_i)
                    bind = self._track_bind.get((cam, track_id_i))
                    if bind is not None:
                        state = self._globals.get(bind.global_id)
                        if state is not None and (
                            state.object_type != object_type
                            or not _same_identity_class(state.class_name, class_name)
                        ):
                            self._track_bind.pop((cam, track_id_i), None)
                            state = None
                        elif state is not None and face_key and state.face_key and state.face_key != face_key:
                            # Face proves this track flipped to another person — split.
                            self._track_bind.pop((cam, track_id_i), None)
                            state = None
                        else:
                            match_score = 1.0

                # 2) Face identity (strongest for persons)
                if state is None and face_key:
                    state = self._match_face(face_key)
                    if state is not None:
                        match_score = max(face_score, 0.99)

                # 3) Strict appearance ReID (leave/return without clear face)
                if state is None and embedding:
                    state, match_score = self._match_reid(object_type, class_name, embedding)
                    # If gallery entry is face-locked to someone else, don't steal via clothes.
                    if state is not None and state.face_key and face_key and state.face_key != face_key:
                        state = None
                        match_score = 0.0

                if state is None:
                    gid = self._next_code(object_type)
                    state = GlobalObjectState(
                        global_id=gid,
                        object_type=object_type,
                        class_name=class_name,
                        reid_embedding=list(embedding),
                        face_key="",
                        first_seen=now,
                        last_seen=now,
                        entry_time=now,
                        camera_history=[cam] if cam else [],
                        active=True,
                    )
                    self._globals[gid] = state
                    match_score = 1.0
                else:
                    reentered = (not state.active) or state.exit_time is not None
                    state.last_seen = now
                    state.active = True
                    state.exit_time = None
                    if reentered:
                        state.entry_time = now
                    self._update_reid(state, embedding, match_score)
                    if cam and (not state.camera_history or state.camera_history[-1] != cam):
                        state.camera_history.append(cam)
                        state.camera_history = state.camera_history[-40:]

                if face_key:
                    self._bind_face(state, face_key)

                if track_id_i is not None:
                    self._track_bind[(cam, track_id_i)] = LocalTrackBind(
                        global_id=state.global_id,
                        last_seen=now,
                    )

                enriched["global_object_id"] = state.global_id
                enriched["first_seen"] = state.first_seen
                enriched["last_seen"] = state.last_seen
                enriched["entry_time"] = state.entry_time
                if state.face_key:
                    enriched["face_identity_key"] = state.face_key
                out.append(enriched)

            self._close_inactive_tracks(cam, active_ids, now)

        return out


_registry: ObjectIdentityRegistry | None = None
_registry_lock = threading.Lock()


def get_object_identity_registry() -> ObjectIdentityRegistry:
    global _registry
    if _registry is None:
        with _registry_lock:
            if _registry is None:
                _registry = ObjectIdentityRegistry()
    return _registry
