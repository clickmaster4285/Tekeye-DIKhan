import { API_BASE_URL, getAuthHeaders, getStoredToken } from "@/lib/api"

const API = `${API_BASE_URL}/api`

export type RemoteServerRecord = {
  id: number
  name: string
  location_code: string
  connection_mode: "ml" | "django"
  base_url: string
  ml_base_url: string
  resolved_ml_base_url?: string
  auth_token_set: boolean
  is_active: boolean
  notes: string
  site?: number | null
  site_code?: string
  site_name?: string
  gpu?: string
  gpu_device?: number | null
  max_cameras?: number
  assigned_count?: number
  available_slots?: number | null
  last_seen_at: string | null
  last_health: string
  last_error: string
  created_by_username?: string
  created_at?: string
  updated_at?: string
}

export type MlGpuInfo = {
  index: number
  name: string
  total_memory_mb?: number | null
  free_memory_mb?: number | null
}

export type RemoteServerWrite = {
  name: string
  location_code?: string
  connection_mode?: "ml" | "django"
  base_url?: string
  ml_base_url?: string
  auth_token?: string
  is_active?: boolean
  notes?: string
  site?: number | null
  gpu?: string
  gpu_device?: number | null
  max_cameras?: number
}

export type DistributionCamera = {
  id: number
  code: string
  name: string
  channel: number
  nvr_id: number | null
  nvr_name: string
  site_id: number | null
  site_code: string
  site_name: string
  ml_server_id: number | null
  ml_server_name: string
  status: string
  is_active: boolean
}

export type DistributionServerColumn = {
  id: number
  name: string
  ml_base_url: string
  location_code: string
  site_id: number | null
  site_code: string
  site_name: string
  gpu: string
  gpu_device?: number | null
  max_cameras: number
  assigned_count: number
  available_slots: number | null
  status: string
  last_health: string
  last_error: string
  last_seen_at: string | null
  is_active: boolean
  cameras: DistributionCamera[]
}

export type DistributionBoard = {
  site_id: number | null
  location_code: string
  total_cameras: number
  unassigned_count: number
  ml_server_count: number
  unassigned: DistributionCamera[]
  servers: DistributionServerColumn[]
  orphan_assigned: DistributionCamera[]
}

export type AutoDistributeResult = {
  total_cameras: number
  ml_server_count: number
  strategy: string
  recommended: Array<{
    ml_server_id: number
    ml_server_name: string
    max_cameras: number
    camera_count: number
    camera_ids: number[]
  }>
  applied: boolean
  moved: number
  warnings?: string[]
}

export type OpsCamera = {
  id: number
  code: string
  name: string
  display_label?: string
  label?: string
  location?: string
  site_code?: string
  site_name?: string
  nvr_name?: string
  channel?: number
  channel_label?: string
  purpose?: string
  purpose_label?: string
  ml_enabled?: boolean
  is_rtsp?: boolean
  ml_stream_key?: string
  ml_live_stream_url?: string
  raw_stream_url?: string
  /** High-quality NVR viewing (ffmpeg), not ML 720p */
  view_stream_url?: string
  /** Hub WebRTC signaling (go2rtc viewing path). Prefer over MJPEG on All Cities wall. */
  webrtc_stream_url?: string
  status?: string
  is_active?: boolean
  connected?: boolean
  has_frame?: boolean
}

export type DetectionEventRow = {
  id: number
  camera?: number
  camera_code?: string
  camera_name?: string
  class_name?: string
  label?: string
  confidence?: number
  is_alert?: boolean
  clip_url?: string
  created_at?: string
}

function formatApiError(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null) {
    if ("detail" in err && typeof (err as { detail: unknown }).detail === "string") {
      return (err as { detail: string }).detail
    }
    if ("error" in err && typeof (err as { error: unknown }).error === "string") {
      return (err as { error: string }).error
    }
    return Object.entries(err)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : String(v)}`)
      .join("; ")
  }
  return fallback
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    return formatApiError(data, fallback)
  } catch {
    return fallback
  }
}

/** Ensure host gets http:// and Django default port :8000 when omitted. */
export function normalizeServerUrl(raw: string, defaultPort = 8000): string {
  let value = (raw || "").trim().replace(/\/$/, "")
  if (!value) return ""
  if (!/^https?:\/\//i.test(value)) {
    value = `http://${value}`
  }
  try {
    const u = new URL(value)
    if (!u.port && defaultPort && u.protocol === "http:") {
      u.port = String(defaultPort)
    }
    // URL.href always has trailing slash for origin-only — strip path slash if empty path
    const href = u.href.replace(/\/$/, "")
    return href
  } catch {
    return value
  }
}

/** ML service URL — default port 8100 when omitted. */
export function normalizeMlUrl(raw: string): string {
  return normalizeServerUrl(raw, 8100)
}

/** Append hub auth token for MJPEG <img> proxy URLs. */
export function withOpsStreamToken(url: string): string {
  const token = getStoredToken()
  if (!token || !url) return url
  if (!url.includes("/api/ops/")) return url
  const sep = url.includes("?") ? "&" : "?"
  if (url.includes("token=")) return url
  return `${url}${sep}token=${encodeURIComponent(token)}`
}

/**
 * Convert an ops MJPEG proxy URL to a single-frame JPEG snapshot URL.
 * Grid views should poll JPEG — browsers only allow ~6 concurrent MJPEG connections per host.
 */
export function opsMjpegUrlToJpeg(url: string): string {
  if (!url) return url
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://local")
    // High-quality view endpoint
    if (u.pathname.includes("/view/")) {
      u.searchParams.set("kind", "jpeg")
      return `${u.pathname}${u.search}`
    }
    const kind = (u.searchParams.get("kind") || "live").toLowerCase()
    if (kind === "raw" || kind === "jpeg_raw" || kind === "raw_jpeg") {
      u.searchParams.set("kind", "jpeg_raw")
    } else {
      u.searchParams.set("kind", "jpeg")
    }
    return `${u.pathname}${u.search}`
  } catch {
    if (url.includes("/view/")) {
      return `${url}${url.includes("?") ? "&" : "?"}kind=jpeg`
    }
    if (/([?&])kind=raw\b/i.test(url)) {
      return url.replace(/([?&])kind=raw\b/i, "$1kind=jpeg_raw")
    }
    if (/[?&]kind=/i.test(url)) {
      return url.replace(/([?&])kind=[^&]*/i, "$1kind=jpeg")
    }
    return `${url}${url.includes("?") ? "&" : "?"}kind=jpeg`
  }
}

export async function listRemoteServers(): Promise<RemoteServerRecord[]> {
  const res = await fetch(`${API}/ops/servers/`, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error(await parseError(res, "Failed to load servers"))
  const data = await res.json()
  if (Array.isArray(data)) return data
  return data.results || []
}

export async function fetchAllCitiesStreams(opts?: {
  refresh?: boolean
  signal?: AbortSignal
}): Promise<{
  servers: Array<{
    id: number
    name: string
    location_code: string
    connection_mode: string
    ml_base_url: string
    last_health: string
    last_error: string
    ok: boolean
    source: string
    error: string
    camera_count: number
  }>
  cameras: Array<
    OpsCamera & {
      server_id?: number
      server_name?: string
      location_code?: string
    }
  >
  count: number
  server_count: number
}> {
  const qs = opts?.refresh ? "?refresh=1" : ""
  const res = await fetch(`${API}/ops/all-cities-streams/${qs}`, {
    headers: getAuthHeaders(),
    signal: opts?.signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(formatApiError(data, "Failed to load all-cities streams"))
  return {
    servers: data.servers || [],
    cameras: data.cameras || [],
    count: data.count ?? (data.cameras || []).length,
    server_count: data.server_count ?? (data.servers || []).length,
  }
}

/** Per-user All Cities camera checkbox selection (persisted in DB). */
export async function fetchAllCitiesSelection(): Promise<string[]> {
  const res = await fetch(`${API}/ops/all-cities-selection/`, {
    headers: getAuthHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(formatApiError(data, "Failed to load camera selection"))
  return Array.isArray(data.selected_camera_keys)
    ? data.selected_camera_keys.filter((k: unknown): k is string => typeof k === "string")
    : []
}

export async function saveAllCitiesSelection(selectedCameraKeys: string[]): Promise<string[]> {
  const res = await fetch(`${API}/ops/all-cities-selection/`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ selected_camera_keys: selectedCameraKeys }),
    keepalive: true,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(formatApiError(data, "Failed to save camera selection"))
  return Array.isArray(data.selected_camera_keys)
    ? data.selected_camera_keys.filter((k: unknown): k is string => typeof k === "string")
    : selectedCameraKeys
}

export async function createRemoteServer(payload: RemoteServerWrite): Promise<RemoteServerRecord> {
  const mode = payload.connection_mode || "ml"
  const body: Record<string, unknown> = {
    name: payload.name,
    location_code: payload.location_code || "",
    connection_mode: mode,
    is_active: payload.is_active !== false,
    notes: payload.notes || "",
    gpu: payload.gpu || "",
    gpu_device: payload.gpu_device ?? null,
    max_cameras: payload.max_cameras ?? 25,
    site: payload.site ?? null,
  }
  if (mode === "ml") {
    body.ml_base_url = normalizeMlUrl(payload.ml_base_url || payload.base_url || "")
    body.base_url = body.ml_base_url
  } else {
    body.base_url = normalizeServerUrl(payload.base_url || "")
    body.ml_base_url = payload.ml_base_url ? normalizeMlUrl(payload.ml_base_url) : ""
  }
  const res = await fetch(`${API}/ops/servers/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res, "Failed to save server"))
  return res.json()
}

export async function updateRemoteServer(
  id: number,
  payload: Partial<RemoteServerWrite>
): Promise<RemoteServerRecord> {
  const body: Record<string, unknown> = { ...payload }
  if (payload.ml_base_url) body.ml_base_url = normalizeMlUrl(payload.ml_base_url)
  if (payload.base_url) body.base_url = normalizeServerUrl(payload.base_url)
  const res = await fetch(`${API}/ops/servers/${id}/`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res, "Failed to update server"))
  return res.json()
}

export async function deleteRemoteServer(id: number): Promise<void> {
  const res = await fetch(`${API}/ops/servers/${id}/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error(await parseError(res, "Failed to delete server"))
}

export async function removeServerCamera(
  serverId: number,
  payload: { stream_key?: string; ml_stream_key?: string; camera_id?: number; code?: string }
): Promise<{ ok: boolean; removed_remote: boolean; warnings: string[]; remaining_count: number }> {
  const res = await fetch(`${API}/ops/servers/${serverId}/remove-camera/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(formatApiError(data, "Failed to remove camera"))
  return {
    ok: Boolean(data.ok),
    removed_remote: Boolean(data.removed_remote),
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    remaining_count: data.remaining_count ?? 0,
  }
}

export async function testRemoteServer(
  id: number,
  opts?: { gpu_device?: number | null }
): Promise<{
  ok: boolean
  error?: string
  gpus?: MlGpuInfo[]
  server?: RemoteServerRecord
}> {
  const body: Record<string, unknown> = {}
  if (opts && "gpu_device" in opts) body.gpu_device = opts.gpu_device ?? null
  const res = await fetch(`${API}/ops/servers/${id}/test/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(formatApiError(data, "Connection test failed"))
  return data
}

export async function probeMlGpus(mlBaseUrl?: string): Promise<{
  ok: boolean
  ml_base_url: string
  gpus: MlGpuInfo[]
  ml_device?: string | number | null
  cuda_available?: boolean
  cuda_device_name?: string | null
  cuda_device_count?: number
  error?: string
  source?: string
}> {
  const trimmed = (mlBaseUrl || "").trim()
  const body: Record<string, unknown> = {}
  if (trimmed) body.ml_base_url = normalizeMlUrl(trimmed)

  const tryFetch = async (path: string) => {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    return { res, data }
  }

  // Prefer probe-gpus; fall back to host-gpus alias if an old server returns 404.
  let { res, data } = await tryFetch("/ops/probe-gpus/")
  if (res.status === 404) {
    ;({ res, data } = await tryFetch("/ops/host-gpus/"))
  }

  const gpus = Array.isArray(data.gpus) ? data.gpus : []
  if (!res.ok && gpus.length === 0) {
    throw new Error(formatApiError(data, "Failed to detect GPUs"))
  }
  return {
    ok: Boolean(data.ok) || gpus.length > 0,
    ml_base_url: data.ml_base_url || (trimmed ? normalizeMlUrl(trimmed) : ""),
    gpus,
    ml_device: data.ml_device ?? null,
    cuda_available: data.cuda_available,
    cuda_device_name: data.cuda_device_name ?? null,
    cuda_device_count: data.cuda_device_count,
    error: data.error,
    source: data.source,
  }
}

export async function fetchServerCameras(id: number): Promise<{
  cameras: OpsCamera[]
  server_name: string
  count: number
}> {
  const res = await fetch(`${API}/ops/servers/${id}/cameras/`, { headers: getAuthHeaders() })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(formatApiError(data, "Failed to fetch cameras"))
  return {
    cameras: data.cameras || [],
    server_name: data.server_name || "",
    count: data.count ?? (data.cameras || []).length,
  }
}

export async function fetchServerDetections(
  id: number,
  opts?: { page?: number; page_size?: number; is_alert?: boolean }
): Promise<{ results: DetectionEventRow[]; count: number }> {
  const params = new URLSearchParams()
  if (opts?.page) params.set("page", String(opts.page))
  if (opts?.page_size) params.set("page_size", String(opts.page_size))
  if (opts?.is_alert != null) params.set("is_alert", opts.is_alert ? "true" : "false")
  const qs = params.toString()
  const res = await fetch(`${API}/ops/servers/${id}/detection-events/${qs ? `?${qs}` : ""}`, {
    headers: getAuthHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(formatApiError(data, "Failed to fetch detections"))
  return { results: data.results || [], count: data.count || 0 }
}

export async function quickConnect(payload: {
  name?: string
  connection_mode?: "ml" | "django"
  base_url?: string
  ml_base_url?: string
  save?: boolean
}): Promise<{
  cameras: OpsCamera[]
  count: number
  base_url: string
  ml_base_url: string
  server_id?: number | null
  server_name?: string
  connection_mode?: string
}> {
  const mode = payload.connection_mode || "ml"
  const body: Record<string, unknown> = {
    name: payload.name || "",
    connection_mode: mode,
    save: payload.save !== false,
  }
  if (mode === "ml") {
    body.ml_base_url = normalizeMlUrl(payload.ml_base_url || payload.base_url || "")
    body.base_url = ""
  } else {
    body.base_url = normalizeServerUrl(payload.base_url || "")
    body.ml_base_url = payload.ml_base_url ? normalizeMlUrl(payload.ml_base_url) : ""
  }
  const res = await fetch(`${API}/ops/quick-connect/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(formatApiError(data, "Quick connect failed"))
  return {
    cameras: data.cameras || [],
    count: data.count ?? (data.cameras || []).length,
    base_url: data.base_url,
    ml_base_url: data.ml_base_url,
    server_id: data.server_id ?? null,
    server_name: data.server_name,
    connection_mode: data.connection_mode,
  }
}

export async function fetchDistributionBoard(opts?: {
  site_id?: number | null
  location_code?: string
}): Promise<DistributionBoard> {
  const params = new URLSearchParams()
  if (opts?.site_id != null) params.set("site_id", String(opts.site_id))
  if (opts?.location_code) params.set("location_code", opts.location_code)
  const qs = params.toString() ? `?${params.toString()}` : ""
  const res = await fetch(`${API}/ops/distribution/${qs}`, { headers: getAuthHeaders() })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(formatApiError(data, "Failed to load distribution board"))
  return {
    site_id: data.site_id ?? null,
    location_code: data.location_code || "",
    total_cameras: data.total_cameras ?? 0,
    unassigned_count: data.unassigned_count ?? 0,
    ml_server_count: data.ml_server_count ?? 0,
    unassigned: data.unassigned || [],
    servers: data.servers || [],
    orphan_assigned: data.orphan_assigned || [],
  }
}

export async function assignCameraToMlServer(payload: {
  camera_id: number
  ml_server_id: number | null
  enforce_capacity?: boolean
}): Promise<{
  camera: DistributionCamera
  previous_ml_server_id: number | null
  ml_server_id: number | null
  routing?: { registered?: boolean; warnings?: string[]; ml_url?: string }
}> {
  const res = await fetch(`${API}/ops/distribution/assign/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(formatApiError(data, "Failed to assign camera"))
  return data
}

export async function autoDistributeCameras(payload: {
  site_id?: number | null
  location_code?: string
  dry_run?: boolean
  apply?: boolean
}): Promise<AutoDistributeResult> {
  const res = await fetch(`${API}/ops/distribution/auto/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(formatApiError(data, "Auto-distribute failed"))
  return {
    total_cameras: data.total_cameras ?? 0,
    ml_server_count: data.ml_server_count ?? 0,
    strategy: data.strategy || "",
    recommended: data.recommended || [],
    applied: Boolean(data.applied),
    moved: data.moved ?? 0,
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
  }
}

export async function unassignAllCamerasFromServer(ml_server_id: number): Promise<{
  ml_server_id: number
  ml_server_name: string
  total: number
  unassigned: number
  warnings: string[]
}> {
  const res = await fetch(`${API}/ops/distribution/unassign-all/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ ml_server_id }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(formatApiError(data, "Failed to unassign cameras"))
  return {
    ml_server_id: data.ml_server_id,
    ml_server_name: data.ml_server_name || "",
    total: data.total ?? 0,
    unassigned: data.unassigned ?? 0,
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
  }
}

