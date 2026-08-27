import { API_BASE_URL, getAuthHeaders } from "@/lib/api"

const API = `${API_BASE_URL}/api/object-tracking`

export type ObjectType = "person" | "vehicle" | "object"
export type VisitStatus = "active" | "exited"

export type ObjectVisitRecord = {
  id: number
  global_object: number
  global_code: string
  global_uuid?: string
  object_type: ObjectType
  class_name: string
  camera?: number | null
  camera_name?: string
  camera_code?: string
  local_track_id?: number | null
  status: VisitStatus
  entry_at: string
  last_seen_at: string
  exit_at?: string | null
  duration_seconds: number
  detection_event_id?: number | null
  snapshot_url?: string
  bbox?: number[]
  confidence?: number | null
  created_at?: string
}

export type GlobalObjectRecord = {
  id: number
  uuid: string
  code: string
  object_type: ObjectType
  class_name: string
  label?: string
  first_seen_at: string
  last_seen_at: string
  entry_at: string
  exit_at?: string | null
  duration_seconds: number
  latest_camera?: number | null
  latest_camera_name?: string
  latest_camera_code?: string
  visit_count?: number
  active_visit?: ObjectVisitRecord | null
  is_present: boolean
  snapshot_url?: string
  first_detection_event_id?: number | null
  camera_history?: Array<{ camera_id: number; at: string }>
  created_at?: string
  updated_at?: string
}

export type GlobalObjectDetail = GlobalObjectRecord & {
  track_history?: Array<Record<string, unknown>>
  visits?: ObjectVisitRecord[]
  tracks?: Array<{
    id: number
    local_track_id: number
    camera?: number
    camera_name?: string
    status: string
    started_at: string
    ended_at?: string | null
    last_bbox?: number[]
  }>
  metadata?: Record<string, unknown>
}

export type ObjectTrackingSummary = {
  objects_total: number
  present_now: number
  active_visits: number
  visits_24h: number
  exits_24h: number
  by_type: Record<string, number>
}

export type PaginatedResponse<T> = {
  count: number
  page: number
  page_size: number
  total_pages: number
  next?: string | null
  previous?: string | null
  results: T[]
}

function buildParams(
  query: Record<string, string | number | boolean | undefined>,
): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === "") continue
    params.set(k, String(v))
  }
  const s = params.toString()
  return s ? `?${s}` : ""
}

async function getJson<T>(url: string, errorMessage: string): Promise<T> {
  const res = await fetch(url, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error(errorMessage)
  return res.json()
}

export async function fetchObjectTrackingSummary(): Promise<ObjectTrackingSummary> {
  return getJson(`${API}/summary/`, "Failed to load object tracking summary")
}

export async function fetchObjectTrackingLive(query: {
  page?: number
  page_size?: number
} = {}): Promise<PaginatedResponse<ObjectVisitRecord>> {
  const params = buildParams({
    page: query.page ?? 1,
    page_size: query.page_size ?? 15,
  })
  return getJson(`${API}/live/${params}`, "Failed to load live object visits")
}

export async function fetchTrackedObjects(query: {
  q?: string
  object_type?: ObjectType | "all"
  present?: boolean
  page?: number
  page_size?: number
} = {}): Promise<PaginatedResponse<GlobalObjectRecord>> {
  const params = buildParams({
    q: query.q,
    object_type: query.object_type && query.object_type !== "all" ? query.object_type : undefined,
    present: query.present === undefined ? undefined : query.present ? "true" : "false",
    page: query.page ?? 1,
    page_size: query.page_size ?? 25,
  })
  return getJson(`${API}/objects/${params}`, "Failed to load tracked objects")
}

export async function fetchTrackedObjectDetail(uuid: string): Promise<GlobalObjectDetail> {
  return getJson(`${API}/objects/${uuid}/`, "Failed to load object detail")
}

export async function fetchObjectVisits(query: {
  q?: string
  status?: VisitStatus | "all"
  object_type?: ObjectType | "all"
  code?: string
  page?: number
  page_size?: number
} = {}): Promise<PaginatedResponse<ObjectVisitRecord>> {
  const params = buildParams({
    q: query.q,
    code: query.code,
    status: query.status && query.status !== "all" ? query.status : undefined,
    object_type: query.object_type && query.object_type !== "all" ? query.object_type : undefined,
    page: query.page ?? 1,
    page_size: query.page_size ?? 25,
  })
  return getJson(`${API}/visits/${params}`, "Failed to load visits")
}

export function formatDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.floor(Number(seconds) || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m ${sec}s`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

export function objectTypeLabel(type: string): string {
  if (type === "person") return "Person"
  if (type === "vehicle") return "Vehicle"
  return "Object"
}

export function unwrapList<T>(payload: T[] | { results: T[] } | undefined | null): T[] {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  return payload.results ?? []
}
