"""Probe infrastructure devices: ICMP, TCP, Modbus TCP (stdlib)."""

from __future__ import annotations

import logging
import socket
import struct
import subprocess
import sys
from typing import Any

logger = logging.getLogger(__name__)


def ping_host(ip: str, timeout_sec: float = 2.0) -> bool:
    """Return True if host responds to ICMP ping."""
    ip = (ip or "").strip()
    if not ip:
        return False
    try:
        if sys.platform == "win32":
            # -n 1 = one echo; -w timeout ms
            ms = max(200, int(timeout_sec * 1000))
            cmd = ["ping", "-n", "1", "-w", str(ms), ip]
        else:
            cmd = ["ping", "-c", "1", "-W", str(max(1, int(timeout_sec))), ip]
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_sec + 2,
        )
        return proc.returncode == 0
    except Exception as exc:
        logger.debug("ping %s failed: %s", ip, exc)
        return False


def tcp_open(ip: str, port: int, timeout_sec: float = 2.0) -> bool:
    ip = (ip or "").strip()
    if not ip or not port:
        return False
    try:
        with socket.create_connection((ip, int(port)), timeout=timeout_sec):
            return True
    except OSError:
        return False


def modbus_tcp_read_holding(
    ip: str,
    *,
    port: int = 502,
    unit_id: int = 1,
    address: int = 0,
    count: int = 1,
    timeout_sec: float = 3.0,
) -> list[int] | None:
    """
    Modbus TCP function 0x03 (Read Holding Registers).
    Returns list of 16-bit register values, or None on failure.
    """
    ip = (ip or "").strip()
    if not ip or count < 1 or count > 125:
        return None
    # MBAP + PDU
    transaction_id = 1
    protocol_id = 0
    unit = max(0, min(int(unit_id), 255))
    pdu = struct.pack(">BHH", 0x03, int(address) & 0xFFFF, int(count) & 0xFFFF)
    length = 1 + len(pdu)
    mbap = struct.pack(">HHHB", transaction_id, protocol_id, length, unit)
    packet = mbap + pdu
    try:
        with socket.create_connection((ip, int(port)), timeout=timeout_sec) as sock:
            sock.settimeout(timeout_sec)
            sock.sendall(packet)
            # header 7 bytes + function + bytecount + data
            header = _recv_exact(sock, 7)
            if not header:
                return None
            _tid, _pid, resp_len, _uid = struct.unpack(">HHHB", header)
            body = _recv_exact(sock, max(0, resp_len - 1))
            if not body or body[0] != 0x03:
                # Exception response starts with 0x83
                return None
            byte_count = body[1]
            data = body[2 : 2 + byte_count]
            if len(data) < byte_count:
                return None
            values = []
            for i in range(0, byte_count, 2):
                if i + 1 < len(data):
                    values.append(struct.unpack(">H", data[i : i + 2])[0])
            return values
    except OSError as exc:
        logger.debug("modbus %s:%s failed: %s", ip, port, exc)
        return None


def _recv_exact(sock: socket.socket, n: int) -> bytes:
    buf = b""
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            break
        buf += chunk
    return buf


def apply_register_map(
    raw_values_by_address: dict[int, int],
    register_map: list[dict[str, Any]],
) -> dict[str, Any]:
    """Map raw Modbus registers to named metrics using scale/unit."""
    metrics: dict[str, Any] = {}
    for entry in register_map or []:
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("name") or "").strip()
        if not name:
            continue
        try:
            reg = int(entry.get("register"))
        except (TypeError, ValueError):
            continue
        if reg not in raw_values_by_address:
            continue
        raw = raw_values_by_address[reg]
        scale = entry.get("scale", 1)
        try:
            scale_f = float(scale) if scale is not None else 1.0
        except (TypeError, ValueError):
            scale_f = 1.0
        value = raw * scale_f
        metrics[name] = value
        unit = entry.get("unit")
        if unit:
            metrics[f"{name}_unit"] = unit
    return metrics


def probe_device(device) -> dict[str, Any]:
    """
    Probe one InfraDevice. Returns dict:
      status, reachable, metrics, error, protocol_ok
    """
    from .models import DeviceStatus, DeviceType, ProtocolType

    ip = (device.ip_address or "").strip() if device.ip_address else ""
    metrics: dict[str, Any] = dict(device.last_metrics or {})
    error = ""
    reachable = False
    protocol_ok = False

    if not ip:
        return {
            "status": DeviceStatus.UNKNOWN,
            "reachable": False,
            "metrics": metrics,
            "error": "No IP configured",
            "protocol_ok": False,
        }

    # 1) Reachability
    reachable = ping_host(ip)
    if not reachable:
        # Fallback: TCP to a useful port
        fallback_port = device.port
        if not fallback_port:
            proto = device.primary_protocol
            if proto == ProtocolType.MODBUS_TCP:
                fallback_port = device.modbus_port or 502
            elif proto == ProtocolType.RTSP or device.device_type in (
                DeviceType.CAMERA,
                DeviceType.NVR,
            ):
                fallback_port = 554
            elif proto == ProtocolType.ONVIF:
                fallback_port = device.onvif_port or 80
            elif proto == ProtocolType.HTTP:
                fallback_port = device.port or 80
            elif device.device_type == DeviceType.SERVER:
                fallback_port = device.port or 22
            else:
                fallback_port = None
        if fallback_port:
            reachable = tcp_open(ip, int(fallback_port))

    if not reachable:
        return {
            "status": DeviceStatus.OFFLINE,
            "reachable": False,
            "metrics": {**metrics, "reachable": False},
            "error": "Host unreachable",
            "protocol_ok": False,
        }

    metrics["reachable"] = True
    metrics["latency_check"] = "ok"

    proto = device.primary_protocol

    # 2) Protocol-specific
    if proto == ProtocolType.MODBUS_TCP or device.supports_modbus:
        port = int(device.modbus_port or 502)
        unit = int(device.modbus_unit_id or 1)
        reg_map = device.modbus_register_map or []
        addresses: list[int] = []
        for entry in reg_map:
            if isinstance(entry, dict) and entry.get("register") is not None:
                try:
                    addresses.append(int(entry["register"]))
                except (TypeError, ValueError):
                    pass
        if not addresses:
            # Connectivity-only Modbus check
            protocol_ok = tcp_open(ip, port)
            if not protocol_ok:
                error = f"Modbus TCP port {port} closed"
        else:
            raw_by_addr: dict[int, int] = {}
            # Read each register individually (compatible with sparse maps)
            ok_any = False
            for addr in addresses:
                vals = modbus_tcp_read_holding(
                    ip, port=port, unit_id=unit, address=addr, count=1
                )
                if vals is not None and vals:
                    raw_by_addr[addr] = vals[0]
                    ok_any = True
            protocol_ok = ok_any
            if ok_any:
                metrics.update(apply_register_map(raw_by_addr, reg_map))
                # Normalize common aliases
                if "battery_soc" in metrics and "battery_percent" not in metrics:
                    metrics["battery_percent"] = metrics["battery_soc"]
                if "pv_power_kw" in metrics and "solar_kw" not in metrics:
                    metrics["solar_kw"] = metrics["pv_power_kw"]
            else:
                error = "Modbus read failed"
                # Port open still counts as degraded reachability
                if tcp_open(ip, port):
                    protocol_ok = False
                    error = "Modbus port open but register read failed"

    elif proto == ProtocolType.SNMP or (
        device.supports_snmp and device.device_type != DeviceType.NVR
    ):
        # Without pysnmp: treat ping as alive for SNMP targets.
        protocol_ok = True
        metrics["snmp_probe"] = "icmp_reachable"
        metrics.setdefault("snmp_community_configured", bool(device.snmp_community))

    elif proto in (ProtocolType.RTSP, ProtocolType.ONVIF) or device.device_type in (
        DeviceType.CAMERA,
        DeviceType.NVR,
    ):
        rtsp_port = int(device.port or 554)
        onvif_port = int(device.onvif_port or 80)
        rtsp_ok = tcp_open(ip, rtsp_port)
        onvif_ok = (
            tcp_open(ip, onvif_port)
            if device.supports_onvif or proto == ProtocolType.ONVIF
            else False
        )
        protocol_ok = rtsp_ok or onvif_ok or reachable
        metrics["rtsp_port_open"] = rtsp_ok
        if device.supports_onvif or proto == ProtocolType.ONVIF:
            metrics["onvif_port_open"] = onvif_ok
        if not protocol_ok:
            error = "Stream/management ports closed"

    elif proto == ProtocolType.HTTP:
        port = int(device.port or 80)
        protocol_ok = tcp_open(ip, port)
        if not protocol_ok:
            error = f"HTTP port {port} closed"
        else:
            metrics["http_port_open"] = True

    else:
        # ICMP-only
        protocol_ok = True

    # NVR health enrichment (ISAPI/Dahua + channel summary) whenever reachable
    if device.device_type == DeviceType.NVR and reachable:
        try:
            from .nvr_health import enrich_nvr_metrics

            metrics.update(enrich_nvr_metrics(device))
            protocol_ok = True
        except Exception as exc:
            logger.debug("NVR enrich failed: %s", exc)

    # Server agent pull / local collect whenever reachable
    if device.device_type == DeviceType.SERVER and reachable:
        try:
            from .server_health import enrich_server_metrics

            metrics.update(enrich_server_metrics(device))
            # Agent pending is still online for ICMP; keep protocol_ok True
            protocol_ok = True
        except Exception as exc:
            logger.debug("Server enrich failed: %s", exc)

    # Fault signal from metrics
    if metrics.get("inverter_fault") in (1, True, "1", "true", "True"):
        return {
            "status": DeviceStatus.FAULT,
            "reachable": True,
            "metrics": metrics,
            "error": error or "Inverter fault reported",
            "protocol_ok": protocol_ok,
        }

    if not protocol_ok and reachable:
        status = DeviceStatus.DEGRADED
    elif reachable and protocol_ok:
        status = DeviceStatus.ONLINE
    else:
        status = DeviceStatus.OFFLINE

    # Battery critical → degraded
    batt = metrics.get("battery_percent")
    try:
        if batt is not None and float(batt) < 15:
            status = DeviceStatus.DEGRADED
            metrics["battery_low"] = True
    except (TypeError, ValueError):
        pass

    return {
        "status": status,
        "reachable": reachable,
        "metrics": metrics,
        "error": error,
        "protocol_ok": protocol_ok,
    }
