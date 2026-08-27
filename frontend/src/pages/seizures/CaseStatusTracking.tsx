
import { Activity, CheckCircle, Clock } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default function CaseStatusTrackingPage() {
  const statusRows = [
    { id: "CF-2024-0841", fir: "FIR-2024-0841", status: "In Court", updated: "2024-02-04" },
    { id: "CF-2024-0840", fir: "FIR-2024-0840", status: "Under Investigation", updated: "2024-02-03" },
  ]

  return (
    <ModulePageLayout
      title="Case Status Tracking"
      description="Track status and progress of all cases."
      breadcrumbs={[{ label: "WMS" }, { label: "Case Status Tracking" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">42</div>
              <p className="text-xs text-muted-foreground mt-1">Active cases</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Court</CardTitle>
              <Activity className="h-4 w-4 text-[#3b82f6]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">24</div>
              <p className="text-xs text-muted-foreground mt-1">Proceedings</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Closed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">182</div>
              <p className="text-xs text-muted-foreground mt-1">Resolved</p>
            </CardContent>
          </Card>
        </div>
        <Card className="w-full min-w-0">
          <CardHeader>
            <CardTitle>Case Status Overview</CardTitle>
            <CardDescription>All cases by status</CardDescription>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="divide-y rounded-lg border md:hidden">
              {statusRows.map((row) => (
                <div key={row.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{row.id}</p>
                    <Badge variant="outline">{row.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">FIR Ref: {row.fir}</p>
                  <p className="text-xs text-muted-foreground">Last Updated: {row.updated}</p>
                  <Button variant="ghost" size="sm" className="mt-1 h-7 px-0 text-[#3b82f6]">Track</Button>
                </div>
              ))}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Case ID</TableHead>
                      <TableHead>FIR Ref</TableHead>
                      <TableHead>Current Status</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statusRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.id}</TableCell>
                        <TableCell>{row.fir}</TableCell>
                        <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
                        <TableCell>{row.updated}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-[#3b82f6]">Track</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
