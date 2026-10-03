import { useEffect, useMemo } from "react"
import { Link } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, AlertTriangle, Info, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  fetchDetectionEventsPage,
  type DetectionEvent,
} from "@/lib/cameras-api"
import { REALTIME_INVALIDATE_EVENT } from "@/lib/realtime-socket"
import { ROUTES } from "@/routes/config"

type AlertType = "critical" | "warning" | "info"

type LiveAlertItem = {
  id: number
  title: string
  city: string
  badge: string
  badgeColor: string
  time: string
  type: AlertType
  className: string
}

function alertTitle(className: string): string {
  const cls = (className || "").toLowerCase()
  if (cls === "crowd") return "Crowd Alert"
  if (cls === "fire" || cls.includes("flame") || cls.includes("burning")) return "Fire Alert"
  if (cls === "smoke") return "Smoke Alert"
  if (
    cls === "weapon" ||
    cls.includes("weapon") ||
    cls === "gun" ||
    cls === "pistol" ||
    cls === "rifle" ||
    cls === "firearm" ||
    cls === "knife" ||
    cls === "knife_weapon"
  ) {
    return "Weapon Alert"
  }
  const pretty = (className || "").trim().replace(/[_-]+/g, " ")
  if (!pretty) return "Security Alert"
  return `${pretty.replace(/\b\w/g, (c) => c.toUpperCase())} Alert`
}

function alertType(className: string): AlertType {
  const cls = (className || "").toLowerCase()
  if (
    cls === "weapon" ||
    cls.includes("weapon") ||
    cls === "gun" ||
    cls === "pistol" ||
    cls === "rifle" ||
    cls === "firearm" ||
    cls === "knife" ||
    cls === "knife_weapon" ||
    cls === "fire" ||
    cls.includes("flame") ||
    cls.includes("burning")
  ) {
    return "critical"
  }
  if (cls === "smoke" || cls === "crowd") return "warning"
  return "info"
}

function formatRelativeTime(iso: string): string {
  const ts = new Date(iso).getTime()
  if (!Number.isFinite(ts)) return ""
  const diffSec = Math.round((Date.now() - ts) / 1000)
  if (diffSec < 45) return "Just now"
  if (diffSec < 3600) {
    const m = Math.max(1, Math.floor(diffSec / 60))
    return `${m} min ago`
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600)
    return h === 1 ? "1 hour ago" : `${h} hours ago`
  }
  const d = Math.floor(diffSec / 86400)
  return d === 1 ? "1 day ago" : `${d} days ago`
}

function toLiveAlert(row: DetectionEvent): LiveAlertItem {
  const cls = row.class_name || ""
  const city =
    row.site_name ||
    row.site_code ||
    row.camera_name ||
    row.name ||
    row.camera_code ||
    "—"
  const zone = (row.zone || "").trim()
  return {
    id: row.id,
    title: alertTitle(cls),
    city,
    badge: zone && zone !== "—" ? zone.slice(0, 12) : "AI",
    badgeColor: zone && zone !== "—" ? "bg-purple-600" : "bg-cyan-600",
    time: formatRelativeTime(row.created_at),
    type: alertType(cls),
    className: cls,
  }
}

const getAlertIcon = (type: AlertType) => {
  switch (type) {
    case "critical":
      return <AlertCircle className="h-5 w-5" />
    case "warning":
      return <AlertTriangle className="h-5 w-5" />
    case "info":
      return <Info className="h-5 w-5" />
  }
}

const getAlertBgColor = (type: AlertType) => {
  switch (type) {
    case "critical":
      return "bg-red-500/20 text-red-400"
    case "warning":
      return "bg-yellow-500/20 text-yellow-400"
    case "info":
      return "bg-cyan-500/20 text-cyan-400"
  }
}

const getAlertBorderColor = (type: AlertType) => {
  switch (type) {
    case "critical":
      return "border-l-red-500"
    case "warning":
      return "border-l-yellow-500"
    case "info":
      return "border-l-cyan-500"
  }
}

export function LiveAlerts() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-live-alerts"],
    queryFn: () => fetchDetectionEventsPage({ is_alert: true, page: 1, page_size: 20 }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    const onRealtime = (e: Event) => {
      const domains = (e as CustomEvent<{ domains?: string[] }>).detail?.domains || []
      if (domains.some((d) => ["alerts", "detections", "cameras"].includes(d))) {
        void queryClient.invalidateQueries({ queryKey: ["dashboard-live-alerts"] })
      }
    }
    window.addEventListener(REALTIME_INVALIDATE_EVENT, onRealtime)
    return () => window.removeEventListener(REALTIME_INVALIDATE_EVENT, onRealtime)
  }, [queryClient])

  const alerts = useMemo(
    () => (data?.results || []).map(toLiveAlert),
    [data?.results],
  )
  const criticalCount = alerts.filter((a) => a.type === "critical").length

  return (
    <Card className="min-w-0 overflow-hidden rounded-[10px] border-gray-200 bg-white flex flex-col">
      <CardContent className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-5 sm:px-6 sm:py-6 border-b border-gray-200">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-black sm:text-2xl">Live Alerts</h2>
            <p className="mt-1 text-xs text-gray-600">Real-time incident feed</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-6 items-center gap-1.5 rounded-full bg-red-100 px-2.5 text-xs font-semibold text-red-600 border border-red-200 flex-shrink-0">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
              {criticalCount} Critical
            </span>
            <Button
              variant="ghost"
              className="text-blue-500 hover:bg-blue-50 hover:text-blue-600 px-0 flex-shrink-0"
              asChild
            >
              <Link to={`${ROUTES.OBJECT_DETECTION}?alert=1`}>
                <span className="text-sm font-medium">View All</span>
                <span className="text-lg ml-1">→</span>
              </Link>
            </Button>
          </div>
        </div>
        <div className="overflow-y-auto max-h-[320px]">
          <div className="space-y-0 px-4 pt-4 pb-0 sm:px-6 sm:pt-5 sm:pb-0">
            {isLoading && alerts.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">Loading alerts…</p>
            ) : alerts.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No live alerts right now</p>
            ) : (
              alerts.map((alert) => (
                <Link
                  key={alert.id}
                  to={`${ROUTES.OBJECT_DETECTION}?alert=1&q=${encodeURIComponent(alert.className || "")}`}
                  className={`flex gap-3 border-l-4 pl-4 py-3 transition-colors hover:bg-gray-50 ${getAlertBorderColor(alert.type)}`}
                >
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full flex-none mt-1 text-white ${getAlertBgColor(alert.type)}`}
                  >
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-black">{alert.title}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-gray-600">{alert.city}</span>
                      <span className="text-gray-400">•</span>
                      <span
                        className={`inline-block text-xs font-semibold text-white px-2 py-1 rounded ${alert.badgeColor}`}
                      >
                        {alert.badge}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500 flex-none">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs">{alert.time}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
