/**
 * Gate Registry & Zone types for Access Control (Gate Integration).
 * Schema: gate_id, gate_name, gate_type, device_type, device_ip, device_port,
 * gate_zone_id_ref, qr_reader_attached, biometric_reader_attached, camera_id_ref, gate_active.
 * Persistence: database via VMS API.
 */

export const GATE_TYPES = ["Entry", "Exit", "Both"] as const
export type GateType = (typeof GATE_TYPES)[number]

export const DEVICE_TYPES = [
  "Turnstile",
  "Boom Barrier",
  "Door",
  "Electronic Lock",
] as const
export type DeviceType = (typeof DEVICE_TYPES)[number]

export const ZONE_TYPES = ["Public", "Restricted", "High Security", "Admin"] as const
export type ZoneType = (typeof ZONE_TYPES)[number]

/** Zone – full schema (zone_id auto, zone_name, zone_code unique, zone_type, floor, building, allowed_categories, max_occupancy, requires_escort, access_hours_start/end, weekend_access, camera_ids, gate_ids, zone_active) */
export interface Zone {
  zone_id: string
  zone_name: string
  zone_code: string
  zone_type: ZoneType
  floor: string
  building: string
  allowed_categories: string[]
  max_occupancy: number
  requires_escort: boolean
  access_hours_start: string
  access_hours_end: string
  weekend_access: boolean
  camera_ids: string[]
  gate_ids: string[]
  zone_active: boolean
}

/** Gate – full schema */
export interface Gate {
  gate_id: string
  gate_name: string
  gate_type: GateType
  device_type: DeviceType
  device_ip: string
  device_port: number
  gate_zone_id_ref: string
  qr_reader_attached: boolean
  biometric_reader_attached: boolean
  camera_id_ref: string
  gate_active: boolean
}

export const GATE_STORAGE_KEYS = {
  GATES: "vms_gates_registry",
  ZONES: "vms_zones",
} as const
