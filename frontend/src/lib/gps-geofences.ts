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
