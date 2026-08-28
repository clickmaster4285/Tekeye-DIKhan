import { useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle,
  ClipboardCheck,
  FileText,
  Package,
  Paperclip,
  QrCode,
  Send,
  Users,
  XCircle,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PrintMenu } from "@/components/seizure/print-menu"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ROUTES,
  getDetentionMemoDetailPath,
  getSeizureMgmtAssessmentDetailPath,
  getSeizureMgmtAssessmentEditPath,
} from "@/routes/config"
import {
  assessmentApproval,
  fetchAssessmentById,
  type DetentionAssessmentRecord,
} from "@/lib/seizure-management-api"
import { fetchDetentionMemoById, type DetentionMemoApiRecord } from "@/lib/detention-memo-api"
import { getStoredUser, type AuthUser } from "@/lib/auth"
import { toast } from "@/hooks/use-toast"
import { reportMissingField } from "@/lib/form-missing-field"
import { GoodsLineText, goodsLineCellClass } from "@/components/goods/goods-line-text-field"
import AssessmentReportPrint from "@/components/seizure/AssessmentReportPrint"

const APPROVER_ROLES = new Set([
  "ADMIN",
  "LOCATION_ADMIN",
  "DEPUTY_COLLECTOR",
  "ASSISTANT_COLLECTOR",
])

function canUserApproveAssessment(row: DetentionAssessmentRecord, user: AuthUser | null): boolean {
  if (row.status !== "Submitted" || !user) return false
  return APPROVER_ROLES.has((user.role || "").trim().toUpperCase())
}

function DetailRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-border/50 py-2 sm:grid-cols-[180px_1fr] sm:gap-2">
      <span className="text-sm text-muted-foreground break-words">{label}</span>
      <span className="text-sm font-medium break-words">{value ?? "—"}</span>
    </div>
  )
}

function getQrCodeUrl(data: string, size = 180) {
  const responsiveSize = typeof window !== "undefined" && window.innerWidth < 640 ? 120 : size
  return `https://api.qrserver.com/v1/create-qr-code/?size=${responsiveSize}x${responsiveSize}&data=${encodeURIComponent(data)}`
}

function getGoodsQrPayload(memoId: string, item: { id: string; qrCodeNumber?: string }): string {
  const ref = item.qrCodeNumber || `${memoId}-${item.id}`
  return `${window.location.origin}${getDetentionMemoDetailPath(memoId)}?goodsQr=${encodeURIComponent(ref)}&view=goods`
}

function recoveryCreateUrl(detentionMemoId: string, assessmentId: string) {
  return `${ROUTES.SEIZURE_MGMT_RECOVERY_MEMO_CREATE}?detentionMemoId=${encodeURIComponent(detentionMemoId)}&assessmentId=${encodeURIComponent(assessmentId)}`
}

function statusBadge(status: string) {
  if (status === "Approved") return <Badge>Approved</Badge>
  if (status === "Submitted") return <Badge variant="secondary">Submitted</Badge>
  if (status === "Rejected") return <Badge variant="destructive">Rejected</Badge>
  return <Badge variant="outline">Draft</Badge>
}

export default function AssessmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const printMode = searchParams.get("print")
  const autoPrint = searchParams.get("autoprint") === "1"
  const autoSavePdf = searchParams.get("savepdf") === "1"
  const [row, setRow] = useState<DetentionAssessmentRecord | null>(null)
  const [memo, setMemo] = useState<DetentionMemoApiRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [approvalRemarks, setApprovalRemarks] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [invalidField, setInvalidField] = useState("")
  const [currentUser] = useState<AuthUser | null>(() => getStoredUser())

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchAssessmentById(id)
      .then(async (assessment) => {
        setRow(assessment)
        try {
          setMemo(await fetchDetentionMemoById(assessment.detentionMemoId))
        } catch {
          setMemo(null)
        }
      })
      .catch(() => {
        setRow(null)
        setMemo(null)
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (printMode === "full" && autoPrint && row && memo) {
      const timer = window.setTimeout(() => window.print(), 350)
      return () => window.clearTimeout(timer)
    }
  }, [printMode, autoPrint, row, memo])

  if (loading) {
    return (
      <ModulePageLayout
        title="Assessment"
        description="Loading…"
        breadcrumbs={[
          { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
          { label: "Assessment", href: ROUTES.SEIZURE_MGMT_ASSESSMENT },
        ]}
      >
        <p className="text-muted-foreground">Loading…</p>
      </ModulePageLayout>
    )
  }

  if (!row || !memo) {
    return (
      <ModulePageLayout
        title="Assessment"
        description="Not found"
        breadcrumbs={[
          { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
          { label: "Assessment", href: ROUTES.SEIZURE_MGMT_ASSESSMENT },
        ]}
      >
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">Assessment or detention memo not found.</p>
            <Button asChild variant="outline">
              <Link to={ROUTES.SEIZURE_MGMT_ASSESSMENT}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Assessment
              </Link>
            </Button>
          </CardContent>
        </Card>
      </ModulePageLayout>
    )
  }

  if (printMode === "full") {
    return <AssessmentReportPrint row={row} memo={memo} autoSavePdf={autoSavePdf} />
  }

  const canAssess = row.status === "Draft" || row.status === "Rejected"
  const canApprove = canUserApproveAssessment(row, currentUser)
  const qrPayload =
    memo.memoQrCodePayload ||
    `${window.location.origin}${getDetentionMemoDetailPath(memo.id)}?print=full`
  const qrNumber = memo.memoQrCodeNumber || `DM-${memo.caseNo}`

  const runApproval = async (action: "submit" | "approve" | "reject") => {
    if (action === "reject" && !rejectionReason.trim()) {
      setInvalidField("as-rejection")
      reportMissingField({ id: "as-rejection", label: "Rejection Reason" })
      return
    }
    setInvalidField("")
    setActing(true)
    try {
      const updated = await assessmentApproval(row.id, action, {
        approvedBy: currentUser?.full_name || currentUser?.username || "",
        approvalRemarks,
        rejectionReason,
      })
      setRow(updated)
      toast({
        title:
          action === "submit"
            ? "Assessment sent for approval"
            : action === "approve"
              ? "Assessment approved"
              : "Assessment rejected",
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
      title={`Detention Memo: ${memo.caseNo}`}
      description={
        memo.referenceNumber
          ? `Memo No. ${memo.referenceNumber} · Assessment ${row.status}`
          : `Pakistan Customs detention memo · Assessment ${row.status}`
      }
      breadcrumbs={[
        { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
        { label: "Assessment", href: ROUTES.SEIZURE_MGMT_ASSESSMENT },
        { label: memo.caseNo },
      ]}
    >
      <div className="grid gap-4 sm:gap-6 print-keep">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between px-4 sm:px-6">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <FileText className="h-5 w-5 flex-shrink-0" />
                <span className="break-words">{memo.caseNo}</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {memo.referenceNumber ? (
                  <>
                    Detention Memo No.{" "}
                    <span className="font-semibold text-foreground">{memo.referenceNumber}</span>
                  </>
                ) : (
                  "Detention memo details for assessment."
                )}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:ml-auto">
              {statusBadge(row.status)}
              <Badge
                variant={memo.verificationStatus === "Verified" ? "default" : "secondary"}
                className="w-fit"
              >
                {memo.verificationStatus || "—"}
              </Badge>
              {canAssess && (
                <Button variant="default" asChild size="sm" className="w-full sm:w-auto">
                  <Link to={getSeizureMgmtAssessmentEditPath(row.id)}>
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    Assess
                  </Link>
                </Button>
              )}
              <PrintMenu
                printHref={`${getSeizureMgmtAssessmentDetailPath(row.id)}?print=full`}
                pdfHref={`${getSeizureMgmtAssessmentDetailPath(row.id)}?print=full&savepdf=1`}
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
            <div className="grid gap-4 sm:gap-6 md:grid-cols-[1fr_220px]">
              <Card className="border-dashed">
                <CardContent className="pt-5">
                  <h4 className="text-sm font-semibold mb-3">Basic Information</h4>
                  <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
                    <DetailRow label="Case No." value={memo.caseNo} />
                    <DetailRow label="Detention Memo No." value={memo.referenceNumber || "—"} />
                    <DetailRow label="Date/Time of occurrence" value={memo.dateTimeOccurrence} />
                    <DetailRow label="Place of occurrence" value={memo.placeOfOccurrence} />
                    <DetailRow label="Date/Time of detention" value={memo.dateTimeDetention} />
                    <DetailRow label="Place of detention" value={memo.placeOfDetention} />
                    <DetailRow label="Detention Type" value={memo.detentionType} />
                    <DetailRow label="Directorate" value={memo.directorate} />
                    <DetailRow label="Reason for detention" value={memo.reasonForDetention} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <QrCode className="h-4 w-4" /> Memo QR
                  </h4>
                  <div className="flex justify-center">
                    <img
                      src={getQrCodeUrl(
                        qrPayload,
                        typeof window !== "undefined" && window.innerWidth < 640 ? 150 : 180
                      )}
                      alt="Memo QR code"
                      className="border rounded-lg p-2 bg-white max-w-full h-auto"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 break-all">{qrNumber}</p>
                  <Button variant="outline" size="sm" className="w-full mt-3" asChild>
                    <Link to={`${ROUTES.DETENTION_MEMO}/${encodeURIComponent(memo.id)}?print=qr`}>
                      Print QR
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Memo Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
                <DetailRow label="Goods detained at" value={memo.whereDeposited} />
                <DetailRow label="Settlement Status" value={memo.settlementStatus} />
                <DetailRow label="Verification Status" value={memo.verificationStatus} />
              </CardContent>
            </Card>

            {(memo.owner?.name || memo.owner?.cnic || memo.owner?.contact || memo.owner?.picture) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Owner
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
                    <DetailRow label="Name" value={memo.owner?.name} />
                    <DetailRow label="CNIC" value={memo.owner?.cnic} />
                    <DetailRow label="Contact" value={memo.owner?.contact} />
                  </div>
                  {memo.owner?.picture && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                        Photo
                      </p>
                      <img
                        src={memo.owner.picture}
                        alt="Owner"
                        className="max-h-48 rounded-lg border object-contain bg-muted/30 w-full sm:w-auto"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {(memo.driver?.name ||
              memo.driver?.cnic ||
              memo.driver?.contact ||
              memo.driver?.picture) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Driver
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
                      <DetailRow label="Name" value={memo.driver?.name} />
                      <DetailRow label="CNIC" value={memo.driver?.cnic} />
                      <DetailRow label="Contact" value={memo.driver?.contact} />
                    </div>
                    {memo.driver?.picture && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                          Photo
                        </p>
                        <img
                          src={memo.driver.picture}
                          alt="Driver"
                          className="max-h-48 rounded-lg border object-contain bg-muted/30 w-full sm:w-auto"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

            {memo.purposeOfDetention && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Purpose of Detention</CardTitle>
                </CardHeader>
                <CardContent className="rounded-lg border p-4">
                  <p className="text-sm whitespace-pre-wrap break-words">{memo.purposeOfDetention}</p>
                </CardContent>
              </Card>
            )}

            {memo.mediaAttachments && memo.mediaAttachments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Attached documents & videos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {memo.mediaAttachments.map((att) =>
                    att.kind === "video" ? (
                      <div key={att.id} className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground break-words">
                          {att.originalFilename || "Video"}
                        </p>
                        <video
                          src={att.url}
                          controls
                          className="w-full max-w-2xl rounded-lg border bg-black"
                        >
                          Your browser does not support video playback.
                        </video>
                      </div>
                    ) : (
                      <div key={att.id} className="flex flex-wrap items-center gap-3">
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary underline-offset-4 hover:underline break-words"
                        >
                          {att.originalFilename || "Download document"}
                        </a>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            )}

            {memo.briefFacts && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Memo Description</CardTitle>
                </CardHeader>
                <CardContent className="rounded-lg border p-4">
                  <p className="text-sm whitespace-pre-wrap break-words">{memo.briefFacts}</p>
                </CardContent>
              </Card>
            )}

            {memo.goodsItems && memo.goodsItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Goods Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="rounded-lg border p-0">
                  <div className="overflow-x-auto">
                    <ScrollArea className="w-full">
                      <Table className="table-fixed w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead>QR Code</TableHead>
                            <TableHead className="w-[22%]">Description</TableHead>
                            <TableHead>PCT</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead>Condition</TableHead>
                            <TableHead>Assessable</TableHead>
                            <TableHead>Perishable</TableHead>
                            <TableHead>ID / Chassis</TableHead>
                            <TableHead className="w-[16%]">Item Notes</TableHead>
                            <TableHead>Images</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {memo.goodsItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-mono text-xs">
                                <div className="space-y-1">
                                  <img
                                    src={getQrCodeUrl(getGoodsQrPayload(memo.id, item), 56)}
                                    alt={`Goods QR ${item.qrCodeNumber || item.id}`}
                                    className="h-14 w-14 border rounded p-1 bg-white"
                                  />
                                  <span className="block text-[10px] text-muted-foreground max-w-[80px] break-all">
                                    {item.qrCodeNumber || "—"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className={`${goodsLineCellClass} font-medium`}>
                                <GoodsLineText>{item.description || "—"}</GoodsLineText>
                              </TableCell>
                              <TableCell className="font-mono">{item.pctCode || "—"}</TableCell>
                              <TableCell>{item.quantity || "—"}</TableCell>
                              <TableCell>{item.unit || "—"}</TableCell>
                              <TableCell>{item.condition || "—"}</TableCell>
                              <TableCell>{item.assessableValuePkr || "—"}</TableCell>
                              <TableCell>{item.perishable ? "Yes" : "No"}</TableCell>
                              <TableCell>{item.identificationRef || "—"}</TableCell>
                              <TableCell className={`${goodsLineCellClass} text-muted-foreground`}>
                                <GoodsLineText>{item.itemNotes || "—"}</GoodsLineText>
                              </TableCell>
                              <TableCell>
                                {item.images && item.images.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {item.images.map((imgUrl, idx) => (
                                      <img
                                        key={idx}
                                        src={imgUrl}
                                        alt={`Goods ${idx + 1}`}
                                        className="h-10 w-10 object-cover rounded border"
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>
            )}

            {(memo.seizingOfficerNotes ||
              memo.examiningOfficerNotes ||
              memo.detentionNotes ||
              memo.forwardingOfficerRemarks) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Additional Information</CardTitle>
                  </CardHeader>
                  <CardContent className="rounded-lg border p-4 space-y-4">
                    {memo.seizingOfficerNotes && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                          Seizing Officer Notes
                        </p>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {memo.seizingOfficerNotes}
                        </p>
                      </div>
                    )}
                    {memo.examiningOfficerNotes && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                          Examining Officer Notes
                        </p>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {memo.examiningOfficerNotes}
                        </p>
                      </div>
                    )}
                    {memo.detentionNotes && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                          Detention / Customs Clarification Notes
                        </p>
                        <p className="text-sm whitespace-pre-wrap break-words">{memo.detentionNotes}</p>
                      </div>
                    )}
                    {memo.forwardingOfficerRemarks && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                          Forwarding Officer Remarks
                        </p>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {memo.forwardingOfficerRemarks}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

            {/* Assessment findings (only fields needed for assessment workflow) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assessment</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
                <DetailRow label="Assessment Date" value={row.assessmentDate} />
                <DetailRow label="Examining Officer" value={row.examiningOfficer} />
                <DetailRow label="Document Relevance" value={row.documentRelevance} />
                <DetailRow label="Goods Condition" value={row.goodsCondition} />
                <div className="md:col-span-2">
                  <DetailRow label="Valuation Notes" value={row.valuationNotes} />
                </div>
                <div className="md:col-span-2">
                  <DetailRow label="Findings" value={row.findings} />
                </div>
              </CardContent>
            </Card>

            {(row.attachments?.length ?? 0) > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Assessment documents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {row.attachments.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center gap-3">
                      {a.url ? (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {a.originalFilename || a.fileType}
                        </a>
                      ) : (
                        <span className="text-sm">{a.originalFilename || a.fileType}</span>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {canAssess && (
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to={getSeizureMgmtAssessmentEditPath(row.id)}>
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    Assess
                  </Link>
                </Button>
                <Button onClick={() => void runApproval("submit")} disabled={acting}>
                  <Send className="h-4 w-4 mr-2" />
                  Send for Approval
                </Button>
              </div>
            )}

            {row.status === "Submitted" && canApprove && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Decision</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Approval remarks</Label>
                    <Textarea
                      value={approvalRemarks}
                      onChange={(e) => setApprovalRemarks(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="as-rejection">Rejection reason <span className="text-red-600">*</span></Label>
                    <Textarea
                      id="as-rejection"
                      value={rejectionReason}
                      aria-invalid={invalidField === "as-rejection"}
                      onChange={(e) => {
                        setRejectionReason(e.target.value)
                        if (invalidField === "as-rejection") setInvalidField("")
                      }}
                      rows={2}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void runApproval("approve")} disabled={acting}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => void runApproval("reject")}
                      disabled={acting}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
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
                      {row.createdBy?.trim() || "—"}
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

            {row.status === "Approved" && row.documentRelevance === "Relevant" && (
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to={ROUTES.RELEASE_INVENTORY}>Go to Release Inventory</Link>
                </Button>
              </div>
            )}

            {row.status === "Approved" && row.documentRelevance === "Not Relevant" && (
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to={recoveryCreateUrl(row.detentionMemoId, row.id)}>
                    Create Recovery Memo
                  </Link>
                </Button>
              </div>
            )}

            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to={ROUTES.SEIZURE_MGMT_ASSESSMENT}>
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
