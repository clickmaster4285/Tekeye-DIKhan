import { API_BASE_URL, getAuthHeaders } from "@/lib/api"

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  })
  if (response.status === 401) throw new Error("Unauthorized")
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg =
      typeof data?.error === "string"
        ? data.error
        : typeof data?.detail === "string"
          ? data.detail
          : `Request failed (${response.status})`
    throw new Error(msg)
  }
  return data as T
}

export type FaceEnrollment = {
  id: number
  staff_id: number
  employee_id: string | null
  staff_name: string
  department?: string
  is_enrolled: boolean
  is_trained: boolean
  total_images: number
  images_required?: number
  model_version: string
  dataset_folder: string
  profile_image: string | null
}

export type CaptureResult = {
  accepted: boolean
  quality?: { passed: boolean; message?: string; [key: string]: unknown }
  total_images?: number
  images_required?: number
  is_enrolled?: boolean
}

export type IdentifyResult = {
  matched: boolean
  message?: string
  confidence?: number
  staff_id?: number
  staff_name?: string
  employee_id?: string | null
  gallery_key?: string
  attendance?: {
    action: string
    message: string
    date?: string
    check_in?: string | null
    check_out?: string | null
    status?: string
    record_id?: number
  }
}

export type CctvOverview = {
  cameras: Array<{
    id: number
    name: string
    location?: string
    purpose?: string
    purpose_label?: string
    code?: string
    status?: string
    is_active?: boolean
    has_stream?: boolean
    runtime?: {
      running?: boolean
      connected?: boolean
      last_error?: string
      frames_processed?: number
      gallery_size?: number
      has_snapshot?: boolean
    } | null
  }>
  events: Array<Record<string, unknown>>
  snapshots: Array<{
    id: number
    staff_id: number
    employee_name: string
    camera_name: string
    image_url: string
    confidence: number
    attendance_action: string
    detected_at: string
  }>
  running_count: number
}

export type DashboardSummary = {
  date: string
  summary: {
    total_employees: number
    trained_faces: number
    present_today: number
    late_today: number
    absent_today: number
    checked_out_today: number
  }
  department_stats: Array<{
    department: string
    total: number
    present_count: number
    late_count: number
  }>
  recent_activity: Array<Record<string, unknown>>
}

export type DailyReport = {
  date: string
  attendance: Array<Record<string, unknown>>
  absent: Array<{
    staff_id: number
    employee_id: string | null
    name: string
    department: string
  }>
  totals: { present: number; late: number; absent: number }
}

export const recognitionApi = {
  enrollmentStatus: (staffId: number) =>
    apiJson<FaceEnrollment>(`/api/recognition/enroll/${staffId}/`),

  capture: (staffId: number, imageBase64: string) =>
    apiJson<CaptureResult>(`/api/recognition/enroll/${staffId}/capture/`, {
      method: "POST",
      body: JSON.stringify({ image: imageBase64 }),
    }),

  train: (staffId: number) =>
    apiJson<{ trained: boolean; embedding_dim: number; images_used: number; enrollment: FaceEnrollment }>(
      `/api/recognition/enroll/${staffId}/train/`,
      { method: "POST", body: "{}" }
    ),

  identify: (imageBase64: string, markAttendance = true, source: "webcam" | "cctv" = "webcam") =>
    apiJson<IdentifyResult>(`/api/recognition/identify/`, {
      method: "POST",
      body: JSON.stringify({
        image: imageBase64,
        mark_attendance: markAttendance,
        source,
      }),
    }),

  galleryStats: () =>
    apiJson<{
      total_staff_with_enrollment: number
      enrolled: number
      trained: number
      ready_for_recognition: number
    }>(`/api/recognition/gallery/stats/`),

  cctvOverview: () => apiJson<CctvOverview>(`/api/recognition/cctv/`),

  cctvAction: (action: "start_all" | "stop_all") =>
    apiJson<{ action: string; statuses: unknown[] }>(`/api/recognition/cctv/`, {
      method: "POST",
      body: JSON.stringify({ action }),
    }),

  cameraAction: (cameraId: number, action: "start" | "stop") =>
    apiJson<Record<string, unknown>>(`/api/recognition/cctv/cameras/${cameraId}/${action}/`, {
      method: "POST",
      body: "{}",
    }),

  cameraSnapshotUrl: (cameraId: number) =>
    `${API_BASE_URL}/api/recognition/cctv/cameras/${cameraId}/snapshot/?t=${Date.now()}`,

  dashboardSummary: () => apiJson<DashboardSummary>(`/api/recognition/dashboard/summary/`),

  dailyReport: (date?: string) => {
    const qs = date ? `?date=${encodeURIComponent(date)}` : ""
    return apiJson<DailyReport>(`/api/recognition/dashboard/daily-report/${qs}`)
  },
}