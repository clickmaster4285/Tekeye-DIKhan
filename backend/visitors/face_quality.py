"""Enrollment quality gates for visitor faces (not used by staff attendance)."""

from __future__ import annotations

import cv2
import numpy as np

from recognition.services.quality_checker import FaceQualityChecker


class VisitorFaceQuality:
    MIN_FACE_PX = 80
    MIN_BRIGHTNESS = 35.0
    MAX_BRIGHTNESS = 220.0
    MAX_ABS_YAW = 45.0
    MAX_ABS_PITCH = 35.0

    @classmethod
    def evaluate(cls, image: np.ndarray, face) -> dict:
        base = FaceQualityChecker.evaluate(image, face)
        bbox = face.bbox.astype(int)
        x1, y1, x2, y2 = [int(v) for v in bbox]
        h, w = image.shape[:2]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        face_w = max(x2 - x1, 1)
        face_h = max(y2 - y1, 1)
        crop = image[y1:y2, x1:x2]
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if crop.ndim == 3 else crop
        brightness = float(np.mean(gray)) if gray.size else 0.0

        yaw, pitch = cls._pose_angles(face)
        checks = dict(base.get("checks") or {})
        checks["face_pixels_ok"] = face_w >= cls.MIN_FACE_PX and face_h >= cls.MIN_FACE_PX
        checks["brightness_ok"] = cls.MIN_BRIGHTNESS <= brightness <= cls.MAX_BRIGHTNESS
        checks["pose_ok"] = abs(yaw) <= cls.MAX_ABS_YAW and abs(pitch) <= cls.MAX_ABS_PITCH
        passed = all(checks.values())
        quality_score = cls._score(checks, base, brightness)

        result = dict(base)
        result["passed"] = passed
        result["checks"] = checks
        result["face_width"] = face_w
        result["face_height"] = face_h
        result["brightness"] = round(brightness, 2)
        result["yaw"] = round(yaw, 2)
        result["pitch"] = round(pitch, 2)
        result["quality_score"] = round(quality_score, 4)
        result["message"] = cls._message(checks, base.get("message") or "")
        return result

    @staticmethod
    def _pose_angles(face) -> tuple[float, float]:
        pose = getattr(face, "pose", None)
        if pose is None:
            return 0.0, 0.0
        try:
            values = [float(v) for v in list(pose)]
        except (TypeError, ValueError):
            return 0.0, 0.0
        if len(values) < 2:
            return 0.0, 0.0
        pitch, yaw = values[0], values[1]
        return yaw, pitch

    @staticmethod
    def _score(checks: dict, base: dict, brightness: float) -> float:
        det = float(base.get("det_score") or 0.0)
        blur = min(float(base.get("blur_score") or 0.0) / 120.0, 1.0)
        size = 1.0 if checks.get("face_pixels_ok") else 0.0
        light = 1.0 - min(abs(brightness - 128.0) / 128.0, 1.0)
        pose = 1.0 if checks.get("pose_ok") else 0.4
        return max(0.0, min(1.0, 0.35 * det + 0.25 * blur + 0.2 * size + 0.1 * light + 0.1 * pose))

    @staticmethod
    def _message(checks: dict, fallback: str) -> str:
        if checks.get("det_score_ok") is False:
            return "Face detection confidence too low — move closer and face the camera"
        if checks.get("face_size_ok") is False or checks.get("face_pixels_ok") is False:
            return "Face too small — move closer to the camera"
        if checks.get("blur_ok") is False:
            return "Image too blurry — hold still and improve lighting"
        if checks.get("brightness_ok") is False:
            return "Lighting is too dark or too bright — adjust and try again"
        if checks.get("pose_ok") is False:
            return "Face the camera more directly — large head turn rejected"
        if all(checks.values()):
            return "Face quality acceptable"
        return fallback or "Face quality check failed"
