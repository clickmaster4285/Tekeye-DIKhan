"""Sidebar module catalog for dynamic permissions (mirrors frontend ALL_NAV_ITEMS top-level)."""

# Keys/labels must match frontend getSidebarModuleCatalog() / ALL_NAV_ITEMS labels.
SIDEBAR_MODULES: list[dict[str, str]] = [
    {"key": "Visitor Management", "label": "Visitor Management"},
    {"key": "Warehouse Management", "label": "Warehouse Management"},
    {"key": "Seizure Management", "label": "Seizure Management"},
    {"key": "Human Resource", "label": "Human Resource"},
    {"key": "Armory", "label": "Armory"},
    {"key": "Litigation Management", "label": "Litigation Management"},
    {"key": "Auction Management", "label": "Auction Management"},
    {"key": "AI Monitoring & Analytics", "label": "AI Monitoring & Analytics"},
    {"key": "System Configuration", "label": "System Configuration"},
]

SIDEBAR_MODULE_KEYS = frozenset(m["key"] for m in SIDEBAR_MODULES)


def normalize_allowed_modules(raw) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        key = str(item or "").strip()
        if not key or key in seen:
            continue
        if key not in SIDEBAR_MODULE_KEYS:
            continue
        seen.add(key)
        out.append(key)
    return out
