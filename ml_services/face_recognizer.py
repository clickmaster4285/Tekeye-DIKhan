"""
Match detected faces against embedding vectors loaded from the Django database.

Steps implemented:
  4 — Skip low-quality enrollment embeddings during matching
  5 — Optional FAISS index for large galleries (cosine verification on top-K)
  6 — Threshold via ML_FACE_THRESHOLD (use face_calibration.suggest_threshold for tuning)
  7 — TrackRecognitionCache: recognize once per track, occasional re-verification
  8 — UnknownFaceCache: stable temporary IDs for repeated unknown faces
"""
from __future__ import annotations

import os
import threading
import time
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

MODEL_DIR = Path(__file__).resolve().parent / "models" / "face"
YUNET_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/"
    "face_detection_yunet/face_detection_yunet_2023mar.onnx"
)
SFACE_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/"
    "face_recognition_sface/face_recognition_sface_2021dec.onnx"
)

# Face quality gate — applied after YuNet, before alignCrop/SFace.
FACE_MIN_CONFIDENCE = float(os.getenv("ML_FACE_MIN_CONFIDENCE", "0.50"))
FACE_MIN_SIZE_PX = int(os.getenv("ML_FACE_MIN_SIZE", "100"))
FACE_MIN_LAPLACIAN_VAR = float(os.getenv("ML_FACE_MIN_LAPLACIAN_VAR", "50"))
FACE_MIN_BRIGHTNESS = float(os.getenv("ML_FACE_MIN_BRIGHTNESS", "35"))
FACE_MAX_BRIGHTNESS = float(os.getenv("ML_FACE_MAX_BRIGHTNESS", "225"))
FACE_MAX_YAW_RATIO = float(os.getenv("ML_FACE_MAX_YAW_RATIO", "0.35"))
FACE_MAX_PITCH_RATIO = float(os.getenv("ML_FACE_MAX_PITCH_RATIO", "0.55"))
FACE_CHECK_OCCLUSION = os.getenv("ML_FACE_CHECK_OCCLUSION", "1").strip().lower() in (
    "1",
    "true",
    "yes",
)

# Step 4 — ignore poor enrollment vectors when matching.
ENROLLMENT_MIN_QUALITY = float(os.getenv("ML_FACE_ENROLLMENT_MIN_QUALITY", "0.55"))

# Relaxed quality gates for staff photo enrollment (supports pose variations).
ENROLL_MIN_CONFIDENCE = float(os.getenv("ML_FACE_ENROLL_MIN_CONFIDENCE", "0.40"))
ENROLL_MIN_SIZE_PX = int(os.getenv("ML_FACE_ENROLL_MIN_SIZE", "60"))
ENROLL_MIN_LAPLACIAN_VAR = float(os.getenv("ML_FACE_ENROLL_MIN_LAPLACIAN_VAR", "25"))
ENROLL_MIN_BRIGHTNESS = float(os.getenv("ML_FACE_ENROLL_MIN_BRIGHTNESS", "25"))
ENROLL_MAX_BRIGHTNESS = float(os.getenv("ML_FACE_ENROLL_MAX_BRIGHTNESS", "235"))
ENROLL_MAX_YAW_RATIO = float(os.getenv("ML_FACE_ENROLL_MAX_YAW_RATIO", "0.60"))
ENROLL_MAX_PITCH_RATIO = float(os.getenv("ML_FACE_ENROLL_MAX_PITCH_RATIO", "0.80"))
ENROLL_UPSCALE_MIN_SIDE = int(os.getenv("ML_FACE_ENROLL_UPSCALE_MIN_SIDE", "120"))

# Step 5 — FAISS activates when enrolled vector count reaches this (0 = disabled).
FAISS_MIN_EMBEDDINGS = int(os.getenv("ML_FACE_FAISS_MIN_EMBEDDINGS", "500"))
FAISS_TOP_K = max(1, int(os.getenv("ML_FACE_FAISS_TOP_K", "5")))

# Step 7 — re-run face match on an active track after this many seconds.
TRACK_REVERIFY_SEC = float(os.getenv("ML_FACE_TRACK_REVERIFY_SEC", "30"))

# Step 8 — unknown gallery matching.
UNKNOWN_MATCH_THRESHOLD = float(os.getenv("ML_FACE_UNKNOWN_MATCH_THRESHOLD", "0.38"))
UNKNOWN_TTL_SEC = float(os.getenv("ML_FACE_UNKNOWN_TTL_SEC", "600"))
UNKNOWN_MAX_ENTRIES = max(10, int(os.getenv("ML_FACE_UNKNOWN_MAX_ENTRIES", "500")))

try:
    import faiss as _faiss

    _FAISS_AVAILABLE = True
except ImportError:
    _faiss = None
    _FAISS_AVAILABLE = False


def _download(url: str, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.is_file():
        return
    print(f"Downloading {dest.name}...")
    urllib.request.urlretrieve(url, dest)


def _configure_opencv_dnn_gpu() -> None:
    if os.getenv("ML_PREFER_GPU", "true").strip().lower() not in ("1", "true", "yes"):
        return
    if os.getenv("ML_DEVICE", "0").strip().lower() == "cpu":
        return
    try:
        if cv2.cuda.getCudaEnabledDeviceCount() < 1:
            print("[face] OpenCV built without CUDA — face models stay on CPU")
            return
        cv2.dnn.setPreferableBackend(cv2.dnn.DNN_BACKEND_CUDA)
        cv2.dnn.setPreferableTarget(cv2.dnn.DNN_TARGET_CUDA)
        print("[face] OpenCV DNN prefer CUDA for YuNet/SFace")
    except Exception as exc:
        print(f"[face] OpenCV DNN CUDA setup skipped: {exc}")


def _normalize_rows(matrix: np.ndarray) -> np.ndarray:
    out = np.asarray(matrix, dtype=np.float32)
    if out.ndim == 1:
        out = out.reshape(1, -1)
    norms = np.linalg.norm(out, axis=1, keepdims=True)
    norms[norms <= 0] = 1.0
    return out / norms


def is_unknown_label(label: str) -> bool:
    value = (label or "").strip().lower()
    return not value or value in {"unknown", "person", "face"} or value.startswith("unknown:")


@dataclass
class EnrolledFace:
    identity: str
    feature: np.ndarray
    quality: float | None = None

    def active_for_matching(self, min_quality: float) -> bool:
        if self.quality is None:
            return True
        return float(self.quality) >= min_quality


@dataclass
class RecognitionResult:
    identity: str
    score: float
    embedding: list[float] = field(default_factory=list)
    is_known: bool = False
    is_unknown_temp: bool = False
    match_method: str = "linear"


class UnknownFaceCache:
    """Step 8 — reuse the same temporary ID when the same unknown face reappears."""

    def __init__(
        self,
        *,
        match_threshold: float = UNKNOWN_MATCH_THRESHOLD,
        ttl_sec: float = UNKNOWN_TTL_SEC,
        max_entries: int = UNKNOWN_MAX_ENTRIES,
    ):
        self.match_threshold = match_threshold
        self.ttl_sec = ttl_sec
        self.max_entries = max_entries
        self._entries: list[tuple[str, np.ndarray, float]] = []
        self._counter = 0
        self._lock = threading.Lock()

    def resolve(self, feature: np.ndarray, *, recognizer) -> tuple[str, float]:
        now = time.time()
        feature = np.asarray(feature, dtype=np.float32).reshape(1, -1)
        with self._lock:
            self._prune(now)
            best_id = ""
            best_score = float(self.match_threshold)
            for temp_id, stored, _last_seen in self._entries:
                score = float(
                    recognizer.match(
                        feature,
                        stored,
                        cv2.FaceRecognizerSF_FR_COSINE,
                    )
                )
                if score > best_score:
                    best_score = score
                    best_id = temp_id
            if best_id:
                self._touch(best_id, now)
                return best_id, best_score

            self._counter += 1
            temp_id = f"unknown:U{self._counter:04d}"
            self._entries.append((temp_id, feature.copy(), now))
            if len(self._entries) > self.max_entries:
                self._entries.sort(key=lambda item: item[2])
                self._entries = self._entries[-self.max_entries :]
            return temp_id, 0.0

    def _touch(self, temp_id: str, now: float) -> None:
        for idx, (entry_id, feature, _last_seen) in enumerate(self._entries):
            if entry_id == temp_id:
                self._entries[idx] = (entry_id, feature, now)
                break

    def _prune(self, now: float) -> None:
        if self.ttl_sec <= 0:
            return
        cutoff = now - self.ttl_sec
        self._entries = [(tid, feat, seen) for tid, feat, seen in self._entries if seen >= cutoff]

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._entries)


class TrackRecognitionCache:
    """Step 7 — recognize once per track; re-verify occasionally."""

    def __init__(self, *, reverify_sec: float = TRACK_REVERIFY_SEC):
        self.reverify_sec = reverify_sec
        self._tracks: dict[tuple[str, int], dict] = {}
        self._lock = threading.Lock()

    def get(
        self,
        camera_key: str,
        track_id: int,
        *,
        now: float | None = None,
    ) -> dict | None:
        now = time.time() if now is None else now
        with self._lock:
            state = self._tracks.get((camera_key, int(track_id)))
            if not state:
                return None
            if now - float(state.get("recognized_at", 0)) >= self.reverify_sec:
                return None
            return dict(state)

    def put(
        self,
        camera_key: str,
        track_id: int,
        *,
        identity: str,
        score: float,
        embedding: list[float],
        now: float | None = None,
    ) -> None:
        now = time.time() if now is None else now
        with self._lock:
            self._tracks[(camera_key, int(track_id))] = {
                "identity": identity,
                "score": float(score),
                "embedding": list(embedding),
                "recognized_at": now,
            }

    def drop(self, camera_key: str, track_id: int) -> None:
        with self._lock:
            self._tracks.pop((camera_key, int(track_id)), None)

    def prune_inactive(self, camera_key: str, active_track_ids: set[int]) -> None:
        with self._lock:
            prefix = (camera_key,)
            stale = [key for key in self._tracks if key[0] == prefix[0] and key[1] not in active_track_ids]
            for key in stale:
                self._tracks.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._tracks.clear()


class _FaissGallery:
    """Step 5 — approximate nearest-neighbour search with cosine verification."""

    def __init__(self):
        self._index = None
        self._identities: list[str] = []
        self._features: list[np.ndarray] = []

    @property
    def ready(self) -> bool:
        return self._index is not None and len(self._identities) > 0

    def rebuild(self, enrolled: list[EnrolledFace], *, min_quality: float) -> bool:
        self._index = None
        self._identities = []
        self._features = []
        if not _FAISS_AVAILABLE or _faiss is None:
            return False

        active = [row for row in enrolled if row.active_for_matching(min_quality)]
        if not active:
            return False

        matrix = np.vstack([row.feature.reshape(-1) for row in active]).astype(np.float32)
        matrix = _normalize_rows(matrix)
        dim = matrix.shape[1]
        index = _faiss.IndexFlatIP(dim)
        index.add(matrix)
        self._index = index
        self._identities = [row.identity for row in active]
        self._features = [row.feature for row in active]
        return True

    def search(
        self,
        feature: np.ndarray,
        *,
        recognizer,
        top_k: int,
        threshold: float,
    ) -> tuple[str, float]:
        if not self.ready:
            return "unknown", float(threshold)

        query = _normalize_rows(np.asarray(feature, dtype=np.float32).reshape(1, -1))
        k = min(max(1, top_k), len(self._identities))
        scores, indices = self._index.search(query, k)

        best_name = "unknown"
        best_score = float(threshold)
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:
                continue
            identity = self._identities[int(idx)]
            verified = float(
                recognizer.match(
                    feature,
                    self._features[int(idx)],
                    cv2.FaceRecognizerSF_FR_COSINE,
                )
            )
            if verified > best_score:
                best_score = verified
                best_name = identity
        return best_name, best_score


class KnownFaceDB:
    """In-memory face matcher. Vectors are loaded from the database via apply_db_embeddings()."""

    def __init__(self, threshold=0.32):
        self.threshold = float(threshold)
        self.known: list[EnrolledFace] = []
        self.enrollment_min_quality = ENROLLMENT_MIN_QUALITY
        self.faiss_min_embeddings = FAISS_MIN_EMBEDDINGS
        self.faiss_top_k = FAISS_TOP_K

        _configure_opencv_dnn_gpu()

        yunet_path = MODEL_DIR / "face_detection_yunet_2023mar.onnx"
        sface_path = MODEL_DIR / "face_recognition_sface_2021dec.onnx"
        _download(YUNET_URL, yunet_path)
        _download(SFACE_URL, sface_path)

        self.detector = cv2.FaceDetectorYN.create(
            str(yunet_path),
            "",
            (320, 320),
            0.45,
            0.3,
            5000,
        )
        self._face_detection_disabled = False
        self.recognizer = cv2.FaceRecognizerSF.create(str(sface_path), "")
        self._lock = threading.Lock()
        self._faiss = _FaissGallery()
        self.unknown_cache = UnknownFaceCache()
        self.track_cache = TrackRecognitionCache()

    def reload(self):
        """Clear in-memory enrolled faces (database reload supplies new vectors)."""
        self.known = []
        self._faiss = _FaissGallery()

    def _rebuild_index(self) -> None:
        if self.faiss_min_embeddings <= 0:
            return
        active_count = sum(1 for row in self.known if row.active_for_matching(self.enrollment_min_quality))
        if active_count < self.faiss_min_embeddings:
            self._faiss = _FaissGallery()
            return
        built = self._faiss.rebuild(self.known, min_quality=self.enrollment_min_quality)
        if built:
            print(f"[face] FAISS index ready ({active_count} enrollment vectors, top_k={self.faiss_top_k})")

    def extract_embedding(self, image: np.ndarray) -> np.ndarray | None:
        """Return a face feature vector for enrollment (SFace embedding)."""
        if image is None or image.size == 0:
            return None
        with self._lock:
            detail = self._extract_enrollment_feature_with_meta(image)
            if detail is None:
                return None
            return detail["feature"]

    @staticmethod
    def embedding_to_list(feature: np.ndarray) -> list[float]:
        flat = np.asarray(feature, dtype=np.float32).reshape(-1)
        return [float(v) for v in flat]

    def register_embedding(
        self,
        identity: str,
        embedding: list[float] | np.ndarray,
        *,
        quality: float | None = None,
    ) -> None:
        identity = (identity or "").strip()
        if not identity:
            return
        feature = np.asarray(embedding, dtype=np.float32).reshape(1, -1)
        q = float(quality) if quality is not None else None
        self.known.append(EnrolledFace(identity=identity, feature=feature, quality=q))

    def apply_db_embeddings(self, entries: list[dict]) -> int:
        added = 0
        for entry in entries or []:
            identity = str(entry.get("identity") or "").strip()
            embedding = entry.get("embedding")
            if not identity or not isinstance(embedding, list) or not embedding:
                continue
            quality_raw = entry.get("quality")
            quality = float(quality_raw) if quality_raw is not None else None
            self.register_embedding(identity, embedding, quality=quality)
            added += 1
        self._rebuild_index()
        return added

    def matching_stats(self) -> dict:
        active = [row for row in self.known if row.active_for_matching(self.enrollment_min_quality)]
        identities = {row.identity for row in active}
        return {
            "enrolled_vectors": len(self.known),
            "active_vectors": len(active),
            "unique_identities": len(identities),
            "enrollment_min_quality": self.enrollment_min_quality,
            "threshold": self.threshold,
            "faiss_available": _FAISS_AVAILABLE,
            "faiss_enabled": self._faiss.ready,
            "faiss_min_embeddings": self.faiss_min_embeddings,
            "faiss_top_k": self.faiss_top_k,
            "unknown_cache_size": self.unknown_cache.size,
            "track_cache_size": len(self.track_cache._tracks),
        }

    def _clamp_bbox(self, bbox, width, height, pad_ratio=0.0):
        x1, y1, x2, y2 = bbox
        bw = x2 - x1
        bh = y2 - y1
        if pad_ratio > 0:
            x1 -= bw * pad_ratio
            y1 -= bh * pad_ratio
            x2 += bw * pad_ratio
            y2 += bh * pad_ratio
        x1 = max(0, min(width - 1, int(x1)))
        y1 = max(0, min(height - 1, int(y1)))
        x2 = max(0, min(width, int(x2)))
        y2 = max(0, min(height, int(y2)))
        return x1, y1, x2, y2

    def _upscale_if_small(self, image: np.ndarray, min_side=100):
        h, w = image.shape[:2]
        if min(h, w) >= min_side:
            return image
        scale = min_side / min(h, w)
        return cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_LINEAR)

    def _detect_faces(self, image: np.ndarray):
        h, w = image.shape[:2]
        if self._face_detection_disabled or h < 10 or w < 10:
            return None
        try:
            self.detector.setInputSize((w, h))
            _, faces = self.detector.detect(image)
        except cv2.error as exc:
            self._face_detection_disabled = True
            print(f"[face] YuNet detection disabled after OpenCV DNN error: {exc}")
            return None
        if faces is None or len(faces) == 0:
            return None
        return faces

    def _largest_face(self, image: np.ndarray):
        faces = self._detect_faces(image)
        if faces is None:
            return None
        areas = [float(f[2] * f[3]) for f in faces]
        return faces[int(np.argmax(areas))]

    def _faces_by_area(self, image: np.ndarray):
        faces = self._detect_faces(image)
        if faces is None:
            return []
        order = sorted(range(len(faces)), key=lambda idx: float(faces[idx][2] * faces[idx][3]), reverse=True)
        return [faces[idx] for idx in order]

    def _face_crop(self, image: np.ndarray, face) -> np.ndarray:
        h, w = image.shape[:2]
        fw, fh = max(float(face[2]), 1.0), max(float(face[3]), 1.0)
        x, y = int(face[0]), int(face[1])
        x2, y2 = min(w, x + int(fw)), min(h, y + int(fh))
        return image[max(0, y) : y2, max(0, x) : x2]

    @staticmethod
    def _estimate_pose_ratios(face) -> tuple[float, float]:
        """Approximate yaw/pitch from YuNet landmarks (lower is more frontal)."""
        re = np.array([float(face[4]), float(face[5])])
        le = np.array([float(face[6]), float(face[7])])
        nose = np.array([float(face[8]), float(face[9])])
        rcm = np.array([float(face[10]), float(face[11])])
        lcm = np.array([float(face[12]), float(face[13])])

        eye_mid = (re + le) * 0.5
        mouth_mid = (rcm + lcm) * 0.5
        inter_eye = float(np.linalg.norm(le - re))
        if inter_eye < 1.0:
            return 1.0, 1.0

        face_mid_x = (eye_mid[0] + mouth_mid[0]) * 0.5
        yaw_ratio = abs(nose[0] - face_mid_x) / inter_eye

        eye_to_nose = max(float(nose[1] - eye_mid[1]), 1.0)
        nose_to_mouth = max(float(mouth_mid[1] - nose[1]), 1.0)
        pitch_ratio = abs((eye_to_nose / nose_to_mouth) - 1.0)
        return yaw_ratio, pitch_ratio

    @staticmethod
    def _landmarks_plausible(face) -> bool:
        """Reject collapsed or occluded landmark sets before SFace."""
        re = np.array([float(face[4]), float(face[5])])
        le = np.array([float(face[6]), float(face[7])])
        nose = np.array([float(face[8]), float(face[9])])
        rcm = np.array([float(face[10]), float(face[11])])
        lcm = np.array([float(face[12]), float(face[13])])

        fw = max(float(face[2]), 1.0)
        inter_eye = float(np.linalg.norm(le - re))
        if inter_eye < fw * 0.18:
            return False

        eye_y_diff = abs(re[1] - le[1])
        if eye_y_diff > inter_eye * 0.45:
            return False

        mouth_width = float(np.linalg.norm(lcm - rcm))
        if mouth_width < inter_eye * 0.25:
            return False

        if nose[1] <= min(re[1], le[1]) + inter_eye * 0.02:
            return False
        if min(rcm[1], lcm[1]) <= nose[1] + inter_eye * 0.02:
            return False

        x, y, w, h = float(face[0]), float(face[1]), fw, max(float(face[3]), 1.0)
        margin_x, margin_y = w * 0.08, h * 0.08
        for point in (re, le, nose, rcm, lcm):
            if not (x - margin_x <= point[0] <= x + w + margin_x):
                return False
            if not (y - margin_y <= point[1] <= y + h + margin_y):
                return False
        return True

    def _face_quality_metrics(self, image: np.ndarray, face) -> dict[str, float]:
        h, w = image.shape[:2]
        confidence = float(face[14]) if len(face) > 14 else 0.0
        fw, fh = max(float(face[2]), 1.0), max(float(face[3]), 1.0)
        size_ratio = (fw * fh) / max(w * h, 1)
        size_score = min(1.0, max(0.0, (size_ratio - 0.01) / 0.25))

        crop = self._face_crop(image, face)
        lap_var = 0.0
        brightness = 0.0
        sharpness = 0.0
        if crop.size > 0:
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if len(crop.shape) == 3 else crop
            lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
            sharpness = min(1.0, lap_var / 500.0)
            brightness = float(np.mean(gray))

        yaw_ratio, pitch_ratio = self._estimate_pose_ratios(face)
        pose_score = max(
            0.0,
            1.0
            - (
                (yaw_ratio / max(FACE_MAX_YAW_RATIO, 1e-6))
                + (pitch_ratio / max(FACE_MAX_PITCH_RATIO, 1e-6))
            )
            * 0.5,
        )
        brightness_score = 1.0
        if brightness < FACE_MIN_BRIGHTNESS:
            brightness_score = max(0.0, brightness / max(FACE_MIN_BRIGHTNESS, 1.0))
        elif brightness > FACE_MAX_BRIGHTNESS:
            brightness_score = max(
                0.0,
                1.0 - ((brightness - FACE_MAX_BRIGHTNESS) / max(255.0 - FACE_MAX_BRIGHTNESS, 1.0)),
            )

        quality = (
            (0.35 * confidence)
            + (0.20 * size_score)
            + (0.20 * sharpness)
            + (0.15 * pose_score)
            + (0.10 * brightness_score)
        )
        return {
            "confidence": confidence,
            "width": fw,
            "height": fh,
            "laplacian_var": lap_var,
            "brightness": brightness,
            "yaw_ratio": yaw_ratio,
            "pitch_ratio": pitch_ratio,
            "quality": round(float(max(0.0, min(1.0, quality))), 4),
        }

    def _passes_face_quality(self, image: np.ndarray, face) -> tuple[bool, dict[str, float]]:
        metrics = self._face_quality_metrics(image, face)
        if metrics["confidence"] < FACE_MIN_CONFIDENCE:
            return False, metrics
        if metrics["width"] < FACE_MIN_SIZE_PX or metrics["height"] < FACE_MIN_SIZE_PX:
            return False, metrics
        if metrics["laplacian_var"] < FACE_MIN_LAPLACIAN_VAR:
            return False, metrics
        if metrics["brightness"] < FACE_MIN_BRIGHTNESS or metrics["brightness"] > FACE_MAX_BRIGHTNESS:
            return False, metrics
        if metrics["yaw_ratio"] > FACE_MAX_YAW_RATIO or metrics["pitch_ratio"] > FACE_MAX_PITCH_RATIO:
            return False, metrics
        if FACE_CHECK_OCCLUSION and not self._landmarks_plausible(face):
            return False, metrics
        return True, metrics

    def _passes_enrollment_quality(self, image: np.ndarray, face) -> tuple[bool, dict[str, float]]:
        """Relaxed gates for uploaded enrollment photos (left/right/up/down poses)."""
        metrics = self._face_quality_metrics(image, face)
        if metrics["confidence"] < ENROLL_MIN_CONFIDENCE:
            return False, metrics
        if metrics["width"] < ENROLL_MIN_SIZE_PX or metrics["height"] < ENROLL_MIN_SIZE_PX:
            return False, metrics
        if metrics["laplacian_var"] < ENROLL_MIN_LAPLACIAN_VAR:
            return False, metrics
        if metrics["brightness"] < ENROLL_MIN_BRIGHTNESS or metrics["brightness"] > ENROLL_MAX_BRIGHTNESS:
            return False, metrics
        if metrics["yaw_ratio"] > ENROLL_MAX_YAW_RATIO or metrics["pitch_ratio"] > ENROLL_MAX_PITCH_RATIO:
            return False, metrics
        if FACE_CHECK_OCCLUSION and not self._landmarks_plausible(face):
            return False, metrics
        return True, metrics

    def _extract_enrollment_feature_with_meta(self, image: np.ndarray) -> dict | None:
        """Try all detected faces; pick the best-quality one that passes enrollment gates."""
        image = self._upscale_if_small(image, min_side=ENROLL_UPSCALE_MIN_SIDE)
        best: tuple[float, object, dict[str, float]] | None = None
        fallback: tuple[float, object, dict[str, float]] | None = None

        for face in self._faces_by_area(image):
            metrics = self._face_quality_metrics(image, face)
            passed, _ = self._passes_enrollment_quality(image, face)
            if passed:
                quality = float(metrics["quality"])
                if best is None or quality > best[0]:
                    best = (quality, face, metrics)
                continue
            confidence = float(metrics["confidence"])
            if confidence >= ENROLL_MIN_CONFIDENCE and fallback is None:
                fallback = (confidence, face, metrics)

        chosen = best or fallback
        if chosen is None:
            return None

        _, face, metrics = chosen
        aligned = self.recognizer.alignCrop(image, face)
        feature = self.recognizer.feature(aligned)
        return {
            "feature": feature,
            "quality": metrics["quality"],
        }

    def _extract_feature_with_meta(self, image: np.ndarray) -> dict | None:
        image = self._upscale_if_small(image)
        face = self._largest_face(image)
        if face is None:
            return None
        passed, metrics = self._passes_face_quality(image, face)
        if not passed:
            return None
        aligned = self.recognizer.alignCrop(image, face)
        feature = self.recognizer.feature(aligned)
        return {
            "feature": feature,
            "quality": metrics["quality"],
        }

    def extract_embedding_detail(self, image: np.ndarray) -> dict | None:
        """Return SFace feature vector plus enrollment quality metadata."""
        if image is None or image.size == 0:
            return None
        with self._lock:
            return self._extract_enrollment_feature_with_meta(image)

    def _extract_feature(self, image: np.ndarray):
        detail = self._extract_feature_with_meta(image)
        if detail is None:
            return None
        return detail["feature"]

    def _match_feature_linear(self, feature: np.ndarray) -> tuple[str, float]:
        best_name = "unknown"
        best_score = float(self.threshold)
        for row in self.known:
            if not row.active_for_matching(self.enrollment_min_quality):
                continue
            score = float(
                self.recognizer.match(
                    feature,
                    row.feature,
                    cv2.FaceRecognizerSF_FR_COSINE,
                )
            )
            if score > best_score:
                best_score = score
                best_name = row.identity
        return best_name, best_score

    def _match_feature(self, feature: np.ndarray) -> tuple[str, float, str]:
        if self._faiss.ready:
            name, score = self._faiss.search(
                feature,
                recognizer=self.recognizer,
                top_k=self.faiss_top_k,
                threshold=self.threshold,
            )
            return name, score, "faiss"
        name, score = self._match_feature_linear(feature)
        return name, score, "linear"

    def _resolve_unknown(self, feature: np.ndarray) -> tuple[str, float]:
        temp_id, score = self.unknown_cache.resolve(feature, recognizer=self.recognizer)
        return temp_id, score

    def recognize_feature(
        self,
        feature: np.ndarray,
        *,
        use_unknown_cache: bool = True,
    ) -> RecognitionResult:
        if feature is None:
            return RecognitionResult(identity="unknown", score=0.0)
        if not self.known:
            if use_unknown_cache:
                temp_id, score = self._resolve_unknown(feature)
                return RecognitionResult(
                    identity=temp_id,
                    score=score,
                    embedding=self.embedding_to_list(feature),
                    is_unknown_temp=True,
                    match_method="unknown_cache",
                )
            return RecognitionResult(identity="unknown", score=0.0, embedding=self.embedding_to_list(feature))

        name, score, method = self._match_feature(feature)
        embedding = self.embedding_to_list(feature)
        if name != "unknown":
            return RecognitionResult(
                identity=name,
                score=score,
                embedding=embedding,
                is_known=True,
                match_method=method,
            )

        if use_unknown_cache:
            temp_id, unknown_score = self._resolve_unknown(feature)
            return RecognitionResult(
                identity=temp_id,
                score=unknown_score,
                embedding=embedding,
                is_unknown_temp=True,
                match_method="unknown_cache",
            )
        return RecognitionResult(identity="unknown", score=score, embedding=embedding, match_method=method)

    def recognize_with_score(self, image: np.ndarray) -> tuple[str, float]:
        if image is None or image.size == 0:
            return "unknown", 0.0
        with self._lock:
            feature = self._extract_feature(image)
            if feature is None:
                return "unknown", 0.0
            result = self.recognize_feature(feature)
            return result.identity, result.score

    def recognize_with_detail(self, image: np.ndarray) -> RecognitionResult:
        if image is None or image.size == 0:
            return RecognitionResult(identity="unknown", score=0.0)
        with self._lock:
            feature = self._extract_feature(image)
            if feature is None:
                return RecognitionResult(identity="unknown", score=0.0)
            return self.recognize_feature(feature)

    def recognize_track(
        self,
        image: np.ndarray,
        *,
        camera_key: str,
        track_id: int,
        bbox=None,
        force: bool = False,
    ) -> RecognitionResult:
        """Step 7 — cache identity per ByteTrack id until re-verification is due."""
        if image is None or image.size == 0:
            return RecognitionResult(identity="unknown", score=0.0)

        with self._lock:
            if not force:
                cached = self.track_cache.get(camera_key, track_id)
                if cached:
                    return RecognitionResult(
                        identity=str(cached["identity"]),
                        score=float(cached.get("score") or 0.0),
                        embedding=list(cached.get("embedding") or []),
                        is_known=not is_unknown_label(str(cached["identity"])),
                        is_unknown_temp=str(cached["identity"]).startswith("unknown:"),
                        match_method="track_cache",
                    )

            feature = self._extract_feature(image)
            if feature is None and bbox is not None:
                h, w = image.shape[:2]
                x1, y1, x2, y2 = self._clamp_bbox(bbox, w, h)
                if x2 > x1 and y2 > y1:
                    person_crop = image[y1:y2, x1:x2]
                    feature = self._extract_feature(person_crop)

            if feature is None:
                return RecognitionResult(identity="unknown", score=0.0)

            result = self.recognize_feature(feature)
            self.track_cache.put(
                camera_key,
                track_id,
                identity=result.identity,
                score=result.score,
                embedding=result.embedding,
            )
            result.match_method = "fresh" if result.match_method != "track_cache" else result.match_method
            return result

    def has_face(self, image: np.ndarray) -> bool:
        if image is None or image.size == 0:
            return False
        with self._lock:
            return self._extract_feature(image) is not None

    def recognize_image(self, image: np.ndarray) -> str:
        name, _ = self.recognize_with_score(image)
        return name

    def recognize_person(self, frame: np.ndarray, bbox) -> str:
        """Find face inside a YOLO person box (head region first)."""
        h, w = frame.shape[:2]
        x1, y1, x2, y2 = self._clamp_bbox(bbox, w, h)
        if x2 <= x1 or y2 <= y1:
            return "unknown"

        person_h = y2 - y1
        head_y2 = y1 + max(40, int(person_h * 0.6))
        head_crop = frame[y1:head_y2, x1:x2]
        name = self.recognize_image(head_crop)
        if not is_unknown_label(name):
            return name

        person_crop = frame[y1:y2, x1:x2]
        return self.recognize_image(person_crop)

    def recognize_face_box(self, frame: np.ndarray, bbox) -> str:
        """Recognize from a YOLO face box (with padding)."""
        h, w = frame.shape[:2]
        x1, y1, x2, y2 = self._clamp_bbox(bbox, w, h, pad_ratio=0.2)
        if x2 <= x1 or y2 <= y1:
            return "unknown"
        crop = frame[y1:y2, x1:x2]
        return self.recognize_image(crop)

    def label_detection_detail(
        self,
        frame: np.ndarray,
        cls_id: int,
        yolo_name: str,
        bbox,
    ) -> dict:
        """Return label plus optional face embedding for journey ingest."""
        name_lower = yolo_name.lower()
        meta = {
            "label": yolo_name,
            "face_embedding": [],
            "face_match_score": None,
            "face_match_method": "",
        }

        if cls_id == 80 or name_lower == "face":
            h, w = frame.shape[:2]
            x1, y1, x2, y2 = self._clamp_bbox(bbox, w, h, pad_ratio=0.2)
            if x2 <= x1 or y2 <= y1:
                meta["label"] = "unknown"
                return meta
            crop = frame[y1:y2, x1:x2]
            result = self.recognize_with_detail(crop)
        elif cls_id == 0 or name_lower == "person":
            h, w = frame.shape[:2]
            x1, y1, x2, y2 = self._clamp_bbox(bbox, w, h)
            if x2 <= x1 or y2 <= y1:
                meta["label"] = "unknown"
                return meta
            person_h = y2 - y1
            head_y2 = y1 + max(40, int(person_h * 0.6))
            head_crop = frame[y1:head_y2, x1:x2]
            result = self.recognize_with_detail(head_crop)
            if is_unknown_label(result.identity):
                person_crop = frame[y1:y2, x1:x2]
                result = self.recognize_with_detail(person_crop)
        else:
            meta["label"] = yolo_name
            return meta

        meta["label"] = result.identity
        meta["face_embedding"] = result.embedding
        meta["face_match_score"] = round(float(result.score), 4) if result.score else None
        meta["face_match_method"] = result.match_method
        return meta

    def label_detection(self, frame: np.ndarray, cls_id: int, yolo_name: str, bbox) -> str:
        return self.label_detection_detail(frame, cls_id, yolo_name, bbox)["label"]
