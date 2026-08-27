"""HTTP client for talking to remote Tekeye servers."""

from __future__ import annotations

from typing import Any
from urllib.parse import urljoin

import requests
from django.utils import timezone


DEFAULT_TIMEOUT = 15


def _friendly_conn_error(exc: Exception, base: str) -> str:
    msg = str(exc)
    port_hint = "8100 (ML)" if ":8100" in base else "8000 (Django)" if ":8000" in base else "the service port"
    if "ConnectTimeout" in msg or "timed out" in msg.lower():
        return (
            f"Cannot reach {base} — connection timed out. "
            f"From THIS PC (where Django runs): ping the IP, then "
            f"Test-NetConnection HOST -Port {port_hint.split()[0]}. "
            "Confirm ML/Django is running and listening on 0.0.0.0 (not only 127.0.0.1), "
            "and that firewall/VPN allows the connection."
        )
    if "Connection refused" in msg or "10061" in msg:
        return (
            f"Connection refused at {base}. "
            f"Nothing is accepting connections on that port — start the service "
            f"and bind to 0.0.0.0:{port_hint.split()[0]}."
        )
    if "Failed to establish" in msg or "Max retries" in msg:
        return (
            f"Cannot connect to {base}. "
            "Verify the host is online and reachable from the Django server machine."
        )
    return f"Network error talking to {base}: {msg[:240]}"


def _auth_headers(token: str) -> dict[str, str]:
    token = (token or "").strip()
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Token {token}"
    return headers


def remote_get_json(
    base_url: str,
    path: str,
    token: str,
    *,
    params: dict | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> tuple[int, Any]:
    url = urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))
    resp = requests.get(url, headers=_auth_headers(token), params=params or {}, timeout=timeout)
    try:
        data = resp.json()
    except Exception:
        data = {"detail": (resp.text or "")[:500]}
    return resp.status_code, data


def probe_health(base_url: str, token: str) -> dict[str, Any]:
    """Check remote API is reachable; try cameras streams then cameras list."""
    base = base_url.rstrip("/")
    errors: list[str] = []

    for path in ("api/cameras/streams/", "api/cameras/", "api/ml/health/"):
        try:
            status, data = remote_get_json(base, path, token, timeout=10)
        except requests.RequestException as exc:
            return {"ok": False, "error": _friendly_conn_error(exc, base), "details": [str(exc)]}
        if status == 200:
            return {"ok": True, "path": path, "status": status, "data": data}
        if status == 401:
            return {
                "ok": False,
                "error": "Authentication failed (invalid token on remote server).",
                "status": 401,
            }
        errors.append(f"{path}: HTTP {status}")

    return {
        "ok": False,
        "error": errors[0] if errors else "Unreachable",
        "details": errors,
    }


def fetch_remote_cameras(base_url: str, token: str) -> dict[str, Any]:
    """Return normalized camera list from remote streams or cameras API."""
    base = base_url.rstrip("/")
    try:
        status, data = remote_get_json(base, "api/cameras/streams/", token)
    except requests.RequestException as exc:
        return {"ok": False, "error": _friendly_conn_error(exc, base), "cameras": []}

    if status == 200 and isinstance(data, dict) and "cameras" in data:
        cameras = data.get("cameras") or []
        return {
            "ok": True,
            "source": "streams",
            "cameras": [_normalize_stream_cam(c) for c in cameras if isinstance(c, dict)],
            "ml_service_enabled": data.get("ml_service_enabled"),
        }

    if status == 401:
        return {
            "ok": False,
            "error": "Authentication failed (invalid token on remote server).",
            "cameras": [],
        }

    try:
        status2, data2 = remote_get_json(base, "api/cameras/", token, params={"is_active": "true"})
    except requests.RequestException as exc:
        return {"ok": False, "error": _friendly_conn_error(exc, base), "cameras": []}

    if status2 == 200:
        raw = data2
        if isinstance(data2, dict):
            raw = data2.get("results") or data2.get("cameras") or []
        if not isinstance(raw, list):
            raw = []
        return {
            "ok": True,
            "source": "cameras",
            "cameras": [_normalize_camera_record(c) for c in raw if isinstance(c, dict)],
        }

    return {
        "ok": False,
        "error": f"Could not fetch cameras (streams HTTP {status}, cameras HTTP {status2}).",
        "cameras": [],
    }


def fetch_remote_detection_events(
    base_url: str,
    token: str,
    *,
    page: int = 1,
    page_size: int = 25,
    is_alert: bool | None = None,
) -> dict[str, Any]:
    params: dict[str, Any] = {"page": page, "page_size": page_size}
    if is_alert is not None:
        params["is_alert"] = "true" if is_alert else "false"
    try:
        status, data = remote_get_json(
            base_url.rstrip("/"), "api/cameras/detection-events/", token, params=params
        )
    except requests.RequestException as exc:
        return {
            "ok": False,
            "error": _friendly_conn_error(exc, base_url.rstrip("/")),
            "results": [],
            "count": 0,
        }
    if status == 200 and isinstance(data, dict):
        return {"ok": True, **data}
    return {
        "ok": False,
        "error": data.get("detail") if isinstance(data, dict) else f"HTTP {status}",
        "results": [],
        "count": 0,
    }


def _normalize_stream_cam(c: dict) -> dict[str, Any]:
    cam_id = c.get("id")
    stream_key = (c.get("ml_stream_key") or "").strip() or (f"cam-{cam_id}" if cam_id else "")
    return {
        "id": cam_id,
        "code": c.get("code") or "",
        "name": c.get("label") or c.get("name") or c.get("code") or f"Camera {cam_id}",
        "label": c.get("label") or c.get("name") or "",
        "location": c.get("location") or c.get("site_code") or "",
        "site_code": c.get("site_code") or "",
        "site_name": c.get("site_label") or c.get("site_name") or "",
        "nvr_name": c.get("nvr_name") or "",
        "channel": c.get("channel"),
        "purpose": c.get("purpose") or "",
        "purpose_label": c.get("purpose_label") or "",
        "ml_enabled": bool(c.get("ml_enabled")),
        "is_rtsp": bool(c.get("is_rtsp", True)),
        "ml_stream_key": stream_key,
        "ml_live_stream_url": c.get("ml_live_stream_url") or "",
        "raw_stream_url": c.get("raw_stream_url") or "",
        "status": c.get("status") or "Online",
        "is_active": True,
    }


def _normalize_camera_record(c: dict) -> dict[str, Any]:
    cam_id = c.get("id")
    stream_key = (c.get("ml_stream_key") or "").strip() or (f"cam-{cam_id}" if cam_id else "")
    return {
        "id": cam_id,
        "code": c.get("code") or "",
        "name": c.get("name") or c.get("code") or f"Camera {cam_id}",
        "label": c.get("name") or "",
        "location": c.get("location") or c.get("site_code") or "",
        "site_code": c.get("site_code") or "",
        "site_name": c.get("site_name") or "",
        "nvr_name": c.get("nvr_name") or "",
        "channel": c.get("channel"),
        "purpose": c.get("purpose") or "",
        "purpose_label": c.get("purpose_label") or "",
        "ml_enabled": bool(c.get("ml_enabled")),
        "is_rtsp": bool(c.get("is_rtsp", True)),
        "ml_stream_key": stream_key,
        "ml_live_stream_url": c.get("ml_live_stream_url") or "",
        "raw_stream_url": c.get("raw_stream_url") or "",
        "status": c.get("status") or "Online",
        "is_active": bool(c.get("is_active", True)),
        "nvr": c.get("nvr"),
    }


def mark_server_health(server, *, ok: bool, error: str = "") -> None:
    server.last_seen_at = timezone.now()
    server.last_health = "online" if ok else "offline"
    server.last_error = (error or "")[:2000]
    server.save(update_fields=["last_seen_at", "last_health", "last_error", "updated_at"])


def probe_ml_health(ml_base_url: str) -> dict[str, Any]:
    """Ping remote ML /health or /live/status."""
    base = (ml_base_url or "").rstrip("/")
    if not base:
        return {"ok": False, "error": "ML URL is required."}
    errors: list[str] = []
    for path in ("health", "live/status"):
        try:
            resp = requests.get(f"{base}/{path}", timeout=10, headers={"Accept": "application/json"})
        except requests.RequestException as exc:
            return {"ok": False, "error": _friendly_conn_error(exc, base), "details": [str(exc)]}
        if resp.status_code == 200:
            try:
                data = resp.json()
            except Exception:
                data = {}
            return {"ok": True, "path": path, "status": 200, "data": data}
        errors.append(f"{path}: HTTP {resp.status_code}")
    return {"ok": False, "error": errors[0] if errors else "ML unreachable", "details": errors}


def remote_delete_json(
    base_url: str,
    path: str,
    token: str,
    *,
    timeout: float = DEFAULT_TIMEOUT,
) -> tuple[int, Any]:
    url = urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))
    resp = requests.delete(url, headers=_auth_headers(token), timeout=timeout)
    try:
        data = resp.json()
    except Exception:
        data = {"detail": (resp.text or "")[:500]}
    return resp.status_code, data


def unregister_ml_camera_remote(ml_base_url: str, stream_key: str) -> dict[str, Any]:
    """Unregister a camera from a remote (or local) ML node."""
    base = (ml_base_url or "").rstrip("/")
    key = (stream_key or "").strip()
    if not base:
        return {"ok": False, "error": "ML URL is required."}
    if not key:
        return {"ok": False, "error": "stream_key is required."}
    try:
        resp = requests.delete(
            f"{base}/live/cam/{key}/register",
            timeout=15,
            headers={"Accept": "application/json"},
        )
    except requests.RequestException as exc:
        return {"ok": False, "error": _friendly_conn_error(exc, base)}

    if resp.status_code in (200, 204):
        try:
            data = resp.json()
        except Exception:
            data = {"removed": True}
        return {"ok": True, **(data if isinstance(data, dict) else {"data": data})}

    detail = ""
    try:
        body = resp.json()
        if isinstance(body, dict):
            detail = str(body.get("detail") or body.get("error") or "")
    except Exception:
        detail = (resp.text or "")[:200]
    return {
        "ok": False,
        "error": detail or f"ML unregister returned HTTP {resp.status_code}",
        "status": resp.status_code,
    }


def delete_remote_camera(base_url: str, token: str, camera_id: int) -> dict[str, Any]:
    """Delete a camera on a remote Tekeye Django API."""
    base = base_url.rstrip("/")
    if not camera_id:
        return {"ok": False, "error": "camera_id is required."}
    try:
        status, data = remote_delete_json(base, f"api/cameras/{camera_id}/", token)
    except requests.RequestException as exc:
        return {"ok": False, "error": _friendly_conn_error(exc, base)}
    if status in (200, 204):
        return {"ok": True}
    detail = ""
    if isinstance(data, dict):
        detail = str(data.get("detail") or data.get("error") or "")
    return {"ok": False, "error": detail or f"Remote delete returned HTTP {status}", "status": status}


def fetch_ml_cameras(ml_base_url: str, *, server_name: str = "") -> dict[str, Any]:
    """
    List cameras registered on a remote ML service (GET /live/status).
    Only that ML node's cameras are returned — per-server view.
    """
    base = (ml_base_url or "").rstrip("/")
    if not base:
        return {"ok": False, "error": "ML URL is required.", "cameras": []}
    try:
        resp = requests.get(f"{base}/live/status", timeout=15, headers={"Accept": "application/json"})
    except requests.RequestException as exc:
        return {"ok": False, "error": _friendly_conn_error(exc, base), "cameras": []}

    if resp.status_code != 200:
        return {
            "ok": False,
            "error": f"ML /live/status returned HTTP {resp.status_code}",
            "cameras": [],
        }
    try:
        data = resp.json()
    except Exception:
        return {"ok": False, "error": "ML returned invalid JSON.", "cameras": []}

    raw = data.get("cameras") if isinstance(data, dict) else None
    if not isinstance(raw, list):
        raw = []

    cameras = []
    for i, c in enumerate(raw):
        if not isinstance(c, dict):
            continue
        key = (c.get("key") or c.get("ip") or "").strip()
        if not key:
            continue
        connected = bool(c.get("connected") or c.get("has_frame"))
        purpose = (c.get("purpose") or "").strip()
        cameras.append(
            {
                "id": i + 1,
                "code": key,
                "name": key,
                "label": key,
                "location": server_name or "",
                "site_code": "",
                "site_name": server_name or "",
                "nvr_name": "",
                "channel": None,
                "purpose": purpose,
                "purpose_label": purpose or "ML live",
                "ml_enabled": True,
                "is_rtsp": True,
                "ml_stream_key": key,
                "ml_live_stream_url": "",
                "raw_stream_url": "",
                "status": "Online" if connected else "Offline",
                "is_active": True,
                "connected": connected,
                "has_frame": bool(c.get("has_frame")),
                "detections": c.get("detections", 0),
            }
        )

    return {
        "ok": True,
        "source": "ml_live_status",
        "cameras": cameras,
        "ml_running": bool(data.get("running")) if isinstance(data, dict) else False,
        "camera_count": len(cameras),
    }
