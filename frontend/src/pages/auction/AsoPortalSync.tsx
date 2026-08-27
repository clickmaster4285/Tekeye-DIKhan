
import { RefreshCw, CheckCircle, Clock } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default function AsoPortalSyncPage() {
  return (
    <ModulePageLayout
      title="ASO Portal Sync"
      description="Sync auction and seizure data with ASO portal."
      breadcrumbs={[{ label: "WMS" }, { label: "ASO Portal Sync" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Last Sync</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2 hours ago</div>
              <p className="text-xs text-muted-foreground mt-1">Successful</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Records Synced</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,247</div>
              <p className="text-xs text-muted-foreground mt-1">This week</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              <RefreshCw className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting sync</p>
            </CardContent>
          </Card>
        </div>
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Sync History</CardTitle>
              <CardDescription className="break-words">Recent sync operations with ASO portal</CardDescription>
            </div>
            <Button className="w-full bg-[#3b82f6] text-white hover:bg-[#2563eb] sm:w-auto">
              <RefreshCw className="h-4 w-4 mr-2" /> Sync Now
            </Button>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="divide-y rounded-lg border md:hidden">
              {[
                { date: "2024-02-04 10:30", records: 89, status: "Success" },
                { date: "2024-02-04 08:00", records: 156, status: "Success" },
                { date: "2024-02-03 18:00", records: 42, status: "Failed" },
              ].map((row, i) => (
                <div key={i} className="p-3">
                  <p className="text-sm font-medium">{row.date}</p>
                  <p className="text-xs text-muted-foreground">Records: {row.records}</p>
                  <Badge variant={row.status === "Success" ? "default" : "destructive"}>{row.status}</Badge>
                </div>
              ))}
            </div>
            <div className="hidden w-full min-w-0 md:block">
              <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { date: "2024-02-04 10:30", records: 89, status: "Success" },
                      { date: "2024-02-04 08:00", records: 156, status: "Success" },
                      { date: "2024-02-03 18:00", records: 42, status: "Failed" },
                    ].map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.date}</TableCell>
                        <TableCell>{row.records}</TableCell>
                        <TableCell><Badge variant={row.status === "Success" ? "default" : "destructive"}>{row.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-[#3b82f6]">View Log</Button>
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
