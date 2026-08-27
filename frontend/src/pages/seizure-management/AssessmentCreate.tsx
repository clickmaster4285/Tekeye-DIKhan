import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft, Send } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { ROUTES, getSeizureMgmtAssessmentDetailPath } from "@/routes/config"
import { fetchDetentionMemoById, fetchDetentionMemos, type DetentionMemoApiRecord } from "@/lib/detention-memo-api"
import {
  assessmentApproval,
  createAssessment,
  fetchAssessmentById,
  fetchAssessments,
  updateAssessment,
  type AssessmentGoodsValuation,
  type DocumentRelevance,
} from "@/lib/seizure-management-api"
import { getStoredUser } from "@/lib/auth"
import { toast } from "@/hooks/use-toast"
import { firstMissingField, reportMissingField } from "@/lib/form-missing-field"
import { DetentionMemoReadOnlyView } from "@/pages/seizure-management/DetentionMemoReadOnlyView"

type GoodsValuationRow = AssessmentGoodsValuation & {
  description: string
  quantity: string
  unit: string
}

export default function AssessmentCreatePage() {
  const navigate = useNavigate()
  const { id: editId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(editId)
  const memoFromQuery = searchParams.get("detentionMemoId")?.trim() || ""

  const [memos, setMemos] = useState<DetentionMemoApiRecord[]>([])
  const [assessedMemoIds, setAssessedMemoIds] = useState<Set<string>>(new Set())
  const [selectedMemo, setSelectedMemo] = useState<DetentionMemoApiRecord | null>(null)
  const [memoLoading, setMemoLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")
  const [invalidField, setInvalidField] = useState("")

  const [detentionMemoId, setDetentionMemoId] = useState(memoFromQuery)
  const [assessmentDate, setAssessmentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [examiningOfficer, setExaminingOfficer] = useState(
    () => getStoredUser()?.full_name || getStoredUser()?.username || ""
  )
  const [goodsCondition, setGoodsCondition] = useState("")
  const [valuationNotes, setValuationNotes] = useState("")
  const [findings, setFindings] = useState("")
  const [documentRelevance, setDocumentRelevance] = useState<DocumentRelevance>("Pending")
  const [goodsValuation, setGoodsValuation] = useState<GoodsValuationRow[]>([])

  const [photos, setPhotos] = useState<File[]>([])
  const [pdfs, setPdfs] = useState<File[]>([])
  const [invoices, setInvoices] = useState<File[]>([])
  const [otherDocs, setOtherDocs] = useState<File[]>([])
  const [existingAttachmentCount, setExistingAttachmentCount] = useState(0)
  const [auditLog, setAuditLog] = useState({
    createdBy: "",
    createdAt: "",
    updatedBy: "",
    updatedAt: "",
    approvedBy: "",
    approvedAt: "",
  })

  const availableMemos = useMemo(() => {
    if (isEdit) return memos
    return memos.filter((m) => !assessedMemoIds.has(m.id) || m.id === detentionMemoId)
  }, [memos, assessedMemoIds, detentionMemoId, isEdit])

  /** Memo with live PCT / assessable values from the assessment form so Goods Information updates as you type. */
  const memoWithLiveValuation = useMemo(() => {
    if (!selectedMemo) return null
    const byId = new Map(goodsValuation.map((g) => [g.id, g]))
    return {
      ...selectedMemo,
      goodsItems: (selectedMemo.goodsItems ?? []).map((item) => {
        const live = byId.get(item.id)
        if (!live) return item
        return {
          ...item,
          pctCode: live.pctCode,
          assessableValuePkr: live.assessableValuePkr,
        }
      }),
    }
  }, [selectedMemo, goodsValuation])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchDetentionMemos(), fetchAssessments()])
      .then(([m, a]) => {
        setMemos(m)
        setAssessedMemoIds(new Set(a.map((x) => x.detentionMemoId)))
      })
      .catch(() => {
        setMemos([])
        setAssessedMemoIds(new Set())
      })
      .finally(() => setLoading(false))
  }, [])

  // Always load full detention memo for verification while assessing
  useEffect(() => {
    if (!detentionMemoId) {
      setSelectedMemo(null)
      setGoodsValuation([])
      return
    }
    let cancelled = false
    setMemoLoading(true)
    fetchDetentionMemoById(detentionMemoId)
      .then((m) => {
        if (cancelled) return
        setSelectedMemo(m)
        setMemos((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
        setGoodsValuation(
          (m.goodsItems ?? []).map((g) => ({
            id: g.id,
            description: g.description || "",
            quantity: g.quantity || "",
            unit: g.unit || "",
            pctCode: g.pctCode || "",
            assessableValuePkr: g.assessableValuePkr || "",
          }))
        )
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedMemo(null)
          setGoodsValuation([])
        }
      })
      .finally(() => {
        if (!cancelled) setMemoLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [detentionMemoId])

  useEffect(() => {
    if (!editId) return
    fetchAssessmentById(editId)
      .then((row) => {
        if (row.status !== "Draft" && row.status !== "Rejected") {
          toast({
            title: "Cannot edit",
            description: "Only draft or rejected assessments can be edited.",
            variant: "destructive",
          })
          navigate(getSeizureMgmtAssessmentDetailPath(row.id))
          return
        }
        setDetentionMemoId(row.detentionMemoId)
        setAssessmentDate(row.assessmentDate || new Date().toISOString().slice(0, 10))
        setExaminingOfficer(row.examiningOfficer || "")
        setGoodsCondition(row.goodsCondition || "")
        setValuationNotes(row.valuationNotes || "")
        setFindings(row.findings || "")
        setDocumentRelevance(row.documentRelevance || "Pending")
        setExistingAttachmentCount(row.attachments?.length || 0)
        setAuditLog({
          createdBy: row.createdBy || "",
          createdAt: row.createdAt || "",
          updatedBy: row.updatedBy || "",
          updatedAt: row.updatedAt || "",
          approvedBy: row.approvedBy || "",
          approvedAt: row.approvedAt || "",
        })
      })
      .catch((e) => {
        toast({
          title: "Failed to load assessment",
          description: e instanceof Error ? e.message : "Not found",
          variant: "destructive",
        })
        navigate(ROUTES.SEIZURE_MGMT_ASSESSMENT)
      })
  }, [editId, navigate])

  const media = {
    photos,
    pdfs,
    invoices,
    documents: otherDocs,
  }

  const updateGoodsValuation = (id: string, field: "pctCode" | "assessableValuePkr", value: string) => {
    setGoodsValuation((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }

  const goodsValuationPayload = (): AssessmentGoodsValuation[] =>
    goodsValuation.map((row) => ({
      id: row.id,
      pctCode: row.pctCode.trim(),
      assessableValuePkr: row.assessableValuePkr.trim(),
    }))

  const payload = () => {
    const user = getStoredUser()
    const actor = (user?.full_name || "").trim() || user?.username?.trim() || ""
    return {
      detentionMemoId,
      assessmentDate,
      examiningOfficer,
      goodsCondition,
      valuationNotes,
      findings,
      documentRelevance,
      goodsValuation: goodsValuationPayload(),
      createdBy: actor,
      updatedBy: actor,
    }
  }

  const handleSave = async (andSubmit: boolean) => {
    setFormError("")
    const missing = firstMissingField([
      { id: "as-memo", label: "Detention Memo", missing: !detentionMemoId },
      { id: "as-officer", label: "Examining Officer", missing: !examiningOfficer.trim() },
      { id: "as-findings", label: "Findings", missing: andSubmit && !findings.trim() },
      {
        id: "as-relevance",
        label: "Document Relevance",
        missing: andSubmit && documentRelevance === "Pending",
        message: "Set document relevance to Relevant or Not Relevant before sending for approval.",
      },
    ])
    if (missing) {
      setInvalidField(missing.id)
      setFormError(missing.message ?? `${missing.label} is required`)
      reportMissingField(missing)
      return
    }
    setInvalidField("")

    setSaving(true)
    try {
      let id = editId || ""
      const body = payload()
      if (isEdit && editId) {
        await updateAssessment(editId, body, media)
        id = editId
      } else {
        const created = await createAssessment(body, media)
        id = created.id
      }
      if (andSubmit) {
        await assessmentApproval(id, "submit")
        toast({ title: "Sent for approval", description: "Assessment submitted to approving officers." })
      } else {
        toast({ title: "Saved", description: isEdit ? "Assessment updated." : "Assessment saved as draft." })
      }
      navigate(getSeizureMgmtAssessmentDetailPath(id))
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed"
      console.error("Assessment save failed", e)
      setFormError(msg)
      toast({ title: "Save failed", description: msg, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModulePageLayout
      title={isEdit ? "Edit Assessment" : "Create Assessment"}
      description="Record examination findings, PCT codes, assessable values, upload documents, then save draft or send for approval."
      breadcrumbs={[
        { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
        { label: "Assessment", href: ROUTES.SEIZURE_MGMT_ASSESSMENT },
        { label: isEdit ? "Edit" : "Create" },
      ]}
    >
      <div className="mb-4">
        <Button variant="outline" size="sm" asChild>
          <Link to={ROUTES.SEIZURE_MGMT_ASSESSMENT}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to list
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Select Detention Memo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="as-memo">Detention Memo <span className="text-red-600">*</span></Label>
              <Select
                value={detentionMemoId || undefined}
                onValueChange={(v) => {
                  setDetentionMemoId(v)
                  if (invalidField === "as-memo") setInvalidField("")
                }}
                disabled={isEdit || loading}
              >
                <SelectTrigger id="as-memo" className="w-full" aria-invalid={invalidField === "as-memo"}>
                  <SelectValue placeholder={loading ? "Loading…" : "Select detention memo"} />
                </SelectTrigger>
                <SelectContent>
                  {availableMemos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.caseNo || m.referenceNumber || m.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!loading && availableMemos.length === 0 && (
                <p className="text-sm text-amber-800">
                  No detention memos available for a new assessment.{" "}
                  <Link to={ROUTES.DETENTION_MEMO} className="underline text-primary">
                    Create a detention memo
                  </Link>{" "}
                  first.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Assessment Date</Label>
              <Input type="date" value={assessmentDate} onChange={(e) => setAssessmentDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="as-officer">Examining Officer <span className="text-red-600">*</span></Label>
              <Input
                id="as-officer"
                value={examiningOfficer}
                aria-invalid={invalidField === "as-officer"}
                onChange={(e) => {
                  setExaminingOfficer(e.target.value)
                  if (invalidField === "as-officer") setInvalidField("")
                }}
                placeholder="Officer name"
              />
            </div>
          </CardContent>
        </Card>

        {detentionMemoId && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Detention Memo (verify while assessing)
            </h3>
            {memoLoading && !selectedMemo ? (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">
                  Loading detention memo…
                </CardContent>
              </Card>
            ) : memoWithLiveValuation ? (
              <DetentionMemoReadOnlyView memo={memoWithLiveValuation} />
            ) : (
              <Card>
                <CardContent className="py-6 text-sm text-destructive">
                  Could not load detention memo details.
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Goods Valuation (Assessment)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter <strong>PCT Code</strong> and <strong>Assessable Value (PKR)</strong> for each goods line during
              assessment.
            </p>
            {!detentionMemoId ? (
              <p className="text-sm text-muted-foreground">Select a detention memo to load goods.</p>
            ) : goodsValuation.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {memoLoading ? "Loading goods…" : "No goods lines on this detention memo."}
              </p>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Description</TableHead>
                      <TableHead className="w-[90px]">Qty</TableHead>
                      <TableHead className="w-[70px]">Unit</TableHead>
                      <TableHead className="w-[120px]">PCT Code</TableHead>
                      <TableHead className="w-[160px]">Assessable Value (PKR)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {goodsValuation.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.description || "—"}</TableCell>
                        <TableCell>{row.quantity || "—"}</TableCell>
                        <TableCell>{row.unit || "—"}</TableCell>
                        <TableCell>
                          <Input
                            value={row.pctCode}
                            onChange={(e) => updateGoodsValuation(row.id, "pctCode", e.target.value)}
                            placeholder="e.g. 8471"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.assessableValuePkr}
                            onChange={(e) => updateGoodsValuation(row.id, "assessableValuePkr", e.target.value)}
                            placeholder="e.g. 5400000"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Examination Findings</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label>Goods Condition</Label>
              <Input
                value={goodsCondition}
                onChange={(e) => setGoodsCondition(e.target.value)}
                placeholder="Condition of detained goods"
              />
            </div>
            <div className="grid gap-2">
              <Label>Valuation Notes</Label>
              <Textarea
                value={valuationNotes}
                onChange={(e) => setValuationNotes(e.target.value)}
                rows={3}
                placeholder="Valuation / duty notes"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="as-findings">Findings <span className="text-red-600">*</span></Label>
              <Textarea
                id="as-findings"
                value={findings}
                aria-invalid={invalidField === "as-findings"}
                onChange={(e) => {
                  setFindings(e.target.value)
                  if (invalidField === "as-findings") setInvalidField("")
                }}
                rows={4}
                placeholder="Examination findings"
              />
            </div>
            <div className="grid gap-2 max-w-md">
              <Label htmlFor="as-relevance">Document Relevance <span className="text-red-600">*</span></Label>
              <Select
                value={documentRelevance}
                onValueChange={(v) => {
                  setDocumentRelevance(v as DocumentRelevance)
                  if (invalidField === "as-relevance") setInvalidField("")
                }}
              >
                <SelectTrigger id="as-relevance" className="w-full" aria-invalid={invalidField === "as-relevance"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Relevant">Relevant (release path)</SelectItem>
                  <SelectItem value="Not Relevant">Not Relevant (recovery path)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Upload Supporting Documents</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {existingAttachmentCount > 0 && (
              <p className="text-sm text-muted-foreground md:col-span-2">
                {existingAttachmentCount} document(s) already uploaded. New files will be added on save.
              </p>
            )}
            <div className="grid gap-2">
              <Label>Photos</Label>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
              />
              {photos.length > 0 && <p className="text-xs text-muted-foreground">{photos.length} selected</p>}
            </div>
            <div className="grid gap-2">
              <Label>PDFs</Label>
              <Input
                type="file"
                accept="application/pdf"
                multiple
                onChange={(e) => setPdfs(Array.from(e.target.files ?? []))}
              />
              {pdfs.length > 0 && <p className="text-xs text-muted-foreground">{pdfs.length} selected</p>}
            </div>
            <div className="grid gap-2">
              <Label>Invoices</Label>
              <Input
                type="file"
                multiple
                onChange={(e) => setInvoices(Array.from(e.target.files ?? []))}
              />
              {invoices.length > 0 && (
                <p className="text-xs text-muted-foreground">{invoices.length} selected</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Other Documents</Label>
              <Input
                type="file"
                multiple
                onChange={(e) => setOtherDocs(Array.from(e.target.files ?? []))}
              />
              {otherDocs.length > 0 && (
                <p className="text-xs text-muted-foreground">{otherDocs.length} selected</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">5. Approval Workflow</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Send for approval routes to Assistant Collector, Deputy Collector, Location Admin, or Super
              Admin (same as note sheet). Status starts as Draft until submitted.
            </p>
          </CardContent>
        </Card>

        {formError && (
          <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
            {formError}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void handleSave(false)} disabled={saving}>
            {saving ? "Saving…" : "Save Draft"}
          </Button>
          <Button onClick={() => void handleSave(true)} disabled={saving}>
            <Send className="h-4 w-4 mr-2" />
            {saving ? "Sending…" : "Send for Approval"}
          </Button>
          <Button variant="outline" asChild>
            <Link to={ROUTES.SEIZURE_MGMT_ASSESSMENT}>Cancel</Link>
          </Button>
        </div>

        <Card className="rounded-[10px] border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">Audit Log</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-muted-foreground text-sm">Created By</dt>
                <dd className="font-medium text-sm whitespace-pre-wrap">
                  {auditLog.createdBy.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Created On</dt>
                <dd className="font-medium text-sm whitespace-pre-wrap">
                  {auditLog.createdAt.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Updated By</dt>
                <dd className="font-medium text-sm whitespace-pre-wrap">
                  {auditLog.updatedBy.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Updated On</dt>
                <dd className="font-medium text-sm whitespace-pre-wrap">
                  {auditLog.updatedAt.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Approved By</dt>
                <dd className="font-medium text-sm whitespace-pre-wrap">
                  {auditLog.approvedBy.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Approval Time</dt>
                <dd className="font-medium text-sm whitespace-pre-wrap">
                  {auditLog.approvedAt.trim() || "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
