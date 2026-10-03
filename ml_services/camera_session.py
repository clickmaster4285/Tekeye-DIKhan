"""
Shared Camera Session — one RTSP / FFmpeg decode per camera.

Architecture:
  CAMERA → ONE RTSP → ONE FFmpeg (NVDEC) → SHARED FRAME BUFFER
                                              ├─ LIVE (render / MJPEG)
                                              ├─ AI (YOLO / face / plate)
                                              ├─ Journey
                                              └─ Attendance / evidence JPEG

Do not open a second FFmpeg for the same camera. Consumers must call
ensure_session() / get_latest_frame() (or LiveStreamManager helpers that
delegate here).
"""

from __future__ import annotations

import threading
from typing import Any

import numpy as np

# create_camera_stream lives in live_stream; import lazily in ensure to avoid cycles.


class CameraSession:
    """One decoded ingest for a camera key."""

    def __init__(self, key: str, rtsp_url: str, stream: Any, *, keep_native: bool = False):
        self.key = key
        self.rtsp_url = rtsp_url
        self.stream = stream
        self.keep_native = bool(keep_native)
        self.lock = threading.Lock()

    def get_frame(self) -> np.ndarray | None:
        return self.stream.get_frame()

    def get_latest(self) -> tuple[np.ndarray | None, int]:
        getter = getattr(self.stream, "get_latest", None)
        if callable(getter):
            return getter()
        frame = self.get_frame()
        return frame, 0

    @property
    def connected(self) -> bool:
        return bool(getattr(self.stream, "connected", False))

    def stop(self) -> None:
        try:
            self.stream.stop()
        except Exception:
            pass


class CameraSessionManager:
    """Process-wide registry: at most one active decode pipeline per camera key."""

    def __init__(self):
        self._sessions: dict[str, CameraSession] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> CameraSession | None:
        key = (key or "").strip()
        if not key:
            return None
        with self._lock:
            return self._sessions.get(key)

    def ensure(
        self,
        key: str,
        rtsp_url: str,
        *,
        keep_native: bool = False,
    ) -> CameraSession | None:
        key = (key or "").strip()
        url = (rtsp_url or "").strip()
        if not key or not url:
            return None

        with self._lock:
            existing = self._sessions.get(key)
            if existing is not None:
                native_mismatch = bool(existing.keep_native) != bool(keep_native)
                if existing.rtsp_url == url and not native_mismatch:
                    return existing
                existing.stop()
                self._sessions.pop(key, None)

            from live_stream import create_camera_stream

            stream = create_camera_stream(url, key, keep_native=keep_native)
            stream.thread.start()
            session = CameraSession(key, url, stream, keep_native=keep_native)
            self._sessions[key] = session
            tag = "native-4K" if keep_native else "scaled"
            print(f"[camera-session] Opening: {key} ({tag})")
            return session

    def release(self, key: str) -> bool:
        key = (key or "").strip()
        if not key:
            return False
        with self._lock:
            session = self._sessions.pop(key, None)
        if session is None:
            return False
        session.stop()
        print(f"[camera-session] Closed: {key}")
        return True

    def get_latest_frame(self, key: str) -> np.ndarray | None:
        session = self.get(key)
        if session is None:
            return None
        return session.get_frame()

    def list_keys(self) -> list[str]:
        with self._lock:
            return list(self._sessions.keys())

    def status(self) -> dict[str, Any]:
        with self._lock:
            items = []
            for key, session in self._sessions.items():
                items.append(
                    {
                        "key": key,
                        "connected": session.connected,
                        "keep_native": session.keep_native,
                        "rtsp_url": session.rtsp_url[:48] + ("…" if len(session.rtsp_url) > 48 else ""),
                    }
                )
        return {"sessions": items, "count": len(items)}


_manager: CameraSessionManager | None = None
_manager_lock = threading.Lock()


def get_camera_session_manager() -> CameraSessionManager:
    global _manager
    with _manager_lock:
        if _manager is None:
            _manager = CameraSessionManager()
        return _manager
