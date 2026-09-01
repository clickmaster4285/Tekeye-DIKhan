"""Damage map — classify timeline segments and frames for recovery vs regeneration."""

from __future__ import annotations

from typing import Any

VALID = "valid"
DAMAGED_RECOVERABLE = "damaged_recoverable"
RESTORED = "restored"
UNRECOVERABLE = "unrecoverable"
MISSING = "missing"
GENERATED = "generated"


def classify_frame_visual(img) -> str:
    """Classify a decoded frame: valid vs damaged-but-recoverable."""
    from .corruption_types import classify_frame_corruption

    return classify_frame_corruption(img).get("status", VALID)


def build_damage_map(
    frame_entries: list[dict[str, Any]],
    *,
    duration_seconds: float = 0.0,
    fps: float = 25.0,
) -> dict[str, Any]:
    segments: list[dict[str, Any]] = []
    if not frame_entries:
        return {
            "duration_seconds": duration_seconds,
            "fps": fps,
            "frames": [],
            "segments": [],
            "timeline_legend": _legend(),
            "counts": {},
            "timeline_strip": [],
        }

    current_status = frame_entries[0].get("status", VALID)
    seg_start = 0

    def _flush(end_idx: int) -> None:
        nonlocal seg_start, current_status
        if end_idx < seg_start:
            return
        recovery_possible = current_status in (VALID, DAMAGED_RECOVERABLE, RESTORED)
        segments.append(
            {
                "segment_id": len(segments) + 1,
                "start_frame": seg_start,
                "end_frame": end_idx,
                "start_time": round(seg_start / max(fps, 1), 3),
                "end_time": round(end_idx / max(fps, 1), 3),
                "status": current_status,
                "recovery_possible": recovery_possible,
                "technique": "recovery" if recovery_possible else "regeneration",
            }
        )

    for i, entry in enumerate(frame_entries):
        status = entry.get("status", VALID)
        if i == 0:
            current_status = status
            seg_start = 0
            continue
        if status != current_status:
            _flush(i - 1)
            seg_start = i
            current_status = status
    _flush(len(frame_entries) - 1)

    counts: dict[str, int] = {}
    for e in frame_entries:
        st = str(e.get("status", VALID))
        counts[st] = counts.get(st, 0) + 1

    timeline_strip = [e.get("status", VALID) for e in frame_entries]
    step = max(1, len(timeline_strip) // 120)
    strip = timeline_strip[::step]

    return {
        "duration_seconds": duration_seconds or round(len(frame_entries) / max(fps, 1), 3),
        "fps": fps,
        "frames": frame_entries,
        "segments": segments,
        "timeline_strip": strip,
        "timeline_legend": _legend(),
        "counts": counts,
    }


def _legend() -> dict[str, str]:
    return {
        VALID: "Original valid",
        DAMAGED_RECOVERABLE: "Damaged but recoverable",
        RESTORED: "Recovered original",
        UNRECOVERABLE: "Original unrecoverable",
        MISSING: "Missing segment",
        GENERATED: "AI generated",
    }


def frame_needs_regeneration(status: str) -> bool:
    return status in (UNRECOVERABLE, MISSING)


def frame_needs_recovery(status: str) -> bool:
    return status in (DAMAGED_RECOVERABLE,)
