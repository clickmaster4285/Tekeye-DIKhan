import { HEAD_OFFICE_LOCATION, THIS_SITE_LOCATION } from "@/lib/locations"
import { normalizeRole } from "@/lib/role-access"

export const ALL_CITIES_CAMERAS_KEY = "tekeye_all_cities_cameras"
export const ALL_CITIES_CAMERAS_EVENT = "all-cities-cameras-changed"
export const ALL_CITIES_STREAMS_CACHE_KEY = "tekeye_all_cities_streams_cache"

export type AllCitiesStreamsCache = {
  servers: unknown[]
  cameras: unknown[]
  fetchedAt: number
}

/** Roles that can open the live camera wall in the header. */
const CAMERA_WALL_VIEWER_ROLES = new Set([
  "ADMIN",
  "IT_SUPERADMIN",
  "LOCATION_ADMIN",
  "COLLECTOR",
  "DEPUTY_COLLECTOR",
  "ASSISTANT_COLLECTOR",
])

function normalizeLocation(location: string | undefined | null): string {
  return (location || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
}

export function canViewAllCitiesCameras(role: string | undefined | null): boolean {
  const normalized = normalizeRole(role)
  return Boolean(normalized && CAMERA_WALL_VIEWER_ROLES.has(normalized))
}

/** Peshawar Super Admin, IT Super Admin, Peshawar admin, and Peshawar collectors see every city. */
export function canSeeAllCitiesCameras(
  role: string | undefined | null,
  location: string | undefined | null,
): boolean {
  const normalized = normalizeRole(role)
  if (!normalized || !CAMERA_WALL_VIEWER_ROLES.has(normalized)) return false
  const loc = normalizeLocation(location)
  if (loc === HEAD_OFFICE_LOCATION) return true
  if (
    (normalized === "ADMIN" || normalized === "IT_SUPERADMIN") &&
    THIS_SITE_LOCATION === HEAD_OFFICE_LOCATION &&
    !loc
  ) {
    return true
  }
  return false
}

export function getCamerasWallLabel(
  role: string | undefined | null,
  location: string | undefined | null,
): string {
  return canSeeAllCitiesCameras(role, location) ? "All Cities Cameras" : "All Cameras"
}

export function getAllCitiesCameras(): boolean {
  try {
    return sessionStorage.getItem(ALL_CITIES_CAMERAS_KEY) === "1"
  } catch {
    return false
  }
}

export function setAllCitiesCamerasPreference(enabled: boolean): void {
  try {
    const next = enabled ? "1" : "0"
    const prev = sessionStorage.getItem(ALL_CITIES_CAMERAS_KEY)
    if (prev === next) return
    sessionStorage.setItem(ALL_CITIES_CAMERAS_KEY, next)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent(ALL_CITIES_CAMERAS_EVENT, { detail: { enabled } }),
  )
}

export function readAllCitiesStreamsCache(): AllCitiesStreamsCache | null {
  try {
    const raw = sessionStorage.getItem(ALL_CITIES_STREAMS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AllCitiesStreamsCache
    if (!parsed || !Array.isArray(parsed.servers) || !Array.isArray(parsed.cameras)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeAllCitiesStreamsCache(servers: unknown[], cameras: unknown[]): void {
  try {
    const payload: AllCitiesStreamsCache = {
      servers,
      cameras,
      fetchedAt: Date.now(),
    }
    sessionStorage.setItem(ALL_CITIES_STREAMS_CACHE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}
