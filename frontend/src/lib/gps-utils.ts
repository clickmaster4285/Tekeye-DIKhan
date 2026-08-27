import type { GpsHistoryPoint, GpsOfficer, GpsStatus } from "@/lib/gps-tracking-api"
import { haversineM, type GpsGeofence, officerInsideGeofence } from "@/lib/gps-geofences"

export const STATUS_COLOR: Record<GpsStatus, string> = {
  live: "#16a34a",
  stale: "#d97706",
  offline: "#dc2626",
}

export function roleLabel(role: string): string {
  return (role || "").replace(/_/g, " ") || "—"
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

/** Browser Geolocation needs HTTPS (or localhost). */
export function isSecureGeoContext(): boolean {
  if (typeof window === "undefined") return false
  if (window.isSecureContext) return true
  const host = window.location.hostname
  return host === "localhost" || host === "127.0.0.1"
}

/** Wi‑Fi/IP city centroids (e.g. Islamabad 33.72, 73.06) — not a real GPS fix. */
export function isCoarseNetworkFix(lat: number, lng: number, accuracy: number | null): boolean {
  if (accuracy != null && accuracy > 80) return true
  const rounded =
    Math.abs(lat - Math.round(lat * 100) / 100) < 1e-5 && Math.abs(lng - Math.round(lng * 100) / 100) < 1e-5
  return rounded && (accuracy == null || accuracy > 40)
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—"
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "—"
  const sec = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (sec < 60) return `${sec} sec ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hr ago`
  return `${Math.round(hr / 24)} d ago`
}

export function formatClock(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  } catch {
    return iso
  }
}

export function formatWhen(iso: string | null | undefined): string {
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

export function trailDistanceKm(points: GpsHistoryPoint[]): number {
  let meters = 0
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    const d = haversineM(
      { lat: prev.latitude, lng: prev.longitude },
      { lat: cur.latitude, lng: cur.longitude }
    )
    if (d > 50_000) continue
    meters += d
  }
  return meters / 1000
}

export function accuracyGrade(accuracy: number | null | undefined): { label: string; color: string } {
  if (accuracy == null) return { label: "—", color: "#94a3b8" }
  if (accuracy <= 10) return { label: "HIGH", color: "#16a34a" }
  if (accuracy <= 30) return { label: "MEDIUM", color: "#d97706" }
  return { label: "LOW", color: "#dc2626" }
}

export function gpsSignalPct(accuracy: number | null | undefined): number {
  if (accuracy == null) return 0
  return Math.max(5, Math.min(100, Math.round(100 - accuracy)))
}

export type GpsAlert = {
  id: string
  severity: "critical" | "warning"
  title: string
  detail: string
  at: string | null
}

export function deriveGpsAlerts(officers: GpsOfficer[], fences: GpsGeofence[]): GpsAlert[] {
  const alerts: GpsAlert[] = []
  for (const officer of officers) {
    if (officer.onDuty && officer.status === "offline") {
      alerts.push({
        id: `offline-${officer.userId}`,
        severity: "critical",
        title: `${officer.name} GPS offline`,
        detail: "On duty but last ping is older than 10 minutes.",
        at: officer.recordedAt,
      })
    } else if (officer.status === "stale") {
      alerts.push({
        id: `stale-${officer.userId}`,
        severity: "warning",
        title: `${officer.name} GPS stale`,
        detail: "No fresh ping in the last 2 minutes.",
        at: officer.recordedAt,
      })
    }
    if (officer.accuracy != null && officer.accuracy > 100) {
      alerts.push({
        id: `acc-${officer.userId}`,
        severity: "warning",
        title: `${officer.name} GPS accuracy > 100m`,
        detail: `Current accuracy ±${Math.round(officer.accuracy)} m.`,
        at: officer.recordedAt,
      })
    }
    const stationFences = fences.filter((f) => !officer.location || f.location === officer.location)
    if (
      officer.onDuty &&
      officer.status === "live" &&
      stationFences.length > 0 &&
      !stationFences.some((f) => officerInsideGeofence(officer, f))
    ) {
      alerts.push({
        id: `geo-${officer.userId}`,
        severity: "critical",
        title: `${officer.name} left assigned geofence`,
        detail: officer.employeeId ? `Officer ${officer.employeeId} is outside the station compound.` : "Outside the station compound.",
        at: officer.recordedAt,
      })
    }
  }
  return alerts.slice(0, 8)
}

export type RouteEvent = { time: string; label: string }

export function buildRouteEvents(officer: GpsOfficer | null, points: GpsHistoryPoint[]): RouteEvent[] {
  if (!officer) return []
  const events: RouteEvent[] = []
  if (officer.dutyStartedAt) {
    events.push({ time: formatClock(officer.dutyStartedAt), label: "Duty started" })
  }
  if (points.length >= 3) {
    const mid = points[Math.floor(points.length / 2)]
    events.push({ time: formatClock(mid.recordedAt), label: "En route" })
  }
  if (points.length >= 2) {
    const last = points[points.length - 1]
    events.push({ time: formatClock(last.recordedAt), label: "Current position" })
  }
  return events
}

export function hoursSinceLocalMidnight(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 3_600_000))
}
