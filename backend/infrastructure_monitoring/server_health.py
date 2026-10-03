"""
Server health: collect host metrics (CPU/RAM/disk/network/temp/services/GPU)
and shape them for the Infrastructure Monitoring detail UI.

Live collection normally runs on the target host via `server_agent` (push to
`update_metrics`). The Django poller can also pull from an agent HTTP endpoint
configured as device.port (default 9410) at `/infra-agent/metrics`.
"""

from __future__ import annotations

import hashlib
import json
import logging
import platform
import re
import socket
import subprocess
import time
import urllib.request
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

AGENT_DEFAULT_PORT = 9410


def _safe_float(v: Any) -> float | None:
    try:
        if v is None or v == "":
            return None
        return float(v)
    except (TypeError, ValueError):
        return None


def _clamp_percent(v: Any) -> float | None:
    n = _safe_float(v)
    if n is None:
        return None
    if n < 0:
        return 0.0
    if n > 100:
        return 100.0
    return round(n, 2)


def _bytes_display(n: Any) -> str:
    try:
        v = float(n)
    except (TypeError, ValueError):
        return "—"
    units = ["B", "KB", "MB", "GB", "TB", "PB"]
    i = 0
    while v >= 1024 and i < len(units) - 1:
        v /= 1024
        i += 1
    if i == 0:
        return f"{int(v)} {units[i]}"
    return f"{v:.2f} {units[i]}"


def _format_uptime(seconds: Any) -> str:
    try:
        s = int(float(seconds))
    except (TypeError, ValueError):
        return "—"
    if s < 0:
        return "—"
    days, rem = divmod(s, 86400)
    hours, rem = divmod(rem, 3600)
    mins, secs = divmod(rem, 60)
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours or days:
        parts.append(f"{hours}h")
    parts.append(f"{mins}m")
    if not days and not hours:
        parts.append(f"{secs}s")
    return " ".join(parts)


def _pct_display(v: Any, missing: str = "—") -> str:
    n = _clamp_percent(v)
    if n is None:
        return missing
    return f"{n:.1f}%"


def _temp_display(v: Any, missing: str = "—") -> str:
    n = _safe_float(v)
    if n is None:
        return missing
    return f"{n:.1f} °C"


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fingerprint(parts: list[Any]) -> str:
    raw = "|".join("" if p is None else str(p) for p in parts)
    return hashlib.sha1(raw.encode("utf-8", errors="ignore")).hexdigest()


def _collect_nvidia_gpus() -> list[dict[str, Any]]:
    query = (
        "name,uuid,utilization.gpu,utilization.memory,memory.total,memory.used,"
        "memory.free,temperature.gpu,power.draw,power.limit,fan.speed,"
        "clocks.current.graphics,clocks.current.memory,driver_version"
    )
    try:
        proc = subprocess.run(
            [
                "nvidia-smi",
                f"--query-gpu={query}",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError) as exc:
        logger.debug("nvidia-smi unavailable: %s", exc)
        return []

    if proc.returncode != 0 or not (proc.stdout or "").strip():
        return []

    gpus: list[dict[str, Any]] = []
    for idx, line in enumerate(proc.stdout.strip().splitlines()):
        cols = [c.strip() for c in line.split(",")]
        if len(cols) < 14:
            continue

        def num(i: int, row: list[str] = cols) -> float | None:
            return _safe_float(row[i]) if i < len(row) else None

        gpus.append(
            {
                "index": idx,
                "name": cols[0],
                "uuid": cols[1],
                "utilization_percent": _clamp_percent(num(2)),
                "memory_utilization_percent": _clamp_percent(num(3)),
                "vram_total_mb": num(4),
                "vram_used_mb": num(5),
                "vram_free_mb": num(6),
                "temperature_c": num(7),
                "power_draw_w": num(8),
                "power_limit_w": num(9),
                "fan_percent": _clamp_percent(num(10)),
                "clock_graphics_mhz": num(11),
                "clock_memory_mhz": num(12),
                "driver_version": cols[13] if len(cols) > 13 else "",
                "processes": [],
            }
        )

    try:
        pproc = subprocess.run(
            [
                "nvidia-smi",
                "--query-compute-apps=gpu_uuid,pid,process_name,used_memory",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
        if pproc.returncode == 0 and pproc.stdout:
            by_uuid = {g["uuid"]: g for g in gpus}
            for line in pproc.stdout.strip().splitlines():
                cols = [c.strip() for c in line.split(",")]
                if len(cols) < 4:
                    continue
                uuid, pid, name, mem = cols[0], cols[1], cols[2], cols[3]
                target = by_uuid.get(uuid)
                if not target:
                    continue
                target["processes"].append(
                    {"pid": pid, "name": name, "vram_mb": _safe_float(mem)}
                )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        pass

    return gpus


def _collect_temperatures_psutil(psutil_mod) -> dict[str, Any]:
    temps: dict[str, Any] = {"cpu_c": None, "sensors": []}
    try:
        readings = psutil_mod.sensors_temperatures(fahrenheit=False) or {}
    except Exception:
        return temps
    for name, entries in readings.items():
        for e in entries:
            label = getattr(e, "label", None) or name
            current = _safe_float(getattr(e, "current", None))
            temps["sensors"].append(
                {"name": str(label), "celsius": current, "source": str(name)}
            )
            if temps["cpu_c"] is None and current is not None:
                low = str(label).lower()
                if "cpu" in low or "core" in low or "package" in low or name.lower() in (
                    "coretemp",
                    "k10temp",
                    "acpitz",
                ):
                    temps["cpu_c"] = current
    if temps["cpu_c"] is None and temps["sensors"]:
        temps["cpu_c"] = temps["sensors"][0].get("celsius")
    return temps


def _collect_windows_services(limit: int = 80) -> list[dict[str, Any]]:
    if platform.system().lower() != "windows":
        return []
    try:
        proc = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                (
                    "Get-Service | Select-Object -First 200 Name,DisplayName,Status,StartType | "
                    "ConvertTo-Json -Compress"
                ),
            ],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return []
    if proc.returncode != 0 or not (proc.stdout or "").strip():
        return []
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return []
    if isinstance(data, dict):
        data = [data]
    out: list[dict[str, Any]] = []
    for row in data or []:
        status = str(row.get("Status") or "")
        out.append(
            {
                "name": row.get("Name") or "",
                "display_name": row.get("DisplayName") or "",
                "status": status,
                "start_type": str(row.get("StartType") or ""),
                "running": status.lower() in ("running", "4"),
            }
        )
        if len(out) >= limit:
            break
    return out


def _collect_linux_services(limit: int = 80) -> list[dict[str, Any]]:
    if platform.system().lower() != "linux":
        return []
    try:
        proc = subprocess.run(
            ["systemctl", "list-units", "--type=service", "--all", "--no-pager", "--plain"],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return []
    out: list[dict[str, Any]] = []
    for line in (proc.stdout or "").splitlines()[1:]:
        parts = line.split()
        if len(parts) < 4:
            continue
        unit, load, active, sub = parts[0], parts[1], parts[2], parts[3]
        if not unit.endswith(".service"):
            continue
        out.append(
            {
                "name": unit,
                "display_name": unit.replace(".service", ""),
                "status": f"{active}/{sub}",
                "start_type": load,
                "running": active == "active" and sub == "running",
            }
        )
        if len(out) >= limit:
            break
    return out


def _collect_windows_event_logs(limit_per_log: int = 40) -> list[dict[str, Any]]:
    if platform.system().lower() != "windows":
        return []
    logs: list[dict[str, Any]] = []
    sources = [
        ("System", "system"),
        ("Application", "application"),
        ("Security", "security"),
    ]
    for log_name, category in sources:
        ps = (
            f"Get-WinEvent -LogName {log_name} -MaxEvents {limit_per_log} -ErrorAction SilentlyContinue | "
            "Select-Object TimeCreated,Id,LevelDisplayName,ProviderName,Message | ConvertTo-Json -Compress"
        )
        try:
            proc = subprocess.run(
                ["powershell", "-NoProfile", "-Command", ps],
                capture_output=True,
                text=True,
                timeout=25,
                check=False,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
            continue
        if proc.returncode != 0 or not (proc.stdout or "").strip():
            continue
        try:
            rows = json.loads(proc.stdout)
        except json.JSONDecodeError:
            continue
        if isinstance(rows, dict):
            rows = [rows]
        for row in rows or []:
            level = str(row.get("LevelDisplayName") or "")
            msg = str(row.get("Message") or "")[:2000]
            cat = category
            if category == "security":
                cat = (
                    "access"
                    if re.search(r"logon|logoff|login", msg, re.I)
                    else "security"
                )
            if level.lower() in ("error", "critical"):
                cat = "error"
            ts = row.get("TimeCreated")
            log_time = None
            if isinstance(ts, str) and ts.startswith("/Date("):
                try:
                    ms = int(re.search(r"\d+", ts).group(0))  # type: ignore[union-attr]
                    log_time = datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat()
                except Exception:
                    log_time = _iso_now()
            elif isinstance(ts, str):
                log_time = ts
            else:
                log_time = _iso_now()
            event_id = str(row.get("Id") or "")
            provider = str(row.get("ProviderName") or log_name)
            logs.append(
                {
                    "log_time": log_time,
                    "category": cat,
                    "level": level,
                    "source": provider,
                    "user": "",
                    "remote_host": "",
                    "event_id": event_id,
                    "message": msg,
                    "fingerprint": _fingerprint([log_name, event_id, log_time, msg[:120]]),
                }
            )
    return logs


def collect_local_server_metrics() -> dict[str, Any]:
    try:
        import psutil
    except ImportError as exc:
        return {
            "server_probe": "local",
            "server_probe_error": f"psutil missing: {exc}",
            "agent_collected_at": _iso_now(),
        }

    boot = psutil.boot_time()
    uptime_seconds = max(0, int(time.time() - boot))
    vm = psutil.virtual_memory()
    swap = psutil.swap_memory()
    cpu_percent = _clamp_percent(psutil.cpu_percent(interval=0.3))
    cpu_per_core = [_clamp_percent(x) for x in psutil.cpu_percent(interval=0.1, percpu=True)]
    load_avg = None
    try:
        load_avg = list(psutil.getloadavg())  # type: ignore[attr-defined]
    except (AttributeError, OSError):
        load_avg = None

    disks = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
        except (PermissionError, OSError):
            continue
        disks.append(
            {
                "device": part.device,
                "mount": part.mountpoint,
                "fstype": part.fstype,
                "total_bytes": usage.total,
                "used_bytes": usage.used,
                "free_bytes": usage.free,
                "percent": _clamp_percent(usage.percent),
            }
        )

    net_if = []
    io = psutil.net_io_counters(pernic=True) or {}
    addrs = psutil.net_if_addrs() or {}
    stats = {}
    try:
        stats = psutil.net_if_stats() or {}
    except Exception:
        stats = {}
    for name, counters in io.items():
        ipv4 = ""
        for addr in addrs.get(name) or []:
            if getattr(addr, "family", None) == socket.AF_INET:
                ipv4 = addr.address
                break
        st = stats.get(name)
        net_if.append(
            {
                "name": name,
                "ip_address": ipv4,
                "is_up": bool(getattr(st, "isup", True)),
                "speed_mbps": getattr(st, "speed", None),
                "bytes_sent": counters.bytes_sent,
                "bytes_recv": counters.bytes_recv,
                "packets_sent": counters.packets_sent,
                "packets_recv": counters.packets_recv,
                "errin": counters.errin,
                "errout": counters.errout,
                "dropin": counters.dropin,
                "dropout": counters.dropout,
            }
        )

    temps = _collect_temperatures_psutil(psutil)
    services = _collect_windows_services() or _collect_linux_services()
    gpus = _collect_nvidia_gpus()
    logs = _collect_windows_event_logs()
    uname = platform.uname()

    return {
        "server_probe": "local",
        "agent_collected_at": _iso_now(),
        "hostname": socket.gethostname(),
        "os_name": uname.system,
        "os_release": uname.release,
        "os_version": uname.version,
        "architecture": uname.machine,
        "processor": uname.processor or platform.processor(),
        "cpu_count_logical": psutil.cpu_count(logical=True),
        "cpu_count_physical": psutil.cpu_count(logical=False),
        "cpu_percent": cpu_percent,
        "cpu_per_core": cpu_per_core,
        "load_avg": load_avg,
        "memory_percent": _clamp_percent(vm.percent),
        "memory_total": vm.total,
        "memory_used": vm.used,
        "memory_available": vm.available,
        "swap_percent": _clamp_percent(swap.percent),
        "swap_total": swap.total,
        "swap_used": swap.used,
        "uptime_seconds": uptime_seconds,
        "temperature_c": temps.get("cpu_c"),
        "temperature_sensors": temps.get("sensors") or [],
        "disks": disks,
        "network_interfaces": net_if,
        "services": services,
        "services_total": len(services),
        "services_running": sum(1 for s in services if s.get("running")),
        "services_stopped": sum(1 for s in services if not s.get("running")),
        "gpus": gpus,
        "gpu_count": len(gpus),
        "server_logs": logs,
        "server_logs_count": len(logs),
    }


# ---------------------------------------------------------------------------
# SSH collection (Linux hosts — no agent required)
# ---------------------------------------------------------------------------

_SSH_REMOTE_PY = r"""
import json, os, re, socket, subprocess, time, hashlib
from datetime import datetime, timezone

def sh(cmd, timeout=12):
    try:
        p = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return (p.stdout or "") + (p.stderr or "" if p.returncode and not p.stdout else "")
    except Exception as e:
        return ""

def safe_float(v):
    try:
        return float(v)
    except Exception:
        return None

now = datetime.now(timezone.utc).isoformat()
hostname = socket.gethostname()
uname = os.uname() if hasattr(os, "uname") else None
os_name = getattr(uname, "sysname", "Linux") if uname else "Linux"
os_release = getattr(uname, "release", "") if uname else ""
os_version = getattr(uname, "version", "") if uname else ""
architecture = getattr(uname, "machine", "") if uname else ""

# CPU percent via /proc/stat sample
def read_cpu():
    def snap():
        with open("/proc/stat") as f:
            parts = f.readline().split()
        vals = list(map(int, parts[1:8]))
        idle = vals[3] + vals[4]
        total = sum(vals)
        return idle, total
    i1, t1 = snap()
    time.sleep(0.25)
    i2, t2 = snap()
    dt, di = (t2 - t1), (i2 - i1)
    pct = 0.0 if dt <= 0 else max(0.0, min(100.0, (1 - di / dt) * 100))
    cores = []
    with open("/proc/stat") as f:
        for line in f:
            if line.startswith("cpu") and line[3:4].isdigit():
                cores.append(None)
    logical = len(cores) or (os.cpu_count() or 1)
    return round(pct, 2), logical

cpu_percent, cpu_logical = read_cpu()
load_avg = None
try:
    load_avg = list(os.getloadavg())
except Exception:
    pass

mem = {}
with open("/proc/meminfo") as f:
    for line in f:
        k, v = line.split(":", 1)
        mem[k] = int(v.strip().split()[0]) * 1024
mem_total = mem.get("MemTotal", 0)
mem_avail = mem.get("MemAvailable", mem.get("MemFree", 0))
mem_used = max(0, mem_total - mem_avail)
mem_pct = round((mem_used / mem_total) * 100, 2) if mem_total else None
swap_total = mem.get("SwapTotal", 0)
swap_free = mem.get("SwapFree", 0)
swap_used = max(0, swap_total - swap_free)
swap_pct = round((swap_used / swap_total) * 100, 2) if swap_total else 0

uptime_seconds = 0
try:
    with open("/proc/uptime") as f:
        uptime_seconds = int(float(f.read().split()[0]))
except Exception:
    pass

disks = []
for line in sh("df -B1 -P -x tmpfs -x devtmpfs -x squashfs 2>/dev/null").splitlines()[1:]:
    parts = line.split()
    if len(parts) < 6:
        continue
    total, used, free, pct_s, mount = parts[1], parts[2], parts[3], parts[4], parts[5]
    if not mount.startswith("/"):
        continue
    disks.append({
        "device": parts[0], "mount": mount, "fstype": "",
        "total_bytes": int(total), "used_bytes": int(used), "free_bytes": int(free),
        "percent": safe_float(pct_s.replace("%", "")),
    })

net_if = []
addrs = {}
for block in sh("ip -o -4 addr show 2>/dev/null").splitlines():
    p = block.split()
    if len(p) >= 4:
        addrs[p[1]] = p[3].split("/")[0]
stats = {}
try:
    with open("/proc/net/dev") as f:
        for line in f.readlines()[2:]:
            if ":" not in line:
                continue
            name, rest = line.split(":", 1)
            name = name.strip()
            cols = rest.split()
            if len(cols) < 16:
                continue
            net_if.append({
                "name": name,
                "ip_address": addrs.get(name, ""),
                "is_up": True,
                "speed_mbps": None,
                "bytes_recv": int(cols[0]), "packets_recv": int(cols[1]),
                "errin": int(cols[2]), "dropin": int(cols[3]),
                "bytes_sent": int(cols[8]), "packets_sent": int(cols[9]),
                "errout": int(cols[10]), "dropout": int(cols[11]),
            })
except Exception:
    pass

# temperatures
sensors = []
cpu_c = None
sens = sh("sensors -u 2>/dev/null")
for m in re.finditer(r"temp\d+_input:\s+([0-9.]+)", sens):
    val = safe_float(m.group(1))
    sensors.append({"name": "sensor", "celsius": val, "source": "lm-sensors"})
    if cpu_c is None:
        cpu_c = val
if cpu_c is None:
    for zone in sorted(os.listdir("/sys/class/thermal")) if os.path.isdir("/sys/class/thermal") else []:
        p = f"/sys/class/thermal/{zone}/temp"
        if os.path.isfile(p):
            try:
                raw = int(open(p).read().strip())
                val = raw / 1000.0 if raw > 1000 else float(raw)
                sensors.append({"name": zone, "celsius": val, "source": "thermal"})
                if cpu_c is None:
                    cpu_c = val
            except Exception:
                pass

services = []
for line in sh("systemctl list-units --type=service --all --no-pager --plain 2>/dev/null").splitlines()[1:]:
    parts = line.split()
    if len(parts) < 4 or not parts[0].endswith(".service"):
        continue
    unit, load, active, sub = parts[0], parts[1], parts[2], parts[3]
    services.append({
        "name": unit,
        "display_name": unit.replace(".service", ""),
        "status": f"{active}/{sub}",
        "start_type": load,
        "running": active == "active" and sub == "running",
    })
    if len(services) >= 80:
        break

gpus = []
smi = sh("nvidia-smi --query-gpu=name,uuid,utilization.gpu,utilization.memory,memory.total,memory.used,memory.free,temperature.gpu,power.draw,power.limit,fan.speed,clocks.current.graphics,clocks.current.memory,driver_version --format=csv,noheader,nounits 2>/dev/null")
for idx, line in enumerate((smi or "").strip().splitlines()):
    cols = [c.strip() for c in line.split(",")]
    if len(cols) < 14:
        continue
    gpus.append({
        "index": idx, "name": cols[0], "uuid": cols[1],
        "utilization_percent": safe_float(cols[2]),
        "memory_utilization_percent": safe_float(cols[3]),
        "vram_total_mb": safe_float(cols[4]), "vram_used_mb": safe_float(cols[5]),
        "vram_free_mb": safe_float(cols[6]), "temperature_c": safe_float(cols[7]),
        "power_draw_w": safe_float(cols[8]), "power_limit_w": safe_float(cols[9]),
        "fan_percent": safe_float(cols[10]),
        "clock_graphics_mhz": safe_float(cols[11]), "clock_memory_mhz": safe_float(cols[12]),
        "driver_version": cols[13], "processes": [],
    })
by_uuid = {g["uuid"]: g for g in gpus}
for line in sh("nvidia-smi --query-compute-apps=gpu_uuid,pid,process_name,used_memory --format=csv,noheader,nounits 2>/dev/null").splitlines():
    cols = [c.strip() for c in line.split(",")]
    if len(cols) < 4:
        continue
    g = by_uuid.get(cols[0])
    if g is not None:
        g["processes"].append({"pid": cols[1], "name": cols[2], "vram_mb": safe_float(cols[3])})

logs = []
def add_log(category, level, source, message, event_id=""):
    msg = (message or "")[:2000]
    fp = hashlib.sha1(f"{category}|{level}|{source}|{event_id}|{msg[:120]}|{now}".encode()).hexdigest()
    logs.append({
        "log_time": now, "category": category, "level": level, "source": source,
        "user": "", "remote_host": "", "event_id": event_id, "message": msg, "fingerprint": fp,
    })

for line in sh("journalctl -p err..alert -n 40 --no-pager -o short-iso 2>/dev/null").splitlines():
    if line.strip():
        add_log("error", "Error", "journal", line.strip())
for line in sh("journalctl -u ssh -u sshd -n 40 --no-pager -o short-iso 2>/dev/null").splitlines():
    if line.strip():
        add_log("access", "Info", "sshd", line.strip())
for line in sh("journalctl -n 40 --no-pager -o short-iso 2>/dev/null").splitlines():
    if line.strip():
        add_log("system", "Info", "journal", line.strip())

out = {
    "server_probe": "ssh",
    "agent_collected_at": now,
    "hostname": hostname,
    "os_name": os_name,
    "os_release": os_release,
    "os_version": os_version,
    "architecture": architecture,
        "processor": (
            next(
                (
                    ln.split(":", 1)[1].strip()
                    for ln in open("/proc/cpuinfo").read().splitlines()
                    if ln.lower().startswith("model name")
                ),
                "",
            )
            or sh("lscpu 2>/dev/null | awk -F: '/Model name/{print $2; exit}'").strip()
            or sh("uname -m 2>/dev/null").strip()
            or architecture
        ),
    "cpu_count_logical": cpu_logical,
    "cpu_count_physical": os.cpu_count(),
    "cpu_percent": cpu_percent,
    "cpu_per_core": [],
    "load_avg": load_avg,
    "memory_percent": mem_pct,
    "memory_total": mem_total,
    "memory_used": mem_used,
    "memory_available": mem_avail,
    "swap_percent": swap_pct,
    "swap_total": swap_total,
    "swap_used": swap_used,
    "uptime_seconds": uptime_seconds,
    "temperature_c": cpu_c,
    "temperature_sensors": sensors,
    "disks": disks,
    "network_interfaces": net_if,
    "services": services,
    "services_total": len(services),
    "services_running": sum(1 for s in services if s.get("running")),
    "services_stopped": sum(1 for s in services if not s.get("running")),
    "gpus": gpus,
    "gpu_count": len(gpus),
    "server_logs": logs,
    "server_logs_count": len(logs),
}
print(json.dumps(out))
"""


def collect_via_ssh(device) -> dict[str, Any]:
    """Collect host metrics over SSH using device username/password (Linux)."""
    ip = (device.ip_address or "").strip()
    username = (device.username or "").strip()
    password = (device.password or "").strip()
    if not ip:
        return {"server_probe_error": "No IP configured"}
    if not username:
        return {
            "server_probe": "pending_ssh",
            "server_probe_error": "Set SSH username (and password) on this server device, then Poll live.",
        }
    # Prefer SSH port 22; device.port 9410 is agent — ignore high agent ports for SSH
    port = int(device.port or 22)
    if port in (80, 443, AGENT_DEFAULT_PORT) or port >= 9000:
        port = 22

    try:
        import paramiko
    except ImportError:
        return {"server_probe_error": "paramiko not installed on TekEye backend"}

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    last_err: Exception | None = None
    try:
        # Prefer password auth only (avoid racing agent keys / double auth).
        try:
            client.connect(
                hostname=ip,
                port=port,
                username=username,
                password=password or None,
                timeout=15,
                auth_timeout=20,
                banner_timeout=20,
                allow_agent=False,
                look_for_keys=False,
            )
        except Exception as exc:
            last_err = exc
            # Fallback: keyboard-interactive (some sshd configs)
            if not password:
                raise
            transport = paramiko.Transport((ip, int(port)))
            transport.banner_timeout = 20
            transport.auth_timeout = 20
            transport.connect()

            def _kbd_handler(title, instructions, prompt_list):
                return [password for _ in prompt_list]

            try:
                transport.auth_interactive(username, _kbd_handler)
            except Exception:
                transport.auth_password(username, password)
            client._transport = transport  # noqa: SLF001

        # Upload script via stdin to python3
        cmd = "python3 -"
        stdin, stdout, stderr = client.exec_command(cmd, timeout=45)
        stdin.write(_SSH_REMOTE_PY)
        stdin.channel.shutdown_write()
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        if not out.strip():
            return {
                "server_probe": "ssh",
                "server_probe_error": (err or "Empty SSH response — is python3 installed?")[:300],
            }
        text = out.strip()
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            data = json.loads(text.splitlines()[-1])
        if not isinstance(data, dict):
            return {"server_probe_error": "SSH returned non-object JSON"}
        data["server_probe"] = "ssh"
        data["ssh_host"] = ip
        data["ssh_user"] = username
        data["server_probe_error"] = ""  # clear stale auth errors
        # Normalize unknown processor
        proc = str(data.get("processor") or "").strip()
        if not proc or proc.lower() in ("unknown", "x86_64", "amd64", "aarch64"):
            # keep architecture separately; prefer model name already in script
            if proc.lower() in ("unknown",):
                data["processor"] = data.get("architecture") or proc
        return data
    except Exception as exc:
        msg = str(last_err or exc)
        return {
            "server_probe": "ssh",
            "server_probe_error": f"SSH failed: {msg}"[:300],
        }
    finally:
        try:
            client.close()
        except Exception:
            pass


def fetch_agent_metrics(device) -> dict[str, Any]:
    ip = (device.ip_address or "").strip()
    if not ip:
        return {"server_probe_error": "No IP configured"}
    # Only try agent HTTP when port looks like an agent port
    port = int(device.port or 0) or AGENT_DEFAULT_PORT
    if port == 22:
        return {"server_probe_error": "Agent port not configured"}
    url = f"http://{ip}:{port}/infra-agent/metrics"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = resp.read().decode("utf-8", errors="replace")
        data = json.loads(body)
        if not isinstance(data, dict):
            return {"server_probe_error": "Agent returned non-object JSON"}
        data["server_probe"] = "agent_http"
        data["agent_url"] = url
        return data
    except Exception as exc:
        return {"server_probe_error": f"Agent pull failed: {exc}"[:300]}


def persist_server_logs(device, rows: list[dict[str, Any]]) -> int:
    from .models import InfraServerLog, ServerLogCategory

    created = 0
    valid_cats = {c.value for c in ServerLogCategory}
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        fp = row.get("fingerprint") or _fingerprint(
            [
                row.get("log_time"),
                row.get("category"),
                row.get("event_id"),
                row.get("message", "")[:120],
            ]
        )
        cat = str(row.get("category") or ServerLogCategory.OTHER).lower()
        if cat not in valid_cats:
            cat = ServerLogCategory.OTHER
        log_time_raw = row.get("log_time") or _iso_now()
        try:
            if isinstance(log_time_raw, datetime):
                log_time = log_time_raw
            else:
                log_time = datetime.fromisoformat(str(log_time_raw).replace("Z", "+00:00"))
        except Exception:
            log_time = datetime.now(timezone.utc)
        _, was_created = InfraServerLog.objects.get_or_create(
            device=device,
            fingerprint=fp,
            defaults={
                "log_time": log_time,
                "category": cat,
                "level": str(row.get("level") or "")[:32],
                "source": str(row.get("source") or "")[:200],
                "user": str(row.get("user") or "")[:128],
                "remote_host": str(row.get("remote_host") or "")[:64],
                "event_id": str(row.get("event_id") or "")[:64],
                "message": str(row.get("message") or "")[:8000],
                "raw": row,
            },
        )
        if was_created:
            created += 1
    return created


def load_stored_server_logs(
    device, limit: int = 2000, category: str | None = None
) -> list[dict[str, Any]]:
    from .models import InfraServerLog

    qs = InfraServerLog.objects.filter(device=device).order_by("-log_time", "-id")
    if category:
        qs = qs.filter(category=category)
    qs = qs[:limit]
    return [
        {
            "id": row.id,
            "log_time": row.log_time.isoformat() if row.log_time else None,
            "category": row.category,
            "level": row.level,
            "source": row.source,
            "user": row.user,
            "remote_host": row.remote_host,
            "event_id": row.event_id,
            "message": row.message,
            "fingerprint": row.fingerprint,
        }
        for row in qs
    ]


def enrich_server_metrics(device) -> dict[str, Any]:
    metrics: dict[str, Any] = {}
    local_ips: set[str] = set()
    try:
        local_ips.add(socket.gethostbyname(socket.gethostname()))
    except OSError:
        pass
    try:
        import psutil

        for addrs in (psutil.net_if_addrs() or {}).values():
            for a in addrs:
                if getattr(a, "family", None) == socket.AF_INET and a.address:
                    local_ips.add(a.address)
    except Exception:
        pass

    ip = (device.ip_address or "").strip()
    if ip and ip in local_ips:
        metrics.update(collect_local_server_metrics())
    else:
        # Prefer SSH (Linux agentless), then optional HTTP agent
        ssh_data = collect_via_ssh(device)
        if ssh_data.get("cpu_percent") is not None or ssh_data.get("memory_percent") is not None:
            metrics.update(ssh_data)
        else:
            pulled = fetch_agent_metrics(device)
            if pulled.get("cpu_percent") is not None or pulled.get("memory_percent") is not None:
                metrics.update(pulled)
            else:
                metrics["server_probe"] = ssh_data.get("server_probe") or "pending_ssh"
                err = ssh_data.get("server_probe_error") or pulled.get("server_probe_error") or ""
                if err:
                    metrics["server_probe_error"] = err

    logs = metrics.pop("server_logs", None) or []
    try:
        created = persist_server_logs(device, logs)
        metrics["server_logs_saved"] = created
        from .models import InfraServerLog

        metrics["server_logs_count"] = InfraServerLog.objects.filter(device=device).count()
    except Exception as exc:
        metrics["server_logs_persist_error"] = str(exc)[:200]
    metrics["server_logs"] = []
    metrics["polled_at_ts"] = time.time()
    return metrics


def build_server_detail_payload(device) -> dict[str, Any]:
    m = dict(device.last_metrics or {})
    waiting = "Set SSH user/password on this device, then Poll live"
    disks = m.get("disks") if isinstance(m.get("disks"), list) else []
    nics = m.get("network_interfaces") if isinstance(m.get("network_interfaces"), list) else []
    services = m.get("services") if isinstance(m.get("services"), list) else []
    gpus = m.get("gpus") if isinstance(m.get("gpus"), list) else []
    sensors = m.get("temperature_sensors") if isinstance(m.get("temperature_sensors"), list) else []

    try:
        all_logs = load_stored_server_logs(device, limit=3000)
    except Exception:
        all_logs = []

    def by_cat(cat: str) -> list[dict[str, Any]]:
        return [x for x in all_logs if x.get("category") == cat]

    cpu = _clamp_percent(m.get("cpu_percent"))
    ram = _clamp_percent(m.get("memory_percent"))
    has_agent = any(
        m.get(k) is not None
        for k in ("cpu_percent", "memory_percent", "hostname", "agent_collected_at")
    )
    probe = str(m.get("server_probe") or "")
    agent_status = "online" if has_agent else ("ssh_needed" if probe in ("pending_ssh", "") else probe or "pending")

    gpu_summary = []
    for g in gpus:
        if not isinstance(g, dict):
            continue
        gpu_summary.append(
            {
                "index": g.get("index"),
                "name": g.get("name") or f"GPU {g.get('index')}",
                "utilization_percent": g.get("utilization_percent"),
                "utilization_display": _pct_display(
                    g.get("utilization_percent"), waiting if not has_agent else "—"
                ),
                "vram_used_mb": g.get("vram_used_mb"),
                "vram_total_mb": g.get("vram_total_mb"),
                "vram_display": (
                    f"{_bytes_display((g.get('vram_used_mb') or 0) * 1024 * 1024)} / "
                    f"{_bytes_display((g.get('vram_total_mb') or 0) * 1024 * 1024)}"
                    if g.get("vram_total_mb") is not None
                    else ("—" if has_agent else waiting)
                ),
                "temperature_c": g.get("temperature_c"),
                "temperature_display": _temp_display(
                    g.get("temperature_c"), waiting if not has_agent else "—"
                ),
                "power_draw_w": g.get("power_draw_w"),
                "power_limit_w": g.get("power_limit_w"),
                "power_display": (
                    f"{g.get('power_draw_w')} / {g.get('power_limit_w')} W"
                    if g.get("power_draw_w") is not None
                    else ("—" if has_agent else waiting)
                ),
                "fan_percent": g.get("fan_percent"),
                "fan_display": _pct_display(
                    g.get("fan_percent"), waiting if not has_agent else "—"
                ),
                "clock_graphics_mhz": g.get("clock_graphics_mhz"),
                "clock_memory_mhz": g.get("clock_memory_mhz"),
                "clock_display": (
                    f"GCLK {g.get('clock_graphics_mhz')} · MCLK {g.get('clock_memory_mhz')} MHz"
                    if g.get("clock_graphics_mhz") is not None
                    else ("—" if has_agent else waiting)
                ),
                "driver_version": g.get("driver_version") or "",
                "processes": g.get("processes") if isinstance(g.get("processes"), list) else [],
            }
        )

    return {
        "id": device.id,
        "name": device.name,
        "status": device.status,
        "status_label": device.get_status_display(),
        "ip_address": device.ip_address,
        "manufacturer": device.manufacturer,
        "model_number": device.model_number,
        "server_role": device.network_role or "",
        "last_polled_at": device.last_polled_at.isoformat() if device.last_polled_at else None,
        "last_error": device.last_error,
        "agent_status": agent_status,
        "agent_hint": (
            ""
            if has_agent
            else (
                m.get("server_probe_error")
                or "Edit this server, set SSH Username + Password (port 22), then click Poll live."
            )
        ),
        # Hide stale auth errors when a successful metrics snapshot is already present
        "server_probe_error": (
            ""
            if has_agent
            else (m.get("server_probe_error") or "")
        ),
        "device_information": {
            "hostname": m.get("hostname") or device.name,
            "os_name": m.get("os_name") or ("—" if has_agent else waiting),
            "os_release": m.get("os_release") or "",
            "os_version": m.get("os_version") or "",
            "architecture": m.get("architecture") or "",
            "processor": m.get("processor") or "",
            "role": device.network_role or "",
            "ip_address": device.ip_address or "",
        },
        "cpu": {
            "usage_percent": cpu,
            "usage_display": _pct_display(cpu, waiting if not has_agent else "—"),
            "count_logical": m.get("cpu_count_logical"),
            "count_physical": m.get("cpu_count_physical"),
            "per_core": m.get("cpu_per_core") if isinstance(m.get("cpu_per_core"), list) else [],
            "load_avg": m.get("load_avg"),
        },
        "ram": {
            "usage_percent": ram,
            "usage_display": _pct_display(ram, waiting if not has_agent else "—"),
            "total_display": _bytes_display(m.get("memory_total"))
            if m.get("memory_total")
            else ("—" if has_agent else waiting),
            "used_display": _bytes_display(m.get("memory_used"))
            if m.get("memory_used")
            else ("—" if has_agent else waiting),
            "available_display": _bytes_display(m.get("memory_available"))
            if m.get("memory_available")
            else ("—" if has_agent else waiting),
            "swap_percent": _clamp_percent(m.get("swap_percent")),
            "swap_display": _pct_display(m.get("swap_percent"), "—"),
        },
        "disk": {
            "volumes": [
                {
                    **d,
                    "total_display": _bytes_display(d.get("total_bytes")),
                    "used_display": _bytes_display(d.get("used_bytes")),
                    "free_display": _bytes_display(d.get("free_bytes")),
                    "percent_display": _pct_display(d.get("percent")),
                }
                for d in disks
                if isinstance(d, dict)
            ],
            "count": len(disks),
        },
        "network": {
            "interfaces": [
                {
                    **n,
                    "bytes_sent_display": _bytes_display(n.get("bytes_sent")),
                    "bytes_recv_display": _bytes_display(n.get("bytes_recv")),
                    "status": "up" if n.get("is_up") else "down",
                }
                for n in nics
                if isinstance(n, dict)
            ],
            "count": len(nics),
        },
        "temperature": {
            "cpu_c": m.get("temperature_c"),
            "cpu_display": _temp_display(
                m.get("temperature_c"), waiting if not has_agent else "—"
            ),
            "sensors": sensors,
            "uptime": _format_uptime(m.get("uptime_seconds")),
        },
        "services": {
            "total": m.get("services_total")
            if m.get("services_total") is not None
            else len(services),
            "running": m.get("services_running"),
            "stopped": m.get("services_stopped"),
            "items": services,
        },
        "gpu": {
            "count": m.get("gpu_count") if m.get("gpu_count") is not None else len(gpu_summary),
            "items": gpu_summary,
        },
        "logs": {
            "total": len(all_logs),
            "error": by_cat("error"),
            "access": by_cat("access"),
            "system": by_cat("system"),
            "security": by_cat("security"),
            "application": by_cat("application"),
            "other": by_cat("other"),
            "all": all_logs[:500],
        },
        "raw_metrics": m,
    }
