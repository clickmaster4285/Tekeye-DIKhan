"""Visitor InsightFace gallery. Isolated from staff attendance matching."""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

import numpy as np
from django.conf import settings
from django.core.files.base import ContentFile
from django.db.models import Count, Q
from django.utils import timezone

from .face_quality import VisitorFaceQuality
from .models import Visitor, VisitorFace

logger = logging.getLogger(__name__)

_gallery_lock = threading.Lock()
_gallery_cache: list[tuple[int, str, list[float]]] = []
_gallery_at = 0.0


def min_enrollment_images() -> int:
    return max(1, int(getattr(settings, "VISITOR_MIN_ENROLLMENT_IMAGES", 3)))


def max_enrollment_images() -> int:
    return max(min_enrollment_images(), int(getattr(settings, "VISITOR_MAX_ENROLLMENT_IMAGES", 5)))


def similarity_threshold() -> float:
    return float(getattr(settings, "VISITOR_FACE_SIMILARITY_THRESHOLD", 0.42))


def cache_ttl() -> float:
    return float(getattr(settings, "VISITOR_GALLERY_CACHE_SECONDS", 30))


def normalize_embedding(embedding) -> list[float]:
    vec = np.asarray(embedding, dtype=np.float32).reshape(-1)
    if vec.size == 0:
        return []
    norm = float(np.linalg.norm(vec))
    if norm > 0:
        vec = vec / norm
    return vec.astype(float).tolist()


def cosine_similarity(a: list[float] | None, b: list[float] | None) -> float:
    if not a or not b:
        return 0.0
    va = np.asarray(a, dtype=np.float32).reshape(-1)
    vb = np.asarray(b, dtype=np.float32).reshape(-1)
    n = min(va.size, vb.size)
    if n == 0:
        return 0.0
    va = va[:n]
    vb = vb[:n]
    na = float(np.linalg.norm(va))
    nb = float(np.linalg.norm(vb))
    if na <= 0 or nb <= 0:
        return 0.0
    return float(np.dot(va / na, vb / nb))


def invalidate_gallery_cache() -> None:
    global _gallery_cache, _gallery_at
    with _gallery_lock:
        _gallery_cache = []
        _gallery_at = 0.0


def active_face_count(visitor: Visitor) -> int:
    return VisitorFace.objects.filter(visitor=visitor, is_active=True).count()


def visitor_is_enrolled(visitor: Visitor, count: int | None = None) -> bool:
    n = active_face_count(visitor) if count is None else count
    return n >= min_enrollment_images()


def build_visitor_gallery(*, force: bool = False) -> list[tuple[int, str, list[float]]]:
    global _gallery_cache, _gallery_at
    now = time.time()
    with _gallery_lock:
        if not force and _gallery_cache and now - _gallery_at < cache_ttl():
            return _gallery_cache
        rows: list[tuple[int, str, list[float]]] = []
        faces = (
            VisitorFace.objects.filter(is_active=True)
            .exclude(embedding=[])
            .select_related("visitor")
            .only("visitor_id", "embedding", "visitor__full_name")
        )
        for face in faces:
            emb = face.embedding if isinstance(face.embedding, list) else []
            if not emb:
                continue
            rows.append((face.visitor_id, face.visitor.full_name or "", emb))
        _gallery_cache = rows
        _gallery_at = now
        return rows


def search_visitor_gallery(
    probe: list[float] | np.ndarray | None,
    *,
    threshold: float | None = None,
) -> dict[str, Any] | None:
    """Return the best visitor match. Never consults staff attendance."""
    if probe is None:
        return None
    probe_list = normalize_embedding(probe)
    if not probe_list:
        return None
    min_sim = similarity_threshold() if threshold is None else float(threshold)
    best: dict[str, Any] | None = None
    for visitor_id, name, stored in build_visitor_gallery():
        sim = cosine_similarity(probe_list, stored)
        if best is None or sim > float(best["confidence"]):
            best = {
                "matched": True,
                "identity_type": "visitor",
                "visitor_id": visitor_id,
                "visitor_name": name,
                "confidence": round(sim, 4),
            }
    if best and float(best["confidence"]) >= min_sim:
        return best
    return None


def _decode_image(engine, image_b64: str):
    try:
        return engine.decode_base64(image_b64), None
    except (ValueError, Exception):
        return None, "Invalid image data"


def evaluate_enrollment_image(engine, image) -> dict:
    small = engine.resize_max(image, 640)
    faces = engine.detect_faces(small)
    if not faces:
        return {"passed": False, "message": "No face detected", "image": small}
    if len(faces) > 1:
        return {
            "passed": False,
            "message": "Multiple faces detected — only one person allowed",
            "image": small,
            "face_count": len(faces),
        }
    face = faces[0]
    quality = VisitorFaceQuality.evaluate(small, face)
    quality["bbox"] = face.bbox.astype(int).tolist()
    quality["image"] = small
    quality["face"] = face
    quality["face_count"] = 1
    return quality


def _save_face_image(visitor: Visitor, image, index: int) -> tuple[str, ContentFile]:
    import cv2

    ok, buf = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        raise ValueError("Could not encode enrollment image")
    filename = f"visitor_{visitor.pk}_{index}_{int(timezone.now().timestamp())}.jpg"
    return filename, ContentFile(buf.tobytes())


def _sync_journey_face(visitor: Visitor) -> None:
    """Keep journey identity embeddings in sync. Does not create attendance."""
    try:
        from person_journey.services import register_visitor_journey_person

        embeddings = [
            row.embedding
            for row in VisitorFace.objects.filter(visitor=visitor, is_active=True)
            if isinstance(row.embedding, list) and row.embedding
        ]
        if not embeddings:
            return
        stacked = np.mean(np.stack([np.asarray(e, dtype=np.float32) for e in embeddings]), axis=0)
        mean = normalize_embedding(stacked)
        person = register_visitor_journey_person(visitor)
        person.face_embedding = mean
        person.save(update_fields=["face_embedding", "updated_at"])
    except Exception:
        logger.exception("Failed to sync visitor %s journey embedding", visitor.pk)


def enroll_visitor_image(visitor: Visitor, image_b64: str) -> dict[str, Any]:
    from recognition.services.face_engine import get_face_engine

    max_n = max_enrollment_images()
    current = active_face_count(visitor)
    if current >= max_n:
        return {
            "accepted": False,
            "error": f"Maximum {max_n} enrollment images already stored",
            "face_count": current,
            "images_required": min_enrollment_images(),
            "is_enrolled": visitor_is_enrolled(visitor, current),
        }

    engine = get_face_engine()
    image, decode_error = _decode_image(engine, image_b64)
    if decode_error:
        return {"accepted": False, "error": decode_error}

    quality = evaluate_enrollment_image(engine, image)
    face = quality.pop("face", None)
    save_image = quality.pop("image", None)
    if save_image is None:
        save_image = engine.resize_max(image, 640)
    if not quality.get("passed"):
        return {
            "accepted": False,
            "quality": quality,
            "face_count": current,
            "images_required": min_enrollment_images(),
            "is_enrolled": visitor_is_enrolled(visitor, current),
        }
    if face is None or getattr(face, "embedding", None) is None:
        return {
            "accepted": False,
            "error": "Could not generate face embedding",
            "quality": quality,
            "face_count": current,
        }

    embedding = normalize_embedding(face.embedding)
    filename, content = _save_face_image(visitor, save_image, current + 1)
    row = VisitorFace(
        visitor=visitor,
        embedding=embedding,
        quality_score=float(quality.get("quality_score") or 0.0),
        is_active=True,
    )
    row.image.save(filename, content, save=True)
    invalidate_gallery_cache()

    if visitor.flow_stage in ("arrived", "registered"):
        visitor.flow_stage = "face_captured"
        visitor.save(update_fields=["flow_stage", "updated_at"])

    count = active_face_count(visitor)
    _sync_journey_face(visitor)
    logger.info(
        "Visitor face enrolled visitor_id=%s face_id=%s quality=%.3f count=%s",
        visitor.pk,
        row.pk,
        row.quality_score,
        count,
    )
    return {
        "accepted": True,
        "quality": quality,
        "face_id": row.pk,
        "face_count": count,
        "images_required": min_enrollment_images(),
        "images_max": max_n,
        "is_enrolled": visitor_is_enrolled(visitor, count),
        "visitor_id": visitor.pk,
    }


def enroll_visitor_images(visitor: Visitor, images: list[str]) -> dict[str, Any]:
    accepted: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    for raw in images:
        if not isinstance(raw, str) or not raw.strip():
            rejected.append({"accepted": False, "error": "Empty image"})
            continue
        result = enroll_visitor_image(visitor, raw)
        if result.get("accepted"):
            accepted.append(result)
        else:
            rejected.append(result)
        if active_face_count(visitor) >= max_enrollment_images():
            break
    count = active_face_count(visitor)
    return {
        "visitor_id": visitor.pk,
        "embeddings_created": len(accepted),
        "accepted": accepted,
        "rejected": rejected,
        "face_count": count,
        "images_required": min_enrollment_images(),
        "images_max": max_enrollment_images(),
        "is_enrolled": visitor_is_enrolled(visitor, count),
    }


def deactivate_visitor_face(visitor: Visitor, face_id: int) -> bool:
    face = VisitorFace.objects.filter(pk=face_id, visitor=visitor).first()
    if face is None:
        return False
    if face.image:
        face.image.delete(save=False)
    face.delete()
    invalidate_gallery_cache()
    _sync_journey_face(visitor)
    return True


def serialize_visitor_face(face: VisitorFace, request=None) -> dict[str, Any]:
    image_url = ""
    if face.image:
        try:
            image_url = face.image.url
        except ValueError:
            image_url = ""
        if request and image_url:
            try:
                image_url = request.build_absolute_uri(image_url)
            except Exception:
                pass
    return {
        "id": face.pk,
        "visitor_id": face.visitor_id,
        "image_url": image_url,
        "quality_score": round(float(face.quality_score or 0.0), 4),
        "is_active": face.is_active,
        "created_at": face.created_at.isoformat() if face.created_at else None,
        "has_embedding": bool(face.embedding),
    }


def recognize_from_image(image_b64: str) -> dict[str, Any]:
    """Staff gallery first, then visitor gallery. Never marks attendance."""
    from recognition.models import FaceEnrollment
    from recognition.services.face_engine import get_face_engine

    engine = get_face_engine()
    image, decode_error = _decode_image(engine, image_b64)
    if decode_error:
        return {"matched": False, "identity_type": "unknown", "message": decode_error}

    small = engine.resize_max(image, 640)
    face, error = engine.get_single_face(small, allow_largest=False)
    if error:
        return {"matched": False, "identity_type": "unknown", "message": error}

    embedding = normalize_embedding(face.embedding)

    staff_gallery: dict[str, list[float]] = {}
    enrollments = FaceEnrollment.objects.filter(is_trained=True, embedding__isnull=False)
    for enrollment in enrollments:
        if enrollment.embedding:
            staff_gallery[enrollment.gallery_key] = enrollment.embedding
    staff_key, staff_sim = engine.match_embedding(embedding, staff_gallery)
    if staff_key:
        try:
            staff_id = int(str(staff_key).split("-", 1)[1])
        except (IndexError, ValueError):
            staff_id = None
        logger.info(
            "Visitor recognize matched staff staff_id=%s similarity=%.4f (no attendance)",
            staff_id,
            staff_sim,
        )
        return {
            "matched": True,
            "identity_type": "staff",
            "staff_id": staff_id,
            "gallery_key": staff_key,
            "confidence": round(float(staff_sim), 4),
        }

    visitor_hit = search_visitor_gallery(embedding)
    if visitor_hit:
        logger.info(
            "Visitor recognize matched visitor_id=%s similarity=%.4f",
            visitor_hit.get("visitor_id"),
            visitor_hit.get("confidence"),
        )
        return visitor_hit

    return {"matched": False, "identity_type": "unknown", "confidence": 0.0}


def face_stats_qs():
    return Count("faces", filter=Q(faces__is_active=True))
