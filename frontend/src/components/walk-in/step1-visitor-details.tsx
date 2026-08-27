"use client"

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useState, useRef, useEffect, useCallback } from "react"
import { User, Briefcase, Wrench, Search, Check, Camera, X, Plus, Users } from "lucide-react"
import { GroupMembersSection } from "@/components/walk-in/group-members-section"
import {
  MIN_GROUP_PARTY_SIZE,
  resizeGroupMembers,
  validateGroupVisit,
  type GroupVisitMember,
} from "@/components/walk-in/group-member"
import { Button } from "@/components/ui/button"
import CongratulationsModal from "@/components/visitor/CongratulationsModal"
import { cn, getCameraErrorMessage, requestUserMedia } from "@/lib/utils"
import { useFormik } from "formik"
import * as Yup from "yup"
import { isCnicExists } from "@/lib/visitor-api"
import { validateHumanFaceImage, NOT_HUMAN_PICTURE_MESSAGE, preloadHumanFaceModel } from "@/lib/human-face-validation"
import { useToast } from "@/hooks/use-toast"


const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024 // 2MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/jpg", "image/png"]
const MAX_VISITOR_PHOTOS = 5
const MAX_VEHICLE_PHOTOS = 5
const MAX_MINOR_PHOTOS = 5

export type VisitAttendanceMode = "individual" | "group"

export interface WalkInStep1VisitorDetailsFormData {
  visitorCategory: string
  visitorSearch: string
  /** Individual visitor or group sharing one QR code */
  visitMode: VisitAttendanceMode
  groupPartySize: number
  groupMembers: GroupVisitMember[]
  visitorType: string
  fullName: string
  gender: string
  cnicNumber: string
  passportNumber: string
  nationality: string
  dateOfBirth: string
  mobileNumber: string
  emailAddress: string
  residentialAddress: string
  organizationName: string
  organizationType: string
  ntnRegistrationNo: string
  designation: string
  officeAddress: string
  vehicleType: string
  vehicleNumber: string
  vehicleRegistrationNo: string
  licenseNo: string
  licenseIssueDate: string
  licenseExpiryDate: string
  /** Up to 5 vehicle images (same UI as visitor photograph upload) */
  vehicleImages?: string[]
  /** Up to 5 visitor images for detection/recognition (displayed on the right of capture box) */
  visitorPhotos: string[]
  /** Kept for payload: first of visitorPhotos or legacy single capture */
  photoCapture?: string
  /** Minors accompanying the visitor */
  visitorMinors: {
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
    /** Up to 5 captured/uploaded photographs of the minor */
    photos?: string[]
  }[]
}

interface WalkInStep1VisitorDetailsProps {
  formData: WalkInStep1VisitorDetailsFormData
  updateFormData: (data: Partial<WalkInStep1VisitorDetailsFormData>) => void
  onCancel?: () => void
  onReset?: () => void
  onSaveAndContinue?: () => void
  onSaveToDraft?: () => void
}

const defaultMinor = (): WalkInStep1VisitorDetailsFormData["visitorMinors"][number] => ({
  name: "",
  relation: "",
  gender: "",
  cnicOrBForm: "",
  passportNumber: "",
  nationality: "",
  dateOfBirth: "",
  mobileNumber: "",
  emailAddress: "",
  residentialAddress: "",
  photos: [],
})

type VisitorKind = "company-rep" | "contractor" | "individual" | "group"

const visitorKindOptions = [
  {
    value: "company-rep" as const,
    label: "Company Rep.",
    description: "Business meeting or official",
    icon: Briefcase,
  },
  {
    value: "contractor" as const,
    label: "Contractor",
    description: "Maintenance or service",
    icon: Wrench,
  },
  {
    value: "individual" as const,
    label: "Individual",
    description: "Personal visit or guest · one pass",
    icon: User,
  },
  {
    value: "group" as const,
    label: "Group visit",
    description: "Multiple people, one shared QR",
    icon: Users,
  },
] as const

function getVisitorKind(formData: WalkInStep1VisitorDetailsFormData): VisitorKind {
  if (formData.visitMode === "group") return "group"
  if (formData.visitorType === "company-rep") return "company-rep"
  if (formData.visitorType === "contractor") return "contractor"
  return "individual"
}

function visitorKindPatch(
  kind: VisitorKind,
  formData: WalkInStep1VisitorDetailsFormData
): Partial<WalkInStep1VisitorDetailsFormData> {
  if (kind === "group") {
    const size =
      formData.groupPartySize >= MIN_GROUP_PARTY_SIZE
        ? formData.groupPartySize
        : MIN_GROUP_PARTY_SIZE
    return {
      visitMode: "group",
      groupPartySize: size,
      groupMembers: resizeGroupMembers(formData.groupMembers ?? [], size),
    }
  }
  return {
    visitMode: "individual",
    groupMembers: [],
    visitorType: kind === "individual" ? "individual" : kind,
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

export function WalkInStep1VisitorDetails({
  formData,
  updateFormData,
  onCancel,
  onReset,
  onSaveAndContinue,
  onSaveToDraft,
}: WalkInStep1VisitorDetailsProps) {
  const { toast } = useToast()
  const photoInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoValidating, setPhotoValidating] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraLoading, setCameraLoading] = useState(false)
  const vehicleImageInputRef = useRef<HTMLInputElement>(null)
  const vehicleVideoRef = useRef<HTMLVideoElement>(null)
  const vehicleCanvasRef = useRef<HTMLCanvasElement>(null)
  const vehicleStreamRef = useRef<MediaStream | null>(null)
  const [vehicleCameraOpen, setVehicleCameraOpen] = useState(false)
  const [vehicleCameraError, setVehicleCameraError] = useState<string | null>(null)
  const [vehicleCameraLoading, setVehicleCameraLoading] = useState(false)
  const [vehiclePhotoError, setVehiclePhotoError] = useState<string | null>(null)
  const minorImageInputRef = useRef<HTMLInputElement>(null)
  const minorVideoRef = useRef<HTMLVideoElement>(null)
  const minorCanvasRef = useRef<HTMLCanvasElement>(null)
  const minorStreamRef = useRef<MediaStream | null>(null)
  const [minorCameraOpen, setMinorCameraOpen] = useState<number | null>(null)
  const [minorCameraError, setMinorCameraError] = useState<string | null>(null)
  const [minorCameraLoading, setMinorCameraLoading] = useState(false)
  const [minorPhotoError, setMinorPhotoError] = useState<string | null>(null)
  const [minorPhotoValidating, setMinorPhotoValidating] = useState(false)
  const [minorUploadTarget, setMinorUploadTarget] = useState<number | null>(null)
  const [showCongratsModal, setShowCongratsModal] = useState(false)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (!cameraOpen) {
      stopCamera()
      return
    }
    preloadHumanFaceModel()
    setCameraError(null)
    setCameraLoading(true)
    requestUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setCameraError(null)
      })
      .catch((err) => {
        setCameraError(getCameraErrorMessage(err))
      })
      .finally(() => setCameraLoading(false))
    return () => {
      stopCamera()
    }
  }, [cameraOpen, stopCamera])

  const stopVehicleCamera = useCallback(() => {
    vehicleStreamRef.current?.getTracks().forEach((t) => t.stop())
    vehicleStreamRef.current = null
  }, [])

  useEffect(() => {
    if (!vehicleCameraOpen) {
      stopVehicleCamera()
      return
    }
    setVehicleCameraError(null)
    setVehicleCameraLoading(true)
    requestUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        vehicleStreamRef.current = stream
        if (vehicleVideoRef.current) vehicleVideoRef.current.srcObject = stream
        setVehicleCameraError(null)
      })
      .catch((err) => {
        setVehicleCameraError(getCameraErrorMessage(err))
      })
      .finally(() => setVehicleCameraLoading(false))
    return () => {
      stopVehicleCamera()
    }
  }, [vehicleCameraOpen, stopVehicleCamera])

  const stopMinorCamera = useCallback(() => {
    minorStreamRef.current?.getTracks().forEach((t) => t.stop())
    minorStreamRef.current = null
  }, [])

  useEffect(() => {
    if (minorCameraOpen === null) {
      stopMinorCamera()
      return
    }
    setMinorCameraError(null)
    setMinorCameraLoading(true)
    requestUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        minorStreamRef.current = stream
        if (minorVideoRef.current) minorVideoRef.current.srcObject = stream
        setMinorCameraError(null)
      })
      .catch((err) => {
        setMinorCameraError(getCameraErrorMessage(err))
      })
      .finally(() => setMinorCameraLoading(false))
    return () => {
      stopMinorCamera()
    }
  }, [minorCameraOpen, stopMinorCamera])

  const visitorPhotos = Array.isArray(formData.visitorPhotos) ? formData.visitorPhotos : []
  const vehiclePhotos = Array.isArray(formData.vehicleImages) ? formData.vehicleImages : []

  const addPhoto = (dataUrl: string) => {
    if (visitorPhotos.length >= MAX_VISITOR_PHOTOS) return
    updateFormData({ visitorPhotos: [...visitorPhotos, dataUrl], photoCapture: dataUrl })
  }

  const rejectHumanPhoto = (message: string) => {
    setPhotoError(message)
    toast({
      title: NOT_HUMAN_PICTURE_MESSAGE,
      description: "Only clear photos of a person's face are allowed.",
      variant: "destructive",
    })
  }

  const rejectMinorHumanPhoto = (message: string) => {
    setMinorPhotoError(message)
    toast({
      title: NOT_HUMAN_PICTURE_MESSAGE,
      description: "Only clear photos of a person's face are allowed.",
      variant: "destructive",
    })
  }

  const tryAddVisitorPhoto = async (dataUrl: string): Promise<boolean> => {
    if (visitorPhotos.length >= MAX_VISITOR_PHOTOS) return false
    setPhotoError(null)
    setPhotoValidating(true)
    try {
      const result = await validateHumanFaceImage(dataUrl)
      if (!result.ok) {
        rejectHumanPhoto(result.message)
        return false
      }
      addPhoto(dataUrl)
      return true
    } catch {
      rejectHumanPhoto(NOT_HUMAN_PICTURE_MESSAGE)
      return false
    } finally {
      setPhotoValidating(false)
    }
  }

  const tryAddMinorPhoto = async (minorIndex: number, dataUrl: string): Promise<boolean> => {
    const next = [...(formData.visitorMinors ?? [])]
    const minor = { ...defaultMinor(), ...next[minorIndex] }
    const photos = Array.isArray(minor.photos) ? minor.photos : []
    if (photos.length >= MAX_MINOR_PHOTOS) return false

    setMinorPhotoError(null)
    setMinorPhotoValidating(true)
    try {
      const result = await validateHumanFaceImage(dataUrl)
      if (!result.ok) {
        rejectMinorHumanPhoto(result.message)
        return false
      }
      next[minorIndex] = { ...minor, photos: [...photos, dataUrl] }
      updateFormData({ visitorMinors: next })
      return true
    } catch {
      rejectMinorHumanPhoto(NOT_HUMAN_PICTURE_MESSAGE)
      return false
    } finally {
      setMinorPhotoValidating(false)
    }
  }

  const removePhoto = (index: number) => {
    const next = visitorPhotos.filter((_, i) => i !== index)
    updateFormData({
      visitorPhotos: next,
      photoCapture: next[0],
    })
  }

  const captureFromCamera = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !streamRef.current || !canvas) return
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) {
      setCameraError("Camera not ready. Wait a moment and try again.")
      return
    }
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    canvas.width = w
    canvas.height = h
    ctx.drawImage(video, 0, 0, w, h)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92)
    const accepted = await tryAddVisitorPhoto(dataUrl)
    if (accepted) {
      setCameraOpen(false)
      stopCamera()
    }
  }

  const addVehiclePhoto = (dataUrl: string) => {
    if (vehiclePhotos.length >= MAX_VEHICLE_PHOTOS) return
    updateFormData({ vehicleImages: [...vehiclePhotos, dataUrl] })
  }

  const removeVehiclePhoto = (index: number) => {
    const next = vehiclePhotos.filter((_, i) => i !== index)
    updateFormData({ vehicleImages: next })
  }

  const captureVehicleFromCamera = () => {
    const video = vehicleVideoRef.current
    const canvas = vehicleCanvasRef.current
    if (!video || !vehicleStreamRef.current || !canvas) return
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) {
      setVehicleCameraError("Camera not ready. Wait a moment and try again.")
      return
    }
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    canvas.width = w
    canvas.height = h
    ctx.drawImage(video, 0, 0, w, h)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92)
    addVehiclePhoto(dataUrl)
    setVehicleCameraOpen(false)
    stopVehicleCamera()
  }

  const handleVehiclePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setVehiclePhotoError(null)
    if (!file) return
    if (vehiclePhotos.length >= MAX_VEHICLE_PHOTOS) {
      setVehiclePhotoError(`Maximum ${MAX_VEHICLE_PHOTOS} images.`)
      return
    }
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setVehiclePhotoError("Format must be JPG or PNG.")
      return
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setVehiclePhotoError("Image size must be max 2MB.")
      return
    }
    readFileAsDataUrl(file).then((dataUrl) => {
      addVehiclePhoto(dataUrl)
    }).catch(() => setVehiclePhotoError("Failed to read file."))
    e.target.value = ""
  }

  const captureFromMinorCamera = async () => {
    const index = minorCameraOpen
    if (index === null) return
    const video = minorVideoRef.current
    const canvas = minorCanvasRef.current
    if (!video || !minorStreamRef.current || !canvas) return
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) {
      setMinorCameraError("Camera not ready. Wait a moment and try again.")
      return
    }
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    canvas.width = w
    canvas.height = h
    ctx.drawImage(video, 0, 0, w, h)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92)
    const accepted = await tryAddMinorPhoto(index, dataUrl)
    if (accepted) {
      setMinorCameraOpen(null)
      stopMinorCamera()
    }
  }

  const handleMinorPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = minorUploadTarget
    setMinorPhotoError(null)
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || index === null) {
      setMinorUploadTarget(null)
      return
    }
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setMinorPhotoError("Format must be JPG or PNG.")
      return
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setMinorPhotoError("Image size must be max 2MB.")
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      await tryAddMinorPhoto(index, dataUrl)
    } catch {
      setMinorPhotoError("Failed to read file.")
    } finally {
      setMinorUploadTarget(null)
    }
  }

  const removeMinorPhoto = (minorIndex: number, photoIndex: number) => {
    const next = [...(formData.visitorMinors ?? [])]
    const minor = { ...defaultMinor(), ...next[minorIndex] }
    const photos = Array.isArray(minor.photos) ? minor.photos : []
    const newPhotos = photos.filter((_, i) => i !== photoIndex)
    next[minorIndex] = { ...minor, photos: newPhotos }
    updateFormData({ visitorMinors: next })
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setPhotoError(null)
    if (!file) return
    if (visitorPhotos.length >= MAX_VISITOR_PHOTOS) {
      setPhotoError(`Maximum ${MAX_VISITOR_PHOTOS} images.`)
      return
    }
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoError("Format must be JPG or PNG.")
      return
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoError("Image size must be max 2MB.")
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      await tryAddVisitorPhoto(dataUrl)
    } catch {
      setPhotoError("Failed to read image.")
    }
    e.target.value = ""
  }

  const formik = useFormik({
    initialValues: {
      fullName: formData.fullName || "",
      mobileNumber: formData.mobileNumber || "",
      cnicNumber: formData.cnicNumber || "",
      passportNumber: formData.passportNumber || "",
    },
    enableReinitialize: true,
    validateOnChange: false,
    validateOnBlur: true,
    validationSchema: Yup.object()
      .shape({
        fullName: Yup.string().trim().required("Full name is required"),
        mobileNumber: Yup.string().trim().required("Mobile number is required"),
        cnicNumber: Yup.string()
          .trim()
          .required("CNIC number is required")
          .test(
            "cnic-unique",
            "This CNIC is already registered",
            async function (val) {
              if (!val) return true // allow empty (will be caught by required)
              const cnic = val.trim()
              const original = formData.cnicNumber || ""
              // Only check uniqueness if CNIC changed
              if (cnic === original) return true
              // Debounce: small delay to avoid hammering API
              await new Promise((r) => setTimeout(r, 300))
              // Check against backend
              try {
                const exists = await isCnicExists(cnic)
                return !exists
              } catch {
                return true // Allow on error
              }
            }
          ),
        passportNumber: Yup.string().trim(),
      })
      .test(
        "cnic-required",
        "CNIC number is required",
        function (obj) {
          const v = obj as any
          const cnic = (v?.cnicNumber || "").toString().trim()
          return Boolean(cnic)
        }
      ),
    onSubmit: (values) => {
      updateFormData({
        fullName: values.fullName,
        mobileNumber: values.mobileNumber,
        cnicNumber: values.cnicNumber,
        passportNumber: values.passportNumber,
      })
      if (!visitorPhotos.length) {
        toast({
          title: "Photograph required",
          description: "Capture or upload a photograph of the visitor.",
          variant: "destructive",
        })
        return
      }
      if (formData.visitMode === "group") {
        const groupErr = validateGroupVisit(
          formData.groupPartySize,
          formData.groupMembers ?? [],
          visitorPhotos
        )
        if (groupErr) {
          toast({
            title: "Group visit incomplete",
            description: groupErr,
            variant: "destructive",
          })
          return
        }
      }
      setShowCongratsModal(true)
    },
  })
  return (
    <div className="space-y-8">
      {/* Visitor Category */}
      <div className="space-y-4">
        <Label className="text-[22px] font-bold text-foreground">Visitor Category</Label>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <RadioGroup
            value={formData.visitorCategory}
            onValueChange={(value) => updateFormData({ visitorCategory: value })}
            className="flex flex-row gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="new" id="cat-new" />
              <Label htmlFor="cat-new" className="text-base font-normal cursor-pointer">New Visitor</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="registered" id="cat-registered" />
              <Label htmlFor="cat-registered" className="text-base font-normal cursor-pointer">Registered Visitor</Label>
            </div>
          </RadioGroup>
          {formData.visitorCategory === "registered" && (
            <div className="relative flex-1 max-w-sm sm:ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search visitors, pass IDs..."
                value={formData.visitorSearch}
                onChange={(e) => updateFormData({ visitorSearch: e.target.value })}
                className="pl-9 h-10 text-base bg-background border-border"
              />
            </div>
          )}
        </div>
      </div>

      {/* Visitor Type — one selection only */}
      <div className="space-y-4">
        <Label className="text-[22px] font-bold text-foreground">Visitor Type</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visitorKindOptions.map(({ value, label, description, icon: Icon }) => {
            const selectedKind = getVisitorKind(formData)
            const isSelected = selectedKind === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => updateFormData(visitorKindPatch(value, formData))}
                className={cn(
                  "relative flex items-center gap-4 p-4 rounded-lg border text-left transition-colors",
                  isSelected
                    ? "border-2 border-[#3b82f6] bg-[#eff6ff]"
                    : "border border-border bg-card hover:border-muted-foreground/40"
                )}
              >
                {isSelected && (
                  <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#3b82f6]">
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  </span>
                )}
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    isSelected ? "bg-[#3b82f6] text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5 pr-6">
                  <span className="text-base font-semibold text-foreground">{label}</span>
                  <span className="text-sm text-muted-foreground">{description}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Personal Details */}
      <div className="space-y-4">
        <Label className="text-[22px] font-bold text-foreground">
          {formData.visitMode === "group" ? "Group leader (primary visitor)" : "Personal Details"}
        </Label>

        {/* Photograph Upload – capture from camera; captured images on the right for recognition */}
        <div className="space-y-2">
          <Label className="text-base font-medium text-foreground">
            {formData.visitMode === "group" ? "Leader photograph" : "Photograph Upload"}
          </Label>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* Left: capture box */}
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-muted/20 py-6 px-3 transition-colors min-w-0 shrink-0",
                "border-muted-foreground/30 hover:border-primary/40 hover:bg-muted/30 max-w-[280px]"
              )}
            >
              {!cameraOpen ? (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Camera className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground text-center">Upload a Visitor Photograph</p>
                  <p className="text-xs text-muted-foreground text-center">
                    Image size: Max 2MB, JPG/PNG. Up to {MAX_VISITOR_PHOTOS} photos — human face required.
                  </p>
                  <div className="flex flex-col gap-2 w-full">
                    <Button
                      type="button"
                      onClick={() => { setVehicleCameraOpen(false); setMinorCameraOpen(null); setCameraOpen(true); }}
                      disabled={cameraLoading || photoValidating || visitorPhotos.length >= MAX_VISITOR_PHOTOS}
                      className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 w-full"
                    >
                      {cameraLoading ? "Opening camera…" : "Capture from camera"}
                    </Button>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      className="sr-only"
                      onChange={handlePhotoUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={photoValidating || visitorPhotos.length >= MAX_VISITOR_PHOTOS}
                      className="rounded-md px-4 py-2 text-sm font-medium w-full"
                    >
                      {photoValidating ? "Checking photo…" : "Upload Photo"}
                    </Button>
                  </div>
                  {photoValidating && (
                    <p className="text-xs text-muted-foreground text-center">Detecting human face…</p>
                  )}
                  {photoError && (
                    <p className="text-sm text-destructive text-center">{photoError}</p>
                  )}
                </>
              ) : (
                <div className="w-full space-y-2">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full max-h-40 rounded-md bg-muted object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  {cameraError && (
                    <p className="text-sm text-destructive text-center">{cameraError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => void captureFromCamera()}
                      disabled={cameraLoading || photoValidating || !!cameraError || visitorPhotos.length >= MAX_VISITOR_PHOTOS}
                      className="flex-1 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      {photoValidating ? "Checking…" : "Take photo"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setCameraOpen(false); setCameraError(null); stopCamera(); }}
                      className="rounded-md py-2 text-sm font-medium"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: captured images for recognition (up to 5) – uniform box size, scroll on small screens */}
            <div className="flex flex-col gap-3 min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Captured images</p>
              <div className="overflow-x-auto overflow-y-hidden">
                <div className="grid grid-cols-5 gap-3 min-w-[calc(12rem*5+0.75rem*4)] w-max">
                {Array.from({ length: MAX_VISITOR_PHOTOS }, (_, i) => (
                  <div key={i} className="relative h-[14.5rem] w-48 shrink-0">
                    {visitorPhotos[i] ? (
                      <>
                        <img
                          src={visitorPhotos[i]}
                          alt={`Visitor ${i + 1}`}
                          className="h-full w-full rounded-md border border-border object-cover bg-muted"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow"
                          aria-label="Remove photo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <div className="h-full w-full rounded-md border-2 border-dashed border-muted-foreground/40 bg-white flex items-center justify-center">
                        <span className="text-sm text-muted-foreground">{i + 1}</span>
                      </div>
                    )}
                  </div>
                ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{visitorPhotos.length} / {MAX_VISITOR_PHOTOS} images</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-base text-foreground">Full Name (as per CNIC/Passport)<span className="text-destructive -ml-px" aria-hidden="true">*</span></Label>
            <Input
              name="fullName"
              placeholder="e.g. Mohammad Ali Hassan"
              value={formik.values.fullName}
              onChange={(e) => {
                formik.setFieldValue("fullName", e.target.value, false)
                updateFormData({ fullName: e.target.value })
              }}
              onBlur={formik.handleBlur}
              className="h-10 text-base bg-background border-border"
            />
            {formik.touched.fullName && formik.errors.fullName && (
              <p className="text-sm text-destructive">{String(formik.errors.fullName)}</p>
            )}
            <p className="text-sm text-muted-foreground">(as per CNIC/Passport)</p>
          </div>
          <div className="space-y-2">
            <Label className="text-base text-foreground">Gender</Label>
            <Select
              value={formData.gender || undefined}
              onValueChange={(value) => updateFormData({ gender: value })}
            >
              <SelectTrigger className="w-full h-10 bg-background border-border">
                <SelectValue placeholder="Male/Female/Other" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-foreground">CNIC Number<span className="text-destructive -ml-px" aria-hidden="true">*</span></Label>
            <Input
              name="cnicNumber"
              placeholder="00000-0000000-0"
              value={formik.values.cnicNumber}
              onChange={(e) => {
                formik.setFieldValue("cnicNumber", e.target.value, false)
                updateFormData({ cnicNumber: e.target.value })
              }}
              onBlur={formik.handleBlur}
              className="h-10 text-base bg-background border-border"
            />
            {formik.touched.cnicNumber && formik.errors.cnicNumber && (
              <p className="text-sm text-destructive">{String(formik.errors.cnicNumber)}</p>
            )}
            <p className="text-sm text-muted-foreground">(Mandatory for Pakistani Nationals)</p>
          </div>
          <div className="space-y-2">
            <Label className="text-base text-foreground">Passport Number</Label>
            <Input
              name="passportNumber"
              placeholder="123456789"
              value={formik.values.passportNumber}
              onChange={(e) => {
                formik.setFieldValue("passportNumber", e.target.value, false)
                updateFormData({ passportNumber: e.target.value })
              }}
              onBlur={formik.handleBlur}
              className="h-10 text-base bg-background border-border"
            />
            {formik.touched.passportNumber && formik.errors.passportNumber && (
              <p className="text-sm text-destructive">{String(formik.errors.passportNumber)}</p>
            )}
            <p className="text-sm text-muted-foreground">(Mandatory for Foreign Nationals)</p>
          </div>
          <div className="space-y-2">
            <Label className="text-base text-foreground">Nationality</Label>
            <Select
              value={formData.nationality || undefined}
              onValueChange={(value) => updateFormData({ nationality: value })}
            >
              <SelectTrigger className="w-full h-10 bg-background border-border">
                <SelectValue placeholder="Pakistani" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pakistani">Pakistani</SelectItem>
                <SelectItem value="american">American</SelectItem>
                <SelectItem value="british">British</SelectItem>
                <SelectItem value="indian">Indian</SelectItem>
                <SelectItem value="uae">UAE</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">(Country of Citizenship)</p>
          </div>
          <div className="space-y-2">
            <Label className="text-base text-foreground">Date of Birth</Label>
            <Input
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => updateFormData({ dateOfBirth: e.target.value })}
              className="h-10 text-base bg-background border-border"
            />
            <p className="text-sm text-muted-foreground">(for identity verification)</p>
          </div>
          <div className="space-y-2">
            <Label className="text-base text-foreground">Mobile Number<span className="text-destructive -ml-px" aria-hidden="true">*</span></Label>
            <Input
              name="mobileNumber"
              placeholder="0000-0000000"
              value={formik.values.mobileNumber}
              onChange={(e) => {
                formik.setFieldValue("mobileNumber", e.target.value, false)
                updateFormData({ mobileNumber: e.target.value })
              }}
              onBlur={formik.handleBlur}
              className="h-10 text-base bg-background border-border"
            />
            {formik.touched.mobileNumber && formik.errors.mobileNumber && (
              <p className="text-sm text-destructive">{String(formik.errors.mobileNumber)}</p>
            )}
            <p className="text-sm text-muted-foreground">(SMS Notification & OTP)</p>
          </div>
          <div className="space-y-2">
            <Label className="text-base text-foreground">Email Address</Label>
            <Input
              type="email"
              placeholder="emailaddress@email.com"
              value={formData.emailAddress}
              onChange={(e) => updateFormData({ emailAddress: e.target.value })}
              className="h-10 text-base bg-background border-border"
            />
            <p className="text-sm text-muted-foreground">(Confirmation and Status Updates)</p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-base text-foreground">Residential Address</Label>
            <Textarea
              placeholder="e.g. House #, Street Name, City"
              value={formData.residentialAddress}
              onChange={(e) => updateFormData({ residentialAddress: e.target.value })}
              className="min-h-20 text-base bg-background border-border resize-none"
            />
            <p className="text-sm text-muted-foreground">(Visitor Address)</p>
          </div>
        </div>
      </div>

      {/* Company/Organization Information */}
      <div className="space-y-4">
        <Label className="text-[22px] font-bold text-foreground">Company/Organization Information</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-base text-foreground">Organization Name</Label>
            <Input
              placeholder="Enter the organization name"
              value={formData.organizationName}
              onChange={(e) => updateFormData({ organizationName: e.target.value })}
              className="h-10 text-base bg-background border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-base text-foreground">Organization Type</Label>
            <Select
              value={formData.organizationType || undefined}
              onValueChange={(value) => updateFormData({ organizationType: value })}
            >
              <SelectTrigger className="w-full h-10 bg-background border-border">
                <SelectValue placeholder="Select the type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="government">Government</SelectItem>
                <SelectItem value="ngo">NGO</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-base text-foreground">NTN / Registration No.</Label>
            <Input
              placeholder="Enter the number"
              value={formData.ntnRegistrationNo}
              onChange={(e) => updateFormData({ ntnRegistrationNo: e.target.value })}
              className="h-10 text-base bg-background border-border"
            />
            <p className="text-sm text-muted-foreground">(Business registration - optional)</p>
          </div>
          <div className="space-y-2">
            <Label className="text-base text-foreground">Designation</Label>
            <Input
              placeholder="Enter your designation"
              value={formData.designation}
              onChange={(e) => updateFormData({ designation: e.target.value })}
              className="h-10 text-base bg-background border-border"
            />
            <p className="text-sm text-muted-foreground">(Mandatory for Pakistani Nationals)</p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-base text-foreground">Office Address</Label>
            <Textarea
              placeholder="e.g. Office #, Building Name, Area, City"
              value={formData.officeAddress}
              onChange={(e) => updateFormData({ officeAddress: e.target.value })}
              className="min-h-20 text-base bg-background border-border resize-none"
            />
            <p className="text-sm text-muted-foreground">(Organization Address)</p>
          </div>
        </div>
      </div>

      {/* Vehicle Information (optional) */}
      <div className="space-y-4">
        <Label className="text-[22px] font-bold text-foreground">Vehicle Information (optional)</Label>
              {/* Vehicle photograph upload – same styling as visitor Photograph Upload */}
              <div className="space-y-2 pt-2">
          <Label className="text-base font-medium text-foreground">Vehicle Photograph Upload</Label>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-muted/20 py-6 px-3 transition-colors min-w-0 shrink-0",
                "border-muted-foreground/30 hover:border-primary/40 hover:bg-muted/30 max-w-[280px]"
              )}
            >
                {!vehicleCameraOpen ? (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Camera className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground text-center">Upload a Vehicle Photograph</p>
                    <p className="text-xs text-muted-foreground text-center">Image size: Max 2MB, Format JPG/PNG. Up to {MAX_VEHICLE_PHOTOS} images for recognition.</p>
                    <div className="flex flex-col gap-2 w-full">
                      <Button
                        type="button"
                        onClick={() => { setCameraOpen(false); setMinorCameraOpen(null); setVehicleCameraOpen(true); }}
                        disabled={vehicleCameraLoading || vehiclePhotos.length >= MAX_VEHICLE_PHOTOS}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 w-full"
                      >
                        {vehicleCameraLoading ? "Opening camera…" : "Capture from camera"}
                      </Button>
                      <input
                        ref={vehicleImageInputRef}
                        type="file"
                        accept={ALLOWED_PHOTO_TYPES.join(",")}
                        className="sr-only"
                        onChange={handleVehiclePhotoUpload}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => vehicleImageInputRef.current?.click()}
                        disabled={vehiclePhotos.length >= MAX_VEHICLE_PHOTOS}
                        className="rounded-md px-4 py-2 text-sm font-medium w-full"
                      >
                        Upload Photo
                      </Button>
                    </div>
                    {vehiclePhotoError && (
                      <p className="text-sm text-destructive text-center">{vehiclePhotoError}</p>
                    )}
                  </>
                ) : (
                  <div className="w-full space-y-2">
                    <video
                      ref={vehicleVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full max-h-40 rounded-md bg-muted object-cover"
                    />
                    <canvas ref={vehicleCanvasRef} className="hidden" />
                    {vehicleCameraError && (
                      <p className="text-sm text-destructive text-center">{vehicleCameraError}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={captureVehicleFromCamera}
                        disabled={vehicleCameraLoading || !!vehicleCameraError || vehiclePhotos.length >= MAX_VEHICLE_PHOTOS}
                        className="flex-1 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        Take photo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => { setVehicleCameraOpen(false); setVehicleCameraError(null); stopVehicleCamera(); }}
                        className="rounded-md py-2 text-sm font-medium"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
            </div>
            {/* Right: captured images – same as visitor */}
            <div className="flex flex-col gap-3 min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Captured images</p>
              <div className="overflow-x-auto overflow-y-hidden">
                <div className="grid grid-cols-5 gap-3 min-w-[calc(12rem*5+0.75rem*4)] w-max">
                {Array.from({ length: MAX_VEHICLE_PHOTOS }, (_, i) => (
                  <div key={i} className="relative h-[14.5rem] w-48 shrink-0">
                    {vehiclePhotos[i] ? (
                      <>
                        <img
                          src={vehiclePhotos[i]}
                          alt={`Vehicle ${i + 1}`}
                          className="h-full w-full rounded-md border border-border object-cover bg-muted"
                        />
                        <button
                          type="button"
                          onClick={() => removeVehiclePhoto(i)}
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow"
                          aria-label="Remove vehicle photo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <div className="h-full w-full rounded-md border-2 border-dashed border-muted-foreground/40 bg-white flex items-center justify-center">
                        <span className="text-sm text-muted-foreground">{i + 1}</span>
                      </div>
                    )}
                  </div>
                ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{vehiclePhotos.length} / {MAX_VEHICLE_PHOTOS} images</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-base text-foreground">Vehicle Type</Label>
            <Select
              value={formData.vehicleType || undefined}
              onValueChange={(value) => updateFormData({ vehicleType: value })}
            >
              <SelectTrigger className="w-full h-10 bg-background border-border">
                <SelectValue placeholder="Car" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="car">Car</SelectItem>
                <SelectItem value="motorcycle">Motorcycle</SelectItem>
                <SelectItem value="van">Van</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-base text-foreground">Vehicle Number</Label>
            <Input
              placeholder="Enter vehicle number"
              value={formData.vehicleNumber}
              onChange={(e) => updateFormData({ vehicleNumber: e.target.value })}
              className="h-10 text-base bg-background border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-base text-foreground">Vehicle Registration No.</Label>
            <Input
              placeholder="Enter the number"
              value={formData.vehicleRegistrationNo}
              onChange={(e) => updateFormData({ vehicleRegistrationNo: e.target.value })}
              className="h-10 text-base bg-background border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-base text-foreground">License No.</Label>
            <Input
              placeholder="Enter the number"
              value={formData.licenseNo}
              onChange={(e) => updateFormData({ licenseNo: e.target.value })}
              className="h-10 text-base bg-background border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-base text-foreground">Issue Date</Label>
            <Input
              type="date"
              placeholder="DD/MM/YYYY"
              value={formData.licenseIssueDate}
              onChange={(e) => updateFormData({ licenseIssueDate: e.target.value })}
              className="h-10 text-base bg-background border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-base text-foreground">Expiry Date</Label>
            <Input
              type="date"
              placeholder="DD/MM/YYYY"
              value={formData.licenseExpiryDate}
              onChange={(e) => updateFormData({ licenseExpiryDate: e.target.value })}
              className="h-10 text-base bg-background border-border"
            />
          </div>
        </div>

  
      </div>

      {formData.visitMode === "group" && (
        <GroupMembersSection
          partySize={formData.groupPartySize}
          members={formData.groupMembers ?? []}
          onPartySizeChange={(size) => {
            updateFormData({
              groupPartySize: size,
              groupMembers: resizeGroupMembers(formData.groupMembers ?? [], size),
            })
          }}
          onMembersChange={(groupMembers) => updateFormData({ groupMembers })}
        />
      )}

      {/* Visitor with Minor – same layout and styling as main visitor form */}
      {formData.visitMode !== "group" && (
      <>
      <input
        ref={minorImageInputRef}
        type="file"
        accept={ALLOWED_PHOTO_TYPES.join(",")}
        className="sr-only"
        onChange={handleMinorPhotoUpload}
        aria-hidden
      />
      <div className="space-y-4 border-t border-border pt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-[22px] font-bold text-foreground">Visitor with Minor</Label>
            <p className="text-sm text-muted-foreground mt-1">Add any minors (e.g. children) accompanying the visitor.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = [...(formData.visitorMinors ?? []), defaultMinor()]
              updateFormData({ visitorMinors: next })
            }}
            className="flex shrink-0 items-center gap-2 rounded-md border border-[#CCCCCC] bg-white px-4 py-2.5 text-base font-normal text-[#3366CC] transition-colors hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" /> Add Minor
          </button>
        </div>

        <div className="space-y-6">
          {(formData.visitorMinors ?? []).map((m, index) => {
            const minor = { ...defaultMinor(), ...m }
            const setMinor = (patch: Partial<typeof minor>) => {
              const next = [...(formData.visitorMinors ?? [])]
              next[index] = { ...defaultMinor(), ...next[index], ...patch }
              updateFormData({ visitorMinors: next })
            }
            return (
              <div key={index} className="rounded-lg border border-border bg-muted/10 p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-muted-foreground">Minor {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = (formData.visitorMinors ?? []).filter((_, i) => i !== index)
                      updateFormData({ visitorMinors: next })
                    }}
                    aria-label="Remove minor"
                    className="flex items-center gap-1.5 rounded-md border border-[#CCCCCC] bg-white px-4 py-2.5 text-base font-normal text-[#3366CC] transition-colors hover:bg-gray-50"
                  >
                    <X className="h-4 w-4" /> Remove
                  </button>
                </div>

                {/* Photograph Upload – first, same layout/styling as visitor */}
                <div className="space-y-2 mb-6">
                  <Label className="text-base font-medium text-foreground">Minor Photograph Upload</Label>
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    {/* Left: capture box */}
                    <div
                      className={cn(
                        "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-muted/20 py-6 px-3 transition-colors min-w-0 shrink-0",
                        "border-muted-foreground/30 hover:border-primary/40 hover:bg-muted/30 max-w-[280px]"
                      )}
                    >
                      {minorCameraOpen !== index ? (
                        <>
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                            <Camera className="h-6 w-6 text-primary" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground text-center">Upload a Minor Photograph</p>
                          <p className="text-xs text-muted-foreground text-center">
                            Max 2MB, JPG/PNG. Up to {MAX_MINOR_PHOTOS} photos — human face required.
                          </p>
                          <div className="flex flex-col gap-2 w-full">
                            <Button
                              type="button"
                              onClick={() => {
                                setCameraOpen(false)
                                setVehicleCameraOpen(false)
                                setMinorCameraOpen(index)
                              }}
                              disabled={minorCameraLoading || minorPhotoValidating || (Array.isArray(minor.photos) ? minor.photos.length : 0) >= MAX_MINOR_PHOTOS}
                              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 w-full"
                            >
                              {minorCameraLoading && minorCameraOpen === index ? "Opening camera…" : "Capture from camera"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setMinorUploadTarget(index)
                                setMinorPhotoError(null)
                                setTimeout(() => minorImageInputRef.current?.click(), 0)
                              }}
                              disabled={minorPhotoValidating || (Array.isArray(minor.photos) ? minor.photos.length : 0) >= MAX_MINOR_PHOTOS}
                              className="rounded-md px-4 py-2 text-sm font-medium w-full"
                            >
                              {minorPhotoValidating ? "Checking photo…" : "Upload Photo"}
                            </Button>
                          </div>
                          {minorPhotoValidating && (
                            <p className="text-xs text-muted-foreground text-center">Detecting human face…</p>
                          )}
                          {minorPhotoError && (
                            <p className="text-sm text-destructive text-center">{minorPhotoError}</p>
                          )}
                        </>
                      ) : (
                        <div className="w-full space-y-2">
                          <video
                            ref={minorVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full max-h-40 rounded-md bg-muted object-cover"
                          />
                          <canvas ref={minorCanvasRef} className="hidden" />
                          {minorCameraError && (
                            <p className="text-sm text-destructive text-center">{minorCameraError}</p>
                          )}
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={() => void captureFromMinorCamera()}
                              disabled={minorCameraLoading || minorPhotoValidating || !!minorCameraError || (Array.isArray(minor.photos) ? minor.photos.length : 0) >= MAX_MINOR_PHOTOS}
                              className="flex-1 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                            >
                              {minorPhotoValidating ? "Checking…" : "Take photo"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => { setMinorCameraOpen(null); setMinorCameraError(null); stopMinorCamera(); }}
                              className="rounded-md py-2 text-sm font-medium"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right: captured images for recognition (up to 5) */}
                    <div className="flex flex-col gap-3 min-w-0">
                      <p className="text-sm font-medium text-muted-foreground">Captured images</p>
                      <div className="overflow-x-auto overflow-y-hidden">
                        <div className="grid grid-cols-5 gap-3 min-w-[calc(12rem*5+0.75rem*4)] w-max">
                          {Array.from({ length: MAX_MINOR_PHOTOS }, (_, i) => {
                            const minorPhotos = Array.isArray(minor.photos) ? minor.photos : []
                            const photo = minorPhotos[i]
                            return (
                              <div key={i} className="relative h-[14.5rem] w-48 shrink-0">
                                {photo ? (
                                  <>
                                    <img
                                      src={photo}
                                      alt={`Minor ${index + 1} – ${i + 1}`}
                                      className="h-full w-full rounded-md border border-border object-cover bg-muted"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeMinorPhoto(index, i)}
                                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow"
                                      aria-label="Remove minor photo"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </>
                                ) : (
                                  <div className="h-full w-full rounded-md border-2 border-dashed border-muted-foreground/40 bg-white flex items-center justify-center">
                                    <span className="text-sm text-muted-foreground">{i + 1}</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{(Array.isArray(minor.photos) ? minor.photos.length : 0)} / {MAX_MINOR_PHOTOS} images</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-base text-foreground">Full Name (as per CNIC/Passport)<span className="text-destructive -ml-px" aria-hidden="true">*</span></Label>
                    <Input
                      placeholder="e.g. Mohammad Ali Hassan"
                      value={minor.name}
                      onChange={(e) => setMinor({ name: e.target.value })}
                      className="h-10 text-base bg-background border-border rounded-md"
                    />
                    <p className="text-sm text-muted-foreground">(as per CNIC/Passport)</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base text-foreground">Gender</Label>
                    <Select value={minor.gender || undefined} onValueChange={(v) => setMinor({ gender: v })}>
                      <SelectTrigger className="w-full h-10 bg-background border-border rounded-md">
                        <SelectValue placeholder="Male/Female/Other" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base text-foreground">CNIC Number<span className="text-destructive -ml-px" aria-hidden="true">*</span></Label>
                    <Input
                      placeholder="00000-0000000-0"
                      value={minor.cnicOrBForm}
                      onChange={(e) => setMinor({ cnicOrBForm: e.target.value })}
                      className="h-10 text-base bg-background border-border rounded-md"
                    />
                    <p className="text-sm text-muted-foreground">(Mandatory for Pakistani Nationals)</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base text-foreground">Passport Number</Label>
                    <Input
                      placeholder="123456789"
                      value={minor.passportNumber}
                      onChange={(e) => setMinor({ passportNumber: e.target.value })}
                      className="h-10 text-base bg-background border-border rounded-md"
                    />
                    <p className="text-sm text-muted-foreground">(Mandatory for Foreign Nationals)</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base text-foreground">Nationality</Label>
                    <Select value={minor.nationality || undefined} onValueChange={(v) => setMinor({ nationality: v })}>
                      <SelectTrigger className="w-full h-10 bg-background border-border rounded-md">
                        <SelectValue placeholder="Pakistani" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pakistani">Pakistani</SelectItem>
                        <SelectItem value="american">American</SelectItem>
                        <SelectItem value="british">British</SelectItem>
                        <SelectItem value="indian">Indian</SelectItem>
                        <SelectItem value="uae">UAE</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">(Country of Citizenship)</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base text-foreground">Date of Birth</Label>
                    <Input
                      type="date"
                      value={minor.dateOfBirth}
                      onChange={(e) => setMinor({ dateOfBirth: e.target.value })}
                      className="h-10 text-base bg-background border-border rounded-md"
                    />
                    <p className="text-sm text-muted-foreground">(for identity verification)</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base text-foreground">Mobile Number<span className="text-destructive -ml-px" aria-hidden="true">*</span></Label>
                    <Input
                      placeholder="0000-0000000"
                      value={minor.mobileNumber}
                      onChange={(e) => setMinor({ mobileNumber: e.target.value })}
                      className="h-10 text-base bg-background border-border rounded-md"
                    />
                    <p className="text-sm text-muted-foreground">(SMS Notification & OTP)</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base text-foreground">Email Address</Label>
                    <Input
                      type="email"
                      placeholder="emailaddress@email.com"
                      value={minor.emailAddress}
                      onChange={(e) => setMinor({ emailAddress: e.target.value })}
                      className="h-10 text-base bg-background border-border rounded-md"
                    />
                    <p className="text-sm text-muted-foreground">(Confirmation and Status Updates)</p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-base text-foreground">Residential Address</Label>
                    <Textarea
                      placeholder="e.g. House #, Street Name, City"
                      value={minor.residentialAddress}
                      onChange={(e) => setMinor({ residentialAddress: e.target.value })}
                      className="min-h-20 text-base bg-background border-border rounded-md resize-none"
                    />
                    <p className="text-sm text-muted-foreground">(Visitor Address)</p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-base text-foreground">Relation to Visitor</Label>
                    <Input
                      placeholder="e.g. Son, Daughter, Ward"
                      value={minor.relation}
                      onChange={(e) => setMinor({ relation: e.target.value })}
                      className="h-10 text-base bg-background border-border rounded-md"
                    />
                  </div>

       
                </div>
              </div>
            )
          })}
        </div>
      </div>
      </>
      )}

      {/* Action buttons */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-[#CCCCCC] bg-white px-4 py-2.5 text-base font-normal text-[#3366CC] transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="rounded-md border border-[#CCCCCC] bg-white px-4 py-2.5 text-base font-normal text-[#3366CC] transition-colors hover:bg-gray-50"
            >
              Reset Form
            </button>
          )}
          {onSaveToDraft && (
            <button
              type="button"
              onClick={onSaveToDraft}
              className="rounded-md border border-[#CCCCCC] bg-white px-4 py-2.5 text-base font-normal text-[#3366CC] transition-colors hover:bg-gray-50"
            >
              Save to draft
            </button>
          )}
        </div>
        {onSaveAndContinue && (
          <button
            type="button"
            onClick={() => formik.submitForm()}
            className="shrink-0 rounded-md bg-[#3366FF] px-5 py-2.5 text-base font-normal text-white transition-colors hover:bg-[#2952CC]"
          >
            Save & Continue
          </button>
        )}
      </div>

      <CongratulationsModal
        open={showCongratsModal}
        onClose={() => {
          setShowCongratsModal(false)
          onSaveAndContinue?.()
        }}
      />
    </div>
  )
}
