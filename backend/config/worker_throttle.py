"""Operational throttling for background workers (sleep, CPU circuit breaker, thread caps)."""

from __future__ import annotations

import logging
import os
import time

logger = logging.getLogger(__name__)


def apply_worker_resource_limits() -> None:
    """Cap native thread pools for the dedicated background-worker process."""
    for key, val in (
        ("OMP_NUM_THREADS", "1"),
        ("OPENBLAS_NUM_THREADS", "1"),
        ("MKL_NUM_THREADS", "1"),
        ("NUMEXPR_NUM_THREADS", "1"),
        ("VECLIB_MAXIMUM_THREADS", "1"),
        ("BLIS_NUM_THREADS", "1"),
        ("ORT_NUM_THREADS", "1"),
    ):
        os.environ.setdefault(key, val)


def min_cycle_sleep_sec() -> float:
    raw = os.getenv("WORKER_MIN_CYCLE_SLEEP_MS", "100")
    try:
        ms = float(raw)
    except (TypeError, ValueError):
        ms = 100.0
    return max(0.1, ms / 1000.0)


def cpu_pause_threshold() -> float:
    raw = os.getenv("WORKER_CPU_PAUSE_THRESHOLD", "80")
    try:
        val = float(raw)
    except (TypeError, ValueError):
        val = 80.0
    return max(50.0, min(99.0, val))


def cpu_pause_duration_sec() -> float:
    raw = os.getenv("WORKER_CPU_PAUSE_SEC", "30")
    try:
        val = float(raw)
    except (TypeError, ValueError):
        val = 30.0
    return max(5.0, val)


def _cpu_percent() -> float | None:
    try:
        import psutil

        return float(psutil.cpu_percent(interval=0.05))
    except ImportError:
        pass
    except Exception:
        return None
    try:
        with open("/proc/loadavg", encoding="utf-8") as fh:
            load1 = float(fh.read().split()[0])
        cores = max(1, int(os.cpu_count() or 1))
        return min(100.0, (load1 / cores) * 100.0)
    except Exception:
        return None


def maybe_pause_for_cpu(log: logging.Logger | None = None, *, label: str = "worker") -> None:
    """Always sleep min cycle gap; extra pause when host CPU is above threshold."""
    time.sleep(min_cycle_sleep_sec())
    pct = _cpu_percent()
    if pct is None:
        return
    if pct >= cpu_pause_threshold():
        pause = cpu_pause_duration_sec()
        (log or logger).warning(
            "[%s] CPU at %.1f%% >= %.1f%% — circuit-breaker pause %.0fs",
            label,
            pct,
            cpu_pause_threshold(),
            pause,
        )
        time.sleep(pause)
