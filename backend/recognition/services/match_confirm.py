"""Repeat a live match before it can punch attendance."""

from __future__ import annotations

import time
from collections import defaultdict

CONFIRM_WEBCAM = 2
CONFIRM_WEBCAM_WINDOW = 12.0
CONFIRM_CCTV = 3


class MatchConfirmer:
    """Webcam: 2 hits in 12 seconds. Used by IdentifyFaceView, not by the CCTV worker."""

    def __init__(self):
        self._hits: dict[str, list[float]] = defaultdict(list)

    def observe(self, key: str, *, needed: int = CONFIRM_WEBCAM, window: float = CONFIRM_WEBCAM_WINDOW) -> bool:
        now = time.monotonic()
        recent = [stamp for stamp in self._hits[key] if now - stamp <= window]
        recent.append(now)
        self._hits[key] = recent[-8:]
        return len(self._hits[key]) >= needed

    def reset(self, key: str) -> None:
        self._hits.pop(key, None)


_confirmer = MatchConfirmer()


def get_match_confirmer() -> MatchConfirmer:
    return _confirmer
