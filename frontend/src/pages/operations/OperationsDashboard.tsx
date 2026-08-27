import { LayoutDashboard, BarChart3, Activity, Video } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const OPERATIONS_CAMERAS = [
  { id: "CAM-O1", location: "Main Gate", active: true },
  { id: "CAM-O2", location: "Dock 1", active: true },
  { id: "CAM-O3", location: "Dock 2", active: false },
  { id: "CAM-O4", location: "Aisle A", active: true },
  { id: "CAM-O5", location: "Aisle B", active: true },
  { id: "CAM-O6", location: "Staging", active: true },
  { id: "CAM-O7", location: "Receiving", active: false },
  { id: "CAM-O8", location: "Dispatch", active: true },
  { id: "CAM-O9", location: "Parking", active: true },
  { id: "CAM-O10", location: "Perimeter", active: true },
]

export default function OperationsDashboardPage() {
  return (
    <ModulePageLayout
      title="Operations Dashboard"
      description="Real-time view of day-to-day operations and key metrics."
      breadcrumbs={[{ label: "WMS" }, { label: "Operations Dashboard" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Operations</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">24</div>
              <p className="text-xs text-muted-foreground mt-1">In progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Tasks</CardTitle>
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting action</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed Today</CardTitle>
              <BarChart3 className="h-4 w-4 text-[#3b82f6]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">48</div>
              <p className="text-xs text-muted-foreground mt-1">Tasks completed</p>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Operations Overview</CardTitle>
            <CardDescription>Key operational metrics and status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground text-sm">
              Operations metrics and charts — integrate with your data
            </div>
            <Button className="mt-4 bg-[#3b82f6] hover:bg-[#2563eb] text-white">Refresh</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" /> Cameras
              </CardTitle>
              <CardDescription>10 cameras — Active / Inactive</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {OPERATIONS_CAMERAS.map((cam) => (
                <div
                  key={cam.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2"
                >
                  <span className="text-sm font-medium">{cam.id}</span>
                  <Badge variant={cam.active ? "default" : "secondary"}>
                    {cam.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {OPERATIONS_CAMERAS.filter((c) => c.active).length} active / {OPERATIONS_CAMERAS.length} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" /> Live feed
            </CardTitle>
            <CardDescription>Live camera feed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video rounded-lg border border-border overflow-hidden bg-muted flex items-center justify-center text-muted-foreground text-sm">
              Live feed
            </div>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
