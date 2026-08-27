
import { BarChart3, TrendingUp, DollarSign } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function RevenueReportsPage() {
  return (
    <ModulePageLayout
      title="Revenue Reports"
      description="Auction and disposal revenue reports."
      breadcrumbs={[{ label: "WMS" }, { label: "Revenue Reports" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue (This Month)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">PKR 2.4M</div>
              <p className="text-xs text-muted-foreground mt-1">From 18 sales</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">YTD Revenue</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">PKR 18.2M</div>
              <p className="text-xs text-muted-foreground mt-1">Year to date</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">vs Last Month</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+12%</div>
              <p className="text-xs text-muted-foreground mt-1">Growth</p>
            </CardContent>
          </Card>
        </div>
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Revenue by Month</CardTitle>
              <CardDescription className="break-words">Monthly auction and disposal revenue</CardDescription>
            </div>
            <Button variant="outline" className="w-full sm:w-auto">Export</Button>
          </CardHeader>
          <CardContent className="w-full min-w-0">
            <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
              <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Auctions</TableHead>
                  <TableHead>Sales Count</TableHead>
                  <TableHead className="text-right">Revenue (PKR)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { month: "Feb 2024", auctions: 5, sales: 18, revenue: "2,400,000" },
                  { month: "Jan 2024", auctions: 4, sales: 14, revenue: "2,100,000" },
                  { month: "Dec 2023", auctions: 6, sales: 22, revenue: "2,850,000" },
                ].map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="font-medium">{row.month}</TableCell>
                    <TableCell>{row.auctions}</TableCell>
                    <TableCell>{row.sales}</TableCell>
                    <TableCell className="text-right">{row.revenue}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
