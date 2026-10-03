import { API_BASE_URL, getAuthHeaders } from "@/lib/api"

export type MobileDeviceRecord = {
  id: number
  user_id: number
  staff_name: string
  username: string
  device_uuid: string
  device_name: string
  platform: string
  browser: string
  os_version: string
  app_version: string
  pwa_version: string
  is_active: boolean
  is_revoked: boolean
  mobile_access_enabled: boolean
  status: string
  registered_at: string | null
  last_seen_at: string | null
  last_gps_at: string | null
  last_heartbeat_at: string | null
  last_latitude: number | null
  last_longitude: number | null
  battery_level: number | null
  last_gps_status: string
  session_status: string | null
  session_id: string | null
  logged_in: boolean
  installed: boolean
}

export type MobileAlertRecord = {
  id: number
  alert_type: string
  severity: "INFO" | "WARNING" | "CRITICAL" | string
  message: string
  staff_name: string
  user_id: number
  staff_id: number | null
  device_id: number | null
  device_uuid: string | null
  device_name: string | null
  created_at: string
  detected_at: string
  is_active: boolean
  last_gps_at: string | null
  last_heartbeat_at: string | null
  last_latitude: number | null
  last_longitude: number | null
  battery_level: number | null
  device_status: string | null
  session_status: string | null
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data?.detail === "string") return data.detail
  } catch {
    /* ignore */
  }
  return fallback
}

export async function fetchMobileDevices(params?: { userId?: number; username?: string }): Promise<MobileDeviceRecord[]> {
  const sp = new URLSearchParams()
  if (params?.userId) sp.set("user_id", String(params.userId))
  if (params?.username) sp.set("username", params.username)
  const q = sp.toString() ? `?${sp}` : ""
  const res = await fetch(`${API_BASE_URL}/api/mobile-devices/${q}`, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error(await readError(res, "Failed to load devices"))
  const data = await res.json()
  return Array.isArray(data?.results) ? data.results : []
}

export async function fetchMobileDevice(id: number): Promise<MobileDeviceRecord> {
  const res = await fetch(`${API_BASE_URL}/api/mobile-devices/${id}/`, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error(await readError(res, "Failed to load device"))
  return res.json()
}

export async function fetchMobileAlerts(): Promise<MobileAlertRecord[]> {
  const res = await fetch(`${API_BASE_URL}/api/mobile-alerts/?active=1`, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error(await readError(res, "Failed to load alerts"))
  const data = await res.json()
  return Array.isArray(data?.results) ? data.results : []
}

export async function acknowledgeMobileAlert(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/mobile-alerts/${id}/acknowledge/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: "{}",
  })
  if (!res.ok) throw new Error(await readError(res, "Failed to acknowledge alert"))
}

export async function revokeMobileDevice(id: number, reason = ""): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/mobile-devices/${id}/revoke/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason }),
  })
  if (!res.ok) throw new Error(await readError(res, "Failed to revoke device"))
}

export async function terminateMobileDeviceSession(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/mobile-devices/${id}/terminate-session/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: "{}",
  })
  if (!res.ok) throw new Error(await readError(res, "Failed to terminate session"))
}

export async function disableMobileAccess(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/mobile-devices/${id}/disable-access/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: "{}",
  })
  if (!res.ok) throw new Error(await readError(res, "Failed to disable mobile access"))
}
