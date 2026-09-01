"""Disk-backed Find-in-Video jobs so 1-hour recordings can finish without HTTP timeouts."""

from __future__ import annotations

import json
import shutil
import threading
import time
from pathlib import Path
from typing import Any

from django.conf import settings

from .video_clips import cut_clip, save_job_dir, save_preview_jpeg

STATUS_NAME = "status.json"


def _job_dir(job_id: str) -> Path:
    return Path(settings.MEDIA_ROOT) / "video_search" / job_id


def _write_status(folder: Path, payload: dict[str, Any]) -> None:
    payload["updated_at"] = time.time()
    tmp = folder / f".{STATUS_NAME}"
    dest = folder / STATUS_NAME
    tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    tmp.replace(dest)


def read_status(job_id: str) -> dict[str, Any] | None:
    path = _job_dir(job_id) / STATUS_NAME
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return data if isinstance(data, dict) else None


def save_upload(django_file, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    temp_path = getattr(django_file, "temporary_file_path", None)
    if callable(temp_path):
        try:
            src = temp_path()
            if src and Path(src).is_file():
                shutil.copyfile(src, dest)
                return
        except Exception:
            pass
    with dest.open("wb") as out:
        for chunk in django_file.chunks():
            out.write(chunk)


def _finalize_result(folder: Path, result: dict[str, Any], clip_seconds: float) -> dict[str, Any]:
    source_path = folder / "source.mp4"
    query = result.get("query") if isinstance(result.get("query"), dict) else {}
    query_preview = save_preview_jpeg(folder, "query.jpg", query.get("preview_jpeg_b64") or "")
    if isinstance(query, dict):
        query = {k: v for k, v in query.items() if k != "preview_jpeg_b64"}
        query["preview_url"] = query_preview
        result["query"] = query

    segments = result.get("segments") if isinstance(result.get("segments"), list) else []
    cleaned = []
    for index, segment in enumerate(segments, start=1):
        if not isinstance(segment, dict):
            continue
        start = float(segment.get("start_sec") or 0)
        end = float(segment.get("end_sec") or start)
        duration = max(2.0, min(5.0, end - start if end > start else clip_seconds))
        clip_name = f"clip_{index:02d}.mp4"
        clip_path = folder / clip_name
        clipped = cut_clip(str(source_path), str(clip_path), start, duration)
        preview_url = save_preview_jpeg(
            folder,
            f"preview_{index:02d}.jpg",
            segment.get("preview_jpeg_b64") or "",
        )
        item = {k: v for k, v in segment.items() if k != "preview_jpeg_b64"}
        item["preview_url"] = preview_url
        item["clip_url"] = f"/media/video_search/{folder.name}/{clip_name}" if clipped else ""
        item["clip_seconds"] = round(duration, 2)
        cleaned.append(item)
    result["segments"] = cleaned
    result["job_id"] = folder.name
    try:
        source_path.unlink(missing_ok=True)
    except OSError:
        pass
    return result


def _run_job(folder: Path, params: dict[str, Any]) -> None:
    from .client import MLServiceError, ml_poll_video_search, ml_start_video_search

    job_id = folder.name
    clip_seconds = float(params.get("clip_seconds") or 4)
    _write_status(
        folder,
        {
            "job_id": job_id,
            "status": "running",
            "progress": 5,
            "message": "Sending recording to AI engine",
        },
    )
    try:
        started = ml_start_video_search(
            image_path=str(folder / "query_upload.jpg"),
            video_path=str(folder / "source.mp4"),
            face_threshold=float(params.get("face_threshold") or 0.45),
            reid_threshold=float(params.get("reid_threshold") or 0.88),
            sample_fps=float(params.get("sample_fps") or 0),
            clip_seconds=clip_seconds,
        )
        ml_job_id = str(started.get("job_id") or "").strip()
        if not ml_job_id:
            raise MLServiceError("AI engine did not return a search job id.", 503)

        while True:
            row = ml_poll_video_search(ml_job_id)
            status = str(row.get("status") or "")
            _write_status(
                folder,
                {
                    "job_id": job_id,
                    "status": "running",
                    "progress": int(row.get("progress") or 5),
                    "message": row.get("message") or "Scanning camera recording",
                },
            )
            if status == "done":
                result = row.get("result") if isinstance(row.get("result"), dict) else {}
                _write_status(
                    folder,
                    {
                        "job_id": job_id,
                        "status": "running",
                        "progress": 96,
                        "message": "Cutting 2–5 second clips",
                    },
                )
                finalized = _finalize_result(folder, result, clip_seconds)
                _write_status(
                    folder,
                    {
                        "job_id": job_id,
                        "status": "done",
                        "progress": 100,
                        "message": "Done",
                        "result": finalized,
                    },
                )
                break
            if status == "error":
                raise MLServiceError(str(row.get("error") or row.get("message") or "Search failed."), 400)
            time.sleep(2.0)
    except Exception as exc:
        _write_status(
            folder,
            {
                "job_id": job_id,
                "status": "error",
                "progress": 100,
                "message": str(exc),
                "error": str(exc),
            },
        )
    finally:
        try:
            (folder / "query_upload.jpg").unlink(missing_ok=True)
        except OSError:
            pass


def start_job(image_file, video_file, params: dict[str, Any]) -> dict[str, Any]:
    folder = save_job_dir()
    save_upload(image_file, folder / "query_upload.jpg")
    save_upload(video_file, folder / "source.mp4")
    payload = {
        "job_id": folder.name,
        "status": "queued",
        "progress": 1,
        "message": "Uploaded. Starting 1-hour scan…",
    }
    _write_status(folder, payload)
    threading.Thread(
        target=_run_job,
        args=(folder, params),
        daemon=True,
        name=f"django-video-search-{folder.name}",
    ).start()
    return payload
