import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Video, RefreshCw, MapPin, Layers, Camera } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROUTES } from "@/routes/config"
import { CameraSelectItems } from "@/components/cameras/camera-select-items"
import { MlCameraFeed } from "@/components/cameras/ml-camera-feed"
import { MlSystemStatus } from "@/components/cameras/ml-system-status"
import { LOCATION_OPTIONS } from "@/lib/locations"
import { zoneLabel } from "@/lib/warehouse-zones"
import { fetchCameras, type CameraRecord } from "@/lib/cameras-api"

const ALL_LOCATIONS = "all"
const ALL_ZONES = "all"
const ALL_CAMERAS = "all"
const MAX_FEEDS = 4

export function DashboardRtspCameraGrid() {
  const [cameras, setCameras] = useState<CameraRecord[]>([])
  const [location, setLocation] = useState(ALL_LOCATIONS)
  const [zone, setZone] = useState(ALL_ZONES)
  const [cameraId, setCameraId] = useState(ALL_CAMERAS)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const reloadCameras = useCallback((options?: { blocking?: boolean }) => {
    const blocking = options?.blocking ?? false
    if (blocking) setLoading(true)
    else setRefreshing(true)
    fetchCameras()
      .then(setCameras)
      .catch(() => setCameras([]))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }, [])

  useEffect(() => {
    reloadCameras({ blocking: true })
    const onCustom = () => reloadCameras()
    window.addEventListener("camera-integration-updated", onCustom)
    return () => {
      window.removeEventListener("camera-integration-updated", onCustom)
    }
  }, [reloadCameras])

  const locationCodes = useMemo(() => {
    const set = new Set(cameras.map((c) => c.location).filter(Boolean))
    return Array.from(set)
  }, [cameras])

  const camerasForLocation = useMemo(() => {
    if (location === ALL_LOCATIONS) return cameras
    return cameras.filter((c) => c.location === location)
  }, [cameras, location])

  const zoneCodes = useMemo(() => {
    const set = new Set(camerasForLocation.map((c) => c.zone).filter(Boolean))
    return Array.from(set).sort()
  }, [camerasForLocation])

  const camerasForZone = useMemo(() => {
    let list = camerasForLocation
    if (zone !== ALL_ZONES) {
      list = list.filter((c) => c.zone === zone)
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [camerasForLocation, zone])

  useEffect(() => {
    if (cameraId === ALL_CAMERAS) return
    if (!camerasForZone.some((c) => String(c.id) === cameraId)) {
      setCameraId(ALL_CAMERAS)
    }
  }, [cameraId, camerasForZone])

  const feeds = useMemo(() => {
    let list = cameras.filter((c) => c.is_active && c.status === "Online")
    if (location !== ALL_LOCATIONS) {
      list = list.filter((c) => c.location === location)
    }
    if (zone !== ALL_ZONES) {
      list = list.filter((c) => c.zone === zone)
    }
    if (cameraId !== ALL_CAMERAS) {
      list = list.filter((c) => String(c.id) === cameraId)
    }
    return list.slice(0, MAX_FEEDS)
  }, [cameras, location, zone, cameraId])

  const locationLabel =
    location === ALL_LOCATIONS
      ? "all locations"
      : LOCATION_OPTIONS.find((o) => o.value === location)?.label ?? location

  const zoneFilterLabel = zone === ALL_ZONES ? "all zones" : zoneLabel(zone)

  const selectedCamera = useMemo(
    () => camerasForZone.find((c) => String(c.id) === cameraId),
    [camerasForZone, cameraId]
  )

  const cameraFilterLabel =
    cameraId === ALL_CAMERAS ? "all cameras" : selectedCamera?.name ?? "selected camera"

  const emptyFilterLabel = [locationLabel, zoneFilterLabel, cameraFilterLabel]
    .filter((part) => part !== "all locations" && part !== "all zones" && part !== "all cameras")
    .join(" · ") || "all locations"

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-[#3b82f6]" />
            Live Cameras
          </CardTitle>
          {/* <CardDescription>
            Feeds from Camera Integration — ML overlays on cameras with AI purpose assigned.
          </CardDescription> */}
          <MlSystemStatus className="mt-2" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={location}
            onValueChange={(v) => {
              setLocation(v)
              setZone(ALL_ZONES)
              setCameraId(ALL_CAMERAS)
            }}
          >
            <SelectTrigger className="w-[180px]">
              <MapPin className="h-4 w-4 mr-1 shrink-0" />
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_LOCATIONS}>All locations</SelectItem>
              {locationCodes.map((code) => (
                <SelectItem key={code} value={code}>
                  {LOCATION_OPTIONS.find((o) => o.value === code)?.label ?? code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={zone}
            onValueChange={(v) => {
              setZone(v)
              setCameraId(ALL_CAMERAS)
            }}
          >
            <SelectTrigger className="w-[180px]">
              <Layers className="h-4 w-4 mr-1 shrink-0" />
              <SelectValue placeholder="Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ZONES}>All zones</SelectItem>
              {zoneCodes.map((code) => (
                <SelectItem key={code} value={code}>
                  {zoneLabel(code)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cameraId} onValueChange={setCameraId}>
            <SelectTrigger className="w-[200px]">
              <Camera className="h-4 w-4 mr-1 shrink-0" />
              <SelectValue placeholder="Camera" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CAMERAS}>All cameras</SelectItem>
              <CameraSelectItems cameras={camerasForZone} valueAs="id" />
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reloadCameras()}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.CAMERA_MANAGEMENT}>Configure</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading cameras…</p>
        ) : feeds.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            No active cameras for {emptyFilterLabel}.{" "}
            <Link to={ROUTES.CAMERA_MANAGEMENT} className="text-[#3b82f6] underline">
              Add cameras in Camera Management
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {feeds.map((cam) => (
              <MlCameraFeed
                key={cam.id}
                camera={cam}
                pollMl={false}
                showBrandLogo
                showFullscreenButton
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
