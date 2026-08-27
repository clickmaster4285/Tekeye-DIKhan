import { useState } from "react"
import { Calendar } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { DashboardOverviewPanel } from "@/components/dashboard/dashboard-overview-panel"
import { DashboardQuickActions } from "@/components/dashboard/dashboard-quick-actions"
import { DashboardNotifications } from "@/components/dashboard/dashboard-notifications"
import { DashboardAlertFeed } from "@/components/dashboard/dashboard-alert-feed"
import { DashboardStatisticsWidgets } from "@/components/dashboard/dashboard-statistics-widgets"
import { DashboardThermalSummary } from "@/components/dashboard/dashboard-thermal-summary"
import { DashboardLiveCameraGrid } from "@/components/dashboard/dashboard-live-camera-grid"
import { DashboardMapView } from "@/components/dashboard/dashboard-map-view"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function AnalyticsDashboardPage() {
  const [lastRefresh] = useState(() =>
    new Date().toLocaleTimeString("en-US", { hour12: true, hour: "2-digit", minute: "2-digit" })
  )

  return (
    <ModulePageLayout
      title="Main Dashboard — Real-time situational awareness overview"
      description="Required: mandatory fields. Field Type defines input widget. Developer Notes: implementation context."
      breadcrumbs={[{ label: "AI Analytics" }, { label: "Analytics Dashboard" }]}
    >
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Last refresh: {lastRefresh}
            </span>
            <DashboardNotifications />
          </div>
        </div>
        <DashboardQuickActions />
      </div>

      <div className="space-y-6">
        <DashboardOverviewPanel />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardLiveCameraGrid />
          <DashboardAlertFeed />
        </div>

        <DashboardStatisticsWidgets />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardMapView />
          <DashboardThermalSummary />
        </div>

        {/* AI Detection & Analytics Dashboard */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <CardTitle className="text-base">AI Detection & Analytics Dashboard</CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Date range *</Label>
                <Input type="date" className="w-40 h-8" />
                <span className="text-muted-foreground">to</span>
                <Input type="date" className="w-40 h-8" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg border border-border p-3">
                <Label className="text-xs text-muted-foreground">Detections count by type</Label>
                <div className="h-24 mt-1 rounded bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">Bar chart</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <Label className="text-xs text-muted-foreground">Top alert cameras</Label>
                <div className="h-24 mt-1 rounded bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">Bar chart</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <Label className="text-xs text-muted-foreground">False positive rate</Label>
                <p className="text-xl font-semibold mt-1">2.1%</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <Label className="text-xs text-muted-foreground">False negative rate</Label>
                <p className="text-xl font-semibold mt-1">1.4%</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border p-3">
                <Label className="text-xs text-muted-foreground">Activity heat map (on camera view)</Label>
                <div className="h-32 mt-1 rounded bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">Heat map</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <Label className="text-xs text-muted-foreground">Model performance trend</Label>
                <div className="h-32 mt-1 rounded bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">Line chart</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-border p-3">
                <Label className="text-xs text-muted-foreground">Detection count over time</Label>
                <div className="h-28 mt-1 rounded bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">Line chart</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <Label className="text-xs text-muted-foreground">Object type distribution</Label>
                <div className="h-28 mt-1 rounded bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">Pie chart</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <Label className="text-xs text-muted-foreground">Anomaly detection score</Label>
                <p className="text-2xl font-semibold mt-1">87</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg border border-border p-3"><Label className="text-xs text-muted-foreground">Face recognition accuracy</Label><p className="text-lg font-semibold mt-1">96.2%</p></div>
              <div className="rounded-lg border border-border p-3"><Label className="text-xs text-muted-foreground">LPR accuracy</Label><p className="text-lg font-semibold mt-1">94.8%</p></div>
              <div className="rounded-lg border border-border p-3"><Label className="text-xs text-muted-foreground">Behavioral analytics</Label><div className="h-16 mt-1 rounded bg-muted/30 flex items-center justify-center text-xs">Bar</div></div>
              <div className="rounded-lg border border-border p-3"><Label className="text-xs text-muted-foreground">Zone occupancy trends</Label><div className="h-16 mt-1 rounded bg-muted/30 flex items-center justify-center text-xs">Line</div></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border p-3"><Label className="text-xs text-muted-foreground">Person / vehicle count trend</Label><div className="h-24 mt-1 rounded bg-muted/30 flex items-center justify-center text-xs">Line chart</div></div>
              <div className="rounded-lg border border-border p-3"><Label className="text-xs text-muted-foreground">Hourly / daily / weekly / monthly activity</Label><div className="h-24 mt-1 rounded bg-muted/30 flex items-center justify-center text-xs">Bar chart</div></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border p-3"><Label className="text-xs text-muted-foreground">Age distribution</Label><div className="h-20 mt-1 rounded bg-muted/30 flex items-center justify-center text-xs">Bar</div></div>
              <div className="rounded-lg border border-border p-3"><Label className="text-xs text-muted-foreground">Gender distribution</Label><div className="h-20 mt-1 rounded bg-muted/30 flex items-center justify-center text-xs">Pie</div></div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <Label className="text-xs text-muted-foreground">Event log (searchable)</Label>
              <div className="flex flex-wrap gap-2 mt-2 mb-2">
                <Input placeholder="Search events" className="w-48 h-8" />
                <div className="flex gap-2"><label className="flex items-center gap-1 text-xs"><Checkbox />Critical</label><label className="flex items-center gap-1 text-xs"><Checkbox />High</label><label className="flex items-center gap-1 text-xs"><Checkbox />Medium</label><label className="flex items-center gap-1 text-xs"><Checkbox />Low</label></div>
                <div className="flex gap-2"><label className="flex items-center gap-1 text-xs"><Checkbox />Intrusion</label><label className="flex items-center gap-1 text-xs"><Checkbox />Face</label><label className="flex items-center gap-1 text-xs"><Checkbox />LPR</label></div>
                <Select><SelectTrigger className="w-32 h-8"><SelectValue placeholder="Time range" /></SelectTrigger><SelectContent><SelectItem value="24h">Last 24h</SelectItem><SelectItem value="7d">Last 7 days</SelectItem></SelectContent></Select>
              </div>
              <div className="rounded border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/30"><th className="text-left p-2">Time</th><th className="text-left p-2">Type</th><th className="text-left p-2">Camera</th><th className="text-left p-2">Severity</th></tr></thead>
                  <tbody>
                    <tr className="border-b border-border"><td className="p-2">10:32:01</td><td className="p-2">Intrusion</td><td className="p-2">Gate-01</td><td className="p-2">High</td></tr>
                    <tr className="border-b border-border"><td className="p-2">10:28:44</td><td className="p-2">Face match</td><td className="p-2">Entrance</td><td className="p-2">Medium</td></tr>
                    <tr className="border-b border-border"><td className="p-2">10:15:22</td><td className="p-2">LPR</td><td className="p-2">Parking-A</td><td className="p-2">Low</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </ModulePageLayout>
  )
}
