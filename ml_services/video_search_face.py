"""Dedicated CPU-only YuNet/SFace for Find-in-Video.

Isolated from live-stream ``KnownFaceDB`` so concurrent camera recognition cannot
corrupt OpenCV DNN BlobManager during a search job.
"""

from __future__ import annotations

import threading
import urllib.request
from pathlib import Path

import cv2
import numpy as np

MODEL_DIR = Path(__file__).resolve().parent / "models" / "face"
YUNET_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/"
    "face_detection_yunet/face_detection_yunet_2023mar.onnx"
)
SFACE_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/"
    "face_recognition_sface/face_recognition_sface_2021dec.onnx"
)

_LOCK = threading.Lock()
_detector: cv2.FaceDetectorYN | None = None
_recognizer: cv2.FaceRecognizerSF | None = None


def _download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.is_file():
        return
    print(f"[video-search-face] Downloading {dest.name}...")
    urllib.request.urlretrieve(url, dest)


def _ensure_nets() -> tuple[cv2.FaceDetectorYN, cv2.FaceRecognizerSF]:
    global _detector, _recognizer
    if _detector is not None and _recognizer is not None:
        return _detector, _recognizer
    yunet_path = MODEL_DIR / "face_detection_yunet_2023mar.onnx"
    sface_path = MODEL_DIR / "face_recognition_sface_2021dec.onnx"
    _download(YUNET_URL, yunet_path)
    _download(SFACE_URL, sface_path)
    backend = cv2.dnn.DNN_BACKEND_OPENCV
    target = cv2.dnn.DNN_TARGET_CPU
    _detector = cv2.FaceDetectorYN.create(
        str(yunet_path),
        "",
        (320, 320),
        0.45,
        0.3,
        5000,
        backend,
        target,
    )
    _recognizer = cv2.FaceRecognizerSF.create(str(sface_path), "", backend, target)
    print("[video-search-face] YuNet/SFace ready (CPU, search-only)")
    return _detector, _recognizer


def _recreate_nets() -> tuple[cv2.FaceDetectorYN, cv2.FaceRecognizerSF]:
    global _detector, _recognizer
    _detector = None
    _recognizer = None
    return _ensure_nets()


def _upscale_if_small(image: np.ndarray, min_side: int = 100) -> np.ndarray:
    h, w = image.shape[:2]
    if min(h, w) >= min_side:
        return image
    scale = min_side / min(h, w)
    return cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_LINEAR)


def _detect_faces(image: np.ndarray):
    detector, _ = _ensure_nets()
    h, w = image.shape[:2]
    if h < 10 or w < 10:
        return None
    try:
        detector.setInputSize((w, h))
        _, faces = detector.detect(image)
    except cv2.error as exc:
        print(f"[video-search-face] detect failed ({exc}); recreating")
        detector, _ = _recreate_nets()
        detector.setInputSize((w, h))
        _, faces = detector.detect(image)
    if faces is None or len(faces) == 0:
        return None
    return faces


def largest_face(image: np.ndarray):
    if image is None or image.size == 0:
        return None
    with _LOCK:
        faces = _detect_faces(_upscale_if_small(image))
        if faces is None:
            return None
        areas = [float(f[2] * f[3]) for f in faces]
        return faces[int(np.argmax(areas))]


def face_crop(image: np.ndarray, face) -> np.ndarray | None:
    if image is None or image.size == 0 or face is None:
        return None
    h, w = image.shape[:2]
    fw, fh = max(float(face[2]), 1.0), max(float(face[3]), 1.0)
    x, y = int(face[0]), int(face[1])
    x2, y2 = min(w, x + int(fw)), min(h, y + int(fh))
    crop = image[max(0, y):y2, max(0, x):x2]
    return crop if crop.size else None


def extract_embedding(image: np.ndarray) -> list[float]:
    """Return SFace embedding for the largest face, or [] if none."""
    if image is None or image.size == 0:
        return []
    with _LOCK:
        try:
            work = _upscale_if_small(image)
            faces = _detect_faces(work)
            if faces is None:
                return []
            areas = [float(f[2] * f[3]) for f in faces]
            face = faces[int(np.argmax(areas))]
            _, recognizer = _ensure_nets()
            try:
                aligned = recognizer.alignCrop(work, face)
                feature = recognizer.feature(aligned)
            except cv2.error as exc:
                print(f"[video-search-face] feature failed ({exc}); recreating")
                _, recognizer = _recreate_nets()
                aligned = recognizer.alignCrop(work, face)
                feature = recognizer.feature(aligned)
            flat = np.asarray(feature, dtype=np.float32).reshape(-1)
            return [float(v) for v in flat]
        except Exception as exc:
            print(f"[video-search-face] extract_embedding failed: {exc}")
            return []
