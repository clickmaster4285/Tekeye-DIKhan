import { useEffect, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  Send,
  XCircle,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PrintMenu } from "@/components/seizure/print-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ROUTES,
  getSeizureMgmtAssessmentDetailPath,
  getSeizureMgmtRecoveryMemoDetailPath,
} from "@/routes/config"
import {
  fetchRecoveryMemoById,
  recoveryMemoApproval,
  type RecoveryMemoRecord,
} from "@/lib/seizure-management-api"
import { fetchDetentionMemoById, type DetentionMemoApiRecord } from "@/lib/detention-memo-api"
import { getStoredUser, type AuthUser } from "@/lib/auth"
import { toast } from "@/hooks/use-toast"
import { reportMissingField } from "@/lib/form-missing-field"
import { DetentionMemoReadOnlyView } from "@/pages/seizure-management/DetentionMemoReadOnlyView"
import RecoveryMemoReportPrint from "@/components/seizure/RecoveryMemoReportPrint"

const APPROVER_ROLES = new Set([
  "ADMIN",
  "LOCATION_ADMIN",
  "DEPUTY_COLLECTOR",
  "ASSISTANT_COLLECTOR",
])

function canUserApproveRecovery(
  row: RecoveryMemoRecord,
  user: AuthUser | null
): boolean {
  if (row.approvalStatus !== "Pending Approval" || !user) return false
  return APPROVER_ROLES.has((user.role || "").trim().toUpperCase())
}

function DetailRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-border/50 py-2 sm:grid-cols-[180px_1fr] sm:gap-2">
      <span className="text-sm text-muted-foreground break-words">{label}</span>
      <span className="text-sm font-medium break-words">{value?.trim() ? value : "—"}</span>
    </div>
  )
}

function statusBadge(status: RecoveryMemoRecord["approvalStatus"]) {
  if (status === "Approved") return <Badge>Approved</Badge>
  if (status === "Pending Approval") return <Badge variant="secondary">Pending Approval</Badge>
  if (status === "Rejected") return <Badge variant="destructive">Rejected</Badge>
  return <Badge variant="outline">Draft</Badge>
}

export default function RecoveryMemoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const printMode = searchParams.get("print")
  const autoPrint = searchParams.get("autoprint") === "1"
  const autoSavePdf = searchParams.get("savepdf") === "1"
  const [row, setRow] = useState<RecoveryMemoRecord | null>(null)
  const [memo, setMemo] = useState<DetentionMemoApiRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [currentUser] = useState<AuthUser | null>(() => getStoredUser())
  const [approver, setApprover] = useState(
    () => getStoredUser()?.full_name || getStoredUser()?.username || ""
  )
  const [approvalRemarks, setApprovalRemarks] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [invalidField, setInvalidField] = useState("")

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchRecoveryMemoById(id)
      .then(async (recovery) => {
        setRow(recovery)
        try {
          setMemo(await fetchDetentionMemoById(recovery.detentionMemoId))
        } catch {
          setMemo(null)
        }
        if (recovery.approvalStatus === "Pending Approval") {
          void recoveryMemoApproval(recovery.id, "view").catch(() => undefined)
        }
      })
      .catch(() => {
        setRow(null)
        setMemo(null)
      })
      .finally(() => setLoading(false))
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
        title="Recovery Memo"
        description="Loading…"
        breadcrumbs={[
          { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
          { label: "Recovery Memo", href: ROUTES.SEIZURE_MGMT_RECOVERY_MEMO },
        ]}
      >
        <p className="text-muted-foreground">Loading recovery memo…</p>
      </ModulePageLayout>
    )
  }

  if (!row) {
    return (
      <ModulePageLayout
        title="Recovery Memo"
        description="Not found"
        breadcrumbs={[
          { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
          { label: "Recovery Memo", href: ROUTES.SEIZURE_MGMT_RECOVERY_MEMO },
        ]}
      >
        <p className="text-muted-foreground mb-4">Recovery memo not found.</p>
        <Button variant="outline" onClick={() => navigate(ROUTES.SEIZURE_MGMT_RECOVERY_MEMO)}>
          Back to list
        </Button>
      </ModulePageLayout>
    )
  }

  if (printMode === "full") {
    return <RecoveryMemoReportPrint row={row} memo={memo} autoSavePdf={autoSavePdf} />
  }

  const canSubmit = row.approvalStatus === "Draft" || row.approvalStatus === "Rejected"
  const canApprove = canUserApproveRecovery(row, currentUser)
  const isPending = row.approvalStatus === "Pending Approval"

  const runApproval = async (action: "submit" | "approve" | "reject") => {
    if (action === "approve" && !approver.trim()) {
      setInvalidField("rm-approver")
      reportMissingField({ id: "rm-approver", label: "Approving Officer" })
      return
    }
    if (action === "reject" && !rejectionReason.trim()) {
      setInvalidField("rm-rejection")
      reportMissingField({ id: "rm-rejection", label: "Rejection Reason" })
      return
    }
    setInvalidField("")
    setActing(true)
    try {
      const updated = await recoveryMemoApproval(row.id, action, {
        approvedBy: approver,
        approvalRemarks,
        rejectionReason,
      })
      setRow(updated)
      toast({
        title:
          action === "submit"
            ? "Recovery memo sent for approval"
            : action === "approve"
              ? "Recovery memo approved"
              : "Recovery memo rejected",
      })
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Action failed",
        variant: "destructive",
      })
    } finally {
      setActing(false)
    }
  }

  return (
    <ModulePageLayout
      title={memo ? `Detention Memo: ${memo.caseNo}` : `Recovery Memo — ${row.caseNo}`}
      description={
        memo?.referenceNumber
          ? `Memo No. ${memo.referenceNumber} · Recovery ${row.approvalStatus}`
          : `Recovery memo · ${row.approvalStatus}`
      }
      breadcrumbs={[
        { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
        { label: "Recovery Memo", href: ROUTES.SEIZURE_MGMT_RECOVERY_MEMO },
        { label: row.caseNo || "Detail" },
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

      {isPending && canApprove && (
        <div className="mb-4 rounded-[10px] border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          Prepared by{" "}
          <span className="font-medium">{row.recoveryOfficer || row.createdBy || "—"}</span>
          {" · "}
          Pending approval by Assistant Collector, Deputy Collector, Location Admin, or Super Admin.
          You can approve or reject as{" "}
          <span className="font-medium">
            {currentUser?.full_name || currentUser?.username || "you"}
          </span>
          .
        </div>
      )}

      {isPending && !canApprove && (
        <div className="mb-4 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Prepared by{" "}
          <span className="font-medium">{row.recoveryOfficer || row.createdBy || "—"}</span>
          {" · "}
          Waiting for approval from Assistant Collector, Deputy Collector, Location Admin, or Super
          Admin.
        </div>
      )}

      <div className="grid gap-4 sm:gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between px-4 sm:px-6">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <FileText className="h-5 w-5 flex-shrink-0" />
                <span className="break-words">{memo?.caseNo || row.caseNo}</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {memo?.referenceNumber ? (
                  <>
                    Detention Memo No.{" "}
                    <span className="font-semibold text-foreground">{memo.referenceNumber}</span>
                  </>
                ) : (
                  "Detention memo details for recovery."
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              {statusBadge(row.approvalStatus)}
              {memo?.verificationStatus && (
                <Badge
                  variant={memo.verificationStatus === "Verified" ? "default" : "secondary"}
                >
                  {memo.verificationStatus}
                </Badge>
              )}
              <PrintMenu
                printHref={`${getSeizureMgmtRecoveryMemoDetailPath(row.id)}?print=full`}
                pdfHref={`${getSeizureMgmtRecoveryMemoDetailPath(row.id)}?print=full&savepdf=1`}
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
            {memo ? (
              <DetentionMemoReadOnlyView memo={memo} />
            ) : (
              <p className="text-sm text-muted-foreground">Detention memo could not be loaded.</p>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recovery Memo</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
                <DetailRow label="Case No." value={row.caseNo} />
                <DetailRow label="Reference No." value={row.referenceNumber} />
                <DetailRow label="Category" value={row.category} />
                <DetailRow label="Recovery Date" value={row.recoveryDate} />
                <DetailRow label="Recovery Officer" value={row.recoveryOfficer} />
                <DetailRow label="Quantity" value={row.quantity} />
                <div className="md:col-span-2">
                  <DetailRow label="Goods Description" value={row.goodsDescription} />
                </div>
                <div className="md:col-span-2">
                  <DetailRow label="Remarks" value={row.remarks} />
                </div>
                {row.depositAccountId && (
                  <DetailRow label="Deposit Account" value={row.depositAccountId} />
                )}
                {row.assessmentId && (
                  <div className="md:col-span-2 py-2">
                    <span className="text-sm text-muted-foreground">Linked Assessment</span>
                    <div className="mt-1">
                      <Button variant="link" className="h-auto p-0" asChild>
                        <Link to={getSeizureMgmtAssessmentDetailPath(row.assessmentId)}>
                          View assessment
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}
                {(row.approvalRemarks || row.rejectionReason) && (
                  <div className="md:col-span-2">
                    <DetailRow
                      label={row.approvalStatus === "Rejected" ? "Rejection Reason" : "Approval Remarks"}
                      value={
                        row.approvalStatus === "Rejected"
                          ? row.rejectionReason
                          : row.approvalRemarks || row.rejectionReason
                      }
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {canSubmit && (
              <Card className="rounded-[10px]">
                <CardContent className="p-6 flex flex-wrap gap-2">
                  <Button disabled={acting} onClick={() => void runApproval("submit")}>
                    <Send className="h-4 w-4 mr-2" />
                    Send for Approval
                  </Button>
                </CardContent>
              </Card>
            )}

            {isPending && canApprove && (
              <Card className="rounded-[10px]">
                <CardHeader>
                  <CardTitle className="text-base">Senior Officer Decision</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 max-w-sm">
                    <Label htmlFor="rm-approver">Approving Officer (you) <span className="text-red-600">*</span></Label>
                    <Input
                      id="rm-approver"
                      value={approver}
                      onChange={(e) => {
                        setApprover(e.target.value)
                        if (invalidField === "rm-approver") setInvalidField("")
                      }}
                      aria-invalid={invalidField === "rm-approver"}
                      className="bg-muted"
                      readOnly
                    />
                    <p className="text-xs text-muted-foreground">
                      Filled from your login — not the recovery officer above.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Approval Remarks</Label>
                    <Textarea
                      rows={3}
                      value={approvalRemarks}
                      onChange={(e) => setApprovalRemarks(e.target.value)}
                      placeholder="e.g. Approved for deposit register and seizure report."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rm-rejection">Rejection Reason (if rejecting) <span className="text-red-600">*</span></Label>
                    <Textarea
                      id="rm-rejection"
                      rows={3}
                      value={rejectionReason}
                      aria-invalid={invalidField === "rm-rejection"}
                      onChange={(e) => {
                        setRejectionReason(e.target.value)
                        if (invalidField === "rm-rejection") setInvalidField("")
                      }}
                      placeholder="e.g. Rejected because recovery details are incomplete."
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={acting} onClick={() => void runApproval("approve")}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={acting}
                      onClick={() => void runApproval("reject")}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {isPending && !canApprove && (
              <Card className="rounded-[10px]">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">
                    Waiting for approval from{" "}
                    <span className="font-medium text-foreground">
                      Assistant Collector, Deputy Collector, Location Admin, or Super Admin
                    </span>
                    . Only those officials can approve or reject this recovery memo.
                  </p>
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
                    <dt className="text-muted-foreground text-sm">Created By</dt>
                    <dd className="font-medium text-sm whitespace-pre-wrap">
                      {row.createdBy?.trim() || row.recoveryOfficer?.trim() || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">Created On</dt>
                    <dd className="font-medium text-sm whitespace-pre-wrap">
                      {row.createdAt?.trim() || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">Updated By</dt>
                    <dd className="font-medium text-sm whitespace-pre-wrap">
                      {row.updatedBy?.trim() || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">Updated On</dt>
                    <dd className="font-medium text-sm whitespace-pre-wrap">
                      {row.updatedAt?.trim() || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">Approved By</dt>
                    <dd className="font-medium text-sm whitespace-pre-wrap">
                      {row.approvedBy?.trim() || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">Approval Time</dt>
                    <dd className="font-medium text-sm whitespace-pre-wrap">
                      {row.approvedAt?.trim() || "—"}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {row.approvalStatus === "Approved" && (
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link
                    to={`${ROUTES.SEIZURE_MGMT_SEIZURE_REPORT_CREATE}?detentionMemoId=${encodeURIComponent(row.detentionMemoId)}&recoveryMemoId=${encodeURIComponent(row.id)}`}
                  >
                    Create Seizure Report
                  </Link>
                </Button>
              </div>
            )}

            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to={ROUTES.SEIZURE_MGMT_RECOVERY_MEMO}>
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
