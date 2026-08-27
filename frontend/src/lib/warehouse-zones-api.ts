/**
 * Warehouse and Zone Management API — Django REST backend.
 */
import { API_BASE_URL, getAuthHeaders } from "@/lib/api"

const BASE = `${API_BASE_URL}/api`

// Types
export type WarehouseRecord = {
  id: string
  code: string
  name: string
  location_code: string
  status: "ACTIVE" | "MAINTENANCE" | "INACTIVE"
  description: string
  zone_count: number
  created_at: string
  updated_at: string
}

export type SiteZoneRecord = {
  id: string
  warehouse: string
  warehouse_code: string
  warehouse_name: string
  warehouse_location: string
  code: string
  name: string
  purpose: string
  category: "receiving" | "detained" | "seizure" | "examination" | "stock" | "disposal" | "release"
  security_level: "standard" | "restricted" | "high"
  sort_order: number
  is_active: boolean
  description: string
  requires_escort: boolean
  access_hours_start: string
  access_hours_end: string
  weekend_access: boolean
  max_occupancy: number
  allowed_visitor_categories: string[]
  gate_ids: string[]
  camera_ids: string[]
  vms_zone_type: "Public" | "Restricted" | "High Security" | "Admin"
  created_at: string
  updated_at: string
}

function errorMessage(res: Response, body: unknown): string {
  if (res.status === 400 && body && typeof body === "object" && !Array.isArray(body)) {
    const err = body as Record<string, unknown>
    const parts = Object.entries(err).map(([k, v]) =>
      `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`
    )
    if (parts.length) return parts.join("; ")
  }
  if (body && typeof body === "object" && "detail" in body) {
    return String((body as { detail: unknown }).detail)
  }
  return `Request failed (${res.status})`
}

// Warehouse API
export async function fetchWarehouses(location?: string): Promise<WarehouseRecord[]> {
  const url = new URL(`${BASE}/warehouses/`)
  if (location) url.searchParams.set("location_code", location)

  const res = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(errorMessage(res, body))
  }

  const data = await res.json()
  return Array.isArray(data) ? data : data.results || []
}

export async function fetchWarehouse(id: string): Promise<WarehouseRecord> {
  const res = await fetch(`${BASE}/warehouses/${id}/`, {
    headers: getAuthHeaders(),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(errorMessage(res, body))
  }

  return res.json()
}

export async function createWarehouse(payload: {
  code: string
  name: string
  location_code: string
  status?: string
  description?: string
}): Promise<WarehouseRecord> {
  const res = await fetch(`${BASE}/warehouses/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(errorMessage(res, body))
  }

  return res.json()
}

export async function ensureWarehouseZones(warehouseId: string): Promise<{
  warehouse: string
  total_zones: number
  newly_created: number
  message: string
}> {
  const res = await fetch(`${BASE}/warehouses/${warehouseId}/ensure_zones/`, {
    method: "POST",
    headers: getAuthHeaders(),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(errorMessage(res, body))
  }

  return res.json()
}

// Zone API
export type FetchZonesParams = {
  warehouse?: string
  location?: string
  code?: string
}

export async function fetchZones(params?: FetchZonesParams): Promise<SiteZoneRecord[]> {
  const url = new URL(`${BASE}/zones/`)
  if (params?.warehouse) url.searchParams.set("warehouse", params.warehouse)
  if (params?.location) url.searchParams.set("location", params.location)
  if (params?.code) url.searchParams.set("code", params.code)

  const res = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(errorMessage(res, body))
  }

  const data = await res.json()
  return Array.isArray(data) ? data : data.results || []
}

export async function fetchZone(id: string): Promise<SiteZoneRecord> {
  const res = await fetch(`${BASE}/zones/${id}/`, {
    headers: getAuthHeaders(),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(errorMessage(res, body))
  }

  return res.json()
}

export async function updateZone(
  id: string,
  payload: {
    name?: string
    description?: string
    is_active?: boolean
    requires_escort?: boolean
    access_hours_start?: string
    access_hours_end?: string
    weekend_access?: boolean
    max_occupancy?: number
    allowed_visitor_categories?: string[]
    gate_ids?: string[]
    camera_ids?: string[]
    security_level?: "standard" | "restricted" | "high"
    sort_order?: number
    purpose?: string
    vms_zone_type?: "Public" | "Restricted" | "High Security" | "Admin"
  }
): Promise<SiteZoneRecord> {
  const res = await fetch(`${BASE}/zones/${id}/`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(errorMessage(res, body))
  }

  return res.json()
}

export async function createZone(payload: {
  warehouse: string
  code: string
  name: string
  purpose?: string
  security_level?: "standard" | "restricted" | "high"
  sort_order?: number
  description?: string
  is_active?: boolean
  requires_escort?: boolean
  access_hours_start?: string
  access_hours_end?: string
  weekend_access?: boolean
  max_occupancy?: number
  allowed_visitor_categories?: string[]
  gate_ids?: string[]
  camera_ids?: string[]
  vms_zone_type?: "Public" | "Restricted" | "High Security" | "Admin"
}): Promise<SiteZoneRecord> {
  const res = await fetch(`${BASE}/zones/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(errorMessage(res, body))
  }

  return res.json()
}

export async function deleteZone(id: string): Promise<void> {
  const res = await fetch(`${BASE}/zones/${id}/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(errorMessage(res, body))
  }
}
