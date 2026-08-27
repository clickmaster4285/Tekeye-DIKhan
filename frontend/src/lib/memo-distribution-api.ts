import { API_BASE_URL, getAuthHeaders } from "@/lib/api"
import type { WmsStockRow } from "@/lib/wms-stock-storage"

const BASE = `${API_BASE_URL}/api/warehouse`

export type SelectedDestructionItem = {
  goodsLineId: string
  description: string
  qrCode: string
  quantity: string
  unit: string
}

export type MemoDistributionRecord = {
  id: string
  detentionMemoId: string
  detentionCaseNo: string
  camera: number | null
  cameraIds: number[]
  cameraName: string
  cameraVideos: Array<{
    camera_id: number
    filename: string
    path?: string
    url?: string
    size_bytes?: number
    duration_seconds?: number
    includes_ml_overlay?: boolean
    recording_source?: string
  }>
  cameraVideoEntries: Array<{
    camera_id: number
    filename: string
    path?: string
    url?: string
    size_bytes?: number
    duration_seconds?: number
    includes_ml_overlay?: boolean
    recording_source?: string
  }>
  selectedItems: Array<{
    goods_line_id: string
    description: string
    qr_code: string
    quantity: string
    unit: string
  }>
  locationCode: string
  smokeFireDetected: boolean
  videoUrl: string | null
  outcome: "" | "inventory_deducted" | "destructed"
  status: "recording" | "completed" | "failed"
  performedBy: string
  notes: string
  inventoryDeductions: Array<{
    stock_id: string
    client_row_id?: string
    detention_memo_id?: string
    detention_case_no?: string
    goods_line_id?: string
    case_ref: string
    qr_code: string
    description?: string
    quantity_before: string
    quantity_deducted: string
    quantity_after: string
    status?: string
  }>
  errorMessage: string
  createdAt: string
  completedAt: string | null
}

export type FireSmokeLogRecord = {
  id: string
  distribution: string | null
  destructionAlert: string | null
  detentionMemoId: string
  detentionCaseNo: string
  detentionFirNumber: string
  warehouseName: string
  locationCode: string
  placeOfDetention: string
  placeOfOccurrence: string
  camera: number | null
  cameraCode: string
  cameraName: string
  cameraIp: string
  cameraZone: string
  cameraSiteLabel: string
  detectionClass: string
  detectionLabel: string
  confidence: number
  bbox: number[]
  detectionCount: number
  detections: Array<Record<string, unknown>>
  alertTriggered: boolean
  performedBy: string
  sessionStatus: string
  createdAt: string
}

export type DestructionAlertRecord = {
  id: string
  distribution: string | null
  detentionMemoId: string
  detentionCaseNo: string
  camera: number | null
  cameraName: string
  locationCode: string
  alertType: string
  severity: string
  message: string
  detectionClass: string
  confidence: number
  acknowledged: boolean
  createdAt: string
}

function mapDistribution(raw: Record<string, unknown>): MemoDistributionRecord {
  return {
    id: String(raw.id),
    detentionMemoId: String(raw.detention_memo_id),
    detentionCaseNo: String(raw.detention_case_no || ""),
    camera: raw.camera != null ? Number(raw.camera) : null,
    cameraIds: Array.isArray(raw.camera_ids) ? (raw.camera_ids as number[]) : [],
    cameraName: String(raw.camera_name || ""),
    cameraVideos: Array.isArray(raw.camera_videos)
      ? (raw.camera_videos as MemoDistributionRecord["cameraVideos"])
      : [],
    cameraVideoEntries: Array.isArray(raw.camera_video_entries)
      ? (raw.camera_video_entries as MemoDistributionRecord["cameraVideoEntries"])
      : Array.isArray(raw.camera_videos)
        ? (raw.camera_videos as MemoDistributionRecord["cameraVideoEntries"])
        : [],
    selectedItems: Array.isArray(raw.selected_items)
      ? (raw.selected_items as MemoDistributionRecord["selectedItems"])
      : [],
    locationCode: String(raw.location_code || ""),
    smokeFireDetected: Boolean(raw.smoke_fire_detected),
    videoUrl: raw.video_url ? String(raw.video_url) : null,
    outcome: (raw.outcome as MemoDistributionRecord["outcome"]) || "",
    status: (raw.status as MemoDistributionRecord["status"]) || "recording",
    performedBy: String(raw.performed_by || ""),
    notes: String(raw.notes || ""),
    inventoryDeductions: Array.isArray(raw.inventory_deductions)
      ? (raw.inventory_deductions as MemoDistributionRecord["inventoryDeductions"])
      : [],
    errorMessage: String(raw.error_message || ""),
    createdAt: String(raw.created_at || ""),
    completedAt: raw.completed_at ? String(raw.completed_at) : null,
  }
}

function mapFireSmokeLog(raw: Record<string, unknown>): FireSmokeLogRecord {
  return {
    id: String(raw.id),
    distribution: raw.distribution != null ? String(raw.distribution) : null,
    destructionAlert: raw.destruction_alert != null ? String(raw.destruction_alert) : null,
    detentionMemoId: String(raw.detention_memo_id),
    detentionCaseNo: String(raw.detention_case_no || ""),
    detentionFirNumber: String(raw.detention_fir_number || ""),
    warehouseName: String(raw.warehouse_name || ""),
    locationCode: String(raw.location_code || ""),
    placeOfDetention: String(raw.place_of_detention || ""),
    placeOfOccurrence: String(raw.place_of_occurrence || ""),
    camera: raw.camera != null ? Number(raw.camera) : null,
    cameraCode: String(raw.camera_code || ""),
    cameraName: String(raw.camera_name || ""),
    cameraIp: String(raw.camera_ip || ""),
    cameraZone: String(raw.camera_zone || ""),
    cameraSiteLabel: String(raw.camera_site_label || ""),
    detectionClass: String(raw.detection_class || ""),
    detectionLabel: String(raw.detection_label || ""),
    confidence: Number(raw.confidence || 0),
    bbox: Array.isArray(raw.bbox) ? (raw.bbox as number[]) : [],
    detectionCount: Number(raw.detection_count || 0),
    detections: Array.isArray(raw.detections) ? (raw.detections as Array<Record<string, unknown>>) : [],
    alertTriggered: Boolean(raw.alert_triggered),
    performedBy: String(raw.performed_by || ""),
    sessionStatus: String(raw.session_status || ""),
    createdAt: String(raw.created_at || ""),
  }
}

function mapAlert(raw: Record<string, unknown>): DestructionAlertRecord {
  return {
    id: String(raw.id),
    distribution: raw.distribution != null ? String(raw.distribution) : null,
    detentionMemoId: String(raw.detention_memo_id),
    detentionCaseNo: String(raw.detention_case_no || ""),
    camera: raw.camera != null ? Number(raw.camera) : null,
    cameraName: String(raw.camera_name || ""),
    locationCode: String(raw.location_code || ""),
    alertType: String(raw.alert_type || ""),
    severity: String(raw.severity || ""),
    message: String(raw.message || ""),
    detectionClass: String(raw.detection_class || ""),
    confidence: Number(raw.confidence || 0),
    acknowledged: Boolean(raw.acknowledged),
    createdAt: String(raw.created_at || ""),
  }
}

export type WarehouseStockRecord = {
  id: string
  detentionMemoId: string | null
  caseRef: string
  qrCode: string
  description: string
  quantity: string
  unit: string
  status: string
}

export async function fetchWarehouseStock(detentionMemoId?: string): Promise<WarehouseStockRecord[]> {
  const params = detentionMemoId ? `?detention_memo_id=${encodeURIComponent(detentionMemoId)}` : ""
  const res = await fetch(`${BASE}/stock/${params}`, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error("Failed to load warehouse stock")
  const data = await res.json()
  if (!Array.isArray(data)) return []
  return data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    detentionMemoId: row.detention_memo_id ? String(row.detention_memo_id) : null,
    caseRef: String(row.case_ref || ""),
    qrCode: String(row.qr_code || ""),
    description: String(row.description || ""),
    quantity: String(row.quantity ?? "0"),
    unit: String(row.unit || ""),
    status: String(row.status || ""),
  }))
}

export async function syncWarehouseStock(items: WmsStockRow[]): Promise<{ synced: number; created: number }> {
  const payload = items.map((row) => ({
    id: row.id,
    seizureCaseRef: row.seizureCaseRef,
    qrCodeNumber: row.qrCodeNumber,
    descriptionOfGoods: row.descriptionOfGoods,
    pctCode: row.pctCode,
    quantity: row.quantity,
    unitOfMeasure: row.unitOfMeasure,
    godownWarehouse: row.godownWarehouse,
    status: row.status,
    detentionMemoId: row.detentionMemoId,
  }))
  const res = await fetch(`${BASE}/stock/sync/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ items: payload }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(typeof err === "object" && err && "detail" in err ? String(err.detail) : "Stock sync failed")
  }
  return res.json()
}

export async function startMemoDistribution(payload: {
  detentionMemoId: string
  cameraIds: number[]
  selectedItems: SelectedDestructionItem[]
}): Promise<MemoDistributionRecord> {
  const res = await fetch(`${BASE}/distribution/start/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      detention_memo_id: payload.detentionMemoId,
      camera_ids: payload.cameraIds,
      selected_items: payload.selectedItems.map((item) => ({
        goods_line_id: item.goodsLineId,
        qr_code: item.qrCode,
        quantity: item.quantity,
      })),
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof data === "object" && data && "detail" in data ? String(data.detail) : "Could not start recording")
  }
  return mapDistribution(data as Record<string, unknown>)
}

export async function reportDestructionDetection(
  sessionId: string,
  payload: {
    cameraId: number
    detections: Array<{
      class_name: string
      label: string
      confidence: number
      alert?: boolean
    }>
  }
): Promise<{
  logCreated: boolean
  log?: FireSmokeLogRecord
  alertCreated: boolean
  alert?: DestructionAlertRecord
}> {
  const res = await fetch(`${BASE}/distribution/${sessionId}/detection/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      camera_id: payload.cameraId,
      detections: payload.detections,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof data === "object" && data && "detail" in data ? String(data.detail) : "Detection report failed")
  }
  const raw = data as {
    log_created?: boolean
    log?: Record<string, unknown>
    alert_created?: boolean
    alert?: Record<string, unknown>
  }
  return {
    logCreated: Boolean(raw.log_created),
    log: raw.log ? mapFireSmokeLog(raw.log) : undefined,
    alertCreated: Boolean(raw.alert_created),
    alert: raw.alert ? mapAlert(raw.alert) : undefined,
  }
}

export async function fetchFireSmokeLogs(opts?: {
  distributionId?: string
  detentionMemoId?: string
  cameraId?: number
  locationCode?: string
}): Promise<FireSmokeLogRecord[]> {
  const url = new URL(`${BASE}/fire-smoke-logs/`)
  if (opts?.distributionId) url.searchParams.set("distribution_id", opts.distributionId)
  if (opts?.detentionMemoId) url.searchParams.set("detention_memo_id", opts.detentionMemoId)
  if (opts?.cameraId != null) url.searchParams.set("camera_id", String(opts.cameraId))
  if (opts?.locationCode) url.searchParams.set("location_code", opts.locationCode)
  const res = await fetch(url.toString(), { headers: getAuthHeaders() })
  if (!res.ok) throw new Error("Failed to load fire/smoke logs")
  const data = await res.json()
  return Array.isArray(data) ? data.map((row) => mapFireSmokeLog(row as Record<string, unknown>)) : []
}

export async function completeMemoDistribution(sessionId: string): Promise<MemoDistributionRecord> {
  const res = await fetch(`${BASE}/distribution/${sessionId}/complete/`, {
    method: "POST",
    headers: getAuthHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof data === "object" && data && "detail" in data ? String(data.detail) : "Could not complete distribution")
  }
  return mapDistribution(data as Record<string, unknown>)
}

export async function fetchMemoDistributions(opts?: {
  detentionMemoId?: string
  caseRef?: string
}): Promise<MemoDistributionRecord[]> {
  const params = new URLSearchParams()
  if (opts?.detentionMemoId) params.set("detention_memo_id", opts.detentionMemoId)
  if (opts?.caseRef) params.set("case_ref", opts.caseRef)
  const qs = params.toString() ? `?${params}` : ""
  const res = await fetch(`${BASE}/distribution/${qs}`, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error("Failed to load distribution history")
  const data = await res.json()
  return Array.isArray(data) ? data.map((row) => mapDistribution(row as Record<string, unknown>)) : []
}

export async function fetchMemoDistributionById(sessionId: string): Promise<MemoDistributionRecord> {
  const res = await fetch(`${BASE}/distribution/${sessionId}/`, { headers: getAuthHeaders() })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data && "detail" in data ? String(data.detail) : "Failed to load destruction record"
    )
  }
  return mapDistribution(data as Record<string, unknown>)
}

export async function fetchDestructionAlerts(opts?: {
  distributionId?: string
  unacknowledgedOnly?: boolean
}): Promise<DestructionAlertRecord[]> {
  const url = new URL(`${BASE}/destruction-alerts/`)
  if (opts?.distributionId) url.searchParams.set("distribution_id", opts.distributionId)
  if (opts?.unacknowledgedOnly) url.searchParams.set("unacknowledged", "1")
  const res = await fetch(url.toString(), { headers: getAuthHeaders() })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const detail =
      typeof err === "object" && err && "detail" in err ? String((err as { detail: unknown }).detail) : ""
    throw new Error(detail || `Failed to load destruction alerts (${res.status})`)
  }
  const data = await res.json()
  return Array.isArray(data) ? data.map((row) => mapAlert(row as Record<string, unknown>)) : []
}
