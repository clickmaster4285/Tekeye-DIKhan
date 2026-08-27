/**
 * Camera helpers — database API is the only source of truth.
 */

import { fetchCameras, cameraSourceLabel, type CameraPurpose, type CameraRecord } from "@/lib/cameras-api"
import { LOCATION_OPTIONS } from "@/lib/locations"

export type IntegrationCamera = {
  id: string
  name: string
  location: string
  wh: string
  zone: string
  aiModelApplied: string
  active: boolean
  backendId: number
  purpose: CameraPurpose
  isRtsp: boolean
  mlLiveStreamUrl: string
  mlEnabled: boolean
  sourceLabel: string
  siteCode: string
  nvrName: string
  channel: number
  status: string
}

export function cameraRecordToIntegration(cam: CameraRecord): IntegrationCamera {
  const locLabel = LOCATION_OPTIONS.find((o) => o.value === cam.location)?.label ?? cam.site_name ?? cam.location
  return {
    id: cam.code,
    backendId: cam.id,
    name: cam.name,
    location: locLabel,
    wh: locLabel,
    zone: cam.zone,
    aiModelApplied: cam.purpose_label,
    active: cam.is_active,
    purpose: cam.purpose,
    isRtsp: cam.is_rtsp,
    mlLiveStreamUrl: cam.ml_live_stream_url || "",
    mlEnabled: cam.ml_enabled,
    sourceLabel: cameraSourceLabel(cam),
    siteCode: cam.site_code,
    nvrName: cam.nvr_name,
    channel: cam.channel,
    status: cam.status,
  }
}

export async function loadIntegrationCamerasFromApi(): Promise<IntegrationCamera[]> {
  const rows = await fetchCameras()
  return rows.map(cameraRecordToIntegration)
}

export function hasPlayableVideo(cam: IntegrationCamera): boolean {
  return cam.isRtsp && cam.mlEnabled
}

export function getIntegrationCameraLocations(cameras: IntegrationCamera[]): string[] {
  const set = new Set<string>()
  for (const cam of cameras) {
    if (cam.location.trim()) set.add(cam.location.trim())
    if (cam.wh.trim()) set.add(cam.wh.trim())
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

export function filterCamerasByLocation(cameras: IntegrationCamera[], location: string): IntegrationCamera[] {
  if (!location || location === "all") return cameras
  return cameras.filter((c) => c.location === location || c.wh === location)
}

export function getDashboardFeedCameras(
  cameras: IntegrationCamera[],
  location: string,
  maxFeeds = 4
): IntegrationCamera[] {
  return filterCamerasByLocation(cameras, location)
    .filter((c) => c.active && c.status === "Online" && hasPlayableVideo(c))
    .slice(0, maxFeeds)
}

/** @deprecated Use loadIntegrationCamerasFromApi */
export async function loadIntegrationCameras(): Promise<IntegrationCamera[]> {
  return loadIntegrationCamerasFromApi()
}

/** Notify other views that the camera list changed */
export function notifyCamerasUpdated(): void {
  window.dispatchEvent(new Event("camera-integration-updated"))
}
