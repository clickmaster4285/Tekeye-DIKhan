"""
Write operations for the agent (perform_action).

Each action goes through the same REST endpoint the TekEye UI uses, called in-process as the
officer (force_authenticate), so that endpoint's own validation, numbering, notifications and
permission checks all still apply. This layer adds what the endpoints don't: the agent capability
check, location scoping (targets are found only in the officer's scoped datasets), two-phase
confirmation and the audit trail. No action deletes records or touches users, roles or passwords.
"""

from __future__ import annotations

import difflib
import re
import uuid
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Callable

from django.conf import settings
from django.urls import resolve
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from . import policy
from .records import DATASETS, RecordsError, _clean, build_query, ordered


class ActionError(Exception):
    """Expected failure (bad field, ambiguous target, endpoint refused). Message is shown to the model."""


@dataclass(frozen=True)
class Field:
    type: str = "string"  # string | date | number | goods
    required: bool = False
    enum: tuple[str, ...] = ()
    about: str = ""


@dataclass(frozen=True)
class Action:
    name: str
    about: str
    capability: str
    target: str | None  # dataset the existing record is found in; None = creates a new record
    fields: dict[str, Field]
    execute: Callable  # (user, target_pk | None, values) -> dict
    resolve_values: Callable | None = None  # (user, values) -> values, run at prepare time


# ---------------------------------------------------------------- in-process API calls


def _host() -> str:
    hosts = [h for h in settings.ALLOWED_HOSTS if h and "*" not in h and not h.startswith(".")]
    return hosts[0] if hosts else "localhost"


def _error_text(data, status_code: int) -> str:
    if isinstance(data, dict):
        parts = []
        for key, value in data.items():
            msg = "; ".join(str(v) for v in value) if isinstance(value, list) else str(value)
            parts.append(msg if key in ("detail", "error", "non_field_errors") else f"{key}: {msg}")
        text = " | ".join(parts)
    else:
        text = str(data or "")
    return (text or f"TekEye refused the request (HTTP {status_code}).")[:500]


def call_api(user, method: str, path: str, body: dict | None = None) -> dict:
    """Run a TekEye API view as this officer, exactly as the web app would."""
    factory = APIRequestFactory()
    if method == "GET":
        request = factory.get(path, HTTP_HOST=_host())
    else:
        request = getattr(factory, method.lower())(path, body or {}, format="json", HTTP_HOST=_host())
    force_authenticate(request, user=user)
    match = resolve(path)
    response = match.func(request, *match.args, **match.kwargs)
    data = getattr(response, "data", None)
    if response.status_code >= 400:
        raise ActionError(_error_text(data, response.status_code))
    return data if isinstance(data, dict) else {"result": data}


def _who(user) -> str:
    return getattr(user, "full_name", "") or user.username


# ---------------------------------------------------------------- value coercion


def _parse_date(raw: str) -> str:
    text = str(raw).strip().lower()
    today = timezone.localdate()
    named = {"today": today, "aaj": today, "tomorrow": today + timedelta(days=1), "kal": today + timedelta(days=1),
             "yesterday": today - timedelta(days=1)}
    if text in named:
        return named[text].isoformat()
    try:
        return date.fromisoformat(text[:10]).isoformat()
    except ValueError as exc:
        raise ActionError(f"Could not read date '{raw}'. Use YYYY-MM-DD.") from exc


def _goods(raw) -> list[dict]:
    items = raw if isinstance(raw, list) else [p for p in re.split(r"[;\n]", str(raw or "")) if p.strip()]
    lines = []
    for item in items:
        if isinstance(item, dict):
            lines.append(
                {
                    "description": str(item.get("description") or "").strip(),
                    "quantity": str(item.get("quantity") or "").strip(),
                    "unit": str(item.get("unit") or "").strip(),
                    "pctCode": str(item.get("pct_code") or item.get("pctCode") or "").strip(),
                    "assessableValuePkr": str(item.get("value_pkr") or item.get("assessableValuePkr") or "").strip(),
                    "condition": str(item.get("condition") or "").strip(),
                }
            )
        else:
            lines.append({"description": str(item).strip()})
    return [line for line in lines if line.get("description")]


def coerce_values(action: Action, raw: dict) -> dict:
    if not isinstance(raw, dict):
        raise ActionError("fields must be an object of field: value.")
    values: dict = {}
    for key, value in raw.items():
        spec = action.fields.get(key)
        if spec is None:
            close = difflib.get_close_matches(key, list(action.fields), n=1, cutoff=0.75)
            if not close:
                raise ActionError(f"'{key}' is not a field of {action.name}. Fields: {', '.join(action.fields) or 'none'}.")
            key, spec = close[0], action.fields[close[0]]
        if value in (None, "") or value == []:
            continue
        if spec.type == "date":
            value = _parse_date(value)
        elif spec.type == "number":
            try:
                value = float(value) if "." in str(value) else int(value)
            except (TypeError, ValueError) as exc:
                raise ActionError(f"{key} must be a number.") from exc
        elif spec.type == "goods":
            value = _goods(value)
        else:
            value = str(value).strip()[:4000]
            if spec.enum:
                lowered = {e.lower(): e for e in spec.enum}
                hit = lowered.get(value.lower()) or next(
                    iter(lowered[m] for m in difflib.get_close_matches(value.lower(), list(lowered), n=1, cutoff=0.6)),
                    None,
                )
                if hit is None:
                    raise ActionError(f"{key} must be one of: {', '.join(spec.enum)}.")
                value = hit
        values[key] = value
    missing = [k for k, s in action.fields.items() if s.required and k not in values]
    if missing:
        raise ActionError(f"Ask the officer for: {', '.join(missing)}. Required for {action.name}.")
    return values


# ---------------------------------------------------------------- target lookup


def _pk_candidate(model, text: str):
    kind = model._meta.pk.get_internal_type()
    if kind == "UUIDField":
        try:
            return uuid.UUID(text)
        except ValueError:
            return None
    m = re.fullmatch(r"(?:[a-z]{2,4}-?)?(\d+)", text.strip(), re.I)
    return int(m.group(1)) if m else None


def describe(dataset: str, model, pk) -> str:
    ds = DATASETS[dataset]
    row = model.objects.filter(pk=pk).values(*ds.fields).first() or {}
    parts = [f"{k.split('__')[-1].replace('_', ' ')}: {_clean(v)}" for k, v in row.items() if k != "id" and v not in (None, "")]
    return "; ".join(parts[:5]) or str(pk)


def find_target(user, action: Action, text: str):
    """(pk, label) of the one record the officer means, searched only in their own scoped data."""
    text = (text or "").strip()
    if not text:
        raise ActionError(f"Which {action.target.replace('_', ' ')} record? Give a name, number or reference.")
    try:
        rq = build_query(user, {"dataset": action.target})
        pk = _pk_candidate(rq.model, text)
        if pk is not None and rq.qs.filter(pk=pk).exists():
            return pk, describe(rq.name, rq.model, pk)
        rq = build_query(user, {"dataset": action.target, "text": text})
    except RecordsError as exc:
        raise ActionError(str(exc)) from exc
    pks = list(ordered(rq).values_list("pk", flat=True)[:6])
    if not pks:
        raise ActionError(f"No {action.target.replace('_', ' ')} record matches '{text}'.")
    if len(pks) > 1:
        options = " || ".join(f"[{describe(rq.name, rq.model, p)}]" for p in pks[:5])
        raise ActionError(
            f"{len(pks)}{'+' if len(pks) == 6 else ''} records match '{text}': {options}. "
            "Ask the officer which one, then call again with a more specific target (e.g. its number or full name)."
        )
    return pks[0], describe(rq.name, rq.model, pks[0]) + (" (closest spelling match)" if rq.fuzzy else "")


# ---------------------------------------------------------------- incidents


def _incident_update(user, pk, v):
    from .models import Incident

    inc = Incident.objects.get(pk=pk)
    for key in ("status", "severity"):
        if v.get(key):
            setattr(inc, key, v[key])
    if v.get("note"):
        stamp = timezone.localtime().strftime("%Y-%m-%d %H:%M")
        inc.description = f"{inc.description}\n[{stamp} {_who(user)}] {v['note']}".strip()
    inc.save()
    return {"updated": f"INC-{inc.pk}", "status": inc.status, "severity": inc.severity}


# ---------------------------------------------------------------- visitors


_VISITOR_KEYS = ("full_name", "mobile_number", "cnic_number", "visitor_type", "visit_purpose", "department_to_visit",
                 "host_officer_name", "organization_name", "visit_description")


def _visitor_create(user, _pk, v):
    body = {k: v[k] for k in _VISITOR_KEYS if v.get(k)}
    if v.get("visit_date"):
        body["visit_date"] = body["preferred_visit_date"] = v["visit_date"]
    data = call_api(user, "POST", "/api/visitors/create/", body)
    return {
        "created": "visitor",
        "visitor_id": data.get("id"),
        "reference": data.get("visitor_ref_number") or data.get("reference_number") or f"visitor {data.get('id')}",
        "name": data.get("full_name"),
        "approval_status": data.get("approval_status"),
    }


def _visitor_decide(approve: bool):
    def run(user, pk, v):
        if approve:
            body = {"approved_by": _who(user)}
        else:
            body = {"denied_by": _who(user), "rejection_reason": v.get("reason", "")}
        data = call_api(user, "POST", f"/api/visitors/{pk}/{'approve' if approve else 'deny'}/", body)
        return {"visitor": data.get("full_name"), "approval_status": data.get("approval_status")}

    return run


# ---------------------------------------------------------------- leave


def _resolve_leave(user, v):
    from users.models import LeaveType

    try:
        rq = build_query(user, {"dataset": "staff", "text": v["staff"]})
    except RecordsError as exc:
        raise ActionError(str(exc)) from exc
    staff = list(ordered(rq).values("pk", "full_name", "employee_id")[:5])
    exact = [s for s in staff if (s["full_name"] or "").lower() == v["staff"].lower()]
    if len(exact) == 1:
        staff = exact
    if not staff:
        raise ActionError(f"No staff member matches '{v['staff']}'.")
    if len(staff) > 1:
        names = ", ".join(f"{s['full_name']} ({s['employee_id'] or s['pk']})" for s in staff)
        raise ActionError(f"Several staff match '{v['staff']}': {names}. Ask the officer which one.")
    types = {t.name.lower(): t for t in LeaveType.objects.filter(is_active=True)}
    types.update({(t.code or "").lower(): t for t in types.copy().values() if t.code})
    hit = difflib.get_close_matches(v["leave_type"].lower(), list(types), n=1, cutoff=0.5)
    if not hit:
        names = sorted({t.name for t in types.values()})
        raise ActionError(f"Unknown leave type '{v['leave_type']}'. Types: {', '.join(names) or 'none configured'}.")
    frm, to = date.fromisoformat(v["from_date"]), date.fromisoformat(v["to_date"])
    if to < frm:
        raise ActionError("to_date is before from_date.")
    ltype = types[hit[0]]
    return {
        **v,
        "staff": staff[0]["full_name"],
        "leave_type": ltype.name,
        "days": (to - frm).days + 1,
        "staff_id": staff[0]["pk"],
        "leave_type_id": ltype.pk,
    }


def _leave_create(user, _pk, v):
    body = {
        "staff": v["staff_id"],
        "leave_type": v["leave_type_id"],
        "from_date": v["from_date"],
        "to_date": v["to_date"],
        "days": v["days"],
        "reason": v.get("reason", ""),
    }
    data = call_api(user, "POST", "/api/leave-requests/", body)
    return {"created": "leave request", "leave_request_id": data.get("id"), "status": data.get("status", "PENDING")}


def _leave_decide(approve: bool):
    def run(user, pk, v):
        body = {} if approve else {"rejection_reason": v.get("reason", "")}
        data = call_api(user, "POST", f"/api/leave-requests/{pk}/{'approve' if approve else 'reject'}/", body)
        return {"leave_request_id": pk, "status": data.get("status")}

    return run


# ---------------------------------------------------------------- detention memos

_MEMO_FIELDS = {
    "case_no": "caseNo",
    "reference_number": "referenceNumber",
    "fir_number": "firNumber",
    "date_time_occurrence": "dateTimeOccurrence",
    "place_of_occurrence": "placeOfOccurrence",
    "date_time_detention": "dateTimeDetention",
    "place_of_detention": "placeOfDetention",
    "detention_type": "detentionType",
    "directorate": "directorate",
    "reason_for_detention": "reasonForDetention",
    "location_of_detention": "locationOfDetention",
    "gd_number": "gdNumber",
    "where_deposited": "whereDeposited",
    "receipt_officer": "receiptOfficer",
    "settlement_status": "settlementStatus",
    "verification_status": "verificationStatus",
    "brief_facts": "briefFacts",
    "purpose_of_detention": "purposeOfDetention",
    "forwarding_officer_remarks": "forwardingOfficerRemarks",
    "seizing_officer_notes": "seizingOfficerNotes",
    "examining_officer_notes": "examiningOfficerNotes",
    "detention_notes": "detentionNotes",
}
_PERSON_FIELDS = {"owner_name": ("owner", "name"), "owner_cnic": ("owner", "cnic"), "owner_contact": ("owner", "contact"),
                  "driver_name": ("driver", "name"), "driver_cnic": ("driver", "cnic"),
                  "driver_contact": ("driver", "contact")}


def _apply_memo(body: dict, v: dict) -> dict:
    for key, camel in _MEMO_FIELDS.items():
        if key in v:
            body[camel] = v[key]
    for key, (who, attr) in _PERSON_FIELDS.items():
        if key in v:
            body[who] = {**(body.get(who) or {}), attr: v[key]}
    return body


def _memo_create(user, _pk, v):
    body = _apply_memo({"createdBy": _who(user)}, v)
    if v.get("goods"):
        body["goodsItems"] = v["goods"]
    body["clientOrigin"] = getattr(settings, "FRONTEND_ORIGIN", "") or ""
    data = call_api(user, "POST", "/api/detention-memos/create/", body)
    return {"created": "detention memo", "memo_id": data.get("id"), "case_no": data.get("caseNo")}


def _memo_update(user, pk, v):
    # The update endpoint replaces the whole memo: read it, change only the requested fields, write it back.
    current = call_api(user, "GET", f"/api/detention-memos/{pk}/read/")
    body = _apply_memo(dict(current), v)
    if v.get("goods"):
        body["goodsItems"] = [*(current.get("goodsItems") or []), *v["goods"]]
    data = call_api(user, "PUT", f"/api/detention-memos/{pk}/update/", body)
    return {"updated": "detention memo", "case_no": data.get("caseNo"), "changed": sorted(v)}


# ---------------------------------------------------------------- note sheets / assessments / recovery

_NOTE_FIELDS = {
    "subject": "subject",
    "case_no": "caseNo",
    "office": "office",
    "priority": "priority",
    "accused_name": "accusedName",
    "accused_father_name": "accusedFatherName",
    "accused_cnic": "accusedCnic",
    "accused_mobile": "accusedMobile",
    "accused_address": "accusedAddress",
    "business_name": "businessName",
    "ntn_strn": "ntnStrn",
    "place_of_inspection": "placeOfInspection",
    "inspection_date": "inspectionDate",
    "grounds_of_suspicion": "groundsOfSuspicion",
    "preliminary_findings": "preliminaryFindings",
    "recommendation": "recommendation",
    "content": "content",
}


def _note_body(v: dict) -> dict:
    return {camel: v[key] for key, camel in _NOTE_FIELDS.items() if key in v}


def _note_create(user, _pk, v):
    body = {
        **_note_body(v),
        "preparedBy": _who(user),
        "designation": getattr(user, "designation", "") or "",
        "status": "Draft",
    }
    data = call_api(user, "POST", "/api/seizure-management/note-sheets/create/", body)
    return {"created": "note sheet", "note_sheet_no": data.get("noteSheetNo"), "status": data.get("status")}


def _note_update(user, pk, v):
    data = call_api(user, "PUT", f"/api/seizure-management/note-sheets/{pk}/update/", _note_body(v))
    return {"updated": "note sheet", "note_sheet_no": data.get("noteSheetNo"), "changed": sorted(v)}


def _approval(kind: str, decision: str):
    def run(user, pk, v):
        body = {"action": decision, "approvedBy": _who(user)}
        if decision == "reject":
            body["rejectionReason"] = v.get("reason", "")
        elif v.get("remarks"):
            body["approvalRemarks"] = v["remarks"]
        data = call_api(user, "POST", f"/api/seizure-management/{kind}/{pk}/approval/", body)
        return {"record": str(pk), "decision": decision, "status": data.get("status") or data.get("approvalStatus")}

    return run


# ---------------------------------------------------------------- alerts


def _post(path_template: str, body_fn=None):
    def run(user, pk, v):
        data = call_api(user, "POST", path_template.format(pk=pk), body_fn(user, v) if body_fn else {})
        keep = ("acknowledged", "resolved", "status", "acknowledged_by")
        return {"done": True, **{k: data[k] for k in keep if k in data}}

    return run


# ---------------------------------------------------------------- registry

_REASON = Field(about="why (spoken to the requester)")
_NOTE_SPEC = {
    "subject": Field(required=True),
    "case_no": Field(),
    "office": Field(),
    "priority": Field(enum=("Normal", "Urgent")),
    "accused_name": Field(),
    "accused_father_name": Field(),
    "accused_cnic": Field(),
    "accused_mobile": Field(),
    "accused_address": Field(),
    "business_name": Field(),
    "ntn_strn": Field(),
    "place_of_inspection": Field(),
    "inspection_date": Field(type="date"),
    "grounds_of_suspicion": Field(),
    "preliminary_findings": Field(),
    "recommendation": Field(enum=("No Action", "Warning", "Further Investigation", "Issue Detention Memo", "Release Goods")),
    "content": Field(about="free-text body"),
}
_MEMO_SPEC = {
    **{k: Field() for k in _MEMO_FIELDS},
    **{k: Field() for k in _PERSON_FIELDS},
    "goods": Field(type="goods", about="list of {description, quantity, unit, pct_code, value_pkr}"),
}

ACTIONS: dict[str, Action] = {
    a.name: a
    for a in [
        Action("incident.update", "Change an incident's status/severity or add a note.", "incidents.create",
               "incident_register",
               {"status": Field(enum=("open", "investigating", "closed")),
                "severity": Field(enum=("low", "medium", "high", "critical")), "note": Field()},
               _incident_update),
        Action("visitor.register", "Register (pre-register) a visitor.", "visitors.write", None,
               {"full_name": Field(required=True), "mobile_number": Field(required=True), "cnic_number": Field(),
                "visitor_type": Field(enum=("general", "employee", "vip", "contractor")),
                "visit_purpose": Field(enum=("meeting", "interview", "delivery", "maintenance", "consultation", "other")),
                "department_to_visit": Field(enum=("hr", "it", "finance", "operations", "marketing", "admin",
                                                   "enforcement", "appraisement")),
                "host_officer_name": Field(), "organization_name": Field(), "visit_date": Field(type="date"),
                "visit_description": Field()},
               _visitor_create),
        Action("visitor.approve", "Approve a visitor's registration.", "visitors.write", "visitors", {},
               _visitor_decide(True)),
        Action("visitor.deny", "Deny a visitor (revokes their pass).", "visitors.write", "visitors",
               {"reason": _REASON}, _visitor_decide(False)),
        Action("visitor_alert.acknowledge", "Acknowledge a visitor security alert.", "alerts.write",
               "visitor_security_alerts", {},
               _post("/api/security/alerts/{pk}/acknowledge/", lambda u, v: {"acknowledged_by": _who(u)})),
        Action("leave.request", "File a leave request for a staff member.", "leave.write", None,
               {"staff": Field(required=True, about="staff name or employee id"),
                "leave_type": Field(required=True, about="e.g. casual, sick, earned"),
                "from_date": Field(type="date", required=True), "to_date": Field(type="date", required=True),
                "reason": Field()},
               _leave_create, resolve_values=_resolve_leave),
        Action("leave.approve", "Approve a pending leave request.", "leave.write", "leave_requests", {},
               _leave_decide(True)),
        Action("leave.reject", "Reject a pending leave request.", "leave.write", "leave_requests",
               {"reason": _REASON}, _leave_decide(False)),
        Action("detention_memo.create", "Create a detention memo (case) with optional goods lines.", "cases.write",
               None, {**_MEMO_SPEC, "case_no": Field(required=True)}, _memo_create),
        Action("detention_memo.update", "Change fields of an existing detention memo (statuses, remarks, facts, add goods).",
               "cases.write", "detention_memos", _MEMO_SPEC, _memo_update),
        Action("note_sheet.create", "Create a seizure note sheet (saved as Draft).", "cases.write", None, _NOTE_SPEC,
               _note_create),
        Action("note_sheet.update", "Change fields of a note sheet.", "cases.write", "note_sheets",
               {**_NOTE_SPEC, "subject": Field()}, _note_update),
        Action("note_sheet.submit", "Submit a draft/rejected note sheet for approval.", "cases.write", "note_sheets",
               {}, _approval("note-sheets", "submit")),
        Action("note_sheet.approve", "Approve a submitted note sheet.", "cases.write", "note_sheets",
               {"remarks": Field()}, _approval("note-sheets", "approve")),
        Action("note_sheet.reject", "Reject a submitted note sheet.", "cases.write", "note_sheets",
               {"reason": _REASON}, _approval("note-sheets", "reject")),
        Action("assessment.approve", "Approve a detention assessment.", "cases.write", "detention_assessments",
               {"remarks": Field()}, _approval("assessments", "approve")),
        Action("assessment.reject", "Reject a detention assessment.", "cases.write", "detention_assessments",
               {"reason": _REASON}, _approval("assessments", "reject")),
        Action("recovery_memo.approve", "Approve a recovery memo.", "cases.write", "recovery_memos",
               {"remarks": Field()}, _approval("recovery-memos", "approve")),
        Action("recovery_memo.reject", "Reject a recovery memo.", "cases.write", "recovery_memos",
               {"reason": _REASON}, _approval("recovery-memos", "reject")),
        Action("camera_health_alert.resolve", "Mark a camera health alert resolved.", "alerts.write",
               "camera_health_alerts", {}, _post("/api/camera-health/alerts/{pk}/resolve/")),
        Action("infra_alert.acknowledge", "Acknowledge an infrastructure alert.", "alerts.write", "infra_alerts", {},
               _post("/api/infra/alerts/{pk}/acknowledge/")),
        Action("infra_alert.resolve", "Resolve an infrastructure alert.", "alerts.write", "infra_alerts", {},
               _post("/api/infra/alerts/{pk}/resolve/")),
        Action("destruction_alert.acknowledge", "Acknowledge a goods-destruction alert.", "alerts.write",
               "destruction_alerts", {}, _post("/api/warehouse/destruction-alerts/{pk}/acknowledge/")),
    ]
}


def actions_for_user(user) -> list[Action]:
    return [a for a in ACTIONS.values() if policy.has_capability(user, a.capability)]


def action_catalog(actions: list[Action]) -> str:
    lines = []
    for a in actions:
        fields = ", ".join(
            f"{k}{'*' if s.required else ''}" + (f"[{'/'.join(s.enum)}]" if s.enum else "")
            for k, s in a.fields.items()
        )
        target = f" target: a {a.target.replace('_', ' ')} (name/number)." if a.target else ""
        lines.append(f"- {a.name}: {a.about}{target}" + (f" fields: {fields}" if fields else ""))
    return "\n".join(lines)


def prepare(user, name: str, target_text: str, raw_fields: dict) -> dict:
    """Validate and resolve an action without writing anything. Returns the pending-action params."""
    action = ACTIONS.get(name)
    if action is None:
        close = difflib.get_close_matches(name, list(ACTIONS), n=1, cutoff=0.6)
        if not close:
            raise ActionError(f"Unknown action '{name}'.")
        action = ACTIONS[close[0]]
    if not policy.has_capability(user, action.capability):
        raise ActionError(f"This officer is not authorised to {action.about.lower().rstrip('.')}")
    values = coerce_values(action, raw_fields or {})
    if action.resolve_values:
        values = action.resolve_values(user, values)
    pk, label = (None, "")
    if action.target:
        pk, label = find_target(user, action, target_text)
        if not values and action.fields and not any(s.required for s in action.fields.values()) \
                and action.name.endswith(".update"):
            raise ActionError("Say what to change.")
    shown = {k: (f"{len(v)} goods line(s)" if isinstance(v, list) else v) for k, v in values.items() if not k.endswith("_id")}
    summary = action.about.rstrip(".")
    if label:
        summary += f" — {label}"
    if shown:
        summary += " — " + ", ".join(f"{k.replace('_', ' ')}: {v}" for k, v in shown.items())
    return {"action": action.name, "target_pk": str(pk) if pk is not None else None, "values": values,
            "summary": summary}


def execute(user, params: dict) -> dict:
    action = ACTIONS.get(params.get("action") or "")
    if action is None:
        raise ActionError("Unknown action.")
    if not policy.has_capability(user, action.capability):
        raise ActionError("You are not authorised for this action.")
    pk = params.get("target_pk")
    if action.target:
        # Re-verify the target is still inside this officer's scope at execution time.
        rq = build_query(user, {"dataset": action.target})
        pk_value = _pk_candidate(rq.model, pk) if pk else None
        if pk_value is None or not rq.qs.filter(pk=pk_value).exists():
            raise ActionError("That record is no longer available to you.")
        pk = pk_value
    return action.execute(user, pk, params.get("values") or {})


# Verb / noun cues → likely action, added to each turn so small local models pick perform_action reliably.
_VERBS = {
    "approve": r"\b(approve|approval|sanction|manzoor)",
    "reject": r"\b(reject|decline|refuse|na ?manzoor)",
    "deny": r"\b(deny|denied|refuse|block)",
    "submit": r"\b(submit|send for approval|forward)",
    "acknowledge": r"\b(acknowledge|ack\b|seen|noted)",
    "resolve": r"\b(resolve|resolved|fix(ed)?|close|clear)",
    "create": r"\b(create|new|make|add|register|file|open|draft|prepare|banao)",
    "register": r"\b(register|pre-?register|add|new)",
    "request": r"\b(apply|request|file|put in|add|new)",
    "update": r"\b(update|change|set|edit|mark|modify|correct|add (a )?note)",
}
_NOUNS = {
    "incident": r"\bincident|\binc-?\d",
    "visitor": r"\bvisitor|guest",
    "visitor_alert": r"\bvisitor.*alert|security alert",
    "leave": r"\bleave|chutti|چھٹی",
    "detention_memo": r"\bdetention|\bmemo\b|\bcase\b",
    "note_sheet": r"note ?sheet|\bns-",
    "assessment": r"assessment",
    "recovery_memo": r"recovery",
    "camera_health_alert": r"camera (health )?alert|health alert",
    "infra_alert": r"infra|server alert|device alert|ups alert|switch alert",
    "destruction_alert": r"destruction",
}


_QUESTION = re.compile(
    r"^(how|what|which|who|whom|when|where|why|is|are|was|were|do|does|did|has|have|show|list|find|search|give|tell|"
    r"count|kitne|kitni|kya|kaun|kab|kahan|report|generate|summar)\b|\?\s*$"
)


def action_hints(utterance: str, allowed: list[Action]) -> list[str]:
    text = re.sub(r"^(please|officer|hello customs|can you|could you|kindly)[\s,]+", "", (utterance or "").lower().strip())
    if _QUESTION.search(text):
        return []
    nouns = [n for n, pattern in _NOUNS.items() if re.search(pattern, text)]
    verbs = [v for v, pattern in _VERBS.items() if re.search(pattern, text)]
    if not nouns or not verbs:
        return []
    names = {a.name for a in allowed}
    return [f"{n}.{v}" for n in nouns for v in verbs if f"{n}.{v}" in names][:3]
