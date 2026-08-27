import { useEffect, useState } from "react"
import { isAuthenticated } from "@/lib/auth"
import { haversineM } from "@/lib/gps-geofences"
import { fetchGpsMe, postGpsDuty, postGpsHeartbeat, postGpsPing } from "@/lib/gps-tracking-api"
import { isCoarseNetworkFix, isSecureGeoContext } from "@/lib/gps-utils"
import { queryClient } from "@/lib/query-client"

const MOVE_PING_MS = 10_000
const IDLE_PING_MS = 30_000
const MOVE_THRESHOLD_M = 15
const HEARTBEAT_MS = 15_000
const GEO_WATCH_OPTS: PositionOptions = { enableHighAccuracy: true, maximumAge: 5_000, timeout: 60_000 }

export const GPS_TRACKING_STATUS_EVENT = "tekeye-gps-tracking-status"

export type OfficerGpsTrackingStatus = {
  running: boolean
  error: string | null
}

let generation = 0
let watchId: number | null = null
let heartbeatId: number | null = null
let pollId: number | null = null
let lastSent: { lat: number; lng: number; at: number } | null = null
let status: OfficerGpsTrackingStatus = { running: false, error: null }

function publish(next: Partial<OfficerGpsTrackingStatus>) {
  status = { ...status, ...next }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(GPS_TRACKING_STATUS_EVENT, { detail: status }))
  }
}

function clearTimers() {
  if (watchId != null && typeof navigator !== "undefined" && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }
  if (heartbeatId != null) {
    window.clearInterval(heartbeatId)
    heartbeatId = null
  }
  if (pollId != null) {
    window.clearInterval(pollId)
    pollId = null
  }
}

async function refreshGpsQueries() {
  await queryClient.invalidateQueries({ queryKey: ["gps-me"] })
  await queryClient.invalidateQueries({ queryKey: ["gps-live"] })
}

async function sendPing(myGen: number, pos: GeolocationCoordinates) {
  if (myGen !== generation) return
  const speedKmh =
    typeof pos.speed === "number" && Number.isFinite(pos.speed) ? Math.max(0, pos.speed * 3.6) : null
  const headingDeg = typeof pos.heading === "number" && Number.isFinite(pos.heading) ? pos.heading : null
  const altitudeM = typeof pos.altitude === "number" && Number.isFinite(pos.altitude) ? pos.altitude : null
  await postGpsPing({
    latitude: pos.latitude,
    longitude: pos.longitude,
    accuracy: Number.isFinite(pos.accuracy) ? pos.accuracy : null,
    recordedAt: new Date().toISOString(),
    speedKmh,
    headingDeg,
    altitudeM,
  })
  lastSent = { lat: pos.latitude, lng: pos.longitude, at: Date.now() }
  if (status.error) publish({ error: null })
  await refreshGpsQueries()
}

function handlePosition(myGen: number, pos: GeolocationPosition) {
  if (myGen !== generation) return
  const accuracy = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null
  if (isCoarseNetworkFix(pos.coords.latitude, pos.coords.longitude, accuracy)) {
    publish({
      error:
        "Waiting for GPS (this fix looks like Wi‑Fi/city location). Keep the app open, outdoors, with location on.",
    })
    return
  }
  const now = Date.now()
  const prev = lastSent
  const moved = prev
    ? haversineM({ lat: prev.lat, lng: prev.lng }, { lat: pos.coords.latitude, lng: pos.coords.longitude })
    : MOVE_THRESHOLD_M + 1
  const elapsed = prev ? now - prev.at : IDLE_PING_MS
  const due = !prev || (moved >= MOVE_THRESHOLD_M && elapsed >= MOVE_PING_MS) || elapsed >= IDLE_PING_MS
  if (!due) return
  sendPing(myGen, pos.coords).catch((err: unknown) => {
    if (myGen !== generation) return
    publish({ error: err instanceof Error ? err.message : "GPS ping failed" })
  })
}

function requestFix(myGen: number) {
  if (typeof navigator === "undefined" || !navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(
    (pos) => handlePosition(myGen, pos),
    () => {
      /* watchPosition still running */
    },
    GEO_WATCH_OPTS
  )
}

function startWatch(myGen: number) {
  clearTimers()
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    publish({ running: false, error: "This device does not support GPS." })
    return
  }
  if (!isSecureGeoContext()) {
    publish({
      running: false,
      error: "GPS needs HTTPS. Open https://this-pc:3000 (accept the certificate), not http://.",
    })
    return
  }

  requestFix(myGen)
  watchId = navigator.geolocation.watchPosition(
    (pos) => handlePosition(myGen, pos),
    (err) => {
      if (myGen !== generation) return
      if (err.code === err.TIMEOUT) {
        requestFix(myGen)
        return
      }
      publish({ error: err.message || "Location permission denied" })
    },
    GEO_WATCH_OPTS
  )
  pollId = window.setInterval(() => requestFix(myGen), IDLE_PING_MS)
  heartbeatId = window.setInterval(() => {
    if (myGen !== generation || document.visibilityState === "hidden") return
    postGpsHeartbeat()
      .then(() => refreshGpsQueries())
      .catch(() => {
        /* ignore transient */
      })
  }, HEARTBEAT_MS)
  postGpsHeartbeat()
    .then(() => refreshGpsQueries())
    .catch(() => {
      /* ignore */
    })
  publish({ running: true })
}

function onVisibility(myGen: number) {
  if (document.visibilityState !== "visible") return
  if (myGen !== generation) return
  requestFix(myGen)
  postGpsHeartbeat()
    .then(() => refreshGpsQueries())
    .catch(() => {
      /* ignore */
    })
}

/** Start duty + device GPS for the signed-in user. Idempotent. */
export async function startOfficerGpsTracking(): Promise<void> {
  if (status.running && watchId != null) return
  const myGen = ++generation
  lastSent = null
  publish({ running: false, error: null })

  try {
    const me = await fetchGpsMe()
    if (myGen !== generation) return
    if (!me.onDuty) await postGpsDuty("start")
    if (myGen !== generation) return
    await refreshGpsQueries()
  } catch (err) {
    if (myGen !== generation) return
    publish({ error: err instanceof Error ? err.message : "Could not start GPS" })
  }
  if (myGen !== generation) return
  startWatch(myGen)
  window.removeEventListener("visibilitychange", visibilityHandler)
  visibilityHandler = () => onVisibility(myGen)
  window.addEventListener("visibilitychange", visibilityHandler)
}

let visibilityHandler: () => void = () => {}

/** Stop watching. Pass endDuty on logout so the officer goes offline on the map. */
export async function stopOfficerGpsTracking(opts?: { endDuty?: boolean }): Promise<void> {
  generation += 1
  window.removeEventListener("visibilitychange", visibilityHandler)
  clearTimers()
  lastSent = null
  publish({ running: false, error: null })
  if (opts?.endDuty && isAuthenticated()) {
    try {
      await postGpsDuty("stop")
      await refreshGpsQueries()
    } catch {
      /* session may already be gone */
    }
  }
}

export function getOfficerGpsTrackingStatus(): OfficerGpsTrackingStatus {
  return status
}

export function useOfficerGpsTrackingStatus(): OfficerGpsTrackingStatus {
  const [current, setCurrent] = useState(status)
  useEffect(() => {
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<OfficerGpsTrackingStatus>).detail
      setCurrent(detail ?? getOfficerGpsTrackingStatus())
    }
    window.addEventListener(GPS_TRACKING_STATUS_EVENT, onStatus)
    setCurrent(getOfficerGpsTrackingStatus())
    return () => window.removeEventListener(GPS_TRACKING_STATUS_EVENT, onStatus)
  }, [])
  return current
}
