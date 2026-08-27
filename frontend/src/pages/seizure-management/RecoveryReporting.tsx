import { useEffect, useMemo, useState } from "react"
import { Download, Eye, Loader2, Search } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { TableActionGroup, TableActionIcon } from "@/components/seizure/table-action-icon"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ROUTES, getSeizureMgmtRecoveryMemoDetailPath } from "@/routes/config"
import { fetchRecoveryMemos, type RecoveryMemoRecord } from "@/lib/seizure-management-api"

export default function RecoveryReportingPage() {
  const [rows, setRows] = useState<RecoveryMemoRecord[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchRecoveryMemos()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.caseNo.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.approvalStatus.toLowerCase().includes(q)
    )
  }, [rows, search])

  const byCategory = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of rows) {
      counts[r.category] = (counts[r.category] ?? 0) + 1
    }
    return counts
  }, [rows])

  const exportCsv = () => {
    const header = ["Case No", "Category", "Date", "Officer", "Approval Status"]
    const lines = filtered.map((r) =>
      [r.caseNo, r.category, r.recoveryDate, r.recoveryOfficer, r.approvalStatus]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",")
    )
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `recovery-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ModulePageLayout
      title="Recovery Reporting"
      description="Summary of recovery memos by category and approval status."
      breadcrumbs={[
        { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
        { label: "Recovery Memo" },
        { label: "Reporting" },
      ]}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {Object.entries(byCategory).map(([cat, count]) => (
          <Card key={cat} className="rounded-[10px]">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{cat}</p>
              <p className="text-2xl font-bold">{count}</p>
            </CardContent>
          </Card>
        ))}
        {!loading && Object.keys(byCategory).length === 0 && (
          <Card className="rounded-[10px] sm:col-span-3">
            <CardContent className="p-4 text-sm text-muted-foreground">No recovery memos yet.</CardContent>
          </Card>
        )}
      </div>

      <Card className="rounded-[10px] border-gray-200">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <Table className="table-fixed w-full" containerClassName="overflow-x-hidden">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[18%]">Case No</TableHead>
                <TableHead className="w-[18%]">Category</TableHead>
                <TableHead className="w-[16%]">Date</TableHead>
                <TableHead className="w-[22%]">Officer</TableHead>
                <TableHead className="w-[16%]">Status</TableHead>
                <TableHead className="w-[7.5rem] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium truncate" title={row.caseNo}>{row.caseNo}</TableCell>
                    <TableCell className="truncate" title={row.category}>{row.category}</TableCell>
                    <TableCell className="truncate">{row.recoveryDate}</TableCell>
                    <TableCell className="truncate" title={row.recoveryOfficer}>{row.recoveryOfficer}</TableCell>
                    <TableCell>
                      <Badge variant={row.approvalStatus === "Approved" ? "default" : "secondary"}>
                        {row.approvalStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="overflow-visible p-2 text-right align-middle">
                      <TableActionGroup>
                        <TableActionIcon label="View" to={getSeizureMgmtRecoveryMemoDetailPath(row.id)}>
                          <Eye className="h-4 w-4" />
                        </TableActionIcon>
                      </TableActionGroup>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </ModulePageLayout>
  )
}
