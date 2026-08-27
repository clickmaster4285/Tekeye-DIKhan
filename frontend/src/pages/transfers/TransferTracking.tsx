
import { MapPin, Truck } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default function TransferTrackingPage() {
  const transferRows = [
    { ref: "TR-2024-0841", from: "Yarik", to: "Peshawar", status: "In Transit", eta: "2024-02-06" },
    { ref: "TR-2024-0840", from: "Peshawar", to: "Yarik", status: "Received", eta: "—" },
  ]

  return (
    <ModulePageLayout
      title="Transfer Tracking"
      description="Track status and location of transfers."
      breadcrumbs={[{ label: "WMS" }, { label: "Transfer Tracking" }]}
    >
      <div className="grid gap-6">
        <Card className="w-full min-w-0">
          <CardHeader>
            <CardTitle>Active Transfers</CardTitle>
            <CardDescription>Track transfer status in real time</CardDescription>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="divide-y rounded-lg border md:hidden">
              {transferRows.map((row) => (
                <div key={row.ref} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{row.ref}</p>
                    <Badge variant="outline">{row.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">From: {row.from}</p>
                  <p className="text-xs text-muted-foreground">To: {row.to}</p>
                  <p className="text-xs text-muted-foreground">ETA: {row.eta}</p>
                  <Button variant="ghost" size="sm" className="mt-1 h-7 px-0 text-[#3b82f6]">Track</Button>
                </div>
              ))}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ref</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Current Status</TableHead>
                      <TableHead>ETA</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transferRows.map((row) => (
                      <TableRow key={row.ref}>
                        <TableCell className="font-medium">{row.ref}</TableCell>
                        <TableCell>{row.from}</TableCell>
                        <TableCell>{row.to}</TableCell>
                        <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
                        <TableCell>{row.eta}</TableCell>
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
