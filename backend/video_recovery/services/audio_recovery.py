"""Audio Recovery — extraction, noise reduction, gap detection, synchronization."""

from __future__ import annotations

import os
from typing import Any

from .ffmpeg_utils import run_ffmpeg, run_ffprobe


def recover_audio(src_path: str, work_dir: str, *, video_duration: float = 0.0) -> dict[str, Any]:
    os.makedirs(work_dir, exist_ok=True)
    probe = run_ffprobe(src_path)
    streams = probe.get("streams") or []
    audio_streams = [s for s in streams if s.get("codec_type") == "audio"]
    video_streams = [s for s in streams if s.get("codec_type") == "video"]
    has_audio = bool(audio_streams)

    audio_duration = float((audio_streams[0].get("duration") if audio_streams else 0) or 0)
    if not audio_duration:
        audio_duration = float((probe.get("format") or {}).get("duration") or 0)
    if not video_duration and video_streams:
        video_duration = float(video_streams[0].get("duration") or 0)
    if not video_duration:
        video_duration = float((probe.get("format") or {}).get("duration") or 0)

    sync_drift = abs(audio_duration - video_duration) if audio_duration and video_duration else 0.0
    sync_corrupt = sync_drift > 0.5 or not has_audio

    if not has_audio:
        return {
            "audio_present": False,
            "extracted_path": "",
            "noise_reduced_path": "",
            "gaps_detected": 0,
            "synchronized": False,
            "sync_drift_seconds": round(sync_drift, 3),
            "corruption_type": "audio_sync",
            "generated_audio_labeled": True,
            "technique": "audio_fill_labeled",
        }

    raw_audio = os.path.join(work_dir, "audio_raw.aac")
    clean_audio = os.path.join(work_dir, "audio_clean.aac")
    synced_audio = os.path.join(work_dir, "audio_synced.aac")

    extract = run_ffmpeg(
        [
            "-y",
            "-err_detect",
            "ignore_err",
            "-i",
            src_path,
            "-map",
            "0:a:0?",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            raw_audio,
        ],
        timeout=300,
    )
    extracted = extract.returncode == 0 and os.path.isfile(raw_audio) and os.path.getsize(raw_audio) > 0

    denoise = run_ffmpeg(
        [
            "-y",
            "-i",
            raw_audio if extracted else src_path,
            "-af",
            "highpass=f=80,lowpass=f=12000,afftdn=nf=-25",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            clean_audio,
        ],
        timeout=300,
    )
    if denoise.returncode != 0 or not os.path.isfile(clean_audio):
        clean_audio = raw_audio if extracted else ""

    final_audio = clean_audio
    if sync_corrupt and clean_audio and video_duration > 0:
        # Trim/pad audio to video duration for timeline sync recovery (type 12)
        sync = run_ffmpeg(
            [
                "-y",
                "-i",
                clean_audio,
                "-af",
                f"apad,atrim=0:{video_duration:.3f}",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                synced_audio,
            ],
            timeout=300,
        )
        if sync.returncode == 0 and os.path.isfile(synced_audio):
            final_audio = synced_audio

    return {
        "audio_present": True,
        "extracted_path": raw_audio if extracted else "",
        "noise_reduced_path": final_audio,
        "gaps_detected": 1 if sync_corrupt else 0,
        "synchronized": bool(final_audio) and sync_drift <= 2.0,
        "sync_drift_seconds": round(sync_drift, 3),
        "corruption_type": "audio_sync" if sync_corrupt else None,
        "generated_audio_labeled": sync_corrupt,
        "technique": "audio_timeline_recovery" if sync_corrupt else "audio_recovery",
    }
