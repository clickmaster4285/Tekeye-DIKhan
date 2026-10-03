"""
Seed Enforcement Collectorate HQ staff roster into users.Staff.

Source: enforcement_staff_seed.json

Usage:
  python manage.py seed_enforcement_staff
  python manage.py seed_enforcement_staff --dry-run
  python manage.py seed_enforcement_staff --update
  python manage.py seed_enforcement_staff --create-logins --default-password ChangeMe@123
  python manage.py seed_enforcement_staff --no-create-logins
"""

from __future__ import annotations

import json
import re
from datetime import date, datetime
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from users.models import Staff, User

DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "enforcement_staff_seed.json"


def _parse_date(value) -> date | None:
    if value in (None, ""):
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%m/%d/%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _norm_name(value: str | None) -> str:
    text = (value or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _notes_for(row: dict) -> str:
    parts = []
    domicile = (row.get("domicile") or "").strip()
    if domicile:
        parts.append(f"Domicile: {domicile}")
    enf = row.get("enforcement_joining_date")
    if enf:
        parts.append(f"Joining Enforcement Collectorate: {enf}")
    shift = (row.get("security_shift") or "").strip()
    duty = (row.get("place_of_duty") or "").strip()
    if shift:
        parts.append(f"Security shift: {shift}")
    if duty:
        parts.append(f"Place of duty: {duty}")
    parts.append("Seeded from Enforcement HQ roster")
    return " | ".join(parts)


def _find_existing_staff(*, employee_id: str | None, cnic: str | None, full_name: str, father_name: str) -> Staff | None:
    """Resolve an existing Staff row without creating duplicates."""
    if employee_id:
        hit = Staff.objects.filter(employee_id__iexact=employee_id).first()
        if hit:
            return hit
    if cnic:
        hit = Staff.objects.filter(cnic=cnic).first()
        if hit:
            return hit

    name_q = Staff.objects.filter(full_name__iexact=full_name)
    father = (father_name or "").strip()
    blank_father = Q(father_name__isnull=True) | Q(father_name="")

    if father:
        by_father = name_q.filter(father_name__iexact=father).first()
        if by_father:
            return by_father
        # Same name + empty father in DB → same person (fill father later with --update).
        empty_father = name_q.filter(blank_father).first()
        if empty_father:
            return empty_father
        # Same name, different father → different person.
        return None

    # Seed row has no father: only match another blank-father row with this name.
    blank = name_q.filter(blank_father)
    if blank.count() == 1:
        return blank.first()
    return None


def _find_existing_user(*, username: str, cnic: str | None, employee_id: str | None) -> User | None:
    """Find a login that already belongs to this identity — never create a second one."""
    hit = User.objects.filter(username__iexact=username).first()
    if hit:
        return hit
    if cnic:
        hit = User.objects.filter(cnic=cnic).exclude(cnic="").first()
        if hit:
            return hit
    if employee_id:
        hit = User.objects.filter(employee_id__iexact=employee_id).exclude(employee_id="").first()
        if hit:
            return hit
    return None


class Command(BaseCommand):
    help = "Seed Enforcement Collectorate staff from JSON into Staff records (skips existing staff/users)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            default=str(DATA_FILE),
            help="Path to staff JSON seed file",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and report without writing to the database",
        )
        parser.add_argument(
            "--update",
            action="store_true",
            help="Update existing Staff matched by employee_id / cnic / name",
        )
        parser.add_argument(
            "--create-logins",
            action="store_true",
            default=True,
            help="Create login users when missing (default on)",
        )
        parser.add_argument(
            "--no-create-logins",
            action="store_true",
            help="Skip creating login users",
        )
        parser.add_argument(
            "--default-password",
            type=str,
            default="123456",
            help="Password for created logins (default: 123456)",
        )

    def handle(self, *args, **options):
        path = Path(options["file"])
        if not path.is_file():
            raise CommandError(f"Seed file not found: {path}")

        rows = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(rows, list) or not rows:
            raise CommandError("Seed file must be a non-empty JSON array")

        dry = bool(options["dry_run"])
        do_update = bool(options["update"])
        create_logins = bool(options["create_logins"]) and not bool(options["no_create_logins"])
        password = options["default_password"] or "123456"

        created = updated = skipped = logins = linked_existing_logins = 0
        seen_keys: set[str] = set()

        self.stdout.write(f"Loading {len(rows)} staff from {path.name}…")

        with transaction.atomic():
            for row in rows:
                full_name = (row.get("full_name") or "").strip()
                if not full_name:
                    skipped += 1
                    continue

                father_name = (row.get("father_name") or "").strip()
                employee_id = (row.get("employee_id") or "").strip() or None
                cnic_raw = "".join(ch for ch in str(row.get("cnic") or "") if ch.isdigit())
                cnic = cnic_raw[:15] if cnic_raw else None

                # Skip duplicate rows inside the same seed file.
                dedupe_key = "|".join(
                    [
                        (employee_id or "").lower(),
                        cnic or "",
                        _norm_name(full_name),
                        _norm_name(father_name),
                    ]
                )
                if dedupe_key in seen_keys:
                    skipped += 1
                    self.stdout.write(self.style.WARNING(f"  skip duplicate seed row: {full_name}"))
                    continue
                seen_keys.add(dedupe_key)

                existing = _find_existing_staff(
                    employee_id=employee_id,
                    cnic=cnic,
                    full_name=full_name,
                    father_name=father_name,
                )

                joining = _parse_date(row.get("joining_date")) or timezone.localdate()
                payload = {
                    "full_name": full_name[:150],
                    "father_name": father_name[:150] or None,
                    "designation": (row.get("designation") or "Sepoy")[:100],
                    "department": (row.get("department") or "Enforcement Collectorate")[:100],
                    "bps": str(row.get("bps") or "5")[:10] or None,
                    "phone_primary": (row.get("phone_primary") or "")[:20] or None,
                    "phone_alternate": (row.get("phone_alternate") or "")[:20] or None,
                    "date_of_birth": _parse_date(row.get("date_of_birth")),
                    "qualification": (row.get("qualification") or "")[:200] or None,
                    "current_posting": (row.get("current_posting") or "")[:300] or None,
                    "branch_location": "PESHAWAR",
                    "city": (row.get("city") or "Peshawar")[:100],
                    "address": (row.get("address") or "Peshawar, Khyber Pakhtunkhwa"),
                    "state": (row.get("state") or "Khyber Pakhtunkhwa"),
                    "country": (row.get("country") or "Pakistan"),
                    "gender": (row.get("gender") or "")[:20] or None,
                    "joining_date": joining,
                    "emergency_contact": (row.get("emergency_contact") or row.get("phone_primary") or "")[:100]
                    or None,
                    "personal_number": (row.get("personal_number") or employee_id or "")[:50] or None,
                    "employee_id": employee_id,
                    "job_status": (row.get("job_status") or "Active")[:50],
                    "employment_type": (row.get("employment_type") or "Permanent")[:50],
                    "notes": _notes_for(row),
                    "cnic": cnic,
                    "record_source": Staff.RECORD_SOURCE_DATABASE,
                }

                if existing:
                    if not do_update:
                        skipped += 1
                        staff = existing
                        # Still attach login if staff exists but has no user yet.
                    else:
                        if dry:
                            updated += 1
                            staff = existing
                        else:
                            for key, value in payload.items():
                                # Never blank out an existing unique identity with a conflicting value.
                                if key in {"employee_id", "cnic"} and value and getattr(existing, key):
                                    if str(getattr(existing, key)).lower() != str(value).lower():
                                        other = Staff.objects.filter(**{key: value}).exclude(pk=existing.pk).first()
                                        if other:
                                            continue
                                setattr(existing, key, value)
                            existing.save()
                            staff = existing
                            if staff.user_id:
                                User.objects.filter(pk=staff.user_id).update(
                                    location="PESHAWAR",
                                    collectorate="Peshawar (Head Office)",
                                )
                            updated += 1
                else:
                    if dry:
                        created += 1
                        staff = None
                    else:
                        # Guard against unique collisions if another process inserted meanwhile.
                        conflict = None
                        if employee_id:
                            conflict = Staff.objects.filter(employee_id__iexact=employee_id).first()
                        if conflict is None and cnic:
                            conflict = Staff.objects.filter(cnic=cnic).first()
                        if conflict is not None:
                            skipped += 1
                            staff = conflict
                            self.stdout.write(
                                self.style.WARNING(f"  skip existing unique key: {full_name}")
                            )
                        else:
                            staff = Staff.objects.create(**payload)
                            created += 1

                row_wants_login = row.get("create_login", True)
                if (
                    create_logins
                    and row_wants_login is not False
                    and not dry
                    and staff is not None
                ):
                    if staff.user_id:
                        # Already linked — do not create another user.
                        continue

                    from users.staff_login import unique_employee_login_id

                    username = unique_employee_login_id(staff)
                    existing_user = _find_existing_user(
                        username=username,
                        cnic=cnic,
                        employee_id=employee_id,
                    )
                    if existing_user is not None:
                        # Re-use existing login if it is not already tied to another staff row.
                        taken = Staff.objects.filter(user_id=existing_user.pk).exclude(pk=staff.pk).exists()
                        if taken:
                            skipped += 1
                            self.stdout.write(
                                self.style.WARNING(
                                    f"  skip login (user already linked elsewhere): {full_name} -> {existing_user.username}"
                                )
                            )
                        else:
                            staff.user = existing_user
                            staff.save(update_fields=["user"])
                            linked_existing_logins += 1
                        continue

                    if User.objects.filter(username__iexact=username).exists():
                        skipped += 1
                        self.stdout.write(
                            self.style.WARNING(f"  skip login (username exists): {full_name} -> {username}")
                        )
                        continue

                    phone = payload.get("phone_primary") or "03000000000"
                    desig = (payload.get("designation") or "").strip()
                    role = "GUARD"
                    if "LDC" in desig.upper():
                        role = "RECEPTIONIST"
                    user = User.objects.create_user(
                        username=username,
                        password=password,
                        email=f"{username}@ciis.local",
                        role=role,
                        phone=phone,
                        full_name=full_name,
                        cnic=cnic or "",
                        cell_no=phone,
                        designation=desig,
                        employee_id=employee_id or "",
                        location="PESHAWAR",
                        collectorate="Peshawar (Head Office)",
                        is_active=True,
                    )
                    staff.user = user
                    staff.save(update_fields=["user"])
                    logins += 1

            if dry:
                transaction.set_rollback(True)

        action = "Dry-run" if dry else "Done"
        self.stdout.write(
            self.style.SUCCESS(
                f"{action}: created={created} updated={updated} skipped={skipped} "
                f"logins={logins} linked_existing_logins={linked_existing_logins}"
            )
        )
        if dry:
            self.stdout.write("No database changes were written.")
