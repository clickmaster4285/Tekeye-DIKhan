"""RTSP → MJPEG helpers (ffmpeg must be on PATH or FFMPEG_PATH in .env)."""

from __future__ import annotations

import os
import re
import shutil
import subprocess
from typing import Iterator


def resolve_ffmpeg_path() -> str | None:
    import sys

    from django.conf import settings

    custom = getattr(settings, "FFMPEG_PATH", "").strip()
    if custom and os.path.isfile(custom):
        if sys.platform == "win32" or not custom.lower().endswith(".exe"):
            if os.access(custom, os.X_OK):
                return custom
    found = shutil.which("ffmpeg")
    if found:
        return found
    return None


def ffmpeg_available() -> bool:
    return resolve_ffmpeg_path() is not None


def ffmpeg_path() -> str:
    path = resolve_ffmpeg_path()
    if not path:
        raise FileNotFoundError(
            "ffmpeg not found. Place ffmpeg in tools/ffmpeg/bin/ inside the project "
            "or set FFMPEG_PATH in backend/.env."
        )
    return path


def camera_label_from_url(url: str, index: int) -> str:
    match = re.search(r"@([\d.]+)", url)
    if match:
        return f"Camera {index + 1} ({match.group(1)})"
    return f"Camera {index + 1}"


# ——— GPU (NVDEC/NVENC) acceleration — same convention as ml_services/live_stream.py:
# GPU is used whenever available; set ML_RTSP_NVDEC=false / ML_FFMPEG_NVENC=false to force CPU. ———

_gpu_cuda_support: bool | None = None
_gpu_nvenc_support: bool | None = None

_NVENC_PRESET_MAP = {
    "ultrafast": "p1",
    "superfast": "p2",
    "veryfast": "p3",
    "faster": "p3",
    "fast": "p3",
    "medium": "p4",
    "slow": "p5",
    "slower": "p6",
    "veryslow": "p7",
}


def _cuda_device_index() -> str:
    raw = (os.getenv("ML_DEVICE", "0") or "0").strip().lower()
    if raw == "cpu":
        return "0"
    if raw.startswith("cuda:"):
        return raw.split(":", 1)[1] or "0"
    return raw if raw.isdigit() else "0"


def _ffmpeg_probe(exe: str, *flag: str) -> str:
    try:
        proc = subprocess.run([exe, "-hide_banner", *flag], capture_output=True, text=True, timeout=8)
        return f"{proc.stdout or ''}\n{proc.stderr or ''}".lower()
    except Exception:
        return ""


def use_nvdec() -> bool:
    """True when GPU RTSP/video decode (NVDEC) should be used — probed once, cached."""
    global _gpu_cuda_support
    val = os.getenv("ML_RTSP_NVDEC", os.getenv("FFMPEG_NVDEC", "true")).strip().lower()
    if val in ("0", "false", "no", "off"):
        return False
    if _gpu_cuda_support is None:
        exe = resolve_ffmpeg_path()
        _gpu_cuda_support = bool(exe) and "cuda" in _ffmpeg_probe(exe, "-hwaccels")
    return _gpu_cuda_support


def use_nvenc() -> bool:
    """True when GPU H.264 encode (NVENC) should be used — probed once, cached."""
    global _gpu_nvenc_support
    val = os.getenv("ML_FFMPEG_NVENC", os.getenv("FFMPEG_NVENC", "true")).strip().lower()
    if val in ("0", "false", "no", "off"):
        return False
    if _gpu_nvenc_support is None:
        exe = resolve_ffmpeg_path()
        _gpu_nvenc_support = bool(exe) and "h264_nvenc" in _ffmpeg_probe(exe, "-encoders")
    return _gpu_nvenc_support


def hwaccel_input_flags() -> list[str]:
    """CUDA decode flags to place before -i. Empty (CPU decode) when NVDEC is unavailable."""
    if not use_nvdec():
        return []
    return ["-hwaccel", "cuda", "-hwaccel_device", _cuda_device_index(), "-hwaccel_output_format", "cuda"]


def gpu_aware_vf(cpu_filter: str | None) -> str | None:
    """
    Prefix a CPU -vf chain with hwdownload when NVDEC decode is active, since decoded
    frames stay on the GPU (hwaccel_output_format=cuda) and CPU filters/encoders (mjpeg,
    scale, libx264) cannot read them directly.
    """
    if not use_nvdec():
        return cpu_filter
    download = "hwdownload,format=nv12"
    return f"{download},{cpu_filter}" if cpu_filter else download


def video_encoder_flags(*, crf: int = 23, preset: str = "veryfast") -> list[str]:
    """Prefer NVENC H.264 encode; CPU libx264 fallback. NVENC accepts CPU or CUDA frames."""
    if use_nvenc():
        cq = max(0, min(51, crf))
        return ["-c:v", "h264_nvenc", "-preset", _NVENC_PRESET_MAP.get(preset, "p4"), "-cq", str(cq)]
    return ["-c:v", "libx264", "-preset", preset, "-crf", str(crf)]


def capture_jpeg_frame(stream_url: str, timeout: float = 12.0) -> bytes | None:
    """Grab a single JPEG frame from RTSP or HTTP video via ffmpeg."""
    url = (stream_url or "").strip()
    if not url:
        return None
    exe = ffmpeg_path()
    cmd = [
        exe,
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        *hwaccel_input_flags(),
        "-rtsp_transport",
        "tcp",
        "-fflags",
        "+discardcorrupt",
        "-err_detect",
        "ignore_err",
        "-i",
        url,
        "-frames:v",
        "1",
    ]
    vf = gpu_aware_vf(None)
    if vf:
        cmd += ["-vf", vf]
    cmd += [
        "-f",
        "image2",
        "-q:v",
        "2",
        "pipe:1",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=timeout)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    if proc.returncode != 0 or not proc.stdout:
        return None
    return proc.stdout


def _stream_fps() -> int:
    from django.conf import settings

    raw = getattr(settings, "CAMERA_STREAM_FPS", None) or os.getenv("ML_LIVE_STREAM_FPS", "25")
    try:
        return max(1, int(float(raw)))
    except (TypeError, ValueError):
        return 25


def _preview_max_width() -> int:
    """0 = native NVR main-stream resolution (4K passthrough)."""
    try:
        from django.conf import settings

        raw = getattr(settings, "CAMERA_PREVIEW_MAX_WIDTH", None)
        if raw is not None:
            return max(0, int(raw))
    except Exception:
        pass
    try:
        return max(0, int(os.getenv("CAMERA_PREVIEW_MAX_WIDTH", "0")))
    except (TypeError, ValueError):
        return 0


def _preview_vf() -> str:
    fps = _stream_fps()
    max_w = _preview_max_width()
    if max_w <= 0:
        return f"fps={fps}"
    return f"fps={fps},scale='min(iw,{max_w})':-2:flags=lanczos"


def generate_mjpeg_frames(rtsp_url: str) -> Iterator[bytes]:
    """Yield multipart MJPEG chunks from an NVR main RTSP source via ffmpeg."""
    exe = ffmpeg_path()
    cmd = [
        exe,
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        *hwaccel_input_flags(),
        "-rtsp_transport",
        "tcp",
        "-fflags",
        "+discardcorrupt",
        "-err_detect",
        "ignore_err",
        "-i",
        rtsp_url,
        "-an",
        "-vf",
        gpu_aware_vf(_preview_vf()),
        "-f",
        "mjpeg",
        "-q:v",
        "3" if _preview_max_width() <= 0 else "8",
        "-",
    ]
    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            bufsize=0,
        )
    except FileNotFoundError:
        return
    if not proc.stdout:
        proc.kill()
        return

    buffer = b""
    try:
        while True:
            chunk = proc.stdout.read(4096)
            if not chunk:
                break
            buffer += chunk
            start = buffer.find(b"\xff\xd8")
            end = buffer.find(b"\xff\xd9")
            if start == -1 or end == -1 or end < start:
                continue
            jpg = buffer[start : end + 2]
            buffer = buffer[end + 2 :]
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n"
            )
    finally:
        proc.kill()
        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            proc.kill()


def generate_view_mjpeg_frames(
    rtsp_url: str,
    *,
    max_width: int = 1920,
    fps: int = 15,
    jpeg_quality: int = 3,
) -> Iterator[bytes]:
    """
    High-quality viewing MJPEG from NVR main RTSP (bypasses ML 720p buffer).
    max_width=0 keeps native resolution (e.g. 4K).
    """
    exe = ffmpeg_path()
    fps = max(5, min(int(fps), 30))
    q = max(2, min(int(jpeg_quality), 12))
    max_w = max(0, int(max_width))
    if max_w <= 0:
        vf_cpu = f"fps={fps}"
    else:
        vf_cpu = f"fps={fps},scale='min(iw,{max_w})':-2:flags=lanczos"
    cmd = [
        exe,
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        *hwaccel_input_flags(),
        "-rtsp_transport",
        "tcp",
        "-fflags",
        "nobuffer+discardcorrupt",
        "-flags",
        "low_delay",
        "-err_detect",
        "ignore_err",
        "-i",
        rtsp_url,
        "-an",
        "-vf",
        gpu_aware_vf(vf_cpu),
        "-f",
        "mjpeg",
        "-q:v",
        str(q),
        "-",
    ]
    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            bufsize=0,
        )
    except FileNotFoundError:
        return
    if not proc.stdout:
        proc.kill()
        return

    buffer = b""
    try:
        while True:
            chunk = proc.stdout.read(4096)
            if not chunk:
                break
            buffer += chunk
            start = buffer.find(b"\xff\xd8")
            end = buffer.find(b"\xff\xd9")
            if start == -1 or end == -1 or end < start:
                continue
            jpg = buffer[start : end + 2]
            buffer = buffer[end + 2 :]
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n"
            )
    finally:
        proc.kill()
        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            proc.kill()


def capture_view_jpeg_frame(
    rtsp_url: str,
    *,
    max_width: int = 1920,
    timeout: float = 12.0,
) -> bytes | None:
    """Single high-quality JPEG from NVR main RTSP (viewing path)."""
    url = (rtsp_url or "").strip()
    if not url:
        return None
    exe = ffmpeg_path()
    max_w = max(0, int(max_width))
    vf_cpu = None if max_w <= 0 else f"scale='min(iw,{max_w})':-2:flags=lanczos"
    cmd = [
        exe,
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        *hwaccel_input_flags(),
        "-rtsp_transport",
        "tcp",
        "-fflags",
        "+discardcorrupt",
        "-err_detect",
        "ignore_err",
        "-i",
        url,
        "-frames:v",
        "1",
    ]
    vf = gpu_aware_vf(vf_cpu)
    if vf:
        cmd += ["-vf", vf]
    cmd += ["-f", "image2", "-q:v", "2", "pipe:1"]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=timeout)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    if proc.returncode != 0 or not proc.stdout:
        return None
    return proc.stdout
