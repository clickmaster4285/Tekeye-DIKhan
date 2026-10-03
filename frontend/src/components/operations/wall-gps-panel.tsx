"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { MapPin, Radio } from "lucide-react"
import { OfficerGpsMap, GPS_DEFAULT_CENTER } from "@/components/gps/officer-gps-map"
import { Badge } from "@/components/ui/badge"
import { fetchGpsLive } from "@/lib/gps-tracking-api"
import { geofencesForStation, stationCenter } from "@/lib/gps-geofences"
import { getStoredUser } from "@/lib/auth"
import { canSeeAllLocations } from "@/lib/location-access"
import { cn } from "@/lib/utils"

/** Compact GPS map for the custom wall (dark shell). */
export function WallGpsPanel({ className }: { className?: string }) {
  const user = getStoredUser()
  const allStations = canSeeAllLocations(user?.role)
  const station = allStations ? "all" : user?.location || "all"
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["wall-gps-live", station],
    queryFn: () => fetchGpsLive(station === "all" ? undefined : station),
    refetchInterval: 8_000,
    refetchOnWindowFocus: true,
  })

  const officers = data || []
  const liveCount = officers.filter((o) => o.status === "live").length
  const center = useMemo((): [number, number] => {
    if (station !== "all") {
      const c = stationCenter(station)
      if (c) return c
    }
    return GPS_DEFAULT_CENTER
  }, [station])

  const geofences = geofencesForStation(station)

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-zinc-950", className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-white/80">
            GPS tracking
          </p>
        </div>
        <Badge className="border-0 bg-emerald-500/15 text-[10px] font-medium text-emerald-300">
          <Radio className="mr-1 h-3 w-3" />
          {isLoading ? "…" : `${liveCount} live`}
        </Badge>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden isolation-isolate">
        {isError ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-white/50">
            GPS feed unavailable
          </div>
        ) : (
          <OfficerGpsMap
            officers={officers}
            selectedUserId={selectedUserId}
            trail={[]}
            geofences={geofences}
            showGeofences
            focus={null}
            fitTrailToken={0}
            defaultCenter={center}
            onSelect={setSelectedUserId}
            className="!min-h-0 h-full bg-zinc-900"
          />
        )}
      </div>
    </div>
  )
}
