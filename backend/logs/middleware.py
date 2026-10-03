from .models import UserActivityLog

try:
    import requests
except ImportError:
    requests = None

try:
    from user_agents import parse as parse_user_agent
except ImportError:
    parse_user_agent = None


# Paths we don't log (e.g. report endpoint to avoid duplicate entries, or health checks)
SKIP_LOG_PATHS = (
    "/api/activity-logs/report/",
    "/api/activity-logs/report",
    "/api/mobile-sessions/",
    "/api/mobile/heartbeat/",
    "/api/mobile/heartbeat",
    "/api/mobile/gps/",
    "/api/gps/ping/",
    "/api/gps/heartbeat/",
    "/favicon.ico",
    "/media/",
)


def _valid_ip(raw) -> str | None:
    import ipaddress

    value = (raw or "").strip()
    if not value:
        return None
    if value.startswith("::ffff:"):
        value = value[7:]
    try:
        ipaddress.ip_address(value)
    except ValueError:
        return None
    return value


def get_ip(request):
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return _valid_ip(x_forwarded_for.split(",")[0])
    return _valid_ip(request.META.get("REMOTE_ADDR"))


def get_device_info(request):
    user_agent = request.META.get("HTTP_USER_AGENT", "")
    if parse_user_agent is None:
        return "PC", "", (user_agent or "")[:50]
    parsed = parse_user_agent(user_agent)
    device = "Mobile" if parsed.is_mobile else "PC"
    os_str = parsed.os.family or ""
    browser = parsed.browser.family or ""
    return device, os_str, browser


def get_geo(ip):
    if not ip or ip in ("127.0.0.1", "127.0.1", "localhost"):
        return "Pakistan", "Local"
    if requests is None:
        return None, None
    try:
        r = requests.get(f"http://ip-api.com/json/{ip}", timeout=2)
        if r.ok:
            j = r.json()
            return j.get("country"), j.get("city")
    except Exception:
        pass
    return None, None


def create_activity_log(user, request, action, source="web"):
    ip = get_ip(request)
    device, os_str, browser = get_device_info(request)
    country, city = get_geo(ip)
    UserActivityLog.objects.create(
        user=user,
        ip_address=ip,
        country=country,
        city=city,
        device=(device or "")[:50],
        os=(os_str or "")[:50],
        browser=(browser or "")[:50],
        action=action[:255],
        source=(source or "web")[:20],
    )


class ActivityLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if request.user.is_authenticated:
            path = request.path.rstrip("/") or "/"
            if any(path.startswith(p.rstrip("/")) for p in SKIP_LOG_PATHS):
                return response
            action = f"{request.method} {path}"
            create_activity_log(request.user, request, action)

        return response
