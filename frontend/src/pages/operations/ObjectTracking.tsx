import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  Activity,
  Box,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LogOut,
  RefreshCw,
  Search,
  Users,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROUTES, getObjectTrackingDetailPath } from "@/routes/config"
import { TrackingCaptureThumb } from "@/components/object-tracking/tracking-capture-thumb"
import {
  fetchObjectTrackingLive,
  fetchObjectTrackingSummary,
  fetchObjectVisits,
  fetchTrackedObjects,
  formatDuration,
  objectTypeLabel,
  unwrapList,
  type ObjectType,
  type VisitStatus,
} from "@/lib/object-tracking-api"

const LIVE_PAGE_SIZE = 15
const OBJECTS_PAGE_SIZE = 25
const VISITS_PAGE_SIZE = 25

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

function typeBadge(type: string): "default" | "secondary" | "outline" {
  if (type === "person") return "default"
  if (type === "vehicle") return "secondary"
  return "outline"
}

function PaginationBar({
  page,
  totalPages,
  totalCount,
  pageSize,
  isFetching,
  onPageChange,
}: {
  page: number
  totalPages: number
  totalCount: number
  pageSize: number
  isFetching?: boolean
  onPageChange: (page: number) => void
}) {
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, totalCount)

  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {totalCount === 0
          ? "No results"
          : `Showing ${rangeStart}–${rangeEnd} of ${totalCount} · Page ${page} of ${totalPages}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || isFetching}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages || isFetching || totalCount === 0}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="gap-1"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default function ObjectTrackingPage() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | ObjectType>("all")
  const [presenceFilter, setPresenceFilter] = useState<"all" | "present" | "exited">("all")
  const [visitStatus, setVisitStatus] = useState<"all" | VisitStatus>("all")
  const [livePage, setLivePage] = useState(1)
  const [objectsPage, setObjectsPage] = useState(1)
  const [visitsPage, setVisitsPage] = useState(1)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch((prev) => {
        const next = search.trim()
        if (prev !== next) {
          setObjectsPage(1)
          setVisitsPage(1)
        }
        return next
      })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const summaryQuery = useQuery({
    queryKey: ["object-tracking-summary"],
    queryFn: fetchObjectTrackingSummary,
    refetchInterval: 10000,
  })

  const liveQuery = useQuery({
    queryKey: ["object-tracking-live", livePage, LIVE_PAGE_SIZE],
    queryFn: () => fetchObjectTrackingLive({ page: livePage, page_size: LIVE_PAGE_SIZE }),
    refetchInterval: 5000,
    placeholderData: (prev) => prev,
  })

  const objectsQuery = useQuery({
    queryKey: ["object-tracking-objects", debouncedSearch, typeFilter, presenceFilter, objectsPage],
    queryFn: () =>
      fetchTrackedObjects({
        q: debouncedSearch || undefined,
        object_type: typeFilter,
        present:
          presenceFilter === "all" ? undefined : presenceFilter === "present",
        page: objectsPage,
        page_size: OBJECTS_PAGE_SIZE,
      }),
    refetchInterval: 10000,
    placeholderData: (prev) => prev,
  })

  const visitsQuery = useQuery({
    queryKey: ["object-tracking-visits", debouncedSearch, typeFilter, visitStatus, visitsPage],
    queryFn: () =>
      fetchObjectVisits({
        q: debouncedSearch || undefined,
        object_type: typeFilter,
        status: visitStatus,
        page: visitsPage,
        page_size: VISITS_PAGE_SIZE,
      }),
    refetchInterval: 10000,
    placeholderData: (prev) => prev,
  })

  const objects = useMemo(() => unwrapList(objectsQuery.data), [objectsQuery.data])
  const visits = useMemo(() => unwrapList(visitsQuery.data), [visitsQuery.data])
  const live = liveQuery.data?.results ?? []
  const summary = summaryQuery.data

  const liveTotal = liveQuery.data?.count ?? 0
  const liveTotalPages = liveQuery.data?.total_pages ?? 1
  const objectsTotal = objectsQuery.data?.count ?? 0
  const objectsTotalPages = objectsQuery.data?.total_pages ?? 1
  const visitsTotal = visitsQuery.data?.count ?? 0
  const visitsTotalPages = visitsQuery.data?.total_pages ?? 1

  useEffect(() => {
    if (liveTotalPages > 0 && livePage > liveTotalPages) setLivePage(liveTotalPages)
  }, [livePage, liveTotalPages])

  useEffect(() => {
    if (objectsTotalPages > 0 && objectsPage > objectsTotalPages) setObjectsPage(objectsTotalPages)
  }, [objectsPage, objectsTotalPages])

  useEffect(() => {
    if (visitsTotalPages > 0 && visitsPage > visitsTotalPages) setVisitsPage(visitsTotalPages)
  }, [visitsPage, visitsTotalPages])

  return (
    <ModulePageLayout
      title="Object Tracking"
      description="ByteTrack + ReID global identities with visit entry, exit, and duration history."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            summaryQuery.refetch()
            liveQuery.refetch()
            objectsQuery.refetch()
            visitsQuery.refetch()
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Present now</CardDescription>
            <CardTitle className="text-3xl">{summary?.present_now ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" /> Active on cameras
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active visits</CardDescription>
            <CardTitle className="text-3xl">{summary?.active_visits ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center gap-2">
            <Clock3 className="h-3.5 w-3.5" /> Open sessions
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Visits (24h)</CardDescription>
            <CardTitle className="text-3xl">{summary?.visits_24h ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center gap-2">
            <Users className="h-3.5 w-3.5" /> New entries
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Exits (24h)</CardDescription>
            <CardTitle className="text-3xl">{summary?.exits_24h ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center gap-2">
            <LogOut className="h-3.5 w-3.5" /> Closed visits
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Global objects</CardDescription>
            <CardTitle className="text-3xl">{summary?.objects_total ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center gap-2">
            <Box className="h-3.5 w-3.5" /> Unique identities
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Live presence</CardTitle>
            <CardDescription>Objects currently in view</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[420px] overflow-auto">
              {live.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active visits right now.</p>
              ) : (
                live.map((v) => (
                  <Link
                    key={v.id}
                    to={v.global_uuid ? getObjectTrackingDetailPath(v.global_uuid) : ROUTES.OBJECT_TRACKING}
                    className="flex gap-3 rounded-md border p-3 hover:bg-muted/40 transition-colors"
                  >
                    <TrackingCaptureThumb
                      url={v.snapshot_url}
                      alt={v.global_code}
                      size="sm"
                      asLink={false}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{v.global_code}</span>
                        <Badge variant={typeBadge(v.object_type)}>{objectTypeLabel(v.object_type)}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground capitalize">{v.class_name || "—"}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Camera className="h-3 w-3" />
                        {v.camera_name || "Camera"} · track #{v.local_track_id ?? "—"}
                      </div>
                      <div className="text-xs">Entry {formatDateTime(v.entry_at)}</div>
                      <div className="text-xs text-muted-foreground">
                        Duration {formatDuration(
                          Math.max(
                            0,
                            (Date.now() - new Date(v.entry_at).getTime()) / 1000,
                          ),
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
            <PaginationBar
              page={livePage}
              totalPages={liveTotalPages}
              totalCount={liveTotal}
              pageSize={LIVE_PAGE_SIZE}
              isFetching={liveQuery.isFetching}
              onPageChange={setLivePage}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="space-y-3">
            <div>
              <CardTitle className="text-base">Global identities</CardTitle>
              <CardDescription>Same ReID identity across leave / return</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search code, class, label…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select
                value={typeFilter}
                onValueChange={(v) => {
                  setTypeFilter(v as typeof typeFilter)
                  setObjectsPage(1)
                  setVisitsPage(1)
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="person">Person</SelectItem>
                  <SelectItem value="vehicle">Vehicle</SelectItem>
                  <SelectItem value="object">Object</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={presenceFilter}
                onValueChange={(v) => {
                  setPresenceFilter(v as typeof presenceFilter)
                  setObjectsPage(1)
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Presence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="exited">Exited</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Capture</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Camera</TableHead>
                  <TableHead>First seen</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>Visits</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {objects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      No tracked objects yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  objects.map((obj) => (
                    <TableRow key={obj.uuid}>
                      <TableCell>
                        <TrackingCaptureThumb
                          url={obj.snapshot_url || obj.active_visit?.snapshot_url}
                          alt={obj.code}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{obj.code}</TableCell>
                      <TableCell>
                        <Badge variant={typeBadge(obj.object_type)}>
                          {objectTypeLabel(obj.object_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{obj.class_name || "—"}</TableCell>
                      <TableCell>{obj.latest_camera_name || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(obj.first_seen_at)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(obj.last_seen_at)}</TableCell>
                      <TableCell>{obj.visit_count ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant={obj.is_present ? "default" : "outline"}>
                          {obj.is_present ? "Present" : "Exited"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link to={getObjectTrackingDetailPath(obj.uuid)}>
                            Detail <ChevronRight className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <PaginationBar
              page={objectsPage}
              totalPages={objectsTotalPages}
              totalCount={objectsTotal}
              pageSize={OBJECTS_PAGE_SIZE}
              isFetching={objectsQuery.isFetching}
              onPageChange={setObjectsPage}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Visit history</CardTitle>
            <CardDescription>Entry → last seen → exit → duration. Return creates a new visit.</CardDescription>
          </div>
          <Select
            value={visitStatus}
            onValueChange={(v) => {
              setVisitStatus(v as typeof visitStatus)
              setVisitsPage(1)
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Visit status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All visits</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="exited">Exited</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Capture</TableHead>
                <TableHead>Global ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Camera</TableHead>
                <TableHead>Track</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead>Exit</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    No visits recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                visits.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <TrackingCaptureThumb url={v.snapshot_url} alt={v.global_code} size="sm" />
                    </TableCell>
                    <TableCell className="font-medium">
                      {v.global_uuid ? (
                        <Link
                          to={getObjectTrackingDetailPath(v.global_uuid)}
                          className="hover:underline"
                        >
                          {v.global_code}
                        </Link>
                      ) : (
                        v.global_code
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={typeBadge(v.object_type)}>{objectTypeLabel(v.object_type)}</Badge>
                    </TableCell>
                    <TableCell>{v.camera_name || "—"}</TableCell>
                    <TableCell>#{v.local_track_id ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(v.entry_at)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(v.last_seen_at)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(v.exit_at)}</TableCell>
                    <TableCell>
                      {v.status === "active"
                        ? formatDuration(
                            Math.max(0, (Date.now() - new Date(v.entry_at).getTime()) / 1000),
                          )
                        : formatDuration(v.duration_seconds)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={v.status === "active" ? "default" : "outline"}>
                        {v.status === "active" ? "Active" : "Exited"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <PaginationBar
            page={visitsPage}
            totalPages={visitsTotalPages}
            totalCount={visitsTotal}
            pageSize={VISITS_PAGE_SIZE}
            isFetching={visitsQuery.isFetching}
            onPageChange={setVisitsPage}
          />
        </CardContent>
      </Card>
    </ModulePageLayout>
  )
}
