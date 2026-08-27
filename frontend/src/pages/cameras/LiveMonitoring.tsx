import { Monitor, Video, Activity } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"


export default function LiveMonitoringPage() {
  return (
    <ModulePageLayout
      title="Live Monitoring"
      description="Real-time monitoring of cameras, alerts, and system status."
      breadcrumbs={[{ label: "WMS" }, { label: "Live Monitoring" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cameras Online</CardTitle>
              <Video className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8</div>
              <p className="text-xs text-muted-foreground mt-1">/ 10 active</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Alerts</CardTitle>
              <Activity className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sites Monitored</CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground mt-1">Locations</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className="bg-green-600">Operational</Badge>
              <p className="text-xs text-muted-foreground mt-1">All systems normal</p>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Live Feeds</CardTitle>
            <CardDescription>10 cameras — Active / Inactive status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { id: 1, name: "CAM-01", active: true },
                { id: 2, name: "CAM-02", active: true },
                { id: 3, name: "CAM-03", active: false },
                { id: 4, name: "CAM-04", active: true },
                { id: 5, name: "CAM-05", active: true },
                { id: 6, name: "CAM-06", active: true },
                { id: 7, name: "CAM-07", active: false },
                { id: 8, name: "CAM-08", active: true },
                { id: 9, name: "CAM-09", active: true },
                { id: 10, name: "CAM-10", active: true },
              ].map((cam) => (
                <div
                  key={cam.id}
                  className="relative aspect-video rounded-lg border border-border overflow-hidden bg-muted flex items-center justify-center text-muted-foreground text-sm"
                >
                  <span className="absolute inset-0 flex items-center justify-center">Live feed</span>
                  <Badge
                    variant={cam.active ? "default" : "secondary"}
                    className="absolute top-2 right-2 z-10"
                  >
                    {cam.active ? "Active" : "Inactive"}
                  </Badge>
                  <span className="absolute bottom-1 left-1 z-10 text-xs font-medium bg-black/60 text-white px-1.5 py-0.5 rounded">{cam.name}</span>
                </div>
              ))}
            </div>
            <Button className="mt-4 bg-[#3b82f6] hover:bg-[#2563eb] text-white">View All Feeds</Button>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
