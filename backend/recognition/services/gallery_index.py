"""ArcFace gallery search. FAISS inner-product when installed, otherwise numpy."""

from __future__ import annotations

import logging
import threading

import numpy as np

logger = logging.getLogger(__name__)

MATCH_MARGIN = 0.06
SOFT_MISS = 0.28


def _normalize(vector) -> np.ndarray:
    arr = np.asarray(vector, dtype=np.float32).reshape(-1)
    norm = float(np.linalg.norm(arr))
    if norm <= 0:
        return arr
    return arr / norm


class GalleryIndex:
    def __init__(self, entries: list[tuple[str, np.ndarray]]):
        self.keys = [key for key, _ in entries]
        if entries:
            self.matrix = np.stack([vec for _, vec in entries]).astype(np.float32)
        else:
            self.matrix = np.zeros((0, 512), dtype=np.float32)
        self._faiss = None
        if len(self.keys) > 0:
            try:
                import faiss

                index = faiss.IndexFlatIP(self.matrix.shape[1])
                index.add(np.ascontiguousarray(self.matrix))
                self._faiss = index
            except Exception:
                self._faiss = None

    def __len__(self) -> int:
        return len(self.keys)

    def search(self, probe, k: int = 8) -> list[tuple[str, float]]:
        if not self.keys:
            return []
        query = _normalize(probe).reshape(1, -1).astype(np.float32)
        if self._faiss is not None:
            scores, ids = self._faiss.search(np.ascontiguousarray(query), min(k, len(self.keys)))
            hits = []
            for score, idx in zip(scores[0], ids[0]):
                if idx < 0:
                    continue
                hits.append((self.keys[int(idx)], float(score)))
            return hits
        scores = (self.matrix @ query.reshape(-1)).astype(np.float32)
        order = np.argsort(-scores)[:k]
        return [(self.keys[int(i)], float(scores[int(i)])) for i in order]


def best_match(probe, index: GalleryIndex, *, threshold: float) -> dict:
    """Best identity by cosine similarity. Ambiguous when the runner-up is within MATCH_MARGIN."""
    ranked: dict[str, float] = {}
    for key, score in index.search(probe, k=16):
        ranked[key] = max(score, ranked.get(key, -1.0))
    ordered = sorted(ranked.items(), key=lambda item: item[1], reverse=True)
    if not ordered:
        return {"gallery_key": None, "confidence": 0.0, "second": 0.0, "ambiguous": False, "soft_miss": False}
    best_key, best_score = ordered[0]
    second = ordered[1][1] if len(ordered) > 1 else -1.0
    ambiguous = best_score >= threshold and second >= 0 and (best_score - second) < MATCH_MARGIN
    if ambiguous or best_score < threshold:
        return {
            "gallery_key": None,
            "confidence": best_score,
            "second": second,
            "ambiguous": ambiguous,
            "soft_miss": best_score >= SOFT_MISS,
        }
    return {
        "gallery_key": best_key,
        "confidence": best_score,
        "second": second,
        "ambiguous": False,
        "soft_miss": False,
    }


_lock = threading.Lock()
_index: GalleryIndex | None = None


def _load_index() -> GalleryIndex:
    from recognition.models import FaceEnrollment

    entries: list[tuple[str, np.ndarray]] = []
    enrollments = FaceEnrollment.objects.filter(is_trained=True, embedding__isnull=False).only(
        "staff_id", "embedding", "embeddings"
    )
    for enrollment in enrollments:
        vectors = []
        if enrollment.embedding:
            vectors.append(enrollment.embedding)
        for extra in getattr(enrollment, "embeddings", None) or []:
            if extra:
                vectors.append(extra)
        for vector in vectors:
            arr = _normalize(vector)
            if arr.size == 0 or float(np.linalg.norm(arr)) == 0:
                continue
            entries.append((enrollment.gallery_key, arr))
    index = GalleryIndex(entries)
    logger.info("Attendance gallery index loaded (%d vectors, faiss=%s)", len(index), index._faiss is not None)
    return index


def get_gallery_index() -> GalleryIndex:
    global _index
    with _lock:
        if _index is None:
            _index = _load_index()
        return _index


def invalidate_gallery() -> None:
    global _index
    with _lock:
        _index = None
