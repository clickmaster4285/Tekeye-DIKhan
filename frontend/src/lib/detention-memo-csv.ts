import { downloadCsv, joinList } from "@/lib/csv-export"
import type {
  DetentionMemoApiRecord,
  DetentionMemoAuditEntry,
  DetentionMemoGoodsLineApi,
  DetentionMemoMediaAttachment,
} from "@/lib/detention-memo-api"

function formatAttachments(atts?: DetentionMemoMediaAttachment[]): string {
  return (atts || [])
    .map((a) => [a.kind, a.originalFilename, a.url].filter(Boolean).join(" | "))
    .join(" || ")
}

function formatAuditLog(entries?: DetentionMemoAuditEntry[]): string {
  return (entries || [])
    .map((e) => {
      const when = e.createdAt ? new Date(e.createdAt).toLocaleString() : ""
      return [e.actionLabel || e.action, e.performedBy, when, e.message].filter(Boolean).join(" | ")
    })
    .join(" || ")
}

export const DETENTION_MEMO_CSV_HEADERS = [
  "Sheet Sr. No",
  "Case No",
  "Detention Memo No",
  "FIR Number",
  "Date/Time of Occurrence",
  "Place of Occurrence",
  "Date/Time of Detention",
  "Place of Detention",
  "Detention Type",
  "Directorate",
  "Reason for Detention",
  "Location of Detention",
  "GD Number",
  "GD Number 2",
  "Where Deposited",
  "Search / Chassis Number",
  "Receipt Officer",
  "Settlement Status",
  "Verification Status",
  "Disposition Status",
  "Brief Facts",
  "Forwarding Officer Remarks",
  "Purpose of Detention",
  "Owner Name",
  "Owner CNIC",
  "Owner Contact",
  "Owner Picture URL",
  "Driver Name",
  "Driver CNIC",
  "Driver Contact",
  "Driver Picture URL",
  "Seizing Officer Notes",
  "Examining Officer Notes",
  "Detention Notes",
  "Memo QR Number",
  "Memo QR Payload",
  "Attachments",
  "Audit Log",
  "Goods Line No",
  "Goods QR",
  "Description of Goods",
  "PCT Code",
  "Quantity",
  "Unit",
  "Condition",
  "Assessable Value (PKR)",
  "Perishable",
  "ID / Chassis No",
  "Item Notes",
  "Goods Image URLs",
  "Created By",
  "Updated By",
  "Created At",
  "Updated At",
]

function memoCsvCells(
  r: DetentionMemoApiRecord,
  index: number,
  item: DetentionMemoGoodsLineApi | null,
  itemIndex: number
): unknown[] {
  return [
    index + 1,
    r.caseNo,
    r.referenceNumber,
    r.firNumber,
    r.dateTimeOccurrence,
    r.placeOfOccurrence,
    r.dateTimeDetention,
    r.placeOfDetention,
    r.detentionType,
    r.directorate,
    r.reasonForDetention,
    r.locationOfDetention,
    r.gdNumber,
    r.gdNumber2,
    r.whereDeposited,
    r.searchChassisNumber,
    r.receiptOfficer,
    r.settlementStatus,
    r.verificationStatus,
    r.dispositionStatus,
    r.briefFacts,
    r.forwardingOfficerRemarks,
    r.purposeOfDetention,
    r.owner?.name,
    r.owner?.cnic,
    r.owner?.contact,
    r.owner?.picture,
    r.driver?.name,
    r.driver?.cnic,
    r.driver?.contact,
    r.driver?.picture,
    r.seizingOfficerNotes,
    r.examiningOfficerNotes,
    r.detentionNotes,
    r.memoQrCodeNumber,
    r.memoQrCodePayload,
    formatAttachments(r.mediaAttachments),
    formatAuditLog(r.auditLog),
    item ? itemIndex + 1 : "",
    item?.qrCodeNumber,
    item?.description,
    item?.pctCode,
    item?.quantity,
    item?.unit,
    item?.condition,
    item?.assessableValuePkr,
    item ? (item.perishable ? "Yes" : "No") : "",
    item?.identificationRef,
    item?.itemNotes,
    joinList(item?.images),
    r.createdBy,
    r.updatedBy,
    r.createdAt,
    r.updatedAt,
  ]
}

export function downloadDetentionMemoCsv(
  filename: string,
  records: DetentionMemoApiRecord[],
  extra?: {
    headers: string[]
    values: (row: DetentionMemoApiRecord) => unknown[]
  }
): void {
  const headers = extra ? [...DETENTION_MEMO_CSV_HEADERS, ...extra.headers] : DETENTION_MEMO_CSV_HEADERS
  const rows: unknown[][] = []
  records.forEach((r, index) => {
    const goods = r.goodsItems?.length ? r.goodsItems : [null]
    goods.forEach((item, itemIndex) => {
      const cells = memoCsvCells(r, index, item, itemIndex)
      rows.push(extra ? [...cells, ...extra.values(r)] : cells)
    })
  })
  downloadCsv(filename, headers, rows)
}
