"""Background worker: sync cameras/NVRs + poll device health."""

from __future__ import annotations

import logging
import os
import sys
import threading
import time
from pathlib import Path

from django.conf import settings
from django.db import close_old_connections

logger = logging.getLogger(__name__)

_stop_event = threading.Event()
_worker_thread: threading.Thread | None = None
_lock_handle = None


def _lock_path() -> Path:
    base = Path(getattr(settings, "BASE_DIR", Path.cwd()))
    return base / ".infra_monitoring_worker.lock"


def _acquire_lock():
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
            except OSError:
                fh.close()
                return None
        fh.seek(0)
        fh.truncate()
        fh.write(str(os.getpid()))
        fh.flush()
        return fh
    except Exception:
        if fh:
            fh.close()
        return None


def _release_lock(fh) -> None:
    if not fh:
        return
    try:
        if sys.platform == "win32":
            import msvcrt

            fh.seek(0)
            msvcrt.locking(fh.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl

            fcntl.flock(fh.fileno(), fcntl.LOCK_UN)
    except Exception:
        pass
    try:
        fh.close()
    except Exception:
        pass


def _loop() -> None:
    interval = float(getattr(settings, "INFRA_POLL_INTERVAL_SEC", 45))
    interval = max(15.0, interval)
    logger.info("[infra-monitor] worker started (interval=%ss)", interval)
    # First cycle soon after boot
    first = True
    while not _stop_event.is_set():
        if not first:
            _stop_event.wait(interval)
            if _stop_event.is_set():
                break
        first = False
        close_old_connections()
        try:
            from .services import sync_and_poll

            stats = sync_and_poll()
            logger.info("[infra-monitor] cycle ok: %s", stats)
        except Exception:
            logger.exception("[infra-monitor] cycle failed")
        finally:
            close_old_connections()
    logger.info("[infra-monitor] worker stopped")


def maybe_start_infra_worker() -> None:
    global _worker_thread, _lock_handle
    enabled = getattr(settings, "INFRA_MONITORING_WORKER_ENABLED", True)
    if not enabled:
        logger.info("[infra-monitor] worker disabled")
        return
    if _worker_thread and _worker_thread.is_alive():
        return
    _lock_handle = _acquire_lock()
    if _lock_handle is None:
        logger.info("[infra-monitor] another worker holds the lock; skip")
        return
    _stop_event.clear()
    _worker_thread = threading.Thread(
        target=_loop, name="infra-monitoring-worker", daemon=True
    )
    _worker_thread.start()


def stop_infra_worker() -> None:
    global _worker_thread, _lock_handle
    _stop_event.set()
    if _worker_thread:
        _worker_thread.join(timeout=5)
    _worker_thread = None
    _release_lock(_lock_handle)
    _lock_handle = None
