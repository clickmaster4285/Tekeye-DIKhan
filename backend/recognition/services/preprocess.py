"""Lighting helpers for InsightFace enrollment and live probes."""

from __future__ import annotations

import cv2
import numpy as np


def apply_clahe_bgr(image: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    lightness, green, red = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    merged = cv2.merge((clahe.apply(lightness), green, red))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def _gamma(image: np.ndarray, gamma: float) -> np.ndarray:
    gamma = float(np.clip(gamma, 0.2, 4.0))
    table = np.array([((i / 255.0) ** (1.0 / gamma)) * 255 for i in range(256)], dtype=np.uint8)
    return cv2.LUT(image, table)


def lighting_variants(image: np.ndarray) -> list[np.ndarray]:
    """Original photo plus gamma and CLAHE copies used at enrollment."""
    return [image, _gamma(image, 0.7), _gamma(image, 1.4), apply_clahe_bgr(image)]


def correct_exposure(image: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    mean = float(gray.mean())
    if mean < 1.0 or mean > 254.0:
        return image
    gamma = float(np.log(0.5) / np.log(mean / 255.0))
    return _gamma(image, gamma)


def screen_moire_score(image: np.ndarray) -> float:
    """High-frequency energy. A phone or monitor replay scores higher than a live face."""
    if image is None or image.size == 0:
        return 0.0
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    gray = cv2.resize(gray, (64, 64))
    spectrum = np.fft.fftshift(np.fft.fft2(gray.astype(np.float32)))
    magnitude = np.abs(spectrum)
    cy, cx = 32, 32
    magnitude[cy - 4 : cy + 5, cx - 4 : cx + 5] = 0
    peak = float(magnitude.max()) + 1e-6
    return float(np.clip(magnitude.mean() / peak, 0.0, 1.0))
