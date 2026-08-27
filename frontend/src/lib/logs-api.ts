import { API_BASE_URL, getAuthHeaders } from "@/lib/api"

export type ActivityLogRecord = {
  id: number
  username: string | null
  ip_address: string | null
  country: string | null
  city: string | null
  device: string | null
  os: string | null
  browser: string | null
  action: string
  time: string
}

export type ActivityLogsResponse = {
  count: number
  next: string | null
  previous: string | null
  results: ActivityLogRecord[]
}

export async function fetchActivityLogs(params?: {
  page?: number
  page_size?: number
  username?: string
}): Promise<ActivityLogsResponse> {
  const sp = new URLSearchParams()
  if (params?.page != null) sp.set("page", String(params.page))
  if (params?.page_size != null) sp.set("page_size", String(params.page_size))
  if (params?.username) sp.set("username", params.username)
  const qs = sp.toString()
  const base = `${API_BASE_URL}/api/activity-logs/`
  const url = qs ? `${base}?${qs}` : base
  try {
    const res = await fetch(url, { headers: getAuthHeaders() })
    if (!res.ok) throw new Error("Failed to fetch activity logs")
    return res.json() as Promise<ActivityLogsResponse>
  } catch (err) {
    // Backend not connected / offline: return empty logs instead of crashing.
    return { count: 0, next: null, previous: null, results: [] }
  }
}

/** Report an app-level action (e.g. "Viewed /settings/logs") for full-app activity logging. No-op if not authenticated. */
export async function reportActivityLog(action: string): Promise<void> {
  const token = typeof window !== "undefined" ? window.sessionStorage.getItem("pakistan_customs_token") : null
  if (!token || !action?.trim()) return
  const url = `${API_BASE_URL}/api/activity-logs/report/`
  try {
    await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ action: action.trim().slice(0, 255) }),
    })
  } catch {
    // Fire-and-forget; ignore errors to avoid breaking the app when backend is down.
  }
}
