"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Camera, Upload, Video, VideoOff, FileImage, X } from "lucide-react"
import { getCameraErrorMessage, requestUserMedia } from "@/lib/utils"

interface WalkInStep2DocumentProps {
  formData: { documentImages: string[] }
  updateFormData: (data: { documentImages?: string[] }) => void
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

export function WalkInStep2Document({
  formData,
  updateFormData,
}: WalkInStep2DocumentProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showCameraPanel, setShowCameraPanel] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const images = formData.documentImages ?? []

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
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
    video.play().catch((e) => console.warn("Video play failed:", e))
  }, [stream])

  const startCamera = async () => {
    setError(null)
    setIsLoading(true)
    try {
      const mediaStream = await requestUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      setStream(mediaStream)
    } catch (err) {
      setError(getCameraErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  const addImage = (dataUrl: string) => {
    updateFormData({ documentImages: [...images, dataUrl] })
    setSelectedIndex(images.length)
  }

  const removeImage = (index: number) => {
    const next = images.filter((_, i) => i !== index)
    updateFormData({ documentImages: next })
    if (next.length === 0) {
      setSelectedIndex(null)
    } else if (selectedIndex === index) {
      setSelectedIndex(Math.min(index, next.length - 1))
    } else if (selectedIndex !== null && selectedIndex > index) {
      setSelectedIndex(selectedIndex - 1)
    }
  }

  const handleCapture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !stream || !canvas) return
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) {
      setError("Camera not ready. Wait a moment and try again.")
      return
    }
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    canvas.width = w
    canvas.height = h
    ctx.drawImage(video, 0, 0, w, h)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92)
    addImage(dataUrl)
    stopCamera()
    setShowCameraPanel(false)
    setError(null)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setError(null)
    const newUrls: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith("image/")) continue
      try {
        const dataUrl = await readFileAsDataUrl(file)
        newUrls.push(dataUrl)
      } catch {
        setError("Failed to read some files. Try other images.")
      }
    }
    if (newUrls.length) {
      updateFormData({ documentImages: [...images, ...newUrls] })
      setSelectedIndex(images.length + newUrls.length - 1)
    }
    e.target.value = ""
  }

  const openUpload = () => {
    setError(null)
    fileInputRef.current?.click()
  }

  const openCamera = () => {
    setError(null)
    setShowCameraPanel(true)
  }

  const closeCamera = () => {
    stopCamera()
    setShowCameraPanel(false)
    setError(null)
  }

  const selectedImage = selectedIndex != null && images[selectedIndex] ? images[selectedIndex] : null

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Document Upload</h2>
      <p className="text-sm text-muted-foreground">
        Add multiple document images (ID, passport, etc.) by capturing from webcam or uploading from your device.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Document previews + selected large preview */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 overflow-hidden aspect-[3/4] max-w-sm flex items-center justify-center min-h-[200px]">
            {selectedImage ? (
              <img
                src={selectedImage}
                alt="Document preview"
                className="w-full h-full object-contain"
              />
            ) : images.length > 0 ? (
              <img
                src={images[0]}
                alt="Document preview"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground p-4">
                <FileImage className="w-12 h-12" />
                <span className="text-sm text-center">Document preview will appear here</span>
              </div>
            )}
          </div>
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((src, i) => (
                <div key={i} className="relative group">
                  <button
                    type="button"
                    onClick={() => setSelectedIndex(i)}
                    className={`block w-14 h-14 rounded border-2 overflow-hidden shrink-0 ${
                      selectedIndex === i ? "border-[#3b82f6]" : "border-border"
                    }`}
                  >
                    <img src={src} alt={`Doc ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-90 group-hover:opacity-100"
                    onClick={() => removeImage(i)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {images.length > 0 && (
            <p className="text-sm text-muted-foreground">{images.length} image(s) added</p>
          )}
        </div>

        {/* Right: Capture / Upload options */}
        <div className="lg:col-span-2 space-y-4">
          {!showCameraPanel && (
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={openCamera}
                className="gap-2"
              >
                <Camera className="w-5 h-5" />
                Capture from webcam
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={openUpload}
                className="gap-2"
              >
                <Upload className="w-5 h-5" />
                Upload from device
              </Button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          {showCameraPanel && (
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm py-2 px-3 bg-destructive/10 rounded-md">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {!stream && (
                <div className="space-y-3">
                  {!error && (
                    <p className="text-sm text-muted-foreground">Click Start Camera to capture a document image. You can add more after.</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={startCamera}
                      disabled={isLoading}
                      className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-2"
                    >
                      {isLoading ? "Opening…" : <><Video className="w-4 h-4" /> {error ? "Try again" : "Start Camera"}</>}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={closeCamera}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {stream && (
                <div className="space-y-3">
                  <div className="relative rounded overflow-hidden bg-black aspect-video max-w-md">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCapture}
                      className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-2"
                    >
                      <Camera className="w-4 h-4" /> Add this image
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={closeCamera}>
                      <VideoOff className="w-4 h-4 mr-2" /> Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
