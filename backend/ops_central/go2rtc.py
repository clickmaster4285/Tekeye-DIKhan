"""go2rtc client — register RTSP streams and exchange WebRTC SDP (viewing path)."""

from __future__ import annotations

import logging
from urllib.parse import quote, urljoin

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def go2rtc_configured() -> bool:
    return bool((getattr(settings, "GO2RTC_URL", "") or "").strip())


def go2rtc_base() -> str:
    return (getattr(settings, "GO2RTC_URL", "") or "").strip().rstrip("/")


def stream_name_for(server_id: int | None, stream_key: str) -> str:
    key = (stream_key or "").strip().replace("/", "_")
    if server_id is None:
        return key
    return f"s{server_id}_{key}"


def _source_variants(rtsp_url: str) -> list[str]:
    """
    H.265 NVR → H.264 for Chrome WebRTC.

    Soft libx264 first (stable SDP on these cameras). Optional GPU hardware next.
    Never use bare RTSP copy for WebRTC — Chrome rejects HEVC.
    """
    mode = (getattr(settings, "GO2RTC_VIDEO_MODE", "h264") or "h264").strip().lower()
    rtsp = (rtsp_url or "").strip()
    if not rtsp:
        return []
    if mode in ("copy", "hevc", "h265", "passthrough"):
        # Still wrap — bare HEVC breaks browser WebRTC
        return [f"ffmpeg:{rtsp}#video=h264#audio=copy"]
    soft = f"ffmpeg:{rtsp}#video=h264#audio=copy"
    hw = f"ffmpeg:{rtsp}#video=h264#hardware#audio=copy"
    if mode in ("h264_hw", "hardware", "gpu"):
        return [hw, soft]
    if mode in ("h264_soft", "soft", "cpu"):
        return [soft]
    return [soft, hw]


def _put_stream(name: str, src: str) -> bool:
    base = go2rtc_base()
    try:
        try:
            requests.delete(f"{base}/api/streams", params={"src": name}, timeout=5)
        except requests.RequestException:
            pass
        url = f"{base}/api/streams?name={quote(name, safe='')}&src={quote(src, safe='')}"
        res = requests.put(url, timeout=8)
        check = requests.get(f"{base}/api/streams", timeout=5)
        streams = check.json() if check.ok else {}
        return bool(isinstance(streams, dict) and name in streams) or res.status_code in (
            200,
            201,
            204,
        )
    except requests.RequestException as exc:
        logger.warning("go2rtc put %s failed: %s", name, exc)
        return False


def warm_stream(name: str, *, timeout: float = 25.0) -> bool:
    """Pull one JPEG so go2rtc starts ffmpeg/RTSP before WebRTC SDP."""
    base = go2rtc_base()
    if not base or not name:
        return False
    try:
        res = requests.get(
            f"{base}/api/frame.jpeg",
            params={"src": name},
            timeout=timeout,
        )
        ok = res.status_code == 200 and len(res.content or b"") > 1000
        if not ok:
            logger.warning(
                "go2rtc warm_stream %s → HTTP %s bytes=%s",
                name,
                res.status_code,
                len(res.content or b""),
            )
        return ok
    except requests.RequestException as exc:
        logger.warning("go2rtc warm_stream %s failed: %s", name, exc)
        return False


def ensure_stream(name: str, rtsp_url: str) -> bool:
    """Register stream; prefer first variant that warms a real JPEG frame."""
    base = go2rtc_base()
    variants = _source_variants(rtsp_url)
    if not base or not name or not variants:
        return False

    for src in variants:
        if not _put_stream(name, src):
            continue
        if warm_stream(name, timeout=20.0):
            logger.info("go2rtc stream %s ready via %s", name, src[:90])
            return True
        logger.warning("go2rtc stream %s warm failed for %s", name, src[:90])

    return _put_stream(name, variants[0])


def exchange_webrtc_sdp(name: str, offer_sdp: str) -> tuple[str | None, str]:
    """POST browser SDP offer to go2rtc; accept HTTP 200/201 with SDP body."""
    base = go2rtc_base()
    if not base:
        return None, "GO2RTC_URL is not configured."
    if not name:
        return None, "stream name required."
    if not (offer_sdp or "").strip():
        return None, "SDP offer required."

    url = urljoin(base + "/", f"api/webrtc?src={quote(name)}")
    try:
        res = requests.post(
            url,
            data=offer_sdp.encode("utf-8"),
            headers={"Content-Type": "application/sdp"},
            timeout=30,
        )
        answer = (res.text or "").strip()
        if res.status_code in (200, 201) and answer.startswith("v="):
            return answer, ""
        if res.status_code in (200, 201) and "v=0" in answer:
            return answer[answer.find("v=0") :], ""
        return None, f"go2rtc WebRTC HTTP {res.status_code}: {answer[:300]}"
    except requests.RequestException as exc:
        return None, str(exc)


def health_ok() -> bool:
    base = go2rtc_base()
    if not base:
        return False
    try:
        res = requests.get(f"{base}/api", timeout=3)
        return res.status_code == 200
    except requests.RequestException:
        return False
