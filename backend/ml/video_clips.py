"""Cut short evidence clips around video-search hits."""

from __future__ import annotations

import base64
import os
import subprocess
import uuid
from pathlib import Path

from django.conf import settings


def _ffmpeg() -> str | None:
    try:
        from cameras.stream_utils import resolve_ffmpeg_path

        return resolve_ffmpeg_path()
    except Exception:
        return None


def save_job_dir() -> Path:
    job_id = uuid.uuid4().hex[:12]
    folder = Path(settings.MEDIA_ROOT) / "video_search" / job_id
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def save_preview_jpeg(folder: Path, name: str, b64: str) -> str:
    raw = (b64 or "").strip()
    if not raw:
        return ""
    try:
        data = base64.b64decode(raw, validate=False)
    except Exception:
        return ""
    if not data:
        return ""
    path = folder / name
    path.write_bytes(data)
    rel = path.relative_to(settings.MEDIA_ROOT).as_posix()
    return f"/media/{rel}"


def cut_clip(source_path: str, dest_path: str, start_sec: float, duration_sec: float) -> bool:
    exe = _ffmpeg()
    if not exe or not os.path.isfile(source_path):
        return False
    duration = max(1.5, min(5.0, float(duration_sec)))
    start = max(0.0, float(start_sec))
    cmd = [
        exe,
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        f"{start:.2f}",
        "-t",
        f"{duration:.2f}",
        "-i",
        source_path,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "28",
        "-an",
        "-movflags",
        "+faststart",
        dest_path,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=60)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False
    return proc.returncode == 0 and os.path.isfile(dest_path) and os.path.getsize(dest_path) > 0
