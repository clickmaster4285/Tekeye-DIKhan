import { useEffect, useRef, useState } from "react"
import type { GpsGeofence } from "@/lib/gps-geofences"
import { haversineM } from "@/lib/gps-geofences"
import type { GpsHistoryPoint, GpsOfficer } from "@/lib/gps-tracking-api"
import { STATUS_COLOR, timeAgo } from "@/lib/gps-utils"

const PIN_DEEP: Record<string, string> = {
  live: "#15803d",
  stale: "#b45309",
  offline: "#b91c1c",
}

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
export const GPS_DEFAULT_CENTER: [number, number] = [31.8315, 70.9017]
const DEFAULT_ZOOM = 12

type LeafletNs = {
  map: (el: HTMLElement, opts?: Record<string, unknown>) => LeafletMap
  tileLayer: (url: string, opts?: Record<string, unknown>) => { addTo: (map: LeafletMap) => unknown }
  marker: (latlng: [number, number], opts?: Record<string, unknown>) => LeafletMarker
  divIcon: (opts: Record<string, unknown>) => unknown
  circle: (latlng: [number, number], opts?: Record<string, unknown>) => LeafletLayer
  polyline: (
    latlngs: [number, number][],
    opts?: Record<string, unknown>
  ) => LeafletLayer & { setLatLngs: (ll: [number, number][]) => void }
  featureGroup: (layers: unknown[]) => { getBounds: () => { isValid?: () => boolean; pad: (n: number) => unknown } }
}

type LeafletMap = {
  setView: (latlng: [number, number], zoom: number) => LeafletMap
  flyTo: (latlng: [number, number], zoom: number) => void
  remove: () => void
  fitBounds: (bounds: unknown, opts?: Record<string, unknown>) => void
  invalidateSize: () => void
  removeLayer: (layer: unknown) => void
}

type LeafletMarker = {
  addTo: (map: LeafletMap) => LeafletMarker
  setLatLng: (latlng: [number, number]) => void
  setIcon: (icon: unknown) => void
  on: (event: string, fn: () => void) => void
  remove: () => void
}

type LeafletLayer = {
  addTo: (map: LeafletMap) => LeafletLayer
  bindTooltip?: (html: string, opts?: Record<string, unknown>) => LeafletLayer
  remove: () => void
}

declare global {
  interface Window {
    L?: LeafletNs
  }
}

let leafletLoader: Promise<LeafletNs> | null = null

export function loadLeaflet(): Promise<LeafletNs> {
  if (window.L) return Promise.resolve(window.L)
  if (leafletLoader) return leafletLoader
  leafletLoader = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = LEAFLET_CSS
      document.head.appendChild(link)
    }
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener("load", () => (window.L ? resolve(window.L) : reject(new Error("Leaflet failed"))))
      existing.addEventListener("error", () => reject(new Error("Leaflet failed to load")))
      return
    }
    const script = document.createElement("script")
    script.src = LEAFLET_JS
    script.async = true
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error("Leaflet failed")))
    script.onerror = () => reject(new Error("Leaflet failed to load"))
    document.body.appendChild(script)
  })
  return leafletLoader
}

function hasFix(officer: GpsOfficer): officer is GpsOfficer & { latitude: number; longitude: number } {
  return (
    typeof officer.latitude === "number" &&
    typeof officer.longitude === "number" &&
    !(officer.latitude === 0 && officer.longitude === 0)
  )
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function pinHtml(officer: GpsOfficer, selected: boolean): string {
  const color = STATUS_COLOR[officer.status] ?? STATUS_COLOR.offline
  const colorDeep = PIN_DEEP[officer.status] ?? PIN_DEEP.offline
  const acc = officer.accuracy != null ? `${Math.round(officer.accuracy)} m` : "—"
  const selectedClass = selected ? " is-selected" : ""
  const heading = typeof officer.headingDeg === "number" && Number.isFinite(officer.headingDeg)
    ? officer.headingDeg
    : 180
  const gradId = `gps-pin-${officer.userId}`
  return `<div class="gps-officer-pin${selectedClass}">
    <span class="gps-officer-marker">
      <svg class="gps-officer-svg" width="28" height="40" viewBox="0 0 28 40" aria-hidden="true">
        <defs>
          <linearGradient id="${gradId}" x1="14" y1="1" x2="14" y2="39" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="${color}"/>
            <stop offset="100%" stop-color="${colorDeep}"/>
          </linearGradient>
          <filter id="${gradId}-shadow" x="-30%" y="-10%" width="160%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-opacity="0.35"/>
          </filter>
        </defs>
        <path filter="url(#${gradId}-shadow)" fill="url(#${gradId})" stroke="#fff" stroke-width="1.25"
          d="M14 1.2C7.1 1.2 1.6 7 1.6 14.3c0 8.6 10.2 22.7 12.05 24.9a.6.6 0 0 0 .7 0C16.2 37 26.4 22.9 26.4 14.3 26.4 7 20.9 1.2 14 1.2z"/>
        <circle cx="14" cy="14.2" r="5.4" fill="#fff"/>
      </svg>
      <span class="gps-officer-heading" style="transform:translate(-50%,0) rotate(${heading}deg)">
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
          <path d="M5.5 1.1 L9.6 9.2 L5.5 7.4 L1.4 9.2 Z" fill="#0f172a"/>
        </svg>
      </span>
    </span>
    <span class="gps-officer-label">
      <strong>${escapeHtml(officer.name)}</strong>
      <small>${acc} • ${escapeHtml(timeAgo(officer.recordedAt))}</small>
    </span>
  </div>`
}

export function OfficerGpsMap({
  officers,
  selectedUserId,
  trail,
  geofences,
  showGeofences,
  focus,
  fitTrailToken,
  defaultCenter = GPS_DEFAULT_CENTER,
  onSelect,
}: {
  officers: GpsOfficer[]
  selectedUserId: number | null
  trail: GpsHistoryPoint[]
  geofences: GpsGeofence[]
  showGeofences: boolean
  focus: { lat: number; lng: number; zoom?: number } | null
  fitTrailToken: number
  defaultCenter?: [number, number]
  onSelect: (userId: number) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markersRef = useRef<Map<number, LeafletMarker>>(new Map())
  const trailRef = useRef<LeafletLayer | null>(null)
  const fencesRef = useRef<LeafletLayer[]>([])
  const fittedRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!containerRef.current) return

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return
        const map = L.map(containerRef.current, { zoomControl: true }).setView(defaultCenter, DEFAULT_ZOOM)
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map)
        mapRef.current = map
        setMapReady(true)
        requestAnimationFrame(() => map.invalidateSize())
      })
      .catch(() => {
        /* list still works */
      })

    return () => {
      cancelled = true
      markersRef.current.forEach((m) => m.remove())
      markersRef.current.clear()
      trailRef.current?.remove()
      trailRef.current = null
      fencesRef.current.forEach((f) => f.remove())
      fencesRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
      fittedRef.current = false
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const el = containerRef.current
    if (!map || !mapReady || !el) return
    const resize = () => map.invalidateSize()
    const observer = new ResizeObserver(() => requestAnimationFrame(resize))
    observer.observe(el)
    window.addEventListener("resize", resize)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", resize)
    }
  }, [mapReady])

  useEffect(() => {
    const L = window.L
    const map = mapRef.current
    if (!L || !map || !mapReady) return

    const seen = new Set<number>()
    for (const officer of officers) {
      if (!hasFix(officer)) continue
      seen.add(officer.userId)
      const latlng: [number, number] = [officer.latitude, officer.longitude]
      const icon = L.divIcon({
        className: "gps-officer-icon",
        html: pinHtml(officer, officer.userId === selectedUserId),
        iconSize: [240, 48],
        iconAnchor: [14, 40],
      })
      let marker = markersRef.current.get(officer.userId)
      if (!marker) {
        marker = L.marker(latlng, { icon, zIndexOffset: officer.userId === selectedUserId ? 800 : 0 }).addTo(map)
        marker.on("click", () => onSelect(officer.userId))
        markersRef.current.set(officer.userId, marker)
      } else {
        marker.setLatLng(latlng)
        marker.setIcon(icon)
      }
    }

    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    }

    if (!fittedRef.current) {
      const withFix = officers.filter(hasFix)
      const nearby = withFix.filter(
        (o) =>
          haversineM({ lat: o.latitude, lng: o.longitude }, { lat: defaultCenter[0], lng: defaultCenter[1] }) < 80_000
      )
      const fitOfficers = nearby.length > 0 ? nearby : withFix
      const fitMarkers = [...markersRef.current.entries()]
        .filter(([id]) => fitOfficers.some((n) => n.userId === id))
        .map(([, m]) => m)
      if (fitMarkers.length === 0) {
        map.setView(defaultCenter, DEFAULT_ZOOM)
      } else {
        try {
          const maxZoom = nearby.length > 0 ? 14 : 13
          map.fitBounds(L.featureGroup(fitMarkers).getBounds().pad(0.4), { maxZoom })
        } catch {
          map.setView(defaultCenter, DEFAULT_ZOOM)
        }
      }
      fittedRef.current = true
    }
  }, [officers, selectedUserId, onSelect, mapReady, defaultCenter])

  useEffect(() => {
    const L = window.L
    const map = mapRef.current
    if (!L || !map || !mapReady) return
    fencesRef.current.forEach((f) => f.remove())
    fencesRef.current = []
    if (!showGeofences) return
    for (const fence of geofences) {
      const circle = L.circle([fence.latitude, fence.longitude], {
        radius: fence.radiusM,
        color: "#155DFC",
        weight: 2,
        fillColor: "#155DFC",
        fillOpacity: 0.12,
      }).addTo(map)
      circle.bindTooltip?.(fence.name, { permanent: true, direction: "center", className: "gps-fence-label" })
      fencesRef.current.push(circle)
    }
  }, [geofences, showGeofences, mapReady])

  useEffect(() => {
    const L = window.L
    const map = mapRef.current
    if (!L || !map || !mapReady) return
    trailRef.current?.remove()
    trailRef.current = null
    const pts = trail
      .filter((p) => typeof p.latitude === "number" && typeof p.longitude === "number")
      .map((p) => [p.latitude, p.longitude] as [number, number])
    if (pts.length < 2) return
    trailRef.current = L.polyline(pts, { color: "#155DFC", weight: 4, opacity: 0.85 }).addTo(map)
  }, [trail, mapReady])

  useEffect(() => {
    const L = window.L
    const map = mapRef.current
    if (!L || !map || !mapReady || !focus) return
    map.flyTo([focus.lat, focus.lng], focus.zoom ?? 15)
  }, [focus, mapReady])

  useEffect(() => {
    const L = window.L
    const map = mapRef.current
    if (!L || !map || !mapReady || !fitTrailToken || !trailRef.current) return
    try {
      map.fitBounds(L.featureGroup([trailRef.current]).getBounds().pad(0.25), { maxZoom: 16 })
    } catch {
      /* ignore */
    }
  }, [fitTrailToken, mapReady])

  return <div ref={containerRef} className="h-full min-h-[420px] w-full bg-muted" />
}
