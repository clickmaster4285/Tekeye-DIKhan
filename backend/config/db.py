"""Thread-local Postgres cleanup for camera / snapshot workers."""

from __future__ import annotations


def release_db() -> None:
    """Drop this thread's DB connection so idle workers do not pin a Postgres slot."""
    try:
        from django.db import connections

        connections.close_all()
    except Exception:
        pass
