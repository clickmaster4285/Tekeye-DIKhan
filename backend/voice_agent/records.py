"""
Generic, allow-listed record search for the voice agent (search_records).

Each dataset declares exactly which fields may be searched, filtered, grouped and returned,
which policy capability it needs, and how it is scoped to the officer's location. Anything
not listed here — passwords, SNMP communities, tokens, salaries, bank details, embeddings,
uploaded files — is unreachable by the model.
"""

from __future__ import annotations

import difflib
import re
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Callable

from django.apps import apps
from django.contrib.postgres.search import TrigramWordSimilarity
from django.db.models import Count, F, Q
from django.db.models.functions import Greatest
from django.utils import timezone

from . import policy

MAX_ROWS = 25
MAX_REPORT_ROWS = 500
MAX_GROUPS = 15
MAX_TEXT = 200
# pg_trgm word_similarity floor for typo-tolerant matching ("mohamad" ~ "muhammad", "peshwar" ~ "peshawar").
FUZZY_MIN_SIMILARITY = 0.45
_TEXT_TYPES = frozenset({"CharField", "TextField", "EmailField", "SlugField", "URLField"})

# Scope builders: user -> Q, or None when the dataset has no location to scope by
# (then location-restricted officers are refused rather than shown other sites' data).
ScopeFn = Callable[[object], "Q | None"]


def _camera_scope(prefix: str) -> ScopeFn:
    return lambda user: policy.camera_scope_q(user, prefix=prefix)


def _location_scope(field_name: str) -> ScopeFn:
    def build(user):
        scope = policy.location_scope(user)
        return Q(**{f"{field_name}__iexact": scope}) if scope else Q()

    return build


def _global_only(user):
    return Q() if not policy.location_scope(user) else None


@dataclass(frozen=True)
class Dataset:
    model: str
    about: str
    capability: str
    fields: tuple[str, ...]  # returned columns (Django lookups, e.g. "camera__name")
    search: tuple[str, ...]  # free-text search columns (may include ones not returned, e.g. CNIC)
    date_field: str
    filters: tuple[str, ...] = ()
    group_by: tuple[str, ...] = ()
    scope: ScopeFn = _global_only
    base: dict = field(default_factory=dict)


DATASETS: dict[str, Dataset] = {
    # ---- incident register (created via create_incident)
    "incident_register": Dataset(
        "voice_agent.Incident",
        "Incidents officers reported in TekEye (INC-n): title, severity, status, location, camera. Not detention cases.",
        "incidents.view",
        ("id", "title", "description", "severity", "status", "location", "camera__name", "created_by__username",
         "created_at"),
        ("title", "description", "location", "camera__name"),
        "created_at",
        ("status", "severity", "location"),
        ("status", "severity", "location", "camera__name"),
        _location_scope("location"),
    ),
    # ---- staff / HR
    "staff": Dataset(
        "users.Staff",
        "Employee directory: name, employee id, personal number, designation, BPS, department, posting, status, contact.",
        "staff.view",
        ("full_name", "employee_id", "personal_number", "designation", "bps", "department", "current_posting",
         "branch_location", "job_status", "employment_type", "phone_primary", "email", "joining_date"),
        ("full_name", "employee_id", "personal_number", "designation", "department", "current_posting",
         "branch_location", "city", "email", "phone_primary", "cnic"),
        "joining_date",
        ("gender", "designation", "department", "job_status", "employment_type", "bps", "current_posting", "city"),
        ("designation", "department", "job_status", "gender", "bps", "current_posting", "employment_type"),
        _location_scope("user__location"),
    ),
    "system_users": Dataset(
        "users.User",
        "TekEye login accounts: username, name, role, designation, location, active, last login.",
        "staff.view",
        ("username", "full_name", "role", "designation", "location", "collectorate", "is_active", "last_login"),
        ("username", "full_name", "role", "designation", "employee_id", "email"),
        "last_login",
        ("role", "location", "designation", "is_active"),
        ("role", "location", "designation", "is_active"),
        _location_scope("location"),
        {"is_deleted": False},
    ),
    "attendance": Dataset(
        "users.Attendance",
        "Daily staff attendance: check-in/check-out times and status.",
        "staff.view",
        ("staff__full_name", "user__username", "date", "check_in", "check_out", "status", "source"),
        ("staff__full_name", "user__username", "user__full_name", "staff__employee_id"),
        "date",
        ("status", "source"),
        ("status", "staff__full_name", "source"),
        _location_scope("user__location"),
    ),
    "leave_requests": Dataset(
        "users.LeaveRequest",
        "Staff leave applications: who, leave type, dates, days, status.",
        "staff.view",
        ("staff__full_name", "leave_type__name", "from_date", "to_date", "days", "status", "reason"),
        ("staff__full_name", "leave_type__name", "reason"),
        "from_date",
        ("status", "leave_type__name"),
        ("status", "leave_type__name", "staff__full_name"),
        _location_scope("staff__user__location"),
    ),
    "user_activity": Dataset(
        "logs.UserActivityLog",
        "Audit log of user actions in TekEye (who did what, when, from where).",
        "audit.view",
        ("user__username", "user__full_name", "action", "source", "ip_address", "city", "device", "browser", "time"),
        ("action", "user__username", "user__full_name", "ip_address", "source"),
        "time",
        ("source", "city", "browser", "os"),
        ("user__username", "source", "city", "browser"),
    ),
    # ---- detention / seizure cases
    "detention_memos": Dataset(
        "detentions.DetentionMemo",
        "Detention memos (cases): case no, FIR, reference, place/date of detention, type, reason, owner, driver, statuses.",
        "cases.view",
        ("case_no", "reference_number", "fir_number", "date_time_detention", "place_of_detention", "detention_type",
         "directorate", "reason_for_detention", "owner_name", "driver_name", "receipt_officer", "settlement_status",
         "verification_status", "disposition_status", "created_at"),
        ("case_no", "reference_number", "fir_number", "place_of_occurrence", "place_of_detention",
         "reason_for_detention", "detention_type", "directorate", "owner_name", "driver_name", "owner_cnic",
         "driver_cnic", "search_chassis_number", "memo_qr_code_number", "brief_facts", "receipt_officer"),
        "created_at",
        ("detention_type", "directorate", "settlement_status", "verification_status", "disposition_status"),
        ("detention_type", "directorate", "place_of_detention", "settlement_status", "verification_status",
         "disposition_status"),
    ),
    "detained_goods": Dataset(
        "detentions.DetentionMemoGoodsLine",
        "Goods lines on detention memos: description, PCT code, quantity, unit, condition, value (PKR), camera where located.",
        "cases.view",
        ("memo__case_no", "description", "pct_code", "quantity", "unit", "condition", "assessable_value_pkr",
         "qr_code_number", "perishable", "located_camera__name", "detected_at"),
        ("description", "pct_code", "qr_code_number", "identification_ref", "memo__case_no", "item_notes"),
        "memo__created_at",
        ("condition", "unit", "perishable", "pct_code"),
        ("condition", "unit", "perishable", "pct_code", "located_camera__name", "memo__case_no"),
    ),
    "note_sheets": Dataset(
        "seizure_management.NoteSheet",
        "Seizure note sheets: number, case, office, priority, status, subject, accused, business, inspection place, approval.",
        "cases.view",
        ("note_sheet_no", "case_no", "date_time", "office", "priority", "status", "subject", "prepared_by",
         "accused_name", "business_name", "place_of_inspection", "recommendation", "approved_by", "created_at"),
        ("note_sheet_no", "case_no", "subject", "accused_name", "accused_cnic", "business_name", "ntn_strn",
         "place_of_inspection", "prepared_by", "reference_number", "office", "detention_memo__case_no"),
        "created_at",
        ("priority", "status", "office", "department"),
        ("priority", "status", "office", "prepared_by", "department"),
    ),
    "seized_items": Dataset(
        "seizure_management.NoteSheetItem",
        "Items on seizure note sheets: product, PCT code, quantity, unit, condition, estimated value.",
        "cases.view",
        ("note_sheet__note_sheet_no", "note_sheet__case_no", "product", "pct_code", "quantity", "unit", "condition",
         "estimated_value", "perishable", "located_camera__name", "created_at"),
        ("product", "pct_code", "qr_code_number", "identification_ref", "remarks", "note_sheet__case_no",
         "note_sheet__note_sheet_no", "note_sheet__detention_memo__case_no"),
        "created_at",
        ("condition", "unit", "perishable", "pct_code"),
        ("condition", "unit", "perishable", "pct_code", "product"),
    ),
    "detention_assessments": Dataset(
        "seizure_management.DetentionAssessment",
        "Assessments of detained goods: case, examining officer, goods condition, findings, status, approval.",
        "cases.view",
        ("detention_memo__case_no", "assessment_date", "examining_officer", "goods_condition", "findings", "status",
         "approved_by", "approved_at", "created_at"),
        ("detention_memo__case_no", "examining_officer", "findings", "valuation_notes", "goods_condition"),
        "created_at",
        ("status", "goods_condition"),
        ("status", "examining_officer", "goods_condition"),
    ),
    "recovery_memos": Dataset(
        "seizure_management.RecoveryMemo",
        "Recovery memos: case, category, recovery officer, goods, quantity, approval status.",
        "cases.view",
        ("detention_memo__case_no", "category", "recovery_date", "recovery_officer", "goods_description", "quantity",
         "approval_status", "approved_by", "created_at"),
        ("detention_memo__case_no", "recovery_officer", "goods_description", "category", "remarks"),
        "created_at",
        ("approval_status", "category"),
        ("approval_status", "category", "recovery_officer"),
    ),
    "seizure_reports": Dataset(
        "seizure_management.SeizureReport",
        "Final seizure reports: case, date, prepared by, summary, status.",
        "cases.view",
        ("detention_memo__case_no", "report_date", "prepared_by", "summary", "status", "created_at"),
        ("detention_memo__case_no", "prepared_by", "summary"),
        "created_at",
        ("status",),
        ("status", "prepared_by"),
    ),
    # ---- warehouse
    "warehouses": Dataset(
        "warehouse.Warehouse",
        "Warehouses / godowns: code, name, location, status.",
        "cases.view",
        ("code", "name", "location_code", "status", "description"),
        ("code", "name", "location_code", "description"),
        "created_at",
        ("status", "location_code"),
        ("status", "location_code"),
        _location_scope("location_code"),
    ),
    "warehouse_stock": Dataset(
        "warehouse.WarehouseStockItem",
        "Stock held in warehouses: case ref, description, PCT code, quantity, unit, godown, status.",
        "cases.view",
        ("case_ref", "description", "pct_code", "quantity", "unit", "godown_warehouse", "status", "created_at"),
        ("case_ref", "description", "pct_code", "qr_code", "godown_warehouse"),
        "created_at",
        ("status", "godown_warehouse", "unit"),
        ("status", "godown_warehouse", "unit", "pct_code"),
    ),
    "destruction_alerts": Dataset(
        "warehouse.DestructionAlert",
        "Alerts raised during goods destruction/distribution (e.g. fire/smoke): case, camera, type, severity, acknowledged.",
        "cases.view",
        ("detention_case_no", "camera__name", "location_code", "alert_type", "severity", "message",
         "detection_class", "acknowledged", "created_at"),
        ("detention_case_no", "message", "alert_type", "detection_class"),
        "created_at",
        ("alert_type", "severity", "acknowledged", "location_code"),
        ("alert_type", "severity", "acknowledged", "camera__name"),
        _location_scope("location_code"),
    ),
    # ---- visitors
    "visitors": Dataset(
        "visitors.Visitor",
        "Visitor registrations: name, type, purpose, department, host officer, visit date, approval status, zone, gate.",
        "people.view",
        ("full_name", "visitor_type", "visit_purpose", "department_to_visit", "host_officer_name", "visit_date",
         "approval_status", "registration_status", "access_zone", "entry_gate", "organization_name", "location",
         "created_at"),
        ("full_name", "cnic_number", "passport_number", "mobile_number", "organization_name", "host_officer_name",
         "reference_number", "visitor_ref_number", "visit_purpose"),
        "created_at",
        ("visitor_type", "approval_status", "registration_status", "department_to_visit", "access_zone", "location"),
        ("visitor_type", "approval_status", "registration_status", "department_to_visit", "host_officer_name",
         "access_zone"),
        _location_scope("location"),
    ),
    "visitor_security_alerts": Dataset(
        "visitors.SecurityAlert",
        "Visitor security alerts (denied access, watchlist, overstay): visitor, type, severity, zone, gate, acknowledged.",
        "people.view",
        ("visitor__full_name", "alert_type", "severity", "message", "zone", "gate", "acknowledged", "created_at"),
        ("visitor__full_name", "message", "alert_type", "zone", "gate"),
        "created_at",
        ("alert_type", "severity", "acknowledged", "zone", "gate"),
        ("alert_type", "severity", "acknowledged", "zone", "gate"),
        _location_scope("visitor__location"),
    ),
    # ---- cameras / surveillance infrastructure
    "detection_events": Dataset(
        "cameras.DetectionEvent",
        "AI detection events for reports and history (person, car, weapon, fire, face…): camera, class, identified staff, confidence, alert.",
        "detections.view",
        ("id", "camera__name", "class_name", "label", "employee_name", "personal_number", "confidence", "is_alert",
         "created_at"),
        ("camera__name", "class_name", "label", "employee_name", "personal_number"),
        "created_at",
        ("class_name", "is_alert", "camera__name"),
        ("class_name", "camera__name", "is_alert", "employee_name"),
        _camera_scope("camera__"),
    ),
    "camera_health_alerts": Dataset(
        "camera_health.CameraHealthAlert",
        "Camera image/stream health problems (blur, dark, frozen, offline): camera, type, severity, recommendation, resolved.",
        "cameras.view",
        ("camera__name", "alert_type", "severity", "message", "recommendation", "first_detected", "last_detected",
         "resolved"),
        ("camera__name", "alert_type", "message", "recommendation"),
        "last_detected",
        ("alert_type", "severity", "resolved"),
        ("alert_type", "severity", "resolved", "camera__name"),
        _camera_scope("camera__"),
    ),
    "tracked_objects": Dataset(
        "object_tracking.GlobalObject",
        "Objects tracked across cameras (bags, vehicles, boxes…): code, class, label, first/last seen, latest camera.",
        "detections.view",
        ("code", "object_type", "class_name", "label", "first_seen_at", "last_seen_at", "entry_at", "exit_at",
         "latest_camera__name"),
        ("code", "class_name", "label", "object_type", "latest_camera__name"),
        "last_seen_at",
        ("object_type", "class_name"),
        ("object_type", "class_name", "latest_camera__name"),
        _camera_scope("latest_camera__"),
    ),
    "object_visits": Dataset(
        "object_tracking.ObjectVisit",
        "Each time a tracked object entered/left a camera view: object code/class, camera, entry, exit, duration.",
        "detections.view",
        ("global_object__code", "global_object__class_name", "camera__name", "status", "entry_at", "exit_at",
         "duration_seconds"),
        ("global_object__code", "global_object__class_name", "global_object__label", "camera__name"),
        "entry_at",
        ("status", "global_object__class_name"),
        ("camera__name", "global_object__class_name", "status"),
        _camera_scope("camera__"),
    ),
    "sites_and_nvrs": Dataset(
        "cameras.Nvr",
        "Recorders (NVRs) and the sites they belong to: NVR name, site, IP, brand, active.",
        "cameras.view",
        ("name", "site__name", "site__code", "ip_address", "brand", "is_active"),
        ("name", "site__name", "site__code", "ip_address", "brand"),
        "created_at",
        ("brand", "is_active", "site__code"),
        ("site__name", "brand", "is_active"),
        _location_scope("site__code"),
    ),
    "infra_devices": Dataset(
        "infrastructure_monitoring.InfraDevice",
        "Monitored IT/power infrastructure (servers, switches, UPS, NVRs, generators): type, name, make/model, IP, location, status, last error.",
        "infra.view",
        ("site__name", "device_type", "name", "manufacturer", "model_number", "ip_address", "install_location",
         "network_role", "status", "last_seen_at", "last_error"),
        ("name", "device_type", "manufacturer", "model_number", "ip_address", "install_location", "serial_number",
         "asset_tag"),
        "last_seen_at",
        ("device_type", "status", "manufacturer", "is_active"),
        ("device_type", "status", "manufacturer", "install_location"),
    ),
    "infra_alerts": Dataset(
        "infrastructure_monitoring.InfraAlert",
        "Infrastructure alerts (device down, high temperature, low battery…): device, type, severity, acknowledged, resolved.",
        "infra.view",
        ("device__name", "device__device_type", "alert_type", "severity", "title", "message", "metric_key",
         "metric_value", "acknowledged", "resolved", "first_detected", "last_detected"),
        ("device__name", "title", "message", "alert_type", "metric_key"),
        "last_detected",
        ("alert_type", "severity", "acknowledged", "resolved"),
        ("alert_type", "severity", "device__name", "resolved"),
    ),
    "infra_events": Dataset(
        "infrastructure_monitoring.InfraEvent",
        "Infrastructure event history (status changes, polls, reboots): device, type, title, message, time.",
        "infra.view",
        ("device__name", "event_type", "title", "message", "actor", "created_at"),
        ("device__name", "title", "message", "event_type", "actor"),
        "created_at",
        ("event_type",),
        ("event_type", "device__name"),
    ),
    "server_logs": Dataset(
        "infrastructure_monitoring.InfraServerLog",
        "Server/Windows event logs collected from infrastructure: device, time, category, level, source, user, message.",
        "infra.view",
        ("device__name", "log_time", "category", "level", "source", "user", "remote_host", "event_id", "message"),
        ("message", "source", "user", "remote_host", "event_id", "device__name"),
        "log_time",
        ("category", "level", "source"),
        ("category", "level", "source", "device__name", "user"),
    ),
}


def dataset_catalog() -> str:
    return "\n".join(f"- {name}: {ds.about}" for name, ds in DATASETS.items())


# Keyword → dataset hints added to each turn; small local models pick datasets far more reliably with them.
_HINTS: tuple[tuple[str, tuple[str, ...]], ...] = (
    (r"incident|\binc-?\d|واقعہ", ("incident_register",)),
    (r"detention|detain|memo|\bcase|\bfir\b|seizure|seized|confiscat|ڈیٹینشن|کیس|ضبط|مقدمہ", ("detention_memos",)),
    (r"goods|\bitems?\b|product|\btea\b|cloth|quantity|\bpct\b|مال|سامان", ("detained_goods", "seized_items")),
    (r"note ?sheet|accused|inspection|نوٹ شیٹ|ملزم", ("note_sheets",)),
    (r"assess|examin|valuation|جائزہ", ("detention_assessments",)),
    (r"recovery|recovered", ("recovery_memos",)),
    (r"report", ("seizure_reports",)),
    (r"warehouse|godown|stock|گودام", ("warehouse_stock", "warehouses")),
    (r"destruction|destroy|burn", ("destruction_alerts",)),
    (r"staff|employee|sepoy|officer'?s? (phone|number|email|designation)|designation|\bbps\b|posting|department|"
     r"phone|mobile|email|contact|ملازم|عملہ|سپاہی|فون|نمبر", ("staff",)),
    (r"\buser|account|login|role", ("system_users",)),
    (r"attendance|check.?in|check.?out|present|absent|late|حاضری", ("attendance",)),
    (r"leave|چھٹی", ("leave_requests",)),
    (r"activity|audit|who (did|changed|deleted|created)|log ?in history", ("user_activity",)),
    (r"visitor|guest|ملاقاتی|مہمان", ("visitors", "visitor_security_alerts")),
    (r"camera health|health|blur|dark|frozen|freeze|not working|image quality|خراب", ("camera_health_alerts",)),
    (r"detection|detected|weapon|\bfire\b|smoke|\bgun\b", ("detection_events",)),
    (r"tracked object|object|\bbag|luggage|box|parcel", ("tracked_objects", "object_visits")),
    (r"\bnvr|recorder|\bsite", ("sites_and_nvrs", "infra_devices")),
    (r"server|switch|router|\bups\b|generator|device|infrastructure|network|offline|online|down\b|power|سرور",
     ("infra_devices", "infra_alerts", "infra_events")),
    (r"server log|event log|error log|\blogs?\b|boot|crash", ("server_logs",)),
)


def dataset_hints(utterance: str) -> list[str]:
    text = (utterance or "").lower()
    hits: list[str] = []
    for pattern, names in _HINTS:
        if re.search(pattern, text):
            hits.extend(n for n in names if n not in hits)
    return hits[:5]


# The officer mentioned a time window; otherwise a model-invented last_days/date range is dropped.
_TIME_WORDS = re.compile(
    # "latest" / "last 5 memos" ask for the newest rows, not a date window — only time units count.
    r"\b(today|tonight|yesterday|weeks?|months?|years?|hours?|minutes?|days?|recently|since|ago|"
    r"morning|evening|night|20\d\d|aaj|kal|hafte|hafta|mahine|mahina|saal|ghante|din)\b|آج|کل|ہفت|مہین|سال|گھنٹ|دن"
)


def mentions_time(utterance: str) -> bool:
    return bool(_TIME_WORDS.search((utterance or "").lower()))


def _text_elsewhere(user, text: str, skip: str) -> list[dict]:
    """When a text search finds nothing, report which other permitted datasets do contain it."""
    found = []
    for name in DATASETS:
        if name == skip:
            continue
        try:
            n = search_records(user, {"dataset": name, "text": text, "limit": 0}, fallback=False, allow_fuzzy=False)["total"]
        except RecordsError:
            continue
        if n:
            found.append({"dataset": name, "matches": n})
    return found


class RecordsError(Exception):
    pass


def _clean(value):
    if isinstance(value, datetime):
        return timezone.localtime(value).strftime("%Y-%m-%d %H:%M") if timezone.is_aware(value) else value.strftime("%Y-%m-%d %H:%M")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, (uuid.UUID, Decimal)):
        return str(value)
    if isinstance(value, str):
        value = value.strip()
        return value if len(value) <= MAX_TEXT else value[:MAX_TEXT] + "…"
    return value


def _parse_bool(raw) -> bool | None:
    text = str(raw).strip().lower()
    if text in ("true", "yes", "1", "haan", "han"):
        return True
    if text in ("false", "no", "0", "nahi", "nahin"):
        return False
    return None


def _field_type(model, lookup: str) -> str:
    current = model
    parts = lookup.split("__")
    for part in parts[:-1]:
        current = current._meta.get_field(part).related_model
    return current._meta.get_field(parts[-1]).get_internal_type()


def _to_bound(raw: str, model, date_field: str, end: bool):
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError as exc:
        raise RecordsError(f"Could not parse date '{raw}'. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM.") from exc
    if len(raw) == 10 and end:
        dt = dt + timedelta(days=1) - timedelta(microseconds=1)
    if _field_type(model, date_field) == "DateField":
        return dt.date()
    return timezone.make_aware(dt) if timezone.is_naive(dt) else dt


def _text_words(text) -> list[str]:
    return re.findall(r"[\w\-/.@]+", str(text or ""))


def _exact_text_q(ds: Dataset, words: list[str]) -> Q:
    q = Q()
    for word in words:
        word_q = Q()
        for col in ds.search:
            word_q |= Q(**{f"{col}__icontains": word})
        q &= word_q
    return q


def _fuzzy_text(qs, model, ds: Dataset, words: list[str]):
    """Typo-tolerant match: every word must closely resemble a word in some text column (pg_trgm)."""
    cols = [c for c in ds.search if _field_type(model, c) in _TEXT_TYPES]
    words = [w for w in words if len(w) >= 3]
    if not cols or not words:
        return qs.none()
    score_names = []
    for i, word in enumerate(words):
        sims = [TrigramWordSimilarity(word, col) for col in cols]
        name = f"_fz{i}"
        qs = qs.annotate(**{name: Greatest(*sims) if len(sims) > 1 else sims[0]}).filter(
            **{f"{name}__gte": FUZZY_MIN_SIMILARITY}
        )
        score_names.append(name)
    total = F(score_names[0])
    for name in score_names[1:]:
        total = total + F(name)
    return qs.annotate(_fuzzy_score=total)


def _closest_value(qs, key: str, raw: str) -> str | None:
    """Closest existing value of a filter field, for misspelt/mis-cased filters ('aproved' → 'Approved')."""
    values = [
        str(v) for v in qs.exclude(**{f"{key}__isnull": True}).values_list(key, flat=True).distinct()[:300]
        if str(v or "").strip()
    ]
    lowered = {v.lower(): v for v in values}
    hit = difflib.get_close_matches(raw.lower(), list(lowered), n=1, cutoff=0.6)
    if hit:
        return lowered[hit[0]]
    contains = [v for v in values if raw.lower() in v.lower()]
    return contains[0] if len(contains) == 1 else None


@dataclass
class RecordQuery:
    name: str
    ds: Dataset
    model: type
    qs: object
    fuzzy: bool = False
    notes: list[str] = field(default_factory=list)


def build_query(user, args: dict, *, allow_fuzzy: bool = True) -> RecordQuery:
    """RBAC/location-scoped, filtered queryset for one dataset — shared by search, reports and actions."""
    name = str(args.get("dataset") or "").strip()
    ds = DATASETS.get(name)
    if ds is None:
        close = difflib.get_close_matches(name, list(DATASETS), n=1, cutoff=0.6)
        if not close:
            raise RecordsError(f"Unknown dataset '{name}'. Available: {', '.join(DATASETS)}.")
        name, ds = close[0], DATASETS[close[0]]
    if not policy.has_capability(user, ds.capability):
        raise RecordsError(f"This officer is not authorised to view {name}.")
    scope_q = ds.scope(user)
    if scope_q is None:
        raise RecordsError(f"{name} is only available to officers with all-sites access.")

    model = apps.get_model(ds.model)
    qs = model.objects.filter(scope_q, **ds.base)
    notes: list[str] = []

    filters = args.get("filters") or {}
    if not isinstance(filters, dict):
        raise RecordsError("filters must be an object of field: value.")
    for key, value in filters.items():
        if key not in ds.filters:
            close = difflib.get_close_matches(key, ds.filters, n=1, cutoff=0.7)
            if not close:
                raise RecordsError(f"Cannot filter {name} by '{key}'. Allowed: {', '.join(ds.filters) or 'none'}.")
            key = close[0]
        if _field_type(model, key) == "BooleanField":
            flag = _parse_bool(value)
            if flag is None:
                raise RecordsError(f"'{key}' must be true or false.")
            qs = qs.filter(**{key: flag})
            continue
        raw = str(value).strip()
        if not qs.filter(**{f"{key}__iexact": raw}).exists():
            closest = _closest_value(qs, key, raw)
            if closest is not None and closest.lower() != raw.lower():
                notes.append(f"No {key.replace('__', ' ')} '{raw}'; used the closest value '{closest}'.")
                raw = closest
            elif closest is None:
                existing = sorted({str(v) for v in qs.values_list(key, flat=True).distinct()[:12] if str(v or "").strip()})
                if existing:
                    notes.append(
                        f"No {key.replace('__', ' ')} is '{raw}'. Values that exist: {', '.join(existing)}. "
                        "Tell the officer, and search again with the right value if one fits."
                    )
        qs = qs.filter(**{f"{key}__iexact": raw})

    start = _to_bound(str(args.get("date_from") or ""), model, ds.date_field, end=False)
    end = _to_bound(str(args.get("date_to") or ""), model, ds.date_field, end=True)
    last_days = args.get("last_days")
    if not start and last_days not in (None, "", 0):
        try:
            days = max(1, min(int(last_days), 3650))
        except (TypeError, ValueError) as exc:
            raise RecordsError("last_days must be a number.") from exc
        start = timezone.now() - timedelta(days=days)
        if _field_type(model, ds.date_field) == "DateField":
            start = timezone.localtime(start).date()
    if start:
        qs = qs.filter(**{f"{ds.date_field}__gte": start})
    if end:
        qs = qs.filter(**{f"{ds.date_field}__lte": end})

    words = _text_words(args.get("text"))
    fuzzy = False
    if words:
        exact = qs.filter(_exact_text_q(ds, words))
        if exact.exists() or not allow_fuzzy:
            qs = exact
        else:
            qs = _fuzzy_text(qs, model, ds, words)
            fuzzy = True
    return RecordQuery(name=name, ds=ds, model=model, qs=qs, fuzzy=fuzzy, notes=notes)


def ordered(rq: RecordQuery):
    """Best fuzzy matches first; otherwise newest first."""
    if rq.fuzzy:
        return rq.qs.order_by("-_fuzzy_score", F(rq.ds.date_field).desc(nulls_last=True))
    return rq.qs.order_by(F(rq.ds.date_field).desc(nulls_last=True))


def group_counts(rq: RecordQuery, group: str, max_groups: int = MAX_GROUPS) -> list[dict]:
    if group not in rq.ds.group_by:
        close = difflib.get_close_matches(group, rq.ds.group_by, n=1, cutoff=0.7)
        if not close:
            raise RecordsError(
                f"Cannot group {rq.name} by '{group}'. Allowed: {', '.join(rq.ds.group_by) or 'none'}."
            )
        group = close[0]
    rows = rq.qs.order_by().values(group).annotate(n=Count("pk", distinct=True)).order_by("-n")[:max_groups]
    return [{"value": _clean(r[group]) if r[group] not in (None, "") else "(blank)", "count": r["n"]} for r in rows]


def clean_rows(rq: RecordQuery, limit: int) -> list[dict]:
    rows = ordered(rq).values(*rq.ds.fields)[:limit]
    return [{k: _clean(v) for k, v in r.items() if v not in (None, "")} for r in rows]


def search_records(user, args: dict, *, fallback: bool = True, allow_fuzzy: bool = True) -> dict:
    rq = build_query(user, args, allow_fuzzy=allow_fuzzy)
    name = rq.name
    out: dict = {"dataset": name, "total": rq.qs.count()}
    if rq.fuzzy and out["total"]:
        out["match"] = "fuzzy"
        out["note"] = (
            f"No exact match for '{str(args.get('text')).strip()}'. These are the closest spellings — "
            "say they are close matches, not exact."
        )
    if rq.notes:
        out["interpreted"] = rq.notes
    group = str(args.get("group_by") or "").strip()
    if not group and out["total"] > 1:
        # Small models count sample rows instead of asking for a breakdown; always give the status split.
        group = next((g for g in rq.ds.group_by if g.split("__")[-1].endswith("status")), "")
    if group:
        out["counts"] = group_counts(rq, group)

    try:
        limit = max(0, min(int(args.get("limit", 10)), MAX_ROWS))
    except (TypeError, ValueError):
        limit = 10
    if limit:
        out["rows"] = clean_rows(rq, limit)
        out["truncated"] = out["total"] > limit
    text = str(args.get("text") or "").strip()
    if fallback and text and (not out["total"] or rq.fuzzy):
        elsewhere = _text_elsewhere(user, text, skip=name)
        if elsewhere:
            out["found_in_other_datasets"] = elsewhere
            out["note"] = (
                ("Only close spellings here, but " if out["total"] else "Nothing here, but ")
                + "these datasets match exactly — search them with the same text."
            )
    return {"summary": _summary(name, out, group), **out}


def _summary(name: str, out: dict, group: str) -> str:
    """One plain sentence with the real totals, so small models don't confuse rows shown with the count."""
    parts = [f"{out['total']} {name.replace('_', ' ')} record(s) match in total."]
    if out.get("counts"):
        top = ", ".join(f"{c['value']}: {c['count']}" for c in out["counts"][:6])
        parts.append(f"By {group.replace('__', ' ').replace('_', ' ')} — {top}.")
    if out.get("rows") is not None and out.get("truncated"):
        parts.append(f"Only the latest {len(out['rows'])} rows are listed below; use the total above for counts.")
    return " ".join(parts)
