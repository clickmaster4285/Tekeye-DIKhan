"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Building2,
  Eye,
  HardDrive,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Video,
  Wifi,
} from "lucide-react"
import { ROUTES } from "@/routes/config"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  bulkCreateCameras,
  cameraSourceLabel,
  createCamera,
  createNvr,
  createSite,
  deleteCamera,
  deleteNvr,
  deleteSite,
  fetchCameraPurposes,
  fetchCameras,
  fetchNvrBrands,
  fetchNvrs,
  fetchSites,
  getPreviewMjpegUrl,
  updateCamera,
  updateNvr,
  updateSite,
  ALL_CAMERA_PURPOSES,
  type CameraPurpose,
  type CameraRecord,
  type CameraWritePayload,
  type NvrBrand,
  type NvrRecord,
  type NvrWritePayload,
  type SiteRecord,
  type SiteWritePayload,
} from "@/lib/cameras-api"
import { fetchZones, type SiteZoneRecord } from "@/lib/warehouse-zones-api"
import { zoneLabel } from "@/lib/warehouse-zones"

type CameraManagementContentProps = {
  viewBasePath?: string
}

const emptySiteForm = (): SiteWritePayload => ({ code: "", name: "", description: "" })

const emptyNvrForm = (siteId?: number): NvrWritePayload => ({
  site: siteId ?? 0,
  name: "",
  ip_address: "",
  port: 554,
  username: "admin",
  password: "",
  brand: "hikvision",
  stream_path_template: "",
})

const emptyCameraForm = (nvrId?: number): CameraWritePayload => ({
  name: "",
  nvr: nvrId ?? 0,
  channel: 1,
  zone: "",
  purpose: ALL_CAMERA_PURPOSES[0],
  purposes: [...ALL_CAMERA_PURPOSES],
})

export function CameraManagementContent({
  viewBasePath = ROUTES.CAMERA_MANAGEMENT,
}: CameraManagementContentProps) {
  const [tab, setTab] = useState("cameras")
  const [sites, setSites] = useState<SiteRecord[]>([])
  const [nvrs, setNvrs] = useState<NvrRecord[]>([])
  const [cameras, setCameras] = useState<CameraRecord[]>([])
  const [purposes, setPurposes] = useState<{ value: CameraPurpose; label: string }[]>([])
  const [brands, setBrands] = useState<{ value: NvrBrand; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [filterSiteId, setFilterSiteId] = useState<string>("all")
  const [filterNvrId, setFilterNvrId] = useState<string>("all")

  const [siteForm, setSiteForm] = useState<SiteWritePayload>(emptySiteForm())
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null)

  const [nvrForm, setNvrForm] = useState<NvrWritePayload>(emptyNvrForm())
  const [editingNvrId, setEditingNvrId] = useState<number | null>(null)

  const [cameraForm, setCameraForm] = useState<CameraWritePayload>(emptyCameraForm())
  const [editingCameraId, setEditingCameraId] = useState<number | null>(null)
  const [bulkChannelCount, setBulkChannelCount] = useState("16")
  const [showPreview, setShowPreview] = useState(false)
  const [locationZones, setLocationZones] = useState<SiteZoneRecord[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [siteRows, nvrRows, camRows, purposeOpts, brandOpts] = await Promise.all([
        fetchSites(),
        fetchNvrs(),
        fetchCameras(),
        fetchCameraPurposes(),
        fetchNvrBrands(),
      ])
      setSites(siteRows)
      setNvrs(nvrRows)
      setCameras(camRows)
      setPurposes(purposeOpts)
      setBrands(brandOpts)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load surveillance data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selectedSite = useMemo(() => {
    if (filterSiteId === "all") return null
    return sites.find((s) => String(s.id) === filterSiteId) ?? null
  }, [filterSiteId, sites])

  const filteredNvrs = useMemo(() => {
    if (filterSiteId === "all") return nvrs
    return nvrs.filter((n) => String(n.site) === filterSiteId)
  }, [nvrs, filterSiteId])

  const filteredCameras = useMemo(() => {
    let rows = cameras
    if (filterSiteId !== "all") {
      rows = rows.filter((c) => String(c.site_code) === selectedSite?.code || c.location === selectedSite?.code)
    }
    if (filterNvrId !== "all") {
      rows = rows.filter((c) => String(c.nvr) === filterNvrId)
    }
    return rows
  }, [cameras, filterSiteId, filterNvrId, selectedSite])

  const cameraFormSiteCode = useMemo(() => {
    const nvr = nvrs.find((n) => n.id === cameraForm.nvr)
    return nvr?.site_code ?? ""
  }, [cameraForm.nvr, nvrs])

  useEffect(() => {
    if (!cameraFormSiteCode) {
      setLocationZones([])
      return
    }
    let cancelled = false
    fetchZones({ location: cameraFormSiteCode })
      .then((rows) => {
        if (!cancelled) setLocationZones(rows.filter((z) => z.is_active))
      })
      .catch(() => {
        if (!cancelled) setLocationZones([])
      })
    return () => {
      cancelled = true
    }
  }, [cameraFormSiteCode])

  const notifyUpdated = () => window.dispatchEvent(new Event("camera-integration-updated"))

  const onSaveSite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!siteForm.code.trim() || !siteForm.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      if (editingSiteId) {
        await updateSite(editingSiteId, siteForm)
      } else {
        await createSite({ ...siteForm, code: siteForm.code.toUpperCase() })
      }
      setSiteForm(emptySiteForm())
      setEditingSiteId(null)
      await load()
      notifyUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save site")
    } finally {
      setSaving(false)
    }
  }

  const onSaveNvr = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nvrForm.site || !nvrForm.name.trim() || !nvrForm.ip_address.trim()) return
    setSaving(true)
    setError(null)
    try {
      if (editingNvrId) {
        await updateNvr(editingNvrId, nvrForm)
      } else {
        await createNvr(nvrForm)
      }
      setNvrForm(emptyNvrForm(filterSiteId !== "all" ? Number(filterSiteId) : undefined))
      setEditingNvrId(null)
      await load()
      notifyUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save NVR")
    } finally {
      setSaving(false)
    }
  }

  const onSaveCamera = async (e: React.FormEvent) => {
    e.preventDefault()
    const selectedPurposes = cameraForm.purposes?.length
      ? cameraForm.purposes
      : cameraForm.purpose
        ? [cameraForm.purpose]
        : []
    if (!cameraForm.name.trim() || !cameraForm.nvr || !cameraForm.channel || selectedPurposes.length === 0) {
      setError("Name, NVR, channel, and at least one AI purpose are required.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload: CameraWritePayload = {
        ...cameraForm,
        purposes: selectedPurposes,
        purpose: selectedPurposes[0],
      }
      if (editingCameraId) {
        await updateCamera(editingCameraId, payload)
      } else {
        await createCamera(payload)
      }
      setCameraForm(emptyCameraForm(filterNvrId !== "all" ? Number(filterNvrId) : undefined))
      setEditingCameraId(null)
      setShowPreview(false)
      await load()
      notifyUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save camera")
    } finally {
      setSaving(false)
    }
  }

  const togglePurpose = (value: CameraPurpose, checked: boolean) => {
    setCameraForm((prev) => {
      const current = prev.purposes?.length
        ? [...prev.purposes]
        : prev.purpose
          ? [prev.purpose]
          : []
      const next = checked
        ? current.includes(value)
          ? current
          : [...current, value]
        : current.filter((p) => p !== value)
      return {
        ...prev,
        purposes: next,
        purpose: next[0] ?? prev.purpose,
      }
    })
  }

  const selectedPurposes = useMemo(() => {
    if (cameraForm.purposes?.length) return cameraForm.purposes
    if (cameraForm.purpose) return [cameraForm.purpose]
    return [] as CameraPurpose[]
  }, [cameraForm.purposes, cameraForm.purpose])

  const allPurposesSelected =
    purposes.length > 0 && purposes.every((p) => selectedPurposes.includes(p.value))
  const somePurposesSelected = purposes.some((p) => selectedPurposes.includes(p.value))

  const toggleAllPurposes = (checked: boolean) => {
    if (checked) {
      const next = purposes.map((p) => p.value)
      setCameraForm((prev) => ({
        ...prev,
        purposes: next,
        purpose: next[0] ?? prev.purpose,
      }))
      return
    }
    setCameraForm((prev) => ({
      ...prev,
      purposes: [],
      purpose: prev.purpose,
    }))
  }

  const onBulkCreate = async () => {
    const nvrId = filterNvrId !== "all" ? Number(filterNvrId) : cameraForm.nvr
    if (!nvrId) {
      setError("Select an NVR before bulk-creating channels.")
      return
    }
    const count = Math.min(64, Math.max(1, Number(bulkChannelCount) || 16))
    setSaving(true)
    setError(null)
    try {
      await bulkCreateCameras(nvrId, {
        channel_count: count,
        name_prefix: "Camera",
        zone: cameraForm.zone,
        purposes: cameraForm.purposes?.length
          ? cameraForm.purposes
          : cameraForm.purpose
            ? [cameraForm.purpose]
            : [...ALL_CAMERA_PURPOSES],
        purpose: cameraForm.purpose,
      })
      await load()
      notifyUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk create failed")
    } finally {
      setSaving(false)
    }
  }

  const onlineCount = cameras.filter((c) => c.status === "Online" && c.is_active).length

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sites</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{sites.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">NVRs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{nvrs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cameras</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{cameras.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Online</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-green-600">{onlineCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Hierarchy filters</CardTitle>
          <CardDescription>Site → NVR → Camera. Streams are built dynamically on the server.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-2 min-w-[200px]">
            <Label>Site</Label>
            <Select value={filterSiteId} onValueChange={(v) => { setFilterSiteId(v); setFilterNvrId("all") }}>
              <SelectTrigger><SelectValue placeholder="All sites" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sites</SelectItem>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 min-w-[200px]">
            <Label>NVR</Label>
            <Select value={filterNvrId} onValueChange={setFilterNvrId}>
              <SelectTrigger><SelectValue placeholder="All NVRs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All NVRs</SelectItem>
                {filteredNvrs.map((n) => (
                  <SelectItem key={n.id} value={String(n.id)}>{n.name} — {n.ip_address}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="sites" className="gap-1.5"><Building2 className="h-4 w-4" />Sites</TabsTrigger>
          <TabsTrigger value="nvrs" className="gap-1.5"><HardDrive className="h-4 w-4" />NVRs</TabsTrigger>
          <TabsTrigger value="cameras" className="gap-1.5"><Video className="h-4 w-4" />Cameras</TabsTrigger>
        </TabsList>

        <TabsContent value="sites" className="mt-4 space-y-4">
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">{editingSiteId ? "Edit site" : "Add site"}</CardTitle>
                <CardDescription>Step 1 — define a physical location (city, branch, facility).</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onSaveSite} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Code</Label>
                    <Input
                      value={siteForm.code}
                      onChange={(e) => setSiteForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                      placeholder="PESHAWAR"
                      required
                      disabled={Boolean(editingSiteId)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={siteForm.name}
                      onChange={(e) => setSiteForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Peshawar Head Office"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={siteForm.description ?? ""}
                      onChange={(e) => setSiteForm((p) => ({ ...p, description: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : editingSiteId ? "Update" : "Create site"}</Button>
                    {editingSiteId && (
                      <Button type="button" variant="outline" onClick={() => { setEditingSiteId(null); setSiteForm(emptySiteForm()) }}>Cancel</Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
            <Card className="lg:col-span-3">
              <CardHeader><CardTitle>Sites</CardTitle></CardHeader>
              <CardContent>
                {loading ? <p className="text-muted-foreground text-sm py-8 text-center">Loading…</p> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>NVRs</TableHead>
                        <TableHead>Cameras</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sites.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-xs">{s.code}</TableCell>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>{s.nvr_count}</TableCell>
                          <TableCell>{s.camera_count}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingSiteId(s.id); setSiteForm({ code: s.code, name: s.name, description: s.description }) }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={async () => {
                              if (!window.confirm(`Delete site ${s.name}?`)) return
                              await deleteSite(s.id)
                              await load()
                            }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
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
        </TabsContent>

        <TabsContent value="nvrs" className="mt-4 space-y-4">
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">{editingNvrId ? "Edit NVR" : "Add NVR"}</CardTitle>
                <CardDescription>Step 2 — register device credentials (stored securely on server only).</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onSaveNvr} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Site</Label>
                    <Select
                      value={nvrForm.site ? String(nvrForm.site) : undefined}
                      onValueChange={(v) => setNvrForm((p) => ({ ...p, site: Number(v) }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                      <SelectContent>
                        {sites.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>NVR name</Label>
                    <Input value={nvrForm.name} onChange={(e) => setNvrForm((p) => ({ ...p, name: e.target.value }))} placeholder="Main NVR" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>IP address</Label>
                      <Input className="font-mono" value={nvrForm.ip_address} onChange={(e) => setNvrForm((p) => ({ ...p, ip_address: e.target.value }))} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Port</Label>
                      <Input type="number" value={nvrForm.port ?? 554} onChange={(e) => setNvrForm((p) => ({ ...p, port: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input value={nvrForm.username ?? "admin"} onChange={(e) => setNvrForm((p) => ({ ...p, username: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input type="password" value={nvrForm.password ?? ""} onChange={(e) => setNvrForm((p) => ({ ...p, password: e.target.value }))} placeholder={editingNvrId ? "Leave blank to keep" : ""} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Brand</Label>
                    <Select value={nvrForm.brand ?? "hikvision"} onValueChange={(v) => setNvrForm((p) => ({ ...p, brand: v as NvrBrand }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {brands.map((b) => (
                          <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Custom path template (optional)</Label>
                    <Input
                      value={nvrForm.stream_path_template ?? ""}
                      onChange={(e) => setNvrForm((p) => ({ ...p, stream_path_template: e.target.value }))}
                      placeholder="/Streaming/Channels/{channel}"
                      className="font-mono text-xs"
                    />
                  </div>
                  <Button type="submit" disabled={saving}>{saving ? "Saving…" : editingNvrId ? "Update NVR" : "Register NVR"}</Button>
                </form>
              </CardContent>
            </Card>
            <Card className="lg:col-span-3">
              <CardHeader><CardTitle>NVR devices</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Cameras</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNvrs.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="font-medium">{n.name}</TableCell>
                        <TableCell>{n.site_name}</TableCell>
                        <TableCell className="font-mono text-xs">{n.ip_address}:{n.port}</TableCell>
                        <TableCell><Badge variant="secondary">{n.brand_label}</Badge></TableCell>
                        <TableCell>{n.camera_count}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => {
                            setEditingNvrId(n.id)
                            setNvrForm({
                              site: n.site,
                              name: n.name,
                              ip_address: n.ip_address,
                              port: n.port,
                              username: n.username,
                              brand: n.brand,
                              stream_path_template: n.stream_path_template,
                            })
                          }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={async () => {
                            if (!window.confirm(`Delete NVR ${n.name}?`)) return
                            await deleteNvr(n.id)
                            await load()
                          }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cameras" className="mt-4 space-y-4">
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">{editingCameraId ? "Rename camera" : "Add camera channel"}</CardTitle>
                <CardDescription>Step 3 — map channels and assign meaningful names.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onSaveCamera} className="space-y-4">
                  <div className="space-y-2">
                    <Label>NVR</Label>
                    <Select
                      value={cameraForm.nvr ? String(cameraForm.nvr) : undefined}
                      onValueChange={(v) => setCameraForm((p) => ({ ...p, nvr: Number(v) }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Select NVR" /></SelectTrigger>
                      <SelectContent>
                        {filteredNvrs.map((n) => (
                          <SelectItem key={n.id} value={String(n.id)}>{n.site_name} · {n.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Channel</Label>
                    <Input
                      type="number"
                      min={1}
                      value={cameraForm.channel}
                      onChange={(e) => setCameraForm((p) => ({ ...p, channel: Number(e.target.value) }))}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Use 1–32 for logical channels, or 101/201 for Hikvision stream IDs.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Camera name</Label>
                    <Input value={cameraForm.name} onChange={(e) => setCameraForm((p) => ({ ...p, name: e.target.value }))} placeholder="Main Gate" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Zone</Label>
                    {locationZones.length > 0 ? (
                      <Select value={cameraForm.zone || undefined} onValueChange={(v) => setCameraForm((p) => ({ ...p, zone: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                        <SelectContent>
                          {locationZones.map((z) => (
                            <SelectItem key={z.code} value={z.code}>{z.code} — {z.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={cameraForm.zone ?? ""} onChange={(e) => setCameraForm((p) => ({ ...p, zone: e.target.value }))} placeholder="Z-IN" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>AI purposes / models</Label>
                    <div className="rounded-md border p-3 space-y-2 max-h-56 overflow-y-auto">
                      <label className="flex items-start gap-2 text-sm cursor-pointer border-b pb-2 mb-1 font-medium">
                        <Checkbox
                          checked={
                            allPurposesSelected
                              ? true
                              : somePurposesSelected
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={(v) => toggleAllPurposes(v === true)}
                          className="mt-0.5"
                        />
                        <span>{allPurposesSelected ? "Deselect all" : "Select all"}</span>
                      </label>
                      {purposes.map((p) => {
                        const selected = selectedPurposes.includes(p.value)
                        return (
                          <label
                            key={p.value}
                            className="flex items-start gap-2 text-sm cursor-pointer"
                          >
                            <Checkbox
                              checked={selected}
                              onCheckedChange={(v) => togglePurpose(p.value, v === true)}
                              className="mt-0.5"
                            />
                            <span>{p.label}</span>
                          </label>
                        )
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      All models are selected by default. Use Select all / Deselect all,
                      or check only the models you want on this camera.
                    </p>
                  </div>

                  {cameraForm.nvr > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Live preview</Label>
                        <Button type="button" variant="outline" size="sm" onClick={() => setShowPreview((v) => !v)}>
                          {showPreview ? "Hide" : "Show"}
                        </Button>
                      </div>
                      {showPreview && (
                        <div className="relative aspect-video rounded-lg border overflow-hidden bg-black">
                          <img
                            key={`${cameraForm.nvr}-${cameraForm.channel}`}
                            src={getPreviewMjpegUrl(cameraForm.nvr, cameraForm.channel)}
                            alt="Preview"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <Button type="submit" className="bg-[#3b82f6] hover:bg-[#2563eb]" disabled={saving}>
                    {saving ? "Saving…" : editingCameraId ? "Update camera" : "Add camera"}
                  </Button>
                </form>

                <div className="mt-6 pt-6 border-t space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Layers className="h-4 w-4" />
                    Bulk create channels
                  </div>
                  <p className="text-xs text-muted-foreground">Auto-generate cameras for channels 1 through N on the selected NVR.</p>
                  <div className="flex gap-2">
                    <Input type="number" min={1} max={64} value={bulkChannelCount} onChange={(e) => setBulkChannelCount(e.target.value)} className="w-24" />
                    <Button type="button" variant="outline" onClick={onBulkCreate} disabled={saving}>
                      <Plus className="h-4 w-4 mr-1" />
                      Generate
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-muted-foreground" />
                  Camera channels
                </CardTitle>
                <CardDescription>RTSP URLs are generated on demand — never stored or exposed.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
                ) : filteredCameras.length === 0 ? (
                  <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                    <Video className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No cameras yet. Add a site and NVR first, then create channels.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Site / NVR</TableHead>
                          <TableHead>Ch</TableHead>
                          <TableHead>Zone</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCameras.map((cam) => (
                          <TableRow key={cam.id}>
                            <TableCell className="font-medium">{cam.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{cameraSourceLabel(cam)}</TableCell>
                            <TableCell className="font-mono">{cam.channel}</TableCell>
                            <TableCell>{zoneLabel(cam.zone)}</TableCell>
                            <TableCell>
                              <Badge variant={cam.status === "Online" ? "default" : "outline"}>{cam.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" className="text-[#3b82f6]" asChild>
                                <Link to={`${viewBasePath}/${cam.id}`}>
                                  <Eye className="h-4 w-4 mr-1" />
                                  Live
                                </Link>
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => {
                                setEditingCameraId(cam.id)
                                setCameraForm({
                                  name: cam.name,
                                  nvr: cam.nvr,
                                  channel: cam.channel,
                                  zone: cam.zone,
                                  purpose: cam.purpose,
                                  purposes: cam.purposes?.length ? cam.purposes : [cam.purpose],
                                })
                                setTab("cameras")
                              }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={async () => {
                                if (!window.confirm(`Remove camera ${cam.name}?`)) return
                                await deleteCamera(cam.id)
                                await load()
                                notifyUpdated()
                              }}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function CameraManagementPage() {
  return (
    <ModulePageLayout
      title="Camera Management"
      description="Manage sites, NVRs, and camera channels. Streams are generated dynamically from NVR credentials."
      breadcrumbs={[{ label: "WMS" }, { label: "Camera Management" }]}
    >
      <CameraManagementContent />
    </ModulePageLayout>
  )
}
