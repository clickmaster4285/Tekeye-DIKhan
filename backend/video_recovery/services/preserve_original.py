"""Preserve original upload — read-only copy and SHA-256 hash."""

from __future__ import annotations

import hashlib
import os
import shutil
from typing import Any


def sha256_file(path: str, chunk_size: int = 1024 * 1024) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            chunk = fh.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def preserve_original(src_path: str, preserve_dir: str) -> dict[str, Any]:
    os.makedirs(preserve_dir, exist_ok=True)
    basename = os.path.basename(src_path) or "original.bin"
    dest = os.path.join(preserve_dir, f"preserved_{basename}")
    if os.path.abspath(src_path) != os.path.abspath(dest):
        shutil.copy2(src_path, dest)
    digest = sha256_file(dest)
    return {
        "preserved_path": dest,
        "sha256": digest,
        "size_bytes": os.path.getsize(dest),
        "read_only": True,
    }
