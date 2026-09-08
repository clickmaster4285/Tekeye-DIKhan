"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Navigate, useNavigate, useSearchParams } from "react-router-dom"
import {
  GripVertical,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Server,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getStoredUser } from "@/lib/auth"
import { fetchSites, type SiteRecord } from "@/lib/cameras-api"
import {
  assignCameraToMlServer,
  autoDistributeCameras,
  fetchDistributionBoard,
  type AutoDistributeResult,
  type DistributionBoard,
  type DistributionCamera,
} from "@/lib/ops-central-api"
import { normalizeRole } from "@/lib/role-access"
import { ROUTES } from "@/routes/config"
import { cn } from "@/lib/utils"

type DropTarget = "unassigned" | number

function CameraChip({
  camera,
  dragging,
  onDragStart,
}: {
  camera: DistributionCamera
  dragging: boolean
  onDragStart: (id: number) => void
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/camera-id", String(camera.id))
        e.dataTransfer.effectAllowed = "move"
        onDragStart(camera.id)
      }}
      className={cn(
        "flex cursor-grab items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm active:cursor-grabbing",
        dragging && "opacity-50"
      )}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{camera.code || camera.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[camera.nvr_name, camera.name !== camera.code ? camera.name : ""]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </div>
  )
}

function Column({
  title,
  subtitle,
  countLabel,
  status,
  cameras,
  dragCameraId,
  onDragStart,
  onDropCamera,
  accent,
}: {
  title: string
  subtitle?: string
  countLabel: string
  status?: string
  cameras: DistributionCamera[]
  dragCameraId: number | null
  onDragStart: (id: number) => void
  onDropCamera: (cameraIdFromTransfer: number | null) => void
  accent?: boolean
}) {
  const [over, setOver] = useState(false)
  const healthy =
    (status || "").toLowerCase() === "healthy" ||
    (status || "").toLowerCase() === "ok" ||
    (status || "").toLowerCase() === "online"

  return (
    <div
      className={cn(
        "flex min-h-[280px] flex-col rounded-lg border bg-card",
        over && "border-emerald-400 ring-2 ring-emerald-200",
        accent && "border-dashed"
      )}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const raw = e.dataTransfer.getData("text/camera-id")
        const fromTransfer = raw ? Number(raw) : NaN
        if (Number.isFinite(fromTransfer) && fromTransfer > 0) {
          onDropCamera(fromTransfer)
          return
        }
        onDropCamera(null)
      }}
    >
      <div className="border-b px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium">{title}</p>
          <Badge variant="secondary">{countLabel}</Badge>
        </div>
        {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        {status ? (
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-xs",
              healthy ? "text-emerald-700" : "text-slate-500"
            )}
          >
            {healthy ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {healthy ? "Healthy" : status}
          </p>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2">
        {cameras.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">Drop cameras here</p>
        ) : (
          cameras.map((cam) => (
            <CameraChip
              key={cam.id}
              camera={cam}
              dragging={dragCameraId === cam.id}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default function OpsCameraDistributionPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const user = getStoredUser()
  const isOpsAdmin = normalizeRole(user?.role) === "IT_SUPERADMIN"

  const [sites, setSites] = useState<SiteRecord[]>([])
  const [siteFilter, setSiteFilter] = useState<string>("")
  const [board, setBoard] = useState<DistributionBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [dragCameraId, setDragCameraId] = useState<number | null>(null)
  const [preview, setPreview] = useState<AutoDistributeResult | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const siteId = siteFilter ? Number(siteFilter) : null
      const data = await fetchDistributionBoard({ site_id: siteId })
      setBoard(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load distribution")
    } finally {
      setLoading(false)
    }
  }, [siteFilter])

  useEffect(() => {
    if (!isOpsAdmin) return
    void fetchSites()
      .then((rows) => setSites(rows.filter((s) => s.is_active)))
      .catch(() => setSites([]))
  }, [isOpsAdmin])

  useEffect(() => {
    if (isOpsAdmin) void load()
  }, [isOpsAdmin, load])

  const highlightServerId = useMemo(() => {
    const raw = searchParams.get("server")
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }, [searchParams])

  const moveCamera = async (cameraId: number, target: DropTarget) => {
    setBusy(true)
    setError(null)
    setStatusMsg(null)
    try {
      const ml_server_id = target === "unassigned" ? null : target
      const result = await assignCameraToMlServer({
        camera_id: cameraId,
        ml_server_id,
        enforce_capacity: true,
      })
      const warnings = result.routing?.warnings || []
      setStatusMsg(
        ml_server_id == null
          ? `Unassigned camera ${result.camera.code || cameraId}`
          : `Moved ${result.camera.code || cameraId} → server ${ml_server_id}${
              warnings.length ? ` (${warnings[0]})` : ""
            }`
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Move failed")
    } finally {
      setBusy(false)
      setDragCameraId(null)
    }
  }

  const onDropTo = (target: DropTarget, cameraIdFromTransfer: number | null) => {
    const cameraId = cameraIdFromTransfer ?? dragCameraId
    if (cameraId == null) return
    void moveCamera(cameraId, target)
  }

  const onPreviewAuto = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await autoDistributeCameras({
        site_id: siteFilter ? Number(siteFilter) : null,
        dry_run: true,
        apply: false,
      })
      setPreview(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed")
    } finally {
      setBusy(false)
    }
  }

  const onApplyAuto = async () => {
    if (
      !window.confirm(
        "Apply balanced distribution? Cameras will be reassigned and re-registered on ML nodes."
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await autoDistributeCameras({
        site_id: siteFilter ? Number(siteFilter) : null,
        dry_run: false,
        apply: true,
      })
      setPreview(result)
      setStatusMsg(
        `Distributed ${result.moved} camera(s) across ${result.ml_server_count} ML server(s).`
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auto-distribute failed")
    } finally {
      setBusy(false)
    }
  }

  if (!isOpsAdmin) {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }

  return (
    <ModulePageLayout
      title="Camera Distribution"
      description="Drag cameras onto ML servers. Assignment is stored in Django and routed to the correct GPU node."
      breadcrumbs={[
        { label: "Central Ops", href: ROUTES.OPS_CENTRAL },
        { label: "Camera Distribution" },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.OPS_ML_SERVERS)}>
            <Server className="mr-1.5 h-4 w-4" />
            ML Servers
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.ALL_CITIES_CAMERAS)}>
            <LayoutGrid className="mr-1.5 h-4 w-4" />
            All Cities
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || busy}>
            <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {statusMsg ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {statusMsg}
          </div>
        ) : null}

        <Card>
          <CardContent className="flex flex-wrap items-end gap-4 pt-6">
            <div className="min-w-[200px] space-y-1.5">
              <Label className="text-xs">Filter by site</Label>
              <Select
                value={siteFilter || "__all__"}
                onValueChange={(v) => setSiteFilter(v === "__all__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All sites</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void onPreviewAuto()} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Auto Distribute (preview)
              </Button>
              <Button onClick={() => void onApplyAuto()} disabled={busy}>
                Apply Distribution
              </Button>
            </div>
            {board ? (
              <div className="ml-auto text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{board.total_cameras}</span> cameras ·{" "}
                <span className="font-medium text-foreground">{board.ml_server_count}</span> ML
                servers ·{" "}
                <span className="font-medium text-foreground">{board.unassigned_count}</span>{" "}
                unassigned
              </div>
            ) : null}
          </CardContent>
        </Card>

        {preview ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {preview.applied ? "Applied plan" : "Recommended distribution"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-3">
              {preview.recommended.map((row) => (
                <div key={row.ml_server_id} className="rounded-md border px-3 py-2 text-sm">
                  <p className="font-medium">{row.ml_server_name}</p>
                  <p className="text-muted-foreground">
                    {row.camera_count}
                    {row.max_cameras ? ` / ${row.max_cameras}` : ""} cameras
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {loading && !board ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading board…
          </div>
        ) : board ? (
          <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
            <Column
              title="Unassigned"
              subtitle="Not yet routed to an ML node"
              countLabel={String(board.unassigned.length)}
              cameras={board.unassigned}
              dragCameraId={dragCameraId}
              onDragStart={setDragCameraId}
              onDropCamera={(id) => onDropTo("unassigned", id)}
              accent
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {board.servers.map((server) => (
                <div
                  key={server.id}
                  className={cn(highlightServerId === server.id && "rounded-lg ring-2 ring-sky-300")}
                >
                  <Column
                    title={server.name}
                    subtitle={[server.gpu, server.ml_base_url].filter(Boolean).join(" · ")}
                    countLabel={`${server.cameras.length}${
                      server.max_cameras ? ` / ${server.max_cameras}` : ""
                    }`}
                    status={server.status}
                    cameras={server.cameras}
                    dragCameraId={dragCameraId}
                    onDragStart={setDragCameraId}
                    onDropCamera={(id) => onDropTo(server.id, id)}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {busy ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating assignment & ML routing…
          </p>
        ) : null}
      </div>
    </ModulePageLayout>
  )
}
