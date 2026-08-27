
import { Move } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default function InternalMovementPage() {
  const movementRows = [
    { ref: "IM-2024-0841", from: "Z-A01", to: "Z-B02", date: "2024-02-04", status: "Completed" },
  ]

  return (
    <ModulePageLayout
      title="Internal Movement"
      description="Track internal movement of goods within warehouse/location."
      breadcrumbs={[{ label: "WMS" }, { label: "Internal Movement" }]}
    >
      <div className="grid gap-6">
        <Card className="w-full min-w-0">
          <CardHeader>
            <CardTitle>Internal Movements</CardTitle>
            <CardDescription>Movement log within premises</CardDescription>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="divide-y rounded-lg border md:hidden">
              {movementRows.map((row) => (
                <div key={row.ref} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{row.ref}</p>
                    <Badge variant="default">{row.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">From: {row.from}</p>
                  <p className="text-xs text-muted-foreground">To: {row.to}</p>
                  <p className="text-xs text-muted-foreground">Date: {row.date}</p>
                  <Button variant="ghost" size="sm" className="mt-1 h-7 px-0 text-[#3b82f6]">View</Button>
                </div>
              ))}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ref</TableHead>
                      <TableHead>From Zone</TableHead>
                      <TableHead>To Zone</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movementRows.map((row) => (
                      <TableRow key={row.ref}>
                        <TableCell className="font-medium">{row.ref}</TableCell>
                        <TableCell>{row.from}</TableCell>
                        <TableCell>{row.to}</TableCell>
                        <TableCell>{row.date}</TableCell>
                        <TableCell><Badge variant="default">{row.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-[#3b82f6]">View</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <Button className="w-full bg-[#3b82f6] text-white hover:bg-[#2563eb] sm:w-auto">Record Movement</Button>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
