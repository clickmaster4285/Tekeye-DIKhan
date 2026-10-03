"""Operational throttling for background workers (cycle sleep + thread caps)."""

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


def maybe_pause_for_cpu(log: logging.Logger | None = None, *, label: str = "worker") -> None:
    """Brief inter-cycle sleep only (CPU circuit-breaker removed)."""
    del log, label  # kept for call-site compatibility
    time.sleep(min_cycle_sleep_sec())
