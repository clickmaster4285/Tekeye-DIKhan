import { API_BASE_URL, getAuthHeaders } from "@/lib/api"

export type LeaveTypeRecord = {
  id: number
  name: string
  code: string
  max_days_per_year: number | null
  requires_approval: boolean
  is_paid: boolean
  is_active: boolean
  created_at: string
}

export type LeaveRequestRecord = {
  id: number
  staff: number
  staff_name: string
  leave_type: number
  leave_type_name: string
  leave_type_code: string
  from_date: string
  to_date: string
  days: number
  reason: string | null
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  approved_by: number | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

const BASE = `${API_BASE_URL}/api`

export async function fetchLeaveTypes(): Promise<LeaveTypeRecord[]> {
  const res = await fetch(`${BASE}/leave-types/`, { headers: getAuthHeaders(), cache: "no-store" })
  if (res.status === 401) throw new Error("Unauthorized")
  if (!res.ok) throw new Error(`Failed to load leave types (${res.status})`)
  const data = await res.json()
  return Array.isArray(data) ? data : data?.results ?? []
}

export async function fetchLeaveRequests(params?: { status?: string }): Promise<LeaveRequestRecord[]> {
  const q = params?.status ? `?status=${encodeURIComponent(params.status)}` : ""
  const res = await fetch(`${BASE}/leave-requests/${q}`, { headers: getAuthHeaders(), cache: "no-store" })
  if (res.status === 401) throw new Error("Unauthorized")
  if (!res.ok) throw new Error(`Failed to load leave requests (${res.status})`)
  const data = await res.json()
  return Array.isArray(data) ? data : data?.results ?? []
}

export async function createLeaveRequest(payload: {
  staff: number
  leave_type: number
  from_date: string
  to_date: string
  days: number
  reason?: string
}): Promise<LeaveRequestRecord> {
  const res = await fetch(`${BASE}/leave-requests/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  if (res.status === 401) throw new Error("Unauthorized")
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = typeof err === "object" && err !== null ? Object.entries(err).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`).join("; ") : `Failed to create leave request (${res.status})`
    throw new Error(msg)
  }
  return res.json()
}

export async function approveLeaveRequest(id: number): Promise<LeaveRequestRecord> {
  const res = await fetch(`${BASE}/leave-requests/${id}/approve/`, { method: "POST", headers: getAuthHeaders() })
  if (res.status === 401) throw new Error("Unauthorized")
  if (!res.ok) throw new Error(`Failed to approve (${res.status})`)
  return res.json()
}

export async function rejectLeaveRequest(id: number, rejection_reason?: string): Promise<LeaveRequestRecord> {
  const res = await fetch(`${BASE}/leave-requests/${id}/reject/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ rejection_reason: rejection_reason ?? "" }),
  })
  if (res.status === 401) throw new Error("Unauthorized")
  if (!res.ok) throw new Error(`Failed to reject (${res.status})`)
  return res.json()
}
