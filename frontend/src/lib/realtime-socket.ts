/**
 * App-wide Socket.IO client. Backend emits `realtime:invalidate` with domains;
 * this module connects once and fans out to React Query + window events.
 */
import { io, type Socket } from "socket.io-client"
import { API_BASE_URL, getStoredToken } from "@/lib/api"

export const REALTIME_INVALIDATE_EVENT = "tekeye-realtime-invalidate"

export type RealtimeInvalidateDetail = {
  domains: string[]
  payload?: Record<string, unknown>
}

/** Domains → React Query key prefixes to invalidate. */
export const DOMAIN_QUERY_PREFIXES: Record<string, (string | number)[][]> = {
  vms: [["vms"], ["visitors"], ["visitor"]],
  dashboard: [["vms"], ["visitors"]],
  cameras: [
    ["cameras"],
    ["sites"],
    ["detection-summary"],
    ["detection-events"],
    ["plate-captures"],
    ["vehicle-journey"],
    ["vehicle-detection-events"],
  ],
  detections: [
    ["detection-summary"],
    ["detection-events"],
    ["plate-captures"],
    ["cameras"],
    ["vehicle-detection-events"],
  ],
  notifications: [["vms", "notifications"], ["seizure-mgmt"]],
  alerts: [["vms", "security-alerts"], ["detection-events"]],
  ops: [["ops"], ["remote-servers"], ["cameras"]],
  person_journey: [
    ["journey-summary"],
    ["journey-live"],
    ["journey-persons"],
    ["journey-camera-sightings"],
    ["journey-timeline"],
    ["journey-camera-captures"],
  ],
  object_tracking: [
    ["object-tracking-summary"],
    ["object-tracking-live"],
    ["object-tracking-objects"],
    ["object-tracking-visits"],
    ["object-tracking-detail"],
  ],
  gps: [["gps-me"], ["gps-live"], ["gps-history"]],
  hr: [["staff"], ["users"]],
  attendance: [["staff"], ["attendance"]],
  users: [["users"], ["staff"]],
  seizure: [["seizure-mgmt"], ["seizure"]],
  detentions: [["detentions"], ["detention"], ["seizure-mgmt"]],
  warehouse: [["warehouse"], ["stock"], ["memo-distribution"]],
  video_recovery: [["video-recovery"], ["video-recovery-jobs"], ["video-recovery-job"]],
  recognition: [["recognition"], ["staff"]],
}

const DEFAULT_ROOMS = Object.keys(DOMAIN_QUERY_PREFIXES)

let socket: Socket | null = null
let started = false

function socketUrl(): string {
  // Same-origin when API is proxied; otherwise Django host.
  if (!API_BASE_URL) return window.location.origin
  try {
    return new URL(API_BASE_URL).origin
  } catch {
    return window.location.origin
  }
}

export function getRealtimeSocket(): Socket | null {
  return socket
}

export function startRealtimeSocket(options?: { rooms?: string[] }): Socket {
  if (socket?.connected) return socket
  if (started && socket) return socket
  started = true

  const token = getStoredToken()
  // Django runserver / sync WSGI cannot host Engine.IO WebSocket upgrades.
  // Long-polling works everywhere (Vite proxy + production gunicorn).
  socket = io(socketUrl(), {
    path: "/socket.io",
    transports: ["polling"],
    upgrade: false,
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1500,
    reconnectionAttempts: Infinity,
    auth: token ? { token } : undefined,
  })

  socket.on("connect", () => {
    socket?.emit("subscribe", { rooms: options?.rooms ?? DEFAULT_ROOMS })
  })

  socket.on("realtime:invalidate", (body: unknown) => {
    const domains = Array.isArray((body as { domains?: unknown })?.domains)
      ? ((body as { domains: string[] }).domains || []).map(String)
      : []
    if (!domains.length) return
    window.dispatchEvent(
      new CustomEvent<RealtimeInvalidateDetail>(REALTIME_INVALIDATE_EVENT, {
        detail: { domains, payload: (body as Record<string, unknown>) || {} },
      })
    )
    if (domains.includes("cameras") || domains.includes("ops")) {
      window.dispatchEvent(new Event("camera-integration-updated"))
    }
  })

  return socket
}

export function stopRealtimeSocket() {
  started = false
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}
