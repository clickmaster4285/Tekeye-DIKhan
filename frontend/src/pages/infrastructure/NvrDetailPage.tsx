import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  Activity,
  AlertCircle,
  Camera,
  Cpu,
  HardDrive,
  Loader2,
  Network,
  RefreshCw,
  Server,
  Thermometer,
  Trash2,
  Video,
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
import { ROUTES, getInfrastructureNvrDetailPath } from "@/routes/config"
import {
  fetchNvrDetail,
  deleteNvrLogs,
  refreshNvrLogs,
  type NvrDetailPayload,
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

function pct(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return "—"
  return `${Number(v).toFixed(1)}%`
}

function temp(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return "—"
  return `${Number(v).toFixed(1)} °C`
}

function statusTone(status: string) {
  const s = status.toLowerCase()
  if (s.includes("online") || s === "ok" || s === "up" || s === "normal") {
    return "bg-emerald-100 text-emerald-800 border-emerald-200"
  }
  if (s.includes("offline") || s.includes("error") || s.includes("fault") || s === "down") {
    return "bg-red-100 text-red-800 border-red-200"
  }
  if (s.includes("video") || s.includes("degraded") || s.includes("alarm")) {
    return "bg-amber-100 text-amber-800 border-amber-200"
  }
  return "bg-slate-100 text-slate-700 border-slate-200"
}

export default function NvrDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const nvrId = Number(id)
  const isAdmin = normalizeRole(getStoredUser()?.role) === "ADMIN"
  const [data, setData] = useState<NvrDetailPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [probing, setProbing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (refresh = false) => {
      if (!Number.isFinite(nvrId)) {
        setError("Invalid NVR id")
        setLoading(false)
        return
      }
      if (refresh) setProbing(true)
      else setLoading(true)
      setError(null)
      try {
        const payload = await fetchNvrDetail(nvrId, { refresh })
        setData(payload)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load NVR detail")
      } finally {
        setLoading(false)
        setProbing(false)
      }
    },
    [nvrId]
  )

  useEffect(() => {
    void load(false)
    const t = window.setInterval(() => void load(false), 30000)
    return () => window.clearInterval(t)
  }, [load])

  if (!Number.isFinite(nvrId)) {
    return (
      <ModulePageLayout title="NVR Detail" description="Invalid NVR" breadcrumbs={[]}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Invalid NVR id.</AlertDescription>
        </Alert>
      </ModulePageLayout>
    )
  }

  return (
    <ModulePageLayout
      title={data?.name || "NVR Detail"}
      description="Live NVR health — system, storage, network, recording, and camera channels."
      breadcrumbs={[
        { label: "Infrastructure Monitoring", href: ROUTES.INFRASTRUCTURE_OVERVIEW },
        { label: "NVRs", href: ROUTES.INFRASTRUCTURE_NVRS },
        { label: data?.name || `NVR #${nvrId}` },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.INFRASTRUCTURE_NVRS)}>
            Back to NVRs
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
          Loading NVR health…
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Header status */}
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
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {data.ip_address || "No IP"} · {[data.manufacturer, data.model_number].filter(Boolean).join(" ") || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last polled:{" "}
                    {data.last_polled_at ? new Date(data.last_polled_at).toLocaleString() : "—"}
                  </p>
                </div>
              </div>
              {data.last_error ? (
                <p className="max-w-md text-xs text-amber-700">{data.last_error}</p>
              ) : null}
            </CardContent>
          </Card>

          {/* Device Information */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <HardDrive className="h-4 w-4" />
                Device Information
              </CardTitle>
              <CardDescription>Model, firmware/software, system identifiers</CardDescription>
            </CardHeader>
            <CardContent>
              <MetricRow label="Model" value={data.device_information.model} />
              <MetricRow label="Firmware / software" value={data.device_information.firmware} />
              <MetricRow label="Serial number" value={data.device_information.serial_number} />
              <MetricRow label="MAC address" value={data.device_information.mac_address} />
              <MetricRow
                label="System identifiers"
                value={data.device_information.system_identifiers}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* System Health */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cpu className="h-4 w-4" />
                  System Health
                </CardTitle>
                <CardDescription>CPU, RAM, temperature, uptime</CardDescription>
              </CardHeader>
              <CardContent>
                <MetricRow
                  label="NVR status"
                  value={
                    <Badge
                      className={`border ${statusTone(String(data.system_health.nvr_status))}`}
                      variant="outline"
                    >
                      {data.system_health.nvr_status}
                    </Badge>
                  }
                />
                <MetricRow label="System state" value={data.system_health.system_state} />
                <MetricRow
                  label="CPU usage"
                  value={
                    data.system_health.cpu_display ??
                    pct(data.system_health.cpu_usage)
                  }
                />
                <MetricRow
                  label="RAM usage"
                  value={
                    data.system_health.ram_display ??
                    pct(data.system_health.ram_usage)
                  }
                />
                <MetricRow
                  label="Temperature"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
                      {data.system_health.temperature_display ??
                        temp(data.system_health.temperature)}
                    </span>
                  }
                />
                <MetricRow label="Uptime" value={data.system_health.uptime} />
              </CardContent>
            </Card>

            {/* Storage Health */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <HardDrive className="h-4 w-4" />
                  Storage Health
                </CardTitle>
                <CardDescription>HDD status, capacity, free/used, disk errors</CardDescription>
              </CardHeader>
              <CardContent>
                <MetricRow
                  label="HDD status"
                  value={
                    <Badge
                      className={`border ${statusTone(String(data.storage_health.hdd_status))}`}
                      variant="outline"
                    >
                      {data.storage_health.hdd_status}
                    </Badge>
                  }
                />
                <MetricRow label="HDD capacity" value={data.storage_health.hdd_capacity} />
                <MetricRow label="Used space" value={data.storage_health.used_space} />
                <MetricRow label="Free space" value={data.storage_health.free_space} />
                <MetricRow label="Disk errors" value={data.storage_health.disk_errors} />
              </CardContent>
            </Card>

            {/* Network Health */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Network className="h-4 w-4" />
                  Network Health
                </CardTitle>
                <CardDescription>Interface, link speed, traffic, errors</CardDescription>
              </CardHeader>
              <CardContent>
                <MetricRow
                  label="Interface status"
                  value={data.network_health.interface_status}
                />
                <MetricRow label="Link speed" value={data.network_health.link_speed} />
                <MetricRow
                  label="Duplex"
                  value={data.network_health.duplex && data.network_health.duplex !== "—"
                    ? data.network_health.duplex
                    : "—"}
                />
                <MetricRow
                  label="IP mode"
                  value={
                    data.network_health.addressing && data.network_health.addressing !== "—"
                      ? data.network_health.addressing
                      : "—"
                  }
                />
                <MetricRow label="RX traffic" value={data.network_health.rx_traffic} />
                <MetricRow label="TX traffic" value={data.network_health.tx_traffic} />
                <MetricRow label="Network errors" value={data.network_health.network_errors} />
              </CardContent>
            </Card>

            {/* Recording */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Video className="h-4 w-4" />
                  Recording
                </CardTitle>
                <CardDescription>Recording status and alarms</CardDescription>
              </CardHeader>
              <CardContent>
                <MetricRow label="Recording status" value={data.recording.recording_status} />
                <MetricRow label="Recording alarms" value={data.recording.recording_alarms} />
              </CardContent>
            </Card>
          </div>

          {/* Alarms */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Alarms
              </CardTitle>
              <CardDescription>Storage, network, hardware and other alarms</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-x-8 sm:grid-cols-2">
              <MetricRow label="Storage alarms" value={data.alarms.storage} />
              <MetricRow label="Network alarms" value={data.alarms.network} />
              <MetricRow label="Hardware alarms" value={data.alarms.hardware} />
              <MetricRow label="Other alarms" value={data.alarms.other} />
            </CardContent>
          </Card>

          {/* Camera Channels */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="h-4 w-4" />
                Camera Channels
              </CardTitle>
              <CardDescription>
                Online / offline / video loss / recording — pulled live from the NVR (ISAPI /
                Dahua), not from TekEye camera records
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.vendor_probe_error ? (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {data.vendor_probe_error}. Edit the NVR and set username/password (HTTP/ISAPI
                    port, usually 80) then click Poll live.
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {(
                  [
                    ["Total", data.camera_channels.total],
                    ["Online", data.camera_channels.online],
                    ["Offline", data.camera_channels.offline],
                    ["Video loss", data.camera_channels.video_loss],
                    ["Recording", data.camera_channels.recording],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-md border bg-muted/20 px-3 py-2">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg font-semibold tabular-nums">{value}</p>
                  </div>
                ))}
              </div>

              {(data.camera_channels.items || []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No channels returned by the NVR yet. Ensure IP + credentials are set, HTTP port
                  (ONVIF port field) is correct, then Poll live.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Channel</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Recording</TableHead>
                        <TableHead>Last polled</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.camera_channels.items.map((ch) => (
                        <TableRow key={String(ch.id)}>
                          <TableCell className="font-mono text-sm">
                            {ch.channel ?? "—"}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div>{ch.name}</div>
                            {ch.code ? (
                              <div className="text-xs text-muted-foreground">{ch.code}</div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Badge className={`border ${statusTone(ch.status)}`} variant="outline">
                              {ch.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>{ch.recording ? "Yes" : "No"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {ch.last_polled_at
                              ? new Date(ch.last_polled_at).toLocaleString()
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* NVR Logs */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4" />
                    NVR Logs
                  </CardTitle>
                  <CardDescription>
                    All major types from the NVR (Information, Trigger Alarm, Exception, Operation,
                    …) — same columns as the NVR log viewer
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={probing}
                    onClick={() =>
                      void (async () => {
                        setProbing(true)
                        setError(null)
                        try {
                          const res = await refreshNvrLogs(nvrId)
                          setData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  nvr_logs: res.results,
                                  nvr_logs_count: res.count,
                                }
                              : prev
                          )
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Failed to pull NVR logs")
                        } finally {
                          setProbing(false)
                        }
                      })()
                    }
                  >
                    {probing ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-4 w-4" />
                    )}
                    Pull all logs
                  </Button>
                  {isAdmin ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={probing || !(data.nvr_logs_count || data.nvr_logs?.length)}
                      onClick={() =>
                        void (async () => {
                          if (
                            !window.confirm(
                              "Delete ALL stored NVR logs for this device? This cannot be undone."
                            )
                          ) {
                            return
                          }
                          setProbing(true)
                          setError(null)
                          try {
                            await deleteNvrLogs(nvrId)
                            setData((prev) =>
                              prev ? { ...prev, nvr_logs: [], nvr_logs_count: 0 } : prev
                            )
                          } catch (e) {
                            setError(e instanceof Error ? e.message : "Failed to delete NVR logs")
                          } finally {
                            setProbing(false)
                          }
                        })()
                      }
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Delete logs
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">
                {data.nvr_logs_count ?? data.nvr_logs?.length ?? 0} log entries stored
              </p>
              {(data.nvr_logs || []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No logs yet. Click &quot;Pull all logs&quot; or Poll live. Requires NVR
                  username/password.
                </p>
              ) : (
                <div className="max-h-[480px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">No.</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Major Type</TableHead>
                        <TableHead>Subtype</TableHead>
                        <TableHead>Channel No.</TableHead>
                        <TableHead>Local/Remote User</TableHead>
                        <TableHead>Remote Host IP Address</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.nvr_logs.map((log, idx) => (
                        <TableRow key={`${log.time}-${idx}`}>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {log.no ?? idx + 1}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {log.time}
                          </TableCell>
                          <TableCell className="text-sm">{log.major_type}</TableCell>
                          <TableCell className="max-w-[280px] text-sm">
                            {log.subtype || log.minor_type || log.description}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {log.channel_no || log.channel || "--"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.local_remote_user || log.user || "--"}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {log.remote_host_ip || "--"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Channels and logs are read from the NVR over HTTP (Hikvision ISAPI / Dahua CGI). Values
            marked “—” are not exposed by this firmware.{" "}
            <Link className="underline" to={getInfrastructureNvrDetailPath(nvrId)}>
              Permalink
            </Link>
          </p>
        </div>
      ) : null}
    </ModulePageLayout>
  )
}
