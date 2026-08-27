"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { Label } from "@/components/ui/label"
import { Camera, FileText, X, Upload, Video, VideoOff, AlertCircle } from "lucide-react"
import { getCameraErrorMessage, requestUserMedia } from "@/lib/utils"

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

type DocumentField = keyof WalkInStep2DocumentsFormData

export interface UploadedFileItem {
  dataUrl: string
  name: string
  size: string
}

export interface WalkInStep2DocumentsFormData {
  frontImage: string
  backImage: string
  applicationLetter: string
  additionalDocument: string
  authorizationLetter: string
  nocDocument: string
  /** Multiple files for Proof of Identification (backImage = first item for API) */
  backImageFiles?: UploadedFileItem[]
  /** Multiple files for Authorization letter */
  authorizationLetterFiles?: UploadedFileItem[]
  /** Multiple files for NOC */
  nocDocumentFiles?: UploadedFileItem[]
}

interface UploadedFile {
  id: string
  name: string
  size: string
  file?: File
}

interface WalkInStep2DocumentsUploadProps {
  formData: WalkInStep2DocumentsFormData
  updateFormData: (data: Partial<WalkInStep2DocumentsFormData>) => void
  onCancel?: () => void
  onReset?: () => void
  onPrevious?: () => void
  onSaveToDraft?: () => void
  onSaveAndContinue?: () => void
}

const uploadBoxClass =
  "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 py-8 px-6"

export function WalkInStep2DocumentsUpload({
  formData,
  updateFormData,
  onCancel,
  onReset,
  onPrevious,
  onSaveToDraft,
  onSaveAndContinue,
}: WalkInStep2DocumentsUploadProps) {
  const { toast } = useToast()
  const [supportingFiles, setSupportingFiles] = useState<UploadedFile[]>([])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [])
  const photoInputRef = useRef<HTMLInputElement>(null)
  const idInputRef = useRef<HTMLInputElement>(null)
  const supportingInputRef = useRef<HTMLInputElement>(null)
  const authorizationLetterInputRef = useRef<HTMLInputElement>(null)
  const nocDocumentInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "backImage" | "authorizationLetter" | "nocDocument"
  ) => {
    const files = e.target.files
    if (!files?.length) return
    const newItems: UploadedFileItem[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const dataUrl = await readFileAsDataUrl(file)
        const sizeStr = `${(file.size / 1024 / 1024).toFixed(1)}MB`
        newItems.push({ dataUrl, name: file.name, size: sizeStr })
      } catch {
        console.error("Failed to read uploaded file", file.name)
        toast({ title: "Upload failed", description: `Could not read ${file.name}.`, variant: "destructive" })
      }
    }
    if (newItems.length === 0) {
      e.target.value = ""
      return
    }
    if (field === "backImage") {
      const prev = formData.backImageFiles ?? []
      const next = [...prev, ...newItems]
      updateFormData({ backImageFiles: next, backImage: next[0]?.dataUrl ?? "" })
    } else if (field === "authorizationLetter") {
      const prev = formData.authorizationLetterFiles ?? []
      const next = [...prev, ...newItems]
      updateFormData({ authorizationLetterFiles: next, authorizationLetter: next[0]?.dataUrl ?? "" })
    } else if (field === "nocDocument") {
      const prev = formData.nocDocumentFiles ?? []
      const next = [...prev, ...newItems]
      updateFormData({ nocDocumentFiles: next, nocDocument: next[0]?.dataUrl ?? "" })
    }
    e.target.value = ""
  }

  const handleSupportingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const newFiles: UploadedFile[] = []
    let applicationLetter = formData.applicationLetter
    let additionalDocument = formData.additionalDocument
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      newFiles.push({
        id: Math.random().toString(36).slice(2),
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)}MB`,
        file,
      })
      try {
        const dataUrl = await readFileAsDataUrl(file)
        if (i === 0) applicationLetter = dataUrl
        else if (i === 1) additionalDocument = dataUrl
      } catch {
        console.error("Failed to read file", file.name)
      }
    }
    setSupportingFiles((prev) => [...prev, ...newFiles])
    updateFormData({ applicationLetter, additionalDocument })
    e.target.value = ""
  }

  const removeSupportingFile = (id: string) => {
    setSupportingFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const [cameraFor, setCameraFor] = useState<DocumentField | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraLoading, setCameraLoading] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
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
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92)
    const approxBytes = Math.round((dataUrl.length * 3) / 4)
    const sizeStr = approxBytes >= 1024 * 1024 ? `${(approxBytes / 1024 / 1024).toFixed(1)}MB` : `${(approxBytes / 1024).toFixed(1)}KB`
    const newItem: UploadedFileItem = { dataUrl, name: "Captured image.jpg", size: sizeStr }
    if (cameraFor === "backImage") {
      const prev = formData.backImageFiles ?? []
      const next = [...prev, newItem]
      updateFormData({ backImageFiles: next, backImage: next[0]?.dataUrl ?? "" })
    } else if (cameraFor === "authorizationLetter") {
      const prev = formData.authorizationLetterFiles ?? []
      const next = [...prev, newItem]
      updateFormData({ authorizationLetterFiles: next, authorizationLetter: next[0]?.dataUrl ?? "" })
    } else if (cameraFor === "nocDocument") {
      const prev = formData.nocDocumentFiles ?? []
      const next = [...prev, newItem]
      updateFormData({ nocDocumentFiles: next, nocDocument: next[0]?.dataUrl ?? "" })
    }
    stopCamera()
    setCameraFor(null)
    setCameraError(null)
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

  return (
    <div className="space-y-8">
      <Label className="text-[22px] font-bold text-foreground">Documents Upload</Label>

      {/* Photograph – capture from camera or upload */}
      {/* <div className="space-y-3">
        <p className="text-base font-medium text-foreground">Visitor Photograph</p>
        <div className="flex flex-col sm:flex-row gap-4">
          {formData.frontImage && isImageDataUrl(formData.frontImage) && (
            <div className="rounded-lg border border-border overflow-hidden bg-muted/20 shrink-0">
              <img src={formData.frontImage} alt="Visitor photo" className="h-40 w-auto object-contain" />
            </div>
          )}
          <div className={uploadBoxClass + " flex-1 min-w-0"}>
            <input
              ref={photoInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,image/*"
              className="hidden"
              onChange={(e) => handleUpload(e, "frontImage")}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openCameraFor("frontImage")}
                className="rounded-md bg-[#3366FF] px-4 py-2.5 text-base font-normal text-white flex items-center gap-2"
              >
                <Camera className="h-4 w-4" /> Capture from camera
              </button>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="rounded-md border border-[#3366FF] bg-white px-4 py-2.5 text-base text-[#3366FF] flex items-center gap-2"
              >
                <Upload className="h-4 w-4" /> Upload from device
              </button>
            </div>
          </div>
        </div>
      </div> */}

      {/* ID Document – Proof of Identification */}
      <div className="space-y-3 border-t border-border pt-6">
        <p className="text-base font-medium text-foreground">Proof of Identification</p>
        <div className={uploadBoxClass + " w-full"}>
          <input
            ref={idInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,image/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e, "backImage")}
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dbeafe] ring-2 ring-[#3b82f6]">
            <Camera className="h-6 w-6 text-[#2563eb]" />
          </div>
          <p className="text-base font-medium text-foreground">Upload a Proof of Identification</p>
          <p className="text-sm text-muted-foreground">Image size: Max 5MB, Format: PDF, JPG</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button type="button" onClick={() => openCameraFor("backImage")} className="rounded-md bg-[#3366FF] px-4 py-2.5 text-base font-normal text-white flex items-center gap-2 transition-colors hover:bg-[#2952CC]">
              <Camera className="h-4 w-4" /> Capture from camera
            </button>
            <button type="button" onClick={() => idInputRef.current?.click()} className="rounded-md border border-[#3366FF] bg-white px-4 py-2.5 text-base text-[#3366FF] flex items-center gap-2 transition-colors hover:bg-gray-50">
              <Upload className="h-4 w-4" /> Upload from device
            </button>
          </div>
        </div>
        {(formData.backImageFiles ?? []).map((file, idx) => (
          <div key={idx} className="flex items-center gap-4 rounded-lg border border-[#93c5fd] bg-white px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dbeafe]">
              <FileText className="h-5 w-5 text-[#2563eb]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium text-foreground">{file.name}</p>
              <p className="text-sm text-muted-foreground">File size: {file.size}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = (formData.backImageFiles ?? []).filter((_, i) => i !== idx)
                updateFormData({ backImageFiles: next, backImage: next[0]?.dataUrl ?? "" })
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3366FF] text-white hover:bg-[#2952CC] focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Authorization letter (if applicable) */}
      <div className="space-y-3 border-t border-border pt-6">
        <p className="text-base font-medium text-foreground">Authorization letter (if applicable)</p>
        <div className="rounded-lg border-2 border-dashed border-border bg-muted/20 py-8 px-6 flex flex-col items-center justify-center gap-3">
          <input
            ref={authorizationLetterInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,image/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e, "authorizationLetter")}
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dbeafe] ring-2 ring-[#3b82f6]">
            <Camera className="h-6 w-6 text-[#2563eb]" />
          </div>
          <p className="text-base font-medium text-foreground">Upload a Proof of Identification</p>
          <p className="text-sm text-muted-foreground">Image size: Max 5MB, Format: PDF, JPG</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={() => openCameraFor("authorizationLetter")}
              className="rounded-md bg-[#3366FF] px-4 py-2.5 text-base font-normal text-white flex items-center gap-2 transition-colors hover:bg-[#2952CC]"
            >
              <Camera className="h-4 w-4" /> Capture from camera
            </button>
            <button
              type="button"
              onClick={() => authorizationLetterInputRef.current?.click()}
              className="rounded-md border border-[#3366FF] bg-white px-4 py-2.5 text-base text-[#3366FF] flex items-center gap-2 transition-colors hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" /> Upload from device
            </button>
          </div>
        </div>
        {(formData.authorizationLetterFiles ?? []).map((file, idx) => (
          <div key={idx} className="flex items-center gap-4 rounded-lg border border-[#93c5fd] bg-white px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dbeafe]">
              <FileText className="h-5 w-5 text-[#2563eb]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium text-foreground">{file.name}</p>
              <p className="text-sm text-muted-foreground">File size: {file.size}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = (formData.authorizationLetterFiles ?? []).filter((_, i) => i !== idx)
                updateFormData({ authorizationLetterFiles: next, authorizationLetter: next[0]?.dataUrl ?? "" })
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3366FF] text-white hover:bg-[#2952CC] focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* NOC from Relevant Authority (if required) */}
      <div className="space-y-3 border-t border-border pt-6">
        <p className="text-base font-medium text-foreground">NOC from Relevant Authority (if required)</p>
        <div className="rounded-lg border-2 border-dashed border-border bg-muted/20 py-8 px-6 flex flex-col items-center justify-center gap-3">
          <input
            ref={nocDocumentInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,image/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e, "nocDocument")}
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dbeafe] ring-2 ring-[#3b82f6]">
            <Camera className="h-6 w-6 text-[#2563eb]" />
          </div>
          <p className="text-base font-medium text-foreground">Upload a Proof of Identification</p>
          <p className="text-sm text-muted-foreground">Image size: Max 5MB, Format: PDF, JPG</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={() => openCameraFor("nocDocument")}
              className="rounded-md bg-[#3366FF] px-4 py-2.5 text-base font-normal text-white flex items-center gap-2 transition-colors hover:bg-[#2952CC]"
            >
              <Camera className="h-4 w-4" /> Capture from camera
            </button>
            <button
              type="button"
              onClick={() => nocDocumentInputRef.current?.click()}
              className="rounded-md border border-[#3366FF] bg-white px-4 py-2.5 text-base text-[#3366FF] flex items-center gap-2 transition-colors hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" /> Upload from device
            </button>
          </div>
        </div>
        {(formData.nocDocumentFiles ?? []).map((file, idx) => (
          <div key={idx} className="flex items-center gap-4 rounded-lg border border-[#93c5fd] bg-white px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dbeafe]">
              <FileText className="h-5 w-5 text-[#2563eb]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium text-foreground">{file.name}</p>
              <p className="text-sm text-muted-foreground">File size: {file.size}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = (formData.nocDocumentFiles ?? []).filter((_, i) => i !== idx)
                updateFormData({ nocDocumentFiles: next, nocDocument: next[0]?.dataUrl ?? "" })
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3366FF] text-white hover:bg-[#2952CC] focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Supporting Documents */}
      <div className="space-y-3 border-t border-border pt-6">
        <p className="text-base font-medium text-foreground">Supporting document(s)</p>
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
          {formData.applicationLetter && isImageDataUrl(formData.applicationLetter) && (
            <div className="rounded-lg border border-border overflow-hidden bg-muted/20 shrink-0">
              <img src={formData.applicationLetter} alt="Supporting doc 1" className="h-40 w-auto object-contain" />
            </div>
          )}
          {formData.additionalDocument && isImageDataUrl(formData.additionalDocument) && (
            <div className="rounded-lg border border-border overflow-hidden bg-muted/20 shrink-0">
              <img src={formData.additionalDocument} alt="Supporting doc 2" className="h-40 w-auto object-contain" />
            </div>
          )}
          <div className={uploadBoxClass + " flex-1 min-w-0"}>
            <input
              ref={supportingInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,image/*"
              multiple
              className="hidden"
              onChange={handleSupportingUpload}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => openCameraFor("applicationLetter")} className="rounded-md bg-[#3366FF] px-4 py-2.5 text-base font-normal text-white flex items-center gap-2">
                <Camera className="h-4 w-4" /> Capture (doc 1)
              </button>
              <button type="button" onClick={() => openCameraFor("additionalDocument")} className="rounded-md bg-[#3366FF] px-4 py-2.5 text-base font-normal text-white flex items-center gap-2">
                <Camera className="h-4 w-4" /> Capture (doc 2)
              </button>
              <button type="button" onClick={() => supportingInputRef.current?.click()} className="rounded-md border border-[#3366FF] bg-white px-4 py-2.5 text-base text-[#3366FF] flex items-center gap-2">
                <Upload className="h-4 w-4" /> Upload from device
              </button>
            </div>
          </div>
        </div>
        {supportingFiles.length > 0 && (
          <div className="space-y-2">
            {supportingFiles.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3"
              >
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base text-foreground">{f.name}</p>
                  <p className="text-sm text-muted-foreground">File size: {f.size}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeSupportingFile(f.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Camera panel – shown when capturing one of the documents */}
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
                {cameraLoading ? "Opening…" : <><Video className="h-4 w-4" /> Start camera</>}
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

      {/* Action buttons – same as first form */}
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
          {onSaveToDraft && (
            <button
              type="button"
              onClick={onSaveToDraft}
              className="rounded-md border border-[#CCCCCC] bg-white px-4 py-2.5 text-base font-normal text-[#3366CC] transition-colors hover:bg-gray-50"
            >
              Save to draft
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
