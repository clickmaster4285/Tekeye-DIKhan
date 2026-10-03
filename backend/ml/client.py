"""HTTP client for the external ML inference service (ml_services/api_server.py)."""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlencode

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class MLServiceError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def known_ml_base_urls() -> list[str]:
    """
    Every ML node the backend should control:
      - ML_SERVICE_URL (optional hub)
      - active RemoteServer rows in ML mode (ops camera distribution)

    Loopback URLs (127.0.0.1 / localhost) are allowed — local and remote ML hosts are both valid.
    """
    urls: list[str] = []
    seen: set[str] = set()

    def _add(raw: str) -> None:
        url = (raw or "").strip().rstrip("/")
        if not url or url in seen:
            return
        seen.add(url)
        urls.append(url)

    _add(getattr(settings, "ML_SERVICE_URL", "") or "")
    try:
        from ops_central.models import RemoteServer

        for server in RemoteServer.objects.filter(is_active=True):
            if hasattr(server, "is_ml_mode") and not server.is_ml_mode():
                continue
            _add(server.resolved_ml_base_url() or "")
    except Exception:
        logger.debug("Could not enumerate RemoteServer ML URLs", exc_info=True)
    return urls


def ml_service_enabled() -> bool:
    """True when at least one ML endpoint is configured (hub and/or RemoteServer)."""
    return bool(known_ml_base_urls())


def _base_url() -> str:
    urls = known_ml_base_urls()
    if not urls:
        raise MLServiceError(
            "ML service is not configured. Set ML_SERVICE_URL or add an active ML RemoteServer.",
            503,
        )
    return urls[0]


def _timeout() -> int:
    return int(getattr(settings, "ML_SERVICE_TIMEOUT", 60))


def _live_timeout() -> tuple[float, float]:
    return (3.0, min(float(_timeout()), 30.0))


def _live_rtsp_params(rtsp_url: str | None) -> dict[str, str]:
    url = (rtsp_url or "").strip()
    if not url:
        return {}
    return {"rtsp_url": url}


def _request(method: str, path: str, *, timeout: float | tuple[float, float] | None = None, **kwargs) -> requests.Response:
    url = f"{_base_url()}{path}"
    req_timeout = _timeout() if timeout is None else timeout
    try:
        return requests.request(method, url, timeout=req_timeout, **kwargs)
    except requests.RequestException as exc:
        raise MLServiceError(
            f"ML service unreachable at {_base_url()}. "
            f"Start the ML server: cd ml_services && python api_server.py ({exc})",
            503,
        ) from exc


def ml_health() -> dict[str, Any]:
    """Health of the first reachable ML node (hub preference order)."""
    return ml_health_any()


def ml_health_any() -> dict[str, Any]:
    """Return health from the first reachable known ML node."""
    last_exc: Exception | None = None
    urls = known_ml_base_urls()
    if not urls:
        raise MLServiceError(
            "ML service is not configured. Set ML_SERVICE_URL or add an active ML RemoteServer.",
            503,
        )
    for base in urls:
        try:
            data = ml_health_at(base)
            data.setdefault("ml_base_url", base)
            return data
        except MLServiceError as exc:
            last_exc = exc
            logger.debug("ML health failed at %s: %s", base, exc)
    raise MLServiceError(
        f"No reachable ML service among {len(urls)} configured node(s). Last error: {last_exc}",
        getattr(last_exc, "status_code", None) or 503,
    ) from last_exc


def ml_health_all() -> dict[str, Any]:
    """Probe every known ML node (does not raise if some are down)."""
    by_server: dict[str, Any] = {}
    for base in known_ml_base_urls():
        try:
            by_server[base] = {"ok": True, **ml_health_at(base)}
        except MLServiceError as exc:
            by_server[base] = {"ok": False, "error": str(exc)}
    return {
        "ok_count": sum(1 for v in by_server.values() if v.get("ok")),
        "total": len(by_server),
        "by_server": by_server,
    }


def ml_reload_faces(embeddings: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """Push known faces to every connected ML node."""
    return ml_reload_faces_all(embeddings)


def ml_reload_faces_all(embeddings: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    payload = [
        {"identity": entry["identity"], "embedding": entry["embedding"]}
        for entry in (embeddings or [])
    ]
    urls = known_ml_base_urls()
    if not urls:
        raise MLServiceError(
            "ML service is not configured. Set ML_SERVICE_URL or add an active ML RemoteServer.",
            503,
        )
    by_server: dict[str, Any] = {}
    ok = 0
    for base in urls:
        try:
            res = _request_at(base, "POST", "/reload/faces", json=payload)
            if res.status_code != 200:
                by_server[base] = {
                    "ok": False,
                    "error": f"HTTP {res.status_code}",
                    "detail": res.text[:200],
                }
                logger.warning("[face-sync] reload/faces failed at %s (%s)", base, res.status_code)
                continue
            data = res.json() if res.content else {}
            by_server[base] = {"ok": True, **(data if isinstance(data, dict) else {"result": data})}
            ok += 1
        except MLServiceError as exc:
            by_server[base] = {"ok": False, "error": str(exc)}
            logger.warning("[face-sync] reload/faces unreachable at %s: %s", base, exc)
    if ok == 0:
        raise MLServiceError(
            f"Failed to reload faces on all {len(urls)} ML node(s).",
            503,
        )
    return {
        "known_faces": len(payload),
        "db_embeddings": len(payload),
        "ok_count": ok,
        "total": len(urls),
        "by_server": by_server,
    }


def ml_extract_face_embedding(file_bytes: bytes, filename: str = "face.jpg") -> dict[str, Any]:
    """Extract embedding via the first reachable ML node."""
    last_exc: Exception | None = None
    urls = known_ml_base_urls()
    if not urls:
        raise MLServiceError(
            "ML service is not configured. Set ML_SERVICE_URL or add an active ML RemoteServer.",
            503,
        )
    for base in urls:
        try:
            res = _request_at(
                base,
                "POST",
                "/faces/extract",
                files={"image": (filename, file_bytes, "application/octet-stream")},
            )
            if res.status_code != 200:
                last_exc = MLServiceError(
                    f"Face embedding extraction failed: {res.text[:300]}",
                    res.status_code,
                )
                continue
            return res.json()
        except MLServiceError as exc:
            last_exc = exc
            logger.debug("Face extract failed at %s: %s", base, exc)
    raise MLServiceError(
        f"Face embedding extraction failed on all ML nodes. Last error: {last_exc}",
        getattr(last_exc, "status_code", None) or 503,
    ) from last_exc


def ml_detect_image(
    file_bytes: bytes,
    filename: str = "image.jpg",
    *,
    conf: float = 0.25,
    recognize_faces: bool = True,
) -> dict[str, Any]:
    res = _request(
        "POST",
        "/detect/image",
        files={"image": (filename, file_bytes, "application/octet-stream")},
        params={"conf": conf, "recognize_faces": str(recognize_faces).lower()},
    )
    if res.status_code != 200:
        detail = res.text[:300]
        raise MLServiceError(f"Detection failed: {detail}", res.status_code)
    return res.json()


def ml_detect_plates(
    file_bytes: bytes,
    filename: str = "vehicle.jpg",
    *,
    conf: float | None = None,
    save: bool = True,
    camera_key: str = "",
) -> dict[str, Any]:
    """License plate detect + OCR. Saves under media/licence plates/ when save=True."""
    params: dict[str, str] = {"save": str(bool(save)).lower()}
    if conf is not None:
        params["conf"] = str(conf)
    if camera_key.strip():
        params["camera_key"] = camera_key.strip()
    res = _request(
        "POST",
        "/plates/detect",
        files={"image": (filename, file_bytes, "application/octet-stream")},
        params=params,
    )
    if res.status_code != 200:
        detail = res.text[:300]
        raise MLServiceError(f"Plate detection failed: {detail}", res.status_code)
    return res.json()


def ml_recognize_face(file_bytes: bytes, filename: str = "face.jpg") -> dict[str, Any]:
    res = _request(
        "POST",
        "/recognize/face",
        files={"image": (filename, file_bytes, "application/octet-stream")},
    )
    if res.status_code != 200:
        detail = res.text[:300]
        raise MLServiceError(f"Face recognition failed: {detail}", res.status_code)
    return res.json()


def ml_live_status() -> dict[str, Any]:
    res = _request("GET", "/live/status")
    if res.status_code != 200:
        raise MLServiceError(f"Live stream status failed ({res.status_code})", res.status_code)
    return res.json()


def camera_ml_base_url(camera) -> str:
    """Assigned ML node URL, or empty when unassigned (must not fall back to ML_SERVICE_URL)."""
    if not getattr(camera, "ml_server_id", None):
        return ""
    server = getattr(camera, "ml_server", None)
    if server is None:
        return ""
    return (server.resolved_ml_base_url() or "").strip().rstrip("/")


def require_camera_ml_url(camera) -> str:
    url = camera_ml_base_url(camera)
    if not url:
        raise MLServiceError(
            "Camera is not assigned to an ML server. Assign it in Camera Distribution first.",
            409,
        )
    return url


def ml_live_detections_at(
    base_url: str,
    stream_key: str,
    rtsp_url: str | None = None,
    *,
    purpose: str = "",
    purposes: list[str] | None = None,
) -> dict[str, Any]:
    key = (stream_key or "").strip()
    params = dict(_live_rtsp_params(rtsp_url))
    purpose_list = [str(p).strip() for p in (purposes or []) if str(p).strip()]
    if purpose_list:
        params["purposes"] = ",".join(purpose_list)
    primary = (purpose or "").strip()
    if primary:
        params["purpose"] = primary
    res = _request_at(
        base_url,
        "GET",
        f"/live/cam/{key}/detections",
        params=params,
        timeout=_live_timeout(),
    )
    if res.status_code != 200:
        detail = res.text[:300]
        raise MLServiceError(
            f"Live detections failed ({res.status_code}): {detail}",
            res.status_code,
        )
    return res.json()


def ml_live_detections(
    stream_key: str,
    rtsp_url: str | None = None,
    *,
    purpose: str = "",
    purposes: list[str] | None = None,
) -> dict[str, Any]:
    """Legacy: detections against global ML_SERVICE_URL. Prefer ml_live_detections_for_camera."""
    return ml_live_detections_at(
        _base_url(),
        stream_key,
        rtsp_url,
        purpose=purpose,
        purposes=purposes,
    )


def ml_live_detections_for_camera(
    camera,
    *,
    purpose: str = "",
    purposes: list[str] | None = None,
) -> dict[str, Any]:
    """Poll detections only on the camera's assigned ML node."""
    base = require_camera_ml_url(camera)
    return ml_live_detections_at(
        base,
        camera.stream_key,
        rtsp_url=camera.effective_stream_url(),
        purpose=purpose or camera.purpose,
        purposes=purposes if purposes is not None else camera.purpose_list(),
    )


def ml_assigned_mjpeg_public_url(camera, *, kind: str = "live") -> str:
    """
    Browser MJPEG via Ops proxy to the assigned ML server.
    Empty string when unassigned (no stream until Camera Distribution assigns).
    """
    if not getattr(camera, "ml_server_id", None) or not camera.is_active or not camera.nvr_id:
        return ""
    key = (camera.stream_key or "").strip()
    if not key:
        return ""
    kind_q = "raw" if (kind or "").strip().lower() == "raw" else "live"
    return f"/api/ops/servers/{camera.ml_server_id}/mjpeg/?stream_key={key}&kind={kind_q}"


def ml_live_mjpeg_url(stream_key: str, rtsp_url: str | None = None) -> str:
    key = (stream_key or "").strip()
    base = f"{_base_url()}/live/cam/{key}/mjpeg"
    params = _live_rtsp_params(rtsp_url)
    if not params:
        return base
    return f"{base}?{urlencode(params)}"


def ml_live_mjpeg_url_for_camera(camera) -> str:
    """Absolute MJPEG URL on the assigned ML node (server-side fetch)."""
    base = require_camera_ml_url(camera)
    key = camera.stream_key
    params = _live_rtsp_params(camera.effective_stream_url())
    path = f"{base}/live/cam/{key}/mjpeg"
    if not params:
        return path
    return f"{path}?{urlencode(params)}"


def ml_live_mjpeg_public_url(
    stream_key: str,
    *,
    rtsp_url: str | None = None,
    purpose: str = "",
    purposes: list[str] | None = None,
) -> str:
    """Deprecated global /ml proxy path — prefer ml_assigned_mjpeg_public_url(camera)."""
    key = (stream_key or "").strip()
    if not key:
        return ""
    base = f"/ml/live/cam/{key}/mjpeg"
    params: dict[str, str] = {}
    url = (rtsp_url or "").strip()
    if url:
        params["rtsp_url"] = url
    purpose_list = [str(p).strip() for p in (purposes or []) if str(p).strip()]
    if purpose_list:
        params["purposes"] = ",".join(purpose_list)
    primary = (purpose or "").strip()
    if primary:
        params["purpose"] = primary
    if not params:
        return base
    return f"{base}?{urlencode(params)}"


def ml_live_mjpeg_raw_public_url(
    stream_key: str,
    *,
    rtsp_url: str | None = None,
    purpose: str = "",
    purposes: list[str] | None = None,
) -> str:
    key = (stream_key or "").strip()
    if not key:
        return ""
    base = f"/ml/live/cam/{key}/mjpeg/raw"
    params: dict[str, str] = {}
    url = (rtsp_url or "").strip()
    if url:
        params["rtsp_url"] = url
    purpose_list = [str(p).strip() for p in (purposes or []) if str(p).strip()]
    if purpose_list:
        params["purposes"] = ",".join(purpose_list)
    primary = (purpose or "").strip()
    if primary:
        params["purpose"] = primary
    if not params:
        return base
    return f"{base}?{urlencode(params)}"


def ml_live_mjpeg_raw_url(stream_key: str, rtsp_url: str | None = None) -> str:
    key = (stream_key or "").strip()
    base = f"{_base_url()}/live/cam/{key}/mjpeg/raw"
    params = _live_rtsp_params(rtsp_url)
    if not params:
        return base
    return f"{base}?{urlencode(params)}"


def ml_live_mjpeg_raw_url_for_camera(camera) -> str:
    base = require_camera_ml_url(camera)
    key = camera.stream_key
    params = _live_rtsp_params(camera.effective_stream_url())
    path = f"{base}/live/cam/{key}/mjpeg/raw"
    if not params:
        return path
    return f"{path}?{urlencode(params)}"


def ml_live_jpeg_url(stream_key: str, rtsp_url: str | None = None) -> str:
    key = (stream_key or "").strip()
    base = f"{_base_url()}/live/cam/{key}/jpeg"
    params = _live_rtsp_params(rtsp_url)
    if not params:
        return base
    return f"{base}?{urlencode(params)}"


def ml_live_jpeg_raw_url(stream_key: str, rtsp_url: str | None = None) -> str:
    """Single-frame raw JPEG (use this for snapshots; do not hang on MJPEG)."""
    key = (stream_key or "").strip()
    base = f"{_base_url()}/live/cam/{key}/jpeg/raw"
    params = _live_rtsp_params(rtsp_url)
    if not params:
        return base
    return f"{base}?{urlencode(params)}"


def ml_live_jpeg_raw_url_for_camera(camera) -> str:
    base = require_camera_ml_url(camera)
    key = camera.stream_key
    params = _live_rtsp_params(camera.effective_stream_url())
    path = f"{base}/live/cam/{key}/jpeg/raw"
    if not params:
        return path
    return f"{path}?{urlencode(params)}"


def ml_live_jpeg_evidence_url_for_camera(camera) -> str:
    """Same-frame evidence JPEG (YOLO infer frame) — preferred for detection snapshots."""
    base = require_camera_ml_url(camera)
    key = camera.stream_key
    params = _live_rtsp_params(camera.effective_stream_url())
    path = f"{base}/live/cam/{key}/jpeg/evidence"
    if not params:
        return path
    return f"{path}?{urlencode(params)}"


def ml_live_jpeg_attendance_url(
    stream_key: str,
    rtsp_url: str | None = None,
    *,
    width: int = 1280,
) -> str:
    key = (stream_key or "").strip()
    base = f"{_base_url()}/live/cam/{key}/jpeg/attendance"
    params = dict(_live_rtsp_params(rtsp_url))
    params["width"] = str(max(640, min(4096, int(width or 3840))))
    return f"{base}?{urlencode(params)}"


def ml_live_mjpeg_attendance_url(
    stream_key: str,
    rtsp_url: str | None = None,
    *,
    width: int = 1280,
) -> str:
    """HD main-stream MJPEG for attendance clips (same RTSP session as live AI)."""
    key = (stream_key or "").strip()
    base = f"{_base_url()}/live/cam/{key}/mjpeg/attendance"
    params = dict(_live_rtsp_params(rtsp_url))
    params["width"] = str(max(640, min(4096, int(width or 3840))))
    return f"{base}?{urlencode(params)}"


def ml_live_mjpeg_attendance_url_for_camera(camera, *, width: int = 1280) -> str:
    base = require_camera_ml_url(camera)
    key = camera.stream_key
    params = dict(_live_rtsp_params(camera.effective_stream_url()))
    params["width"] = str(max(640, min(4096, int(width or 3840))))
    return f"{base}/live/cam/{key}/mjpeg/attendance?{urlencode(params)}"


def _build_register_payload(entries: list[dict[str, str]]) -> list[dict[str, Any]]:
    payload = []
    for item in entries:
        key = str(item.get("key") or "").strip()
        rtsp_url = str(item.get("rtsp_url") or "").strip()
        if not key or not rtsp_url:
            continue
        entry: dict[str, Any] = {"key": key, "rtsp_url": rtsp_url}
        purpose = str(item.get("purpose") or "").strip()
        if purpose:
            entry["purpose"] = purpose
        purposes = item.get("purposes")
        if isinstance(purposes, list) and purposes:
            entry["purposes"] = [str(p).strip() for p in purposes if str(p).strip()]
        elif purpose:
            entry["purposes"] = [purpose]
        payload.append(entry)
    return payload


def _request_at(
    base_url: str,
    method: str,
    path: str,
    *,
    timeout: float | tuple[float, float] | None = None,
    **kwargs,
) -> requests.Response:
    root = (base_url or "").strip().rstrip("/")
    if not root:
        raise MLServiceError("ML base URL is empty.", 503)
    url = f"{root}{path}"
    req_timeout = _timeout() if timeout is None else timeout
    try:
        return requests.request(method, url, timeout=req_timeout, **kwargs)
    except requests.RequestException as exc:
        raise MLServiceError(f"ML service unreachable at {root} ({exc})", 503) from exc


def ml_health_at(base_url: str) -> dict[str, Any]:
    res = _request_at(base_url, "GET", "/health", timeout=5.0)
    if res.status_code != 200:
        raise MLServiceError(f"ML health check failed ({res.status_code})", res.status_code)
    return res.json()


def ml_register_cameras_bulk_at(
    base_url: str,
    entries: list[dict[str, str]],
    *,
    timeout: float | tuple[float, float] | None = None,
    replace: bool = False,
) -> dict[str, Any]:
    payload = _build_register_payload(entries)
    if not payload and not replace:
        return {"registered": 0, "total": 0, "removed": 0}
    params = {"replace": "true"} if replace else None
    res = _request_at(
        base_url,
        "POST",
        "/live/register/bulk",
        json=payload,
        params=params,
        timeout=timeout,
    )
    if res.status_code != 200:
        raise MLServiceError(
            f"Failed to register cameras with ML service at {base_url}.",
            res.status_code,
        )
    return res.json()


def ml_unregister_camera_at(
    base_url: str,
    stream_key: str,
    *,
    timeout: float | tuple[float, float] | None = None,
) -> dict[str, Any]:
    key = (stream_key or "").strip()
    if not key:
        return {"removed": False}
    res = _request_at(
        base_url, "DELETE", f"/live/cam/{key}/register", timeout=timeout
    )
    if res.status_code != 200:
        raise MLServiceError(f"Failed to unregister camera {key} at {base_url}.", res.status_code)
    return res.json()


def ml_register_cameras_bulk(entries: list[dict[str, str]]) -> dict[str, Any]:
    payload = _build_register_payload(entries)
    if not payload:
        return {"registered": 0, "total": 0}
    res = _request("POST", "/live/register/bulk", json=payload)
    if res.status_code != 200:
        raise MLServiceError("Failed to register cameras with ML service.", res.status_code)
    return res.json()


def ml_unregister_camera(stream_key: str) -> dict[str, Any]:
    key = (stream_key or "").strip()
    if not key:
        return {"removed": False}
    res = _request("DELETE", f"/live/cam/{key}/register")
    if res.status_code != 200:
        raise MLServiceError(f"Failed to unregister camera {key}.", res.status_code)
    return res.json()


def ml_validate_human_face(file_bytes: bytes, filename: str = "face.jpg") -> dict[str, Any]:
    res = _request(
        "POST",
        "/validate/human-face",
        files={"image": (filename, file_bytes, "application/octet-stream")},
    )
    if res.status_code != 200:
        detail = res.text[:300]
        raise MLServiceError(f"Face validation failed: {detail}", res.status_code)
    return res.json()


def _video_search_timeout() -> int:
    return int(getattr(settings, "ML_VIDEO_SEARCH_TIMEOUT", 3600))


def _ml_is_local() -> bool:
    url = _base_url().lower()
    return "127.0.0.1" in url or "localhost" in url or "://[::1]" in url


def ml_start_video_search(
    *,
    image_path: str,
    video_path: str,
    face_threshold: float = 0.45,
    reid_threshold: float = 0.88,
    sample_fps: float = 0.0,
    clip_seconds: float = 4.0,
) -> dict[str, Any]:
    params = {
        "face_threshold": str(face_threshold),
        "reid_threshold": str(reid_threshold),
        "sample_fps": str(sample_fps),
        "clip_seconds": str(clip_seconds),
    }
    form: dict[str, str] = {}
    files: dict[str, Any] = {
        "image": ("query.jpg", open(image_path, "rb"), "application/octet-stream"),
    }
    handles: list[Any] = [files["image"][1]]
    if _ml_is_local():
        form["video_path"] = video_path
    else:
        video_handle = open(video_path, "rb")
        handles.append(video_handle)
        files["video"] = ("source.mp4", video_handle, "application/octet-stream")
    try:
        res = _request(
            "POST",
            "/search/video",
            files=files,
            data=form or None,
            params=params,
            timeout=_video_search_timeout(),
        )
    finally:
        for handle in handles:
            try:
                handle.close()
            except Exception:
                pass
    if res.status_code != 200:
        detail = res.text[:400]
        raise MLServiceError(f"Video search failed: {detail}", res.status_code)
    return res.json()


def ml_poll_video_search(job_id: str) -> dict[str, Any]:
    res = _request("GET", f"/search/video/{job_id.strip()}", timeout=30)
    if res.status_code != 200:
        detail = res.text[:400]
        raise MLServiceError(f"Video search status failed: {detail}", res.status_code)
    return res.json()


def ml_start_video_analyze(
    *,
    video_path: str,
    person: bool = True,
    vehicle: bool = True,
    weapon: bool = True,
    fire: bool = True,
    match_staff: bool = True,
    sample_fps: float = 1.0,
) -> dict[str, Any]:
    form: dict[str, str] = {
        "person": str(bool(person)).lower(),
        "vehicle": str(bool(vehicle)).lower(),
        "weapon": str(bool(weapon)).lower(),
        "fire": str(bool(fire)).lower(),
        "match_staff": str(bool(match_staff)).lower(),
        "sample_fps": str(sample_fps),
    }
    files: dict[str, Any] = {}
    handles: list[Any] = []
    if _ml_is_local():
        form["video_path"] = video_path
    else:
        video_handle = open(video_path, "rb")
        handles.append(video_handle)
        files["video"] = ("source.mp4", video_handle, "application/octet-stream")
    try:
        res = _request(
            "POST",
            "/analyze/video",
            files=files or None,
            data=form,
            timeout=_video_search_timeout(),
        )
    finally:
        for handle in handles:
            try:
                handle.close()
            except Exception:
                pass
    if res.status_code != 200:
        detail = res.text[:400]
        raise MLServiceError(f"Video AI test failed: {detail}", res.status_code)
    return res.json()


def ml_poll_video_analyze(job_id: str) -> dict[str, Any]:
    res = _request("GET", f"/analyze/video/{job_id.strip()}", timeout=30)
    if res.status_code != 200:
        detail = res.text[:400]
        raise MLServiceError(f"Video AI status failed: {detail}", res.status_code)
    return res.json()


def ml_download_video_analyze(job_id: str, dest: str) -> None:
    from pathlib import Path

    dest_path = Path(dest)
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    res = _request(
        "GET",
        f"/analyze/video/{job_id.strip()}/file",
        timeout=_video_search_timeout(),
        stream=True,
    )
    if res.status_code != 200:
        detail = res.text[:400]
        raise MLServiceError(f"Tagged video download failed: {detail}", res.status_code)
    with dest_path.open("wb") as out:
        for chunk in res.iter_content(chunk_size=1024 * 256):
            if chunk:
                out.write(chunk)
