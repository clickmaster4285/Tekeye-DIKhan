import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  Activity,
  AlertCircle,
  Cpu,
  Fan,
  Gauge,
  HardDrive,
  Loader2,
  MemoryStick,
  Network,
  RefreshCw,
  Server,
  Thermometer,
  Trash2,
  Zap,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ROUTES, getInfrastructureServerDetailPath } from "@/routes/config"
import {
  fetchServerDetail,
  deleteServerLogs,
  refreshServerLogs,
  type ServerDetailPayload,
  type ServerLogEntry,
} from "@/lib/infrastructure-api"
import { getStoredUser } from "@/lib/auth"
import { normalizeRole } from "@/lib/role-access"

function MetricRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right tabular-nums">{value ?? "—"}</span>
    </div>
  )
}

function statusTone(status: string) {
  const s = status.toLowerCase()
  if (s.includes("online") || s === "ok" || s === "up" || s === "running" || s === "normal") {
    return "bg-emerald-100 text-emerald-800 border-emerald-200"
  }
  if (s.includes("offline") || s.includes("error") || s.includes("fault") || s === "down" || s === "stopped") {
    return "bg-red-100 text-red-800 border-red-200"
  }
  if (s.includes("pending") || s.includes("degraded") || s.includes("warning")) {
    return "bg-amber-100 text-amber-800 border-amber-200"
  }
  return "bg-slate-100 text-slate-700 border-slate-200"
}

const SECTIONS = [
  { id: "cpu", label: "CPU" },
  { id: "ram", label: "RAM" },
  { id: "disk", label: "Disk" },
  { id: "network", label: "Network" },
  { id: "temperature", label: "Temperature" },
  { id: "services", label: "Services" },
  { id: "gpu", label: "GPU" },
  { id: "logs", label: "Logs" },
] as const

function LogTable({ rows }: { rows: ServerLogEntry[] }) {
  if (!rows.length) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No log entries.</p>
  }
  return (
    <div className="max-h-[420px] overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((log, idx) => (
            <TableRow key={log.fingerprint || `${log.event_id}-${idx}`}>
              <TableCell className="whitespace-nowrap text-xs">
                {log.log_time ? new Date(log.log_time).toLocaleString() : "—"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={`border ${statusTone(log.level || log.category)}`}>
                  {log.level || log.category}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">{log.source || "—"}</TableCell>
              <TableCell className="font-mono text-xs">{log.event_id || "—"}</TableCell>
              <TableCell className="max-w-[420px] truncate text-xs" title={log.message}>
                {log.message || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default function ServerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const serverId = Number(id)
  const isAdmin = normalizeRole(getStoredUser()?.role) === "ADMIN"
  const [data, setData] = useState<ServerDetailPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [probing, setProbing] = useState(false)
  const [logBusy, setLogBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logTab, setLogTab] = useState<"error" | "access" | "system" | "security" | "application" | "all">(
    "error"
  )

  const load = useCallback(
    async (refresh = false) => {
      if (!Number.isFinite(serverId)) {
        setError("Invalid server id")
        setLoading(false)
        return
      }
      if (refresh) setProbing(true)
      else setLoading(true)
      setError(null)
      try {
        const payload = await fetchServerDetail(serverId, { refresh })
        setData(payload)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load server detail")
      } finally {
        setLoading(false)
        setProbing(false)
      }
    },
    [serverId]
  )

  useEffect(() => {
    void load(false)
    const t = window.setInterval(() => void load(false), 30000)
    return () => window.clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!data || loading) return
    const hash = window.location.hash.replace("#", "")
    if (!hash) return
    window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 100)
  }, [data, loading])

  if (!Number.isFinite(serverId)) {
    return (
      <ModulePageLayout title="Server Detail" description="Invalid server" breadcrumbs={[]}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Invalid server id.</AlertDescription>
        </Alert>
      </ModulePageLayout>
    )
  }

  const logRows =
    logTab === "all"
      ? data?.logs.all || []
      : logTab === "error"
        ? data?.logs.error || []
        : logTab === "access"
          ? data?.logs.access || []
          : logTab === "system"
            ? data?.logs.system || []
            : logTab === "security"
              ? data?.logs.security || []
              : data?.logs.application || []

  return (
    <ModulePageLayout
      title={data?.name || "Server Detail"}
      description="Live server health via SSH — CPU, RAM, disk, network, temperature, services, GPU, and logs."
      breadcrumbs={[
        { label: "Infrastructure Monitoring", href: ROUTES.INFRASTRUCTURE_OVERVIEW },
        { label: "Servers", href: ROUTES.INFRASTRUCTURE_SERVERS },
        { label: data?.name || `Server #${serverId}` },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.INFRASTRUCTURE_SERVERS)}>
            Back to Servers
          </Button>
          <Button size="sm" onClick={() => void load(true)} disabled={probing || loading}>
            {probing ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-4 w-4" />
            )}
            Poll live
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
          Loading server health…
        </div>
      ) : data ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-background">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{data.name}</h2>
                    <Badge className={`border ${statusTone(data.status_label)}`} variant="outline">
                      {data.status_label}
                    </Badge>
                    <Badge className={`border ${statusTone(data.agent_status)}`} variant="outline">
                      {data.agent_status === "online"
                        ? "Metrics: online"
                        : data.agent_status === "ssh_needed"
                          ? "SSH credentials needed"
                          : `Metrics: ${data.agent_status}`}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {data.ip_address || "No IP"}
                    {data.server_role ? ` · ${data.server_role}` : ""}
                    {" · "}
                    {[data.manufacturer, data.model_number].filter(Boolean).join(" ") || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last polled:{" "}
                    {data.last_polled_at ? new Date(data.last_polled_at).toLocaleString() : "—"}
                  </p>
                </div>
              </div>
              {(data.last_error || data.agent_hint || data.server_probe_error) && (
                <p className="max-w-md text-xs text-amber-700">
                  {data.last_error || data.server_probe_error || data.agent_hint}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <Button key={s.id} variant="outline" size="sm" asChild>
                <a href={`#${s.id}`}>{s.label}</a>
              </Button>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <HardDrive className="h-4 w-4" />
                Device Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MetricRow label="Hostname" value={data.device_information.hostname} />
              <MetricRow
                label="OS"
                value={[data.device_information.os_name, data.device_information.os_release]
                  .filter(Boolean)
                  .join(" ")}
              />
              <MetricRow label="Architecture" value={data.device_information.architecture} />
              <MetricRow label="Processor" value={data.device_information.processor} />
              <MetricRow label="Role" value={data.device_information.role || "—"} />
              <MetricRow label="IP address" value={data.device_information.ip_address} />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card id="cpu">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cpu className="h-4 w-4" />
                  CPU
                </CardTitle>
                <CardDescription>Utilization and core layout</CardDescription>
              </CardHeader>
              <CardContent>
                <MetricRow label="Usage" value={data.cpu.usage_display} />
                <MetricRow
                  label="Logical / physical"
                  value={`${data.cpu.count_logical ?? "—"} / ${data.cpu.count_physical ?? "—"}`}
                />
                <MetricRow
                  label="Load average"
                  value={
                    Array.isArray(data.cpu.load_avg) && data.cpu.load_avg.length
                      ? data.cpu.load_avg.map((n) => Number(n).toFixed(2)).join(" · ")
                      : "—"
                  }
                />
                {data.cpu.per_core?.length ? (
                  <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {data.cpu.per_core.map((v, i) => (
                      <div key={i} className="rounded border px-2 py-1 text-center text-xs tabular-nums">
                        C{i}: {v != null ? `${Number(v).toFixed(0)}%` : "—"}
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card id="ram">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MemoryStick className="h-4 w-4" />
                  RAM
                </CardTitle>
                <CardDescription>Memory and swap</CardDescription>
              </CardHeader>
              <CardContent>
                <MetricRow label="Usage" value={data.ram.usage_display} />
                <MetricRow label="Total" value={data.ram.total_display} />
                <MetricRow label="Used" value={data.ram.used_display} />
                <MetricRow label="Available" value={data.ram.available_display} />
                <MetricRow label="Swap" value={data.ram.swap_display} />
              </CardContent>
            </Card>

            <Card id="temperature">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Thermometer className="h-4 w-4" />
                  Temperature
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MetricRow label="CPU temperature" value={data.temperature.cpu_display} />
                <MetricRow label="Uptime" value={data.temperature.uptime} />
                {(data.temperature.sensors || []).slice(0, 8).map((s, i) => (
                  <MetricRow
                    key={`${s.name}-${i}`}
                    label={s.name}
                    value={s.celsius != null ? `${Number(s.celsius).toFixed(1)} °C` : "—"}
                  />
                ))}
              </CardContent>
            </Card>

            <Card id="disk">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <HardDrive className="h-4 w-4" />
                  Disk
                </CardTitle>
                <CardDescription>{data.disk.count} volume(s)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data.disk.volumes || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No disk data yet.</p>
                ) : (
                  data.disk.volumes.map((v, i) => (
                    <div key={`${v.mount}-${i}`} className="rounded-md border p-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{v.mount || v.device}</span>
                        <Badge variant="outline">{v.percent_display}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {v.used_display} used · {v.free_display} free · {v.total_display} · {v.fstype || "—"}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card id="network">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Network className="h-4 w-4" />
                Network
              </CardTitle>
              <CardDescription>{data.network.count} interface(s)</CardDescription>
            </CardHeader>
            <CardContent>
              {(data.network.interfaces || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No network data yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Interface</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Speed</TableHead>
                        <TableHead>RX</TableHead>
                        <TableHead>TX</TableHead>
                        <TableHead>Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.network.interfaces.map((n, i) => (
                        <TableRow key={`${n.name}-${i}`}>
                          <TableCell className="font-medium">{n.name}</TableCell>
                          <TableCell className="font-mono text-xs">{n.ip_address || "—"}</TableCell>
                          <TableCell>
                            <Badge className={`border ${statusTone(n.status)}`} variant="outline">
                              {n.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {n.speed_mbps ? `${n.speed_mbps} Mbps` : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{n.bytes_recv_display}</TableCell>
                          <TableCell className="text-xs">{n.bytes_sent_display}</TableCell>
                          <TableCell className="text-xs">
                            {(n.errin || 0) + (n.errout || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card id="services">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Services
              </CardTitle>
              <CardDescription>
                {data.services.running ?? "—"} running · {data.services.stopped ?? "—"} stopped ·{" "}
                {data.services.total ?? 0} total
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(data.services.items || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No service data yet.</p>
              ) : (
                <div className="max-h-[360px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Display</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Start type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.services.items.map((s, i) => (
                        <TableRow key={`${s.name}-${i}`}>
                          <TableCell className="font-mono text-xs">{s.name}</TableCell>
                          <TableCell className="text-xs">{s.display_name || "—"}</TableCell>
                          <TableCell>
                            <Badge
                              className={`border ${statusTone(s.running ? "running" : "stopped")}`}
                              variant="outline"
                            >
                              {s.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{s.start_type || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card id="gpu">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4" />
                GPU
              </CardTitle>
              <CardDescription>
                Utilization, VRAM, temperature, power, fan, clock, processes · {data.gpu.count} GPU(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(data.gpu.items || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No GPU reported (nvidia-smi not available or no agent data yet).
                </p>
              ) : (
                data.gpu.items.map((g) => (
                  <div key={`${g.index}-${g.name}`} className="rounded-md border p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">
                        GPU {g.index}: {g.name}
                      </h3>
                      {g.driver_version ? (
                        <Badge variant="outline">Driver {g.driver_version}</Badge>
                      ) : null}
                    </div>
                    <div className="grid gap-x-8 sm:grid-cols-2">
                      <MetricRow
                        label="GPU utilization"
                        value={
                          <span className="inline-flex items-center gap-1">
                            <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                            {g.utilization_display}
                          </span>
                        }
                      />
                      <MetricRow label="VRAM" value={g.vram_display} />
                      <MetricRow label="Temperature" value={g.temperature_display} />
                      <MetricRow label="Power" value={g.power_display} />
                      <MetricRow
                        label="Fan"
                        value={
                          <span className="inline-flex items-center gap-1">
                            <Fan className="h-3.5 w-3.5 text-muted-foreground" />
                            {g.fan_display}
                          </span>
                        }
                      />
                      <MetricRow label="Clock" value={g.clock_display} />
                    </div>
                    <div className="mt-3">
                      <p className="mb-2 text-sm font-medium">GPU processes</p>
                      {(g.processes || []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">No compute processes.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>PID</TableHead>
                              <TableHead>Process</TableHead>
                              <TableHead>VRAM</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {g.processes.map((p, i) => (
                              <TableRow key={`${p.pid}-${i}`}>
                                <TableCell className="font-mono text-xs">{p.pid}</TableCell>
                                <TableCell className="text-xs">{p.name}</TableCell>
                                <TableCell className="text-xs">
                                  {p.vram_mb != null ? `${p.vram_mb} MB` : "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card id="logs">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertCircle className="h-4 w-4" />
                    Logs
                  </CardTitle>
                  <CardDescription>
                    Error, access, system, security, and application logs · {data.logs.total} stored
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={logBusy}
                    onClick={async () => {
                      setLogBusy(true)
                      try {
                        await refreshServerLogs(serverId)
                        await load(false)
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Failed to refresh logs")
                      } finally {
                        setLogBusy(false)
                      }
                    }}
                  >
                    {logBusy ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-4 w-4" />
                    )}
                    Pull logs
                  </Button>
                  {isAdmin ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={logBusy || (data.logs.total || 0) === 0}
                      onClick={async () => {
                        const scope =
                          logTab === "all"
                            ? "ALL stored server logs"
                            : `stored “${logTab}” logs`
                        if (
                          !window.confirm(
                            `Delete ${scope} for this server? This cannot be undone.`
                          )
                        ) {
                          return
                        }
                        setLogBusy(true)
                        try {
                          await deleteServerLogs(
                            serverId,
                            logTab === "all" ? undefined : { category: logTab }
                          )
                          await load(false)
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Failed to delete logs")
                        } finally {
                          setLogBusy(false)
                        }
                      }}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Delete {logTab === "all" ? "all" : logTab} logs
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["error", "Error"],
                    ["access", "Access"],
                    ["system", "System"],
                    ["security", "Security"],
                    ["application", "Application"],
                    ["all", "All"],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={logTab === key ? "default" : "outline"}
                    onClick={() => setLogTab(key)}
                  >
                    {label}
                    {key !== "all" ? ` (${(data.logs as Record<string, ServerLogEntry[]>)[key]?.length ?? 0})` : ""}
                  </Button>
                ))}
              </div>
              <LogTable rows={logRows} />
              <p className="text-xs text-muted-foreground">
                Detail link:{" "}
                <Link className="underline" to={getInfrastructureServerDetailPath(serverId)}>
                  {getInfrastructureServerDetailPath(serverId)}
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </ModulePageLayout>
  )
}
