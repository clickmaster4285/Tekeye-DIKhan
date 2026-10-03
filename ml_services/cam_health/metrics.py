"""Image quality metrics (OpenCV / NumPy) — V1 camera health."""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np


def _gray(frame: np.ndarray) -> np.ndarray:
    if frame.ndim == 2:
        return frame
    return cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)


def sharpness(frame: np.ndarray) -> float:
    gray = _gray(frame)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def brightness(frame: np.ndarray) -> float:
    return float(np.mean(_gray(frame)))


def contrast(frame: np.ndarray) -> float:
    return float(np.std(_gray(frame)))


def exposure_ratios(frame: np.ndarray) -> dict[str, float]:
    gray = _gray(frame)
    total = max(int(gray.size), 1)
    dark = float(np.count_nonzero(gray < 40)) / total
    bright = float(np.count_nonzero(gray > 220)) / total
    return {
        "dark_ratio": round(dark, 4),
        "bright_ratio": round(bright, 4),
        "overexposure": round(bright, 4),
    }


def noise_estimate(frame: np.ndarray) -> float:
    """High-frequency residual after mild blur — proxy for sensor/compression noise."""
    gray = _gray(frame)
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    residual = cv2.absdiff(gray, blur)
    return float(np.mean(residual))


def glare_score(frame: np.ndarray) -> float:
    """Fraction of very bright, low-saturation pixels (specular glare proxy)."""
    if frame.ndim != 3:
        gray = _gray(frame)
        return float(np.count_nonzero(gray > 245)) / max(int(gray.size), 1)
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    mask = (v > 240) & (s < 40)
    return float(np.count_nonzero(mask)) / max(int(mask.size), 1)


def color_abnormality(frame: np.ndarray) -> float:
    """Channel imbalance score (0 = balanced, higher = tint/cast)."""
    if frame.ndim != 3:
        return 0.0
    b, g, r = cv2.split(frame.astype(np.float32))
    means = np.array([float(np.mean(b)), float(np.mean(g)), float(np.mean(r))])
    return float(np.std(means) / max(float(np.mean(means)), 1.0))


def resolution_info(frame: np.ndarray) -> dict[str, int]:
    h, w = frame.shape[:2]
    return {"width": int(w), "height": int(h), "megapixels": round((w * h) / 1_000_000, 3)}


def fingerprint(frame: np.ndarray, size: int = 32) -> list[float]:
    """Tiny downscaled grayscale vector for freeze comparison."""
    gray = _gray(frame)
    small = cv2.resize(gray, (size, size), interpolation=cv2.INTER_AREA)
    return [round(float(v), 2) for v in small.flatten().tolist()]


def frame_diff_score(current_fp: list[float], previous_fp: list[float] | None) -> float:
    """0 = identical frames, ~1 = very different. Used as freeze inverse."""
    if not previous_fp or not current_fp or len(previous_fp) != len(current_fp):
        return 1.0
    a = np.asarray(current_fp, dtype=np.float32)
    b = np.asarray(previous_fp, dtype=np.float32)
    mad = float(np.mean(np.abs(a - b)))
    return min(1.0, mad / 25.0)


def compute_image_metrics(frame: np.ndarray) -> dict[str, Any]:
    exp = exposure_ratios(frame)
    sharp = sharpness(frame)
    bright = brightness(frame)
    cont = contrast(frame)
    return {
        "sharpness": round(sharp, 2),
        "brightness": round(bright, 2),
        "contrast": round(cont, 2),
        "dark_ratio": exp["dark_ratio"],
        "bright_ratio": exp["bright_ratio"],
        "overexposure": exp["overexposure"],
        "noise": round(noise_estimate(frame), 2),
        "glare": round(glare_score(frame), 4),
        "color_abnormality": round(color_abnormality(frame), 4),
        "resolution": resolution_info(frame),
        "fingerprint": fingerprint(frame),
    }
