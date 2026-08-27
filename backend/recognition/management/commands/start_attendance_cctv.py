from django.core.management.base import BaseCommand

from recognition.services.attendance_cameras import collect_attendance_camera_payloads
from recognition.services.cctv_worker import get_cctv_manager


class Command(BaseCommand):
    help = "Start InsightFace CCTV attendance workers for all active cameras."

    def add_arguments(self, parser):
        parser.add_argument(
            "--stop",
            action="store_true",
            help="Stop all running attendance CCTV workers instead of starting.",
        )

    def handle(self, *args, **options):
        manager = get_cctv_manager()
        if options["stop"]:
            statuses = manager.stop_all()
            self.stdout.write(self.style.SUCCESS(f"Stopped {len(statuses)} workers"))
            return

        cameras = collect_attendance_camera_payloads(for_workers=False)
        statuses = manager.start_all(cameras)
        self.stdout.write(self.style.SUCCESS(f"Started {len(statuses)} CCTV attendance workers"))
        for s in statuses:
            self.stdout.write(f"  camera {s['camera_id']}: running={s['running']}")
