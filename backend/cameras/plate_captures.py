"""Read ANPR plate captures saved by ml_services under media/licence plates/.

Dedupes by plate number (keeps best OCR/det row), deletes duplicate image files,
and supports pagination for the Vehicle Tracking UI.
"""

from __future__ import annotations

import csv
import logging
import os
import re
import threading
from datetime import datetime
from pathlib import Path
from typing import Any

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)
_cleanup_lock = threading.Lock()

CSV_FIELDS = [
    "timestamp",
    "camera_key",
    "plate_number",
    "det_conf",
    "ocr_conf",
    "plate_image",
    "frame_image",
]


def plate_media_root() -> Path:
    return Path(settings.MEDIA_ROOT) / "licence plates"


def captures_csv_path() -> Path:
    return plate_media_root() / "captures.csv"


def _media_url(rel: str) -> str:
    rel = (rel or "").strip().replace("\\", "/")
    if not rel:
        return ""
    if rel.startswith("/media/"):
        return rel
    if rel.startswith("media/"):
        return f"/{rel}"
    return f"/media/{rel.lstrip('/')}"


def _rel_from_url(url: str) -> str:
    """media-relative path suitable for joining under MEDIA_ROOT."""
    path = (url or "").strip().replace("\\", "/")
    if path.startswith("/media/"):
        path = path[len("/media/") :]
    elif path.startswith("media/"):
        path = path[len("media/") :]
    return path.lstrip("/")


def _abs_media(rel_or_url: str) -> Path | None:
    rel = _rel_from_url(rel_or_url)
    if not rel:
        return None
    return Path(settings.MEDIA_ROOT) / rel


def _parse_ts(value: str) -> datetime | None:
    raw = (value or "").strip()
    if not raw:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


# City/region text often OCR'd from the line under the plate number.
_REGION_NOISE = (
    "ISLAMABAD",
    "ISLAMABA",
    "ISLAMAB",
    "ICT",
    "ISB",
    "PUNJAB",
    "SINDH",
    "KARACHI",
    "LAHORE",
    "PESHAWAR",
    "BALOCH",
    "PAKISTAN",
    "PAK",
    "CITY",
)

_OSD_DATE_TOKENS = frozenset(
    {
        "MON",
        "TUE",
        "WED",
        "THU",
        "FRI",
        "SAT",
        "SUN",
        "JAN",
        "FEB",
        "MAR",
        "APR",
        "MAY",
        "JUN",
        "JUL",
        "AUG",
        "SEP",
        "OCT",
        "NOV",
        "DEC",
    }
)
_DATETIME_OCR_RE = re.compile(
    r"("
    r"\b(20\d{2}|19\d{2})\b|"
    r"\b\d{1,2}[:.]\d{2}([:.]\d{2})?\b|"
    r"\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|"
    r"\b(MON|TUE|WED|THU|FRI|SAT|SUN|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b"
    r")",
    re.IGNORECASE,
)

# Match ML plate floors so Vehicle Tracking UI does not re-accept weak OSD/box reads
def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


_MIN_OCR_CONF_ACCEPTED = _env_float(
    "ML_PLATE_RECO_CONF",
    _env_float("ML_PLATE_MIN_OCR_CONF", 0.45),
)
_MIN_DET_CONF_ACCEPTED = _env_float("ML_PLATE_MIN_DET_CONF", 0.45)
FUZZY_MATCH_MIN_OCR = 0.50
JOURNEY_MIN_OCR_CONF = 0.50


def _plate_key(text: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (text or "").upper())


def _strip_region_noise(key: str) -> str:
    out = key
    for token in _REGION_NOISE:
        out = out.replace(token, "")
    return out


def _split_alpha_digits(key: str) -> tuple[str, str]:
    m = re.match(r"^([A-Z]*)(\d*)([A-Z0-9]*)$", key)
    if not m:
        letters = re.sub(r"\d", "", key)
        digits = re.sub(r"\D", "", key)
        return letters, digits
    letters, digits, rest = m.group(1), m.group(2), m.group(3)
    if rest:
        # Prefer leading letters + first digit run (drop trailing OCR junk)
        return letters, digits
    return letters, digits


def _looks_like_datetime_ocr(text: str) -> bool:
    raw = str(text or "").strip()
    if not raw:
        return False
    if _DATETIME_OCR_RE.search(raw):
        return True
    key = _plate_key(raw)
    if not key:
        return False
    for token in _OSD_DATE_TOKENS:
        if key.startswith(token) and re.search(r"\d", key[len(token) :]):
            return True
    if key.isdigit() and len(key) >= 6:
        return True
    return False


def canonicalize_plate(text: str) -> str:
    """
    Pull a Pakistan-style plate (e.g. BSD987) out of noisy OCR that often
    appends city text: BSD987ICLILWAAP → BSD987.
    """
    key = _strip_region_noise(_plate_key(text))
    if not key:
        return ""

    candidates: list[str] = []
    candidates.extend(re.findall(r"[A-Z]{2,3}\d{3}", key))
    candidates.extend(re.findall(r"[A-Z]{2,3}\d{4}", key))
    # Also allow 1–4 letters if embedded mid-string after noise strip
    if not candidates:
        m = re.search(r"([A-Z]{2,4})(\d{3,4})", key)
        if m:
            candidates.append(m.group(1) + m.group(2))

    if candidates:
        def rank(c: str) -> tuple[int, int, int]:
            letters, digits = _split_alpha_digits(c)
            # Prefer classic 3-letter + 3-digit (Islamabad private)
            style = 0 if len(letters) == 3 and len(digits) == 3 else 1
            return (style, 0 if len(digits) == 3 else 1, len(c))

        return sorted(set(candidates), key=rank)[0]

    letters, digits = _split_alpha_digits(key)
    if len(letters) >= 2 and len(digits) >= 3:
        return f"{letters[:3]}{digits[:4]}"
    return ""


def format_plate_display(text: str) -> str:
    canon = canonicalize_plate(text) or _plate_key(text)
    letters, digits = _split_alpha_digits(canon)
    if letters and digits:
        return f"{letters} {digits}"
    return (text or "").strip().upper()


def _edit_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    if abs(len(a) - len(b)) > 2:
        return 99
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def _digits_close(da: str, db: str) -> bool:
    if not da or not db:
        return False
    if da == db:
        return True
    # 987 vs 9876 / 9871 — same stem, one extra OCR digit
    if abs(len(da) - len(db)) == 1 and (da in db or db in da):
        return True
    if len(da) == len(db) and _edit_distance(da, db) <= 1:
        return True
    return False


def _letters_close(la: str, lb: str) -> bool:
    if not la or not lb:
        return False
    if la == lb:
        return True
    # SD vs BSD / DSD — suffix/prefix slip
    if la.endswith(lb) or lb.endswith(la) or la.startswith(lb) or lb.startswith(la):
        if min(len(la), len(lb)) >= 2:
            return True
    return _edit_distance(la, lb) <= 1


def plates_are_same_vehicle(
    a: str,
    b: str,
    conf_a: float = 1.0,
    conf_b: float = 1.0,
) -> bool:
    """True when OCR variants likely refer to the same physical plate."""
    ca = canonicalize_plate(a) or _plate_key(a)
    cb = canonicalize_plate(b) or _plate_key(b)
    if not ca or not cb:
        return False
    if ca == cb:
        return True
    try:
        if float(conf_a) < FUZZY_MATCH_MIN_OCR or float(conf_b) < FUZZY_MATCH_MIN_OCR:
            return False
    except (TypeError, ValueError):
        return False
    la, da = _split_alpha_digits(ca)
    lb, db = _split_alpha_digits(cb)
    return _digits_close(da, db) and _letters_close(la, lb)


def _is_unknown_plate(text: str) -> bool:
    return _plate_key(text) in {"UNKNOWN", "PLATE"}


def _is_valid_plate(text: str, *, min_len: int = 5) -> bool:
    if _looks_like_datetime_ocr(text):
        return False
    canon = canonicalize_plate(text)
    key = canon or _plate_key(text)
    if len(key) < min_len:
        return False
    if key in {"UNKNOWN", "PLATE", "LICENSEPLATE"}:
        return False
    if not re.search(r"[A-Z]", key):
        return False
    if not re.search(r"\d", key):
        return False
    # Require a recognizable letter+digit plate shape after cleanup
    if not canon:
        return False
    letters, digits = _split_alpha_digits(canon)
    if len(letters) < 2 or len(digits) < 3:
        return False
    if letters in _OSD_DATE_TOKENS:
        return False
    return True


def _row_score(row: dict[str, Any]) -> tuple[float, float, int, str]:
    """Prefer clean canonical plates, then higher OCR×det confidence."""
    plate = str(row.get("plate_number") or "")
    canon = canonicalize_plate(plate)
    letters, digits = _split_alpha_digits(canon)
    # Bonus for classic XXX 999 shape
    shape_bonus = 1.0 if len(letters) == 3 and len(digits) == 3 else 0.0
    # Prefer shorter OCR (less city-junk appended)
    brevity = max(0, 12 - len(_plate_key(plate)))
    try:
        det = float(row.get("det_conf") or 0)
    except (TypeError, ValueError):
        det = 0.0
    try:
        ocr = float(row.get("ocr_conf") or 0)
    except (TypeError, ValueError):
        ocr = 0.0
    quality = ocr * det + ocr * 0.5 + det * 0.25 + shape_bonus + brevity * 0.02
    return (quality, ocr, brevity, str(row.get("timestamp") or ""))


def _delete_file(rel_or_url: str) -> bool:
    path = _abs_media(rel_or_url)
    if path is None or not path.is_file():
        return False
    try:
        path.unlink()
        return True
    except OSError as exc:
        logger.warning("Could not delete plate media %s: %s", path, exc)
        return False


def _read_raw_rows(*, camera_key: str = "") -> list[dict[str, Any]]:
    path = captures_csv_path()
    if not path.is_file():
        return []

    rows: list[dict[str, Any]] = []
    key_filter = (camera_key or "").strip().lower()
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            cam = str(row.get("camera_key") or "").strip()
            if key_filter and cam.lower() != key_filter and f"cam-{key_filter}" != cam.lower():
                continue
            plate = str(row.get("plate_number") or "").strip()
            plate_image = str(row.get("plate_image") or "").strip()
            frame_image = str(row.get("frame_image") or "").strip()
            ts = _parse_ts(str(row.get("timestamp") or ""))
            try:
                det_conf = float(row.get("det_conf") or 0)
            except (TypeError, ValueError):
                det_conf = 0.0
            try:
                ocr_conf = float(row.get("ocr_conf") or 0)
            except (TypeError, ValueError):
                ocr_conf = 0.0
            rows.append(
                {
                    "timestamp": ts.isoformat(timespec="seconds") if ts else str(row.get("timestamp") or ""),
                    "camera_key": cam,
                    "plate_number": plate,
                    "det_conf": round(det_conf, 4),
                    "ocr_conf": round(ocr_conf, 4),
                    "plate_image_rel": plate_image,
                    "frame_image_rel": frame_image,
                    "plate_image": _media_url(plate_image),
                    "frame_image": _media_url(frame_image),
                    "accepted": _is_valid_plate(plate)
                    and ocr_conf >= _MIN_OCR_CONF_ACCEPTED
                    and det_conf >= _MIN_DET_CONF_ACCEPTED,
                }
            )
    return rows


def _write_csv(rows: list[dict[str, Any]]) -> None:
    path = captures_csv_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "timestamp": row.get("timestamp") or "",
                    "camera_key": row.get("camera_key") or "",
                    "plate_number": row.get("plate_number") or "",
                    "det_conf": row.get("det_conf") or 0,
                    "ocr_conf": row.get("ocr_conf") or 0,
                    "plate_image": row.get("plate_image_rel")
                    or _rel_from_url(str(row.get("plate_image") or "")),
                    "frame_image": row.get("frame_image_rel")
                    or _rel_from_url(str(row.get("frame_image") or "")),
                }
            )


def dedupe_plate_captures(*, camera_key: str = "", persist: bool = True) -> dict[str, Any]:
    """
    Keep one best row per physical plate (fuzzy OCR variants merged).
    UNKNOWN crops are kept as separate rows. Invalid OCR junk is dropped.
    """
    with _cleanup_lock:
        raw = _read_raw_rows(camera_key=camera_key)
        candidates: list[dict[str, Any]] = []
        discarded: list[dict[str, Any]] = []

        for row in raw:
            plate = str(row.get("plate_number") or "").strip()
            if _is_unknown_plate(plate):
                candidates.append({**row, "accepted": False, "_canon": ""})
                continue
            if not _is_valid_plate(plate):
                discarded.append(row)
                continue
            if not row.get("accepted"):
                discarded.append(row)
                continue
            canon = canonicalize_plate(plate)
            display = format_plate_display(canon or plate)
            enriched = {
                **row,
                "plate_number": display,
                "accepted": True,
                "_canon": canon,
            }
            candidates.append(enriched)

        # Best-first greedy clustering: merge similar OCR on same camera
        candidates.sort(key=_row_score, reverse=True)
        clusters: list[dict[str, Any]] = []
        for row in candidates:
            matched = False
            row_unknown = _is_unknown_plate(str(row.get("plate_number") or ""))
            for kept in clusters:
                if row_unknown or _is_unknown_plate(str(kept.get("plate_number") or "")):
                    continue
                same_cam = str(row.get("camera_key") or "").lower() == str(
                    kept.get("camera_key") or ""
                ).lower()
                if same_cam and plates_are_same_vehicle(
                    str(row.get("plate_number") or ""),
                    str(kept.get("plate_number") or ""),
                ):
                    discarded.append(row)
                    matched = True
                    break
            if not matched:
                clusters.append(row)

        kept = sorted(
            clusters,
            key=lambda r: str(r.get("timestamp") or ""),
            reverse=True,
        )
        for row in kept:
            row.pop("_canon", None)

        deleted_files = 0
        root = plate_media_root()

        # File deletes + CSV rewrite only on full persist (never when camera-filtered)
        if persist and camera_key == "":
            keep_files: set[str] = set()
            for row in kept:
                for field in ("plate_image_rel", "frame_image_rel"):
                    rel = _rel_from_url(str(row.get(field) or ""))
                    if rel:
                        keep_files.add(rel.replace("\\", "/").lower())

            for row in discarded:
                for field in ("plate_image_rel", "frame_image_rel", "plate_image", "frame_image"):
                    rel = _rel_from_url(str(row.get(field) or ""))
                    if not rel:
                        continue
                    if rel.replace("\\", "/").lower() in keep_files:
                        continue
                    if _delete_file(rel):
                        deleted_files += 1

            for sub in ("plates", "frames"):
                folder = root / sub
                if not folder.is_dir():
                    continue
                for file in folder.iterdir():
                    if not file.is_file() or file.name == ".gitkeep":
                        continue
                    rel = f"licence plates/{sub}/{file.name}".replace("\\", "/")
                    if rel.lower() not in keep_files:
                        try:
                            file.unlink()
                            deleted_files += 1
                        except OSError:
                            pass

            _write_csv(kept)
            numbers_path = root / "numbers.txt"
            try:
                lines = [
                    f"{r.get('timestamp')}  [{r.get('camera_key')}]  {r.get('plate_number')}"
                    for r in kept
                ]
                numbers_path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
            except OSError as exc:
                logger.warning("Could not rewrite numbers.txt: %s", exc)

        return {
            "kept": len(kept),
            "removed_rows": len(discarded),
            "deleted_files": deleted_files,
            "results": kept,
        }


def _parse_filter_bound(value: str, *, end_of_day: bool = False) -> datetime | None:
    """Parse date (YYYY-MM-DD) or datetime filter bounds from query params."""
    raw = (value or "").strip()
    if not raw:
        return None
    # datetime-local / ISO with T
    normalized = raw.replace("Z", "+00:00")
    if "T" in normalized or " " in normalized:
        dt = _parse_ts(normalized.replace(" ", "T", 1) if " " in normalized and "T" not in normalized else normalized)
        if dt:
            return dt
    try:
        day = datetime.strptime(raw[:10], "%Y-%m-%d")
    except ValueError:
        return _parse_ts(raw)
    if end_of_day:
        return day.replace(hour=23, minute=59, second=59)
    return day.replace(hour=0, minute=0, second=0)


def load_plate_captures(
    *,
    page: int = 1,
    page_size: int = 25,
    camera_key: str = "",
    q: str = "",
    plate_number: str = "",
    date_from: str = "",
    date_to: str = "",
    cleanup: bool = True,
) -> dict[str, Any]:
    """Return unique/valid plate captures with pagination.

    Filters:
      - camera_key: exact / cam-<id> match
      - plate_number: substring match on display or canonical plate
      - q: substring match on plate or camera_key
      - date_from / date_to: inclusive datetime bounds
    """
    if cleanup:
        dedupe = dedupe_plate_captures(camera_key="", persist=True)
        rows = dedupe["results"]
        cleanup_meta = {
            "removed_rows": dedupe["removed_rows"],
            "deleted_files": dedupe["deleted_files"],
        }
    else:
        # Soft dedupe in memory only
        dedupe = dedupe_plate_captures(camera_key=camera_key, persist=False)
        rows = dedupe["results"]
        cleanup_meta = {
            "removed_rows": dedupe["removed_rows"],
            "deleted_files": 0,
        }

    if camera_key:
        key_filter = camera_key.strip().lower()
        rows = [
            r
            for r in rows
            if str(r.get("camera_key") or "").lower() == key_filter
            or str(r.get("camera_key") or "").lower() == f"cam-{key_filter}"
        ]

    plate_term = (plate_number or "").strip().lower()
    if plate_term:
        plate_compact = _plate_key(plate_term)
        rows = [
            r
            for r in rows
            if plate_term in str(r.get("plate_number") or "").lower()
            or (
                plate_compact
                and plate_compact in _plate_key(str(r.get("plate_number") or "")).lower()
            )
        ]

    term = (q or "").strip().lower()
    if term:
        rows = [
            r
            for r in rows
            if term in str(r.get("plate_number") or "").lower()
            or term in str(r.get("camera_key") or "").lower()
            or term in _plate_key(str(r.get("plate_number") or "")).lower()
        ]

    from_dt = _parse_filter_bound(date_from, end_of_day=False)
    to_dt = _parse_filter_bound(date_to, end_of_day=True)
    if from_dt or to_dt:
        filtered: list[dict[str, Any]] = []
        for row in rows:
            ts = _parse_ts(str(row.get("timestamp") or ""))
            if ts is None:
                continue
            # Compare naive timestamps consistently
            cmp = ts.replace(tzinfo=None) if ts.tzinfo else ts
            if from_dt and cmp < from_dt:
                continue
            if to_dt and cmp > to_dt:
                continue
            filtered.append(row)
        rows = filtered

    total = len(rows)
    page_size = max(5, min(int(page_size or 25), 100))
    total_pages = max(1, (total + page_size - 1) // page_size)
    page = max(1, min(int(page or 1), total_pages))
    start = (page - 1) * page_size
    page_rows = rows[start : start + page_size]

    # Public payload without internal rel fields
    results = []
    for row in page_rows:
        results.append(
            {
                "timestamp": row.get("timestamp") or "",
                "camera_key": row.get("camera_key") or "",
                "plate_number": row.get("plate_number") or "",
                "det_conf": row.get("det_conf") or 0,
                "ocr_conf": row.get("ocr_conf") or 0,
                "plate_image": row.get("plate_image") or _media_url(str(row.get("plate_image_rel") or "")),
                "frame_image": row.get("frame_image") or _media_url(str(row.get("frame_image_rel") or "")),
                "accepted": bool(row.get("accepted")),
            }
        )

    return {
        "count": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "cleanup": cleanup_meta,
        "results": results,
    }


def plate_capture_summary() -> dict[str, Any]:
    from cameras.models import Camera, CameraPurpose

    today = timezone.localdate()
    # Use deduped unique plates (no file rewrite here — list endpoint handles cleanup)
    dedupe = dedupe_plate_captures(persist=False)
    all_rows = dedupe["results"]
    today_rows = []
    for row in all_rows:
        ts = _parse_ts(str(row.get("timestamp") or ""))
        if ts and ts.date() == today:
            today_rows.append(row)

    accepted_today = [r for r in today_rows if r.get("accepted")]
    unique_plates = {
        canonicalize_plate(str(r.get("plate_number") or "")) or _plate_key(str(r.get("plate_number") or ""))
        for r in accepted_today
    }
    unique_plates.discard("")
    cameras_active = sum(
        1
        for cam in Camera.objects.filter(is_active=True).only("purpose", "purposes")
        if cam.has_purpose(CameraPurpose.ANPR)
    )

    match_rate = 100.0 if today_rows else 0.0
    # After dedupe, all kept rows are valid; rate vs raw would need raw count —
    # expose unique accepted as the primary metric.
    return {
        "anpr_cameras": cameras_active,
        "reads_today": len(today_rows),
        "accepted_today": len(accepted_today),
        "unique_plates_today": len(unique_plates),
        "match_rate": match_rate,
        "total_captures": len(all_rows),
    }


# Same journey pass until the plate has been gone this long (matches ML visit window).
_PASS_GAP_SECONDS = 600


def _camera_meta_map() -> dict[str, dict[str, str]]:
    """Map cam-<id> / numeric id → display name, location, zone."""
    try:
        from cameras.models import Camera
    except Exception:
        return {}

    out: dict[str, dict[str, str]] = {}
    try:
        qs = Camera.objects.select_related("nvr", "nvr__site").all()
        for cam in qs:
            site = ""
            if cam.nvr_id and getattr(cam.nvr, "site", None):
                site = cam.nvr.site.name or cam.nvr.site.code or ""
            info = {
                "camera_name": cam.name or cam.code or cam.stream_key,
                "camera_code": cam.code or "",
                "location": cam.location or site,
                "zone": cam.zone or "",
            }
            out[cam.stream_key.lower()] = info
            out[str(cam.pk)] = info
    except Exception:
        logger.debug("Camera lookup failed for vehicle journeys", exc_info=True)
    return out


def _camera_info_for(camera_key: str, meta: dict[str, dict[str, str]]) -> dict[str, str]:
    key = (camera_key or "").strip()
    info = meta.get(key.lower()) or {}
    if not info and key.lower().startswith("cam-"):
        info = meta.get(key.lower()[4:]) or {}
    return {
        "camera_name": info.get("camera_name") or key or "Unknown camera",
        "camera_code": info.get("camera_code") or "",
        "location": info.get("location") or "",
        "zone": info.get("zone") or "",
    }


def _filter_rows_by_date(rows: list[dict[str, Any]], date_from: str, date_to: str) -> list[dict[str, Any]]:
    from_dt = _parse_filter_bound(date_from, end_of_day=False)
    to_dt = _parse_filter_bound(date_to, end_of_day=True)
    if not from_dt and not to_dt:
        return rows
    filtered: list[dict[str, Any]] = []
    for row in rows:
        ts = _parse_ts(str(row.get("timestamp") or ""))
        if ts is None:
            continue
        cmp = ts.replace(tzinfo=None) if ts.tzinfo else ts
        if from_dt and cmp < from_dt:
            continue
        if to_dt and cmp > to_dt:
            continue
        filtered.append(row)
    return filtered


def _accepted_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in rows:
        plate = str(row.get("plate_number") or "").strip()
        if not _is_valid_plate(plate):
            continue
        if not row.get("accepted"):
            continue
        out.append(row)
    return out


def _journey_identity_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Rows trusted enough to identify a vehicle. Low-OCR stays in captures, not journeys."""
    out: list[dict[str, Any]] = []
    for row in _accepted_rows(rows):
        try:
            ocr = float(row.get("ocr_conf") or 0)
        except (TypeError, ValueError):
            ocr = 0.0
        if ocr < JOURNEY_MIN_OCR_CONF:
            continue
        out.append(row)
    return out


def _bucket_best_ocr(rows: list[dict[str, Any]]) -> float:
    best = 0.0
    for row in rows:
        try:
            best = max(best, float(row.get("ocr_conf") or 0))
        except (TypeError, ValueError):
            continue
    return best


def _cluster_rows_by_plate(rows: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    """Keep every sighting; merge only high-confidence OCR slips of the same plate."""
    buckets: dict[str, list[dict[str, Any]]] = {}
    order: list[str] = []
    for row in rows:
        plate = str(row.get("plate_number") or "").strip()
        key = canonicalize_plate(plate) or _plate_key(plate)
        if not key:
            continue
        if key not in buckets:
            buckets[key] = []
            order.append(key)
        buckets[key].append(row)

    keys_sorted = sorted(
        order,
        key=lambda k: _row_score(max(buckets[k], key=_row_score)),
        reverse=True,
    )
    used: set[str] = set()
    clusters: list[list[dict[str, Any]]] = []
    for key in keys_sorted:
        if key in used:
            continue
        group_keys = [key]
        used.add(key)
        conf_key = _bucket_best_ocr(buckets[key])
        for other in keys_sorted:
            if other in used:
                continue
            if plates_are_same_vehicle(key, other, conf_key, _bucket_best_ocr(buckets[other])):
                group_keys.append(other)
                used.add(other)
        cluster: list[dict[str, Any]] = []
        for gk in group_keys:
            cluster.extend(buckets[gk])
        clusters.append(cluster)
    return clusters


def _count_passes(sightings: list[dict[str, Any]]) -> int:
    """Count return visits, not camera hops or OCR flicker."""
    if not sightings:
        return 0
    passes = 1
    prev_ts = _parse_ts(str(sightings[0].get("timestamp") or ""))
    for row in sightings[1:]:
        ts = _parse_ts(str(row.get("timestamp") or ""))
        gap = 0.0
        if ts and prev_ts:
            a = ts.replace(tzinfo=None) if ts.tzinfo else ts
            b = prev_ts.replace(tzinfo=None) if prev_ts.tzinfo else prev_ts
            gap = abs((a - b).total_seconds())
        if gap > _PASS_GAP_SECONDS:
            passes += 1
        prev_ts = ts or prev_ts
    return passes


def _journey_from_cluster(cluster: list[dict[str, Any]], camera_meta: dict[str, dict[str, str]]) -> dict[str, Any]:
    best = max(cluster, key=_row_score)
    raw_plate = str(best.get("plate_number") or "")
    plate_key = canonicalize_plate(raw_plate) or _plate_key(raw_plate)
    plate_display = format_plate_display(raw_plate)

    sightings = sorted(cluster, key=lambda r: str(r.get("timestamp") or ""))
    path: list[dict[str, Any]] = []
    for i, row in enumerate(sightings, start=1):
        cam_key = str(row.get("camera_key") or "")
        info = _camera_info_for(cam_key, camera_meta)
        path.append(
            {
                "index": i,
                "timestamp": row.get("timestamp") or "",
                "camera_key": cam_key,
                "camera_name": info["camera_name"],
                "camera_code": info["camera_code"],
                "location": info["location"],
                "zone": info["zone"],
                "plate_number": format_plate_display(str(row.get("plate_number") or "")),
                "det_conf": row.get("det_conf") or 0,
                "ocr_conf": row.get("ocr_conf") or 0,
                "plate_image": row.get("plate_image") or _media_url(str(row.get("plate_image_rel") or "")),
                "frame_image": row.get("frame_image") or _media_url(str(row.get("frame_image_rel") or "")),
            }
        )

    cameras: list[dict[str, str]] = []
    seen_cams: set[str] = set()
    hops: list[str] = []
    for stop in path:
        name = stop["camera_name"] or stop["camera_key"]
        if not hops or hops[-1] != name:
            hops.append(name)
        ck = str(stop["camera_key"]).lower()
        if ck and ck not in seen_cams:
            seen_cams.add(ck)
            cameras.append(
                {
                    "camera_key": stop["camera_key"],
                    "camera_name": stop["camera_name"],
                    "location": stop["location"],
                    "zone": stop["zone"],
                }
            )

    variants = sorted({s["plate_number"] for s in path if s.get("plate_number")})
    first = path[0] if path else {}
    last = path[-1] if path else {}
    return {
        "plate_key": plate_key,
        "plate_number": plate_display,
        "ocr_variants": variants,
        "sighting_count": len(path),
        "pass_count": _count_passes(path),
        "camera_count": len(cameras),
        "cameras": cameras,
        "route": hops,
        "first_seen": first.get("timestamp") or "",
        "last_seen": last.get("timestamp") or "",
        "first_camera": first.get("camera_name") or first.get("camera_key") or "",
        "last_camera": last.get("camera_name") or last.get("camera_key") or "",
        "plate_image": last.get("plate_image") or first.get("plate_image") or "",
        "frame_image": last.get("frame_image") or first.get("frame_image") or "",
        "path": path,
    }


def _journey_matches_query(journey: dict[str, Any], term: str) -> bool:
    q = (term or "").strip().lower()
    if not q:
        return True
    compact = _plate_key(q)
    if q in str(journey.get("plate_number") or "").lower():
        return True
    if compact and compact in str(journey.get("plate_key") or "").lower():
        return True
    for variant in journey.get("ocr_variants") or []:
        if q in str(variant).lower() or (compact and compact in _plate_key(str(variant)).lower()):
            return True
    for cam in journey.get("cameras") or []:
        blob = " ".join(
            str(cam.get(k) or "") for k in ("camera_name", "camera_key", "location", "zone")
        ).lower()
        if q in blob:
            return True
    return False


def load_vehicle_journeys(
    *,
    page: int = 1,
    page_size: int = 25,
    q: str = "",
    min_passes: int = 2,
    date_from: str = "",
    date_to: str = "",
    include_path: bool = False,
) -> dict[str, Any]:
    """Group raw ANPR rows into a per-vehicle timeline (no CSV rewrite)."""
    raw = _filter_rows_by_date(_journey_identity_rows(_read_raw_rows()), date_from, date_to)
    camera_meta = _camera_meta_map()
    journeys = [_journey_from_cluster(c, camera_meta) for c in _cluster_rows_by_plate(raw)]

    summary = {
        "total_vehicles": len(journeys),
        "repeat_vehicles": sum(1 for j in journeys if int(j.get("pass_count") or 0) >= 2),
        "multi_camera": sum(1 for j in journeys if int(j.get("camera_count") or 0) >= 2),
        "total_sightings": sum(int(j.get("sighting_count") or 0) for j in journeys),
    }

    try:
        min_passes_n = max(1, int(min_passes or 1))
    except (TypeError, ValueError):
        min_passes_n = 2
    journeys = [j for j in journeys if int(j.get("pass_count") or 0) >= min_passes_n]
    journeys = [j for j in journeys if _journey_matches_query(j, q)]
    journeys.sort(
        key=lambda j: (int(j.get("pass_count") or 0), str(j.get("last_seen") or "")),
        reverse=True,
    )

    total = len(journeys)
    page_size = max(5, min(int(page_size or 25), 100))
    total_pages = max(1, (total + page_size - 1) // page_size)
    page = max(1, min(int(page or 1), total_pages))
    start = (page - 1) * page_size
    page_rows = journeys[start : start + page_size]

    results: list[dict[str, Any]] = []
    for journey in page_rows:
        item = dict(journey)
        if not include_path:
            item.pop("path", None)
        results.append(item)

    return {
        "count": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "min_passes": min_passes_n,
        "summary": summary,
        "results": results,
    }


def load_vehicle_journey(plate_key: str) -> dict[str, Any] | None:
    """Full timeline for one plate (OCR variants included)."""
    needle = canonicalize_plate(plate_key) or _plate_key(plate_key)
    if not needle:
        return None
    raw = _journey_identity_rows(_read_raw_rows())
    camera_meta = _camera_meta_map()
    for cluster in _cluster_rows_by_plate(raw):
        journey = _journey_from_cluster(cluster, camera_meta)
        if journey["plate_key"] == needle:
            return journey
        if plates_are_same_vehicle(needle, journey["plate_key"]):
            return journey
        if any(plates_are_same_vehicle(needle, str(v)) for v in journey.get("ocr_variants") or []):
            return journey
    return None
