import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  Route,
  Users,
  UserX,
  Activity,
  Search,
  RefreshCw,
  ChevronRight,
  MapPin,
  Camera,
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

export default function PersonJourneyPage() {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | JourneyPersonType>("all")

  const summaryQuery = useQuery({
    queryKey: ["journey-summary"],
    queryFn: fetchJourneySummary,
    refetchInterval: 15000,
  })

  const liveQuery = useQuery({
    queryKey: ["journey-live"],
    queryFn: () => fetchJourneyLive(30),
    refetchInterval: 10000,
  })

  const personsQuery = useQuery({
    queryKey: ["journey-persons", typeFilter],
    queryFn: () =>
      fetchJourneyPersons({
        person_type: typeFilter === "all" ? undefined : typeFilter,
        active_only: true,
      }),
    refetchInterval: 15000,
  })

  const cameraSightingsQuery = useQuery({
    queryKey: ["journey-camera-sightings"],
    queryFn: () => fetchJourneyCameraSightings(4),
    refetchInterval: 15000,
  })

  const filtered = useMemo(() => {
    const list = personsQuery.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.display_name.toLowerCase().includes(q) ||
        (p.latest_zone ?? "").toLowerCase().includes(q) ||
        (p.latest_camera_name ?? "").toLowerCase().includes(q)
    )
  }, [personsQuery.data, search])

  const summary = summaryQuery.data

  return (
    <ModulePageLayout
      title="Person Journey"
      description="Enterprise cross-camera tracking — YOLO + ByteTrack + Face + ReID matching with unified Person UUID timeline."
      breadcrumbs={[{ label: "AI Analytics" }, { label: "Person Journey" }]}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Now</CardDescription>
              <CardTitle className="text-3xl">{summary?.active_now ?? "—"}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="h-3.5 w-3.5" /> Persons with open journeys
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unknown Today</CardDescription>
              <CardTitle className="text-3xl">{summary?.unknown_today ?? "—"}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground flex items-center gap-1">
              <UserX className="h-3.5 w-3.5" /> New unknown UUIDs created
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
            <CardTitle>Camera Captures</CardTitle>
            <CardDescription>Latest person sighting snapshot from each active camera</CardDescription>
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
                      className="h-36 w-full rounded-none border-0 object-cover"
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
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Live Persons</CardTitle>
                <CardDescription>Seen in the last 30 minutes across all cameras</CardDescription>
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
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search code, name, zone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
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
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No active person journeys. Enable the journey worker and sync cameras to start tracking.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Capture</TableHead>
                      <TableHead>Person</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Last Location</TableHead>
                      <TableHead>Last Seen</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((person) => (
                      <TableRow key={person.uuid}>
                        <TableCell>
                          <JourneySnapshot
                            url={personSnapshotUrl(person)}
                            alt={person.display_name || person.code}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{person.display_name || person.code}</div>
                          <div className="text-xs text-muted-foreground font-mono">{person.code}</div>
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
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest sightings (30 min window)</CardDescription>
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
                      className="h-14 w-20 rounded border object-cover bg-muted shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{p.display_name || p.code}</span>
                      <Badge variant={typeBadgeVariant(p.person_type)} className="shrink-0 text-[10px]">
                        {p.code}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {p.latest_camera_name || "Camera"} · {formatDateTime(p.latest_seen_at)}
                    </p>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* <Card>
          <CardHeader>
            <CardTitle>Pipeline Architecture</CardTitle>
            <CardDescription>
              Independent Tek Eye journey service — does not replace existing object detection or attendance logic.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              RTSP → YOLO Person Detection → ByteTrack → Face (InsightFace/SFace) + Appearance (ReID) → Person
              Matching Engine → Journey Event Database → this dashboard.
            </p>
            <p>
              Enable with <code className="text-xs bg-muted px-1 rounded">PERSON_JOURNEY_WORKER_ENABLED=True</code>{" "}
              in backend <code className="text-xs bg-muted px-1 rounded">.env</code>, then run{" "}
              <code className="text-xs bg-muted px-1 rounded">python manage.py sync_journey_cameras</code>.
            </p>
          </CardContent>
        </Card> */}
      </div>
    </ModulePageLayout>
  )
}
