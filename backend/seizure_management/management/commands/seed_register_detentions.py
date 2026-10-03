"""
Seed Peshawar DA register detentions (57 rows).

For each row creates:
  - NoteSheet with status=Approved
  - DetentionMemo linked to that note sheet
  - DetentionAssessment with status=Draft (assessment still to be performed)
  - Goods lines with product / quantity / unit parsed correctly
  - Vehicles stored on memo chassis + notes (NOT as product lines)

Usage:
  python manage.py seed_register_detentions
  python manage.py seed_register_detentions --dry-run
  python manage.py seed_register_detentions --force
  python manage.py seed_register_detentions --include-duplicates
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from detentions.models import DetentionMemo, DetentionMemoGoodsLine
from seizure_management.models import DetentionAssessment, NoteSheet, NoteSheetItem
from seizure_management.notifications import NOTE_SHEET_FORWARD_TO_LABEL

DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "register_detentions_seed.json"

OFFICE = "Model Customs Collectorate, Peshawar"
WAREHOUSE = "Bonded Godown A, Customs House Peshawar"
LOCATION = "PESHAWAR"
APPROVER = "Assistant Collector (Preventive)"

# Units normalised for quantity / unit boxes
_UNIT_MAP = {
    "kg": "Kg",
    "kgs": "Kg",
    "kgs.": "Kg",
    "kg.": "Kg",
    "no": "No.",
    "nos": "No.",
    "no.": "No.",
    "nos.": "No.",
    "pc": "Pcs",
    "pcs": "Pcs",
    "pcs.": "Pcs",
    "piece": "Pcs",
    "pieces": "Pcs",
    "strip": "Strips",
    "strips": "Strips",
    "bottle": "Bottles",
    "bottles": "Bottles",
    "box": "Boxes",
    "boxes": "Boxes",
    "packet": "Packets",
    "packets": "Packets",
    "bundle": "Bundles",
    "bundles": "Bundles",
    "roll": "Rolls",
    "rolls": "Rolls",
    "than": "Thans",
    "thans": "Thans",
    "bag": "Bags",
    "bags": "Bags",
    "ctn": "Ctns",
    "ctns": "Ctns",
    "can": "Cans",
    "cans": "Cans",
    "drum": "Drums",
    "drums": "Drums",
    "pkg": "Pkgs",
    "pkgs": "Pkgs",
    "suit": "Suits",
    "suits": "Suits",
}

_UNIT_ALT = "|".join(
    sorted(
        {
            "Kgs?",
            "Kg",
            "Nos?",
            "No\\.?",
            "Pcs?",
            "Pieces?",
            "Strips?",
            "Bottles?",
            "Boxes?",
            "Packets?",
            "Bundles?",
            "Rolls?",
            "Thans?",
            "Bags?",
            "Ctns?",
            "Cans?",
            "Drums?",
            "Pkgs?",
            "Suits?",
        },
        key=len,
        reverse=True,
    )
)

# Trailing "= 122Kgs" / "= 122 Kgs" / "=01No." / ", 5372 kgs" / "=109 Bags( each 25 kgs)"
_QTY_TAIL_RE = re.compile(
    rf"(?P<head>.+?)\s*(?:=\s*|,)\s*(?P<qty>\d+(?:[.,]\d+)?)\s*(?P<unit>{_UNIT_ALT})"
    rf"(?:\s*\([^)]*\))?\s*\.?\s*$",
    re.IGNORECASE,
)
# Glued without space: "=122Kgs" / "=109Bags"
_QTY_GLUED_RE = re.compile(
    rf"(?P<head>.+?)\s*=\s*(?P<qty>\d+(?:[.,]\d+)?)(?P<unit>{_UNIT_ALT})"
    rf"(?:\s*\([^)]*\))?\s*\.?\s*$",
    re.IGNORECASE,
)
# Packing prefix kept in remarks: "29 bags = 1620 Kgs" / "17Bundles = 1230Kgs" / "185 Ctns = 3680 Kgs"
_PACK_PREFIX_RE = re.compile(
    rf"^(?P<product>.+?)\s+(?P<pack_qty>\d+)\s*(?P<pack_unit>{_UNIT_ALT})\s*=\s*"
    rf"(?P<qty>\d+(?:[.,]\d+)?)\s*(?P<unit>{_UNIT_ALT})\s*\.?\s*$",
    re.IGNORECASE,
)
# Glued pack: "17Bundles = 1230Kgs"
_PACK_GLUED_RE = re.compile(
    rf"^(?P<product>.+?)\s*(?P<pack_qty>\d+)(?P<pack_unit>{_UNIT_ALT})\s*=\s*"
    rf"(?P<qty>\d+(?:[.,]\d+)?)\s*(?P<unit>{_UNIT_ALT})\s*\.?\s*$",
    re.IGNORECASE,
)

_VEHICLE_HINT_RE = re.compile(
    r"(?i)\b("
    r"motorcycle|motor\s*cycle|motor\s*car|chinchi|"
    r"truck|pickup|bedford|hino|mazda|toyota|suzuki\s+mehran|changan|"
    r"chassis\s*no|engine\s*no|reg(?:istration)?\s*no"
    r")\b"
)

_CHASSIS_RE = re.compile(r"(?i)Chassis\s*No\.?\s*([A-Z0-9\-]+)")
_ENGINE_RE = re.compile(r"(?i)Engine\s*No\.?\s*([A-Z0-9\-]+)")
_REG_RE = re.compile(
    r"Reg(?:istration)?\s*No\.?\s*([A-Z0-9\-/]+)|"
    r"\bReg\s+([A-Z]{1,4}-?\d{2,5})\b|"
    r"\b(?:BedFord|Bedford|Mazda|Hino|Toyota|Suzuki|Changan)\s+"
    r"(?:Truck|Pickup|Ju-?\d+|Motor\s*Car)?\s*(?:Reg\s*No\.?\s*)?"
    r"([A-Z]{1,5}-?\d{2,5}|[A-Z]{1,4}-?\d{3,5})",
    re.IGNORECASE,
)


def _safe_key(raw: str) -> str:
    text = re.sub(r"[^A-Za-z0-9]+", "-", (raw or "").strip()).strip("-")
    return (text or "ROW")[:40]


def _dt(date_str: str | None, fallback: str | None = None) -> str:
    """Return 'YYYY-MM-DD HH:MM' from YYYY-MM-DD."""
    src = date_str or fallback
    if not src:
        return timezone.now().strftime("%Y-%m-%d %H:%M")
    try:
        d = datetime.strptime(src[:10], "%Y-%m-%d")
        return d.strftime("%Y-%m-%d 10:00")
    except ValueError:
        return timezone.now().strftime("%Y-%m-%d %H:%M")


def _dept_label(department: str) -> str:
    d = (department or "").strip()
    if d.lower().startswith("apprais"):
        return "Appraisement"
    return "Enforcement"


def _norm_unit(raw: str) -> str:
    key = (raw or "").strip().lower().rstrip(".")
    return _UNIT_MAP.get(key, (raw or "").strip() or "")


def _norm_qty(raw: str) -> str:
    return (raw or "").replace(",", "").strip()


def _split_description_lines(description: str) -> list[str]:
    """Split numbered goods/vehicle lines from a register description."""
    text = (description or "").strip()
    if not text:
        return []
    parts = re.split(r"(?:^|\s)(?:\d+[.)]\s*|\d+\))\s*", text)
    items = [p.strip(" ;,.") for p in parts if p and p.strip(" ;,.")]
    if len(items) <= 1:
        return [text]
    return items


def _is_vehicle_line(text: str) -> bool:
    t = (text or "").strip()
    if not t:
        return False
    if _VEHICLE_HINT_RE.search(t):
        # Pure goods that mention "covering" etc. are not vehicles
        if re.search(r"(?i)\b(fabric|cloth|tea|kernel|tyre|thread|nara|sweater)\b", t) and not re.search(
            r"(?i)\b(motorcycle|motor\s*car|truck|pickup|chassis|engine\s*no|reg\s*no|bedford|hino|mazda|toyota|suzuki|changan|chinchi)\b",
            t,
        ):
            return False
        return True
    # Short conveyance-only lines: "Mazda Ju-7213", "BedFord Truck E-9728"
    if re.search(
        r"(?i)^(mazda|bedford|hino|toyota|suzuki|changan|honda)\b.{0,40}\b[A-Z]{1,5}-?\d{2,5}\b",
        t,
    ):
        return True
    return False


def _vehicle_summary(text: str) -> dict[str, str]:
    """Extract conveyance label + identifiers (not used as product)."""
    chassis_m = _CHASSIS_RE.search(text)
    engine_m = _ENGINE_RE.search(text)
    chassis = chassis_m.group(1) if chassis_m else ""
    engine = engine_m.group(1) if engine_m else ""
    reg = ""
    for m in _REG_RE.finditer(text):
        for g in m.groups():
            if g:
                reg = g.strip(" .,;")
                break
        if reg:
            break

    # Clean label: drop chassis/engine/reg tails and parking notes
    label = text
    label = _CHASSIS_RE.sub("", label)
    label = _ENGINE_RE.sub("", label)
    label = re.sub(r"(?i)Reg(?:istration)?\s*No\.?\s*[A-Za-z0-9\-/]+", "", label)
    label = re.sub(r"(?i)\bReg\s+[A-Z]{1,5}-?\d{2,5}\b", "", label)
    label = re.sub(r"(?i)\bModel[-\s.:]*\w[\w\-]*", "", label)
    label = re.sub(r"(?i)\(Parked[^)]*\)?", "", label)
    label = re.sub(r"(?i)Parked Customs House.*$", "", label)
    label = re.sub(r"[.,;:\s]+$", "", label)
    label = re.sub(r"\s{2,}", " ", label).strip(" ;,.-")
    if not label:
        label = "Conveyance / Vehicle"

    bits = []
    if chassis:
        bits.append(f"Chassis No. {chassis}")
    if engine:
        bits.append(f"Engine No. {engine}")
    if reg and reg.lower() != "nil":
        bits.append(f"Reg No. {reg}")
    return {
        "label": label[:500],
        "chassis": chassis or "",
        "engine": engine or "",
        "reg": "" if (reg or "").lower() == "nil" else (reg or ""),
        "detail": " · ".join(bits),
    }


def _parse_goods_line(line: str) -> dict[str, str] | None:
    """
    Return product / quantity / unit / remarks for a goods line.
    Returns None for vehicle lines (handled separately).
    """
    raw = (line or "").strip(" ;,.")
    if not raw:
        return None
    if _is_vehicle_line(raw):
        return None

    remarks = ""

    m = _PACK_PREFIX_RE.match(raw) or _PACK_GLUED_RE.match(raw)
    if m:
        product = m.group("product").strip(" ;,.=-")
        qty = _norm_qty(m.group("qty"))
        unit = _norm_unit(m.group("unit"))
        pack_qty = _norm_qty(m.group("pack_qty"))
        pack_unit = _norm_unit(m.group("pack_unit"))
        if pack_qty and pack_unit:
            remarks = f"{pack_qty} {pack_unit}"
        return {
            "product": product or raw,
            "quantity": qty,
            "unit": unit,
            "remarks": remarks,
        }

    m = _QTY_TAIL_RE.match(raw) or _QTY_GLUED_RE.match(raw)
    if m:
        product = m.group("head").strip(" ;,.=-")
        remarks = ""
        # Pull packing count off product into remarks: "… 185 Ctns" / "… 17Bundles"
        pack_m = re.search(
            rf"^(?P<prod>.+?)[,\s]+(?P<pack_qty>\d+)\s*(?P<pack_unit>{_UNIT_ALT})\s*$",
            product,
            flags=re.IGNORECASE,
        )
        if pack_m:
            product = pack_m.group("prod").strip(" ;,.=-")
            remarks = f"{_norm_qty(pack_m.group('pack_qty'))} {_norm_unit(pack_m.group('pack_unit'))}"
        else:
            product = re.sub(
                rf"\s+\d+\s*(?:{_UNIT_ALT})\s*$",
                "",
                product,
                flags=re.IGNORECASE,
            ).strip(" ;,.=-")
        return {
            "product": product or raw,
            "quantity": _norm_qty(m.group("qty")),
            "unit": _norm_unit(m.group("unit")),
            "remarks": remarks,
        }

    # Fallback: whole line is product, no qty/unit
    return {"product": raw, "quantity": "", "unit": "", "remarks": ""}


def _parse_register_description(description: str) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    """Split description into goods items and vehicle conveyances."""
    goods: list[dict[str, str]] = []
    vehicles: list[dict[str, str]] = []
    for line in _split_description_lines(description):
        if _is_vehicle_line(line):
            vehicles.append(_vehicle_summary(line))
            continue
        parsed = _parse_goods_line(line)
        if parsed and parsed.get("product"):
            goods.append(parsed)
    if not goods and not vehicles:
        goods.append(
            {
                "product": (description or "Goods as per DA register").strip()[:2000],
                "quantity": "",
                "unit": "",
                "remarks": "",
            }
        )
    return goods, vehicles


class Command(BaseCommand):
    help = "Seed DA register detentions with approved note sheets and draft assessments"

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            default=str(DATA_FILE),
            help="Path to register_detentions_seed.json",
        )
        parser.add_argument("--dry-run", action="store_true", help="Parse only; no DB writes")
        parser.add_argument(
            "--force",
            action="store_true",
            help="Replace existing seeded rows matched by note_sheet_no",
        )
        parser.add_argument(
            "--include-duplicates",
            action="store_true",
            help="Also seed rows marked duplicate_of_sno in the JSON",
        )

    def handle(self, *args, **options):
        path = Path(options["file"])
        if not path.is_file():
            raise CommandError(f"Seed file not found: {path}")

        rows = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(rows, list) or not rows:
            raise CommandError("Seed file must be a non-empty JSON array")

        dry = bool(options["dry_run"])
        force = bool(options["force"])
        include_dupes = bool(options["include_duplicates"])

        created = updated = skipped = assessments = 0
        self.stdout.write(f"Loading {len(rows)} register detentions from {path.name}…")

        with transaction.atomic():
            for row in rows:
                if row.get("duplicate_of_sno") and not include_dupes:
                    skipped += 1
                    continue

                sno = int(row.get("sno") or 0)
                da_no = (row.get("da_no") or "").strip()
                case_no = (row.get("case_no") or "").strip()
                if not da_no and not case_no:
                    skipped += 1
                    continue

                department = _dept_label(row.get("department") or "")
                officer = (row.get("officer_name") or "Seizing Officer").strip()
                station = (row.get("station") or "Peshawar").strip()
                description = (row.get("description") or "").strip()
                da_date = row.get("da_date") or row.get("case_date")
                case_date = row.get("case_date") or da_date
                when = _dt(da_date, case_date)

                goods, vehicles = _parse_register_description(description)

                note_sheet_no = f"NS-REG-{sno:03d}-{_safe_key(da_no)}"
                memo_case = f"DA-{_safe_key(da_no)}"
                memo_ref = f"DET-REG-{sno:03d}"

                existing_ns = NoteSheet.objects.filter(note_sheet_no=note_sheet_no).first()
                if existing_ns and not force:
                    skipped += 1
                    continue

                if dry:
                    # Show a couple of parse samples in dry-run
                    if sno in (1, 15, 29, 31, 38):
                        self.stdout.write(f"\n--- S.No {sno} parse preview ---")
                        for g in goods:
                            self.stdout.write(
                                f"  GOODS  product={g['product']!r}  qty={g['quantity']!r}  unit={g['unit']!r}"
                            )
                        for v in vehicles:
                            self.stdout.write(
                                f"  VEHICLE  {v['label']!r}  {v['detail']!r}"
                            )
                    if existing_ns:
                        updated += 1
                    else:
                        created += 1
                    assessments += 1
                    continue

                if existing_ns and force:
                    memo = existing_ns.detention_memo
                    if memo:
                        DetentionAssessment.objects.filter(detention_memo=memo).delete()
                        DetentionMemoGoodsLine.objects.filter(memo=memo).delete()
                        memo.delete()
                    existing_ns.items.all().delete()
                    existing_ns.delete()
                    updated += 1
                else:
                    created += 1

                # Subject = goods description only (do not prefix DA number)
                subject = (goods[0]["product"] if goods else "DA register seizure")[:200]

                chassis_parts = [v["chassis"] for v in vehicles if v.get("chassis")]
                reg_parts = [v["reg"] for v in vehicles if v.get("reg")]
                engine_parts = [v["engine"] for v in vehicles if v.get("engine")]
                search_chassis = " / ".join(chassis_parts or reg_parts or engine_parts)

                vehicle_notes = ""
                if vehicles:
                    vehicle_notes = "Conveyance: " + "; ".join(
                        f"{v['label']}" + (f" ({v['detail']})" if v["detail"] else "")
                        for v in vehicles
                    )

                brief = (
                    f"Seizure Case No. {case_no} dated {case_date or '—'}. "
                    f"Seizing Officer: {officer} ({station}). Department: {department}. "
                    f"DA No. {da_no}."
                )
                if vehicle_notes:
                    brief = f"{brief} {vehicle_notes}."

                memo = DetentionMemo.objects.create(
                    case_no=memo_case,
                    reference_number=memo_ref,
                    fir_number=f"SC-{case_no}" if case_no else "",
                    date_time_occurrence=when,
                    place_of_occurrence=f"{station}, Peshawar / Torkham corridor",
                    date_time_detention=when,
                    place_of_detention=OFFICE,
                    detention_type="Detention",
                    directorate=f"MCC Peshawar — {department}",
                    reason_for_detention=description[:2000],
                    location_of_detention=LOCATION,
                    where_deposited=WAREHOUSE,
                    search_chassis_number=search_chassis[:500],
                    settlement_status="Pending",
                    verification_status="Verified",
                    disposition_status="In Warehouse",
                    brief_facts=brief[:4000],
                    seizing_officer_notes=f"Seizing Officer: {officer} — {station}",
                    detention_notes=(
                        "Detention memo issued after approved note sheet. "
                        "Detention assessment has to be performed."
                        + (f" {vehicle_notes}." if vehicle_notes else "")
                    )[:4000],
                    purpose_of_detention="Pending valuation / detention assessment",
                    receipt_officer=officer,
                    memo_qr_code_number=f"QR-DET-REG-{sno:03d}",
                    memo_qr_code_payload="",
                    created_by=officer,
                    updated_by=officer,
                )
                memo.memo_qr_code_payload = f"/seizure-management/detention-memo/{memo.pk}"
                memo.save(update_fields=["memo_qr_code_payload", "updated_at"])

                for idx, g in enumerate(goods, start=1):
                    DetentionMemoGoodsLine.objects.create(
                        memo=memo,
                        client_line_id=f"reg-{sno}-{idx}",
                        qr_code_number=f"QR-DET-REG-{sno:03d}-{idx}",
                        description=g["product"][:2000],
                        quantity=g["quantity"],
                        unit=g["unit"],
                        condition="Detained",
                        perishable=False,
                        item_notes=g.get("remarks") or "",
                    )

                approved_at = timezone.now()
                ns = NoteSheet.objects.create(
                    note_sheet_no=note_sheet_no,
                    reference_number=note_sheet_no,
                    status=NoteSheet.STATUS_APPROVED,
                    priority=NoteSheet.PRIORITY_NORMAL,
                    recommendation=NoteSheet.RECOMMENDATION_DETENTION,
                    date_time=when,
                    office=OFFICE,
                    case_no=case_no or memo_case,
                    subject=subject,
                    prepared_by=officer,
                    badge_id=f"REG-{sno:03d}",
                    designation="Seizing Officer",
                    department=department,
                    place_of_inspection=station,
                    warehouse_shop=WAREHOUSE,
                    inspection_date=when,
                    grounds_of_suspicion=(
                        f"Goods detained under DA {da_no} (Case {case_no}) at {station}. "
                        f"Department: {department}."
                    ),
                    evidence_collected=["Photographs", "Physical Examination", "DA Register Entry"],
                    preliminary_findings=description[:4000],
                    content=(
                        f"Note sheet raised from Peshawar DA register entry S.No {sno}. "
                        f"Recommended: Issue Detention Memo. "
                        f"Detention assessment has to be performed."
                        + (f" {vehicle_notes}." if vehicle_notes else "")
                    ),
                    prepared_signature=officer,
                    prepared_date=(da_date or case_date or "")[:10],
                    forward_to=NOTE_SHEET_FORWARD_TO_LABEL,
                    submitted_at=approved_at,
                    approved_by=APPROVER,
                    approved_at=approved_at,
                    approval_remarks=(
                        "Approved. Issue detention memo. Detention assessment has to be performed."
                    ),
                    detention_memo=memo,
                    created_by=officer,
                    updated_by=officer,
                )

                for idx, g in enumerate(goods, start=1):
                    NoteSheetItem.objects.create(
                        note_sheet=ns,
                        client_line_id=f"reg-ns-{sno}-{idx}",
                        qr_code_number=f"QR-NS-REG-{sno:03d}-{idx}",
                        product=g["product"][:2000],
                        quantity=g["quantity"],
                        unit=g["unit"],
                        condition="Detained",
                        perishable=False,
                        remarks=g.get("remarks") or "",
                        sort_order=idx,
                    )

                DetentionAssessment.objects.create(
                    detention_memo=memo,
                    assessment_date=(case_date or da_date or "")[:10],
                    examining_officer=officer,
                    goods_condition="Goods under detention — examination pending",
                    valuation_notes="",
                    findings=(
                        "Detention assessment has to be performed. "
                        "Draft assessment created from DA register seed."
                    ),
                    document_relevance=DetentionAssessment.RELEVANCE_PENDING,
                    status=DetentionAssessment.STATUS_DRAFT,
                    created_by=officer,
                    updated_by=officer,
                )
                assessments += 1

            if dry:
                transaction.set_rollback(True)

        action = "Dry-run" if dry else "Done"
        self.stdout.write(
            self.style.SUCCESS(
                f"{action}: created={created} updated={updated} skipped={skipped} "
                f"assessments={assessments}"
            )
        )
        self.stdout.write(
            "Note sheets: status=Approved · Assessments: status=Draft "
            "(detention assessment has to be performed) · "
            "created_by/updated_by = seizing officer name"
        )
