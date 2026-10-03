import { useCallback, useEffect, useRef, useState } from "react"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  RefreshCw,
  WifiOff,
  XCircle,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  fetchCameraHealthDashboard,
  resolveHealthAlert,
  scanCameraHealth,
  type CameraHealthDashboard,
  type HealthStatus,
} from "@/lib/camera-health-api"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

function statusBadge(status: HealthStatus | string) {
  const map: Record<string, string> = {
    healthy: "bg-emerald-100 text-emerald-800 border-emerald-200",
    degraded: "bg-amber-100 text-amber-900 border-amber-200",
    critical: "bg-red-100 text-red-800 border-red-200",
    offline: "bg-slate-200 text-slate-800 border-slate-300",
    unknown: "bg-muted text-muted-foreground",
  }
  return map[status] || map.unknown
}

function statusLabel(status: HealthStatus | string) {
  if (status === "unknown") return "Not scanned"
  return status
}

function severityBadge(severity: string) {
  const map: Record<string, string> = {
    info: "secondary",
    medium: "outline",
    high: "default",
    critical: "destructive",
  }
  return (map[severity] || "outline") as "default" | "secondary" | "destructive" | "outline"
}

function pct(v?: number) {
  return Math.round(Math.max(0, Math.min(100, Number(v) || 0)))
}

export default function AiSuggestionsPage() {
  const { toast } = useToast()
  const [data, setData] = useState<CameraHealthDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const autoScannedRef = useRef(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const dash = await fetchCameraHealthDashboard()
      setData(dash)
      setSelectedId((prev) => {
        if (prev != null) return prev
        return dash.cameras[0]?.camera_id ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load camera health")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), 30000)
    return () => window.clearInterval(t)
  }, [load])

  const onScanAll = async () => {
    setScanning(true)
    try {
      const result = (await scanCameraHealth()) as { ok?: number; failed?: number }
      toast({
        title: "Health scan finished",
        description: `Updated ${result?.ok ?? 0} camera(s)${result?.failed ? `, ${result.failed} failed` : ""}.`,
      })
      await load()
    } catch (err) {
      toast({
        title: "Scan failed",
        description: err instanceof Error ? err.message : "Could not scan cameras",
        variant: "destructive",
      })
    } finally {
      setScanning(false)
    }
  }

  // First visit with no snapshots: scan automatically once
  useEffect(() => {
    if (!data || scanning || loading || autoScannedRef.current) return
    const allUnknown =
      data.cameras.length > 0 && data.cameras.every((c) => c.status === "unknown")
    if (!allUnknown) return
    autoScannedRef.current = true
    void onScanAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, scanning, loading])

  const onResolve = async (id: number) => {
    try {
      await resolveHealthAlert(id)
      await load()
    } catch (err) {
      toast({
        title: "Could not resolve",
        description: err instanceof Error ? err.message : "Request failed",
        variant: "destructive",
      })
    }
  }

  const selected = data?.cameras.find((c) => c.camera_id === selectedId) || null
  const by = data?.by_status || {}

  return (
    <ModulePageLayout
      title="AI Suggestions — Camera Health & Visibility"
      description="OpenCV + purpose-aware YOLO checks: blur, lighting, freeze, FPS, and whether people / vehicles / plates are usable for AI."
      breadcrumbs={[
        { label: "AI Monitoring & Analytics" },
        { label: "AI Suggestions" },
      ]}
      actions={
        <Button type="button" onClick={() => void onScanAll()} disabled={scanning || loading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", scanning && "animate-spin")} />
          {scanning ? "Scanning…" : "Scan all cameras"}
        </Button>
      }
    >
      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cameras</CardDescription>
            <CardTitle className="text-2xl">{data?.camera_count ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Healthy
            </CardDescription>
            <CardTitle className="text-2xl">{by.healthy ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Degraded
            </CardDescription>
            <CardTitle className="text-2xl">{by.degraded ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5 text-red-600" /> Critical
            </CardDescription>
            <CardTitle className="text-2xl">{by.critical ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <WifiOff className="h-3.5 w-3.5" /> Offline / open alerts
            </CardDescription>
            <CardTitle className="text-2xl">
              {by.offline ?? 0} / {data?.open_alerts ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> Camera health
            </CardTitle>
            <CardDescription>Click a row for metrics and AI recommendations</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Camera</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Alerts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.cameras || []).map((cam) => (
                      <TableRow
                        key={cam.camera_id}
                        className={cn(
                          "cursor-pointer",
                          selectedId === cam.camera_id && "bg-muted/60"
                        )}
                        onClick={() => setSelectedId(cam.camera_id)}
                      >
                        <TableCell>
                          <div className="font-medium">{cam.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {cam.code}
                            {cam.zone ? ` · ${cam.zone}` : ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex rounded border px-2 py-0.5 text-xs font-medium capitalize",
                              statusBadge(cam.status)
                            )}
                          >
                            {statusLabel(cam.status)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="w-24">
                            <div className="mb-1 text-sm font-semibold">{pct(cam.overall_score)}</div>
                            <Progress value={pct(cam.overall_score)} className="h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell className="text-xs max-w-[140px] truncate">
                          {(cam.purposes || []).join(", ") || "—"}
                        </TableCell>
                        <TableCell>{cam.open_alerts}</TableCell>
                      </TableRow>
                    ))}
                    {!data?.cameras?.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground text-sm">
                          No active cameras. Assign cameras in Camera Integration, then scan.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
            <CardDescription>
              {selected ? selected.name : "Select a camera"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">No camera selected.</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded border px-2 py-0.5 text-xs font-medium capitalize",
                      statusBadge(selected.status)
                    )}
                  >
                    {selected.status}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      setScanning(true)
                      try {
                        await scanCameraHealth(selected.camera_id)
                        await load()
                      } finally {
                        setScanning(false)
                      }
                    }}
                  >
                    Rescan
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Metric label="Sharpness" value={selected.latest?.sharpness} />
                  <Metric label="Brightness" value={selected.latest?.brightness} />
                  <Metric label="Contrast" value={selected.latest?.contrast} />
                  <Metric label="Dark %" value={pct((selected.latest?.dark_ratio || 0) * 100)} suffix="%" />
                  <Metric label="Overexpose %" value={pct((selected.latest?.bright_ratio || 0) * 100)} suffix="%" />
                  <Metric label="Freeze" value={pct((selected.latest?.freeze_score || 0) * 100)} suffix="%" />
                  <Metric label="Person vis." value={pct((selected.latest?.person_visibility || 0) * 100)} suffix="%" />
                  <Metric label="Vehicle vis." value={pct((selected.latest?.vehicle_visibility || 0) * 100)} suffix="%" />
                  <Metric label="Plate vis." value={pct((selected.latest?.plate_visibility || 0) * 100)} suffix="%" />
                  <Metric label="Face vis." value={pct((selected.latest?.face_visibility || 0) * 100)} suffix="%" />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                    <Lightbulb className="h-3.5 w-3.5" /> Suggestions
                  </p>
                  <ul className="space-y-2">
                    {(selected.latest?.recommendations || []).length ? (
                      (selected.latest?.recommendations || []).map((rec, i) => (
                        <li key={i} className="rounded-md border border-border bg-muted/30 p-2.5 text-sm">
                          <p className="font-medium">{rec.message}</p>
                          <p className="text-muted-foreground mt-1">{rec.recommendation}</p>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-muted-foreground">
                        {selected.top_recommendation || "No suggestions yet — run a scan."}
                      </li>
                    )}
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Open AI suggestions</CardTitle>
          <CardDescription>Actionable issues from the latest health checks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Camera</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Recommendation</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.suggestions || []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.camera_name}</div>
                      <div className="text-xs text-muted-foreground">{s.camera_code}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{s.message}</div>
                      <div className="text-xs text-muted-foreground">{s.alert_type}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={severityBadge(s.severity)} className="capitalize">
                        {s.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-md">{s.recommendation}</TableCell>
                    <TableCell>
                      <Button type="button" size="sm" variant="ghost" onClick={() => void onResolve(s.id)}>
                        Resolve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!data?.suggestions?.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">
                      No open suggestions. Cameras look healthy or have not been scanned yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </ModulePageLayout>
  )
}

function Metric({
  label,
  value,
  suffix = "",
}: {
  label: string
  value?: number
  suffix?: string
}) {
  const shown = value == null || Number.isNaN(Number(value)) ? "—" : `${Math.round(Number(value))}${suffix}`
  return (
    <div className="rounded-md border border-border px-2.5 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{shown}</p>
    </div>
  )
}
