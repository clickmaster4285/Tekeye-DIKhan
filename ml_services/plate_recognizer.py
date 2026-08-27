"""
License plate detection (YOLO) + OCR (EasyOCR).

Logic mirrors the standalone License Plate/ project:
  detect → crop → track-gate OCR → validate → save snapshots.

OCR is NOT run on every frame: IoU tracks gate EasyOCR to new plates
and cooldown re-reads (ML_PLATE_OCR_COOLDOWN), which typically cuts OCR 90%+.
"""
from __future__ import annotations

import csv
import os
import re
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import cv2
import numpy as np

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_WEIGHTS = (
    BASE_DIR / "runs" / "train" / "stage3_finetune3" / "weights" / "best_number_plate_detection.pt"
)
OCR_ALLOWLIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 "

_engine: "PlateEngine | None" = None
_engine_lock = threading.Lock()


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


def resolve_media_root() -> Path:
    """Django media root — defaults to backend/media next to ml_services."""
    override = os.getenv("ML_MEDIA_ROOT", "").strip()
    if override:
        return Path(override)
    return (BASE_DIR.parent / "backend" / "media").resolve()


def resolve_plate_media_dir() -> Path:
    """backend/media/licence plates/"""
    override = os.getenv("ML_PLATE_MEDIA_DIR", "").strip()
    if override:
        root = Path(override)
    else:
        root = resolve_media_root() / "licence plates"
    root.mkdir(parents=True, exist_ok=True)
    (root / "plates").mkdir(parents=True, exist_ok=True)
    (root / "frames").mkdir(parents=True, exist_ok=True)
    return root


def resolve_plate_weights() -> Path | None:
    env = os.getenv("ML_PLATE_WEIGHTS", "").strip()
    if env:
        path = Path(env)
        if not path.is_absolute():
            path = BASE_DIR / path
        return path if path.is_file() else None
    if DEFAULT_WEIGHTS.is_file():
        return DEFAULT_WEIGHTS
    # Fallbacks
    legacy = BASE_DIR / "runs" / "plate_detect_v1" / "weights" / "best.pt"
    if legacy.is_file():
        return legacy
    sibling = (
        BASE_DIR.parent
        / "License Plate"
        / "runs"
        / "plate_detect_v1"
        / "weights"
        / "best.pt"
    )
    return sibling if sibling.is_file() else None


def clean_plate_text(text: str | list) -> str:
    if isinstance(text, list):
        text = " ".join(str(t) for t in text)
    text = str(text).upper().strip()
    text = re.sub(r"[^A-Z0-9 ]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def plate_key(text: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", text.upper())


_REGION_NOISE = (
    "ISLAMABAD",
    "ISLAMABA",
    "ISLAMAB",
    "ICT",
    "ISB",
    "PUNJAB",
    "SINDH",
    "KARACHI",
    "LAHORE",
    "PESHAWAR",
    "BALOCH",
    "PAKISTAN",
    "PAK",
    "CITY",
)

# Camera OSD / clock tokens that OCR often turns into fake plates (e.g. "TUE 014").
_OSD_DATE_TOKENS = frozenset(
    {
        "MON",
        "TUE",
        "WED",
        "THU",
        "FRI",
        "SAT",
        "SUN",
        "JAN",
        "FEB",
        "MAR",
        "APR",
        "MAY",
        "JUN",
        "JUL",
        "AUG",
        "SEP",
        "OCT",
        "NOV",
        "DEC",
    }
)
_DATETIME_OCR_RE = re.compile(
    r"("
    r"\b(20\d{2}|19\d{2})\b|"  # year
    r"\b\d{1,2}[:.]\d{2}([:.]\d{2})?\b|"  # time HH:MM(:SS)
    r"\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|"  # date
    r"\b(MON|TUE|WED|THU|FRI|SAT|SUN|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b"
    r")",
    re.IGNORECASE,
)


def _strip_region_noise(key: str) -> str:
    out = key
    for token in _REGION_NOISE:
        out = out.replace(token, "")
    return out


def looks_like_datetime_ocr(text: str) -> bool:
    """True when OCR text is likely a camera timestamp / OSD, not a plate."""
    raw = str(text or "").strip()
    if not raw:
        return False
    if _DATETIME_OCR_RE.search(raw):
        return True
    key = plate_key(raw)
    if not key:
        return False
    # Weekday/month as letter prefix: TUE014, AUG2026, WED024
    for token in _OSD_DATE_TOKENS:
        if key.startswith(token) and re.search(r"\d", key[len(token) :]):
            return True
    # Pure digit clocks / dates after cleanup (e.g. 05082026)
    if key.isdigit() and len(key) >= 6:
        return True
    return False


def canonicalize_plate(text: str) -> str:
    """Extract PK-style plate (BSD987) from OCR that often includes city text."""
    key = _strip_region_noise(plate_key(text))
    if not key:
        return ""
    candidates: list[str] = []
    candidates.extend(re.findall(r"[A-Z]{2,3}\d{3}", key))
    candidates.extend(re.findall(r"[A-Z]{2,3}\d{4}", key))
    if not candidates:
        m = re.search(r"([A-Z]{2,4})(\d{3,4})", key)
        if m:
            candidates.append(m.group(1) + m.group(2))
    if candidates:
        def rank(c: str) -> tuple[int, int, int]:
            letters = re.match(r"[A-Z]+", c)
            digits = re.search(r"\d+", c)
            la = letters.group(0) if letters else ""
            da = digits.group(0) if digits else ""
            style = 0 if len(la) == 3 and len(da) == 3 else 1
            return (style, 0 if len(da) == 3 else 1, len(c))

        return sorted(set(candidates), key=rank)[0]
    m = re.match(r"^([A-Z]{2,3})(\d{3,4})", key)
    if m:
        return m.group(1) + m.group(2)
    return ""


def format_plate_display(text: str) -> str:
    canon = canonicalize_plate(text) or plate_key(text)
    m = re.match(r"^([A-Z]+)(\d+)$", canon)
    if m:
        return f"{m.group(1)} {m.group(2)}"
    return clean_plate_text(text)


def is_valid_plate(text: str, min_len: int = 5) -> bool:
    if looks_like_datetime_ocr(text):
        return False
    canon = canonicalize_plate(text)
    key = canon or plate_key(text)
    if len(key) < min_len:
        return False
    if key in {"UNKNOWN", "PLATE", "LICENSEPLATE"}:
        return False
    if not canon:
        return False
    if not re.search(r"[A-Z]", key) or not re.search(r"\d", key):
        return False
    letters = re.sub(r"\d", "", canon)
    digits = re.sub(r"\D", "", canon)
    if len(letters) < 2 or len(digits) < 3:
        return False
    # Reject weekday/month letter runs that slipped past canonicalize
    if letters in _OSD_DATE_TOKENS:
        return False
    return True


def _bbox_iou(a: list[float] | tuple[int, ...], b: list[float] | tuple[int, ...]) -> float:
    ax1, ay1, ax2, ay2 = map(float, a[:4])
    bx1, by1, bx2, by2 = map(float, b[:4])
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def _expand_bbox(
    box: list[float] | tuple[int, ...],
    frame_w: int,
    frame_h: int,
    expand: float,
) -> list[float]:
    x1, y1, x2, y2 = map(float, box[:4])
    bw, bh = max(1.0, x2 - x1), max(1.0, y2 - y1)
    pad_x, pad_y = bw * expand, bh * expand
    return [
        max(0.0, x1 - pad_x),
        max(0.0, y1 - pad_y),
        min(float(frame_w), x2 + pad_x),
        min(float(frame_h), y2 + pad_y),
    ]


def plate_near_vehicle(
    plate_bbox: list[float] | tuple[int, ...],
    vehicle_boxes: list[list[float]] | None,
    *,
    frame_w: int,
    frame_h: int,
    min_iou: float = 0.02,
    expand: float = 0.35,
) -> bool:
    """True if the plate overlaps (or sits inside) an expanded vehicle box."""
    if not vehicle_boxes:
        return False
    expanded_plate = _expand_bbox(plate_bbox, frame_w, frame_h, expand)
    px1, py1, px2, py2 = expanded_plate
    pcx, pcy = (px1 + px2) / 2.0, (py1 + py2) / 2.0
    for vb in vehicle_boxes:
        if _bbox_iou(expanded_plate, vb) >= min_iou:
            return True
        vx1, vy1, vx2, vy2 = map(float, vb[:4])
        # Plate center inside vehicle (common for front/rear plates)
        if vx1 <= pcx <= vx2 and vy1 <= pcy <= vy2:
            return True
        # Plate mostly contained in vehicle
        if vx1 - (vx2 - vx1) * 0.1 <= px1 and px2 <= vx2 + (vx2 - vx1) * 0.1:
            if vy1 - (vy2 - vy1) * 0.1 <= py1 and py2 <= vy2 + (vy2 - vy1) * 0.15:
                return True
    return False


def _edit_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a or not b:
        return max(len(a), len(b))
    if abs(len(a) - len(b)) > 2:
        return 99
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def plates_are_same_vehicle(a: str, b: str) -> bool:
    ca = canonicalize_plate(a) or plate_key(a)
    cb = canonicalize_plate(b) or plate_key(b)
    if not ca or not cb:
        return False
    if ca == cb:
        return True
    la, da = re.sub(r"\d", "", ca), re.sub(r"\D", "", ca)
    lb, db = re.sub(r"\d", "", cb), re.sub(r"\D", "", cb)
    digits_ok = da == db or (
        abs(len(da) - len(db)) == 1 and (da in db or db in da)
    ) or (len(da) == len(db) and _edit_distance(da, db) <= 1)
    if not digits_ok:
        return False
    if la == lb:
        return True
    if min(len(la), len(lb)) >= 2 and (
        la.endswith(lb) or lb.endswith(la) or la.startswith(lb) or lb.startswith(la)
    ):
        return True
    return _edit_distance(la, lb) <= 1


def reading_score(text: str, conf: float) -> float:
    canon = canonicalize_plate(text)
    key = canon or plate_key(text)
    # Prefer classic XXX999 and penalize long junk strings
    bonus = 0.25 if re.fullmatch(r"[A-Z]{3}\d{3}", key or "") else 0.0
    penalty = max(0, len(plate_key(text)) - 7) * 0.08
    return conf + min(len(key), 12) * 0.035 + bonus - penalty


def scale_for_plate_detect(
    frame: np.ndarray,
    max_w: int,
    max_h: int,
) -> tuple[np.ndarray, float, float]:
    """Return (detect_frame, sx, sy) mapping detect pixels → original pixels."""
    if frame is None or frame.size == 0:
        return frame, 1.0, 1.0
    h, w = frame.shape[:2]
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


def map_box_to_original(
    box: tuple[int, int, int, int] | list[int],
    sx: float,
    sy: float,
    orig_w: int,
    orig_h: int,
) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = (int(box[0]), int(box[1]), int(box[2]), int(box[3]))
    ox1 = max(0, min(orig_w, int(round(x1 * sx))))
    oy1 = max(0, min(orig_h, int(round(y1 * sy))))
    ox2 = max(0, min(orig_w, int(round(x2 * sx))))
    oy2 = max(0, min(orig_h, int(round(y2 * sy))))
    if ox2 <= ox1 or oy2 <= oy1:
        return x1, y1, x2, y2
    return ox1, oy1, ox2, oy2


def upscale(crop: np.ndarray, min_height: int = 120) -> np.ndarray:
    h, w = crop.shape[:2]
    scale = max(1.0, min_height / max(h, 1))
    if scale > 1.0:
        crop = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    return crop


def preprocess_variants(crop: np.ndarray) -> list[np.ndarray]:
    if crop.size == 0:
        return []
    crop = upscale(crop)
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    blur = cv2.bilateralFilter(enhanced, 9, 75, 75)
    sharp = cv2.filter2D(blur, -1, np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]]))
    _, binary = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if np.mean(binary) > 127:
        binary = cv2.bitwise_not(binary)
    return [
        cv2.cvtColor(sharp, cv2.COLOR_GRAY2BGR),
        cv2.cvtColor(blur, cv2.COLOR_GRAY2BGR),
        cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR),
        crop,
    ]


def merge_ocr_segments(results: list, min_conf: float = 0.1) -> tuple[str, float]:
    segments: list[dict] = []
    for item in results:
        if len(item) != 3:
            continue
        bbox, text, conf = item
        cleaned = clean_plate_text(text)
        if not cleaned or float(conf) < min_conf:
            continue
        xs = [p[0] for p in bbox]
        segments.append(
            {
                "left": min(xs),
                "right": max(xs),
                "text": cleaned.replace(" ", ""),
                "conf": float(conf),
            }
        )
    if not segments:
        return "", 0.0
    segments.sort(key=lambda s: s["left"])
    parts = [segments[0]["text"]]
    confs = [segments[0]["conf"]]
    for i in range(1, len(segments)):
        prev, curr = segments[i - 1], segments[i]
        gap = curr["left"] - prev["right"]
        avg_char_w = max((prev["right"] - prev["left"]) / max(len(prev["text"]), 1), 8.0)
        if gap > avg_char_w * 0.4:
            parts.append(" ")
        parts.append(curr["text"])
        confs.append(curr["conf"])
    return clean_plate_text("".join(parts)), sum(confs) / len(confs)


def draw_plate_box(frame: np.ndarray, box: tuple[int, int, int, int], text: str, ok: bool) -> None:
    x1, y1, x2, y2 = box
    color = (0, 255, 0) if ok else (0, 165, 255)
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
    label = text if text else "PLATE"
    (tw, th), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
    y_text = max(y1 - 8, th + 8)
    cv2.rectangle(frame, (x1, y_text - th - 8), (x1 + tw + 8, y_text + baseline), color, -1)
    cv2.putText(frame, label, (x1 + 4, y_text), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)


def _bbox_iou(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    union = area_a + area_b - inter
    return float(inter / union) if union > 0 else 0.0


class _PlateTrackState:
    __slots__ = (
        "track_id",
        "bbox",
        "last_seen",
        "last_ocr_at",
        "plate_text",
        "ocr_conf",
        "ocr_done",
    )

    def __init__(self, track_id: int, bbox: tuple[int, int, int, int], now: float):
        self.track_id = track_id
        self.bbox = bbox
        self.last_seen = now
        self.last_ocr_at = 0.0
        self.plate_text = ""
        self.ocr_conf = 0.0
        self.ocr_done = False  # True after a valid accepted OCR read


class PlateOcrTracker:
    """
    IoU plate tracks + OCR gating:
      - OCR when track is new / not yet successfully read
      - Re-OCR only after cooldown (default 2s)
    Cuts EasyOCR calls dramatically vs every detection.
    """

    def __init__(
        self,
        *,
        iou_match: float = 0.3,
        ttl_sec: float = 3.0,
        ocr_cooldown: float = 2.0,
        ocr_retry: float = 0.25,
    ):
        self.iou_match = max(0.05, float(iou_match))
        self.ttl_sec = max(0.5, float(ttl_sec))
        self.ocr_cooldown = max(0.5, float(ocr_cooldown))
        self.ocr_retry = max(0.0, float(ocr_retry))
        self._lock = threading.Lock()
        self._tracks: dict[str, dict[int, _PlateTrackState]] = {}
        self._next_id: dict[str, int] = {}

    def clear_camera(self, camera_key: str) -> None:
        key = (camera_key or "").strip() or "_default"
        with self._lock:
            self._tracks.pop(key, None)
            self._next_id.pop(key, None)

    def _prune_locked(self, cam: str, now: float) -> None:
        tracks = self._tracks.get(cam)
        if not tracks:
            return
        stale = [tid for tid, t in tracks.items() if (now - t.last_seen) > self.ttl_sec]
        for tid in stale:
            tracks.pop(tid, None)

    def assign(self, camera_key: str, bbox: tuple[int, int, int, int], now: float) -> _PlateTrackState:
        cam = (camera_key or "").strip() or "_default"
        with self._lock:
            if cam not in self._tracks:
                self._tracks[cam] = {}
                self._next_id[cam] = 1
            self._prune_locked(cam, now)
            tracks = self._tracks[cam]
            best_id = None
            best_iou = self.iou_match
            for tid, state in tracks.items():
                iou = _bbox_iou(bbox, state.bbox)
                if iou >= best_iou:
                    best_iou = iou
                    best_id = tid
            if best_id is not None:
                state = tracks[best_id]
                state.bbox = bbox
                state.last_seen = now
                return state
            tid = self._next_id[cam]
            self._next_id[cam] = tid + 1
            state = _PlateTrackState(tid, bbox, now)
            tracks[tid] = state
            return state

    def should_ocr(self, track: _PlateTrackState, now: float) -> bool:
        """OCR new tracks; retry until success; re-OCR after cooldown once done."""
        if not track.ocr_done:
            if track.last_ocr_at <= 0:
                return True
            return (now - track.last_ocr_at) >= self.ocr_retry
        return (now - track.last_ocr_at) >= self.ocr_cooldown

    def mark_ocr(
        self,
        track: _PlateTrackState,
        *,
        plate_text: str,
        ocr_conf: float,
        accepted: bool,
        now: float,
    ) -> None:
        track.last_ocr_at = now
        if plate_text and (accepted or ocr_conf >= track.ocr_conf):
            track.plate_text = plate_text
            track.ocr_conf = float(ocr_conf)
        if accepted and plate_text:
            track.ocr_done = True


class PlateEngine:
    """YOLO plate detector + EasyOCR reader with media snapshot saving."""

    def __init__(self):
        self.weights = resolve_plate_weights()
        self.detector = None
        self.reader = None
        self.available = False
        self._infer_lock = threading.Lock()
        self._save_lock = threading.Lock()
        self._last_saved: dict[str, float] = {}
        self._best_saved: dict[str, float] = {}  # raw track slot → best score
        self._raw_was_valid: dict[str, bool] = {}
        self.conf = _env_float("ML_PLATE_CONF", 0.45)
        self.min_ocr_conf = _env_float(
            "ML_PLATE_RECO_CONF",
            _env_float("ML_PLATE_MIN_OCR_CONF", 0.45),
        )
        self.min_det_conf = _env_float("ML_PLATE_MIN_DET_CONF", 0.45)
        self.min_plate_len = _env_int("ML_PLATE_MIN_LEN", 5)
        # Only used when upgrading a track from UNKNOWN → accepted text
        self.save_interval = _env_float("ML_PLATE_SAVE_INTERVAL", 3600.0)
        # Detect on a ~1080p copy; crop/OCR always from the original (4K) frame.
        self.detect_width = max(0, _env_int("ML_PLATE_DETECT_WIDTH", 1920))
        self.detect_height = max(0, _env_int("ML_PLATE_DETECT_HEIGHT", 1080))
        self.imgsz = max(640, _env_int("ML_PLATE_IMGSZ", 1280))
        self.device = "cpu"
        try:
            from inference_engine import resolve_ml_device

            resolved = resolve_ml_device()
            self.device = "cpu" if resolved == "cpu" else str(resolved)
        except Exception:
            raw = os.getenv("ML_DEVICE", "0").strip() or "0"
            self.device = "cpu" if raw.lower() == "cpu" else raw
        self.require_vehicle = os.getenv("ML_PLATE_REQUIRE_VEHICLE", "true").strip().lower() in (
            "1",
            "true",
            "yes",
        )
        self.vehicle_iou = _env_float("ML_PLATE_VEHICLE_IOU", 0.02)
        self.vehicle_expand = _env_float("ML_PLATE_VEHICLE_EXPAND", 0.35)
        # Track-based OCR: new track → OCR once; re-OCR only after cooldown
        self._ocr_tracker = PlateOcrTracker(
            iou_match=_env_float("ML_PLATE_TRACK_IOU", 0.3),
            ttl_sec=_env_float("ML_PLATE_TRACK_TTL", 3.0),
            ocr_cooldown=_env_float("ML_PLATE_OCR_COOLDOWN", 2.0),
            ocr_retry=_env_float("ML_PLATE_OCR_RETRY", 0.25),
        )
        self._media_dir = resolve_plate_media_dir()
        self._load()

    def clear_camera_tracks(self, camera_key: str) -> None:
        self._ocr_tracker.clear_camera(camera_key)

    def _load(self) -> None:
        if self.weights is None:
            print("[plate] Weights not found — plate detection disabled")
            return
        try:
            from ultralytics import YOLO

            self.detector = YOLO(str(self.weights))
            print(f"[plate] YOLO loaded: {self.weights}")
        except Exception as exc:
            print(f"[plate] Failed to load YOLO: {exc}")
            return

        try:
            import easyocr

            use_gpu = self.device.lower() != "cpu"
            try:
                self.reader = easyocr.Reader(["en"], gpu=use_gpu, verbose=False)
                print(f"[plate] EasyOCR ready (gpu={use_gpu})")
            except Exception as gpu_exc:
                if not use_gpu:
                    raise
                print(f"[plate] EasyOCR GPU failed ({gpu_exc}) — retrying CPU")
                self.device = "cpu"
                self.reader = easyocr.Reader(["en"], gpu=False, verbose=False)
                print("[plate] EasyOCR ready (gpu=False)")
        except Exception as exc:
            print(f"[plate] Failed to load EasyOCR: {exc}")
            return

        self.available = True
        print(f"[plate] Media dir: {self._media_dir}")

    def ocr_plate(self, crop: np.ndarray) -> tuple[str, float]:
        if self.reader is None or crop is None or crop.size == 0:
            return "", 0.0
        best_text, best_conf, best_score = "", 0.0, -1.0
        for variant in preprocess_variants(crop):
            results = self.reader.readtext(
                variant,
                detail=1,
                paragraph=False,
                allowlist=OCR_ALLOWLIST,
                width_ths=0.5,
                height_ths=0.5,
            )
            candidates = [merge_ocr_segments(results)]
            for item in results:
                if len(item) == 3:
                    cleaned = clean_plate_text(item[1])
                    if cleaned:
                        candidates.append((cleaned, float(item[2])))
            for text, conf in candidates:
                if not text:
                    continue
                if looks_like_datetime_ocr(text):
                    continue
                canon = canonicalize_plate(text)
                if not canon:
                    continue
                display = format_plate_display(canon)
                score = reading_score(text, conf)
                if score > best_score:
                    best_text, best_conf, best_score = display, conf, score
        return best_text, best_conf

    def save_snapshot(
        self,
        frame: np.ndarray,
        crop: np.ndarray,
        plate_text: str,
        det_conf: float,
        ocr_conf: float,
        *,
        camera_key: str = "",
        force: bool = False,
        track_id: int = 0,
        bbox: tuple[int, int, int, int] | None = None,
    ) -> dict[str, str] | None:
        """Save a 4K-source plate crop. OCR/format/OSD never block the JPEG."""
        valid = is_valid_plate(plate_text, min_len=self.min_plate_len)
        if valid:
            key = canonicalize_plate(plate_text) or plate_key(plate_text)
            plate_text = format_plate_display(key) if key else "UNKNOWN"
            if not key:
                valid = False
                key = "UNKNOWN"
                plate_text = "UNKNOWN"
        else:
            key = "UNKNOWN"
            plate_text = "UNKNOWN"

        if track_id:
            slot = f"{camera_key}:raw:{int(track_id)}"
        elif bbox is not None:
            cx = int((bbox[0] + bbox[2]) / 2) // 80
            cy = int((bbox[1] + bbox[3]) / 2) // 80
            slot = f"{camera_key}:raw:{cx}_{cy}"
        else:
            slot = f"{camera_key}:raw:{key}"

        score = float(ocr_conf) * float(det_conf) + float(ocr_conf) * 0.5
        now = time.time()
        with self._save_lock:
            if not force:
                last = self._last_saved.get(slot, 0.0)
                prev_best = self._best_saved.get(slot, 0.0)
                prev_valid = self._raw_was_valid.get(slot, False)
                if last > 0:
                    # One raw crop per track. Allow a second write only to
                    # upgrade UNKNOWN → accepted plate text (or a clearly better read).
                    if prev_valid and (not valid or score <= prev_best * 1.05):
                        return None
                    if not prev_valid and not valid:
                        return None
            self._last_saved[slot] = now
            self._best_saved[slot] = max(self._best_saved.get(slot, 0.0), score)
            self._raw_was_valid[slot] = bool(valid or self._raw_was_valid.get(slot, False))

        media = resolve_plate_media_dir()
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        safe = key
        cam_prefix = plate_key(camera_key)[:24] if camera_key else "cam"
        plate_name = f"{stamp}_{cam_prefix}_{safe}.jpg"
        frame_name = f"{stamp}_{cam_prefix}_{safe}.jpg"
        plate_path = media / "plates" / plate_name
        frame_path = media / "frames" / frame_name

        annotated = frame.copy()
        # Prefer drawing using crop location if present in detections later;
        # for now draw nothing extra if box unknown — frame already annotated by caller.
        cv2.imwrite(str(plate_path), crop)
        cv2.imwrite(str(frame_path), annotated)

        log_path = media / "captures.csv"
        write_header = not log_path.exists()
        with self._save_lock:
            with log_path.open("a", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(
                    f,
                    fieldnames=[
                        "timestamp",
                        "camera_key",
                        "plate_number",
                        "det_conf",
                        "ocr_conf",
                        "plate_image",
                        "frame_image",
                    ],
                )
                if write_header:
                    writer.writeheader()
                writer.writerow(
                    {
                        "timestamp": datetime.now().isoformat(timespec="seconds"),
                        "camera_key": camera_key,
                        "plate_number": plate_text,
                        "det_conf": round(det_conf, 4),
                        "ocr_conf": round(ocr_conf, 4),
                        "plate_image": f"licence plates/plates/{plate_name}",
                        "frame_image": f"licence plates/frames/{frame_name}",
                    }
                )
            numbers_path = media / "numbers.txt"
            with numbers_path.open("a", encoding="utf-8") as f:
                prefix = f"[{camera_key}] " if camera_key else ""
                f.write(f"{datetime.now().isoformat(timespec='seconds')}  {prefix}{plate_text}\n")

        return {
            "plate_image": f"licence plates/plates/{plate_name}",
            "frame_image": f"licence plates/frames/{frame_name}",
            "plate_image_abs": str(plate_path),
            "frame_image_abs": str(frame_path),
        }

    def detect_and_read(
        self,
        frame: np.ndarray,
        *,
        camera_key: str = "",
        conf: float | None = None,
        save: bool = True,
        force_save: bool = False,
        vehicle_boxes: list[list[float]] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Plate YOLO on a scaled copy (~1080p), crop from original 4K, save every
        qualifying detection (per track), then OCR for ABC 123 / UNKNOWN labels.
        Vehicle / OCR success / Pakistan format / OSD never block the crop.
        """
        if not self.available or self.detector is None or frame is None or frame.size == 0:
            return []

        orig_h, orig_w = frame.shape[:2]
        detect_frame, sx, sy = scale_for_plate_detect(
            frame, self.detect_width, self.detect_height
        )
        det_h, det_w = detect_frame.shape[:2]
        det_conf_thresh = conf if conf is not None else self.conf
        detections: list[dict[str, Any]] = []
        now = time.time()

        with self._infer_lock:
            results = self.detector.predict(
                detect_frame,
                conf=det_conf_thresh,
                imgsz=self.imgsz,
                device=self.device,
                verbose=False,
            )

        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                dx1, dy1, dx2, dy2 = map(int, box.xyxy[0].tolist())
                dx1, dy1 = max(0, dx1), max(0, dy1)
                dx2, dy2 = min(det_w, dx2), min(det_h, dy2)
                det_conf = float(box.conf[0])
                if dx2 <= dx1 or dy2 <= dy1:
                    continue
                x1, y1, x2, y2 = map_box_to_original(
                    (dx1, dy1, dx2, dy2), sx, sy, orig_w, orig_h
                )
                if x2 <= x1 or y2 <= y1:
                    continue
                crop = frame[y1:y2, x1:x2]
                if crop.size == 0:
                    continue

                bbox = (x1, y1, x2, y2)
                track = self._ocr_tracker.assign(camera_key, bbox, now)
                near_vehicle = plate_near_vehicle(
                    bbox,
                    vehicle_boxes,
                    frame_w=orig_w,
                    frame_h=orig_h,
                    min_iou=self.vehicle_iou,
                    expand=self.vehicle_expand,
                )

                # OCR labels the crop; it is not a save gate.
                run_ocr = self._ocr_tracker.should_ocr(track, now)
                plate_text = track.plate_text
                ocr_conf = track.ocr_conf
                ocr_ran = False
                if run_ocr:
                    plate_text, ocr_conf = self.ocr_plate(crop)
                    ocr_ran = True
                    if looks_like_datetime_ocr(plate_text):
                        # Keep the JPEG; never store OSD/clock text as a plate number.
                        plate_text, ocr_conf = "", 0.0

                accepted = is_valid_plate(plate_text, self.min_plate_len) and ocr_conf >= self.min_ocr_conf

                if ocr_ran:
                    self._ocr_tracker.mark_ocr(
                        track,
                        plate_text=plate_text,
                        ocr_conf=ocr_conf,
                        accepted=accepted,
                        now=now,
                    )
                    plate_text = track.plate_text or plate_text
                    ocr_conf = track.ocr_conf if track.ocr_conf else ocr_conf
                    accepted = is_valid_plate(plate_text, self.min_plate_len) and ocr_conf >= self.min_ocr_conf

                save_text = plate_text if accepted else "UNKNOWN"
                overlay_text = save_text

                saved: dict[str, str] | None = None
                if save:
                    annotated = frame.copy()
                    draw_plate_box(annotated, bbox, overlay_text, accepted)
                    saved = self.save_snapshot(
                        annotated,
                        crop,
                        save_text,
                        det_conf,
                        ocr_conf,
                        camera_key=camera_key,
                        force=force_save,
                        track_id=track.track_id,
                        bbox=bbox,
                    )

                det: dict[str, Any] = {
                    "class_id": 0,
                    "class_name": "license_plate",
                    "label": overlay_text,
                    "plate_number": overlay_text,
                    "confidence": round(det_conf, 4),
                    "ocr_confidence": round(float(ocr_conf), 4),
                    "bbox": [x1, y1, x2, y2],
                    "alert": False,
                    "priority": "high",
                    "model": "plate",
                    "accepted": accepted,
                    "near_vehicle": near_vehicle,
                    "track_id": track.track_id,
                    "ocr_ran": ocr_ran,
                }
                if saved:
                    det["plate_image"] = saved["plate_image"]
                    det["frame_image"] = saved["frame_image"]
                detections.append(det)

        return detections


def get_plate_engine() -> PlateEngine:
    global _engine
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                _engine = PlateEngine()
    return _engine
