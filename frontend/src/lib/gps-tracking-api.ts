import { API_BASE_URL, getAuthHeaders } from "@/lib/api"

const API = `${API_BASE_URL}/api/gps`

export type GpsStatus = "live" | "stale" | "offline"

export type GpsOfficer = {
  userId: number
  username: string
  name: string
  role: string
  employeeId?: string
  location: string
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  speedKmh?: number | null
  headingDeg?: number | null
  altitudeM?: number | null
  recordedAt: string | null
  onDuty: boolean
  dutyStartedAt: string | null
  batteryPct: number | null
  status: GpsStatus
}

export type GpsHistoryPoint = {
  latitude: number
  longitude: number
  accuracy: number | null
  recordedAt: string | null
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data?.detail === "string") return data.detail
    if (Array.isArray(data?.detail) && data.detail[0]) return String(data.detail[0])
    const first = data && typeof data === "object" ? Object.values(data)[0] : null
    if (Array.isArray(first) && first[0]) return String(first[0])
  } catch {
    /* ignore */
  }
  return fallback
}

export async function fetchGpsMe(): Promise<GpsOfficer> {
  const res = await fetch(`${API}/me/`, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error(await readError(res, "Failed to load GPS status"))
  return res.json()
}

export async function postGpsDuty(action: "start" | "stop"): Promise<GpsOfficer> {
  const res = await fetch(`${API}/duty/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ action }),
  })
  if (!res.ok) throw new Error(await readError(res, "Failed to update duty"))
  return res.json()
}

export async function postGpsHeartbeat(): Promise<GpsOfficer> {
  const res = await fetch(`${API}/heartbeat/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: "{}",
  })
  if (!res.ok) throw new Error(await readError(res, "Failed to send GPS heartbeat"))
  return res.json()
}

export async function postGpsPing(payload: {
  latitude: number
  longitude: number
  accuracy?: number | null
  recordedAt?: string
  batteryPct?: number | null
  speedKmh?: number | null
  headingDeg?: number | null
  altitudeM?: number | null
}): Promise<GpsOfficer> {
  const res = await fetch(`${API}/ping/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await readError(res, "Failed to send GPS ping"))
  return res.json()
}

export async function fetchGpsLive(location?: string): Promise<GpsOfficer[]> {
  const q = location && location !== "all" ? `?location=${encodeURIComponent(location)}` : ""
  const res = await fetch(`${API}/live/${q}`, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error(await readError(res, "Failed to load live GPS"))
  const data = await res.json()
  return Array.isArray(data?.officers) ? data.officers : []
}

export async function fetchGpsHistory(userId: number, hours = 24): Promise<GpsHistoryPoint[]> {
  const res = await fetch(`${API}/history/${userId}/?hours=${hours}`, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error(await readError(res, "Failed to load GPS history"))
  const data = await res.json()
  return Array.isArray(data?.points) ? data.points : []
}
