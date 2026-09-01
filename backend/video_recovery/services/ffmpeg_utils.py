"""FFmpeg / FFprobe helpers for the video recovery module."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from typing import Any


def ffmpeg_path() -> str:
    from django.conf import settings

    custom = getattr(settings, "FFMPEG_PATH", "").strip()
    if custom and os.path.isfile(custom):
        return custom
    found = shutil.which("ffmpeg")
    if found:
        return found
    raise FileNotFoundError(
        "ffmpeg not found. Set FFMPEG_PATH in backend/.env or install ffmpeg."
    )


def ffprobe_path() -> str:
    ffmpeg = ffmpeg_path()
    if ffmpeg.lower().endswith("ffmpeg.exe"):
        probe = ffmpeg[:-10] + "ffprobe.exe"
        if os.path.isfile(probe):
            return probe
    if ffmpeg.lower().endswith("ffmpeg"):
        probe = ffmpeg[:-6] + "ffprobe"
        if os.path.isfile(probe):
            return probe
    found = shutil.which("ffprobe")
    if found:
        return found
    raise FileNotFoundError(
        "ffprobe not found. Install ffprobe alongside ffmpeg or set FFMPEG_PATH."
    )


def ffmpeg_available() -> bool:
    try:
        ffmpeg_path()
        ffprobe_path()
        return True
    except FileNotFoundError:
        return False


def run_ffprobe(path: str) -> dict[str, Any]:
    cmd = [
        ffprobe_path(),
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        path,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return {"error": str(exc)}
    if proc.returncode != 0:
        return {"error": (proc.stderr or proc.stdout or "ffprobe failed").strip()}
    try:
        return json.loads(proc.stdout or "{}")
    except json.JSONDecodeError:
        return {"error": "Invalid ffprobe JSON output"}


def run_ffmpeg(cmd_args: list[str], *, timeout: int = 600) -> subprocess.CompletedProcess:
    cmd = [ffmpeg_path(), "-nostdin", "-hide_banner", "-loglevel", "error", *cmd_args]
    return subprocess.run(cmd, capture_output=True, timeout=timeout)
