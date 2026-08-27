"""Run camera / journey / attendance workers outside of runserver."""

from __future__ import annotations

import os
import signal
import threading

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        "Run detection, person-journey, clip requeue, and attendance workers "
        "in this process. Keep `runserver` for the UI so navigation stays fast."
    )

    def handle(self, *args, **options):
        os.environ["TEKEYE_DETECTION_WORKER"] = "1"

        from django.db import connections

        # Worker threads must not keep idle Postgres sessions for CONN_MAX_AGE.
        settings.DATABASES["default"]["CONN_MAX_AGE"] = 0
        connections["default"].settings_dict["CONN_MAX_AGE"] = 0

        from cameras.clip_capture import requeue_pending_clips
        from cameras.detection_worker import run_worker_forever, stop_background_worker

        try:
            requeue_pending_clips()
        except Exception as exc:
            self.stderr.write(self.style.WARNING(f"Clip requeue skipped: {exc}"))

        from person_journey.live_worker import start_live_ingest_worker

        start_live_ingest_worker()

        if getattr(settings, "PERSON_JOURNEY_WORKER_ENABLED", False):
            from person_journey.journey_worker import start_journey_worker_thread

            start_journey_worker_thread()

        if getattr(settings, "ATTENDANCE_CCTV_AUTOSTART", True):
            from recognition.services.autostart import schedule_autostart

            schedule_autostart(delay_seconds=1.0)

        stop = threading.Event()

        def _shutdown(signum, _frame):
            self.stdout.write(self.style.WARNING(f"Stopping background workers (signal {signum})…"))
            stop_background_worker()
            stop.set()

        signal.signal(signal.SIGINT, _shutdown)
        signal.signal(signal.SIGTERM, _shutdown)

        self.stdout.write(
            self.style.SUCCESS(
                "Background workers running (detection + journey + attendance). Ctrl+C to stop."
            )
        )

        if getattr(settings, "DETECTION_WORKER_ENABLED", True):
            run_worker_forever()
        else:
            stop.wait()
