/**
 * VMS API client: approval, zone scan, vehicles, notifications, analytics, security.
 */
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { getUserLocationFilter } from "@/lib/location-access";

const API = `${API_BASE_URL}/api`;

function authInit(): RequestInit {
  return { headers: getAuthHeaders(), cache: "no-store" };
}

function getErrorMessage(response: Response, body: unknown): string {
  if (response.status === 400 && body && typeof body === "object" && !Array.isArray(body)) {
    const err = body as Record<string, unknown>
    const parts = Object.entries(err).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
    if (parts.length) return parts.join("; ")
  }
  if (body && typeof body === "object" && "detail" in body) return String((body as { detail: unknown }).detail)
  return `Request failed (${response.status})`
}

// ----- Active Visitors (in building) -----
export type ActiveVisitor = {
  id: number
  full_name: string
  flow_stage?: string
  host_full_name?: string
  host_department?: string
  access_zone?: string
  updated_at?: string
  created_at: string
  [key: string]: unknown
}

export async function fetchActiveVisitors(): Promise<ActiveVisitor[]> {
  const res = await fetch(`${API}/visitors/active/`, authInit())
  if (!res.ok) {
    let msg = `Failed to load active visitors (${res.status})`
    try {
      const data = await res.json()
      msg = getErrorMessage(res, data)
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return res.json()
}

// ----- Approval Workflow -----
export type PendingVisitor = {
  id: number
  full_name: string
  approval_status: string
  flow_stage?: string
  host_full_name?: string
  host_department?: string
  created_at: string
  [key: string]: unknown
}

export async function fetchPendingApprovals(): Promise<PendingVisitor[]> {
  const res = await fetch(`${API}/approval/pending/`, authInit())
  if (!res.ok) {
    let msg = `Failed to load pending approvals (${res.status})`
    try {
      const data = await res.json()
      msg = getErrorMessage(res, data)
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return res.json()
}

export async function approveVisitor(id: number, approvedBy: string): Promise<PendingVisitor> {
  const res = await fetch(`${API}/visitors/${id}/approve/`, {
    method: "POST",
    ...authInit(),
    body: JSON.stringify({ approved_by: approvedBy }),
  })
  if (!res.ok) {
    let msg = `Failed to approve (${res.status})`
    try {
      const data = await res.json()
      msg = getErrorMessage(res, data)
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return res.json()
}

export async function denyVisitor(
  id: number,
  payload: { rejection_reason: string; denied_by?: string }
): Promise<PendingVisitor> {
  const res = await fetch(`${API}/visitors/${id}/deny/`, {
    method: "POST",
    ...authInit(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let msg = `Failed to deny (${res.status})`
    try {
      const data = await res.json()
      msg = getErrorMessage(res, data)
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return res.json()
}

// ----- Zone scan (Check-in / Check-out) -----
export type ZoneScanPayload = {
  qr_code_id: string
  zone: string
  gate?: string
  scan_type?: "entry" | "exit"
  scanner_id?: string
}

export type ZoneScanResult = {
  allowed: boolean
  message: string
  visitor_id?: number
  visitor_name?: string
  flow_stage?: string
}

export async function zoneScan(payload: ZoneScanPayload): Promise<ZoneScanResult> {
  const res = await fetch(`${API}/zone-access/scan/`, {
    method: "POST",
    ...authInit(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let msg = `Scan failed (${res.status})`
    try {
      const data = await res.json()
      msg = getErrorMessage(res, data)
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return res.json()
}

// ----- Vehicles -----
export type VehicleRecord = {
  id: number
  visitor: number
  visitor_name?: string
  plate_number: string
  vehicle_type: string
  contractor_company?: string
  driver_name?: string
  remarks?: string
  created_at: string
}

export async function fetchVehicles(visitorId?: number): Promise<VehicleRecord[]> {
  const url = visitorId ? `${API}/vehicles/?visitor_id=${visitorId}` : `${API}/vehicles/`
  const res = await fetch(url, authInit())
  if (!res.ok) throw new Error(`Failed to load vehicles (${res.status})`)
  return res.json()
}

export async function createVehicle(payload: {
  visitor: number
  plate_number: string
  vehicle_type: string
  contractor_company?: string
  driver_name?: string
  remarks?: string
}): Promise<VehicleRecord> {
  const res = await fetch(`${API}/vehicles/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let msg = `Failed to add vehicle (${res.status})`
    try {
      const data = await res.json()
      msg = getErrorMessage(res, data)
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return res.json()
}

// ----- Notifications / Communication -----
export type NotificationRecord = {
  id: number
  visitor: number
  visitor_name?: string
  notification_type: string
  recipient: string
  sent_at: string
  success: boolean
  message?: string
}

export async function fetchNotifications(visitorId?: number): Promise<NotificationRecord[]> {
  const url = visitorId ? `${API}/notifications/?visitor_id=${visitorId}` : `${API}/notifications/`
  const res = await fetch(url, authInit())
  if (!res.ok) throw new Error(`Failed to load notifications (${res.status})`)
  return res.json()
}

export async function notifyHost(visitorId: number, recipient?: string): Promise<{ host_notified_at: string; recipient: string }> {
  const res = await fetch(`${API}/visitors/${visitorId}/notify-host/`, {
    method: "POST",
    ...authInit(),
    body: JSON.stringify({ recipient: recipient || "" }),
  })
  if (!res.ok) {
    let msg = `Failed to notify host (${res.status})`
    try {
      const data = await res.json()
      msg = getErrorMessage(res, data)
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return res.json()
}

// ----- Security alerts -----
export type SecurityAlertRecord = {
  id: number
  visitor?: number | null
  visitor_name?: string | null
  alert_type: string
  severity: string
  message: string
  zone?: string
  gate?: string
  created_at: string
  acknowledged: boolean
  acknowledged_at?: string | null
  acknowledged_by?: string
}

export async function fetchSecurityAlerts(params?: {
  acknowledged?: boolean
  severity?: string
}): Promise<SecurityAlertRecord[]> {
  const sp = new URLSearchParams()
  if (params?.acknowledged !== undefined) sp.set("acknowledged", String(params.acknowledged))
  if (params?.severity) sp.set("severity", params.severity)
  const finalUrl = sp.toString() ? `${API}/security/alerts/?${sp.toString()}` : `${API}/security/alerts/`
  const res = await fetch(finalUrl, authInit())
  if (!res.ok) throw new Error(`Failed to load alerts (${res.status})`)
  return res.json()
}

export async function acknowledgeSecurityAlert(
  alertId: number,
  acknowledgedBy?: string
): Promise<SecurityAlertRecord> {
  const res = await fetch(`${API}/security/alerts/${alertId}/acknowledge/`, {
    method: "POST",
    ...authInit(),
    body: JSON.stringify({ acknowledged_by: acknowledgedBy || "" }),
  })
  if (!res.ok) {
    let msg = `Failed to acknowledge alert (${res.status})`
    try {
      const data = await res.json()
      msg = getErrorMessage(res, data)
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return res.json()
}

export type ScreeningSummary = {
  total: number
  cleared: number
  flagged: number
  potential: number
  blacklisted: number
  not_checked: number
}

export async function fetchScreeningSummary(): Promise<ScreeningSummary> {
  const sp = new URLSearchParams()
  const loc = getUserLocationFilter()
  if (loc) sp.set("location", loc)
  const url = sp.toString() ? `${API}/vms/screening/summary/?${sp}` : `${API}/vms/screening/summary/`
  const res = await fetch(url, authInit())
  if (!res.ok) throw new Error(`Failed to load screening summary (${res.status})`)
  return res.json()
}

export type MarkVisitorScreeningResult = {
  visitor_id: number
  watchlist_check_status: string
  screening: {
    match?: string
    score?: number
    source?: string
    status?: string
    message?: string
    remarks?: string
  }
}

export async function markVisitorScreening(
  visitorId: number,
  action: "flagged" | "blacklisted",
  remarks?: string
): Promise<MarkVisitorScreeningResult> {
  const res = await fetch(`${API}/vms/screening/mark/`, {
    method: "POST",
    ...authInit(),
    body: JSON.stringify({
      visitor_id: visitorId,
      action,
      remarks: remarks || "",
    }),
  })
  if (!res.ok) {
    let msg = `Failed to update screening status (${res.status})`
    try {
      const data = await res.json()
      msg = getErrorMessage(res, data)
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return res.json()
}

export async function rescreenVisitors(visitorId?: number): Promise<{ screened: number }> {
  const body: Record<string, unknown> = {}
  if (visitorId) body.visitor_id = visitorId
  const loc = getUserLocationFilter()
  if (loc) body.location = loc
  const res = await fetch(`${API}/vms/screening/rescreen/`, {
    method: "POST",
    ...authInit(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let msg = `Re-screen failed (${res.status})`
    try {
      const data = await res.json()
      msg = getErrorMessage(res, data)
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return res.json()
}

export type SecurityDashboard = {
  visitors_today: number
  in_building: number
  alerts_unacknowledged: number
  alerts_today: number
  recent_alerts: SecurityAlertRecord[]
}

export async function fetchSecurityDashboard(): Promise<SecurityDashboard> {
  const res = await fetch(`${API}/security/dashboard/`, authInit())
  if (!res.ok) throw new Error(`Failed to load dashboard (${res.status})`)
  return res.json()
}

// ----- VMS Analytics -----
export type VmsAnalytics = {
  from_date: string
  to_date: string
  visitors_registered: number
  in_building_now: number
  zone_scans_in_range: number
  alerts_in_range: number
  alerts_unacknowledged: number
  pending_approvals: number
  approved_in_range: number
  denied_in_range: number
}

export async function fetchVmsAnalytics(fromDate?: string, toDate?: string): Promise<VmsAnalytics> {
  const sp = new URLSearchParams()
  if (fromDate) sp.set("from", fromDate)
  if (toDate) sp.set("to", toDate)
  const finalUrl = sp.toString() ? `${API}/vms/analytics/?${sp.toString()}` : `${API}/vms/analytics/`
  const res = await fetch(finalUrl, authInit())
  if (!res.ok) throw new Error(`Failed to load analytics (${res.status})`)
  return res.json()
}

// ----- VMS Overview dashboard -----
export type VmsOverviewVisitorRow = {
  id: number
  reg_id: string
  date: string
  visitor_name: string
  organization: string
  vehicle_id: string
  status: string
  host_name: string
  date_time: string
  priority: string
  approval_status: string
  registration_source: string
}

export type VmsOverview = {
  expected_today: number
  checked_in: number
  pending_docs: number
  pending_approval: number
  blacklisted_visitors: number
  blacklisted_vehicles: number
  rejected_requests: number
  active_passes: number
  visitors_registered_today: number
  recent_registrations: VmsOverviewVisitorRow[]
  registered_visitors: VmsOverviewVisitorRow[]
}

export async function fetchVmsOverview(): Promise<VmsOverview> {
  const sp = new URLSearchParams()
  const loc = getUserLocationFilter()
  if (loc) sp.set("location", loc)
  const url = sp.toString() ? `${API}/vms/overview/?${sp}` : `${API}/vms/overview/`
  const res = await fetch(url, authInit())
  if (!res.ok) throw new Error(`Failed to load visitor overview (${res.status})`)
  return res.json()
}
