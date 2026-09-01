"""Hybrid merger — combine original, recovered, and generated segments."""

from __future__ import annotations

import os
import shutil
from typing import Any


def merge_hybrid_timeline(
    entries: list[dict[str, Any]],
    work_dir: str,
) -> dict[str, Any]:
    """Priority 9: merge timeline with source labels."""
    merge_dir = os.path.join(work_dir, "hybrid_merged")
    if os.path.isdir(merge_dir):
        shutil.rmtree(merge_dir, ignore_errors=True)
    os.makedirs(merge_dir, exist_ok=True)

    ordered = sorted(entries, key=lambda e: e.get("index", 0))
    paths: list[str] = []
    breakdown = {"original": 0, "recovered": 0, "generated": 0}

    for out_idx, entry in enumerate(ordered):
        src_path = entry.get("path")
        if not src_path or not os.path.isfile(str(src_path)):
            continue
        dest = os.path.join(merge_dir, f"frame_{out_idx:06d}.jpg")
        shutil.copy2(str(src_path), dest)
        paths.append(dest)
        source = entry.get("source", "original")
        if source in breakdown:
            breakdown[source] += 1

    return {
        "merged_paths": paths,
        "frame_count": len(paths),
        "breakdown": breakdown,
        "merge_dir": merge_dir,
        "principle": "recover_what_is_real_plus_regenerate_what_is_lost",
    }
