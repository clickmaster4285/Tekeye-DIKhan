"""
RBAC / policy for the voice agent.

The LLM is never the security layer: tools are filtered by these rules before they
are offered to the model, and every tool re-checks them when it executes.
"""

from __future__ import annotations

from django.db.models import Q

from users.permissions import (
    GLOBAL_ADMIN_ROLE,
    IT_SUPERADMIN_ROLE,
    LOCATION_ADMIN_ROLE,
    can_view_all_staff,
    get_location_scope,
    has_hr_api_access,
)

# Operational roles that may talk to the agent at all.
VOICE_AGENT_ROLES = frozenset(
    {
        GLOBAL_ADMIN_ROLE,
        IT_SUPERADMIN_ROLE,
        LOCATION_ADMIN_ROLE,
        "OPERATION_MANAGER",
        "COLLECTOR",
        "DEPUTY_COLLECTOR",
        "ASSISTANT_COLLECTOR",
        "INSPECTOR",
        "DETECTION_OFFICER",
        "INVESTIGATION_OFFICER",
        "IT_ADMIN",
    }
)

SURVEILLANCE_ROLES = VOICE_AGENT_ROLES

INCIDENT_WRITE_ROLES = frozenset(
    {
        GLOBAL_ADMIN_ROLE,
        LOCATION_ADMIN_ROLE,
        "OPERATION_MANAGER",
        "COLLECTOR",
        "DEPUTY_COLLECTOR",
        "ASSISTANT_COLLECTOR",
        "INSPECTOR",
        "DETECTION_OFFICER",
        "INVESTIGATION_OFFICER",
    }
)


# Detention / seizure / warehouse case records: the operational officers who handle cases.
CASE_ROLES = INCIDENT_WRITE_ROLES

# System audit trail (who did what in TekEye).
AUDIT_ROLES = frozenset({GLOBAL_ADMIN_ROLE, IT_SUPERADMIN_ROLE})


def _role(user) -> str:
    return getattr(user, "role", None) or ""


def _authenticated(user) -> bool:
    return bool(user and getattr(user, "is_authenticated", False) and getattr(user, "is_active", False))


def can_use_voice_agent(user) -> bool:
    return _authenticated(user) and _role(user) in VOICE_AGENT_ROLES


CAPABILITY_CHECKS = {
    "cameras.view": lambda u: _role(u) in SURVEILLANCE_ROLES,
    "detections.view": lambda u: _role(u) in SURVEILLANCE_ROLES,
    "vehicles.view": lambda u: _role(u) in SURVEILLANCE_ROLES,
    "people.view": lambda u: _role(u) in SURVEILLANCE_ROLES,
    "gps.view": lambda u: can_view_all_staff(u),
    "incidents.view": lambda u: _role(u) in SURVEILLANCE_ROLES,
    "incidents.create": lambda u: _role(u) in INCIDENT_WRITE_ROLES,
    "ui.control": lambda u: True,
    # search_records datasets
    "records.view": lambda u: _role(u) in VOICE_AGENT_ROLES,
    "staff.view": lambda u: can_view_all_staff(u),
    "cases.view": lambda u: _role(u) in CASE_ROLES,
    "infra.view": lambda u: _role(u) in SURVEILLANCE_ROLES,
    "audit.view": lambda u: _role(u) in AUDIT_ROLES,
    # perform_action writes (each still needs the officer's explicit yes)
    "visitors.write": lambda u: _role(u) in INCIDENT_WRITE_ROLES,
    "leave.write": lambda u: has_hr_api_access(u),
    "cases.write": lambda u: _role(u) in CASE_ROLES,
    "alerts.write": lambda u: _role(u) in SURVEILLANCE_ROLES,
    "reports.create": lambda u: _role(u) in VOICE_AGENT_ROLES,
}

WRITE_CAPABILITIES = ("incidents.create", "visitors.write", "leave.write", "cases.write", "alerts.write")
CAPABILITY_CHECKS["actions.perform"] = lambda u: any(CAPABILITY_CHECKS[c](u) for c in WRITE_CAPABILITIES)


def has_capability(user, capability: str) -> bool:
    if not can_use_voice_agent(user):
        return False
    check = CAPABILITY_CHECKS.get(capability)
    return bool(check and check(user))


def location_scope(user) -> str | None:
    """None = all sites; otherwise the site code this officer is restricted to."""
    return get_location_scope(user)


def camera_scope_q(user, prefix: str = "") -> Q:
    """Q filter restricting Camera rows (optionally via a relation prefix) to the user's site."""
    scope = location_scope(user)
    if not scope:
        return Q()
    pretty = scope.replace("_", " ")
    return (
        Q(**{f"{prefix}location__iexact": scope})
        | Q(**{f"{prefix}nvr__site__code__iexact": scope})
        | Q(**{f"{prefix}nvr__site__name__icontains": pretty})
    )


def location_allowed(user, location: str) -> bool:
    scope = location_scope(user)
    if not scope:
        return True
    loc = (location or "").strip().upper().replace(" ", "_")
    return loc == scope.upper() or scope.replace("_", " ").lower() in (location or "").lower()
