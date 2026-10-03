"""Mark HR attendance when registered staff are recognized (webcam, CCTV, or manual)."""

from __future__ import annotations

import logging
import time
from datetime import datetime, time as dt_time, timedelta
from typing import Literal

from django.conf import settings
from django.db import IntegrityError
from django.db.models import Q
from django.utils import timezone

from users.models import Attendance, Staff, User

logger = logging.getLogger(__name__)

AttendanceAction = Literal[
    "check_in",
    "check_out",
    "already_complete",
    "ignored",
    "skipped_cooldown",
    "skipped_no_staff",
    "skipped_not_enrolled",
]

_GENERIC_LABELS = frozenset({"unknown", "person", "face", ""})
_recent_camera_marks: dict[str, float] = {}


def _work_start() -> dt_time:
    raw = getattr(settings, "ATTENDANCE_WORK_START", "09:00")
    h, m = [int(x) for x in str(raw).split(":")[:2]]
    return dt_time(h, m)


def _work_end():
    raw = getattr(settings, "ATTENDANCE_WORK_END", "17:00")
    h, m = [int(x) for x in str(raw).split(":")[:2]]
    return dt_time(h, m)


def camera_attendance_zone(camera) -> str:
    """entry / exit / interior / mixed. Place names stay mixed so existing cameras keep last-seen checkout."""
    if camera is None:
        return "mixed"
    for raw in (getattr(camera, "passage_role", ""), getattr(camera, "zone", "")):
        token = (raw or "").strip().lower()
        if token in {"mixed", "entry", "exit", "interior"}:
            return token
    return "mixed"


def _late_after() -> dt_time:
    raw = getattr(settings, "ATTENDANCE_LATE_AFTER", "09:30")
    h, m = [int(x) for x in str(raw).split(":")[:2]]
    return dt_time(h, m)


def _min_checkout_after_in() -> timedelta:
    minutes = float(getattr(settings, "ATTENDANCE_MIN_CHECKOUT_AFTER_IN_MINUTES", 1))
    return timedelta(minutes=max(0.0, minutes))


def _camera_mark_cooldown() -> int:
    return max(30, int(getattr(settings, "ATTENDANCE_CAMERA_MARK_COOLDOWN_SECONDS", 120)))


def _min_checkout_seconds() -> int:
    hours = float(getattr(settings, "ATTENDANCE_MIN_CHECKOUT_HOURS", 4))
    return max(0, int(hours * 3600))


def _cooldown_key(*, user: User | None = None, staff: Staff | None = None) -> str | None:
    if user is not None:
        return f"user:{user.pk}"
    if staff is not None:
        return f"staff:{staff.pk}"
    return None


def _is_recognized_identity(identity: str) -> bool:
    lbl = (identity or "").strip()
    if not lbl:
        return False
    low = lbl.lower()
    if low in _GENERIC_LABELS or low.startswith("unknown"):
        return False
    if low.startswith(("gp", "go", "gv")) and low[2:].isdigit():
        return False
    if low.startswith("t") and low[1:].isdigit():
        return False
    return True


def resolve_staff_for_face_identity(identity: str) -> Staff | None:
    """Map identity label to a Staff row (full name, face label, or linked username)."""
    lbl = (identity or "").strip()
    if not _is_recognized_identity(lbl):
        return None

    return (
        Staff.objects.filter(
            Q(face_identity_label__iexact=lbl)
            | Q(full_name__iexact=lbl)
            | Q(user__username__iexact=lbl)
            | Q(employee_id__iexact=lbl)
        )
        .select_related("user")
        .first()
    )


def resolve_user_for_face_identity(identity: str) -> User | None:
    staff = resolve_staff_for_face_identity(identity)
    if staff and staff.user_id:
        linked = staff.user
        if linked and not linked.is_deleted:
            return linked

    lbl = (identity or "").strip()
    if not _is_recognized_identity(lbl):
        return None
    return User.objects.filter(username__iexact=lbl, is_deleted=False).first()


def staff_is_enrolled_for_attendance(staff: Staff | None) -> bool:
    """True when InsightFace enrollment is trained (preferred) or legacy photos exist."""
    if staff is None:
        return False
    try:
        enrollment = getattr(staff, "face_enrollment", None)
        if enrollment is not None and enrollment.is_trained and enrollment.embedding:
            return True
    except Exception:
        pass
    # Legacy fallback during migration — prefer InsightFace going forward
    from ml.face_sync import staff_has_face_embedding
    from users.staff_photos import staff_photo_paths

    if staff_has_face_embedding(staff):
        return True
    return bool(staff_photo_paths(staff))


def _touch_camera_cooldown(key: str) -> None:
    _recent_camera_marks[key] = time.monotonic()


def _camera_cooldown_active(key: str) -> bool:
    last = _recent_camera_marks.get(key, 0.0)
    return time.monotonic() - last < _camera_mark_cooldown()


class AttendanceDecisionEngine:
    """
    First recognition of the day → check-in (present/late).
    Later recognition → update check-out (last seen).
    Ignore detections within MIN_CHECKOUT_AFTER_IN of check-in.
    """

    @classmethod
    def is_on_time(cls, check_in_time: datetime, staff: Staff | None = None) -> bool:
        local_time = timezone.localtime(check_in_time).time()
        deadline = _late_after()
        shift_start = getattr(staff, "work_shift_start", None) if staff is not None else None
        if shift_start is not None:
            grace = datetime.combine(check_in_time.date(), _late_after()) - datetime.combine(
                check_in_time.date(), _work_start()
            )
            deadline_dt = datetime.combine(check_in_time.date(), shift_start) + grace
            deadline = deadline_dt.time()
        return local_time <= deadline

    @classmethod
    def determine_status(cls, check_in_time: datetime, staff: Staff | None = None) -> str:
        if cls.is_on_time(check_in_time, staff):
            return Attendance.STATUS_PRESENT
        return Attendance.STATUS_LATE

    @classmethod
    def apply_checkout_rules(cls, record: Attendance, staff: Staff | None, now: datetime, *, zone: str = "mixed") -> None:
        if not record.check_in or not record.check_out:
            return
        hours = (record.check_out - record.check_in).total_seconds() / 3600.0
        shift_end = getattr(staff, "work_shift_end", None) if staff is not None else None
        end = shift_end or _work_end()
        local_out = timezone.localtime(record.check_out).time()
        notes: list[str] = []
        if zone == "exit" and hours < 4:
            record.status = Attendance.STATUS_HALF_DAY
            notes.append("Half day")
        elif zone == "exit" and local_out < end:
            notes.append("Early leave")
        if local_out > end:
            notes.append("Overtime")
        if notes:
            record.notes = "; ".join(notes)

    @classmethod
    def _get_or_create_today(cls, staff: Staff, source: str, now: datetime) -> Attendance:
        today = timezone.localdate(now)
        try:
            if staff.user_id and staff.user and not staff.user.is_deleted:
                record, _ = Attendance.objects.get_or_create(
                    user=staff.user,
                    date=today,
                    defaults={"staff": staff, "source": source},
                )
                if record.staff_id is None:
                    record.staff = staff
                    record.save(update_fields=["staff", "updated_at"])
                return record

            record, _ = Attendance.objects.get_or_create(
                staff=staff,
                date=today,
                defaults={"source": source},
            )
            return record
        except IntegrityError:
            if staff.user_id:
                return Attendance.objects.get(user=staff.user, date=today)
            return Attendance.objects.get(staff=staff, date=today)

    @classmethod
    def process_recognition(
        cls,
        staff: Staff,
        confidence: float = 0.0,
        source: str = Attendance.SOURCE_CCTV,
        now: datetime | None = None,
        *,
        allow_checkout: bool = True,
        enforce_camera_cooldown: bool = False,
        enforce_min_checkout_hours: bool = False,
        camera_zone: str = "mixed",
    ) -> dict:
        now = now or timezone.now()
        zone = (camera_zone or "mixed").strip().lower()
        if zone not in {"mixed", "entry", "exit", "interior"}:
            zone = "mixed"
        key = _cooldown_key(staff=staff) if not (staff.user_id) else _cooldown_key(user=staff.user)

        camera_like = source in (
            Attendance.SOURCE_CCTV,
            Attendance.SOURCE_CAMERA,
            "camera",
        )
        if enforce_camera_cooldown and camera_like and key and _camera_cooldown_active(key):
            return {
                "action": "skipped_cooldown",
                "message": "Camera mark cooldown active",
                "record": None,
            }

        record = cls._get_or_create_today(staff, source, now)

        if record.check_in is None:
            if zone == "exit":
                if record.pk:
                    record.delete()
                return {
                    "action": "ignored",
                    "message": "Exit camera with no check-in",
                    "record": None,
                }
            record.check_in = now
            record.check_in_confidence = confidence
            record.status = cls.determine_status(now, staff)
            record.source = source
            record.save(
                update_fields=[
                    "check_in",
                    "check_in_confidence",
                    "status",
                    "source",
                    "updated_at",
                ]
            )
            if enforce_camera_cooldown and camera_like and key:
                _touch_camera_cooldown(key)
            logger.info("Attendance check-in: %s (%s)", staff.full_name, source)
            return {
                "action": "check_in",
                "message": f"Checked in at {timezone.localtime(now).strftime('%H:%M')}",
                "record": record,
            }

        if not allow_checkout:
            return {
                "action": "already_complete",
                "message": "Already checked in",
                "record": record,
            }

        if now - record.check_in < _min_checkout_after_in():
            return {
                "action": "ignored",
                "message": "Checked in just now — waiting before first check-out update",
                "record": record,
            }

        if zone in {"entry", "interior"}:
            return {
                "action": "ignored",
                "message": "Already checked in — entry/interior camera does not check out",
                "record": record,
            }

        if enforce_min_checkout_hours and camera_like:
            min_checkout = _min_checkout_seconds()
            if min_checkout > 0 and (now - record.check_in).total_seconds() < min_checkout:
                return {
                    "action": "skipped_cooldown",
                    "message": "Minimum hours before camera check-out not reached",
                    "record": record,
                }

        # Continuously update check-out (last seen) for CCTV/webcam
        record.check_out = now
        record.check_out_confidence = confidence
        cls.apply_checkout_rules(record, staff, now, zone=zone)
        record.save(update_fields=["check_out", "check_out_confidence", "status", "notes", "updated_at"])
        if enforce_camera_cooldown and camera_like and key:
            _touch_camera_cooldown(key)
        logger.info("Attendance check-out: %s (%s)", staff.full_name, source)
        return {
            "action": "check_out",
            "message": f"Check-out updated to {timezone.localtime(now).strftime('%H:%M')}",
            "record": record,
        }


def mark_attendance_for_staff(
    staff: Staff,
    *,
    source: str = "manual",
    allow_checkout: bool = True,
    confidence: float = 0.0,
) -> tuple[AttendanceAction, Attendance | None]:
    """Public helper used by kiosk/camera detection paths."""
    enforce_camera = source in ("camera", Attendance.SOURCE_CAMERA, Attendance.SOURCE_CCTV)
    decision = AttendanceDecisionEngine.process_recognition(
        staff=staff,
        confidence=confidence,
        source=source,
        allow_checkout=allow_checkout,
        enforce_camera_cooldown=enforce_camera,
        enforce_min_checkout_hours=source in ("camera", Attendance.SOURCE_CAMERA),
    )
    return decision["action"], decision["record"]  # type: ignore[return-value]


def mark_attendance_for_user(
    user: User,
    *,
    source: str = "manual",
    allow_checkout: bool = True,
    confidence: float = 0.0,
) -> tuple[AttendanceAction, Attendance | None]:
    staff = getattr(user, "staff_profile", None)
    if staff is None:
        # Create/update user-keyed attendance without staff
        now = timezone.now()
        today = timezone.localdate()
        key = _cooldown_key(user=user)
        if source == "camera" and key and _camera_cooldown_active(key):
            return "skipped_cooldown", None
        attendance, _ = Attendance.objects.get_or_create(
            user=user, date=today, defaults={"source": source}
        )
        if not attendance.check_in:
            attendance.check_in = now
            attendance.status = AttendanceDecisionEngine.determine_status(now)
            attendance.source = source
            attendance.check_in_confidence = confidence
            attendance.save(
                update_fields=["check_in", "status", "source", "check_in_confidence", "updated_at"]
            )
            if source == "camera" and key:
                _touch_camera_cooldown(key)
            return "check_in", attendance
        if not allow_checkout:
            return "already_complete", attendance
        if now - attendance.check_in < _min_checkout_after_in():
            return "ignored", attendance
        attendance.check_out = now
        attendance.check_out_confidence = confidence
        attendance.save(update_fields=["check_out", "check_out_confidence", "updated_at"])
        if source == "camera" and key:
            _touch_camera_cooldown(key)
        return "check_out", attendance
    return mark_attendance_for_staff(
        staff, source=source, allow_checkout=allow_checkout, confidence=confidence
    )


def _attendance_camera_purposes():
    from cameras.models import CameraPurpose

    purposes = {
        CameraPurpose.ATTENDANCE,
        CameraPurpose.FACE_RECOGNITION,
    }
    if getattr(settings, "ATTENDANCE_MARK_ON_FACE_RECOGNITION_CAMERAS", True):
        purposes.add(CameraPurpose.FACE_RECOGNITION)
    return purposes


def _camera_allows_attendance(camera) -> bool:
    purposes = set(camera.purpose_list()) if hasattr(camera, "purpose_list") else {camera.purpose}
    if purposes & _attendance_camera_purposes():
        return True
    return getattr(settings, "ATTENDANCE_MARK_ON_ALL_CAMERAS", False)


def try_mark_attendance_from_detection(
    camera,
    label: str,
    class_name: str,
    confidence: float,
) -> tuple[AttendanceAction | None, Attendance | None]:
    """Detection labels are not a face match. InsightFace CCTV is the only punch path."""
    del camera, label, class_name, confidence
    return None, None
