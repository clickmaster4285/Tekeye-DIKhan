import { useState, useRef, useEffect, useCallback } from "react"
import { Camera, FileText, X, Upload, Video, VideoOff, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn, getCameraErrorMessage, requestUserMedia } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

export type UploadValue = {
  file: File | null
  previewUrl: string | null
  /** True while client-side face check is running for this preview. */
  validating?: boolean
}

export interface UploadedFileItem {
  dataUrl: string
  name: string
  size: string
}

export interface AddStaffStep2DocumentsFormData {
  cnicFront: string
  cnicBack: string
  appointmentLetter: string
  additionalDocument: string
  /** Multiple files for CNIC Front */
  cnicFrontFiles?: UploadedFileItem[]
  /** Multiple files for CNIC Back */
  cnicBackFiles?: UploadedFileItem[]
  /** Multiple files for Appointment Letter */
  appointmentLetterFiles?: UploadedFileItem[]
  /** Multiple files for Additional Document */
  additionalDocumentFiles?: UploadedFileItem[]
}

type DocumentField = "cnicFront" | "cnicBack" | "appointmentLetter" | "additionalDocument"

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

function isImageDataUrl(s: string): boolean {
  return typeof s === "string" && s.startsWith("data:image/")
}

const uploadBoxClass =
  "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-8 px-6 transition-colors hover:border-primary/40 hover:bg-muted/30"

function isImagePreviewUrl(url: string): boolean {
  if (isImageDataUrl(url)) return true
  return /\.(jpe?g|png|gif|webp|bmp)(\?|$)/i.test(url)
}

function DocumentUploadPreview({
  value,
  label,
  onRemove,
}: {
  value: UploadValue
  label: string
  onRemove: () => void
}) {
  if (!value.previewUrl && !value.file) return null

  if (value.previewUrl && isImagePreviewUrl(value.previewUrl)) {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="relative max-w-md">
          <img
            src={value.previewUrl}
            alt={label}
            className="max-h-64 w-full rounded-md border border-border object-contain bg-white"
            decoding="async"
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow"
            aria-label={`Remove ${label}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {value.file ? (
          <p className="text-sm text-muted-foreground">
            {value.file.name} ({(value.file.size / 1024).toFixed(1)} KB)
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Current file on server — upload to replace</p>
        )}
      </div>
    )
  }

  if (!value.file) return null

  return (
    <div className="flex items-center gap-4 rounded-lg border border-[#93c5fd] bg-white px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dbeafe]">
        <FileText className="h-5 w-5 text-[#2563eb]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium text-foreground">{value.file.name}</p>
        <p className="text-sm text-muted-foreground">File size: {(value.file.size / 1024).toFixed(1)} KB</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3366FF] text-white hover:bg-[#2952CC] focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Remove file"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function AddStaffStep2DocumentsUpload({
  cnicFront,
  cnicBack,
  appointmentLetter,
  additionalDocument,
  onPickCnicFront,
  onPickCnicBack,
  onPickAppointmentLetter,
  onPickAdditionalDocument,
  onRemoveCnicFront,
  onRemoveCnicBack,
  onRemoveAppointmentLetter,
  onRemoveAdditionalDocument,
  onCancel,
  onReset,
  onPrevious,
  onSaveAndContinue,
}: {
  cnicFront: UploadValue
  cnicBack: UploadValue
  appointmentLetter: UploadValue
  additionalDocument: UploadValue
  onPickCnicFront: (file: File | null) => void
  onPickCnicBack: (file: File | null) => void
  onPickAppointmentLetter: (file: File | null) => void
  onPickAdditionalDocument: (file: File | null) => void
  onRemoveCnicFront: () => void
  onRemoveCnicBack: () => void
  onRemoveAppointmentLetter: () => void
  onRemoveAdditionalDocument: () => void
  onCancel: () => void
  onReset: () => void
  onPrevious: () => void
  onSaveAndContinue: () => void
}) {
  const { toast } = useToast()
  const [cameraFor, setCameraFor] = useState<DocumentField | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraLoading, setCameraLoading] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Input refs for each document type
  const cnicFrontInputRef = useRef<HTMLInputElement>(null)
  const cnicBackInputRef = useRef<HTMLInputElement>(null)
  const appointmentLetterInputRef = useRef<HTMLInputElement>(null)
  const additionalDocumentInputRef = useRef<HTMLInputElement>(null)

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      setStream(null)
    }
  }, [stream])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  useEffect(() => {
    if (!stream || !videoRef.current) return
    const video = videoRef.current
    video.srcObject = stream
    video.play().catch((e) => console.warn("Video play:", e))
  }, [stream])

  const startCamera = async () => {
    setCameraError(null)
    setCameraLoading(true)
    try {
      const mediaStream = await requestUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      setStream(mediaStream)
    } catch (err) {
      setCameraError(getCameraErrorMessage(err))
    } finally {
      setCameraLoading(false)
    }
  }

  const captureFromCamera = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!cameraFor || !video || !stream || !canvas) return
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
    const dataUrl = canvas.toDataURL("image/jpeg", 0.98)
    
    // Convert dataUrl to File
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], `${cameraFor}_captured.jpg`, { type: "image/jpeg" })
        
        if (cameraFor === "cnicFront") {
          onPickCnicFront(file)
        } else if (cameraFor === "cnicBack") {
          onPickCnicBack(file)
        } else if (cameraFor === "appointmentLetter") {
          onPickAppointmentLetter(file)
        } else if (cameraFor === "additionalDocument") {
          onPickAdditionalDocument(file)
        }
        
        stopCamera()
        setCameraFor(null)
        setCameraError(null)
      })
      .catch(() => {
        toast({ title: "Capture failed", description: "Could not save captured image.", variant: "destructive" })
      })
  }

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: DocumentField
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (field === "cnicFront") {
      onPickCnicFront(file)
    } else if (field === "cnicBack") {
      onPickCnicBack(file)
    } else if (field === "appointmentLetter") {
      onPickAppointmentLetter(file)
    } else if (field === "additionalDocument") {
      onPickAdditionalDocument(file)
    }
    
    e.target.value = ""
  }

  const openCameraFor = (field: DocumentField) => {
    setCameraError(null)
    setCameraFor(field)
  }

  const closeCamera = () => {
    stopCamera()
    setCameraFor(null)
    setCameraError(null)
  }

  const getFieldValue = (field: DocumentField): UploadValue => {
    switch (field) {
      case "cnicFront": return cnicFront
      case "cnicBack": return cnicBack
      case "appointmentLetter": return appointmentLetter
      case "additionalDocument": return additionalDocument
    }
  }

  const getInputRef = (field: DocumentField) => {
    switch (field) {
      case "cnicFront": return cnicFrontInputRef
      case "cnicBack": return cnicBackInputRef
      case "appointmentLetter": return appointmentLetterInputRef
      case "additionalDocument": return additionalDocumentInputRef
    }
  }

  const getFieldTitle = (field: DocumentField): string => {
    switch (field) {
      case "cnicFront": return "CNIC Front"
      case "cnicBack": return "CNIC Back"
      case "appointmentLetter": return "Appointment / Joining Letter"
      case "additionalDocument": return "Additional Document"
    }
  }

  return (
    <div className="space-y-8">
      <Label className="text-[22px] font-bold text-foreground">Documents Upload</Label>

      {/* CNIC Front */}
      <div className="space-y-3 border-t border-border pt-6">
        <p className="text-base font-medium text-foreground">CNIC Front</p>
        <div className={cn(uploadBoxClass, "w-full")}>
          <input
            ref={cnicFrontInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,image/*"
            className="hidden"
            onChange={(e) => handleUpload(e, "cnicFront")}
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dbeafe] ring-2 ring-[#3b82f6]">
            <Camera className="h-6 w-6 text-[#2563eb]" />
          </div>
          <p className="text-base font-medium text-foreground">Upload CNIC Front</p>
          <p className="text-sm text-muted-foreground">Image size: Max 5MB, Format: PDF, JPG</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={() => openCameraFor("cnicFront")}
              className="rounded-md bg-[#3366FF] px-4 py-2.5 text-base font-normal text-white flex items-center gap-2 transition-colors hover:bg-[#2952CC]"
            >
              <Camera className="h-4 w-4" /> Capture from camera
            </button>
            <button
              type="button"
              onClick={() => cnicFrontInputRef.current?.click()}
              className="rounded-md border border-[#3366FF] bg-white px-4 py-2.5 text-base text-[#3366FF] flex items-center gap-2 transition-colors hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" /> Upload from device
            </button>
          </div>
        </div>
        <DocumentUploadPreview value={cnicFront} label="CNIC Front" onRemove={onRemoveCnicFront} />
      </div>

      {/* CNIC Back */}
      <div className="space-y-3 border-t border-border pt-6">
        <p className="text-base font-medium text-foreground">CNIC Back</p>
        <div className={cn(uploadBoxClass, "w-full")}>
          <input
            ref={cnicBackInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,image/*"
            className="hidden"
            onChange={(e) => handleUpload(e, "cnicBack")}
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dbeafe] ring-2 ring-[#3b82f6]">
            <Camera className="h-6 w-6 text-[#2563eb]" />
          </div>
          <p className="text-base font-medium text-foreground">Upload CNIC Back</p>
          <p className="text-sm text-muted-foreground">Image size: Max 5MB, Format: PDF, JPG</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={() => openCameraFor("cnicBack")}
              className="rounded-md bg-[#3366FF] px-4 py-2.5 text-base font-normal text-white flex items-center gap-2 transition-colors hover:bg-[#2952CC]"
            >
              <Camera className="h-4 w-4" /> Capture from camera
            </button>
            <button
              type="button"
              onClick={() => cnicBackInputRef.current?.click()}
              className="rounded-md border border-[#3366FF] bg-white px-4 py-2.5 text-base text-[#3366FF] flex items-center gap-2 transition-colors hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" /> Upload from device
            </button>
          </div>
        </div>
        <DocumentUploadPreview value={cnicBack} label="CNIC Back" onRemove={onRemoveCnicBack} />
      </div>

      {/* Appointment / Joining Letter */}
      <div className="space-y-3 border-t border-border pt-6">
        <p className="text-base font-medium text-foreground">Appointment / Joining Letter</p>
        <div className={cn(uploadBoxClass, "w-full")}>
          <input
            ref={appointmentLetterInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,image/*"
            className="hidden"
            onChange={(e) => handleUpload(e, "appointmentLetter")}
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dbeafe] ring-2 ring-[#3b82f6]">
            <Camera className="h-6 w-6 text-[#2563eb]" />
          </div>
          <p className="text-base font-medium text-foreground">Upload Appointment Letter</p>
          <p className="text-sm text-muted-foreground">Image size: Max 5MB, Format: PDF, JPG</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={() => openCameraFor("appointmentLetter")}
              className="rounded-md bg-[#3366FF] px-4 py-2.5 text-base font-normal text-white flex items-center gap-2 transition-colors hover:bg-[#2952CC]"
            >
              <Camera className="h-4 w-4" /> Capture from camera
            </button>
            <button
              type="button"
              onClick={() => appointmentLetterInputRef.current?.click()}
              className="rounded-md border border-[#3366FF] bg-white px-4 py-2.5 text-base text-[#3366FF] flex items-center gap-2 transition-colors hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" /> Upload from device
            </button>
          </div>
        </div>
        <DocumentUploadPreview
          value={appointmentLetter}
          label="Appointment Letter"
          onRemove={onRemoveAppointmentLetter}
        />
      </div>

      {/* Additional Document */}
      <div className="space-y-3 border-t border-border pt-6">
        <p className="text-base font-medium text-foreground">Additional Document</p>
        <div className={cn(uploadBoxClass, "w-full")}>
          <input
            ref={additionalDocumentInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,image/*"
            className="hidden"
            onChange={(e) => handleUpload(e, "additionalDocument")}
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dbeafe] ring-2 ring-[#3b82f6]">
            <Camera className="h-6 w-6 text-[#2563eb]" />
          </div>
          <p className="text-base font-medium text-foreground">Upload Additional Document</p>
          <p className="text-sm text-muted-foreground">Image size: Max 5MB, Format: PDF, JPG</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={() => openCameraFor("additionalDocument")}
              className="rounded-md bg-[#3366FF] px-4 py-2.5 text-base font-normal text-white flex items-center gap-2 transition-colors hover:bg-[#2952CC]"
            >
              <Camera className="h-4 w-4" /> Capture from camera
            </button>
            <button
              type="button"
              onClick={() => additionalDocumentInputRef.current?.click()}
              className="rounded-md border border-[#3366FF] bg-white px-4 py-2.5 text-base text-[#3366FF] flex items-center gap-2 transition-colors hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" /> Upload from device
            </button>
          </div>
        </div>
        <DocumentUploadPreview
          value={additionalDocument}
          label="Additional Document"
          onRemove={onRemoveAdditionalDocument}
        />
      </div>

      {/* Camera panel – shown when capturing a document */}
      {cameraFor && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          {cameraError && (
            <div className="flex flex-col gap-2 text-destructive text-sm py-2 px-3 bg-destructive/10 rounded-md">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{cameraError}</span>
              </div>
              <button
                type="button"
                onClick={() => { setCameraError(null); startCamera(); }}
                disabled={cameraLoading}
                className="self-start rounded-md bg-[#3366FF] px-3 py-1.5 text-white text-sm"
              >
                {cameraLoading ? "Opening…" : "Try again"}
              </button>
            </div>
          )}
          {!stream && !cameraError && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={startCamera}
                disabled={cameraLoading}
                className="rounded-md bg-[#3366FF] px-4 py-2.5 text-white flex items-center gap-2"
              >
                {cameraLoading ? "Opening…" : <><Video className="h-4 w-4" /> Start camera for {getFieldTitle(cameraFor)}</>}
              </button>
              <button type="button" onClick={closeCamera} className="rounded-md border border-border px-4 py-2.5">
                Cancel
              </button>
            </div>
          )}
          {!stream && cameraError && (
            <div className="flex gap-2">
              <button type="button" onClick={closeCamera} className="rounded-md border border-border px-4 py-2.5">
                Cancel
              </button>
            </div>
          )}
          {stream && (
            <>
              <div className="rounded overflow-hidden bg-black aspect-video max-w-md">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <div className="flex gap-2">
                <button type="button" onClick={captureFromCamera} className="rounded-md bg-[#3366FF] px-4 py-2.5 text-white flex items-center gap-2">
                  <Camera className="h-4 w-4" /> Capture
                </button>
                <button type="button" onClick={closeCamera} className="rounded-md border border-border px-4 py-2.5 flex items-center gap-2">
                  <VideoOff className="h-4 w-4" /> Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 border-t border-border">
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
        </div>
        <div className="flex items-center gap-3">
          {onPrevious && (
            <button
              type="button"
              onClick={onPrevious}
              className="rounded-md bg-[#3366FF] px-4 py-2.5 text-base font-normal text-white transition-colors hover:bg-[#2952CC]"
            >
              Previous
            </button>
          )}
          {onSaveAndContinue && (
            <button
              type="button"
              onClick={onSaveAndContinue}
              className="shrink-0 rounded-md bg-[#3366FF] px-5 py-2.5 text-base font-normal text-white transition-colors hover:bg-[#2952CC]"
            >
              Save & Continue
            </button>
          )}
        </div>
      </div>
    </div>
  )
}