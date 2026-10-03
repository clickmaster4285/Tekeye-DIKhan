"use client"

import { useState, type DragEvent } from "react"
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  GripVertical,
  LayoutDashboard,
  MapPin,
  Plus,
  ScanEye,
  Video,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  WALL_DOCKS,
  WALL_WIDGET_CATALOG,
  findWidgetDock,
  isWidgetEnabled,
  moveWallWidget,
  placeWallWidget,
  reorderInDock,
  toggleWallWidget,
  type CustomWallDesign,
  type WallDock,
  type WallWidgetId,
} from "@/lib/custom-wall-layout"
import { cn } from "@/lib/utils"

const WIDGET_ICON: Record<WallWidgetId, typeof MapPin> = {
  gps: MapPin,
  alerts: ScanEye,
  analytics: BarChart3,
}

const WIDGET_COLOR: Record<WallWidgetId, string> = {
  gps: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  alerts: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  analytics: "border-violet-500/40 bg-violet-500/15 text-violet-300",
}

const DND_TYPE = "application/x-tekeye-wall-widget"

type DragPayload =
  | { kind: "reorder"; id: WallWidgetId; dock: WallDock; fromIndex: number }
  | { kind: "catalog"; id: WallWidgetId }

function readPayload(e: DragEvent): DragPayload | null {
  try {
    const raw = e.dataTransfer.getData(DND_TYPE) || e.dataTransfer.getData("text/plain")
    if (!raw) return null
    return JSON.parse(raw) as DragPayload
  } catch {
    return null
  }
}

/** Widgets button — add to left/right/top/bottom and drag to rearrange. */
export function WallWidgetPicker({
  design,
  onChange,
}: {
  design: CustomWallDesign
  onChange: (next: CustomWallDesign) => void
}) {
  const [dropTarget, setDropTarget] = useState<{ dock: WallDock; index: number } | null>(null)
  const [placeDock, setPlaceDock] = useState<WallDock>("right")
  const activeCount = WALL_DOCKS.reduce((n, d) => n + design.docks[d.id].length, 0)

  const onDropAt = (e: DragEvent, dock: WallDock, toIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    setDropTarget(null)
    const payload = readPayload(e)
    if (!payload) return
    if (payload.kind === "catalog") {
      onChange(placeWallWidget(design, payload.id, dock, toIndex))
      return
    }
    if (payload.dock === dock) {
      onChange(reorderInDock(design, dock, payload.fromIndex, Math.min(toIndex, design.docks[dock].length - 1)))
      return
    }
    onChange(placeWallWidget(design, payload.id, dock, toIndex))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 hover:text-white"
          title="Add panels anywhere on the wall"
          aria-label="Add wall panels"
        >
          <Plus className="h-3.5 w-3.5" />
          <LayoutDashboard className="hidden h-3.5 w-3.5 sm:inline" />
          <span className="hidden sm:inline">Widgets</span>
          {activeCount > 0 ? (
            <span className="rounded-full bg-emerald-400/20 px-1.5 text-[10px] font-semibold tabular-nums text-emerald-200">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="z-[270] w-[22rem] border-white/10 bg-zinc-950 p-3 text-white shadow-2xl"
      >
        <div className="mb-3">
          <p className="text-sm font-semibold text-white">Wall widgets</p>
          <p className="text-[11px] text-white/50">
            Cameras stay in the center. Place GPS, detections, or analytics on any side.
          </p>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-sky-500/30 bg-sky-500/15 text-sky-300">
            <Video className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white">Cameras</p>
            <p className="text-[10px] text-white/45">Fixed in the center</p>
          </div>
          <Check className="h-4 w-4 text-sky-400" />
        </div>

        <div className="mb-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
            Click adds to
          </p>
          <div className="grid grid-cols-4 gap-1">
            {WALL_DOCKS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setPlaceDock(d.id)}
                className={cn(
                  "rounded-md border px-1 py-1.5 text-[10px] font-semibold transition",
                  placeDock === d.id
                    ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                    : "border-white/10 bg-white/[0.02] text-white/55 hover:bg-white/5",
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {WALL_WIDGET_CATALOG.map((item) => {
            const Icon = WIDGET_ICON[item.id]
            const on = isWidgetEnabled(design, item.id)
            const dock = findWidgetDock(design, item.id)
            return (
              <button
                key={item.id}
                type="button"
                draggable
                onDragStart={(e) => {
                  const payload: DragPayload = { kind: "catalog", id: item.id }
                  e.dataTransfer.setData(DND_TYPE, JSON.stringify(payload))
                  e.dataTransfer.setData("text/plain", JSON.stringify(payload))
                  e.dataTransfer.effectAllowed = "copyMove"
                }}
                onClick={() => onChange(toggleWallWidget(design, item.id, placeDock))}
                className={cn(
                  "flex cursor-grab flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center transition active:cursor-grabbing",
                  on
                    ? WIDGET_COLOR[item.id]
                    : "border-white/10 bg-white/[0.02] text-white/55 hover:border-white/25 hover:text-white",
                )}
                title={on ? `On ${dock} — click to remove` : `Add to ${placeDock}`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-semibold leading-tight">{item.label}</span>
                {on ? (
                  <span className="text-[9px] capitalize opacity-80">{dock}</span>
                ) : (
                  <Plus className="h-3 w-3 opacity-50" />
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto border-t border-white/10 pt-3">
          {WALL_DOCKS.map((dock) => {
            const list = design.docks[dock.id]
            return (
              <div
                key={dock.id}
                className={cn(
                  "rounded-md border border-white/10 p-2",
                  dropTarget?.dock === dock.id && "border-emerald-400/40 bg-emerald-500/5",
                )}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDropTarget({ dock: dock.id, index: list.length })
                }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => onDropAt(e, dock.id, list.length)}
              >
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                  {dock.label}
                </p>
                {list.length === 0 ? (
                  <div className="rounded border border-dashed border-white/15 px-2 py-3 text-center text-[10px] text-white/35">
                    Drop here
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {list.map((id, index) => {
                      const meta = WALL_WIDGET_CATALOG.find((w) => w.id === id)
                      const Icon = WIDGET_ICON[id]
                      return (
                        <li
                          key={id}
                          draggable
                          onDragStart={(e) => {
                            const payload: DragPayload = {
                              kind: "reorder",
                              id,
                              dock: dock.id,
                              fromIndex: index,
                            }
                            e.dataTransfer.setData(DND_TYPE, JSON.stringify(payload))
                            e.dataTransfer.setData("text/plain", JSON.stringify(payload))
                            e.dataTransfer.effectAllowed = "move"
                          }}
                          onDragOver={(e) => {
                            e.preventDefault()
                            setDropTarget({ dock: dock.id, index })
                          }}
                          onDrop={(e) => onDropAt(e, dock.id, index)}
                          className={cn(
                            "flex cursor-grab items-center gap-1.5 rounded border border-white/10 bg-white/[0.03] px-1.5 py-1 active:cursor-grabbing",
                            dropTarget?.dock === dock.id &&
                              dropTarget.index === index &&
                              "border-emerald-400/50 bg-emerald-500/10",
                          )}
                        >
                          <GripVertical className="h-3 w-3 text-white/35" />
                          <Icon className="h-3 w-3 text-white/70" />
                          <span className="min-w-0 flex-1 truncate text-[11px]">{meta?.label}</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5 text-white/50 hover:bg-white/10 hover:text-white"
                            disabled={index === 0}
                            onClick={() => onChange(moveWallWidget(design, id, "up"))}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5 text-white/50 hover:bg-white/10 hover:text-white"
                            disabled={index === list.length - 1}
                            onClick={() => onChange(moveWallWidget(design, id, "down"))}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
