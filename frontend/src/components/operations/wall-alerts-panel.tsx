"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Link } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  Camera,
  Crosshair,
  Grid2x2,
  MapPin,
  Radio,
  ScanEye,
  Search,
  Siren,
} from "lucide-react"
import {
  fetchCameras,
  fetchDetectionEventsPage,
  fetchSites,
  type DetectionEvent,
} from "@/lib/cameras-api"
import { detectionIconTone, iconForDetectionClass } from "@/lib/detection-icons"
import { REALTIME_INVALIDATE_EVENT } from "@/lib/realtime-socket"
import { ROUTES } from "@/routes/config"
import { cn } from "@/lib/utils"

function isCritical(className: string): boolean {
  const cls = (className || "").toLowerCase()
  return (
    cls.includes("weapon") ||
    cls === "gun" ||
    cls === "fire" ||
    cls.includes("flame") ||
    cls === "crowd"
  )
}

function titleFor(className: string): string {
  const pretty = (className || "").trim().replace(/[_-]+/g, " ")
  if (!pretty) return "Detection"
  return pretty.replace(/\b\w/g, (c) => c.toUpperCase())
}

function locationLabel(ev: DetectionEvent): string {
  return (ev.site_name || "").trim() || (ev.site_code || "").trim() || ""
}

function cameraLabel(ev: DetectionEvent): string {
  return (
    (ev.camera_name || "").trim() ||
    (ev.name || "").trim() ||
    (ev.camera_code || "").trim() ||
    "Camera"
  )
}

function formatTime(iso?: string): string {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function confidencePct(value?: number): string | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null
  return `${Math.round(value * 100)}%`
}

const filterSelectClass =
  "h-7 w-full appearance-none rounded border border-white/10 bg-zinc-900/80 px-2 text-[10px] font-medium text-white/85 outline-none transition hover:border-white/20 focus:border-sky-500/40"

/** Fullscreen red flash on new wall alerts — auto-hides after ~1.5s. */
const ALERT_FLASH_MS = 1600

export function WallAlertPopupHost() {
  const [queue, setQueue] = useState<DetectionEvent[]>([])
  const baselineReady = useRef(false)
  const seenIds = useRef(new Set<number>())
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ["wall-alert-popup-feed"],
    queryFn: () => fetchDetectionEventsPage({ is_alert: true, page: 1, page_size: 15 }),
    refetchInterval: 8_000,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    const onRealtime = (e: Event) => {
      const domains = (e as CustomEvent<{ domains?: string[] }>).detail?.domains || []
      if (domains.some((d) => ["alerts", "detections", "cameras"].includes(d))) {
        void queryClient.invalidateQueries({ queryKey: ["wall-alert-popup-feed"] })
      }
    }
    window.addEventListener(REALTIME_INVALIDATE_EVENT, onRealtime)
    return () => window.removeEventListener(REALTIME_INVALIDATE_EVENT, onRealtime)
  }, [queryClient])

  useEffect(() => {
    const rows = data?.results || []
    if (rows.length === 0) return

    if (!baselineReady.current) {
      for (const row of rows) seenIds.current.add(row.id)
      baselineReady.current = true
      return
    }

    const fresh = rows
      .filter((row) => row.is_alert && !seenIds.current.has(row.id))
      .sort((a, b) => a.id - b.id)

    if (fresh.length === 0) return
    for (const row of fresh) seenIds.current.add(row.id)
    setQueue((prev) => {
      const known = new Set(prev.map((p) => p.id))
      const add = fresh.filter((f) => !known.has(f.id))
      return add.length ? [...prev, ...add] : prev
    })
  }, [data])

  const current = queue[0]

  useEffect(() => {
    if (!current) return
    const id = window.setTimeout(() => {
      setQueue((q) => q.slice(1))
    }, ALERT_FLASH_MS)
    return () => window.clearTimeout(id)
  }, [current?.id])

  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setQueue((q) => q.slice(1))
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [current?.id])

  if (!current || typeof document === "undefined") return null

  const AlertIcon = iconForDetectionClass(String(current.class_name || ""))
  const cam = cameraLabel(current)
  const loc = locationLabel(current)
  const zn = (current.zone || "").trim()
  const conf = confidencePct(current.confidence)

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[300] flex animate-in fade-in duration-150 items-center justify-center"
      role="alert"
      aria-live="assertive"
      aria-label="Security alert"
    >
      <div className="absolute inset-0 bg-red-700/80" />
      <div className="absolute inset-0 animate-pulse bg-red-500/40" />
      <div className="absolute inset-0 ring-[14px] ring-inset ring-red-300/60" />

      <div className="relative z-[1] mx-4 max-w-2xl text-center text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.6)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/45">
          <AlertIcon className="h-8 w-8" />
        </div>
        <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/90">
          <Siren className="h-4 w-4 animate-pulse" />
          Security alert
        </p>
        <p className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
          {titleFor(String(current.class_name || ""))}
        </p>
        <p className="mt-3 text-base font-medium text-white/95 sm:text-lg">
          {[cam, zn || null, loc || null].filter(Boolean).join(" · ")}
        </p>
        {conf ? (
          <p className="mt-2 text-sm tabular-nums text-white/75">Confidence {conf}</p>
        ) : null}
        {queue.length > 1 ? (
          <p className="mt-4 text-xs text-white/60">+{queue.length - 1} more</p>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

/** Professional live-detections feed for the custom wall. */
export function WallAlertsPanel({ className }: { className?: string }) {
  const queryClient = useQueryClient()
  const [site, setSite] = useState("all")
  const [zone, setZone] = useState("all")
  const [camera, setCamera] = useState("all")
  const [q, setQ] = useState("")
  const [qDebounced, setQDebounced] = useState("")

  useEffect(() => {
    const id = window.setTimeout(() => setQDebounced(q), 250)
    return () => window.clearTimeout(id)
  }, [q])

  const { data: sites = [] } = useQuery({
    queryKey: ["wall-detection-sites"],
    queryFn: fetchSites,
    staleTime: 60_000,
  })

  const { data: cameras = [] } = useQuery({
    queryKey: ["wall-detection-cameras"],
    queryFn: () => fetchCameras(),
    staleTime: 60_000,
  })

  const siteCameras = useMemo(() => {
    if (site === "all") return cameras
    return cameras.filter(
      (c) => c.site_code === site || c.location === site || c.site_name === site,
    )
  }, [cameras, site])

  const zones = useMemo(() => {
    const set = new Set<string>()
    for (const c of siteCameras) {
      const z = (c.zone || "").trim()
      if (z) set.add(z)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [siteCameras])

  const queryParams = useMemo(
    () => ({
      page: 1,
      page_size: 50,
      ...(site !== "all" ? { site } : {}),
      ...(zone !== "all" ? { zone } : {}),
      ...(camera !== "all" ? { camera: Number(camera) } : {}),
      ...(qDebounced.trim() ? { q: qDebounced.trim() } : {}),
    }),
    [site, zone, camera, qDebounced],
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["wall-live-detections", queryParams],
    queryFn: () => fetchDetectionEventsPage(queryParams),
    refetchInterval: 12_000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  })

  useEffect(() => {
    const onRealtime = (e: Event) => {
      const domains = (e as CustomEvent<{ domains?: string[] }>).detail?.domains || []
      if (domains.some((d) => ["alerts", "detections", "cameras"].includes(d))) {
        void queryClient.invalidateQueries({ queryKey: ["wall-live-detections"] })
      }
    }
    window.addEventListener(REALTIME_INVALIDATE_EVENT, onRealtime)
    return () => window.removeEventListener(REALTIME_INVALIDATE_EVENT, onRealtime)
  }, [queryClient])

  const events = data?.results || []
  const alertCount = useMemo(
    () => events.filter((e) => e.is_alert || isCritical(String(e.class_name || ""))).length,
    [events],
  )
  const filtersActive = site !== "all" || zone !== "all" || camera !== "all" || qDebounced.trim() !== ""

  const clearFilters = () => {
    setSite("all")
    setZone("all")
    setCamera("all")
    setQ("")
    setQDebounced("")
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-[#0a0a0b]", className)}>
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.07] px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <ScanEye className="h-3.5 w-3.5 text-sky-400" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90">
                Live detections
              </p>
            </div>
            <p className="mt-0.5 text-[10px] text-white/40">
              {isLoading && events.length === 0
                ? "Connecting to detection feed…"
                : `${data?.count ?? events.length} events · real-time feed`}
              {isFetching && events.length > 0 ? " · refreshing" : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {alertCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-red-300">
                <AlertTriangle className="h-2.5 w-2.5" />
                {alertCount}
              </span>
            ) : null}
            <Link
              to={ROUTES.OBJECT_DETECTION}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-sky-400/90 hover:bg-white/5 hover:text-sky-300"
            >
              Open
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="shrink-0 space-y-1.5 border-b border-white/[0.07] px-2.5 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by class or label"
            aria-label="Filter detections"
            className="h-8 w-full rounded-md border border-white/15 bg-zinc-900 pl-8 pr-2 text-[11px] text-zinc-100 outline-none placeholder:text-zinc-500 hover:border-white/25 focus:border-sky-500/50 focus:bg-zinc-900 focus:ring-1 focus:ring-sky-500/30"
          />
        </div>
        <div className="grid grid-cols-3 gap-1">
          <label className="min-w-0">
            <span className="mb-0.5 flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-white/35">
              <MapPin className="h-2.5 w-2.5" />
              Location
            </span>
            <select
              value={site}
              onChange={(e) => {
                setSite(e.target.value)
                setZone("all")
                setCamera("all")
              }}
              className={filterSelectClass}
              aria-label="Filter by location"
            >
              <option value="all" className="bg-zinc-900">
                All
              </option>
              {sites.map((s) => (
                <option key={s.id} value={s.code} className="bg-zinc-900">
                  {s.name || s.code}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0">
            <span className="mb-0.5 flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-white/35">
              <Grid2x2 className="h-2.5 w-2.5" />
              Zone
            </span>
            <select
              value={zone}
              onChange={(e) => {
                setZone(e.target.value)
                setCamera("all")
              }}
              className={filterSelectClass}
              aria-label="Filter by zone"
            >
              <option value="all" className="bg-zinc-900">
                All
              </option>
              {zones.map((z) => (
                <option key={z} value={z} className="bg-zinc-900">
                  {z}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0">
            <span className="mb-0.5 flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-white/35">
              <Camera className="h-2.5 w-2.5" />
              Camera
            </span>
            <select
              value={camera}
              onChange={(e) => setCamera(e.target.value)}
              className={filterSelectClass}
              aria-label="Filter by camera"
            >
              <option value="all" className="bg-zinc-900">
                All
              </option>
              {siteCameras
                .filter((c) => zone === "all" || (c.zone || "").trim() === zone)
                .map((c) => (
                  <option key={c.id} value={String(c.id)} className="bg-zinc-900">
                    {c.name || c.code}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {filtersActive ? (
          <button
            type="button"
            onClick={clearFilters}
            className="text-[10px] font-medium text-white/40 hover:text-white/70"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {/* Feed */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <Radio className="h-5 w-5 animate-pulse text-white/25" />
            <p className="text-xs text-white/40">Loading detection feed…</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <Crosshair className="h-5 w-5 text-white/20" />
            <p className="text-xs font-medium text-white/50">No detections</p>
            <p className="text-[10px] text-white/30">
              {filtersActive ? "Try clearing filters" : "Waiting for activity"}
            </p>
          </div>
        ) : (
          <ul className="py-0.5">
            {events.map((ev) => {
              const cls = String(ev.class_name || "")
              const alert = Boolean(ev.is_alert) || isCritical(cls)
              const critical = isCritical(cls)
              const when = formatTime(ev.created_at)
              const loc = locationLabel(ev)
              const cam = cameraLabel(ev)
              const zn = (ev.zone || "").trim()
              const conf = confidencePct(ev.confidence)
              const ClassIcon = iconForDetectionClass(cls)
              const iconTone = detectionIconTone(cls, alert)

              return (
                <li key={ev.id}>
                  <Link
                    to={`${ROUTES.OBJECT_DETECTION}?q=${encodeURIComponent(cls)}${ev.is_alert ? "&alert=1" : ""}`}
                    className={cn(
                      "group relative flex gap-2.5 border-l-2 px-3 py-2 transition-colors",
                      critical
                        ? "border-l-red-500 bg-red-500/[0.06] hover:bg-red-500/[0.1]"
                        : alert
                          ? "border-l-amber-500/80 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]"
                          : "border-l-transparent hover:border-l-white/20 hover:bg-white/[0.03]",
                    )}
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.04] ring-1 ring-white/[0.08]">
                      <ClassIcon className={cn("h-3.5 w-3.5", iconTone)} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-[12px] font-semibold leading-tight text-white/95">
                          {titleFor(cls)}
                        </p>
                        <time className="shrink-0 font-mono text-[10px] tabular-nums text-white/35">
                          {when}
                        </time>
                      </div>

                      <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[10px] text-white/55">
                        <Camera className="h-2.5 w-2.5 shrink-0 text-white/30" />
                        <span className="truncate">{cam}</span>
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-white/35">
                        {zn ? (
                          <span className="inline-flex items-center gap-0.5">
                            <Grid2x2 className="h-2.5 w-2.5 text-white/25" />
                            {zn}
                          </span>
                        ) : null}
                        {loc ? (
                          <span className="inline-flex min-w-0 items-center gap-0.5 truncate">
                            <MapPin className="h-2.5 w-2.5 shrink-0 text-white/25" />
                            <span className="truncate">{loc}</span>
                          </span>
                        ) : null}
                        {conf ? <span className="tabular-nums text-white/45">{conf}</span> : null}
                        {alert ? (
                          <span
                            className={cn(
                              "ml-auto inline-flex items-center gap-0.5 rounded px-1 py-px text-[8px] font-bold uppercase tracking-wide",
                              critical
                                ? "bg-red-500/20 text-red-300"
                                : "bg-amber-500/15 text-amber-300",
                            )}
                          >
                            <AlertTriangle className="h-2 w-2" />
                            {critical ? "Critical" : "Alert"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
