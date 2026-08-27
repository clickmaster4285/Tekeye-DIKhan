import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
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
import { ROUTES, getSeizureMgmtRecoveryMemoDetailPath } from "@/routes/config"
import {
  fetchDetentionMemoById,
  fetchDetentionMemos,
  type DetentionMemoApiRecord,
} from "@/lib/detention-memo-api"
import {
  RECOVERY_CATEGORIES,
  createRecoveryMemo,
  isWithinDetentionWindow,
  recoveryMemoApproval,
} from "@/lib/seizure-management-api"
import { getStoredUser } from "@/lib/auth"
import { toast } from "@/hooks/use-toast"
import { firstMissingField, reportMissingField } from "@/lib/form-missing-field"
import { DetentionMemoReadOnlyView } from "@/pages/seizure-management/DetentionMemoReadOnlyView"

export default function RecoveryMemoCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const memoFromQuery = searchParams.get("detentionMemoId")?.trim() || ""
  const assessmentFromQuery = searchParams.get("assessmentId")?.trim() || ""

  const [memos, setMemos] = useState<DetentionMemoApiRecord[]>([])
  const [selectedMemo, setSelectedMemo] = useState<DetentionMemoApiRecord | null>(null)
  const [memoLoading, setMemoLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")
  const [invalidField, setInvalidField] = useState("")

  const [detentionMemoId, setDetentionMemoId] = useState(memoFromQuery)
  const [assessmentId] = useState(assessmentFromQuery)
  const [caseNo, setCaseNo] = useState("")
  const [category, setCategory] = useState<(typeof RECOVERY_CATEGORIES)[number]>(
    RECOVERY_CATEGORIES[0]
  )
  const [recoveryDate, setRecoveryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [recoveryOfficer, setRecoveryOfficer] = useState(
    () => getStoredUser()?.full_name || getStoredUser()?.username || ""
  )
  const [goodsDescription, setGoodsDescription] = useState("")
  const [quantity, setQuantity] = useState("")
  const [remarks, setRemarks] = useState("")

  useEffect(() => {
    setLoading(true)
    fetchDetentionMemos()
      .then(setMemos)
      .catch(() => setMemos([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!detentionMemoId) {
      setSelectedMemo(null)
      setCaseNo("")
      return
    }
    let cancelled = false
    setMemoLoading(true)
    fetchDetentionMemoById(detentionMemoId)
      .then((m) => {
        if (cancelled) return
        setSelectedMemo(m)
        setCaseNo(m.caseNo || "")
        setMemos((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
        if (!goodsDescription.trim()) {
          const lines = (m.goodsItems ?? [])
            .map((g) => g.description || g.pctCode)
            .filter(Boolean)
          if (lines.length) setGoodsDescription(lines.join("; "))
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refetch on memo change
  }, [detentionMemoId])

  const withinWindow = selectedMemo ? isWithinDetentionWindow(selectedMemo.dateTimeDetention) : true

  const handleSave = async (submitForApproval: boolean) => {
    setFormError("")
    const missing = firstMissingField([
      { id: "rm-memo", label: "Detention Memo", missing: !detentionMemoId },
      { id: "rm-officer", label: "Recovery Officer", missing: !recoveryOfficer.trim() },
      {
        id: "rm-goods",
        label: "Goods Description",
        missing: submitForApproval && !goodsDescription.trim(),
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
      const created = await createRecoveryMemo({
        detentionMemoId,
        assessmentId: assessmentId || undefined,
        caseNo,
        category,
        recoveryDate,
        recoveryOfficer,
        goodsDescription,
        quantity,
        remarks,
        createDeposit: true,
      })
      if (submitForApproval) {
        await recoveryMemoApproval(created.id, "submit")
        toast({ title: "Sent for approval", description: "Recovery memo submitted for approval." })
      } else {
        toast({ title: "Saved", description: "Recovery memo saved as draft." })
      }
      navigate(getSeizureMgmtRecoveryMemoDetailPath(created.id))
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed"
      setFormError(msg)
      toast({ title: "Save failed", description: msg, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModulePageLayout
      title="Create Recovery Memo"
      description="Verify the detention memo, record recovery details, then save draft or send for approval."
      breadcrumbs={[
        { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
        { label: "Recovery Memo", href: ROUTES.SEIZURE_MGMT_RECOVERY_MEMO },
        { label: "Create" },
      ]}
    >
      <div className="mb-4">
        <Button variant="outline" size="sm" asChild>
          <Link to={ROUTES.SEIZURE_MGMT_RECOVERY_MEMO}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to list
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:gap-6">
        {!withinWindow && selectedMemo && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-3 text-sm text-amber-900">
              This detention exceeds the 60-day recovery window. You may still create a recovery memo.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Select Detention Memo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="rm-memo">Detention Memo <span className="text-red-600">*</span></Label>
              <Select
                value={detentionMemoId || undefined}
                onValueChange={(v) => {
                  setDetentionMemoId(v)
                  if (invalidField === "rm-memo") setInvalidField("")
                }}
                disabled={loading || Boolean(memoFromQuery)}
              >
                <SelectTrigger id="rm-memo" className="w-full" aria-invalid={invalidField === "rm-memo"}>
                  <SelectValue placeholder={loading ? "Loading…" : "Select detention memo"} />
                </SelectTrigger>
                <SelectContent>
                  {memos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.caseNo || m.referenceNumber || m.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Recovery Date</Label>
              <Input
                type="date"
                value={recoveryDate}
                onChange={(e) => setRecoveryDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rm-officer">Recovery Officer <span className="text-red-600">*</span></Label>
              <Input
                id="rm-officer"
                value={recoveryOfficer}
                aria-invalid={invalidField === "rm-officer"}
                onChange={(e) => {
                  setRecoveryOfficer(e.target.value)
                  if (invalidField === "rm-officer") setInvalidField("")
                }}
                placeholder="Recovery officer name"
              />
            </div>
          </CardContent>
        </Card>

        {detentionMemoId && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Detention Memo (verify while creating recovery)
            </h3>
            {memoLoading && !selectedMemo ? (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">
                  Loading detention memo…
                </CardContent>
              </Card>
            ) : selectedMemo ? (
              <DetentionMemoReadOnlyView memo={selectedMemo} />
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
            <CardTitle className="text-base">2. Recovery Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Category <span className="text-red-600">*</span></Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as (typeof RECOVERY_CATEGORIES)[number])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECOVERY_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Quantity</Label>
              <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="rm-goods">Goods Description <span className="text-red-600">*</span></Label>
              <Textarea
                id="rm-goods"
                value={goodsDescription}
                aria-invalid={invalidField === "rm-goods"}
                onChange={(e) => {
                  setGoodsDescription(e.target.value)
                  if (invalidField === "rm-goods") setInvalidField("")
                }}
                rows={3}
                placeholder="Description of goods being recovered"
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Remarks</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                placeholder="Additional remarks"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Approval Workflow</CardTitle>
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
            <Link to={ROUTES.SEIZURE_MGMT_RECOVERY_MEMO}>Cancel</Link>
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
                <dd className="font-medium text-sm">—</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Created On</dt>
                <dd className="font-medium text-sm">—</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Updated By</dt>
                <dd className="font-medium text-sm">—</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Updated On</dt>
                <dd className="font-medium text-sm">—</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Approved By</dt>
                <dd className="font-medium text-sm">—</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Approval Time</dt>
                <dd className="font-medium text-sm">—</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
