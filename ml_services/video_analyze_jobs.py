"""Background jobs for offline video AI tagging."""

from __future__ import annotations

import shutil
import re
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from video_analyze import analyze_video_path

_LOCK = threading.Lock()
_RUN_LOCK = threading.Lock()
_JOBS: dict[str, dict[str, Any]] = {}
_TMP = Path(__file__).resolve().parent / "tmp" / "video_analyze"
_TMP.mkdir(parents=True, exist_ok=True)


def _safe_stem(name: str, fallback: str = "video") -> str:
    stem = Path(str(name or "")).stem.strip()
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", stem).strip("._")[:48]
    return stem or fallback


def unique_tagged_filename(job_id: str, source_path: str = "") -> str:
    stamp = time.strftime("%Y%m%d_%H%M%S")
    stem = _safe_stem(source_path)
    if stem.lower() in {"source", "video"}:
        stem = "video"
    return f"{stem}_tagged_{job_id}_{stamp}.mp4"


def _patch(job_id: str, **fields: Any) -> None:
    with _LOCK:
        row = _JOBS.get(job_id)
        if not row:
            return
        row.update(fields)
        row["updated_at"] = time.time()


def get_analyze_job(job_id: str) -> dict[str, Any] | None:
    with _LOCK:
        row = _JOBS.get(job_id)
        if not row:
            return None
        return {
            "job_id": row["job_id"],
            "status": row["status"],
            "progress": int(row.get("progress") or 0),
            "message": row.get("message") or "",
            "error": row.get("error"),
            "result": row.get("result"),
            "output_path": row.get("output_path") or "",
        }


def get_output_path(job_id: str) -> Path | None:
    with _LOCK:
        row = _JOBS.get(job_id)
        if not row:
            return None
        path = Path(str(row.get("output_path") or ""))
    if path.is_file():
        return path
    return None


def start_analyze_job(
    video_path: str,
    *,
    person: bool,
    vehicle: bool,
    weapon: bool,
    fire: bool,
    match_staff: bool,
    sample_fps: float,
    cleanup_video: bool = True,
) -> str:
    job_id = uuid.uuid4().hex[:12]
    out_path = Path(video_path).parent / unique_tagged_filename(job_id, video_path)
    with _LOCK:
        _JOBS[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "progress": 1,
            "message": "Queued",
            "result": None,
            "error": None,
            "output_path": str(out_path),
            "created_at": time.time(),
            "updated_at": time.time(),
        }
    threading.Thread(
        target=_run_job,
        args=(
            job_id,
            video_path,
            str(out_path),
            person,
            vehicle,
            weapon,
            fire,
            match_staff,
            sample_fps,
            cleanup_video,
        ),
        daemon=True,
        name=f"video-analyze-{job_id}",
    ).start()
    return job_id


def _run_job(
    job_id: str,
    video_path: str,
    output_path: str,
    person: bool,
    vehicle: bool,
    weapon: bool,
    fire: bool,
    match_staff: bool,
    sample_fps: float,
    cleanup_video: bool,
) -> None:
    _patch(job_id, status="running", progress=2, message="Waiting for GPU")
    with _RUN_LOCK:
        _patch(job_id, status="running", progress=4, message="Pausing live cameras")
        live = None
        try:
            from live_stream import get_live_manager

            live = get_live_manager()
            live.pause_for_offline()
            time.sleep(0.4)
        except Exception as exc:
            print(f"[video-ai] could not pause live: {exc}")
        try:

            def progress_cb(pct: int, message: str) -> None:
                _patch(job_id, status="running", progress=int(pct), message=message)
                print(f"[video-ai] {job_id} {pct}% {message}", flush=True)

            result = analyze_video_path(
                video_path,
                output_path,
                person=person,
                vehicle=vehicle,
                weapon=weapon,
                fire=fire,
                match_staff=match_staff,
                sample_fps=sample_fps,
                progress_cb=progress_cb,
            )
            result["output_path"] = output_path
            _patch(job_id, status="done", progress=100, message="Done", result=result, error=None)
        except Exception as exc:
            _patch(job_id, status="error", progress=100, message=str(exc), error=str(exc))
        finally:
            if live is not None:
                try:
                    live.resume_after_offline()
                except Exception:
                    pass
            if cleanup_video:
                try:
                    Path(video_path).unlink(missing_ok=True)
                except OSError:
                    pass


def new_upload_dir() -> Path:
    job_dir = _TMP / uuid.uuid4().hex[:12]
    job_dir.mkdir(parents=True, exist_ok=True)
    return job_dir


def copy_upload(src_file, dest: Path) -> None:
    with dest.open("wb") as out:
        shutil.copyfileobj(src_file, out)
