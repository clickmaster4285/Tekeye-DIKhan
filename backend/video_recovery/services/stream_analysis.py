"""Stream Analysis — video/audio packet inspection and timestamp recovery."""

from __future__ import annotations

import os
from typing import Any

from .ffmpeg_utils import run_ffprobe, run_ffmpeg


def analyze_streams(path: str, work_dir: str) -> dict[str, Any]:
    os.makedirs(work_dir, exist_ok=True)
    probe = run_ffprobe(path)
    streams = probe.get("streams") or []
    video_packets: list[dict[str, Any]] = []
    audio_packets: list[dict[str, Any]] = []

    for stream in streams:
        idx = stream.get("index", 0)
        codec_type = stream.get("codec_type")
        entry = {
            "stream_index": idx,
            "codec": stream.get("codec_name", ""),
            "duration": float(stream.get("duration") or 0),
            "time_base": stream.get("time_base", ""),
            "start_pts": stream.get("start_pts"),
            "start_time": float(stream.get("start_time") or 0),
            "nb_frames": stream.get("nb_frames"),
            "avg_frame_rate": stream.get("avg_frame_rate", ""),
        }
        if codec_type == "video":
            entry["width"] = stream.get("width")
            entry["height"] = stream.get("height")
            video_packets.append(entry)
        elif codec_type == "audio":
            entry["sample_rate"] = stream.get("sample_rate")
            entry["channels"] = stream.get("channels")
            audio_packets.append(entry)

    # Decode probe — count decodable frames (packet inspection)
    frames_log = os.path.join(work_dir, "stream_decode.log")
    decode_report: dict[str, Any] = {"decodable": False, "frames_decoded": 0}
    null_out = "NUL" if os.name == "nt" else "/dev/null"
    proc = run_ffmpeg(
        [
            "-y",
            "-err_detect",
            "ignore_err",
            "-fflags",
            "+discardcorrupt+genpts",
            "-i",
            path,
            "-map",
            "0:v:0?",
            "-f",
            "null",
            null_out,
        ],
        timeout=600,
    )
    decode_report["decodable"] = proc.returncode == 0
    decode_report["return_code"] = proc.returncode
    if proc.stderr:
        text = proc.stderr.decode("utf-8", errors="replace")
        with open(frames_log, "w", encoding="utf-8") as fh:
            fh.write(text)
        decode_report["log_path"] = frames_log

    fmt = probe.get("format") or {}
    return {
        "video_stream_analysis": video_packets,
        "audio_stream_analysis": audio_packets,
        "timestamp_recovery": {
            "duration_seconds": float(fmt.get("duration") or 0),
            "start_time": float(fmt.get("start_time") or 0),
            "bit_rate": int(fmt.get("bit_rate") or 0),
        },
        "packet_inspection": decode_report,
    }
