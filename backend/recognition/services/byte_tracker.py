"""BYTE-style multi-object tracker for face boxes (Kalman + two-stage IoU).

Inspired by Zhang et al., ByteTrack — implemented here without YOLO/lap so
InsightFace detections can keep a stable track id across CCTV frames.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


def _iou_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    if a.size == 0 or b.size == 0:
        return np.zeros((len(a), len(b)), dtype=np.float32)
    ax1, ay1, ax2, ay2 = a[:, 0][:, None], a[:, 1][:, None], a[:, 2][:, None], a[:, 3][:, None]
    bx1, by1, bx2, by2 = b[:, 0][None, :], b[:, 1][None, :], b[:, 2][None, :], b[:, 3][None, :]
    inter_w = np.maximum(0.0, np.minimum(ax2, bx2) - np.maximum(ax1, bx1))
    inter_h = np.maximum(0.0, np.minimum(ay2, by2) - np.maximum(ay1, by1))
    inter = inter_w * inter_h
    area_a = np.maximum(0.0, ax2 - ax1) * np.maximum(0.0, ay2 - ay1)
    area_b = np.maximum(0.0, bx2 - bx1) * np.maximum(0.0, by2 - by1)
    union = area_a + area_b - inter + 1e-6
    return (inter / union).astype(np.float32)


def greedy_iou_match(
    track_boxes: np.ndarray,
    det_boxes: np.ndarray,
    iou_thresh: float,
) -> tuple[list[tuple[int, int]], list[int], list[int]]:
    ious = _iou_matrix(track_boxes, det_boxes)
    matches: list[tuple[int, int]] = []
    used_t: set[int] = set()
    used_d: set[int] = set()
    if ious.size:
        order = np.dstack(np.unravel_index(np.argsort(-ious, axis=None), ious.shape))[0]
        for ti, di in order:
            ti, di = int(ti), int(di)
            if ti in used_t or di in used_d:
                continue
            if ious[ti, di] < iou_thresh:
                break
            used_t.add(ti)
            used_d.add(di)
            matches.append((ti, di))
    unmatched_t = [i for i in range(len(track_boxes)) if i not in used_t]
    unmatched_d = [i for i in range(len(det_boxes)) if i not in used_d]
    return matches, unmatched_t, unmatched_d


def _xyxy_to_xywh(bbox) -> np.ndarray:
    x1, y1, x2, y2 = [float(v) for v in bbox]
    w = max(x2 - x1, 1.0)
    h = max(y2 - y1, 1.0)
    return np.array([(x1 + x2) / 2.0, (y1 + y2) / 2.0, w, h], dtype=np.float32)


def _xywh_to_xyxy(xywh) -> np.ndarray:
    cx, cy, w, h = [float(v) for v in xywh]
    w, h = max(w, 1.0), max(h, 1.0)
    return np.array([cx - w / 2.0, cy - h / 2.0, cx + w / 2.0, cy + h / 2.0], dtype=np.float32)


class _KalmanBBox:
    def __init__(self, bbox):
        xywh = _xyxy_to_xywh(bbox)
        self.mean = np.zeros(8, dtype=np.float32)
        self.mean[:4] = xywh
        self.cov = np.eye(8, dtype=np.float32)
        self.cov[:4, :4] *= 10.0
        self.cov[4:, 4:] *= 100.0

    def predict(self) -> np.ndarray:
        f = np.eye(8, dtype=np.float32)
        for i in range(4):
            f[i, i + 4] = 1.0
        q = np.eye(8, dtype=np.float32)
        q[:4, :4] *= 1.0
        q[4:, 4:] *= 1.5
        self.mean = f @ self.mean
        self.cov = f @ self.cov @ f.T + q
        self.mean[2] = max(self.mean[2], 1.0)
        self.mean[3] = max(self.mean[3], 1.0)
        return self.bbox()

    def update(self, bbox) -> np.ndarray:
        z = _xyxy_to_xywh(bbox)
        h = np.zeros((4, 8), dtype=np.float32)
        h[0, 0] = h[1, 1] = h[2, 2] = h[3, 3] = 1.0
        r = np.eye(4, dtype=np.float32) * 1.5
        s = h @ self.cov @ h.T + r
        k = self.cov @ h.T @ np.linalg.inv(s)
        y = z - h @ self.mean
        self.mean = self.mean + k @ y
        self.cov = (np.eye(8, dtype=np.float32) - k @ h) @ self.cov
        self.mean[2] = max(self.mean[2], 1.0)
        self.mean[3] = max(self.mean[3], 1.0)
        return self.bbox()

    def bbox(self) -> np.ndarray:
        return _xywh_to_xyxy(self.mean[:4])


@dataclass
class STrack:
    track_id: int
    score: float
    kalman: _KalmanBBox
    hits: int = 1
    time_since_update: int = 0
    det_index: int | None = None
    staff_id: int | None = None
    identity_confidence: float = 0.0
    attendance_written: bool = False
    review_queued: bool = False
    extra: dict = field(default_factory=dict)

    @property
    def bbox(self) -> np.ndarray:
        return self.kalman.bbox()


class BYTETracker:
    def __init__(
        self,
        track_high_thresh: float = 0.55,
        track_low_thresh: float = 0.30,
        match_iou: float = 0.30,
        max_time_lost: int = 10,
    ):
        self.track_high_thresh = track_high_thresh
        self.track_low_thresh = track_low_thresh
        self.match_iou = match_iou
        self.max_time_lost = max_time_lost
        self.tracks: list[STrack] = []
        self._next_id = 1

    def update(self, detections: np.ndarray) -> list[STrack]:
        """
        detections: (N, 5) array of [x1, y1, x2, y2, score]
        Returns currently visible tracks (matched this frame).
        """
        dets = np.asarray(detections, dtype=np.float32)
        if dets.ndim == 1:
            dets = dets.reshape(0, 5) if dets.size == 0 else dets.reshape(1, 5)
        if dets.size == 0:
            dets = np.zeros((0, 5), dtype=np.float32)

        for tr in self.tracks:
            tr.kalman.predict()
            tr.time_since_update += 1
            tr.det_index = None

        high_idx = [i for i, d in enumerate(dets) if d[4] >= self.track_high_thresh]
        low_idx = [
            i
            for i, d in enumerate(dets)
            if self.track_low_thresh <= d[4] < self.track_high_thresh
        ]

        pool = list(self.tracks)
        unmatched_tracks = list(range(len(pool)))

        if pool and high_idx:
            tboxes = np.stack([pool[i].bbox for i in unmatched_tracks])
            dboxes = dets[high_idx][:, :4]
            matches, u_t, u_d = greedy_iou_match(tboxes, dboxes, self.match_iou)
            still = []
            for ti, di in matches:
                tr = pool[unmatched_tracks[ti]]
                det_i = high_idx[di]
                tr.kalman.update(dets[det_i][:4])
                tr.score = float(dets[det_i][4])
                tr.hits += 1
                tr.time_since_update = 0
                tr.det_index = det_i
            still = [unmatched_tracks[i] for i in u_t]
            unmatched_high = [high_idx[i] for i in u_d]
            unmatched_tracks = still
        else:
            unmatched_high = list(high_idx)

        if unmatched_tracks and low_idx:
            tboxes = np.stack([pool[i].bbox for i in unmatched_tracks])
            dboxes = dets[low_idx][:, :4]
            matches, u_t, _u_d = greedy_iou_match(tboxes, dboxes, max(self.match_iou - 0.1, 0.15))
            for ti, di in matches:
                tr = pool[unmatched_tracks[ti]]
                det_i = low_idx[di]
                tr.kalman.update(dets[det_i][:4])
                tr.score = float(dets[det_i][4])
                tr.hits += 1
                tr.time_since_update = 0
                tr.det_index = det_i
            unmatched_tracks = [unmatched_tracks[i] for i in u_t]

        for det_i in unmatched_high:
            self.tracks.append(
                STrack(
                    track_id=self._next_id,
                    score=float(dets[det_i][4]),
                    kalman=_KalmanBBox(dets[det_i][:4]),
                    det_index=det_i,
                )
            )
            self._next_id += 1

        alive: list[STrack] = []
        for tr in self.tracks:
            if tr.time_since_update > self.max_time_lost:
                continue
            alive.append(tr)
        self.tracks = alive
        return [tr for tr in self.tracks if tr.time_since_update == 0]
