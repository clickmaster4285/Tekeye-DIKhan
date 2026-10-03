"""
Person Journey identity helpers.

Foundation rule — NEVER conflate these:

  CameraTrack.tracklet_id  →  C01-T18492   (per-camera ByteTrack session)
  JourneyPerson.code       →  PJ-00042    (global cross-camera person)

Many tracklets on different cameras may resolve to the same global person.
"""

from __future__ import annotations

import re

PERSON_CODE_PREFIX = "PJ-"
PERSON_CODE_WIDTH = 5
_PERSON_CODE_RE = re.compile(r"^PJ-(\d+)$", re.IGNORECASE)
_LEGACY_CODE_RE = re.compile(r"^[PVU](\d+)$", re.IGNORECASE)


def format_person_code(seq: int) -> str:
    """Global person ID: PJ-00042."""
    return f"{PERSON_CODE_PREFIX}{int(seq):0{PERSON_CODE_WIDTH}d}"


def parse_person_code_seq(code: str | None) -> int | None:
    """Extract numeric sequence from PJ-##### or legacy P/V/U##### codes."""
    if not code:
        return None
    text = str(code).strip()
    m = _PERSON_CODE_RE.match(text)
    if m:
        return int(m.group(1))
    m = _LEGACY_CODE_RE.match(text)
    if m:
        return int(m.group(1))
    digits = "".join(c for c in text if c.isdigit())
    if digits:
        try:
            return int(digits)
        except ValueError:
            return None
    return None


def format_tracklet_id(camera_id: int | None, track_id: int | None) -> str:
    """
    Per-camera tracklet ID: C01-T18492.

    Camera number is zero-padded to at least 2 digits.
    Track id is left as-is (no padding) so ByteTrack ids stay readable.
    """
    if camera_id is None or track_id is None:
        return ""
    try:
        cam = int(camera_id)
        tid = int(track_id)
    except (TypeError, ValueError):
        return ""
    if cam < 0 or tid < 0:
        return ""
    cam_width = 2 if cam < 100 else len(str(cam))
    return f"C{cam:0{cam_width}d}-T{tid}"


def is_global_person_code(code: str | None) -> bool:
    return bool(code and _PERSON_CODE_RE.match(str(code).strip()))
