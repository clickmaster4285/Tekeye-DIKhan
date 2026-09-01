"""Video Reconstruction — frame ordering, timestamp reconstruction, encoding."""

from __future__ import annotations

import os
from typing import Any

from .ffmpeg_utils import run_ffmpeg
from .gpu_utils import ffmpeg_nvenc_available, gpu_info, video_encoder_args


def reconstruct_video(
    frame_paths: list[str],
    audio_path: str,
    dest_mp4: str,
    *,
    fps: float = 25.0,
) -> dict[str, Any]:
    if not frame_paths:
        return {"success": False, "error": "No frames to reconstruct", "output_path": ""}

    work_dir = os.path.dirname(dest_mp4)
    os.makedirs(work_dir, exist_ok=True)
    list_file = os.path.join(work_dir, "frames_list.txt")

    with open(list_file, "w", encoding="utf-8") as fh:
        for path in frame_paths:
            safe = path.replace("\\", "/").replace("'", "'\\''")
            fh.write(f"file '{safe}'\n")
            fh.write(f"duration {1.0 / max(fps, 1.0):.6f}\n")
        # concat demuxer requires last file repeated
        last = frame_paths[-1].replace("\\", "/").replace("'", "'\\''")
        fh.write(f"file '{last}'\n")

    video_only = os.path.join(work_dir, "video_only.mp4")
    encode_args = video_encoder_args(crf=20, preset="medium")
    cmd_video = [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        list_file,
        "-vsync",
        "vfr",
        *encode_args,
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        video_only,
    ]
    proc = run_ffmpeg(cmd_video, timeout=900)
    if proc.returncode != 0 or not os.path.isfile(video_only):
        # Fallback: image sequence input
        first_dir = os.path.dirname(frame_paths[0])
        pattern = os.path.join(first_dir, "frame_%06d.jpg")
        proc = run_ffmpeg(
            [
                "-y",
                "-framerate",
                str(fps),
                "-i",
                pattern,
                *encode_args,
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                video_only,
            ],
            timeout=900,
        )

    if proc.returncode != 0 or not os.path.isfile(video_only):
        stderr = (proc.stderr or b"").decode("utf-8", errors="replace")[:400]
        return {"success": False, "error": stderr or "Video encoding failed", "output_path": ""}

    if audio_path and os.path.isfile(audio_path):
        mux = run_ffmpeg(
            [
                "-y",
                "-i",
                video_only,
                "-i",
                audio_path,
                "-c:v",
                "copy",
                "-c:a",
                "aac",
                "-shortest",
                "-movflags",
                "+faststart",
                dest_mp4,
            ],
            timeout=600,
        )
        if mux.returncode == 0 and os.path.isfile(dest_mp4):
            return {
                "success": True,
                "output_path": dest_mp4,
                "frame_count": len(frame_paths),
                "fps": fps,
                "audio_synced": True,
            }

    os.replace(video_only, dest_mp4)
    return {
        "success": True,
        "output_path": dest_mp4,
        "frame_count": len(frame_paths),
        "fps": fps,
        "audio_synced": False,
        "gpu_encode": ffmpeg_nvenc_available(),
        "gpu": gpu_info(),
    }
