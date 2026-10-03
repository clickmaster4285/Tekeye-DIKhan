from __future__ import annotations

import logging
import threading
import time

from django.conf import settings

logger = logging.getLogger(__name__)

_stop = threading.Event()
_thread: threading.Thread | None = None
_db_skip_warned = False


def start_mobile_monitor_thread():
    global _thread, _db_skip_warned
    if _thread and _thread.is_alive():
        return _thread

    def _loop():
        global _db_skip_warned
        interval = max(15, int(getattr(settings, "CIIS_MONITOR_INTERVAL", 60)))
        while not _stop.wait(interval):
            try:
                from django.db.utils import OperationalError, ProgrammingError
                from logs.enforcement import monitor_mobile_devices

                monitor_mobile_devices()
            except (ProgrammingError, OperationalError) as exc:
                # Missing migration / table — warn once, never spam stack traces.
                if not _db_skip_warned:
                    logger.warning(
                        "CIIS mobile device monitor skipped (DB schema): %s. "
                        "Run: python manage.py migrate logs",
                        exc,
                    )
                    _db_skip_warned = True
            except Exception:
                logger.exception("CIIS mobile device monitor failed")

    _stop.clear()
    _db_skip_warned = False
    _thread = threading.Thread(target=_loop, name="ciis-mobile-monitor", daemon=True)
    _thread.start()
    return _thread


def stop_mobile_monitor_thread():
    _stop.set()
