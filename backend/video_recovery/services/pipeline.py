"""Video Recovery hybrid pipeline — Recovery + Regeneration techniques."""

from __future__ import annotations

import logging
import os
import shutil
import threading
import time
from typing import Any

from django.conf import settings
from django.core.files import File
from django.utils import timezone

from ..models import JobStatus, RecoveryStage, VideoRecoveryJob
from .audio_recovery import recover_audio
from .content_analysis import assess_visual_recovery
from .corruption_types import build_corruption_report, count_frame_corruption_types
from .damage_analyzer import analyze_damage
from .damage_map import build_damage_map
from .ffmpeg_utils import ffmpeg_available
from .hybrid_merger import merge_hybrid_timeline
from .preserve_original import preserve_original
from .quality_validation import validate_recovered_video
from .recovery_engine import run_recovery_engine
from .regeneration_engine import classify_extracted_frames, run_regeneration_engine
from .temporal_consistency import apply_temporal_consistency
from .upload_validation import validate_upload
from .video_reconstruction import reconstruct_video

logger = logging.getLogger(__name__)

_jobs_lock = threading.Lock()
_running_jobs: set[str] = set()


def _work_dir(job_id: str) -> str:
    path = os.path.join(settings.MEDIA_ROOT, "video_recovery", "work", str(job_id))
    os.makedirs(path, exist_ok=True)
    return path


def _append_log(job: VideoRecoveryJob, stage: str, payload: dict[str, Any]) -> None:
    logs = list(job.stage_logs or [])
    logs.append({"stage": stage, "timestamp": timezone.now().isoformat(), **payload})
    job.stage_logs = logs
    job.save(update_fields=["stage_logs", "updated_at"])


def _set_stage(job: VideoRecoveryJob, stage: str) -> None:
    job.current_stage = stage
    job.save(update_fields=["current_stage", "updated_at"])


def _complete_container_only(job: VideoRecoveryJob, output_path: str, method: str, preserved_path: str) -> None:
    with open(output_path, "rb") as fh:
        job.recovered_file.save(f"recovered_{job.id}.mp4", File(fh), save=False)
    quality = validate_recovered_video(preserved_path, output_path, _work_dir(str(job.id)))
    job.quality_report = {**quality, "method": method, "hybrid": True}
    job.hybrid_report = {
        "recovery_technique": method,
        "regeneration_technique": "none",
        "breakdown": {"original": 0, "recovered": 100, "generated": 0},
    }
    job.status = JobStatus.COMPLETED
    job.current_stage = RecoveryStage.COMPLETED
    job.completed_at = timezone.now()
    job.save()
    _append_log(job, RecoveryStage.COMPLETED, {"method": method, "container_only": True})


def run_recovery_pipeline(job_id: str) -> None:
    """Execute hybrid Recovery + Regeneration pipeline."""
    try:
        job = VideoRecoveryJob.objects.get(pk=job_id)
    except VideoRecoveryJob.DoesNotExist:
        return

    if not ffmpeg_available():
        job.status = JobStatus.FAILED
        job.error_message = "ffmpeg/ffprobe not available. Set FFMPEG_PATH in backend/.env."
        job.save(update_fields=["status", "error_message", "updated_at"])
        return

    job.status = JobStatus.PROCESSING
    job.error_message = ""
    job.damage_map = {}
    job.hybrid_report = {}
    job.save(update_fields=["status", "error_message", "damage_map", "hybrid_report", "updated_at"])

    work = _work_dir(str(job.id))
    upload_path = job.original_file.path

    try:
        # ── Upload validation ──
        _set_stage(job, RecoveryStage.VALIDATE)
        validation = validate_upload(upload_path, job.original_filename)
        _append_log(job, RecoveryStage.VALIDATE, validation)
        if not validation.get("valid"):
            raise RuntimeError("; ".join(validation.get("errors") or ["Upload validation failed"]))

        # ── Preserve original (read-only + SHA-256) ──
        _set_stage(job, RecoveryStage.PRESERVE)
        preserved = preserve_original(upload_path, os.path.join(work, "preserve"))
        job.original_sha256 = preserved.get("sha256", "")
        job.preserved_path = preserved.get("preserved_path", "")
        job.save(update_fields=["original_sha256", "preserved_path", "updated_at"])
        _append_log(job, RecoveryStage.PRESERVE, preserved)
        preserved_path = str(preserved["preserved_path"])

        # ── Deep damage analysis ──
        _set_stage(job, RecoveryStage.DAMAGE_ANALYSIS)
        damage = analyze_damage(preserved_path, os.path.join(work, "analysis"))
        job.forensic_report = damage.get("forensic") or {}
        job.save(update_fields=["forensic_report", "updated_at"])
        _append_log(job, RecoveryStage.DAMAGE_ANALYSIS, {
            "container_damage": damage.get("container_damage"),
            "stream_damage": damage.get("stream_damage"),
            "file_corruption_types": damage.get("file_corruption_types"),
        })

        container_damaged = bool(damage.get("container_damage") or damage.get("stream_damage"))

        # ── RECOVERY TECHNIQUE (Priority 2-5) ──
        _set_stage(job, RecoveryStage.RECOVERY)
        recovery = run_recovery_engine(
            preserved_path,
            work,
            container_damaged=container_damaged,
        )
        _append_log(job, RecoveryStage.RECOVERY, recovery.get("levels") or {})

        frame_report = recovery.get("frame_report") or {}
        container_result = recovery.get("container_result") or {}
        working_path = recovery.get("working_path") or preserved_path

        valid_paths = frame_report.get("valid_frame_paths") or []
        bad_paths = frame_report.get("bad_frame_paths") or []
        missing_count = int(frame_report.get("missing_frame_count") or 0)

        # Container-only success (no decodable frames but playable output)
        if not valid_paths and container_result.get("success") and container_result.get("output_path"):
            _complete_container_only(
                job,
                str(container_result["output_path"]),
                str(container_result.get("method") or "container_recovery"),
                preserved_path,
            )
            return

        if not valid_paths and not container_result.get("success"):
            issues = (job.forensic_report.get("corruption_detection") or {}).get("issues") or []
            raise RuntimeError(
                "Recovery failed: original data could not be extracted. "
                f"Issues: {'; '.join(str(i) for i in issues[:4])}"
            )

        # ── Classify frames → damage map ──
        _set_stage(job, RecoveryStage.DAMAGE_MAP)
        frame_entries = classify_extracted_frames(valid_paths, bad_paths, missing_count=missing_count)
        fps = 25.0
        duration = float(
            (damage.get("forensic") or {}).get("container_analysis", {}).get("duration_seconds") or 0
        )
        damage_map = build_damage_map(frame_entries, duration_seconds=duration, fps=fps)
        frame_corruption_counts = count_frame_corruption_types(frame_entries)
        damage_map["corruption_types"] = frame_corruption_counts
        damage_map["file_corruption_types"] = damage.get("file_corruption_types") or []
        job.damage_map = damage_map
        job.save(update_fields=["damage_map", "updated_at"])
        _append_log(job, RecoveryStage.DAMAGE_MAP, {
            "segments": len(damage_map.get("segments") or []),
            "counts": damage_map.get("counts"),
        })

        # ── REGENERATION TECHNIQUE (for unrecoverable / missing) ──
        _set_stage(job, RecoveryStage.REGENERATION)
        regen = run_regeneration_engine(frame_entries, os.path.join(work, "regen"))
        regen_entries = regen.get("output_entries") or []
        if not regen_entries:
            regen_entries = [
                {"index": i, "path": p, "status": "valid", "source": "original", "technique": "recovery"}
                for i, p in enumerate(valid_paths)
            ]
        _append_log(job, RecoveryStage.REGENERATION, {
            **(regen.get("stats") or {}),
            "gpu": regen.get("gpu") or {},
        })

        # ── Hybrid merger ──
        _set_stage(job, RecoveryStage.HYBRID_MERGE)
        hybrid = merge_hybrid_timeline(regen_entries, work)
        merged_paths = hybrid.get("merged_paths") or []
        _append_log(job, RecoveryStage.HYBRID_MERGE, hybrid)

        if not merged_paths:
            raise RuntimeError("Hybrid merge produced no frames")

        # ── Temporal consistency ──
        _set_stage(job, RecoveryStage.TEMPORAL)
        temporal = apply_temporal_consistency(merged_paths, work)
        final_frames = temporal.get("output_paths") or merged_paths
        _append_log(job, RecoveryStage.TEMPORAL, {"processed": temporal.get("processed_count")})

        # ── Audio pipeline (parallel recover / fill) ──
        _set_stage(job, RecoveryStage.AUDIO)
        audio = recover_audio(working_path, os.path.join(work, "audio"), video_duration=duration)
        if audio.get("generated_audio_labeled") is None:
            audio["generated_audio_labeled"] = not audio.get("audio_present")
        _append_log(job, RecoveryStage.AUDIO, audio)

        # ── Timeline reconstruction + encode ──
        _set_stage(job, RecoveryStage.RECONSTRUCT)
        dest_mp4 = os.path.join(work, f"hybrid_{job.id}.mp4")
        recon = reconstruct_video(
            final_frames,
            audio.get("noise_reduced_path") or audio.get("extracted_path") or "",
            dest_mp4,
            fps=fps,
        )
        _append_log(job, RecoveryStage.RECONSTRUCT, recon)
        if not recon.get("success"):
            raise RuntimeError(recon.get("error") or "Video encoding failed")

        # ── Quality validation ──
        _set_stage(job, RecoveryStage.VALIDATE_OUT)
        content = assess_visual_recovery(
            valid_paths,
            final_frames,
            damage_map.get("counts") or {},
        )
        quality = validate_recovered_video(
            preserved_path,
            dest_mp4,
            os.path.join(work, "validate"),
            source_frame_paths=valid_paths,
            output_frame_paths=final_frames,
            damage_counts=damage_map.get("counts") or {},
        )
        job.quality_report = quality
        corruption_report = build_corruption_report(
            file_level=damage.get("file_corruption_types") or [],
            frame_counts=frame_corruption_counts,
            regen_stats=regen.get("stats"),
            audio_report=audio,
            recovery_levels=recovery.get("levels"),
        )
        job.hybrid_report = {
            "recovery_technique": "container_stream_frame_recovery",
            "regeneration_technique": regen.get("stats"),
            "breakdown": hybrid.get("breakdown"),
            "principle": "recover_what_is_real_regenerate_what_is_lost",
            "audio_generated_labeled": audio.get("generated_audio_labeled", False),
            "gpu": regen.get("gpu") or recon.get("gpu") or {},
            "content_assessment": content,
            "scene_recovered": content.get("scene_recovered", False),
            "corruption_report": corruption_report,
        }
        job.save(update_fields=["quality_report", "hybrid_report", "updated_at"])
        _append_log(job, RecoveryStage.VALIDATE_OUT, quality)

        with open(dest_mp4, "rb") as fh:
            job.recovered_file.save(f"recovered_{job.id}.mp4", File(fh), save=False)

        job.status = JobStatus.COMPLETED
        job.current_stage = RecoveryStage.COMPLETED
        job.completed_at = timezone.now()
        job.save()
        _append_log(job, RecoveryStage.COMPLETED, {
            "quality_score": quality.get("quality_score"),
            "hybrid": True,
        })

    except Exception as exc:
        logger.exception("Hybrid video recovery failed for job %s", job_id)
        job.refresh_from_db()
        job.status = JobStatus.FAILED
        job.error_message = str(exc)
        job.save(update_fields=["status", "error_message", "updated_at"])
        _append_log(job, job.current_stage, {"status": "failed", "error": str(exc)})
    finally:
        with _jobs_lock:
            _running_jobs.discard(str(job_id))


def schedule_recovery(job_id: str) -> None:
    key = str(job_id)
    with _jobs_lock:
        if key in _running_jobs:
            return
        _running_jobs.add(key)

    def _runner() -> None:
        time.sleep(0.2)
        run_recovery_pipeline(key)
        with _jobs_lock:
            _running_jobs.discard(key)

    threading.Thread(target=_runner, daemon=True, name=f"video-recovery-{key[:8]}").start()
