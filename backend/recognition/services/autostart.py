"""Autostart InsightFace CCTV attendance workers when the server boots."""

from __future__ import annotations

import logging
import os
import sys
import threading
from pathlib import Path

from django.conf import settings
from django.db import close_old_connections

logger = logging.getLogger(__name__)
_lock_handle = None


def _lock_path() -> Path:
    base = Path(getattr(settings, "BASE_DIR", Path.cwd()))
    return base / ".cctv_autostart.lock"


def _acquire_autostart_lock():
    lock_path = _lock_path()
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    fh = None
    try:
        fh = open(lock_path, "a+", encoding="utf-8")
        if sys.platform == "win32":
            import msvcrt

            try:
                msvcrt.locking(fh.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError:
                fh.close()
                return None
        else:
            import fcntl

            try:
                fcntl.flock(fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                fh.close()
                return None
        fh.seek(0)
        fh.truncate()
        fh.write(f"{os.getpid()}\n")
        fh.flush()
        return fh
    except OSError as exc:
        logger.debug("[cctv-autostart] Could not acquire lock: %s", exc)
        if fh is not None:
            try:
                fh.close()
            except OSError:
                pass
        return None


def collect_attendance_cameras() -> list[dict]:
    """Active cameras with attendance/face purposes and a resolvable RTSP URL."""
    from recognition.services.attendance_cameras import collect_attendance_camera_payloads

    return collect_attendance_camera_payloads(for_workers=True)


def _autostart_worker(delay_seconds: float):
    import time

    global _lock_handle

    time.sleep(delay_seconds)
    lock = _acquire_autostart_lock()
    if lock is None:
        logger.debug("[cctv-autostart] Another Gunicorn worker already started CCTV workers")
        return
    _lock_handle = lock
    try:
        close_old_connections()
        from recognition.services.cctv_worker import get_cctv_manager

        cameras = collect_attendance_cameras()
        if not cameras:
            logger.info("CCTV autostart: no attendance-purpose cameras found")
            return
        manager = get_cctv_manager()
        statuses = manager.start_all(cameras)
        logger.info("CCTV autostart: started %d attendance workers", len(statuses))
    except Exception:
        logger.exception("CCTV autostart failed")
    finally:
        close_old_connections()


def schedule_autostart(delay_seconds: float = 3.0):
    """Start workers in a daemon thread shortly after boot (non-blocking)."""
    thread = threading.Thread(
        target=_autostart_worker,
        args=(delay_seconds,),
        name="cctv-attendance-autostart",
        daemon=True,
    )
    thread.start()
