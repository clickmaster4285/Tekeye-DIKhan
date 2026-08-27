import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  AlertTriangle,
  Compass,
  Expand,
  Layers,
  MapPin,
  Radio,
  RefreshCw,
  Route,
  Search,
  Shrink,
} from "lucide-react"
import { GpsMiniMap } from "@/components/gps/gps-mini-map"
import { OfficerGpsMap } from "@/components/gps/officer-gps-map"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { geofencesForStation, officerInsideGeofence, STATION_GEOFENCES, stationCenter } from "@/lib/gps-geofences"
import {
  fetchGpsHistory,
  fetchGpsLive,
  fetchGpsMe,
  type GpsStatus,
} from "@/lib/gps-tracking-api"
import {
  accuracyGrade,
  buildRouteEvents,
  deriveGpsAlerts,
  formatClock,
  gpsSignalPct,
  hoursSinceLocalMidnight,
  initials,
  STATUS_COLOR,
  timeAgo,
  trailDistanceKm,
} from "@/lib/gps-utils"
import { useOfficerGpsTrackingStatus } from "@/lib/officer-gps-session"
import { getStoredUser } from "@/lib/auth"
import { canSeeAllLocations } from "@/lib/location-access"
import { LOCATION_OPTIONS, locationLabel } from "@/lib/locations"
import { ROUTES } from "@/routes/config"
import { cn } from "@/lib/utils"

const LIVE_POLL_MS = 8_000

function AccuracyGauge({ accuracy }: { accuracy: number | null | undefined }) {
  const grade = accuracyGrade(accuracy)
  const pct = accuracy == null ? 0 : Math.max(8, Math.min(100, Math.round(100 - accuracy * 1.5)))
  const r = 44
  const c = 2 * Math.PI * r
  const dash = (pct / 100) * c
  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-[120px] w-[120px]">
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={grade.color}
        strokeWidth="10"
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="56" textAnchor="middle" fill="currentColor" fontSize="16" fontWeight="700">
        {accuracy != null ? `${accuracy.toFixed(1)} m` : "—"}
      </text>
      <text x="60" y="74" textAnchor="middle" fill={grade.color} fontSize="11" fontWeight="700">
        {grade.label}
      </text>
    </svg>
  )
}

export default function GpsTrackingPage() {
  const user = getStoredUser()
  const gpsSession = useOfficerGpsTrackingStatus()
  const allStations = canSeeAllLocations(user?.role)
  const [station, setStation] = useState(allStations ? "all" : user?.location || "all")
  const [dateRange, setDateRange] = useState<"today" | "24h" | "48h">("today")
  const [search, setSearch] = useState("")
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [showGeofences, setShowGeofences] = useState(true)
  const [mapFullscreen, setMapFullscreen] = useState(false)
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number } | null>(null)
  const [fitTrailToken, setFitTrailToken] = useState(0)
  const alertsRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<HTMLElement | null>(null)
  const officersRef = useRef<HTMLElement | null>(null)
  const detailsRef = useRef<HTMLElement | null>(null)

  const historyHours = dateRange === "today" ? hoursSinceLocalMidnight() : dateRange === "24h" ? 24 : 48

  const meQuery = useQuery({
    queryKey: ["gps-me"],
    queryFn: fetchGpsMe,
    refetchInterval: LIVE_POLL_MS,
  })
  const liveQuery = useQuery({
    queryKey: ["gps-live", station],
    queryFn: () => fetchGpsLive(station),
    refetchInterval: LIVE_POLL_MS,
  })
  const historyQuery = useQuery({
    queryKey: ["gps-history", selectedUserId, historyHours],
    queryFn: () => fetchGpsHistory(selectedUserId!, historyHours),
    enabled: selectedUserId != null,
  })

  const onDuty = Boolean(meQuery.data?.onDuty)
  const officers = liveQuery.data ?? []
  const fences = useMemo(() => {
    if (station !== "all") return geofencesForStation(station)
    const locs = new Set(officers.map((o) => o.location).filter(Boolean))
    if (locs.size === 0) return geofencesForStation("DI_KHAN")
    return STATION_GEOFENCES.filter((g) => locs.has(g.location))
  }, [station, officers])

  useEffect(() => {
    if (selectedUserId != null) return
    const first = officers.find((o) => o.status === "live") ?? officers[0]
    if (first) setSelectedUserId(first.userId)
  }, [officers, selectedUserId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = [...officers].sort((a, b) => {
      const rank = (s: GpsStatus) => (s === "live" ? 0 : s === "stale" ? 1 : 2)
      return rank(a.status) - rank(b.status) || a.name.localeCompare(b.name)
    })
    if (!q) return list
    return list.filter((o) =>
      [o.name, o.username, o.role, o.location, o.employeeId].join(" ").toLowerCase().includes(q)
    )
  }, [officers, search])

  const selected = officers.find((o) => o.userId === selectedUserId) ?? null
  const trail = historyQuery.data ?? []
  const alerts = useMemo(() => deriveGpsAlerts(officers, fences), [officers, fences])
  const todayKm = trailDistanceKm(trail)
  const routeEvents = buildRouteEvents(selected, trail)
  const mapCenter = stationCenter(station)

  const scrollToMap = () => {
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const mapBlock = (
    <div
      className={cn(
        "relative overflow-hidden bg-muted",
        mapFullscreen
          ? "h-full min-h-0"
          : "h-[min(58dvh,420px)] min-h-[240px] sm:h-[380px] md:h-[440px] xl:h-[520px]"
      )}
    >
      <OfficerGpsMap
        officers={officers}
        selectedUserId={selectedUserId}
        trail={trail}
        geofences={fences}
        showGeofences={showGeofences}
        focus={focus}
        fitTrailToken={fitTrailToken}
        defaultCenter={mapCenter}
        onSelect={setSelectedUserId}
      />
      <div className="absolute left-3 top-14 z-[400] flex flex-col gap-1">
        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          className="h-8 w-8 border bg-white shadow-sm"
          onClick={() => setShowGeofences((v) => !v)}
          title="Toggle geofences"
        >
          <Layers className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          className="h-8 w-8 border bg-white shadow-sm"
          onClick={() => setMapFullscreen((v) => !v)}
          title={mapFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {mapFullscreen ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="-mx-3 flex min-w-0 max-w-full flex-col gap-3 overflow-x-hidden sm:-mx-6 lg:-mx-8">
      <div className="relative z-40 flex flex-col gap-3 border-b bg-white px-3 py-3 sm:px-6 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">AI Monitoring</p>
          <h1 className="text-lg font-semibold text-foreground sm:text-xl">GPS Live Monitoring</h1>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Select value={station} onValueChange={setStation} disabled={!allStations && Boolean(user?.location)}>
            <SelectTrigger className="h-9 w-full bg-white sm:w-[180px]">
              <SelectValue placeholder="Station" />
            </SelectTrigger>
            <SelectContent className="z-[2000]">
              {allStations ? <SelectItem value="all">All stations</SelectItem> : null}
              {LOCATION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)}>
            <SelectTrigger className="h-9 w-full bg-white sm:w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[2000]">
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="48h">Last 48h</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => {
              meQuery.refetch()
              liveQuery.refetch()
              historyQuery.refetch()
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Badge
            variant="outline"
            className={cn(
              "h-9 max-w-full justify-center gap-1.5 px-3 text-sm font-medium sm:justify-start",
              gpsSession.error
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : onDuty || gpsSession.running
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "text-muted-foreground"
            )}
          >
            <Radio className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {gpsSession.error
                ? "GPS unavailable"
                : onDuty || gpsSession.running
                  ? "Location sharing"
                  : "Starting GPS…"}
            </span>
          </Badge>
        </div>
      </div>

      {gpsSession.error ? (
        <p className="px-3 text-sm leading-snug text-destructive sm:px-6">{gpsSession.error}</p>
      ) : null}

      <div className="sticky top-16 z-30 grid grid-cols-3 gap-1 bg-[#f8fafc]/95 px-3 py-1.5 backdrop-blur md:hidden">
        <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={scrollToMap}>
          Map
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => officersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          Officers
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          Details
        </Button>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 px-3 md:grid-cols-2 xl:grid-cols-[minmax(200px,280px)_minmax(0,1fr)_minmax(220px,300px)] lg:px-6">
        <section
          ref={officersRef}
          className="order-2 flex max-h-[240px] min-w-0 flex-col overflow-hidden scroll-mt-28 rounded-xl border bg-white md:max-h-[min(440px,52vh)] xl:order-1 xl:max-h-none xl:min-h-[520px]"
        >
          <div className="border-b px-3 py-3">
            <h2 className="text-sm font-semibold tracking-wide text-foreground">
              Officers ({filtered.length})
            </h2>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search officers"
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {liveQuery.isLoading ? (
              <li className="px-3 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                No GPS pings yet. Officers appear here automatically after they sign in.
              </li>
            ) : (
              filtered.map((officer) => {
                const active = officer.userId === selectedUserId
                return (
                  <li key={officer.userId}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserId(officer.userId)
                        if (window.matchMedia("(max-width: 767px)").matches) {
                          detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                        }
                      }}
                      className={cn(
                        "flex w-full items-start gap-2 border-b px-3 py-2.5 text-left text-sm transition-colors",
                        active ? "bg-[#EBF2FF]" : "hover:bg-muted/60"
                      )}
                    >
                      <span
                        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: STATUS_COLOR[officer.status] }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{officer.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {locationLabel(officer.location)}
                          {officer.accuracy != null ? ` · ${Math.round(officer.accuracy)} m` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">{timeAgo(officer.recordedAt)}</span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </section>

        <section
          ref={mapRef}
          className={cn(
            "order-1 relative z-0 isolate min-w-0 scroll-mt-28 overflow-hidden rounded-xl border bg-white md:col-span-2 xl:col-span-1 xl:order-2",
            mapFullscreen && "fixed inset-0 z-[90] rounded-none"
          )}
        >
          {mapBlock}
        </section>

        <section
          ref={detailsRef}
          className="order-3 flex min-w-0 flex-col overflow-hidden scroll-mt-28 rounded-xl border bg-white md:max-h-[min(440px,52vh)] xl:max-h-none xl:min-h-[520px]"
        >
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold tracking-wide">Officer details</h2>
          </div>
          {selected ? (
            <div className="flex flex-1 flex-col overflow-y-auto p-4">
              <div className="flex items-start gap-3">
                <Avatar className="size-14 border">
                  <AvatarFallback className="bg-[#EBF2FF] text-sm font-semibold text-[#155DFC]">
                    {initials(selected.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{selected.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.employeeId || `CM-${String(selected.userId).padStart(4, "0")}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{locationLabel(selected.location)}</p>
                </div>
              </div>
              <Badge
                className={cn(
                  "mt-3 w-fit",
                  selected.onDuty && selected.status === "live"
                    ? "bg-emerald-600 text-white hover:bg-emerald-600"
                    : selected.onDuty
                      ? "bg-amber-500 text-white hover:bg-amber-500"
                      : "bg-slate-400 text-white hover:bg-slate-400"
                )}
              >
                {selected.onDuty ? "On duty" : "Off duty"}
              </Badge>

              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Current location
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Latitude</dt>
                    <dd className="font-medium">{selected.latitude?.toFixed(5) ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Longitude</dt>
                    <dd className="font-medium">{selected.longitude?.toFixed(5) ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Accuracy</dt>
                    <dd className="font-medium">
                      {selected.accuracy != null ? `${Math.round(selected.accuracy)} m` : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Speed</dt>
                    <dd className="font-medium">
                      {selected.speedKmh != null ? `${selected.speedKmh.toFixed(0)} km/h` : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Heading</dt>
                    <dd className="font-medium">
                      {selected.headingDeg != null ? `${Math.round(selected.headingDeg)}°` : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Last update</dt>
                    <dd className="font-medium">{timeAgo(selected.recordedAt)}</dd>
                  </div>
                </dl>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-[#F8FAFC] p-3 text-center">
                <div>
                  <p className="text-sm font-semibold">{todayKm.toFixed(1)} km</p>
                  <p className="text-[10px] text-muted-foreground">Distance</p>
                </div>
                <div>
                  <p className="text-sm font-semibold">{trail.length}</p>
                  <p className="text-[10px] text-muted-foreground">GPS points</p>
                </div>
                <div>
                  <p className="text-sm font-semibold">{formatClock(selected.dutyStartedAt)}</p>
                  <p className="text-[10px] text-muted-foreground">Duty started</p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <Button
                  className="w-full"
                  onClick={() => {
                    setFitTrailToken((n) => n + 1)
                    if (selected.latitude && selected.longitude) {
                      setFocus({ lat: selected.latitude, lng: selected.longitude, zoom: 15 })
                    }
                    scrollToMap()
                  }}
                >
                  <Route className="h-4 w-4" />
                  View route
                </Button>
                <Button asChild variant="secondary" className="w-full">
                  <Link to={ROUTES.PERSON_JOURNEY}>
                    <Compass className="h-4 w-4" />
                    Person journey
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => alertsRef.current?.scrollIntoView({ behavior: "smooth" })}
                >
                  <AlertTriangle className="h-4 w-4" />
                  View events
                </Button>
              </div>
            </div>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">Select an officer to see details.</p>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-3 px-3 pb-2 sm:grid-cols-2 xl:grid-cols-4 lg:px-6">
        <section className="rounded-xl border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Route history</h3>
            <span className="text-xs text-muted-foreground">{selected?.name ?? "—"}</span>
          </div>
          <GpsMiniMap points={trail} />
          <ol className="mt-3 space-y-2 text-sm">
            {routeEvents.length === 0 ? (
              <li className="text-muted-foreground">No route yet for this period.</li>
            ) : (
              routeEvents.map((ev) => (
                <li key={`${ev.time}-${ev.label}`} className="flex gap-2">
                  <span className="w-16 shrink-0 font-medium text-[#155DFC]">{ev.time}</span>
                  <span>{ev.label}</span>
                </li>
              ))
            )}
          </ol>
          <div className="mt-3 flex justify-between text-xs text-muted-foreground">
            <span>Distance {todayKm.toFixed(1)} km</span>
            <span>GPS points {trail.length}</span>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-4">
          <h3 className="mb-1 text-sm font-semibold">GPS accuracy</h3>
          <AccuracyGauge accuracy={selected?.accuracy} />
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">GPS signal</dt>
              <dd className="flex flex-1 items-center justify-end gap-2">
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-[#155DFC]"
                    style={{ width: `${gpsSignalPct(selected?.accuracy)}%` }}
                  />
                </span>
                <span className="w-8 text-right text-xs">{gpsSignalPct(selected?.accuracy)}%</span>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Speed</dt>
              <dd>{selected?.speedKmh != null ? `${selected.speedKmh.toFixed(0)} km/h` : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Heading</dt>
              <dd>{selected?.headingDeg != null ? `${Math.round(selected.headingDeg)}°` : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Altitude</dt>
              <dd>{selected?.altitudeM != null ? `${Math.round(selected.altitudeM)} m` : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Last update</dt>
              <dd>{timeAgo(selected?.recordedAt)}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold">Geofences</h3>
          <ul className="space-y-3">
            {fences.length === 0 ? (
              <li className="text-sm text-muted-foreground">No geofences for this station.</li>
            ) : (
              fences.map((fence) => {
                const inside = officers.filter((o) => officerInsideGeofence(o, fence)).length
                const outside = Math.max(0, officers.length - inside)
                return (
                  <li key={fence.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{fence.name}</p>
                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Active</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Radius {fence.radiusM} m</p>
                    <p className="mt-1 text-xs">
                      <span className="font-medium text-emerald-700">{inside} inside</span>
                      <span className="text-muted-foreground"> · {outside} outside</span>
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setFocus({ lat: fence.latitude, lng: fence.longitude, zoom: 15 })
                        scrollToMap()
                      }}
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      View on map
                    </Button>
                  </li>
                )
              })
            )}
          </ul>
        </section>

        <section ref={alertsRef} className="rounded-xl border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Alerts</h3>
            {alerts.length > 0 ? (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                {alerts.length}
              </span>
            ) : null}
          </div>
          <ul className="space-y-2">
            {alerts.length === 0 ? (
              <li className="text-sm text-muted-foreground">No GPS alerts right now.</li>
            ) : (
              alerts.map((alert) => (
                <li key={alert.id} className="flex gap-2 rounded-lg border p-2.5 text-sm">
                  <AlertTriangle
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      alert.severity === "critical" ? "text-red-600" : "text-amber-500"
                    )}
                  />
                  <div>
                    <p className="font-medium leading-snug">{alert.title}</p>
                    <p className="text-xs text-muted-foreground">{alert.detail}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(alert.at)}</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  )
}
