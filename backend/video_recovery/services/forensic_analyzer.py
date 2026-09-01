"""File Forensic Analyzer — signature, container, codec, metadata, corruption."""

from __future__ import annotations

import os
from typing import Any

from .ffmpeg_utils import run_ffprobe

SIGNATURES = {
    "mp4": (b"ftyp", 4),
    "mov": (b"ftyp", 4),
    "mkv": (b"\x1a\x45\xdf\xa3", 0),
    "avi": (b"RIFF", 0),
    "webm": (b"\x1a\x45\xdf\xa3", 0),
}


def _read_header(path: str, size: int = 32) -> bytes:
    with open(path, "rb") as fh:
        return fh.read(size)


def detect_file_signature(path: str) -> dict[str, Any]:
    header = _read_header(path)
    detected = []
    for fmt, (magic, offset) in SIGNATURES.items():
        end = offset + len(magic)
        if len(header) >= end and header[offset:end] == magic:
            detected.append(fmt)
    if header[:4] == b"RIFF" and b"AVI" in header[8:16]:
        if "avi" not in detected:
            detected.append("avi")
    return {
        "header_hex": header[:16].hex(),
        "detected_formats": detected,
        "primary_format": detected[0] if detected else "unknown",
    }


def analyze_container(path: str, probe: dict[str, Any]) -> dict[str, Any]:
    fmt = probe.get("format") or {}
    streams = probe.get("streams") or []
    video_streams = [s for s in streams if s.get("codec_type") == "video"]
    audio_streams = [s for s in streams if s.get("codec_type") == "audio"]
    return {
        "format_name": fmt.get("format_name", ""),
        "format_long_name": fmt.get("format_long_name", ""),
        "duration_seconds": float(fmt.get("duration") or 0),
        "size_bytes": int(fmt.get("size") or os.path.getsize(path)),
        "bit_rate": int(fmt.get("bit_rate") or 0),
        "video_stream_count": len(video_streams),
        "audio_stream_count": len(audio_streams),
        "metadata": fmt.get("tags") or {},
    }


def detect_codecs(probe: dict[str, Any]) -> dict[str, Any]:
    streams = probe.get("streams") or []
    video = []
    audio = []
    for stream in streams:
        codec_type = stream.get("codec_type")
        entry = {
            "index": stream.get("index"),
            "codec_name": stream.get("codec_name", ""),
            "codec_long_name": stream.get("codec_long_name", ""),
            "profile": stream.get("profile", ""),
            "width": stream.get("width"),
            "height": stream.get("height"),
            "pix_fmt": stream.get("pix_fmt"),
            "sample_rate": stream.get("sample_rate"),
            "channels": stream.get("channels"),
        }
        if codec_type == "video":
            video.append(entry)
        elif codec_type == "audio":
            audio.append(entry)
    return {"video_codecs": video, "audio_codecs": audio}


def detect_corruption(path: str, probe: dict[str, Any]) -> dict[str, Any]:
    issues: list[str] = []
    fmt = probe.get("format") or {}
    raw_error = probe.get("error")
    if raw_error:
        err_text = str(raw_error).strip()
        if err_text and err_text not in ("{}", "None", ""):
            if "moov atom not found" in err_text.lower():
                issues.append("MP4 index (moov atom) missing — typical of truncated downloads")
            else:
                issues.append(err_text[:300])
    if not fmt.get("format_name"):
        issues.append("Container format could not be identified")
    streams = probe.get("streams") or []
    if not any(s.get("codec_type") == "video" for s in streams):
        issues.append("No video stream found")
    duration = float(fmt.get("duration") or 0)
    if duration <= 0:
        issues.append("Missing or zero duration metadata")
    size = os.path.getsize(path)
    if size < 1024:
        issues.append("File is suspiciously small")

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique_issues: list[str] = []
    for item in issues:
        if item in seen:
            continue
        seen.add(item)
        unique_issues.append(item)

    recovery_hint = ""
    if any("moov" in i.lower() for i in unique_issues):
        recovery_hint = (
            "Truncated MP4 detected. Attempting mdat salvage to rebuild video from raw media data."
        )
    elif unique_issues:
        recovery_hint = "Running container remux, re-encode, and frame extraction recovery passes."

    return {
        "corruption_detected": bool(unique_issues),
        "issues": unique_issues,
        "severity": "high" if len(unique_issues) >= 2 else ("medium" if unique_issues else "none"),
        "recovery_hint": recovery_hint,
    }


def run_forensic_analysis(path: str) -> dict[str, Any]:
    signature = detect_file_signature(path)
    probe = run_ffprobe(path)
    container = analyze_container(path, probe)
    codecs = detect_codecs(probe)
    corruption = detect_corruption(path, probe)
    return {
        "file_signature": signature,
        "container_analysis": container,
        "codec_detection": codecs,
        "metadata_recovery": container.get("metadata") or {},
        "corruption_detection": corruption,
        "ffprobe_raw": probe if not probe.get("error") else {"error": probe.get("error")},
    }
