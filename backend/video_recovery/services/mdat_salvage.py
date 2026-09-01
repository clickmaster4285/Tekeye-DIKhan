"""Salvage video from truncated MP4/MOV files missing moov (mdat AVCC → Annex-B decode)."""

from __future__ import annotations

import os
import re
from typing import Any

from .ffmpeg_utils import run_ffmpeg

_NAL_START = re.compile(b"\x00\x00(?:00\x01|01)")


def _read_file(path: str) -> bytes:
    with open(path, "rb") as fh:
        return fh.read()


def extract_mdat_payload(data: bytes) -> bytes | None:
    """Return mdat box payload; handles truncated files (box extends past EOF)."""
    offset = 0
    file_len = len(data)
    while offset + 8 <= file_len:
        size = int.from_bytes(data[offset : offset + 4], "big")
        box_type = data[offset + 4 : offset + 8]
        header = 8
        if size == 1 and offset + 16 <= file_len:
            size = int.from_bytes(data[offset + 8 : offset + 16], "big")
            header = 16
        if size < header:
            break
        payload_start = offset + header
        if box_type == b"mdat":
            if size == 0 or offset + size > file_len:
                return data[payload_start:file_len]
            return data[payload_start : offset + size]
        if size == 0:
            break
        offset += size
    # Fallback: search for mdat marker when box structure is broken
    idx = data.find(b"mdat")
    if idx >= 8:
        return data[idx + 8 : file_len]
    return None


def find_avcc_offset(payload: bytes) -> int:
    """Locate first valid AVCC length-prefixed NAL run (skips ffmpeg metadata prefix)."""
    limit = min(len(payload), 800000)
    for start in range(0, limit - 8):
        nal_len = int.from_bytes(payload[start : start + 4], "big")
        if nal_len < 4 or nal_len > 2_000_000:
            continue
        if start + 4 + nal_len > len(payload):
            continue
        nal_type = payload[start + 4] & 0x1F
        if nal_type not in (1, 5, 6, 7, 8, 9):
            continue
        nxt = start + 4 + nal_len
        if nxt + 8 > len(payload):
            return start
        nal_len2 = int.from_bytes(payload[nxt : nxt + 4], "big")
        if nal_len2 < 4 or nxt + 4 + nal_len2 > len(payload):
            continue
        nal_type2 = payload[nxt + 4] & 0x1F
        if nal_type2 in (1, 5, 6, 7, 8, 9):
            return start
    return 0


def _looks_like_avcc_nal(data: bytes, pos: int) -> bool:
    if pos + 8 > len(data):
        return False
    nal_len = int.from_bytes(data[pos : pos + 4], "big")
    if nal_len < 4 or nal_len > 2_000_000 or pos + 4 + nal_len > len(data):
        return False
    nal_type = data[pos + 4] & 0x1F
    return nal_type in (1, 5, 6, 7, 8, 9)


def avcc_to_annex_b(payload: bytes) -> bytes:
    """Convert length-prefixed NAL units (MP4 mdat) to Annex-B start codes."""
    start = find_avcc_offset(payload)
    data = payload[start:]
    out = bytearray()
    i = 0
    length = len(data)
    valid_nals = 0
    max_resync_scan = 8192

    while i + 4 < length:
        if not _looks_like_avcc_nal(data, i):
            found = False
            scan_end = min(i + max_resync_scan, length - 8)
            for j in range(i + 1, scan_end):
                if _looks_like_avcc_nal(data, j):
                    i = j
                    found = True
                    break
            if not found:
                break
            continue

        nal_len = int.from_bytes(data[i : i + 4], "big")
        i += 4
        out.extend(b"\x00\x00\x00\x01")
        out.extend(data[i : i + nal_len])
        i += nal_len
        valid_nals += 1

    if valid_nals >= 1:
        return bytes(out)
    return b""


def scan_annex_b(payload: bytes) -> bytes:
    """Keep raw bytes if Annex-B start codes already present in mdat."""
    if _NAL_START.search(payload[:4096]):
        return payload
    return b""


def salvage_mdat_stream(src_path: str, work_dir: str) -> dict[str, Any]:
    """
    Extract decodable H.264 from truncated MP4 when moov/index is missing.
    Re-encodes to a playable MP4.
    """
    os.makedirs(work_dir, exist_ok=True)
    data = _read_file(src_path)
    mdat = extract_mdat_payload(data)
    if not mdat or len(mdat) < 256:
        return {
            "success": False,
            "method": "mdat_salvage",
            "error": "No mdat payload found in file",
        }

    annex_b = avcc_to_annex_b(mdat)
    if not annex_b:
        annex_b = scan_annex_b(mdat)
    nal_count = annex_b.count(b"\x00\x00\x00\x01") if annex_b else 0
    if not annex_b or len(annex_b) < 128:
        return {
            "success": False,
            "method": "mdat_salvage",
            "error": "Could not extract NAL units from mdat (file may be too severely truncated)",
        }

    raw_h264 = os.path.join(work_dir, "salvaged.h264")
    out_mp4 = os.path.join(work_dir, "salvaged.mp4")
    with open(raw_h264, "wb") as fh:
        fh.write(annex_b)

    proc = None
    for attempt, extra in enumerate(
        (
            ["-f", "h264"],
            ["-f", "hevc"],
            [],
        )
    ):
        cmd = [
            "-y",
            "-err_detect",
            "ignore_err",
            *extra,
            "-i",
            raw_h264,
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "22",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            out_mp4,
        ]
        proc = run_ffmpeg(cmd, timeout=600)
        if proc.returncode == 0 and os.path.isfile(out_mp4) and os.path.getsize(out_mp4) > 0:
            return {
                "success": True,
                "method": "mdat_salvage",
                "output_path": out_mp4,
                "header_rebuilt": True,
                "index_rebuilt": True,
                "attempt": attempt + 1,
                "nal_units_extracted": nal_count,
            }

    stderr = (proc.stderr or b"").decode("utf-8", errors="replace")[:400] if proc else ""
    return {
        "success": False,
        "method": "mdat_salvage",
        "error": stderr or "mdat salvage encode failed",
    }
