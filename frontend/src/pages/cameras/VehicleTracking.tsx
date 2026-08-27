import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  Car,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  RefreshCw,
  Route,
  Search,
  Settings2,
  X,
} from "lucide-react"
import { getVehicleJourneyPath, ROUTES } from "@/routes/config"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  fetchPlateCaptures,
  resolveMediaUrl,
  type PlateCapture,
} from "@/lib/cameras-api"

const PAGE_SIZE = 25

type AppliedFilters = {
  plate_number: string
  date_from: string
  date_to: string
}

const emptyFilters: AppliedFilters = {
  plate_number: "",
  date_from: "",
  date_to: "",
}

function formatTime(value: string) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function PlateThumb({
  src,
  alt,
  onClick,
}: {
  src: string
  alt: string
  onClick?: () => void
}) {
  const url = resolveMediaUrl(src)
  if (!url) {
    return <div className="h-14 w-24 rounded bg-muted" />
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="block overflow-hidden rounded border bg-muted/40 transition hover:opacity-90"
    >
      <img src={url} alt={alt} className="h-14 w-24 object-cover" loading="lazy" />
    </button>
  )
}

export default function VehicleTrackingPage() {
  const [filters, setFilters] = useState<AppliedFilters>(emptyFilters)
  const [debouncedPlate, setDebouncedPlate] = useState("")
  const [page, setPage] = useState(1)
  const [preview, setPreview] = useState<PlateCapture | null>(null)

  // Debounce plate text; date controls apply immediately.
  useEffect(() => {
    const next = filters.plate_number.trim()
    const timer = window.setTimeout(() => {
      setDebouncedPlate((prev) => {
        if (prev !== next) setPage(1)
        return next
      })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [filters.plate_number])

  const applied = useMemo(
    () => ({
      plate_number: debouncedPlate,
      date_from: filters.date_from,
      date_to: filters.date_to,
    }),
    [debouncedPlate, filters.date_from, filters.date_to]
  )

  const hasActiveFilters = useMemo(
    () =>
      filters.plate_number.trim() !== "" ||
      filters.date_from !== "" ||
      filters.date_to !== "",
    [filters]
  )

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["plate-captures", page, PAGE_SIZE, applied],
    queryFn: () =>
      fetchPlateCaptures({
        page,
        page_size: PAGE_SIZE,
        plate_number: applied.plate_number || undefined,
        date_from: applied.date_from || undefined,
        date_to: applied.date_to || undefined,
        cleanup: false,
      }),
    refetchInterval: 8_000,
    placeholderData: (prev) => prev,
  })

  const summary = data?.summary
  const results = data?.results ?? []
  const total = data?.count ?? 0
  const totalPages = data?.total_pages ?? 1

  const updateFilters = (patch: Partial<AppliedFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    if (!("plate_number" in patch)) setPage(1)
  }

  const clearFilters = () => {
    setFilters(emptyFilters)
    setDebouncedPlate("")
    setPage(1)
  }

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  return (
    <ModulePageLayout
      title="Number Plate Tracking"
      description="Saved ANPR detections with plate crop, scene image, and licence plate number. Filter by plate number and date/time. Open Vehicle Journey to see the same plate across cameras and repeat passes."
      breadcrumbs={[{ label: "AI Computer Vision" }, { label: "Number Plate Tracking" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ANPR Cameras</CardTitle>
              <Car className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.anpr_cameras ?? "—"}</div>
              <p className="mt-1 text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saved records</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.total_captures ?? "—"}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary?.reads_today ?? 0} today · {summary?.unique_plates_today ?? 0} unique today
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Match Rate</CardTitle>
              <Settings2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary ? `${summary.match_rate}%` : "—"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Pakistan-format plates among saved reads</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
              <CardDescription>Filters apply as you change them</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters ? (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="plate-number">Plate number</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="plate-number"
                  className="pl-8"
                  placeholder="e.g. BSD987"
                  value={filters.plate_number}
                  onChange={(e) => updateFilters({ plate_number: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plate-from">Date & time from</Label>
              <Input
                id="plate-from"
                type="datetime-local"
                value={filters.date_from}
                onChange={(e) => updateFilters({ date_from: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plate-to">Date & time to</Label>
              <Input
                id="plate-to"
                type="datetime-local"
                value={filters.date_to}
                onChange={(e) => updateFilters({ date_to: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Plate Captures</CardTitle>
              <CardDescription>
                Each detection is saved with a plate crop, scene image, and OCR licence plate number.
                Showing {results.length} of {total}
                {hasActiveFilters ? " (filtered)" : ""}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" className="gap-2">
                <Link to={ROUTES.VEHICLE_JOURNEY}>
                  <Route className="h-4 w-4" />
                  Vehicle Journey
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-sm text-destructive">
                {error instanceof Error ? error.message : "Failed to load plate captures."}
              </p>
            ) : null}
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading captures…</p>
            ) : results.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "No plate captures match your filters."
                  : "No plate records yet. Run an ANPR camera stream so each detection is saved with crop, scene, and plate number."}
              </p>
            ) : (
              <>
                <div className="w-full max-w-full overflow-x-auto rounded-lg border">
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plate crop</TableHead>
                        <TableHead>Scene</TableHead>
                        <TableHead>Plate number</TableHead>
                        <TableHead>Camera</TableHead>
                        <TableHead>Det / OCR</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((row) => (
                        <TableRow key={`${row.plate_number}-${row.camera_key}-${row.timestamp}`}>
                          <TableCell>
                            <PlateThumb
                              src={row.plate_image}
                              alt={row.plate_number || "plate"}
                              onClick={() => setPreview(row)}
                            />
                          </TableCell>
                          <TableCell>
                            <PlateThumb
                              src={row.frame_image}
                              alt="scene"
                              onClick={() => setPreview(row)}
                            />
                          </TableCell>
                          <TableCell className="font-semibold tracking-wide">
                            {row.plate_number ? (
                              <Link
                                to={getVehicleJourneyPath(row.plate_number)}
                                className="hover:underline"
                                title="Open vehicle journey"
                              >
                                {row.plate_number}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>{row.camera_key || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {(row.det_conf * 100).toFixed(0)}% / {(row.ocr_conf * 100).toFixed(0)}%
                          </TableCell>
                          <TableCell className="text-sm">{formatTime(row.timestamp)}</TableCell>
                          <TableCell>
                            <Badge variant={row.accepted ? "default" : "secondary"}>
                              {row.accepted ? "Accepted" : "Low OCR"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || isFetching}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages || isFetching}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="gap-1"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[92vh] w-[min(96vw,88rem)] max-w-none overflow-y-auto sm:max-w-[88rem]">
          <DialogHeader>
            <DialogTitle className="pr-8 text-xl">
              {preview?.plate_number || "Plate"} · {preview?.camera_key}
            </DialogTitle>
          </DialogHeader>
          {preview ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm text-muted-foreground">Plate crop</p>
                <img
                  src={resolveMediaUrl(preview.plate_image)}
                  alt="plate"
                  className="max-h-[70vh] min-h-[18rem] w-full rounded-lg border bg-black object-contain"
                />
              </div>
              <div>
                <p className="mb-2 text-sm text-muted-foreground">Full frame</p>
                <img
                  src={resolveMediaUrl(preview.frame_image)}
                  alt="frame"
                  className="max-h-[70vh] min-h-[18rem] w-full rounded-lg border bg-black object-contain"
                />
              </div>
              <p className="text-sm text-muted-foreground lg:col-span-2">
                {formatTime(preview.timestamp)} · det {(preview.det_conf * 100).toFixed(0)}% · ocr{" "}
                {(preview.ocr_conf * 100).toFixed(0)}%
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}
