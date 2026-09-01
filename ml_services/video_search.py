"""Find a query image (person / vehicle / object) inside an uploaded video."""

from __future__ import annotations

import base64
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from inference_engine import (
    _predict_model,
    decode_image,
    get_face_db,
    get_yolo_coco_model,
)
from reid_extractor import extract_reid_embedding

PERSON_CLASS_IDS = frozenset({0})
VEHICLE_CLASS_IDS = frozenset({2, 3, 5, 7})
BAG_CLASS_IDS = frozenset({24, 26, 28})
SEARCH_CLASS_IDS = PERSON_CLASS_IDS | VEHICLE_CLASS_IDS | BAG_CLASS_IDS

MAX_VIDEO_BYTES = int(os.getenv("ML_VIDEO_SEARCH_MAX_BYTES", str(8 * 1024 * 1024 * 1024)))
MAX_DURATION_SEC = float(os.getenv("ML_VIDEO_SEARCH_MAX_DURATION", "3600"))
MAX_SEGMENTS = int(os.getenv("ML_VIDEO_SEARCH_MAX_SEGMENTS", "40"))
DETECT_IMG_SIZE = int(os.getenv("ML_VIDEO_SEARCH_IMG_SIZE", "416"))
DETECT_MAX_WIDTH = int(os.getenv("ML_VIDEO_SEARCH_DETECT_WIDTH", "640"))
FACE_SCAN_MAX_WIDTH = int(os.getenv("ML_VIDEO_SEARCH_FACE_WIDTH", "960"))
MAX_BOXES_PER_FRAME = int(os.getenv("ML_VIDEO_SEARCH_MAX_BOXES", "5"))
DEFAULT_FACE_THRESHOLD = float(os.getenv("ML_VIDEO_SEARCH_FACE_THRESHOLD", "0.45"))
DEFAULT_REID_THRESHOLD = float(os.getenv("ML_VIDEO_SEARCH_REID_THRESHOLD", "0.88"))
MIN_FACE_SEGMENT_SCORE = float(os.getenv("ML_VIDEO_SEARCH_MIN_FACE_SCORE", "0.44"))
MIN_REID_SEGMENT_SCORE = float(os.getenv("ML_VIDEO_SEARCH_MIN_REID_SCORE", "0.86"))
HIGH_CONFIDENCE_FACE = float(os.getenv("ML_VIDEO_SEARCH_HIGH_CONF_FACE", "0.52"))
MIN_HITS_PER_SEGMENT = int(os.getenv("ML_VIDEO_SEARCH_MIN_HITS", "2"))


def _cosine(a: list[float] | np.ndarray | None, b: list[float] | np.ndarray | None) -> float:
    if a is None or b is None:
        return 0.0
    va = np.asarray(a, dtype=np.float32).reshape(-1)
    vb = np.asarray(b, dtype=np.float32).reshape(-1)
    if va.size == 0 or vb.size == 0 or va.size != vb.size:
        return 0.0
    na = float(np.linalg.norm(va))
    nb = float(np.linalg.norm(vb))
    if na <= 1e-8 or nb <= 1e-8:
        return 0.0
    return float(np.dot(va / na, vb / nb))


def _crop(frame: np.ndarray, bbox: list[int]) -> np.ndarray | None:
    if frame is None or frame.size == 0 or len(bbox) < 4:
        return None
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = (int(v) for v in bbox[:4])
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    if x2 <= x1 or y2 <= y1:
        return None
    crop = frame[y1:y2, x1:x2]
    return crop if crop.size else None


def _jpeg_b64(image: np.ndarray, quality: int = 55) -> str:
    frame = image
    h, w = frame.shape[:2]
    if w > 160:
        scale = 160 / float(w)
        frame = cv2.resize(frame, (160, max(1, int(h * scale))), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        return ""
    return base64.b64encode(buf.tobytes()).decode("ascii")


def auto_sample_fps(duration_sec: float) -> float:
    """Fewer samples on hour-long NVR recordings so the scan can finish in minutes."""
    duration = max(0.0, float(duration_sec or 0))
    if duration >= 3300:  # ~55+ minutes → every 5 seconds
        return 0.2
    if duration >= 1800:  # 30+ minutes → every 4 seconds
        return 0.25
    if duration >= 900:
        return 0.4
    return 0.75


def _resolve_ffprobe() -> str | None:
    custom = os.getenv("FFPROBE_PATH", "").strip()
    if custom and os.path.isfile(custom):
        return custom
    found = shutil.which("ffprobe") or shutil.which("ffprobe.exe")
    if found:
        return found
    try:
        from live_stream import _resolve_ffmpeg_path

        ffmpeg = _resolve_ffmpeg_path()
    except Exception:
        ffmpeg = None
    if ffmpeg:
        probe = Path(ffmpeg).with_name("ffprobe.exe" if sys.platform == "win32" else "ffprobe")
        if probe.is_file():
            return str(probe)
    base = Path(__file__).resolve().parent.parent / "tools" / "ffmpeg" / "bin"
    for name in ("ffprobe.exe", "ffprobe"):
        candidate = base / name
        if candidate.is_file():
            return str(candidate)
    return None


def _ffprobe_duration(video_path: str) -> float:
    exe = _resolve_ffprobe()
    if not exe:
        return 0.0
    try:
        proc = subprocess.run(
            [
                exe,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                video_path,
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return max(0.0, float(proc.stdout.strip()))
    except Exception:
        pass
    return 0.0


def _video_meta(video_path: str) -> tuple[float, float]:
    cap = cv2.VideoCapture(video_path)
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0) or 25.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration = frame_count / fps if frame_count > 0 else 0.0
    cap.release()
    if duration <= 0:
        duration = _ffprobe_duration(video_path)
    if duration <= 0:
        # Last resort: estimate from file size (~4 Mbps CCTV ≈ 0.5 MB/s).
        size_mb = os.path.getsize(video_path) / (1024 * 1024)
        duration = min(MAX_DURATION_SEC, max(60.0, size_mb / 0.5))
    return fps, min(duration, MAX_DURATION_SEC)


def _resize_for_search(frame: np.ndarray, *, max_width: int) -> np.ndarray:
    h, w = frame.shape[:2]
    if w <= max_width:
        return frame
    scale = max_width / float(w)
    return cv2.resize(frame, (max_width, max(1, int(h * scale))), interpolation=cv2.INTER_AREA)


def _iter_sampled_frames(
    cap: cv2.VideoCapture,
    *,
    fps: float,
    duration: float,
    sample_fps: float,
):
    """Jump to timestamps instead of decoding every skipped frame (much faster on long MP4s)."""
    interval = 1.0 / max(0.15, float(sample_fps))
    end = duration if duration > 0 else interval * 5000
    t_sec = 0.0
    while t_sec <= end + 0.01:
        if duration > 0 and t_sec > duration + 0.05:
            break
        cap.set(cv2.CAP_PROP_POS_MSEC, t_sec * 1000.0)
        ok, frame = cap.read()
        if not ok or frame is None or frame.size == 0:
            if duration <= 0:
                break
            t_sec += interval
            continue
        yield t_sec, frame
        t_sec += interval


def _detect_boxes(frame: np.ndarray, *, class_ids: list[int], conf: float = 0.25) -> list[dict[str, Any]]:
    model = get_yolo_coco_model()
    if model is None:
        return []
    small = _resize_for_search(frame, max_width=DETECT_MAX_WIDTH)
    sx = frame.shape[1] / max(small.shape[1], 1)
    sy = frame.shape[0] / max(small.shape[0], 1)
    results = _predict_model(
        model,
        small,
        conf=conf,
        iou=0.45,
        img_size=DETECT_IMG_SIZE,
        classes=class_ids,
        max_det=20,
    )
    if not results:
        return []
    result = results[0]
    if result.boxes is None:
        return []
    names = result.names or {}
    out: list[dict[str, Any]] = []
    for box in result.boxes:
        cls_id = int(box.cls[0])
        if cls_id not in SEARCH_CLASS_IDS:
            continue
        x1, y1, x2, y2 = (float(v) for v in box.xyxy[0].tolist())
        out.append(
            {
                "class_id": cls_id,
                "class_name": str(names.get(cls_id, cls_id)),
                "confidence": round(float(box.conf[0]), 4),
                "bbox": [
                    int(x1 * sx),
                    int(y1 * sy),
                    int(x2 * sx),
                    int(y2 * sy),
                ],
            }
        )
    out.sort(key=lambda b: b["confidence"], reverse=True)
    return out[:MAX_BOXES_PER_FRAME]


def _face_embedding(image: np.ndarray) -> list[float]:
    try:
        db = get_face_db()
        feature = db.extract_embedding(image)
        if feature is None:
            return []
        return db.embedding_to_list(feature)
    except Exception:
        return []


def _expand_face_to_body(image: np.ndarray, face) -> np.ndarray | None:
    h, w = image.shape[:2]
    x, y, fw, fh = float(face[0]), float(face[1]), max(float(face[2]), 1.0), max(float(face[3]), 1.0)
    x1 = max(0, int(x - fw * 0.45))
    x2 = min(w, int(x + fw * 1.45))
    y1 = max(0, int(y - fh * 0.3))
    y2 = min(h, int(y + fh * 4.0))
    if x2 <= x1 or y2 <= y1:
        return None
    crop = image[y1:y2, x1:x2]
    return crop if crop.size else None


def _build_query(image: np.ndarray) -> dict[str, Any]:
    db = get_face_db()
    face_emb: list[float] = []
    reid_emb: list[float] = []
    target_classes: set[int] = set()
    query_label = "image"
    person_crop: np.ndarray | None = None

    largest_face = db._largest_face(image)
    if largest_face is not None:
        face_crop = db._face_crop(image, largest_face)
        if face_crop is not None and face_crop.size:
            face_emb = _face_embedding(face_crop)
            person_crop = _expand_face_to_body(image, largest_face)
    if not face_emb:
        face_emb = _face_embedding(image)

    boxes = _detect_boxes(image, class_ids=sorted(SEARCH_CLASS_IDS), conf=0.3)
    boxes.sort(
        key=lambda b: (b["bbox"][2] - b["bbox"][0]) * (b["bbox"][3] - b["bbox"][1]),
        reverse=True,
    )

    if face_emb:
        target_classes |= PERSON_CLASS_IDS
        query_label = "person"
        if person_crop is not None:
            reid_emb = extract_reid_embedding(person_crop) or []
        elif boxes and int(boxes[0]["class_id"]) in PERSON_CLASS_IDS:
            body = _crop(image, boxes[0]["bbox"])
            if body is not None:
                reid_emb = extract_reid_embedding(body) or []
    elif boxes:
        best = boxes[0]
        target_classes.add(int(best["class_id"]))
        query_label = str(best["class_name"])
        body = _crop(image, best["bbox"])
        if body is not None:
            reid_emb = extract_reid_embedding(body) or []
        if int(best["class_id"]) in PERSON_CLASS_IDS:
            target_classes |= PERSON_CLASS_IDS
        elif int(best["class_id"]) in VEHICLE_CLASS_IDS:
            target_classes |= VEHICLE_CLASS_IDS
        else:
            target_classes |= BAG_CLASS_IDS

    if not reid_emb and not face_emb:
        reid_emb = extract_reid_embedding(image) or []
    if not target_classes:
        target_classes = set(SEARCH_CLASS_IDS)
    return {
        "has_face": bool(face_emb),
        "has_reid": bool(reid_emb),
        "face_embedding": face_emb,
        "reid_embedding": reid_emb,
        "target_class_ids": sorted(target_classes),
        "label": query_label,
        "preview_jpeg_b64": _jpeg_b64(image),
    }


def _score_person_crop(
    crop: np.ndarray,
    query: dict[str, Any],
    *,
    face_threshold: float,
    reid_threshold: float,
) -> tuple[float, str]:
    face_score = 0.0
    reid_score = 0.0
    if query.get("has_face"):
        face_score = _cosine(query.get("face_embedding"), _face_embedding(crop))
    if query.get("has_reid"):
        reid_score = _cosine(query.get("reid_embedding"), extract_reid_embedding(crop) or [])

    if query.get("has_face") and face_score >= face_threshold:
        if not query.get("has_reid") or face_score >= reid_score:
            return face_score, "face"
        if face_score >= face_threshold - 0.04 and reid_score >= reid_threshold:
            return max(face_score, reid_score), "face+appearance"
        return face_score, "face"
    if query.get("has_reid") and reid_score >= reid_threshold:
        return reid_score, "appearance"
    return max(face_score, reid_score), "none"


def _score_object_crop(
    crop: np.ndarray,
    query: dict[str, Any],
    *,
    reid_threshold: float,
) -> tuple[float, str]:
    if not query.get("has_reid"):
        return 0.0, "none"
    reid_score = _cosine(query.get("reid_embedding"), extract_reid_embedding(crop) or [])
    if reid_score >= reid_threshold:
        return reid_score, "appearance"
    return reid_score, "none"


def _match_persons_in_frame(
    frame: np.ndarray,
    query: dict[str, Any],
    *,
    face_threshold: float,
    reid_threshold: float,
) -> dict[str, Any] | None:
    boxes = _detect_boxes(frame, class_ids=[0], conf=0.35)
    best_hit: dict[str, Any] | None = None
    for box in boxes:
        crop = _crop(frame, box["bbox"])
        if crop is None:
            continue
        score, match_type = _score_person_crop(
            crop,
            query,
            face_threshold=face_threshold,
            reid_threshold=reid_threshold,
        )
        if match_type == "none":
            continue
        candidate = {
            "score": round(score, 4),
            "match_type": match_type,
            "class_name": "person",
            "bbox": box["bbox"],
            "preview_jpeg_b64": _jpeg_b64(crop),
        }
        if best_hit is None or score > float(best_hit["score"]):
            best_hit = candidate
    return best_hit


def _match_objects_in_frame(
    frame: np.ndarray,
    query: dict[str, Any],
    *,
    class_ids: list[int],
    reid_threshold: float,
    detect_conf: float,
) -> dict[str, Any] | None:
    boxes = _detect_boxes(frame, class_ids=class_ids, conf=detect_conf)
    best_hit: dict[str, Any] | None = None
    for box in boxes:
        crop = _crop(frame, box["bbox"])
        if crop is None:
            continue
        score, match_type = _score_object_crop(crop, query, reid_threshold=reid_threshold)
        if match_type == "none":
            continue
        candidate = {
            "score": round(score, 4),
            "match_type": match_type,
            "class_name": box["class_name"],
            "bbox": box["bbox"],
            "preview_jpeg_b64": _jpeg_b64(crop),
        }
        if best_hit is None or score > float(best_hit["score"]):
            best_hit = candidate
    return best_hit


def _verify_hit_at_time(
    cap: cv2.VideoCapture,
    hit: dict[str, Any],
    query: dict[str, Any],
    *,
    face_threshold: float,
    reid_threshold: float,
    target_ids: list[int],
) -> dict[str, Any] | None:
    t_sec = float(hit.get("t_sec") or 0)
    cap.set(cv2.CAP_PROP_POS_MSEC, t_sec * 1000.0)
    ok, frame = cap.read()
    if not ok or frame is None or frame.size == 0:
        return None

    is_person = 0 in target_ids and query.get("has_face")
    if is_person:
        confirmed = _match_persons_in_frame(
            frame,
            query,
            face_threshold=face_threshold + 0.02,
            reid_threshold=reid_threshold,
        )
    else:
        confirmed = _match_objects_in_frame(
            frame,
            query,
            class_ids=target_ids,
            reid_threshold=reid_threshold + 0.02,
            detect_conf=0.35,
        )
    if confirmed is None:
        return None
    if float(confirmed["score"]) < float(hit.get("score") or 0) * 0.92:
        return None
    return {**hit, **confirmed, "t_sec": round(t_sec, 2)}


def _report_progress(
    progress_cb,
    last_progress: list[float],
    *,
    pct: int,
    message: str,
) -> None:
    if not callable(progress_cb):
        return
    pct = max(0, min(99, int(pct)))
    if pct != last_progress[0] or pct >= 95:
        last_progress[0] = pct
        progress_cb(pct, message)


def _cluster_hits(
    hits: list[dict[str, Any]],
    *,
    duration: float,
    clip_seconds: float,
    merge_gap: float,
) -> list[dict[str, Any]]:
    if not hits:
        return []
    ordered = sorted(hits, key=lambda h: float(h["t_sec"]))
    groups: list[list[dict[str, Any]]] = [[ordered[0]]]
    for hit in ordered[1:]:
        prev = groups[-1][-1]
        if float(hit["t_sec"]) - float(prev["t_sec"]) <= merge_gap:
            groups[-1].append(hit)
        else:
            groups.append([hit])

    half = clip_seconds / 2.0
    segments: list[dict[str, Any]] = []
    for group in groups:
        peak = max(group, key=lambda h: float(h["score"]))
        peak_score = float(peak["score"])
        match_type = str(peak.get("match_type") or "appearance")
        is_face = "face" in match_type
        min_score = MIN_FACE_SEGMENT_SCORE if is_face else MIN_REID_SEGMENT_SCORE
        if peak_score < min_score:
            continue
        if len(group) < MIN_HITS_PER_SEGMENT and peak_score < HIGH_CONFIDENCE_FACE:
            continue
        peak_t = float(peak["t_sec"])
        start = max(0.0, peak_t - half)
        end = min(duration, start + clip_seconds)
        if end - start < 1.5:
            end = min(duration, start + max(clip_seconds, 2.0))
        start = max(0.0, min(start, max(0.0, duration - (end - start))))
        segments.append(
            {
                "start_sec": round(start, 2),
                "end_sec": round(end, 2),
                "peak_t_sec": round(peak_t, 2),
                "peak_score": round(float(peak["score"]), 4),
                "match_type": peak.get("match_type") or "appearance",
                "class_name": peak.get("class_name") or "",
                "bbox": peak.get("bbox") or [],
                "hit_count": len(group),
                "preview_jpeg_b64": peak.get("preview_jpeg_b64") or "",
            }
        )
        if len(segments) >= MAX_SEGMENTS:
            break
    segments.sort(key=lambda s: float(s.get("peak_score") or 0), reverse=True)
    return segments


def search_video_path(
    image_bytes: bytes,
    video_path: str,
    *,
    face_threshold: float = DEFAULT_FACE_THRESHOLD,
    reid_threshold: float = DEFAULT_REID_THRESHOLD,
    sample_fps: float = 0.0,
    clip_seconds: float = 4.0,
    detect_conf: float = 0.25,
    progress_cb=None,
) -> dict[str, Any]:
    if not image_bytes:
        raise ValueError("Query image is required.")
    if not video_path or not os.path.isfile(video_path):
        raise ValueError("Video file is required.")
    size = os.path.getsize(video_path)
    if size > MAX_VIDEO_BYTES:
        raise ValueError(
            f"Video is too large (max {MAX_VIDEO_BYTES // (1024 * 1024)} MB). "
            "Export a 1-hour camera recording at a normal CCTV bitrate."
        )

    clip_seconds = min(5.0, max(2.0, float(clip_seconds)))
    face_threshold = min(0.9, max(0.2, float(face_threshold)))
    reid_threshold = min(0.98, max(0.55, float(reid_threshold)))

    query_image = decode_image(image_bytes)
    if callable(progress_cb):
        progress_cb(4, "Analyzing query photo")
    query = _build_query(query_image)
    if not query["has_face"] and not query["has_reid"]:
        raise ValueError("Could not extract a face or appearance signature from the image.")

    fps, duration = _video_meta(video_path)
    chosen_fps = float(sample_fps or 0)
    if chosen_fps <= 0:
        chosen_fps = auto_sample_fps(duration)
    chosen_fps = min(4.0, max(0.15, chosen_fps))
    estimated_frames = max(1, int(duration * chosen_fps)) if duration > 0 else 0
    is_person_query = bool(set(query["target_class_ids"]) & PERSON_CLASS_IDS)
    if callable(progress_cb):
        mode = "person match" if is_person_query else "object match"
        progress_cb(
            5,
            f"Prepared {duration / 60:.0f} min recording ({mode}, every {1 / chosen_fps:.0f}s)",
        )

    cap = None
    last_progress = [-1.0]
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError("Could not open the video. Use an MP4/AVI/MKV camera recording.")

        target_ids = [int(v) for v in query["target_class_ids"]]
        hits: list[dict[str, Any]] = []
        frames_scanned = 0
        last_t = 0.0
        for t_sec, frame in _iter_sampled_frames(
            cap,
            fps=fps,
            duration=duration,
            sample_fps=chosen_fps,
        ):
            last_t = t_sec
            frames_scanned += 1
            if duration > 0:
                pct = min(94, 6 + int((t_sec / duration) * 88))
            elif estimated_frames > 0:
                pct = min(94, 6 + int((frames_scanned / estimated_frames) * 88))
            else:
                pct = min(94, 6 + frames_scanned // 8)
            _report_progress(
                progress_cb,
                last_progress,
                pct=pct,
                message=f"Scanning {t_sec / 60:.1f} / {duration / 60:.0f} min",
            )

            best_hit: dict[str, Any] | None = None
            if is_person_query and query.get("has_face"):
                person_hit = _match_persons_in_frame(
                    frame,
                    query,
                    face_threshold=face_threshold,
                    reid_threshold=reid_threshold,
                )
                if person_hit is not None:
                    best_hit = {"t_sec": round(t_sec, 2), **person_hit}
            else:
                object_hit = _match_objects_in_frame(
                    frame,
                    query,
                    class_ids=target_ids,
                    reid_threshold=reid_threshold,
                    detect_conf=max(0.35, detect_conf),
                )
                if object_hit is not None:
                    best_hit = {"t_sec": round(t_sec, 2), **object_hit}

            if best_hit is not None:
                hits.append(best_hit)

        if hits:
            if callable(progress_cb):
                progress_cb(92, "Verifying matches")
            verified: list[dict[str, Any]] = []
            seen_times: set[float] = set()
            for hit in sorted(hits, key=lambda h: float(h["score"]), reverse=True):
                t_key = round(float(hit["t_sec"]), 1)
                if t_key in seen_times:
                    continue
                seen_times.add(t_key)
                ok_hit = _verify_hit_at_time(
                    cap,
                    hit,
                    query,
                    face_threshold=face_threshold,
                    reid_threshold=reid_threshold,
                    target_ids=target_ids,
                )
                if ok_hit is not None:
                    verified.append(ok_hit)
            hits = verified

        merge_gap = max(2.0, clip_seconds * 1.1)
        if duration <= 0 and last_t:
            duration = last_t
        segments = _cluster_hits(
            hits,
            duration=max(duration, 0.0),
            clip_seconds=clip_seconds,
            merge_gap=merge_gap,
        )
        if callable(progress_cb):
            progress_cb(98, "Building clips")
        return {
            "query": {
                "has_face": query["has_face"],
                "has_reid": query["has_reid"],
                "label": query["label"],
                "target_class_ids": query["target_class_ids"],
                "preview_jpeg_b64": query["preview_jpeg_b64"],
            },
            "video": {
                "duration_sec": round(duration, 2),
                "fps": round(fps, 2),
                "frames_scanned": frames_scanned,
                "sample_fps": chosen_fps,
                "clip_seconds": clip_seconds,
                "scan_mode": "person" if is_person_query else "object",
            },
            "thresholds": {
                "face": face_threshold,
                "reid": reid_threshold,
            },
            "hit_count": len(hits),
            "segments": segments,
        }
    finally:
        if cap is not None:
            cap.release()


def search_video_bytes(
    image_bytes: bytes,
    video_bytes: bytes,
    *,
    face_threshold: float = DEFAULT_FACE_THRESHOLD,
    reid_threshold: float = DEFAULT_REID_THRESHOLD,
    sample_fps: float = 0.0,
    clip_seconds: float = 4.0,
    detect_conf: float = 0.25,
    progress_cb=None,
) -> dict[str, Any]:
    if not video_bytes:
        raise ValueError("Video file is required.")
    if len(video_bytes) > MAX_VIDEO_BYTES:
        raise ValueError(f"Video is too large (max {MAX_VIDEO_BYTES // (1024 * 1024)} MB).")
    fd, video_path = tempfile.mkstemp(suffix=".mp4", prefix="video_search_")
    os.close(fd)
    try:
        with open(video_path, "wb") as handle:
            handle.write(video_bytes)
        return search_video_path(
            image_bytes,
            video_path,
            face_threshold=face_threshold,
            reid_threshold=reid_threshold,
            sample_fps=sample_fps,
            clip_seconds=clip_seconds,
            detect_conf=detect_conf,
            progress_cb=progress_cb,
        )
    finally:
        try:
            os.remove(video_path)
        except OSError:
            pass
