
import { Gavel, Users, TrendingUp } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default function BiddingManagementPage() {
  return (
    <ModulePageLayout
      title="Bidding Management"
      description="Manage auction bids and bidders."
      breadcrumbs={[{ label: "WMS" }, { label: "Bidding Management" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Auctions</CardTitle>
              <Gavel className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5</div>
              <p className="text-xs text-muted-foreground mt-1">Open for bids</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Registered Bidders</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">124</div>
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Bids</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">342</div>
              <p className="text-xs text-muted-foreground mt-1">Current cycle</p>
            </CardContent>
          </Card>
        </div>
        <Card className="w-full min-w-0">
          <CardHeader>
            <CardTitle>Active Bids</CardTitle>
            <CardDescription>Bids received for open lots</CardDescription>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
              <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Lot No</TableHead>
                  <TableHead>Bidder</TableHead>
                  <TableHead>Bid Amount</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { lot: "LOT-2024-0841", bidder: "BID-7821", amount: "PKR 55,000", time: "10:45 AM", status: "Leading" },
                  { lot: "LOT-2024-0840", bidder: "BID-7819", amount: "PKR 125,000", time: "10:42 AM", status: "Leading" },
                ].map((row) => (
                  <TableRow key={row.lot + row.bidder}>
                    <TableCell className="font-medium">{row.lot}</TableCell>
                    <TableCell>{row.bidder}</TableCell>
                    <TableCell>{row.amount}</TableCell>
                    <TableCell>{row.time}</TableCell>
                    <TableCell><Badge variant="default">{row.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-[#3b82f6]">View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
            <Button className="mt-1 w-full bg-[#3b82f6] text-white hover:bg-[#2563eb] sm:w-auto">New Auction</Button>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
