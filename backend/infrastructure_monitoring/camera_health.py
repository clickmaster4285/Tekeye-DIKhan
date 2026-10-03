"""Per-camera health: NVR channel status + direct ISAPI when the camera has its own IP."""

from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from typing import Any

from .models import DeviceStatus, DeviceType, InfraDevice
from .nvr_health import (
    _channel_state_from_flags,
    _find_direct,
    _find_text,
    _format_uptime,
    _http_get,
    _safe_float,
    _tag,
    _truthy,
    fetch_hikvision_network,
    fetch_hikvision_system_health,
)

logger = logging.getLogger(__name__)


def _meta(device) -> dict[str, Any]:
    return device.metadata if isinstance(device.metadata, dict) else {}


def _resolve_nvr_channel_id(raw: Any) -> str:
    """
    TekEye often stores Hikvision-style ids (101, 2501) while NVR InputProxy uses 1, 25.
    """
    if raw is None or raw == "":
        return ""
    text = str(raw).strip()
    try:
        ch = int(float(text))
    except (TypeError, ValueError):
        return text
    if ch >= 100:
        return str(ch // 100)
    return str(ch)


def _parent_nvr(device) -> InfraDevice | None:
    meta = _meta(device)
    nvr_id = meta.get("nvr_id")
    if nvr_id:
        obj = InfraDevice.objects.filter(
            source_key=f"cameras.nvr:{nvr_id}", device_type=DeviceType.NVR
        ).first()
        if obj:
            return obj
        obj = InfraDevice.objects.filter(id=nvr_id, device_type=DeviceType.NVR).first()
        if obj:
            return obj
    # Same IP as an infra NVR
    if device.ip_address:
        return (
            InfraDevice.objects.filter(
                device_type=DeviceType.NVR, ip_address=device.ip_address, is_active=True
            )
            .order_by("id")
            .first()
        )
    return None


def _nvr_http_creds(nvr: InfraDevice) -> tuple[str, str, str, int]:
    ip = (nvr.ip_address or "").strip()
    return ip, (nvr.username or "").strip(), nvr.password or "", int(nvr.onvif_port or 80)


def _parse_frame_rate(raw: Any) -> float | None:
    """Hikvision maxFrameRate is usually hundredths of fps (1200 → 12.0)."""
    v = _safe_float(raw)
    if v is None or v < 0:
        return None
    if v > 120:
        return round(v / 100.0, 1)
    return round(v, 1)


def _fetch_nvr_channel(
    nvr: InfraDevice, *, channel_id: str, camera_code: str = "", camera_name: str = ""
) -> dict[str, Any]:
    """Resolve InputProxy channel config + live status from the parent NVR."""
    ip, user, password, port = _nvr_http_creds(nvr)
    out: dict[str, Any] = {"channel_id": channel_id}

    if not ip or not user:
        out["error"] = "NVR credentials missing"
        return out

    # Resolve channel by id, else by name/code in the channel list
    resolved = channel_id
    if not resolved or camera_code or camera_name:
        code, body = _http_get(
            ip,
            "/ISAPI/ContentMgmt/InputProxy/channels",
            username=user,
            password=password,
            port=port,
            timeout=12,
        )
        if code == 200 and body:
            try:
                root = ET.fromstring(body)
                for ch in root.iter():
                    if _tag(ch).lower() not in ("inputproxychannel", "channel"):
                        continue
                    cid = _find_direct(ch, "id", "channelID") or _find_text(ch, "id")
                    name = (
                        _find_direct(ch, "name", "channelName")
                        or _find_text(ch, "name", "channelName")
                        or ""
                    )
                    if resolved and cid == resolved:
                        out["channel_name"] = name
                        break
                    code_u = (camera_code or "").strip().upper()
                    name_u = (camera_name or "").strip().upper()
                    if code_u and name.upper() == code_u:
                        resolved = cid
                        out["channel_name"] = name
                        break
                    if name_u and name.upper() == name_u:
                        resolved = cid
                        out["channel_name"] = name
                        break
            except ET.ParseError:
                pass

    if not resolved:
        out["error"] = "Could not resolve NVR channel"
        return out

    out["channel_id"] = resolved

    code, body = _http_get(
        ip,
        f"/ISAPI/ContentMgmt/InputProxy/channels/{resolved}",
        username=user,
        password=password,
        port=port,
        timeout=10,
    )
    if code == 200 and body:
        try:
            root = ET.fromstring(body)
            out["channel_name"] = out.get("channel_name") or _find_text(
                root, "name", "channelName"
            )
            out["camera_ip"] = _find_text(root, "ipAddress", "ipv4Address")
            out["manage_port"] = _safe_float(_find_text(root, "managePortNo", "managePort"))
            out["device_model"] = _find_text(root, "model")
            out["serial_number"] = _find_text(root, "serialNumber")
            out["firmware_version"] = _find_text(root, "firmwareVersion")
            out["proxy_protocol"] = _find_text(root, "proxyProtocol")
            out["channel_config_ok"] = True
        except ET.ParseError as exc:
            out["channel_config_error"] = str(exc)[:120]

    code, body = _http_get(
        ip,
        f"/ISAPI/ContentMgmt/InputProxy/channels/{resolved}/status",
        username=user,
        password=password,
        port=port,
        timeout=10,
    )
    if code == 200 and body:
        try:
            root = ET.fromstring(body)
            online_raw = _find_text(root, "online", "Online")
            online = _truthy(online_raw) if online_raw else False
            detect = (_find_text(root, "chanDetectResult", "srcSignalStatus") or "").lower()
            video_loss = detect in ("videoloss", "video_loss", "loss", "abnormal", "disconnect")
            if detect in ("connect", "connected", "normal", "ok"):
                video_loss = False
            vl_raw = _find_text(root, "videoLoss", "VideoLoss")
            if vl_raw:
                video_loss = _truthy(vl_raw)
            out["online"] = online
            out["video_loss"] = video_loss
            out["chan_detect"] = detect or online_raw or ""
            out["channel_status"] = _channel_state_from_flags(
                online=online, video_loss=video_loss
            )
            # streaming proxy ids e.g. 2501 / 2502
            stream_ids: list[str] = []
            for el in root.iter():
                if _tag(el).lower() == "streamingproxychannelid" and el.text:
                    stream_ids.append(el.text.strip())
            out["stream_ids"] = stream_ids
            out["channel_status_ok"] = True
        except ET.ParseError as exc:
            out["channel_status_error"] = str(exc)[:120]

    # Stream config (FPS / codec / resolution) from NVR streaming proxy or camera
    stream_id = ""
    ids = out.get("stream_ids") or []
    if ids:
        stream_id = ids[0]
    elif resolved:
        stream_id = f"{resolved}01"

    if stream_id:
        sc, sb = _http_get(
            ip,
            f"/ISAPI/ContentMgmt/StreamingProxy/channels/{stream_id}",
            username=user,
            password=password,
            port=port,
            timeout=8,
        )
        if sc == 200 and sb:
            try:
                root = ET.fromstring(sb)
                out["fps_configured"] = _parse_frame_rate(
                    _find_text(root, "maxFrameRate", "frameRate")
                )
                out["video_codec"] = _find_text(root, "videoCodecType", "codecType")
                w = _find_text(root, "videoResolutionWidth", "width")
                h = _find_text(root, "videoResolutionHeight", "height")
                if w and h:
                    out["resolution"] = f"{w}x{h}"
                out["stream_enabled"] = _truthy(_find_text(root, "enabled"))
                out["streaming_transport"] = _find_text(
                    root, "streamingTransport", "Transport"
                ) or "RTSP"
            except ET.ParseError:
                pass

    return out


def _probe_camera_direct(
    cam_ip: str, *, username: str, password: str, http_port: int = 80
) -> dict[str, Any]:
    """ISAPI health from the camera itself (preferred when NVR exposes camera IP)."""
    out: dict[str, Any] = {"camera_ip": cam_ip, "http_port": http_port}
    if not cam_ip or not username:
        return out

    code, body = _http_get(
        cam_ip,
        "/ISAPI/System/deviceInfo",
        username=username,
        password=password,
        port=http_port,
        timeout=8,
    )
    if code == 200 and body:
        try:
            root = ET.fromstring(body)
            out["device_model"] = _find_text(root, "model", "deviceName")
            out["firmware_version"] = _find_text(root, "firmwareVersion")
            out["serial_number"] = _find_text(root, "serialNumber")
            out["mac_address"] = _find_text(root, "macAddress")
            out["manufacturer"] = _find_text(root, "manufacturer", "systemContact")
            out["device_name"] = _find_text(root, "deviceName", "deviceID")
            out["device_info_ok"] = True
            out["management_online"] = True
        except ET.ParseError:
            out["device_info_ok"] = False

    health = fetch_hikvision_system_health(
        cam_ip, username=username, password=password, http_port=http_port
    )
    out.update(health)
    if health.get("system_status_ok"):
        out["management_online"] = True

    net = fetch_hikvision_network(
        cam_ip, username=username, password=password, http_port=http_port
    )
    out.update(net)

    # Main stream FPS / codec on the camera
    sc, sb = _http_get(
        cam_ip,
        "/ISAPI/Streaming/channels/101",
        username=username,
        password=password,
        port=http_port,
        timeout=8,
    )
    if sc == 200 and sb:
        try:
            root = ET.fromstring(sb)
            fps = _parse_frame_rate(_find_text(root, "maxFrameRate", "frameRate"))
            if fps is not None:
                out["fps_configured"] = fps
            out["video_codec"] = _find_text(root, "videoCodecType") or out.get("video_codec")
            w = _find_text(root, "videoResolutionWidth")
            h = _find_text(root, "videoResolutionHeight")
            if w and h:
                out["resolution"] = f"{w}x{h}"
            if _truthy(_find_text(root, "enabled")):
                out["rtsp_receiving"] = True
                out["streaming_transport"] = "RTSP"
        except ET.ParseError:
            pass

    return out


def enrich_camera_metrics(device) -> dict[str, Any]:
    """Live enrich one infra camera device; merge into last_metrics."""
    meta = _meta(device)
    metrics: dict[str, Any] = {
        "camera_probe": "isapi",
        "camera_code": meta.get("camera_code") or device.asset_tag or "",
        "channel_raw": meta.get("channel"),
    }
    nvr = _parent_nvr(device)
    channel_id = _resolve_nvr_channel_id(meta.get("channel"))
    metrics["nvr_channel_id"] = channel_id

    user = (device.username or "").strip()
    password = device.password or ""
    if nvr:
        metrics["parent_nvr_id"] = nvr.id
        metrics["parent_nvr_name"] = nvr.name
        if not user:
            user = (nvr.username or "").strip()
        if not password:
            password = nvr.password or ""
        ch = _fetch_nvr_channel(
            nvr,
            channel_id=channel_id,
            camera_code=str(metrics["camera_code"] or ""),
            camera_name=device.name or "",
        )
        metrics["nvr_channel"] = ch
        if ch.get("camera_ip"):
            metrics["camera_ip"] = ch["camera_ip"]
        if ch.get("online") is not None:
            metrics["channel_online"] = ch["online"]
        if ch.get("video_loss") is not None:
            metrics["video_loss"] = ch["video_loss"]
        if ch.get("channel_status"):
            metrics["channel_status"] = ch["channel_status"]
        for k in (
            "device_model",
            "serial_number",
            "firmware_version",
            "fps_configured",
            "video_codec",
            "resolution",
            "streaming_transport",
        ):
            if ch.get(k):
                metrics[k] = ch[k]
        if ch.get("online") and not ch.get("video_loss"):
            metrics["rtsp_receiving"] = True
        elif ch.get("online") is False or ch.get("video_loss"):
            metrics["rtsp_receiving"] = False

    cam_ip = (metrics.get("camera_ip") or "").strip()
    # Prefer real camera NIC; fall back to device IP only if it differs from NVR
    if not cam_ip and device.ip_address:
        if not nvr or str(device.ip_address) != str(nvr.ip_address):
            cam_ip = str(device.ip_address)

    if cam_ip and user:
        direct = _probe_camera_direct(
            cam_ip, username=user, password=password, http_port=80
        )
        metrics["direct_probe"] = {
            k: direct.get(k)
            for k in (
                "management_online",
                "device_info_ok",
                "system_status_ok",
                "network_ok",
                "camera_ip",
            )
            if k in direct
        }
        # Prefer direct camera readings when present
        for k, v in direct.items():
            if k in ("direct_probe",):
                continue
            if v is not None and v != "":
                metrics[k] = v
        metrics["camera_ip"] = cam_ip

    # SNMP UDP is often closed on these cameras; management plane via ISAPI counts as ONLINE
    if metrics.get("management_online") or metrics.get("channel_online"):
        metrics["snmp_status"] = "ONLINE"
        metrics["snmp_via"] = "ISAPI"
    elif device.status == DeviceStatus.ONLINE:
        metrics["snmp_status"] = "ONLINE"
        metrics["snmp_via"] = "ICMP"
    else:
        metrics["snmp_status"] = "OFFLINE"
        metrics["snmp_via"] = "none"

    # Image quality: no dedicated analytics on most firmwares — derive from signal health
    if metrics.get("video_loss"):
        metrics["image_blur"] = "DEGRADED"
        metrics["image_brightness"] = "UNKNOWN"
        metrics["image_visibility"] = "POOR"
        metrics["image_obstruction"] = "POSSIBLE"
    elif metrics.get("channel_online") or metrics.get("rtsp_receiving"):
        metrics["image_blur"] = "NORMAL"
        metrics["image_brightness"] = "NORMAL"
        metrics["image_visibility"] = "NORMAL"
        metrics["image_obstruction"] = "NONE"
    else:
        metrics["image_blur"] = "—"
        metrics["image_brightness"] = "—"
        metrics["image_visibility"] = "—"
        metrics["image_obstruction"] = "—"

    # Overall
    if metrics.get("video_loss"):
        metrics["overall_health"] = "VIDEO LOSS"
    elif metrics.get("channel_online") or metrics.get("management_online"):
        metrics["overall_health"] = "HEALTHY"
    elif device.status == DeviceStatus.ONLINE:
        metrics["overall_health"] = "HEALTHY"
    elif device.status == DeviceStatus.OFFLINE:
        metrics["overall_health"] = "OFFLINE"
    else:
        metrics["overall_health"] = "UNKNOWN"

    # Network summary label
    if metrics.get("network_ok") or metrics.get("channel_online") or metrics.get(
        "management_online"
    ):
        metrics["network_health"] = "HEALTHY"
    elif device.status == DeviceStatus.OFFLINE:
        metrics["network_health"] = "DOWN"
    else:
        metrics["network_health"] = "—"

    return metrics


def build_camera_detail_payload(device) -> dict[str, Any]:
    """Structured camera detail for the UI."""
    m = dict(device.last_metrics or {})
    meta = _meta(device)
    status_label = (
        "Online"
        if device.status == DeviceStatus.ONLINE
        else "Offline"
        if device.status == DeviceStatus.OFFLINE
        else device.get_status_display()
        if hasattr(device, "get_status_display")
        else str(device.status)
    )

    uptime = m.get("uptime") or _format_uptime(m.get("uptime_seconds"), m.get("uptime_raw"))
    if not uptime:
        uptime = "—"

    temp = m.get("temperature_c")
    temp_display = f"{float(temp):.0f}°C" if temp is not None else "Not reported by camera"

    fps = m.get("fps_configured")
    fps_display = f"{float(fps):.1f}" if fps is not None else "—"

    link = m.get("network_link_speed") or "—"
    if link in ("", "0", 0):
        link = "—"

    snmp = m.get("snmp_status") or ("ONLINE" if device.status == DeviceStatus.ONLINE else "—")
    rtsp = "RECEIVING" if m.get("rtsp_receiving") else (
        "LOST" if m.get("video_loss") else ("IDLE" if device.status == DeviceStatus.ONLINE else "—")
    )
    video_loss = m.get("video_loss")
    if video_loss is True:
        vl = "YES"
    elif video_loss is False:
        vl = "NO"
    else:
        vl = "—"

    cpu = m.get("cpu_percent")
    ram = m.get("memory_percent")
    try:
        if ram is not None and float(ram) > 100:
            ram = None
    except (TypeError, ValueError):
        ram = None

    return {
        "id": device.id,
        "name": device.name,
        "status": device.status,
        "status_label": status_label,
        "ip_address": m.get("camera_ip") or device.ip_address,
        "nvr_ip_address": device.ip_address,
        "manufacturer": device.manufacturer,
        "model_number": m.get("device_model") or device.model_number,
        "last_polled_at": device.last_polled_at.isoformat() if device.last_polled_at else None,
        "last_error": device.last_error,
        "camera_code": m.get("camera_code") or meta.get("camera_code") or device.asset_tag or "—",
        "channel": m.get("nvr_channel_id") or meta.get("channel") or "—",
        "parent_nvr_id": m.get("parent_nvr_id"),
        "parent_nvr_name": m.get("parent_nvr_name") or "—",
        "device_information": {
            "model": m.get("device_model") or device.model_number or device.manufacturer or "—",
            "firmware": m.get("firmware_version") or "—",
            "serial_number": m.get("serial_number") or device.serial_number or "—",
            "mac_address": m.get("mac_address") or m.get("network_mac") or device.mac_address or "—",
            "system_identifiers": m.get("device_name")
            or meta.get("camera_code")
            or device.asset_tag
            or "—",
            "camera_ip": m.get("camera_ip") or "—",
            "resolution": m.get("resolution") or "—",
            "codec": m.get("video_codec") or "—",
        },
        "summary": {
            "snmp_status": snmp,
            "snmp_via": m.get("snmp_via") or "—",
            "network": m.get("network_health") or "—",
            "uptime": uptime,
            "temperature": temp,
            "temperature_display": temp_display,
            "interface": link,
            "rtsp": rtsp,
            "fps": fps,
            "fps_display": fps_display,
            "video_loss": vl,
            "overall": m.get("overall_health") or status_label.upper(),
        },
        "image_quality": {
            "blur": m.get("image_blur") or "—",
            "brightness": m.get("image_brightness") or "—",
            "visibility": m.get("image_visibility") or "—",
            "obstruction": m.get("image_obstruction") or "—",
        },
        "system_health": {
            "cpu_usage": cpu,
            "cpu_display": f"{float(cpu):.1f}%" if cpu is not None else "Not reported by camera",
            "ram_usage": ram,
            "ram_display": f"{float(ram):.1f}%" if ram is not None else "Not reported by camera",
            "temperature_display": temp_display,
            "uptime": uptime,
        },
        "network_health": {
            "interface_status": (
                "up"
                if (
                    m.get("management_online")
                    or m.get("channel_online")
                    or (m.get("network_link_speed") not in (None, "", "0", 0))
                )
                else (m.get("network_interface_status") or "—")
            ),
            "link_speed": link,
            "duplex": m.get("network_duplex") or "—",
            "addressing": m.get("network_addressing") or "—",
            "mac_address": m.get("mac_address") or m.get("network_mac") or "—",
            "rx_traffic": m.get("network_rx") or "—",
            "tx_traffic": m.get("network_tx") or "—",
            "network_errors": m.get("network_errors")
            if m.get("network_errors") not in (None, "")
            else "—",
        },
        "alarms": {
            "video_loss": vl,
            "channel_status": m.get("channel_status") or "—",
            "hardware": "—",
            "network": "—" if (m.get("network_health") == "HEALTHY") else (m.get("network_health") or "—"),
        },
    }
