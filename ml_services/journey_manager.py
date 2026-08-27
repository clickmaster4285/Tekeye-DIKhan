"""Journey processing manager — one pipeline thread per camera."""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any

import requests

from journey_pipeline import JourneyCameraPipeline
from live_stream import get_live_manager

logger = logging.getLogger(__name__)


class JourneyManager:
    def __init__(self):
        self._lock = threading.Lock()
        self._pipelines: dict[str, JourneyCameraPipeline] = {}
        self._threads: dict[str, threading.Thread] = {}
        self._stop_flags: dict[str, threading.Event] = {}
        self._backend_ingest_url = ""
        self._ingest_token = ""

    def configure_ingest(self, backend_ingest_url: str, ingest_token: str = ""):
        self._backend_ingest_url = (backend_ingest_url or "").strip()
        self._ingest_token = (ingest_token or "").strip()

    def register_cameras_bulk(self, payload: dict[str, Any]) -> dict[str, Any]:
        cameras = payload.get("cameras") or []
        if payload.get("backend_ingest_url"):
            self.configure_ingest(
                str(payload.get("backend_ingest_url") or ""),
                str(payload.get("ingest_token") or ""),
            )
        registered = 0
        desired_keys: set[str] = set()
        live = get_live_manager()
        live.ensure_started()
        for item in cameras:
            key = str(item.get("key") or "").strip()
            url = str(item.get("rtsp_url") or "").strip()
            if not key or not url:
                continue
            camera_id = item.get("camera_id")
            try:
                camera_id = int(camera_id) if camera_id is not None else None
            except (TypeError, ValueError):
                camera_id = None
            desired_keys.add(key)
            live.ensure_camera(key, url)
            self._start_pipeline(
                key=key,
                rtsp_url=url,
                camera_id=camera_id,
                zone=str(item.get("zone") or ""),
                name=str(item.get("name") or key),
            )
            registered += 1

        # Stop pipelines for cameras removed from DB (empty sync stops all).
        stopped = 0
        with self._lock:
            stale = [k for k in list(self._pipelines.keys()) if k not in desired_keys]
            for key in stale:
                self._stop_pipeline_locked(key)
                stopped += 1
                try:
                    live.unregister_camera(key)
                except Exception:
                    pass

        return {
            "registered": registered,
            "stopped": stopped,
            "total": len(cameras),
            "running": len(self._pipelines),
            "ingest_url": self._backend_ingest_url,
        }

    def unregister_camera(self, key: str) -> bool:
        key = (key or "").strip()
        if not key:
            return False
        with self._lock:
            existed = key in self._pipelines
            self._stop_pipeline_locked(key)
        try:
            get_live_manager().unregister_camera(key)
        except Exception:
            pass
        return existed

    def _start_pipeline(self, *, key: str, rtsp_url: str, camera_id: int | None, zone: str, name: str):
        with self._lock:
            self._stop_pipeline_locked(key)
            pipeline = JourneyCameraPipeline(
                camera_key=key,
                camera_id=camera_id,
                rtsp_url=rtsp_url,
                zone=zone,
                name=name,
            )
            stop_event = threading.Event()
            thread = threading.Thread(
                target=self._run_pipeline,
                args=(key, pipeline, stop_event),
                daemon=True,
                name=f"journey-{key}",
            )
            self._pipelines[key] = pipeline
            self._stop_flags[key] = stop_event
            self._threads[key] = thread
            thread.start()
            logger.info("[journey] Started pipeline for %s (%s)", key, name)

    def _stop_pipeline_locked(self, key: str):
        stop = self._stop_flags.pop(key, None)
        if stop:
            stop.set()
        pipeline = self._pipelines.pop(key, None)
        if pipeline:
            pipeline.stop()
        thread = self._threads.pop(key, None)
        if thread:
            thread.join(timeout=2.0)

    def _run_pipeline(self, key: str, pipeline: JourneyCameraPipeline, stop_event: threading.Event):
        interval = max(0.2, float(os.getenv("JOURNEY_INFER_INTERVAL_SEC", "0.5")))
        while not stop_event.is_set():
            try:
                observations = pipeline.process_once()
                for obs in observations:
                    self._post_observation(obs)
            except Exception as exc:
                logger.warning("[journey] Pipeline error %s: %s", key, exc)
            stop_event.wait(interval)

    def _post_observation(self, payload: dict[str, Any]):
        url = self._backend_ingest_url
        if not url:
            return
        headers = {"Content-Type": "application/json"}
        if self._ingest_token:
            headers["X-Journey-Ingest-Token"] = self._ingest_token
        try:
            res = requests.post(url, json=payload, headers=headers, timeout=10)
            if res.status_code >= 400:
                logger.debug("[journey] Ingest %s: %s", res.status_code, res.text[:200])
        except Exception as exc:
            logger.debug("[journey] Ingest failed: %s", exc)

    def status(self) -> dict[str, Any]:
        with self._lock:
            return {
                "running_pipelines": len(self._pipelines),
                "cameras": list(self._pipelines.keys()),
                "ingest_url": self._backend_ingest_url,
            }

    def stop_all(self):
        with self._lock:
            for key in list(self._pipelines.keys()):
                self._stop_pipeline_locked(key)


_manager: JourneyManager | None = None


def get_journey_manager() -> JourneyManager:
    global _manager
    if _manager is None:
        _manager = JourneyManager()
    return _manager
