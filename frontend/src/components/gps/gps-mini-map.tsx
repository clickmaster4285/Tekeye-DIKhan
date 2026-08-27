import { useEffect, useRef } from "react"
import type { GpsHistoryPoint } from "@/lib/gps-tracking-api"
import { GPS_DEFAULT_CENTER, loadLeaflet } from "@/components/gps/officer-gps-map"

export function GpsMiniMap({ points }: { points: GpsHistoryPoint[] }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let map: { remove: () => void; invalidateSize: () => void; fitBounds: (b: unknown, o?: unknown) => void; setView: (ll: [number, number], z: number) => void } | null =
      null
    let cancelled = false

    loadLeaflet().then((L) => {
      if (cancelled || !ref.current) return
      map = L.map(ref.current, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false })
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(map)
      const pts = points.map((p) => [p.latitude, p.longitude] as [number, number])
      if (pts.length >= 2) {
        const line = L.polyline(pts, { color: "#155DFC", weight: 3 }).addTo(map)
        try {
          map.fitBounds(L.featureGroup([line]).getBounds().pad(0.3), { maxZoom: 15 })
        } catch {
          map.setView(pts[0], 13)
        }
      } else if (pts.length === 1) {
        map.setView(pts[0], 14)
        L.circle(pts[0], { radius: 40, color: "#155DFC", fillOpacity: 0.3 }).addTo(map)
      } else {
        map.setView(GPS_DEFAULT_CENTER, 11)
      }
      requestAnimationFrame(() => map?.invalidateSize())
    })

    return () => {
      cancelled = true
      map?.remove()
    }
  }, [points])

  return <div ref={ref} className="h-[140px] w-full overflow-hidden rounded-md border bg-muted" />
}
