import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Eye, Loader2, Plus, Search } from "lucide-react"
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
import { ROUTES, getSeizureMgmtSeizureReportDetailPath } from "@/routes/config"
import { fetchSeizureReports, type SeizureReportRecord } from "@/lib/seizure-management-api"
import { ExportMenu } from "@/components/seizure/export-menu"
import SeizureReportPrint from "@/components/seizure/SeizureReportPrint"
import { downloadCsv } from "@/lib/csv-export"
import { useBatchPdfExport } from "@/hooks/use-batch-pdf-export"
import { PdfExportHost } from "@/components/seizure/pdf-export-host"

export default function SeizureReportPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<SeizureReportRecord[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchSeizureReports()
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
        r.preparedBy.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
    )
  }, [rows, search])

  const pdf = useBatchPdfExport<SeizureReportRecord>(`seizure-reports-${new Date().toISOString().slice(0, 10)}.pdf`)

  const exportCsv = () => {
    downloadCsv(`seizure-reports-${new Date().toISOString().slice(0, 10)}.csv`, [
      "Seizure Report No",
      "Case No",
      "Report Date",
      "Prepared By",
      "Summary",
      "Recovery / Assessment Notes",
      "Status",
      "Submitted At",
      "Created At",
      "Updated At",
    ], filtered.map((r) => [
      r.referenceNumber,
      r.caseNo,
      r.reportDate,
      r.preparedBy,
      r.summary,
      r.recoveryAssessmentNotes,
      r.status,
      r.submittedAt,
      r.createdAt,
      r.updatedAt,
    ]))
  }

  return (
    <ModulePageLayout
      title="Seizure Report"
      description="Final seizure reports built from Recovery + Assessment Sheet and submitted."
      breadcrumbs={[
        { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
        { label: "Seizure Report" },
      ]}
    >
      <Card className="rounded-[10px] border-gray-200">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search case, officer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0 sm:ml-auto">
              <Button asChild>
                <Link to={ROUTES.SEIZURE_MGMT_SEIZURE_REPORT_CREATE}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Seizure Report
                </Link>
              </Button>
              <ExportMenu
                disabled={filtered.length === 0}
                onExportCsv={exportCsv}
                onExportPdf={() => pdf.start(filtered)}
              />
            </div>
          </div>

          <Table className="table-fixed w-full" containerClassName="overflow-x-hidden">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[22%]">Case No</TableHead>
                <TableHead className="w-[18%]">Report Date</TableHead>
                <TableHead className="w-[28%]">Prepared By</TableHead>
                <TableHead className="w-[16%]">Status</TableHead>
                <TableHead className="w-[7.5rem] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No seizure reports yet.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium truncate" title={row.caseNo}>{row.caseNo}</TableCell>
                    <TableCell className="truncate">{row.reportDate}</TableCell>
                    <TableCell className="truncate" title={row.preparedBy}>{row.preparedBy}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === "Submitted" ? "default" : "secondary"}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="overflow-visible p-2 text-right align-middle">
                      <TableActionGroup>
                        <TableActionIcon
                          label="View"
                          onClick={() => navigate(getSeizureMgmtSeizureReportDetailPath(row.id))}
                        >
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
      <PdfExportHost hostRef={pdf.hostRef}>
        {pdf.items?.map((row) => (
          <SeizureReportPrint key={row.id} row={row} embedded />
        ))}
      </PdfExportHost>
    </ModulePageLayout>
  )
}
