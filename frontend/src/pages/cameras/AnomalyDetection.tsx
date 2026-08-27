
import { AlertTriangle, Activity, CheckCircle } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default function AnomalyDetectionPage() {
  return (
    <ModulePageLayout
      title="Anomaly Detection"
      description="AI-driven anomaly detection for warehouse and movement alerts."
      breadcrumbs={[{ label: "WMS" }, { label: "Anomaly Detection" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5</div>
              <p className="text-xs text-muted-foreground mt-1">Require review</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Resolved Today</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground mt-1">Confirmed / false positive</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Models Active</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">4</div>
              <p className="text-xs text-muted-foreground mt-1">Movement, access, inventory</p>
            </CardContent>
          </Card>
        </div>
        <Card className="w-full min-w-0">
          <CardHeader>
            <CardTitle>Anomaly Alerts</CardTitle>
            <CardDescription>Recent anomalies detected by AI models</CardDescription>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
              <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { time: "10:55 AM", type: "Unauthorized access", location: "Zone B", severity: "High", status: "Open" },
                  { time: "10:42 AM", type: "Inventory mismatch", location: "WH-A Aisle 2", severity: "Medium", status: "Open" },
                  { time: "10:30 AM", type: "After-hours movement", location: "Gate 1", severity: "Medium", status: "Resolved" },
                ].map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.time}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.location}</TableCell>
                    <TableCell><Badge variant={row.severity === "High" ? "destructive" : "secondary"}>{row.severity}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-[#3b82f6]">Review</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
            <Button className="mt-1 w-full bg-[#3b82f6] text-white hover:bg-[#2563eb] sm:w-auto">Configure Rules</Button>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
