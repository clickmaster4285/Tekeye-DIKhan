"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Navigate } from "react-router-dom"
import {
  Cable,
  Loader2,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  Video,
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
import { normalizeRole } from "@/lib/role-access"
import { ROUTES } from "@/routes/config"
import {
  createRemoteServer,
  deleteRemoteServer,
  fetchServerCameras,
  listRemoteServers,
  quickConnect,
  removeServerCamera,
  testRemoteServer,
  withOpsStreamToken,
  type OpsCamera,
  type RemoteServerRecord,
} from "@/lib/ops-central-api"
import { cn } from "@/lib/utils"

function OpsStreamTile({
  camera,
  onRemove,
  removing,
}: {
  camera: OpsCamera
  onRemove?: () => void
  removing?: boolean
}) {
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState(false)
  const raw = (camera.ml_live_stream_url || "").trim()
  const src = raw
    ? `${withOpsStreamToken(raw)}${withOpsStreamToken(raw).includes("?") ? "&" : "?"}r=${retry}`
    : null

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-black">
      <div className="relative aspect-video w-full">
        {src && !error ? (
          <img
            src={src}
            alt={camera.name}
            className="h-full w-full object-contain"
            onError={() => {
              setError(true)
              window.setTimeout(() => {
                setError(false)
                setRetry((n) => n + 1)
              }, 2500)
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/60">
            {error ? "Reconnecting…" : "No stream URL"}
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
          <p className="truncate text-sm font-medium text-white">{camera.name}</p>
          <p className="truncate text-xs text-white/70">
            {[camera.site_name || camera.site_code, camera.status, camera.code]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Badge className="absolute top-2 right-2 bg-emerald-600/90 text-white">ML</Badge>
        {onRemove ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="absolute top-2 left-2 h-8 w-8 bg-black/55 text-white hover:bg-red-700/80 hover:text-white"
            onClick={onRemove}
            disabled={removing}
            title="Remove camera"
            aria-label="Remove camera"
          >
            {removing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export default function OpsCentralPage() {
  const user = getStoredUser()
  const isOpsAdmin = normalizeRole(user?.role) === "IT_SUPERADMIN"

  const [servers, setServers] = useState<RemoteServerRecord[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [cameras, setCameras] = useState<OpsCamera[]>([])
  const [loadingServers, setLoadingServers] = useState(true)
  const [loadingCameras, setLoadingCameras] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const [qcName, setQcName] = useState("DI Khan")
  const [qcMl, setQcMl] = useState("192.168.199.12:8100")

  const [showAdd, setShowAdd] = useState(false)
  const [formName, setFormName] = useState("")
  const [formMl, setFormMl] = useState("")
  const [saving, setSaving] = useState(false)
  const [removingCameraKey, setRemovingCameraKey] = useState<string | null>(null)

  const selectedServer = useMemo(
    () => servers.find((s) => String(s.id) === selectedId) || null,
    [servers, selectedId]
  )

  const loadServers = useCallback(async () => {
    setLoadingServers(true)
    setError(null)
    try {
      const list = await listRemoteServers()
      setServers(list)
      setSelectedId((prev) => prev || (list.length > 0 ? String(list[0].id) : ""))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load servers")
    } finally {
      setLoadingServers(false)
    }
  }, [])

  useEffect(() => {
    if (isOpsAdmin) void loadServers()
  }, [isOpsAdmin, loadServers])

  const connectSaved = useCallback(
    async (id: number) => {
      setLoadingCameras(true)
      setError(null)
      setStatusMsg(null)
      try {
        await testRemoteServer(id)
        const result = await fetchServerCameras(id)
        setCameras(result.cameras)
        setStatusMsg(
          `Connected to ${result.server_name || "ML server"} — ${result.count} camera(s) on this node only`
        )
        await loadServers()
      } catch (e) {
        setCameras([])
        setError(e instanceof Error ? e.message : "Connect failed")
      } finally {
        setLoadingCameras(false)
      }
    },
    [loadServers]
  )

  const onQuickConnect = async () => {
    if (!qcName.trim() || !qcMl.trim()) {
      setError("Server name and ML server URL are required.")
      return
    }
    setLoadingCameras(true)
    setError(null)
    setStatusMsg(null)
    try {
      const result = await quickConnect({
        name: qcName.trim(),
        connection_mode: "ml",
        ml_base_url: qcMl.trim(),
        save: true,
      })
      setCameras(result.cameras)
      setStatusMsg(
        `ML node “${result.server_name || qcName}” — ${result.count} camera(s) registered on this server only`
      )
      await loadServers()
      if (result.server_id) setSelectedId(String(result.server_id))
    } catch (e) {
      setCameras([])
      setError(e instanceof Error ? e.message : "Connect failed")
    } finally {
      setLoadingCameras(false)
    }
  }

  const onSaveServer = async () => {
    if (!formName.trim() || !formMl.trim()) {
      setError("Server name and ML URL are required.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const created = await createRemoteServer({
        name: formName.trim(),
        connection_mode: "ml",
        ml_base_url: formMl.trim(),
        is_active: true,
      })
      setShowAdd(false)
      setFormName("")
      setFormMl("")
      await loadServers()
      setSelectedId(String(created.id))
      await connectSaved(created.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: number, name?: string) => {
    const label = name ? `"${name}"` : "this ML server"
    if (!window.confirm(`Remove ${label} from Central Ops? Connected cameras will no longer appear.`)) return
    try {
      await deleteRemoteServer(id)
      if (selectedId === String(id)) {
        setSelectedId("")
        setCameras([])
      }
      await loadServers()
      setStatusMsg(`Removed server ${name || id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed")
    }
  }

  const onRemoveCamera = async (cam: OpsCamera) => {
    if (!selectedId) return
    const label = cam.name || cam.code || "this camera"
    if (
      !window.confirm(
        `Remove ${label} from this server? This deletes it on the remote/local node when possible.`
      )
    ) {
      return
    }
    const key = cam.ml_stream_key || cam.code || String(cam.id)
    setRemovingCameraKey(key)
    setError(null)
    try {
      const result = await removeServerCamera(Number(selectedId), {
        stream_key: cam.ml_stream_key || cam.code,
        camera_id: cam.id,
        code: cam.code,
      })
      setCameras((prev) =>
        prev.filter(
          (row) =>
            row.id !== cam.id &&
            (row.ml_stream_key || row.code) !== (cam.ml_stream_key || cam.code)
        )
      )
      const warn = result.warnings.length ? ` (${result.warnings[0]})` : ""
      setStatusMsg(
        result.removed_remote
          ? `Removed ${label} from server${warn}`
          : `Removed ${label} from hub cache${warn}`
      )
      await loadServers()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove camera failed")
    } finally {
      setRemovingCameraKey(null)
    }
  }

  if (!isOpsAdmin) {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }

  return (
    <ModulePageLayout
      title="Central Ops"
      description="Connect to each ML server (port 8100). Only cameras registered on that ML node are shown."
      breadcrumbs={[{ label: "Central Ops" }]}
      actions={
        <Button variant="outline" size="sm" onClick={() => setShowAdd((v) => !v)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {showAdd ? "Cancel" : "Add ML server"}
        </Button>
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
              <CardTitle className="text-base">Add ML server</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Server name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="DI Khan"
                />
              </div>
              <div className="space-y-2">
                <Label>ML server URL</Label>
                <Input
                  value={formMl}
                  onChange={(e) => setFormMl(e.target.value)}
                  placeholder="192.168.199.12:8100"
                />
                <p className="text-xs text-muted-foreground">Port 8100 added if omitted.</p>
              </div>
              <div className="sm:col-span-2">
                <Button onClick={() => void onSaveServer()} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Server className="mr-2 h-4 w-4" />}
                  Save & connect
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cable className="h-4 w-4" />
                  Connect ML server
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Server name</Label>
                  <Input
                    value={qcName}
                    onChange={(e) => setQcName(e.target.value)}
                    placeholder="DI Khan"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">ML server URL</Label>
                  <Input
                    value={qcMl}
                    onChange={(e) => setQcMl(e.target.value)}
                    placeholder="192.168.199.12:8100"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    ML only — cameras from this node’s /live/status.
                  </p>
                </div>
                <Button className="w-full" onClick={() => void onQuickConnect()} disabled={loadingCameras}>
                  {loadingCameras ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Video className="mr-2 h-4 w-4" />
                  )}
                  Connect & show streams
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Saved ML servers</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void loadServers()}
                    disabled={loadingServers}
                  >
                    <RefreshCw className={cn("h-4 w-4", loadingServers && "animate-spin")} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {servers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No ML servers yet.</p>
                ) : (
                  <>
                    <Select value={selectedId} onValueChange={setSelectedId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select server" />
                      </SelectTrigger>
                      <SelectContent>
                        {servers.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name} ({s.connection_mode || "ml"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="max-h-56 space-y-2 overflow-y-auto">
                      {servers.map((s) => (
                        <div
                          key={s.id}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-md border p-2 text-xs",
                            selectedId === String(s.id) && "border-sky-300 bg-sky-50/60"
                          )}
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => setSelectedId(String(s.id))}
                          >
                            <p className="truncate font-medium text-foreground">{s.name}</p>
                            <p className="truncate text-muted-foreground">
                              {s.ml_base_url || s.base_url}
                            </p>
                          </button>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={loadingCameras}
                              onClick={() => void connectSaved(s.id)}
                              title="Fetch cameras"
                            >
                              <Video className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => void onDelete(s.id, s.name)}
                              title="Remove server"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedServer ? (
                      <div className="space-y-2 rounded-md border p-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          {selectedServer.last_health === "online" ? (
                            <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <WifiOff className="h-3.5 w-3.5 text-amber-600" />
                          )}
                          <span className="font-medium text-foreground">
                            {selectedServer.ml_base_url || selectedServer.base_url}
                          </span>
                        </div>
                        {selectedServer.last_error ? (
                          <p className="text-red-600">{selectedServer.last_error}</p>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        disabled={!selectedId || loadingCameras}
                        onClick={() => selectedId && void connectSaved(Number(selectedId))}
                      >
                        {loadingCameras ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Video className="mr-2 h-4 w-4" />
                        )}
                        Fetch cameras
                      </Button>
                      <Button
                        variant="outline"
                        disabled={!selectedId}
                        onClick={() =>
                          selectedId &&
                          void onDelete(Number(selectedId), selectedServer?.name)
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Video className="h-4 w-4" />
                Live streams (this ML server only)
                {cameras.length > 0 ? (
                  <Badge variant="secondary" className="ml-2">
                    {cameras.length}
                  </Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCameras ? (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading cameras from ML…
                </div>
              ) : cameras.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                  <Server className="h-10 w-10 opacity-40" />
                  <p>Connect an ML server to see only that node’s registered cameras.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {cameras.map((cam) => {
                    const removeKey = cam.ml_stream_key || cam.code || String(cam.id)
                    return (
                      <OpsStreamTile
                        key={`${cam.ml_stream_key}-${cam.code}`}
                        camera={cam}
                        onRemove={() => void onRemoveCamera(cam)}
                        removing={removingCameraKey === removeKey}
                      />
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ModulePageLayout>
  )
}
