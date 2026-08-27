/**
 * WMS lifecycle API — seizure, release, QR resolve, overview.
 */
import { API_BASE_URL, getAuthHeaders } from "@/lib/api"

const BASE = `${API_BASE_URL}/api/warehouse`

function errorMessage(res: Response, body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    return String((body as { detail: unknown }).detail)
  }
  return `Request failed (${res.status})`
}

export type WmsStockApiRow = {
  id: string
  detention_memo_id?: string
  goods_line_id?: string
  client_row_id?: string
  case_ref: string
  qr_code: string
  description: string
  pct_code: string
  quantity: string
  unit: string
  godown_warehouse: string
  status: string
  updated_at?: string
}

export type SeizureRecordApi = {
  id: string
  detention_memo_id: string
  deposit_account_id?: string
  case_no: string
  fir_number?: string
  place_of_detention?: string
  source: string
  seized_at: string
  seized_by?: string
  remarks?: string
}

export type ReleaseRecordApi = {
  id: string
  detention_memo_id?: string
  deposit_account_id?: string
  case_no: string
  qr_code: string
  warehouse: string
  quantity_released?: string
  unit?: string
  released_on_behalf_of?: string
  deputy_name?: string
  collector_name?: string
  release_description?: string
  released_at: string
  released_by?: string
  remarks?: string
}

export type WmsLifecycleEventApi = {
  id: string
  event_type: string
  detention_memo_id?: string
  qr_code?: string
  case_no?: string
  description?: string
  quantity?: string
  unit?: string
  performed_by?: string
  created_at: string
  metadata?: Record<string, unknown>
}

export type WmsOverview = {
  found: boolean
  memo?: {
    id: string
    caseNo: string
    firNumber?: string
    settlementStatus?: string
    dispositionStatus?: string
    placeOfDetention?: string
  }
  goodsLines?: Array<{
    id: string
    qrCodeNumber: string
    description: string
    quantity: string
    unit: string
    condition: string
  }>
  summary?: {
    totalGoodsLines: number
    totalGoodsQuantity: string
    deposited: boolean
    depositCount: number
    seized: boolean
    seizureCount: number
    released: boolean
    releaseCount: number
    inInventoryCount: number
    inInventoryQuantity: string
    releasedQuantity: string
    destructedCount: number
    destructedQuantity: string
    destructionSessionCount: number
  }
  deposits?: Array<{ id: string; caseSeizureRef: string; status: string; depositType: string }>
  seizures?: Array<{ id: string; caseNo: string; seizedAt: string; seizedBy?: string; source: string }>
  releases?: Array<{
    id: string
    qrCode: string
    warehouse: string
    quantityReleased?: string
    unit?: string
    releasedOnBehalfOf?: string
    deputyName?: string
    collectorName?: string
    releaseDescription?: string
    releasedAt: string
    releasedBy?: string
  }>
  stockItems?: Array<{
    id: string
    qrCode: string
    caseRef: string
    description: string
    quantity: string
    unit: string
    status: string
    godownWarehouse: string
  }>
  destructions?: Array<{
    id: string
    caseNo: string
    outcome: string
    completedAt?: string
    performedBy?: string
    locationCode?: string
    videos?: Array<{ camera_id?: number; url?: string; filename?: string }>
    videoUrl?: string
    selectedItems?: unknown[]
    inventoryDeductions?: unknown[]
  }>
  timeline?: WmsLifecycleEventApi[]
}

export type QrResolveResult = {
  qr_code: string
  type: string
  memo?: WmsOverview["memo"]
  goods_line?: { id: string; qrCodeNumber: string; description: string; quantity: string; unit: string }
  stock?: { id: string; qrCode: string; caseRef: string; description: string; quantity: string; status: string }
  deposit?: { id: string; caseSeizureRef: string; status: string }
}

export async function fetchWarehouseStock(params?: {
  detentionMemoId?: string
  caseRef?: string
}): Promise<WmsStockApiRow[]> {
  const url = new URL(`${BASE}/stock/`)
  if (params?.detentionMemoId) url.searchParams.set("detention_memo_id", params.detentionMemoId)
  if (params?.caseRef) url.searchParams.set("case_ref", params.caseRef)
  const res = await fetch(url.toString(), { headers: getAuthHeaders(), cache: "no-store" })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // ignore
  }
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as WmsStockApiRow[]
}

export async function promoteSeizure(payload: {
  detentionMemoId: string
  depositAccountId?: string
  source?: string
  remarks?: string
}): Promise<{ seizure: SeizureRecordApi; stockItems: WmsStockApiRow[] }> {
  const res = await fetch(`${BASE}/seizure/promote/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      detention_memo_id: payload.detentionMemoId,
      deposit_account_id: payload.depositAccountId,
      source: payload.source,
      remarks: payload.remarks,
    }),
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // ignore
  }
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as { seizure: SeizureRecordApi; stockItems: WmsStockApiRow[] }
}

export type ReleaseItemLine = {
  stockId: string
  qrCode: string
  description: string
  availableQty: string
  unit: string
  releaseQty: string
  godownWarehouse?: string
}

/** In-custody stock lines for a detention memo (fallback to memo goods lines). */
export async function fetchReleaseItemLinesForMemo(detentionMemoId: string): Promise<ReleaseItemLine[]> {
  try {
    const stock = await fetchWarehouseStock({ detentionMemoId })
    const inCustody = stock.filter(
      (s) => (s.status || "").toLowerCase() === "in custody" && Number(s.quantity) > 0
    )
    if (inCustody.length > 0) {
      return inCustody.map((s) => ({
        stockId: s.id,
        qrCode: s.qr_code,
        description: s.description || "—",
        availableQty: String(s.quantity),
        unit: s.unit || "PCS",
        releaseQty: "",
        godownWarehouse: s.godown_warehouse,
      }))
    }
  } catch {
    // fall through
  }

  try {
    const overview = await fetchWmsOverview({ detentionMemoId })
    return (overview.goodsLines || []).map((g) => ({
      stockId: "",
      qrCode: g.qrCodeNumber,
      description: g.description || "—",
      availableQty: String(g.quantity),
      unit: g.unit || "PCS",
      releaseQty: "",
    }))
  } catch {
    return []
  }
}

export type ReleaseItemPayload = {
  stockItemId?: string
  qrCode: string
  quantity: string
  unit?: string
  description?: string
}

export async function releaseInventoryApi(payload: {
  depositAccountId?: string
  detentionMemoId?: string
  qrCode?: string
  warehouse: string
  quantityReleased?: string
  unit?: string
  releasedOnBehalfOf: string
  deputyName: string
  collectorName: string
  releaseDescription: string
  releasedItems?: ReleaseItemPayload[]
  firNumber?: string
  stackCount?: string
  treasuryChallanNo?: string
  customsStation?: string
  amount?: string
  bankTreasuryName?: string
  remarks?: string
  settleMemo?: boolean
}): Promise<{ release: ReleaseRecordApi; stockItems: WmsStockApiRow[] }> {
  const res = await fetch(`${BASE}/release/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      deposit_account_id: payload.depositAccountId,
      detention_memo_id: payload.detentionMemoId,
      qr_code: payload.qrCode,
      warehouse: payload.warehouse,
      quantity_released: payload.quantityReleased,
      unit: payload.unit || "PCS",
      released_on_behalf_of: payload.releasedOnBehalfOf,
      deputy_name: payload.deputyName,
      collector_name: payload.collectorName,
      release_description: payload.releaseDescription,
      released_items: payload.releasedItems?.map((item) => ({
        stock_item_id: item.stockItemId,
        qr_code: item.qrCode,
        quantity: item.quantity,
        unit: item.unit,
        description: item.description,
      })),
      fir_number: payload.firNumber,
      stack_count: payload.stackCount,
      treasury_challan_no: payload.treasuryChallanNo,
      customs_station: payload.customsStation,
      amount: payload.amount,
      bank_treasury_name: payload.bankTreasuryName,
      remarks: payload.remarks,
      settle_memo: payload.settleMemo ?? true,
    }),
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // ignore
  }
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as { release: ReleaseRecordApi; stockItems: WmsStockApiRow[] }
}

export async function resolveQrCode(code: string): Promise<QrResolveResult> {
  const encoded = encodeURIComponent(code.trim())
  const res = await fetch(`${BASE}/qr/${encoded}/resolve/`, {
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
  return body as QrResolveResult
}

export async function fetchWmsOverview(params: {
  detentionMemoId?: string
  caseNo?: string
}): Promise<WmsOverview> {
  const url = new URL(`${BASE}/overview/`)
  if (params.detentionMemoId) url.searchParams.set("detention_memo_id", params.detentionMemoId)
  if (params.caseNo) url.searchParams.set("case_no", params.caseNo)
  const res = await fetch(url.toString(), { headers: getAuthHeaders(), cache: "no-store" })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // ignore
  }
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as WmsOverview
}

export async function fetchSeizureRecords(params?: {
  detentionMemoId?: string
  caseNo?: string
}): Promise<SeizureRecordApi[]> {
  const url = new URL(`${BASE}/seizures/`)
  if (params?.detentionMemoId) url.searchParams.set("detention_memo_id", params.detentionMemoId)
  if (params?.caseNo) url.searchParams.set("case_no", params.caseNo)
  const res = await fetch(url.toString(), { headers: getAuthHeaders(), cache: "no-store" })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // ignore
  }
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as SeizureRecordApi[]
}

export async function fetchReleaseRecords(detentionMemoId?: string): Promise<ReleaseRecordApi[]> {
  const url = new URL(`${BASE}/releases/`)
  if (detentionMemoId) url.searchParams.set("detention_memo_id", detentionMemoId)
  const res = await fetch(url.toString(), { headers: getAuthHeaders(), cache: "no-store" })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // ignore
  }
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as ReleaseRecordApi[]
}

export function apiStockToWmsRow(row: WmsStockApiRow) {
  return {
    id: row.id,
    qrCodeNumber: row.qr_code,
    seizureCaseRef: row.case_ref,
    pctCode: row.pct_code,
    descriptionOfGoods: row.description,
    godownWarehouse: row.godown_warehouse,
    quantity: String(row.quantity),
    unitOfMeasure: row.unit || "PCS",
    condition: "Seized",
    status: row.status || "In Custody",
    detentionMemoId: row.detention_memo_id,
    detentionCaseNo: row.case_ref,
  }
}
