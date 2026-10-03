"use client"

import { useQuery } from "@tanstack/react-query"
import { Activity, BarChart3, Siren } from "lucide-react"
import { fetchDetectionSummary } from "@/lib/cameras-api"
import { cn } from "@/lib/utils"

/** Compact analytics strip for the custom wall. */
export function WallAnalyticsPanel({
  className,
  cameraCount,
  onlineCount,
}: {
  className?: string
  cameraCount?: number
  onlineCount?: number
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["wall-detection-summary"],
    queryFn: fetchDetectionSummary,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })

  const cards = [
    {
      label: "Cameras on wall",
      value: cameraCount != null ? String(cameraCount) : "—",
      sub: onlineCount != null ? `${onlineCount} online` : undefined,
      icon: Activity,
      tone: "text-sky-300",
    },
    {
      label: "Detections today",
      value: isLoading ? "…" : String(data?.detections_today ?? 0),
      icon: BarChart3,
      tone: "text-emerald-300",
    },
    {
      label: "Alerts today",
      value: isLoading ? "…" : String(data?.alerts_today ?? 0),
      icon: Siren,
      tone: "text-amber-300",
    },
    {
      label: "Classes tracked",
      value: isLoading ? "…" : String(data?.classes_tracked ?? 0),
      icon: BarChart3,
      tone: "text-violet-300",
    },
  ]

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-zinc-950", className)}>
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
        <BarChart3 className="h-3.5 w-3.5 text-violet-400" />
        <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Analytics</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5"
            >
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/45">
                <card.icon className={cn("h-3 w-3", card.tone)} />
                {card.label}
              </div>
              <p className="mt-1 text-xl font-semibold tabular-nums text-white">{card.value}</p>
              {card.sub ? <p className="text-[10px] text-white/40">{card.sub}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
