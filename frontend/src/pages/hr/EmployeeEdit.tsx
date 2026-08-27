import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchStaffById,
  resolveStaffMediaUrl,
  resolveStaffPhotoGallery,
  updateStaff,
  type CreateStaffPayload,
  type StaffRecord,
} from "@/lib/staff-api"
import { ROUTES } from "@/routes/config"
import { StaffStepIndicator } from "@/components/hr/add-staff/staff-step-indicator"
import { AddStaffStep1PersonalInfo } from "@/components/hr/add-staff/step1-personal-info"
import { AddStaffStep2DocumentsUpload, type UploadValue } from "@/components/hr/add-staff/step2-documents-upload"
import { AddStaffStep3LoginAccess } from "@/components/hr/add-staff/step3-login-access"
import { Input } from "@/components/ui/input"
import {
  ingestStaffPhotoFiles,
  primaryStaffPhotoFile,
  newStaffPhotoFiles,
  existingStaffPhotoPaths,
  revokeStaffUploadBlobs,
} from "@/lib/staff-photo-utils"
import { preloadHumanFaceModel } from "@/lib/human-face-validation"
import { useToast } from "@/hooks/use-toast"
import {
  STAFF_BPS_OPTIONS,
  STAFF_DEPARTMENT_OPTIONS,
  STAFF_EMPLOYMENT_TYPE_OPTIONS,
  STAFF_QUALIFICATION_OPTIONS,
  STAFF_ROLE_OPTIONS,
} from "@/lib/staff-form-options"

function uploadValueFromPath(path: string | null | undefined): UploadValue {
  const url = resolveStaffMediaUrl(path)
  if (!url) return { file: null, previewUrl: null }
  const isImage = /\.(jpe?g|png|gif|webp|bmp)$/i.test(url)
  return { file: null, previewUrl: isImage ? url : null }
}

function staffToForm(staff: StaffRecord): CreateStaffPayload {
  return {
    personal_number: staff.personal_number ?? "",
    has_login: Boolean(staff.user_details || staff.user),
    login_username: staff.user_details?.username ?? "",
    password: "",
    email: staff.email ?? "",
    role: staff.role ?? staff.user_details?.role ?? "RECEPTIONIST",
    phone: staff.phone_primary ?? staff.phone ?? "",
    full_name: staff.full_name ?? "",
    father_name: staff.father_name ?? "",
    gender: staff.gender ?? "",
    cnic: staff.cnic ?? staff.national_id ?? "",
    address: staff.address ?? staff.street_address ?? "",
    date_of_birth: staff.date_of_birth ?? "",
    joining_date: staff.joining_date ?? "",
    department: staff.department ?? "",
    designation: staff.designation ?? "",
    employment_type: staff.employment_type ?? "",
    emergency_contact: staff.emergency_contact ?? staff.emergency_contact_phone ?? "",
    emergency_contact_name: staff.emergency_contact_name ?? "",
    emergency_contact_relationship: staff.emergency_contact_relationship ?? "",
    emergency_contact_phone: staff.emergency_contact_phone ?? "",
    emergency_contact_address: staff.emergency_contact_address ?? "",
    bps: staff.bps ?? "",
    qualification: staff.qualification ?? "",
    current_posting: staff.current_posting ?? staff.branch_location ?? "",
    collector_name: staff.collector_name ?? "",
    transferred_from: staff.transferred_from ?? "",
    transferred_to: staff.transferred_to ?? "",
    job_status: staff.job_status ?? "",
    notes: staff.notes ?? "",
    employee_id: staff.employee_id ?? "",
    branch_location: staff.branch_location ?? "",
  }
}

function initialPhotosFromStaff(staff: StaffRecord): UploadValue[] {
  return resolveStaffPhotoGallery(staff).map((previewUrl) => ({
    file: null,
    previewUrl,
  }))
}

export default function EmployeeEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const staffId = id ? parseInt(id, 10) : NaN

  const { data: staff, isLoading, isError } = useQuery({
    queryKey: ["staff", staffId],
    queryFn: () => fetchStaffById(staffId),
    enabled: Number.isInteger(staffId),
  })

  const [form, setForm] = useState<CreateStaffPayload | null>(null)
  const [staffPhotos, setStaffPhotos] = useState<UploadValue[]>([])
  const [cameraOpen, setCameraOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [initialized, setInitialized] = useState(false)

  const [cnicFront, setCnicFront] = useState<UploadValue>({ file: null, previewUrl: null })
  const [cnicBack, setCnicBack] = useState<UploadValue>({ file: null, previewUrl: null })
  const [appointmentLetter, setAppointmentLetter] = useState<UploadValue>({ file: null, previewUrl: null })
  const [additionalDocument, setAdditionalDocument] = useState<UploadValue>({ file: null, previewUrl: null })

  const uploadsRef = useRef({
    staffPhotos,
    cnicFront,
    cnicBack,
    appointmentLetter,
    additionalDocument,
  })
  uploadsRef.current = {
    staffPhotos,
    cnicFront,
    cnicBack,
    appointmentLetter,
    additionalDocument,
  }

  useEffect(() => {
    preloadHumanFaceModel()
  }, [])

  useEffect(() => {
    if (!staff || initialized) return
    setForm(staffToForm(staff))
    setStaffPhotos(initialPhotosFromStaff(staff))
    setCnicFront(uploadValueFromPath(staff.id_proof_file))
    setCnicBack(uploadValueFromPath(staff.certificates_file))
    setAppointmentLetter(uploadValueFromPath(staff.joining_letter_file))
    setAdditionalDocument(uploadValueFromPath(staff.contract_file))
    setInitialized(true)
  }, [staff, initialized])

  useEffect(() => {
    return () => revokeStaffUploadBlobs(uploadsRef.current)
  }, [])

  const updateUploadValue = (
    setter: React.Dispatch<React.SetStateAction<UploadValue>>,
    file: File | null
  ) => {
    setter((prev) => {
      if (prev.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(prev.previewUrl)
      if (!file) return { file: null, previewUrl: null }
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null
      return { file, previewUrl }
    })
  }

  const addPhotos = async (files: File[]) => {
    await ingestStaffPhotoFiles({
      files,
      currentCount: staffPhotos.length,
      setPhotos: setStaffPhotos,
      onValidationError: (message) => {
        toast({
          title: message,
          description: "Use a clear photo with the person's face visible (front or side).",
          variant: "destructive",
        })
      },
    })
  }

  const handleImageCapture = async (file: File) => {
    await addPhotos([file])
    setCameraOpen(false)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"))
    if (files.length) await addPhotos(files)
    e.target.value = ""
  }

  const handleRemovePhotoAt = (index: number) => {
    setStaffPhotos((prev) => {
      const item = prev[index]
      if (item?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  const resetFromStaff = () => {
    if (!staff) return
    setForm(staffToForm(staff))
    setCurrentStep(1)
    setSubmitError(null)
    setStaffPhotos((prev) => {
      for (const p of prev) {
        if (p.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl)
      }
      return initialPhotosFromStaff(staff)
    })
    updateUploadValue(setCnicFront, null)
    updateUploadValue(setCnicBack, null)
    updateUploadValue(setAppointmentLetter, null)
    updateUploadValue(setAdditionalDocument, null)
    setCnicFront(uploadValueFromPath(staff.id_proof_file))
    setCnicBack(uploadValueFromPath(staff.certificates_file))
    setAppointmentLetter(uploadValueFromPath(staff.joining_letter_file))
    setAdditionalDocument(uploadValueFromPath(staff.contract_file))
  }

  const nextStep = () => setCurrentStep((s) => Math.min(3, s + 1))
  const prevStep = () => setCurrentStep((s) => Math.max(1, s - 1))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!Number.isInteger(staffId) || !form) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      const qualification = Array.isArray(form.qualification)
        ? form.qualification.join(", ")
        : form.qualification

      const payload: Partial<CreateStaffPayload> = {
        ...form,
        qualification,
        phone_primary: form.phone,
        street_address: form.address,
        date_of_joining: form.joining_date,
        emergency_contact_phone: form.emergency_contact_phone || form.emergency_contact,
        profile_image: primaryStaffPhotoFile(staffPhotos),
        staff_photos: newStaffPhotoFiles(staffPhotos),
        staff_photos_keep: existingStaffPhotoPaths(staffPhotos),
        cnic_front: cnicFront.file ?? undefined,
        cnic_back: cnicBack.file ?? undefined,
        appointment_letter: appointmentLetter.file ?? undefined,
        additional_document: additionalDocument.file ?? undefined,
      }

      await updateStaff(staffId, payload)
      toast({ title: "Employee updated", description: "Changes have been saved." })
      void queryClient.invalidateQueries({ queryKey: ["staff", staffId] })
      void queryClient.invalidateQueries({ queryKey: ["staff"] })
      navigate(`/employees/${staffId}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to update employee")
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading || !id) {
    return (
      <div className="w-full px-4 sm:px-6 py-8">
        <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">
          {!id ? "Invalid employee" : "Loading…"}
        </div>
      </div>
    )
  }

  if (isError || !staff || !form) {
    return (
      <div className="w-full px-4 sm:px-6 py-8">
        <p className="text-destructive mb-4">Employee not found.</p>
        <Link to={ROUTES.EMPLOYEES} className="text-primary hover:underline">
          Back to Employees
        </Link>
      </div>
    )
  }

  const s = staff as StaffRecord
  const hasExistingLogin = Boolean(s.user_details || s.user)

  return (
    <div className="w-full px-4">
      <nav className="text-base text-muted-foreground mb-6 flex flex-wrap items-center gap-x-2 gap-y-1" aria-label="Breadcrumb">
        <Link to={ROUTES.DASHBOARD} className="hover:text-foreground transition-colors">Home</Link>
        <span aria-hidden className="text-muted-foreground/70">/</span>
        <span className="text-muted-foreground">HR</span>
        <span aria-hidden className="text-muted-foreground/70">/</span>
        <Link to={ROUTES.EMPLOYEES} className="hover:text-foreground transition-colors">Employees</Link>
        <span aria-hidden className="text-muted-foreground/70">/</span>
        <Link to={`/employees/${s.id}`} className="hover:text-foreground transition-colors">
          {s.full_name ?? "Employee"}
        </Link>
        <span aria-hidden className="text-muted-foreground/70">/</span>
        <span className="text-[#3b82f6] font-medium" aria-current="page">
          Edit
        </span>
      </nav>

      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">Edit Employee</h1>
        <p className="text-base text-muted-foreground mt-1">
          Update employee details, photos, and documents.
        </p>
      </div>

      <StaffStepIndicator currentStep={currentStep} />

      <form id="edit-staff-form" onSubmit={handleSave} className="mt-6">
        <Input
          id="profile_image"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageUpload}
        />
        {submitError && (
          <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-md text-sm mb-6">
            {submitError}
          </div>
        )}

        <div className="bg-card rounded-xl border border-border shadow-sm p-4 sm:p-6 mt-6">
          {currentStep === 1 && (
            <AddStaffStep1PersonalInfo
              employeeCategory="existing"
              onEmployeeCategoryChange={() => {}}
              form={form}
              updateForm={(patch) => setForm((f) => (f ? { ...f, ...patch } : f))}
              staffPhotos={staffPhotos}
              cameraOpen={cameraOpen}
              onOpenCamera={() => setCameraOpen(true)}
              onCaptureFromCamera={handleImageCapture}
              onCloseCamera={() => setCameraOpen(false)}
              onUploadPhotoClick={() => document.getElementById("profile_image")?.click()}
              onRemovePhoto={handleRemovePhotoAt}
              onCancel={() => navigate(`/employees/${s.id}`)}
              onReset={resetFromStaff}
              onSaveAndContinue={nextStep}
              roleOptions={STAFF_ROLE_OPTIONS}
              departmentOptions={STAFF_DEPARTMENT_OPTIONS}
              employmentTypeOptions={STAFF_EMPLOYMENT_TYPE_OPTIONS}
              bpsOptions={STAFF_BPS_OPTIONS}
              qualificationOptions={STAFF_QUALIFICATION_OPTIONS}
            />
          )}

          {currentStep === 2 && (
            <AddStaffStep2DocumentsUpload
              cnicFront={cnicFront}
              cnicBack={cnicBack}
              appointmentLetter={appointmentLetter}
              additionalDocument={additionalDocument}
              onPickCnicFront={(file) => updateUploadValue(setCnicFront, file)}
              onPickCnicBack={(file) => updateUploadValue(setCnicBack, file)}
              onPickAppointmentLetter={(file) => updateUploadValue(setAppointmentLetter, file)}
              onPickAdditionalDocument={(file) => updateUploadValue(setAdditionalDocument, file)}
              onRemoveCnicFront={() => updateUploadValue(setCnicFront, null)}
              onRemoveCnicBack={() => updateUploadValue(setCnicBack, null)}
              onRemoveAppointmentLetter={() => updateUploadValue(setAppointmentLetter, null)}
              onRemoveAdditionalDocument={() => updateUploadValue(setAdditionalDocument, null)}
              onCancel={() => navigate(`/employees/${s.id}`)}
              onReset={resetFromStaff}
              onPrevious={prevStep}
              onSaveAndContinue={nextStep}
            />
          )}

          {currentStep === 3 && (
            <AddStaffStep3LoginAccess
              form={form}
              updateForm={(patch) => setForm((f) => (f ? { ...f, ...patch } : f))}
              onCancel={() => navigate(`/employees/${s.id}`)}
              onReset={resetFromStaff}
              onPrevious={prevStep}
              onFinish={() => {
                const formEl = document.getElementById("edit-staff-form") as HTMLFormElement | null
                formEl?.requestSubmit()
              }}
              submitting={submitting}
              mode="edit"
              hasExistingLogin={hasExistingLogin}
            />
          )}
        </div>
      </form>
    </div>
  )
}
