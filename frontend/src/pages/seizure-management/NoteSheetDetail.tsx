import { useEffect, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft, CheckCircle, ChevronDown, FileOutput, Pencil, Printer, Send, Trash2, XCircle } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  getSeizureMgmtNoteSheetDetailPath,
  getSeizureMgmtNoteSheetEditPath,
} from "@/routes/config"
import {
  canUserDeleteNoteSheet,
  deleteNoteSheet,
  fetchNoteSheetById,
  noteSheetApproval,
  type NoteSheetRecord,
  type NoteSheetStatus,
} from "@/lib/seizure-management-api"
import { getStoredUser, setAuthenticatedWithToken, type AuthUser } from "@/lib/auth"
import { getStoredToken } from "@/lib/api"
import { fetchCurrentUser } from "@/lib/users-api"
import { toast } from "@/hooks/use-toast"
import { reportMissingField } from "@/lib/form-missing-field"
import { GoodsLineText, goodsLineCellClass } from "@/components/goods/goods-line-text-field"
import NoteSheetReportPrint from "@/components/seizure/NoteSheetReportPrint"

function statusBadge(status: NoteSheetStatus) {
  if (status === "Approved") return <Badge>Approved</Badge>
  if (status === "Submitted") return <Badge variant="secondary">Submitted</Badge>
  if (status === "Rejected") return <Badge variant="destructive">Rejected</Badge>
  return <Badge variant="outline">Draft</Badge>
}

function Field({ label, value, className }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="font-medium text-sm whitespace-pre-wrap">{value?.trim() ? value : "—"}</dd>
    </div>
  )
}

function canUserApproveNoteSheet(
  row: NoteSheetRecord,
  user: Pick<AuthUser, "id" | "username" | "full_name" | "role" | "location"> | null
): boolean {
  if (row.status !== "Submitted" || !user) return false
  const role = (user.role || "").trim().toUpperCase()
  const approverRoles = new Set([
    "ADMIN",
    "LOCATION_ADMIN",
    "DEPUTY_COLLECTOR",
    "ASSISTANT_COLLECTOR",
  ])
  if (!approverRoles.has(role)) return false
  if (role === "ADMIN") return true
  // Location-scoped officials: same location as sheet office when known
  const userLoc = (user.location || "").trim().toUpperCase()
  const office = (row.office || "").trim().toUpperCase()
  if (!userLoc || !office) return true
  return office.includes(userLoc) || userLoc.includes(office.split("(")[0].trim())
}

export default function NoteSheetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const printMode = searchParams.get("print")
  const autoPrint = searchParams.get("autoprint") === "1"
  const autoSavePdf = searchParams.get("savepdf") === "1"
  const [row, setRow] = useState<NoteSheetRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredUser())
  const [approver, setApprover] = useState("")
  const [approvalRemarks, setApprovalRemarks] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [invalidField, setInvalidField] = useState("")

  const load = () => {
    if (!id) return
    setLoading(true)
    fetchNoteSheetById(id)
      .then((data) => {
        setRow(data)
        void noteSheetApproval(data.id, "view").catch(() => undefined)
      })
      .catch(() => setRow(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per id
  }, [id])

  useEffect(() => {
    let cancelled = false
    const stored = getStoredUser()
    if (stored) {
      setCurrentUser(stored)
      setApprover((stored.full_name || "").trim() || stored.username || "")
    }
    fetchCurrentUser()
      .then((profile) => {
        if (cancelled || !profile) return
        const base = getStoredUser()
        const merged: AuthUser = {
          id: profile.id,
          username: profile.username,
          email: profile.email || base?.email || "",
          role: profile.role || base?.role || "",
          phone: profile.phone || base?.phone || "",
          location: profile.location || base?.location,
          full_name: profile.full_name || "",
          designation: profile.designation || base?.designation,
          employee_id: profile.employee_id || base?.employee_id,
          cell_no: profile.cell_no || base?.cell_no,
          office_phone_1: profile.office_phone_1 || base?.office_phone_1,
          office_phone_2: profile.office_phone_2 || base?.office_phone_2,
          collectorate: profile.collectorate || base?.collectorate,
          is_active: profile.is_active,
        }
        setCurrentUser(merged)
        setApprover((merged.full_name || "").trim() || merged.username || "")
        const token = getStoredToken()
        if (token) setAuthenticatedWithToken(token, merged)
      })
      .catch(() => undefined)
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
      <ModulePageLayout title="Note Sheet" description="Loading..." breadcrumbs={[]}>
        <p className="text-muted-foreground">Loading...</p>
      </ModulePageLayout>
    )
  }

  if (!row) {
    return (
      <ModulePageLayout
        title="Note Sheet"
        description="Not found"
        breadcrumbs={[
          { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
          { label: "Note Sheet", href: ROUTES.SEIZURE_MGMT_NOTE_SHEET },
        ]}
      >
        <p className="text-muted-foreground">Note sheet not found.</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate(ROUTES.SEIZURE_MGMT_NOTE_SHEET)}>
          Back
        </Button>
      </ModulePageLayout>
    )
  }

  if (printMode === "full") {
    return <NoteSheetReportPrint row={row} autoSavePdf={autoSavePdf} />
  }

  const runApproval = async (action: "submit" | "approve" | "reject") => {
    if (action === "approve" && !approver.trim()) {
      setInvalidField("ns-approver")
      reportMissingField({ id: "ns-approver", label: "Approving Officer" })
      return
    }
    if (action === "reject" && !rejectionReason.trim()) {
      setInvalidField("ns-rejection")
      reportMissingField({ id: "ns-rejection", label: "Rejection Reason" })
      return
    }
    setInvalidField("")
    setActing(true)
    try {
      const updated = await noteSheetApproval(row.id, action, {
        approvedBy: approver,
        approvalRemarks,
        rejectionReason,
      })
      setRow(updated)
      toast({
        title:
          action === "submit"
            ? "Note sheet sent for approval"
            : action === "approve"
              ? "Note sheet approved"
              : "Note sheet rejected",
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

  const title = row.noteSheetNo || row.referenceNumber || row.subject || "Note Sheet"
  const canEdit = row.status === "Draft" || row.status === "Rejected"
  const canApprove = canUserApproveNoteSheet(row, currentUser)
  const canDelete = canUserDeleteNoteSheet(row, currentUser?.role)

  const handleDelete = async () => {
    const label = row.noteSheetNo || row.referenceNumber || "this note sheet"
    const approvedHint =
      row.status === "Approved"
        ? " This sheet is already approved. Only a higher official can delete it."
        : ""
    if (!window.confirm(`Delete ${label}? This cannot be undone.${approvedHint}`)) return
    setActing(true)
    try {
      await deleteNoteSheet(row.id)
      toast({ title: `${label} deleted` })
      navigate(ROUTES.SEIZURE_MGMT_NOTE_SHEET)
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Could not delete note sheet",
        variant: "destructive",
      })
    } finally {
      setActing(false)
    }
  }
  const approvalStatusLabel =
    row.status === "Approved"
      ? "Approved"
      : row.status === "Rejected"
        ? "Rejected"
        : row.status === "Submitted"
          ? "Pending"
          : "Draft"

  return (
    <ModulePageLayout
      title={title}
      description={`${row.subject || "Note sheet"} · ${row.status}`}
      breadcrumbs={[
        { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
        { label: "Note Sheet", href: ROUTES.SEIZURE_MGMT_NOTE_SHEET },
        { label: row.noteSheetNo || row.referenceNumber || "Detail" },
      ]}
    >
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.SEIZURE_MGMT_NOTE_SHEET}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        {statusBadge(row.status)}
        {row.priority === "Urgent" && <Badge variant="destructive">Urgent</Badge>}
        {canEdit && (
          <Button variant="outline" size="sm" asChild>
            <Link to={getSeizureMgmtNoteSheetEditPath(row.id)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Print
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem asChild>
              <Link to={`${getSeizureMgmtNoteSheetDetailPath(row.id)}?print=full`}>
                <Printer className="h-4 w-4" />
                Print
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`${getSeizureMgmtNoteSheetDetailPath(row.id)}?print=full&savepdf=1`}>
                <FileOutput className="h-4 w-4" />
                Save as PDF
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {canDelete && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={acting}
            onClick={() => void handleDelete()}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        )}
      </div>

      {row.status === "Submitted" && canApprove && (
        <div className="mb-4 rounded-[10px] border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          Prepared by <span className="font-medium">{row.preparedBy || row.createdBy || "—"}</span>
          {" · "}
          Pending approval by Assistant Collector, Deputy Collector, Location Admin, or Super Admin.
          You can approve or reject as{" "}
          <span className="font-medium">{currentUser?.full_name || currentUser?.username || "you"}</span>.
        </div>
      )}

      {row.status === "Submitted" && !canApprove && (
        <div className="mb-4 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Prepared by <span className="font-medium">{row.preparedBy || row.createdBy || "—"}</span>
          {" · "}
          Waiting for approval from Assistant Collector, Deputy Collector, Location Admin, or Super
          Admin.
        </div>
      )}

      <div className="space-y-4 max-w-[1600px]">
        {/* 13. Timeline */}
        {row.timeline?.length > 0 && (
          <Card className="rounded-[10px] border-gray-200">
            <CardHeader>
              <CardTitle className="text-base">13. Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative border-l border-muted-foreground/30 ml-2 space-y-4">
                {row.timeline.map((step) => (
                  <li key={step.key} className="ml-4">
                    <span
                      className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border ${step.done ? "bg-primary border-primary" : "bg-background border-muted-foreground/40"
                        }`}
                    />
                    <p className={`text-sm font-medium ${step.done ? "" : "text-muted-foreground"}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{step.at || "—"}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        {/* 1. Basic Information */}
        <Card className="rounded-[10px] border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">1. Basic Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Note Sheet Number" value={row.noteSheetNo || row.referenceNumber} />
              <Field label="Date & Time" value={row.dateTime} />
              <Field label="Office / Region" value={row.office} />
              <Field label="Investigation / Case Number" value={row.caseNo} />
              <Field label="Priority" value={row.priority} />
              <Field label="Status" value={row.status} />
              <Field label="Subject" value={row.subject} className="sm:col-span-2" />
            </dl>
          </CardContent>
        </Card>

        {/* 2. Officer Information */}
        <Card className="rounded-[10px] border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">2. Preparing Officer Information</CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Officer who created this note sheet (not the current login).
            </p>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Preparing Officer" value={row.preparedBy} />
              <Field label="Badge / Employee ID" value={row.badgeId} />
              <Field label="Designation" value={row.designation} />
              <Field label="Department" value={row.department} />
              <Field label="Contact Number" value={row.officerContact} className="sm:col-span-2" />
            </dl>
          </CardContent>
        </Card>

        {/* 3. Suspect / Accused */}
        <Card className="rounded-[10px] border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">3. Suspect / Accused Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Name" value={row.accusedName} />
              <Field label="Father Name" value={row.accusedFatherName} />
              <Field label="CNIC / Passport" value={row.accusedCnic} />
              <Field label="Mobile Number" value={row.accusedMobile} />
              <Field label="Address" value={row.accusedAddress} className="sm:col-span-2" />
              <Field label="Business Name" value={row.businessName} />
              <Field label="NTN / STRN" value={row.ntnStrn} />
            </dl>
          </CardContent>
        </Card>

        {/* 4. Goods */}
        <Card className="rounded-[10px] border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">4. Goods Information</CardTitle>
          </CardHeader>
          <CardContent>
            {row.items?.length ? (
              <div className="overflow-auto">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>QR Code</TableHead>
                      <TableHead className="w-[22%]">Description</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Perishable</TableHead>
                      <TableHead>ID / Chassis No.</TableHead>
                      <TableHead className="w-[16%]">Item Notes</TableHead>
                      <TableHead>Images</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {row.items.map((item, i) => (
                      <TableRow key={item.id ?? i}>
                        <TableCell className="font-mono text-xs">{item.qrCodeNumber || "—"}</TableCell>
                        <TableCell className={goodsLineCellClass}>
                          <GoodsLineText>{item.product || item.description || "—"}</GoodsLineText>
                        </TableCell>
                        <TableCell>{item.quantity || "—"}</TableCell>
                        <TableCell>{item.unit || "—"}</TableCell>
                        <TableCell>{item.condition || "—"}</TableCell>
                        <TableCell>{item.perishable ? "Yes" : "No"}</TableCell>
                        <TableCell>{item.identificationRef || "—"}</TableCell>
                        <TableCell className={goodsLineCellClass}>
                          <GoodsLineText>{item.remarks || item.itemNotes || "—"}</GoodsLineText>
                        </TableCell>
                        <TableCell>
                          {item.images?.length ? (
                            <div className="flex flex-wrap gap-1">
                              {item.images.map((url, idx) => (
                                <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                  <img src={url} alt="" className="h-8 w-8 object-cover rounded border" />
                                </a>
                              ))}
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No goods recorded.</p>
            )}
          </CardContent>
        </Card>

        {/* 5. Location */}
        <Card className="rounded-[10px] border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">5. Location Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Place of Inspection" value={row.placeOfInspection} />
              <Field label="Warehouse / Shop" value={row.warehouseShop} />
              <Field label="GPS Location" value={row.gpsLocation} />
              <Field label="Inspection Date & Time" value={row.inspectionDate} />
            </dl>
          </CardContent>
        </Card>

        {/* 6–10 */}
        <Card className="rounded-[10px] border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">6. Grounds of Suspicion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{row.groundsOfSuspicion || "—"}</p>
          </CardContent>
        </Card>

        <Card className="rounded-[10px] border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">7. Evidence Collected</CardTitle>
          </CardHeader>
          <CardContent>
            {row.evidenceCollected?.length ? (
              <ul className="list-disc list-inside text-sm space-y-1">
                {row.evidenceCollected.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">None recorded.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[10px] border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">8. Documents Attached</CardTitle>
          </CardHeader>
          <CardContent>
            {row.attachments?.length ? (
              <ul className="space-y-2 text-sm">
                {row.attachments.map((att) => (
                  <li key={att.id}>
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {att.originalFilename || att.fileType}
                    </a>
                    <span className="text-muted-foreground ml-2 text-xs">({att.fileType})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No attachments.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[10px] border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">9. Preliminary Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{row.preliminaryFindings || row.content || "—"}</p>
          </CardContent>
        </Card>

        <Card className="rounded-[10px] border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">10. Recommendation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{row.recommendation || "—"}</p>
          </CardContent>
        </Card>

        {/* 11. Approval Workflow */}
        <Card className="rounded-[10px] border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">11. Approval Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-3">Prepared By</p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Officer Name" value={row.preparedBy} />
                <Field label="Signature" value={row.preparedSignature} />
                <Field label="Date" value={row.preparedDate} />
              </dl>
            </div>
            <div>
              <p className="text-sm font-medium mb-3">Forward To</p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Approving Officials"
                  value={
                    row.forwardTo?.trim() ||
                    "Assistant Collector, Deputy Collector, Location Admin, Super Admin"
                  }
                />
                <Field label="Status" value={approvalStatusLabel} />
                <Field label="Approval Date" value={row.approvedAt} />
                <Field label="Approving Officer (decision)" value={row.approvedBy} />
              </dl>
            </div>
            {row.detentionMemoId && (
              <div>
                <dt className="text-muted-foreground text-sm">Detention Memo</dt>
                <dd>
                  <Link
                    to={getDetentionMemoDetailPath(row.detentionMemoId)}
                    className="text-primary hover:underline text-sm"
                  >
                    Open linked detention memo
                  </Link>
                </dd>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 12. Approval Remarks */}
        <Card className="rounded-[10px] border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">12. Approval Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            {row.status === "Rejected" && row.rejectionReason ? (
              <p className="text-sm text-destructive whitespace-pre-wrap">{row.rejectionReason}</p>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{row.approvalRemarks || "—"}</p>
            )}
          </CardContent>
        </Card>

        {/* 14. Audit Log */}
        <Card className="rounded-[10px] border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">14. Audit Log</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Created By" value={row.createdBy} />
              <Field label="Created On" value={row.createdAt} />
              <Field label="Updated By" value={row.updatedBy} />
              <Field label="Updated On" value={row.updatedAt} />
              <Field label="Approved By" value={row.approvedBy} />
              <Field label="Approval Time" value={row.approvedAt} />
            </dl>
          </CardContent>
        </Card>

        {(row.status === "Draft" || row.status === "Rejected") && (
          <Card className="rounded-[10px]">
            <CardContent className="p-6 flex flex-wrap gap-2">
              {canEdit && (
                <Button variant="outline" asChild>
                  <Link to={getSeizureMgmtNoteSheetEditPath(row.id)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Link>
                </Button>
              )}
              <Button disabled={acting} onClick={() => void runApproval("submit")}>
                <Send className="h-4 w-4 mr-2" />
                Send for Approval
              </Button>
            </CardContent>
          </Card>
        )}

        {row.status === "Submitted" && canApprove && (
          <Card className="rounded-[10px]">
            <CardHeader>
              <CardTitle className="text-base">Senior Officer Decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-w-sm">
                <Label htmlFor="ns-approver">Approving Officer (you) <span className="text-red-600">*</span></Label>
                <Input
                  id="ns-approver"
                  value={approver}
                  onChange={(e) => {
                    setApprover(e.target.value)
                    if (invalidField === "ns-approver") setInvalidField("")
                  }}
                  aria-invalid={invalidField === "ns-approver"}
                  className="bg-muted"
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  Filled from your login — not the preparing officer above.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Approval Remarks</Label>
                <Textarea
                  rows={3}
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  placeholder="e.g. Approved for issuance of Detention Memo under Section XX after preliminary examination."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ns-rejection">Rejection Reason (if rejecting) <span className="text-red-600">*</span></Label>
                <Textarea
                  id="ns-rejection"
                  rows={3}
                  value={rejectionReason}
                  aria-invalid={invalidField === "ns-rejection"}
                  onChange={(e) => {
                    setRejectionReason(e.target.value)
                    if (invalidField === "ns-rejection") setInvalidField("")
                  }}
                  placeholder="e.g. Rejected because sufficient evidence has not been provided."
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

        {row.status === "Submitted" && !canApprove && (
          <Card className="rounded-[10px]">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Waiting for approval from{" "}
                <span className="font-medium text-foreground">
                  Assistant Collector, Deputy Collector, Location Admin, or Super Admin
                </span>
                . Only those officials can approve or reject this note sheet.
              </p>
            </CardContent>
          </Card>
        )}

        {row.status === "Approved" && !row.detentionMemoId && (
          <Card className="rounded-[10px] border-green-200 bg-green-50/50">
            <CardContent className="p-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <p className="text-sm text-green-900">
                Note sheet approved. You can now create the detention memo — owner, goods, location, and grounds will be prefilled.
              </p>
              <Button asChild>
                <Link to={`${ROUTES.DETENTION_MEMO_CREATE}?noteSheetId=${encodeURIComponent(row.id)}`}>
                  Create Detention Memo
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </ModulePageLayout>
  )
}
