import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { createStaff, type CreateStaffPayload } from "@/lib/staff-api"
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

const emptyForm: CreateStaffPayload = {
  personal_number: "",
  has_login: false,
  login_username: "",
  password: "",
  email: "",
  role: "RECEPTIONIST",
  phone: "",
  full_name: "",
  father_name: "",
  gender: "",
  cnic: "",
  address: "",
  date_of_birth: "",
  joining_date: new Date().toISOString().slice(0, 10),
  department: "",
  designation: "",
  employment_type: "",
  emergency_contact: "",
  emergency_contact_name: "",
  emergency_contact_relationship: "",
  emergency_contact_phone: "",
  emergency_contact_address: "",
  bps: "",
  qualification: "",
  current_posting: "",
  collector_name: "",
}

type StoredFile = {
  name: string
  type: string
  dataUrl: string
}

type AddStaffDraft = {
  v: 1
  savedAt: string
  employeeCategory: "new" | "existing"
  currentStep: number
  form: CreateStaffPayload
  staffPhotos: (StoredFile | null)[]
  cnicFront: StoredFile | null
  cnicBack: StoredFile | null
  appointmentLetter: StoredFile | null
  additionalDocument: StoredFile | null
}

const ADD_STAFF_DRAFT_KEY = "tekeye.hr.addStaff.draft.v1"

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

async function toStoredFile(file: File, opts?: { maxBytes?: number }): Promise<StoredFile | null> {
  const maxBytes = opts?.maxBytes ?? 1_800_000 // ~1.8MB per file to avoid blowing localStorage
  if (file.size > maxBytes) return null
  const dataUrl = await readFileAsDataUrl(file)
  return { name: file.name, type: file.type || "application/octet-stream", dataUrl }
}

async function storedFileToFile(stored: StoredFile): Promise<File> {
  const res = await fetch(stored.dataUrl)
  const blob = await res.blob()
  return new File([blob], stored.name, { type: stored.type || blob.type })
}

export default function AddStaffPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState<CreateStaffPayload>(emptyForm)
  const [staffPhotos, setStaffPhotos] = useState<UploadValue[]>([])
  const [cameraOpen, setCameraOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [employeeCategory, setEmployeeCategory] = useState<"new" | "existing">("new")
  const [currentStep, setCurrentStep] = useState(1)

  const [cnicFront, setCnicFront] = useState<UploadValue>({ file: null, previewUrl: null })
  const [cnicBack, setCnicBack] = useState<UploadValue>({ file: null, previewUrl: null })
  const [appointmentLetter, setAppointmentLetter] = useState<UploadValue>({ file: null, previewUrl: null })
  const [additionalDocument, setAdditionalDocument] = useState<UploadValue>({ file: null, previewUrl: null })

  const savingDraftRef = useRef(false)
  const lastSavedDraftJsonRef = useRef<string>("")
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
  const draftSnapshot = useMemo(() => {
    return {
      employeeCategory,
      currentStep,
      form,
      staffPhotos: staffPhotos.map((p) => p.file),
      cnicFront: cnicFront.file,
      cnicBack: cnicBack.file,
      appointmentLetter: appointmentLetter.file,
      additionalDocument: additionalDocument.file,
    }
  }, [
    employeeCategory,
    currentStep,
    form,
    staffPhotos,
    cnicFront.file,
    cnicBack.file,
    appointmentLetter.file,
    additionalDocument.file,
  ])

  // Restore draft (localStorage) on mount.
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const raw = localStorage.getItem(ADD_STAFF_DRAFT_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw) as AddStaffDraft
        if (!parsed || parsed.v !== 1) return
        if (cancelled) return

        setEmployeeCategory(parsed.employeeCategory ?? "new")
        setCurrentStep(typeof parsed.currentStep === "number" ? parsed.currentStep : 1)
        setForm((prev) => ({ ...prev, ...(parsed.form ?? {}) }))

        const restoredPhotos: UploadValue[] = []
        for (const item of parsed.staffPhotos ?? []) {
          if (!item) continue
          try {
            const file = await storedFileToFile(item)
            if (cancelled) return
            restoredPhotos.push({ file, previewUrl: URL.createObjectURL(file) })
          } catch {
            // ignore corrupted draft items
          }
        }
        if (!cancelled) setStaffPhotos(restoredPhotos)

        const restoreSingle = async (
          stored: StoredFile | null | undefined,
          setter: React.Dispatch<React.SetStateAction<UploadValue>>
        ) => {
          if (!stored) return
          try {
            const file = await storedFileToFile(stored)
            if (cancelled) return
            const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null
            setter({ file, previewUrl })
          } catch {
            // ignore
          }
        }

        await restoreSingle(parsed.cnicFront, setCnicFront)
        await restoreSingle(parsed.cnicBack, setCnicBack)
        await restoreSingle(parsed.appointmentLetter, setAppointmentLetter)
        await restoreSingle(parsed.additionalDocument, setAdditionalDocument)
      } catch {
        // ignore invalid draft
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  // Auto-save draft to localStorage (debounced).
  useEffect(() => {
    if (savingDraftRef.current) return
    const t = window.setTimeout(() => {
      const save = async () => {
        if (savingDraftRef.current) return
        savingDraftRef.current = true
        try {
          const staffPhotoStored = await Promise.all(
            (draftSnapshot.staffPhotos ?? []).slice(0, 5).map(async (f) => {
              if (!f) return null
              try {
                return await toStoredFile(f)
              } catch {
                return null
              }
            })
          )

          const draft: AddStaffDraft = {
            v: 1,
            savedAt: new Date().toISOString(),
            employeeCategory: draftSnapshot.employeeCategory,
            currentStep: draftSnapshot.currentStep,
            form: draftSnapshot.form,
            staffPhotos: staffPhotoStored,
            cnicFront: draftSnapshot.cnicFront ? await toStoredFile(draftSnapshot.cnicFront) : null,
            cnicBack: draftSnapshot.cnicBack ? await toStoredFile(draftSnapshot.cnicBack) : null,
            appointmentLetter: draftSnapshot.appointmentLetter ? await toStoredFile(draftSnapshot.appointmentLetter) : null,
            additionalDocument: draftSnapshot.additionalDocument ? await toStoredFile(draftSnapshot.additionalDocument) : null,
          }

          const json = JSON.stringify(draft)
          if (json !== lastSavedDraftJsonRef.current) {
            localStorage.setItem(ADD_STAFF_DRAFT_KEY, json)
            lastSavedDraftJsonRef.current = json
          }
        } catch {
          // ignore quota / serialization errors
        } finally {
          savingDraftRef.current = false
        }
      }
      void save()
    }, 350)

    return () => window.clearTimeout(t)
  }, [draftSnapshot])

  useEffect(() => {
    return () => revokeStaffUploadBlobs(uploadsRef.current)
  }, [])

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

  const nextStep = () => setCurrentStep((s) => Math.min(3, s + 1))
  const prevStep = () => setCurrentStep((s) => Math.max(1, s - 1))

  const resetAll = () => {
    setForm(emptyForm)
    setEmployeeCategory("new")
    setCurrentStep(1)
    setSubmitError(null)
    try {
      localStorage.removeItem(ADD_STAFF_DRAFT_KEY)
    } catch {
      // ignore
    }
    setStaffPhotos((prev) => {
      for (const p of prev) {
        if (p.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl)
      }
      return []
    })
    updateUploadValue(setCnicFront, null)
    updateUploadValue(setCnicBack, null)
    updateUploadValue(setAppointmentLetter, null)
    updateUploadValue(setAdditionalDocument, null)
  }

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setSubmitting(true)
    try {
      // Create a clean payload that only includes login info if has_login is true
      // Also map field names to match backend StaffCreateSerializer expectations
      const nameParts = (form.full_name || "").trim().split(/\s+/)
      const first_name = nameParts[0] || ""
      const last_name = nameParts.slice(1).join(" ") || ""

      const payload: any = {
        ...form,
        first_name,
        last_name,
        national_id: form.cnic,
        street_address: form.address,
        date_of_joining: form.joining_date,
        emergency_contact_phone: form.emergency_contact_phone || form.emergency_contact,
        emergency_contact_name: form.emergency_contact_name || (form.full_name ? `${form.full_name} Contact` : ""),
        emergency_contact_relationship: form.emergency_contact_relationship,
        emergency_contact_address: form.emergency_contact_address,
        profile_image: primaryStaffPhotoFile(staffPhotos),
        staff_photos: newStaffPhotoFiles(staffPhotos),
        staff_photos_keep: existingStaffPhotoPaths(staffPhotos),
        cnic_front: cnicFront.file ?? undefined,
        cnic_back: cnicBack.file ?? undefined,
        appointment_letter: appointmentLetter.file ?? undefined,
        additional_document: additionalDocument.file ?? undefined,
      }

      if (!form.has_login) {
        delete payload.login_username
        delete payload.username
        delete payload.password
      } else {
        payload.login_username = form.login_username || form.username
        payload.username = payload.login_username
      }

      await createStaff(payload as CreateStaffPayload)
      try {
        localStorage.removeItem(ADD_STAFF_DRAFT_KEY)
      } catch {
        // ignore
      }
      void queryClient.invalidateQueries({ queryKey: ["staff"] })
      navigate(ROUTES.EMPLOYEES)
      return
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to add staff")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full px-4">
      <nav className="text-base text-muted-foreground mb-6 flex flex-wrap items-center gap-x-2 gap-y-1" aria-label="Breadcrumb">
        <Link to={ROUTES.DASHBOARD} className="hover:text-foreground transition-colors">Home</Link>
        <span aria-hidden className="text-muted-foreground/70">/</span>
        <span className="text-muted-foreground">HR</span>
        <span aria-hidden className="text-muted-foreground/70">/</span>
        <Link to={ROUTES.EMPLOYEES} className="hover:text-foreground transition-colors">Employees</Link>
        <span aria-hidden className="text-muted-foreground/70">/</span>
        <span className="text-[#3b82f6] font-medium" aria-current="page">
          Add Staff
        </span>
      </nav>
        <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">Add Staff</h1>
        <p className="text-base text-muted-foreground mt-1">
          Add a new employee record.
        </p>
        </div>

      <StaffStepIndicator currentStep={currentStep} />

      <form id="add-staff-form" onSubmit={handleAddStaff} className="mt-6">
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
              employeeCategory={employeeCategory}
              onEmployeeCategoryChange={setEmployeeCategory}
              form={form}
              updateForm={(patch) => setForm((f) => ({ ...f, ...patch }))}
              staffPhotos={staffPhotos}
              cameraOpen={cameraOpen}
              onOpenCamera={() => setCameraOpen(true)}
              onCaptureFromCamera={handleImageCapture}
              onCloseCamera={() => setCameraOpen(false)}
              onUploadPhotoClick={() => document.getElementById("profile_image")?.click()}
              onRemovePhoto={handleRemovePhotoAt}
              onCancel={() => navigate(ROUTES.EMPLOYEES)}
              onReset={resetAll}
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
              onCancel={() => navigate(ROUTES.EMPLOYEES)}
              onReset={resetAll}
              onPrevious={prevStep}
              onSaveAndContinue={nextStep}
            />
          )}

          {currentStep === 3 && (
            <AddStaffStep3LoginAccess
              form={form}
              updateForm={(patch) => setForm((f) => ({ ...f, ...patch }))}
              onCancel={() => navigate(ROUTES.EMPLOYEES)}
              onReset={resetAll}
              onPrevious={prevStep}
              onFinish={() => {
                const formEl = document.getElementById("add-staff-form") as HTMLFormElement | null
                formEl?.requestSubmit()
              }}
              submitting={submitting}
            />
          )}
              </div>

            </form>
      </div>
  )
}
