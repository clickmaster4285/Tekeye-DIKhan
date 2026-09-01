"""Recovery engine — recover original data (container → stream → frame)."""

from __future__ import annotations

import os
from typing import Any

from .container_recovery import recover_container
from .frame_recovery import recover_frames
from .mdat_salvage import salvage_mdat_stream
from .stream_analysis import analyze_streams


def run_recovery_engine(
    preserved_path: str,
    work_dir: str,
    *,
    container_damaged: bool = True,
) -> dict[str, Any]:
    """Priority 2-5: structure → streams → packets → frames."""
    recovery_dir = os.path.join(work_dir, "recovery_engine")
    os.makedirs(recovery_dir, exist_ok=True)

    levels: dict[str, Any] = {}
    working_path = preserved_path
    container_result: dict[str, Any] = {"success": False}

    if container_damaged:
        container_result = recover_container(preserved_path, os.path.join(recovery_dir, "container"))
        levels["level_1_container"] = container_result
        if container_result.get("success") and container_result.get("output_path"):
            working_path = str(container_result["output_path"])

    stream_report = analyze_streams(working_path, os.path.join(recovery_dir, "stream"))
    levels["level_2_stream"] = {
        "decodable": (stream_report.get("packet_inspection") or {}).get("decodable"),
        "video_streams": len(stream_report.get("video_stream_analysis") or []),
    }

    frame_report = recover_frames(working_path, os.path.join(recovery_dir, "frames"))
    levels["level_3_frames"] = {
        "valid": frame_report.get("valid_frame_count"),
        "bad": frame_report.get("bad_frame_count"),
        "missing": frame_report.get("missing_frame_count"),
    }

    if not frame_report.get("valid_frame_paths"):
        if container_result.get("success"):
            frame_report = recover_frames(working_path, os.path.join(recovery_dir, "frames_retry"))
            levels["level_3_frames_retry"] = frame_report
        if not frame_report.get("valid_frame_paths"):
            salvage = salvage_mdat_stream(preserved_path, os.path.join(recovery_dir, "mdat"))
            levels["level_1_mdat_salvage"] = salvage
            if salvage.get("success") and salvage.get("output_path"):
                working_path = str(salvage["output_path"])
                frame_report = recover_frames(working_path, os.path.join(recovery_dir, "frames_salvage"))
                levels["level_3_frames_salvage"] = frame_report

    return {
        "working_path": working_path,
        "container_result": container_result,
        "stream_report": stream_report,
        "frame_report": frame_report,
        "levels": levels,
        "recovered_any": bool(frame_report.get("valid_frame_paths") or container_result.get("success")),
    }
