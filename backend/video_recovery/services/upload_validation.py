"""Upload validation — signature, format, size, basic integrity."""

from __future__ import annotations

import os
from typing import Any

from .forensic_analyzer import detect_file_signature, run_forensic_analysis

ALLOWED_EXTENSIONS = frozenset({".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"})
MIN_BYTES = 512
MAX_BYTES = 2 * 1024 * 1024 * 1024  # 2 GB


def validate_upload(path: str, filename: str = "") -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    if not os.path.isfile(path):
        return {"valid": False, "errors": ["File not found"], "warnings": []}

    size = os.path.getsize(path)
    if size < MIN_BYTES:
        errors.append(f"File too small ({size} bytes)")
    if size > MAX_BYTES:
        errors.append(f"File exceeds maximum size ({size} bytes)")

    ext = os.path.splitext(filename or path)[1].lower()
    if ext and ext not in ALLOWED_EXTENSIONS:
        warnings.append(f"Unusual extension '{ext}' — proceeding with content inspection")

    signature = detect_file_signature(path)
    if signature.get("primary_format") == "unknown":
        errors.append("Unrecognized video file signature")

    forensic = run_forensic_analysis(path)
    corruption = forensic.get("corruption_detection") or {}
    if corruption.get("corruption_detected"):
        warnings.extend(corruption.get("issues") or [])

    return {
        "valid": not errors,
        "errors": errors,
        "warnings": warnings[:8],
        "file_signature": signature,
        "size_bytes": size,
        "format": signature.get("primary_format"),
    }
