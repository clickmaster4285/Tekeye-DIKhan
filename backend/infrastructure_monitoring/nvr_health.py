"""NVR health probing — channels & logs from the NVR (ISAPI / Dahua), not TekEye cameras."""

from __future__ import annotations

import logging
import time
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote
from xml.etree.ElementTree import Element

import requests
from requests.auth import HTTPBasicAuth, HTTPDigestAuth

logger = logging.getLogger(__name__)

# Suppress insecure-request warnings for LAN NVRs with self-signed certs / plain HTTP
try:
    import urllib3

    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except Exception:
    pass


def _tag(el: Element) -> str:
    return el.tag.split("}")[-1] if "}" in el.tag else el.tag


def _find_text(root: Element, *names: str) -> str:
    # Prefer names in the order given (not document order).
    for name in names:
        want = name.lower()
        for el in root.iter():
            if _tag(el).lower() == want and el.text and el.text.strip():
                return el.text.strip()
    return ""


def _find_direct(parent: Element, *names: str) -> str:
    for name in names:
        want = name.lower()
        for child in list(parent):
            if _tag(child).lower() == want and child.text and child.text.strip():
                return child.text.strip()
    return ""


def _http_request(
    method: str,
    ip: str,
    path: str,
    *,
    username: str,
    password: str,
    port: int = 80,
    timeout: float = 8.0,
    data: str | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[int | None, str]:
    url = f"http://{ip}:{port}{path}"
    hdrs = {"Content-Type": "application/xml"} if data else {}
    if headers:
        hdrs.update(headers)
    auths = []
    if username:
        auths.append(HTTPDigestAuth(username, password or ""))
        auths.append(HTTPBasicAuth(username, password or ""))
    else:
        auths.append(None)

    last_err = ""
    for auth in auths:
        try:
            res = requests.request(
                method,
                url,
                auth=auth,
                data=data,
                headers=hdrs or None,
                timeout=timeout,
                verify=False,
            )
            # Retry with other auth if unauthorized
            if res.status_code == 401 and auth is not None:
                last_err = "401 unauthorized"
                continue
            return res.status_code, res.text or ""
        except Exception as exc:
            last_err = str(exc)
            logger.debug("NVR HTTP %s %s failed: %s", method, url, exc)
    return None, last_err


def _http_get(ip: str, path: str, **kwargs) -> tuple[int | None, str]:
    return _http_request("GET", ip, path, **kwargs)


def _http_post(ip: str, path: str, data: str, **kwargs) -> tuple[int | None, str]:
    return _http_request("POST", ip, path, data=data, **kwargs)


def _safe_float(raw: Any) -> float | None:
    if raw is None or raw == "":
        return None
    try:
        return float(str(raw).replace("%", "").strip())
    except (TypeError, ValueError):
        return None


def _parse_kv(body: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in (body or "").splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def _truthy(val: str) -> bool:
    return val.strip().lower() in ("1", "true", "yes", "online", "ok", "normal", "connected")


def _channel_state_from_flags(*, online: bool, video_loss: bool) -> str:
    if video_loss:
        return "video_loss"
    if online:
        return "online"
    return "offline"


def _summarize_channels(items: list[dict[str, Any]]) -> dict[str, Any]:
    online = offline = video_loss = recording = 0
    for it in items:
        st = it.get("status") or "offline"
        if st == "online":
            online += 1
        elif st == "video_loss":
            video_loss += 1
        else:
            offline += 1
        if it.get("recording"):
            recording += 1
    return {
        "source": "nvr",
        "total": len(items),
        "online": online,
        "offline": offline,
        "video_loss": video_loss,
        "recording": recording,
        "items": items,
    }


def _format_link_speed(raw: Any) -> str:
    """Normalize NVR link speed to a human label (never show bare 0 as success)."""
    if raw is None or raw == "":
        return ""
    s = str(raw).strip()
    if not s:
        return ""
    lower = s.lower().replace(" ", "")
    if lower in ("0", "0m", "0mbps", "0mb", "unknown", "n/a", "na", "-"):
        return ""
    # Already labeled
    if "mbps" in lower or "gbps" in lower or "mbit" in lower:
        return s
    try:
        val = float(s.replace(",", ""))
    except ValueError:
        return s
    if val <= 0:
        return ""
    if val >= 1000 and val % 1000 == 0:
        gb = val / 1000
        if gb == int(gb):
            return f"{int(gb)} Gbps"
        return f"{gb:g} Gbps"
    if val == int(val):
        return f"{int(val)} Mbps"
    return f"{val:g} Mbps"


def _format_bytes(raw: Any) -> str:
    try:
        n = float(raw)
    except (TypeError, ValueError):
        return ""
    if n < 0:
        return ""
    units = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while n >= 1024 and i < len(units) - 1:
        n /= 1024
        i += 1
    if i == 0:
        return f"{int(n)} {units[i]}"
    return f"{n:.2f} {units[i]}"


def fetch_hikvision_network(
    ip: str, *, username: str, password: str, http_port: int = 80
) -> dict[str, Any]:
    """
    Parse NVR NIC status correctly.

    Hikvision XML often has:
      <NetworkInterface>
        <IPAddress><addressingType>static</addressingType>...</IPAddress>
        <Link><speed>1000</speed><duplex>full</duplex>...</Link>
      </NetworkInterface>

    We must NOT treat addressingType (static/dhcp) as interface status.
    """
    out: dict[str, Any] = {}
    code, body = _http_get(
        ip,
        "/ISAPI/System/Network/interfaces",
        username=username,
        password=password,
        port=http_port,
        timeout=10,
    )
    if code == 200 and body:
        try:
            root = ET.fromstring(body)
            best: dict[str, Any] = {}
            for iface in root.iter():
                if _tag(iface).lower() != "networkinterface":
                    continue
                iface_id = _find_direct(iface, "id") or "1"
                enabled = _find_direct(iface, "enabled", "enable") or _find_text(
                    iface, "enabled", "enable"
                )
                # Walk children for Link / IPAddress
                speed = ""
                duplex = ""
                mac = ""
                link_status = ""
                addressing = ""
                for child in list(iface):
                    t = _tag(child).lower()
                    if t == "link":
                        speed = (
                            _find_direct(child, "speed", "linkSpeed", "Speed")
                            or _find_text(child, "speed", "linkSpeed")
                        )
                        duplex = _find_direct(child, "duplex", "Duplex") or _find_text(
                            child, "duplex"
                        )
                        mac = _find_direct(child, "MACAddress", "macAddress") or _find_text(
                            child, "MACAddress", "macAddress"
                        )
                        link_status = (
                            _find_direct(child, "linkStatus", "connectionStatus", "status")
                            or _find_text(child, "linkStatus", "connectionStatus")
                        )
                    elif t == "ipaddress":
                        addressing = (
                            _find_direct(child, "addressingType", "ipAddressType")
                            or _find_text(child, "addressingType")
                        )
                # Prefer first interface with a real speed, else first
                candidate = {
                    "id": iface_id,
                    "enabled": enabled,
                    "speed": speed,
                    "duplex": duplex,
                    "mac": mac,
                    "link_status": link_status,
                    "addressing": addressing,
                }
                formatted = _format_link_speed(speed)
                if formatted and not best.get("_speed_ok"):
                    candidate["_speed_ok"] = True
                    best = candidate
                elif not best:
                    best = candidate
            if best:
                # Interface status: link up/down / enabled — never addressingType
                status = (best.get("link_status") or "").strip()
                if not status:
                    en = (best.get("enabled") or "").lower()
                    if en in ("true", "1", "yes"):
                        status = "up"
                    elif en in ("false", "0", "no"):
                        status = "down"
                    else:
                        status = "up"  # interface exists and answered
                out["network_interface_status"] = status
                out["network_addressing"] = best.get("addressing") or ""
                out["network_duplex"] = best.get("duplex") or ""
                out["network_mac"] = best.get("mac") or ""
                speed_label = _format_link_speed(best.get("speed"))
                if speed_label:
                    out["network_link_speed"] = speed_label
                elif best.get("duplex"):
                    # Speed 0 but duplex present — still useful
                    out["network_link_speed"] = f"Auto ({best.get('duplex')} duplex)"
                out["network_ok"] = True
                out["network_iface_id"] = best.get("id") or "1"
        except ET.ParseError as exc:
            logger.debug("network interfaces parse failed: %s", exc)

    iface_id = str(out.get("network_iface_id") or "1")

    # Dedicated link endpoint (some firmwares expose speed only here)
    if not out.get("network_link_speed"):
        for path in (
            f"/ISAPI/System/Network/interfaces/{iface_id}/link",
            f"/ISAPI/System/Network/interfaces/{iface_id}",
        ):
            sc, sb = _http_get(
                ip, path, username=username, password=password, port=http_port, timeout=8
            )
            if sc != 200 or not sb:
                continue
            try:
                root = ET.fromstring(sb)
                speed = _find_text(root, "speed", "linkSpeed", "Speed")
                duplex = _find_text(root, "duplex", "Duplex")
                link_status = _find_text(root, "linkStatus", "connectionStatus", "status")
                label = _format_link_speed(speed)
                if label:
                    out["network_link_speed"] = label
                elif duplex and not out.get("network_link_speed"):
                    out["network_link_speed"] = f"Auto ({duplex} duplex)"
                if link_status and not out.get("network_interface_status"):
                    out["network_interface_status"] = link_status
                if duplex:
                    out["network_duplex"] = duplex
                if label or duplex:
                    out["network_ok"] = True
                    break
            except ET.ParseError:
                continue

    # Traffic counters when available
    for path in (
        f"/ISAPI/System/Network/interfaces/{iface_id}/statistics",
        f"/ISAPI/System/Network/interfaces/{iface_id}/link/statistics",
        "/ISAPI/System/Network/interfaces/statistics",
    ):
        sc, sb = _http_get(
            ip, path, username=username, password=password, port=http_port, timeout=8
        )
        if sc != 200 or not sb:
            continue
        try:
            root = ET.fromstring(sb)
            rx = _find_text(
                root,
                "recvBytes",
                "rxBytes",
                "bytesReceived",
                "inOctets",
                "ifInOctets",
            )
            tx = _find_text(
                root,
                "sendBytes",
                "txBytes",
                "bytesSent",
                "outOctets",
                "ifOutOctets",
            )
            errs = _find_text(
                root,
                "errorPackets",
                "errors",
                "recvErrorPackets",
                "sendErrorPackets",
                "ifInErrors",
            )
            if rx:
                out["network_rx"] = _format_bytes(rx) or rx
            if tx:
                out["network_tx"] = _format_bytes(tx) or tx
            if errs:
                out["network_errors"] = errs
            if rx or tx:
                break
        except ET.ParseError:
            continue

    return out


def fetch_dahua_network(
    ip: str, *, username: str, password: str, http_port: int = 80
) -> dict[str, Any]:
    out: dict[str, Any] = {}
    code, body = _http_get(
        ip,
        "/cgi-bin/configManager.cgi?action=getConfig&name=Network",
        username=username,
        password=password,
        port=http_port,
        timeout=10,
    )
    if code == 200 and body:
        parsed = _parse_kv(body)
        # eth0.Speed / eth0.LinkMode / eth0.PhysicalAddress
        speed = (
            parsed.get("Network.eth0.Speed")
            or parsed.get("eth0.Speed")
            or parsed.get("Network.eth0.DefaultSpeed")
            or ""
        )
        # Sometimes Speed=0 means auto; DefaultSpeed or LinkMode holds real value
        label = _format_link_speed(speed)
        if not label:
            for k, v in parsed.items():
                if k.lower().endswith(".speed") or k.lower().endswith("linkspeed"):
                    label = _format_link_speed(v)
                    if label:
                        break
        if label:
            out["network_link_speed"] = label
        link = (
            parsed.get("Network.eth0.LinkMode")
            or parsed.get("eth0.LinkMode")
            or parsed.get("Network.eth0.EnableDhcp")
            or ""
        )
        if "dhcp" in str(parsed.get("Network.eth0.DhcpEnable", "")).lower():
            out["network_addressing"] = "dhcp"
        out["network_interface_status"] = "up" if label or link else "up"
        out["network_ok"] = True

    # NetApp work state
    code, body = _http_get(
        ip,
        "/cgi-bin/netApp.cgi?action=getInterfacesInfo",
        username=username,
        password=password,
        port=http_port,
        timeout=8,
    )
    if code == 200 and body:
        parsed = _parse_kv(body)
        for k, v in parsed.items():
            kl = k.lower()
            if "speed" in kl:
                label = _format_link_speed(v)
                if label:
                    out["network_link_speed"] = label
            if "link" in kl and "status" in kl:
                out["network_interface_status"] = v or out.get("network_interface_status")
            if "rx" in kl and ("byte" in kl or "octet" in kl):
                out["network_rx"] = _format_bytes(v) or v
            if "tx" in kl and ("byte" in kl or "octet" in kl):
                out["network_tx"] = _format_bytes(v) or v
        out["network_ok"] = True

    return out


# ─── Hikvision ISAPI ─────────────────────────────────────────────────────────


def fetch_hikvision_channels(
    ip: str, *, username: str, password: str, http_port: int = 80
) -> list[dict[str, Any]]:
    """Pull channel list + online/video-loss/recording from the NVR itself."""
    items: list[dict[str, Any]] = []
    by_id: dict[str, dict[str, Any]] = {}

    # 1) IP camera proxy channels (most NVR deployments)
    code, body = _http_get(
        ip,
        "/ISAPI/ContentMgmt/InputProxy/channels",
        username=username,
        password=password,
        port=http_port,
        timeout=10,
    )
    if code == 200 and body:
        try:
            root = ET.fromstring(body)
            for ch in root.iter():
                if _tag(ch).lower() not in ("inputproxychannel", "channel"):
                    continue
                cid = _find_direct(ch, "id", "channelID") or _find_text(ch, "id")
                if not cid:
                    continue
                name = (
                    _find_direct(ch, "name", "channelName")
                    or _find_text(ch, "name", "channelName")
                    or f"Channel {cid}"
                )
                src_ip = _find_text(ch, "ipAddress", "ipv4Address")
                enabled = _find_text(ch, "enable", "enabled", "online")
                by_id[cid] = {
                    "id": cid,
                    "channel": cid,
                    "name": name,
                    "code": src_ip or "",
                    "status": "online" if (not enabled or _truthy(enabled)) else "offline",
                    "recording": False,
                    "video_loss": False,
                    "source": "nvr_isapi",
                    "last_polled_at": datetime.now(timezone.utc).isoformat(),
                }
        except ET.ParseError as exc:
            logger.debug("InputProxy parse failed: %s", exc)

    # 2) Analog / video input channels (fallback / supplement)
    if not by_id:
        code, body = _http_get(
            ip,
            "/ISAPI/System/Video/inputs/channels",
            username=username,
            password=password,
            port=http_port,
            timeout=10,
        )
        if code == 200 and body:
            try:
                root = ET.fromstring(body)
                for ch in root.iter():
                    if _tag(ch).lower() not in ("videointputchannel", "videoinputchannel", "channel"):
                        continue
                    cid = _find_direct(ch, "id") or _find_text(ch, "id")
                    if not cid:
                        continue
                    name = _find_text(ch, "name", "channelName") or f"Channel {cid}"
                    by_id[cid] = {
                        "id": cid,
                        "channel": cid,
                        "name": name,
                        "code": "",
                        "status": "online",
                        "recording": False,
                        "video_loss": False,
                        "source": "nvr_isapi",
                        "last_polled_at": datetime.now(timezone.utc).isoformat(),
                    }
            except ET.ParseError:
                pass

    # 3) Per-channel / bulk status (online + video loss)
    code, body = _http_get(
        ip,
        "/ISAPI/ContentMgmt/InputProxy/channels/status",
        username=username,
        password=password,
        port=http_port,
        timeout=12,
    )
    if code == 200 and body:
        try:
            root = ET.fromstring(body)
            for st in root.iter():
                tag = _tag(st).lower()
                if tag not in (
                    "inputproxychannelstatus",
                    "channelstatus",
                    "status",
                ):
                    # Also match nested status blocks that have an id child
                    if _find_direct(st, "id", "channelID") == "" and tag != "inputproxychannelstatus":
                        continue
                cid = _find_direct(st, "id", "channelID") or _find_text(st, "id", "channelID")
                if not cid:
                    continue
                online_raw = _find_text(st, "online", "chanStatus", "connectionState", "signalStatus")
                video_loss_raw = _find_text(
                    st, "videoLoss", "signalLoss", "chanSrcSignalStatus", "srcSignalStatus"
                )
                online = _truthy(online_raw) if online_raw else True
                # Hikvision often uses online=false for disconnect; signal ok/abnormal
                if online_raw.lower() in ("offline", "disconnect", "disconnected", "0", "false"):
                    online = False
                video_loss = False
                if video_loss_raw:
                    vl = video_loss_raw.lower()
                    video_loss = vl in ("true", "1", "yes", "abnormal", "loss", "videoloss")
                    if vl in ("ok", "normal", "good"):
                        video_loss = False
                entry = by_id.get(cid) or {
                    "id": cid,
                    "channel": cid,
                    "name": f"Channel {cid}",
                    "code": "",
                    "recording": False,
                    "source": "nvr_isapi",
                    "last_polled_at": datetime.now(timezone.utc).isoformat(),
                }
                entry["video_loss"] = video_loss
                entry["status"] = _channel_state_from_flags(online=online, video_loss=video_loss)
                entry["online_raw"] = online_raw
                by_id[cid] = entry
        except ET.ParseError as exc:
            logger.debug("channel status parse failed: %s", exc)
    else:
        # Probe each channel status individually (slower, limited)
        for cid in list(by_id.keys())[:64]:
            sc, sb = _http_get(
                ip,
                f"/ISAPI/ContentMgmt/InputProxy/channels/{cid}/status",
                username=username,
                password=password,
                port=http_port,
                timeout=4,
            )
            if sc != 200 or not sb:
                continue
            try:
                root = ET.fromstring(sb)
                online_raw = _find_text(root, "online", "chanStatus")
                video_loss_raw = _find_text(root, "videoLoss", "srcSignalStatus")
                online = _truthy(online_raw) if online_raw else by_id[cid]["status"] == "online"
                if online_raw.lower() in ("offline", "disconnect", "disconnected", "0", "false"):
                    online = False
                video_loss = video_loss_raw.lower() in (
                    "true",
                    "1",
                    "abnormal",
                    "loss",
                    "videoloss",
                )
                by_id[cid]["status"] = _channel_state_from_flags(
                    online=online, video_loss=video_loss
                )
                by_id[cid]["video_loss"] = video_loss
            except ET.ParseError:
                continue

    # 4) Recording tracks → mark which channels are recording
    code, body = _http_get(
        ip,
        "/ISAPI/ContentMgmt/record/tracks",
        username=username,
        password=password,
        port=http_port,
        timeout=10,
    )
    recording_ids: set[str] = set()
    if code == 200 and body:
        try:
            root = ET.fromstring(body)
            for tr in root.iter():
                if _tag(tr).lower() not in ("track", "recordingtrack", "tracklist"):
                    if _find_direct(tr, "id", "Channel", "channel") == "" and _tag(tr).lower() != "track":
                        continue
                tid = _find_direct(tr, "id", "Channel", "channel", "channelID") or _find_text(
                    tr, "id", "Channel", "channelID"
                )
                enabled = _find_text(tr, "Enable", "enabled", "recording", "DefaultRecordingMode")
                desc = _find_text(tr, "description", "TrackDescription", "Type")
                # Track IDs often like 101, 201 for channel 1 main/sub
                if tid:
                    # Map 101 → channel 1 style and also keep full id
                    recording_ids.add(tid)
                    if len(tid) >= 3 and tid.isdigit():
                        recording_ids.add(str(int(tid) // 100))
                        recording_ids.add(tid[: len(tid) - 2] if len(tid) > 2 else tid)
                if enabled and not _truthy(enabled) and "disable" in enabled.lower():
                    continue
                if desc and "record" in desc.lower():
                    if tid:
                        recording_ids.add(tid)
        except ET.ParseError:
            pass

    for cid, entry in by_id.items():
        rec = cid in recording_ids
        # Also match track id patterns: channel 1 ↔ 101
        if not rec and cid.isdigit():
            rec = f"{cid}01" in recording_ids or any(
                rid.startswith(cid) for rid in recording_ids if rid.isdigit()
            )
        entry["recording"] = bool(rec)
        items.append(entry)

    # Sort by numeric channel id when possible
    def _sort_key(it: dict[str, Any]):
        c = str(it.get("channel") or "")
        return (0, int(c)) if c.isdigit() else (1, c)

    items.sort(key=_sort_key)
    return items


def fetch_hikvision_logs(
    ip: str,
    *,
    username: str,
    password: str,
    http_port: int = 80,
    page_size: int = 100,
    hours: int = 48,
    max_total: int = 5000,
) -> list[dict[str, Any]]:
    """
    Pull ALL log types from the NVR via ISAPI logSearch with pagination.

    Maps to NVR UI columns:
      Time | Major Type | Subtype | Channel No. | Local/Remote User | Remote Host IP
    """
    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=max(1, hours))
    start_s = start.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_s = end.strftime("%Y-%m-%dT%H:%M:%SZ")

    # Hikvision major-type codes commonly used in log search
    major_filters: list[str | None] = [
        None,  # unfiltered = all types
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
    ]

    paths = (
        "/ISAPI/ContentMgmt/logSearch",
        "/ISAPI/System/Logs/search",
    )

    collected: list[dict[str, Any]] = []
    seen: set[str] = set()

    def _ingest(rows: list[dict[str, Any]]) -> int:
        added = 0
        for row in rows:
            fp = row.get("fingerprint") or _log_fingerprint(row)
            if fp in seen:
                continue
            seen.add(fp)
            row["fingerprint"] = fp
            collected.append(row)
            added += 1
            if len(collected) >= max_total:
                break
        return added

    working_path: str | None = None
    for path in paths:
        # Probe with one unfiltered page
        probe_xml = _hik_log_search_xml(
            start_s, end_s, position=0, max_results=page_size, major_type=None
        )
        code, body = _http_post(
            ip,
            path,
            probe_xml,
            username=username,
            password=password,
            port=http_port,
            timeout=20,
        )
        if code in (200, 201) and body and ("match" in body.lower() or "log" in body.lower()):
            working_path = path
            _ingest(_parse_hikvision_log_xml(body))
            break

    if not working_path:
        # Fallback GET
        code, body = _http_get(
            ip,
            f"/ISAPI/System/Logs?limit={min(page_size, 200)}",
            username=username,
            password=password,
            port=http_port,
            timeout=15,
        )
        if code == 200 and body:
            _ingest(_parse_hikvision_log_xml(body))
        return collected[:max_total]

    # Paginate across major-type filters (ensures Alarm + Information + Operation etc.)
    for major in major_filters:
        if len(collected) >= max_total:
            break
        position = 0
        empty_streak = 0
        for _ in range(0, max_total // max(1, page_size) + 5):
            if len(collected) >= max_total:
                break
            xml_body = _hik_log_search_xml(
                start_s,
                end_s,
                position=position,
                max_results=page_size,
                major_type=major,
            )
            code, body = _http_post(
                ip,
                working_path,
                xml_body,
                username=username,
                password=password,
                port=http_port,
                timeout=25,
            )
            if code not in (200, 201) or not body:
                empty_streak += 1
                if empty_streak >= 2:
                    break
                position += page_size
                continue

            page_rows = _parse_hikvision_log_xml(body)
            status_str = ""
            num_matches = len(page_rows)
            try:
                root = ET.fromstring(body)
                status_str = (_find_text(root, "responseStatusStrg", "statusString") or "").upper()
                raw_n = _find_text(root, "numOfMatches", "totalMatches")
                if raw_n.isdigit():
                    num_matches = int(raw_n)
            except ET.ParseError:
                pass

            added = _ingest(page_rows)
            if (
                not page_rows
                or added == 0
                or "NO MATCHES" in status_str
                or num_matches == 0
            ):
                empty_streak += 1
                if empty_streak >= 2:
                    break
            else:
                empty_streak = 0

            # Advance position
            step = len(page_rows) if page_rows else page_size
            if step <= 0:
                break
            position += step
            # If fewer than page_size returned, this filter is exhausted
            if len(page_rows) < page_size:
                break

    # Newest first
    collected.sort(key=lambda r: r.get("time") or "", reverse=True)
    return collected[:max_total]


def _hik_log_search_xml(
    start_s: str,
    end_s: str,
    *,
    position: int,
    max_results: int,
    major_type: str | None,
) -> str:
    search_id = str(uuid.uuid4())
    major_block = ""
    if major_type is not None:
        major_block = f"""
  <majorTypeList>
    <majorType>{major_type}</majorType>
  </majorTypeList>"""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<CMSearchDescription>
  <searchID>{search_id}</searchID>
  <searchResultPosition>{int(position)}</searchResultPosition>
  <maxResults>{int(max_results)}</maxResults>
  <timeSpanList>
    <timeSpan>
      <startTime>{start_s}</startTime>
      <endTime>{end_s}</endTime>
    </timeSpan>
  </timeSpanList>{major_block}
</CMSearchDescription>"""


_HIK_MAJOR_TYPE_MAP = {
    "0": "None",
    "1": "Trigger Alarm",
    "2": "Exception",
    "3": "Operation",
    "4": "Information",
    "5": "Smart",
    "6": "Event",
    "7": "Industry",
    # text passthrough keys
    "alarm": "Trigger Alarm",
    "trigger alarm": "Trigger Alarm",
    "information": "Information",
    "exception": "Exception",
    "operation": "Operation",
}


def _map_major_type(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        return "—"
    key = s.lower()
    if key in _HIK_MAJOR_TYPE_MAP:
        return _HIK_MAJOR_TYPE_MAP[key]
    if s.isdigit() and s in _HIK_MAJOR_TYPE_MAP:
        return _HIK_MAJOR_TYPE_MAP[s]
    return s


def _parse_log_time(raw: str) -> datetime | None:
    if not raw or raw == "—":
        return None
    text = raw.strip().replace("Z", "+00:00")
    for fmt in (
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
    ):
        try:
            dt = datetime.strptime(text.replace("+00:00", ""), fmt) if "%z" not in fmt else datetime.strptime(text, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    try:
        # fromisoformat handles many cases
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def _log_fingerprint(row: dict[str, Any]) -> str:
    import hashlib

    parts = "|".join(
        [
            str(row.get("time") or ""),
            str(row.get("major_type") or ""),
            str(row.get("subtype") or row.get("minor_type") or ""),
            str(row.get("channel_no") or row.get("channel") or ""),
            str(row.get("local_remote_user") or row.get("user") or ""),
            str(row.get("remote_host_ip") or ""),
            str(row.get("description") or ""),
        ]
    )
    return hashlib.sha1(parts.encode("utf-8", errors="ignore")).hexdigest()


def _parse_hikvision_log_xml(body: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        return rows

    entry_tags = {
        "searchmatchitem",
        "matchelement",
        "logitem",
        "logentry",
        "item",
        "logdescriptor",
    }
    for item in root.iter():
        tag = _tag(item).lower()
        if tag not in entry_tags:
            continue
        # Skip empty containers that only wrap lists
        has_time = bool(
            _find_direct(item, "time", "logTime", "dateTime", "startTime")
            or _find_text(item, "time", "logTime", "dateTime", "startTime")
        )
        has_major = bool(
            _find_direct(item, "majorType", "MajorType")
            or _find_text(item, "majorType", "MajorType", "major")
        )
        has_minor = bool(
            _find_direct(item, "minorType", "MinorType", "subType")
            or _find_text(item, "minorType", "MinorType", "subType", "eventType")
        )
        if not (has_time or has_major or has_minor):
            continue

        ts = (
            _find_direct(item, "time", "logTime", "dateTime", "startTime")
            or _find_text(item, "time", "logTime", "dateTime", "startTime")
            or "—"
        )
        major_raw = (
            _find_direct(item, "majorType", "MajorType")
            or _find_text(item, "majorType", "MajorType", "major")
            or ""
        )
        subtype = (
            _find_direct(item, "minorType", "MinorType", "subType")
            or _find_text(item, "minorType", "MinorType", "subType", "eventType", "name")
            or ""
        )
        channel = (
            _find_direct(item, "channelID", "channelNo", "channel", "dynChannelID")
            or _find_text(item, "channelID", "channelNo", "channel", "dynChannelID")
            or ""
        )
        user = (
            _find_direct(item, "userName", "localUserName", "user", "localOrRemoteUser")
            or _find_text(item, "userName", "localUserName", "user", "localOrRemoteUser")
            or ""
        )
        remote_ip = (
            _find_direct(item, "remoteHostIP", "ipAddress", "remoteIP", "hostIP")
            or _find_text(item, "remoteHostIP", "ipAddress", "remoteIP", "hostIP")
            or ""
        )
        desc = (
            _find_direct(item, "description", "logDescription", "info", "detail")
            or _find_text(item, "description", "logDescription", "info", "detail")
            or subtype
            or "—"
        )
        # Skip totally empty rows
        if not major_raw and not subtype and (not ts or ts == "—"):
            continue

        # Normalize blank channel/user/ip to -- like NVR UI
        def _dash(v: str) -> str:
            v = (v or "").strip()
            return v if v and v.lower() not in ("0", "none", "null") else "--"

        row = {
            "time": ts,
            "major_type": _map_major_type(major_raw),
            "subtype": subtype or "—",
            "minor_type": subtype or "—",  # legacy alias
            "channel_no": _dash(channel),
            "channel": _dash(channel),
            "local_remote_user": _dash(user),
            "user": _dash(user),
            "remote_host_ip": _dash(remote_ip),
            "description": desc,
            "source": "nvr_isapi",
        }
        row["fingerprint"] = _log_fingerprint(row)
        rows.append(row)
    return rows


def persist_nvr_logs(device, logs: list[dict[str, Any]]) -> int:
    """Upsert NVR log rows into InfraNvrLog. Returns number newly created."""
    from .models import InfraNvrLog

    created = 0
    for row in logs or []:
        fp = row.get("fingerprint") or _log_fingerprint(row)
        dt = _parse_log_time(str(row.get("time") or ""))
        if dt is None:
            dt = datetime.now(timezone.utc)
        obj, was_created = InfraNvrLog.objects.get_or_create(
            device=device,
            fingerprint=fp,
            defaults={
                "log_time": dt,
                "major_type": (row.get("major_type") or "")[:128],
                "subtype": (row.get("subtype") or row.get("minor_type") or "")[:256],
                "channel_no": (row.get("channel_no") or row.get("channel") or "")[:32],
                "local_remote_user": (
                    row.get("local_remote_user") or row.get("user") or ""
                )[:128],
                "remote_host_ip": (row.get("remote_host_ip") or "")[:64],
                "description": row.get("description") or "",
                "raw": row,
            },
        )
        if was_created:
            created += 1
        else:
            # Keep raw updated
            obj.raw = row
            obj.save(update_fields=["raw"])
    return created


def load_stored_nvr_logs(device, *, limit: int = 5000) -> list[dict[str, Any]]:
    from .models import InfraNvrLog

    qs = InfraNvrLog.objects.filter(device=device).order_by("-log_time", "-id")[:limit]
    out = []
    for i, row in enumerate(qs, start=1):
        out.append(
            {
                "no": i,
                "time": row.log_time.strftime("%Y-%m-%d %H:%M:%S") if row.log_time else "—",
                "major_type": row.major_type or "—",
                "subtype": row.subtype or "—",
                "minor_type": row.subtype or "—",
                "channel_no": row.channel_no or "--",
                "channel": row.channel_no or "--",
                "local_remote_user": row.local_remote_user or "--",
                "user": row.local_remote_user or "--",
                "remote_host_ip": row.remote_host_ip or "--",
                "description": row.description or row.subtype or "—",
                "source": "nvr_db",
                "fingerprint": row.fingerprint,
            }
        )
    # Re-number so No. 1 is oldest or newest? NVR UI shows ascending No. with time order.
    # User sample: No. 8,9,10... with chronological time — keep newest-first display
    # but number 1..n in current list order (newest first).
    for i, row in enumerate(out, start=1):
        row["no"] = i
    return out


def _format_uptime(seconds: Any, raw: Any = None) -> str:
    """Format device uptime; raw numeric strings are treated as seconds."""
    secs = None
    try:
        if seconds is not None:
            secs = int(float(seconds))
    except (TypeError, ValueError):
        secs = None
    if secs is None and raw is not None:
        text = str(raw).strip()
        # Pure number → seconds
        try:
            if text.replace(".", "", 1).isdigit():
                secs = int(float(text))
        except ValueError:
            pass
        if secs is None and text:
            # Already human-readable
            return text
    if secs is None or secs < 0:
        return ""
    days, rem = divmod(secs, 86400)
    hours, rem = divmod(rem, 3600)
    mins, _ = divmod(rem, 60)
    if days > 0:
        return f"{days}d {hours}h {mins}m"
    if hours > 0:
        return f"{hours}h {mins}m"
    return f"{mins}m"


def _clamp_percent(val: float | None) -> float | None:
    if val is None:
        return None
    if val < 0:
        return None
    # Values like 2288 are MB totals wrongly used as %
    if val > 100:
        return None
    return round(float(val), 1)


def parse_hikvision_device_status_xml(body: str) -> dict[str, Any]:
    """
    Parse /ISAPI/System/status XML into cpu/ram/temp/uptime.

    Hikvision typically nests:
      <CPUList><CPU><cpuUtilization>12</cpuUtilization></CPU></CPUList>
      <MemoryList><Memory>
        <memoryUsage>45</memoryUsage>  OR available/total in KB/MB
      </Memory></MemoryList>
      <deviceUpTime>404371</deviceUpTime>
    """
    out: dict[str, Any] = {}
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        return out

    # —— CPU: average cpuUtilization nodes (do not double-count parent+child) ——
    cpu_vals: list[float] = []
    for el in root.iter():
        t = _tag(el).lower()
        if t in ("cpuutilization", "cpuusage") and el.text:
            v = _safe_float(el.text)
            if v is not None and 0 <= v <= 100:
                cpu_vals.append(v)
    if cpu_vals:
        out["cpu_percent"] = round(sum(cpu_vals) / len(cpu_vals), 1)
    else:
        out["cpu_percent"] = _clamp_percent(
            _safe_float(_find_text(root, "cpuUtilization", "CPUUtilization", "cpuUsage"))
        )

    # —— Memory ——
    # Hikvision often reports memoryUsage as *used MB* (e.g. 2286) plus
    # memoryAvailable as free MB — not a percentage. Older firmwares may
    # put a 0–100 percent in memoryUsage instead.
    mem_pct = None
    mem_total = None
    mem_avail = None
    mem_used = None
    for el in root.iter():
        t = _tag(el).lower()
        if t == "memory":
            usage = _safe_float(
                _find_direct(el, "memoryUsage", "memoryUtilization", "usage")
            )
            total = _safe_float(
                _find_direct(el, "memoryTotal", "total", "memorySize", "size")
            )
            avail = _safe_float(
                _find_direct(el, "memoryAvailable", "available", "freeMemory", "free")
            )
            used = _safe_float(_find_direct(el, "memoryUsed", "used"))
            if usage is not None and 0 <= usage <= 100:
                mem_pct = usage
            elif usage is not None and usage > 100:
                mem_used = usage
            if total is not None:
                mem_total = total
            if avail is not None:
                mem_avail = avail
            if used is not None:
                mem_used = used
        elif t in ("memoryusage", "memoryutilization"):
            v = _safe_float(el.text)
            if v is not None and 0 <= v <= 100:
                mem_pct = v
            elif v is not None and v > 100:
                mem_used = v
        elif t in ("memorytotal", "totalmemory"):
            mem_total = _safe_float(el.text) or mem_total
        elif t in ("memoryavailable", "freememory", "availablememory"):
            mem_avail = _safe_float(el.text) or mem_avail
        elif t in ("memoryused", "usedmemory"):
            mem_used = _safe_float(el.text) or mem_used

    if mem_pct is None:
        if mem_total and mem_total > 0:
            if mem_used is not None:
                mem_pct = (mem_used / mem_total) * 100
            elif mem_avail is not None:
                mem_pct = ((mem_total - mem_avail) / mem_total) * 100
        elif mem_used is not None and mem_avail is not None and (mem_used + mem_avail) > 0:
            # used MB + free MB → derive total and percent
            mem_total = mem_used + mem_avail
            mem_pct = (mem_used / mem_total) * 100

    out["memory_percent"] = _clamp_percent(mem_pct)
    if mem_total:
        out["memory_total"] = mem_total
    if mem_avail is not None:
        out["memory_available"] = mem_avail
    if mem_used is not None:
        out["memory_used"] = mem_used

    # —— Uptime (seconds) ——
    uptime = _find_text(root, "deviceUpTime", "upTime", "Uptime", "runTime")
    if uptime:
        out["uptime_raw"] = uptime
        secs = _safe_float(uptime)
        if secs is not None:
            out["uptime_seconds"] = secs
        out["uptime"] = _format_uptime(secs, uptime)

    # —— Temperature ——
    temp_vals: list[float] = []
    for el in root.iter():
        t = _tag(el).lower()
        if t in (
            "temperature",
            "devicetemperature",
            "cputemperature",
            "boardtemperature",
            "hightemperature",
            "temp",
        ):
            v = _safe_float(el.text)
            # Reasonable electronics range °C (or sometimes 10x)
            if v is None:
                continue
            if 0 <= v <= 120:
                temp_vals.append(v)
            elif 200 <= v <= 1200:
                # decidegrees
                temp_vals.append(v / 10.0)
    if temp_vals:
        out["temperature_c"] = round(sum(temp_vals) / len(temp_vals), 1)

    state = _find_text(root, "deviceStatus", "status", "workStatus")
    if state and state.lower() not in ("static", "dhcp"):
        out["system_state"] = state
    else:
        out.setdefault("system_state", "normal")

    out["system_status_ok"] = True
    return out


def fetch_hikvision_system_health(
    ip: str, *, username: str, password: str, http_port: int = 80
) -> dict[str, Any]:
    """CPU / RAM / temperature / uptime from NVR status (+ fallback endpoints)."""
    out: dict[str, Any] = {}
    code, body = _http_get(
        ip,
        "/ISAPI/System/status",
        username=username,
        password=password,
        port=http_port,
        timeout=10,
    )
    if code == 200 and body:
        out.update(parse_hikvision_device_status_xml(body))

    # Extra hardware / thermal endpoints used by some firmwares
    if out.get("temperature_c") is None or out.get("cpu_percent") is None:
        for path in (
            "/ISAPI/System/HardwareStatus",
            "/ISAPI/System/hardwareStatus",
            "/ISAPI/System/deviceStatus",
            "/ISAPI/System/WorkStatus",
        ):
            sc, sb = _http_get(
                ip, path, username=username, password=password, port=http_port, timeout=8
            )
            if sc != 200 or not sb:
                continue
            parsed = parse_hikvision_device_status_xml(sb)
            if out.get("cpu_percent") is None and parsed.get("cpu_percent") is not None:
                out["cpu_percent"] = parsed["cpu_percent"]
            if out.get("memory_percent") is None and parsed.get("memory_percent") is not None:
                out["memory_percent"] = parsed["memory_percent"]
            if out.get("temperature_c") is None and parsed.get("temperature_c") is not None:
                out["temperature_c"] = parsed["temperature_c"]
            if out.get("uptime_seconds") is None and parsed.get("uptime_seconds") is not None:
                out["uptime_seconds"] = parsed["uptime_seconds"]
                out["uptime"] = parsed.get("uptime") or _format_uptime(
                    parsed.get("uptime_seconds")
                )
            if parsed.get("system_state"):
                out.setdefault("system_state", parsed["system_state"])

    # Dahua-style CPU/mem if still missing (some rebranded units)
    if out.get("cpu_percent") is None:
        sc, sb = _http_get(
            ip,
            "/cgi-bin/magicBox.cgi?action=getCPUUsage",
            username=username,
            password=password,
            port=http_port,
            timeout=6,
        )
        if sc == 200 and sb:
            parsed = _parse_kv(sb)
            out["cpu_percent"] = _clamp_percent(
                _safe_float(parsed.get("usage") or parsed.get("CPUUsage"))
            )

    if out.get("memory_percent") is None:
        sc, sb = _http_get(
            ip,
            "/cgi-bin/magicBox.cgi?action=getMemoryInfo",
            username=username,
            password=password,
            port=http_port,
            timeout=6,
        )
        if sc == 200 and sb:
            parsed = _parse_kv(sb)
            total = _safe_float(parsed.get("total"))
            free = _safe_float(parsed.get("free"))
            if total and free is not None and total > 0:
                out["memory_percent"] = _clamp_percent(((total - free) / total) * 100)

    if out.get("uptime") is None and out.get("uptime_seconds") is not None:
        out["uptime"] = _format_uptime(out["uptime_seconds"], out.get("uptime_raw"))

    return out


def probe_hikvision_isapi(
    ip: str,
    *,
    username: str,
    password: str,
    http_port: int = 80,
) -> dict[str, Any]:
    """System/storage/network + channels + logs from Hikvision-compatible NVR."""
    metrics: dict[str, Any] = {"vendor_probe": "hikvision_isapi"}

    code, body = _http_get(
        ip, "/ISAPI/System/deviceInfo", username=username, password=password, port=http_port
    )
    if code == 200 and body:
        try:
            root = ET.fromstring(body)
            metrics["device_model"] = _find_text(root, "model", "deviceName")
            metrics["firmware_version"] = _find_text(root, "firmwareVersion", "firmwareVersionInfo")
            metrics["device_name"] = _find_text(root, "deviceName", "deviceID")
            metrics["serial_number"] = _find_text(root, "serialNumber")
            metrics["mac_address"] = _find_text(root, "macAddress")
            metrics["device_info_ok"] = True
        except ET.ParseError:
            metrics["device_info_ok"] = False

    metrics.update(
        fetch_hikvision_system_health(
            ip, username=username, password=password, http_port=http_port
        )
    )

    code, body = _http_get(
        ip,
        "/ISAPI/ContentMgmt/Storage",
        username=username,
        password=password,
        port=http_port,
    )
    if code == 200 and body:
        try:
            root = ET.fromstring(body)
            hdds = []
            capacity_total = free_total = used_total = 0.0
            errors = 0
            for hdd in root.iter():
                if _tag(hdd).lower() != "hdd":
                    continue
                status = _find_text(hdd, "status", "hddStatus") or "unknown"
                cap = _safe_float(_find_text(hdd, "capacity", "hddCapacity")) or 0.0
                free = _safe_float(_find_text(hdd, "freeSpace", "hddFreeSpace")) or 0.0
                capacity_total += cap
                free_total += free
                used = max(0.0, cap - free)
                used_total += used
                if status.lower() not in ("ok", "normal", "good", ""):
                    errors += 1
                hdds.append(
                    {
                        "status": status,
                        "capacity_mb": cap,
                        "free_mb": free,
                        "used_mb": used,
                    }
                )
            if hdds:
                metrics["hdd_list"] = hdds
                metrics["hdd_status"] = "error" if errors else "ok"
                metrics["hdd_capacity_mb"] = capacity_total
                metrics["hdd_free_mb"] = free_total
                metrics["hdd_used_mb"] = used_total
                metrics["hdd_errors"] = errors
                metrics["storage_ok"] = True
        except ET.ParseError:
            metrics["storage_ok"] = False

    net = fetch_hikvision_network(
        ip, username=username, password=password, http_port=http_port
    )
    metrics.update(net)

    code, body = _http_get(
        ip,
        "/ISAPI/ContentMgmt/record/tracks",
        username=username,
        password=password,
        port=http_port,
    )
    if code == 200:
        metrics["recording_status"] = "available"
        metrics["recording_ok"] = True
    elif code is not None:
        metrics["recording_status"] = "unknown"
        metrics["recording_ok"] = False

    # Channels + logs from NVR
    try:
        ch_items = fetch_hikvision_channels(
            ip, username=username, password=password, http_port=http_port
        )
        channels = _summarize_channels(ch_items)
        metrics["channels"] = channels
        metrics["channels_source"] = "nvr"
        metrics["channels_online"] = channels["online"]
        metrics["channels_offline"] = channels["offline"]
        metrics["channels_video_loss"] = channels["video_loss"]
        metrics["channels_recording"] = channels["recording"]
        metrics["channels_total"] = channels["total"]
        if channels["total"]:
            metrics["channels_ok"] = True
    except Exception as exc:
        metrics["channels_error"] = str(exc)[:200]

    try:
        logs = fetch_hikvision_logs(
            ip,
            username=username,
            password=password,
            http_port=http_port,
            page_size=100,
            hours=72,
            max_total=5000,
        )
        metrics["nvr_logs"] = logs
        metrics["nvr_logs_count"] = len(logs)
        metrics["nvr_logs_ok"] = True
    except Exception as exc:
        metrics["nvr_logs"] = []
        metrics["nvr_logs_error"] = str(exc)[:200]

    return metrics


# ─── Dahua CGI ───────────────────────────────────────────────────────────────


def fetch_dahua_channels(
    ip: str, *, username: str, password: str, http_port: int = 80
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    # Camera connection state
    code, body = _http_get(
        ip,
        "/cgi-bin/logicDeviceManager.cgi?action=getCameraState&channel=all",
        username=username,
        password=password,
        port=http_port,
        timeout=12,
    )
    states: dict[str, str] = {}
    if code == 200 and body:
        parsed = _parse_kv(body)
        # keys like channels[0].channel=1 / channels[0].connectionState=Connected
        tmp: dict[str, dict[str, str]] = {}
        for k, v in parsed.items():
            if not k.startswith("channels["):
                continue
            try:
                idx = k.split("[", 1)[1].split("]", 1)[0]
                field = k.split(".", 1)[1] if "." in k else "value"
            except IndexError:
                continue
            tmp.setdefault(idx, {})[field] = v
        for idx, fields in tmp.items():
            ch = fields.get("channel") or fields.get("UniqueChannel") or str(int(idx) + 1)
            conn = fields.get("connectionState") or fields.get("state") or ""
            states[ch] = conn

    code, body = _http_get(
        ip,
        "/cgi-bin/configManager.cgi?action=getConfig&name=ChannelTitle",
        username=username,
        password=password,
        port=http_port,
        timeout=10,
    )
    titles: dict[str, str] = {}
    if code == 200 and body:
        parsed = _parse_kv(body)
        for k, v in parsed.items():
            # ChannelTitle[0].Name=Gate
            if "ChannelTitle[" in k and k.endswith(".Name"):
                try:
                    idx = k.split("[", 1)[1].split("]", 1)[0]
                    titles[str(int(idx) + 1)] = v
                except ValueError:
                    pass

    # Build channel list from states or titles
    ids = sorted(set(states.keys()) | set(titles.keys()), key=lambda x: int(x) if x.isdigit() else x)
    if not ids:
        # Assume 16 channels if device answers system info only
        return items

    for ch in ids:
        conn = (states.get(ch) or "").lower()
        video_loss = "loss" in conn or "abnormal" in conn
        online = conn in ("connected", "connect", "ok", "normal", "online") or (
            conn == "" and ch in titles
        )
        if "disconnect" in conn or conn in ("idle", "empty", "none"):
            online = False
        status = _channel_state_from_flags(online=online, video_loss=video_loss)
        items.append(
            {
                "id": ch,
                "channel": ch,
                "name": titles.get(ch) or f"Channel {ch}",
                "code": "",
                "status": status,
                "recording": False,
                "video_loss": video_loss,
                "source": "nvr_dahua",
                "last_polled_at": datetime.now(timezone.utc).isoformat(),
                "connection_state": states.get(ch, ""),
            }
        )
    return items


def fetch_dahua_logs(
    ip: str,
    *,
    username: str,
    password: str,
    http_port: int = 80,
    max_results: int = 5000,
    hours: int = 72,
) -> list[dict[str, Any]]:
    end = datetime.now()
    start = end - timedelta(hours=max(1, hours))
    start_s = start.strftime("%Y-%m-%d %H:%M:%S")
    end_s = end.strftime("%Y-%m-%d %H:%M:%S")
    code, body = _http_get(
        ip,
        (
            "/cgi-bin/log.cgi?action=startFind"
            f"&condition.StartTime={quote(start_s)}"
            f"&condition.EndTime={quote(end_s)}"
        ),
        username=username,
        password=password,
        port=http_port,
        timeout=15,
    )
    token = ""
    if code == 200 and body:
        parsed = _parse_kv(body)
        token = parsed.get("token") or parsed.get("result") or ""
    logs: list[dict[str, Any]] = []
    if not token:
        return logs

    # Paginate doFind
    remaining = max_results
    while remaining > 0:
        batch = min(100, remaining)
        sc, sb = _http_get(
            ip,
            f"/cgi-bin/log.cgi?action=doFind&token={token}&count={batch}",
            username=username,
            password=password,
            port=http_port,
            timeout=20,
        )
        if sc != 200 or not sb:
            break
        parsed = _parse_kv(sb)
        buckets: dict[str, dict[str, str]] = {}
        for k, v in parsed.items():
            if not k.startswith("items["):
                continue
            try:
                idx = k.split("[", 1)[1].split("]", 1)[0]
                field = k.split(".", 1)[1]
            except IndexError:
                continue
            buckets.setdefault(idx, {})[field] = v
        if not buckets:
            break
        for idx in sorted(buckets.keys(), key=lambda x: int(x) if x.isdigit() else x):
            f = buckets[idx]
            row = {
                "time": f.get("Time") or f.get("time") or "—",
                "major_type": _map_major_type(f.get("Type") or f.get("type") or ""),
                "subtype": f.get("Detail") or f.get("detail") or f.get("Content") or "—",
                "minor_type": f.get("Detail") or f.get("detail") or "—",
                "channel_no": f.get("Channel") or f.get("channel") or "--",
                "channel": f.get("Channel") or f.get("channel") or "--",
                "local_remote_user": f.get("User") or f.get("user") or "--",
                "user": f.get("User") or "--",
                "remote_host_ip": f.get("Address") or f.get("RemoteAddress") or "--",
                "description": f.get("Detail") or f.get("detail") or "—",
                "source": "nvr_dahua",
            }
            row["fingerprint"] = _log_fingerprint(row)
            logs.append(row)
        remaining -= len(buckets)
        if len(buckets) < batch:
            break

    _http_get(
        ip,
        f"/cgi-bin/log.cgi?action=stopFind&token={token}",
        username=username,
        password=password,
        port=http_port,
        timeout=5,
    )
    return logs[:max_results]


def probe_dahua_cgi(
    ip: str,
    *,
    username: str,
    password: str,
    http_port: int = 80,
) -> dict[str, Any]:
    metrics: dict[str, Any] = {"vendor_probe": "dahua_cgi"}
    code, body = _http_get(
        ip,
        "/cgi-bin/magicBox.cgi?action=getSystemInfo",
        username=username,
        password=password,
        port=http_port,
    )
    if code == 200 and body:
        parsed = _parse_kv(body)
        metrics["device_model"] = parsed.get("deviceType") or parsed.get("serialNumber", "")
        metrics["serial_number"] = parsed.get("serialNumber", "")
        metrics["firmware_version"] = parsed.get("updateSerial") or parsed.get(
            "hardwareVersion", ""
        )
        metrics["device_info_ok"] = True

    code, body = _http_get(
        ip,
        "/cgi-bin/magicBox.cgi?action=getCPUUsage",
        username=username,
        password=password,
        port=http_port,
    )
    if code == 200 and body:
        parsed = _parse_kv(body)
        metrics["cpu_percent"] = _safe_float(parsed.get("usage") or parsed.get("CPUUsage"))

    code, body = _http_get(
        ip,
        "/cgi-bin/magicBox.cgi?action=getMemoryInfo",
        username=username,
        password=password,
        port=http_port,
    )
    if code == 200 and body:
        parsed = _parse_kv(body)
        total = _safe_float(parsed.get("total"))
        free = _safe_float(parsed.get("free"))
        if total and free is not None and total > 0:
            metrics["memory_percent"] = round(((total - free) / total) * 100, 1)

    try:
        metrics.update(
            fetch_dahua_network(ip, username=username, password=password, http_port=http_port)
        )
    except Exception as exc:
        metrics["network_error"] = str(exc)[:200]

    try:
        ch_items = fetch_dahua_channels(
            ip, username=username, password=password, http_port=http_port
        )
        channels = _summarize_channels(ch_items)
        metrics["channels"] = channels
        metrics["channels_source"] = "nvr"
        metrics["channels_online"] = channels["online"]
        metrics["channels_offline"] = channels["offline"]
        metrics["channels_video_loss"] = channels["video_loss"]
        metrics["channels_recording"] = channels["recording"]
        metrics["channels_total"] = channels["total"]
    except Exception as exc:
        metrics["channels_error"] = str(exc)[:200]

    try:
        logs = fetch_dahua_logs(ip, username=username, password=password, http_port=http_port)
        metrics["nvr_logs"] = logs
        metrics["nvr_logs_count"] = len(logs)
        metrics["nvr_logs_ok"] = True
    except Exception as exc:
        metrics["nvr_logs"] = []
        metrics["nvr_logs_error"] = str(exc)[:200]

    return metrics


# ─── Orchestration ───────────────────────────────────────────────────────────


def enrich_nvr_metrics(device) -> dict[str, Any]:
    """
    Probe the NVR appliance directly for health, camera channels, and logs.
    Does NOT use TekEye Camera Management camera records for channel status.
    """
    from .models import DeviceStatus

    metrics: dict[str, Any] = {
        k: v
        for k, v in (device.last_metrics or {}).items()
        # Drop stale TekEye-camera channel caches when re-enriching
        if k
        not in (
            "channels",
            "channels_online",
            "channels_offline",
            "channels_video_loss",
            "channels_recording",
            "channels_total",
            "nvr_logs",
        )
    }
    ip = (device.ip_address or "").strip() if device.ip_address else ""
    username = (device.username or "").strip()
    password = device.password or ""
    brand = (device.manufacturer or device.model_number or "").lower()
    http_port = int(device.onvif_port or 80)

    if not ip:
        metrics["channels"] = _summarize_channels([])
        metrics["nvr_logs"] = []
        metrics["vendor_probe_error"] = "No IP configured"
        return metrics

    if not username:
        metrics["channels"] = _summarize_channels([])
        metrics["nvr_logs"] = []
        metrics["vendor_probe_error"] = "NVR username/password required to read channels & logs"
        return metrics

    try:
        if "dahua" in brand:
            metrics.update(
                probe_dahua_cgi(ip, username=username, password=password, http_port=http_port)
            )
        else:
            hik = probe_hikvision_isapi(
                ip, username=username, password=password, http_port=http_port
            )
            metrics.update(hik)
            # If ISAPI deviceInfo failed, try Dahua as fallback
            if not hik.get("device_info_ok") and not hik.get("channels_ok"):
                dahua = probe_dahua_cgi(
                    ip, username=username, password=password, http_port=http_port
                )
                # Prefer whichever returned channels
                if (dahua.get("channels") or {}).get("total", 0) > (
                    hik.get("channels") or {}
                ).get("total", 0):
                    metrics.update(dahua)
                elif not metrics.get("nvr_logs") and dahua.get("nvr_logs"):
                    metrics["nvr_logs"] = dahua["nvr_logs"]
                    metrics["nvr_logs_count"] = len(dahua["nvr_logs"])
    except Exception as exc:
        metrics["vendor_probe_error"] = str(exc)[:200]

    metrics.setdefault("channels", _summarize_channels([]))
    metrics.setdefault("nvr_logs", [])
    metrics.setdefault("device_model", device.model_number or device.manufacturer)
    if device.serial_number:
        metrics.setdefault("serial_number", device.serial_number)
    metrics["nvr_name"] = device.name
    metrics["ip_address"] = ip
    metrics["polled_at_ts"] = time.time()
    metrics["channels_source"] = "nvr"

    # Persist every fetched log into DB (accumulates full history)
    try:
        created = persist_nvr_logs(device, metrics.get("nvr_logs") or [])
        metrics["nvr_logs_saved"] = created
        from .models import InfraNvrLog

        metrics["nvr_logs_count"] = InfraNvrLog.objects.filter(device=device).count()
        # Keep last_metrics small — full log history lives in InfraNvrLog
        metrics["nvr_logs"] = []
    except Exception as exc:
        metrics["nvr_logs_persist_error"] = str(exc)[:200]
        metrics["nvr_logs"] = []

    if device.status == DeviceStatus.ONLINE:
        metrics.setdefault("nvr_status", "Online")
    elif device.status == DeviceStatus.OFFLINE:
        metrics["nvr_status"] = "Offline"
    else:
        metrics.setdefault("nvr_status", device.get_status_display())
    metrics.setdefault("system_state", metrics.get("nvr_status", "unknown"))

    return metrics


def build_nvr_detail_payload(device) -> dict[str, Any]:
    """Structured detail payload — channels & logs sourced from the NVR."""
    m = dict(device.last_metrics or {})
    channels = m.get("channels") if isinstance(m.get("channels"), dict) else _summarize_channels([])
    # Never fall back to TekEye camera sync for this payload
    if channels.get("source") != "nvr" and not channels.get("items"):
        channels = _summarize_channels([])
        channels["source"] = "nvr"
    status_label = device.get_status_display()
    # Always serve accumulated DB logs (all types) when available
    try:
        logs = load_stored_nvr_logs(device, limit=5000)
    except Exception:
        logs = m.get("nvr_logs") if isinstance(m.get("nvr_logs"), list) else []
    if not logs and isinstance(m.get("nvr_logs"), list):
        logs = m["nvr_logs"]

    def mb_to_display(mb: Any) -> str | None:
        try:
            v = float(mb)
        except (TypeError, ValueError):
            return None
        if v >= 1024 * 1024:
            return f"{v / (1024 * 1024):.2f} TB"
        if v >= 1024:
            return f"{v / 1024:.2f} GB"
        return f"{v:.0f} MB"

    uptime = _format_uptime(m.get("uptime_seconds"), m.get("uptime_raw") or m.get("uptime"))
    if not uptime:
        uptime = "—"

    # Sanitize / recompute RAM (Hikvision often stores used MB in memoryUsage)
    ram = m.get("memory_percent")
    try:
        if ram is not None and float(ram) > 100:
            ram = None
    except (TypeError, ValueError):
        ram = None
    if ram is None:
        used = _safe_float(m.get("memory_used"))
        avail = _safe_float(m.get("memory_available"))
        total = _safe_float(m.get("memory_total"))
        if used is not None and used > 100 and avail is not None and (used + avail) > 0:
            ram = _clamp_percent((used / (used + avail)) * 100)
            total = total or (used + avail)
        elif total and total > 0 and avail is not None:
            ram = _clamp_percent(((total - avail) / total) * 100)
        elif total and total > 0 and used is not None:
            ram = _clamp_percent((used / total) * 100)

    cpu = m.get("cpu_percent")
    try:
        if cpu is not None and float(cpu) > 100:
            cpu = None
    except (TypeError, ValueError):
        cpu = None

    # This firmware's /ISAPI/System/status has no CPUList / temperature nodes.
    system_probed = bool(
        m.get("system_status_ok")
        or m.get("uptime_seconds") is not None
        or m.get("memory_available") is not None
        or m.get("memory_percent") is not None
        or ram is not None
    )
    not_reported = "Not reported by NVR"

    return {
        "id": device.id,
        "name": device.name,
        "status": device.status,
        "status_label": status_label,
        "ip_address": device.ip_address,
        "manufacturer": device.manufacturer,
        "model_number": device.model_number,
        "last_polled_at": device.last_polled_at.isoformat() if device.last_polled_at else None,
        "last_error": device.last_error,
        "channels_source": m.get("channels_source") or channels.get("source") or "nvr",
        "vendor_probe_error": m.get("vendor_probe_error") or m.get("channels_error") or "",
        "device_information": {
            "model": m.get("device_model") or device.model_number or device.manufacturer or "—",
            "firmware": m.get("firmware_version") or "—",
            "serial_number": m.get("serial_number") or device.serial_number or "—",
            "mac_address": m.get("mac_address") or device.mac_address or "—",
            "system_identifiers": m.get("device_name")
            or device.asset_tag
            or device.source_key
            or "—",
        },
        "system_health": {
            "nvr_status": m.get("nvr_status") or status_label,
            "system_state": m.get("system_state") or "—",
            "cpu_usage": cpu,
            "cpu_display": (
                f"{cpu:.1f}%" if cpu is not None else (not_reported if system_probed else "—")
            ),
            "ram_usage": ram,
            "ram_display": (
                f"{ram:.1f}%" if ram is not None else (not_reported if system_probed else "—")
            ),
            "temperature": m.get("temperature_c"),
            "temperature_display": (
                f"{float(m['temperature_c']):.1f} °C"
                if m.get("temperature_c") is not None
                else (not_reported if system_probed else "—")
            ),
            "uptime": uptime,
        },
        "storage_health": {
            "hdd_status": m.get("hdd_status") or "—",
            "hdd_capacity": mb_to_display(m.get("hdd_capacity_mb"))
            or m.get("hdd_capacity")
            or "—",
            "used_space": mb_to_display(m.get("hdd_used_mb")) or m.get("hdd_used") or "—",
            "free_space": mb_to_display(m.get("hdd_free_mb")) or m.get("hdd_free") or "—",
            "disk_errors": m.get("hdd_errors") if m.get("hdd_errors") is not None else "—",
            "hdd_list": m.get("hdd_list") or [],
        },
        "network_health": {
            "interface_status": (
                m.get("network_interface_status")
                if m.get("network_interface_status")
                not in (None, "", "static", "dhcp", "dynamic")
                else ("up" if device.status == "online" else "—")
            ),
            "link_speed": (
                m.get("network_link_speed")
                if m.get("network_link_speed") not in (None, "", "0", 0)
                else "—"
            ),
            "rx_traffic": m.get("network_rx") or m.get("rx_bytes") or "—",
            "tx_traffic": m.get("network_tx") or m.get("tx_bytes") or "—",
            "network_errors": m.get("network_errors")
            if m.get("network_errors") not in (None, "")
            else "—",
            "duplex": m.get("network_duplex") or "—",
            "addressing": m.get("network_addressing") or "—",
        },
        "recording": {
            "recording_status": m.get("recording_status") or "—",
            "recording_alarms": m.get("recording_alarms") or m.get("alarms") or "—",
        },
        "camera_channels": channels,
        "nvr_logs": logs,
        "nvr_logs_count": len(logs),
        "alarms": {
            "storage": m.get("alarm_storage") or "—",
            "network": m.get("alarm_network") or "—",
            "hardware": m.get("alarm_hardware") or "—",
            "other": m.get("alarms") or "—",
        },
        "raw_metrics": m,
    }
