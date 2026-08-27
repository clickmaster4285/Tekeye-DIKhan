"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

const severityColor = (severity: string) => {
  switch (severity) {
    case "critical": return "bg-red-500/10 text-red-600 border-red-500/30"
    case "high": return "bg-amber-500/10 text-amber-600 border-amber-500/30"
    case "medium": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/30"
    default: return "bg-blue-500/10 text-blue-600 border-blue-500/30"
  }
}

const ALERT_SEVERITIES = [
  { label: "Critical", count: 1, severity: "critical" as const },
  { label: "High", count: 4, severity: "high" as const },
  { label: "Medium", count: 2, severity: "medium" as const },
  { label: "Low", count: 0, severity: "low" as const },
] as const

export function DashboardOverviewPanel() {
  const lastRefresh = new Date().toLocaleTimeString("en-US", { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" })
  const camerasOnline = 42
  const camerasOffline = 3
  const totalCameras = camerasOnline + camerasOffline
  const onlinePct = totalCameras ? Math.round((camerasOnline / totalCameras) * 100) : 0
  const systemHealth = 94
  const healthColor = systemHealth >= 90 ? "text-green-600" : systemHealth >= 70 ? "text-amber-600" : "text-red-600"
  const storageUsed = 68

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Overview Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alert types: Critical, High, Medium, Low — compact cards */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Alerts by type</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ALERT_SEVERITIES.map(({ label, count, severity }) => (
              <div
                key={severity}
                className={`rounded-md border p-2 ${severity === "critical" ? "border-red-500/30 bg-red-500/5" : severity === "high" ? "border-amber-500/30 bg-amber-500/5" : severity === "medium" ? "border-yellow-500/30 bg-yellow-500/5" : "border-blue-500/30 bg-blue-500/5"}`}
              >
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className="text-base font-semibold text-foreground leading-tight">{count}</p>
                <Badge className={`mt-0.5 text-[10px] px-1.5 py-0 ${severityColor(severity)}`} variant="outline">{label}</Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Cameras Online</p>
            <p className={`text-xl font-semibold mt-0.5 ${onlinePct > 90 ? "text-green-600" : "text-foreground"}`}>{camerasOnline}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Cameras Offline</p>
            <p className={`text-xl font-semibold mt-0.5 ${camerasOffline > 0 ? "text-red-600" : "text-foreground"}`}>{camerasOffline}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Incidents Today</p>
            <p className="text-xl font-semibold text-foreground mt-0.5">12</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">System Health</p>
            <p className={`text-xl font-semibold mt-0.5 ${healthColor}`}>{systemHealth}%</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">AI Processing</p>
            <Badge className="bg-green-500/10 text-green-600 border-green-500/30" variant="outline">Online</Badge>
          </div>
          <div className="rounded-lg border border-border p-3 col-span-2">
            <p className="text-xs text-muted-foreground">Storage Usage</p>
            <Progress value={storageUsed} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-1">{storageUsed}% used</p>
          </div>
          <div className="rounded-lg border border-border p-3 flex flex-col justify-center">
            <p className="text-xs text-muted-foreground">Last Refresh</p>
            <p className="text-sm font-medium text-foreground mt-0.5">{lastRefresh}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
