import { LOCATION_OPTIONS, type LocationCode } from "@/lib/locations"
import type { GpsOfficer } from "@/lib/gps-tracking-api"

export type GpsGeofence = {
  id: string
  name: string
  location: LocationCode
  latitude: number
  longitude: number
  radiusM: number
}

/** Approximate customs compound circles used for live inside/outside counts. */
export const STATION_GEOFENCES: GpsGeofence[] = [
  {
    id: "di-khan-warehouse",
    name: "DI Khan Customs Warehouse",
    location: "DI_KHAN",
    latitude: 31.8315,
    longitude: 70.9017,
    radiusM: 450,
  },
  {
    id: "peshawar-office",
    name: "Peshawar Customs Office",
    location: "PESHAWAR",
    latitude: 34.008,
    longitude: 71.5789,
    radiusM: 600,
  },
  {
    id: "kohat-office",
    name: "Kohat Customs Office",
    location: "KOHAT",
    latitude: 33.5889,
    longitude: 71.4429,
    radiusM: 450,
  },
  {
    id: "nowshera-office",
    name: "Nowshera Customs Office",
    location: "NOWSHERA",
    latitude: 34.0153,
    longitude: 71.9814,
    radiusM: 450,
  },
  {
    id: "mardan-office",
    name: "Mardan Customs Office",
    location: "MARDAN",
    latitude: 34.1986,
    longitude: 72.04,
    radiusM: 450,
  },
  {
    id: "ratta-kulachi",
    name: "SWH Ratta Kulachi",
    location: "SWH_RATTA_KULACHI",
    latitude: 31.801,
    longitude: 70.726,
    radiusM: 500,
  },
]

export function stationCenter(station: string | "all"): [number, number] {
  if (station && station !== "all") {
    const fence = STATION_GEOFENCES.find((g) => g.location === station)
    if (fence) return [fence.latitude, fence.longitude]
  }
  const di = STATION_GEOFENCES.find((g) => g.location === "DI_KHAN")
  return [di?.latitude ?? 31.8315, di?.longitude ?? 70.9017]
}

export function geofencesForStation(station: string | "all"): GpsGeofence[] {
  if (!station || station === "all") return STATION_GEOFENCES
  return STATION_GEOFENCES.filter((g) => g.location === station)
}

export function stationOptions() {
  return LOCATION_OPTIONS
}

export function officerInsideGeofence(officer: GpsOfficer, fence: GpsGeofence): boolean {
  if (typeof officer.latitude !== "number" || typeof officer.longitude !== "number") return false
  return haversineM(
    { lat: officer.latitude, lng: officer.longitude },
    { lat: fence.latitude, lng: fence.longitude }
  ) <= fence.radiusM
}

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** Distance within which an out-of-fence point is labeled "Near {station}". */
const NEAR_STATION_M = 2_000

/**
 * Station-compound label only (customs geofence).
 * Returns empty string when outside all compounds — do NOT use "Outside station"
 * as a place name; reverse-geocoding owns city/street labels.
 */
export function locationNameForCoords(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ""

  let nearest: GpsGeofence | null = null
  let nearestDist = Number.POSITIVE_INFINITY

  for (const fence of STATION_GEOFENCES) {
    const dist = haversineM(
      { lat, lng },
      { lat: fence.latitude, lng: fence.longitude }
    )
    if (dist <= fence.radiusM) return fence.name
    if (dist < nearestDist) {
      nearestDist = dist
      nearest = fence
    }
  }

  if (nearest && nearestDist <= NEAR_STATION_M) return `Near ${nearest.name}`
  return ""
}

function coordKey(lat: number, lng: number): string {
  const r = (n: number) => (Math.round(n * 1e4) / 1e4).toFixed(4)
  return `${r(lat)},${r(lng)}`
}

/**
 * Prefer exact reverse-geocoded place name; then customs compound; never "Outside station".
 * Pass `pointLocationName` when the history API already resolved the name.
 */
export function resolveLocationName(
  lat: number,
  lng: number,
  exactNames?: Record<string, string> | null,
  opts?: { loading?: boolean; pointLocationName?: string | null }
): string {
  const fromPoint = (opts?.pointLocationName || "").trim()
  if (fromPoint) return fromPoint

  if (opts?.loading) return "Looking up…"

  const key = coordKey(lat, lng)
  if (exactNames) {
    const exact = (exactNames[key] || "").trim()
    if (exact) return exact
  }

  const fenceOrNear = locationNameForCoords(lat, lng)
  if (fenceOrNear) return fenceOrNear

  // Names not loaded yet (still waiting on first response).
  if (exactNames == null) return "Looking up…"

  // Geocode finished but no street name for this point.
  return "Place name unavailable"
}

