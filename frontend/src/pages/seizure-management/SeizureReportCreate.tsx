import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, ClipboardCheck, Loader2, Package, Send } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ROUTES,
  getSeizureMgmtAssessmentDetailPath,
  getSeizureMgmtRecoveryMemoDetailPath,
  getSeizureMgmtSeizureReportDetailPath,
} from "@/routes/config"
import {
  fetchDetentionMemoById,
  fetchDetentionMemos,
  type DetentionMemoApiRecord,
} from "@/lib/detention-memo-api"
import {
  createSeizureReport,
  fetchAssessments,
  fetchRecoveryMemos,
  type DetentionAssessmentRecord,
  type RecoveryMemoRecord,
} from "@/lib/seizure-management-api"
import { getStoredUser } from "@/lib/auth"
import { toast } from "@/hooks/use-toast"
import { firstMissingField, reportMissingField } from "@/lib/form-missing-field"
import { DetentionMemoReadOnlyView } from "@/pages/seizure-management/DetentionMemoReadOnlyView"

function buildSheetNotes(
  assess: DetentionAssessmentRecord | undefined,
  recovery: RecoveryMemoRecord | undefined
) {
  return [
    assess
      ? `Assessment: ${assess.findings || assess.goodsCondition || "—"} (${assess.status}; docs: ${assess.documentRelevance})`
      : "Assessment: not recorded",
    recovery
      ? `Recovery: ${recovery.category} — ${recovery.goodsDescription || "—"} (${recovery.approvalStatus})`
      : "Recovery: no approved memo",
  ].join("\n")
}

export default function SeizureReportCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const memoFromQuery = searchParams.get("detentionMemoId")?.trim() || ""
  const recoveryFromQuery = searchParams.get("recoveryMemoId")?.trim() || ""
  const assessmentFromQuery = searchParams.get("assessmentId")?.trim() || ""

  const [memos, setMemos] = useState<DetentionMemoApiRecord[]>([])
  const [assessments, setAssessments] = useState<DetentionAssessmentRecord[]>([])
  const [recoveryMemos, setRecoveryMemos] = useState<RecoveryMemoRecord[]>([])
  const [selectedMemo, setSelectedMemo] = useState<DetentionMemoApiRecord | null>(null)
  const [memoLoading, setMemoLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [invalidField, setInvalidField] = useState("")

  const [form, setForm] = useState({
    detentionMemoId: memoFromQuery,
    caseNo: "",
    assessmentId: assessmentFromQuery,
    recoveryMemoId: recoveryFromQuery,
    reportDate: new Date().toISOString().slice(0, 10),
    preparedBy: getStoredUser()?.full_name || getStoredUser()?.username || "",
    summary: "",
    recoveryAssessmentNotes: "",
  })

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchDetentionMemos().catch(() => [] as DetentionMemoApiRecord[]),
      fetchAssessments().catch(() => [] as DetentionAssessmentRecord[]),
      fetchRecoveryMemos().catch(() => [] as RecoveryMemoRecord[]),
    ])
      .then(([m, a, r]) => {
        setMemos(m)
        setAssessments(a)
        setRecoveryMemos(r)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!form.detentionMemoId) {
      setSelectedMemo(null)
      return
    }
    let cancelled = false
    setMemoLoading(true)
    fetchDetentionMemoById(form.detentionMemoId)
      .then((m) => {
        if (cancelled) return
        setSelectedMemo(m)
        setForm((f) => ({ ...f, caseNo: m.caseNo || f.caseNo }))
      })
      .catch(() => {
        if (!cancelled) setSelectedMemo(null)
      })
      .finally(() => {
        if (!cancelled) setMemoLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [form.detentionMemoId])

  const recoveryOptions = useMemo(
    () =>
      recoveryMemos.filter(
        (r) => r.detentionMemoId === form.detentionMemoId && r.approvalStatus === "Approved"
      ),
    [form.detentionMemoId, recoveryMemos]
  )

  const assessmentOptions = useMemo(
    () => assessments.filter((a) => a.detentionMemoId === form.detentionMemoId),
    [assessments, form.detentionMemoId]
  )

  const assessment = useMemo(
    () =>
      assessmentOptions.find((a) => a.id === form.assessmentId) ||
      assessmentOptions.find((a) => a.status === "Approved") ||
      assessmentOptions[0],
    [assessmentOptions, form.assessmentId]
  )

  const selectedRecovery = useMemo(
    () => recoveryOptions.find((r) => r.id === form.recoveryMemoId) || recoveryOptions[0],
    [recoveryOptions, form.recoveryMemoId]
  )

  // Prefill linked ids + sheet notes when memo / lists load
  useEffect(() => {
    if (!form.detentionMemoId || loading) return
    const assess =
      (assessmentFromQuery
        ? assessments.find((a) => a.id === assessmentFromQuery)
        : undefined) ||
      assessments.find((a) => a.detentionMemoId === form.detentionMemoId && a.status === "Approved") ||
      assessments.find((a) => a.detentionMemoId === form.detentionMemoId)
    const approvedRecovery =
      (recoveryFromQuery
        ? recoveryMemos.find((r) => r.id === recoveryFromQuery)
        : undefined) ||
      recoveryMemos.find(
        (r) => r.detentionMemoId === form.detentionMemoId && r.approvalStatus === "Approved"
      )

    setForm((f) => {
      const nextAssessmentId = f.assessmentId || assess?.id || ""
      const nextRecoveryId = f.recoveryMemoId || approvedRecovery?.id || ""
      const nextAssess =
        assessments.find((a) => a.id === nextAssessmentId) || assess
      const nextRecovery =
        recoveryMemos.find((r) => r.id === nextRecoveryId) || approvedRecovery
      const notes =
        f.recoveryAssessmentNotes.trim() || buildSheetNotes(nextAssess, nextRecovery)
      if (
        nextAssessmentId === f.assessmentId &&
        nextRecoveryId === f.recoveryMemoId &&
        notes === f.recoveryAssessmentNotes
      ) {
        return f
      }
      return {
        ...f,
        assessmentId: nextAssessmentId,
        recoveryMemoId: nextRecoveryId,
        recoveryAssessmentNotes: notes,
      }
    })
  }, [
    form.detentionMemoId,
    loading,
    assessments,
    recoveryMemos,
    assessmentFromQuery,
    recoveryFromQuery,
  ])

  const onMemoSelect = (memoId: string) => {
    const memo = memos.find((m) => m.id === memoId)
    const assess =
      assessments.find((a) => a.detentionMemoId === memoId && a.status === "Approved") ||
      assessments.find((a) => a.detentionMemoId === memoId)
    const approvedRecovery = recoveryMemos.find(
      (r) => r.detentionMemoId === memoId && r.approvalStatus === "Approved"
    )
    setForm((f) => ({
      ...f,
      detentionMemoId: memoId,
      caseNo: memo?.caseNo ?? "",
      assessmentId: assess?.id ?? "",
      recoveryMemoId: approvedRecovery?.id ?? "",
      recoveryAssessmentNotes: buildSheetNotes(assess, approvedRecovery),
    }))
    setInvalidField("")
  }

  const handleSave = async (submit: boolean) => {
    const missing = firstMissingField([
      { id: "sr-memo", label: "Detention Memo", missing: !form.detentionMemoId },
      { id: "sr-prepared-by", label: "Prepared By", missing: !form.preparedBy.trim() },
      {
        id: "sr-assessment",
        label: "Assessment",
        missing: submit && !form.assessmentId,
        message: "Completed assessment is required to submit.",
      },
      {
        id: "sr-assessment",
        label: "Assessment",
        title: "Assessment must be approved",
        missing: submit && Boolean(assessment) && assessment?.status !== "Approved",
        message: "Assessment must be approved before submit.",
      },
      {
        id: "sr-recovery",
        label: "Approved Recovery Memo",
        missing: submit && !form.recoveryMemoId,
        message: "An approved recovery memo is required to submit.",
      },
      {
        id: "sr-recovery",
        label: "Approved Recovery Memo",
        title: "Recovery memo must be approved",
        missing: submit && Boolean(selectedRecovery) && selectedRecovery?.approvalStatus !== "Approved",
        message: "Recovery memo must be approved before submit.",
      },
      { id: "sr-summary", label: "Summary", missing: submit && !form.summary.trim() },
    ])
    if (missing) {
      setInvalidField(missing.id)
      reportMissingField(missing)
      return
    }
    setInvalidField("")
    setSaving(true)
    try {
      const saved = await createSeizureReport({
        detentionMemoId: form.detentionMemoId,
        caseNo: form.caseNo,
        assessmentId: form.assessmentId || undefined,
        recoveryMemoId: form.recoveryMemoId || undefined,
        reportDate: form.reportDate,
        preparedBy: form.preparedBy,
        summary: form.summary,
        recoveryAssessmentNotes: form.recoveryAssessmentNotes,
        status: submit ? "Submitted" : "Draft",
      })
      toast({ title: submit ? "Seizure report submitted" : "Draft saved" })
      navigate(getSeizureMgmtSeizureReportDetailPath(saved.id))
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Failed to save",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModulePageLayout
      title="Create Seizure Report"
      description="Consolidates detention, recovery, and assessment into the final seizure report."
      breadcrumbs={[
        { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
        { label: "Seizure Report", href: ROUTES.SEIZURE_MGMT_SEIZURE_REPORT },
        { label: "Create" },
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

      {loading ? (
        <p className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : (
        <div className="grid gap-4 sm:gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-lg">Detention Memo</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select the detained case. Linked approved assessment and recovery are loaded
                automatically.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6">
              <div className="space-y-2 max-w-xl">
                <Label htmlFor="sr-memo">Detention Memo / Case <span className="text-red-600">*</span></Label>
                <Select value={form.detentionMemoId || undefined} onValueChange={onMemoSelect}>
                  <SelectTrigger id="sr-memo" className="w-full" aria-invalid={invalidField === "sr-memo"}>
                    <SelectValue placeholder="Select case" />
                  </SelectTrigger>
                  <SelectContent>
                    {memos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.caseNo || m.referenceNumber || m.id}
                        {m.referenceNumber ? ` · ${m.referenceNumber}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {memoLoading ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading detention memo…
                </p>
              ) : selectedMemo ? (
                <DetentionMemoReadOnlyView memo={selectedMemo} />
              ) : form.detentionMemoId ? (
                <p className="text-sm text-muted-foreground">Detention memo could not be loaded.</p>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card
              id="sr-assessment"
              tabIndex={-1}
              className={
                invalidField === "sr-assessment" ? "ring-2 ring-red-500 outline-none" : undefined
              }
            >
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Assessment <span className="text-red-600">*</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {assessment ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={assessment.status === "Approved" ? "default" : "secondary"}>
                        {assessment.status}
                      </Badge>
                      <span className="text-muted-foreground">{assessment.documentRelevance}</span>
                    </div>
                    <p>
                      <span className="text-muted-foreground">Officer:</span>{" "}
                      {assessment.examiningOfficer || "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Findings:</span>{" "}
                      {assessment.findings || assessment.goodsCondition || "—"}
                    </p>
                    <Button variant="link" className="h-auto p-0" asChild>
                      <Link to={getSeizureMgmtAssessmentDetailPath(assessment.id)}>
                        View assessment
                      </Link>
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">No assessment for this detention memo.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Recovery Memo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="space-y-2">
                  <Label htmlFor="sr-recovery">Approved Recovery Memo <span className="text-red-600">*</span></Label>
                  <Select
                    value={form.recoveryMemoId || undefined}
                    onValueChange={(v) => {
                      const r = recoveryOptions.find((x) => x.id === v)
                      setForm((f) => ({
                        ...f,
                        recoveryMemoId: v,
                        recoveryAssessmentNotes: buildSheetNotes(assessment, r),
                      }))
                      if (invalidField === "sr-recovery") setInvalidField("")
                    }}
                  >
                    <SelectTrigger id="sr-recovery" className="w-full" aria-invalid={invalidField === "sr-recovery"}>
                      <SelectValue
                        placeholder={
                          recoveryOptions.length ? "Select recovery memo" : "None approved"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {recoveryOptions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.category} — {r.recoveryDate || "no date"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedRecovery ? (
                  <>
                    <p>
                      <span className="text-muted-foreground">Officer:</span>{" "}
                      {selectedRecovery.recoveryOfficer || "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Goods:</span>{" "}
                      {selectedRecovery.goodsDescription || "—"}
                    </p>
                    <Button variant="link" className="h-auto p-0" asChild>
                      <Link to={getSeizureMgmtRecoveryMemoDetailPath(selectedRecovery.id)}>
                        View recovery memo
                      </Link>
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    No approved recovery memo for this case yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seizure Report Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Report Date</Label>
                  <Input
                    type="date"
                    value={form.reportDate}
                    onChange={(e) => setForm((f) => ({ ...f, reportDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sr-prepared-by">Prepared By <span className="text-red-600">*</span></Label>
                  <Input
                    id="sr-prepared-by"
                    value={form.preparedBy}
                    aria-invalid={invalidField === "sr-prepared-by"}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, preparedBy: e.target.value }))
                      if (invalidField === "sr-prepared-by") setInvalidField("")
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sr-summary">Summary <span className="text-red-600">*</span></Label>
                <Textarea
                  id="sr-summary"
                  value={form.summary}
                  aria-invalid={invalidField === "sr-summary"}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, summary: e.target.value }))
                    if (invalidField === "sr-summary") setInvalidField("")
                  }}
                  rows={4}
                  placeholder="Executive summary of the seizure…"
                />
              </div>

              <div className="space-y-2">
                <Label>Recovery + Assessment Sheet</Label>
                <Textarea
                  value={form.recoveryAssessmentNotes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, recoveryAssessmentNotes: e.target.value }))
                  }
                  rows={6}
                  placeholder="Select a detention memo to load sheet data."
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void handleSave(false)} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Draft
                </Button>
                <Button onClick={() => void handleSave(true)} disabled={saving}>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </ModulePageLayout>
  )
}
