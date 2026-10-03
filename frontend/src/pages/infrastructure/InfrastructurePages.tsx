import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bell,
  Camera,
  ClipboardList,
  Cpu,
  HardDrive,
  Loader2,
  Network,
  Plus,
  RefreshCw,
  Server,
  Zap,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { InfrastructureDeviceManager } from "@/components/infrastructure/device-manager"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ROUTES } from "@/routes/config"
import {
  acknowledgeInfraAlert,
  createInfraAlertRule,
  createInfraSite,
  deleteInfraAlertRule,
  deleteInfraSite,
  fetchInfraAlertRules,
  fetchInfraAlerts,
  fetchInfraDevices,
  fetchInfraEvents,
  fetchInfraOverview,
  fetchInfraReport,
  fetchInfraSites,
  refreshInfraMonitoring,
  resolveInfraAlert,
  updateInfraSite,
  type InfraAlert,
  type InfraAlertRule,
  type InfraDevice,
  type InfraEvent,
  type InfraOverview,
  type InfraReport,
  type InfraSite,
} from "@/lib/infrastructure-api"

const MODULE_LINKS = [
  {
    label: "Cameras",
    href: ROUTES.INFRASTRUCTURE_CAMERAS,
    description: "Configure camera inventory, IP, ONVIF/RTSP, and health.",
    icon: Camera,
  },
  {
    label: "NVRs",
    href: ROUTES.INFRASTRUCTURE_NVRS,
    description: "Register NVRs with SNMP, channels, and credentials.",
    icon: Server,
  },
  {
    label: "UPS Systems",
    href: ROUTES.INFRASTRUCTURE_UPS,
    description: "UPS SNMP / capacity configuration.",
    icon: Zap,
  },
  {
    label: "Inverters",
    href: ROUTES.INFRASTRUCTURE_INVERTERS,
    description: "Inverter Modbus TCP/RTU and register maps.",
    icon: Zap,
  },
  {
    label: "Network Devices",
    href: ROUTES.INFRASTRUCTURE_NETWORK,
    description: "Switches, routers, and link monitoring targets.",
    icon: Network,
  },
  {
    label: "Servers",
    href: ROUTES.INFRASTRUCTURE_SERVERS,
    description: "Application, database, and host reachability monitoring.",
    icon: Cpu,
  },
  {
    label: "Device Health",
    href: ROUTES.INFRASTRUCTURE_DEVICE_HEALTH,
    description: "Cross-device status board.",
    icon: Activity,
  },
  {
    label: "Power Monitoring",
    href: ROUTES.INFRASTRUCTURE_POWER,
    description: "UPS and inverter readings overview.",
    icon: Zap,
  },
  {
    label: "Alerts",
    href: ROUTES.INFRASTRUCTURE_ALERTS,
    description: "Open alerts and threshold rules.",
    icon: Bell,
  },
  {
    label: "Events",
    href: ROUTES.INFRASTRUCTURE_EVENTS,
    description: "Configuration and incident timeline.",
    icon: ClipboardList,
  },
  {
    label: "Reports",
    href: ROUTES.INFRASTRUCTURE_REPORTS,
    description: "Availability and protocol coverage.",
    icon: BarChart3,
  },
] as const

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  )
}

export default function InfrastructureOverview() {
  const [data, setData] = useState<InfraOverview | null>(null)
  const [sites, setSites] = useState<InfraSite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [siteDialog, setSiteDialog] = useState(false)
  const [editingSite, setEditingSite] = useState<InfraSite | null>(null)
  const [siteForm, setSiteForm] = useState({
    code: "",
    name: "",
    location: "",
    description: "",
    is_active: true,
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [overview, siteList] = await Promise.all([
        fetchInfraOverview(),
        fetchInfraSites(),
      ])
      setData(overview)
      setSites(siteList)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load overview")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 20000)
    return () => window.clearInterval(id)
  }, [load])

  const syncAndPoll = async () => {
    setLoading(true)
    setError(null)
    try {
      await refreshInfraMonitoring()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync/poll failed")
      setLoading(false)
    }
  }

  const openSite = (site?: InfraSite) => {
    if (site) {
      setEditingSite(site)
      setSiteForm({
        code: site.code,
        name: site.name,
        location: site.location || "",
        description: site.description || "",
        is_active: site.is_active,
      })
    } else {
      setEditingSite(null)
      setSiteForm({ code: "", name: "", location: "", description: "", is_active: true })
    }
    setSiteDialog(true)
  }

  const saveSite = async () => {
    if (!siteForm.code.trim() || !siteForm.name.trim()) {
      setError("Site code and name are required")
      return
    }
    setSaving(true)
    try {
      if (editingSite) await updateInfraSite(editingSite.id, siteForm)
      else await createInfraSite(siteForm)
      setSiteDialog(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save site")
    } finally {
      setSaving(false)
    }
  }

  const removeSite = async (site: InfraSite) => {
    if (!window.confirm(`Delete site ${site.name}? Devices must be removed or reassigned first.`))
      return
    try {
      await deleteInfraSite(site.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete site")
    }
  }

  return (
    <ModulePageLayout
      title="Infrastructure Monitoring"
      description="Configure and monitor NVRs, cameras, UPS, inverters, and network gear."
      breadcrumbs={[{ label: "Infrastructure Monitoring" }]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => void syncAndPoll()} disabled={loading}>
            Sync cameras &amp; poll live
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

      {loading && !data ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading overview…
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Sites" value={data?.totals.sites ?? 0} />
            <StatCard label="Devices" value={data?.totals.devices ?? 0} />
            <StatCard
              label="Online"
              value={data?.totals.online ?? 0}
              hint={`${data?.totals.offline ?? 0} offline · ${data?.totals.unknown ?? 0} unknown`}
            />
            <StatCard
              label="Open alerts"
              value={data?.totals.open_alerts ?? 0}
              hint={`${data?.totals.critical_alerts ?? 0} critical`}
            />
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {(
              [
                ["camera", "Cameras"],
                ["nvr", "NVRs"],
                ["ups", "UPS"],
                ["inverter", "Inverters"],
                ["network", "Network"],
                ["server", "Servers"],
              ] as const
            ).map(([key, label]) => (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardDescription>{label}</CardDescription>
                  <CardTitle className="text-xl tabular-nums">
                    {data?.by_type?.[key] ?? 0}
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          <div className="mb-8 flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-background">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Live status from equipment</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Cameras and NVRs are imported from Camera Management. Status is polled automatically
                (ping / ports / Modbus). Configure UPS and inverters once; readings update on each
                poll cycle (~45s).
              </p>
            </div>
          </div>

          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Sites</h2>
              <Button size="sm" onClick={() => openSite()}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add site
              </Button>
            </div>
            <Card>
              <CardContent className="pt-4">
                {sites.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No sites yet. Create a site (e.g. Peshawar HQ) before assigning devices.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Devices</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sites.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-sm">{s.code}</TableCell>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>{s.location || "—"}</TableCell>
                          <TableCell>{s.device_count}</TableCell>
                          <TableCell>
                            <Badge variant={s.is_active ? "default" : "secondary"}>
                              {s.is_active ? "Yes" : "No"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button variant="outline" size="sm" onClick={() => openSite(s)}>
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => void removeSite(s)}>
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <h2 className="mb-3 text-base font-semibold">Modules</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {MODULE_LINKS.map(({ label, href, description, icon: Icon }) => (
              <Link key={href} to={href} className="group block min-w-0">
                <Card className="h-full transition-colors group-hover:border-foreground/20 group-hover:bg-muted/20">
                  <CardHeader className="pb-2">
                    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md border bg-background">
                      <Icon className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-base">{label}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>

          {(data?.recent_alerts?.length || 0) > 0 ? (
            <div className="mt-8">
              <h2 className="mb-3 text-base font-semibold">Recent open alerts</h2>
              <Card>
                <CardContent className="pt-4">
                  <ul className="space-y-2 text-sm">
                    {data!.recent_alerts.map((a) => (
                      <li key={a.id} className="flex items-start justify-between gap-2 border-b py-2 last:border-0">
                        <div>
                          <span className="font-medium">{a.title}</span>
                          <span className="ml-2 text-muted-foreground">{a.device_name}</span>
                        </div>
                        <Badge variant="outline">{a.severity_label}</Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </>
      )}

      <Dialog open={siteDialog} onOpenChange={setSiteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSite ? "Edit site" : "Add site"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label>Code *</Label>
              <Input
                value={siteForm.code}
                onChange={(e) => setSiteForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="DI_KHAN"
              />
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={siteForm.name}
                onChange={(e) => setSiteForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={siteForm.location}
                onChange={(e) => setSiteForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={siteForm.description}
                onChange={(e) => setSiteForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={siteForm.is_active}
                onCheckedChange={(v) => setSiteForm((f) => ({ ...f, is_active: v }))}
              />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSiteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveSite()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}

export function InfrastructureCameras() {
  return (
    <InfrastructureDeviceManager
      deviceType="camera"
      title="Cameras"
      description="Register cameras for infrastructure health (IP, ONVIF, RTSP). Live video stays in AI / Central Ops."
    />
  )
}

export function InfrastructureNvrs() {
  return (
    <InfrastructureDeviceManager
      deviceType="nvr"
      title="NVRs"
      description="Configure NVR inventory with SNMP, channel count, and network settings."
    />
  )
}

export function InfrastructureUps() {
  return (
    <InfrastructureDeviceManager
      deviceType="ups"
      title="UPS Systems"
      description="Configure UPS units — typically SNMP with battery and load metrics."
    />
  )
}

export function InfrastructureInverters() {
  return (
    <InfrastructureDeviceManager
      deviceType="inverter"
      title="Inverters"
      description="Configure inverters with Modbus TCP/RTU and manufacturer register maps."
    />
  )
}

export function InfrastructureNetwork() {
  return (
    <InfrastructureDeviceManager
      deviceType="network"
      title="Network Devices"
      description="Configure switches, routers, and access points (usually SNMP + ICMP)."
    />
  )
}

export function InfrastructureServers() {
  return (
    <InfrastructureDeviceManager
      deviceType="server"
      title="Servers"
      description="Linux hosts: set SSH username + password (port 22), then open Detail and Poll live for CPU, RAM, disk, GPU, services, and logs."
    />
  )
}

export function InfrastructureDeviceHealth() {
  const [devices, setDevices] = useState<InfraDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDevices(await fetchInfraDevices())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 20000)
    return () => window.clearInterval(id)
  }, [load])

  return (
    <ModulePageLayout
      title="Device Health"
      description="Live status board — polled from devices automatically (not user-selected)."
      breadcrumbs={[
        { label: "Infrastructure Monitoring", href: ROUTES.INFRASTRUCTURE_OVERVIEW },
        { label: "Device Health" },
      ]}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void refreshInfraMonitoring()
              .then(load)
              .catch((e) => setError(e instanceof Error ? e.message : "Refresh failed"))
          }
        >
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Sync &amp; poll
        </Button>
      }
    >
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Protocol</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last polled</TableHead>
                  <TableHead>Last error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>{d.device_type_label}</TableCell>
                    <TableCell className="font-mono text-sm">{d.ip_address || "—"}</TableCell>
                    <TableCell>{d.primary_protocol_label}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{d.status_label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.last_polled_at
                        ? new Date(d.last_polled_at).toLocaleString()
                        : d.last_seen_at
                          ? new Date(d.last_seen_at).toLocaleString()
                          : "—"}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                      {d.last_error || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </ModulePageLayout>
  )
}

export function InfrastructurePower() {
  const [devices, setDevices] = useState<InfraDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPower = async () => {
      setLoading(true)
      try {
        const all = await fetchInfraDevices()
        setDevices(all.filter((d) => d.device_type === "ups" || d.device_type === "inverter"))
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load")
      } finally {
        setLoading(false)
      }
    }
    void loadPower()
    const id = window.setInterval(() => void loadPower(), 20000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <ModulePageLayout
      title="Power Monitoring"
      description="Live UPS / inverter metrics from Modbus or SNMP polls (auto-updated)."
      breadcrumbs={[
        { label: "Infrastructure Monitoring", href: ROUTES.INFRASTRUCTURE_OVERVIEW },
        { label: "Power Monitoring" },
      ]}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void refreshInfraMonitoring().then(async () => {
              const all = await fetchInfraDevices()
              setDevices(all.filter((d) => d.device_type === "ups" || d.device_type === "inverter"))
            })
          }
        >
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Poll now
        </Button>
      }
    >
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Power assets</CardTitle>
          <CardDescription>
            Values come from the last successful device poll (Modbus registers / SNMP). Not entered
            by hand.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : devices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No UPS or inverter configured. Add them under UPS Systems / Inverters.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {devices.map((d) => {
                const m = d.last_metrics || {}
                return (
                  <Card key={d.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{d.name}</CardTitle>
                        <Badge variant="outline">{d.status_label}</Badge>
                      </div>
                      <CardDescription>
                        {d.device_type_label} · {d.primary_protocol_label}
                        {d.ip_address ? ` · ${d.ip_address}` : ""}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Battery %</p>
                        <p className="font-medium tabular-nums">
                          {m.battery_percent != null ? String(m.battery_percent) : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Solar kW</p>
                        <p className="font-medium tabular-nums">
                          {m.solar_kw != null || m.pv_power_kw != null
                            ? String(m.solar_kw ?? m.pv_power_kw)
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Load kW</p>
                        <p className="font-medium tabular-nums">
                          {m.load_kw != null ? String(m.load_kw) : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Grid</p>
                        <p className="font-medium">
                          {m.grid_available == null
                            ? "—"
                            : m.grid_available
                              ? "Available"
                              : "Unavailable"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </ModulePageLayout>
  )
}

export function InfrastructureAlerts() {
  const [alerts, setAlerts] = useState<InfraAlert[]>([])
  const [rules, setRules] = useState<InfraAlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ruleOpen, setRuleOpen] = useState(false)
  const [ruleForm, setRuleForm] = useState({
    name: "",
    device_type: "",
    metric_key: "battery_percent",
    operator: "lt",
    threshold_value: "20",
    severity: "high" as const,
    message_template: "Battery below threshold",
    is_active: true,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [a, r] = await Promise.all([
        fetchInfraAlerts({ resolved: false }),
        fetchInfraAlertRules(),
      ])
      setAlerts(a)
      setRules(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load alerts")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveRule = async () => {
    try {
      await createInfraAlertRule({
        name: ruleForm.name,
        device_type: ruleForm.device_type,
        metric_key: ruleForm.metric_key,
        operator: ruleForm.operator,
        threshold_value: Number(ruleForm.threshold_value),
        severity: ruleForm.severity,
        message_template: ruleForm.message_template,
        is_active: ruleForm.is_active,
      })
      setRuleOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create rule")
    }
  }

  return (
    <ModulePageLayout
      title="Alerts"
      description="Open infrastructure alerts and threshold rules."
      breadcrumbs={[
        { label: "Infrastructure Monitoring", href: ROUTES.INFRASTRUCTURE_OVERVIEW },
        { label: "Alerts" },
      ]}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setRuleOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Alert rule
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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Open alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No open alerts.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell>{a.device_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{a.severity_label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(a.last_detected).toLocaleString()}
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      {!a.acknowledged ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void acknowledgeInfraAlert(a.id).then(load)}
                        >
                          Ack
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        onClick={() => void resolveInfraAlert(a.id).then(load)}
                      >
                        Resolve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alert rules</CardTitle>
          <CardDescription>Thresholds used by a future poller (e.g. battery &lt; 20%).</CardDescription>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No rules configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Metric</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="font-mono text-sm">{r.metric_key}</TableCell>
                    <TableCell className="text-sm">
                      {r.operator} {r.threshold_value ?? ""}
                    </TableCell>
                    <TableCell>{r.severity}</TableCell>
                    <TableCell>{r.is_active ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void deleteInfraAlertRule(r.id).then(load)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New alert rule</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={ruleForm.name}
                onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Device type (optional)</Label>
              <Select
                value={ruleForm.device_type || "__all__"}
                onValueChange={(v) =>
                  setRuleForm((f) => ({ ...f, device_type: v === "__all__" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All types</SelectItem>
                  <SelectItem value="ups">UPS</SelectItem>
                  <SelectItem value="inverter">Inverter</SelectItem>
                  <SelectItem value="nvr">NVR</SelectItem>
                  <SelectItem value="camera">Camera</SelectItem>
                  <SelectItem value="network">Network</SelectItem>
                  <SelectItem value="server">Server</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Metric key</Label>
              <Input
                value={ruleForm.metric_key}
                onChange={(e) => setRuleForm((f) => ({ ...f, metric_key: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Operator</Label>
                <Select
                  value={ruleForm.operator}
                  onValueChange={(v) => setRuleForm((f) => ({ ...f, operator: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["lt", "lte", "gt", "gte", "eq", "neq"].map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Threshold</Label>
                <Input
                  value={ruleForm.threshold_value}
                  onChange={(e) =>
                    setRuleForm((f) => ({ ...f, threshold_value: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Input
                value={ruleForm.message_template}
                onChange={(e) =>
                  setRuleForm((f) => ({ ...f, message_template: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveRule()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}

export function InfrastructureEvents() {
  const [events, setEvents] = useState<InfraEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setEvents(await fetchInfraEvents())
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load events")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <ModulePageLayout
      title="Events"
      description="Timeline of device configuration changes and status events."
      breadcrumbs={[
        { label: "Infrastructure Monitoring", href: ROUTES.INFRASTRUCTURE_OVERVIEW },
        { label: "Events" },
      ]}
    >
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No events yet. Creating or updating devices will appear here.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Actor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(ev.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ev.event_type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{ev.title}</TableCell>
                    <TableCell>{ev.device_name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ev.actor || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </ModulePageLayout>
  )
}

export function InfrastructureReports() {
  const [report, setReport] = useState<InfraReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setReport(await fetchInfraReport())
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load report")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <ModulePageLayout
      title="Reports"
      description="Availability and protocol coverage across infrastructure assets."
      breadcrumbs={[
        { label: "Infrastructure Monitoring", href: ROUTES.INFRASTRUCTURE_OVERVIEW },
        { label: "Reports" },
      ]}
    >
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {loading || !report ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Generated {new Date(report.generated_at).toLocaleString()}
          </p>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="SNMP devices" value={report.snmp_devices} />
            <StatCard label="Modbus devices" value={report.modbus_devices} />
            <StatCard label="Missing IP" value={report.devices_without_ip} />
            <StatCard label="No protocol" value={report.devices_without_protocol} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Availability by type</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Online</TableHead>
                    <TableHead>Offline</TableHead>
                    <TableHead>Availability</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.availability_by_type.map((row) => (
                    <TableRow key={row.device_type}>
                      <TableCell className="capitalize">{row.device_type}</TableCell>
                      <TableCell>{row.total}</TableCell>
                      <TableCell>{row.online}</TableCell>
                      <TableCell>{row.offline}</TableCell>
                      <TableCell className="tabular-nums">{row.availability_pct}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </ModulePageLayout>
  )
}
