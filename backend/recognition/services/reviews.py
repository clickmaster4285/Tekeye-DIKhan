"""Soft misses and spoofs kept for review. Attendance is not written from these."""

from __future__ import annotations

import logging
import time

logger = logging.getLogger(__name__)
_last_write: dict[tuple, float] = {}


def _save(kind: str, *, confidence: float = 0.0, source: str = "", camera_id: int | None = None, message: str = ""):
    key = (kind, camera_id or 0, source or "")
    now = time.monotonic()
    if now - _last_write.get(key, 0.0) < 30.0:
        return
    _last_write[key] = now
    try:
        from recognition.models import MatchReview

        MatchReview.objects.create(
            kind=kind,
            confidence=confidence,
            source=source or "",
            camera_id=camera_id,
            message=(message or "")[:255],
        )
    except Exception:
        logger.debug("Match review was not saved", exc_info=True)


def record_unknown(*, confidence: float = 0.0, source: str = "", camera_id: int | None = None, message: str = ""):
    _save("unknown", confidence=confidence, source=source, camera_id=camera_id, message=message)


def record_spoof(*, confidence: float = 0.0, source: str = "", camera_id: int | None = None, message: str = ""):
    _save("spoof", confidence=confidence, source=source, camera_id=camera_id, message=message)


def enqueue_match_review(*, confidence: float = 0.0, source: str = "", camera_id: int | None = None, message: str = ""):
    _save("soft_miss", confidence=confidence, source=source, camera_id=camera_id, message=message or "Soft miss")
