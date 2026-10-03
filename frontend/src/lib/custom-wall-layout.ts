/** Custom wall — cameras in the center; widgets dock left/right/top/bottom. */

export type WallWidgetId = "gps" | "alerts" | "analytics"
export type WallDock = "left" | "right" | "top" | "bottom"

export type CustomWallDesign = {
  showCameras: true
  docks: Record<WallDock, WallWidgetId[]>
  /** Horizontal share for left / right docks (% of width). */
  leftSize: number
  rightSize: number
  /** Vertical share for top / bottom docks (% of height). */
  topSize: number
  bottomSize: number
}

export const CUSTOM_WALL_STORAGE_KEY = "tekeye-custom-wall-design-v3"

export const WALL_DOCKS: { id: WallDock; label: string }[] = [
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
  { id: "top", label: "Top" },
  { id: "bottom", label: "Bottom" },
]

export const WALL_WIDGET_CATALOG: {
  id: WallWidgetId
  label: string
  hint: string
}[] = [
  { id: "gps", label: "GPS tracking", hint: "Live officer map" },
  { id: "alerts", label: "Live detections", hint: "All detections + search" },
  { id: "analytics", label: "Analytics", hint: "Detection stats" },
]

export const DEFAULT_CUSTOM_WALL: CustomWallDesign = {
  showCameras: true,
  docks: { left: [], right: [], top: [], bottom: [] },
  leftSize: 22,
  rightSize: 24,
  topSize: 20,
  bottomSize: 20,
}

const VALID_WIDGET = new Set<WallWidgetId>(["gps", "alerts", "analytics"])
const VALID_DOCK = new Set<WallDock>(["left", "right", "top", "bottom"])

function emptyDocks(): Record<WallDock, WallWidgetId[]> {
  return { left: [], right: [], top: [], bottom: [] }
}

function normalizeList(raw: unknown): WallWidgetId[] {
  if (!Array.isArray(raw)) return []
  const out: WallWidgetId[] = []
  for (const item of raw) {
    if (typeof item === "string" && VALID_WIDGET.has(item as WallWidgetId) && !out.includes(item as WallWidgetId)) {
      out.push(item as WallWidgetId)
    }
  }
  return out
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

/** All widget ids currently on the wall (any dock). */
export function allPlacedWidgets(design: CustomWallDesign): WallWidgetId[] {
  return ([...design.docks.left, ...design.docks.right, ...design.docks.top, ...design.docks.bottom])
}

export function findWidgetDock(design: CustomWallDesign, id: WallWidgetId): WallDock | null {
  for (const dock of WALL_DOCKS) {
    if (design.docks[dock.id].includes(id)) return dock.id
  }
  return null
}

export function isWidgetEnabled(design: CustomWallDesign, id: WallWidgetId): boolean {
  return findWidgetDock(design, id) != null
}

function migrateLegacy(raw: string): CustomWallDesign | null {
  try {
    const parsed = JSON.parse(raw) as {
      showGps?: boolean
      showAlerts?: boolean
      widgets?: unknown
      camerasSize?: number
      docks?: Partial<Record<WallDock, unknown>>
    }
    if (parsed.docks && typeof parsed.docks === "object") return null

    const docks = emptyDocks()
    if (Array.isArray(parsed.widgets)) {
      docks.right = normalizeList(parsed.widgets)
    } else {
      if (parsed.showGps) docks.right.push("gps")
      if (parsed.showAlerts) docks.right.push("alerts")
    }
    const side = clamp(100 - (Number(parsed.camerasSize) || 68), 18, 40)
    return {
      ...DEFAULT_CUSTOM_WALL,
      docks,
      rightSize: docks.right.length ? side : DEFAULT_CUSTOM_WALL.rightSize,
    }
  } catch {
    return null
  }
}

export function loadCustomWallDesign(): CustomWallDesign {
  try {
    const v3 = localStorage.getItem(CUSTOM_WALL_STORAGE_KEY)
    if (v3) {
      const parsed = JSON.parse(v3) as Partial<CustomWallDesign>
      const docks = emptyDocks()
      for (const dock of WALL_DOCKS) {
        docks[dock.id] = normalizeList(parsed.docks?.[dock.id])
      }
      // Ensure each widget appears in at most one dock
      const seen = new Set<WallWidgetId>()
      for (const dock of WALL_DOCKS) {
        docks[dock.id] = docks[dock.id].filter((id) => {
          if (seen.has(id)) return false
          seen.add(id)
          return true
        })
      }
      return {
        showCameras: true,
        docks,
        leftSize: clamp(Number(parsed.leftSize) || 22, 14, 28),
        rightSize: clamp(Number(parsed.rightSize) || 24, 14, 28),
        topSize: clamp(Number(parsed.topSize) || 20, 12, 26),
        bottomSize: clamp(Number(parsed.bottomSize) || 20, 12, 26),
      }
    }
    for (const key of ["tekeye-custom-wall-design-v2", "tekeye-custom-wall-design-v1"]) {
      const legacy = localStorage.getItem(key)
      if (!legacy) continue
      const migrated = migrateLegacy(legacy)
      if (migrated) {
        saveCustomWallDesign(migrated)
        return migrated
      }
    }
    return {
      ...DEFAULT_CUSTOM_WALL,
      docks: emptyDocks(),
    }
  } catch {
    return { ...DEFAULT_CUSTOM_WALL, docks: emptyDocks() }
  }
}

export function saveCustomWallDesign(design: CustomWallDesign): void {
  try {
    localStorage.setItem(
      CUSTOM_WALL_STORAGE_KEY,
      JSON.stringify({
        docks: design.docks,
        leftSize: design.leftSize,
        rightSize: design.rightSize,
        topSize: design.topSize,
        bottomSize: design.bottomSize,
      }),
    )
  } catch {
    /* ignore */
  }
}

function stripWidget(docks: Record<WallDock, WallWidgetId[]>, id: WallWidgetId) {
  const next = emptyDocks()
  for (const dock of WALL_DOCKS) {
    next[dock.id] = docks[dock.id].filter((w) => w !== id)
  }
  return next
}

/** Toggle widget on a preferred dock (default right). */
export function toggleWallWidget(
  design: CustomWallDesign,
  id: WallWidgetId,
  preferredDock: WallDock = "right",
): CustomWallDesign {
  if (findWidgetDock(design, id)) {
    return { ...design, docks: stripWidget(design.docks, id) }
  }
  const docks = stripWidget(design.docks, id)
  const dock = VALID_DOCK.has(preferredDock) ? preferredDock : "right"
  docks[dock] = [...docks[dock], id]
  return { ...design, docks }
}

/** Place (or move) widget onto a dock at an optional index. */
export function placeWallWidget(
  design: CustomWallDesign,
  id: WallWidgetId,
  dock: WallDock,
  atIndex?: number,
): CustomWallDesign {
  if (!VALID_WIDGET.has(id) || !VALID_DOCK.has(dock)) return design
  const docks = stripWidget(design.docks, id)
  const list = [...docks[dock]]
  const idx = atIndex == null ? list.length : clamp(atIndex, 0, list.length)
  list.splice(idx, 0, id)
  docks[dock] = list
  return { ...design, docks }
}

export function reorderInDock(
  design: CustomWallDesign,
  dock: WallDock,
  fromIndex: number,
  toIndex: number,
): CustomWallDesign {
  const list = [...design.docks[dock]]
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length
  ) {
    return design
  }
  const [item] = list.splice(fromIndex, 1)
  list.splice(toIndex, 0, item)
  return { ...design, docks: { ...design.docks, [dock]: list } }
}

export function moveWallWidget(
  design: CustomWallDesign,
  id: WallWidgetId,
  direction: "up" | "down",
): CustomWallDesign {
  const dock = findWidgetDock(design, id)
  if (!dock) return design
  const idx = design.docks[dock].indexOf(id)
  const swap = direction === "up" ? idx - 1 : idx + 1
  return reorderInDock(design, dock, idx, swap)
}

/** @deprecated use placeWallWidget / reorderInDock */
export function reorderWallWidgets(
  design: CustomWallDesign,
  fromIndex: number,
  toIndex: number,
): CustomWallDesign {
  // Legacy: treat as reorder within right dock
  return reorderInDock(design, "right", fromIndex, toIndex)
}

export function hasAnySidePanel(design: CustomWallDesign): boolean {
  return allPlacedWidgets(design).length > 0
}
