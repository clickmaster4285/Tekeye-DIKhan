import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ChevronLeft,
  Camera,
  MapPin,
  Clock,
  Shield,
  LogIn,
  AlertTriangle,
  User,
  Route,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ROUTES } from "@/routes/config"
import {
  fetchJourneyTimeline,
  fetchJourneyCameraCaptures,
  journeyEventIconType,
  journeyPersonTypeLabel,
  type JourneyCameraCapture,
  type JourneyEventRecord,
} from "@/lib/person-journey-api"
import {
  JourneySnapshot,
  eventSnapshotUrl,
} from "@/components/person-journey/journey-snapshot"

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

function EventIcon({ type }: { type: ReturnType<typeof journeyEventIconType> }) {
  const cls = "h-4 w-4"
  if (type === "attendance") return <LogIn className={cls} />
  if (type === "zone") return <MapPin className={cls} />
  if (type === "alert") return <AlertTriangle className={cls} />
  if (type === "user") return <User className={cls} />
  return <Camera className={cls} />
}

function CameraCaptureCard({ capture }: { capture: JourneyCameraCapture }) {
  return (
    <div className="rounded-lg border overflow-hidden bg-card">
      <JourneySnapshot
        url={capture.snapshot_url}
        alt={capture.camera_name || "Camera capture"}
        className="h-36 w-full object-cover bg-muted"
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
  )
}

function TimelineItem({ event }: { event: JourneyEventRecord }) {
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
          <p className="font-medium text-sm">{event.title || event.event_type}</p>
          {isWeapon ? (
            <Badge variant="destructive" className="text-[10px]">
              Security
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
          {event.zone ? (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {event.zone}
            </span>
          ) : null}
          {event.match_score != null ? (
            <span>Match {(event.match_score * 100).toFixed(0)}%</span>
          ) : null}
        </div>
          </div>
          {isCameraEvent ? (
            <JourneySnapshot
              url={snapshot}
              alt={`${event.camera_name || "Camera"} capture`}
              className="h-24 w-40 rounded border object-cover bg-muted shrink-0"
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function PersonJourneyDetailPage() {
  const { uuid } = useParams<{ uuid: string }>()
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const { data, isLoading, isError } = useQuery({
    queryKey: ["journey-timeline", uuid, dateFrom, dateTo],
    queryFn: () => fetchJourneyTimeline(uuid!, dateFrom || undefined, dateTo || undefined),
    enabled: !!uuid,
    refetchInterval: 15000,
  })

  const { data: cameraData } = useQuery({
    queryKey: ["journey-camera-captures", uuid],
    queryFn: () => fetchJourneyCameraCaptures(uuid!, { refresh: true, hours: 48 }),
    enabled: !!uuid,
    refetchInterval: 20000,
  })

  const events = data?.events ?? []
  const person = data?.person
  const cameraCaptures = cameraData?.results ?? []

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
      <ModulePageLayout title="Person Journey" description="Loading timeline...">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </ModulePageLayout>
    )
  }

  if (isError || !person) {
    return (
      <ModulePageLayout title="Person Journey" description="Person not found">
        <Button asChild variant="outline">
          <Link to={ROUTES.PERSON_JOURNEY}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
      </ModulePageLayout>
    )
  }

  return (
    <ModulePageLayout
      title={person.display_name || person.code}
      description={`Person UUID journey — ${person.code}`}
      breadcrumbs={[
        { label: "AI Analytics" },
        { label: "Person Journey", href: ROUTES.PERSON_JOURNEY },
        { label: person.code },
      ]}
    >
      <div className="space-y-6">
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.PERSON_JOURNEY}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            All Journeys
          </Link>
        </Button>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-start gap-4 justify-between">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Route className="h-5 w-5" />
                  {person.display_name || "Unidentified"}
                </h2>
                <p className="text-sm text-muted-foreground font-mono mt-1">{person.code}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>{journeyPersonTypeLabel(person.person_type)}</Badge>
                <Badge variant="outline">{person.status}</Badge>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 mt-6 text-sm">
              <div>
                <p className="text-muted-foreground">Last Camera</p>
                <p className="font-medium">{person.latest_camera_name || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Zone</p>
                <p className="font-medium">{person.latest_zone || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Seen</p>
                <p className="font-medium">
                  {person.latest_seen_at ? formatDateTime(person.latest_seen_at) : "—"}
                </p>
              </div>
            </div>
            {person.latest_snapshot_url ? (
              <div className="mt-6">
                <p className="text-sm text-muted-foreground mb-2">Latest capture</p>
                <JourneySnapshot
                  url={person.latest_snapshot_url}
                  alt={person.display_name || person.code}
                  className="h-48 w-full max-w-md rounded-lg border object-cover bg-muted"
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        {cameraCaptures.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Camera Captures
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {cameraCaptures.map((capture) => (
                  <CameraCaptureCard key={capture.camera_id} capture={capture} />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Journey Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div>
                <Label htmlFor="from">From</Label>
                <Input id="from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="to">To</Label>
                <Input id="to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>

            {groupedByDate.length === 0 ? (
              <p className="text-sm text-muted-foreground">No journey events in this range.</p>
            ) : (
              groupedByDate.map(([day, dayEvents]) => (
                <div key={day} className="mb-8 last:mb-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                    {day}
                  </p>
                  {dayEvents.map((ev) => (
                    <TimelineItem key={ev.id} event={ev} />
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
