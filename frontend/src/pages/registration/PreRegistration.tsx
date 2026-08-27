import { useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { WalkInStepIndicator } from "@/components/walk-in/step-indicator"
import { WalkInStep1VisitorDetails } from "@/components/walk-in/step1-visitor-details"
import { WalkInStep2DocumentsUpload } from "@/components/walk-in/step2-documents-upload"
import { WalkInStep4QRCodeGeneration } from "@/components/walk-in/step4-qr-code-generation"
import { WalkInStep3VisitDetails } from "@/components/walk-in/step3-visit-details"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { createVisitor, fetchVisitors, getVisitor, deleteVisitor, getErrorToastMessage, getVisitorCreatedBy, saveDraftToStore, updateVisitor, type VisitorRecord } from "@/lib/visitor-api"
import { getVisitorPhotoUrl } from "@/lib/image-match"
import { buildVisitorQrPayload, validateGroupVisit } from "@/components/walk-in/group-member"
import { useAccessZones } from "@/hooks/use-access-zones"
import type { GroupVisitMember } from "@/components/walk-in/group-member"
import { PrintQROnSave } from "@/components/visitor/print-qr-on-save"
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, UserPlus, Trash2, Printer } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { ROUTES, getVisitorDetailPath } from "@/routes/config"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase()
  return "??"
}

type RegistrationEntry = {
  id: number
  name: string
  initials: string
  avatar: string
  type: "Pre-Registration"
  department: string
  status: "Checked In" | "Approved" | "Pending Docs" | "Draft" | "Sent"
  time: string
  date: string
  cnic: string
  contact: string
  visitPurpose: string
  host: string
  createdBy: string
}

function formatTime(value: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

function formatDate(value: string) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
}

function mapVisitorToRegistration(visitor: VisitorRecord & Record<string, unknown>): RegistrationEntry {
  const name = visitor.full_name || "Unknown Visitor"
  const mobile = visitor.phone ?? (visitor as Record<string, unknown>).mobile_number ?? ""
  const email = visitor.email ?? (visitor as Record<string, unknown>).email_address ?? ""
  const contact = [String(mobile || ""), String(email || "")].filter(Boolean).join(" · ") || "—"
  const cnicRaw = visitor.cnic_number ?? (visitor as Record<string, unknown>).cnic_number
  const cnic = cnicRaw != null && typeof cnicRaw === "string" ? cnicRaw : String(cnicRaw ?? "")
  const visitPurpose = (visitor as Record<string, unknown>).visit_purpose ?? (visitor as Record<string, unknown>).visitPurpose ?? ""
  const host = (visitor as Record<string, unknown>).host_officer_name ?? (visitor as Record<string, unknown>).hostFullName ?? (visitor as Record<string, unknown>).host_name ?? ""
  const regStatus = (visitor as Record<string, unknown>).registration_status as string | undefined
  const status = regStatus === "draft" ? "Draft" : regStatus === "sent" ? "Sent" : regStatus === "approved" ? "Approved" : "Approved"
  return {
    id: visitor.id,
    name,
    initials: getInitials(name),
    avatar: getVisitorPhotoUrl(visitor as Record<string, unknown>) ?? "",
    type: "Pre-Registration",
    department: visitor.department_to_visit || "—",
    status,
    time: formatTime(visitor.created_at),
    date: formatDate(visitor.created_at),
    cnic: cnic.trim() || "—",
    contact,
    visitPurpose: String(visitPurpose || "").trim() || "—",
    host: String(host || "").trim() || "—",
    createdBy: getVisitorCreatedBy(visitor),
  }
}

function getStatusStyle(status: string) {
  switch (status) {
    case "Checked In": return "bg-[#dbeafe] text-[#3b82f6]"
    case "Approved": return "bg-[#dcfce7] text-[#22c55e]"
    case "Sent": return "bg-[#dcfce7] text-[#22c55e]"
    case "Draft": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
    case "Pending Docs": return "bg-[#fef9c3] text-[#ca8a04]"
    default: return "bg-muted text-muted-foreground"
  }
}

const initialFormData = {
  registrationType: "pre-registration",
  visitorCategory: "new",
  visitorSearch: "",
  visitMode: "individual" as "individual" | "group",
  groupPartySize: 2,
  groupMembers: [] as GroupVisitMember[],
  visitorType: "individual",
  fullName: "",
  cnicPassport: "",
  cnicNumber: "",
  gender: "",
  passportNumber: "",
  nationality: "",
  dateOfBirth: "",
  mobileNumber: "",
  emailAddress: "",
  residentialAddress: "",
  organizationName: "",
  organizationType: "",
  ntnRegistrationNo: "",
  designation: "",
  officeAddress: "",
  vehicleType: "",
  vehicleNumber: "",
  vehicleRegistrationNo: "",
  licenseNo: "",
  licenseIssueDate: "",
  licenseExpiryDate: "",
  vehicleImages: [] as string[],
  visitorPhotos: [] as string[],
  photoCapture: "",
  visitorMinors: [] as {
    name: string
    relation: string
    gender: string
    cnicOrBForm: string
    passportNumber: string
    nationality: string
    dateOfBirth: string
    mobileNumber: string
    emailAddress: string
    residentialAddress: string
    photos?: string[]
  }[],
  visitPurpose: "",
  department: "",
  hostName: "",
  location: "",
  documentType: "",
  documentNo: "",
  issuingAuthority: "",
  expiryDate: "",
  frontImage: "",
  backImage: "",
  backImageFiles: [] as { dataUrl: string; name: string; size: string }[],
  supportDocType: "",
  applicationLetter: "",
  letterRefNo: "",
  additionalDocument: "",
  authorizationLetter: "",
  authorizationLetterFiles: [] as { dataUrl: string; name: string; size: string }[],
  nocDocument: "",
  nocDocumentFiles: [] as { dataUrl: string; name: string; size: string }[],
  uploadProcedure: "",
  qrCodeId: "",
  securityLevel: "",
  maxVisitDuration: "",
  allowedDepartments: "",
  allowedZones: "",
  additionalRemarks: "",
  escortMandatory: "yes",
  visitorRefNumber: "",
  visitDate: "",
  timeValidityStart: "",
  timeValidityEnd: "",
  accessZone: "",
  entryGate: "",
  expiryStatus: "",
  scanCount: "",
  generatedOn: "",
  generatedBy: "",
  preferredDate: "",
  preferredTimeSlot: "",
  departmentForSlot: "",
  slotDuration: "",
  hostId: "",
  hostFullName: "",
  hostDesignation: "",
  hostDepartment: "",
  hostEmail: "",
  hostContactNumber: "",
  priorityLevel: "normal",
  visitType: "",
  visitPurposeDescription: "",
  referenceNumber: "",
  watchlistCheckStatus: "",
  approverRequired: "",
  temporaryAccessGranted: "",
  guardRemarks: "",
}

function summarizeGroupMembers(members: GroupVisitMember[]): string {
  const names = members.map((m) => m.name.trim()).filter(Boolean)
  if (!names.length) return ""
  if (names.length <= 3) return names.join(", ")
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`
}

export default function PreRegistrationPage() {
  const { toast } = useToast()
  useAccessZones()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["visitors", "pre-registration"],
    queryFn: () => fetchVisitors("pre-registration"),
  })
  const registrations = (data ?? []).map(mapVisitorToRegistration)
  const [showForm, setShowForm] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [printQRData, setPrintQRData] = useState<{
    qrPayload: string
    visitorName: string
    visitorCNIC?: string
    accessZone?: string
    validFrom: string
    validTo: string
    qrCodeId?: string
    visitMode?: string
    groupPartySize?: number
    groupMemberSummary?: string
  } | null>(null)
  const [formData, setFormData] = useState({ ...initialFormData })
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null)

  const updateFormData = (data: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...data }))
  }

  useEffect(() => {
    if (!showForm || !editingDraftId) return
    getVisitor(editingDraftId, "pre-registration").then((v: VisitorRecord | null) => {
      if (!v) return
      const draftForm = (v as Record<string, unknown>).draft_form_data
      if (draftForm && typeof draftForm === "object") {
        setFormData({ ...initialFormData, ...draftForm } as typeof formData)
      }
      setCurrentStep(1)
    })
  }, [showForm, editingDraftId])

  useEffect(() => {
    if (!showForm) return
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [showForm, currentStep])

  const buildPayload = (): Record<string, unknown> => ({
        visitor_type: formData.visitorType || "individual",
        full_name: formData.fullName || "Unknown Visitor",
        gender: formData.gender,
        cnic_number: formData.cnicNumber || formData.cnicPassport,
        passport_number: formData.passportNumber,
        nationality: formData.nationality,
        date_of_birth: formData.dateOfBirth,
        mobile_number: formData.mobileNumber,
        email_address: formData.emailAddress,
        residential_address: formData.residentialAddress,
        organization_name: formData.organizationName,
        organization_type: formData.organizationType,
        ntn_registration_no: formData.ntnRegistrationNo,
        designation: formData.designation,
        office_address: formData.officeAddress,
        vehicle_type: formData.vehicleType,
        vehicle_number: formData.vehicleNumber,
        vehicle_registration_no: formData.vehicleRegistrationNo,
        license_no: formData.licenseNo,
        license_issue_date: formData.licenseIssueDate,
        license_expiry_date: formData.licenseExpiryDate,
        vehicle_images: formData.vehicleImages ?? [],
        vehicle_image: (formData.vehicleImages?.length ? formData.vehicleImages[0] : undefined) ?? "",
        visitor_photos: formData.visitorPhotos ?? [],
        photo_capture: formData.photoCapture,
        captured_photo: (formData.visitorPhotos?.length ? formData.visitorPhotos[0] : formData.photoCapture) ?? "",
        profile_image: (formData.visitorPhotos?.length ? formData.visitorPhotos[0] : formData.photoCapture) ?? "",
        visitor_minors: formData.visitorMinors ?? [],
        visit_mode: formData.visitMode ?? "individual",
        group_party_size: formData.visitMode === "group" ? formData.groupPartySize : undefined,
        group_members: formData.visitMode === "group" ? formData.groupMembers ?? [] : [],
        visit_purpose: formData.visitPurpose,
        visit_purpose_description: formData.visitPurposeDescription,
        visit_type: formData.visitType,
        department_to_visit: formData.department || formData.departmentForSlot || "admin",
        host_officer_name: formData.hostFullName || formData.hostName,
        host_name: formData.hostName,
        host_id: formData.hostId,
        host_officer_designation: formData.hostDesignation,
        host_department: formData.hostDepartment,
        host_email: formData.hostEmail,
        host_contact_number: formData.hostContactNumber,
        preferred_visit_date: formData.preferredDate,
        preferred_time_slot: formData.preferredTimeSlot,
        department_for_slot: formData.departmentForSlot,
        slot_duration: formData.slotDuration,
        priority_level: formData.priorityLevel,
        visit_date: formData.visitDate,
        location: formData.location,
        document_type: formData.documentType,
        document_no: formData.documentNo,
        issuing_authority: formData.issuingAuthority,
        expiry_date: formData.expiryDate,
        front_image: formData.frontImage,
        back_image: formData.backImage,
        application_letter: formData.applicationLetter,
        letter_ref_no: formData.letterRefNo,
        additional_document: formData.additionalDocument,
        authorization_letter: formData.authorizationLetter,
        noc_document: formData.nocDocument,
        support_doc_type: formData.supportDocType,
        upload_procedure: formData.uploadProcedure,
        time_validity_start: formData.timeValidityStart,
        time_validity_end: formData.timeValidityEnd,
        access_zone: formData.accessZone,
        entry_gate: formData.entryGate,
        qr_code_id: formData.qrCodeId,
        visitor_ref_number: formData.visitorRefNumber,
        reference_number: formData.referenceNumber,
        security_level: formData.securityLevel,
        max_visit_duration: formData.maxVisitDuration,
        allowed_departments: formData.allowedDepartments,
        allowed_zones: formData.allowedZones,
        additional_remarks: formData.additionalRemarks,
        escort_mandatory: formData.escortMandatory,
        watchlist_check_status: formData.watchlistCheckStatus,
        guard_remarks: formData.guardRemarks,
        approver_required: formData.approverRequired,
        temporary_access_granted: formData.temporaryAccessGranted,
        expiry_status: formData.expiryStatus,
        scan_count: formData.scanCount,
        generated_on: formData.generatedOn,
        generated_by: formData.generatedBy,
  })

  const persistDraft = async (closeForm = false) => {
    try {
      const payload = buildPayload()
      ;(payload as Record<string, unknown>).draft_form_data = formData
      if (editingDraftId != null) {
        const updated = await updateVisitor(editingDraftId, payload, "pre-registration", { registrationStatus: "draft" })
        if (!updated) {
          toast({ title: "Could not save draft", variant: "destructive" })
          return
        }
        await queryClient.invalidateQueries({ queryKey: ["visitors", "pre-registration"] })
        toast({
          title: closeForm ? "Draft updated" : "Progress saved",
          description: closeForm
            ? "Draft has been saved to the list."
            : "Your changes on this step have been saved.",
        })
      } else {
        const created = await saveDraftToStore(payload, "pre-registration")
        setEditingDraftId(created.id)
        await queryClient.invalidateQueries({ queryKey: ["visitors", "pre-registration"] })
        toast({
          title: "Draft saved",
          description: closeForm
            ? "Draft has been saved to the list. You can continue or submit later."
            : "Draft created. Continue with the remaining steps.",
        })
      }
      if (closeForm) {
        setEditingDraftId(null)
        setShowForm(false)
        setCurrentStep(1)
        setFormData({ ...initialFormData })
      }
    } catch (err) {
      toast({
        title: "Could not save draft",
        description: getErrorToastMessage(err),
        variant: "destructive",
      })
    }
  }

  const saveDraft = () => persistDraft(true)

  const validateStep = (step: number) => {
    switch (step) {
      case 1:
        if (!formData.fullName.trim()) throw new Error("Full name is required")
        if (!formData.mobileNumber.trim()) throw new Error("Mobile number is required")
        if (!formData.cnicNumber.trim()) throw new Error("CNIC number is required")
        if (!(formData.visitorPhotos ?? []).length) throw new Error("Visitor photograph is required")
        if (formData.visitMode === "group") {
          const groupErr = validateGroupVisit(
            formData.groupPartySize,
            formData.groupMembers ?? [],
            formData.visitorPhotos ?? []
          )
          if (groupErr) throw new Error(groupErr)
        }
        break
      case 2:
        break
      case 3:
        break
      case 4:
        if (!formData.accessZone.trim()) throw new Error("Access zone is required")
        if (!formData.timeValidityStart.trim() || !formData.timeValidityEnd.trim())
          throw new Error("Time validity start and end are required")
        break
    }
  }

  const nextStep = () => {
    try {
      validateStep(currentStep)
      if (currentStep < 4) setCurrentStep(currentStep + 1)
    } catch (e) {
      toast({
        title: "Validation failed",
        description: getErrorToastMessage(e),
        variant: "destructive",
      })
    }
  }

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const createVisitorMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createVisitor(payload, "pre-registration"),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["visitors", "pre-registration"] })
      toast({
        title: "Pre-Registration saved",
        description: "Visitor has been added to the list.",
      })
      setShowForm(false)
      setCurrentStep(1)
      const validFrom = (formData.timeValidityStart || "00:00").trim() || "00:00"
      const validTo = (formData.timeValidityEnd || "23:59").trim() || "23:59"
      const qrPayload = buildVisitorQrPayload({
        name: data.full_name,
        cnic: data.cnic_number,
        id: data.id,
        validFrom,
        validTo,
        accessZone: formData.accessZone,
        qrCodeId: formData.qrCodeId || "",
        visitMode: formData.visitMode,
        groupPartySize: formData.groupPartySize,
        groupMembers: formData.groupMembers,
        mobileNumber: formData.mobileNumber,
      })
      setPrintQRData({
        qrPayload,
        visitorName: formData.fullName || data.full_name || "Visitor",
        visitorCNIC: formData.cnicPassport || formData.cnicNumber || data.cnic_number || "",
        accessZone: formData.accessZone,
        validFrom,
        validTo,
        qrCodeId: formData.qrCodeId || "",
        visitMode: formData.visitMode,
        groupPartySize: formData.visitMode === "group" ? formData.groupPartySize : undefined,
        groupMemberSummary:
          formData.visitMode === "group"
            ? summarizeGroupMembers(formData.groupMembers ?? [])
            : undefined,
      })
      setFormData({ ...initialFormData })
      setEditingDraftId(null)
    },
    onError: (mutationError) => {
      toast({
        title: "Save failed",
        description: getErrorToastMessage(mutationError),
        variant: "destructive",
      })
    },
  })

  const handleSubmit = async () => {
    try {
      const payload = buildPayload()
      if (editingDraftId != null) {
        ;(payload as Record<string, unknown>).draft_form_data = formData
        const updated = await updateVisitor(editingDraftId, payload, "pre-registration", { registrationStatus: "sent" })
        if (!updated) {
          toast({ title: "Update failed", variant: "destructive" })
          return
        }
        await queryClient.invalidateQueries({ queryKey: ["visitors", "pre-registration"] })
        toast({ title: "Registration sent", description: "Draft has been submitted and status updated." })
        setShowForm(false)
        setCurrentStep(1)
        const validFrom = (formData.timeValidityStart || "00:00").trim() || "00:00"
        const validTo = (formData.timeValidityEnd || "23:59").trim() || "23:59"
        const qrPayload = buildVisitorQrPayload({
          name: updated.full_name,
          cnic: updated.cnic_number,
          id: updated.id,
          validFrom,
          validTo,
          accessZone: formData.accessZone,
          qrCodeId: formData.qrCodeId || "",
          visitMode: formData.visitMode,
          groupPartySize: formData.groupPartySize,
          groupMembers: formData.groupMembers,
          mobileNumber: formData.mobileNumber,
        })
        setPrintQRData({
          qrPayload,
          visitorName: formData.fullName || updated.full_name || "Visitor",
          visitorCNIC: formData.cnicPassport || formData.cnicNumber || updated.cnic_number || "",
          accessZone: formData.accessZone,
          validFrom,
          validTo,
          qrCodeId: formData.qrCodeId || "",
          visitMode: formData.visitMode,
          groupPartySize: formData.visitMode === "group" ? formData.groupPartySize : undefined,
          groupMemberSummary:
            formData.visitMode === "group"
              ? summarizeGroupMembers(formData.groupMembers ?? [])
              : undefined,
        })
        setFormData({ ...initialFormData })
        setEditingDraftId(null)
      } else {
        createVisitorMutation.mutate(payload)
      }
    } catch (err) {
      toast({
        title: "Save failed",
        description: getErrorToastMessage(err),
        variant: "destructive",
      })
    }
  }

  const handleCancelForm = () => {
    setShowForm(false)
    setCurrentStep(1)
    setFormData({ ...initialFormData })
    setEditingDraftId(null)
  }

  const handlePrintQR = () => {
    if (!formData.accessZone.trim()) {
      toast({
        title: "Access zone required",
        description: "Select an access zone before printing the visitor pass.",
        variant: "destructive",
      })
      return
    }
    const validFrom = (formData.timeValidityStart || "00:00").trim() || "00:00"
    const validTo = (formData.timeValidityEnd || "23:59").trim() || "23:59"
    const qrPayload = buildVisitorQrPayload({
      fullName: formData.fullName,
      cnicNumber: formData.cnicNumber || formData.cnicPassport,
      validFrom,
      validTo,
      qrCodeId: formData.qrCodeId || "",
      visitorRefNumber: formData.visitorRefNumber,
      visitDate: formData.visitDate,
      accessZone: formData.accessZone,
      entryGate: formData.entryGate,
      visitPurpose: formData.visitPurpose,
      department: formData.department,
      visitMode: formData.visitMode,
      groupPartySize: formData.groupPartySize,
      groupMembers: formData.groupMembers,
      mobileNumber: formData.mobileNumber,
    })
    setPrintQRData({
      qrPayload,
      visitorName: formData.fullName || "Visitor",
      visitorCNIC: formData.cnicPassport || formData.cnicNumber || "",
      accessZone: formData.accessZone,
      validFrom,
      validTo,
      qrCodeId: formData.qrCodeId || "",
      visitMode: formData.visitMode,
      groupPartySize: formData.visitMode === "group" ? formData.groupPartySize : undefined,
      groupMemberSummary:
        formData.visitMode === "group"
          ? summarizeGroupMembers(formData.groupMembers ?? [])
          : undefined,
    })
  }

  return (
    <div className="w-full px-4 ">
      <nav className="text-base text-muted-foreground mb-6 flex flex-wrap items-center gap-x-2 gap-y-1" aria-label="Breadcrumb">
        <Link to={ROUTES.DASHBOARD} className="hover:text-foreground transition-colors">Home</Link>
        <span aria-hidden className="text-muted-foreground/70">/</span>
        <Link to={ROUTES.PRE_REGISTRATION} className="hover:text-foreground transition-colors">Visitor Registration</Link>
        <span aria-hidden className="text-muted-foreground/70">/</span>
        <span className="text-[#3b82f6] font-medium" aria-current="page">
          {showForm ? "New Pre-Registration" : "Pre-Registration"}
        </span>
      </nav>

      {!showForm ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold tracking-tight text-foreground">Pre-Registration</h1>
              <p className="text-base text-muted-foreground mt-1">
                View and manage pre-registrations. Add a new visitor to start.
              </p>
            </div>
            <Button
              onClick={() => {
                setFormData({ ...initialFormData })
                setCurrentStep(1)
                setEditingDraftId(null)
                setShowForm(true)
              }}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white shrink-0 w-full sm:w-auto"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              New Pre-Registration
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-border bg-muted/30">
              <h2 className="text-[22px] font-bold text-foreground">Recent Registrations</h2>
              <p className="text-base text-muted-foreground mt-0.5">Click a row to view details or use the menu for actions.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-160">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Visitor Name</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Type</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Department</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">CNIC / ID</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Contact</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Visit Purpose</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Host</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Created by</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Date</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Time</th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-18">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr className="border-b border-border last:border-0">
                      <td colSpan={12} className="px-4 py-6 text-center text-sm text-muted-foreground">Loading registrations…</td>
                    </tr>
                  ) : isError ? (
                    <tr className="border-b border-border last:border-0">
                      <td colSpan={12} className="px-4 py-6 text-center text-sm text-destructive">
                        {error instanceof Error ? error.message : "Failed to load registrations."}
                      </td>
                    </tr>
                  ) : registrations.length === 0 ? (
                    <tr className="border-b border-border last:border-0">
                      <td colSpan={12} className="px-4 py-6 text-center text-sm text-muted-foreground">No registrations found.</td>
                    </tr>
                  ) : (
                    registrations.map((reg) => (
                      <tr
                        key={reg.id}
                        className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                        onClick={() => navigate(getVisitorDetailPath(reg.id))}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={reg.avatar || "/placeholder.svg"} />
                              <AvatarFallback className="text-xs">{reg.initials}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-foreground">{reg.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-sm text-muted-foreground">{reg.type}</span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground">{reg.department || "—"}</span>
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <span className="text-sm text-muted-foreground font-mono">{reg.cnic}</span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell max-w-[140px] truncate" title={reg.contact}>
                          <span className="text-sm text-muted-foreground">{reg.contact}</span>
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell max-w-[120px] truncate" title={reg.visitPurpose}>
                          <span className="text-sm text-muted-foreground">{reg.visitPurpose}</span>
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell max-w-[120px] truncate" title={reg.host}>
                          <span className="text-sm text-muted-foreground">{reg.host}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusStyle(reg.status)}`}>
                            {reg.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground">{reg.createdBy}</span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-sm text-muted-foreground">{reg.date}</span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-sm text-muted-foreground">{reg.time}</span>
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" className="p-1 rounded hover:bg-muted transition-colors" aria-label="Actions">
                                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(getVisitorDetailPath(reg.id))}>View details</DropdownMenuItem>
                              {reg.status === "Draft" && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingDraftId(reg.id)
                                    setShowForm(true)
                                  }}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit draft
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => setDeleteId(reg.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    const v = await getVisitor(reg.id, "pre-registration")
                                    if (!v) {
                                      toast({ title: "Visitor not found", variant: "destructive" })
                                      return
                                    }
                                    const vZone = String(v.access_zone ?? "")
                                    const vRec = v as Record<string, unknown>
                                    const visitMode = String(vRec.visit_mode ?? vRec.visitMode ?? "individual")
                                    const groupMembers = (vRec.group_members ?? vRec.groupMembers ?? []) as GroupVisitMember[]
                                    const groupPartySize = Number(vRec.group_party_size ?? vRec.groupPartySize ?? 0) || undefined
                                    const qrPayload = buildVisitorQrPayload({
                                      name: v.full_name,
                                      cnic: v.cnic_number,
                                      id: v.id,
                                      validFrom: "00:00",
                                      validTo: "23:59",
                                      accessZone: vZone,
                                      visitMode,
                                      groupPartySize,
                                      groupMembers,
                                    })
                                    setPrintQRData({
                                      qrPayload,
                                      visitorName: v.full_name ?? reg.name,
                                      visitorCNIC: v.cnic_number ?? "",
                                      accessZone: vZone,
                                      validFrom: "00:00",
                                      validTo: "23:59",
                                      qrCodeId: undefined,
                                      visitMode,
                                      groupPartySize: visitMode === "group" ? groupPartySize : undefined,
                                      groupMemberSummary:
                                        visitMode === "group"
                                          ? summarizeGroupMembers(groupMembers)
                                          : undefined,
                                    })
                                  } catch (e) {
                                    toast({
                                      title: "Failed to load visitor",
                                      description: getErrorToastMessage(e),
                                      variant: "destructive",
                                    })
                                  }
                                }}
                              >
                                <Printer className="h-4 w-4 mr-2" />
                                Print QR
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      <AlertDialog open={deleteId != null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete visitor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this visitor record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={async (e) => {
                e.preventDefault()
                if (deleteId == null) return
                setIsDeleting(true)
                try {
                  await deleteVisitor(deleteId, "pre-registration")
                  await queryClient.invalidateQueries({ queryKey: ["visitors", "pre-registration"] })
                  toast({ title: "Visitor deleted", description: "The visitor has been removed." })
                  setDeleteId(null)
                } catch (err) {
                  toast({
                    title: "Delete failed",
                    description: getErrorToastMessage(err),
                    variant: "destructive",
                  })
                } finally {
                  setIsDeleting(false)
                }
              }}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {printQRData && (
        <PrintQROnSave
          qrPayload={printQRData.qrPayload}
          visitorName={printQRData.visitorName}
          visitorCNIC={printQRData.visitorCNIC}
          accessZone={printQRData.accessZone}
          validFrom={printQRData.validFrom}
          validTo={printQRData.validTo}
          qrCodeId={printQRData.qrCodeId}
          visitMode={printQRData.visitMode}
          groupPartySize={printQRData.groupPartySize}
          groupMemberSummary={printQRData.groupMemberSummary}
          onDone={() => setPrintQRData(null)}
        />
      )}

      {showForm ? (
        <>
          <div className="mb-6">
            <h1 className="text-[22px] font-bold tracking-tight text-foreground">Pre-Registration</h1>
            <p className="text-base text-muted-foreground mt-1">
              Complete the registration fields for a new visit.
            </p>
          </div>

          <WalkInStepIndicator currentStep={currentStep} />

          <div className="bg-card rounded-xl border border-border shadow-sm p-4 sm:p-6 mt-6">
            {currentStep === 1 && (
              <WalkInStep1VisitorDetails
                formData={{
                  visitorCategory: formData.visitorCategory,
                  visitorSearch: formData.visitorSearch,
                  visitorType: formData.visitorType,
                  fullName: formData.fullName,
                  gender: formData.gender,
                  cnicNumber: formData.cnicNumber || formData.cnicPassport,
                  passportNumber: formData.passportNumber,
                  nationality: formData.nationality,
                  dateOfBirth: formData.dateOfBirth,
                  mobileNumber: formData.mobileNumber,
                  emailAddress: formData.emailAddress,
                  residentialAddress: formData.residentialAddress,
                  organizationName: formData.organizationName,
                  organizationType: formData.organizationType,
                  ntnRegistrationNo: formData.ntnRegistrationNo,
                  designation: formData.designation,
                  officeAddress: formData.officeAddress,
                  vehicleType: formData.vehicleType,
                  vehicleNumber: formData.vehicleNumber,
                  vehicleRegistrationNo: formData.vehicleRegistrationNo,
                  licenseNo: formData.licenseNo,
                  licenseIssueDate: formData.licenseIssueDate,
                  licenseExpiryDate: formData.licenseExpiryDate,
                  vehicleImages: formData.vehicleImages ?? [],
                  visitorPhotos: formData.visitorPhotos ?? [],
                  photoCapture: formData.photoCapture,
                  visitMode: formData.visitMode ?? "individual",
                  groupPartySize: formData.groupPartySize ?? 2,
                  groupMembers: formData.groupMembers ?? [],
                  visitorMinors: formData.visitorMinors ?? [],
                }}
                updateFormData={(data) => {
                  updateFormData({
                    ...data,
                    ...(data.cnicNumber !== undefined && { cnicPassport: data.cnicNumber }),
                  })
                }}
                onCancel={handleCancelForm}
                onReset={() => {
                  setFormData({ ...initialFormData })
                  try {
                  } catch {}
                }}
                onSaveAndContinue={nextStep}
                onSaveToDraft={saveDraft}
              />
            )}
            {currentStep === 2 && (
              <WalkInStep2DocumentsUpload
                formData={{
                  frontImage: formData.frontImage,
                  backImage: formData.backImage,
                  backImageFiles: formData.backImageFiles ?? [],
                  applicationLetter: formData.applicationLetter,
                  additionalDocument: formData.additionalDocument,
                  authorizationLetter: formData.authorizationLetter ?? "",
                  authorizationLetterFiles: formData.authorizationLetterFiles ?? [],
                  nocDocument: formData.nocDocument ?? "",
                  nocDocumentFiles: formData.nocDocumentFiles ?? [],
                }}
                updateFormData={(data) => updateFormData(data)}
                onCancel={handleCancelForm}
                onReset={() => setFormData({ ...initialFormData })}
                onPrevious={prevStep}
                onSaveToDraft={() => persistDraft(false)}
                onSaveAndContinue={nextStep}
              />
            )}
            {currentStep === 3 && (
              <WalkInStep3VisitDetails
                formData={{
                  visitPurpose: formData.visitPurpose,
                  visitPurposeDescription: formData.visitPurposeDescription,
                  department: formData.department,
                  departmentForSlot: formData.departmentForSlot,
                  hostFullName: formData.hostFullName,
                  hostDesignation: formData.hostDesignation,
                  hostDepartment: formData.hostDepartment,
                  hostEmail: formData.hostEmail,
                  hostContactNumber: formData.hostContactNumber,
                  preferredDate: formData.preferredDate,
                  preferredTimeSlot: formData.preferredTimeSlot,
                  slotDuration: formData.slotDuration,
                  priorityLevel: formData.priorityLevel,
                  location: formData.location,
                  securityLevel: formData.securityLevel,
                  allowedDepartments: formData.allowedDepartments,
                  allowedZones: formData.allowedZones,
                  entryGate: formData.entryGate,
                  maxVisitDuration: formData.maxVisitDuration,
                  timeValidityStart: formData.timeValidityStart,
                  timeValidityEnd: formData.timeValidityEnd,
                  additionalRemarks: formData.additionalRemarks,
                  escortMandatory: formData.escortMandatory,
                }}
                updateFormData={(data) => updateFormData(data)}
                onCancel={handleCancelForm}
                onReset={() => setFormData({ ...initialFormData })}
                onPrevious={prevStep}
                onSaveToDraft={() => persistDraft(false)}
                onSaveAndContinue={nextStep}
              />
            )}
            {currentStep === 4 && (
              <WalkInStep4QRCodeGeneration
                formData={{
                  ...formData,
                  cnicNumber: formData.cnicNumber || formData.cnicPassport,
                }}
                updateFormData={(data) => updateFormData(data)}
                onCancel={handleCancelForm}
                onReset={() => setFormData({ ...initialFormData })}
                onPrevious={prevStep}
                onPrint={handlePrintQR}
                onFinish={handleSubmit}
              />
            )}
          </div>

          {currentStep > 1 && currentStep !== 2 && currentStep !== 3 && currentStep !== 4 && (
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-4 mt-6 pt-6 border-t border-border">
              <Button variant="outline" onClick={prevStep} className="border-border shrink-0">
                <ChevronLeft className="w-4 h-4 sm:mr-1" />
                Previous
              </Button>
              {currentStep < 4 ? (
                <Button onClick={nextStep} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white shrink-0">
                  Next
                  <ChevronRight className="w-4 h-4 sm:ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={createVisitorMutation.isPending}
                  className="bg-[#3b82f6] hover:bg-[#2563eb] text-white shrink-0"
                >
                  {createVisitorMutation.isPending ? "Submitting…" : "Submit"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
