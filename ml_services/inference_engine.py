"""Shared YOLO + face inference for API and scripts."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from face_recognizer import KnownFaceDB

BASE_DIR = Path(__file__).resolve().parent
WEIGHTS_DIR = BASE_DIR / "runs" / "train" / "stage3_finetune3" / "weights"

# Multi-model live stack:
# 1) yolo26l.pt — COCO pretrained (classes 0–79, allowlisted)
# 2) best.pt — custom classes only (drop COCO 0–79)
# 3) best_Smoke_Detection.pt — fire/smoke specialist
# 4) best_weapon_detection.pt — weapon specialist
YOLO_WEIGHTS_COCO = WEIGHTS_DIR / "yolo26l.pt"
YOLO_WEIGHTS_CUSTOM = WEIGHTS_DIR / "best.pt"
YOLO_WEIGHTS_SMOKE = WEIGHTS_DIR / "best_Smoke_Detection.pt"
YOLO_WEIGHTS_WEAPON = WEIGHTS_DIR / "best_weapon_detection.pt"

YOLO_WEIGHTS_ENV = os.getenv("ML_YOLO_WEIGHTS", "").strip()
YOLO_CUSTOM_WEIGHTS_ENV = os.getenv("ML_YOLO_CUSTOM_WEIGHTS", "").strip()
YOLO_SMOKE_WEIGHTS_ENV = os.getenv("ML_YOLO_SMOKE_WEIGHTS", "").strip()
YOLO_WEAPON_WEIGHTS_ENV = os.getenv("ML_YOLO_WEAPON_WEIGHTS", "").strip()

COCO_MAX_CLASS_ID = int(os.getenv("ML_COCO_MAX_CLASS_ID", "79"))
ALERT_CLASS_IDS = {80, 81, 82, 83}  # face / weapons from best.pt (fire/smoke use smoke model)
FIRE_SMOKE_KEYWORDS = ("fire", "smoke", "flame", "burning")
# Dropped from best.pt — handled by best_Smoke_Detection.pt instead.
CUSTOM_EXCLUDED_CLASS_IDS = frozenset({84, 85})  # fire, smoke
CUSTOM_EXCLUDED_CLASS_NAMES = frozenset({"fire", "smoke", "flame", "burning"})
try:
    SMOKE_FIRE_MIN_CONF = float(os.getenv("ML_SMOKE_FIRE_CONF", "0.42"))
except ValueError:
    SMOKE_FIRE_MIN_CONF = 0.42
try:
    WEAPON_MIN_CONF = float(os.getenv("ML_WEAPON_CONF", "0.40"))
except ValueError:
    WEAPON_MIN_CONF = 0.40

# COCO allowlist for yolo26l.pt — all other COCO classes are dropped at predict + parse.
# Weapons / fire / smoke come from specialist models (not COCO).
# High: person, vehicles, bags, phone, laptop, knife
# Medium: bicycle, bench, chair, dining table, bottle (left-behind items)
ALLOWED_COCO_CLASS_IDS: frozenset[int] = frozenset(
    {
        0,   # person
        1,   # bicycle (medium)
        2,   # car
        3,   # motorcycle
        5,   # bus
        7,   # truck
        13,  # bench (medium)
        24,  # backpack
        26,  # handbag
        28,  # suitcase
        39,  # bottle (medium)
        43,  # knife — keep COCO knife (not dropped)
        56,  # chair (medium)
        60,  # dining table (medium)
        63,  # laptop
        67,  # cell phone
    }
)
ALLOWED_COCO_CLASS_NAMES = frozenset(
    {
        # High priority
        "person",
        "car",
        "truck",
        "bus",
        "motorcycle",
        "backpack",
        "handbag",
        "suitcase",
        "cell phone",
        "laptop",
        "knife",
        # Medium priority
        "bicycle",
        "bench",
        "chair",
        "dining table",
        "bottle",
    }
)
HIGH_PRIORITY_CLASS_NAMES = frozenset(
    {
        "person",
        "car",
        "truck",
        "bus",
        "motorcycle",
        "backpack",
        "handbag",
        "suitcase",
        "cell phone",
        "laptop",
        "knife",
        "weapon",
        "gun",
        "pistol",
        "rifle",
        "firearm",
        "sword",
        "machete",
        "heavy-weapon",
        "knife_weapon",
        "fire",
        "smoke",
        "flame",
        "burning",
    }
)
MEDIUM_PRIORITY_CLASS_NAMES = frozenset(
    {
        "bicycle",
        "bench",
        "chair",
        "dining table",
        "bottle",
    }
)

_yolo_coco = None
_yolo_custom = None
_yolo_smoke = None
_yolo_weapon = None
_face_db: KnownFaceDB | None = None
_warmup_done = False
_custom_class_ids_cache: list[int] | None = None
_custom_class_names_cache: dict[int, str] | None = None


def resolve_ml_device() -> str | int:
    """Resolve ML_DEVICE to a CUDA index or 'cpu', verifying torch CUDA availability."""
    raw = os.getenv("ML_DEVICE", "0").strip().lower()
    if raw == "cpu":
        return "cpu"
    try:
        import torch

        if not torch.cuda.is_available():
            print("[ml] ML_DEVICE requests GPU but torch.cuda.is_available() is False — using CPU")
            return "cpu"
        if raw in ("", "cuda", "gpu", "auto"):
            return 0
        idx = int(raw)
        if idx < 0 or idx >= torch.cuda.device_count():
            print(f"[ml] ML_DEVICE={raw} invalid — using cuda:0")
            return 0
        return idx
    except Exception as exc:
        print(f"[ml] CUDA device resolution failed ({exc}) — using CPU")
        return "cpu"


def use_gpu_half() -> bool:
    return resolve_ml_device() != "cpu"


def get_cuda_status() -> dict[str, Any]:
    device = resolve_ml_device()
    info: dict[str, Any] = {
        "ml_device": device,
        "cuda_available": False,
        "cuda_device_name": None,
        "cuda_device_count": 0,
    }
    try:
        import torch

        info["cuda_available"] = bool(torch.cuda.is_available())
        info["cuda_device_count"] = int(torch.cuda.device_count()) if torch.cuda.is_available() else 0
        if torch.cuda.is_available() and device != "cpu":
            idx = int(device) if isinstance(device, int) else 0
            info["cuda_device_name"] = torch.cuda.get_device_name(idx)
    except Exception as exc:
        info["cuda_error"] = str(exc)
    return info


def _warmup_yolo_model(model, device: str | int, weights_label: str) -> None:
    if device == "cpu":
        return
    try:
        import torch

        dummy = np.zeros((640, 640, 3), dtype=np.uint8)
        model.predict(
            source=dummy,
            device=device,
            imgsz=640,
            half=True,
            verbose=False,
        )
        torch.cuda.synchronize()
        print(f"[ml] GPU warmup OK ({weights_label}) on cuda:{device}")
    except Exception as exc:
        print(f"[ml] GPU warmup failed for {weights_label}: {exc}")


def _resolve_path(candidate: Path) -> str | None:
    if candidate.is_file():
        return str(candidate)
    return None


def _resolve_env_path(env_value: str) -> str | None:
    if not env_value:
        return None
    candidate = Path(env_value)
    if not candidate.is_absolute():
        candidate = BASE_DIR / candidate
    return _resolve_path(candidate)


def _resolve_weights(value: str) -> str | None:
    value = (value or "").strip()
    if not value:
        return None
    local = _resolve_env_path(value)
    if local:
        return local
    candidate = Path(value)
    if candidate.is_file():
        return str(candidate)
    if value.endswith(".pt"):
        return value
    return None


def resolve_coco_weights_path() -> str | None:
    if YOLO_WEIGHTS_ENV:
        return _resolve_weights(YOLO_WEIGHTS_ENV)
    return _resolve_path(YOLO_WEIGHTS_COCO)


def resolve_custom_weights_path() -> str | None:
    if YOLO_CUSTOM_WEIGHTS_ENV:
        return _resolve_weights(YOLO_CUSTOM_WEIGHTS_ENV)
    return _resolve_path(YOLO_WEIGHTS_CUSTOM)


def resolve_smoke_weights_path() -> str | None:
    if YOLO_SMOKE_WEIGHTS_ENV:
        return _resolve_weights(YOLO_SMOKE_WEIGHTS_ENV)
    return _resolve_path(YOLO_WEIGHTS_SMOKE)


def resolve_weapon_weights_path() -> str | None:
    if YOLO_WEAPON_WEIGHTS_ENV:
        return _resolve_weights(YOLO_WEAPON_WEIGHTS_ENV)
    return _resolve_path(YOLO_WEIGHTS_WEAPON)


def resolve_general_weights_path() -> str | None:
    """Backward-compatible alias for the COCO model weights."""
    return resolve_coco_weights_path()


def resolve_weights_path() -> str | None:
    return resolve_coco_weights_path()


def _load_yolo(weights: str):
    from ultralytics import YOLO

    device = resolve_ml_device()
    model = YOLO(weights)
    model._ml_device = device  # type: ignore[attr-defined]
    if device != "cpu":
        try:
            cuda_tag = f"cuda:{device}" if isinstance(device, int) else str(device)
            model.to(cuda_tag)
        except Exception as exc:
            print(f"[ml] model.to({device}) failed for {weights}: {exc}")
        _warmup_yolo_model(model, device, Path(weights).name)
    return model


def warmup_all_models() -> dict[str, Any]:
    """Load YOLO weights onto GPU and run a dummy inference to initialize CUDA."""
    global _warmup_done
    status = get_cuda_status()
    print(f"[ml] Device: {status.get('ml_device')} — {status.get('cuda_device_name') or 'CPU'}")
    get_yolo_coco_model()
    get_yolo_custom_model()
    get_yolo_smoke_model()
    get_yolo_weapon_model()
    _warmup_done = True
    status["models_warmed"] = True
    return status


def get_yolo_coco_model():
    global _yolo_coco
    if _yolo_coco is not None:
        return _yolo_coco
    weights = resolve_coco_weights_path()
    if not weights:
        return None
    _yolo_coco = _load_yolo(weights)
    return _yolo_coco


def get_yolo_custom_model():
    global _yolo_custom
    if _yolo_custom is not None:
        return _yolo_custom
    weights = resolve_custom_weights_path()
    if not weights:
        return None
    _yolo_custom = _load_yolo(weights)
    # Cache custom-only IDs (80+). COCO 0–79 are never predicted/emitted from best.pt.
    custom_names = custom_only_class_names(_yolo_custom)
    custom_only_class_ids(_yolo_custom)
    print(f"[ml] best.pt custom-only classes ({len(custom_names)}): {custom_names}")
    return _yolo_custom


def get_yolo_smoke_model():
    global _yolo_smoke
    if _yolo_smoke is not None:
        return _yolo_smoke
    weights = resolve_smoke_weights_path()
    if not weights:
        return None
    _yolo_smoke = _load_yolo(weights)
    return _yolo_smoke


def get_yolo_weapon_model():
    global _yolo_weapon
    if _yolo_weapon is not None:
        return _yolo_weapon
    weights = resolve_weapon_weights_path()
    if not weights:
        return None
    _yolo_weapon = _load_yolo(weights)
    return _yolo_weapon


def get_yolo_general_model():
    """Backward-compatible alias for the COCO model."""
    return get_yolo_coco_model()


def get_yolo_model():
    return get_yolo_coco_model()


def get_face_db() -> KnownFaceDB:
    global _face_db
    if _face_db is None:
        threshold = float(os.getenv("ML_FACE_THRESHOLD", "0.32"))
        _face_db = KnownFaceDB(threshold=threshold)
    return _face_db


def reload_face_db(db_embeddings: list[dict] | None = None) -> int:
    db = get_face_db()
    db.reload()
    db.apply_db_embeddings(db_embeddings or [])
    return len(db.known)


def extract_face_embedding(image: np.ndarray) -> dict[str, Any]:
    db = get_face_db()
    detail = db.extract_embedding_detail(image)
    if detail is None:
        raise ValueError("No face detected in image.")
    vector = db.embedding_to_list(detail["feature"])
    dim = len(vector)
    return {
        "embedding": vector,
        "dimension": dim,
        "dim": dim,
        "model": "SFace",
        "quality": detail["quality"],
    }


def decode_image(file_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(file_bytes, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image.")
    return image


def is_fire_smoke_class(class_name: str) -> bool:
    name = str(class_name).lower()
    return any(keyword in name for keyword in FIRE_SMOKE_KEYWORDS)


def is_alert_detection(
    cls_id: int,
    class_name: str,
    *,
    smoke_model: bool = False,
    weapon_model: bool = False,
) -> bool:
    if smoke_model or weapon_model:
        return True
    return cls_id in ALERT_CLASS_IDS or is_fire_smoke_class(class_name)


def is_smoke_fire_detection(cls_id: int, class_name: str, *, smoke_model: bool = False) -> bool:
    if smoke_model:
        return True
    return cls_id in ALERT_CLASS_IDS or is_fire_smoke_class(class_name)


def is_coco_class_id(cls_id: int) -> bool:
    return int(cls_id) <= COCO_MAX_CLASS_ID


def is_allowed_coco_class(cls_id: int, class_name: str) -> bool:
    """True when a COCO detection is in the high/medium priority allowlist."""
    if int(cls_id) in ALLOWED_COCO_CLASS_IDS:
        return True
    name = str(class_name or "").strip().lower()
    return name in ALLOWED_COCO_CLASS_NAMES


# Standard COCO names (0–79) — used to strip COCO hits from best.pt even if IDs differ.
_COCO80_CLASS_NAMES = frozenset(
    {
        "person",
        "bicycle",
        "car",
        "motorcycle",
        "airplane",
        "bus",
        "train",
        "truck",
        "boat",
        "traffic light",
        "fire hydrant",
        "stop sign",
        "parking meter",
        "bench",
        "bird",
        "cat",
        "dog",
        "horse",
        "sheep",
        "cow",
        "elephant",
        "bear",
        "zebra",
        "giraffe",
        "backpack",
        "umbrella",
        "handbag",
        "tie",
        "suitcase",
        "frisbee",
        "skis",
        "snowboard",
        "sports ball",
        "kite",
        "baseball bat",
        "baseball glove",
        "skateboard",
        "surfboard",
        "tennis racket",
        "bottle",
        "wine glass",
        "cup",
        "fork",
        "knife",
        "spoon",
        "bowl",
        "banana",
        "apple",
        "sandwich",
        "orange",
        "broccoli",
        "carrot",
        "hot dog",
        "pizza",
        "donut",
        "cake",
        "chair",
        "couch",
        "potted plant",
        "bed",
        "dining table",
        "toilet",
        "tv",
        "laptop",
        "mouse",
        "remote",
        "keyboard",
        "cell phone",
        "microwave",
        "oven",
        "toaster",
        "sink",
        "refrigerator",
        "book",
        "clock",
        "vase",
        "scissors",
        "teddy bear",
        "hair drier",
        "toothbrush",
    }
)


def custom_only_class_ids(model=None) -> list[int]:
    """Class IDs from best.pt that are NOT COCO and NOT fire/smoke (smoke model owns those)."""
    global _custom_class_ids_cache, _custom_class_names_cache
    if _custom_class_ids_cache is not None:
        return list(_custom_class_ids_cache)
    if model is None:
        model = _yolo_custom
    if model is None:
        return []
    names = getattr(model, "names", None) or {}
    ids: list[int] = []
    name_map: dict[int, str] = {}
    for i, n in names.items():
        cls_id = int(i)
        label = str(n).strip().lower()
        if cls_id <= COCO_MAX_CLASS_ID:
            continue
        if cls_id in CUSTOM_EXCLUDED_CLASS_IDS or label in CUSTOM_EXCLUDED_CLASS_NAMES:
            continue
        ids.append(cls_id)
        name_map[cls_id] = str(n)
    ids.sort()
    _custom_class_ids_cache = ids
    _custom_class_names_cache = name_map
    return list(ids)


def custom_only_class_names(model=None) -> dict[int, str]:
    """Non-COCO, non-fire/smoke name map from best.pt."""
    global _custom_class_names_cache
    if _custom_class_names_cache is not None:
        return dict(_custom_class_names_cache)
    if model is None:
        model = _yolo_custom
    if model is None:
        return {}
    custom_only_class_ids(model)
    return dict(_custom_class_names_cache or {})


def detection_priority(class_name: str, *, alert: bool = False) -> str:
    """Return 'high', 'medium', or 'low' for UI / downstream filtering."""
    name = str(class_name or "").strip().lower()
    if alert or name in HIGH_PRIORITY_CLASS_NAMES or is_fire_smoke_class(name):
        return "high"
    if name in MEDIUM_PRIORITY_CLASS_NAMES:
        return "medium"
    return "low"


def keep_custom_classes_only(detections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """From best.pt: drop COCO + fire/smoke; keep other custom classes only."""
    kept: list[dict[str, Any]] = []
    for d in detections:
        try:
            cls_id = int(d.get("class_id", -1))
        except (TypeError, ValueError):
            cls_id = -1
        if is_coco_class_id(cls_id):
            continue
        if cls_id in CUSTOM_EXCLUDED_CLASS_IDS:
            continue
        name = str(d.get("class_name") or d.get("label") or "").strip().lower()
        # Safety: never re-emit vanilla COCO labels from the custom model.
        if name in _COCO80_CLASS_NAMES:
            continue
        # Fire/smoke come from best_Smoke_Detection.pt only.
        if name in CUSTOM_EXCLUDED_CLASS_NAMES or is_fire_smoke_class(name):
            continue
        kept.append(d)
    return kept


def _box_iou(a: list[int], b: list[int]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)
    inter_w = max(0, inter_x2 - inter_x1)
    inter_h = max(0, inter_y2 - inter_y1)
    inter_area = inter_w * inter_h
    if inter_area <= 0:
        return 0.0
    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    union = area_a + area_b - inter_area
    if union <= 0:
        return 0.0
    return inter_area / union


def merge_detections(
    general: list[dict[str, Any]],
    smoke: list[dict[str, Any]],
    *,
    iou_threshold: float = 0.45,
) -> list[dict[str, Any]]:
    """Combine base detections + specialist smoke/fire, preferring specialist on overlap."""
    merged = list(general)
    for smoke_det in smoke:
        smoke_bbox = smoke_det.get("bbox", [0, 0, 0, 0])
        replaced = False
        for index, existing in enumerate(merged):
            existing_name = str(existing.get("class_name", existing.get("label", "")))
            if not (existing.get("alert") or is_fire_smoke_class(existing_name)):
                continue
            if _box_iou(existing.get("bbox", [0, 0, 0, 0]), smoke_bbox) >= iou_threshold:
                if float(smoke_det.get("confidence", 0)) >= float(existing.get("confidence", 0)):
                    merged[index] = smoke_det
                replaced = True
                break
        if not replaced:
            merged.append(smoke_det)
    return merged


def merge_triple_detections(
    coco: list[dict[str, Any]],
    custom: list[dict[str, Any]],
    smoke: list[dict[str, Any]],
    *,
    iou_threshold: float = 0.45,
) -> list[dict[str, Any]]:
    base = list(coco)
    base.extend(custom)
    if not smoke:
        return base
    return merge_detections(base, smoke, iou_threshold=iou_threshold)


def _predict_model(
    model,
    image: np.ndarray,
    *,
    conf: float,
    iou: float,
    img_size: int,
    half: bool | None = None,
    max_det: int = 300,
    classes: list[int] | tuple[int, ...] | None = None,
):
    device = getattr(model, "_ml_device", resolve_ml_device())
    if half is None:
        half = device != "cpu"
    kwargs: dict[str, Any] = {
        "source": image,
        "device": device,
        "conf": conf,
        "iou": iou,
        "imgsz": img_size,
        "max_det": max_det,
        "half": half,
        "verbose": False,
    }
    if classes is not None:
        kwargs["classes"] = list(classes)
    return model.predict(**kwargs)


def parse_yolo_result(
    frame: np.ndarray,
    result,
    *,
    sx: float = 1.0,
    sy: float = 1.0,
    recognize_faces: bool = True,
    smoke_model: bool = False,
    weapon_model: bool = False,
    model_tag: str = "coco",
    face_db: KnownFaceDB | None = None,
) -> list[dict[str, Any]]:
    detections: list[dict[str, Any]] = []
    if result.boxes is None:
        return detections

    names = result.names or {}
    filter_coco = (not smoke_model) and (not weapon_model) and model_tag == "coco"
    for box in result.boxes:
        cls_id = int(box.cls[0])
        confidence = float(box.conf[0])
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        bbox = [int(x1 * sx), int(y1 * sy), int(x2 * sx), int(y2 * sy)]
        yolo_name = str(names.get(cls_id, cls_id))
        if filter_coco and not is_allowed_coco_class(cls_id, yolo_name):
            continue
        if smoke_model:
            if confidence < SMOKE_FIRE_MIN_CONF:
                continue
        elif weapon_model:
            if confidence < WEAPON_MIN_CONF:
                continue
        elif is_smoke_fire_detection(cls_id, yolo_name, smoke_model=False):
            if confidence < SMOKE_FIRE_MIN_CONF:
                continue
        label = yolo_name
        face_meta: dict[str, Any] | None = None

        if not smoke_model and not weapon_model and recognize_faces and face_db is not None:
            face_meta = face_db.label_detection_detail(frame, cls_id, yolo_name, tuple(bbox))
            label = face_meta["label"]
        elif not smoke_model and not weapon_model and cls_id == 0 and not recognize_faces:
            label = "unknown"

        alert = is_alert_detection(
            cls_id, yolo_name, smoke_model=smoke_model, weapon_model=weapon_model
        )
        if weapon_model:
            model_name = "weapon"
        elif smoke_model:
            model_name = "smoke"
        else:
            model_name = model_tag
        det: dict[str, Any] = {
            "class_id": cls_id,
            "class_name": yolo_name,
            "label": label,
            "confidence": round(confidence, 4),
            "bbox": bbox,
            "alert": alert,
            "priority": detection_priority(yolo_name, alert=alert),
            "model": model_name,
        }
        if face_meta:
            if face_meta.get("face_embedding"):
                det["face_embedding"] = face_meta["face_embedding"]
            if face_meta.get("face_match_score") is not None:
                det["face_match_score"] = face_meta["face_match_score"]
            if face_meta.get("face_match_method"):
                det["face_match_method"] = face_meta["face_match_method"]
        detections.append(det)
    return detections


def run_triple_detection(
    image: np.ndarray,
    *,
    conf: float = 0.25,
    iou: float = 0.45,
    img_size: int = 640,
    recognize_faces: bool = True,
    half: bool = False,
    max_det: int = 300,
) -> list[dict[str, Any]]:
    coco_model = get_yolo_coco_model()
    custom_model = get_yolo_custom_model()
    smoke_model = get_yolo_smoke_model()
    weapon_model = get_yolo_weapon_model()
    if coco_model is None and custom_model is None and smoke_model is None and weapon_model is None:
        return []

    face_db = get_face_db() if recognize_faces else None
    coco_detections: list[dict[str, Any]] = []
    custom_detections: list[dict[str, Any]] = []
    smoke_detections: list[dict[str, Any]] = []
    weapon_detections: list[dict[str, Any]] = []

    if coco_model is not None:
        for result in _predict_model(
            coco_model,
            image,
            conf=conf,
            iou=iou,
            img_size=img_size,
            half=half,
            max_det=max_det,
            classes=ALLOWED_COCO_CLASS_IDS,
        ):
            coco_detections.extend(
                parse_yolo_result(
                    image,
                    result,
                    recognize_faces=recognize_faces,
                    smoke_model=False,
                    model_tag="coco",
                    face_db=face_db,
                )
            )

    if custom_model is not None:
        custom_ids = custom_only_class_ids(custom_model)
        for result in _predict_model(
            custom_model,
            image,
            conf=conf,
            iou=iou,
            img_size=img_size,
            half=half,
            max_det=max_det,
            classes=custom_ids or None,
        ):
            raw = parse_yolo_result(
                image,
                result,
                recognize_faces=False,
                smoke_model=False,
                model_tag="custom",
                face_db=None,
            )
            custom_detections.extend(keep_custom_classes_only(raw))

    if smoke_model is not None:
        smoke_conf = max(conf, SMOKE_FIRE_MIN_CONF)
        for result in _predict_model(
            smoke_model, image, conf=smoke_conf, iou=iou, img_size=img_size, half=half, max_det=max_det
        ):
            smoke_detections.extend(
                parse_yolo_result(
                    image,
                    result,
                    recognize_faces=False,
                    smoke_model=True,
                    model_tag="smoke",
                    face_db=None,
                )
            )

    if weapon_model is not None:
        weapon_conf = max(conf, WEAPON_MIN_CONF)
        for result in _predict_model(
            weapon_model, image, conf=weapon_conf, iou=iou, img_size=img_size, half=half, max_det=max_det
        ):
            weapon_detections.extend(
                parse_yolo_result(
                    image,
                    result,
                    recognize_faces=False,
                    weapon_model=True,
                    model_tag="weapon",
                    face_db=None,
                )
            )

    merged = merge_triple_detections(coco_detections, custom_detections, smoke_detections)
    merged.extend(weapon_detections)
    return merged


def run_dual_detection(
    image: np.ndarray,
    *,
    conf: float = 0.25,
    iou: float = 0.45,
    img_size: int = 640,
    recognize_faces: bool = True,
    half: bool = False,
) -> list[dict[str, Any]]:
    return run_triple_detection(
        image,
        conf=conf,
        iou=iou,
        img_size=img_size,
        recognize_faces=recognize_faces,
        half=half,
    )


def health_status() -> dict[str, Any]:
    coco_weights = resolve_coco_weights_path()
    custom_weights = resolve_custom_weights_path()
    smoke_weights = resolve_smoke_weights_path()
    weapon_weights = resolve_weapon_weights_path()
    db = get_face_db()
    any_weights = any([coco_weights, custom_weights, smoke_weights, weapon_weights])
    cuda = get_cuda_status()

    custom_ids: list[int] = []
    custom_names: list[str] = []
    if custom_weights:
        custom_model = _yolo_custom or get_yolo_custom_model()
        if custom_model is not None:
            custom_ids = custom_only_class_ids(custom_model)
            custom_names = sorted(custom_only_class_names(custom_model).values())

    plate_info: dict[str, Any] = {"plate_available": False, "plate_weights": None}
    try:
        from plate_recognizer import get_plate_engine, resolve_plate_media_dir, resolve_plate_weights

        weights = resolve_plate_weights()
        engine = get_plate_engine()
        plate_info = {
            "plate_available": bool(engine.available),
            "plate_weights": str(weights) if weights else None,
            "plate_media_dir": str(resolve_plate_media_dir()),
        }
    except Exception as exc:
        plate_info["plate_error"] = str(exc)

    return {
        "status": "ok",
        **cuda,
        "models_warmed": _warmup_done,
        "yolo_available": any_weights,
        "yolo_weights": coco_weights,
        "yolo_general_available": coco_weights is not None,
        "yolo_general_weights": coco_weights,
        "yolo_coco_available": coco_weights is not None,
        "yolo_coco_weights": coco_weights,
        "yolo_custom_available": custom_weights is not None,
        "yolo_custom_weights": custom_weights,
        "yolo_smoke_available": smoke_weights is not None,
        "yolo_smoke_weights": smoke_weights,
        "yolo_weapon_available": weapon_weights is not None,
        "yolo_weapon_weights": weapon_weights,
        "dual_model_mode": coco_weights is not None and smoke_weights is not None,
        "triple_model_mode": all([coco_weights, custom_weights, smoke_weights]),
        "quad_model_mode": all([coco_weights, custom_weights, smoke_weights, weapon_weights]),
        "coco_max_class_id": COCO_MAX_CLASS_ID,
        "allowed_coco_class_ids": list(ALLOWED_COCO_CLASS_IDS),
        "allowed_coco_class_names": sorted(ALLOWED_COCO_CLASS_NAMES),
        "custom_only_class_ids": custom_ids,
        "custom_only_class_names": custom_names,
        "smoke_fire_min_conf": SMOKE_FIRE_MIN_CONF,
        "weapon_min_conf": WEAPON_MIN_CONF,
        "known_faces": len(db.known),
        "face_matching": db.matching_stats(),
        "face_source": "database",
        "face_models_dir": str(BASE_DIR / "models" / "face"),
        **plate_info,
    }


def detect_image(
    image: np.ndarray,
    *,
    conf: float = 0.25,
    iou: float = 0.45,
    img_size: int = 640,
    recognize_faces: bool = True,
) -> list[dict[str, Any]]:
    return run_triple_detection(
        image,
        conf=conf,
        iou=iou,
        img_size=img_size,
        recognize_faces=recognize_faces,
        half=use_gpu_half(),
    )


def recognize_face(image: np.ndarray) -> dict[str, Any]:
    db = get_face_db()
    result = db.recognize_with_detail(image)
    recognized = result.is_known and bool(db.known)
    return {
        "recognized": recognized,
        "identity": result.identity,
        "similarity": round(float(result.score), 4),
        "known_faces_loaded": len(db.known),
        "is_unknown_temp": result.is_unknown_temp,
        "match_method": result.match_method,
        "face_embedding": result.embedding,
        "threshold": db.threshold,
    }


def validate_human_face(image: np.ndarray) -> dict[str, Any]:
    db = get_face_db()
    if not db.has_face(image):
        return {"ok": False, "message": "No human face detected."}
    return {"ok": True, "message": "Human face detected."}
