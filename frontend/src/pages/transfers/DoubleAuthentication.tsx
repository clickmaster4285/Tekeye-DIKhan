
import { Shield, UserCheck } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default function DoubleAuthenticationPage() {
  const authRows = [
    { tx: "TR-2024-0841", type: "Transfer", first: "2024-02-04 10:00", second: "—", status: "Pending" },
  ]

  return (
    <ModulePageLayout
      title="Double Authentication"
      description="Two-factor and dual-approval for transfers and handovers."
      breadcrumbs={[{ label: "WMS" }, { label: "Double Authentication" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending 2FA</CardTitle>
              <Shield className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">4</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting second approval</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed Today</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground mt-1">Authenticated</p>
            </CardContent>
          </Card>
        </div>
        <Card className="w-full min-w-0">
          <CardHeader>
            <CardTitle>Authentication Log</CardTitle>
            <CardDescription>Dual-approval and 2FA events</CardDescription>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="divide-y rounded-lg border md:hidden">
              {authRows.map((row) => (
                <div key={row.tx} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{row.tx}</p>
                    <Badge variant="secondary">{row.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Type: {row.type}</p>
                  <p className="text-xs text-muted-foreground">First Auth: {row.first}</p>
                  <p className="text-xs text-muted-foreground">Second Auth: {row.second}</p>
                </div>
              ))}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>First Auth</TableHead>
                      <TableHead>Second Auth</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {authRows.map((row) => (
                      <TableRow key={row.tx}>
                        <TableCell className="font-medium">{row.tx}</TableCell>
                        <TableCell>{row.type}</TableCell>
                        <TableCell>{row.first}</TableCell>
                        <TableCell>{row.second}</TableCell>
                        <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
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
