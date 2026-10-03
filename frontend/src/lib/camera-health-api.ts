import { API_BASE_URL, getAuthHeaders } from "@/lib/api"

export type HealthStatus = "healthy" | "degraded" | "critical" | "offline" | "unknown"

export type CameraHealthSuggestion = {
  id: number
  camera: number
  camera_code: string
  camera_name: string
  alert_type: string
  severity: string
  message: string
  recommendation: string
  first_detected: string
  last_detected: string
  resolved: boolean
}

export type CameraHealthSummary = {
  camera_id: number
  code: string
  name: string
  zone: string
  location: string
  purposes: string[]
  health_roi: Record<string, number> | null
  status: HealthStatus
  overall_score: number
  last_checked: string | null
  open_alerts: number
  top_recommendation: string
  latest: {
    sharpness?: number
    brightness?: number
    contrast?: number
    dark_ratio?: number
    bright_ratio?: number
    freeze_score?: number
    fps?: number | null
    person_visibility?: number
    vehicle_visibility?: number
    plate_visibility?: number
    face_visibility?: number
    recommendations?: Array<{
      alert_type?: string
      severity?: string
      message?: string
      recommendation?: string
    }>
    details?: Record<string, unknown>
  } | null
}

export type CameraHealthDashboard = {
  camera_count: number
  open_alerts: number
  by_status: Record<string, number>
  cameras: CameraHealthSummary[]
  suggestions: CameraHealthSuggestion[]
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data?.detail === "string") return data.detail
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`
}

export async function fetchCameraHealthDashboard(): Promise<CameraHealthDashboard> {
  const res = await fetch(`${API_BASE_URL}/api/camera-health/dashboard/`, {
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function scanCameraHealth(cameraId?: number): Promise<unknown> {
  const res = await fetch(`${API_BASE_URL}/api/camera-health/scan/`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cameraId ? { camera_id: cameraId } : {}),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function resolveHealthAlert(alertId: number): Promise<CameraHealthSuggestion> {
  const res = await fetch(`${API_BASE_URL}/api/camera-health/alerts/${alertId}/resolve/`, {
    method: "POST",
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}
