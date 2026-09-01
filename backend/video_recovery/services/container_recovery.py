"""Container Recovery — MP4 / MOV / AVI header and index rebuilding via remux/re-encode."""

from __future__ import annotations

import os
from typing import Any

from .ffmpeg_utils import run_ffmpeg
from .mdat_salvage import salvage_mdat_stream

_INPUT_FLAGS = [
    "-err_detect",
    "ignore_err",
    "-fflags",
    "+discardcorrupt+genpts+igndts",
    "-analyzeduration",
    "100M",
    "-probesize",
    "100M",
]


def recover_container(src_path: str, work_dir: str) -> dict[str, Any]:
    os.makedirs(work_dir, exist_ok=True)
    remux_path = os.path.join(work_dir, "container_remux.mp4")
    reencode_path = os.path.join(work_dir, "container_reencoded.mp4")

    # Attempt 1: stream copy remux (rebuilds index/moov for many MP4/MOV files)
    proc = run_ffmpeg(
        [
            "-y",
            *_INPUT_FLAGS,
            "-i",
            src_path,
            "-map",
            "0:v:0?",
            "-map",
            "0:a:0?",
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            remux_path,
        ],
        timeout=600,
    )
    if proc.returncode == 0 and os.path.isfile(remux_path) and os.path.getsize(remux_path) > 0:
        return {
            "success": True,
            "method": "remux_copy",
            "output_path": remux_path,
            "header_rebuilt": True,
            "index_rebuilt": True,
        }

    # Attempt 2: full re-encode (header/index reconstruction)
    proc2 = run_ffmpeg(
        [
            "-y",
            *_INPUT_FLAGS,
            "-i",
            src_path,
            "-map",
            "0:v:0?",
            "-map",
            "0:a:0?",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "20",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            reencode_path,
        ],
        timeout=900,
    )
    if proc2.returncode == 0 and os.path.isfile(reencode_path) and os.path.getsize(reencode_path) > 0:
        return {
            "success": True,
            "method": "reencode",
            "output_path": reencode_path,
            "header_rebuilt": True,
            "index_rebuilt": True,
        }

    # Attempt 3: truncated MP4 — salvage raw H.264 from mdat when moov is missing
    salvage = salvage_mdat_stream(src_path, os.path.join(work_dir, "mdat_salvage"))
    if salvage.get("success"):
        return salvage

    stderr = (proc2.stderr or proc.stderr or b"").decode("utf-8", errors="replace")[:500]
    salvage_err = str(salvage.get("error") or "")
    return {
        "success": False,
        "method": "none",
        "output_path": "",
        "error": stderr or salvage_err or "Container recovery failed",
    }
