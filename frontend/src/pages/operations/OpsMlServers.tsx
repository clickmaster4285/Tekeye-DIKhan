"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import {
  Cable,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { matchesThisSite, THIS_SITE_LOCATION } from "@/lib/locations"
import { fetchSites, type SiteRecord } from "@/lib/cameras-api"
import {
  createRemoteServer,
  deleteRemoteServer,
  listRemoteServers,
  probeMlGpus,
  testRemoteServer,
  updateRemoteServer,
  type MlGpuInfo,
  type RemoteServerRecord,
} from "@/lib/ops-central-api"
import { normalizeRole } from "@/lib/role-access"
import { ROUTES } from "@/routes/config"
import { cn } from "@/lib/utils"

function healthTone(health: string): "ok" | "bad" | "unknown" {
  const h = (health || "").toLowerCase()
  if (h === "ok" || h === "healthy" || h === "up" || h === "online") return "ok"
  if (h === "error" || h === "down" || h === "unreachable" || h === "offline") return "bad"
  return "unknown"
}

function formatGpuOption(gpu: MlGpuInfo): string {
  const mem = gpu.total_memory_mb ? ` · ${gpu.total_memory_mb} MB` : ""
  return `GPU ${gpu.index} · ${gpu.name}${mem}`
}

function labelForGpu(gpu: MlGpuInfo): string {
  return formatGpuOption(gpu)
}

function defaultSiteId(sites: SiteRecord[]): string {
  const site = sites.find((s) => matchesThisSite(s.code, s.name))
  return site ? String(site.id) : ""
}

export default function OpsMlServersPage() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const isOpsAdmin = normalizeRole(user?.role) === "IT_SUPERADMIN"

  const [servers, setServers] = useState<RemoteServerRecord[]>([])
  const [sites, setSites] = useState<SiteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [formName, setFormName] = useState("")
  const [formMl, setFormMl] = useState("")
  const [formGpu, setFormGpu] = useState("")
  const [formGpuDevice, setFormGpuDevice] = useState<string>("")
  const [formMax, setFormMax] = useState("25")
  const [formSite, setFormSite] = useState<string>("")
  const [detectedGpus, setDetectedGpus] = useState<MlGpuInfo[]>([])
  const [detectingGpus, setDetectingGpus] = useState(false)
  const [serverGpus, setServerGpus] = useState<Record<number, MlGpuInfo[]>>({})

  /** Ignore stale probe responses (URL auto-probe vs Detect click). */
  const probeSeq = useRef(0)
  const formGpuDeviceRef = useRef(formGpuDevice)
  const formGpuRef = useRef(formGpu)
  formGpuDeviceRef.current = formGpuDevice
  formGpuRef.current = formGpu

  const applyGpuList = useCallback(
    (
      gpus: MlGpuInfo[],
      opts?: { mlDevice?: string | number | null; forceSelect?: boolean }
    ) => {
      setDetectedGpus(gpus)
      if (!gpus.length) return
      const currentDevice = formGpuDeviceRef.current
      const currentLabel = formGpuRef.current
      const preferred =
        (!opts?.forceSelect && currentDevice !== ""
          ? gpus.find((g) => String(g.index) === currentDevice)
          : null) ||
        (opts?.mlDevice != null && String(opts.mlDevice) !== "cpu"
          ? gpus.find((g) => String(g.index) === String(opts.mlDevice))
          : null) ||
        gpus[0]
      if (!preferred) return
      if (opts?.forceSelect || currentDevice === "" || !currentLabel.trim()) {
        setFormGpuDevice(String(preferred.index))
        setFormGpu(labelForGpu(preferred))
      } else {
        const match = gpus.find((g) => String(g.index) === currentDevice)
        if (match) setFormGpu(labelForGpu(match))
      }
    },
    []
  )

  const detectGpusForUrl = useCallback(
    async (url: string, opts?: { silent?: boolean; forceSelect?: boolean }) => {
      const trimmed = url.trim()
      const seq = ++probeSeq.current
      if (!opts?.silent) {
        setDetectingGpus(true)
        setError(null)
        setStatusMsg(null)
      }
      try {
        // Empty URL → GPUs on this Django host; otherwise probe that ML node.
        const result = await probeMlGpus(trimmed || undefined)
        if (seq !== probeSeq.current) return result.gpus || []
        const gpus = result.gpus || []
        if (gpus.length > 0) {
          applyGpuList(gpus, {
            mlDevice: result.ml_device,
            forceSelect: opts?.forceSelect === true,
          })
          if (!opts?.silent) {
            const where = result.ml_base_url || "this host"
            setStatusMsg(
              `Detected ${gpus.length} GPU${gpus.length === 1 ? "" : "s"} on ${where}`
            )
          }
        } else if (!opts?.silent) {
          setDetectedGpus([])
          setError(
            result.error ||
              "No GPUs found. Install NVIDIA drivers / nvidia-smi, or check the ML URL."
          )
        }
        return gpus
      } catch (e) {
        if (seq !== probeSeq.current) return []
        if (!opts?.silent) {
          setDetectedGpus([])
          setError(e instanceof Error ? e.message : "GPU detection failed")
        }
        return []
      } finally {
        if (!opts?.silent && seq === probeSeq.current) {
          setDetectingGpus(false)
        }
      }
    },
    [applyGpuList]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, siteRows] = await Promise.all([listRemoteServers(), fetchSites().catch(() => [])])
      setServers(list)
      setSites(siteRows.filter((s) => s.is_active))

      // Live GPU inventory for every active ML node (fills cards + assignment dropdown).
      const gpuEntries = await Promise.all(
        list
          .filter((s) => s.is_active && (s.resolved_ml_base_url || s.ml_base_url))
          .map(async (s) => {
            const url = s.resolved_ml_base_url || s.ml_base_url || ""
            try {
              const result = await probeMlGpus(url)
              return [s.id, result.gpus || []] as const
            } catch {
              return [s.id, []] as const
            }
          })
      )
      const gpuMap: Record<number, MlGpuInfo[]> = {}
      for (const [id, gpus] of gpuEntries) {
        if (gpus.length) gpuMap[id] = gpus
      }
      setServerGpus(gpuMap)

      // Refresh stale/empty health so online nodes are not stuck showing offline.
      const needsProbe = list.filter((s) => {
        if (!s.is_active) return false
        const h = (s.last_health || "").toLowerCase()
        return !["online", "ok", "healthy", "up"].includes(h) || !s.gpu
      })
      if (needsProbe.length > 0) {
        const refreshed = await Promise.all(
          needsProbe.map(async (s) => {
            try {
              const result = await testRemoteServer(s.id)
              return result.server ?? null
            } catch {
              return null
            }
          })
        )
        const byId = new Map(
          refreshed.filter((s): s is RemoteServerRecord => Boolean(s)).map((s) => [s.id, s])
        )
        if (byId.size > 0) {
          setServers((prev) => prev.map((s) => byId.get(s.id) ?? s))
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ML servers")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpsAdmin) void load()
  }, [isOpsAdmin, load])

  useEffect(() => {
    if (!showAdd || editingId != null || formSite) return
    const id = defaultSiteId(sites)
    if (id) setFormSite(id)
  }, [sites, showAdd, editingId, formSite])

  // Soft auto-fill when URL changes — never spins Detect button; stale replies ignored.
  useEffect(() => {
    if (!showAdd) return
    const url = formMl.trim()
    if (!url || url.length < 7) return
    const t = window.setTimeout(() => {
      void detectGpusForUrl(url, { silent: true, forceSelect: false })
    }, 700)
    return () => window.clearTimeout(t)
  }, [formMl, showAdd, detectGpusForUrl])

  const resetForm = () => {
    probeSeq.current += 1
    setFormName("")
    setFormMl("")
    setFormGpu("")
    setFormGpuDevice("")
    setFormMax("25")
    setFormSite(defaultSiteId(sites))
    setDetectedGpus([])
    setDetectingGpus(false)
    setEditingId(null)
    setShowAdd(false)
  }

  const selectGpu = (gpu: MlGpuInfo | null) => {
    if (!gpu) {
      setFormGpuDevice("")
      setFormGpu("")
      return
    }
    setFormGpuDevice(String(gpu.index))
    setFormGpu(labelForGpu(gpu))
  }

  const onDetectGpus = async () => {
    // Invalidate in-flight silent probes so they cannot wipe this click result.
    probeSeq.current += 1
    await detectGpusForUrl(formMl.trim(), { silent: false, forceSelect: true })
  }

  const onSave = async () => {
    if (!formName.trim() || !formMl.trim()) {
      setError("Server name and ML URL / IP are required.")
      return
    }
    const maxCameras = Math.max(1, Number.parseInt(formMax, 10) || 25)
    const gpuDevice =
      formGpuDevice !== "" && Number.isFinite(Number(formGpuDevice))
        ? Number(formGpuDevice)
        : null
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: formName.trim(),
        connection_mode: "ml" as const,
        ml_base_url: formMl.trim(),
        gpu: formGpu.trim(),
        gpu_device: gpuDevice,
        max_cameras: maxCameras,
        location_code: THIS_SITE_LOCATION,
        site: formSite ? Number(formSite) : null,
        is_active: true,
      }
      if (editingId) {
        await updateRemoteServer(editingId, payload)
        setStatusMsg(`Updated ${payload.name}`)
      } else {
        await createRemoteServer(payload)
        setStatusMsg(`Saved ${payload.name}`)
      }
      resetForm()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const onEdit = (server: RemoteServerRecord) => {
    setEditingId(server.id)
    setShowAdd(true)
    setFormName(server.name)
    setFormMl(server.ml_base_url || server.resolved_ml_base_url || "")
    setFormGpu(server.gpu || "")
    setFormGpuDevice(server.gpu_device != null ? String(server.gpu_device) : "")
    setFormMax(String(server.max_cameras ?? 25))
    setFormSite(server.site != null ? String(server.site) : "")
    const cached = serverGpus[server.id] || []
    setDetectedGpus(cached)
  }

  const onTest = async (id: number) => {
    setTestingId(id)
    setError(null)
    try {
      const gpuDevice =
        editingId === id && formGpuDevice !== "" && Number.isFinite(Number(formGpuDevice))
          ? Number(formGpuDevice)
          : undefined
      const result = await testRemoteServer(
        id,
        gpuDevice != null ? { gpu_device: gpuDevice } : undefined
      )
      if (result.gpus?.length) {
        applyGpuList(result.gpus, { forceSelect: editingId === id })
        setServerGpus((prev) => ({ ...prev, [id]: result.gpus || [] }))
      }
      if (result.server && editingId === id) {
        setFormGpu(result.server.gpu || formGpu)
        if (result.server.gpu_device != null) {
          setFormGpuDevice(String(result.server.gpu_device))
        }
      }
      setStatusMsg(result.ok ? "Connection healthy — GPU synced" : result.error || "Unreachable")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed")
    } finally {
      setTestingId(null)
    }
  }

  const onDelete = async (server: RemoteServerRecord) => {
    if (!window.confirm(`Remove ML server “${server.name}”? Assigned cameras will become unassigned.`)) {
      return
    }
    try {
      await deleteRemoteServer(server.id)
      setStatusMsg(`Removed ${server.name}`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed")
    }
  }

  if (!isOpsAdmin) {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }

  return (
    <ModulePageLayout
      title="ML Servers"
      description="Register GPU nodes, detect CUDA devices dynamically, and set capacity. Assign cameras on Camera Distribution."
      breadcrumbs={[
        { label: "Central Ops", href: ROUTES.OPS_CENTRAL },
        { label: "ML Servers" },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.OPS_CAMERA_DISTRIBUTION)}>
            <LayoutGrid className="mr-1.5 h-4 w-4" />
            Distribution
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (showAdd) resetForm()
              else {
                setFormSite(defaultSiteId(sites))
                setShowAdd(true)
              }
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {showAdd ? "Cancel" : "Add ML Server"}
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

        {showAdd ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {editingId ? "Edit ML Server" : "Add ML Server"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Server Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="DIK-ML-01"
                />
              </div>
              <div className="space-y-2">
                <Label>IP / ML API URL</Label>
                <Input
                  value={formMl}
                  onChange={(e) => setFormMl(e.target.value)}
                  placeholder="192.168.1.101:8100"
                />
                <p className="text-xs text-muted-foreground">Port 8100 added if omitted.</p>
              </div>
              <div className="space-y-2">
                <Label>Site</Label>
                <Select value={formSite || "__none__"} onValueChange={(v) => setFormSite(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional site" />
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
              <div className="space-y-2 sm:col-span-2">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div className="space-y-1">
                    <Label>GPU assignment</Label>
                    <p className="text-xs text-muted-foreground">
                      Click Detect GPUs to load devices from this PC (nvidia-smi) or from the ML
                      URL if set, then click a GPU to assign it.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void onDetectGpus()}
                    disabled={detectingGpus}
                  >
                    {detectingGpus ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Detect GPUs
                  </Button>
                </div>

                {detectingGpus ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Fetching GPUs from ML host…
                  </p>
                ) : null}

                {detectedGpus.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {detectedGpus.map((g) => {
                        const selected = formGpuDevice === String(g.index)
                        return (
                          <button
                            key={g.index}
                            type="button"
                            onClick={() => selectGpu(g)}
                            className={cn(
                              "rounded-md border px-3 py-2 text-left text-xs transition-colors",
                              selected
                                ? "border-sky-500 bg-sky-50 text-sky-900 ring-1 ring-sky-300"
                                : "border-border bg-background hover:bg-muted/60"
                            )}
                          >
                            <span className="font-medium">{formatGpuOption(g)}</span>
                            {g.free_memory_mb != null ? (
                              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                {g.free_memory_mb} MB free
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                    {formGpu ? (
                      <p className="text-xs text-muted-foreground">Assigned: {formGpu}</p>
                    ) : null}
                  </div>
                ) : (
                  <Input
                    value={formGpu}
                    onChange={(e) => setFormGpu(e.target.value)}
                    placeholder="Click Detect GPUs, or type a label (e.g. GPU 0 · RTX A6000)"
                  />
                )}
                {formGpuDevice !== "" ? (
                  <p className="text-xs text-amber-700/90">
                    This ML process must run with{" "}
                    <code className="rounded bg-muted px-1">ML_DEVICE={formGpuDevice}</code>
                    {" "}(or matching{" "}
                    <code className="rounded bg-muted px-1">CUDA_VISIBLE_DEVICES</code>
                    ). For two GPUs, run two ML instances on different ports and register each here.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Maximum Cameras</Label>
                <Input
                  type="number"
                  min={1}
                  value={formMax}
                  onChange={(e) => setFormMax(e.target.value)}
                  placeholder="25"
                />
              </div>
              <div className="flex items-end gap-2 sm:col-span-2">
                <Button onClick={() => void onSave()} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Server className="mr-2 h-4 w-4" />}
                  Save
                </Button>
                {editingId ? (
                  <Button
                    variant="outline"
                    onClick={() => void onTest(editingId)}
                    disabled={testingId === editingId}
                  >
                    {testingId === editingId ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Cable className="mr-2 h-4 w-4" />
                    )}
                    Test Connection
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {loading && servers.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading ML servers…
          </div>
        ) : servers.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No ML servers yet. Add DIK-ML-01 / 02 / 03 with max 25 cameras each.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {servers.map((server) => {
              const tone = healthTone(server.last_health)
              const assigned = server.assigned_count ?? 0
              const max = server.max_cameras ?? 0
              return (
                <Card key={server.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{server.name}</CardTitle>
                      <Badge
                        variant="outline"
                        className={cn(
                          tone === "ok" && "border-emerald-300 text-emerald-700",
                          tone === "bad" && "border-red-300 text-red-700",
                          tone === "unknown" && "border-slate-300 text-slate-600"
                        )}
                      >
                        {tone === "ok" ? (
                          <Wifi className="mr-1 h-3 w-3" />
                        ) : (
                          <WifiOff className="mr-1 h-3 w-3" />
                        )}
                        {tone === "ok" ? "Healthy" : tone === "bad" ? "Unhealthy" : "Unknown"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p className="text-muted-foreground">
                      {server.resolved_ml_base_url || server.ml_base_url || "—"}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">GPU</p>
                        <p className="font-medium">
                          {server.gpu ||
                            (server.gpu_device != null ? `GPU ${server.gpu_device}` : "—")}
                        </p>
                        {(serverGpus[server.id] || []).length > 0 ? (
                          <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                            {(serverGpus[server.id] || []).map((g) => (
                              <li key={g.index}>
                                {formatGpuOption(g)}
                                {server.gpu_device === g.index ? " ← assigned" : ""}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cameras</p>
                        <p className="font-medium">
                          {assigned}
                          {max ? ` / ${max}` : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Site</p>
                        <p className="font-medium">
                          {server.site_name || server.site_code || "Unlinked"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          navigate(`${ROUTES.OPS_CAMERA_DISTRIBUTION}?server=${server.id}`)
                        }
                      >
                        View Cameras
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onEdit(server)}>
                        Manage
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void onTest(server.id)}
                        disabled={testingId === server.id}
                      >
                        {testingId === server.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Test"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => void onDelete(server)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </ModulePageLayout>
  )
}
