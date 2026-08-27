import { API_BASE_URL, getAuthHeaders, getStoredToken } from "@/lib/api"

const API = `${API_BASE_URL}/api`

export type RemoteServerRecord = {
  id: number
  name: string
  location_code: string
  connection_mode: "ml" | "django"
  base_url: string
  ml_base_url: string
  auth_token_set: boolean
  is_active: boolean
  notes: string
  last_seen_at: string | null
  last_health: string
  last_error: string
  created_by_username?: string
  created_at?: string
  updated_at?: string
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
}

export type OpsCamera = {
  id: number
  code: string
  name: string
  label?: string
  location?: string
  site_code?: string
  site_name?: string
  nvr_name?: string
  channel?: number
  purpose?: string
  purpose_label?: string
  ml_enabled?: boolean
  is_rtsp?: boolean
  ml_stream_key?: string
  ml_live_stream_url?: string
  raw_stream_url?: string
  status?: string
  is_active?: boolean
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

export async function listRemoteServers(): Promise<RemoteServerRecord[]> {
  const res = await fetch(`${API}/ops/servers/`, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error(await parseError(res, "Failed to load servers"))
  const data = await res.json()
  if (Array.isArray(data)) return data
  return data.results || []
}

export async function createRemoteServer(payload: RemoteServerWrite): Promise<RemoteServerRecord> {
  const mode = payload.connection_mode || "ml"
  const body: Record<string, unknown> = {
    name: payload.name,
    location_code: payload.location_code || "",
    connection_mode: mode,
    is_active: payload.is_active !== false,
    notes: payload.notes || "",
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
  const res = await fetch(`${API}/ops/servers/${id}/`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
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

export async function testRemoteServer(id: number): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${API}/ops/servers/${id}/test/`, {
    method: "POST",
    headers: getAuthHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(formatApiError(data, "Connection test failed"))
  return data
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

