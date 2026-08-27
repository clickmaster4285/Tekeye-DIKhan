import { AlertCircle, AlertTriangle, Info, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type AlertType = "critical" | "warning" | "info"

type AlertLocation = {
  city: string
  badge: string
  badgeColor: string
}

type Alert = {
  title: string
  location: AlertLocation
  time: string
  type: AlertType
}

const ALERTS_DATA: Alert[] = [
  {
    title: "Blacklisted visitor detected at Gate-3",
    location: { city: "Peshawar", badge: "VMS", badgeColor: "bg-blue-600" },
    time: "2 min ago",
    type: "critical",
  },
  {
    title: "Suspicious vehicle on watchlist",
    location: { city: "Peshawar", badge: "VRLS", badgeColor: "bg-green-600" },
    time: "5 min ago",
    type: "critical",
  },
  {
    title: "Unauthorized warehouse access attempt",
    location: { city: "Kohat", badge: "CGIMS", badgeColor: "bg-purple-600" },
    time: "12 min ago",
    type: "warning",
  },
  {
    title: "AI anomaly: Unusual vehicle pattern",
    location: { city: "Nowshera", badge: "AI", badgeColor: "bg-cyan-600" },
    time: "18 min ago",
    type: "warning",
  },
  {
    title: "Visitor overstay warning (4 hours)",
    location: { city: "Mardan", badge: "VMS", badgeColor: "bg-blue-600" },
    time: "25 min ago",
    type: "info",
  },
  {
    title: "Gate access denied - Invalid credentials",
    location: { city: "DI Khan", badge: "VRLS", badgeColor: "bg-green-600" },
    time: "32 min ago",
    type: "critical",
  },
  {
    title: "Unregistered visitor in restricted zone",
    location: { city: "Peshawar", badge: "CGIMS", badgeColor: "bg-purple-600" },
    time: "45 min ago",
    type: "warning",
  },
  {
    title: "Vehicle maintenance reminder due",
    location: { city: "Kohat", badge: "AI", badgeColor: "bg-cyan-600" },
    time: "1 hour ago",
    type: "info",
  },
  {
    title: "Expired visitor pass detected",
    location: { city: "Nowshera", badge: "VMS", badgeColor: "bg-blue-600" },
    time: "1 hour 15 min ago",
    type: "warning",
  },
  {
    title: "Security protocol breach attempt",
    location: { city: "Mardan", badge: "CGIMS", badgeColor: "bg-purple-600" },
    time: "1 hour 30 min ago",
    type: "critical",
  },
]

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

const criticalCount = ALERTS_DATA.filter((a) => a.type === "critical").length

export function LiveAlerts() {
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
            <Button variant="ghost" className="text-blue-500 hover:bg-blue-50 hover:text-blue-600 px-0 flex-shrink-0">
              <span className="text-sm font-medium">View All</span>
              <span className="text-lg ml-1">→</span>
            </Button>
          </div>
        </div>
        <div className="overflow-y-auto max-h-[320px]">
          <div className="space-y-0 px-4 pt-4 pb-0 sm:px-6 sm:pt-5 sm:pb-0">
            {ALERTS_DATA.map((alert, idx) => (
              <div
                key={idx}
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
                    <span className="text-xs text-gray-600">{alert.location.city}</span>
                    <span className="text-gray-400">•</span>
                    <span className={`inline-block text-xs font-semibold text-white px-2 py-1 rounded ${alert.location.badgeColor}`}>
                      {alert.location.badge}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-500 flex-none">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">{alert.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
