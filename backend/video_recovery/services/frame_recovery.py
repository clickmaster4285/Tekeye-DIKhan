"""Frame Recovery Engine — decode valid frames, detect corruption and missing frames."""

from __future__ import annotations

import glob
import os
import shutil
from typing import Any

from .ffmpeg_utils import run_ffmpeg

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


def recover_frames(src_path: str, work_dir: str) -> dict[str, Any]:
    frames_dir = os.path.join(work_dir, "frames")
    os.makedirs(frames_dir, exist_ok=True)
    pattern = os.path.join(frames_dir, "frame_%06d.jpg")

    proc = run_ffmpeg(
        [
            "-y",
            *_INPUT_FLAGS,
            "-i",
            src_path,
            "-vsync",
            "0",
            "-q:v",
            "2",
            pattern,
        ],
        timeout=900,
    )

    extracted = sorted(glob.glob(os.path.join(frames_dir, "frame_*.jpg")))
    valid_frames: list[str] = []
    bad_frames: list[str] = []

    try:
        import cv2
    except ImportError:
        cv2 = None

    for frame_path in extracted:
        size = os.path.getsize(frame_path)
        if size < 512:
            bad_frames.append(frame_path)
            continue
        if cv2 is not None:
            img = cv2.imread(frame_path)
            if img is None or img.size == 0:
                bad_frames.append(frame_path)
                continue
        valid_frames.append(frame_path)

    # Estimate missing frames from expected duration vs extracted count
    missing_count = 0
    if len(extracted) >= 2 and cv2 is not None:
        # Heuristic: gaps in numbering indicate missing frames
        indices = []
        for path in extracted:
            base = os.path.basename(path)
            num = int(base.replace("frame_", "").replace(".jpg", ""))
            indices.append(num)
        if indices:
            expected = max(indices) - min(indices) + 1
            missing_count = max(0, expected - len(valid_frames))

    return {
        "total_extracted": len(extracted),
        "valid_frame_count": len(valid_frames),
        "bad_frame_count": len(bad_frames),
        "missing_frame_count": missing_count,
        "valid_frames_dir": frames_dir,
        "valid_frame_paths": valid_frames,
        "bad_frame_paths": bad_frames,
        "decode_success": proc.returncode == 0,
    }
