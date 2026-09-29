from rest_framework import permissions
from django.db.models import Q

GLOBAL_ADMIN_ROLE = "ADMIN"
IT_SUPERADMIN_ROLE = "IT_SUPERADMIN"
LOCATION_ADMIN_ROLE = "LOCATION_ADMIN"

PRIVILEGED_ROLES = frozenset({GLOBAL_ADMIN_ROLE, LOCATION_ADMIN_ROLE, IT_SUPERADMIN_ROLE})


def is_global_admin(user) -> bool:
    return bool(
        user
        and getattr(user, "is_authenticated", False)
        and getattr(user, "role", None) == GLOBAL_ADMIN_ROLE
    )


def is_it_superadmin(user) -> bool:
    return bool(
        user
        and getattr(user, "is_authenticated", False)
        and getattr(user, "role", None) == IT_SUPERADMIN_ROLE
    )


def is_ops_viewer(user) -> bool:
    """Global and location-scoped operations users may view Central Ops streams."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if is_global_admin(user) or is_it_superadmin(user):
        return True
    return getattr(user, "role", None) in {
        "LOCATION_ADMIN",
        "COLLECTOR",
        "DEPUTY_COLLECTOR",
        "ASSISTANT_COLLECTOR",
    }


HEAD_OFFICE_LOCATION = "PESHAWAR"
THIS_SITE_LOCATION = "DI_KHAN"

_LOCATION_NAME_ALIASES = {
    "PESHAWAR": ("Peshawar",),
    "KOHAT": ("Kohat",),
    "NOWSHERA": ("Nowshera",),
    "MARDAN": ("Mardan",),
    "DI_KHAN": ("DI Khan", "Dera Ismail Khan", "DIKhan"),
    "SWH_RATTA_KULACHI": ("Ratta Kulachi", "SWH Ratta Kulachi"),
    "THAKOT": ("Thakot",),
}

_ALL_CITIES_VIEWER_ROLES = frozenset(
    {
        GLOBAL_ADMIN_ROLE,
        IT_SUPERADMIN_ROLE,
        LOCATION_ADMIN_ROLE,
        "COLLECTOR",
        "DEPUTY_COLLECTOR",
        "ASSISTANT_COLLECTOR",
    }
)


def _normalize_location_code(value) -> str:
    return (value or "").strip().upper().replace(" ", "_").replace("-", "_")


def can_see_all_cities_cameras(user) -> bool:
    """Peshawar Super Admin, IT Super Admin, Peshawar admin, and Peshawar collectors see every city."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    role = getattr(user, "role", None)
    if role not in _ALL_CITIES_VIEWER_ROLES:
        return False
    loc = _normalize_location_code(getattr(user, "location", None))
    if loc == HEAD_OFFICE_LOCATION:
        return True
    if role in {GLOBAL_ADMIN_ROLE, IT_SUPERADMIN_ROLE} and THIS_SITE_LOCATION == HEAD_OFFICE_LOCATION and not loc:
        return True
    return False


def ops_camera_location_scope(user) -> str | None:
    """None = all connected cities; otherwise only this location's servers."""
    if can_see_all_cities_cameras(user):
        return None
    loc = (getattr(user, "location", None) or "").strip()
    return loc or THIS_SITE_LOCATION


def is_location_admin(user) -> bool:
    return bool(
        user
        and getattr(user, "is_authenticated", False)
        and getattr(user, "role", None) == LOCATION_ADMIN_ROLE
    )


def is_admin_user(user) -> bool:
    return is_global_admin(user) or is_location_admin(user)


def get_location_scope(user) -> str | None:
    """
    Return the location code the user is restricted to, or None if they may see all sites.
    Global admins are never scoped; everyone else uses their assigned location when set.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return None
    if is_global_admin(user) or is_it_superadmin(user):
        return None
    loc = (getattr(user, "location", None) or "").strip()
    return loc or None


def apply_remote_server_scope(queryset, user):
    """Restrict remote servers to the viewer's site unless they may see all cities."""
    scope = ops_camera_location_scope(user)
    if not scope:
        return queryset
    aliases = _LOCATION_NAME_ALIASES.get(scope.upper(), ())
    match = Q(location_code__iexact=scope)
    for alias in aliases:
        match |= Q(location_code__iexact=alias)
        match |= Q(name__icontains=alias)
    pretty = scope.replace("_", " ")
    if pretty.lower() != scope.lower():
        match |= Q(name__icontains=pretty)
    return queryset.filter(match)


def get_effective_location(user, query_param: str | None = None) -> str | None:
    """Location used for list filtering. Scoped users ignore query_param overrides."""
    scope = get_location_scope(user)
    if scope:
        return scope
    qp = (query_param or "").strip()
    return qp or None


def apply_location_filter(queryset, user, field: str = "location", query_param: str | None = None):
    loc = get_effective_location(user, query_param)
    if loc:
        return queryset.filter(**{field: loc})
    return queryset


def resolve_location_for_write(user, requested_location: str = "") -> str:
    """On create/update: location-scoped users always write to their own site."""
    scope = get_location_scope(user)
    if scope:
        return scope
    return (requested_location or "").strip()


def location_admin_may_assign_role(actor, role: str) -> bool:
    if is_global_admin(actor):
        return True
    if is_location_admin(actor):
        return role not in PRIVILEGED_ROLES
    return True


HR_MODULE_KEY = "Human Resource"

# Matches frontend site-full-access roles that already show Attendance / HR in the sidebar.
SITE_FULL_ACCESS_ROLES = frozenset(
    {
        LOCATION_ADMIN_ROLE,
        "OPERATION_MANAGER",
        "COLLECTOR",
        "DEPUTY_COLLECTOR",
        "ASSISTANT_COLLECTOR",
    }
)

HR_API_ROLES = frozenset(
    {GLOBAL_ADMIN_ROLE, "HR", "IT_ADMIN"} | SITE_FULL_ACCESS_ROLES
)

# PWA: these roles may see every employee’s location, attendance, and mobile logs.
STAFF_OVERVIEW_ROLES = frozenset(
    {
        GLOBAL_ADMIN_ROLE,
        IT_SUPERADMIN_ROLE,
        LOCATION_ADMIN_ROLE,
        "HR",
        "IT_ADMIN",
        "OPERATION_MANAGER",
        "COLLECTOR",
        "DEPUTY_COLLECTOR",
        "ASSISTANT_COLLECTOR",
    }
)


def can_view_all_staff(user) -> bool:
    """True when the user may view other employees’ GPS, attendance, and logs."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in STAFF_OVERVIEW_ROLES:
        return True
    modules = getattr(user, "allowed_modules", None) or []
    return HR_MODULE_KEY in modules


def has_hr_api_access(user) -> bool:
    """True when the user may call staff / attendance / leave / recognition APIs."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in HR_API_ROLES:
        return True
    modules = getattr(user, "allowed_modules", None) or []
    return HR_MODULE_KEY in modules


class IsAdminOrHR(permissions.BasePermission):
    """Allow HR APIs to the same people who can open Attendance in the UI."""

    allowed_roles = tuple(HR_API_ROLES)

    def has_permission(self, request, view):
        return has_hr_api_access(request.user)


class IsGlobalAdmin(permissions.BasePermission):
    """Allow access only to the global super administrator."""

    def has_permission(self, request, view):
        return is_global_admin(request.user)


class IsAdminUser(permissions.BasePermission):
    """Allow global or location administrators."""

    def has_permission(self, request, view):
        return is_admin_user(request.user)
