import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Car,
  ChevronLeft,
  ChevronRight,
  Filter,
  Flame,
  RefreshCw,
  Search,
  Truck,
  X,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DetectionSnapshotThumb } from "@/components/cameras/detection-snapshot-thumb"
import {
  fetchDetectionEventsPage,
  fetchCameras,
  fetchSites,
  type DetectionEventsQuery,
  type SiteRecord,
} from "@/lib/cameras-api"

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const
const DEFAULT_PAGE_SIZE = 25

/** Prefer Peshawar site when present; otherwise use first configured site. */
const SITE_CODE = "PESHAWAR"

/** Allowed vehicle classes for this panel (must match backend vehicle_only). */
const VEHICLE_CLASSES = new Set([
  "car",
  "truck",
  "bus",
  "motorcycle",
  "bicycle",
  "vehicle",
  "van",
  "microbus",
  "pickup-van",
  "pickup_van",
  "pickupvan",
])

type AppliedFilters = {
  q: string
  camera: string
  date_from: string
  date_to: string
  class_name: string
}

type ListSnapshot = {
  as_of: string
  as_of_id: number
}

const emptyFilters: AppliedFilters = {
  q: "",
  camera: "all",
  date_from: "",
  date_to: "",
  class_name: "all",
}

function resolveSiteCode(sites: SiteRecord[]): string {
  const match = sites.find(
    (s) =>
      s.code?.toUpperCase() === SITE_CODE ||
      s.name?.toLowerCase().includes("peshawar") ||
      s.code?.toLowerCase().includes("peshawar")
  )
  return match?.code || sites[0]?.code || SITE_CODE
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

function buildQuery(
  page: number,
  pageSize: number,
  filters: AppliedFilters,
  siteCode: string,
  snapshot: ListSnapshot | null
): DetectionEventsQuery {
  const query: DetectionEventsQuery = {
    page,
    page_size: pageSize,
    vehicle_only: true,
    site: siteCode,
  }
  if (filters.q.trim()) query.q = filters.q.trim()
  if (filters.camera !== "all") query.camera = Number(filters.camera)
  if (filters.date_from) query.date_from = filters.date_from
  if (filters.date_to) query.date_to = filters.date_to
  if (filters.class_name !== "all") query.class_name = filters.class_name
  // Page 1 stays live; page 2+ freezes at the tip captured from page 1.
  if (page > 1 && snapshot) {
    query.as_of = snapshot.as_of
    query.as_of_id = snapshot.as_of_id
  }
  return query
}

export default function NumberPlateDetectionPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [pageInput, setPageInput] = useState("1")
  const [filters, setFilters] = useState<AppliedFilters>(emptyFilters)
  const [debouncedQ, setDebouncedQ] = useState("")
  const [snapshot, setSnapshot] = useState<ListSnapshot | null>(null)

  // Debounce free-text search; selects/dates apply immediately.
  useEffect(() => {
    const next = filters.q.trim()
    const timer = window.setTimeout(() => {
      setDebouncedQ((prev) => {
        if (prev !== next) {
          setPage(1)
          setSnapshot(null)
        }
        return next
      })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [filters.q])

  const applied = useMemo(
    () => ({ ...filters, q: debouncedQ }),
    [filters, debouncedQ]
  )

  const { data: sites = [] } = useQuery({
    queryKey: ["sites"],
    queryFn: fetchSites,
  })

  const siteCode = useMemo(() => resolveSiteCode(sites), [sites])

  const { data: cameras = [] } = useQuery({
    queryKey: ["cameras", siteCode],
    queryFn: () => fetchCameras(),
  })

  const siteCameras = useMemo(() => {
    const code = siteCode.toLowerCase()
    const filtered = cameras.filter(
      (c) =>
        c.site_code?.toLowerCase() === code ||
        c.location?.toLowerCase() === code ||
        c.site_code?.toLowerCase().includes("peshawar") ||
        c.location?.toLowerCase().includes("peshawar")
    )
    return filtered.length > 0 ? filtered : cameras
  }, [cameras, siteCode])

  const queryParams = useMemo(
    () => buildQuery(page, pageSize, applied, siteCode, snapshot),
    [page, pageSize, applied, siteCode, snapshot]
  )

  const {
    data: eventsPage,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["vehicle-detection-events", queryParams],
    queryFn: () => fetchDetectionEventsPage(queryParams),
    // Only auto-poll live page 1 so deeper pages stay frozen.
    refetchInterval: page === 1 ? 12_000 : false,
    refetchOnWindowFocus: false,
  })

  // Capture tip from live page 1 for stable later pages.
  useEffect(() => {
    if (page !== 1) return
    const asOf = eventsPage?.as_of
    const asOfId = eventsPage?.as_of_id
    if (!asOf || asOfId == null) return
    setSnapshot({ as_of: asOf, as_of_id: Number(asOfId) })
  }, [page, eventsPage?.as_of, eventsPage?.as_of_id])

  const events = useMemo(
    () =>
      (eventsPage?.results ?? []).filter((row) =>
        VEHICLE_CLASSES.has(String(row.class_name || "").trim().toLowerCase())
      ),
    [eventsPage?.results]
  )
  const totalCount = eventsPage?.count ?? 0
  const totalPages = eventsPage?.total_pages ?? 0

  const hasActiveFilters = useMemo(
    () =>
      filters.q.trim() !== "" ||
      filters.camera !== "all" ||
      filters.date_from !== "" ||
      filters.date_to !== "" ||
      filters.class_name !== "all",
    [filters]
  )

  const updateFilters = (patch: Partial<AppliedFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    // Immediate controls (not search text) reset paging + snapshot.
    if (!("q" in patch)) {
      setPage(1)
      setSnapshot(null)
    }
  }

  const clearFilters = () => {
    setFilters(emptyFilters)
    setDebouncedQ("")
    setSnapshot(null)
    setPage(1)
  }

  const refreshLive = () => {
    setSnapshot(null)
    setPage(1)
    void refetch()
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
      title="Vehicle Detection"
      description="Vehicle detections only (car, truck, bus, motorcycle, van, bicycle)."
      breadcrumbs={[{ label: "AI Computer Vision" }, { label: "Vehicle Detection" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-l-4 border-l-primary shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Vehicles listed</CardTitle>
              <Truck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">
                {totalCount.toLocaleString()}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Matching current filters
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-sky-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">On this page</CardTitle>
              <Car className="h-4 w-4 text-sky-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{events.length}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {totalCount > 0
                  ? `Showing ${rangeStart}–${rangeEnd}`
                  : "No vehicles yet"}
              </p>
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
                  Filters apply as you change them.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={refreshLive} disabled={isFetching}>
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1.5" />
                    Clear filters
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="veh-search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="veh-search"
                  className="h-10 w-full pl-9"
                  placeholder="e.g. truck, cam code, camera name…"
                  value={filters.q}
                  onChange={(e) => updateFilters({ q: e.target.value })}
                />
              </div>
            </div>
            <div className="min-w-0 space-y-2">
              <Label>Camera</Label>
              <Select
                value={filters.camera}
                onValueChange={(v) => updateFilters({ camera: v })}
              >
                <SelectTrigger className="h-10 w-full">
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
            <div className="min-w-0 space-y-2">
              <Label>Vehicle class</Label>
              <Select
                value={filters.class_name}
                onValueChange={(v) => updateFilters({ class_name: v })}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All vehicles</SelectItem>
                  <SelectItem value="car">Car</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                  <SelectItem value="bus">Bus</SelectItem>
                  <SelectItem value="motorcycle">Motorcycle</SelectItem>
                  <SelectItem value="bicycle">Bicycle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="veh-from">Date & time from</Label>
              <Input
                id="veh-from"
                type="datetime-local"
                className="h-10 w-full"
                value={filters.date_from}
                onChange={(e) => updateFilters({ date_from: e.target.value })}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="veh-to">Date & time to</Label>
              <Input
                id="veh-to"
                type="datetime-local"
                className="h-10 w-full"
                value={filters.date_to}
                onChange={(e) => updateFilters({ date_to: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="w-full min-w-0 shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Detected vehicles</CardTitle>
              <CardDescription>
                {totalCount > 0
                  ? `Showing ${rangeStart}–${rangeEnd} of ${totalCount.toLocaleString()} vehicles`
                  : hasActiveFilters
                    ? "No vehicles match your filters"
                    : "No vehicle detections recorded yet"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="veh-page-size" className="text-sm text-muted-foreground whitespace-nowrap">
                Per page
              </Label>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v))
                  setSnapshot(null)
                  setPage(1)
                }}
              >
                <SelectTrigger id="veh-page-size" className="w-[100px]">
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
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error instanceof Error ? error.message : "Failed to load vehicle detections"}
              </div>
            )}

            <div className="w-full overflow-x-auto rounded-lg border">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[170px]">Date & time</TableHead>
                    <TableHead>Camera</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead className="w-[140px]">Confidence</TableHead>
                    <TableHead>Alert</TableHead>
                    <TableHead className="w-[140px]">Snapshot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                        Loading vehicle detections…
                      </TableCell>
                    </TableRow>
                  ) : events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                        <Car className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        {hasActiveFilters
                          ? "No vehicles match your filters. Try a wider date range or clear filters."
                          : "No vehicles detected yet. Enable AI on cameras and open live feeds."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    events.map((row) => (
                      <TableRow key={row.id} className={row.is_alert ? "bg-amber-50/50 dark:bg-amber-950/10" : undefined}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {formatDateTime(row.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.camera_code}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                            {row.name ?? row.camera_name ?? row.camera_code}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal capitalize">
                            {row.class_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate" title={row.label}>
                          {row.label}
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
                          {row.clip_url ? (
                            <DetectionSnapshotThumb row={row} />
                          ) : row.clip_status === "pending" || row.clip_status === "recording" ? (
                            <span className="text-xs text-muted-foreground">Capturing…</span>
                          ) : row.clip_status === "failed" ? (
                            <span className="text-xs text-destructive">Capture failed</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
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
                    <Label htmlFor="veh-page-jump" className="text-sm text-muted-foreground whitespace-nowrap">
                      Go to
                    </Label>
                    <Input
                      id="veh-page-jump"
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
    </ModulePageLayout>
  )
}
