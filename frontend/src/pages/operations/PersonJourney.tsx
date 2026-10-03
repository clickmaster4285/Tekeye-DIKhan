import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  Route,
  Users,
  UserX,
  Contact,
  Activity,
  Search,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Camera,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROUTES } from "@/routes/config"
import {
  JourneySnapshot,
  eventSnapshotUrl,
  personSnapshotUrl,
} from "@/components/person-journey/journey-snapshot"
import {
  fetchJourneyCameraSightings,
  fetchJourneyLive,
  fetchJourneyPersons,
  fetchJourneySummary,
  journeyPersonTypeLabel,
  type JourneyEventRecord,
  type JourneyPersonType,
} from "@/lib/person-journey-api"

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
const DEFAULT_PAGE_SIZE = 20

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    return iso
  }
}

function typeBadgeVariant(type: JourneyPersonType): "default" | "secondary" | "destructive" | "outline" {
  if (type === "staff") return "default"
  if (type === "visitor") return "secondary"
  return "destructive"
}

function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

export default function PersonJourneyPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 350)
  const [typeFilter, setTypeFilter] = useState<"all" | JourneyPersonType>("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const summaryQuery = useQuery({
    queryKey: ["journey-summary"],
    queryFn: fetchJourneySummary,
  })

  const liveQuery = useQuery({
    queryKey: ["journey-live"],
    queryFn: () => fetchJourneyLive(24 * 60), // last 24 hours for sidebar activity
  })

  const personsQuery = useQuery({
    queryKey: ["journey-persons", typeFilter, debouncedSearch, page, pageSize],
    queryFn: () =>
      fetchJourneyPersons({
        q: debouncedSearch.trim() || undefined,
        person_type: typeFilter === "all" ? undefined : typeFilter,
        page,
        page_size: pageSize,
      }),
  })

  const cameraSightingsQuery = useQuery({
    queryKey: ["journey-camera-sightings"],
    queryFn: () => fetchJourneyCameraSightings(0), // 0 = all history
  })

  const persons = personsQuery.data?.results ?? []
  const totalCount = personsQuery.data?.count ?? 0
  const totalPages = personsQuery.data?.total_pages ?? 1
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, totalCount)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, typeFilter, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const summary = summaryQuery.data

  const pageNumbers = useMemo(() => {
    const pages: number[] = []
    const window = 2
    const start = Math.max(1, page - window)
    const end = Math.min(totalPages, page + window)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }, [page, totalPages])

  return (
    <ModulePageLayout
      title="Person Journey"
      description="See who was spotted on cameras and follow their path from place to place."
      breadcrumbs={[{ label: "AI Analytics" }, { label: "Person Journey" }]}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Now</CardDescription>
              <CardTitle className="text-3xl">{summary?.active_now ?? "—"}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="h-3.5 w-3.5" /> Staff, visitors, and unknowns
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unknown Today</CardDescription>
              <CardTitle className="text-3xl">{summary?.unknown_today ?? "—"}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground flex items-center gap-1">
              <UserX className="h-3.5 w-3.5" /> Unidentified people
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Visitors Today</CardDescription>
              <CardTitle className="text-3xl">{summary?.visitors_today ?? summary?.by_type?.visitor ?? "—"}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground flex items-center gap-1">
              <Contact className="h-3.5 w-3.5" /> Registered visitor tracks
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Staff Recognized (24h)</CardDescription>
              <CardTitle className="text-3xl">{summary?.staff_recognized_24h ?? "—"}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Face match events
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Journey Events (24h)</CardDescription>
              <CardTitle className="text-3xl">{summary?.events_24h ?? "—"}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground flex items-center gap-1">
              <Route className="h-3.5 w-3.5" /> Camera, zone, attendance
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Live camera photos</CardTitle>
            <CardDescription>Latest photo of a person from each camera</CardDescription>
          </CardHeader>
          <CardContent>
            {cameraSightingsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading camera captures...</p>
            ) : (cameraSightingsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No camera captures yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {(cameraSightingsQuery.data ?? []).map((ev: JourneyEventRecord) => (
                  <div key={ev.id} className="rounded-lg border overflow-hidden bg-card">
                    <JourneySnapshot
                      url={eventSnapshotUrl(ev)}
                      alt={ev.camera_name || "Camera capture"}
                      className="h-44 w-full rounded-none border-0 object-contain bg-muted"
                    />
                    <div className="p-3 space-y-1">
                      <p className="font-medium text-sm truncate">{ev.camera_name || ev.camera_code}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {ev.person_name || ev.person_code || "Unknown"} · {formatDateTime(ev.created_at)}
                      </p>
                      {ev.zone ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {ev.zone}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>All Journeys</CardTitle>
                <CardDescription>
                  {totalCount > 0
                    ? `Showing ${rangeStart}–${rangeEnd} of ${totalCount.toLocaleString()} people`
                    : "All staff, visitors, and unknown people tracked by cameras"}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="journey-page-size" className="text-sm text-muted-foreground whitespace-nowrap">
                    Per page
                  </Label>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => {
                      setPageSize(Number(v))
                      setPage(1)
                    }}
                  >
                    <SelectTrigger id="journey-page-size" className="w-[100px]">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    liveQuery.refetch()
                    personsQuery.refetch()
                    summaryQuery.refetch()
                    cameraSightingsQuery.refetch()
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name, code, camera, zone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={typeFilter}
                  onValueChange={(v) => {
                    setTypeFilter(v as typeof typeFilter)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="visitor">Visitor</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {personsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Loading journeys...</p>
              ) : persons.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {debouncedSearch.trim() || typeFilter !== "all"
                    ? "No journeys match your search."
                    : "No people tracked yet. When cameras see someone, they will appear here."}
                </p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[88px]">Capture</TableHead>
                        <TableHead>Person</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Last Location</TableHead>
                        <TableHead>Last Seen</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {persons.map((person) => (
                        <TableRow key={person.uuid}>
                          <TableCell>
                            <JourneySnapshot
                              url={personSnapshotUrl(person)}
                              alt={person.display_name || person.code}
                              className="h-24 w-36 rounded border object-contain bg-muted"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{person.display_name || person.code}</div>
                            <div className="text-xs text-muted-foreground">
                              Ref {person.person_id || person.code}
                            </div>
                            {(person.active_tracklet_count ?? 0) > 0 ? (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                Seen on {person.active_tracklet_count} camera
                                {person.active_tracklet_count === 1 ? "" : "s"} now
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Badge variant={typeBadgeVariant(person.person_type)}>
                              {journeyPersonTypeLabel(person.person_type)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                              {person.latest_camera_name || "—"}
                            </div>
                            {person.latest_zone ? (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                <MapPin className="h-3 w-3" />
                                {person.latest_zone}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-sm">{formatDateTime(person.latest_seen_at)}</TableCell>
                          <TableCell>
                            <Button asChild variant="ghost" size="icon">
                              <Link to={ROUTES.PERSON_JOURNEY_DETAIL.replace(":uuid", person.uuid)}>
                                <ChevronRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </p>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1 || personsQuery.isFetching}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      {pageNumbers[0] > 1 ? (
                        <>
                          <Button variant={page === 1 ? "default" : "outline"} size="sm" onClick={() => setPage(1)}>
                            1
                          </Button>
                          {pageNumbers[0] > 2 ? (
                            <span className="px-1 text-muted-foreground text-sm">…</span>
                          ) : null}
                        </>
                      ) : null}
                      {pageNumbers.map((n) => (
                        <Button
                          key={n}
                          variant={n === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(n)}
                        >
                          {n}
                        </Button>
                      ))}
                      {pageNumbers[pageNumbers.length - 1] < totalPages ? (
                        <>
                          {pageNumbers[pageNumbers.length - 1] < totalPages - 1 ? (
                            <span className="px-1 text-muted-foreground text-sm">…</span>
                          ) : null}
                          <Button
                            variant={page === totalPages ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPage(totalPages)}
                          >
                            {totalPages}
                          </Button>
                        </>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages || personsQuery.isFetching}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest people seen (last 24 hours) — older journeys stay in All Journeys</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[480px] overflow-y-auto">
              {(liveQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              ) : (
                (liveQuery.data ?? []).slice(0, 20).map((p) => (
                  <Link
                    key={p.uuid}
                    to={ROUTES.PERSON_JOURNEY_DETAIL.replace(":uuid", p.uuid)}
                    className="flex gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <JourneySnapshot
                      url={personSnapshotUrl(p)}
                      alt={p.display_name || p.code}
                      className="h-20 w-32 rounded border object-contain bg-muted shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{p.display_name || p.code}</span>
                        <Badge variant={typeBadgeVariant(p.person_type)} className="shrink-0 text-[10px]">
                          {journeyPersonTypeLabel(p.person_type)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {p.latest_camera_name || "Camera"} · {formatDateTime(p.latest_seen_at)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Tap to see their full path</p>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ModulePageLayout>
  )
}
