/**
 * Detention Memo API — Django REST backend (PostgreSQL).
 */
import { API_BASE_URL, getAuthHeaders, getAuthHeadersFormData } from "@/lib/api"

const BASE = `${API_BASE_URL}/api/detention-memos`

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

export type DetentionMemoGoodsLineApi = {
  id: string
  qrCodeNumber: string
  description: string
  pctCode: string
  quantity: string
  unit: string
  condition: string
  assessableValuePkr: string
  identificationRef: string
  itemNotes: string
  perishable: boolean
  images: string[]
}

export type DetentionMemoMediaAttachment = {
  id: string
  kind: "document" | "video"
  url: string
  originalFilename: string
}

/** Optional files sent with create (multipart). */
export type DetentionMemoCreateMedia = {
  ownerPhoto?: File | null
  driverPhoto?: File | null
  documents?: File[]
  videos?: File[]
  goodsImages?: Record<string, File[]>
}

/** Record shape returned by the API (camelCase). */
export type DetentionMemoApiRecord = {
  id: string
  caseNo: string
  referenceNumber: string
  firNumber?: string
  dateTimeOccurrence: string
  placeOfOccurrence: string
  dateTimeDetention: string
  placeOfDetention: string
  detentionType: string
  directorate: string
  reasonForDetention: string
  locationOfDetention?: string
  gdNumber?: string
  gdNumber2?: string
  whereDeposited: string
  searchChassisNumber?: string
  receiptOfficer?: string
  settlementStatus: string
  verificationStatus: string
  dispositionStatus?: string
  briefFacts?: string
  forwardingOfficerRemarks?: string
  purposeOfDetention?: string
  owner?: { name?: string; cnic?: string; contact?: string; picture?: string | null }
  driver?: { name?: string; cnic?: string; contact?: string; picture?: string | null }
  goodsItems?: DetentionMemoGoodsLineApi[]
  seizingOfficerNotes?: string
  examiningOfficerNotes?: string
  detentionNotes?: string
  memoQrCodeNumber?: string
  memoQrCodePayload?: string
  createdBy?: string
  updatedBy?: string
  createdAt: string
  updatedAt?: string
  mediaAttachments?: DetentionMemoMediaAttachment[]
  auditLog?: DetentionMemoAuditEntry[]
}

export type DetentionMemoAuditEntry = {
  id: string
  action: string
  actionLabel: string
  performedBy: string
  message: string
  createdAt: string
}

export async function fetchDetentionMemos(): Promise<DetentionMemoApiRecord[]> {
  const res = await fetch(`${BASE}/list/`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // ignore
  }
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as DetentionMemoApiRecord[]
}

export async function fetchDetentionMemoById(id: string): Promise<DetentionMemoApiRecord> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}/read/`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // ignore
  }
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as DetentionMemoApiRecord
}

/** Build JSON body for PUT /update/ — matches `DetentionMemoWriteSerializer`; preserves goods lines. */
export function memoApiRecordToWritePayload(record: DetentionMemoApiRecord): Record<string, unknown> {
  const owner = record.owner ?? {}
  const driver = record.driver ?? {}
  return {
    caseNo: record.caseNo ?? "",
    referenceNumber: record.referenceNumber ?? "",
    dateTimeOccurrence: record.dateTimeOccurrence ?? "",
    placeOfOccurrence: record.placeOfOccurrence ?? "",
    dateTimeDetention: record.dateTimeDetention ?? "",
    placeOfDetention: record.placeOfDetention ?? "",
    detentionType: record.detentionType ?? "",
    directorate: record.directorate ?? "",
    reasonForDetention: record.reasonForDetention ?? "",
    locationOfDetention: record.locationOfDetention ?? "",
    gdNumber: record.gdNumber ?? "",
    gdNumber2: record.gdNumber2 ?? "",
    whereDeposited: record.whereDeposited ?? "",
    searchChassisNumber: record.searchChassisNumber ?? "",
    receiptOfficer: record.receiptOfficer ?? "",
    settlementStatus: record.settlementStatus ?? "",
    verificationStatus: record.verificationStatus ?? "",
    briefFacts: record.briefFacts ?? "",
    forwardingOfficerRemarks: record.forwardingOfficerRemarks ?? "",
    purposeOfDetention: record.purposeOfDetention ?? "",
    owner: {
      name: owner.name ?? "",
      cnic: owner.cnic ?? "",
      contact: owner.contact ?? "",
      picture: owner.picture ?? "",
    },
    driver: {
      name: driver.name ?? "",
      cnic: driver.cnic ?? "",
      contact: driver.contact ?? "",
      picture: driver.picture ?? "",
    },
    goodsItems: (record.goodsItems ?? []).map((g) => ({
      id: g.id,
      qrCodeNumber: g.qrCodeNumber,
      description: g.description,
      pctCode: g.pctCode,
      quantity: g.quantity,
      unit: g.unit,
      condition: g.condition,
      assessableValuePkr: g.assessableValuePkr,
      identificationRef: g.identificationRef,
      itemNotes: g.itemNotes,
      perishable: g.perishable,
      images: g.images ?? [],
    })),
    seizingOfficerNotes: record.seizingOfficerNotes ?? "",
    examiningOfficerNotes: record.examiningOfficerNotes ?? "",
    detentionNotes: record.detentionNotes ?? "",
    memoQrCodeNumber: record.memoQrCodeNumber ?? "",
    memoQrCodePayload: record.memoQrCodePayload ?? "",
    createdBy: record.createdBy ?? "",
    clientOrigin: typeof window !== "undefined" ? window.location.origin : "",
  }
}

export async function updateDetentionMemo(
  record: DetentionMemoApiRecord,
  overrides: Partial<Record<string, unknown>> = {}
): Promise<DetentionMemoApiRecord> {
  const body = { ...memoApiRecordToWritePayload(record), ...overrides }
  const res = await fetch(`${BASE}/${encodeURIComponent(record.id)}/update/`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  })
  let resBody: unknown = null
  try {
    resBody = await res.json()
  } catch {
    // ignore
  }
  if (!res.ok) throw new Error(errorMessage(res, resBody))
  return resBody as DetentionMemoApiRecord
}

function hasCreateMedia(media?: DetentionMemoCreateMedia): boolean {
  if (!media) return false
  return !!(
    media.ownerPhoto ||
    media.driverPhoto ||
    (media.documents?.length ?? 0) > 0 ||
    (media.videos?.length ?? 0) > 0 ||
    (media.goodsImages && Object.keys(media.goodsImages).length > 0)
  )
}

export async function createDetentionMemo(
  payload: Record<string, unknown>,
  media?: DetentionMemoCreateMedia
): Promise<DetentionMemoApiRecord> {
  if (!hasCreateMedia(media)) {
    const res = await fetch(`${BASE}/create/`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      // ignore
    }
    if (!res.ok) throw new Error(errorMessage(res, body))
    return body as DetentionMemoApiRecord
  }

  const form = new FormData()
  form.append("payload", JSON.stringify(payload))
  if (media?.ownerPhoto) form.append("owner_photo", media.ownerPhoto)
  if (media?.driverPhoto) form.append("driver_photo", media.driverPhoto)
  for (const f of media?.documents ?? []) {
    form.append("documents", f)
  }
  for (const f of media?.videos ?? []) {
    form.append("videos", f)
  }
  // Add goods images with prefix based on goods item id
  if (media?.goodsImages) {
    for (const [goodsId, files] of Object.entries(media.goodsImages)) {
      for (let i = 0; i < files.length; i++) {
        form.append(`goods_image_${goodsId}_${i}`, files[i])
      }
    }
  }

  const res = await fetch(`${BASE}/create/`, {
    method: "POST",
    headers: getAuthHeadersFormData(),
    body: form,
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // ignore
  }
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as DetentionMemoApiRecord
}

export async function deleteDetentionMemo(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}/delete/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  })
  if (!res.status.toString().startsWith("2")) {
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      // ignore
    }
    throw new Error(errorMessage(res, body))
  }
}
