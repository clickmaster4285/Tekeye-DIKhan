"""Seed 3 fully populated note sheets (draft, submitted, approved)."""

from datetime import timedelta
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from seizure_management.models import NoteSheet, NoteSheetItem
from seizure_management.notifications import NOTE_SHEET_FORWARD_TO_LABEL

SITE_PROFILES = {
    "dikhan": {
        "office": "Model Customs Collectorate, Dera Ismail Khan",
        "place": "AFU Import Examination Shed, MCC D.I Khan",
        "warehouse": "Bonded Godown-I, Customs House D.I Khan",
        "gps": "31.8314, 70.9017",
        "collectorate": "MCC D.I Khan",
        "code": "DIK",
    },
    "peshawar": {
        "office": "Model Customs Collectorate, Peshawar",
        "place": "Torkham / Customs House Examination Area, Peshawar",
        "warehouse": "Bonded Godown A, Customs House Peshawar",
        "gps": "34.0151, 71.5249",
        "collectorate": "MCC Peshawar",
        "code": "PSH",
    },
    "thakot": {
        "office": "Model Customs Collectorate, Thakot",
        "place": "Thakot Border Crossing Examination Shed",
        "warehouse": "Transit Shed, Customs Station Thakot",
        "gps": "34.7860, 72.9260",
        "collectorate": "MCC Thakot",
        "code": "THK",
    },
}


def _default_site() -> str:
    text = str(Path(__file__).resolve()).lower()
    if "peshawar" in text:
        return "peshawar"
    if "thakot" in text:
        return "thakot"
    return "dikhan"


def _sample_sheets(site: dict) -> list[dict]:
    office = site["office"]
    place = site["place"]
    warehouse = site["warehouse"]
    gps = site["gps"]
    collectorate = site["collectorate"]
    code = site["code"]
    now = timezone.now()

    return [
        {
            "note_sheet_no": f"NS-{code}-SEED-001",
            "status": NoteSheet.STATUS_DRAFT,
            "priority": NoteSheet.PRIORITY_URGENT,
            "date_time": (now - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M"),
            "office": office,
            "case_no": f"SZ-{code}-2026-201",
            "subject": "Undeclared imported electronics intercepted during AFU examination",
            "prepared_by": "Inspector Naeem Ullah",
            "badge_id": f"{code}-INS-4412",
            "designation": "Inspector",
            "department": f"Preventive / Examination — {collectorate}",
            "officer_contact": "0333-5122091",
            "accused_name": "Muhammad Imran",
            "accused_father_name": "Ghulam Qadir",
            "accused_cnic": "12101-4455123-7",
            "accused_mobile": "0345-7788120",
            "accused_address": "Shop No. 14, Sarafa Bazaar, Dera Ismail Khan",
            "business_name": "Imran Electronics & Mobile Accessories",
            "ntn_strn": "4012345-6 / 3270012345678",
            "place_of_inspection": place,
            "warehouse_shop": warehouse,
            "gps_location": gps,
            "inspection_date": (now - timedelta(hours=8)).strftime("%Y-%m-%d %H:%M"),
            "grounds_of_suspicion": (
                "Consignment declared as mixed plastic household goods. Physical examination of cartons "
                "revealed factory-packed smartphones, laptop computers and branded chargers with no "
                "GD, invoice, or packing list matching the declared description. Serial numbers on "
                "devices were not listed on any accompanying commercial document. The importer could "
                "not produce WeBOC GD or bank-attested invoice at the time of inspection."
            ),
            "evidence_collected": [
                "Photographs",
                "Videos",
                "Invoice Copies",
                "CNIC Copies",
                "Witness Statement",
            ],
            "preliminary_findings": (
                "Goods appear to be commercial quantity of undeclared electronics. Estimated CIF value "
                "substantially exceeds the declared household-goods value. Recommendation is to issue "
                "a detention memo pending valuation, origin verification and WeBOC audit."
            ),
            "recommendation": NoteSheet.RECOMMENDATION_DETENTION,
            "content": (
                "Preliminary note prepared after joint examination with Preventive staff. Goods kept "
                "under lock in Bonded Godown pending senior officer decision."
            ),
            "prepared_signature": "Inspector Naeem Ullah",
            "prepared_date": (now - timedelta(hours=6)).strftime("%Y-%m-%d"),
            "forward_to": "",
            "items": [
                {
                    "qr": f"QR-NS-{code}-201-A",
                    "product": "Samsung Galaxy A55 smartphones (dual SIM), boxed, 128 GB, mixed colours",
                    "pct": "8517.1300",
                    "qty": "180",
                    "unit": "PCS",
                    "condition": "New / Sealed",
                    "value": "12600000",
                    "id_ref": "IMEI lot A55-DIK-201",
                    "notes": "Cartons marked as kitchenware. IMEI stickers intact.",
                    "perishable": False,
                },
                {
                    "qr": f"QR-NS-{code}-201-B",
                    "product": "HP ProBook 450 G10 notebooks, Intel i5, 16 GB RAM, 512 GB SSD",
                    "pct": "8471.3010",
                    "qty": "48",
                    "unit": "PCS",
                    "condition": "New / Sealed",
                    "value": "6720000",
                    "id_ref": "S/N HP450-LOT-201",
                    "notes": "Original HP cartons, no GD reference on packing list.",
                    "perishable": False,
                },
                {
                    "qr": f"QR-NS-{code}-201-C",
                    "product": "USB-C fast chargers and power adapters, 25W / 65W mixed lot",
                    "pct": "8504.4090",
                    "qty": "600",
                    "unit": "PCS",
                    "condition": "New",
                    "value": "900000",
                    "id_ref": "CHG-LOT-201",
                    "notes": "Loose packed in polybags inside cartons 11–16.",
                    "perishable": False,
                },
            ],
        },
        {
            "note_sheet_no": f"NS-{code}-SEED-002",
            "status": NoteSheet.STATUS_SUBMITTED,
            "priority": NoteSheet.PRIORITY_NORMAL,
            "date_time": (now - timedelta(days=1, hours=3)).strftime("%Y-%m-%d %H:%M"),
            "office": office,
            "case_no": f"SZ-{code}-2026-202",
            "subject": "Misdeclared auto parts and tyres — suspected under-invoicing",
            "prepared_by": "Inspector Sanaullah Khan",
            "badge_id": f"{code}-INS-3388",
            "designation": "Inspector",
            "department": f"Preventive — {collectorate}",
            "officer_contact": "0300-9112045",
            "accused_name": "Abdul Rehman",
            "accused_father_name": "Haji Umar Gul",
            "accused_cnic": "11201-7788990-1",
            "accused_mobile": "0312-4455098",
            "accused_address": "Plot 8, Industrial Area, Bannu Road",
            "business_name": "Rehman Auto Traders",
            "ntn_strn": "3278891-2 / 3270088912345",
            "place_of_inspection": place,
            "warehouse_shop": warehouse,
            "gps_location": gps,
            "inspection_date": (now - timedelta(days=1, hours=5)).strftime("%Y-%m-%d %H:%M"),
            "grounds_of_suspicion": (
                "GD described goods as used rubber scrap. Examination found new radial tyres of "
                "Japanese and Chinese origin together with complete shock absorbers and brake kits "
                "in commercial packing. Declared value is about one-fifth of prevailing market "
                "assessable value. No valid origin certificate or brand authorization was produced."
            ),
            "evidence_collected": [
                "Photographs",
                "Invoice Copies",
                "Vehicle Information",
                "CNIC Copies",
                "Other",
            ],
            "preliminary_findings": (
                "Apparent misdeclaration of description and value. Tyres are new, DOT/ECE marked. "
                "Recommend detention and referral for valuation and possible FIR if mens rea is "
                "established after importer's reply."
            ),
            "recommendation": NoteSheet.RECOMMENDATION_DETENTION,
            "content": "Submitted for approval of Assistant Collector / Deputy Collector.",
            "prepared_signature": "Inspector Sanaullah Khan",
            "prepared_date": (now - timedelta(days=1)).strftime("%Y-%m-%d"),
            "forward_to": NOTE_SHEET_FORWARD_TO_LABEL,
            "submitted_at": now - timedelta(hours=20),
            "items": [
                {
                    "qr": f"QR-NS-{code}-202-A",
                    "product": "New radial tyres 195/65 R15, mixed Bridgestone / Triangle brands",
                    "pct": "4011.1000",
                    "qty": "240",
                    "unit": "PCS",
                    "condition": "New",
                    "value": "4800000",
                    "id_ref": "DOT 2225 / 2325 lot",
                    "notes": "Stacked on pallets 1–8; no used-scrap markings.",
                    "perishable": False,
                },
                {
                    "qr": f"QR-NS-{code}-202-B",
                    "product": "Complete shock absorber assemblies for 1300cc passenger cars",
                    "pct": "8708.8090",
                    "qty": "160",
                    "unit": "PCS",
                    "condition": "New / Boxed",
                    "value": "1280000",
                    "id_ref": "SA-LOT-202",
                    "notes": "Cartons labelled in Chinese / English, no GD HS match.",
                    "perishable": False,
                },
                {
                    "qr": f"QR-NS-{code}-202-C",
                    "product": "Ceramic brake pad kits (front) for Toyota Corolla 2014–2018",
                    "pct": "8708.3090",
                    "qty": "300",
                    "unit": "SET",
                    "condition": "New",
                    "value": "900000",
                    "id_ref": "BP-COR-202",
                    "notes": "Packed 4 pads per set; commercial quantity.",
                    "perishable": False,
                },
            ],
        },
        {
            "note_sheet_no": f"NS-{code}-SEED-003",
            "status": NoteSheet.STATUS_APPROVED,
            "priority": NoteSheet.PRIORITY_NORMAL,
            "date_time": (now - timedelta(days=3, hours=2)).strftime("%Y-%m-%d %H:%M"),
            "office": office,
            "case_no": f"SZ-{code}-2026-203",
            "subject": "Suspected smuggled textiles and fabric rolls without GD",
            "prepared_by": "Inspector Farzana Bibi",
            "badge_id": f"{code}-INS-2201",
            "designation": "Inspector",
            "department": f"Anti-Smuggling — {collectorate}",
            "officer_contact": "0346-2011988",
            "accused_name": "Khalid Mehmood",
            "accused_father_name": "Noor Muhammad",
            "accused_cnic": "12101-9900112-5",
            "accused_mobile": "0332-6677001",
            "accused_address": "Godown 3, Circular Road, Dera Ismail Khan",
            "business_name": "Khyber Fabrics & Hosiery",
            "ntn_strn": "4019988-1 / 3270019988123",
            "place_of_inspection": place,
            "warehouse_shop": warehouse,
            "gps_location": gps,
            "inspection_date": (now - timedelta(days=3, hours=4)).strftime("%Y-%m-%d %H:%M"),
            "grounds_of_suspicion": (
                "Intelligence indicated a night unloading of fabric rolls without WeBOC coverage. "
                "Search of the godown recovered polyester suiting, printed lawn and knitted fabric "
                "with foreign mill markings and no corresponding GD, invoice or STRN sales record "
                "for the quantities found."
            ),
            "evidence_collected": [
                "Photographs",
                "Videos",
                "Witness Statement",
                "CNIC Copies",
                "Invoice Copies",
            ],
            "preliminary_findings": (
                "Goods are commercial textile lots with no lawful import trail. Senior officer "
                "approved issuance of detention memo. Valuation to follow from Examination."
            ),
            "recommendation": NoteSheet.RECOMMENDATION_DETENTION,
            "content": "Approved for detention memo. Godown sealed; keys with Preventive in-charge.",
            "prepared_signature": "Inspector Farzana Bibi",
            "prepared_date": (now - timedelta(days=3)).strftime("%Y-%m-%d"),
            "forward_to": NOTE_SHEET_FORWARD_TO_LABEL,
            "submitted_at": now - timedelta(days=2, hours=12),
            "approved_by": "Assistant Collector (Preventive)",
            "approved_at": now - timedelta(days=2),
            "approval_remarks": (
                "Grounds are sufficient. Issue detention memo and complete inventory with QR tagging. "
                "Forward valuation to Examination Wing."
            ),
            "items": [
                {
                    "qr": f"QR-NS-{code}-203-A",
                    "product": "Polyester suiting fabric, 58 inch, mixed colours, mill-packed rolls",
                    "pct": "5515.1300",
                    "qty": "4200",
                    "unit": "MTR",
                    "condition": "New / Rolls",
                    "value": "3360000",
                    "id_ref": "Roll lot PS-203",
                    "notes": "Foreign mill stamps; no GD stickers.",
                    "perishable": False,
                },
                {
                    "qr": f"QR-NS-{code}-203-B",
                    "product": "Printed lawn / voile fabric, 48 inch, seasonal prints",
                    "pct": "5208.5200",
                    "qty": "2800",
                    "unit": "MTR",
                    "condition": "New / Rolls",
                    "value": "2240000",
                    "id_ref": "Roll lot LN-203",
                    "notes": "Packed in polythene; commercial prints.",
                    "perishable": False,
                },
                {
                    "qr": f"QR-NS-{code}-203-C",
                    "product": "Knitted hosiery fabric, cotton/poly blend, 30/1, grey and dyed",
                    "pct": "6006.2200",
                    "qty": "1500",
                    "unit": "KG",
                    "condition": "New",
                    "value": "1875000",
                    "id_ref": "Bale lot KH-203",
                    "notes": "18 bales; weight as per platform scale.",
                    "perishable": False,
                },
            ],
        },
    ]


class Command(BaseCommand):
    help = "Create 3 sample note sheets with full officer, accused, goods and narrative data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--site",
            choices=sorted(SITE_PROFILES.keys()),
            default=_default_site(),
            help="Collectorate profile used for office / location text.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Replace existing seed sheets with the same note sheet numbers.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        site = SITE_PROFILES[options["site"]]
        force = options["force"]
        created = 0
        updated = 0

        for entry in _sample_sheets(site):
            items = entry.pop("items")
            note_no = entry["note_sheet_no"]
            existing = NoteSheet.objects.filter(note_sheet_no=note_no).first()
            if existing and not force:
                self.stdout.write(self.style.WARNING(f"Skip {note_no} (already exists). Use --force to replace."))
                continue

            if existing and force:
                existing.items.all().delete()
                obj = existing
                updated += 1
            else:
                obj = NoteSheet()
                created += 1

            obj.note_sheet_no = note_no
            obj.reference_number = note_no
            obj.date_time = entry["date_time"]
            obj.office = entry["office"]
            obj.case_no = entry["case_no"]
            obj.priority = entry["priority"]
            obj.status = entry["status"]
            obj.subject = entry["subject"]
            obj.prepared_by = entry["prepared_by"]
            obj.badge_id = entry["badge_id"]
            obj.designation = entry["designation"]
            obj.department = entry["department"]
            obj.officer_contact = entry["officer_contact"]
            obj.accused_name = entry["accused_name"]
            obj.accused_father_name = entry["accused_father_name"]
            obj.accused_cnic = entry["accused_cnic"]
            obj.accused_mobile = entry["accused_mobile"]
            obj.accused_address = entry["accused_address"]
            obj.business_name = entry["business_name"]
            obj.ntn_strn = entry["ntn_strn"]
            obj.place_of_inspection = entry["place_of_inspection"]
            obj.warehouse_shop = entry["warehouse_shop"]
            obj.gps_location = entry["gps_location"]
            obj.inspection_date = entry["inspection_date"]
            obj.grounds_of_suspicion = entry["grounds_of_suspicion"]
            obj.evidence_collected = entry["evidence_collected"]
            obj.preliminary_findings = entry["preliminary_findings"]
            obj.recommendation = entry["recommendation"]
            obj.content = entry["content"]
            obj.prepared_signature = entry["prepared_signature"]
            obj.prepared_date = entry["prepared_date"]
            obj.forward_to = entry.get("forward_to") or ""
            obj.submitted_at = entry.get("submitted_at")
            obj.approved_by = entry.get("approved_by") or ""
            obj.approved_at = entry.get("approved_at")
            obj.approval_remarks = entry.get("approval_remarks") or ""
            obj.created_by = obj.created_by or "seed_note_sheets"
            obj.updated_by = "seed_note_sheets"
            obj.save()

            for idx, goods in enumerate(items, start=1):
                NoteSheetItem.objects.create(
                    note_sheet=obj,
                    client_line_id=f"seed-{idx}",
                    qr_code_number=goods["qr"],
                    product=goods["product"],
                    pct_code=goods["pct"],
                    quantity=goods["qty"],
                    unit=goods["unit"],
                    condition=goods["condition"],
                    estimated_value=goods["value"],
                    identification_ref=goods["id_ref"],
                    remarks=goods["notes"],
                    perishable=goods.get("perishable", False),
                    sort_order=idx,
                )

            self.stdout.write(
                self.style.SUCCESS(
                    f"{'Updated' if existing and force else 'Created'} {note_no} "
                    f"[{obj.status}] with {len(items)} goods line(s)."
                )
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done ({options['site']}): {created} created, {updated} replaced."
            )
        )
