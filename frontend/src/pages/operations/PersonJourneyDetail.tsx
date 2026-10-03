import { useMemo, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ChevronLeft,
  ChevronRight,
  Camera,
  MapPin,
  Clock,
  Shield,
  LogIn,
  AlertTriangle,
  User,
  Route,
  ArrowRight,
  Pencil,
  Check,
  X,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ROUTES } from "@/routes/config"
import {
  JourneyPersonNotFoundError,
  fetchJourneyTimeline,
  fetchJourneyCameraCaptures,
  fetchJourneyPersonDetail,
  renameJourneyPerson,
  journeyEventIconType,
  journeyPersonId,
  type JourneyCameraCapture,
  type JourneyEventRecord,
  type JourneyTrackletRecord,
} from "@/lib/person-journey-api"
import {
  JourneySnapshot,
  eventSnapshotUrl,
} from "@/components/person-journey/journey-snapshot"

type JourneyStop = {
  key: string
  step: number
  cameraName: string
  place: string
  firstSeen: string
  lastSeen: string
  isActive: boolean
  snapshotUrl?: string
  visitCount: number
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

function formatClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    return iso
  }
}

function dayLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return iso.slice(0, 10)
  }
}

function personTypePlain(type: string): string {
  if (type === "staff") return "Staff member"
  if (type === "visitor") return "Visitor"
  return "Unknown person"
}

function statusPlain(status: string, isActiveStop?: boolean): string {
  if (isActiveStop || status === "active") return "Still being watched"
  if (status === "finished") return "Left"
  if (status === "merged") return "Joined with another record"
  return status
}

function EventIcon({ type }: { type: ReturnType<typeof journeyEventIconType> }) {
  const cls = "h-4 w-4"
  if (type === "attendance") return <LogIn className={cls} />
  if (type === "zone") return <MapPin className={cls} />
  if (type === "alert") return <AlertTriangle className={cls} />
  if (type === "user") return <User className={cls} />
  return <Camera className={cls} />
}

function plainEventTitle(event: JourneyEventRecord): string {
  const cam = event.camera_name || event.zone || "a camera"
  if (event.event_type === "staff_recognized") {
    return `Recognized as staff at ${cam}`
  }
  if (event.event_type === "face_matched") {
    return `Matched a known visitor at ${cam}`
  }
  if (event.event_type === "zone_entry") {
    return `Entered ${event.zone || cam}`
  }
  if (event.event_type === "zone_exit") {
    return `Left ${event.zone || cam}`
  }
  if (event.event_type.includes("attendance")) {
    return event.title || `Attendance at ${cam}`
  }
  if (event.title?.toLowerCase().startsWith("seen at")) {
    return `Seen on ${cam}`
  }
  return event.title || `Seen on ${cam}`
}

/** Build a simple camera path: consecutive same-camera visits become one stop. */
function buildJourneyStops(
  events: JourneyEventRecord[],
  captures: JourneyCameraCapture[],
  tracks: JourneyTrackletRecord[]
): JourneyStop[] {
  const captureByCamera = new Map<string, string>()
  for (const c of captures) {
    const key = (c.camera_name || "").trim().toLowerCase()
    if (key && c.snapshot_url) captureByCamera.set(key, c.snapshot_url)
  }

  const cameraEvents = events
    .filter((e) => (e.camera_name || "").trim())
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  type Acc = {
    key: string
    cameraName: string
    place: string
    firstSeen: string
    lastSeen: string
    isActive: boolean
    snapshotUrl?: string
    visitCount: number
  }
  const stops: Acc[] = []

  for (const ev of cameraEvents) {
    const cameraName = (ev.camera_name || "Camera").trim()
    const place = (ev.zone || cameraName).trim()
    const snap = eventSnapshotUrl(ev) || captureByCamera.get(cameraName.toLowerCase())
    const last = stops[stops.length - 1]
    if (last && last.cameraName.toLowerCase() === cameraName.toLowerCase()) {
      last.lastSeen = ev.created_at
      last.visitCount += 1
      if (snap) last.snapshotUrl = snap
      continue
    }
    stops.push({
      key: `${cameraName}-${ev.created_at}-${stops.length}`,
      cameraName,
      place,
      firstSeen: ev.created_at,
      lastSeen: ev.created_at,
      isActive: false,
      snapshotUrl: snap,
      visitCount: 1,
    })
  }

  // If timeline is empty, fall back to tracklets (one stop per unique camera, chronological).
  if (stops.length === 0 && tracks.length > 0) {
    const byCamera = new Map<string, JourneyTrackletRecord>()
    const ordered = tracks.slice().sort((a, b) => a.started_at.localeCompare(b.started_at))
    for (const t of ordered) {
      const name = (t.camera_name || "Camera").trim()
      const key = name.toLowerCase()
      const prev = byCamera.get(key)
      if (!prev || t.started_at >= prev.started_at) {
        byCamera.set(key, t)
      }
    }
    for (const t of ordered) {
      const name = (t.camera_name || "Camera").trim()
      const key = name.toLowerCase()
      if (byCamera.get(key) !== t) continue
      stops.push({
        key: `track-${t.id}`,
        cameraName: name,
        place: (t.camera_zone || name).trim(),
        firstSeen: t.started_at,
        lastSeen: t.ended_at || t.started_at,
        isActive: t.status === "active",
        snapshotUrl: captureByCamera.get(key),
        visitCount: 1,
      })
    }
  }

  // Mark last stop active if any track on that camera is still active.
  const activeCameras = new Set(
    tracks.filter((t) => t.status === "active").map((t) => (t.camera_name || "").trim().toLowerCase())
  )
  for (const s of stops) {
    if (activeCameras.has(s.cameraName.toLowerCase())) s.isActive = true
  }

  return stops.map((s, i) => ({ ...s, step: i + 1 }))
}

function JourneyPath({ stops }: { stops: JourneyStop[] }) {
  if (stops.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No camera sightings yet. This person’s path will appear here when cameras see them.
      </p>
    )
  }

  const first = stops[0]
  const last = stops[stops.length - 1]
  const places = stops.map((s) => s.cameraName).join(" → ")

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
        <p className="font-medium">
          {stops.length === 1
            ? `Seen on 1 camera: ${first.cameraName}`
            : `Moved across ${stops.length} cameras`}
        </p>
        {stops.length > 1 ? (
          <p className="mt-1 text-muted-foreground leading-relaxed">{places}</p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          First seen {formatDateTime(first.firstSeen)}
          {last !== first ? ` · Last seen ${formatDateTime(last.lastSeen)}` : ""}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {stops.map((stop, index) => (
          <div key={stop.key} className="flex items-stretch gap-2 shrink-0">
            <div
              className={`w-[220px] rounded-xl border overflow-hidden bg-card ${
                stop.isActive ? "ring-2 ring-primary/40" : ""
              }`}
            >
              <div className="relative">
                <JourneySnapshot
                  url={stop.snapshotUrl}
                  alt={`Seen on ${stop.cameraName}`}
                  className="h-36 w-full rounded-none border-0 object-cover bg-muted"
                />
                <span className="absolute top-2 left-2 rounded-full bg-background/95 border px-2.5 py-0.5 text-xs font-semibold shadow-sm">
                  Step {stop.step}
                </span>
              </div>
              <div className="p-3 space-y-2">
                <div>
                  <p className="font-semibold text-sm leading-snug">{stop.cameraName}</p>
                  {stop.place && stop.place !== stop.cameraName ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {stop.place}
                    </p>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3 shrink-0" />
                  {formatClock(stop.firstSeen)}
                  {stop.lastSeen !== stop.firstSeen ? ` – ${formatClock(stop.lastSeen)}` : ""}
                </p>
                <Badge variant={stop.isActive ? "default" : "outline"} className="text-[10px]">
                  {stop.isActive ? "Still here" : "Left this camera"}
                </Badge>
              </div>
            </div>
            {index < stops.length - 1 ? (
              <div className="flex items-center px-0.5 text-muted-foreground" aria-hidden>
                <ArrowRight className="h-5 w-5" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelineItem({ event, stepLabel }: { event: JourneyEventRecord; stepLabel?: string }) {
  const iconType = journeyEventIconType(event.event_type)
  const isWeapon = event.event_type === "weapon_detected"
  const snapshot = eventSnapshotUrl(event)
  const isCameraEvent = iconType === "camera" || iconType === "user"

  return (
    <div className="flex gap-4 pb-6 last:pb-0">
      <div className="flex flex-col items-center">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full border ${
            isWeapon ? "bg-red-100 border-red-300 text-red-700" : "bg-muted"
          }`}
        >
          <EventIcon type={iconType} />
        </div>
        <div className="w-px flex-1 bg-border mt-2 min-h-[24px]" />
      </div>
      <div className="flex-1 pt-0.5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {stepLabel ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {stepLabel}
                </span>
              ) : null}
              <p className="font-medium text-sm">{plainEventTitle(event)}</p>
              {isWeapon ? (
                <Badge variant="destructive" className="text-[10px]">
                  Security alert
                </Badge>
              ) : null}
            </div>
            {event.description ? (
              <p className="text-sm text-muted-foreground mt-0.5">{event.description}</p>
            ) : null}
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDateTime(event.created_at)}
              </span>
              {event.camera_name ? (
                <span className="flex items-center gap-1">
                  <Camera className="h-3 w-3" />
                  {event.camera_name}
                </span>
              ) : null}
              {event.zone && event.zone !== event.camera_name ? (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {event.zone}
                </span>
              ) : null}
            </div>
          </div>
          {isCameraEvent ? (
            <JourneySnapshot
              url={snapshot}
              alt={`${event.camera_name || "Camera"} capture`}
              className="h-32 w-48 rounded border object-contain bg-muted shrink-0"
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function PersonJourneyDetailPage() {
  const { uuid } = useParams<{ uuid: string }>()
  const queryClient = useQueryClient()
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState("")
  const [nameError, setNameError] = useState("")

  const snapshotsRefreshed = useRef(new Set<string>())
  const refreshOnce = (key: string) => {
    if (snapshotsRefreshed.current.has(key)) return false
    snapshotsRefreshed.current.add(key)
    return true
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["journey-timeline", uuid, dateFrom, dateTo],
    queryFn: () =>
      fetchJourneyTimeline(uuid!, dateFrom || undefined, dateTo || undefined, refreshOnce(`timeline:${uuid}`)),
    enabled: !!uuid,
    retry: (count, err) => !(err instanceof JourneyPersonNotFoundError) && count < 3,
  })
  const notFound = error instanceof JourneyPersonNotFoundError

  const { data: detail } = useQuery({
    queryKey: ["journey-person-detail", uuid],
    queryFn: () => fetchJourneyPersonDetail(uuid!),
    enabled: !!uuid,
  })

  const { data: cameraData } = useQuery({
    queryKey: ["journey-camera-captures", uuid],
    queryFn: () => fetchJourneyCameraCaptures(uuid!, { refresh: refreshOnce(`captures:${uuid}`), hours: 0 }),
    enabled: !!uuid,
  })

  const renameMutation = useMutation({
    mutationFn: (name: string) => renameJourneyPerson(uuid!, name),
    onSuccess: () => {
      setEditingName(false)
      setNameError("")
      queryClient.invalidateQueries({ queryKey: ["journey-timeline", uuid] })
      queryClient.invalidateQueries({ queryKey: ["journey-person-detail", uuid] })
      queryClient.invalidateQueries({ queryKey: ["journey-persons"] })
      queryClient.invalidateQueries({ queryKey: ["journey-live"] })
    },
    onError: (err: Error) => {
      setNameError(err.message || "Could not save name")
    },
  })

  const events = data?.events ?? []
  const person = data?.person
  const cameraCaptures = cameraData?.results ?? []
  const tracklets = detail?.tracks ?? []
  const personId = person ? journeyPersonId(person) : ""

  const startRename = () => {
    if (!person) return
    const current =
      person.display_name && !person.display_name.startsWith("Unknown")
        ? person.display_name
        : ""
    setNameDraft(current)
    setNameError("")
    setEditingName(true)
  }

  const saveRename = () => {
    const trimmed = nameDraft.trim()
    if (!trimmed) {
      setNameError("Please enter a name")
      return
    }
    renameMutation.mutate(trimmed)
  }

  const journeyStops = useMemo(
    () => buildJourneyStops(events, cameraCaptures, tracklets),
    [events, cameraCaptures, tracklets]
  )

  const groupedByDate = useMemo(() => {
    const map = new Map<string, JourneyEventRecord[]>()
    for (const ev of events) {
      const day = ev.created_at.slice(0, 10)
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(ev)
    }
    return Array.from(map.entries())
  }, [events])

  if (isLoading) {
    return (
      <ModulePageLayout title="Person Journey" description="Loading this person's path…">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </ModulePageLayout>
    )
  }

  if (!person) {
    return (
      <ModulePageLayout
        title="Person Journey"
        description={notFound ? "Person not found" : "Couldn't load this journey — the server may be busy. Retrying…"}
      >
        <Button asChild variant="outline">
          <Link to={ROUTES.PERSON_JOURNEY}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
      </ModulePageLayout>
    )
  }

  const displayName =
    person.display_name && person.display_name !== personId
      ? person.display_name
      : personTypePlain(person.person_type)

  return (
    <ModulePageLayout
      title={displayName}
      description="Follow where this person was seen — camera by camera, in order."
      breadcrumbs={[
        { label: "AI Analytics" },
        { label: "Person Journey", href: ROUTES.PERSON_JOURNEY },
        { label: displayName },
      ]}
    >
      <div className="space-y-6">
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.PERSON_JOURNEY}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            All people
          </Link>
        </Button>

        {/* Who is this? */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-5">
              <JourneySnapshot
                url={person.latest_snapshot_url || cameraCaptures[0]?.snapshot_url}
                alt={displayName}
                className="h-44 w-full sm:w-56 rounded-xl border object-cover bg-muted shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      This person
                    </p>
                    {editingName ? (
                      <div className="space-y-2 max-w-md">
                        <Label htmlFor="person-name">Give this person a name</Label>
                        <div className="flex flex-wrap gap-2">
                          <Input
                            id="person-name"
                            value={nameDraft}
                            onChange={(e) => setNameDraft(e.target.value)}
                            placeholder="e.g. Ahmed, Visitor from Gate 2"
                            maxLength={200}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveRename()
                              if (e.key === "Escape") {
                                setEditingName(false)
                                setNameError("")
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={saveRename}
                            disabled={renameMutation.isPending}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingName(false)
                              setNameError("")
                            }}
                            disabled={renameMutation.isPending}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                        {nameError ? <p className="text-xs text-destructive">{nameError}</p> : null}
                      </div>
                    ) : (
                      <>
                        <h2 className="text-xl font-semibold flex items-center gap-2 flex-wrap">
                          <User className="h-5 w-5 shrink-0" />
                          <span>{displayName}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={startRename}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                            {person.name_locked ||
                            (person.display_name && !person.display_name.startsWith("Unknown"))
                              ? "Edit name"
                              : "Give a name"}
                          </Button>
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          {personTypePlain(person.person_type)}
                          <span className="mx-1.5 text-border">·</span>
                          Ref {personId}
                        </p>
                      </>
                    )}
                  </div>
                  <Badge variant={person.status === "active" ? "default" : "outline"}>
                    {statusPlain(person.status)}
                  </Badge>
                </div>

                <div className="grid sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Last seen on</p>
                    <p className="font-medium">{person.latest_camera_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Place</p>
                    <p className="font-medium">{person.latest_zone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Time</p>
                    <p className="font-medium">
                      {person.latest_seen_at ? formatDateTime(person.latest_seen_at) : "—"}
                    </p>
                  </div>
                </div>

                {journeyStops.length > 1 ? (
                  <p className="text-sm text-muted-foreground flex items-start gap-2">
                    <Route className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      Path:{" "}
                      <span className="text-foreground font-medium">
                        {journeyStops.map((s) => s.cameraName).join(" → ")}
                      </span>
                    </span>
                  </p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visual path — primary understanding */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Route className="h-5 w-5" />
              Where they went
            </CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Read left to right. Each step is a camera that saw this person.
            </p>
          </CardHeader>
          <CardContent>
            <JourneyPath stops={journeyStops} />
          </CardContent>
        </Card>

        {/* Photo gallery by camera */}
        {cameraCaptures.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="h-5 w-5" />
                Photos from cameras
              </CardTitle>
              <p className="text-sm text-muted-foreground font-normal">
                Latest clear photo from each camera that saw this person.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {cameraCaptures.map((capture) => (
                  <div key={capture.camera_id} className="rounded-xl border overflow-hidden bg-card">
                    <JourneySnapshot
                      url={capture.snapshot_url}
                      alt={capture.camera_name || "Camera capture"}
                      className="h-40 w-full rounded-none border-0 object-cover bg-muted"
                    />
                    <div className="p-3 space-y-1">
                      <p className="font-medium text-sm truncate">{capture.camera_name || "Camera"}</p>
                      {capture.zone ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {capture.zone}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        {formatDateTime(capture.captured_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Full timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5" />
              Full story (timeline)
            </CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Every time this person was noticed, in order.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div>
                <Label htmlFor="from">From date</Label>
                <Input id="from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="to">To date</Label>
                <Input id="to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>

            {groupedByDate.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing recorded in this date range.</p>
            ) : (
              groupedByDate.map(([day, dayEvents]) => (
                <div key={day} className="mb-8 last:mb-0">
                  <p className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                    <ChevronRight className="h-4 w-4" />
                    {dayLabel(dayEvents[0]?.created_at || day)}
                  </p>
                  {dayEvents.map((ev, idx) => (
                    <TimelineItem key={ev.id} event={ev} stepLabel={`#${idx + 1}`} />
                  ))}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
