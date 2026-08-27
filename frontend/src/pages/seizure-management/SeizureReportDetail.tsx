import { useEffect, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  ClipboardCheck,
  FileOutput,
  FileText,
  Package,
  Printer,
  Send,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ROUTES,
  getDetentionMemoDetailPath,
  getSeizureMgmtAssessmentDetailPath,
  getSeizureMgmtRecoveryMemoDetailPath,
  getSeizureMgmtSeizureReportDetailPath,
} from "@/routes/config"
import {
  fetchAssessmentById,
  fetchRecoveryMemoById,
  fetchSeizureReportById,
  updateSeizureReport,
  type DetentionAssessmentRecord,
  type RecoveryMemoRecord,
  type SeizureReportRecord,
} from "@/lib/seizure-management-api"
import { fetchDetentionMemoById, type DetentionMemoApiRecord } from "@/lib/detention-memo-api"
import { getStoredUser } from "@/lib/auth"
import { toast } from "@/hooks/use-toast"
import { reportMissingField } from "@/lib/form-missing-field"
import { DetentionMemoReadOnlyView } from "@/pages/seizure-management/DetentionMemoReadOnlyView"
import SeizureReportPrint from "@/components/seizure/SeizureReportPrint"

function DetailRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-border/50 py-2 sm:grid-cols-[180px_1fr] sm:gap-2">
      <span className="text-sm text-muted-foreground break-words">{label}</span>
      <span className="text-sm font-medium break-words whitespace-pre-wrap">
        {value?.trim() ? value : "—"}
      </span>
    </div>
  )
}

function statusBadge(status: SeizureReportRecord["status"]) {
  if (status === "Submitted") return <Badge>Submitted</Badge>
  return <Badge variant="outline">Draft</Badge>
}

function formatWhen(value?: string) {
  if (!value?.trim()) return "—"
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export default function SeizureReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const printMode = searchParams.get("print")
  const autoPrint = searchParams.get("autoprint") === "1"
  const autoSavePdf = searchParams.get("savepdf") === "1"
  const [row, setRow] = useState<SeizureReportRecord | null>(null)
  const [memo, setMemo] = useState<DetentionMemoApiRecord | null>(null)
  const [assessment, setAssessment] = useState<DetentionAssessmentRecord | null>(null)
  const [recovery, setRecovery] = useState<RecoveryMemoRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [editSummary, setEditSummary] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editPreparedBy, setEditPreparedBy] = useState("")
  const [editReportDate, setEditReportDate] = useState("")
  const [invalidField, setInvalidField] = useState("")

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    fetchSeizureReportById(id)
      .then(async (report) => {
        if (cancelled) return
        setRow(report)
        setEditSummary(report.summary || "")
        setEditNotes(report.recoveryAssessmentNotes || "")
        setEditPreparedBy(
          report.preparedBy ||
            getStoredUser()?.full_name ||
            getStoredUser()?.username ||
            ""
        )
        setEditReportDate(report.reportDate || new Date().toISOString().slice(0, 10))

        const [memoRes, assessRes, recoveryRes] = await Promise.all([
          fetchDetentionMemoById(report.detentionMemoId).catch(() => null),
          report.assessmentId
            ? fetchAssessmentById(report.assessmentId).catch(() => null)
            : Promise.resolve(null),
          report.recoveryMemoId
            ? fetchRecoveryMemoById(report.recoveryMemoId).catch(() => null)
            : Promise.resolve(null),
        ])
        if (cancelled) return
        setMemo(memoRes)
        setAssessment(assessRes)
        setRecovery(recoveryRes)
      })
      .catch(() => {
        if (cancelled) return
        setRow(null)
        setMemo(null)
        setAssessment(null)
        setRecovery(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (printMode === "full" && autoPrint && row) {
      const timer = window.setTimeout(() => window.print(), 350)
      return () => window.clearTimeout(timer)
    }
  }, [printMode, autoPrint, row])

  if (loading) {
    return (
      <ModulePageLayout
        title="Seizure Report"
        description="Loading…"
        breadcrumbs={[
          { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
          { label: "Seizure Report", href: ROUTES.SEIZURE_MGMT_SEIZURE_REPORT },
        ]}
      >
        <p className="text-muted-foreground">Loading seizure report…</p>
      </ModulePageLayout>
    )
  }

  if (!row) {
    return (
      <ModulePageLayout
        title="Seizure Report"
        description="Not found"
        breadcrumbs={[
          { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
          { label: "Seizure Report", href: ROUTES.SEIZURE_MGMT_SEIZURE_REPORT },
        ]}
      >
        <p className="text-muted-foreground mb-4">Seizure report not found.</p>
        <Button variant="outline" onClick={() => navigate(ROUTES.SEIZURE_MGMT_SEIZURE_REPORT)}>
          Back to list
        </Button>
      </ModulePageLayout>
    )
  }

  if (printMode === "full") {
    return (
      <SeizureReportPrint
        row={row}
        memo={memo}
        assessment={assessment}
        recovery={recovery}
        autoSavePdf={autoSavePdf}
      />
    )
  }

  const isDraft = row.status === "Draft"
  const canSubmit =
    isDraft &&
    Boolean(row.assessmentId) &&
    Boolean(row.recoveryMemoId) &&
    assessment?.status === "Approved" &&
    recovery?.approvalStatus === "Approved"

  const saveDraft = async () => {
    if (!editPreparedBy.trim()) {
      setInvalidField("sr-prepared-by")
      reportMissingField({ id: "sr-prepared-by", label: "Prepared By" })
      return
    }
    setInvalidField("")
    setActing(true)
    try {
      const updated = await updateSeizureReport(row.id, {
        detentionMemoId: row.detentionMemoId,
        assessmentId: row.assessmentId || undefined,
        recoveryMemoId: row.recoveryMemoId || undefined,
        caseNo: row.caseNo,
        reportDate: editReportDate,
        preparedBy: editPreparedBy,
        summary: editSummary,
        recoveryAssessmentNotes: editNotes,
        status: "Draft",
      })
      setRow(updated)
      toast({ title: "Draft saved" })
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Failed to save",
        variant: "destructive",
      })
    } finally {
      setActing(false)
    }
  }

  const submitReport = async () => {
    if (!canSubmit) {
      toast({
        title: "Approved assessment and recovery memo are required to submit",
        variant: "destructive",
      })
      return
    }
    if (!editPreparedBy.trim()) {
      setInvalidField("sr-prepared-by")
      reportMissingField({ id: "sr-prepared-by", label: "Prepared By" })
      return
    }
    if (!editSummary.trim()) {
      setInvalidField("sr-summary")
      reportMissingField({ id: "sr-summary", label: "Summary" })
      return
    }
    setInvalidField("")
    setActing(true)
    try {
      const updated = await updateSeizureReport(row.id, {
        detentionMemoId: row.detentionMemoId,
        assessmentId: row.assessmentId || undefined,
        recoveryMemoId: row.recoveryMemoId || undefined,
        caseNo: row.caseNo,
        reportDate: editReportDate,
        preparedBy: editPreparedBy,
        summary: editSummary,
        recoveryAssessmentNotes: editNotes,
        status: "Submitted",
      })
      setRow(updated)
      toast({ title: "Seizure report submitted" })
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Failed to submit",
        variant: "destructive",
      })
    } finally {
      setActing(false)
    }
  }

  return (
    <ModulePageLayout
      title={memo ? `Detention Memo: ${memo.caseNo}` : `Seizure Report — ${row.caseNo}`}
      description={
        memo?.referenceNumber
          ? `Memo No. ${memo.referenceNumber} · Seizure Report ${row.status}`
          : `Seizure report · ${row.status}`
      }
      breadcrumbs={[
        { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
        { label: "Seizure Report", href: ROUTES.SEIZURE_MGMT_SEIZURE_REPORT },
        { label: row.caseNo || "Detail" },
      ]}
    >
      <div className="mb-4">
        <Button variant="outline" size="sm" asChild>
          <Link to={ROUTES.SEIZURE_MGMT_SEIZURE_REPORT}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to list
          </Link>
        </Button>
      </div>

      {isDraft && (
        <div className="mb-4 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          This seizure report is still a <span className="font-medium">draft</span>. Review the
          linked detention, assessment, and recovery details below, then submit when ready.
        </div>
      )}

      {row.status === "Submitted" && (
        <div className="mb-4 rounded-[10px] border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          Submitted by <span className="font-medium">{row.preparedBy || "—"}</span>
          {row.submittedAt ? (
            <>
              {" "}
              on <span className="font-medium">{formatWhen(row.submittedAt)}</span>
            </>
          ) : null}
          .
        </div>
      )}

      <div className="grid gap-4 sm:gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between px-4 sm:px-6">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <FileText className="h-5 w-5 flex-shrink-0" />
                <span className="break-words">{memo?.caseNo || row.caseNo || "Seizure Report"}</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {memo?.referenceNumber ? (
                  <>
                    Detention Memo No.{" "}
                    <span className="font-semibold text-foreground">{memo.referenceNumber}</span>
                  </>
                ) : (
                  "Final seizure report consolidating recovery and assessment."
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge(row.status)}
              {memo?.verificationStatus && (
                <Badge variant={memo.verificationStatus === "Verified" ? "default" : "secondary"}>
                  {memo.verificationStatus}
                </Badge>
              )}
              <Button variant="outline" asChild size="sm">
                <Link to={`${getSeizureMgmtSeizureReportDetailPath(row.id)}?print=full`}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print Report
                </Link>
              </Button>
              <Button variant="outline" asChild size="sm">
                <Link to={`${getSeizureMgmtSeizureReportDetailPath(row.id)}?print=full&savepdf=1`}>
                  <FileOutput className="h-4 w-4 mr-2" />
                  Save as PDF
                </Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
            {memo ? (
              <DetentionMemoReadOnlyView memo={memo} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Detention memo could not be loaded.{" "}
                <Link
                  to={getDetentionMemoDetailPath(row.detentionMemoId)}
                  className="text-primary hover:underline"
                >
                  Open detention memo
                </Link>
              </p>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Seizure Report
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isDraft ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Report Date</Label>
                      <Input
                        type="date"
                        value={editReportDate}
                        onChange={(e) => setEditReportDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sr-prepared-by">Prepared By <span className="text-red-600">*</span></Label>
                      <Input
                        id="sr-prepared-by"
                        value={editPreparedBy}
                        aria-invalid={invalidField === "sr-prepared-by"}
                        onChange={(e) => {
                          setEditPreparedBy(e.target.value)
                          if (invalidField === "sr-prepared-by") setInvalidField("")
                        }}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="sr-summary">Summary <span className="text-red-600">*</span></Label>
                      <Textarea
                        id="sr-summary"
                        rows={4}
                        value={editSummary}
                        aria-invalid={invalidField === "sr-summary"}
                        onChange={(e) => {
                          setEditSummary(e.target.value)
                          if (invalidField === "sr-summary") setInvalidField("")
                        }}
                        placeholder="Executive summary of the seizure…"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label>Recovery + Assessment Sheet</Label>
                      <Textarea
                        rows={6}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
                    <DetailRow label="Case No." value={row.caseNo} />
                    <DetailRow label="Reference No." value={row.referenceNumber} />
                    <DetailRow label="Report Date" value={row.reportDate} />
                    <DetailRow label="Prepared By" value={row.preparedBy} />
                    <DetailRow label="Submitted At" value={formatWhen(row.submittedAt)} />
                    <div className="md:col-span-2">
                      <DetailRow label="Summary" value={row.summary} />
                    </div>
                    <div className="md:col-span-2">
                      <DetailRow
                        label="Recovery + Assessment Sheet"
                        value={row.recoveryAssessmentNotes}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Linked Assessment
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assessment ? (
                  <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
                    <DetailRow label="Assessment Date" value={assessment.assessmentDate} />
                    <DetailRow label="Examining Officer" value={assessment.examiningOfficer} />
                    <DetailRow label="Status" value={assessment.status} />
                    <DetailRow label="Document Relevance" value={assessment.documentRelevance} />
                    <DetailRow label="Goods Condition" value={assessment.goodsCondition} />
                    <div className="md:col-span-2">
                      <DetailRow label="Findings" value={assessment.findings} />
                    </div>
                    <div className="md:col-span-2 py-2">
                      <Button variant="link" className="h-auto p-0" asChild>
                        <Link to={getSeizureMgmtAssessmentDetailPath(assessment.id)}>
                          View full assessment
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No assessment linked.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Linked Recovery Memo
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recovery ? (
                  <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
                    <DetailRow label="Category" value={recovery.category} />
                    <DetailRow label="Recovery Date" value={recovery.recoveryDate} />
                    <DetailRow label="Recovery Officer" value={recovery.recoveryOfficer} />
                    <DetailRow label="Approval Status" value={recovery.approvalStatus} />
                    <DetailRow label="Quantity" value={recovery.quantity} />
                    <DetailRow label="Approved By" value={recovery.approvedBy} />
                    <div className="md:col-span-2">
                      <DetailRow label="Goods Description" value={recovery.goodsDescription} />
                    </div>
                    <div className="md:col-span-2">
                      <DetailRow label="Remarks" value={recovery.remarks} />
                    </div>
                    {recovery.depositAccountId ? (
                      <DetailRow label="Deposit Account" value={recovery.depositAccountId} />
                    ) : null}
                    <div className="md:col-span-2 py-2">
                      <Button variant="link" className="h-auto p-0" asChild>
                        <Link to={getSeizureMgmtRecoveryMemoDetailPath(recovery.id)}>
                          View full recovery memo
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No recovery memo linked.</p>
                )}
              </CardContent>
            </Card>

            {isDraft && (
              <Card className="rounded-[10px]">
                <CardContent className="p-6 flex flex-wrap gap-2">
                  <Button variant="outline" disabled={acting} onClick={() => void saveDraft()}>
                    Save Draft
                  </Button>
                  <Button disabled={acting || !canSubmit} onClick={() => void submitReport()}>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Report
                  </Button>
                  {!canSubmit && (
                    <p className="w-full text-sm text-muted-foreground">
                      Submit requires an approved assessment and an approved recovery memo linked to
                      this report.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="rounded-[10px] border-gray-200">
              <CardHeader>
                <CardTitle className="text-base">Audit Log</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-muted-foreground text-sm">Prepared By</dt>
                    <dd className="font-medium text-sm">{row.preparedBy?.trim() || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">Report Date</dt>
                    <dd className="font-medium text-sm">{row.reportDate?.trim() || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">Created On</dt>
                    <dd className="font-medium text-sm">{formatWhen(row.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">Updated On</dt>
                    <dd className="font-medium text-sm">{formatWhen(row.updatedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">Submitted At</dt>
                    <dd className="font-medium text-sm">{formatWhen(row.submittedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">Status</dt>
                    <dd className="font-medium text-sm">{row.status}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to={ROUTES.SEIZURE_MGMT_SEIZURE_REPORT}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to list
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
