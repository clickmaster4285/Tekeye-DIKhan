"""Background jobs for hour-long camera recording search."""

from __future__ import annotations

import shutil
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from video_search import search_video_path

_LOCK = threading.Lock()
_JOBS: dict[str, dict[str, Any]] = {}
_TMP = Path(__file__).resolve().parent / "tmp" / "video_search"
_TMP.mkdir(parents=True, exist_ok=True)


def _patch(job_id: str, **fields: Any) -> None:
    with _LOCK:
        row = _JOBS.get(job_id)
        if not row:
            return
        row.update(fields)
        row["updated_at"] = time.time()


def get_search_job(job_id: str) -> dict[str, Any] | None:
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
        }


def start_search_job(
    image_path: str,
    video_path: str,
    *,
    face_threshold: float,
    reid_threshold: float,
    sample_fps: float,
    clip_seconds: float,
    cleanup_video: bool = True,
) -> str:
    job_id = uuid.uuid4().hex[:12]
    with _LOCK:
        _JOBS[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "progress": 1,
            "message": "Queued",
            "result": None,
            "error": None,
            "created_at": time.time(),
            "updated_at": time.time(),
        }
    threading.Thread(
        target=_run_job,
        args=(
            job_id,
            image_path,
            video_path,
            face_threshold,
            reid_threshold,
            sample_fps,
            clip_seconds,
            cleanup_video,
        ),
        daemon=True,
        name=f"video-search-{job_id}",
    ).start()
    return job_id


def _run_job(
    job_id: str,
    image_path: str,
    video_path: str,
    face_threshold: float,
    reid_threshold: float,
    sample_fps: float,
    clip_seconds: float,
    cleanup_video: bool,
) -> None:
    _patch(job_id, status="running", progress=3, message="Loading query image")
    try:
        image_bytes = Path(image_path).read_bytes()

        def progress_cb(pct: int, message: str) -> None:
            _patch(job_id, status="running", progress=int(pct), message=message)

        result = search_video_path(
            image_bytes,
            video_path,
            face_threshold=face_threshold,
            reid_threshold=reid_threshold,
            sample_fps=sample_fps,
            clip_seconds=clip_seconds,
            progress_cb=progress_cb,
        )
        _patch(job_id, status="done", progress=100, message="Done", result=result, error=None)
    except Exception as exc:
        _patch(job_id, status="error", progress=100, message=str(exc), error=str(exc))
    finally:
        try:
            Path(image_path).unlink(missing_ok=True)
        except OSError:
            pass
        if cleanup_video:
            try:
                Path(video_path).unlink(missing_ok=True)
            except OSError:
                pass
        folder = Path(image_path).parent
        try:
            if folder.is_dir() and folder.parent == _TMP:
                shutil.rmtree(folder, ignore_errors=True)
        except OSError:
            pass


def new_upload_dir() -> Path:
    job_dir = _TMP / uuid.uuid4().hex[:12]
    job_dir.mkdir(parents=True, exist_ok=True)
    return job_dir


def copy_upload(src_file, dest: Path) -> None:
    with dest.open("wb") as out:
        shutil.copyfileobj(src_file, out)
