"""Offline video AI test: person / vehicle / weapon / fire with staff-name tags."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Callable

import cv2

from inference_engine import (
    ALLOWED_COCO_CLASS_IDS,
    SMOKE_FIRE_MIN_CONF,
    WEAPON_MIN_CONF,
    get_face_db,
    get_yolo_coco_model,
    get_yolo_smoke_model,
    get_yolo_weapon_model,
    is_fire_smoke_class,
    parse_yolo_result,
    use_gpu_half,
    _predict_model,
)
from live_stream import draw_detections

PERSON_CLASSES = frozenset({"person", "face"})
VEHICLE_CLASSES = frozenset(
    {
        "car",
        "truck",
        "bus",
        "motorcycle",
        "bicycle",
        "vehicle",
        "microbus",
        "pickup-van",
        "pickup_van",
    }
)
WEAPON_CLASSES = frozenset(
    {
        "weapon",
        "gun",
        "handgun",
        "pistol",
        "rifle",
        "firearm",
        "knife",
        "knife_weapon",
        "sword",
        "machete",
        "heavy-weapon",
        "heavy_weapon",
        "heavyweapon",
    }
)
GENERIC_PERSON = frozenset({"person", "face", "unknown", ""})

MAX_DURATION_SEC = float(os.getenv("ML_VIDEO_ANALYZE_MAX_DURATION", "7200"))
DETECT_IMG_SIZE = int(os.getenv("ML_VIDEO_ANALYZE_IMG_SIZE", "416"))
OUTPUT_MAX_WIDTH = int(os.getenv("ML_VIDEO_ANALYZE_MAX_WIDTH", "960"))
_PERSON_COCO_IDS = frozenset({0})
_VEHICLE_COCO_IDS = frozenset({2, 3, 5, 7, 1})


def _norm(name: str) -> str:
    return str(name or "").strip().lower().replace("_", "-")


def _is_weapon(det: dict[str, Any]) -> bool:
    tag = str(det.get("model") or det.get("model_tag") or "").strip().lower()
    if tag == "weapon":
        return True
    cls = _norm(det.get("class_name") or "")
    label = _norm(det.get("label") or "")
    if cls in WEAPON_CLASSES or label in WEAPON_CLASSES:
        return True
    return any(token in cls or token in label for token in ("gun", "rifle", "pistol", "firearm", "weapon"))


def _is_fire(det: dict[str, Any]) -> bool:
    tag = str(det.get("model") or det.get("model_tag") or "").strip().lower()
    if tag == "smoke":
        return True
    cls = str(det.get("class_name") or det.get("label") or "")
    return is_fire_smoke_class(cls)


def _is_person(det: dict[str, Any]) -> bool:
    cls = _norm(det.get("class_name") or "")
    label = _norm(det.get("label") or "")
    return cls in PERSON_CLASSES or label in PERSON_CLASSES


def _is_vehicle(det: dict[str, Any]) -> bool:
    cls = _norm(det.get("class_name") or "")
    label = _norm(det.get("label") or "")
    return cls in VEHICLE_CLASSES or label in VEHICLE_CLASSES


def _is_known_staff(det: dict[str, Any]) -> bool:
    label = str(det.get("label") or "").strip()
    cls = _norm(det.get("class_name") or "")
    if not label:
        return False
    if _norm(label) in GENERIC_PERSON:
        return False
    return cls in PERSON_CLASSES or bool(label)


def _shrink(frame, max_w: int = OUTPUT_MAX_WIDTH):
    h, w = frame.shape[:2]
    if w <= max_w or max_w <= 0:
        return frame
    scale = max_w / float(w)
    nw = max(2, int(w * scale) // 2 * 2)
    nh = max(2, int(h * scale) // 2 * 2)
    return cv2.resize(frame, (nw, nh), interpolation=cv2.INTER_AREA)


def detect_selected(
    frame,
    *,
    person: bool,
    vehicle: bool,
    weapon: bool,
    fire: bool,
    match_staff: bool,
    img_size: int = DETECT_IMG_SIZE,
) -> list[dict[str, Any]]:
    """Run only the models the user selected (much faster than the full live stack)."""
    half = use_gpu_half()
    detections: list[dict[str, Any]] = []
    if person or vehicle:
        coco = get_yolo_coco_model()
        if coco is not None:
            classes: set[int] = set()
            if person:
                classes |= _PERSON_COCO_IDS
            if vehicle:
                classes |= _VEHICLE_COCO_IDS
            class_ids = sorted(cid for cid in classes if cid in ALLOWED_COCO_CLASS_IDS)
            face_db = get_face_db() if person and match_staff else None
            for result in _predict_model(
                coco,
                frame,
                conf=0.25,
                iou=0.45,
                img_size=img_size,
                half=half,
                max_det=50,
                classes=class_ids or None,
            ):
                detections.extend(
                    parse_yolo_result(
                        frame,
                        result,
                        recognize_faces=bool(person and match_staff),
                        smoke_model=False,
                        model_tag="coco",
                        face_db=face_db,
                    )
                )
    if weapon:
        weapon_model = get_yolo_weapon_model()
        if weapon_model is not None:
            for result in _predict_model(
                weapon_model,
                frame,
                conf=WEAPON_MIN_CONF,
                iou=0.45,
                img_size=img_size,
                half=half,
                max_det=50,
            ):
                detections.extend(
                    parse_yolo_result(
                        frame,
                        result,
                        recognize_faces=False,
                        weapon_model=True,
                        model_tag="weapon",
                        face_db=None,
                    )
                )
    if fire:
        smoke_model = get_yolo_smoke_model()
        if smoke_model is not None:
            for result in _predict_model(
                smoke_model,
                frame,
                conf=SMOKE_FIRE_MIN_CONF,
                iou=0.45,
                img_size=img_size,
                half=half,
                max_det=50,
            ):
                detections.extend(
                    parse_yolo_result(
                        frame,
                        result,
                        recognize_faces=False,
                        smoke_model=True,
                        model_tag="smoke",
                        face_db=None,
                    )
                )
    return detections


def filter_detections(
    detections: list[dict[str, Any]],
    *,
    person: bool,
    vehicle: bool,
    weapon: bool,
    fire: bool,
    match_staff: bool,
) -> list[dict[str, Any]]:
    kept: list[dict[str, Any]] = []
    for det in detections or []:
        work = dict(det)
        keep = False
        if person and _is_person(work):
            keep = True
            if not match_staff:
                work["label"] = str(work.get("class_name") or "person")
        if vehicle and _is_vehicle(work):
            keep = True
        if weapon and _is_weapon(work):
            keep = True
            work["alert"] = True
        if fire and _is_fire(work):
            keep = True
            work["alert"] = True
        if keep:
            kept.append(work)
    return kept


def _hit_kind(det: dict[str, Any]) -> str:
    if _is_weapon(det):
        return "weapon"
    if _is_fire(det):
        return "fire"
    if _is_vehicle(det):
        return "vehicle"
    if _is_known_staff(det):
        return "known"
    if _is_person(det):
        return "unknown"
    return "other"


def _open_writer(path: str, fps: float, width: int, height: int) -> cv2.VideoWriter | None:
    fps = max(1.0, float(fps) or 1.0)
    for fourcc_name in ("mp4v", "avc1", "XVID"):
        writer = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*fourcc_name), fps, (width, height))
        if writer.isOpened():
            return writer
        writer.release()
    return None


def analyze_video_path(
    video_path: str,
    output_path: str,
    *,
    person: bool = True,
    vehicle: bool = True,
    weapon: bool = True,
    fire: bool = True,
    match_staff: bool = True,
    sample_fps: float = 0.5,
    progress_cb: Callable[[int, str], None] | None = None,
) -> dict[str, Any]:
    if not any([person, vehicle, weapon, fire]):
        raise ValueError("Select at least one detection type.")
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError("Could not open the video file.")
    try:
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    except Exception:
        pass

    src_fps = float(cap.get(cv2.CAP_PROP_FPS) or 0) or 25.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    duration = (frame_count / src_fps) if frame_count > 0 else 0.0
    if duration > MAX_DURATION_SEC:
        cap.release()
        raise ValueError(
            f"Video is too long ({duration / 60:.1f} min). Maximum is {MAX_DURATION_SEC / 60:.0f} minutes."
        )
    if width < 32 or height < 32:
        cap.release()
        raise ValueError("Video has an invalid frame size.")

    out_fps = max(0.5, min(float(sample_fps), 4.0))
    detect_every = max(1, int(round(src_fps / out_fps)))
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    report_frames = max(1, int(frame_count / detect_every) if frame_count > 0 else 1)

    hits: list[dict[str, Any]] = []
    frames_written = 0
    index = 0
    scanned = 0
    writer: cv2.VideoWriter | None = None
    known_staff: set[str] = set()
    counts = {"known": 0, "unknown": 0, "vehicle": 0, "weapon": 0, "fire": 0}

    def report(pct: int, message: str) -> None:
        if progress_cb:
            progress_cb(max(1, min(99, pct)), message)

    report(4, "Opening video")
    try:
        while True:
            if index % detect_every != 0:
                if not cap.grab():
                    break
                index += 1
                continue
            ok, frame = cap.read()
            if not ok or frame is None:
                break
            small = _shrink(frame)
            if writer is None:
                oh, ow = small.shape[:2]
                writer = _open_writer(output_path, out_fps, ow, oh)
                if writer is None:
                    raise ValueError("Could not create the tagged video file.")
            report(5 + int(90 * scanned / report_frames), f"Detecting sample {scanned + 1}…")
            do_faces = bool(match_staff and person and (scanned % 2 == 0))
            raw = detect_selected(
                small,
                person=person,
                vehicle=vehicle,
                weapon=weapon,
                fire=fire,
                match_staff=do_faces,
            )
            boxes = filter_detections(
                raw,
                person=person,
                vehicle=vehicle,
                weapon=weapon,
                fire=fire,
                match_staff=match_staff,
            )
            t = index / src_fps
            for det in boxes:
                kind = _hit_kind(det)
                label = str(det.get("label") or det.get("class_name") or kind)
                if kind == "known":
                    known_staff.add(label)
                if kind in counts:
                    counts[kind] += 1
                hits.append(
                    {
                        "t": round(t, 2),
                        "kind": kind,
                        "class_name": det.get("class_name"),
                        "label": label,
                        "model": det.get("model"),
                        "confidence": det.get("confidence"),
                        "bbox": det.get("bbox") or [],
                    }
                )
            tagged = draw_detections(small, boxes) if boxes else small
            writer.write(tagged)
            frames_written += 1
            scanned += 1
            index += 1
            report(
                5 + int(90 * scanned / report_frames),
                f"Tagging {scanned} samples ({t:.0f}s / {duration:.0f}s)",
            )
    finally:
        cap.release()
        if writer is not None:
            writer.release()

    if frames_written <= 0:
        raise ValueError("No frames could be read from the video.")

    report(99, "Finishing tagged video")
    return {
        "duration_sec": round(duration or (frames_written / out_fps), 2),
        "fps": round(out_fps, 2),
        "frames_written": frames_written,
        "frames_scanned": scanned,
        "sample_fps": round(out_fps, 2),
        "hit_count": len(hits),
        "known_staff": sorted(known_staff),
        "unknown_people": counts["unknown"],
        "vehicles": counts["vehicle"],
        "weapons": counts["weapon"],
        "fires": counts["fire"],
        "hits": hits[:2000],
        "output_name": Path(output_path).name,
    }
