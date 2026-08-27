
import { CheckCircle, FileText, Banknote } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default function SaleCompletionPage() {
  return (
    <ModulePageLayout
      title="Sale Completion"
      description="Complete auction sales and generate documents."
      breadcrumbs={[{ label: "WMS" }, { label: "Sale Completion" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed This Month</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">18</div>
              <p className="text-xs text-muted-foreground mt-1">Sales closed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Handover</CardTitle>
              <FileText className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">4</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting collection</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue (MTD)</CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">PKR 2.4M</div>
              <p className="text-xs text-muted-foreground mt-1">Month to date</p>
            </CardContent>
          </Card>
        </div>
        <Card className="w-full min-w-0">
          <CardHeader>
            <CardTitle>Completed Sales</CardTitle>
            <CardDescription>Sales ready for handover or completed</CardDescription>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
              <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Sale ID</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { id: "SAL-2024-0891", lot: "LOT-2024-0839", buyer: "BID-7801", amount: "PKR 95,000", status: "Handover Pending" },
                  { id: "SAL-2024-0890", lot: "LOT-2024-0838", buyer: "BID-7798", amount: "PKR 210,000", status: "Completed" },
                ].map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.id}</TableCell>
                    <TableCell>{row.lot}</TableCell>
                    <TableCell>{row.buyer}</TableCell>
                    <TableCell>{row.amount}</TableCell>
                    <TableCell><Badge variant={row.status === "Completed" ? "default" : "secondary"}>{row.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-[#3b82f6]">View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
            <Button className="mt-1 w-full bg-[#3b82f6] text-white hover:bg-[#2563eb] sm:w-auto">Generate Sale Certificate</Button>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
