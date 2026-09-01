"""GPU helpers for video recovery — PyTorch CUDA + FFmpeg NVENC when available."""

from __future__ import annotations

import os
import subprocess
from functools import lru_cache
from typing import Any

import numpy as np


def _gpu_enabled() -> bool:
    try:
        from django.conf import settings

        return getattr(settings, "VIDEO_RECOVERY_USE_GPU", True)
    except Exception:
        return True


def gpu_batch_size() -> int:
    try:
        from django.conf import settings

        return int(getattr(settings, "VIDEO_RECOVERY_GPU_BATCH_SIZE", 32))
    except Exception:
        return 32


@lru_cache(maxsize=1)
def get_torch_device():
    """Return cuda device if GPU processing is enabled and available."""
    if not _gpu_enabled():
        return None
    try:
        import torch
    except ImportError:
        return None
    if not torch.cuda.is_available():
        return None
    return torch.device("cuda")


def gpu_info() -> dict[str, Any]:
    device = get_torch_device()
    if device is None:
        return {"available": False, "backend": "cpu"}
    try:
        import torch

        return {
            "available": True,
            "backend": "cuda",
            "device": torch.cuda.get_device_name(device),
            "batch_size": gpu_batch_size(),
            "nvenc": ffmpeg_nvenc_available(),
        }
    except Exception as exc:
        return {"available": False, "backend": "cpu", "error": str(exc)}


@lru_cache(maxsize=1)
def ffmpeg_nvenc_available() -> bool:
    if not _gpu_enabled():
        return False
    try:
        from .ffmpeg_utils import ffmpeg_path

        proc = subprocess.run(
            [ffmpeg_path(), "-hide_banner", "-encoders"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        out = (proc.stdout or "") + (proc.stderr or "")
        return "h264_nvenc" in out
    except Exception:
        return False


def video_encoder_args(*, crf: int = 20, preset: str = "medium") -> list[str]:
    """Prefer NVENC on NVIDIA GPUs; fall back to libx264."""
    if ffmpeg_nvenc_available():
        cq = max(0, min(51, crf))
        return ["-c:v", "h264_nvenc", "-preset", preset if preset != "medium" else "p4", "-cq", str(cq)]
    return ["-c:v", "libx264", "-preset", preset, "-crf", str(crf)]


def _gaussian_kernel1d(size: int, sigma: float, device, dtype):
    import torch

    coords = torch.arange(size, device=device, dtype=dtype) - (size - 1) / 2.0
    kernel = torch.exp(-(coords**2) / (2 * sigma**2))
    return kernel / kernel.sum()


def gaussian_blur_batch(t, kernel_size: int = 7, sigma: float = 2.0):
    """Separable Gaussian blur on NCHW float tensor in [0, 1]."""
    import torch
    import torch.nn.functional as F

    k = kernel_size if kernel_size % 2 == 1 else kernel_size + 1
    pad = k // 2
    dtype = t.dtype
    device = t.device
    g1 = _gaussian_kernel1d(k, sigma, device, dtype).view(1, 1, 1, k)
    g2 = _gaussian_kernel1d(k, sigma, device, dtype).view(1, 1, k, 1)
    c = t.shape[1]
    g1 = g1.expand(c, 1, 1, k).contiguous()
    g2 = g2.expand(c, 1, k, 1).contiguous()
    out = F.conv2d(t, g1, padding=(0, pad), groups=c)
    out = F.conv2d(out, g2, padding=(pad, 0), groups=c)
    return out.clamp(0.0, 1.0)


def bgr_to_tensor(img: np.ndarray, device):
    """Single-frame BGR numpy array → NCHW float tensor on device."""
    import torch

    return (
        torch.from_numpy(img)
        .to(device, non_blocking=True)
        .permute(2, 0, 1)
        .unsqueeze(0)
        .float()
        / 255.0
    )


def bgr_batch_to_tensor(imgs: list[np.ndarray], device):
    import torch

    if not imgs:
        return None
    if len(imgs) == 1:
        return bgr_to_tensor(imgs[0], device)
    h, w = imgs[0].shape[:2]
    batch = np.empty((len(imgs), h, w, 3), dtype=np.uint8)
    for i, img in enumerate(imgs):
        if img.shape[:2] != (h, w):
            import cv2

            img = cv2.resize(img, (w, h))
        batch[i] = img
    return torch.from_numpy(batch).to(device, non_blocking=True).permute(0, 3, 1, 2).float() / 255.0


def tensor_batch_to_bgr_list(t) -> list[np.ndarray]:
    arr = (t.permute(0, 2, 3, 1).clamp(0, 1) * 255.0).byte().cpu().numpy()
    return [arr[i] for i in range(arr.shape[0])]


def restore_damaged_frames_batch(imgs: list[np.ndarray]) -> list[np.ndarray] | None:
    """GPU batch restoration — replaces slow per-frame CPU denoise/inpaint."""
    device = get_torch_device()
    if device is None or not imgs:
        return None

    import torch

    t = bgr_batch_to_tensor(imgs, device)
    b, g, r = t[:, 0:1], t[:, 1:2], t[:, 2:3]
    luminance = 0.114 * b + 0.587 * g + 0.299 * r
    green_mask = (g > 0.35) & (g > r * 1.05) & (g > b * 1.05)
    black_mask = luminance < 0.05
    white_mask = (luminance > 0.97) & (t.std(dim=1, keepdim=True) < 0.03)
    damage = green_mask | black_mask | white_mask

    light_blur = gaussian_blur_batch(t, 5, 1.2)
    heavy_blur = gaussian_blur_batch(t, 11, 3.0)
    damage_ratio = damage.float().mean(dim=(1, 2, 3), keepdim=True)

    out = torch.where(damage, light_blur, t * 0.88 + light_blur * 0.12)
    out = torch.where(damage_ratio > 0.45, torch.where(damage, heavy_blur, out), out)
    out = torch.where(damage_ratio > 0.85, heavy_blur * 0.65 + light_blur * 0.35, out)

    result = tensor_batch_to_bgr_list(out)
    del t, light_blur, heavy_blur, out
    try:
        import torch

        if device.type == "cuda":
            torch.cuda.empty_cache()
    except Exception:
        pass
    return result


def interpolate_frames_batch(frame_a: np.ndarray, frame_b: np.ndarray, count: int) -> list[np.ndarray] | None:
    """GPU-accelerated frame interpolation between two anchors."""
    device = get_torch_device()
    if device is None or count <= 0 or frame_a is None or frame_b is None:
        return None

    import cv2
    import torch

    if frame_a.shape != frame_b.shape:
        frame_b = cv2.resize(frame_b, (frame_a.shape[1], frame_a.shape[0]))

    ta = bgr_batch_to_tensor([frame_a], device)
    tb = bgr_batch_to_tensor([frame_b], device)
    out: list[np.ndarray] = []
    for i in range(count):
        alpha = (i + 1) / (count + 1)
        blended = ta * (1.0 - alpha) + tb * alpha
        out.extend(tensor_batch_to_bgr_list(blended))
    return out


def temporal_blend_streaming(
    paths: list[str],
    out_dir: str,
    *,
    blend_weight: float = 0.15,
) -> list[str] | None:
    """GPU temporal smoothing — one frame at a time to avoid multi-GB RAM spikes."""
    device = get_torch_device()
    if device is None or len(paths) < 2:
        return None

    import cv2
    import torch

    os.makedirs(out_dir, exist_ok=True)
    w = float(blend_weight)
    output_paths: list[str] = []
    prev_tensor = None
    out_idx = 0

    for path in paths:
        img = cv2.imread(path)
        if img is None:
            continue

        dest = os.path.join(out_dir, f"frame_{out_idx:06d}.jpg")

        if prev_tensor is None:
            cv2.imwrite(dest, img, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
            output_paths.append(dest)
            prev_tensor = bgr_to_tensor(img, device)
            out_idx += 1
            continue

        cur = bgr_to_tensor(img, device)
        blended = cur * (1.0 - w) + prev_tensor * w
        out_img = tensor_batch_to_bgr_list(blended)[0]
        cv2.imwrite(dest, out_img, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
        output_paths.append(dest)
        prev_tensor = blended
        del cur, blended
        out_idx += 1

    try:
        if device.type == "cuda":
            torch.cuda.empty_cache()
    except Exception:
        pass

    return output_paths if len(output_paths) >= 2 else None


def temporal_blend_batch(paths: list[str], blend_weight: float = 0.15) -> list[np.ndarray] | None:
    """Legacy wrapper — delegates to streaming path for memory safety."""
    del blend_weight
    # Do not load all frames into RAM; callers should use temporal_blend_streaming.
    if len(paths) > gpu_batch_size():
        return None
    return _temporal_blend_small_batch(paths, blend_weight)


def _temporal_blend_small_batch(paths: list[str], blend_weight: float = 0.15) -> list[np.ndarray] | None:
    device = get_torch_device()
    if device is None or len(paths) < 2:
        return None

    import cv2
    import torch

    imgs: list[np.ndarray] = []
    for path in paths:
        img = cv2.imread(path)
        if img is not None:
            imgs.append(img)
    if len(imgs) < 2:
        return None

    t = bgr_batch_to_tensor(imgs, device)
    prev = t[0:1]
    out_tensors = [t[0:1]]
    w = float(blend_weight)
    for i in range(1, t.shape[0]):
        cur = t[i : i + 1]
        blended = cur * (1.0 - w) + prev * w
        out_tensors.append(blended)
        prev = blended
    merged = torch.cat(out_tensors, dim=0)
    return tensor_batch_to_bgr_list(merged)
