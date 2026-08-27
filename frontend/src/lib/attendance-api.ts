import { API_BASE_URL, getAuthHeaders, getAuthHeadersFormData } from "@/lib/api"

export type AttendanceRecord = {
  id: number
  user: number | null
  staff?: number | null
  username: string | null
  staff_name?: string | null
  employee_id?: string | null
  department?: string | null
  date: string
  check_in: string | null
  check_out: string | null
  status?: string
  check_in_confidence?: number | null
  check_out_confidence?: number | null
  source?: string
  notes?: string
  image: string | null
  video?: string | null
  created_at?: string | null
  updated_at?: string | null
}

const ATTENDANCE_ENDPOINT = `${API_BASE_URL}/api/attendance/`

export async function fetchAttendance(params?: {
  date?: string
  staff?: number
  status?: string
}): Promise<AttendanceRecord[]> {
  const qs = new URLSearchParams()
  if (params?.date) qs.set("date", params.date)
  if (params?.staff != null) qs.set("staff", String(params.staff))
  if (params?.status) qs.set("status", params.status)
  const url = qs.toString() ? `${ATTENDANCE_ENDPOINT}?${qs}` : ATTENDANCE_ENDPOINT
  const response = await fetch(url, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  if (response.status === 401) throw new Error("Unauthorized")
  if (!response.ok) throw new Error(`Failed to load attendance (${response.status})`)
  const data = await response.json()
  if (Array.isArray(data)) return data
  if (data && Array.isArray((data as { results?: AttendanceRecord[] }).results))
    return (data as { results: AttendanceRecord[] }).results
  return []
}

export async function fetchAttendanceById(id: number): Promise<AttendanceRecord> {
  const response = await fetch(`${ATTENDANCE_ENDPOINT}${id}/`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  if (response.status === 401) throw new Error("Unauthorized")
  if (response.status === 404) throw new Error("Attendance record not found")
  if (!response.ok) throw new Error(`Failed to load attendance (${response.status})`)
  return response.json()
}

export type AttendanceUpdatePayload = {
  user?: number | null
  staff?: number | null
  date?: string
  check_in?: string | null
  check_out?: string | null
  status?: string
  notes?: string
}

export async function updateAttendance(
  id: number,
  payload: AttendanceUpdatePayload
): Promise<AttendanceRecord> {
  const response = await fetch(`${ATTENDANCE_ENDPOINT}${id}/`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  if (response.status === 401) throw new Error("Unauthorized")
  if (response.status === 403) throw new Error("Only Admin or HR can update attendance.")
  if (response.status === 404) throw new Error("Attendance record not found")
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg =
      typeof err === "object" && err !== null
        ? Object.entries(err)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`)
            .join("; ")
        : `Failed to update attendance (${response.status})`
    throw new Error(msg)
  }
  return response.json()
}

export async function deleteAttendance(id: number): Promise<void> {
  const response = await fetch(`${ATTENDANCE_ENDPOINT}${id}/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  })
  if (response.status === 401) throw new Error("Unauthorized")
  if (response.status === 403) throw new Error("Only Admin or HR can delete attendance.")
  if (response.status === 404) throw new Error("Attendance record not found")
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete attendance (${response.status})`)
  }
}

export async function manualAttendance(payload: {
  staff_id: number
  action: "check_in" | "check_out"
  notes?: string
}): Promise<AttendanceRecord> {
  const response = await fetch(`${ATTENDANCE_ENDPOINT}manual/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  if (response.status === 401) throw new Error("Unauthorized")
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : `Manual mark failed (${response.status})`)
  }
  return data as AttendanceRecord
}

/** Mark check-in with camera image. */
export async function markCheckIn(userId: number, imageFile: File): Promise<AttendanceRecord> {
  const form = new FormData()
  form.append("user", String(userId))
  form.append("image", imageFile)
  const response = await fetch(ATTENDANCE_ENDPOINT, {
    method: "POST",
    headers: getAuthHeadersFormData(),
    body: form,
  })
  if (response.status === 401) throw new Error("Unauthorized")
  if (response.status === 403) throw new Error("Only Admin or HR can mark attendance.")
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg =
      typeof err === "object" && err !== null
        ? Object.entries(err)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`)
            .join("; ")
        : `Failed to mark check-in (${response.status})`
    throw new Error(msg)
  }
  return response.json()
}

/** Mark check-out. */
export async function markCheckOut(recordId: number, imageFile?: File): Promise<AttendanceRecord> {
  const url = `${ATTENDANCE_ENDPOINT}${recordId}/`
  const checkOutIso = new Date().toISOString()
  if (imageFile) {
    const form = new FormData()
    form.append("check_out", checkOutIso)
    form.append("image", imageFile)
    const response = await fetch(url, {
      method: "PATCH",
      headers: getAuthHeadersFormData(),
      body: form,
    })
    if (response.status === 401) throw new Error("Unauthorized")
    if (!response.ok) throw new Error(`Failed to mark check-out (${response.status})`)
    return response.json()
  }
  const response = await fetch(url, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ check_out: checkOutIso }),
  })
  if (response.status === 401) throw new Error("Unauthorized")
  if (!response.ok) throw new Error(`Failed to mark check-out (${response.status})`)
  return response.json()
}

export function getTodayRecordForUser(
  records: AttendanceRecord[],
  userId: number
): AttendanceRecord | undefined {
  const today = new Date().toISOString().slice(0, 10)
  return records.find((r) => r.user === userId && r.date === today)
}

export type RecognizeResponse =
  | { recognized: false; message: string; similarity?: number }
  | {
      recognized: true
      user_id: number | null
      staff_id?: number
      username?: string
      staff_name?: string
      similarity: number
      confidence?: number
      attendance?: string
      record_id?: number
      status?: string
    }

export async function recognizeAndMarkAttendance(
  imageFile: File,
  options?: { autoMark?: boolean; threshold?: number; source?: string }
): Promise<RecognizeResponse> {
  const form = new FormData()
  form.append("image", imageFile)
  form.append("auto_mark", options?.autoMark !== false ? "true" : "false")
  form.append("source", options?.source || "webcam")
  if (options?.threshold != null) form.append("threshold", String(options.threshold))
  const response = await fetch(`${API_BASE_URL}/api/attendance/recognize/`, {
    method: "POST",
    headers: getAuthHeadersFormData(),
    body: form,
  })
  if (response.status === 401) throw new Error("Unauthorized")
  if (response.status === 503)
    throw new Error(
      "Face recognition not available. Install InsightFace backend dependencies and ensure the model is loaded."
    )
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = typeof data?.error === "string" ? data.error : `Recognition failed (${response.status})`
    throw new Error(msg)
  }
  return data as RecognizeResponse
}
