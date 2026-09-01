"""Deep damage analysis — container, stream, and frame-level damage detection."""

from __future__ import annotations

from typing import Any

from .corruption_types import detect_file_level_types
from .forensic_analyzer import run_forensic_analysis
from .stream_analysis import analyze_streams


def analyze_damage(path: str, work_dir: str) -> dict[str, Any]:
    forensic = run_forensic_analysis(path)
    stream = analyze_streams(path, work_dir)
    corruption = forensic.get("corruption_detection") or {}

    container_damage: list[str] = []
    if corruption.get("corruption_detected"):
        for issue in corruption.get("issues") or []:
            text = str(issue).lower()
            if any(k in text for k in ("moov", "container", "format", "truncat", "index", "header")):
                container_damage.append(str(issue))
    if not container_damage and corruption.get("corruption_detected"):
        container_damage.append("Container metadata incomplete or corrupt")

    stream_damage: list[str] = []
    packet = (stream.get("packet_inspection") or {})
    if not packet.get("decodable"):
        stream_damage.append("Video stream decode errors detected")
    for vs in stream.get("video_stream_analysis") or []:
        if float(vs.get("duration") or 0) <= 0:
            stream_damage.append("Video stream missing duration timestamps")

    file_corruption_types = detect_file_level_types(path, forensic, stream, {
        "container_damage": container_damage,
        "stream_damage": stream_damage,
    })

    return {
        "container_damage": container_damage,
        "stream_damage": stream_damage,
        "frame_damage": [],
        "forensic": forensic,
        "stream": stream,
        "severity": corruption.get("severity", "none"),
        "file_corruption_types": file_corruption_types,
    }
