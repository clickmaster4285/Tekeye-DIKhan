"""Appearance ReID feature extraction.

Default: OSNet-inspired multi-part (stripe) embedding — no external weights.
Optional: load a Torch OSNet checkpoint if ML_REID_BACKEND=osnet and weights exist.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import cv2
import numpy as np

REID_DIM = 512
BASE_DIR = Path(__file__).resolve().parent

_osnet_model: Any = None
_osnet_device: str | None = None
_osnet_failed = False


def _env_backend() -> str:
    return (os.getenv("ML_REID_BACKEND", "parts") or "parts").strip().lower()


def _part_embedding(person_crop: np.ndarray) -> list[float]:
    """
    Stronger handcrafted ReID: 6 horizontal body stripes × (HSV hist + gradients).
    More discriminative than a single global histogram (reduces wrong person merges).
    """
    if person_crop is None or person_crop.size == 0:
        return []

    img = person_crop
    if img.shape[0] < 32 or img.shape[1] < 16:
        img = cv2.resize(img, (64, 128), interpolation=cv2.INTER_LINEAR)

    h, w = img.shape[:2]
    resized = cv2.resize(img, (64, 128), interpolation=cv2.INTER_AREA)
    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag = cv2.magnitude(gx, gy)
    ori = np.arctan2(gy, gx)

    parts: list[np.ndarray] = []
    stripes = 6
    stripe_h = resized.shape[0] // stripes
    for i in range(stripes):
        y0 = i * stripe_h
        y1 = resized.shape[0] if i == stripes - 1 else (i + 1) * stripe_h
        hsv_s = hsv[y0:y1, :]
        mag_s = mag[y0:y1, :]
        ori_s = ori[y0:y1, :]
        hist_h = cv2.calcHist([hsv_s], [0], None, [16], [0, 180]).flatten()
        hist_s = cv2.calcHist([hsv_s], [1], None, [12], [0, 256]).flatten()
        hist_v = cv2.calcHist([hsv_s], [2], None, [12], [0, 256]).flatten()
        ori_hist, _ = np.histogram(ori_s, bins=8, range=(-np.pi, np.pi), weights=mag_s)
        parts.extend(
            [
                hist_h.astype(np.float32),
                hist_s.astype(np.float32),
                hist_v.astype(np.float32),
                ori_hist.astype(np.float32),
                np.asarray([float(mag_s.mean()), float(mag_s.std())], dtype=np.float32),
            ]
        )

    # Global cues
    aspect = np.array([w / max(h, 1), h / max(w, 1)], dtype=np.float32)
    upper = resized[: resized.shape[0] // 2, :]
    lower = resized[resized.shape[0] // 2 :, :]
    parts.append(aspect)
    parts.append(upper.mean(axis=(0, 1)).astype(np.float32) if upper.size else np.zeros(3, np.float32))
    parts.append(lower.mean(axis=(0, 1)).astype(np.float32) if lower.size else np.zeros(3, np.float32))

    vec = np.concatenate([np.asarray(p, dtype=np.float32).reshape(-1) for p in parts])
    if vec.size < REID_DIM:
        vec = np.pad(vec, (0, REID_DIM - vec.size))
    else:
        vec = vec[:REID_DIM]
    norm = float(np.linalg.norm(vec))
    if norm > 0:
        vec = vec / norm
    return [float(v) for v in vec]


def _resolve_osnet_weights() -> Path | None:
    env = (os.getenv("ML_REID_WEIGHTS", "") or "").strip()
    candidates: list[Path] = []
    if env:
        p = Path(env)
        candidates.append(p if p.is_absolute() else BASE_DIR / p)
    candidates.extend(
        [
            BASE_DIR / "runs" / "reid" / "osnet_x1_0_market1501.pth",
            BASE_DIR / "runs" / "reid" / "osnet_x1_0.pth",
            BASE_DIR / "weights" / "osnet_x1_0.pth",
        ]
    )
    for path in candidates:
        if path.is_file():
            return path
    return None


def _try_osnet_embedding(person_crop: np.ndarray) -> list[float]:
    """Optional Torch OSNet via torchreid if installed + weights present."""
    global _osnet_model, _osnet_device, _osnet_failed
    if _osnet_failed:
        return []
    if person_crop is None or person_crop.size == 0:
        return []

    weights = _resolve_osnet_weights()
    if weights is None:
        return []

    try:
        import torch
        import torch.nn.functional as F
    except Exception:
        _osnet_failed = True
        return []

    if _osnet_model is None:
        try:
            import torchreid  # type: ignore

            model = torchreid.models.build_model(
                name="osnet_x1_0",
                num_classes=1,
                pretrained=False,
                use_gpu=torch.cuda.is_available(),
            )
            state = torch.load(str(weights), map_location="cpu")
            if isinstance(state, dict) and "state_dict" in state:
                state = state["state_dict"]
            model.load_state_dict(state, strict=False)
            model.eval()
            device = "cuda" if torch.cuda.is_available() else "cpu"
            model = model.to(device)
            _osnet_model = model
            _osnet_device = device
            print(f"[reid] OSNet loaded from {weights} ({device})")
        except Exception as exc:
            print(f"[reid] OSNet unavailable ({exc}) — using part-based ReID")
            _osnet_failed = True
            return []

    try:
        import torch

        img = cv2.resize(person_crop, (128, 256), interpolation=cv2.INTER_LINEAR)
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        rgb = (rgb - mean) / std
        tensor = torch.from_numpy(rgb.transpose(2, 0, 1)).unsqueeze(0).to(_osnet_device)
        with torch.no_grad():
            feat = _osnet_model(tensor)
            if isinstance(feat, (tuple, list)):
                feat = feat[0]
            feat = torch.nn.functional.normalize(feat, dim=1)
        vec = feat.squeeze(0).detach().cpu().numpy().astype(np.float32).reshape(-1)
        if vec.size < REID_DIM:
            vec = np.pad(vec, (0, REID_DIM - vec.size))
        else:
            vec = vec[:REID_DIM]
        return [float(v) for v in vec]
    except Exception:
        return []


def extract_reid_embedding(person_crop: np.ndarray) -> list[float]:
    """
    Extract a normalized appearance embedding from a person/vehicle crop.

    Backend:
      - parts (default): multi-stripe OSNet-inspired features
      - osnet: Torch OSNet when weights + torchreid are available, else parts
    """
    backend = _env_backend()
    if backend in ("osnet", "torchreid", "auto"):
        vec = _try_osnet_embedding(person_crop)
        if vec:
            return vec
    return _part_embedding(person_crop)
