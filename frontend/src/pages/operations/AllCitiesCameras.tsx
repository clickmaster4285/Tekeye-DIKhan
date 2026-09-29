"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Expand,
  LayoutGrid,
  Loader2,
  MapPin,
  Maximize2,
  Minimize2,
  MonitorPlay,
  RefreshCw,
  Search,
  Server,
  Trash2,
  Video,
  Wifi,
  WifiOff,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getStoredUser } from "@/lib/auth"
import { canViewAllCitiesCameras, getCamerasWallLabel } from "@/lib/all-cities-cameras"
import { normalizeRole } from "@/lib/role-access"
import { ROUTES } from "@/routes/config"
import {
  setAllCitiesCamerasPreference,
} from "@/lib/all-cities-cameras"
import {
  fetchAllCitiesSelection,
  fetchAllCitiesStreams,
  saveAllCitiesSelection,
  withOpsStreamToken,
  type OpsCamera,
} from "@/lib/ops-central-api"
import { cn } from "@/lib/utils"

type CityCamera = OpsCamera & {
  server_id?: number
  server_name?: string
  location_code?: string
}

type ServerSummary = {
  id: number
  name: string
  location_code: string
  connection_mode: string
  ml_base_url: string
  last_health: string
  last_error: string
  ok: boolean
  source: string
  error: string
  camera_count: number
}

type GridLayout = "auto" | "1x1" | "2x2" | "3x3" | "4x4" | "6x6" | "8x8" | "10x10"

const ALL_CITIES_SELECTION_LEGACY_KEY = "tekeye-all-cities-selected-cameras"

function readLegacyLocalSelection(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(ALL_CITIES_SELECTION_LEGACY_KEY) || "[]")
    return Array.isArray(stored) ? stored.filter((key): key is string => typeof key === "string") : []
  } catch {
    return []
  }
}

function clearLegacyLocalSelection() {
  try {
    localStorage.removeItem(ALL_CITIES_SELECTION_LEGACY_KEY)
  } catch {
    /* ignore */
  }
}

function gridPageSize(layout: GridLayout): number {
  if (layout === "1x1") return 1
  if (layout === "2x2") return 4
  if (layout === "3x3") return 9
  if (layout === "4x4") return 16
  // Large grids paginate so the browser never mounts 36–100 streams at once
  if (layout === "6x6") return 36
  if (layout === "8x8") return 64
  if (layout === "10x10") return 16
  return Number.MAX_SAFE_INTEGER
}

function camerasFingerprint(
  list: Array<{ server_id?: number; id: number; code: string; ml_live_stream_url?: string }>
): string {
  return list
    .map(
      (c) =>
        `${c.server_id ?? 0}:${c.id}:${c.code}:${(c.ml_live_stream_url || "").trim()}`
    )
    .join("|")
}

function cameraLocationKey(camera: Pick<CityCamera, "location_code" | "location" | "server_name">): string {
  return (camera.location_code || camera.location || camera.server_name || "Unassigned location").trim() || "Unassigned location"
}

function isCameraOnline(camera: CityCamera): boolean {
  const status = (camera.status || "").trim().toLowerCase()
  // Explicit offline statuses win.
  if (["offline", "inactive", "down", "disconnected", "error"].includes(status)) return false
  // Registered / live statuses win over a stale connected=false during RTSP reconnect.
  if (["online", "active", "live", "running", "ok"].includes(status)) return true
  if (typeof camera.connected === "boolean" && camera.connected) return true
  if (typeof camera.is_active === "boolean") return camera.is_active
  return Boolean((camera.ml_live_stream_url || "").trim())
}

/** Balanced column count for Auto wall — avoids one skinny row of N cameras. */
function autoWallColumns(count: number): number {
  if (count <= 1) return 1
  if (count === 2) return 2
  if (count <= 4) return 2
  if (count <= 6) return 3
  if (count <= 9) return 3
  if (count <= 12) return 4
  if (count <= 16) return 4
  if (count <= 25) return 5
  return 6
}

const GRID_CLASS: Record<GridLayout, string> = {
  auto: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
  "1x1": "grid-cols-1",
  "2x2": "grid-cols-2",
  "3x3": "grid-cols-3",
  "4x4": "grid-cols-4",
  "6x6": "grid-cols-6",
  "8x8": "grid-cols-8",
  "10x10": "grid-cols-10",
}

/** Wall-view row sizing: 1x1 fills the full wall; fixed grids use equal cells. */
const WALL_GRID_CLASS: Record<GridLayout, string> = {
  auto: "h-full",
  "1x1": "h-full grid-rows-1",
  "2x2": "h-full grid-rows-2",
  "3x3": "h-full grid-rows-3",
  "4x4": "h-full grid-rows-4",
  "6x6": "h-full grid-rows-6",
  "8x8": "h-full grid-rows-8",
  "10x10": "h-full grid-rows-10",
}

function wallTileMediaClass(layout: GridLayout): string {
  // All wall layouts fill their cell; 1x1 = full screen
  void layout
  return "aspect-auto h-full w-full min-h-0 flex-1"
}

const GRID_LAYOUT_OPTIONS: { value: GridLayout; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Fit all cameras" },
  { value: "1x1", label: "1 × 1", hint: "1 camera" },
  { value: "2x2", label: "2 × 2", hint: "4 cameras" },
  { value: "3x3", label: "3 × 3", hint: "9 cameras" },
  { value: "4x4", label: "4 × 4", hint: "16 cameras" },
  { value: "6x6", label: "6 × 6", hint: "36 cameras" },
  { value: "8x8", label: "8 × 8", hint: "64 cameras" },
  { value: "10x10", label: "10 × 10", hint: "100 cameras" },
]

function GridLayoutSelect({
  layout,
  onChange,
  tone = "light",
}: {
  layout: GridLayout
  onChange: (value: GridLayout) => void
  tone?: "light" | "dark"
}) {
  const dark = tone === "dark"
  return (
    <Select
      value={layout}
      onValueChange={(value) => onChange(value as GridLayout)}
    >
      <SelectTrigger
        className={cn(
          "h-8 w-[9.5rem] gap-2 text-xs font-medium",
          dark &&
            "border-white/25 bg-white/5 text-white shadow-none hover:bg-white/10 focus:ring-white/20 [&>svg]:text-white/70"
        )}
        aria-label="Grid layout"
      >
        <LayoutGrid className="h-3.5 w-3.5 shrink-0 opacity-80" />
        <SelectValue placeholder="Layout">
          {GRID_LAYOUT_OPTIONS.find((option) => option.value === layout)?.label ?? "Layout"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        align="end"
        className={cn(
          "min-w-[12rem]",
          // Wall overlay is z-[190] — dropdown must render above it
          dark && "!z-[220]",
        )}
      >
        {GRID_LAYOUT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value} textValue={option.label}>
            <div className="flex w-full min-w-[9rem] items-center justify-between gap-6">
              <span className="font-medium">{option.label}</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">{option.hint}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const StreamTile = memo(function StreamTile({
  camera,
  showTimestamp,
  wallMode = false,
  wallLayout = "auto",
  canManage,
  onRemove,
  removing,
  liveEnabled = true,
}: {
  camera: CityCamera
  showTimestamp: boolean
  wallMode?: boolean
  wallLayout?: GridLayout
  canManage?: boolean
  onRemove?: () => void
  removing?: boolean
  /** When false, show a placeholder instead of opening an MJPEG connection. */
  liveEnabled?: boolean
}) {
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const imgRef = useRef<HTMLImageElement | null>(null)
  const retryTimerRef = useRef<number | null>(null)
  const raw = (camera.ml_live_stream_url || "").trim()
  const tokenized = raw ? withOpsStreamToken(raw) : null
  const src =
    (liveEnabled || isFullscreen) && tokenized
      ? `${tokenized}${tokenized.includes("?") ? "&" : "?"}r=${retry}`
      : null

  useEffect(() => {
    return () => {
      if (retryTimerRef.current != null) window.clearTimeout(retryTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (liveEnabled) return
    setError(false)
    if (retryTimerRef.current != null) {
      window.clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }, [liveEnabled])

  const exitFullscreen = useCallback(() => setIsFullscreen(false), [])

  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitFullscreen()
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [isFullscreen, exitFullscreen])

  useEffect(() => {
    if (!showTimestamp && !isFullscreen) return
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [showTimestamp, isFullscreen])

  const refreshStream = () => {
    setError(false)
    setRetry((n) => n + 1)
  }

  const takeSnapshot = () => {
    const img = imgRef.current
    if (!img || !img.naturalWidth) return
    try {
      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      const link = document.createElement("a")
      const stamp = new Date().toISOString().replace(/[:.]/g, "-")
      link.download = `${(camera.code || camera.name || "camera").replace(/\s+/g, "_")}_${stamp}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    } catch {
      /* cross-origin canvas may be tainted — ignore */
    }
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-black",
        wallMode && "flex h-full min-h-0 min-w-0 flex-col rounded-md",
        wallMode && wallLayout === "1x1" && "rounded-none border-0",
        isFullscreen && "fixed inset-0 z-[200] flex flex-col rounded-none border-0",
      )}
    >
      <div
        className={cn(
          "relative aspect-video w-full",
          wallMode && wallTileMediaClass(wallLayout),
          isFullscreen && "flex-1 aspect-auto min-h-0 max-h-none max-w-none",
        )}
      >
        {src && !error ? (
          <img
            ref={imgRef}
            src={src}
            alt={camera.name}
            className={cn(
              "h-full w-full object-center",
              wallMode || isFullscreen ? "object-cover" : "object-contain",
            )}
            onError={() => {
              setError(true)
              // Cap reconnect storms — too many cameras retrying freezes the tab
              if (retry >= 4) return
              if (retryTimerRef.current != null) window.clearTimeout(retryTimerRef.current)
              retryTimerRef.current = window.setTimeout(() => {
                setError(false)
                setRetry((n) => n + 1)
              }, 3000 + retry * 1500)
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-sm text-white/60">
            {!liveEnabled && !isFullscreen
              ? "Paused (stream limit) — open fullscreen or next page"
              : error
                ? retry >= 4
                  ? "Stream unavailable"
                  : "Reconnecting…"
                : "No stream URL"}
          </div>
        )}

        <div className="absolute left-2 top-2 z-10 flex max-w-[70%] flex-wrap gap-1">
          <Badge className="max-w-full truncate bg-sky-700/90 text-white">
            {camera.server_name || "Server"}
          </Badge>
          {src && !error ? (
            <Badge className="bg-emerald-600/90 text-white">Live</Badge>
          ) : null}
        </div>

        <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
          {canManage && onRemove ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 bg-black/55 text-white hover:bg-red-700/80 hover:text-white"
              onClick={onRemove}
              disabled={removing}
              title="Remove camera"
              aria-label="Remove camera"
            >
              {removing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 bg-black/55 text-white hover:bg-black/75 hover:text-white"
            onClick={refreshStream}
            title="Refresh stream"
            aria-label="Refresh stream"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 bg-black/55 text-white hover:bg-black/75 hover:text-white"
            onClick={takeSnapshot}
            title="Take snapshot"
            aria-label="Take snapshot"
            disabled={!src || error}
          >
            <Camera className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 bg-black/55 text-white hover:bg-black/75 hover:text-white"
            onClick={() => (isFullscreen ? exitFullscreen() : setIsFullscreen(true))}
            title={isFullscreen ? "Exit full screen (Esc)" : "View full screen"}
            aria-label={isFullscreen ? "Exit full screen" : "View full screen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>

        {(showTimestamp || isFullscreen) && (
          <span className="absolute bottom-12 right-2 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/90 sm:bottom-14">
            {now.toLocaleTimeString()}
          </span>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
          <p className="truncate text-sm font-medium text-white">{camera.name}</p>
          <p className="truncate text-xs text-white/70">
            {[camera.code, camera.channel_label || `Channel ${camera.channel ?? "-"}`, camera.status, camera.location_code || camera.location]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {isFullscreen && (
        <div className="flex shrink-0 items-center justify-center gap-3 border-t border-white/10 bg-black/90 px-4 py-2 text-xs text-white/80">
          <span>
            {camera.name}
            {camera.server_name ? ` · ${camera.server_name}` : ""}
            {" · Press Esc or tap minimize to exit"}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            onClick={takeSnapshot}
          >
            <Camera className="mr-1.5 h-3.5 w-3.5" />
            Snapshot
          </Button>
        </div>
      )}
    </div>
  )
})

export default function AllCitiesCamerasPage() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const role = normalizeRole(user?.role)
  const allowed = canViewAllCitiesCameras(user?.role)

  const [servers, setServers] = useState<ServerSummary[]>([])
  const [cameras, setCameras] = useState<CityCamera[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locationFilter, setLocationFilter] = useState<string>("all")
  const [selectedCameraKeys, setSelectedCameraKeys] = useState<string[]>([])
  const [selectionReady, setSelectionReady] = useState(false)
  const [selectionSaving, setSelectionSaving] = useState(false)
  const [layout, setLayout] = useState<GridLayout>("auto")
  const [gridPage, setGridPage] = useState(0)
  const [showTimestamp, setShowTimestamp] = useState(true)
  const [wallFullscreen, setWallFullscreen] = useState(false)
  const [cameraPickerOpen, setCameraPickerOpen] = useState(false)
  const [pickerLocation, setPickerLocation] = useState<string | null>(null)
  const [pickerCameraQuery, setPickerCameraQuery] = useState("")
  const saveTimerRef = useRef<number | null>(null)
  const selectionHydratedRef = useRef(false)
  const lastSavedKeysRef = useRef<string>("")
  const preferenceSetRef = useRef(false)
  const loadGenRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const cameraKey = useCallback(
    (camera: Pick<CityCamera, "server_id" | "id" | "code">) =>
      `${camera.server_id ?? 0}:${camera.id}:${camera.code}`,
    []
  )

  const load = useCallback(async (refresh = false) => {
    // Cancel any in-flight list request so clicks can't stack into a loading loop
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const gen = ++loadGenRef.current

    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    // Soft refresh stays under overall backend ~14s; hard refresh gets a bit more headroom
    const timeoutId = window.setTimeout(() => controller.abort(), refresh ? 18_000 : 16_000)

    try {
      const data = await fetchAllCitiesStreams({
        refresh,
        signal: controller.signal,
      })
      if (gen !== loadGenRef.current) return
      setServers(Array.isArray(data.servers) ? data.servers : [])
      const nextCameras = Array.isArray(data.cameras) ? data.cameras : []
      setCameras((prev) =>
        camerasFingerprint(prev) === camerasFingerprint(nextCameras) ? prev : nextCameras
      )
    } catch (e) {
      if (gen !== loadGenRef.current) return
      if (controller.signal.aborted) {
        setError("Request timed out. Existing cameras kept — try again.")
      } else {
        setError(e instanceof Error ? e.message : "Failed to load streams")
      }
      // Never clear existing cameras on refresh failure (avoids empty↔loading loop)
    } finally {
      window.clearTimeout(timeoutId)
      // Always clear our own flags when we are still the latest generation
      if (gen === loadGenRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!allowed) return
    if (!preferenceSetRef.current) {
      preferenceSetRef.current = true
      setAllCitiesCamerasPreference(true)
    }
    void load(false)
    return () => {
      loadGenRef.current += 1
      abortRef.current?.abort()
    }
  }, [allowed, load])

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    selectionHydratedRef.current = false
    ;(async () => {
      try {
        let keys = await fetchAllCitiesSelection()
        if (keys.length === 0) {
          const legacy = readLegacyLocalSelection()
          if (legacy.length > 0) {
            keys = await saveAllCitiesSelection(legacy)
            clearLegacyLocalSelection()
          }
        } else {
          clearLegacyLocalSelection()
        }
        if (cancelled) return
        lastSavedKeysRef.current = JSON.stringify(keys)
        setSelectedCameraKeys(keys)
      } catch {
        if (cancelled) return
        const legacy = readLegacyLocalSelection()
        lastSavedKeysRef.current = JSON.stringify(legacy)
        setSelectedCameraKeys(legacy)
      } finally {
        if (!cancelled) {
          selectionHydratedRef.current = true
          setSelectionReady(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allowed])

  // Prune stale keys once cameras are known — do not loop or wipe during soft refresh
  useEffect(() => {
    if (!selectionReady || cameras.length === 0) return
    const availableKeys = new Set(cameras.map((camera) => cameraKey(camera)))
    setSelectedCameraKeys((keys) => {
      if (keys.length === 0) return keys
      const next = keys.filter((key) => availableKeys.has(key))
      if (next.length === 0 && keys.length > 0) return keys
      if (next.length === keys.length && next.every((key, i) => key === keys[i])) return keys
      return next
    })
  }, [cameras, cameraKey, selectionReady])

  // Persist selection only after hydrate, and only when it actually changed
  useEffect(() => {
    if (!allowed || !selectionReady || !selectionHydratedRef.current) return
    const serialized = JSON.stringify(selectedCameraKeys)
    if (serialized === lastSavedKeysRef.current) return
    // Avoid wiping DB selection during the cameras-still-loading race
    if (selectedCameraKeys.length === 0 && cameras.length === 0) return

    if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      setSelectionSaving(true)
      void saveAllCitiesSelection(selectedCameraKeys)
        .then((keys) => {
          lastSavedKeysRef.current = JSON.stringify(keys)
        })
        .catch(() => {
          /* keep local selection */
        })
        .finally(() => setSelectionSaving(false))
    }, 500)

    return () => {
      if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current)
    }
  }, [allowed, cameras.length, selectedCameraKeys, selectionReady])

  const handleAllCitiesToggle = (enabled: boolean) => {
    setAllCitiesCamerasPreference(enabled)
    if (!enabled) {
      navigate(role === "IT_SUPERADMIN" ? ROUTES.OPS_CENTRAL : ROUTES.DASHBOARD)
    }
  }

  useEffect(() => {
    if (!wallFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      // Don't exit wall while a layout/menu popup is open
      const menuOpen = document.querySelector('[data-slot="select-content"][data-state="open"]')
      if (menuOpen) return
      setWallFullscreen(false)
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [wallFullscreen])

  const scopedCameras = useMemo(() => {
    if (locationFilter === "all") return cameras
    return cameras.filter((camera) => cameraLocationKey(camera) === locationFilter)
  }, [cameras, locationFilter])

  const cameraStats = useMemo(() => {
    let active = 0
    let offline = 0
    for (const camera of scopedCameras) {
      if (isCameraOnline(camera)) active += 1
      else offline += 1
    }

    const locationNames = new Set<string>()
    if (locationFilter === "all") {
      for (const camera of cameras) locationNames.add(cameraLocationKey(camera))
      for (const server of servers) {
        const key = (server.location_code || server.name || "").trim()
        if (!key) continue
        if (server.ok || ["ok", "online"].includes((server.last_health || "").toLowerCase()) || server.camera_count > 0) {
          locationNames.add(key)
        }
      }
    } else {
      locationNames.add(locationFilter)
    }

    const serversHealthy = servers.filter(
      (server) => server.ok || ["ok", "online"].includes((server.last_health || "").toLowerCase())
    ).length

    return {
      locations: locationFilter === "all" ? locationNames.size : (scopedCameras.length > 0 ? 1 : 0),
      total: scopedCameras.length,
      active,
      offline,
      serversTotal: servers.length,
      serversHealthy,
      selected: selectedCameraKeys.length,
      label: locationFilter === "all" ? "All locations" : locationFilter,
    }
  }, [cameras, locationFilter, scopedCameras, selectedCameraKeys, servers])

  const visibleCameras = useMemo(() => {
    // All locations → selected wall only. Specific location → that site's cameras + stats.
    if (locationFilter !== "all") return scopedCameras
    return scopedCameras.filter((camera) =>
      selectedCameraKeys.includes(`${camera.server_id ?? 0}:${camera.id}:${camera.code}`)
    )
  }, [locationFilter, scopedCameras, selectedCameraKeys])

  const pageSize = gridPageSize(layout)
  const pageCount = Math.max(1, Math.ceil(visibleCameras.length / pageSize))
  const currentGridPage = Math.min(gridPage, pageCount - 1)
  const pagedCameras = useMemo(
    () => visibleCameras.slice(currentGridPage * pageSize, (currentGridPage + 1) * pageSize),
    [currentGridPage, pageSize, visibleCameras]
  )

  const camerasByLocation = useMemo(() => {
    const groups = new Map<string, CityCamera[]>()
    for (const camera of cameras) {
      const location = cameraLocationKey(camera)
      const group = groups.get(location) ?? []
      group.push(camera)
      groups.set(location, group)
    }
    return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right))
  }, [cameras])

  const toggleCamera = (camera: CityCamera) => {
    const key = `${camera.server_id ?? 0}:${camera.id}:${camera.code}`
    setSelectedCameraKeys((keys) => keys.includes(key)
      ? keys.filter((value) => value !== key)
      : [...keys, key])
  }

  const selectLocationCameras = (locationCameras: CityCamera[]) => {
    const keys = locationCameras.map((camera) => `${camera.server_id ?? 0}:${camera.id}:${camera.code}`)
    setSelectedCameraKeys((current) => Array.from(new Set([...current, ...keys])))
  }

  const clearLocationCameras = (locationCameras: CityCamera[]) => {
    const remove = new Set(
      locationCameras.map((camera) => `${camera.server_id ?? 0}:${camera.id}:${camera.code}`)
    )
    setSelectedCameraKeys((current) => current.filter((key) => !remove.has(key)))
  }

  const pickerLocationCameras = useMemo(() => {
    if (!pickerLocation) return []
    return camerasByLocation.find(([location]) => location === pickerLocation)?.[1] ?? []
  }, [camerasByLocation, pickerLocation])

  const filteredPickerCameras = useMemo(() => {
    const q = pickerCameraQuery.trim().toLowerCase()
    if (!q) return pickerLocationCameras
    return pickerLocationCameras.filter((camera) => {
      const haystack = [
        camera.name,
        camera.code,
        camera.channel_label,
        camera.channel != null ? String(camera.channel) : "",
        camera.status,
        camera.server_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [pickerCameraQuery, pickerLocationCameras])

  const pickerLocationSelectedCount = useMemo(() => {
    return pickerLocationCameras.filter((camera) =>
      selectedCameraKeys.includes(`${camera.server_id ?? 0}:${camera.id}:${camera.code}`)
    ).length
  }, [pickerLocationCameras, selectedCameraKeys])

  const filteredPickerSelectedCount = useMemo(() => {
    return filteredPickerCameras.filter((camera) =>
      selectedCameraKeys.includes(`${camera.server_id ?? 0}:${camera.id}:${camera.code}`)
    ).length
  }, [filteredPickerCameras, selectedCameraKeys])

  const openCameraPicker = () => {
    setPickerLocation(null)
    setPickerCameraQuery("")
    setCameraPickerOpen(true)
  }

  const grouped = useMemo(() => {
    const map = new Map<number, { server: ServerSummary | null; cameras: CityCamera[] }>()
    for (const s of servers) {
      map.set(s.id, { server: s, cameras: [] })
    }
    for (const cam of pagedCameras) {
      const sid = cam.server_id ?? 0
      if (!map.has(sid)) {
        map.set(sid, {
          server: {
            id: sid,
            name: cam.server_name || `Server ${sid}`,
            location_code: cam.location_code || "",
            connection_mode: "ml",
            ml_base_url: "",
            last_health: "",
            last_error: "",
            ok: true,
            source: "",
            error: "",
            camera_count: 0,
          },
          cameras: [],
        })
      }
      map.get(sid)!.cameras.push(cam)
    }
    return Array.from(map.values()).filter((g) => g.cameras.length > 0)
  }, [servers, pagedCameras])

  const liveStreamKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const cam of pagedCameras) {
      keys.add(`${cam.server_id ?? 0}:${cam.id}:${cam.code}`)
    }
    return keys
  }, [pagedCameras])

  if (!allowed) {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }

  const cameraGrid = (
    <div className={cn("space-y-8", wallFullscreen && "h-full min-h-0 space-y-2")}>
      {grouped.map(({ server, cameras: cams }) => (
        <section key={server?.id ?? "unknown"} className={wallFullscreen ? "flex min-h-0 flex-1 flex-col" : undefined}>
          <div className={cn("mb-3 flex flex-wrap items-center gap-2", wallFullscreen && "mb-1 shrink-0")}> 
            <Video className="h-4 w-4 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">{server?.name || "Server"}</h2>
            {server?.location_code ? (
              <Badge variant="outline" className="border-border text-foreground">{server.location_code}</Badge>
            ) : null}
            <span className="text-sm text-muted-foreground">
              {cams.length} camera{cams.length === 1 ? "" : "s"}
              {server?.ml_base_url ? ` · ${server.ml_base_url}` : ""}
            </span>
            {server?.error ? (
              <span className="text-xs text-amber-200">{server.error}</span>
            ) : null}
          </div>
          {cams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No live cameras on this server.</p>
          ) : (
            <div
              className={cn("grid gap-3", GRID_CLASS[layout], wallFullscreen && "min-h-0 flex-1 content-start")}
            >
              {cams.map((cam) => {
                const key = `${cam.server_id ?? 0}:${cam.id}:${cam.code}`
                return (
                  <StreamTile
                    key={`${cam.server_id}-${cam.id}-${cam.ml_stream_key || cam.code}`}
                    camera={cam}
                    showTimestamp={showTimestamp}
                    wallMode={wallFullscreen}
                    wallLayout={layout}
                    liveEnabled={liveStreamKeys.has(key)}
                  />
                )
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  )

  const autoCols = autoWallColumns(pagedCameras.length)
  const autoRows = Math.max(1, Math.ceil(Math.max(pagedCameras.length, 1) / autoCols))
  const fixedRows =
    layout === "1x1" ? 1
    : layout === "2x2" ? 2
    : layout === "3x3" ? 3
    : layout === "4x4" ? 4
    : layout === "6x6" ? 6
    : layout === "8x8" ? 8
    : layout === "10x10" ? 10
    : 1
  const fixedRowMin =
    layout === "2x2" ? "44vh"
    : layout === "3x3" ? "30vh"
    : layout === "4x4" ? "23vh"
    : layout === "6x6" ? "15vh"
    : layout === "8x8" ? "11vh"
    : layout === "10x10" ? "9vh"
    : "0"

  const wallCameraGrid = (
    <div
      className={cn(
        "grid h-full min-h-0",
        layout === "1x1" ? "gap-0" : "gap-0.5",
        layout === "auto" ? undefined : GRID_CLASS[layout],
        WALL_GRID_CLASS[layout],
      )}
      style={
        layout === "auto"
          ? {
              gridTemplateColumns: `repeat(${autoCols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${autoRows}, minmax(0, 1fr))`,
            }
          : layout === "1x1"
            ? {
                gridTemplateColumns: "minmax(0, 1fr)",
                gridTemplateRows: "minmax(0, 1fr)",
              }
            : {
                gridTemplateRows: `repeat(${fixedRows}, minmax(${fixedRowMin}, 1fr))`,
              }
      }
    >
      {pagedCameras.map((camera) => {
        const key = `${camera.server_id ?? 0}:${camera.id}:${camera.code}`
        return (
          <StreamTile
            key={`${camera.server_id}-${camera.id}-${camera.ml_stream_key || camera.code}`}
            camera={camera}
            showTimestamp={showTimestamp}
            wallMode
            wallLayout={layout}
            liveEnabled={liveStreamKeys.has(key)}
          />
        )
      })}
    </div>
  )

  return (
    <ModulePageLayout
      title="All Cities Cameras"
      description="Live detected streams from every connected Central Ops server."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <GridLayoutSelect layout={layout} onChange={(value) => { setLayout(value); setGridPage(0) }} />
          <Button
            type="button"
            variant={showTimestamp ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowTimestamp((v) => !v)}
          >
            Timestamp
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setWallFullscreen(true)}
            disabled={cameras.length === 0}
          >
            <Expand className="mr-2 h-4 w-4" />
            Wall view
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            title="Refresh camera list (Shift+click to force live re-fetch from all ML servers)"
            onClick={(e) => void load(e.shiftKey)}
            disabled={loading || refreshing}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      }
    >
      <div className="mb-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {locationFilter === "all" ? "Locations" : "Location"}
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {locationFilter === "all" ? cameraStats.locations : 1}
            </p>
            <p className="truncate text-xs text-muted-foreground">{cameraStats.label}</p>
          </div>
          <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-emerald-800/80">
              <Wifi className="h-3.5 w-3.5" />
              Active cameras
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-900">{cameraStats.active}</p>
            <p className="text-xs text-emerald-800/70">Online / connected</p>
          </div>
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-amber-900/80">
              <WifiOff className="h-3.5 w-3.5" />
              Offline cameras
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-950">{cameraStats.offline}</p>
            <p className="text-xs text-amber-900/70">No live feed</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Video className="h-3.5 w-3.5" />
              Total cameras
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{cameraStats.total}</p>
            <p className="text-xs text-muted-foreground">
              {locationFilter === "all"
                ? `${visibleCameras.length} selected on wall`
                : `${visibleCameras.length} at this location`}
            </p>
          </div>
          <div className="rounded-lg border border-sky-200/80 bg-sky-50/60 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-sky-800/80">
              <Server className="h-3.5 w-3.5" />
              Servers
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-sky-950">{cameraStats.serversTotal}</p>
            <p className="text-xs text-sky-800/70">
              {cameraStats.serversHealthy} healthy
              {cameraStats.serversTotal - cameraStats.serversHealthy > 0
                ? ` · ${cameraStats.serversTotal - cameraStats.serversHealthy} issue`
                : ""}
            </p>
          </div>
          <div className="rounded-lg border border-cyan-200/80 bg-cyan-50/60 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-cyan-800/80">
              <MonitorPlay className="h-3.5 w-3.5" />
              On wall
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-cyan-950">{visibleCameras.length}</p>
            <p className="text-xs text-cyan-800/70">
              {cameraStats.selected} selected · live now
            </p>
          </div>
        </div>

        {locationFilter !== "all" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              Showing <span className="font-medium text-foreground">{locationFilter}</span>
              {" — "}
              {cameraStats.active} active, {cameraStats.offline} offline, {cameraStats.total} cameras on wall
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => {
                setLocationFilter("all")
                setGridPage(0)
              }}
            >
              Back to all
            </Button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          <Select
            value={locationFilter}
            onValueChange={(value) => {
              setLocationFilter(value)
              setGridPage(0)
            }}
          >
            <SelectTrigger id="all-cities-location" className="w-48">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {camerasByLocation.map(([location]) => (
                <SelectItem key={location} value={location}>{location}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={openCameraPicker} className="gap-2">
            <MapPin className="h-4 w-4" />
            Select cameras
          </Button>
        </div>
      </div>

      <Dialog
        open={cameraPickerOpen}
        onOpenChange={(open) => {
          setCameraPickerOpen(open)
          if (!open) {
            setPickerLocation(null)
            setPickerCameraQuery("")
          }
        }}
      >
        <DialogContent className="flex max-h-[85vh] w-[min(96vw,40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
            <DialogTitle className="flex items-center gap-2">
              {pickerLocation ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setPickerLocation(null)
                      setPickerCameraQuery("")
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Back to locations"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {pickerLocation}
                </>
              ) : (
                <>
                  <MapPin className="h-5 w-5 text-sky-600" />
                  Choose location
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {pickerLocation
                ? "Search and select the cameras you want on the wall for this location."
                : "Pick a city first, then choose cameras."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {!pickerLocation ? (
              camerasByLocation.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Server className="h-10 w-10 opacity-40" />
                  <p className="text-sm">No locations available yet.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {camerasByLocation.map(([location, locationCameras]) => {
                    const selectedCount = locationCameras.filter((camera) =>
                      selectedCameraKeys.includes(`${camera.server_id ?? 0}:${camera.id}:${camera.code}`)
                    ).length
                    return (
                      <button
                        key={location}
                        type="button"
                        onClick={() => {
                          setPickerCameraQuery("")
                          setPickerLocation(location)
                        }}
                        className="group flex w-full items-center gap-3 rounded-xl border border-transparent bg-muted/40 px-3 py-3 text-left transition-all hover:border-sky-200 hover:bg-sky-50/80"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-border">
                          <MapPin className="h-4 w-4 text-sky-600" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">{location}</span>
                          <span className="text-xs text-muted-foreground">
                            {locationCameras.length} camera{locationCameras.length === 1 ? "" : "s"}
                            {selectedCount > 0 ? ` · ${selectedCount} selected` : ""}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" />
                      </button>
                    )
                  })}
                </div>
              )
            ) : (
              <div className="space-y-3">
                <div className="relative px-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={pickerCameraQuery}
                    onChange={(e) => setPickerCameraQuery(e.target.value)}
                    placeholder="Search cameras by name, code, or channel…"
                    className="h-10 pl-9"
                    autoFocus
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <p className="text-xs text-muted-foreground">
                    {pickerCameraQuery.trim()
                      ? `${filteredPickerSelectedCount} selected · ${filteredPickerCameras.length} match${filteredPickerCameras.length === 1 ? "" : "es"}`
                      : `${pickerLocationSelectedCount} of ${pickerLocationCameras.length} selected`}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => selectLocationCameras(filteredPickerCameras)}
                      disabled={filteredPickerCameras.length === 0}
                    >
                      Select all
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => clearLocationCameras(filteredPickerCameras)}
                      disabled={filteredPickerSelectedCount === 0}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  {filteredPickerCameras.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                      <Search className="h-8 w-8 opacity-40" />
                      <p className="text-sm">No cameras match “{pickerCameraQuery.trim()}”.</p>
                    </div>
                  ) : (
                    filteredPickerCameras.map((camera) => {
                      const key = `${camera.server_id ?? 0}:${camera.id}:${camera.code}`
                      const checked = selectedCameraKeys.includes(key)
                      return (
                        <label
                          key={key}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                            checked
                              ? "border-sky-200 bg-sky-50/70"
                              : "border-transparent bg-muted/30 hover:bg-muted/60",
                          )}
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleCamera(camera)} />
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/90 text-white">
                            <Video className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{camera.name || camera.code}</span>
                            <span className="text-xs text-muted-foreground">
                              {[camera.code, camera.channel_label || `Ch ${camera.channel ?? "-"}`, camera.status]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t border-border px-5 py-3 sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {selectedCameraKeys.length} camera{selectedCameraKeys.length === 1 ? "" : "s"} on wall
            </p>
            <div className="flex gap-2">
              {pickerLocation ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPickerLocation(null)
                    setPickerCameraQuery("")
                  }}
                >
                  Back
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={() => {
                  if (selectionReady) {
                    if (saveTimerRef.current != null) {
                      window.clearTimeout(saveTimerRef.current)
                      saveTimerRef.current = null
                    }
                    const keys = [...selectedCameraKeys]
                    setSelectionSaving(true)
                    void saveAllCitiesSelection(keys)
                      .then((savedKeys) => {
                        lastSavedKeysRef.current = JSON.stringify(savedKeys)
                      })
                      .catch(() => {
                        /* the next load can retry the selection */
                      })
                      .finally(() => setSelectionSaving(false))
                  }
                  setCameraPickerOpen(false)
                }}
              >
                Done
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && cameras.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading streams from connected servers…
        </div>
      ) : cameras.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
          <Server className="h-10 w-10 opacity-40" />
          <p className="text-sm">No cameras yet. Connect ML servers in Central Ops first.</p>
        </div>
      ) : visibleCameras.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          {locationFilter === "all"
            ? "Select cameras above to display them."
            : `No cameras found for ${locationFilter}.`}
        </div>
      ) : (
        cameraGrid
      )}

      {wallFullscreen && visibleCameras.length > 0 && (
        <div className="fixed inset-0 z-[190] flex flex-col bg-black">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
            <p className="truncate text-sm font-medium text-white">
              All Cities Wall · {visibleCameras.length} camera
              {visibleCameras.length === 1 ? "" : "s"}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <GridLayoutSelect
                layout={layout}
                tone="dark"
                onChange={(value) => { setLayout(value); setGridPage(0) }}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => setGridPage((page) => Math.max(0, page - 1))}
                disabled={currentGridPage === 0}
                title="Previous cameras"
                aria-label="Previous cameras"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-14 text-center text-xs text-white/80">
                {currentGridPage + 1} / {pageCount}
              </span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => setGridPage((page) => Math.min(pageCount - 1, page + 1))}
                disabled={currentGridPage >= pageCount - 1}
                title="Next cameras"
                aria-label="Next cameras"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                title="Refresh camera list (Shift+click to force live re-fetch)"
                onClick={(e) => void load(e.shiftKey)}
                disabled={loading || refreshing}
              >
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", refreshing && "animate-spin")} />
                Refresh
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8"
                onClick={() => setWallFullscreen(false)}
              >
                <Minimize2 className="mr-1.5 h-3.5 w-3.5" />
                Exit wall (Esc)
              </Button>
            </div>
          </div>
          <div
            className={cn(
              "min-h-0 flex-1 p-0",
              layout === "auto" || layout === "1x1" ? "overflow-hidden" : "overflow-y-auto",
            )}
          >
            {wallCameraGrid}
          </div>
        </div>
      )}
    </ModulePageLayout>
  )
}
