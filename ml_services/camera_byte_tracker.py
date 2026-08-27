"""Per-camera ByteTrack so multi-camera live inference does not mix track IDs."""

from __future__ import annotations

from typing import Any

import numpy as np
from ultralytics.trackers.byte_tracker import BYTETracker
from ultralytics.utils import IterableSimpleNamespace, YAML
from ultralytics.utils.checks import check_yaml


def _byte_tracker_args(*, track_buffer: int = 90) -> IterableSimpleNamespace:
    cfg = dict(YAML.load(check_yaml("bytetrack.yaml")))
    cfg["track_buffer"] = max(30, int(track_buffer))
    return IterableSimpleNamespace(**cfg)


class _DetResults:
    """Minimal Results-like wrapper for BYTETracker.update()."""

    __slots__ = ("xyxy", "conf", "cls", "_n")

    def __init__(self, xyxy: np.ndarray, conf: np.ndarray, cls: np.ndarray):
        self.xyxy = xyxy
        self.conf = conf
        self.cls = cls
        self._n = int(xyxy.shape[0]) if xyxy is not None else 0

    @property
    def xywh(self) -> np.ndarray:
        if self._n == 0:
            return np.zeros((0, 4), dtype=np.float32)
        x1 = self.xyxy[:, 0]
        y1 = self.xyxy[:, 1]
        x2 = self.xyxy[:, 2]
        y2 = self.xyxy[:, 3]
        w = np.maximum(0.0, x2 - x1)
        h = np.maximum(0.0, y2 - y1)
        cx = x1 + w * 0.5
        cy = y1 + h * 0.5
        return np.stack([cx, cy, w, h], axis=1).astype(np.float32)

    def __len__(self) -> int:
        return self._n

    def __getitem__(self, mask):
        return _DetResults(self.xyxy[mask], self.conf[mask], self.cls[mask])


class CameraByteTrackerPool:
    """One BYTETracker instance per camera key."""

    def __init__(self, *, track_buffer: int = 90):
        self._track_buffer = track_buffer
        self._trackers: dict[str, BYTETracker] = {}

    def reset(self, camera_key: str = "") -> None:
        if camera_key:
            self._trackers.pop(camera_key, None)
        else:
            self._trackers.clear()

    def _get(self, camera_key: str) -> BYTETracker:
        key = (camera_key or "").strip() or "_default"
        tracker = self._trackers.get(key)
        if tracker is None:
            tracker = BYTETracker(args=_byte_tracker_args(track_buffer=self._track_buffer))
            self._trackers[key] = tracker
        return tracker

    def assign_track_ids(
        self,
        camera_key: str,
        detections: list[dict[str, Any]],
        frame: np.ndarray | None = None,
    ) -> list[dict[str, Any]]:
        """Attach local ByteTrack ``track_id`` onto each detection dict."""
        if not detections:
            return detections

        xyxy = []
        conf = []
        cls = []
        for det in detections:
            bbox = det.get("bbox") or [0, 0, 0, 0]
            if len(bbox) < 4:
                bbox = [0, 0, 0, 0]
            xyxy.append([float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])])
            conf.append(float(det.get("confidence") or 0.0))
            try:
                cls.append(float(int(det.get("class_id", 0))))
            except (TypeError, ValueError):
                cls.append(0.0)

        results = _DetResults(
            np.asarray(xyxy, dtype=np.float32),
            np.asarray(conf, dtype=np.float32),
            np.asarray(cls, dtype=np.float32),
        )
        tracker = self._get(camera_key)
        tracks = tracker.update(results, frame)
        if tracks is None or len(tracks) == 0:
            for det in detections:
                det.pop("track_id", None)
            return detections

        # tracks: x1,y1,x2,y2, track_id, score, cls, idx
        by_idx: dict[int, int] = {}
        for row in np.asarray(tracks, dtype=np.float32):
            if row.shape[0] < 8:
                continue
            track_id = int(row[4])
            idx = int(row[7])
            by_idx[idx] = track_id

        out: list[dict[str, Any]] = []
        for i, det in enumerate(detections):
            tid = by_idx.get(i)
            if tid is None:
                # Unmatched in this frame — keep detection without a stable id
                det = dict(det)
                det.pop("track_id", None)
                out.append(det)
                continue
            enriched = dict(det)
            enriched["track_id"] = tid
            out.append(enriched)
        return out
