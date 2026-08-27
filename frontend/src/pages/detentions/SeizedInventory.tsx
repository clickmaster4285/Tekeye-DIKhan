import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Eye } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ROUTES, getSeizedInventoryDetailPath } from "@/routes/config"

const STORAGE_KEY = "wms_seized_inventory"

type SeizedItem = {
  id: string
  sourceDetentionId: string
  seizedAt: string
  caseNo: string
  firNumber?: string
  referenceNumber: string
  dateTimeDetention: string
  [key: string]: unknown
}

function loadRows(): SeizedItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {}
  return []
}

export default function SeizedInventoryPage() {
  const [rows, setRows] = useState<SeizedItem[]>([])

  useEffect(() => {
    setRows(loadRows())
  }, [])

  const formatSeizedDate = (d: string) => {
    if (!d) return "—"
    try {
      const date = new Date(d)
      return date.toISOString().slice(0, 10) + " " + date.toTimeString().slice(0, 5)
    } catch {
      return d
    }
  }

  return (
    <ModulePageLayout
      title="Seized Inventory"
      description="Inventory transferred from detention to seizure. Data stored in localStorage."
      breadcrumbs={[{ label: "WMS" }, { label: "Detentions" }, { label: "Seized Inventory" }]}
    >
      <div className="grid gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-hidden rounded-md border">
              <div className="overflow-auto max-h-[60vh] w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Case Number</TableHead>
                      <TableHead>Detention Date/Time</TableHead>
                      <TableHead>Seized Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No seized inventory. Use &quot;Seize&quot; on a Detention Memo to add it here.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.caseNo}</TableCell>
                          <TableCell>{row.dateTimeDetention || "—"}</TableCell>
                          <TableCell>{formatSeizedDate(row.seizedAt)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={getSeizedInventoryDetailPath(row.id)}>
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
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
