"""Silent-Face MiniFASNet liveness. Missing weights do not block attendance."""

from __future__ import annotations

import logging
from pathlib import Path

import cv2
import numpy as np
from django.conf import settings

logger = logging.getLogger(__name__)

WEBCAM_LIVENESS_THRESHOLD = 0.50
CCTV_LIVENESS_THRESHOLD = 0.40
MOIRE_FAIL = 0.62

_MODELS = (
    ("MiniFASNetV2", 2.7, "2.7_80x80_MiniFASNetV2.onnx"),
    ("MiniFASNetV1SE", 4.0, "4.0_80x80_MiniFASNetV1SE.onnx"),
)


def _weight_dirs() -> list[Path]:
    configured = (getattr(settings, "ATTENDANCE_ANTISPOOF_DIR", "") or "").strip()
    dirs = []
    if configured:
        dirs.append(Path(configured))
    base = Path(getattr(settings, "BASE_DIR", "."))
    dirs.append(base / "recognition" / "weights")
    dirs.append(Path.home() / ".insightface" / "antispoof")
    return dirs


def _find_model(filename: str) -> Path | None:
    for folder in _weight_dirs():
        path = folder / filename
        if path.is_file():
            return path
    return None


class AntiSpoofChecker:
    """MiniFASNetV2 (scale 2.7) + MiniFASNetV1SE (scale 4.0)."""

    def __init__(self):
        self._sessions: list[tuple[str, float, object]] = []
        self._loaded = False
        self._missing_logged = False

    def _ensure(self) -> bool:
        if self._loaded:
            return bool(self._sessions)
        self._loaded = True
        try:
            import onnxruntime as ort
        except ImportError:
            logger.warning("Anti-spoof skipped: onnxruntime is not installed")
            return False
        for name, scale, filename in _MODELS:
            path = _find_model(filename)
            if path is None:
                continue
            session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
            self._sessions.append((name, scale, session))
        if len(self._sessions) < 2:
            if not self._missing_logged:
                logger.warning(
                    "Anti-spoof weights not found (MiniFASNetV2 / MiniFASNetV1SE). Liveness is skipped."
                )
                self._missing_logged = True
            self._sessions = []
            return False
        logger.info("Anti-spoof ready: %s", [name for name, _, _ in self._sessions])
        return True

    @staticmethod
    def _crop(image: np.ndarray, bbox, scale: float) -> np.ndarray:
        height, width = image.shape[:2]
        x1, y1, x2, y2 = [float(v) for v in bbox]
        box_w = max(x2 - x1, 1.0)
        box_h = max(y2 - y1, 1.0)
        scale = min((height - 1) / box_h, min((width - 1) / box_w, scale))
        center_x = x1 + box_w / 2.0
        center_y = y1 + box_h / 2.0
        new_w = box_w * scale
        new_h = box_h * scale
        left = int(max(0, center_x - new_w / 2.0))
        top = int(max(0, center_y - new_h / 2.0))
        right = int(min(width, center_x + new_w / 2.0))
        bottom = int(min(height, center_y + new_h / 2.0))
        crop = image[top:bottom, left:right]
        if crop.size == 0:
            crop = image
        return cv2.resize(crop, (80, 80))

    def _score(self, image: np.ndarray, bbox) -> float:
        scores = []
        for _name, scale, session in self._sessions:
            crop = self._crop(image, bbox, scale)
            blob = crop.astype(np.float32).transpose(2, 0, 1)[None, ...]
            input_name = session.get_inputs()[0].name
            output = session.run(None, {input_name: blob})[0]
            row = np.array(output, dtype=np.float32).reshape(-1)
            exp = np.exp(row - row.max())
            probs = exp / exp.sum()
            real = float(probs[1]) if probs.size > 1 else float(probs[0])
            scores.append(real)
        if not scores:
            return 1.0
        return float(sum(scores) / len(scores))

    def evaluate(self, image: np.ndarray, face, *, source: str = "webcam") -> dict:
        from recognition.services.preprocess import screen_moire_score

        bbox = getattr(face, "bbox", None)
        crop = image
        if bbox is not None:
            height, width = image.shape[:2]
            x1, y1, x2, y2 = [int(v) for v in bbox]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(width, x2), min(height, y2)
            if x2 > x1 and y2 > y1:
                crop = image[y1:y2, x1:x2]
        moire = screen_moire_score(crop)
        threshold = CCTV_LIVENESS_THRESHOLD if source == "cctv" else WEBCAM_LIVENESS_THRESHOLD
        if not self._ensure() or bbox is None:
            passed = moire < MOIRE_FAIL
            return {
                "passed": passed,
                "skipped": True,
                "score": None,
                "moire": round(moire, 4),
                "threshold": threshold,
                "message": "Live face" if passed else "Screen replay detected",
            }
        score = self._score(image, bbox)
        passed = score >= threshold and moire < MOIRE_FAIL
        return {
            "passed": passed,
            "skipped": False,
            "score": round(score, 4),
            "moire": round(moire, 4),
            "threshold": threshold,
            "message": "Live face" if passed else "Spoof detected",
        }


_checker: AntiSpoofChecker | None = None


def get_antispoof() -> AntiSpoofChecker:
    global _checker
    if _checker is None:
        _checker = AntiSpoofChecker()
    return _checker
