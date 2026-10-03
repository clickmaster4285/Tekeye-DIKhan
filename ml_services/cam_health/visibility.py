"""Purpose-aware object visibility from YOLO / ANPR detection lists."""

from __future__ import annotations

from typing import Any


PERSON_LABELS = {"person", "face"}
VEHICLE_LABELS = {
    "car",
    "truck",
    "bus",
    "motorcycle",
    "bicycle",
    "van",
    "pickup",
    "microbus",
    "pickup-van",
    "vehicle",
}
PLATE_LABELS = {"license_plate", "license-plate", "number_plate", "plate", "License_Plate"}
FACE_LABELS = {"face"}


def _label(det: dict[str, Any]) -> str:
    for key in ("class_name", "label", "name", "class", "cls_name"):
        val = det.get(key)
        if val is not None:
            return str(val).strip().lower().replace(" ", "_")
    return ""


def _conf(det: dict[str, Any]) -> float:
    for key in ("confidence", "score", "conf"):
        try:
            return float(det.get(key) or 0)
        except (TypeError, ValueError):
            continue
    return 0.0


def _bbox(det: dict[str, Any]) -> tuple[float, float, float, float] | None:
    box = det.get("bbox") or det.get("box") or det.get("xyxy")
    if isinstance(box, (list, tuple)) and len(box) >= 4:
        try:
            return float(box[0]), float(box[1]), float(box[2]), float(box[3])
        except (TypeError, ValueError):
            return None
    try:
        return (
            float(det["x1"]),
            float(det["y1"]),
            float(det["x2"]),
            float(det["y2"]),
        )
    except (KeyError, TypeError, ValueError):
        return None


def _size(box: tuple[float, float, float, float]) -> tuple[int, int]:
    x1, y1, x2, y2 = box
    return max(0, int(abs(x2 - x1))), max(0, int(abs(y2 - y1)))


def _readable_from_size(w: int, h: int, *, min_w: int = 40, min_h: int = 12) -> str:
    if w >= min_w * 1.5 and h >= min_h * 1.5:
        return "GOOD"
    if w >= min_w and h >= min_h:
        return "FAIR"
    return "POOR"


def evaluate_visibility(
    detections: list[dict[str, Any]] | None,
    purposes: list[str] | None = None,
) -> dict[str, Any]:
    dets = detections or []
    purposes_l = [str(p).strip().lower() for p in (purposes or []) if str(p).strip()]

    persons = [d for d in dets if _label(d) in PERSON_LABELS]
    vehicles = [d for d in dets if _label(d) in VEHICLE_LABELS]
    plates = [d for d in dets if _label(d) in PLATE_LABELS or "plate" in _label(d)]
    faces = [d for d in dets if _label(d) in FACE_LABELS]

    best_plate = max(plates, key=_conf, default=None)
    plate_w = plate_h = 0
    plate_conf = 0.0
    plate_readable = "NONE"
    if best_plate is not None:
        plate_conf = _conf(best_plate)
        box = _bbox(best_plate)
        if box:
            plate_w, plate_h = _size(box)
            plate_readable = _readable_from_size(plate_w, plate_h)

    person_vis = min(1.0, len(persons) * 0.35) if persons else 0.0
    vehicle_vis = min(1.0, len(vehicles) * 0.35) if vehicles else 0.0
    face_vis = min(1.0, len(faces) * 0.4) if faces else 0.0
    if best_plate is not None:
        size_score = min(1.0, (plate_w / 80.0) * (plate_h / 24.0))
        plate_vis = min(1.0, 0.4 * plate_conf + 0.6 * size_score)
    else:
        plate_vis = 0.0

    # Scene empty is not always a fault — only score "expected" classes for purpose.
    expects_person = any(p in {"general_objects", "custom_objects", "face_recognition", "attendance", "weapon"} for p in purposes_l) or not purposes_l
    expects_vehicle = any(p in {"general_objects", "custom_objects", "anpr"} for p in purposes_l) or not purposes_l
    expects_plate = "anpr" in purposes_l
    expects_face = any(p in {"face_recognition", "attendance"} for p in purposes_l)

    return {
        "person_visibility": round(person_vis, 3),
        "vehicle_visibility": round(vehicle_vis, 3),
        "plate_visibility": round(plate_vis, 3),
        "face_visibility": round(face_vis, 3),
        "person_detected": bool(persons),
        "vehicle_detected": bool(vehicles),
        "plate_detected": bool(plates),
        "face_detected": bool(faces),
        "person_count": len(persons),
        "vehicle_count": len(vehicles),
        "plate_count": len(plates),
        "plate_size": {"width": plate_w, "height": plate_h},
        "plate_confidence": round(plate_conf, 3),
        "plate_readable": plate_readable,
        "expects_person": expects_person,
        "expects_vehicle": expects_vehicle,
        "expects_plate": expects_plate,
        "expects_face": expects_face,
        "detection_count": len(dets),
    }
