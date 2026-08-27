/**
 * Seizure Management API — Note Sheet, Assessment, Recovery Memo, Seizure Report.
 */
import { API_BASE_URL, getAuthHeaders, getAuthHeadersFormData } from "@/lib/api"

const BASE = `${API_BASE_URL}/api/seizure-management`

function errorMessage(res: Response, body: unknown): string {
  if (res.status === 400 && body && typeof body === "object" && !Array.isArray(body)) {
    const err = body as Record<string, unknown>
    const parts = Object.entries(err).map(([k, v]) =>
      `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`
    )
    if (parts.length) return parts.join("; ")
  }
  if (body && typeof body === "object" && "detail" in body) {
    return String((body as { detail: unknown }).detail)
  }
  return `Request failed (${res.status})`
}

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export const RECOVERY_CATEGORIES = ["Dangerous/Chemical", "Perishable", "Other"] as const
export type RecoveryCategory = (typeof RECOVERY_CATEGORIES)[number]

export type NoteSheetStatus = "Draft" | "Submitted" | "Approved" | "Rejected"

const NOTE_SHEET_HIGHER_OFFICIAL_ROLES = new Set([
  "ADMIN",
  "LOCATION_ADMIN",
  "DEPUTY_COLLECTOR",
  "ASSISTANT_COLLECTOR",
])

/** Before approval any user may delete; after approval only higher officials. Linked sheets cannot be deleted. */
export function canUserDeleteNoteSheet(
  row: { status: NoteSheetStatus; detentionMemoId?: string },
  role?: string | null
): boolean {
  if (row.detentionMemoId) return false
  if (row.status !== "Approved") return true
  const normalized = (role ?? "").trim().replace(/[\s-]+/g, "_").toUpperCase()
  return NOTE_SHEET_HIGHER_OFFICIAL_ROLES.has(normalized)
}
export type ApprovalStatus = "Draft" | "Pending Approval" | "Approved" | "Rejected"
export type AssessmentStatus = "Draft" | "Submitted" | "Approved" | "Rejected"
export type DocumentRelevance = "Pending" | "Relevant" | "Not Relevant"
export type SeizureReportStatus = "Draft" | "Submitted"

export const EVIDENCE_OPTIONS = [
  "Photographs",
  "Videos",
  "Witness Statement",
  "Invoice Copies",
  "Vehicle Information",
  "CNIC Copies",
  "Other",
] as const

export const RECOMMENDATION_OPTIONS = [
  "No Action",
  "Warning",
  "Further Investigation",
  "Issue Detention Memo",
  "Release Goods",
] as const

export type NoteSheetItem = {
  id?: string
  clientLineId?: string
  qrCodeNumber: string
  product: string
  description?: string
  pctCode: string
  quantity: string
  unit: string
  condition: string
  estimatedValue: string
  assessableValuePkr?: string
  perishable: boolean
  identificationRef: string
  remarks: string
  itemNotes?: string
  images?: string[]
  imageFiles?: File[]
}

export type NoteSheetAttachment = {
  id: string
  fileType: string
  originalFilename: string
  url: string
  uploadedAt: string
}

export type NoteSheetTimelineStep = {
  key: string
  label: string
  at: string
  done: boolean
}

export type NoteSheetRecord = {
  id: string
  noteSheetNo: string
  referenceNumber: string
  dateTime: string
  office: string
  caseNo: string
  priority: "Normal" | "Urgent"
  status: NoteSheetStatus
  subject: string
  preparedBy: string
  badgeId: string
  designation: string
  department: string
  officerContact: string
  accusedName: string
  accusedFatherName: string
  accusedCnic: string
  accusedMobile: string
  accusedAddress: string
  businessName: string
  ntnStrn: string
  items: NoteSheetItem[]
  placeOfInspection: string
  warehouseShop: string
  gpsLocation: string
  inspectionDate: string
  groundsOfSuspicion: string
  evidenceCollected: string[]
  preliminaryFindings: string
  recommendation: string
  content: string
  preparedSignature: string
  preparedDate: string
  forwardTo: string
  forwardToUserId: number | null
  approvedBy: string
  approvedAt: string
  approvalRemarks: string
  rejectionReason: string
  submittedAt: string
  viewedAt: string
  createdBy: string
  updatedBy: string
  detentionMemoId: string
  attachments: NoteSheetAttachment[]
  timeline: NoteSheetTimelineStep[]
  createdAt: string
  updatedAt: string
}

export type NoteSheetWritePayload = Partial<Omit<NoteSheetRecord, "id" | "attachments" | "timeline" | "createdAt" | "updatedAt" | "detentionMemoId" | "approvedAt" | "submittedAt" | "viewedAt">> & {
  items?: NoteSheetItem[]
  evidenceCollected?: string[]
}

export type NoteSheetCreateMedia = {
  photos?: File[]
  videos?: File[]
  pdfs?: File[]
  invoices?: File[]
  challans?: File[]
  importDocs?: File[]
  cnics?: File[]
  other?: File[]
}

export type DetentionAssessmentAttachment = {
  id: string
  fileType: string
  originalFilename: string
  url: string
  uploadedAt: string
}

export type AssessmentGoodsValuation = {
  id: string
  pctCode: string
  assessableValuePkr: string
}

export type DetentionAssessmentRecord = {
  id: string
  detentionMemoId: string
  caseNo: string
  referenceNumber: string
  assessmentDate: string
  examiningOfficer: string
  goodsCondition: string
  valuationNotes: string
  findings: string
  documentRelevance: DocumentRelevance
  status: AssessmentStatus
  approvedBy: string
  approvedAt: string
  approvalRemarks: string
  rejectionReason: string
  submittedAt: string
  viewedAt: string
  createdBy: string
  updatedBy: string
  attachments: DetentionAssessmentAttachment[]
  timeline?: Array<{
    action: string
    label: string
    at: string
    by?: string
    remarks?: string
  }>
  createdAt: string
  updatedAt: string
}

export type RecoveryMemoRecord = {
  id: string
  detentionMemoId: string
  assessmentId: string
  caseNo: string
  referenceNumber: string
  category: RecoveryCategory
  recoveryDate: string
  recoveryOfficer: string
  goodsDescription: string
  quantity: string
  remarks: string
  approvalStatus: ApprovalStatus
  approvedBy: string
  approvedAt: string
  approvalRemarks?: string
  rejectionReason: string
  submittedAt?: string
  depositAccountId: string
  createdBy?: string
  updatedBy?: string
  createdAt: string
  updatedAt: string
}

export type SeizureReportRecord = {
  id: string
  detentionMemoId: string
  assessmentId: string
  recoveryMemoId: string
  caseNo: string
  referenceNumber: string
  reportDate: string
  preparedBy: string
  summary: string
  recoveryAssessmentNotes: string
  status: SeizureReportStatus
  submittedAt: string
  createdAt: string
  updatedAt: string
}

export type SeizureMgmtOverview = {
  noteSheets: number
  noteSheetsPending: number
  noteSheetsApprovedAvailable: number
  assessments: number
  assessmentsPending: number
  recoveryMemos: number
  recoveryPendingApproval: number
  seizureReports: number
  seizureReportsSubmitted: number
}

export const DETENTION_WINDOW_DAYS = 60

export function daysSinceDetention(dateTimeDetention: string): number | null {
  if (!dateTimeDetention?.trim()) return null
  try {
    const det = new Date(dateTimeDetention.replace(" ", "T"))
    return Math.floor((Date.now() - det.getTime()) / (1000 * 60 * 60 * 24))
  } catch {
    return null
  }
}

export function isWithinDetentionWindow(dateTimeDetention: string): boolean {
  const days = daysSinceDetention(dateTimeDetention)
  if (days === null) return true
  return days <= DETENTION_WINDOW_DAYS
}

// ——— Overview ———

export async function fetchSeizureMgmtOverview(): Promise<SeizureMgmtOverview> {
  const res = await fetch(`${BASE}/overview/`, { headers: getAuthHeaders(), cache: "no-store" })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as SeizureMgmtOverview
}

// ——— Note sheets ———

export async function fetchNoteSheets(params?: { status?: string; available?: boolean }): Promise<NoteSheetRecord[]> {
  const q = new URLSearchParams()
  if (params?.status) q.set("status", params.status)
  if (params?.available) q.set("available", "1")
  const qs = q.toString()
  const res = await fetch(`${BASE}/note-sheets/list/${qs ? `?${qs}` : ""}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as NoteSheetRecord[]
}

export async function fetchNoteSheetById(id: string): Promise<NoteSheetRecord> {
  const res = await fetch(`${BASE}/note-sheets/${encodeURIComponent(id)}/read/`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as NoteSheetRecord
}

function appendNoteSheetMedia(form: FormData, media?: NoteSheetCreateMedia, items?: NoteSheetItem[]) {
  for (const f of media?.photos ?? []) form.append("photo", f)
  for (const f of media?.videos ?? []) form.append("video", f)
  for (const f of media?.pdfs ?? []) form.append("pdf", f)
  for (const f of media?.invoices ?? []) form.append("invoice", f)
  for (const f of media?.challans ?? []) form.append("delivery_challan", f)
  for (const f of media?.importDocs ?? []) form.append("import_document", f)
  for (const f of media?.cnics ?? []) form.append("cnic", f)
  for (const f of media?.other ?? []) form.append("other", f)

  for (const item of items ?? []) {
    const lineId = item.clientLineId || item.id || ""
    if (!lineId) continue
    ;(item.imageFiles ?? []).forEach((file, idx) => {
      form.append(`goods_image_${lineId}_${idx}`, file)
    })
  }
}

function noteSheetHasUploads(media?: NoteSheetCreateMedia, items?: NoteSheetItem[]): boolean {
  const hasMedia =
    media && Object.values(media).some((arr) => Array.isArray(arr) && arr.length > 0)
  const hasGoodsImages = (items ?? []).some((it) => (it.imageFiles?.length ?? 0) > 0)
  return Boolean(hasMedia || hasGoodsImages)
}

function serializeNoteSheetItems(items?: NoteSheetItem[]) {
  return (items ?? []).map((it, idx) => ({
    clientLineId: it.clientLineId || it.id || "",
    qrCodeNumber: it.qrCodeNumber || "",
    product: it.product || it.description || "",
    description: it.description || it.product || "",
    // PCT / assessable value are assessment-stage fields — not captured on note sheet
    pctCode: "",
    quantity: it.quantity || "",
    unit: it.unit || "",
    condition: it.condition || "",
    estimatedValue: "",
    assessableValuePkr: "",
    perishable: Boolean(it.perishable),
    identificationRef: it.identificationRef || "",
    remarks: it.remarks || it.itemNotes || "",
    itemNotes: it.itemNotes || it.remarks || "",
    sortOrder: idx,
  }))
}

export async function createNoteSheet(
  payload: NoteSheetWritePayload,
  media?: NoteSheetCreateMedia
): Promise<NoteSheetRecord> {
  const items = serializeNoteSheetItems(payload.items)
  const bodyPayload = { ...payload, items }

  if (!noteSheetHasUploads(media, payload.items)) {
    const res = await fetch(`${BASE}/note-sheets/create/`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(bodyPayload),
    })
    const body = await parseJson(res)
    if (!res.ok) throw new Error(errorMessage(res, body))
    return body as NoteSheetRecord
  }

  const form = new FormData()
  form.append("payload", JSON.stringify(bodyPayload))
  appendNoteSheetMedia(form, media, payload.items)

  const res = await fetch(`${BASE}/note-sheets/create/`, {
    method: "POST",
    headers: getAuthHeadersFormData(),
    body: form,
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as NoteSheetRecord
}

export async function updateNoteSheet(
  id: string,
  payload: NoteSheetWritePayload,
  media?: NoteSheetCreateMedia
): Promise<NoteSheetRecord> {
  const items = serializeNoteSheetItems(payload.items)
  const bodyPayload = { ...payload, items }

  if (!noteSheetHasUploads(media, payload.items)) {
    const res = await fetch(`${BASE}/note-sheets/${encodeURIComponent(id)}/update/`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(bodyPayload),
    })
    const body = await parseJson(res)
    if (!res.ok) throw new Error(errorMessage(res, body))
    return body as NoteSheetRecord
  }

  const form = new FormData()
  form.append("payload", JSON.stringify(bodyPayload))
  appendNoteSheetMedia(form, media, payload.items)

  const res = await fetch(`${BASE}/note-sheets/${encodeURIComponent(id)}/update/`, {
    method: "PUT",
    headers: getAuthHeadersFormData(),
    body: form,
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as NoteSheetRecord
}

export async function deleteNoteSheet(id: string): Promise<void> {
  const res = await fetch(`${BASE}/note-sheets/${encodeURIComponent(id)}/delete/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  })
  if (!res.ok) {
    const body = await parseJson(res)
    throw new Error(errorMessage(res, body))
  }
}

export async function noteSheetApproval(
  id: string,
  action: "submit" | "approve" | "reject" | "view",
  extra?: { approvedBy?: string; rejectionReason?: string; approvalRemarks?: string }
): Promise<NoteSheetRecord> {
  const res = await fetch(`${BASE}/note-sheets/${encodeURIComponent(id)}/approval/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ action, ...extra }),
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as NoteSheetRecord
}

export type NoteSheetNotificationItem = {
  id: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  noteSheetId: string
  noteSheetNo: string
  assessmentId?: string
  recoveryMemoId?: string
  caseNo?: string
  type: string
  hrefKind?: "note_sheet" | "assessment" | "recovery" | string
}

export async function fetchNoteSheetNotifications(opts?: {
  unread?: boolean
}): Promise<{ unreadCount: number; results: NoteSheetNotificationItem[] }> {
  const qs = opts?.unread ? "?unread=1" : ""
  const res = await fetch(`${BASE}/notifications/${qs}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as { unreadCount: number; results: NoteSheetNotificationItem[] }
}

export async function markNoteSheetNotificationRead(id: string): Promise<void> {
  const res = await fetch(`${BASE}/notifications/${encodeURIComponent(id)}/mark-read/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const body = await parseJson(res)
    throw new Error(errorMessage(res, body))
  }
}

export async function markAllNoteSheetNotificationsRead(): Promise<void> {
  const res = await fetch(`${BASE}/notifications/mark-read/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ all: true }),
  })
  if (!res.ok) {
    const body = await parseJson(res)
    throw new Error(errorMessage(res, body))
  }
}

export async function linkNoteSheetToDetention(noteSheetId: string, detentionMemoId: string): Promise<NoteSheetRecord> {
  const res = await fetch(`${BASE}/note-sheets/${encodeURIComponent(noteSheetId)}/link-detention/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ detentionMemoId }),
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as NoteSheetRecord
}

// ——— Assessments ———

export type AssessmentUploadMedia = {
  photos?: File[]
  videos?: File[]
  pdfs?: File[]
  invoices?: File[]
  challans?: File[]
  importDocs?: File[]
  cnics?: File[]
  other?: File[]
  documents?: File[]
}

function assessmentHasMedia(media?: AssessmentUploadMedia): boolean {
  if (!media) return false
  return Object.values(media).some((arr) => (arr?.length ?? 0) > 0)
}

export async function fetchAssessments(detentionMemoId?: string): Promise<DetentionAssessmentRecord[]> {
  const qs = detentionMemoId ? `?detentionMemoId=${encodeURIComponent(detentionMemoId)}` : ""
  const res = await fetch(`${BASE}/assessments/list/${qs}`, { headers: getAuthHeaders(), cache: "no-store" })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as DetentionAssessmentRecord[]
}

export async function fetchAssessmentById(id: string): Promise<DetentionAssessmentRecord> {
  const res = await fetch(`${BASE}/assessments/${encodeURIComponent(id)}/read/`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as DetentionAssessmentRecord
}

function appendAssessmentMedia(form: FormData, media?: AssessmentUploadMedia) {
  if (!media) return
  for (const f of media.photos ?? []) form.append("photo", f)
  for (const f of media.videos ?? []) form.append("video", f)
  for (const f of media.pdfs ?? []) form.append("pdf", f)
  for (const f of media.invoices ?? []) form.append("invoice", f)
  for (const f of media.challans ?? []) form.append("delivery_challan", f)
  for (const f of media.importDocs ?? []) form.append("import_document", f)
  for (const f of media.cnics ?? []) form.append("cnic", f)
  for (const f of media.other ?? []) form.append("other", f)
  for (const f of media.documents ?? []) form.append("documents", f)
}

export async function createAssessment(
  payload: Partial<DetentionAssessmentRecord> & {
    detentionMemoId: string
    goodsValuation?: AssessmentGoodsValuation[]
  },
  media?: AssessmentUploadMedia
): Promise<DetentionAssessmentRecord> {
  if (!assessmentHasMedia(media)) {
    const res = await fetch(`${BASE}/assessments/create/`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    const body = await parseJson(res)
    if (!res.ok) throw new Error(errorMessage(res, body))
    return body as DetentionAssessmentRecord
  }
  const form = new FormData()
  form.append("payload", JSON.stringify(payload))
  appendAssessmentMedia(form, media)
  const res = await fetch(`${BASE}/assessments/create/`, {
    method: "POST",
    headers: getAuthHeadersFormData(),
    body: form,
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as DetentionAssessmentRecord
}

export async function updateAssessment(
  id: string,
  payload: Partial<DetentionAssessmentRecord> & { goodsValuation?: AssessmentGoodsValuation[] },
  media?: AssessmentUploadMedia
): Promise<DetentionAssessmentRecord> {
  if (!assessmentHasMedia(media)) {
    const res = await fetch(`${BASE}/assessments/${encodeURIComponent(id)}/update/`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    const body = await parseJson(res)
    if (!res.ok) throw new Error(errorMessage(res, body))
    return body as DetentionAssessmentRecord
  }
  const form = new FormData()
  form.append("payload", JSON.stringify(payload))
  appendAssessmentMedia(form, media)
  const res = await fetch(`${BASE}/assessments/${encodeURIComponent(id)}/update/`, {
    method: "PUT",
    headers: getAuthHeadersFormData(),
    body: form,
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as DetentionAssessmentRecord
}

export async function assessmentApproval(
  id: string,
  action: "submit" | "approve" | "reject" | "view",
  opts?: { approvedBy?: string; approvalRemarks?: string; rejectionReason?: string }
): Promise<DetentionAssessmentRecord> {
  const res = await fetch(`${BASE}/assessments/${encodeURIComponent(id)}/approval/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      action,
      approvedBy: opts?.approvedBy || "",
      approvalRemarks: opts?.approvalRemarks || "",
      rejectionReason: opts?.rejectionReason || "",
    }),
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as DetentionAssessmentRecord
}

export async function deleteAssessment(id: string): Promise<void> {
  const res = await fetch(`${BASE}/assessments/${encodeURIComponent(id)}/delete/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  })
  if (!res.ok) {
    const body = await parseJson(res)
    throw new Error(errorMessage(res, body))
  }
}

// ——— Recovery memos ———

export async function fetchRecoveryMemos(detentionMemoId?: string): Promise<RecoveryMemoRecord[]> {
  const qs = detentionMemoId ? `?detentionMemoId=${encodeURIComponent(detentionMemoId)}` : ""
  const res = await fetch(`${BASE}/recovery-memos/list/${qs}`, { headers: getAuthHeaders(), cache: "no-store" })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as RecoveryMemoRecord[]
}

export async function fetchRecoveryMemoById(id: string): Promise<RecoveryMemoRecord> {
  const res = await fetch(`${BASE}/recovery-memos/${encodeURIComponent(id)}/read/`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as RecoveryMemoRecord
}

export async function createRecoveryMemo(
  payload: Partial<RecoveryMemoRecord> & { detentionMemoId: string; createDeposit?: boolean }
): Promise<RecoveryMemoRecord> {
  const res = await fetch(`${BASE}/recovery-memos/create/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as RecoveryMemoRecord
}

export async function updateRecoveryMemo(
  id: string,
  payload: Partial<RecoveryMemoRecord> & { createDeposit?: boolean }
): Promise<RecoveryMemoRecord> {
  const res = await fetch(`${BASE}/recovery-memos/${encodeURIComponent(id)}/update/`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as RecoveryMemoRecord
}

export async function deleteRecoveryMemo(id: string): Promise<void> {
  const res = await fetch(`${BASE}/recovery-memos/${encodeURIComponent(id)}/delete/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  })
  if (!res.ok) {
    const body = await parseJson(res)
    throw new Error(errorMessage(res, body))
  }
}

export async function recoveryMemoApproval(
  id: string,
  action: "submit" | "approve" | "reject" | "view",
  extra?: { approvedBy?: string; rejectionReason?: string; approvalRemarks?: string }
): Promise<RecoveryMemoRecord> {
  const res = await fetch(`${BASE}/recovery-memos/${encodeURIComponent(id)}/approval/`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as RecoveryMemoRecord
}

// ——— Seizure reports ———

export async function fetchSeizureReports(): Promise<SeizureReportRecord[]> {
  const res = await fetch(`${BASE}/seizure-reports/list/`, { headers: getAuthHeaders(), cache: "no-store" })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as SeizureReportRecord[]
}

export async function fetchSeizureReportById(id: string): Promise<SeizureReportRecord> {
  const res = await fetch(`${BASE}/seizure-reports/${encodeURIComponent(id)}/read/`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as SeizureReportRecord
}

export async function createSeizureReport(
  payload: Partial<SeizureReportRecord> & { detentionMemoId: string }
): Promise<SeizureReportRecord> {
  const res = await fetch(`${BASE}/seizure-reports/create/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as SeizureReportRecord
}

export async function updateSeizureReport(
  id: string,
  payload: Partial<SeizureReportRecord>
): Promise<SeizureReportRecord> {
  const res = await fetch(`${BASE}/seizure-reports/${encodeURIComponent(id)}/update/`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as SeizureReportRecord
}

export async function deleteSeizureReport(id: string): Promise<void> {
  const res = await fetch(`${BASE}/seizure-reports/${encodeURIComponent(id)}/delete/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  })
  if (!res.ok) {
    const body = await parseJson(res)
    throw new Error(errorMessage(res, body))
  }
}
