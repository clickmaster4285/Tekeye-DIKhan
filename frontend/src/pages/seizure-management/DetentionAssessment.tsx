import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Loader2,
  Package,
  PackageOpen,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { TableActionGroup, TableActionIcon } from "@/components/seizure/table-action-icon"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ROUTES,
  getDetentionMemoDetailPath,
  getSeizureMgmtAssessmentDetailPath,
  getSeizureMgmtAssessmentEditPath,
} from "@/routes/config"
import { fetchDetentionMemos, type DetentionMemoApiRecord } from "@/lib/detention-memo-api"
import {
  deleteAssessment,
  fetchAssessments,
  canUserEditAssessment,
  type DetentionAssessmentRecord,
} from "@/lib/seizure-management-api"
import { getStoredUser } from "@/lib/auth"
import { toast } from "@/hooks/use-toast"
import { ExportMenu } from "@/components/seizure/export-menu"
import AssessmentReportPrint from "@/components/seizure/AssessmentReportPrint"
import { downloadCsv, joinList } from "@/lib/csv-export"
import { useBatchPdfExport } from "@/hooks/use-batch-pdf-export"
import { PdfExportHost } from "@/components/seizure/pdf-export-host"

const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100]
const DEFAULT_PAGE_SIZE = 20

function assessmentStatusBadge(assessment: DetentionAssessmentRecord | undefined) {
  if (!assessment) {
    return (
      <Badge
        variant="outline"
        className="rounded-md border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800"
      >
        Pending
      </Badge>
    )
  }
  if (assessment.status === "Approved") {
    return (
      <Badge className="rounded-md border-0 bg-sky-600 px-1.5 py-0.5 text-[11px] font-medium text-white hover:bg-sky-600">
        Approved
      </Badge>
    )
  }
  if (assessment.status === "Submitted") {
    return (
      <Badge className="rounded-md border-0 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100">
        Submitted
      </Badge>
    )
  }
  if (assessment.status === "Rejected") {
    return (
      <Badge className="rounded-md border-0 bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-800 hover:bg-red-100">
        Rejected
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-600"
    >
      Draft
    </Badge>
  )
}

function goodsSummary(memo: DetentionMemoApiRecord): string {
  const items = memo.goodsItems ?? []
  if (items.length === 0) return "—"
  if (items.length === 1) return items[0].description || "1 item"
  return `${items.length} items`
}

function goodsValue(memo: DetentionMemoApiRecord): string {
  const items = memo.goodsItems ?? []
  if (items.length === 0) return "—"
  const total = items.reduce((sum, g) => {
    const n = parseFloat(String(g.assessableValuePkr ?? "").replace(/,/g, ""))
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
  return total > 0 ? `PKR ${total.toLocaleString()}` : "—"
}

function recoveryMemoCreateHref(detentionMemoId: string, assessmentId: string) {
  return `${ROUTES.SEIZURE_MGMT_RECOVERY_MEMO_CREATE}?detentionMemoId=${encodeURIComponent(detentionMemoId)}&assessmentId=${encodeURIComponent(assessmentId)}`
}

function shortPlace(place: string | undefined): string {
  const p = (place || "").trim()
  if (!p) return "—"
  return p
    .replace(/^Model Customs Collectorate,?\s*/i, "MCC ")
    .replace(/\s+/g, " ")
}

export default function DetentionAssessmentPage() {
  const navigate = useNavigate()
  const currentUser = getStoredUser()
  const [memos, setMemos] = useState<DetentionMemoApiRecord[]>([])
  const [assessments, setAssessments] = useState<DetentionAssessmentRecord[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const load = () => {
    setLoading(true)
    Promise.all([fetchDetentionMemos(), fetchAssessments()])
      .then(([m, a]) => {
        setMemos(m)
        setAssessments(a)
      })
      .catch((e) => {
        setMemos([])
        setAssessments([])
        toast({
          title: "Failed to load assessments",
          description: e instanceof Error ? e.message : "Could not load data",
          variant: "destructive",
        })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const assessmentByMemoId = useMemo(() => {
    const map = new Map<string, DetentionAssessmentRecord>()
    for (const a of assessments) map.set(a.detentionMemoId, a)
    return map
  }, [assessments])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return memos
    return memos.filter((m) => {
      const assessment = assessmentByMemoId.get(m.id)
      return (
        (m.caseNo || "").toLowerCase().includes(q) ||
        (m.referenceNumber || "").toLowerCase().includes(q) ||
        (m.placeOfDetention || "").toLowerCase().includes(q) ||
        (m.owner?.name || "").toLowerCase().includes(q) ||
        (assessment?.examiningOfficer || "").toLowerCase().includes(q) ||
        (assessment?.documentRelevance || "").toLowerCase().includes(q) ||
        (assessment?.status || "").toLowerCase().includes(q)
      )
    })
  }, [memos, search, assessmentByMemoId])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  )
  const pageSerial = (index: number) => (page - 1) * pageSize + index + 1

  useEffect(() => {
    setPage(1)
  }, [search, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const stats = useMemo(() => {
    const assessed = memos.filter((m) => assessmentByMemoId.has(m.id)).length
    const approved = memos.filter((m) => assessmentByMemoId.get(m.id)?.status === "Approved").length
    const pendingApproval = memos.filter(
      (m) => assessmentByMemoId.get(m.id)?.status === "Submitted"
    ).length
    return {
      total: memos.length,
      pending: memos.length - assessed,
      pendingApproval,
      approved,
    }
  }, [memos, assessmentByMemoId])

  const pdf = useBatchPdfExport<{
    row: DetentionAssessmentRecord
    memo: DetentionMemoApiRecord
  }>(`assessments-${new Date().toISOString().slice(0, 10)}.pdf`)

  const exportCsv = () => {
    const headers = [
      "Sheet Sr. No",
      "Case No",
      "Detention Memo No",
      "Detention Date",
      "Place of Detention",
      "Detention Type",
      "Owner",
      "Verification",
      "Assessment No",
      "Assessment Date",
      "Examining Officer",
      "Goods Condition",
      "Valuation Notes",
      "Findings",
      "Document Relevance",
      "Assessment Status",
      "Approved By",
      "Approved At",
      "Approval Remarks",
      "Rejection Reason",
      "Submitted At",
      "Viewed At",
      "Created By",
      "Updated By",
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
    ]
    const rows: unknown[][] = []
    filtered.forEach((memo, index) => {
      const assessment = assessmentByMemoId.get(memo.id)
      const goods = memo.goodsItems?.length ? memo.goodsItems : [null]
      goods.forEach((item, itemIndex) => {
        rows.push([
          index + 1,
          memo.caseNo,
          memo.referenceNumber,
          memo.dateTimeDetention,
          memo.placeOfDetention,
          memo.detentionType,
          memo.owner?.name,
          memo.verificationStatus,
          assessment?.referenceNumber,
          assessment?.assessmentDate,
          assessment?.examiningOfficer,
          assessment?.goodsCondition,
          assessment?.valuationNotes,
          assessment?.findings,
          assessment?.documentRelevance,
          assessment?.status,
          assessment?.approvedBy,
          assessment?.approvedAt,
          assessment?.approvalRemarks,
          assessment?.rejectionReason,
          assessment?.submittedAt,
          assessment?.viewedAt,
          assessment?.createdBy,
          assessment?.updatedBy,
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
        ])
      })
    })
    downloadCsv(`assessments-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  const exportPdf = () => {
    const items = filtered.flatMap((memo) => {
      const assessment = assessmentByMemoId.get(memo.id)
      return assessment ? [{ row: assessment, memo }] : []
    })
    if (!items.length) {
      toast({
        title: "No assessments to export",
        description: "Create an assessment first, then export PDF.",
      })
      return
    }
    pdf.start(items)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAssessment(id)
      toast({ title: "Assessment deleted" })
      load()
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Failed to delete",
        variant: "destructive",
      })
    }
  }

  return (
    <ModulePageLayout
      title="Detention Assessment"
      description="Review each detention memo, record findings, upload documents, and send for approval."
      breadcrumbs={[
        { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
        { label: "Detention" },
        { label: "Assessment" },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link to={ROUTES.SEIZURE_MGMT_ASSESSMENT_CREATE}>
              <Plus className="mr-1.5 h-4 w-4" />
              New Assessment
            </Link>
          </Button>
          <ExportMenu
            disabled={filtered.length === 0}
            onExportCsv={exportCsv}
            onExportPdf={exportPdf}
          />
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Detention Memos", value: stats.total, tone: "text-foreground" },
            { label: "Pending Assessment", value: stats.pending, tone: "text-amber-700" },
            { label: "Pending Approval", value: stats.pendingApproval, tone: "text-sky-700" },
            { label: "Approved", value: stats.approved, tone: "text-emerald-700" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border/80 bg-card px-3 py-3 shadow-sm"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${stat.tone}`}>
                {loading ? "—" : stat.value}
              </p>
            </div>
          ))}
        </div>

        <Card className="overflow-hidden rounded-xl border-border/80 shadow-sm">
          <CardContent className="space-y-0 p-0">
            <div className="flex flex-col gap-3 border-b bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 bg-white pl-8 text-sm"
                  placeholder="Search case no, memo no, place, owner…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {filtered.length} of {memos.length} shown
              </p>
            </div>

            <div className="w-full max-w-full overflow-x-auto">
              <Table className="min-w-[920px] table-fixed">
                <TableHeader>
                  <TableRow className="border-b bg-slate-50/90 hover:bg-slate-50/90">
                    <TableHead className="w-12 px-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Sr. No
                    </TableHead>
                    <TableHead className="w-[8.5rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Case No
                    </TableHead>
                    <TableHead className="w-[7.5rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Memo No
                    </TableHead>
                    <TableHead className="w-[6rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Date
                    </TableHead>
                    <TableHead className="w-[6.5rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Place
                    </TableHead>
                    <TableHead className="w-[4.5rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Type
                    </TableHead>
                    <TableHead className="w-[5.5rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Owner
                    </TableHead>
                    <TableHead className="w-[11rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Goods
                    </TableHead>
                    <TableHead className="w-[5rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Value
                    </TableHead>
                    <TableHead className="w-[5rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Verify
                    </TableHead>
                    <TableHead className="w-[6rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Assessment
                    </TableHead>
                    <TableHead className="sticky right-0 z-20 w-[6.5rem] bg-slate-50/95 px-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={12} className="py-14 text-center text-sm text-muted-foreground">
                        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                        Loading detention memos…
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="py-14 text-center text-sm text-muted-foreground">
                        No detention memos found. Create a detention memo first.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((memo, index) => {
                      const assessment = assessmentByMemoId.get(memo.id)
                      const isApproved = assessment?.status === "Approved"
                      const goodsLabel = goodsSummary(memo)
                      const goodsFull =
                        (memo.goodsItems ?? [])
                          .map((g) => g.description)
                          .filter(Boolean)
                          .join("; ") || goodsLabel

                      return (
                        <TableRow
                          key={memo.id}
                          className="group border-b border-slate-100 transition-colors hover:bg-sky-50/40"
                        >
                          <TableCell className="px-1.5 py-2 text-center text-xs font-medium tabular-nums text-foreground">
                            {pageSerial(index)}
                          </TableCell>
                          <TableCell className="px-1.5 py-2">
                            <button
                              type="button"
                              className="max-w-full truncate text-left font-mono text-[12px] font-semibold text-black hover:underline"
                              title={memo.caseNo || ""}
                              onClick={() => navigate(getDetentionMemoDetailPath(memo.id))}
                            >
                              {memo.caseNo || "—"}
                            </button>
                          </TableCell>
                          <TableCell className="px-1.5 py-2">
                            <span
                              className="block max-w-full truncate font-mono text-[11px] text-black"
                              title={memo.referenceNumber || ""}
                            >
                              {memo.referenceNumber || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="px-1.5 py-2 text-xs tabular-nums text-slate-700">
                            {memo.dateTimeDetention?.slice(0, 10) || "—"}
                          </TableCell>
                          <TableCell className="px-1.5 py-2">
                            <span
                              className="block max-w-full truncate text-xs text-slate-700"
                              title={memo.placeOfDetention || ""}
                            >
                              {shortPlace(memo.placeOfDetention)}
                            </span>
                          </TableCell>
                          <TableCell className="px-1.5 py-2 text-xs text-slate-700">
                            {memo.detentionType || "—"}
                          </TableCell>
                          <TableCell className="px-1.5 py-2">
                            <span
                              className="block max-w-full truncate text-xs"
                              title={memo.owner?.name || ""}
                            >
                              {memo.owner?.name || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-normal px-1.5 py-2">
                            <p
                              className="line-clamp-2 max-w-[11rem] break-words text-xs leading-snug text-foreground"
                              title={goodsFull}
                            >
                              {goodsLabel}
                            </p>
                          </TableCell>
                          <TableCell className="px-1.5 py-2 text-xs tabular-nums text-slate-700">
                            {goodsValue(memo)}
                          </TableCell>
                          <TableCell className="px-1.5 py-2">
                            {memo.verificationStatus === "Verified" ? (
                              <Badge className="rounded-md border-0 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 hover:bg-emerald-100">
                                Verified
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                              >
                                {memo.verificationStatus || "—"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="px-1.5 py-2">
                            <div className="min-w-0 space-y-0.5">
                              {assessmentStatusBadge(assessment)}
                              {assessment?.examiningOfficer ? (
                                <p
                                  className="truncate text-[10px] text-muted-foreground"
                                  title={assessment.examiningOfficer}
                                >
                                  {assessment.examiningOfficer}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="sticky right-0 z-10 overflow-visible bg-card px-1 py-1.5 text-right group-hover:bg-sky-50/40">
                            <TableActionGroup className="w-auto min-w-0 gap-0">
                              <TableActionIcon label="View memo" to={getDetentionMemoDetailPath(memo.id)}>
                                <Eye className="h-4 w-4" />
                              </TableActionIcon>
                              {assessment ? (
                                <>
                                  <TableActionIcon
                                    label={
                                      canUserEditAssessment(assessment, currentUser?.role)
                                        ? "Edit assessment"
                                        : "View assessment"
                                    }
                                    onClick={() =>
                                      navigate(
                                        canUserEditAssessment(assessment, currentUser?.role)
                                          ? getSeizureMgmtAssessmentEditPath(assessment.id)
                                          : getSeizureMgmtAssessmentDetailPath(assessment.id)
                                      )
                                    }
                                  >
                                    <ClipboardCheck className="h-4 w-4" />
                                  </TableActionIcon>
                                  {isApproved && assessment.documentRelevance === "Relevant" && (
                                    <TableActionIcon label="Release" to={ROUTES.RELEASE_INVENTORY}>
                                      <PackageOpen className="h-4 w-4" />
                                    </TableActionIcon>
                                  )}
                                  {isApproved && assessment.documentRelevance === "Not Relevant" && (
                                    <TableActionIcon
                                      label="Create recovery memo"
                                      to={recoveryMemoCreateHref(
                                        assessment.detentionMemoId,
                                        assessment.id
                                      )}
                                    >
                                      <Package className="h-4 w-4" />
                                    </TableActionIcon>
                                  )}
                                  {assessment.status !== "Approved" && (
                                    <TableActionIcon
                                      label="Delete assessment"
                                      destructive
                                      onClick={() => void handleDelete(assessment.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </TableActionIcon>
                                  )}
                                </>
                              ) : (
                                <TableActionIcon
                                  label="Assess"
                                  to={`${ROUTES.SEIZURE_MGMT_ASSESSMENT_CREATE}?detentionMemoId=${encodeURIComponent(memo.id)}`}
                                >
                                  <ClipboardCheck className="h-4 w-4" />
                                </TableActionIcon>
                              )}
                            </TableActionGroup>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {filtered.length > 0 ? (
              <div className="flex flex-col gap-3 border-t bg-slate-50/40 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Rows per page</span>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => {
                      setPageSize(Number(value))
                      setPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 w-[72px] bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={size.toString()}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of{" "}
                    {filtered.length}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1 lg:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="h-8 w-8 bg-white p-0"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="h-8 w-8 bg-white p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-2 text-xs tabular-nums text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page === totalPages}
                    className="h-8 w-8 bg-white p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="h-8 w-8 bg-white p-0"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <PdfExportHost hostRef={pdf.hostRef}>
        {pdf.items?.map((item) => (
          <AssessmentReportPrint key={item.row.id} row={item.row} memo={item.memo} embedded />
        ))}
      </PdfExportHost>
    </ModulePageLayout>
  )
}
