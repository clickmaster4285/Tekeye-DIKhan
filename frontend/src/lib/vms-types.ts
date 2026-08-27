/**
 * VMS (Vehicle Management Module) – Vehicle Registration & Vehicle Tracking.
 * Matches master schema; persistence via VMS API (database).
 */

export const VEHICLE_TYPES = [
  "Car",
  "Motorcycle",
  "Truck",
  "Container",
  "Trailer",
  "Bus",
] as const

export type VehicleType = (typeof VEHICLE_TYPES)[number]

export const VEHICLE_STATUSES = ["Inside", "Exited", "Overstay"] as const

export type VehicleStatus = (typeof VEHICLE_STATUSES)[number]

/** Vehicle Registration – links to Visit, Gates */
export interface VehicleEntry {
  vehicle_entry_id: string
  visit_id_ref: string
  vehicle_reg_no: string
  anpr_image: string
  vehicle_type: VehicleType
  vehicle_make: string
  vehicle_color: string
  driver_name: string
  driver_cnic: string
  container_no: string
  seal_no: string
  declaration_no: string
  entry_datetime: string
  entry_gate_id: string
  parking_bay_assigned: string
  exit_datetime: string
  exit_gate_id: string
  status: VehicleStatus
}

/** Vehicle Tracking – links to VehicleEntry */
export interface VehicleTrackingRecord {
  tracking_id: string
  vehicle_entry_id_ref: string
  gps_coordinates: string
  dwell_time_minutes: number
  assigned_loading_area: string
  movement_log: string
  overstay_alert_sent: boolean
  overstay_threshold_minutes: number
}

export const VMS_STORAGE_KEYS = {
  VEHICLE_ENTRIES: "vms_vehicle_entries",
  VEHICLE_TRACKING: "vms_vehicle_tracking",
} as const
