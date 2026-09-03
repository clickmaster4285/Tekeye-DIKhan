"""
License plate detection (YOLO) + OCR (PaddleOCR PP-OCRv5 GPU).

Logic:
  detect → crop → preprocess variants → PP-OCRv5 → validate → save snapshots.
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
DEFAULT_OCR_VERSION = "PP-OCRv5"
DEFAULT_DET_MODEL = "PP-OCRv5_server_det"
DEFAULT_REC_MODEL = "en_PP-OCRv5_mobile_rec"
CSV_FIELDS = [
    "timestamp",
    "camera_key",
    "plate_number",
    "det_conf",
    "ocr_conf",
    "plate_image",
    "frame_image",
]
# A visit stays open until the plate is unseen on that camera for this long.
DEFAULT_VISIT_TIMEOUT_SEC = 600.0

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


def _paddle_device(ml_device: str) -> str:
    """Map ML_DEVICE (0 / cuda:0 / cpu) to PaddleOCR device (gpu:0 / cpu)."""
    raw = (ml_device or "0").strip().lower()
    if raw in {"cpu", "-1"}:
        return "cpu"
    if raw.startswith("gpu"):
        if ":" in raw:
            return raw
        idx = raw.replace("gpu", "").strip() or "0"
        return f"gpu:{idx}"
    if raw.startswith("cuda"):
        idx = raw.split(":")[-1] if ":" in raw else raw.replace("cuda", "").strip() or "0"
        return f"gpu:{idx}"
    if raw.isdigit():
        return f"gpu:{raw}"
    return "gpu:0"


def _page_to_dict(page: Any) -> dict[str, Any]:
    """Normalize a PaddleOCR 3.x predict() page into a dict with rec_* keys."""
    if isinstance(page, dict):
        if "rec_texts" in page:
            return page
        nested = page.get("res")
        if isinstance(nested, dict):
            return nested
        return page
    json_data = getattr(page, "json", None)
    if callable(json_data):
        try:
            json_data = json_data()
        except Exception:
            json_data = None
    if isinstance(json_data, dict):
        return _page_to_dict(json_data)
    texts = getattr(page, "rec_texts", None)
    if texts is not None:
        return {
            "rec_texts": list(texts),
            "rec_scores": list(getattr(page, "rec_scores", []) or []),
            "rec_polys": list(
                getattr(page, "rec_polys", None) or getattr(page, "dt_polys", None) or []
            ),
        }
    try:
        return {
            "rec_texts": list(page["rec_texts"]),
            "rec_scores": list(page["rec_scores"] if "rec_scores" in page else []),
            "rec_polys": list(page["rec_polys"] if "rec_polys" in page else page.get("dt_polys") or []),
        }
    except Exception:
        return {}


def _as_poly_points(poly: Any) -> list[list[float]]:
    arr = np.asarray(poly)
    if arr.size == 0:
        return []
    if arr.ndim == 2 and arr.shape[1] >= 2:
        return arr[:, :2].astype(float).tolist()
    if arr.ndim == 1 and arr.size >= 8:
        return arr.reshape(-1, 2)[:, :2].astype(float).tolist()
    return []


def _patch_paddlex_opencv_extra() -> None:
    """paddlex[ocr-core] pins opencv-contrib-python; this stack already has opencv-python."""
    import sys

    orig = None
    try:
        from paddlex.utils import deps as paddlex_deps

        orig = paddlex_deps.is_dep_available

        def _is_dep_available(dep, /, check_version=False):
            if dep == "opencv-contrib-python":
                return True
            return orig(dep, check_version=check_version)

        paddlex_deps.is_dep_available = _is_dep_available
        cache_clear = getattr(paddlex_deps.is_extra_available, "cache_clear", None)
        if callable(cache_clear):
            cache_clear()
    except Exception:
        pass
    for name, mod in list(sys.modules.items()):
        if not name.startswith("paddlex") or getattr(mod, "__dict__", None) is None:
            continue
        if "cv2" not in mod.__dict__ and "is_dep_available" in mod.__dict__:
            mod.cv2 = cv2


def paddle_results_to_items(raw: Any) -> list[tuple[list, str, float]]:
    """Convert PaddleOCR predict() output to [(bbox, text, conf), ...] tuples."""
    pages = raw if isinstance(raw, (list, tuple)) else [raw]
    items: list[tuple[list, str, float]] = []
    for page in pages:
        data = _page_to_dict(page)
        texts = list(data.get("rec_texts") or [])
        scores = list(data.get("rec_scores") or [])
        polys = list(data.get("rec_polys") or data.get("dt_polys") or [])
        for i, text in enumerate(texts):
            conf = float(scores[i]) if i < len(scores) else 0.0
            bbox = _as_poly_points(polys[i]) if i < len(polys) else []
            if not bbox:
                bbox = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
            items.append((bbox, str(text), conf))
    return items


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


def bbox_in_osd_band(
    bbox: tuple[int, ...] | list[float],
    frame_h: int,
    frame_w: int,
    *,
    top_frac: float = 0.22,
    left_frac: float = 0.55,
    right_frac: float = 0.55,
    bottom_frac: float = 0.0,
) -> bool:
    """True when a box sits in the CCTV date/time overlay band (must not be saved as a plate)."""
    if frame_h <= 0 or frame_w <= 0 or len(bbox) < 4:
        return False
    x1, y1, x2, y2 = (float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))
    cx = (x1 + x2) / 2.0
    cy = (y1 + y2) / 2.0
    y_top = frame_h * max(0.0, min(top_frac, 0.5))
    y_bottom = frame_h * (1.0 - max(0.0, min(bottom_frac, 0.5)))
    x_left = frame_w * max(0.0, min(left_frac, 1.0))
    x_right = frame_w * (1.0 - max(0.0, min(right_frac, 1.0)))
    if cy <= y_top or y2 <= y_top:
        return True
    if bottom_frac > 0 and (cy >= y_bottom or y1 >= y_bottom):
        return True
    if cy <= y_top * 1.35 and (cx <= x_left or cx >= x_right):
        return True
    return False


def canonicalize_plate(text: str) -> str:
    """Normalize plate text: A-Z0-9 only, strip common city/region OCR noise."""
    return _strip_region_noise(plate_key(text))


def format_plate_display(text: str) -> str:
    key = canonicalize_plate(text) or plate_key(text)
    m = re.match(r"^([A-Z]+)(\d+)$", key)
    if m:
        return f"{m.group(1)} {m.group(2)}"
    m = re.match(r"^(\d+)([A-Z]+)$", key)
    if m:
        return f"{m.group(1)} {m.group(2)}"
    return clean_plate_text(text)


def is_valid_plate(text: str, min_len: int = 5, *, camera_key: str = "") -> bool:
    if looks_like_datetime_ocr(text):
        return False
    if looks_like_camera_overlay(text, camera_key=camera_key):
        return False
    key = canonicalize_plate(text) or plate_key(text)
    if len(key) < min_len:
        return False
    if key in {"UNKNOWN", "PLATE", "LICENSEPLATE"}:
        return False
    if not re.search(r"[A-Z0-9]", key):
        return False
    letters = re.sub(r"\d", "", key)
    if letters in _OSD_DATE_TOKENS:
        return False
    return True


_CAMERA_OVERLAY_RE = re.compile(r"^CAM(ERA)?\d{0,4}$")


def looks_like_camera_overlay(text: str, *, camera_key: str = "") -> bool:
    """True when OCR is a camera name overlay (CAM 002 / CAM-2), not a plate."""
    key = canonicalize_plate(text) or plate_key(text)
    if not key:
        return False
    if _CAMERA_OVERLAY_RE.match(key):
        return True
    cam = plate_key(camera_key)
    if cam and key == cam:
        return True
    return False


def bbox_is_plausible_plate(
    bbox: tuple[int, ...] | list[float],
    frame_h: int,
    frame_w: int,
    *,
    max_width_frac: float = 0.28,
    max_height_frac: float = 0.20,
    max_area_frac: float = 0.05,
    min_aspect: float = 1.2,
    max_aspect: float = 6.5,
) -> bool:
    """False for scene-sized or non-plate-shaped boxes (e.g. CAM-002 overlay region)."""
    if frame_h <= 0 or frame_w <= 0 or len(bbox) < 4:
        return False
    x1, y1, x2, y2 = (float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))
    bw, bh = x2 - x1, y2 - y1
    if bw <= 1 or bh <= 1:
        return False
    if bw / frame_w > max_width_frac:
        return False
    if bh / frame_h > max_height_frac:
        return False
    if (bw * bh) / (frame_w * frame_h) > max_area_frac:
        return False
    aspect = bw / bh
    return min_aspect <= aspect <= max_aspect


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
    plate_box: list[float] | tuple[int, ...],
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
    px1, py1, px2, py2 = map(float, plate_box[:4])
    pcx, pcy = (px1 + px2) / 2.0, (py1 + py2) / 2.0
    plate_area = max(1.0, (px2 - px1) * (py2 - py1))
    for vb in vehicle_boxes:
        expanded = _expand_bbox(vb, frame_w, frame_h, expand)
        ex1, ey1, ex2, ey2 = expanded
        # Plate center inside vehicle (common for front/rear plates)
        if ex1 <= pcx <= ex2 and ey1 <= pcy <= ey2:
            return True
        # Plate mostly contained in vehicle
        ix1, iy1 = max(px1, ex1), max(py1, ey1)
        ix2, iy2 = min(px2, ex2), min(py2, ey2)
        inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
        if inter / plate_area >= 0.5:
            return True
        if _bbox_iou(plate_box, expanded) >= min_iou:
            return True
    return False


FUZZY_MATCH_MIN_OCR = 0.50


def plates_are_same_vehicle(
    a: str,
    b: str,
    conf_a: float = 1.0,
    conf_b: float = 1.0,
) -> bool:
    """Exact plate match, or one-character OCR slip when both reads are trusted."""
    ca = canonicalize_plate(a) or plate_key(a)
    cb = canonicalize_plate(b) or plate_key(b)
    if not ca or not cb:
        return False
    if ca == cb:
        return True
    try:
        if float(conf_a) < FUZZY_MATCH_MIN_OCR or float(conf_b) < FUZZY_MATCH_MIN_OCR:
            return False
    except (TypeError, ValueError):
        return False
    if len(ca) != len(cb):
        return False
    differences = sum(x != y for x, y in zip(ca, cb))
    return differences <= 1


def reading_score(text: str, conf: float) -> float:
    key = canonicalize_plate(text) or plate_key(text)
    return conf + min(len(key), 12) * 0.035


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


class PlateEngine:
    """YOLO plate detector + PaddleOCR PP-OCRv5 reader with media snapshot saving."""

    def __init__(self):
        self.weights = resolve_plate_weights()
        self.detector = None
        self.reader = None
        self.available = False
        self.ocr_backend = "PP-OCRv5"
        self.ocr_device = "cpu"
        self._infer_lock = threading.Lock()
        self._ocr_lock = threading.Lock()
        self._save_lock = threading.Lock()
        # Open visits: camera+plate → last seen, best score, and the CSV/image row to overwrite.
        self._visits: dict[str, dict[str, Any]] = {}
        self.conf = _env_float("ML_PLATE_CONF", 0.25)
        self.min_ocr_conf = _env_float("ML_PLATE_MIN_OCR_CONF", 0.25)
        self.min_det_conf = _env_float("ML_PLATE_MIN_DET_CONF", 0.20)
        self.min_plate_len = _env_int("ML_PLATE_MIN_LEN", 4)
        # Kept for compatibility; visit close uses visit_timeout, not this interval.
        self.save_interval = _env_float("ML_PLATE_SAVE_INTERVAL", 3600.0)
        self.visit_timeout = max(60.0, _env_float("ML_PLATE_VISIT_TIMEOUT", DEFAULT_VISIT_TIMEOUT_SEC))
        # 4K cameras need larger imgsz — 640 misses small plates
        self.imgsz = max(640, _env_int("ML_PLATE_IMGSZ", 1280))
        try:
            from inference_engine import resolve_ml_device

            resolved = resolve_ml_device()
            self.device = "cpu" if resolved == "cpu" else str(resolved)
        except Exception:
            self.device = os.getenv("ML_DEVICE", "0").strip() or "0"
        self.require_vehicle = os.getenv("ML_PLATE_REQUIRE_VEHICLE", "true").strip().lower() in (
            "1",
            "true",
            "yes",
        )
        self.vehicle_iou = _env_float("ML_PLATE_VEHICLE_IOU", 0.02)
        self.vehicle_expand = _env_float("ML_PLATE_VEHICLE_EXPAND", 0.35)
        self.osd_filter = os.getenv("ML_OSD_FILTER", "true").strip().lower() in ("1", "true", "yes")
        self.osd_top = _env_float("ML_OSD_TOP", 0.22)
        self.osd_left = _env_float("ML_OSD_LEFT", 0.55)
        self.osd_right = _env_float("ML_OSD_RIGHT", 0.55)
        self.osd_bottom = _env_float("ML_OSD_BOTTOM", 0.0)
        self._media_dir = resolve_plate_media_dir()
        self._load()

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
            import torch  # noqa: F401 — Windows: load CUDA DLLs before paddlepaddle-gpu

            os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
            _patch_paddlex_opencv_extra()
            from paddleocr import PaddleOCR

            _patch_paddlex_opencv_extra()

            paddle_device = _paddle_device(self.device)
            ocr_version = os.getenv("ML_PADDLE_OCR_VERSION", DEFAULT_OCR_VERSION).strip() or DEFAULT_OCR_VERSION
            det_model = os.getenv("ML_PADDLE_DET_MODEL", DEFAULT_DET_MODEL).strip() or DEFAULT_DET_MODEL
            rec_model = os.getenv("ML_PADDLE_REC_MODEL", DEFAULT_REC_MODEL).strip() or DEFAULT_REC_MODEL
            self.ocr_backend = ocr_version
            self.ocr_device = paddle_device
            kwargs: dict[str, Any] = {
                "device": paddle_device,
                "use_doc_orientation_classify": False,
                "use_doc_unwarping": False,
                "use_textline_orientation": False,
                "text_detection_model_name": det_model,
                "text_recognition_model_name": rec_model,
            }
            self.reader = PaddleOCR(**kwargs)
            print(
                f"[plate] PaddleOCR {ocr_version} ready "
                f"(device={paddle_device}, det={det_model}, rec={rec_model})"
            )
        except Exception as exc:
            print(f"[plate] Failed to load PaddleOCR PP-OCRv5: {exc}")
            return

        self.available = True
        print(f"[plate] Media dir: {self._media_dir}")
        if self.osd_filter:
            print(f"[plate] OSD band skip enabled (top={self.osd_top:.0%}) — clock overlay will not be saved")
        n = self._restore_visits_from_csv()
        print(f"[plate] Visit window {self.visit_timeout:.0f}s — restored {n} open visit(s)")

    def clear_camera_tracks(self, camera_key: str) -> None:
        """Drop open plate visits when a camera stream is stopped or reconnected."""
        cam = (camera_key or "").strip().lower()
        if not cam:
            return
        stale = [
            slot
            for slot, visit in self._visits.items()
            if str(visit.get("camera_key") or "").strip().lower() == cam
        ]
        for slot in stale:
            self._visits.pop(slot, None)

    def ocr_plate(self, crop: np.ndarray) -> tuple[str, float]:
        if self.reader is None or crop is None or crop.size == 0:
            return "", 0.0
        best_text, best_conf, best_score = "", 0.0, -1.0
        variants = preprocess_variants(crop)
        if not variants:
            return "", 0.0
        # Original BGR crop first; extra preprocessed variants only if needed.
        ordered = [variants[-1], *variants[:-1]] if len(variants) > 1 else variants
        for variant in ordered:
            try:
                with self._ocr_lock:
                    raw = self.reader.predict(variant)
            except Exception as exc:
                print(f"[plate] PaddleOCR predict failed: {exc}")
                continue
            results = paddle_results_to_items(raw)
            candidates = [merge_ocr_segments(results)]
            for item in results:
                if len(item) == 3:
                    cleaned = clean_plate_text(item[1])
                    if cleaned:
                        candidates.append((cleaned, float(item[2])))
            improved = False
            for text, conf in candidates:
                if not text:
                    continue
                if not is_valid_plate(text, min_len=self.min_plate_len):
                    continue
                display = format_plate_display(text)
                score = reading_score(text, conf)
                if score > best_score:
                    best_text, best_conf, best_score = display, conf, score
                    improved = True
            if improved and is_valid_plate(best_text, min_len=self.min_plate_len):
                break
        return best_text, best_conf

    @staticmethod
    def _visit_score(det_conf: float, ocr_conf: float) -> float:
        return float(ocr_conf) * float(det_conf) + float(ocr_conf) * 0.5

    def _captures_csv(self) -> Path:
        return resolve_plate_media_dir() / "captures.csv"

    def _abs_media(self, rel: str) -> Path:
        path = (rel or "").strip().replace("\\", "/").lstrip("/")
        if path.startswith("licence plates/"):
            return resolve_media_root() / path
        return resolve_plate_media_dir() / path

    def _match_visit_slot(self, camera_key: str, plate_key: str, ocr_conf: float = 1.0) -> str | None:
        cam = (camera_key or "").strip()
        for slot, visit in self._visits.items():
            if str(visit.get("camera_key") or "").strip().lower() != cam.lower():
                continue
            if plates_are_same_vehicle(
                plate_key,
                str(visit.get("plate_key") or ""),
                ocr_conf,
                float(visit.get("ocr_conf") or 0),
            ):
                return slot
        return None

    def _close_stale_visits(self, now: float) -> None:
        stale = [
            slot
            for slot, visit in self._visits.items()
            if now - float(visit.get("last_seen") or 0) > self.visit_timeout
        ]
        for slot in stale:
            self._visits.pop(slot, None)

    def _restore_visits_from_csv(self) -> int:
        """Re-open visits that are still inside the timeout so an ML restart does not re-save."""
        path = self._captures_csv()
        if not path.is_file():
            return 0
        now = time.time()
        parsed: list[dict[str, Any]] = []
        try:
            with path.open("r", encoding="utf-8", newline="") as f:
                for row in csv.DictReader(f):
                    plate = str(row.get("plate_number") or "").strip()
                    key = canonicalize_plate(plate) or plate_key(plate)
                    if not key:
                        continue
                    ts_raw = str(row.get("timestamp") or "").strip()
                    try:
                        epoch = datetime.fromisoformat(ts_raw.replace("Z", "")).timestamp()
                    except ValueError:
                        continue
                    try:
                        det_conf = float(row.get("det_conf") or 0)
                    except (TypeError, ValueError):
                        det_conf = 0.0
                    try:
                        ocr_conf = float(row.get("ocr_conf") or 0)
                    except (TypeError, ValueError):
                        ocr_conf = 0.0
                    parsed.append(
                        {
                            "epoch": epoch,
                            "camera_key": str(row.get("camera_key") or ""),
                            "plate_key": key,
                            "plate_text": format_plate_display(key),
                            "det_conf": det_conf,
                            "ocr_conf": ocr_conf,
                            "score": self._visit_score(det_conf, ocr_conf),
                            "plate_rel": str(row.get("plate_image") or "").replace("\\", "/"),
                            "frame_rel": str(row.get("frame_image") or "").replace("\\", "/"),
                        }
                    )
        except OSError as exc:
            print(f"[plate] Could not restore visits from CSV: {exc}")
            return 0

        parsed.sort(key=lambda r: float(r["epoch"]), reverse=True)
        restored = 0
        for row in parsed:
            if now - float(row["epoch"]) > self.visit_timeout:
                continue
            if self._match_visit_slot(row["camera_key"], row["plate_key"], float(row.get("ocr_conf") or 0)):
                continue
            slot = f"{row['camera_key']}:{row['plate_key']}"
            self._visits[slot] = {
                "camera_key": row["camera_key"],
                "plate_key": row["plate_key"],
                "plate_text": row["plate_text"],
                "score": row["score"],
                "last_seen": float(row["epoch"]),
                "det_conf": row["det_conf"],
                "ocr_conf": row["ocr_conf"],
                "plate_rel": row["plate_rel"],
                "frame_rel": row["frame_rel"],
            }
            restored += 1
        return restored

    def _write_csv_rows(self, rows: list[dict[str, Any]]) -> None:
        path = self._captures_csv()
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
            writer.writeheader()
            for row in rows:
                writer.writerow({field: row.get(field, "") for field in CSV_FIELDS})

    def _upsert_csv_row(self, record: dict[str, Any], *, match_plate_rel: str = "") -> None:
        path = self._captures_csv()
        rows: list[dict[str, Any]] = []
        if path.is_file():
            with path.open("r", encoding="utf-8", newline="") as f:
                rows = list(csv.DictReader(f))
        target = (match_plate_rel or "").replace("\\", "/")
        updated = False
        if target:
            for row in rows:
                if str(row.get("plate_image") or "").replace("\\", "/") == target:
                    row.update(record)
                    updated = True
                    break
        if not updated:
            rows.append(record)
        self._write_csv_rows(rows)

    def _visit_payload(self, visit: dict[str, Any]) -> dict[str, str]:
        plate_rel = str(visit.get("plate_rel") or "")
        frame_rel = str(visit.get("frame_rel") or "")
        return {
            "plate_image": plate_rel,
            "frame_image": frame_rel,
            "plate_image_abs": str(self._abs_media(plate_rel)) if plate_rel else "",
            "frame_image_abs": str(self._abs_media(frame_rel)) if frame_rel else "",
        }

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
    ) -> dict[str, str] | None:
        """One CSV/image row per visit: overwrite if OCR improves, new row only after the vehicle left."""
        if not is_valid_plate(plate_text, min_len=self.min_plate_len):
            return None
        key = canonicalize_plate(plate_text) or plate_key(plate_text)
        if not key:
            return None
        plate_text = format_plate_display(key)
        score = self._visit_score(det_conf, ocr_conf)
        now = time.time()
        stamp = datetime.now().isoformat(timespec="seconds")

        with self._save_lock:
            # Deleted CSV = clean slate (do not keep stale in-memory visits).
            if not self._captures_csv().is_file():
                self._visits.clear()
            self._close_stale_visits(now)
            slot = self._match_visit_slot(camera_key, key, ocr_conf)
            visit = self._visits.get(slot) if slot else None

            if visit is not None:
                visit["last_seen"] = now
                if not force and score <= float(visit.get("score") or 0):
                    return self._visit_payload(visit)

                plate_rel = str(visit.get("plate_rel") or "")
                frame_rel = str(visit.get("frame_rel") or "")
                plate_path = self._abs_media(plate_rel) if plate_rel else None
                frame_path = self._abs_media(frame_rel) if frame_rel else None
                if plate_path is None or frame_path is None:
                    if slot:
                        self._visits.pop(slot, None)
                else:
                    plate_path.parent.mkdir(parents=True, exist_ok=True)
                    frame_path.parent.mkdir(parents=True, exist_ok=True)
                    cv2.imwrite(str(plate_path), crop)
                    cv2.imwrite(str(frame_path), frame)
                    visit["score"] = max(float(visit.get("score") or 0), score)
                    visit["plate_text"] = plate_text
                    visit["det_conf"] = det_conf
                    visit["ocr_conf"] = ocr_conf
                    self._upsert_csv_row(
                        {
                            "timestamp": stamp,
                            "camera_key": camera_key,
                            "plate_number": plate_text,
                            "det_conf": round(det_conf, 4),
                            "ocr_conf": round(ocr_conf, 4),
                            "plate_image": plate_rel,
                            "frame_image": frame_rel,
                        },
                        match_plate_rel=plate_rel,
                    )
                    return self._visit_payload(visit)

            media = resolve_plate_media_dir()
            file_stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
            cam_prefix = plate_key(camera_key)[:24] if camera_key else "cam"
            plate_name = f"{file_stamp}_{cam_prefix}_{key}.jpg"
            frame_name = f"{file_stamp}_{cam_prefix}_{key}.jpg"
            plate_rel = f"licence plates/plates/{plate_name}"
            frame_rel = f"licence plates/frames/{frame_name}"
            plate_path = media / "plates" / plate_name
            frame_path = media / "frames" / frame_name
            plate_path.parent.mkdir(parents=True, exist_ok=True)
            frame_path.parent.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(plate_path), crop)
            cv2.imwrite(str(frame_path), frame)

            record = {
                "timestamp": stamp,
                "camera_key": camera_key,
                "plate_number": plate_text,
                "det_conf": round(det_conf, 4),
                "ocr_conf": round(ocr_conf, 4),
                "plate_image": plate_rel,
                "frame_image": frame_rel,
            }
            self._upsert_csv_row(record)
            numbers_path = media / "numbers.txt"
            with numbers_path.open("a", encoding="utf-8") as f:
                prefix = f"[{camera_key}] " if camera_key else ""
                f.write(f"{stamp}  {prefix}{plate_text}\n")

            new_slot = f"{camera_key}:{key}"
            self._visits[new_slot] = {
                "camera_key": camera_key,
                "plate_key": key,
                "plate_text": plate_text,
                "score": score,
                "last_seen": now,
                "det_conf": det_conf,
                "ocr_conf": ocr_conf,
                "plate_rel": plate_rel,
                "frame_rel": frame_rel,
            }
            return {
                "plate_image": plate_rel,
                "frame_image": frame_rel,
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
        """Run plate YOLO + OCR on a BGR frame. Optionally save accepted plates to media."""
        if not self.available or self.detector is None or frame is None or frame.size == 0:
            return []

        height, width = frame.shape[:2]
        det_conf_thresh = conf if conf is not None else self.conf
        detections: list[dict[str, Any]] = []
        need_vehicle = self.require_vehicle

        with self._infer_lock:
            results = self.detector.predict(
                frame,
                conf=det_conf_thresh,
                imgsz=self.imgsz,
                device=self.device,
                verbose=False,
            )

        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(width, x2), min(height, y2)
                det_conf = float(box.conf[0])
                if x2 <= x1 or y2 <= y1:
                    continue
                bbox = (x1, y1, x2, y2)
                if not bbox_is_plausible_plate(bbox, height, width):
                    continue
                if self.osd_filter and bbox_in_osd_band(
                    bbox,
                    height,
                    width,
                    top_frac=self.osd_top,
                    left_frac=self.osd_left,
                    right_frac=self.osd_right,
                    bottom_frac=self.osd_bottom,
                ):
                    continue
                crop = frame[y1:y2, x1:x2]
                if crop.size == 0:
                    continue

                near_vehicle = True
                if need_vehicle:
                    near_vehicle = plate_near_vehicle(
                        bbox,
                        vehicle_boxes,
                        frame_w=width,
                        frame_h=height,
                        min_iou=self.vehicle_iou,
                        expand=self.vehicle_expand,
                    )
                if need_vehicle and not near_vehicle:
                    continue

                plate_text, ocr_conf = self.ocr_plate(crop)
                if looks_like_datetime_ocr(plate_text) or looks_like_camera_overlay(
                    plate_text, camera_key=camera_key
                ):
                    continue
                if not is_valid_plate(plate_text, self.min_plate_len, camera_key=camera_key):
                    continue

                accepted = (
                    ocr_conf >= self.min_ocr_conf
                    and det_conf >= self.min_det_conf
                    and near_vehicle
                )
                if not accepted:
                    continue

                saved: dict[str, str] | None = None
                # Only persist accepted reads — no OSD / non-vehicle bypass
                should_save = save and accepted
                if should_save:
                    annotated = frame.copy()
                    label = plate_text if plate_text else "PLATE"
                    draw_plate_box(annotated, bbox, label, accepted)
                    saved = self.save_snapshot(
                        annotated,
                        crop,
                        plate_text or "UNKNOWN",
                        det_conf,
                        ocr_conf,
                        camera_key=camera_key,
                        force=force_save,
                    )

                det: dict[str, Any] = {
                    "class_id": 0,
                    "class_name": "license_plate",
                    "label": plate_text if plate_text else "license_plate",
                    "plate_number": plate_text,
                    "confidence": round(det_conf, 4),
                    "ocr_confidence": round(ocr_conf, 4),
                    "bbox": [x1, y1, x2, y2],
                    "alert": False,
                    "priority": "high",
                    "model": "plate",
                    "accepted": accepted,
                    "near_vehicle": near_vehicle,
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
