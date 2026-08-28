import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Eye, Search } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { TableActionGroup, TableActionIcon } from "@/components/seizure/table-action-icon"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ExportMenu } from "@/components/seizure/export-menu"
import DetentionMemoReportPrint from "@/components/detention/DetentionMemoReportPrint"
import { downloadCsv, joinList } from "@/lib/csv-export"
import { useBatchPdfExport } from "@/hooks/use-batch-pdf-export"
import { PdfExportHost } from "@/components/seizure/pdf-export-host"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ROUTES, getDetentionMemoDetailPath } from "@/routes/config"
import { fetchDetentionMemos, type DetentionMemoApiRecord } from "@/lib/detention-memo-api"
import {
  DETENTION_WINDOW_DAYS,
  daysSinceDetention,
  fetchAssessments,
  type DetentionAssessmentRecord,
} from "@/lib/seizure-management-api"

export default function DetentionReportingPage() {
  const [rows, setRows] = useState<DetentionMemoApiRecord[]>([])
  const [assessments, setAssessments] = useState<DetentionAssessmentRecord[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchDetentionMemos().catch(() => [] as DetentionMemoApiRecord[]),
      fetchAssessments().catch(() => [] as DetentionAssessmentRecord[]),
    ])
      .then(([memos, assess]) => {
        setRows(memos)
        setAssessments(assess)
      })
      .finally(() => setLoading(false))
  }, [])

  const assessedMemoIds = useMemo(() => {
    const set = new Set<string>()
    for (const a of assessments) set.add(a.detentionMemoId)
    return set
  }, [assessments])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.caseNo.toLowerCase().includes(q) ||
        r.placeOfDetention.toLowerCase().includes(q) ||
        (r.verificationStatus ?? "").toLowerCase().includes(q)
    )
  }, [rows, search])

  const stats = useMemo(() => {
    const overdue = rows.filter((r) => {
      const days = daysSinceDetention(r.dateTimeDetention)
      return days !== null && days > DETENTION_WINDOW_DAYS
    }).length
    const withAssessment = rows.filter((r) => assessedMemoIds.has(r.id)).length
    return { total: rows.length, overdue, withAssessment }
  }, [rows, assessedMemoIds])

  const pdf = useBatchPdfExport<DetentionMemoApiRecord>(`detention-report-${new Date().toISOString().slice(0, 10)}.pdf`)

  const exportCsv = () => {
    const headers = [
      "Sheet Sr. No",
      "Record ID",
      "Case No",
      "Detention Memo No",
      "FIR Number",
      "Date/Time of Occurrence",
      "Place of Occurrence",
      "Date/Time of Detention",
      "Place of Detention",
      "Detention Type",
      "Directorate",
      "Reason for Detention",
      "Location of Detention",
      "GD Number",
      "GD Number 2",
      "Where Deposited",
      "Search / Chassis Number",
      "Receipt Officer",
      "Settlement Status",
      "Verification Status",
      "Disposition Status",
      "Brief Facts",
      "Forwarding Officer Remarks",
      "Purpose of Detention",
      "Owner Name",
      "Owner CNIC",
      "Owner Contact",
      "Driver Name",
      "Driver CNIC",
      "Driver Contact",
      "Seizing Officer Notes",
      "Examining Officer Notes",
      "Detention Notes",
      "Days Since Detention",
      "Assessment",
      "60-Day Status",
      "Goods Line No",
      "Goods QR",
      "Description of Goods",
      "PCT Code",
      "Quantity",
      "Unit",
      "Condition",
      "Assessable Value (PKR)",
      "Perishable",
      "ID / Chassis No",
      "Item Notes",
      "Goods Image URLs",
      "Created By",
      "Updated By",
      "Created At",
      "Updated At",
    ]
    const rows: unknown[][] = []
    filtered.forEach((r, index) => {
      const days = daysSinceDetention(r.dateTimeDetention)
      const hasAssessment = assessedMemoIds.has(r.id)
      const windowStatus =
        days === null ? "" : days > DETENTION_WINDOW_DAYS ? "Overdue" : "Within window"
      const goods = r.goodsItems?.length ? r.goodsItems : [null]
      goods.forEach((item, itemIndex) => {
        rows.push([
          index + 1,
          r.id,
          r.caseNo,
          r.referenceNumber,
          r.firNumber,
          r.dateTimeOccurrence,
          r.placeOfOccurrence,
          r.dateTimeDetention,
          r.placeOfDetention,
          r.detentionType,
          r.directorate,
          r.reasonForDetention,
          r.locationOfDetention,
          r.gdNumber,
          r.gdNumber2,
          r.whereDeposited,
          r.searchChassisNumber,
          r.receiptOfficer,
          r.settlementStatus,
          r.verificationStatus,
          r.dispositionStatus,
          r.briefFacts,
          r.forwardingOfficerRemarks,
          r.purposeOfDetention,
          r.owner?.name,
          r.owner?.cnic,
          r.owner?.contact,
          r.driver?.name,
          r.driver?.cnic,
          r.driver?.contact,
          r.seizingOfficerNotes,
          r.examiningOfficerNotes,
          r.detentionNotes,
          days ?? "",
          hasAssessment ? "Yes" : "No",
          windowStatus,
          item ? itemIndex + 1 : "",
          item?.qrCodeNumber,
          item?.description,
          item?.pctCode,
          item?.quantity,
          item?.unit,
          item?.condition,
          item?.assessableValuePkr,
          item ? (item.perishable ? "Yes" : "No") : "",
          item?.identificationRef,
          item?.itemNotes,
          joinList(item?.images),
          r.createdBy,
          r.updatedBy,
          r.createdAt,
          r.updatedAt,
        ])
      })
    })
    downloadCsv(`detention-report-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  return (
    <ModulePageLayout
      title="Detention Reporting"
      description="Summary of detention memos, assessment coverage, and 60-day recovery window compliance."
      breadcrumbs={[
        { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
        { label: "Detention" },
        { label: "Reporting" },
      ]}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="rounded-[10px]">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Memos</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[10px]">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">With Assessment</p>
            <p className="text-2xl font-bold">{stats.withAssessment}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[10px] border-amber-200">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Over {DETENTION_WINDOW_DAYS} Days</p>
            <p className="text-2xl font-bold text-amber-700">{stats.overdue}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[10px] border-gray-200">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search case no, place..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="shrink-0 sm:ml-auto">
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
                <TableHead className="w-[16%]">Case No</TableHead>
                <TableHead className="w-[14%]">Detention Date</TableHead>
                <TableHead className="w-[22%]">Place</TableHead>
                <TableHead className="w-[8%]">Days</TableHead>
                <TableHead className="w-[12%]">Assessment</TableHead>
                <TableHead className="w-[14%]">Window</TableHead>
                <TableHead className="w-[7.5rem] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No detention memos found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const days = daysSinceDetention(row.dateTimeDetention)
                  const overdue = days !== null && days > DETENTION_WINDOW_DAYS
                  const hasAssessment = assessedMemoIds.has(row.id)
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium truncate" title={row.caseNo}>{row.caseNo}</TableCell>
                      <TableCell className="truncate">{row.dateTimeDetention?.slice(0, 10) ?? "—"}</TableCell>
                      <TableCell className="truncate" title={row.placeOfDetention}>{row.placeOfDetention}</TableCell>
                      <TableCell>{days ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={hasAssessment ? "default" : "outline"}>
                          {hasAssessment ? "Done" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {overdue ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Overdue
                          </Badge>
                        ) : (
                          <Badge variant="secondary">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell className="overflow-visible p-2 text-right align-middle">
                        <TableActionGroup>
                          <TableActionIcon label="View memo" to={getDetentionMemoDetailPath(row.id)}>
                            <Eye className="h-4 w-4" />
                          </TableActionIcon>
                        </TableActionGroup>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <PdfExportHost hostRef={pdf.hostRef}>
        {pdf.items?.map((row) => (
          <DetentionMemoReportPrint key={row.id} row={row} embedded />
        ))}
      </PdfExportHost>
    </ModulePageLayout>
  )
}
