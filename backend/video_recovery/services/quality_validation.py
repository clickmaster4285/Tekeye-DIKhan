"""Quality Validation — frame comparison, artifact detection, sync validation."""

from __future__ import annotations

import os
from typing import Any

from .content_analysis import assess_visual_recovery
from .ffmpeg_utils import run_ffprobe, run_ffmpeg


def validate_recovered_video(
    original_path: str,
    recovered_path: str,
    work_dir: str,
    *,
    source_frame_paths: list[str] | None = None,
    output_frame_paths: list[str] | None = None,
    damage_counts: dict[str, int] | None = None,
) -> dict[str, Any]:
    os.makedirs(work_dir, exist_ok=True)
    orig_probe = run_ffprobe(original_path)
    rec_probe = run_ffprobe(recovered_path)

    orig_fmt = orig_probe.get("format") or {}
    rec_fmt = rec_probe.get("format") or {}
    orig_dur = float(orig_fmt.get("duration") or 0)
    rec_dur = float(rec_fmt.get("duration") or 0)

    duration_delta = abs(orig_dur - rec_dur) if orig_dur and rec_dur else None
    sync_valid = duration_delta is None or duration_delta <= max(2.0, orig_dur * 0.15)

    artifacts: list[str] = []
    if rec_dur <= 0:
        artifacts.append("Recovered video has zero duration")
    if not any(s.get("codec_type") == "video" for s in rec_probe.get("streams") or []):
        artifacts.append("Recovered file has no video stream")

    # Decode validation
    null_out = "NUL" if os.name == "nt" else "/dev/null"
    decode = run_ffmpeg(
        ["-y", "-i", recovered_path, "-f", "null", null_out],
        timeout=600,
    )
    decode_ok = decode.returncode == 0
    if not decode_ok:
        artifacts.append("Recovered video failed decode validation")

    rec_size = os.path.getsize(recovered_path) if os.path.isfile(recovered_path) else 0
    orig_size = os.path.getsize(original_path) if os.path.isfile(original_path) else 0
    size_ratio = (rec_size / orig_size) if orig_size else 0

    content = assess_visual_recovery(
        source_frame_paths or [],
        output_frame_paths or [],
        damage_counts,
    )
    for warning in content.get("warnings") or []:
        artifacts.append(warning)

    passed = decode_ok and sync_valid and not content.get("total_visual_loss")
    quality_score = max(0, min(100, int(100 - len(artifacts) * 20 - (0 if sync_valid else 15))))
    if content.get("total_visual_loss"):
        quality_score = min(quality_score, 15)
    elif not content.get("scene_recovered"):
        quality_score = min(quality_score, 40)

    return {
        "passed": passed,
        "frame_comparison": {
            "original_duration": orig_dur,
            "recovered_duration": rec_dur,
            "duration_delta_seconds": duration_delta,
        },
        "artifact_detection": {
            "artifacts_found": artifacts,
            "artifact_count": len(artifacts),
        },
        "sync_validation": {
            "audio_video_sync_valid": sync_valid,
            "size_ratio": round(size_ratio, 3),
        },
        "decode_validation": decode_ok,
        "content_assessment": content,
        "scene_recovered": content.get("scene_recovered", False),
        "quality_score": quality_score,
    }
