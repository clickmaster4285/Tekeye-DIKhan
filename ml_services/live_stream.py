"""
Live RTSP streams with purpose-gated multi-model YOLO inference + optional plate OCR.
Only models relevant to each camera's purpose run on that feed.

Pipeline (decoupled — capture / infer / render never block each other):
  NVR main stream (4K) ──► FFmpeg NVDEC (native, no downscale)
         ▼
  Latest Frame Buffer
         ├─► Partitioned Inference Workers → Result Buffer
         └─► Render Thread → Browser MJPEG
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor
from pathlib import Path
from typing import Any, Iterator
from urllib.parse import quote

os.environ.setdefault("OPENCV_LOG_LEVEL", "SILENT")

_DEFAULT_FFMPEG_CAPTURE_OPTIONS = (
    "rtsp_transport;tcp|"
    "fflags;nobuffer+discardcorrupt|"
    "flags;low_delay|"
    "err_detect;ignore_err|"
    "probesize;500000|"
    "analyzeduration;500000|"
    "max_delay;0|"
    "reorder_queue_size;0|"
    "stimeout;5000000"
)
if "OPENCV_FFMPEG_CAPTURE_OPTIONS" not in os.environ:
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = os.getenv(
        "ML_RTSP_FFMPEG_OPTIONS",
        _DEFAULT_FFMPEG_CAPTURE_OPTIONS,
    )

import cv2
import numpy as np

from camera_byte_tracker import CameraByteTrackerPool
from face_recognizer import KnownFaceDB
from inference_engine import (
    ALLOWED_COCO_CLASS_IDS,
    SMOKE_FIRE_MIN_CONF,
    WEAPON_MIN_CONF,
    custom_only_class_ids,
    get_cuda_status,
    get_face_db,
    get_yolo_coco_model,
    get_yolo_custom_model,
    get_yolo_smoke_model,
    get_yolo_weapon_model,
    keep_custom_classes_only,
    merge_triple_detections,
    parse_yolo_result,
    resolve_coco_weights_path,
    resolve_custom_weights_path,
    resolve_ml_device,
    resolve_smoke_weights_path,
    resolve_weapon_weights_path,
)
from object_identity import get_object_identity_registry
from plate_recognizer import PlateEngine, get_plate_engine


def build_rtsp_url(
    ip: str,
    user: str = "admin",
    password: str = "",
    port: str | int = "554",
    path: str = "/Streaming/Channels/101",
) -> str:
    encoded_password = quote(password, safe="")
    if password:
        return f"rtsp://{user}:{encoded_password}@{ip}:{port}{path}"
    return f"rtsp://{user}@{ip}:{port}{path}"


def _rtsp_config() -> dict[str, str]:
    return {
        "user": os.getenv("CAMERA_RTSP_USER", "admin"),
        "password": os.getenv("CAMERA_RTSP_PASSWORD", ""),
        "port": os.getenv("CAMERA_RTSP_PORT", "554"),
        "path": os.getenv("CAMERA_RTSP_PATH", "/Streaming/Channels/101"),
    }


def _boot_camera_ips() -> list[str]:
    raw = os.getenv("ML_LIVE_BOOT_IPS", "").strip()
    if not raw:
        return []
    return [ip.strip() for ip in raw.split(",") if ip.strip()]


_CAM_KEY_RE = re.compile(r"^cam-\d+$", re.IGNORECASE)
_IPV4_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")


def _key_may_be_rtsp_host(key: str) -> bool:
    """True only when the stream key looks like an IP / hostname, not cam-{id}."""
    text = (key or "").strip()
    if not text or _CAM_KEY_RE.match(text):
        return False
    if _IPV4_RE.match(text):
        return True
    if "." in text and not text.startswith("cam-"):
        return True
    return text in _boot_camera_ips()


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _resolve_ffmpeg_path() -> str | None:
    custom = os.getenv("FFMPEG_PATH", "").strip()
    if custom and os.path.isfile(custom):
        return custom
    found = shutil.which("ffmpeg")
    if found:
        return found
    base = Path(__file__).resolve().parent.parent / "tools" / "ffmpeg" / "bin"
    for name in ("ffmpeg.exe", "ffmpeg"):
        candidate = base / name
        if candidate.is_file():
            return str(candidate)
    return None


def _rtsp_decode_backend() -> str:
    return os.getenv("ML_RTSP_DECODE", "ffmpeg").strip().lower()


def _cuda_device_index() -> str:
    """GPU index for NVDEC (from ML_DEVICE)."""
    raw = (os.getenv("ML_DEVICE", "0") or "0").strip()
    low = raw.lower()
    if low == "cpu":
        return "0"
    if low.startswith("cuda:"):
        return low.split(":", 1)[1] or "0"
    return raw if raw.isdigit() else "0"


def _nvdec_requested() -> bool:
    """User wants GPU decode always unless explicitly disabled."""
    val = os.getenv("ML_RTSP_NVDEC", "true").strip().lower()
    return val not in ("0", "false", "no", "off")


_ffmpeg_cuda_support: bool | None = None
_ffmpeg_cuda_logged = False


def _ffmpeg_supports_cuda(ffmpeg_path: str) -> bool:
    global _ffmpeg_cuda_support, _ffmpeg_cuda_logged
    if _ffmpeg_cuda_support is not None:
        return _ffmpeg_cuda_support
    try:
        proc = subprocess.run(
            [ffmpeg_path, "-hide_banner", "-hwaccels"],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
        blob = f"{proc.stdout or ''}\n{proc.stderr or ''}".lower()
        _ffmpeg_cuda_support = "cuda" in blob
    except Exception as exc:
        print(f"[live] ffmpeg CUDA probe failed: {exc}")
        _ffmpeg_cuda_support = False
    if not _ffmpeg_cuda_logged:
        _ffmpeg_cuda_logged = True
        if _ffmpeg_cuda_support:
            print(f"[live] NVDEC available via ffmpeg (device={_cuda_device_index()})")
        else:
            print(
                "[live] WARNING: ffmpeg has no CUDA hwaccel — "
                "install CUDA-enabled ffmpeg for GPU RTSP decode"
            )
    return _ffmpeg_cuda_support


def _use_nvdec(ffmpeg_path: str) -> bool:
    return _nvdec_requested() and _ffmpeg_supports_cuda(ffmpeg_path)


def _rtsp_scale_size() -> tuple[int, int]:
    """
    Live AI/view capture size after FFmpeg scale (NVR keeps original 4K recording).
    Default 0x0 = native 3840x2160 main-stream passthrough.
    """
    w = max(0, _env_int("ML_RTSP_SCALE_WIDTH", 0))
    h = max(0, _env_int("ML_RTSP_SCALE_HEIGHT", 0))
    return w, h


def _ffmpeg_threads() -> str:
    return os.getenv("ML_FFMPEG_THREADS", "1").strip() or "1"


def _ffmpeg_socket_timeout_us() -> str:
    return os.getenv("ML_FFMPEG_STIMEOUT_US", "10000000").strip() or "10000000"


def _ffmpeg_timeout_cli_flag() -> str:
    """CLI flag for socket I/O timeout (microseconds). Use 'timeout' — '-stimeout' is not accepted by many ffmpeg builds."""
    raw = os.getenv("ML_FFMPEG_TIMEOUT_FLAG", "timeout").strip().lstrip("-") or "timeout"
    return raw


def _mjpeg_quality(*, keep_native: bool) -> str:
    if keep_native:
        return os.getenv("ML_MJPEG_QUALITY_NATIVE", "2").strip() or "2"
    return os.getenv("ML_MJPEG_QUALITY", "8").strip() or "8"


def _rtsp_stream_input_flags() -> list[str]:
    flags = [
        "-rtsp_transport",
        "tcp",
        f"-{_ffmpeg_timeout_cli_flag()}",
        _ffmpeg_socket_timeout_us(),
    ]
    reorder = os.getenv("ML_FFMPEG_REORDER_QUEUE_SIZE", "").strip()
    if reorder:
        flags += ["-reorder_queue_size", reorder]
    return flags


def _rtsp_scale_filter(use_cuda_scale: bool) -> str | None:
    """FFmpeg -vf string to downscale to ~1080p before MJPEG pipe / YOLO."""
    w, h = _rtsp_scale_size()
    if w <= 0 and h <= 0:
        return None
    if w <= 0:
        w = -2
    if h <= 0:
        h = -2
    # Keep aspect ratio; never upscale small streams.
    if use_cuda_scale:
        # NVDEC frames stay on GPU → scale_cuda → download for MJPEG encode.
        return (
            f"scale_cuda=w={w}:h={h}:force_original_aspect_ratio=decrease,"
            "hwdownload,format=nv12"
        )
    return f"scale={w}:{h}:force_original_aspect_ratio=decrease:force_divisible_by=2"


class CameraStream:
    """Background reader that keeps the newest frame; reconnects on decode failures."""

    def __init__(self, rtsp_url: str, label: str, drain_reads: int = 2):
        self.rtsp_url = rtsp_url
        self.label = label
        self.keep_native = False
        self.drain_reads = max(1, drain_reads)
        self.lock = threading.Lock()
        self.frame: np.ndarray | None = None
        self.frame_seq = 0
        self.running = True
        self.connected = False
        self.cap: cv2.VideoCapture | None = None
        self._fail_streak = 0
        self._max_fail_before_reconnect = max(5, _env_int("ML_RTSP_MAX_FAILS", 30))
        self._reconnect_delay = max(0.5, _env_float("ML_RTSP_RECONNECT_SEC", 2.0))
        self._open_retry_delay = max(0.5, _env_float("ML_RTSP_OPEN_RETRY_SEC", 3.0))
        self._logged_res = False
        self.thread = threading.Thread(target=self._run, daemon=True, name=f"cam-{label}")

    @staticmethod
    def _open(source: str):
        cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
        if not cap.isOpened():
            cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            raise RuntimeError(f"Could not open RTSP stream: {source}")
        if hasattr(cv2, "CAP_PROP_BUFFERSIZE"):
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        return cap

    @staticmethod
    def _valid_frame(frame: np.ndarray | None) -> bool:
        if frame is None or not hasattr(frame, "size") or frame.size == 0:
            return False
        if len(frame.shape) < 2:
            return False
        h, w = frame.shape[:2]
        return h >= 32 and w >= 32

    def _release_cap(self) -> None:
        cap = self.cap
        self.cap = None
        if cap is not None:
            try:
                cap.release()
            except Exception:
                pass

    def _open_cap(self) -> bool:
        self._release_cap()
        try:
            self.cap = self._open(self.rtsp_url)
            self._fail_streak = 0
            return True
        except Exception as exc:
            print(f"[live] Failed to open {self.label}: {exc}")
            self.connected = False
            return False

    def _read_frame(self) -> np.ndarray | None:
        cap = self.cap
        if cap is None:
            return None
        try:
            for _ in range(self.drain_reads):
                if not cap.grab():
                    return None
            ret, frame = cap.retrieve()
            if ret and self._valid_frame(frame):
                return frame
            ret, frame = cap.read()
            if ret and self._valid_frame(frame):
                return frame
        except cv2.error:
            return None
        except Exception:
            return None
        return None

    def _run(self):
        while self.running:
            if self.cap is None:
                if not self._open_cap():
                    time.sleep(self._open_retry_delay)
                    continue

            frame = self._read_frame()
            if frame is not None:
                if not self._logged_res:
                    h, w = frame.shape[:2]
                    self._logged_res = True
                    print(f"[live] {self.label} native stream {w}x{h} (opencv)")
                with self.lock:
                    self.frame = frame
                    self.frame_seq += 1
                    self.connected = True
                self._fail_streak = 0
                continue

            self._fail_streak += 1
            self.connected = False
            if self._fail_streak >= self._max_fail_before_reconnect:
                print(
                    f"[live] Reconnecting {self.label} after "
                    f"{self._fail_streak} failed frame read(s)"
                )
                self._release_cap()
                self._fail_streak = 0
                time.sleep(self._reconnect_delay)
            else:
                time.sleep(0.02)

    def get_frame(self) -> np.ndarray | None:
        frame, _ = self.get_latest()
        return frame

    def get_latest(self) -> tuple[np.ndarray | None, int]:
        """Copy of newest frame + monotonic seq (Latest Frame Buffer read)."""
        with self.lock:
            if self.frame is None:
                return None, self.frame_seq
            return self.frame.copy(), self.frame_seq

    def stop(self):
        self.running = False
        self.thread.join(timeout=2.0)
        self._release_cap()


class FfmpegCameraStream:
    """
    RTSP reader via ffmpeg:
      4K camera (NVR still records original)
        → NVDEC decode
        → scale to 1080p inside FFmpeg
        → MJPEG pipe → Latest Frame Buffer → YOLO / Render / Browser
    """

    def __init__(self, rtsp_url: str, label: str, ffmpeg_path: str, keep_native: bool = False):
        self.rtsp_url = rtsp_url
        self.label = label
        self.ffmpeg_path = ffmpeg_path
        self.keep_native = bool(keep_native)
        self.lock = threading.Lock()
        self.frame: np.ndarray | None = None
        self.frame_seq = 0
        self.running = True
        self.connected = False
        self._proc: subprocess.Popen | None = None
        self._fail_streak = 0
        self._max_fail_before_reconnect = max(5, _env_int("ML_RTSP_MAX_FAILS", 30))
        self._reconnect_delay = max(0.5, _env_float("ML_RTSP_RECONNECT_SEC", 2.0))
        self._open_retry_delay = max(0.5, _env_float("ML_RTSP_OPEN_RETRY_SEC", 3.0))
        self._logged_res = False
        self._use_nvdec = _use_nvdec(ffmpeg_path)
        # Prefer GPU scale when NVDEC is on; fall back to CPU scale on ffmpeg errors.
        # Native/4K ANPR path skips FFmpeg scale entirely.
        self._use_cuda_scale = self._use_nvdec and not self.keep_native
        self._last_stderr = ""
        self.thread = threading.Thread(target=self._run, daemon=True, name=f"cam-{label}")

    def _ffmpeg_cmd(self) -> list[str]:
        """
        Decode with NVDEC when available.
        Default: scale to 1080p in FFmpeg, then MJPEG pipe.
        ANPR (keep_native): leave the original 4K frame in the buffer.
        """
        cmd: list[str] = [
            self.ffmpeg_path,
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-threads",
            _ffmpeg_threads(),
        ]
        if self._use_nvdec:
            cmd += [
                "-hwaccel",
                "cuda",
                "-hwaccel_device",
                _cuda_device_index(),
            ]
            if (
                not self.keep_native
                and self._use_cuda_scale
                and _rtsp_scale_filter(True)
            ):
                # Keep frames on GPU until after scale_cuda.
                cmd += ["-hwaccel_output_format", "cuda"]

        cmd += [
            "-fflags",
            "nobuffer+discardcorrupt+genpts",
            "-flags",
            "low_delay",
            *_rtsp_stream_input_flags(),
            "-i",
            self.rtsp_url,
            "-an",
        ]

        vf = None
        if not self.keep_native:
            vf = _rtsp_scale_filter(use_cuda_scale=bool(self._use_nvdec and self._use_cuda_scale))
        if vf:
            cmd += ["-vf", vf]

        mux_qsize = os.getenv("ML_FFMPEG_MAX_MUXING_QUEUE_SIZE", "1024").strip() or "1024"
        cmd += [
            "-max_muxing_queue_size",
            mux_qsize,
            "-f",
            "mjpeg",
            "-q:v",
            _mjpeg_quality(keep_native=self.keep_native),
            "-",
        ]
        return cmd

    def _drain_stderr(self, proc: subprocess.Popen) -> None:
        """Prevent stderr pipe fill; keep last error line for reconnect logs."""
        try:
            if proc.stderr is None:
                return
            chunks: list[str] = []
            while True:
                line = proc.stderr.readline()
                if not line:
                    break
                text = line.decode("utf-8", errors="replace").strip()
                if text:
                    chunks.append(text)
                    if len(chunks) > 8:
                        chunks = chunks[-8:]
            if chunks:
                self._last_stderr = " | ".join(chunks)[-240:]
        except Exception:
            pass

    def _maybe_fallback_cpu_scale(self) -> None:
        """If scale_cuda fails, switch to CPU scale on next reconnect."""
        err = (self._last_stderr or "").lower()
        if not self._use_cuda_scale:
            return
        markers = (
            "scale_cuda",
            "impossible to convert",
            "function not found",
            "no device",
            "invalid argument",
            "hwdownload",
        )
        if any(m in err for m in markers):
            self._use_cuda_scale = False
            print(
                f"[live] {self.label} scale_cuda unavailable — "
                "falling back to CPU scale=1080p in FFmpeg"
            )

    def _stop_proc(self) -> None:
        proc = self._proc
        self._proc = None
        if proc is None:
            return
        try:
            proc.kill()
            proc.wait(timeout=2)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass

    def _decode_mjpeg_buffer(self, buffer: bytearray) -> np.ndarray | None:
        while True:
            start = buffer.find(b"\xff\xd8")
            end = buffer.find(b"\xff\xd9")
            if start == -1 or end == -1 or end < start:
                return None
            jpg = bytes(buffer[start : end + 2])
            del buffer[: end + 2]
            arr = np.frombuffer(jpg, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is not None and CameraStream._valid_frame(frame):
                return frame
            if not buffer:
                return None

    def _run(self) -> None:
        sw, sh = _rtsp_scale_size()
        if self.keep_native:
            scale_note = "native-4K"
        else:
            scale_note = f"scale={sw}x{sh}" if (sw or sh) else "native"
        if self._use_nvdec:
            print(
                f"[live] {self.label} opening GPU NVDEC + FFmpeg {scale_note} "
                f"(cuda:{_cuda_device_index()})"
            )
        elif _nvdec_requested():
            print(f"[live] {self.label} NVDEC unavailable — software decode + FFmpeg {scale_note}")
        else:
            print(f"[live] {self.label} opening FFmpeg {scale_note}")

        while self.running:
            self._stop_proc()
            # Re-check CUDA availability; keep CPU-scale fallback once chosen.
            self._use_nvdec = _use_nvdec(self.ffmpeg_path)
            if not self._use_nvdec:
                self._use_cuda_scale = False
            decode_tag = "ffmpeg+nvdec" if self._use_nvdec else "ffmpeg"
            if self.keep_native:
                decode_tag += "+native"
            elif self._use_nvdec and self._use_cuda_scale:
                decode_tag += "+scale_cuda"
            elif sw or sh:
                decode_tag += "+scale"
            try:
                self._last_stderr = ""
                self._proc = subprocess.Popen(
                    self._ffmpeg_cmd(),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    bufsize=0,
                )
                threading.Thread(
                    target=self._drain_stderr,
                    args=(self._proc,),
                    daemon=True,
                    name=f"fferr-{self.label}",
                ).start()
            except OSError as exc:
                print(f"[live] Failed to open {self.label} ({decode_tag}): {exc}")
                self.connected = False
                time.sleep(self._open_retry_delay)
                continue

            if not self._proc.stdout:
                self._stop_proc()
                time.sleep(self._open_retry_delay)
                continue

            buffer = bytearray()
            self._fail_streak = 0
            while self.running and self._proc.poll() is None:
                try:
                    chunk = self._proc.stdout.read(8192)
                except Exception:
                    chunk = b""
                if not chunk:
                    self._fail_streak += 1
                    if self._fail_streak >= self._max_fail_before_reconnect:
                        break
                    time.sleep(0.02)
                    continue

                buffer.extend(chunk)
                while True:
                    frame = self._decode_mjpeg_buffer(buffer)
                    if frame is None:
                        break
                    if not self._logged_res:
                        h, w = frame.shape[:2]
                        self._logged_res = True
                        print(
                            f"[live] {self.label} capture {w}x{h} "
                            f"({decode_tag}; NVR may still record 4K)"
                        )
                    with self.lock:
                        self.frame = frame
                        self.frame_seq += 1
                        self.connected = True
                    self._fail_streak = 0

            self.connected = False
            if self.running:
                err_hint = (self._last_stderr or "").strip()
                self._maybe_fallback_cpu_scale()
                if err_hint:
                    print(f"[live] Reconnecting {self.label} ({decode_tag}): {err_hint}")
                else:
                    print(f"[live] Reconnecting {self.label} ({decode_tag})")
                self._stop_proc()
                time.sleep(self._reconnect_delay)

    def get_frame(self) -> np.ndarray | None:
        frame, _ = self.get_latest()
        return frame

    def get_latest(self) -> tuple[np.ndarray | None, int]:
        """Copy of newest frame + monotonic seq (Latest Frame Buffer read)."""
        with self.lock:
            if self.frame is None:
                return None, self.frame_seq
            return self.frame.copy(), self.frame_seq

    def stop(self) -> None:
        self.running = False
        self._stop_proc()
        self.thread.join(timeout=2.0)


def create_camera_stream(
    rtsp_url: str,
    label: str,
    keep_native: bool = False,
) -> CameraStream | FfmpegCameraStream:
    # GPU NVDEC requires the ffmpeg path — skip OpenCV when NVDEC is requested.
    backend = _rtsp_decode_backend()
    ffmpeg = _resolve_ffmpeg_path()
    if backend == "opencv" and not _nvdec_requested():
        stream = CameraStream(rtsp_url, label)
        stream.keep_native = bool(keep_native)
        return stream
    if ffmpeg:
        return FfmpegCameraStream(rtsp_url, label, ffmpeg, keep_native=keep_native)
    print(f"[live] ffmpeg not found — falling back to OpenCV for {label}")
    stream = CameraStream(rtsp_url, label)
    stream.keep_native = bool(keep_native)
    return stream


def draw_detections(frame: np.ndarray, detections: list[dict[str, Any]], label_scale: float = 0.55) -> np.ndarray:
    if not detections:
        return frame
    output = frame.copy()
    h, _ = output.shape[:2]
    font_scale = max(0.32, label_scale * (h / 720))
    thickness = max(1, int(font_scale * 1.5))
    box_thickness = max(1, int(font_scale * 1.2))
    font = cv2.FONT_HERSHEY_SIMPLEX

    for det in detections:
        display_id = str(det.get("display_id") or det.get("global_object_id") or "").strip()
        name = str(det.get("label") or det.get("class_name") or "")
        conf = float(det.get("confidence", 0))
        x1, y1, x2, y2 = det.get("bbox", [0, 0, 0, 0])
        is_unknown = (
            bool(det.get("is_unknown"))
            or name.lower() == "unknown"
            or name.lower().startswith("unknown")
            or bool(_OBJECT_ID_LABEL.match(name))
        )
        is_alert = bool(det.get("alert"))
        if is_alert:
            color = (0, 0, 255)
        elif is_unknown:
            color = (0, 140, 255)
        else:
            color = (0, 220, 0)
        cv2.rectangle(output, (int(x1), int(y1)), (int(x2), int(y2)), color, box_thickness)
        if display_id and display_id.lower() not in name.lower():
            name = f"{display_id} {name}".strip()
        elif display_id and not name:
            name = display_id
        label = f"{name} {conf:.2f}".strip()
        (text_w, text_h), baseline = cv2.getTextSize(label, font, font_scale, thickness)
        text_x = int(x1)
        text_y = max(text_h + 4, int(y1) - 4)
        cv2.rectangle(
            output,
            (text_x, text_y - text_h - 3),
            (text_x + text_w + 4, text_y + baseline + 2),
            (0, 0, 0),
            -1,
        )
        cv2.putText(output, label, (text_x + 2, text_y), font, font_scale, color, thickness, cv2.LINE_AA)
    return output


_GENERIC_FACE_LABELS = frozenset({"", "unknown", "person", "face"})
_OBJECT_ID_LABEL = re.compile(r"^(?:gp|go|gv|t)\d+$", re.IGNORECASE)


def _is_generic_face_label(label: str) -> bool:
    value = (label or "").strip().lower()
    if not value or value in _GENERIC_FACE_LABELS:
        return True
    if value.startswith("unknown") or value.startswith("face:unknown"):
        return True
    return bool(_OBJECT_ID_LABEL.match(value))


def assign_overlay_ids(detections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Put a stable ID on every live box: GP/GO/GV from identity, else ByteTrack T#."""
    for det in detections or []:
        gid = str(det.get("global_object_id") or "").strip()
        tid = det.get("track_id")
        try:
            track_no = int(tid) if tid is not None else None
        except (TypeError, ValueError):
            track_no = None
        display_id = gid or (f"T{track_no}" if track_no is not None else "")
        if display_id:
            det["display_id"] = display_id

        cls = str(det.get("class_name") or "").strip().lower()
        label = str(det.get("label") or "").strip()
        if cls in ("person", "face") and _is_generic_face_label(label):
            det["is_unknown"] = True
            det["label"] = display_id or "Unknown"
    return detections


def filter_enrolled_staff_detections(detections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Only show boxes/labels for recognized enrolled staff (attendance-eligible identities)."""
    kept: list[dict[str, Any]] = []
    for det in detections or []:
        if det.get("alert"):
            kept.append(det)
            continue
        # Always keep license-plate OCR overlays
        if str(det.get("model") or "").strip().lower() == "plate":
            kept.append(det)
            continue
        cls = str(det.get("class_name") or det.get("label") or "").strip().lower()
        if cls in ("license_plate", "license plate", "number_plate", "number plate"):
            kept.append(det)
            continue
        if cls not in ("person", "face"):
            continue
        label = str(det.get("label") or "").strip()
        if not label or _is_generic_face_label(label):
            continue
        kept.append(det)
    return kept


# COCO class ids for ANPR vehicle association (car / motorcycle / bus / truck)
_ANPR_VEHICLE_CLASS_IDS: frozenset[int] = frozenset({2, 3, 5, 7})
_ANPR_VEHICLE_NAMES: frozenset[str] = frozenset({"car", "motorcycle", "bus", "truck", "vehicle"})
_FACE_PURPOSE_CLASS_IDS: frozenset[int] = frozenset({0})  # person
# General objects = COCO allowlist WITHOUT vehicles (vehicles only when ANPR is selected)
_GENERAL_OBJECT_CLASS_IDS: frozenset[int] = frozenset(
    cid for cid in ALLOWED_COCO_CLASS_IDS if cid not in _ANPR_VEHICLE_CLASS_IDS
)

# Legacy purpose codes → model-centric codes (must match Django PURPOSE_ALIASES)
_PURPOSE_ALIASES: dict[str, str] = {
    "object_detection": "general_objects",
    "surveillance": "general_objects",
    "zone_monitoring": "general_objects",
    "thermal": "smoke_fire",
}

_SMOKE_FIRE_NAMES: frozenset[str] = frozenset({"smoke", "fire", "flame", "burning"})
_WEAPON_NAMES: frozenset[str] = frozenset(
    {
        "weapon",
        "gun",
        "pistol",
        "rifle",
        "firearm",
        "knife",
        "knife_weapon",
        "sword",
        "machete",
        "heavy-weapon",
    }
)
_PLATE_NAMES: frozenset[str] = frozenset(
    {
        "license_plate",
        "license plate",
        "number_plate",
        "number plate",
        "plate",
    }
)


def filter_detections_for_purposes(
    detections: list[dict[str, Any]],
    purposes: list[str] | set[str],
) -> list[dict[str, Any]]:
    """Hard gate: keep only detections that belong to the selected model purposes."""
    purpose_set = {
        _PURPOSE_ALIASES.get(str(p).strip().lower(), str(p).strip().lower())
        for p in (purposes or [])
        if str(p).strip()
    }
    if not purpose_set:
        return []

    kept: list[dict[str, Any]] = []
    for det in detections or []:
        tag = str(det.get("model_tag") or det.get("model") or "").strip().lower()
        cls = str(det.get("class_name") or "").strip().lower()
        label = str(det.get("label") or "").strip().lower()
        allow = False

        if "general_objects" in purpose_set:
            if tag in ("", "coco") and cls and cls not in _ANPR_VEHICLE_NAMES and cls not in _PLATE_NAMES:
                if cls not in _SMOKE_FIRE_NAMES and tag not in ("smoke", "weapon", "custom", "plate"):
                    allow = True

        if "custom_objects" in purpose_set and tag == "custom":
            allow = True

        if "smoke_fire" in purpose_set and (tag == "smoke" or cls in _SMOKE_FIRE_NAMES or label in _SMOKE_FIRE_NAMES):
            allow = True

        if "weapon" in purpose_set and (tag == "weapon" or cls in _WEAPON_NAMES or label in _WEAPON_NAMES):
            allow = True

        if purpose_set & {"face_recognition", "attendance"}:
            if cls in ("person", "face") or label in ("person", "face") or (
                tag in ("", "coco") and cls == "person"
            ):
                allow = True

        if "anpr" in purpose_set:
            if tag == "plate" or cls in _PLATE_NAMES or cls in _ANPR_VEHICLE_NAMES:
                allow = True

        if allow:
            kept.append(det)
    return kept


def filter_osd_detections(
    detections: list[dict[str, Any]],
    frame_h: int,
    frame_w: int,
    *,
    top_frac: float = 0.22,
    left_frac: float = 0.55,
    right_frac: float = 0.55,
    bottom_frac: float = 0.0,
) -> list[dict[str, Any]]:
    """Drop boxes in CCTV OSD bands (top strip corners / optional bottom)."""
    if not detections or frame_h <= 0 or frame_w <= 0:
        return detections
    y_top = frame_h * max(0.0, min(top_frac, 0.5))
    y_bottom = frame_h * (1.0 - max(0.0, min(bottom_frac, 0.5)))
    x_left = frame_w * max(0.0, min(left_frac, 1.0))
    x_right = frame_w * (1.0 - max(0.0, min(right_frac, 1.0)))
    kept: list[dict[str, Any]] = []
    for det in detections:
        x1, y1, x2, y2 = det.get("bbox", [0, 0, 0, 0])
        cx = (float(x1) + float(x2)) / 2.0
        cy = (float(y1) + float(y2)) / 2.0
        # Full-width top OSD strip (date/time overlays)
        if cy <= y_top:
            continue
        # Bottom OSD strip if configured
        if bottom_frac > 0 and cy >= y_bottom:
            continue
        # Extra left/right corner guard slightly below top band
        if cy <= y_top * 1.35 and (cx <= x_left or cx >= x_right):
            continue
        kept.append(det)
    return kept


def encode_jpeg(frame: np.ndarray, quality: int) -> bytes | None:
    ret, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return jpeg.tobytes() if ret else None


class _CameraSession:
    """Per-camera buffers: latest frame mirror + result/JPEG caches."""

    def __init__(self, ip: str, stream: CameraStream, rtsp_url: str):
        self.ip = ip
        self.stream = stream
        self.rtsp_url = rtsp_url
        self.lock = threading.Lock()
        # Result Buffer + browser JPEG (written by render / infer)
        self.latest_jpeg: bytes | None = None
        self.latest_detections: list[dict[str, Any]] = []
        # Infer scheduling (newest-frame-only; never queue stale work)
        self.infer_lock = threading.Lock()
        self.infer_busy = False
        self.infer_seq_done = 0
        self.last_infer_at = 0.0

    def set_frame(self, jpeg: bytes | None, detections: list[dict[str, Any]]):
        with self.lock:
            if jpeg is not None:
                self.latest_jpeg = jpeg
            self.latest_detections = detections

    def set_results(self, detections: list[dict[str, Any]]):
        with self.lock:
            self.latest_detections = detections


class LiveStreamManager:
    """Runs triple-model inference and serves annotated MJPEG per camera key."""

    def __init__(self):
        self._sessions: dict[str, _CameraSession] = {}
        self._registry: dict[str, str] = {}
        self._purposes: dict[str, list[str]] = {}
        self._lock = threading.Lock()
        self._byte_trackers = CameraByteTrackerPool(track_buffer=90)
        self._object_identity = get_object_identity_registry()
        self._infer_executor: ThreadPoolExecutor | None = None
        self._infer_futures: list[Future] = []
        self._infer_threads: list[threading.Thread] = []  # compat / status
        self._infer_thread: threading.Thread | None = None  # compat alias (first worker)
        self._render_thread: threading.Thread | None = None
        self._running = False
        self._face_db: KnownFaceDB | None = None
        self._plate_engine: PlateEngine | None = None
        self._coco_model = None
        self._custom_model = None
        self._smoke_model = None
        self._weapon_model = None
        self._device: str | int = 0
        self._conf = 0.12
        self._iou = 0.45
        self._imgsz = 1280
        self._max_det = 300
        self._osd_filter = True
        self._osd_top = 0.22
        self._osd_left = 0.55
        self._osd_right = 0.55
        self._osd_bottom = 0.0
        self._infer_interval = 0.15
        # Partition cameras across workers (e.g. 5 workers → ~5 cams each when 25 cams).
        self._infer_workers = max(1, min(_env_int("ML_LIVE_INFER_WORKERS", 5), 16))
        self._predict_lock = threading.Lock()
        # Browser preview defaults: smaller/faster JPEGs (override via env).
        self._jpeg_quality = 50
        self._face_threshold = 0.28
        # Plate OCR: on for purpose=anpr by default; set ML_PLATE_ON_ALL=true for every camera.
        self._plate_on_all = os.getenv("ML_PLATE_ON_ALL", "false").strip().lower() in (
            "1",
            "true",
            "yes",
        )
        self._plate_ocr_every = max(1, _env_int("ML_PLATE_OCR_EVERY", 3))
        self._plate_frame_counters: dict[str, int] = {}
        self._plate_counter_lock = threading.Lock()
        self._last_plate_dets: dict[str, list[dict[str, Any]]] = {}
        # 0 = native 4K passthrough for browser preview (override via ML_LIVE_MAX_WIDTH/HEIGHT).
        self._max_width = 0
        self._max_height = 0
        self._stream_fps = max(5, min(_env_int("ML_LIVE_STREAM_FPS", 12), 30))
        self._frame_interval = 1.0 / self._stream_fps
        self._detections: dict[str, list[dict[str, Any]]] = {}
        self._det_lock = threading.Lock()
        self._start_lock = threading.Lock()

    def configure_from_env(self):
        boot_ips = _boot_camera_ips()
        for ip in boot_ips:
            threading.Thread(
                target=self.ensure_camera,
                args=(ip,),
                daemon=True,
                name=f"live-boot-{ip}",
            ).start()

    def _load_infer_settings(self):
        try:
            self._conf = float(os.getenv("ML_YOLO_CONF", str(self._conf)))
        except (TypeError, ValueError):
            pass
        try:
            self._iou = float(os.getenv("ML_YOLO_IOU", str(self._iou)))
        except (TypeError, ValueError):
            pass
        try:
            self._imgsz = max(320, int(os.getenv("ML_YOLO_IMGSZ", str(self._imgsz))))
        except (TypeError, ValueError):
            pass
        try:
            self._max_det = max(1, int(os.getenv("ML_YOLO_MAX_DET", str(self._max_det))))
        except (TypeError, ValueError):
            pass
        self._osd_filter = os.getenv("ML_OSD_FILTER", "true").lower() in ("true", "1", "yes")
        self._osd_enrolled_staff_only = os.getenv("ML_OSD_ENROLLED_STAFF_ONLY", "false").lower() in (
            "true",
            "1",
            "yes",
        )
        try:
            self._osd_top = float(os.getenv("ML_OSD_TOP", str(self._osd_top)))
        except (TypeError, ValueError):
            pass
        try:
            self._osd_left = float(os.getenv("ML_OSD_LEFT", str(self._osd_left)))
        except (TypeError, ValueError):
            pass
        try:
            self._osd_right = float(os.getenv("ML_OSD_RIGHT", str(self._osd_right)))
        except (TypeError, ValueError):
            pass
        try:
            self._osd_bottom = float(os.getenv("ML_OSD_BOTTOM", str(self._osd_bottom)))
        except (TypeError, ValueError):
            pass
        self._max_width = _env_int("ML_LIVE_MAX_WIDTH", self._max_width)
        self._max_height = _env_int("ML_LIVE_MAX_HEIGHT", self._max_height)
        self._jpeg_quality = max(40, min(100, _env_int("ML_LIVE_JPEG_QUALITY", self._jpeg_quality)))
        self._stream_fps = max(5, min(_env_int("ML_LIVE_STREAM_FPS", self._stream_fps), 30))
        self._frame_interval = 1.0 / self._stream_fps
        try:
            self._infer_interval = max(0.05, float(os.getenv("ML_LIVE_INFER_INTERVAL", str(self._infer_interval))))
        except (TypeError, ValueError):
            pass
        self._infer_workers = max(1, min(_env_int("ML_LIVE_INFER_WORKERS", self._infer_workers), 16))

    def _close_session(self, key: str) -> None:
        session = self._sessions.pop(key, None)
        self._detections.pop(key, None)
        self._plate_frame_counters.pop(key, None)
        self._last_plate_dets.pop(key, None)
        if self._plate_engine is not None:
            try:
                self._plate_engine.clear_camera_tracks(key)
            except Exception:
                pass
        if session is not None:
            with session.infer_lock:
                session.infer_busy = False
            session.stream.stop()

    def resolve_rtsp_url(self, key: str, rtsp_url: str | None = None) -> str | None:
        key = key.strip()
        explicit = (rtsp_url or "").strip()
        if explicit:
            return explicit
        registered = self._registry.get(key, "").strip()
        if registered:
            return registered
        if not key:
            return None
        # Never treat Django stream keys (cam-11) as RTSP hostnames.
        if not _key_may_be_rtsp_host(key):
            return None
        cfg = _rtsp_config()
        return build_rtsp_url(key, cfg["user"], cfg["password"], cfg["port"], cfg["path"])

    def register_camera(
        self,
        key: str,
        rtsp_url: str,
        purpose: str = "",
        purposes: list[str] | None = None,
    ) -> bool:
        key = (key or "").strip()
        url = (rtsp_url or "").strip()
        if not key or not url:
            return False
        purpose_list = self._normalize_purpose_list(purposes, primary=purpose)
        with self._lock:
            self._registry[key] = url
            self._purposes[key] = purpose_list
            existing = self._sessions.get(key)
            if existing is not None:
                native_mismatch = bool(getattr(existing.stream, "keep_native", False)) != self._want_native_frame(key)
                if existing.rtsp_url != url or native_mismatch:
                    self._close_session(key)
                    self._open_session_locked(key, url)
        return True

    def set_camera_purposes(
        self,
        key: str,
        *,
        purpose: str = "",
        purposes: list[str] | None = None,
    ) -> list[str]:
        """Update AI purposes for an already-known camera key (e.g. from MJPEG query)."""
        key = (key or "").strip()
        if not key:
            return []
        purpose_list = self._normalize_purpose_list(purposes, primary=purpose)
        with self._lock:
            if purpose_list:
                self._purposes[key] = purpose_list
            existing = self._sessions.get(key)
            if existing is not None:
                native_mismatch = bool(getattr(existing.stream, "keep_native", False)) != self._want_native_frame(key)
                if native_mismatch:
                    self._close_session(key)
                    self._open_session_locked(key, existing.rtsp_url)
            return list(self._purposes.get(key) or [])

    @staticmethod
    def _normalize_purpose_list(
        purposes: list[str] | None,
        *,
        primary: str = "",
    ) -> list[str]:
        out: list[str] = []
        for raw in purposes or []:
            code = _PURPOSE_ALIASES.get(str(raw or "").strip().lower(), str(raw or "").strip().lower())
            if code and code not in out:
                out.append(code)
        primary_code = _PURPOSE_ALIASES.get(
            (primary or "").strip().lower(),
            (primary or "").strip().lower(),
        )
        if primary_code and primary_code not in out:
            out.insert(0, primary_code)
        return out

    def register_cameras_bulk(self, entries: list[dict[str, str]]) -> dict[str, int]:
        registered = 0
        for item in entries:
            key = str(item.get("key") or "").strip()
            url = str(item.get("rtsp_url") or "").strip()
            purpose = str(item.get("purpose") or "").strip()
            raw_purposes = item.get("purposes")
            purposes = raw_purposes if isinstance(raw_purposes, list) else []
            if self.register_camera(key, url, purpose=purpose, purposes=purposes):
                registered += 1
        self.ensure_started()
        return {"registered": registered, "total": len(entries)}

    def get_raw_frame(self, key: str):
        """Latest decoded frame from an existing live RTSP session (no extra connection)."""
        key = (key or "").strip()
        if not key:
            return None
        with self._lock:
            session = self._sessions.get(key)
        if session is None:
            return None
        return session.stream.get_frame()

    def is_ready(self) -> bool:
        """True after YOLO infer loops have started. Raw RTSP can run before this."""
        return bool(self._running)

    def get_raw_jpeg_bytes(self, key: str, *, target_width: int | None = None) -> bytes | None:
        """Encode the latest raw RTSP frame (does not wait for YOLO)."""
        raw = self.get_raw_frame(key)
        if raw is None:
            return None
        if target_width:
            prepared = self._prepare_attendance_frame(raw, int(target_width))
            quality = 98 if int(target_width) >= 2560 else max(90, min(self._jpeg_quality, 98))
            return encode_jpeg(prepared, quality)
        quality = max(70, min(self._jpeg_quality, 98))
        return encode_jpeg(self._limit_size(raw), quality)

    def wait_for_raw_jpeg(
        self,
        key: str,
        *,
        timeout_sec: float = 6.0,
        target_width: int | None = None,
    ) -> bytes | None:
        deadline = time.monotonic() + max(0.1, float(timeout_sec))
        while time.monotonic() < deadline:
            jpeg = self.get_raw_jpeg_bytes(key, target_width=target_width)
            if jpeg:
                return jpeg
            time.sleep(0.05)
        return None

    def wait_for_preview_jpeg(self, key: str, *, timeout_sec: float = 2.5) -> bytes | None:
        deadline = time.monotonic() + max(0.1, float(timeout_sec))
        while time.monotonic() < deadline:
            frame = self.get_preview_jpeg(key)
            if frame:
                return frame
            jpeg = self.get_raw_jpeg_bytes(key)
            if jpeg:
                return jpeg
            time.sleep(0.05)
        return None

    def ensure_started(self) -> bool:
        """Start infer/render threads if YOLO is available but loops are not running."""
        self.start()
        return self._running

    def unregister_camera(self, key: str) -> bool:
        key = (key or "").strip()
        if not key:
            return False
        with self._lock:
            self._registry.pop(key, None)
            self._purposes.pop(key, None)
            self._close_session(key)
        return True

    def ensure_camera(self, key: str, rtsp_url: str | None = None) -> bool:
        key = key.strip()
        if not key:
            return False
        url = self.resolve_rtsp_url(key, rtsp_url)
        if not url:
            return False
        with self._lock:
            existing = self._sessions.get(key)
            if existing is not None:
                # Never reopen just because a query-string RTSP URL differs slightly
                # (encoding / param order). That caused Opening storms + perpetual 503.
                if url and existing.rtsp_url != url:
                    self._registry[key] = url
                native_mismatch = bool(getattr(existing.stream, "keep_native", False)) != self._want_native_frame(key)
                if not native_mismatch:
                    return True
                self._close_session(key)
            self._open_session_locked(key, url)
            return True

    def get_preview_jpeg(self, key: str) -> bytes | None:
        """Cached browser JPEG only (never encode on the request path)."""
        return self.get_latest_jpeg(key)

    def start(self):
        with self._start_lock:
            if self._running:
                return
            try:
                self._load_infer_settings()
                coco_weights = resolve_coco_weights_path()
                custom_weights = resolve_custom_weights_path()
                smoke_weights = resolve_smoke_weights_path()
                weapon_weights = resolve_weapon_weights_path()
                if not any([coco_weights, custom_weights, smoke_weights, weapon_weights]):
                    print("[live] No YOLO weights — live annotated streams disabled.")
                    return

                self._coco_model = get_yolo_coco_model()
                self._custom_model = get_yolo_custom_model()
                self._smoke_model = get_yolo_smoke_model()
                self._weapon_model = get_yolo_weapon_model()
                if (
                    self._coco_model is None
                    and self._custom_model is None
                    and self._smoke_model is None
                    and self._weapon_model is None
                ):
                    print("[live] YOLO models unavailable.")
                    return

                self._device = resolve_ml_device()
                cuda = get_cuda_status()
                self._face_db = get_face_db()
                if hasattr(self._face_db, "threshold"):
                    self._face_db.threshold = self._face_threshold
                try:
                    self._plate_engine = get_plate_engine()
                except Exception as exc:
                    print(f"[live] Plate engine unavailable: {exc}")
                    self._plate_engine = None
                plate_ok = bool(self._plate_engine and self._plate_engine.available)
                self._running = True
                self._infer_futures = []
                self._infer_executor = ThreadPoolExecutor(
                    max_workers=self._infer_workers,
                    thread_name_prefix="live-infer",
                )
                for i in range(self._infer_workers):
                    fut = self._infer_executor.submit(self._infer_shard_loop, i)
                    self._infer_futures.append(fut)
                self._infer_threads = []
                self._infer_thread = None
                self._render_thread = threading.Thread(target=self._render_loop, daemon=True, name="live-render")
                self._render_thread.start()
                max_label = (
                    "native"
                    if self._max_width <= 0 and self._max_height <= 0
                    else f"{self._max_width}x{self._max_height}"
                )
                print(
                    "[live] Started partitioned infer workers "
                    f"(device={self._device}, gpu={cuda.get('cuda_device_name') or 'n/a'}, "
                    f"fps={self._stream_fps}, infer_interval={self._infer_interval}s, "
                    f"infer_workers={self._infer_workers} "
                    f"[Worker-i → contiguous camera shard], "
                    f"conf={self._conf}, imgsz={self._imgsz}, display={max_label}, "
                    f"osd_enrolled_staff_only={self._osd_enrolled_staff_only}, "
                    f"rtsp_decode={_rtsp_decode_backend()}, "
                    f"coco={coco_weights or 'off'}, custom={custom_weights or 'off'}, "
                    f"smoke={smoke_weights or 'off'}, weapon={weapon_weights or 'off'}, "
                    f"plate={'on' if plate_ok else 'off'}, plate_on_all={self._plate_on_all})"
                )
            except Exception as exc:
                print(f"[live] start failed: {exc}")
                self._running = False

    def stop(self):
        self._running = False
        if self._infer_executor is not None:
            try:
                self._infer_executor.shutdown(wait=False, cancel_futures=True)
            except TypeError:
                self._infer_executor.shutdown(wait=False)
            self._infer_executor = None
        for fut in self._infer_futures:
            try:
                fut.result(timeout=2.0)
            except Exception:
                pass
        self._infer_futures = []
        self._infer_threads = []
        self._infer_thread = None
        if self._render_thread:
            self._render_thread.join(timeout=2.0)
        with self._lock:
            for session in self._sessions.values():
                session.stream.stop()
            self._sessions.clear()

    def status(self) -> dict[str, Any]:
        with self._lock:
            keys = set(self._registry.keys()) | set(self._sessions.keys())
            cameras = []
            for key in sorted(keys):
                session = self._sessions.get(key)
                det_count = 0
                has_frame = False
                connected = False
                if session is not None:
                    with session.lock:
                        det_count = len(session.latest_detections)
                        has_frame = session.latest_jpeg is not None
                    connected = bool(session.stream.connected)
                cameras.append(
                    {
                        "ip": key,
                        "key": key,
                        "registered": key in self._registry,
                        "connected": connected,
                        "has_frame": has_frame,
                        "detections": det_count,
                        "purpose": (self._purposes.get(key) or [""])[0] if self._purposes.get(key) else "",
                        "purposes": list(self._purposes.get(key) or []),
                        "rtsp_url": (self._registry.get(key) or "").strip(),
                    }
                )
        return {
            "running": self._running,
            "inference_device": self._device,
            "plate_only_mode": False,
            "plate_model_loaded": bool(self._plate_engine and self._plate_engine.available),
            "triple_model_mode": (
                self._coco_model is not None
                and self._custom_model is not None
                and self._smoke_model is not None
            ),
            "quad_model_mode": (
                self._coco_model is not None
                and self._custom_model is not None
                and self._smoke_model is not None
                and self._weapon_model is not None
            ),
            "coco_model_loaded": self._coco_model is not None,
            "custom_model_loaded": self._custom_model is not None,
            "smoke_model_loaded": self._smoke_model is not None,
            "weapon_model_loaded": self._weapon_model is not None,
            "dual_model_mode": self._coco_model is not None and self._smoke_model is not None,
            "general_model_loaded": self._coco_model is not None,
            "infer_workers": self._infer_workers,
            "camera_count": len(cameras),
            "cameras": cameras,
        }

    def get_latest_jpeg(self, ip: str) -> bytes | None:
        session = self._sessions.get(ip)
        if not session:
            return None
        with session.lock:
            return session.latest_jpeg

    def get_detections(self, ip: str) -> list[dict[str, Any]]:
        return list(self.get_detection_snapshot(ip).get("detections") or [])

    def get_detection_snapshot(self, ip: str) -> dict[str, Any]:
        session = self._sessions.get(ip)
        if not session:
            return {
                "detections": [],
                "frame_width": 0,
                "frame_height": 0,
                "display_width": 0,
                "display_height": 0,
            }
        with self._det_lock:
            detections = list(self._detections.get(ip, []))
        raw = session.stream.get_frame()
        if raw is not None:
            infer_h, infer_w = raw.shape[:2]
            limited = self._limit_size(raw)
            display_h, display_w = limited.shape[:2]
        else:
            infer_w, infer_h = 0, 0
            display_w, display_h = 0, 0
        return {
            "detections": detections,
            "frame_width": int(infer_w),
            "frame_height": int(infer_h),
            "display_width": int(display_w),
            "display_height": int(display_h),
        }

    def iter_mjpeg(self, key: str) -> Iterator[bytes]:
        boundary = b"--frame\r\n"
        last: bytes | None = None
        while True:
            frame = self.get_latest_jpeg(key)
            if frame and frame is not last:
                last = frame
                yield boundary
                yield b"Content-Type: image/jpeg\r\n"
                yield f"Content-Length: {len(frame)}\r\n\r\n".encode()
                yield frame
                yield b"\r\n"
                time.sleep(self._frame_interval)
            else:
                time.sleep(0.02)

    def iter_mjpeg_raw(self, key: str) -> Iterator[bytes]:
        session = self._sessions.get(key)
        if session is None:
            return
        boundary = b"--frame\r\n"
        quality = max(70, min(self._jpeg_quality, 98))
        while True:
            raw = session.stream.get_frame()
            if raw is not None:
                jpeg = encode_jpeg(self._limit_size(raw), quality)
                if jpeg:
                    yield boundary
                    yield b"Content-Type: image/jpeg\r\n"
                    yield f"Content-Length: {len(jpeg)}\r\n\r\n".encode()
                    yield jpeg
                    yield b"\r\n"
            time.sleep(self._frame_interval)

    def _prepare_frame(self, frame: np.ndarray):
        """
        Other YOLO models stay on the live AI size (~1080p).
        Native/4K ANPR buffers are scaled here; boxes map back via sx/sy.
        """
        h, w = frame.shape[:2]
        max_w, max_h = _rtsp_scale_size()
        if max_w <= 0 and max_h <= 0:
            return frame, 1.0, 1.0
        if max_w <= 0:
            max_w = w
        if max_h <= 0:
            max_h = h
        if w <= max_w and h <= max_h:
            return frame, 1.0, 1.0
        scale = min(max_w / float(w), max_h / float(h))
        dw = max(2, int(w * scale) // 2 * 2)
        dh = max(2, int(h * scale) // 2 * 2)
        small = cv2.resize(frame, (dw, dh), interpolation=cv2.INTER_AREA)
        return small, w / float(dw), h / float(dh)

    def _want_native_frame(self, camera_key: str) -> bool:
        """Keep native camera resolution (4K) when RTSP scaling is disabled."""
        w, h = _rtsp_scale_size()
        if w <= 0 and h <= 0:
            return True
        if self._plate_on_all:
            return True
        return "anpr" in self._purposes_for(camera_key)

    def _open_session_locked(self, key: str, url: str) -> None:
        keep_native = self._want_native_frame(key)
        stream = create_camera_stream(url, key, keep_native=keep_native)
        stream.thread.start()
        self._sessions[key] = _CameraSession(key, stream, url)
        self._detections[key] = []
        tag = "native-4K" if keep_native else "scaled"
        print(f"[live] Opening: {key} ({tag})")

    def _predict(self, model, frame: np.ndarray, *, min_conf: float | None = None, classes=None):
        use_half = self._device != "cpu"
        conf = max(self._conf, min_conf) if min_conf is not None else self._conf
        kwargs = {
            "device": self._device,
            "conf": conf,
            "iou": self._iou,
            "imgsz": self._imgsz,
            "max_det": self._max_det,
            "half": use_half,
            "verbose": False,
        }
        if classes is not None:
            kwargs["classes"] = list(classes)
        # Serialize GPU predict across workers; OCR/post-process can overlap.
        with self._predict_lock:
            return model.predict(frame, **kwargs)

    def _purposes_for(self, camera_key: str) -> list[str]:
        values = self._purposes.get(camera_key) or []
        if isinstance(values, str):
            values = [values] if values else []
        out: list[str] = []
        for raw in values:
            code = str(raw or "").strip().lower()
            code = _PURPOSE_ALIASES.get(code, code)
            if code and code not in out:
                out.append(code)
        return out

    def _should_run_plates(self, camera_key: str) -> bool:
        if self._plate_engine is None or not self._plate_engine.available:
            return False
        if self._plate_on_all:
            return True
        return "anpr" in self._purposes_for(camera_key)

    def _purpose_pipeline(self, camera_key: str) -> dict[str, Any]:
        """
        Run ONLY the models that are explicitly selected on this camera.
        Each purpose maps 1:1 to a model (union when multiple are checked).
        """
        purposes = set(self._purposes_for(camera_key))
        # No purposes registered yet → run nothing (do NOT fall back to general objects)
        if not purposes:
            return {
                "coco": False,
                "coco_classes": [],
                "recognize_faces": False,
                "custom": False,
                "smoke": False,
                "weapon": False,
                "plates": False,
                "purposes": [],
            }

        coco = False
        recognize_faces = False
        custom = False
        smoke = False
        weapon = False
        coco_ids: set[int] = set()

        # General Objects (YOLO) — non-vehicle COCO classes only
        if "general_objects" in purposes:
            coco = True
            coco_ids |= set(_GENERAL_OBJECT_CLASS_IDS)

        # Custom trained objects model
        if "custom_objects" in purposes:
            custom = True

        # Fire & Smoke specialist — nothing else
        if "smoke_fire" in purposes:
            smoke = True

        # Weapon specialist — nothing else
        if "weapon" in purposes:
            weapon = True

        # Face / Attendance — person + face recognition only
        if purposes & {"face_recognition", "attendance"}:
            coco = True
            recognize_faces = True
            coco_ids |= set(_FACE_PURPOSE_CLASS_IDS)

        # ANPR — vehicles + plate OCR only
        if "anpr" in purposes:
            coco = True
            coco_ids |= set(_ANPR_VEHICLE_CLASS_IDS)

        return {
            "coco": coco,
            "coco_classes": sorted(coco_ids) if coco_ids else ([] if coco else None),
            "recognize_faces": recognize_faces,
            "custom": custom,
            "smoke": smoke,
            "weapon": weapon,
            "plates": self._should_run_plates(camera_key),
            "purposes": sorted(purposes),
        }

    def _infer_frame(
        self,
        frame: np.ndarray,
        *,
        camera_key: str = "",
        run_plates: bool = False,
    ) -> list[dict[str, Any]]:
        infer_frame, sx, sy = self._prepare_frame(frame)
        pipeline = self._purpose_pipeline(camera_key)
        # Caller may force plates off; purpose may force on
        do_plates = bool(run_plates and pipeline.get("plates"))

        coco_detections: list[dict[str, Any]] = []
        custom_detections: list[dict[str, Any]] = []
        smoke_detections: list[dict[str, Any]] = []
        weapon_detections: list[dict[str, Any]] = []

        if pipeline.get("coco") and self._coco_model is not None:
            coco_classes = pipeline.get("coco_classes")
            if coco_classes is None:
                class_filter = ALLOWED_COCO_CLASS_IDS
            else:
                class_filter = frozenset(int(c) for c in coco_classes)
            if class_filter:
                results = self._predict(self._coco_model, infer_frame, classes=class_filter)
                coco_detections = parse_yolo_result(
                    frame,
                    results[0],
                    sx=sx,
                    sy=sy,
                    recognize_faces=bool(pipeline.get("recognize_faces")),
                    smoke_model=False,
                    model_tag="coco",
                    face_db=self._face_db if pipeline.get("recognize_faces") else None,
                )

        if pipeline.get("custom") and self._custom_model is not None:
            custom_ids = custom_only_class_ids(self._custom_model)
            results = self._predict(
                self._custom_model,
                infer_frame,
                classes=custom_ids or None,
            )
            custom_detections = keep_custom_classes_only(
                parse_yolo_result(
                    frame,
                    results[0],
                    sx=sx,
                    sy=sy,
                    recognize_faces=False,
                    smoke_model=False,
                    model_tag="custom",
                    face_db=None,
                )
            )

        if pipeline.get("smoke") and self._smoke_model is not None:
            results = self._predict(self._smoke_model, infer_frame, min_conf=SMOKE_FIRE_MIN_CONF)
            smoke_detections = parse_yolo_result(
                frame,
                results[0],
                sx=sx,
                sy=sy,
                recognize_faces=False,
                smoke_model=True,
                model_tag="smoke",
                face_db=None,
            )

        if pipeline.get("weapon") and self._weapon_model is not None:
            results = self._predict(self._weapon_model, infer_frame, min_conf=WEAPON_MIN_CONF)
            weapon_detections = parse_yolo_result(
                frame,
                results[0],
                sx=sx,
                sy=sy,
                recognize_faces=False,
                weapon_model=True,
                model_tag="weapon",
                face_db=None,
            )

        detections = merge_triple_detections(coco_detections, custom_detections, smoke_detections)
        detections.extend(weapon_detections)

        vehicle_boxes: list[list[float]] = []
        for det in coco_detections:
            cls = str(det.get("class_name") or det.get("label") or "").strip().lower()
            if cls in _ANPR_VEHICLE_NAMES:
                bbox = det.get("bbox") or []
                if len(bbox) >= 4:
                    vehicle_boxes.append([float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])])

        if do_plates and self._plate_engine is not None:
            with self._plate_counter_lock:
                counter = self._plate_frame_counters.get(camera_key, 0) + 1
                self._plate_frame_counters[camera_key] = counter
            # Plate YOLO every N infer cycles; PaddleOCR PP-OCRv5 runs inside PlateEngine.
            if counter % self._plate_ocr_every == 0:
                try:
                    plate_dets = self._plate_engine.detect_and_read(
                        frame,
                        camera_key=camera_key,
                        save=True,
                        vehicle_boxes=vehicle_boxes,
                    )
                    self._last_plate_dets[camera_key] = plate_dets
                    detections.extend(plate_dets)
                except Exception as exc:
                    print(f"[live] Plate OCR error [{camera_key}]: {exc}")
                    detections.extend(self._last_plate_dets.get(camera_key, []))
            else:
                # Keep last plate boxes on screen between detect cycles
                detections.extend(self._last_plate_dets.get(camera_key, []))

        if self._osd_filter:
            h, w = frame.shape[:2]
            detections = filter_osd_detections(
                detections,
                h,
                w,
                top_frac=self._osd_top,
                left_frac=self._osd_left,
                right_frac=self._osd_right,
                bottom_frac=self._osd_bottom,
            )
        # Final hard gate — never draw/save classes outside selected purposes
        detections = filter_detections_for_purposes(
            detections,
            pipeline.get("purposes") or self._purposes_for(camera_key),
        )
        detections = self._byte_trackers.assign_track_ids(camera_key, detections, frame)
        detections = self._object_identity.enrich_detections(
            camera_key,
            frame,
            detections,
            face_db=self._face_db,
        )
        detections = assign_overlay_ids(detections)
        return detections

    def _publish_results(self, camera_key: str, detections: list[dict[str, Any]]) -> None:
        """Write Result Buffer (API snapshot + session cache)."""
        with self._det_lock:
            self._detections[camera_key] = detections
        session = self._sessions.get(camera_key)
        if session is not None:
            session.set_results(detections)

    def _sessions_for_worker(self, worker_id: int) -> list[_CameraSession]:
        """
        Contiguous camera shards across workers:
          Worker-0 → cams[0 : chunk)
          Worker-1 → cams[chunk : 2*chunk)
          ...
        With 25 cams and 5 workers → ~5 cams each (cam1-5, cam6-10, ...).
        """
        n_workers = max(1, self._infer_workers)
        worker_id = max(0, min(int(worker_id), n_workers - 1))
        with self._lock:
            sessions = sorted(self._sessions.values(), key=lambda s: s.ip)
        total = len(sessions)
        if total == 0:
            return []
        base = total // n_workers
        rem = total % n_workers
        # First `rem` workers get one extra camera so every cam is covered.
        start = 0
        for i in range(worker_id):
            start += base + (1 if i < rem else 0)
        size = base + (1 if worker_id < rem else 0)
        return sessions[start : start + size]

    def _run_camera_inference(self, session: _CameraSession) -> None:
        """Infer newest frame only for one camera; write Result Buffer. Never encodes JPEG."""
        now = time.time()
        with session.infer_lock:
            if session.infer_busy:
                return
            if (now - session.last_infer_at) < self._infer_interval:
                return

        getter = getattr(session.stream, "get_latest", None)
        if callable(getter):
            frame, seq = getter()
        else:
            frame = session.stream.get_frame()
            seq = session.infer_seq_done + 1 if frame is not None else session.infer_seq_done
        if frame is None:
            return

        with session.infer_lock:
            if session.infer_busy:
                return
            if seq <= session.infer_seq_done:
                return
            if (now - session.last_infer_at) < self._infer_interval:
                return
            session.infer_busy = True
            session.last_infer_at = now

        try:
            detections = self._infer_frame(
                frame,
                camera_key=session.ip,
                run_plates=self._should_run_plates(session.ip),
            )
            fh, fw = frame.shape[:2]
            for det in detections:
                det["frame_width"] = int(fw)
                det["frame_height"] = int(fh)
            self._publish_results(session.ip, detections)
            with session.infer_lock:
                session.infer_seq_done = seq
        except Exception as exc:
            print(f"[live] Inference error [{session.ip}]: {exc}")
        finally:
            with session.infer_lock:
                session.infer_busy = False

    def _infer_shard_loop(self, worker_id: int) -> None:
        """
        Dedicated worker loop for one contiguous camera shard.
        Runs in parallel with other workers via ThreadPoolExecutor.
        """
        while self._running:
            loop_start = time.time()
            sessions = self._sessions_for_worker(worker_id)
            for session in sessions:
                if not self._running:
                    break
                self._run_camera_inference(session)
            elapsed = time.time() - loop_start
            wait = self._infer_interval - elapsed
            if wait > 0:
                time.sleep(wait)
            elif not sessions:
                time.sleep(0.05)

    def _limit_size(self, frame: np.ndarray) -> np.ndarray:
        """Downscale only when ML_LIVE_MAX_WIDTH/HEIGHT cap is set; 0 = native passthrough."""
        h, w = frame.shape[:2]
        max_w = self._max_width
        max_h = self._max_height
        if max_w <= 0 and max_h <= 0:
            return frame
        if max_w <= 0:
            max_w = w
        if max_h <= 0:
            max_h = h
        if w <= max_w and h <= max_h:
            return frame
        scale = min(max_w / w, max_h / h)
        return cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    def _prepare_attendance_frame(self, frame: np.ndarray, target_width: int) -> np.ndarray:
        """Native main-stream frame; only downscale when wider than target (never upscale)."""
        h, w = frame.shape[:2]
        if w <= 0 or h <= 0:
            return frame
        target_width = max(640, min(4096, int(target_width or 3840)))
        if w <= target_width:
            return frame
        scale = target_width / float(w)
        return cv2.resize(
            frame,
            (target_width, max(1, int(h * scale))),
            interpolation=cv2.INTER_AREA,
        )

    def iter_mjpeg_attendance(self, key: str, *, target_width: int = 3840) -> Iterator[bytes]:
        """Full main-stream MJPEG for attendance clips (higher quality than raw preview)."""
        session = self._sessions.get(key)
        if session is None:
            return
        boundary = b"--frame\r\n"
        quality = 98 if target_width >= 2560 else max(90, min(self._jpeg_quality, 98))
        while True:
            raw = session.stream.get_frame()
            if raw is not None:
                prepared = self._prepare_attendance_frame(raw, target_width)
                jpeg = encode_jpeg(prepared, quality)
                if jpeg:
                    yield boundary
                    yield b"Content-Type: image/jpeg\r\n"
                    yield f"Content-Length: {len(jpeg)}\r\n\r\n".encode()
                    yield jpeg
                    yield b"\r\n"
            time.sleep(self._frame_interval)

    def _render_loop(self):
        """Render Thread: latest frame + last Result Buffer → JPEG. Never waits on inference."""
        while self._running:
            loop_start = time.time()
            with self._lock:
                sessions = list(self._sessions.values())
            for session in sessions:
                live = session.stream.get_frame()
                if live is None:
                    continue
                with self._det_lock:
                    boxes = list(self._detections.get(session.ip, []))
                if self._osd_enrolled_staff_only:
                    boxes = filter_enrolled_staff_detections(boxes)
                # draw_detections copies when there are boxes; otherwise just resize+encode.
                framed = draw_detections(live, boxes) if boxes else live
                jpeg = encode_jpeg(self._limit_size(framed), self._jpeg_quality)
                session.set_frame(jpeg, boxes)
            elapsed = time.time() - loop_start
            wait = self._frame_interval - elapsed
            if wait > 0:
                time.sleep(wait)


_manager: LiveStreamManager | None = None
_manager_lock = threading.Lock()


def get_live_manager() -> LiveStreamManager:
    global _manager
    with _manager_lock:
        if _manager is None:
            _manager = LiveStreamManager()
        return _manager
