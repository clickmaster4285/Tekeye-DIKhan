/**
 * Infrastructure Monitoring API — sites, devices, alerts, events, reports.
 */
import { API_BASE_URL, getAuthHeaders } from "@/lib/api"

const BASE = `${API_BASE_URL}/api`

export type DeviceType = "camera" | "nvr" | "ups" | "inverter" | "network" | "server"
export type ProtocolType =
  | "none"
  | "icmp"
  | "snmp"
  | "modbus_tcp"
  | "modbus_rtu"
  | "onvif"
  | "rtsp"
  | "http"
export type DeviceStatus =
  | "online"
  | "offline"
  | "degraded"
  | "fault"
  | "unknown"
  | "maintenance"
export type AlertSeverity = "info" | "medium" | "high" | "critical"
export type SnmpVersion = "v1" | "v2c" | "v3"

export type ModbusRegister = {
  name: string
  register: number
  scale?: number
  unit?: string
}

export type InfraSite = {
  id: number
  code: string
  name: string
  location: string
  description: string
  is_active: boolean
  device_count: number
  created_at?: string
  updated_at?: string
}

export type InfraDevice = {
  id: number
  site: number | null
  site_code: string
  site_name: string
  device_type: DeviceType
  device_type_label: string
  name: string
  manufacturer: string
  model_number: string
  serial_number: string
  asset_tag: string
  ip_address: string | null
  port: number | null
  mac_address: string
  install_location: string
  primary_protocol: ProtocolType
  primary_protocol_label: string
  secondary_protocol: ProtocolType
  username: string
  password_set: boolean
  snmp_version: SnmpVersion
  snmp_community: string
  snmp_port: number
  snmp_oid_map: Record<string, string>
  modbus_unit_id: number
  modbus_port: number
  modbus_register_map: ModbusRegister[]
  onvif_port: number
  rtsp_url: string
  channel_count: number | null
  supports_onvif: boolean
  supports_rtsp: boolean
  supports_snmp: boolean
  supports_modbus: boolean
  rated_capacity_kva: number | null
  rated_power_kw: number | null
  network_role: string
  poll_interval_sec: number
  status: DeviceStatus
  status_label: string
  last_seen_at: string | null
  last_polled_at: string | null
  last_error: string
  last_metrics: Record<string, unknown>
  source_key: string | null
  is_active: boolean
  notes: string
  metadata: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export type InfraDeviceWrite = {
  site?: number | null
  device_type: DeviceType
  name: string
  manufacturer?: string
  model_number?: string
  serial_number?: string
  asset_tag?: string
  ip_address?: string | null
  port?: number | null
  mac_address?: string
  install_location?: string
  primary_protocol?: ProtocolType
  secondary_protocol?: ProtocolType
  username?: string
  password?: string
  snmp_version?: SnmpVersion
  snmp_community?: string
  snmp_port?: number
  snmp_oid_map?: Record<string, string>
  modbus_unit_id?: number
  modbus_port?: number
  modbus_register_map?: ModbusRegister[]
  onvif_port?: number
  rtsp_url?: string
  channel_count?: number | null
  supports_onvif?: boolean
  supports_rtsp?: boolean
  supports_snmp?: boolean
  supports_modbus?: boolean
  rated_capacity_kva?: number | null
  rated_power_kw?: number | null
  network_role?: string
  poll_interval_sec?: number
  is_active?: boolean
  notes?: string
  metadata?: Record<string, unknown>
}

export type InfraAlert = {
  id: number
  device: number | null
  device_name: string
  device_type: string
  alert_type: string
  severity: AlertSeverity
  severity_label: string
  title: string
  message: string
  metric_key: string
  metric_value: number | null
  acknowledged: boolean
  acknowledged_at: string | null
  resolved: boolean
  resolved_at: string | null
  first_detected: string
  last_detected: string
  details: Record<string, unknown>
}

export type InfraAlertRule = {
  id: number
  name: string
  device_type: string
  metric_key: string
  operator: string
  threshold_value: number | null
  severity: AlertSeverity
  message_template: string
  is_active: boolean
}

export type InfraEvent = {
  id: number
  device: number | null
  device_name: string
  event_type: string
  title: string
  message: string
  actor: string
  payload: Record<string, unknown>
  created_at: string
}

export type InfraOverview = {
  totals: {
    sites: number
    devices: number
    online: number
    offline: number
    degraded: number
    fault: number
    unknown: number
    open_alerts: number
    critical_alerts: number
  }
  by_type: Record<DeviceType, number>
  by_status: Record<string, number>
  power_summary: Array<{
    id: number
    name: string
    device_type: string
    status: string
    battery_percent?: number | null
    solar_kw?: number | null
    load_kw?: number | null
    grid_available?: boolean | null
  }>
  recent_alerts: InfraAlert[]
  recent_events: InfraEvent[]
}

export type InfraReport = {
  generated_at: string
  availability_by_type: Array<{
    device_type: string
    total: number
    online: number
    offline: number
    availability_pct: number
  }>
  open_alerts_by_severity: Record<string, number>
  devices_without_ip: number
  devices_without_protocol: number
  modbus_devices: number
  snmp_devices: number
}

function parseList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === "object" && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results
  }
  return []
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...getAuthHeaders(), ...(init?.headers || {}) },
    cache: "no-store",
  })
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (typeof body?.detail === "string") detail = body.detail
      else if (body && typeof body === "object") detail = JSON.stringify(body)
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function fetchInfraOverview(): Promise<InfraOverview> {
  return apiJson("/infra/overview/")
}

export async function fetchInfraReport(): Promise<InfraReport> {
  return apiJson("/infra/reports/")
}

export async function fetchInfraSites(): Promise<InfraSite[]> {
  return parseList(await apiJson("/infra/sites/"))
}

export async function createInfraSite(
  payload: Partial<InfraSite> & { code: string; name: string }
): Promise<InfraSite> {
  return apiJson("/infra/sites/", {
    method: "POST",
    body: JSON.stringify({ is_active: true, ...payload }),
  })
}

export async function updateInfraSite(
  id: number,
  payload: Partial<InfraSite>
): Promise<InfraSite> {
  return apiJson(`/infra/sites/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export async function deleteInfraSite(id: number): Promise<void> {
  await apiJson(`/infra/sites/${id}/`, { method: "DELETE" })
}

export async function fetchInfraDevices(params?: {
  device_type?: DeviceType
  site?: number
  status?: string
  search?: string
}): Promise<InfraDevice[]> {
  const q = new URLSearchParams()
  if (params?.device_type) q.set("device_type", params.device_type)
  if (params?.site != null) q.set("site", String(params.site))
  if (params?.status) q.set("status", params.status)
  if (params?.search) q.set("search", params.search)
  const qs = q.toString()
  return parseList(await apiJson(`/infra/devices/${qs ? `?${qs}` : ""}`))
}

export async function createInfraDevice(payload: InfraDeviceWrite): Promise<InfraDevice> {
  return apiJson("/infra/devices/", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updateInfraDevice(
  id: number,
  payload: Partial<InfraDeviceWrite>
): Promise<InfraDevice> {
  return apiJson(`/infra/devices/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export async function deleteInfraDevice(id: number): Promise<void> {
  await apiJson(`/infra/devices/${id}/`, { method: "DELETE" })
}

export async function probeInfraDevice(id: number): Promise<InfraDevice> {
  return apiJson(`/infra/devices/${id}/probe/`, { method: "POST", body: "{}" })
}

export type NvrDetailPayload = {
  id: number
  name: string
  status: DeviceStatus
  status_label: string
  ip_address: string | null
  manufacturer: string
  model_number: string
  last_polled_at: string | null
  last_error: string
  device_information: {
    model: string
    firmware: string
    serial_number: string
    mac_address: string
    system_identifiers: string
  }
  system_health: {
    nvr_status: string
    system_state: string
    cpu_usage: number | null
    cpu_display?: string
    ram_usage: number | null
    ram_display?: string
    temperature: number | null
    temperature_display?: string
    uptime: string
  }
  storage_health: {
    hdd_status: string
    hdd_capacity: string
    used_space: string
    free_space: string
    disk_errors: string | number
    hdd_list: Array<{
      status: string
      capacity_mb: number
      free_mb: number
      used_mb: number
    }>
  }
  network_health: {
    interface_status: string
    link_speed: string
    rx_traffic: string | number
    tx_traffic: string | number
    network_errors: string | number
    duplex?: string
    addressing?: string
  }
  recording: {
    recording_status: string
    recording_alarms: string | number
  }
  camera_channels: {
    total: number
    online: number
    offline: number
    video_loss: number
    recording: number
    source?: string
    items: Array<{
      id: number | string
      name: string
      code: string
      channel?: number | string
      status: string
      recording: boolean
      last_polled_at: string | null
      connection_state?: string
    }>
  }
  nvr_logs: Array<{
    no?: number
    time: string
    major_type: string
    subtype?: string
    minor_type?: string
    channel_no?: string
    channel?: string
    local_remote_user?: string
    user?: string
    remote_host_ip?: string
    description: string
    source?: string
  }>
  nvr_logs_count?: number
  channels_source?: string
  vendor_probe_error?: string
  alarms: {
    storage: string | number
    network: string | number
    hardware: string | number
    other: string | number
  }
}

export async function fetchNvrDetail(
  id: number,
  opts?: { refresh?: boolean }
): Promise<NvrDetailPayload> {
  const q = opts?.refresh ? "?refresh=1" : ""
  return apiJson(`/infra/devices/${id}/nvr_detail/${q}`)
}

export type CameraDetailPayload = {
  id: number
  name: string
  status: string
  status_label: string
  ip_address: string | null
  nvr_ip_address?: string | null
  manufacturer: string
  model_number: string
  last_polled_at: string | null
  last_error: string
  camera_code: string
  channel: string | number
  parent_nvr_id: number | null
  parent_nvr_name: string
  device_information: {
    model: string
    firmware: string
    serial_number: string
    mac_address: string
    system_identifiers: string
    camera_ip: string
    resolution: string
    codec: string
  }
  summary: {
    snmp_status: string
    snmp_via: string
    network: string
    uptime: string
    temperature: number | null
    temperature_display: string
    interface: string
    rtsp: string
    fps: number | null
    fps_display: string
    video_loss: string
    overall: string
  }
  image_quality: {
    blur: string
    brightness: string
    visibility: string
    obstruction: string
  }
  system_health: {
    cpu_usage: number | null
    cpu_display: string
    ram_usage: number | null
    ram_display: string
    temperature_display: string
    uptime: string
  }
  network_health: {
    interface_status: string
    link_speed: string
    duplex: string
    addressing: string
    mac_address: string
    rx_traffic: string | number
    tx_traffic: string | number
    network_errors: string | number
  }
  alarms: {
    video_loss: string
    channel_status: string
    hardware: string
    network: string
  }
}

export async function fetchCameraDetail(
  id: number,
  opts?: { refresh?: boolean }
): Promise<CameraDetailPayload> {
  const q = opts?.refresh ? "?refresh=1" : ""
  return apiJson(`/infra/devices/${id}/camera_detail/${q}`)
}

export async function refreshNvrLogs(id: number): Promise<{ count: number; results: NvrDetailPayload["nvr_logs"] }> {
  return apiJson(`/infra/devices/${id}/nvr_logs/`, { method: "POST", body: "{}" })
}

export type ServerLogEntry = {
  id?: number
  log_time: string | null
  category: string
  level: string
  source: string
  user: string
  remote_host: string
  event_id: string
  message: string
  fingerprint?: string
}

export type ServerDetailPayload = {
  id: number
  name: string
  status: string
  status_label: string
  ip_address: string | null
  manufacturer: string
  model_number: string
  server_role: string
  last_polled_at: string | null
  last_error: string
  agent_status: string
  agent_hint: string
  server_probe_error: string
  device_information: {
    hostname: string
    os_name: string
    os_release: string
    os_version: string
    architecture: string
    processor: string
    role: string
    ip_address: string
  }
  cpu: {
    usage_percent: number | null
    usage_display: string
    count_logical: number | null
    count_physical: number | null
    per_core: Array<number | null>
    load_avg: number[] | null
  }
  ram: {
    usage_percent: number | null
    usage_display: string
    total_display: string
    used_display: string
    available_display: string
    swap_percent: number | null
    swap_display: string
  }
  disk: {
    count: number
    volumes: Array<{
      device?: string
      mount?: string
      fstype?: string
      total_bytes?: number
      used_bytes?: number
      free_bytes?: number
      percent?: number | null
      total_display: string
      used_display: string
      free_display: string
      percent_display: string
    }>
  }
  network: {
    count: number
    interfaces: Array<{
      name: string
      ip_address?: string
      is_up?: boolean
      status: string
      speed_mbps?: number | null
      bytes_sent?: number
      bytes_recv?: number
      bytes_sent_display: string
      bytes_recv_display: string
      errin?: number
      errout?: number
    }>
  }
  temperature: {
    cpu_c: number | null
    cpu_display: string
    sensors: Array<{ name: string; celsius: number | null; source?: string }>
    uptime: string
  }
  services: {
    total: number
    running: number | null
    stopped: number | null
    items: Array<{
      name: string
      display_name: string
      status: string
      start_type: string
      running: boolean
    }>
  }
  gpu: {
    count: number
    items: Array<{
      index: number
      name: string
      utilization_percent: number | null
      utilization_display: string
      vram_used_mb: number | null
      vram_total_mb: number | null
      vram_display: string
      temperature_c: number | null
      temperature_display: string
      power_draw_w: number | null
      power_limit_w: number | null
      power_display: string
      fan_percent: number | null
      fan_display: string
      clock_graphics_mhz: number | null
      clock_memory_mhz: number | null
      clock_display: string
      driver_version: string
      processes: Array<{ pid: string; name: string; vram_mb: number | null }>
    }>
  }
  logs: {
    total: number
    error: ServerLogEntry[]
    access: ServerLogEntry[]
    system: ServerLogEntry[]
    security: ServerLogEntry[]
    application: ServerLogEntry[]
    other: ServerLogEntry[]
    all: ServerLogEntry[]
  }
}

export async function fetchServerDetail(
  id: number,
  opts?: { refresh?: boolean }
): Promise<ServerDetailPayload> {
  const q = opts?.refresh ? "?refresh=1" : ""
  return apiJson(`/infra/devices/${id}/server_detail/${q}`)
}

export async function refreshServerLogs(
  id: number
): Promise<{ count: number; results: ServerLogEntry[] }> {
  return apiJson(`/infra/devices/${id}/server_logs/`, { method: "POST", body: "{}" })
}

export async function deleteServerLogs(
  id: number,
  opts?: { category?: string }
): Promise<{ deleted: number; category: string }> {
  const q = opts?.category ? `?category=${encodeURIComponent(opts.category)}` : ""
  return apiJson(`/infra/devices/${id}/server_logs/${q}`, { method: "DELETE" })
}

export async function deleteNvrLogs(id: number): Promise<{ deleted: number }> {
  return apiJson(`/infra/devices/${id}/nvr_logs/`, { method: "DELETE" })
}

export async function refreshInfraMonitoring(): Promise<{
  sync: { created: number; updated: number; skipped: number }
  poll: {
    polled: number
    online: number
    offline: number
    degraded: number
    fault: number
    errors: number
  }
}> {
  return apiJson("/infra/refresh/", { method: "POST", body: "{}" })
}

export async function fetchInfraAlerts(params?: {
  resolved?: boolean
  severity?: string
}): Promise<InfraAlert[]> {
  const q = new URLSearchParams()
  if (params?.resolved != null) q.set("resolved", String(params.resolved))
  if (params?.severity) q.set("severity", params.severity)
  const qs = q.toString()
  return parseList(await apiJson(`/infra/alerts/${qs ? `?${qs}` : ""}`))
}

export async function createInfraAlert(
  payload: Partial<InfraAlert> & { title: string; alert_type: string }
): Promise<InfraAlert> {
  return apiJson("/infra/alerts/", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function acknowledgeInfraAlert(id: number): Promise<InfraAlert> {
  return apiJson(`/infra/alerts/${id}/acknowledge/`, { method: "POST", body: "{}" })
}

export async function resolveInfraAlert(id: number): Promise<InfraAlert> {
  return apiJson(`/infra/alerts/${id}/resolve/`, { method: "POST", body: "{}" })
}

export async function fetchInfraAlertRules(): Promise<InfraAlertRule[]> {
  return parseList(await apiJson("/infra/alert-rules/"))
}

export async function createInfraAlertRule(
  payload: Partial<InfraAlertRule> & { name: string; metric_key: string }
): Promise<InfraAlertRule> {
  return apiJson("/infra/alert-rules/", {
    method: "POST",
    body: JSON.stringify({ is_active: true, ...payload }),
  })
}

export async function updateInfraAlertRule(
  id: number,
  payload: Partial<InfraAlertRule>
): Promise<InfraAlertRule> {
  return apiJson(`/infra/alert-rules/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export async function deleteInfraAlertRule(id: number): Promise<void> {
  await apiJson(`/infra/alert-rules/${id}/`, { method: "DELETE" })
}

export async function fetchInfraEvents(): Promise<InfraEvent[]> {
  return parseList(await apiJson("/infra/events/"))
}

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  camera: "Camera",
  nvr: "NVR",
  ups: "UPS",
  inverter: "Inverter",
  network: "Network Device",
  server: "Server",
}

export const PROTOCOL_OPTIONS: { value: ProtocolType; label: string }[] = [
  { value: "icmp", label: "ICMP (Ping)" },
  { value: "snmp", label: "SNMP" },
  { value: "modbus_tcp", label: "Modbus TCP" },
  { value: "modbus_rtu", label: "Modbus RTU" },
  { value: "onvif", label: "ONVIF" },
  { value: "rtsp", label: "RTSP" },
  { value: "http", label: "HTTP API" },
  { value: "none", label: "None / Manual" },
]

export const STATUS_OPTIONS: { value: DeviceStatus; label: string }[] = [
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "degraded", label: "Degraded" },
  { value: "fault", label: "Fault" },
  { value: "unknown", label: "Unknown" },
  { value: "maintenance", label: "Maintenance" },
]

export function defaultProtocolForType(type: DeviceType): ProtocolType {
  switch (type) {
    case "inverter":
      return "modbus_tcp"
    case "ups":
    case "nvr":
    case "network":
      return "snmp"
    case "server":
      return "icmp"
    case "camera":
      return "icmp"
    default:
      return "icmp"
  }
}
