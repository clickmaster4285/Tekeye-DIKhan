import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  Camera,
  Car,
  ChevronLeft,
  ChevronRight,
  MapPin,
  RefreshCw,
  Route,
  Search,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getVehicleJourneyPath, ROUTES } from "@/routes/config"
import {
  fetchVehicleJourneys,
  resolveMediaUrl,
  type VehicleJourney,
} from "@/lib/cameras-api"

const PAGE_SIZE = 25

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function PlateThumb({ src, alt }: { src: string; alt: string }) {
  const url = resolveMediaUrl(src)
  if (!url) return <div className="h-14 w-24 rounded bg-muted" />
  return (
    <img src={url} alt={alt} className="h-14 w-24 rounded border object-cover bg-muted" loading="lazy" />
  )
}

function routeLabel(journey: VehicleJourney): string {
  if (journey.route?.length) return journey.route.join(" → ")
  return journey.last_camera || "—"
}

export default function VehicleJourneyPage() {
  const [search, setSearch] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [repeatOnly, setRepeatOnly] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const next = search.trim()
    const timer = window.setTimeout(() => {
      setDebouncedQ((prev) => {
        if (prev !== next) setPage(1)
        return next
      })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const minPasses = repeatOnly ? 2 : 1

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["vehicle-journeys", page, PAGE_SIZE, debouncedQ, minPasses],
    queryFn: () =>
      fetchVehicleJourneys({
        page,
        page_size: PAGE_SIZE,
        q: debouncedQ || undefined,
        min_passes: minPasses,
      }),
    refetchInterval: 12_000,
    placeholderData: (prev) => prev,
  })

  const summary = data?.summary
  const results = data?.results ?? []
  const total = data?.count ?? 0
  const totalPages = data?.total_pages ?? 1

  const filteredHint = useMemo(() => {
    if (debouncedQ) return "matching search"
    if (repeatOnly) return "seen more than once"
    return "all plates"
  }, [debouncedQ, repeatOnly])

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <ModulePageLayout
      title="Vehicle Journey"
      description="Same number plate tracked across cameras and repeat visits — timeline of every pass."
      breadcrumbs={[{ label: "AI Computer Vision" }, { label: "Vehicle Journey" }]}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Vehicles</CardTitle>
              <Car className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.total_vehicles ?? "—"}</div>
              <p className="mt-1 text-xs text-muted-foreground">Unique plates with accepted reads</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Repeat visits</CardTitle>
              <Route className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.repeat_vehicles ?? "—"}</div>
              <p className="mt-1 text-xs text-muted-foreground">Passed a camera more than once</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Multi-camera</CardTitle>
              <Camera className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.multi_camera ?? "—"}</div>
              <p className="mt-1 text-xs text-muted-foreground">Seen on two or more cameras</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sightings</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.total_sightings ?? "—"}</div>
              <p className="mt-1 text-xs text-muted-foreground">All plate captures in journeys</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Vehicle journeys</CardTitle>
              <CardDescription>
                Showing {results.length} of {total} {filteredHint}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="repeat-only"
                  checked={repeatOnly}
                  onCheckedChange={(checked) => {
                    setRepeatOnly(checked)
                    setPage(1)
                  }}
                />
                <Label htmlFor="repeat-only" className="text-sm font-normal">
                  Repeat visits only
                </Label>
              </div>
              <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search plate or camera…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive">
                {error instanceof Error ? error.message : "Failed to load vehicle journeys."}
              </p>
            ) : null}
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading journeys…</p>
            ) : results.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {debouncedQ || repeatOnly
                  ? "No vehicles match these filters. Turn off “Repeat visits only” to see every plate."
                  : "No plate journeys yet. Run ANPR cameras so the same number plate can be tracked across passes."}
              </p>
            ) : (
              <>
                <div className="w-full max-w-full overflow-x-auto rounded-lg border">
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plate</TableHead>
                        <TableHead>Number</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Passes</TableHead>
                        <TableHead>Cameras</TableHead>
                        <TableHead>Last seen</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((journey) => (
                        <TableRow key={journey.plate_key}>
                          <TableCell>
                            <PlateThumb src={journey.plate_image} alt={journey.plate_number} />
                          </TableCell>
                          <TableCell>
                            <Link
                              to={getVehicleJourneyPath(journey.plate_key)}
                              className="font-semibold tracking-wide hover:underline"
                            >
                              {journey.plate_number}
                            </Link>
                            {journey.ocr_variants.length > 1 ? (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Also {journey.ocr_variants.filter((v) => v !== journey.plate_number).join(", ")}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="max-w-xs text-sm">
                            <span className="line-clamp-2">{routeLabel(journey)}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={journey.pass_count >= 2 ? "default" : "secondary"}>
                              {journey.pass_count} {journey.pass_count === 1 ? "pass" : "passes"}
                            </Badge>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {journey.sighting_count} reads
                            </p>
                          </TableCell>
                          <TableCell className="text-sm">{journey.camera_count}</TableCell>
                          <TableCell>
                            <p className="text-sm">{formatDateTime(journey.last_seen)}</p>
                            <p className="text-xs text-muted-foreground">{journey.last_camera || "—"}</p>
                          </TableCell>
                          <TableCell>
                            <Button asChild variant="ghost" size="icon">
                              <Link to={getVehicleJourneyPath(journey.plate_key)}>
                                <ChevronRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
            <p className="text-xs text-muted-foreground">
              Need a single capture? Open{" "}
              <Link to={ROUTES.ANPR_VEHICLE_TRACKING} className="underline">
                Number Plate Tracking
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
