"""
Seed August attendance for SWH Ratta Kulachi warehouse staff.

Usage:
  python manage.py seed_august_attendance
  python manage.py seed_august_attendance --year 2026
  python manage.py seed_august_attendance --dry-run
  python manage.py seed_august_attendance --clear
"""

from __future__ import annotations

import random
from datetime import date, datetime, time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from users.models import Attendance, Staff

# August attendance roster — Azhar Habib (0000 / 3710442631911) excluded per request.
AUGUST_STAFF = [
    {"personal_number": "000000", "full_name": "Sher Alam", "cnic": "1210190857903"},
    {"personal_number": "50794711", "full_name": "Ubaid Griffen", "cnic": "1110107089627"},
    {"personal_number": "50714824", "full_name": "Muhammad Masood", "cnic": "1120188640445"},
    {"personal_number": "50710836", "full_name": "Nafid Ullah Khan", "cnic": "1110118205557"},
    {"personal_number": "50794708", "full_name": "Niaz Ali Khan", "cnic": "1110157695791"},
    {"personal_number": "50402298", "full_name": "Muhammad Abid", "cnic": "6110178044963"},
    {"personal_number": "50050201", "full_name": "Aftab Khan", "cnic": "1310164871059"},
    {"personal_number": "50794714", "full_name": "Muhammad Khalil Ahmad", "cnic": "1210179221323"},
    {"personal_number": "50794689", "full_name": "Shalbeem Naseer", "cnic": "1210118212603"},
    {"personal_number": "50714850", "full_name": "Irshad Ahmad", "cnic": "1120203601207"},
    {"personal_number": "50794703", "full_name": "Shahab Alam", "cnic": "1420179920923"},
    {"personal_number": "00090459", "full_name": "Sardar Ali Khan", "cnic": "1420215099723"},
    {"personal_number": "50794694", "full_name": "Mohsin Farid", "cnic": "1430152553730"},
    {"personal_number": "50605519", "full_name": "Shafi Ullah", "cnic": "1420190981989"},
    {"personal_number": "50794680", "full_name": "Rahmat Ali Khan", "cnic": "1110199606025"},
    {"personal_number": "50710465", "full_name": "Sadiq Amin", "cnic": "6110121323727"},
    {"personal_number": "50703963", "full_name": "Syed Ishraq Ali Shah", "cnic": "1730168075003"},
    {"personal_number": "50671028", "full_name": "Abdul Hai", "cnic": "3230462160693"},
    {"personal_number": "50794749", "full_name": "Jawad Ullah", "cnic": "1110103590439"},
]

MONTH = 8

# Random windows (local time)
CHECK_IN_EARLIEST = (8, 30)
CHECK_IN_LATEST = (9, 25)
CHECK_OUT_EARLIEST = (16, 30)
CHECK_OUT_LATEST = (17, 45)
LATE_AFTER = time(9, 5)


def _random_time(rng: random.Random, start: tuple[int, int], end: tuple[int, int]) -> time:
    start_m = start[0] * 60 + start[1]
    end_m = end[0] * 60 + end[1]
    picked = rng.randint(start_m, end_m)
    return time(picked // 60, picked % 60)


def _random_check_times(rng: random.Random, day: date, tz) -> tuple[datetime, datetime, str]:
    in_t = _random_time(rng, CHECK_IN_EARLIEST, CHECK_IN_LATEST)
    out_t = _random_time(rng, CHECK_OUT_EARLIEST, CHECK_OUT_LATEST)
    check_in = timezone.make_aware(datetime.combine(day, in_t), tz)
    check_out = timezone.make_aware(datetime.combine(day, out_t), tz)
    if check_out <= check_in:
        check_out = check_in + timedelta(hours=rng.randint(7, 9), minutes=rng.randint(0, 45))
    status = Attendance.STATUS_LATE if in_t > LATE_AFTER else Attendance.STATUS_PRESENT
    return check_in, check_out, status


def _normalize_cnic(value: str) -> str:
    return "".join(ch for ch in (value or "") if ch.isdigit())


def _resolve_staff(row: dict) -> Staff | None:
    pn = str(row.get("personal_number") or "").strip()
    cnic = _normalize_cnic(str(row.get("cnic") or ""))
    if pn:
        staff = Staff.objects.filter(personal_number=pn).first()
        if staff:
            return staff
    if cnic:
        for candidate in Staff.objects.exclude(cnic__isnull=True).exclude(cnic=""):
            if _normalize_cnic(candidate.cnic) == cnic:
                return candidate
    name = str(row.get("full_name") or "").strip()
    if name:
        return Staff.objects.filter(full_name__iexact=name).first()
    return None


def _august_weekdays(year: int) -> list[date]:
    days: list[date] = []
    d = date(year, MONTH, 1)
    while d.month == MONTH:
        if d.weekday() < 5:
            days.append(d)
        d += timedelta(days=1)
    return days


class Command(BaseCommand):
    help = "Seed August attendance for warehouse staff (excludes Azhar Habib)."

    def add_arguments(self, parser):
        parser.add_argument("--year", type=int, default=2026, help="Year for August seed (default: 2026)")
        parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete existing August attendance for matched staff before seeding",
        )
        parser.add_argument(
            "--seed",
            type=int,
            default=None,
            help="Random seed for reproducible check-in/out times (optional)",
        )

    def handle(self, *args, **options):
        year = int(options["year"])
        dry_run = bool(options["dry_run"])
        clear = bool(options["clear"])
        tz = timezone.get_current_timezone()
        workdays = _august_weekdays(year)
        rng = random.Random(options["seed"] if options["seed"] is not None else year)

        resolved: list[tuple[Staff, dict]] = []
        missing: list[str] = []

        for row in AUGUST_STAFF:
            staff = _resolve_staff(row)
            if staff:
                resolved.append((staff, row))
            else:
                missing.append(f"{row['full_name']} (PN {row['personal_number']}, CNIC {row['cnic']})")

        if missing:
            self.stdout.write(self.style.WARNING("Staff not found in DB (skipped):"))
            for line in missing:
                self.stdout.write(f"  - {line}")

        if not resolved:
            self.stderr.write(self.style.ERROR("No staff matched. Add staff records first, then re-run."))
            return

        self.stdout.write(
            f"Matched {len(resolved)} staff × {len(workdays)} weekdays "
            f"= {len(resolved) * len(workdays)} attendance rows for August {year}"
        )

        if dry_run:
            for staff, row in resolved:
                self.stdout.write(f"  [dry-run] {staff.full_name} ({row['personal_number']})")
            return

        created = 0
        updated = 0
        deleted = 0

        with transaction.atomic():
            if clear:
                staff_ids = [s.id for s, _ in resolved]
                qs = Attendance.objects.filter(
                    staff_id__in=staff_ids,
                    date__year=year,
                    date__month=MONTH,
                )
                deleted, _ = qs.delete()
                self.stdout.write(self.style.WARNING(f"Cleared {deleted} existing August {year} rows"))

            for staff, _row in resolved:
                for day in workdays:
                    check_in, check_out, status = _random_check_times(rng, day, tz)
                    defaults = {
                        "check_in": check_in,
                        "check_out": check_out,
                        "status": status,
                        "source": Attendance.SOURCE_MANUAL,
                        "notes": f"Seeded August {year} attendance (randomized times)",
                    }
                    if staff.user_id:
                        defaults["user"] = staff.user

                    obj, was_created = Attendance.objects.update_or_create(
                        staff=staff,
                        date=day,
                        defaults=defaults,
                    )
                    if was_created:
                        created += 1
                    else:
                        updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Done — created {created}, updated {updated}, cleared {deleted} "
                f"(August {year}, {len(resolved)} employees)"
            )
        )
