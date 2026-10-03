import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  AlertCircle,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  ROUTES,
  getInfrastructureCameraDetailPath,
  getInfrastructureNvrDetailPath,
  getInfrastructureServerDetailPath,
} from "@/routes/config"
import {
  DEVICE_TYPE_LABELS,
  PROTOCOL_OPTIONS,
  createInfraDevice,
  defaultProtocolForType,
  deleteInfraDevice,
  fetchInfraDevices,
  fetchInfraSites,
  probeInfraDevice,
  refreshInfraMonitoring,
  updateInfraDevice,
  type DeviceStatus,
  type DeviceType,
  type InfraDevice,
  type InfraDeviceWrite,
  type InfraSite,
  type ProtocolType,
  type SnmpVersion,
} from "@/lib/infrastructure-api"

type FormState = {
  site: string
  name: string
  manufacturer: string
  model_number: string
  serial_number: string
  asset_tag: string
  ip_address: string
  port: string
  mac_address: string
  install_location: string
  primary_protocol: ProtocolType
  secondary_protocol: ProtocolType
  username: string
  password: string
  snmp_version: SnmpVersion
  snmp_community: string
  snmp_port: string
  modbus_unit_id: string
  modbus_port: string
  modbus_register_map_json: string
  onvif_port: string
  rtsp_url: string
  channel_count: string
  supports_onvif: boolean
  supports_rtsp: boolean
  supports_snmp: boolean
  supports_modbus: boolean
  rated_capacity_kva: string
  rated_power_kw: string
  network_role: string
  poll_interval_sec: string
  is_active: boolean
  notes: string
}

function emptyForm(deviceType: DeviceType): FormState {
  const protocol = defaultProtocolForType(deviceType)
  return {
    site: "",
    name: "",
    manufacturer: "",
    model_number: "",
    serial_number: "",
    asset_tag: "",
    ip_address: "",
    port: deviceType === "server" ? "22" : "",
    mac_address: "",
    install_location: "",
    primary_protocol: protocol,
    secondary_protocol: "none",
    username: "",
    password: "",
    snmp_version: "v2c",
    snmp_community: "public",
    snmp_port: "161",
    modbus_unit_id: "1",
    modbus_port: "502",
    modbus_register_map_json:
      deviceType === "inverter"
        ? JSON.stringify(
            [
              { name: "battery_voltage", register: 1001, scale: 0.1, unit: "V" },
              { name: "battery_soc", register: 1003, scale: 1, unit: "%" },
              { name: "pv_power_kw", register: 1004, scale: 0.1, unit: "kW" },
              { name: "load_kw", register: 1005, scale: 0.1, unit: "kW" },
            ],
            null,
            2
          )
        : "[]",
    onvif_port: "80",
    rtsp_url: "",
    channel_count: deviceType === "nvr" ? "16" : "",
    supports_onvif: deviceType === "camera",
    supports_rtsp: deviceType === "camera" || deviceType === "nvr",
    supports_snmp: ["nvr", "ups", "network"].includes(deviceType),
    supports_modbus: deviceType === "inverter",
    rated_capacity_kva: "",
    rated_power_kw: "",
    network_role:
      deviceType === "network" ? "switch" : deviceType === "server" ? "app" : "",
    poll_interval_sec: "60",
    is_active: true,
    notes: "",
  }
}

function deviceToForm(d: InfraDevice): FormState {
  return {
    site: d.site != null ? String(d.site) : "",
    name: d.name,
    manufacturer: d.manufacturer || "",
    model_number: d.model_number || "",
    serial_number: d.serial_number || "",
    asset_tag: d.asset_tag || "",
    ip_address: d.ip_address || "",
    port: d.port != null ? String(d.port) : "",
    mac_address: d.mac_address || "",
    install_location: d.install_location || "",
    primary_protocol: d.primary_protocol,
    secondary_protocol: d.secondary_protocol || "none",
    username: d.username || "",
    password: "",
    snmp_version: d.snmp_version || "v2c",
    snmp_community: d.snmp_community || "public",
    snmp_port: String(d.snmp_port || 161),
    modbus_unit_id: String(d.modbus_unit_id || 1),
    modbus_port: String(d.modbus_port || 502),
    modbus_register_map_json: JSON.stringify(d.modbus_register_map || [], null, 2),
    onvif_port: String(d.onvif_port || 80),
    rtsp_url: d.rtsp_url || "",
    channel_count: d.channel_count != null ? String(d.channel_count) : "",
    supports_onvif: d.supports_onvif,
    supports_rtsp: d.supports_rtsp,
    supports_snmp: d.supports_snmp,
    supports_modbus: d.supports_modbus,
    rated_capacity_kva: d.rated_capacity_kva != null ? String(d.rated_capacity_kva) : "",
    rated_power_kw: d.rated_power_kw != null ? String(d.rated_power_kw) : "",
    network_role: d.network_role || "",
    poll_interval_sec: String(d.poll_interval_sec || 60),
    is_active: d.is_active,
    notes: d.notes || "",
  }
}

function formToPayload(form: FormState, deviceType: DeviceType): InfraDeviceWrite {
  let registerMap: InfraDeviceWrite["modbus_register_map"] = []
  try {
    const parsed = JSON.parse(form.modbus_register_map_json || "[]")
    if (Array.isArray(parsed)) registerMap = parsed
  } catch {
    registerMap = []
  }
  const num = (v: string) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return {
    site: form.site ? Number(form.site) : null,
    device_type: deviceType,
    name: form.name.trim(),
    manufacturer: form.manufacturer.trim(),
    model_number: form.model_number.trim(),
    serial_number: form.serial_number.trim(),
    asset_tag: form.asset_tag.trim(),
    ip_address: form.ip_address.trim() || null,
    port: num(form.port),
    mac_address: form.mac_address.trim(),
    install_location: form.install_location.trim(),
    primary_protocol: form.primary_protocol,
    secondary_protocol: form.secondary_protocol,
    username: form.username.trim(),
    ...(form.password ? { password: form.password } : {}),
    snmp_version: form.snmp_version,
    snmp_community: form.snmp_community.trim(),
    snmp_port: num(form.snmp_port) ?? 161,
    modbus_unit_id: num(form.modbus_unit_id) ?? 1,
    modbus_port: num(form.modbus_port) ?? 502,
    modbus_register_map: registerMap,
    onvif_port: num(form.onvif_port) ?? 80,
    rtsp_url: form.rtsp_url.trim(),
    channel_count: num(form.channel_count),
    supports_onvif: form.supports_onvif,
    supports_rtsp: form.supports_rtsp,
    supports_snmp: form.supports_snmp,
    supports_modbus: form.supports_modbus,
    rated_capacity_kva: num(form.rated_capacity_kva),
    rated_power_kw: num(form.rated_power_kw),
    network_role: form.network_role.trim(),
    poll_interval_sec: num(form.poll_interval_sec) ?? 60,
    is_active: form.is_active,
    notes: form.notes.trim(),
  }
}

function statusBadge(status: DeviceStatus) {
  const map: Record<DeviceStatus, string> = {
    online: "bg-emerald-100 text-emerald-800 border-emerald-200",
    offline: "bg-red-100 text-red-800 border-red-200",
    degraded: "bg-amber-100 text-amber-800 border-amber-200",
    fault: "bg-rose-100 text-rose-800 border-rose-200",
    unknown: "bg-slate-100 text-slate-700 border-slate-200",
    maintenance: "bg-blue-100 text-blue-800 border-blue-200",
  }
  return map[status] || map.unknown
}

type Props = {
  deviceType: DeviceType
  title: string
  description: string
}

export function InfrastructureDeviceManager({ deviceType, title, description }: Props) {
  const [devices, setDevices] = useState<InfraDevice[]>([])
  const [sites, setSites] = useState<InfraSite[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<InfraDevice | null>(null)
  const [form, setForm] = useState<FormState>(() => emptyForm(deviceType))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [devs, siteList] = await Promise.all([
        fetchInfraDevices({ device_type: deviceType }),
        fetchInfraSites(),
      ])
      setDevices(devs)
      setSites(siteList.filter((s) => s.is_active))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load devices")
    } finally {
      setLoading(false)
    }
  }, [deviceType])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 20000)
    return () => window.clearInterval(id)
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return devices
    return devices.filter((d) =>
      [d.name, d.ip_address, d.manufacturer, d.model_number, d.install_location]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [devices, search])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm(deviceType))
    setDialogOpen(true)
  }

  const openEdit = (d: InfraDevice) => {
    setEditing(d)
    setForm(deviceToForm(d))
    setDialogOpen(true)
  }

  const save = async () => {
    if (!form.name.trim()) {
      setError("Name is required")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = formToPayload(form, deviceType)
      if (editing) await updateInfraDevice(editing.id, payload)
      else await createInfraDevice(payload)
      setDialogOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (d: InfraDevice) => {
    if (!window.confirm(`Delete ${d.name}?`)) return
    setError(null)
    try {
      await deleteInfraDevice(d.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed")
    }
  }

  const probeOne = async (d: InfraDevice) => {
    try {
      await probeInfraDevice(d.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Probe failed")
    }
  }

  const syncAndPoll = async () => {
    setLoading(true)
    setError(null)
    try {
      await refreshInfraMonitoring()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed")
      setLoading(false)
    }
  }

  const showSnmp =
    form.primary_protocol === "snmp" ||
    form.secondary_protocol === "snmp" ||
    form.supports_snmp
  const showModbus =
    form.primary_protocol === "modbus_tcp" ||
    form.primary_protocol === "modbus_rtu" ||
    form.supports_modbus
  const showCameraFields = deviceType === "camera" || deviceType === "nvr"
  const showPowerFields = deviceType === "ups" || deviceType === "inverter"

  return (
    <ModulePageLayout
      title={title}
      description={description}
      breadcrumbs={[
        { label: "Infrastructure Monitoring", href: ROUTES.INFRASTRUCTURE_OVERVIEW },
        { label: title },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void syncAndPoll()} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Sync &amp; poll live
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add {DEVICE_TYPE_LABELS[deviceType]}
          </Button>
        </div>
      }
    >
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Search name, IP, model…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {devices.length} {DEVICE_TYPE_LABELS[deviceType].toLowerCase()}
            (s)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Configured equipment</CardTitle>
          <CardDescription>
            Status is detected automatically (ping / Modbus / ports). Cameras and NVRs from Camera
            Management are imported on Sync &amp; poll.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
              No {DEVICE_TYPE_LABELS[deviceType].toLowerCase()} configured yet. Click Add to
              register one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead>Live status</TableHead>
                    <TableHead>Last polled</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">
                        <div>
                          {deviceType === "nvr" ? (
                            <Link
                              to={getInfrastructureNvrDetailPath(d.id)}
                              className="text-foreground underline-offset-2 hover:underline"
                            >
                              {d.name}
                            </Link>
                          ) : deviceType === "camera" ? (
                            <Link
                              to={getInfrastructureCameraDetailPath(d.id)}
                              className="text-foreground underline-offset-2 hover:underline"
                            >
                              {d.name}
                            </Link>
                          ) : deviceType === "server" ? (
                            <Link
                              to={getInfrastructureServerDetailPath(d.id)}
                              className="text-foreground underline-offset-2 hover:underline"
                            >
                              {d.name}
                            </Link>
                          ) : (
                            d.name
                          )}
                        </div>
                        {d.install_location ? (
                          <div className="text-xs text-muted-foreground">{d.install_location}</div>
                        ) : null}
                        {d.source_key ? (
                          <div className="text-[10px] text-muted-foreground">Auto-synced</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {[d.manufacturer, d.model_number].filter(Boolean).join(" ") || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{d.ip_address || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{d.primary_protocol_label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`border ${statusBadge(d.status)}`} variant="outline">
                          {d.status_label}
                        </Badge>
                        {d.last_error ? (
                          <div className="mt-1 max-w-[160px] truncate text-[10px] text-muted-foreground">
                            {d.last_error}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {d.last_polled_at
                          ? new Date(d.last_polled_at).toLocaleTimeString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {d.site_name || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void probeOne(d)}
                          title="Probe now"
                        >
                          Poll
                        </Button>
                        {deviceType === "nvr" ? (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={getInfrastructureNvrDetailPath(d.id)}>Detail</Link>
                          </Button>
                        ) : null}
                        {deviceType === "camera" ? (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={getInfrastructureCameraDetailPath(d.id)}>Detail</Link>
                          </Button>
                        ) : null}
                        {deviceType === "server" ? (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={getInfrastructureServerDetailPath(d.id)}>Detail</Link>
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => void remove(d)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit" : "Add"} {DEVICE_TYPE_LABELS[deviceType]}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={`${DEVICE_TYPE_LABELS[deviceType]} name`}
              />
            </div>

            <div className="space-y-2">
              <Label>Site</Label>
              <Select
                value={form.site || "__none__"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, site: v === "__none__" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No site</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Install location</Label>
              <Input
                value={form.install_location}
                onChange={(e) => setForm((f) => ({ ...f, install_location: e.target.value }))}
                placeholder="Rack A / Gate 1"
              />
            </div>

            <div className="space-y-2">
              <Label>Manufacturer</Label>
              <Input
                value={form.manufacturer}
                onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Model number</Label>
              <Input
                value={form.model_number}
                onChange={(e) => setForm((f) => ({ ...f, model_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Serial number</Label>
              <Input
                value={form.serial_number}
                onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Asset tag</Label>
              <Input
                value={form.asset_tag}
                onChange={(e) => setForm((f) => ({ ...f, asset_tag: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>IP address</Label>
              <Input
                value={form.ip_address}
                onChange={(e) => setForm((f) => ({ ...f, ip_address: e.target.value }))}
                placeholder="192.168.1.10"
              />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input
                value={form.port}
                onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label>Primary protocol</Label>
              <Select
                value={form.primary_protocol}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, primary_protocol: v as ProtocolType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROTOCOL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Poll interval (sec)</Label>
              <Input
                value={form.poll_interval_sec}
                onChange={(e) => setForm((f) => ({ ...f, poll_interval_sec: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>{deviceType === "server" ? "SSH username" : "Username"}</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder={deviceType === "server" ? "e.g. root" : undefined}
              />
              {deviceType === "server" ? (
                <p className="text-xs text-muted-foreground">
                  Used over SSH (port 22) to collect CPU, RAM, disk, GPU, services, and logs.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>
                {deviceType === "server" ? "SSH password" : "Password"}{" "}
                {editing ? "(leave blank to keep)" : ""}
              </Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
              />
            </div>

            {showSnmp ? (
              <>
                <div className="space-y-2">
                  <Label>SNMP version</Label>
                  <Select
                    value={form.snmp_version}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, snmp_version: v as SnmpVersion }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="v1">SNMPv1</SelectItem>
                      <SelectItem value="v2c">SNMPv2c</SelectItem>
                      <SelectItem value="v3">SNMPv3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>SNMP community</Label>
                  <Input
                    value={form.snmp_community}
                    onChange={(e) => setForm((f) => ({ ...f, snmp_community: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>SNMP port</Label>
                  <Input
                    value={form.snmp_port}
                    onChange={(e) => setForm((f) => ({ ...f, snmp_port: e.target.value }))}
                  />
                </div>
              </>
            ) : null}

            {showModbus ? (
              <>
                <div className="space-y-2">
                  <Label>Modbus unit ID</Label>
                  <Input
                    value={form.modbus_unit_id}
                    onChange={(e) => setForm((f) => ({ ...f, modbus_unit_id: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Modbus TCP port</Label>
                  <Input
                    value={form.modbus_port}
                    onChange={(e) => setForm((f) => ({ ...f, modbus_port: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Modbus register map (JSON)</Label>
                  <Textarea
                    rows={6}
                    className="font-mono text-xs"
                    value={form.modbus_register_map_json}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, modbus_register_map_json: e.target.value }))
                    }
                  />
                </div>
              </>
            ) : null}

            {showCameraFields ? (
              <>
                <div className="space-y-2">
                  <Label>ONVIF port</Label>
                  <Input
                    value={form.onvif_port}
                    onChange={(e) => setForm((f) => ({ ...f, onvif_port: e.target.value }))}
                  />
                </div>
                {deviceType === "nvr" ? (
                  <div className="space-y-2">
                    <Label>Channel count</Label>
                    <Input
                      value={form.channel_count}
                      onChange={(e) => setForm((f) => ({ ...f, channel_count: e.target.value }))}
                    />
                  </div>
                ) : null}
                <div className="space-y-2 sm:col-span-2">
                  <Label>RTSP URL</Label>
                  <Input
                    value={form.rtsp_url}
                    onChange={(e) => setForm((f) => ({ ...f, rtsp_url: e.target.value }))}
                    placeholder="rtsp://user:pass@ip:554/…"
                  />
                </div>
              </>
            ) : null}

            {showPowerFields ? (
              <>
                <div className="space-y-2">
                  <Label>Rated capacity (kVA)</Label>
                  <Input
                    value={form.rated_capacity_kva}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, rated_capacity_kva: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rated power (kW)</Label>
                  <Input
                    value={form.rated_power_kw}
                    onChange={(e) => setForm((f) => ({ ...f, rated_power_kw: e.target.value }))}
                  />
                </div>
              </>
            ) : null}

            {deviceType === "network" ? (
              <div className="space-y-2">
                <Label>Network role</Label>
                <Select
                  value={form.network_role || "switch"}
                  onValueChange={(v) => setForm((f) => ({ ...f, network_role: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="switch">Switch</SelectItem>
                    <SelectItem value="router">Router</SelectItem>
                    <SelectItem value="firewall">Firewall</SelectItem>
                    <SelectItem value="ap">Access Point</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {deviceType === "server" ? (
              <div className="space-y-2">
                <Label>Server role</Label>
                <Select
                  value={form.network_role || "app"}
                  onValueChange={(v) => setForm((f) => ({ ...f, network_role: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="app">Application</SelectItem>
                    <SelectItem value="db">Database</SelectItem>
                    <SelectItem value="web">Web</SelectItem>
                    <SelectItem value="file">File / storage</SelectItem>
                    <SelectItem value="domain">Domain / AD</SelectItem>
                    <SelectItem value="backup">Backup</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-4 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.supports_snmp}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, supports_snmp: v }))}
                />
                SNMP
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.supports_modbus}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, supports_modbus: v }))}
                />
                Modbus
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.supports_onvif}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, supports_onvif: v }))}
                />
                ONVIF
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.supports_rtsp}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, supports_rtsp: v }))}
                />
                RTSP
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
                Active
              </label>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editing ? "Save changes" : "Create device"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}
