import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  Activity,
  AlertCircle,
  Camera,
  Cpu,
  Eye,
  Loader2,
  Network,
  RefreshCw,
  Thermometer,
  Video,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ROUTES, getInfrastructureNvrDetailPath } from "@/routes/config"
import {
  fetchCameraDetail,
  type CameraDetailPayload,
} from "@/lib/infrastructure-api"

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
  if (
    s.includes("online") ||
    s === "ok" ||
    s === "up" ||
    s === "normal" ||
    s === "healthy" ||
    s === "receiving" ||
    s === "none" ||
    s === "no"
  ) {
    return "bg-emerald-100 text-emerald-800 border-emerald-200"
  }
  if (
    s.includes("offline") ||
    s.includes("error") ||
    s.includes("fault") ||
    s === "down" ||
    s === "lost" ||
    s === "yes" ||
    s.includes("video loss") ||
    s === "poor"
  ) {
    return "bg-red-100 text-red-800 border-red-200"
  }
  if (s.includes("degraded") || s.includes("alarm") || s === "possible" || s === "unknown") {
    return "bg-amber-100 text-amber-800 border-amber-200"
  }
  return "bg-slate-100 text-slate-700 border-slate-200"
}

function ToneBadge({ value }: { value: string }) {
  return (
    <Badge className={`border ${statusTone(value)}`} variant="outline">
      {value}
    </Badge>
  )
}

export default function CameraDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const cameraId = Number(id)
  const [data, setData] = useState<CameraDetailPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [probing, setProbing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (refresh = false) => {
      if (!Number.isFinite(cameraId)) {
        setError("Invalid camera id")
        setLoading(false)
        return
      }
      if (refresh) setProbing(true)
      else setLoading(true)
      setError(null)
      try {
        const payload = await fetchCameraDetail(cameraId, { refresh })
        setData(payload)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load camera detail")
      } finally {
        setLoading(false)
        setProbing(false)
      }
    },
    [cameraId]
  )

  useEffect(() => {
    void load(false)
    const t = window.setInterval(() => void load(false), 30000)
    return () => window.clearInterval(t)
  }, [load])

  if (!Number.isFinite(cameraId)) {
    return (
      <ModulePageLayout title="Camera Detail" description="Invalid camera" breadcrumbs={[]}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Invalid camera id.</AlertDescription>
        </Alert>
      </ModulePageLayout>
    )
  }

  const title = data?.camera_code && data.camera_code !== "—" ? data.camera_code : data?.name || "Camera Detail"

  return (
    <ModulePageLayout
      title={title}
      description="Live camera health — status, network, RTSP, and image quality."
      breadcrumbs={[
        { label: "Infrastructure Monitoring", href: ROUTES.INFRASTRUCTURE_OVERVIEW },
        { label: "Cameras", href: ROUTES.INFRASTRUCTURE_CAMERAS },
        { label: title },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.INFRASTRUCTURE_CAMERAS)}>
            Back to Cameras
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
          Loading camera health…
        </div>
      ) : data ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-background">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{data.name}</h2>
                    <ToneBadge value={data.summary.overall} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {data.camera_code} · Channel {data.channel}
                    {data.ip_address ? ` · ${data.ip_address}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[data.manufacturer, data.model_number].filter(Boolean).join(" ") || "—"}
                    {data.parent_nvr_name && data.parent_nvr_name !== "—" ? (
                      <>
                        {" · NVR: "}
                        {data.parent_nvr_id ? (
                          <Link
                            className="underline underline-offset-2"
                            to={getInfrastructureNvrDetailPath(data.parent_nvr_id)}
                          >
                            {data.parent_nvr_name}
                          </Link>
                        ) : (
                          data.parent_nvr_name
                        )}
                      </>
                    ) : null}
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

          {/* Hero summary matching ops card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Status Overview
              </CardTitle>
              <CardDescription>SNMP / management, network, stream, and overall health</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                <MetricRow
                  label="SNMP Status"
                  value={
                    <span className="inline-flex flex-col items-end gap-0.5">
                      <ToneBadge value={data.summary.snmp_status} />
                      {data.summary.snmp_via && data.summary.snmp_via !== "—" ? (
                        <span className="text-[10px] font-normal text-muted-foreground">
                          via {data.summary.snmp_via}
                        </span>
                      ) : null}
                    </span>
                  }
                />
                <MetricRow label="Network" value={<ToneBadge value={data.summary.network} />} />
                <MetricRow label="Uptime" value={data.summary.uptime} />
                <MetricRow
                  label="Temperature"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
                      {data.summary.temperature_display}
                    </span>
                  }
                />
                <MetricRow label="Interface" value={data.summary.interface} />
                <MetricRow label="RTSP" value={<ToneBadge value={data.summary.rtsp} />} />
                <MetricRow label="FPS" value={data.summary.fps_display} />
                <MetricRow label="Video Loss" value={<ToneBadge value={data.summary.video_loss} />} />
                <div className="sm:col-span-2 pt-2">
                  <MetricRow label="Overall" value={<ToneBadge value={data.summary.overall} />} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="h-4 w-4" />
                  Image Quality
                </CardTitle>
                <CardDescription>Blur, brightness, visibility, obstruction</CardDescription>
              </CardHeader>
              <CardContent>
                <MetricRow label="Blur" value={<ToneBadge value={data.image_quality.blur} />} />
                <MetricRow
                  label="Brightness"
                  value={<ToneBadge value={data.image_quality.brightness} />}
                />
                <MetricRow
                  label="Visibility"
                  value={<ToneBadge value={data.image_quality.visibility} />}
                />
                <MetricRow
                  label="Obstruction"
                  value={<ToneBadge value={data.image_quality.obstruction} />}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cpu className="h-4 w-4" />
                  System Health
                </CardTitle>
                <CardDescription>CPU, RAM, temperature, uptime from the camera</CardDescription>
              </CardHeader>
              <CardContent>
                <MetricRow label="CPU usage" value={data.system_health.cpu_display} />
                <MetricRow label="RAM usage" value={data.system_health.ram_display} />
                <MetricRow label="Temperature" value={data.system_health.temperature_display} />
                <MetricRow label="Uptime" value={data.system_health.uptime} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Network className="h-4 w-4" />
                  Network Health
                </CardTitle>
                <CardDescription>Interface, link speed, addressing, traffic</CardDescription>
              </CardHeader>
              <CardContent>
                <MetricRow
                  label="Interface status"
                  value={<ToneBadge value={String(data.network_health.interface_status)} />}
                />
                <MetricRow label="Link speed" value={data.network_health.link_speed} />
                <MetricRow label="Duplex" value={data.network_health.duplex} />
                <MetricRow label="Addressing" value={data.network_health.addressing} />
                <MetricRow label="MAC address" value={data.network_health.mac_address} />
                <MetricRow label="RX traffic" value={data.network_health.rx_traffic} />
                <MetricRow label="TX traffic" value={data.network_health.tx_traffic} />
                <MetricRow label="Network errors" value={data.network_health.network_errors} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Video className="h-4 w-4" />
                  Device Information
                </CardTitle>
                <CardDescription>Model, firmware, identifiers, stream</CardDescription>
              </CardHeader>
              <CardContent>
                <MetricRow label="Model" value={data.device_information.model} />
                <MetricRow label="Firmware" value={data.device_information.firmware} />
                <MetricRow label="Serial number" value={data.device_information.serial_number} />
                <MetricRow label="MAC address" value={data.device_information.mac_address} />
                <MetricRow
                  label="System identifiers"
                  value={data.device_information.system_identifiers}
                />
                <MetricRow label="Camera IP" value={data.device_information.camera_ip} />
                <MetricRow label="Resolution" value={data.device_information.resolution} />
                <MetricRow label="Codec" value={data.device_information.codec} />
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground">
            Management status uses ISAPI when the camera does not answer SNMP. Temperature appears
            only when the firmware exposes it.
          </p>
        </div>
      ) : null}
    </ModulePageLayout>
  )
}
