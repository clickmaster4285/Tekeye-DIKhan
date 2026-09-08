"use client"

import { useCallback, useEffect, useState } from "react"
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
import { fetchSites, type SiteRecord } from "@/lib/cameras-api"
import {
  createRemoteServer,
  deleteRemoteServer,
  listRemoteServers,
  testRemoteServer,
  updateRemoteServer,
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
  const [formGpu, setFormGpu] = useState("P4000")
  const [formMax, setFormMax] = useState("25")
  const [formSite, setFormSite] = useState<string>("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, siteRows] = await Promise.all([listRemoteServers(), fetchSites().catch(() => [])])
      setServers(list)
      setSites(siteRows.filter((s) => s.is_active))
      // Refresh stale/empty health so online nodes are not stuck showing offline.
      const needsProbe = list.filter((s) => {
        if (!s.is_active) return false
        const h = (s.last_health || "").toLowerCase()
        return !["online", "ok", "healthy", "up"].includes(h)
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

  const resetForm = () => {
    setFormName("")
    setFormMl("")
    setFormGpu("P4000")
    setFormMax("25")
    setFormSite("")
    setEditingId(null)
    setShowAdd(false)
  }

  const onSave = async () => {
    if (!formName.trim() || !formMl.trim()) {
      setError("Server name and ML URL / IP are required.")
      return
    }
    const maxCameras = Math.max(1, Number.parseInt(formMax, 10) || 25)
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: formName.trim(),
        connection_mode: "ml" as const,
        ml_base_url: formMl.trim(),
        gpu: formGpu.trim(),
        max_cameras: maxCameras,
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
    setFormMax(String(server.max_cameras ?? 25))
    setFormSite(server.site != null ? String(server.site) : "")
  }

  const onTest = async (id: number) => {
    setTestingId(id)
    setError(null)
    try {
      const result = await testRemoteServer(id)
      setStatusMsg(result.ok ? "Connection healthy" : result.error || "Unreachable")
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
      description="Register GPU nodes and set capacity. Assign cameras on Camera Distribution."
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
              else setShowAdd(true)
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
              <div className="space-y-2">
                <Label>GPU</Label>
                <Input value={formGpu} onChange={(e) => setFormGpu(e.target.value)} placeholder="P4000" />
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
                      <div>
                        <p className="text-xs text-muted-foreground">GPU</p>
                        <p className="font-medium">{server.gpu || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cameras</p>
                        <p className="font-medium">
                          {assigned}
                          {max ? ` / ${max}` : ""}
                        </p>
                      </div>
                      <div className="col-span-2">
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
