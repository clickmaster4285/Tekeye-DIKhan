import { API_BASE_URL, getAuthHeaders } from "@/lib/api"

const API = `${API_BASE_URL}/api/gps`

export type GpsStatus = "live" | "stale" | "offline"

export type GpsOfficer = {
  userId: number
  username: string
  name: string
  role: string
  employeeId?: string
  profileImage?: string | null
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

export type GpsMotionStatus = "Moving" | "Stationary" | string

export type GpsHistoryPoint = {
  latitude: number
  longitude: number
  accuracy: number | null
  speedKmh?: number | null
  recordedAt: string | null
  status?: GpsMotionStatus
  /** Exact reverse-geocoded place name from the API */
  locationName?: string
  /** Google Maps link for this fix */
  mapsUrl?: string
}

export type GpsClosestPoint = GpsHistoryPoint & {
  requestedAt: string
  deltaSeconds: number
}

export type GpsHistoryResponse = {
  userId: number
  points: GpsHistoryPoint[]
  closest: GpsClosestPoint | null
  count: number
  totalCount?: number
  sampled?: boolean
  period?: {
    period?: string
    date?: string
    dateFrom?: string
    dateTo?: string
    hours?: number
    start?: string
    end?: string
    since?: string
  }
}

export type GpsReportPeriod = "day" | "week" | "month"

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

export async function fetchGpsLive(
  location?: string,
  options?: { includeOffDuty?: boolean }
): Promise<GpsOfficer[]> {
  const params = new URLSearchParams()
  if (location && location !== "all") params.set("location", location)
  if (options?.includeOffDuty) params.set("include_off_duty", "1")
  const qs = params.toString()
  const res = await fetch(`${API}/live/${qs ? `?${qs}` : ""}`, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error(await readError(res, "Failed to load live GPS"))
  const data = await res.json()
  return Array.isArray(data?.officers) ? data.officers : []
}

export async function fetchGpsHistory(
  userId: number,
  options: number | { hours?: number; date?: string; at?: string; period?: GpsReportPeriod } = 24
): Promise<GpsHistoryResponse> {
  const params = new URLSearchParams()
  if (typeof options === "number") {
    params.set("hours", String(options))
  } else {
    if (options.date) params.set("date", options.date)
    if (options.at) params.set("at", options.at)
    if (options.period) params.set("period", options.period)
    if (options.hours != null && !options.date && !options.period) {
      params.set("hours", String(options.hours))
    }
  }
  const qs = params.toString()
  const res = await fetch(`${API}/history/${userId}/${qs ? `?${qs}` : ""}`, {
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error(await readError(res, "Failed to load GPS history"))
  const data = await res.json()
  return {
    userId: data?.userId ?? userId,
    points: Array.isArray(data?.points) ? data.points : [],
    closest: data?.closest ?? null,
    count: typeof data?.count === "number" ? data.count : Array.isArray(data?.points) ? data.points.length : 0,
    totalCount: typeof data?.totalCount === "number" ? data.totalCount : undefined,
    sampled: Boolean(data?.sampled),
    period: data?.period,
  }
}

/** Round key matching backend gps_tracking.geocode.coord_key */
export function gpsCoordKey(lat: number, lng: number): string {
  const r = (n: number) => (Math.round(n * 1e4) / 1e4).toFixed(4)
  return `${r(lat)},${r(lng)}`
}

export type GpsReverseGeocodeResult = {
  key: string
  latitude: number
  longitude: number
  locationName: string
}

/** Batch reverse-geocode (street / area names via OSM). Chunks requests to avoid timeouts. */
export async function fetchGpsLocationNames(
  points: Array<{ latitude: number; longitude: number }>
): Promise<Record<string, string>> {
  if (!points.length) return {}

  // Deduplicate by rounded key so we don't spam the API.
  const unique = new Map<string, { latitude: number; longitude: number }>()
  for (const p of points) {
    if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) continue
    const key = gpsCoordKey(p.latitude, p.longitude)
    if (!unique.has(key)) unique.set(key, { latitude: p.latitude, longitude: p.longitude })
  }
  const uniquePoints = [...unique.values()]
  const out: Record<string, string> = {}
  const CHUNK = 25

  for (let i = 0; i < uniquePoints.length; i += CHUNK) {
    const chunk = uniquePoints.slice(i, i + CHUNK)
    const res = await fetch(`${API}/reverse-geocode/`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        points: chunk.map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
        })),
      }),
    })
    if (!res.ok) throw new Error(await readError(res, "Failed to resolve location names"))
    const data = await res.json()
    const results = Array.isArray(data?.results) ? data.results : []
    for (const row of results as GpsReverseGeocodeResult[]) {
      if (!row?.locationName) continue
      if (row.key) out[row.key] = row.locationName
      // Index with frontend rounding too (avoids Python/JS round mismatch).
      if (typeof row.latitude === "number" && typeof row.longitude === "number") {
        out[gpsCoordKey(row.latitude, row.longitude)] = row.locationName
      }
    }
  }
  return out
}
