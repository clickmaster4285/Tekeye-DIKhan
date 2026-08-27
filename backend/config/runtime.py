"""Process-role helpers: keep HTTP (runserver) free of camera worker loops."""

from __future__ import annotations

import os
import sys


def argv_has(*names: str) -> bool:
    return any(name in sys.argv for name in names)


def is_runserver() -> bool:
    return "runserver" in sys.argv


def skip_embedded_background_workers() -> bool:
    """True when this process should not start detection / journey / CCTV loops.

    Dedicated ``run_background_workers`` owns those loops. ``runserver`` stays
    HTTP-only. Only gunicorn/daphne/uvicorn/waitress auto-start workers in-process.
    """
    if argv_has(
        "migrate",
        "makemigrations",
        "test",
        "shell",
        "collectstatic",
        "run_detection_worker",
        "run_background_workers",
        "start_attendance_cctv",
    ):
        return True
    if is_runserver():
        return True
    if os.environ.get("TEKEYE_HTTP_ONLY") == "1":
        return True
    argv = " ".join(sys.argv).lower()
    if any(name in argv for name in ("gunicorn", "daphne", "uvicorn", "waitress")):
        return False
    return True
