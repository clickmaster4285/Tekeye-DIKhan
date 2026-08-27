import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Camera, ChevronDown, Copy, Eye, Plus, Send, Trash2, X } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ROUTES, getSeizureMgmtNoteSheetDetailPath } from "@/routes/config"
import { getStoredUser } from "@/lib/auth"
import { locationLabel } from "@/lib/locations"
import { fetchCurrentUser, pickUserContact } from "@/lib/users-api"
import {
  EVIDENCE_OPTIONS,
  RECOMMENDATION_OPTIONS,
  createNoteSheet,
  fetchNoteSheetById,
  noteSheetApproval,
  updateNoteSheet,
  type NoteSheetCreateMedia,
  type NoteSheetItem,
  type NoteSheetWritePayload,
} from "@/lib/seizure-management-api"
import { toast } from "@/hooks/use-toast"
import { firstMissingField, reportMissingField } from "@/lib/form-missing-field"
import {
  GoodsLineTextField,
  goodsLineCellClass,
  goodsPlaceholderClass,
  goodsSelectTriggerClass,
  goodsTableClass,
} from "@/components/goods/goods-line-text-field"

const NOTE_SHEET_APPROVER_LABEL =
  "Assistant Collector, Deputy Collector, Location Admin, Super Admin"

function nowLocalDatetime(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toDatetimeLocal(value: string | undefined | null): string {
  if (!value?.trim()) return nowLocalDatetime()
  return value.trim().replace(" ", "T").slice(0, 16)
}

const GOODS_UNITS = ["PCS", "KGS", "LTR", "MTR", "CTN", "BOX", "BAG", "DOZ", "SET", "Other"] as const
const GOODS_CONDITIONS = ["Seized", "Detained", "Under Examination", "Pending Clearance", "Unclaimed"] as const

function generateGoodsQrCode(): string {
  return `QR-NS-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

function newClientLineId(): string {
  return `gi-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const getQrCodeUrl = (data: string, size = 120) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`

function emptyItem(): NoteSheetItem {
  const clientLineId = newClientLineId()
  return {
    clientLineId,
    qrCodeNumber: generateGoodsQrCode(),
    product: "",
    pctCode: "",
    quantity: "",
    unit: "PCS",
    condition: "Detained",
    estimatedValue: "",
    perishable: false,
    identificationRef: "",
    remarks: "",
    images: [],
    imageFiles: [],
  }
}

type MediaKey = keyof NoteSheetCreateMedia

const MEDIA_FIELDS: { key: MediaKey; label: string; accept: string }[] = [
  { key: "photos", label: "Photos", accept: "image/*" },
  { key: "videos", label: "Videos", accept: "video/*" },
  { key: "pdfs", label: "PDF", accept: "application/pdf,.pdf" },
  { key: "invoices", label: "Invoice", accept: ".pdf,.jpg,.jpeg,.png,.doc,.docx" },
  { key: "challans", label: "Delivery Challan", accept: ".pdf,.jpg,.jpeg,.png,.doc,.docx" },
  { key: "importDocs", label: "Import Documents", accept: ".pdf,.jpg,.jpeg,.png,.doc,.docx" },
  { key: "cnics", label: "CNIC", accept: "image/*,.pdf" },
  { key: "other", label: "Other Files", accept: "*/*" },
]

const GROUNDS_PLACEHOLDER = [
  "e.g.",
  "• Goods found without valid invoices.",
  "• Tax stamps missing.",
  "• Documents appear forged.",
  "• Quantity does not match declared invoices.",
  "• Smuggled goods suspected.",
  "• Goods concealed.",
  "• Expired licenses.",
].join("\n")

const FINDINGS_PLACEHOLDER =
  "During inspection, goods worth approximately Rs. … were found. The owner failed to produce valid tax invoices. Initial examination suggests possible tax evasion. It is recommended that the goods be detained for detailed assessment."

export default function NoteSheetCreatePage() {
  const navigate = useNavigate()
  const { id: editId } = useParams<{ id?: string }>()
  const isEdit = Boolean(editId)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [invalidField, setInvalidField] = useState("")
  const [noteSheetNo, setNoteSheetNo] = useState("")
  const [status, setStatus] = useState<"Draft" | "Rejected">("Draft")
  const [existingAttachments, setExistingAttachments] = useState<
    { id: string; fileType: string; originalFilename: string; url: string }[]
  >([])

  const [dateTime, setDateTime] = useState(nowLocalDatetime)
  const [office, setOffice] = useState("")
  const [caseNo, setCaseNo] = useState("")
  const [priority, setPriority] = useState<"Normal" | "Urgent">("Normal")
  const [subject, setSubject] = useState("")

  const [preparedBy, setPreparedBy] = useState("")
  const [badgeId, setBadgeId] = useState("")
  const [designation, setDesignation] = useState("")
  const [department, setDepartment] = useState("")
  const [officerContact, setOfficerContact] = useState("")

  const [accusedName, setAccusedName] = useState("")
  const [accusedFatherName, setAccusedFatherName] = useState("")
  const [accusedCnic, setAccusedCnic] = useState("")
  const [accusedMobile, setAccusedMobile] = useState("")
  const [accusedAddress, setAccusedAddress] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [ntnStrn, setNtnStrn] = useState("")

  const [items, setItems] = useState<NoteSheetItem[]>([])
  const [previewQrData, setPreviewQrData] = useState<string | null>(null)

  const [placeOfInspection, setPlaceOfInspection] = useState("")
  const [warehouseShop, setWarehouseShop] = useState("")
  const [gpsLocation, setGpsLocation] = useState("")
  const [inspectionDate, setInspectionDate] = useState(nowLocalDatetime)

  const [groundsOfSuspicion, setGroundsOfSuspicion] = useState("")
  const [evidenceCollected, setEvidenceCollected] = useState<string[]>([])
  const [media, setMedia] = useState<NoteSheetCreateMedia>({})
  const [preliminaryFindings, setPreliminaryFindings] = useState("")
  const [recommendation, setRecommendation] = useState<string>(RECOMMENDATION_OPTIONS[3])

  const [preparedSignature, setPreparedSignature] = useState("")
  const [preparedDate, setPreparedDate] = useState(nowLocalDatetime)

  // Prefill logged-in officer on create
  useEffect(() => {
    const applyOfficerProfile = (user: {
      full_name?: string
      username?: string
      employee_id?: string
      designation?: string
      location?: string
      collectorate?: string
      cell_no?: string
      phone?: string
      office_phone_1?: string
      office_phone_2?: string
    }) => {
      const name = (user.full_name || "").trim() || user.username || ""
      if (name) {
        setPreparedBy(name)
        setPreparedSignature(name)
      }
      setBadgeId((user.employee_id || "").trim())
      setDesignation((user.designation || "").trim())
      const dept =
        (user.collectorate || "").trim() ||
        (user.location ? locationLabel(user.location) : "")
      setDepartment(dept)
      if (user.location) setOffice(locationLabel(user.location))
      setOfficerContact(pickUserContact(user))
    }

    const sessionUser = getStoredUser()
    if (!isEdit && sessionUser) {
      applyOfficerProfile(sessionUser)
    }

    if (!isEdit) {
      fetchCurrentUser()
        .then((profile) => applyOfficerProfile(profile))
        .catch(() => undefined)
    }
  }, [isEdit])

  useEffect(() => {
    if (!editId) return
    setLoading(true)
    fetchNoteSheetById(editId)
      .then((row) => {
        if (row.status !== "Draft" && row.status !== "Rejected") {
          toast({
            title: "Only Draft or Rejected note sheets can be edited",
            variant: "destructive",
          })
          navigate(getSeizureMgmtNoteSheetDetailPath(row.id))
          return
        }
        setNoteSheetNo(row.noteSheetNo || row.referenceNumber || "")
        setStatus(row.status)
        setDateTime(toDatetimeLocal(row.dateTime))
        setOffice(row.office || "")
        setCaseNo(row.caseNo || "")
        setPriority(row.priority === "Urgent" ? "Urgent" : "Normal")
        setSubject(row.subject || "")
        setPreparedBy(row.preparedBy || "")
        setBadgeId(row.badgeId || "")
        setDesignation(row.designation || "")
        setDepartment(row.department || "")
        setOfficerContact(row.officerContact || "")
        setAccusedName(row.accusedName || "")
        setAccusedFatherName(row.accusedFatherName || "")
        setAccusedCnic(row.accusedCnic || "")
        setAccusedMobile(row.accusedMobile || "")
        setAccusedAddress(row.accusedAddress || "")
        setBusinessName(row.businessName || "")
        setNtnStrn(row.ntnStrn || "")
        setItems(
          row.items?.length
            ? row.items.map((it) => ({
                id: it.id,
                clientLineId: it.clientLineId || it.id || newClientLineId(),
                qrCodeNumber: it.qrCodeNumber || generateGoodsQrCode(),
                product: it.product || it.description || "",
                pctCode: it.pctCode || "",
                quantity: it.quantity || "",
                unit: it.unit || "PCS",
                condition: it.condition || "Detained",
                estimatedValue: it.estimatedValue || it.assessableValuePkr || "",
                perishable: Boolean(it.perishable),
                identificationRef: it.identificationRef || "",
                remarks: it.remarks || it.itemNotes || "",
                images: it.images || [],
                imageFiles: [],
              }))
            : [emptyItem()]
        )
        setPlaceOfInspection(row.placeOfInspection || "")
        setWarehouseShop(row.warehouseShop || "")
        setGpsLocation(row.gpsLocation || "")
        setInspectionDate(toDatetimeLocal(row.inspectionDate))
        setGroundsOfSuspicion(row.groundsOfSuspicion || "")
        setEvidenceCollected(row.evidenceCollected || [])
        setPreliminaryFindings(row.preliminaryFindings || row.content || "")
        setRecommendation(row.recommendation || RECOMMENDATION_OPTIONS[3])
        setPreparedSignature(row.preparedSignature || "")
        setPreparedDate(toDatetimeLocal(row.preparedDate))
        setExistingAttachments(row.attachments || [])
      })
      .catch((e) => {
        toast({
          title: e instanceof Error ? e.message : "Failed to load note sheet",
          variant: "destructive",
        })
        navigate(ROUTES.SEIZURE_MGMT_NOTE_SHEET)
      })
      .finally(() => setLoading(false))
  }, [editId, navigate])

  const updateItem = (
    index: number,
    field: keyof NoteSheetItem,
    value: string | boolean | File[] | string[]
  ) => {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text)
    toast({ title: "Copied", description: "QR code number copied." })
  }

  const toggleEvidence = (option: string, checked: boolean) => {
    setEvidenceCollected((prev) =>
      checked ? [...prev, option] : prev.filter((x) => x !== option)
    )
  }

  const onMediaChange = (key: MediaKey, files: FileList | null) => {
    setMedia((prev) => ({
      ...prev,
      [key]: files ? Array.from(files) : [],
    }))
  }

  const buildPayload = (): NoteSheetWritePayload => {
    const user = getStoredUser()
    const officerName =
      preparedBy.trim() ||
      (user?.full_name || "").trim() ||
      user?.username ||
      ""
    return {
      dateTime: dateTime.replace("T", " "),
      office,
      caseNo,
      priority,
      status: "Draft",
      subject,
      preparedBy: officerName,
      badgeId,
      designation,
      department,
      officerContact,
      accusedName,
      accusedFatherName,
      accusedCnic,
      accusedMobile,
      accusedAddress,
      businessName,
      ntnStrn,
      items: items.filter((it) => {
        const hasContent =
          it.product.trim() ||
          it.quantity.trim() ||
          it.remarks.trim() ||
          it.identificationRef.trim() ||
          (it.imageFiles?.length ?? 0) > 0 ||
          (it.images?.length ?? 0) > 0
        return Boolean(hasContent)
      }),
      placeOfInspection,
      warehouseShop,
      gpsLocation,
      inspectionDate: inspectionDate.replace("T", " "),
      groundsOfSuspicion,
      evidenceCollected,
      preliminaryFindings,
      recommendation,
      preparedSignature: preparedSignature.trim() || officerName,
      preparedDate: preparedDate.replace("T", " "),
      forwardTo: NOTE_SHEET_APPROVER_LABEL,
      forwardToUserId: null,
      ...(user ? { createdBy: user.username } : {}),
    }
  }

  const handleSave = async (submit: boolean) => {
    const payload = buildPayload()
    const hasGoods = items.some((it) => it.product.trim())
    const missing = firstMissingField([
      { id: "ns-datetime", label: "Date & Time", missing: !dateTime.trim() },
      { id: "ns-office", label: "Office / Region", missing: submit && !office.trim() },
      { id: "ns-subject", label: "Subject", missing: submit && !subject.trim() },
      {
        id: "ns-prepared-by",
        label: "Preparing Officer",
        missing: !payload.preparedBy?.trim(),
        message: "Log in again if officer details did not load.",
      },
      {
        id: "ns-accused-name",
        label: "Accused Name",
        missing: submit && !accusedName.trim() && !businessName.trim(),
        message: "Enter accused name or business name.",
      },
      {
        id: "ns-goods",
        label: "Description of Goods",
        missing: submit && !hasGoods,
        message: "Add at least one goods line with a description.",
      },
      { id: "ns-place", label: "Place of Inspection", missing: submit && !placeOfInspection.trim() },
      {
        id: "ns-grounds",
        label: "Grounds of Suspicion",
        missing: submit && !groundsOfSuspicion.trim() && !preliminaryFindings.trim(),
        message: "Grounds of Suspicion or Preliminary Findings is required to submit.",
      },
    ])
    if (missing) {
      setInvalidField(missing.id)
      reportMissingField(missing)
      return
    }
    setInvalidField("")

    setSaving(true)
    try {
      const hasDocMedia = Object.values(media).some((arr) => Array.isArray(arr) && arr.length > 0)
      const hasGoodsImages = (payload.items ?? []).some((it) => (it.imageFiles?.length ?? 0) > 0)
      const mediaToSend = hasDocMedia || hasGoodsImages ? media : undefined
      const saved = isEdit && editId
        ? await updateNoteSheet(editId, payload, mediaToSend)
        : await createNoteSheet(payload, mediaToSend)
      if (submit) {
        await noteSheetApproval(saved.id, "submit")
        toast({ title: "Note sheet sent for approval" })
      } else {
        toast({ title: isEdit ? "Note sheet updated" : "Note sheet saved as draft" })
      }
      navigate(getSeizureMgmtNoteSheetDetailPath(saved.id))
    } catch (e) {
      console.error("Note sheet save failed", e)
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Failed to save note sheet",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ModulePageLayout
        title={isEdit ? "Edit Note Sheet" : "Create Note Sheet"}
        description="Loading..."
        breadcrumbs={[
          { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
          { label: "Note Sheet", href: ROUTES.SEIZURE_MGMT_NOTE_SHEET },
          { label: isEdit ? "Edit" : "Create" },
        ]}
      >
        <p className="text-muted-foreground">Loading...</p>
      </ModulePageLayout>
    )
  }

  return (
    <ModulePageLayout
      title={isEdit ? "Edit Note Sheet" : "Create Note Sheet"}
      description="First legal document in the workflow. Records why goods may be detained and requests senior officer approval before a detention memo can be created."
      breadcrumbs={[
        { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
        { label: "Note Sheet", href: ROUTES.SEIZURE_MGMT_NOTE_SHEET },
        { label: isEdit ? "Edit" : "Create" },
      ]}
    >
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to={isEdit && editId ? getSeizureMgmtNoteSheetDetailPath(editId) : ROUTES.SEIZURE_MGMT_NOTE_SHEET}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      <div className="space-y-4 w-full max-w-[1600px]">
        {/* 1. Basic Information */}
        <Collapsible defaultOpen>
          <Card className="rounded-[10px] border-gray-200">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer flex flex-row items-center justify-between hover:bg-muted/50 rounded-t-lg">
                <CardTitle className="text-base">1. Basic Information</CardTitle>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Note Sheet Number</Label>
                  <Input
                    value={noteSheetNo}
                    disabled
                    placeholder="Auto-generated on save"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ns-datetime">Date &amp; Time <span className="text-red-600">*</span></Label>
                  <Input
                    id="ns-datetime"
                    type="datetime-local"
                    value={dateTime}
                    aria-invalid={invalidField === "ns-datetime"}
                    onChange={(e) => {
                      setDateTime(e.target.value)
                      if (invalidField === "ns-datetime") setInvalidField("")
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ns-office">Office / Region <span className="text-red-600">*</span></Label>
                  <Input
                    id="ns-office"
                    value={office}
                    aria-invalid={invalidField === "ns-office"}
                    onChange={(e) => {
                      setOffice(e.target.value)
                      if (invalidField === "ns-office") setInvalidField("")
                    }}
                    placeholder="Customs office / station / region"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Investigation / Case Number</Label>
                  <Input
                    value={caseNo}
                    onChange={(e) => setCaseNo(e.target.value)}
                    placeholder="Investigation or case number"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as "Normal" | "Urgent")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Normal">Normal</SelectItem>
                      <SelectItem value="Urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Input value={isEdit ? status : "Draft"} disabled readOnly />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="ns-subject">Subject <span className="text-red-600">*</span></Label>
                  <Input
                    id="ns-subject"
                    value={subject}
                    aria-invalid={invalidField === "ns-subject"}
                    onChange={(e) => {
                      setSubject(e.target.value)
                      if (invalidField === "ns-subject") setInvalidField("")
                    }}
                    placeholder="Subject of the note sheet"
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 2. Officer Information */}
        <Collapsible defaultOpen>
          <Card className="rounded-[10px] border-gray-200">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer flex flex-row items-center justify-between hover:bg-muted/50 rounded-t-lg">
                <CardTitle className="text-base">2. Officer Information</CardTitle>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="ns-prepared-by">Preparing Officer <span className="text-red-600">*</span></Label>
                  <Input
                    id="ns-prepared-by"
                    value={preparedBy}
                    readOnly
                    disabled
                    aria-invalid={invalidField === "ns-prepared-by"}
                    className="bg-muted"
                    placeholder="Logged-in officer"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Badge / Employee ID</Label>
                  <Input value={badgeId} readOnly disabled className="bg-muted" />
                </div>
                <div className="grid gap-2">
                  <Label>Designation</Label>
                  <Input value={designation} readOnly disabled className="bg-muted" />
                </div>
                <div className="grid gap-2">
                  <Label>Department</Label>
                  <Input value={department} readOnly disabled className="bg-muted" />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label>Contact Number</Label>
                  <Input
                    value={officerContact}
                    readOnly
                    disabled
                    className="bg-muted"
                    placeholder="No phone on profile"
                  />
                  <p className="text-xs text-muted-foreground">
                    All officer fields are filled from the logged-in user profile.
                  </p>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 3. Suspect / Accused */}
        <Collapsible defaultOpen>
          <Card className="rounded-[10px] border-gray-200">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer flex flex-row items-center justify-between hover:bg-muted/50 rounded-t-lg">
                <CardTitle className="text-base">3. Suspect / Accused Information</CardTitle>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="ns-accused-name">Name (or business) <span className="text-red-600">*</span></Label>
                  <Input
                    id="ns-accused-name"
                    value={accusedName}
                    aria-invalid={invalidField === "ns-accused-name"}
                    onChange={(e) => {
                      setAccusedName(e.target.value)
                      if (invalidField === "ns-accused-name") setInvalidField("")
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Father Name</Label>
                  <Input
                    value={accusedFatherName}
                    onChange={(e) => setAccusedFatherName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>CNIC / Passport</Label>
                  <Input
                    value={accusedCnic}
                    onChange={(e) => setAccusedCnic(e.target.value)}
                    placeholder="CNIC (13 digits) or passport"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Mobile Number</Label>
                  <Input value={accusedMobile} onChange={(e) => setAccusedMobile(e.target.value)} />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label>Address</Label>
                  <Textarea
                    rows={3}
                    value={accusedAddress}
                    onChange={(e) => setAccusedAddress(e.target.value)}
                    placeholder="Residential / business address"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Business Name (if any)</Label>
                  <Input
                    value={businessName}
                    onChange={(e) => {
                      setBusinessName(e.target.value)
                      if (invalidField === "ns-accused-name") setInvalidField("")
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>NTN / STRN (optional)</Label>
                  <Input value={ntnStrn} onChange={(e) => setNtnStrn(e.target.value)} />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 4. Goods Information */}
        <Collapsible defaultOpen>
          <Card className="rounded-[10px] border-gray-200">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer flex flex-row items-center justify-between hover:bg-muted/50 rounded-t-lg">
                <CardTitle className="text-base">4. Goods Information</CardTitle>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-4">
                  List of seized/detained goods. <strong>Each item gets a unique QR code</strong> for scanning. Click the eye button to preview a larger QR code.
                </p>
                <div
                  id="ns-goods"
                  tabIndex={-1}
                  className={
                    invalidField === "ns-goods"
                      ? "rounded-md ring-2 ring-red-500 ring-offset-2 outline-none"
                      : undefined
                  }
                >
                <div className="overflow-auto max-w-full">
                  <Table className={goodsTableClass}>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">QR Code</TableHead>
                        <TableHead className="w-[240px]">Description of Goods <span className="text-red-600">*</span></TableHead>
                        <TableHead className="w-[88px]">Qty</TableHead>
                        <TableHead className="w-[110px]">Unit</TableHead>
                        <TableHead className="w-[190px]">Condition</TableHead>
                        <TableHead className="w-[92px]">Perishable</TableHead>
                        <TableHead className="w-[160px]">ID / Chassis No.</TableHead>
                        <TableHead className="w-[220px]">Item Notes</TableHead>
                        <TableHead className="w-[96px]">Images</TableHead>
                        <TableHead className="w-[44px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-muted-foreground text-center py-6">
                            No goods added. Click "Add line" to add seized/detained items.
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((row, index) => (
                          <TableRow key={row.clientLineId || index} className={index % 2 === 1 ? "bg-muted/10" : ""}>
                            <TableCell className="align-middle">
                              <div className="flex flex-col gap-1 items-start">
                                <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded truncate max-w-[130px]">
                                  {row.qrCodeNumber}
                                </span>
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1 text-xs"
                                    onClick={() => copyToClipboard(row.qrCodeNumber)}
                                  >
                                    <Copy className="h-3 w-3 mr-1" />
                                    Copy
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1 text-xs"
                                    onClick={() => setPreviewQrData(row.qrCodeNumber)}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    Preview
                                  </Button>
                                </div>
                                <img
                                  src={getQrCodeUrl(row.qrCodeNumber, 100)}
                                  alt="QR Code"
                                  width={100}
                                  height={100}
                                  className="mt-1 border border-gray-200 rounded-sm bg-white p-1"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='10'%3EQR Error%3C/text%3E%3C/svg%3E"
                                  }}
                                />
                              </div>
                            </TableCell>
                            <TableCell className={goodsLineCellClass}>
                              <GoodsLineTextField
                                value={row.product}
                                onChange={(e) => {
                                  updateItem(index, "product", e.target.value)
                                  if (invalidField === "ns-goods") setInvalidField("")
                                }}
                                placeholder="Description of goods"
                                title="Description of goods"
                                aria-invalid={invalidField === "ns-goods" && index === 0}
                              />
                            </TableCell>
                            <TableCell className="align-middle">
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={row.quantity}
                                onChange={(e) => updateItem(index, "quantity", e.target.value)}
                                placeholder="Qty"
                                title="Qty"
                                className={goodsPlaceholderClass}
                              />
                            </TableCell>
                            <TableCell className="align-middle">
                              <Select value={row.unit} onValueChange={(v) => updateItem(index, "unit", v)}>
                                <SelectTrigger className={goodsSelectTriggerClass} title="Unit">
                                  <SelectValue placeholder="Unit" />
                                </SelectTrigger>
                                <SelectContent>
                                  {GOODS_UNITS.map((u) => (
                                    <SelectItem key={u} value={u}>
                                      {u}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="align-middle">
                              <Select
                                value={row.condition}
                                onValueChange={(v) => updateItem(index, "condition", v)}
                              >
                                <SelectTrigger className={goodsSelectTriggerClass} title="Condition">
                                  <SelectValue placeholder="Condition" />
                                </SelectTrigger>
                                <SelectContent>
                                  {GOODS_CONDITIONS.map((c) => (
                                    <SelectItem key={c} value={c}>
                                      {c}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-center align-middle">
                              <Checkbox
                                checked={row.perishable}
                                onCheckedChange={(checked) => updateItem(index, "perishable", !!checked)}
                              />
                            </TableCell>
                            <TableCell className="align-middle">
                              <Input
                                value={row.identificationRef}
                                onChange={(e) => updateItem(index, "identificationRef", e.target.value)}
                                placeholder="Chassis / Serial"
                                title="Chassis / Serial"
                                className={goodsPlaceholderClass}
                              />
                            </TableCell>
                            <TableCell className={goodsLineCellClass}>
                              <GoodsLineTextField
                                value={row.remarks}
                                onChange={(e) => updateItem(index, "remarks", e.target.value)}
                                placeholder="Officer notes for this item"
                                title="Officer notes for this item"
                              />
                            </TableCell>
                            <TableCell className="align-middle">
                              <div className="flex flex-col gap-1">
                                <label className="cursor-pointer inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 px-2 py-1 rounded">
                                  <Camera className="h-3 w-3" />
                                  Add ({(row.imageFiles?.length ?? 0) + (row.images?.length ?? 0)}/10)
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                      const files = Array.from(e.target.files ?? [])
                                      const current =
                                        (row.imageFiles?.length ?? 0) + (row.images?.length ?? 0)
                                      const available = 10 - current
                                      const next = [...(row.imageFiles ?? []), ...files.slice(0, available)]
                                      updateItem(index, "imageFiles", next)
                                      e.target.value = ""
                                    }}
                                  />
                                </label>
                                {((row.imageFiles?.length ?? 0) > 0 || (row.images?.length ?? 0) > 0) && (
                                  <div className="flex flex-wrap gap-1">
                                    {row.images?.map((imgUrl, idx) => (
                                      <img
                                        key={`existing-${idx}`}
                                        src={imgUrl}
                                        alt={`Goods ${idx + 1}`}
                                        className="h-8 w-8 object-cover rounded border"
                                      />
                                    ))}
                                    {row.imageFiles?.map((file, idx) => (
                                      <div key={`new-${idx}`} className="relative">
                                        <img
                                          src={URL.createObjectURL(file)}
                                          alt={`New ${idx + 1}`}
                                          className="h-8 w-8 object-cover rounded border"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const next = [...(row.imageFiles ?? [])]
                                            next.splice(idx, 1)
                                            updateItem(index, "imageFiles", next)
                                          }}
                                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                                        >
                                          <X className="h-2 w-2" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="align-middle text-center">
                              <div className="flex items-center justify-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                disabled={false}
                                onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setItems((prev) => [...prev, emptyItem()])
                    if (invalidField === "ns-goods") setInvalidField("")
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add line
                </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 5. Location Information */}
        <Collapsible defaultOpen>
          <Card className="rounded-[10px] border-gray-200">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer flex flex-row items-center justify-between hover:bg-muted/50 rounded-t-lg">
                <CardTitle className="text-base">5. Location Information</CardTitle>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="ns-place">Place of Inspection <span className="text-red-600">*</span></Label>
                  <Input
                    id="ns-place"
                    value={placeOfInspection}
                    aria-invalid={invalidField === "ns-place"}
                    onChange={(e) => {
                      setPlaceOfInspection(e.target.value)
                      if (invalidField === "ns-place") setInvalidField("")
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Warehouse / Shop</Label>
                  <Input
                    value={warehouseShop}
                    onChange={(e) => setWarehouseShop(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>GPS Location (optional)</Label>
                  <Input
                    value={gpsLocation}
                    onChange={(e) => setGpsLocation(e.target.value)}
                    placeholder="Lat, Long"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Inspection Date &amp; Time</Label>
                  <Input
                    type="datetime-local"
                    value={inspectionDate}
                    onChange={(e) => setInspectionDate(e.target.value)}
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 6. Grounds of Suspicion */}
        <Collapsible defaultOpen>
          <Card className="rounded-[10px] border-gray-200">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer flex flex-row items-center justify-between hover:bg-muted/50 rounded-t-lg">
                <CardTitle className="text-base">6. Grounds of Suspicion <span className="text-red-600">*</span></CardTitle>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <Textarea
                  id="ns-grounds"
                  rows={8}
                  value={groundsOfSuspicion}
                  aria-invalid={invalidField === "ns-grounds"}
                  onChange={(e) => {
                    setGroundsOfSuspicion(e.target.value)
                    if (invalidField === "ns-grounds") setInvalidField("")
                  }}
                  placeholder={GROUNDS_PLACEHOLDER}
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 7. Evidence Collected */}
        <Collapsible defaultOpen>
          <Card className="rounded-[10px] border-gray-200">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer flex flex-row items-center justify-between hover:bg-muted/50 rounded-t-lg">
                <CardTitle className="text-base">7. Evidence Collected</CardTitle>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 grid gap-3 sm:grid-cols-2">
                {EVIDENCE_OPTIONS.map((option) => {
                  const checked = evidenceCollected.includes(option)
                  return (
                    <label key={option} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleEvidence(option, v === true)}
                      />
                      {option}
                    </label>
                  )
                })}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 8. Documents Attached */}
        <Collapsible defaultOpen>
          <Card className="rounded-[10px] border-gray-200">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer flex flex-row items-center justify-between hover:bg-muted/50 rounded-t-lg">
                <CardTitle className="text-base">8. Documents Attached</CardTitle>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {existingAttachments.length > 0 && (
                  <div className="rounded-md border p-3 space-y-2">
                    <p className="text-sm font-medium">Already uploaded</p>
                    <ul className="text-sm space-y-1">
                      {existingAttachments.map((att) => (
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
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  {MEDIA_FIELDS.map(({ key, label, accept }) => (
                    <div key={key} className="grid gap-2">
                      <Label>{label}</Label>
                      <Input
                        type="file"
                        multiple
                        accept={accept}
                        onChange={(e) => onMediaChange(key, e.target.files)}
                      />
                      {(media[key]?.length ?? 0) > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {media[key]!.length} file(s) selected
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 9. Preliminary Findings */}
        <Collapsible defaultOpen>
          <Card className="rounded-[10px] border-gray-200">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer flex flex-row items-center justify-between hover:bg-muted/50 rounded-t-lg">
                <CardTitle className="text-base">9. Preliminary Findings <span className="text-red-600">*</span></CardTitle>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <Textarea
                  id="ns-findings"
                  rows={6}
                  value={preliminaryFindings}
                  aria-invalid={invalidField === "ns-grounds"}
                  onChange={(e) => {
                    setPreliminaryFindings(e.target.value)
                    if (invalidField === "ns-grounds") setInvalidField("")
                  }}
                  placeholder={FINDINGS_PLACEHOLDER}
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 10. Recommendation */}
        <Collapsible defaultOpen>
          <Card className="rounded-[10px] border-gray-200">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer flex flex-row items-center justify-between hover:bg-muted/50 rounded-t-lg">
                <CardTitle className="text-base">10. Recommendation</CardTitle>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <RadioGroup value={recommendation} onValueChange={setRecommendation} className="gap-3">
                  {RECOMMENDATION_OPTIONS.map((option) => (
                    <label key={option} className="flex items-center gap-2 text-sm cursor-pointer">
                      <RadioGroupItem value={option} id={`rec-${option}`} />
                      {option}
                    </label>
                  ))}
                </RadioGroup>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 11. Approval Workflow (preparation) */}
        <Collapsible defaultOpen>
          <Card className="rounded-[10px] border-gray-200">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer flex flex-row items-center justify-between hover:bg-muted/50 rounded-t-lg">
                <CardTitle className="text-base">11. Approval Workflow</CardTitle>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-6">
                <div>
                  <p className="text-sm font-medium mb-3">Prepared By</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Officer Name</Label>
                      <Input value={preparedBy} disabled readOnly />
                    </div>
                    <div className="grid gap-2">
                      <Label>Signature</Label>
                      <Input
                        value={preparedSignature}
                        onChange={(e) => setPreparedSignature(e.target.value)}
                        placeholder="Name / signature mark"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Date</Label>
                      <Input
                        type="datetime-local"
                        value={preparedDate}
                        onChange={(e) => setPreparedDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-3">Forward To</p>
                  <div className="rounded-md border bg-muted/40 px-3 py-3 space-y-1">
                    <p className="text-sm font-medium">Approving officials (automatic)</p>
                    <p className="text-sm text-foreground">{NOTE_SHEET_APPROVER_LABEL}</p>
                    <p className="text-xs text-muted-foreground">
                      On submit, all of these roles are notified. Location Admin, Deputy Collector,
                      and Assistant Collector at your location, plus Super Admin, can approve or
                      reject.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Approval status (Pending / Approved / Rejected) is set by an approving official on
                  the note sheet detail page.
                </p>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <div className="flex flex-wrap gap-2 pb-8">
          <Button type="button" variant="outline" disabled={saving} onClick={() => void handleSave(false)}>
            {saving ? "Saving…" : "Save Draft"}
          </Button>
          <Button type="button" disabled={saving} onClick={() => void handleSave(true)}>
            <Send className="h-4 w-4 mr-2" />
            {saving ? "Submitting…" : "Send for Approval"}
          </Button>
        </div>
      </div>

      <Dialog open={!!previewQrData} onOpenChange={() => setPreviewQrData(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code Preview</DialogTitle>
            <DialogDescription>
              Scan this QR code to identify the detained goods item.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {previewQrData && (
              <>
                <img
                  src={getQrCodeUrl(previewQrData, 250)}
                  alt="Large QR Code"
                  width={250}
                  height={250}
                  className="border rounded-md p-2 bg-white"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='250' viewBox='0 0 250 250'%3E%3Crect width='250' height='250' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='16'%3EQR Error%3C/text%3E%3C/svg%3E"
                  }}
                />
                <div className="text-center">
                  <p className="font-mono text-sm bg-muted px-2 py-1 rounded break-all">{previewQrData}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => copyToClipboard(previewQrData)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Number
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}
