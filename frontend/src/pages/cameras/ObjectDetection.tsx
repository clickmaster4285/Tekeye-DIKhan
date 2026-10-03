import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Scan,
  Package,
  AlertTriangle,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Flame,
  Camera,
  Trash2,
  Loader2,
  Pencil,
  Film,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MlSystemStatus } from "@/components/cameras/ml-system-status"
import { DetectionSnapshotThumb } from "@/components/cameras/detection-snapshot-thumb"
import {
  fetchDetectionEventsPage,
  fetchDetectionSummary,
  fetchCameras,
  fetchSites,
  deleteDetectionEvent,
  updateDetectionEvent,
  resolveMediaUrl,
  type DetectionEvent,
  type DetectionEventsQuery,
} from "@/lib/cameras-api"
import { getStoredUser } from "@/lib/auth"
import { normalizeRole } from "@/lib/role-access"

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const
const DEFAULT_PAGE_SIZE = 25

type AppliedFilters = {
  q: string
  site: string
  camera: string
  date_from: string
  date_to: string
  alert: "all" | "alerts" | "normal"
  class_name: string
}

const emptyFilters: AppliedFilters = {
  q: "",
  site: "all",
  camera: "all",
  date_from: "",
  date_to: "",
  alert: "all",
  class_name: "",
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    return iso
  }
}

function confidenceTone(confidence: number): string {
  if (confidence >= 0.85) return "bg-emerald-500"
  if (confidence >= 0.6) return "bg-amber-500"
  return "bg-orange-500"
}

function toDatetimeLocalValue(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ""
  }
}

function datetimeLocalToIso(value: string): string {
  if (!value.trim()) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toISOString()
}

function buildQuery(page: number, pageSize: number, filters: AppliedFilters): DetectionEventsQuery {
  const query: DetectionEventsQuery = {
    page,
    page_size: pageSize,
  }
  if (filters.q.trim()) query.q = filters.q.trim()
  if (filters.site !== "all") query.site = filters.site
  if (filters.camera !== "all") query.camera = Number(filters.camera)
  if (filters.date_from) query.date_from = filters.date_from
  if (filters.date_to) query.date_to = filters.date_to
  if (filters.class_name.trim()) query.class_name = filters.class_name.trim()
  if (filters.alert === "alerts") query.is_alert = true
  if (filters.alert === "normal") query.is_alert = false
  return query
}

export default function ObjectDetectionPage() {
  const queryClient = useQueryClient()
  const user = getStoredUser()
  const isAdmin = normalizeRole(user?.role) === "ADMIN"
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [pageInput, setPageInput] = useState("1")
  const [draft, setDraft] = useState<AppliedFilters>(emptyFilters)
  const [applied, setApplied] = useState<AppliedFilters>(emptyFilters)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [editing, setEditing] = useState<DetectionEvent | null>(null)
  const [editForm, setEditForm] = useState({
    created_at: "",
    camera: "",
    class_name: "",
    label: "",
    employee_name: "",
    personal_number: "",
    person_qr: "",
    track_event: "",
    confidencePct: "0",
    is_alert: false,
    clip_status: "ready" as string,
    local_track_id: "",
    clear_clip: false,
    clear_video: false,
  })
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)
  const [editVideoFile, setEditVideoFile] = useState<File | null>(null)
  const [editVideoPreview, setEditVideoPreview] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const { data: summary } = useQuery({
    queryKey: ["detection-summary"],
    queryFn: fetchDetectionSummary
  })

  const { data: sites = [] } = useQuery({
    queryKey: ["sites"],
    queryFn: fetchSites,
  })

  const { data: cameras = [] } = useQuery({
    queryKey: ["cameras"],
    queryFn: () => fetchCameras(),
  })

  const queryParams = useMemo(() => buildQuery(page, pageSize, applied), [page, pageSize, applied])

  const {
    data: eventsPage,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["detection-events", queryParams],
    queryFn: () => fetchDetectionEventsPage(queryParams),
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  })

  const events = eventsPage?.results ?? []
  const totalCount = eventsPage?.count ?? 0
  const totalPages = eventsPage?.total_pages ?? 0

  const refreshDetections = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["detection-events"] }),
      queryClient.invalidateQueries({ queryKey: ["detection-summary"] }),
    ])
  }

  const openEdit = (row: DetectionEvent) => {
    if (editImagePreview) URL.revokeObjectURL(editImagePreview)
    if (editVideoPreview) URL.revokeObjectURL(editVideoPreview)
    setEditing(row)
    setEditForm({
      created_at: toDatetimeLocalValue(row.created_at),
      camera: String(row.camera ?? ""),
      class_name: row.class_name || "",
      label: row.label || "",
      employee_name: row.employee_name || "",
      personal_number: row.personal_number || "",
      person_qr: row.person_qr || "",
      track_event: row.track_event || "detection",
      confidencePct: String(Math.round((row.confidence || 0) * 1000) / 10),
      is_alert: Boolean(row.is_alert),
      clip_status: row.clip_status || "ready",
      local_track_id:
        row.local_track_id === null || row.local_track_id === undefined
          ? ""
          : String(row.local_track_id),
      clear_clip: false,
      clear_video: false,
    })
    setEditImageFile(null)
    setEditImagePreview(null)
    setEditVideoFile(null)
    setEditVideoPreview(null)
    setActionError(null)
  }

  const closeEdit = () => {
    if (editImagePreview) URL.revokeObjectURL(editImagePreview)
    if (editVideoPreview) URL.revokeObjectURL(editVideoPreview)
    setEditImageFile(null)
    setEditImagePreview(null)
    setEditVideoFile(null)
    setEditVideoPreview(null)
    setEditing(null)
  }

  const onEditImageChange = (file: File | null) => {
    if (editImagePreview) URL.revokeObjectURL(editImagePreview)
    setEditImageFile(file)
    setEditImagePreview(file ? URL.createObjectURL(file) : null)
    if (file) {
      setEditForm((f) => ({ ...f, clear_clip: false, clip_status: "ready" }))
    }
  }

  const onEditVideoChange = (file: File | null) => {
    if (editVideoPreview) URL.revokeObjectURL(editVideoPreview)
    setEditVideoFile(file)
    setEditVideoPreview(file ? URL.createObjectURL(file) : null)
    if (file) {
      setEditForm((f) => ({ ...f, clear_video: false }))
    }
  }

  const onDeleteOne = async (row: DetectionEvent) => {
    if (!isAdmin) return
    if (
      !window.confirm(
        `Delete this detection (${row.class_name || row.label || `#${row.id}`})? This cannot be undone.`
      )
    ) {
      return
    }
    setDeleting(true)
    setActionError(null)
    setActionMsg(null)
    try {
      await deleteDetectionEvent(row.id)
      setActionMsg(`Deleted detection #${row.id}.`)
      await refreshDetections()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  const onSaveEdit = async () => {
    if (!isAdmin || !editing) return
    const confRaw = Number.parseFloat(editForm.confidencePct)
    if (Number.isNaN(confRaw) || confRaw < 0 || confRaw > 100) {
      setActionError("Confidence must be a number between 0 and 100.")
      return
    }
    if (!editForm.camera) {
      setActionError("Camera is required.")
      return
    }
    if (!editForm.created_at) {
      setActionError("Date & time is required.")
      return
    }
    setSavingEdit(true)
    setActionError(null)
    setActionMsg(null)
    try {
      const localTrack =
        editForm.local_track_id.trim() === ""
          ? null
          : Number.parseInt(editForm.local_track_id.trim(), 10)
      if (editForm.local_track_id.trim() !== "" && Number.isNaN(localTrack as number)) {
        setActionError("Local track ID must be a number.")
        setSavingEdit(false)
        return
      }
      await updateDetectionEvent(editing.id, {
        camera: Number(editForm.camera),
        created_at: datetimeLocalToIso(editForm.created_at),
        class_name: editForm.class_name.trim(),
        label: editForm.label.trim(),
        employee_name: editForm.employee_name.trim(),
        personal_number: editForm.personal_number.trim(),
        person_qr: editForm.person_qr.trim(),
        track_event: editForm.track_event.trim() || "detection",
        confidence: confRaw / 100,
        is_alert: editForm.is_alert,
        clip_status: editForm.clip_status,
        local_track_id: localTrack,
        clear_clip: editForm.clear_clip && !editImageFile,
        clip: editImageFile,
        clear_video: editForm.clear_video && !editVideoFile,
        video: editVideoFile,
      })
      setActionMsg(`Updated detection #${editing.id}.`)
      closeEdit()
      await refreshDetections()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Update failed")
    } finally {
      setSavingEdit(false)
    }
  }

  const siteCameras = useMemo(() => {
    if (draft.site === "all") return cameras
    return cameras.filter((c) => c.site_code === draft.site || c.location === draft.site)
  }, [cameras, draft.site])

  const hasActiveFilters = useMemo(
    () =>
      applied.q.trim() !== "" ||
      applied.site !== "all" ||
      applied.camera !== "all" ||
      applied.date_from !== "" ||
      applied.date_to !== "" ||
      applied.alert !== "all" ||
      applied.class_name.trim() !== "",
    [applied]
  )

  const applyFilters = () => {
    setApplied(draft)
    setPage(1)
  }

  const clearFilters = () => {
    setDraft(emptyFilters)
    setApplied(emptyFilters)
    setPage(1)
  }

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  const goToPage = () => {
    const parsed = Number.parseInt(pageInput.trim(), 10)
    if (Number.isNaN(parsed)) {
      setPageInput(String(page))
      return
    }
    const target = Math.min(Math.max(1, parsed), Math.max(1, totalPages))
    setPage(target)
    setPageInput(String(target))
  }

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, totalCount)

  return (
    <ModulePageLayout
      title="Object Detection"
      description="YOLO detection log across all cameras — search and filter the full database."
      breadcrumbs={[{ label: "WMS" }, { label: "Object Detection" }]}
    >
      <div className="grid gap-6">
        <MlSystemStatus />

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-l-4 border-l-primary shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Detections Today</CardTitle>
              <Scan className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{summary?.detections_today ?? "—"}</div>
              <p className="text-xs text-muted-foreground mt-1">Saved ML readings today</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-sky-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Classes Tracked</CardTitle>
              <Package className="h-4 w-4 text-sky-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{summary?.classes_tracked ?? "—"}</div>
              <p className="text-xs text-muted-foreground mt-1">Unique object types today</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Alerts Today</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{summary?.alerts_today ?? "—"}</div>
              <p className="text-xs text-muted-foreground mt-1">Fire, smoke, and alert-class events</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-muted-foreground" />
                  Filters
                </CardTitle>
                <CardDescription>
                  Filters query the full detection database on the server, not just the current page.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1.5" />
                    Clear filters
                  </Button>
                )}
                <Button size="sm" onClick={applyFilters}>
                  Apply filters
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="det-search">Search (class, synonyms)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="det-search"
                  className="w-full pl-9"
                  placeholder="e.g. smoke, person, vehicle, fire…"
                  value={draft.q}
                  onChange={(e) => setDraft((f) => ({ ...f, q: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Site</Label>
              <Select
                value={draft.site}
                onValueChange={(v) => setDraft((f) => ({ ...f, site: v, camera: "all" }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sites</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.code}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Camera</Label>
              <Select
                value={draft.camera}
                onValueChange={(v) => setDraft((f) => ({ ...f, camera: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All cameras" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cameras</SelectItem>
                  {siteCameras.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.code} · {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="det-from">Date from</Label>
              <Input
                id="det-from"
                type="date"
                className="w-full"
                value={draft.date_from}
                onChange={(e) => setDraft((f) => ({ ...f, date_from: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="det-to">Date to</Label>
              <Input
                id="det-to"
                type="date"
                className="w-full"
                value={draft.date_to}
                onChange={(e) => setDraft((f) => ({ ...f, date_to: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Alert status</Label>
              <Select
                value={draft.alert}
                onValueChange={(v) => setDraft((f) => ({ ...f, alert: v as AppliedFilters["alert"] }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All events</SelectItem>
                  <SelectItem value="alerts">Alerts only</SelectItem>
                  <SelectItem value="normal">Normal only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="det-class">Class</Label>
              <Input
                id="det-class"
                className="w-full"
                placeholder="e.g. person, car"
                value={draft.class_name}
                onChange={(e) => setDraft((f) => ({ ...f, class_name: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="w-full min-w-0 shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Detection Log</CardTitle>
              <CardDescription>
                {totalCount > 0
                  ? `Showing ${rangeStart}–${rangeEnd} of ${totalCount.toLocaleString()} records`
                  : hasActiveFilters
                    ? "No records match your filters"
                    : "No detections recorded yet"}
                {hasActiveFilters && totalCount > 0 ? " (filtered from full database)" : ""}
                {isAdmin ? " · Super Admin can edit or delete each log." : ""}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="det-page-size" className="text-sm text-muted-foreground whitespace-nowrap">
                Per page
              </Label>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v))
                  setPage(1)
                }}
              >
                <SelectTrigger id="det-page-size" className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-4">
            {actionError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {actionError}
              </div>
            ) : null}
            {actionMsg ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {actionMsg}
              </div>
            ) : null}
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error instanceof Error ? error.message : "Failed to load detection events"}
              </div>
            )}

            <div className="w-full overflow-x-auto rounded-lg border">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[170px]">Date & time</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Camera</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="w-[140px]">Confidence</TableHead>
                    <TableHead>Alert</TableHead>
                    <TableHead className="w-[140px]">Snapshot</TableHead>
                    {isAdmin ? <TableHead className="w-[110px] text-right">Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 8 : 7} className="text-center text-muted-foreground py-12">
                        Loading detection records…
                      </TableCell>
                    </TableRow>
                  ) : events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 8 : 7} className="text-center text-muted-foreground py-12">
                        <Camera className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        {hasActiveFilters
                          ? "No detections match your filters. Try broader search terms or clear filters."
                          : "No detections yet. Assign an AI purpose to cameras and open live feeds."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    events.map((row) => (
                      <TableRow key={row.id} className={row.is_alert ? "bg-amber-50/50 dark:bg-amber-950/10" : undefined}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {formatDateTime(row.created_at)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.site_name || row.site_code || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {row.name ?? row.camera_name ?? row.camera_code ?? "—"}
                          </div>
                          {(row.camera_code || row.site_code) && (
                            <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                              {row.camera_code || row.site_code}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {row.class_name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden min-w-[72px]">
                              <div
                                className={`h-full rounded-full ${confidenceTone(row.confidence)}`}
                                style={{ width: `${Math.round(row.confidence * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium tabular-nums w-9 text-right">
                              {(row.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.is_alert ? (
                            <Badge variant="destructive" className="gap-1">
                              <Flame className="h-3 w-3" />
                              Alert
                            </Badge>
                          ) : (
                            <Badge variant="outline">Normal</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1.5">
                            {row.clip_url ? (
                              <DetectionSnapshotThumb row={row} />
                            ) : row.clip_status === "pending" || row.clip_status === "recording" ? (
                              <span className="text-xs text-muted-foreground">Capturing…</span>
                            ) : row.clip_status === "failed" ? (
                              <span className="text-xs text-destructive">Capture failed</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                            {row.video_url ? (
                              <a
                                href={resolveMediaUrl(row.video_url)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <Film className="h-3 w-3" />
                                Video
                              </a>
                            ) : null}
                          </div>
                        </TableCell>
                        {isAdmin ? (
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Edit"
                                disabled={deleting || savingEdit}
                                onClick={() => openEdit(row)}
                              >
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                title="Delete"
                                disabled={deleting || savingEdit}
                                onClick={() => void onDeleteOne(row)}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete</span>
                              </Button>
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalCount > 0 && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page.toLocaleString()} of {totalPages.toLocaleString()}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isFetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="det-page-jump" className="text-sm text-muted-foreground whitespace-nowrap">
                      Go to
                    </Label>
                    <Input
                      id="det-page-jump"
                      type="number"
                      min={1}
                      max={Math.max(1, totalPages)}
                      value={pageInput}
                      onChange={(e) => setPageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") goToPage()
                      }}
                      placeholder="Page"
                      className="h-8 w-20 text-center tabular-nums"
                      disabled={isFetching}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={goToPage}
                      disabled={isFetching || totalPages <= 1}
                    >
                      Go
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || isFetching}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open && !savingEdit) closeEdit()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit detection #{editing?.id ?? ""}</DialogTitle>
            <DialogDescription>
              Update every field on this log, including the snapshot image and alert video.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-created">Date & time</Label>
                <Input
                  id="edit-created"
                  type="datetime-local"
                  value={editForm.created_at}
                  onChange={(e) => setEditForm((f) => ({ ...f, created_at: e.target.value }))}
                  disabled={savingEdit}
                />
              </div>
              <div className="space-y-2">
                <Label>Camera</Label>
                <Select
                  value={editForm.camera || undefined}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, camera: v }))}
                  disabled={savingEdit}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select camera" />
                  </SelectTrigger>
                  <SelectContent>
                    {cameras.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.code} · {c.name}
                        {c.site_code || c.location ? ` (${c.site_code || c.location})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editForm.camera ? (
                  <p className="text-xs text-muted-foreground">
                    Site:{" "}
                    {cameras.find((c) => String(c.id) === editForm.camera)?.site_name ||
                      cameras.find((c) => String(c.id) === editForm.camera)?.site_code ||
                      cameras.find((c) => String(c.id) === editForm.camera)?.location ||
                      "—"}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit-class">Class</Label>
                <Input
                  id="edit-class"
                  value={editForm.class_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, class_name: e.target.value }))}
                  disabled={savingEdit}
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-conf">Confidence (%)</Label>
                <Input
                  id="edit-conf"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={editForm.confidencePct}
                  onChange={(e) => setEditForm((f) => ({ ...f, confidencePct: e.target.value }))}
                  disabled={savingEdit}
                />
              </div>
              <div className="flex items-end gap-3 pb-2">
                <Switch
                  id="edit-alert"
                  checked={editForm.is_alert}
                  onCheckedChange={(v) => setEditForm((f) => ({ ...f, is_alert: v }))}
                  disabled={savingEdit}
                />
                <Label htmlFor="edit-alert">Mark as alert</Label>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-emp">Employee name</Label>
                <Input
                  id="edit-emp"
                  value={editForm.employee_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, employee_name: e.target.value }))}
                  disabled={savingEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-pn">Personal number</Label>
                <Input
                  id="edit-pn"
                  value={editForm.personal_number}
                  onChange={(e) => setEditForm((f) => ({ ...f, personal_number: e.target.value }))}
                  disabled={savingEdit}
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-qr">Person QR</Label>
                <Input
                  id="edit-qr"
                  value={editForm.person_qr}
                  onChange={(e) => setEditForm((f) => ({ ...f, person_qr: e.target.value }))}
                  disabled={savingEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-track">Track event</Label>
                <Input
                  id="edit-track"
                  value={editForm.track_event}
                  onChange={(e) => setEditForm((f) => ({ ...f, track_event: e.target.value }))}
                  disabled={savingEdit}
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-local-track">Local track ID</Label>
                <Input
                  id="edit-local-track"
                  value={editForm.local_track_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, local_track_id: e.target.value }))}
                  disabled={savingEdit}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Snapshot status</Label>
                <Select
                  value={editForm.clip_status || "ready"}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, clip_status: v }))}
                  disabled={savingEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="recording">Recording</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="skipped">Skipped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <Label>Snapshot image</Label>
              <div className="flex flex-wrap items-start gap-4">
                <div className="h-28 w-40 overflow-hidden rounded-md border bg-muted/30">
                  {editImagePreview ? (
                    <img
                      src={editImagePreview}
                      alt="New snapshot preview"
                      className="h-full w-full object-cover"
                    />
                  ) : editing?.clip_url && !editForm.clear_clip ? (
                    <img
                      src={resolveMediaUrl(editing.clip_url)}
                      alt="Current snapshot"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
                <div className="min-w-[12rem] flex-1 space-y-2">
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={savingEdit}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null
                      onEditImageChange(file)
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={savingEdit || (!editing?.clip_url && !editImageFile)}
                      onClick={() => {
                        onEditImageChange(null)
                        setEditForm((f) => ({ ...f, clear_clip: true, clip_status: "skipped" }))
                      }}
                    >
                      Remove image
                    </Button>
                    {editForm.clear_clip || editImageFile ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={savingEdit}
                        onClick={() => {
                          onEditImageChange(null)
                          setEditForm((f) => ({
                            ...f,
                            clear_clip: false,
                            clip_status: editing?.clip_status || "ready",
                          }))
                        }}
                      >
                        Reset image
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload a new JPEG/PNG to replace the snapshot, or remove it.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <Label className="flex items-center gap-2">
                <Film className="h-4 w-4" />
                Alert video
              </Label>
              <div className="flex flex-wrap items-start gap-4">
                <div className="h-28 w-44 overflow-hidden rounded-md border bg-muted/30">
                  {editVideoPreview ? (
                    <video
                      src={editVideoPreview}
                      className="h-full w-full object-cover"
                      controls
                      muted
                    />
                  ) : editing?.video_url && !editForm.clear_video ? (
                    <video
                      src={resolveMediaUrl(editing.video_url)}
                      className="h-full w-full object-cover"
                      controls
                      muted
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No video
                    </div>
                  )}
                </div>
                <div className="min-w-[12rem] flex-1 space-y-2">
                  <Input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/x-msvideo,.mp4,.webm,.mov,.mkv,.avi"
                    disabled={savingEdit}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null
                      onEditVideoChange(file)
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={savingEdit || (!editing?.video_url && !editVideoFile)}
                      onClick={() => {
                        onEditVideoChange(null)
                        setEditForm((f) => ({ ...f, clear_video: true }))
                      }}
                    >
                      Remove video
                    </Button>
                    {editForm.clear_video || editVideoFile ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={savingEdit}
                        onClick={() => {
                          onEditVideoChange(null)
                          setEditForm((f) => ({ ...f, clear_video: false }))
                        }}
                      >
                        Reset video
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Attach an alert video (mp4, webm, mov, mkv, avi). Useful for fire/smoke and other alert events.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={savingEdit} onClick={closeEdit}>
              Cancel
            </Button>
            <Button type="button" disabled={savingEdit} onClick={() => void onSaveEdit()}>
              {savingEdit ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}
