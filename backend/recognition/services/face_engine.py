from __future__ import annotations

import base64
import logging
import os
import threading
from pathlib import Path

# Cap native BLAS/OpenMP thread pools before InsightFace/ONNX/OpenCV load (per process).
for _env_key, _env_val in (
    ("OMP_NUM_THREADS", "1"),
    ("OPENBLAS_NUM_THREADS", "1"),
    ("MKL_NUM_THREADS", "1"),
    ("NUMEXPR_NUM_THREADS", "1"),
    ("VECLIB_MAXIMUM_THREADS", "1"),
    ("BLIS_NUM_THREADS", "1"),
):
    os.environ.setdefault(_env_key, _env_val)

import cv2
import numpy as np
from django.conf import settings
from PIL import Image

from recognition.services.quality_checker import FaceQualityChecker

logger = logging.getLogger(__name__)

_engine = None
_engine_lock = threading.Lock()


def _webcam_threshold() -> float:
    return float(getattr(settings, "ATTENDANCE_WEBCAM_SIMILARITY_THRESHOLD", 0.45))


def _cctv_threshold() -> float:
    return float(getattr(settings, "ATTENDANCE_CCTV_SIMILARITY_THRESHOLD", 0.38))


# Backwards-compatible module constants (resolved at import; settings override in match)
SIMILARITY_THRESHOLD = 0.45
CCTV_SIMILARITY_THRESHOLD = 0.38
MODEL_VERSION = "InsightFace_v1_multi_light"


_GPU_PROVIDER_ORDER = (
    "CUDAExecutionProvider",
    "TensorrtExecutionProvider",
    "DmlExecutionProvider",
)
_CPU_PROVIDER = "CPUExecutionProvider"
_CUDA_PROVIDER = "CUDAExecutionProvider"


def _cpu_fallback_enabled() -> bool:
    return os.getenv("ATTENDANCE_GPU_CPU_FALLBACK", "true").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def _onnx_session_options():
    """Single-threaded ONNX sessions to avoid native thread explosion per Gunicorn worker."""
    import onnxruntime as ort

    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 1
    opts.inter_op_num_threads = 1
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    return opts


def _select_onnx_providers() -> list[str]:
    """Build provider chain with GPU first. Trust ORT's available list — no probe session."""
    import onnxruntime as ort

    available = set(ort.get_available_providers())
    override = (getattr(settings, "ATTENDANCE_ONNX_PROVIDERS", "") or "").strip()

    if override:
        requested = [p.strip() for p in override.split(",") if p.strip()]
    else:
        requested = [*_GPU_PROVIDER_ORDER, _CPU_PROVIDER]

    providers: list[str] = []
    for name in requested:
        if name in available and name not in providers:
            providers.append(name)

    if _cpu_fallback_enabled() and _CPU_PROVIDER in available and _CPU_PROVIDER not in providers:
        providers.append(_CPU_PROVIDER)

    if not providers:
        providers = [_CPU_PROVIDER]

    logger.info(
        "ONNX Runtime providers (InsightFace): %s (ort_available=%s)",
        providers,
        sorted(available),
    )
    return providers


def _insightface_ctx_id(providers: list[str]) -> int:
    """InsightFace ctx_id: 0 = GPU, -1 = CPU-only."""
    if providers and providers[0] != _CPU_PROVIDER:
        return 0
    return -1


def _log_insightface_session_providers(app) -> None:
    """Log which EP each InsightFace sub-model actually loaded."""
    try:
        for model_name, model in getattr(app, "models", {}).items():
            session = getattr(model, "session", None)
            if session is not None and hasattr(session, "get_providers"):
                logger.info(
                    "InsightFace sub-model %s active providers: %s",
                    model_name,
                    session.get_providers(),
                )
    except Exception as exc:
        logger.debug("Could not inspect InsightFace session providers: %s", exc)


def _create_face_analysis(model_name: str, providers: list[str], ctx_id: int):
    """Instantiate FaceAnalysis; try GPU-only chain first, then GPU+CPU, then CPU."""
    from insightface.app import FaceAnalysis

    gpu_chain = [p for p in providers if p != _CPU_PROVIDER]
    cpu_ok = _CPU_PROVIDER in providers

    attempts: list[tuple[list[str], int, str]] = []
    if _CUDA_PROVIDER in providers:
        attempts.append(([_CUDA_PROVIDER], 0, "cuda-only"))
    if gpu_chain and gpu_chain != [_CUDA_PROVIDER]:
        attempts.append((gpu_chain, 0, "gpu-only"))
    if gpu_chain and cpu_ok:
        attempts.append(([*gpu_chain, _CPU_PROVIDER], 0, "gpu-with-cpu-fallback"))
    if cpu_ok and _cpu_fallback_enabled():
        attempts.append(([_CPU_PROVIDER], -1, "cpu-only"))

    if not attempts:
        attempts.append((providers, ctx_id, "configured"))

    last_exc: Exception | None = None
    for attempt_providers, attempt_ctx, label in attempts:
        fa_kwargs: dict = {"providers": attempt_providers}
        try:
            fa_kwargs["session_options"] = _onnx_session_options()
            app = FaceAnalysis(name=model_name, **fa_kwargs)
        except TypeError:
            fa_kwargs.pop("session_options", None)
            app = FaceAnalysis(name=model_name, **fa_kwargs)
        try:
            app.prepare(ctx_id=attempt_ctx, det_size=(640, 640))
            logger.info(
                "InsightFace initialized (%s, ctx_id=%s, providers=%s)",
                label,
                attempt_ctx,
                attempt_providers,
            )
            _log_insightface_session_providers(app)
            return app, attempt_providers, attempt_ctx
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "InsightFace init failed (%s, providers=%s): %s",
                label,
                attempt_providers,
                exc,
            )

    raise RuntimeError(
        f"InsightFace could not initialize with any provider chain (tried {len(attempts)})."
    ) from last_exc


def get_face_engine():
    global _engine
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                _engine = FaceEngine()
    return _engine


def _ensure_insightface_pack(model_name: str, root: str = "~/.insightface") -> Path:
    """Ensure the InsightFace model pack exists and contains ONNX files.

    InsightFace skips download when the pack folder already exists — even if it
    is empty — which leads to ``assert 'detection' in self.models``.
    """
    from insightface.utils.storage import download

    pack_dir = Path(root).expanduser() / "models" / model_name
    onnx_files = list(pack_dir.glob("*.onnx")) if pack_dir.is_dir() else []
    if onnx_files:
        return pack_dir

    logger.warning(
        "InsightFace pack '%s' missing or empty at %s — downloading…",
        model_name,
        pack_dir,
    )
    download("models", model_name, force=True, root=root)
    onnx_files = list(pack_dir.glob("*.onnx"))
    if not onnx_files:
        raise RuntimeError(
            f"InsightFace model pack '{model_name}' has no .onnx files after download "
            f"at {pack_dir}. Check network access to GitHub releases."
        )
    logger.info("InsightFace pack '%s' ready (%d onnx files)", model_name, len(onnx_files))
    return pack_dir


class FaceEngine:
    def __init__(self):
        providers = _select_onnx_providers()
        model_name = getattr(settings, "ATTENDANCE_INSIGHTFACE_MODEL", "buffalo_l")
        _ensure_insightface_pack(model_name)
        self.app, self.providers, ctx_id = _create_face_analysis(model_name, providers, _insightface_ctx_id(providers))
        logger.info(
            "InsightFace ready (model=%s, ctx_id=%s, primary_provider=%s)",
            model_name,
            ctx_id,
            self.providers[0] if self.providers else "none",
        )
        self.quality = FaceQualityChecker()
        self._infer_lock = threading.Lock()

    @staticmethod
    def decode_image(image_bytes: bytes) -> np.ndarray:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Invalid image data")
        return image

    @staticmethod
    def decode_base64(data: str) -> np.ndarray:
        if "," in data:
            data = data.split(",", 1)[1]
        return FaceEngine.decode_image(base64.b64decode(data))

    def detect_faces(self, image: np.ndarray):
        with self._infer_lock:
            return self.app.get(image)

    @staticmethod
    def resize_max(image: np.ndarray, max_side: int = 640) -> np.ndarray:
        h, w = image.shape[:2]
        side = max(h, w)
        if side <= max_side:
            return image
        scale = max_side / side
        return cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    def get_single_face(self, image: np.ndarray, allow_largest: bool = False):
        faces = self.detect_faces(image)
        if not faces:
            return None, "No face detected"
        if len(faces) > 1 and not allow_largest:
            return None, "Multiple faces detected — only one person allowed"
        if len(faces) == 1:
            return faces[0], None

        def face_area(f):
            x1, y1, x2, y2 = f.bbox
            return max(float(x2 - x1), 1.0) * max(float(y2 - y1), 1.0)

        return max(faces, key=face_area), None

    def extract_embedding(self, image: np.ndarray) -> np.ndarray | None:
        face, error = self.get_single_face(image, allow_largest=True)
        if error:
            return None
        return face.embedding

    def check_quality(self, image: np.ndarray) -> dict:
        small = self.resize_max(image, 640)
        face, error = self.get_single_face(small, allow_largest=True)
        if error:
            return {"passed": False, "message": error}
        result = self.quality.evaluate(small, face)
        result["bbox"] = face.bbox.astype(int).tolist()
        result["image"] = small
        if result["passed"]:
            from recognition.services.antispoof import get_antispoof

            liveness = get_antispoof().evaluate(small, face, source="webcam")
            result["liveness"] = liveness
            if not liveness.get("passed", True):
                result["passed"] = False
                result["message"] = liveness.get("message") or "Spoof detected"
        return result

    def check_liveness(self, image: np.ndarray, face, *, source: str = "webcam") -> dict:
        from recognition.services.antispoof import get_antispoof

        return get_antispoof().evaluate(image, face, source=source)

    def _relight_probe(self, image: np.ndarray, face):
        from recognition.services.preprocess import correct_exposure

        bbox = getattr(face, "bbox", None)
        if bbox is None:
            return image, face
        height, width = image.shape[:2]
        x1, y1, x2, y2 = [int(v) for v in bbox]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(width, x2), min(height, y2)
        crop = image[y1:y2, x1:x2]
        if crop.size == 0:
            return image, face
        mean = float(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY).mean())
        if 50.0 <= mean <= 200.0:
            return image, face
        corrected = correct_exposure(image)
        faces = self.detect_faces(corrected)
        if not faces:
            return image, face
        return corrected, max(faces, key=lambda item: float(getattr(item, "det_score", 0.0)))

    def _relight_crop(self, image: np.ndarray, face):
        """Exposure-correct the face crop so a crowded frame does not switch identity."""
        from recognition.services.preprocess import correct_exposure

        bbox = getattr(face, "bbox", None)
        if bbox is None:
            return face
        height, width = image.shape[:2]
        x1, y1, x2, y2 = [int(v) for v in bbox]
        pad_x = int(max(x2 - x1, 1) * 0.35)
        pad_y = int(max(y2 - y1, 1) * 0.35)
        cx1, cy1 = max(0, x1 - pad_x), max(0, y1 - pad_y)
        cx2, cy2 = min(width, x2 + pad_x), min(height, y2 + pad_y)
        crop = image[cy1:cy2, cx1:cx2]
        if crop.size == 0:
            return face
        mean = float(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY).mean())
        if 50.0 <= mean <= 200.0:
            return face
        faces = self.detect_faces(correct_exposure(crop))
        if not faces:
            return face
        return max(faces, key=lambda item: float(getattr(item, "det_score", 0.0)))

    def generate_embeddings_from_folder(self, folder_path: Path) -> list[np.ndarray]:
        from recognition.services.preprocess import lighting_variants

        embeddings = []
        for img_path in sorted(folder_path.glob("*.jpg")):
            image = cv2.imread(str(img_path))
            if image is None:
                continue
            image = self.resize_max(image, 640)
            for variant in lighting_variants(image):
                emb = self.extract_embedding(variant)
                if emb is not None:
                    embeddings.append(emb)
        return embeddings

    def train_enrollment(self, enrollment, folder: Path, *, required: int) -> dict:
        from recognition.services.gallery_index import invalidate_gallery

        source_images = len(list(folder.glob("*.jpg")))
        embeddings = self.generate_embeddings_from_folder(folder)
        if source_images < required or len(embeddings) < required:
            return {
                "trained": False,
                "error": (
                    f"Only {source_images} photos and {len(embeddings)} face vectors. "
                    "Recapture with better quality."
                ),
                "images_used": source_images,
            }
        mean_embedding = self.average_embedding(embeddings)
        enrollment.embedding = mean_embedding
        enrollment.embeddings = [emb.tolist() if hasattr(emb, "tolist") else list(emb) for emb in embeddings]
        enrollment.is_trained = True
        enrollment.is_enrolled = True
        enrollment.model_version = MODEL_VERSION
        enrollment.save(
            update_fields=[
                "embedding",
                "embeddings",
                "is_trained",
                "is_enrolled",
                "model_version",
                "updated_at",
            ]
        )
        invalidate_gallery()
        return {
            "trained": True,
            "embedding_dim": len(mean_embedding),
            "images_used": source_images,
            "vectors": len(embeddings),
        }

    def match_probe(self, embedding, *, source: str = "webcam") -> dict:
        from recognition.services.gallery_index import best_match, get_gallery_index

        threshold = _cctv_threshold() if source == "cctv" else _webcam_threshold()
        return best_match(embedding, get_gallery_index(), threshold=threshold)

    def identify_from_image(
        self,
        image: np.ndarray,
        gallery: dict[str, list[float]] | None = None,
        threshold: float | None = None,
        source: str = "webcam",
    ) -> dict:
        from recognition.services.preprocess import apply_clahe_bgr
        from recognition.services.reviews import enqueue_match_review, record_spoof, record_unknown

        del gallery  # live search uses GalleryIndex
        small = self.resize_max(image, 640)
        face, error = self.get_single_face(small, allow_largest=True)
        if error:
            small = apply_clahe_bgr(small)
            face, error = self.get_single_face(small, allow_largest=True)
            if error:
                record_unknown(source=source, message=error)
                return {"matched": False, "message": error, "confidence": 0.0}

        liveness = self.check_liveness(small, face, source=source)
        if not liveness.get("passed", True):
            record_spoof(source=source, message=liveness.get("message") or "Spoof")
            return {
                "matched": False,
                "message": liveness.get("message") or "Spoof detected",
                "confidence": 0.0,
                "spoof": True,
                "liveness": liveness,
            }

        small, face = self._relight_probe(small, face)
        if threshold is not None:
            from recognition.services.gallery_index import best_match, get_gallery_index

            match = best_match(face.embedding, get_gallery_index(), threshold=threshold)
        else:
            match = self.match_probe(face.embedding, source=source)
        return self._match_result(match, source=source)

    def score_face(self, image: np.ndarray, face, *, source: str = "cctv", camera_id: int | None = None) -> dict:
        """One detected face: liveness, exposure correction, then gallery match."""
        from recognition.services.reviews import record_spoof

        liveness = self.check_liveness(image, face, source=source)
        if not liveness.get("passed", True):
            record_spoof(
                source=source,
                camera_id=camera_id,
                message=liveness.get("message") or "Spoof",
            )
            return {
                "matched": False,
                "spoof": True,
                "confidence": 0.0,
                "message": liveness.get("message") or "Spoof detected",
                "liveness": liveness,
            }
        face = self._relight_crop(image, face)
        embedding = getattr(face, "embedding", None)
        if embedding is None:
            return {"matched": False, "confidence": 0.0, "message": "No face embedding"}
        match = self.match_probe(embedding, source=source)
        result = self._match_result(match, source=source, camera_id=camera_id)
        result["face"] = face
        return result

    @staticmethod
    def _match_result(match: dict, *, source: str, camera_id: int | None = None) -> dict:
        from recognition.services.reviews import enqueue_match_review, record_unknown

        confidence = round(float(match.get("confidence") or 0.0), 4)
        gallery_key = match.get("gallery_key")
        if gallery_key:
            staff_id = int(gallery_key.replace("staff-", "")) if str(gallery_key).startswith("staff-") else None
            return {
                "matched": True,
                "gallery_key": gallery_key,
                "staff_id": staff_id,
                "confidence": confidence,
                "message": "Face recognized",
            }
        if match.get("ambiguous"):
            enqueue_match_review(
                confidence=confidence,
                source=source,
                camera_id=camera_id,
                message="Ambiguous match",
            )
            return {"matched": False, "confidence": confidence, "message": "Ambiguous face — not marked"}
        if match.get("soft_miss"):
            enqueue_match_review(confidence=confidence, source=source, camera_id=camera_id)
            return {"matched": False, "confidence": confidence, "message": "Possible match held for review"}
        record_unknown(confidence=confidence, source=source, camera_id=camera_id, message="Unknown face")
        return {"matched": False, "confidence": confidence, "message": "Unknown face"}

    @staticmethod
    def average_embedding(embeddings: list[np.ndarray]) -> list[float]:
        if not embeddings:
            return []
        mean = np.mean(np.stack(embeddings), axis=0)
        norm = np.linalg.norm(mean)
        if norm > 0:
            mean = mean / norm
        return mean.tolist()

    def save_dataset_image(self, image: np.ndarray, folder: Path, index: int) -> Path:
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"face_{index:03d}.jpg"
        cv2.imwrite(str(path), image)
        return path

    def save_profile_image(self, image: np.ndarray, staff_id: int) -> str:
        profile_dir = Path(settings.MEDIA_ROOT) / "recognition" / "profile"
        profile_dir.mkdir(parents=True, exist_ok=True)
        path = profile_dir / f"staff_{staff_id}.jpg"
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        Image.fromarray(rgb).save(path, format="JPEG", quality=90)
        return str(path.relative_to(settings.MEDIA_ROOT)).replace("\\", "/")

    def match_embedding(
        self,
        probe: np.ndarray | list[float],
        gallery: dict[str, list[float]],
        threshold: float | None = None,
    ) -> tuple[str | None, float]:
        if not gallery:
            return None, 0.0
        min_sim = _webcam_threshold() if threshold is None else threshold
        probe_vec = np.array(probe, dtype=np.float32)
        norm = np.linalg.norm(probe_vec)
        if norm == 0:
            return None, 0.0
        probe_vec = probe_vec / norm

        best_id = None
        best_sim = -1.0
        for key, stored in gallery.items():
            stored_vec = np.array(stored, dtype=np.float32)
            stored_norm = np.linalg.norm(stored_vec)
            if stored_norm == 0:
                continue
            stored_vec = stored_vec / stored_norm
            sim = float(np.dot(probe_vec, stored_vec))
            if sim > best_sim:
                best_sim = sim
                best_id = key

        if best_sim >= min_sim:
            return best_id, best_sim
        return None, best_sim
