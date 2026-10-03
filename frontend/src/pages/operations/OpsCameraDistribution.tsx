"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Navigate, useNavigate, useSearchParams } from "react-router-dom"
import {
  GripVertical,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  Unlink,
  Wifi,
  WifiOff,
  X,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getStoredUser } from "@/lib/auth"
import { matchesThisSite } from "@/lib/locations"
import { fetchSites, type SiteRecord } from "@/lib/cameras-api"
import {
  assignCameraToMlServer,
  autoDistributeCameras,
  fetchDistributionBoard,
  unassignAllCamerasFromServer,
  type AutoDistributeResult,
  type DistributionBoard,
  type DistributionCamera,
} from "@/lib/ops-central-api"
import { normalizeRole } from "@/lib/role-access"
import { ROUTES } from "@/routes/config"
import { cn } from "@/lib/utils"

type DropTarget = "unassigned" | number

function matchesCameraQuery(camera: DistributionCamera, q: string): boolean {
  if (!q) return true
  return [camera.code, camera.name, camera.nvr_name, camera.site_code, camera.site_name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q)
}

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
        "flex cursor-grab items-center gap-1.5 rounded-md border border-border/80 bg-background px-2 py-1.5 shadow-sm active:cursor-grabbing",
        dragging && "opacity-40 ring-2 ring-sky-300"
      )}
      title={[camera.name, camera.code, camera.nvr_name].filter(Boolean).join(" · ")}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium leading-tight">{camera.name || camera.code}</p>
        {camera.nvr_name ? (
          <p className="truncate text-[10px] leading-tight text-muted-foreground">{camera.nvr_name}</p>
        ) : null}
      </div>
    </div>
  )
}

function DropPanel({
  title,
  subtitle,
  count,
  totalCount,
  status,
  cameras,
  dragCameraId,
  onDragStart,
  onDropCamera,
  accent,
  headerAction,
  searchSlot,
  className,
}: {
  title: string
  subtitle?: string
  count: number
  totalCount?: number
  status?: string
  cameras: DistributionCamera[]
  dragCameraId: number | null
  onDragStart: (id: number) => void
  onDropCamera: (cameraIdFromTransfer: number | null) => void
  accent?: boolean
  headerAction?: ReactNode
  searchSlot?: ReactNode
  className?: string
}) {
  const [over, setOver] = useState(false)
  const healthy =
    (status || "").toLowerCase() === "healthy" ||
    (status || "").toLowerCase() === "ok" ||
    (status || "").toLowerCase() === "online"

  return (
    <section
      className={cn(
        "flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm",
        over && "border-emerald-500 ring-2 ring-emerald-200",
        accent && "border-dashed border-slate-300 bg-slate-50/70",
        className
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
      <header className="shrink-0 space-y-2 border-b bg-card/95 px-3 py-2.5 backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground" title={subtitle}>
                {subtitle}
              </p>
            ) : null}
          </div>
          <Badge variant="secondary" className="shrink-0 tabular-nums">
            {totalCount != null && totalCount !== count ? `${count}/${totalCount}` : count}
          </Badge>
        </div>
        {status ? (
          <p
            className={cn(
              "flex items-center gap-1 text-[11px]",
              healthy ? "text-emerald-700" : "text-slate-500"
            )}
          >
            {healthy ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {healthy ? "Healthy" : status}
          </p>
        ) : null}
        {searchSlot}
        {headerAction}
      </header>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2 [scrollbar-gutter:stable]">
        {cameras.length === 0 ? (
          <div className="flex h-full min-h-[120px] items-center justify-center px-3 text-center text-xs text-muted-foreground">
            {accent ? "No matching cameras" : "Drop cameras here"}
          </div>
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
    </section>
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
  const [cameraQuery, setCameraQuery] = useState("")

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
      .then((rows) => {
        const active = rows.filter((s) => s.is_active)
        setSites(active)
        const site = active.find((s) => matchesThisSite(s.code, s.name))
        if (site) setSiteFilter((current) => current || String(site.id))
      })
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

  const q = cameraQuery.trim().toLowerCase()

  const filteredUnassigned = useMemo(() => {
    const list = board?.unassigned ?? []
    return list.filter((c) => matchesCameraQuery(c, q))
  }, [board?.unassigned, q])

  const filteredServers = useMemo(() => {
    const servers = board?.servers ?? []
    if (!q) return servers.map((s) => ({ ...s, filteredCameras: s.cameras }))
    return servers.map((s) => ({
      ...s,
      filteredCameras: s.cameras.filter((c) => matchesCameraQuery(c, q)),
    }))
  }, [board?.servers, q])

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
          ? `Unassigned camera ${result.camera.name || result.camera.code || "camera"}`
          : `Moved ${result.camera.name || result.camera.code || "camera"} → server ${ml_server_id}${
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

  const onUnassignAllFromServer = async (serverId: number, serverName: string, count: number) => {
    if (count <= 0) return
    if (
      !window.confirm(
        `Unassign all ${count} camera(s) from “${serverName}”? They will move to Unassigned.`
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    setStatusMsg(null)
    try {
      const result = await unassignAllCamerasFromServer(serverId)
      setStatusMsg(
        `Unassigned ${result.unassigned} camera(s) from “${result.ml_server_name || serverName}”` +
          (result.warnings.length ? ` (${result.warnings[0]})` : "")
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unassign all failed")
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
      description="DI Khan cameras are balanced across the ML servers connected to this site. Drag from Unassigned onto an ML server."
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
      <div className="flex flex-col gap-3">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {statusMsg ? (
          <div className="flex items-start justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <span>{statusMsg}</span>
            <button
              type="button"
              className="rounded p-0.5 text-emerald-700 hover:bg-emerald-100"
              onClick={() => setStatusMsg(null)}
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card px-3 py-3 shadow-sm">
          <div className="min-w-[160px] flex-1 space-y-1 sm:max-w-[220px]">
            <Label className="text-[11px] text-muted-foreground">Site</Label>
            <Select
              value={siteFilter || "__all__"}
              onValueChange={(v) => setSiteFilter(v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="h-9">
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

          <div className="min-w-[180px] flex-[2] space-y-1">
            <Label className="text-[11px] text-muted-foreground">Search cameras</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={cameraQuery}
                onChange={(e) => setCameraQuery(e.target.value)}
                placeholder="Code, name, NVR…"
                className="h-9 pl-8 pr-8 text-sm"
              />
              {cameraQuery ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
                  onClick={() => setCameraQuery("")}
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => void onPreviewAuto()}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-4 w-4" />
              )}
              Preview
            </Button>
            <Button size="sm" className="h-9" onClick={() => void onApplyAuto()} disabled={busy}>
              Apply
            </Button>
          </div>

          {board ? (
            <div className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{board.total_cameras}</span> total
              </span>
              <span>
                <span className="font-semibold text-foreground">{board.ml_server_count}</span>{" "}
                servers
              </span>
              <span>
                <span className="font-semibold text-amber-700">{board.unassigned_count}</span>{" "}
                unassigned
              </span>
            </div>
          ) : null}
        </div>

        {preview ? (
          <div className="rounded-xl border bg-card px-3 py-2.5 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {preview.applied ? "Applied plan" : "Recommended distribution"}
              </p>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setPreview(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {preview.recommended.map((row) => (
                <div
                  key={row.ml_server_id}
                  className="min-w-[140px] shrink-0 rounded-lg border px-3 py-2 text-xs"
                >
                  <p className="font-medium">{row.ml_server_name}</p>
                  <p className="text-muted-foreground">
                    {row.camera_count}
                    {row.max_cameras ? ` / ${row.max_cameras}` : ""} cameras
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {loading && !board ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading board…
          </div>
        ) : board ? (
          <div
            className={cn(
              "overflow-hidden rounded-xl",
              /* Fixed board height: lists scroll inside panels, servers stay beside Unassigned */
              "h-[min(720px,calc(100dvh-13.5rem))]"
            )}
          >
            <div className="flex h-full min-h-0 gap-3 overflow-x-auto overflow-y-hidden pb-1">
              <div className="h-full w-[min(300px,85vw)] shrink-0">
                <DropPanel
                  title="Unassigned"
                  subtitle="Scroll · drag onto a server →"
                  count={filteredUnassigned.length}
                  totalCount={board.unassigned.length}
                  cameras={filteredUnassigned}
                  dragCameraId={dragCameraId}
                  onDragStart={setDragCameraId}
                  onDropCamera={(id) => onDropTo("unassigned", id)}
                  accent
                />
              </div>

              {board.servers.length === 0 ? (
                <div className="flex h-full min-w-[240px] flex-1 items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-sm text-muted-foreground">
                  No ML servers yet. Add one under ML Servers.
                </div>
              ) : (
                filteredServers.map((server) => (
                  <div key={server.id} className="h-full w-[260px] shrink-0">
                    <DropPanel
                      className={cn(
                        highlightServerId === server.id && "ring-2 ring-sky-400"
                      )}
                      title={server.name}
                      subtitle={
                        [
                          server.gpu ||
                            (server.gpu_device != null ? `GPU ${server.gpu_device}` : ""),
                          server.max_cameras
                            ? `${server.cameras.length}/${server.max_cameras} capacity`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" · ") || undefined
                      }
                      count={server.filteredCameras.length}
                      totalCount={server.cameras.length}
                      status={server.status}
                      cameras={server.filteredCameras}
                      dragCameraId={dragCameraId}
                      onDragStart={setDragCameraId}
                      onDropCamera={(id) => onDropTo(server.id, id)}
                      headerAction={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 w-full text-[11px]"
                          disabled={busy || server.cameras.length === 0}
                          onClick={() =>
                            void onUnassignAllFromServer(
                              server.id,
                              server.name,
                              server.cameras.length
                            )
                          }
                        >
                          <Unlink className="mr-1.5 h-3 w-3" />
                          Unassign all
                        </Button>
                      }
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {busy ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating assignment & ML routing…
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Tip: use search to narrow long lists. Unassigned and each server column scroll on their own —
            ML servers stay beside Unassigned, not below it.
          </p>
        )}
      </div>
    </ModulePageLayout>
  )
}
