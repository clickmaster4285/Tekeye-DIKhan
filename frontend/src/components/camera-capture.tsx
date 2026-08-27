"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Camera, Video, VideoOff, AlertCircle } from "lucide-react"
import { getCameraErrorMessage, requestUserMedia } from "@/lib/utils"

interface CameraCaptureProps {
  onCapture: (file: File) => void
  onCancel?: () => void
  title?: string
  description?: string
}

/** Captures a photo from the device camera and returns it as a File (JPEG). */
export function CameraCapture({ onCapture, onCancel, title = "Capture from camera", description }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

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
    const video = videoRef.current
    if (!video || !stream) return
    video.srcObject = stream
    video.play().catch(() => setError("Could not play video"))
  }, [stream])

  const startCamera = async () => {
    setError(null)
    setIsLoading(true)
    try {
      const mediaStream = await requestUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      setStream(mediaStream)
    } catch (err) {
      setError(getCameraErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleCapture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !stream || !canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx || !video.videoWidth || !video.videoHeight) {
      setError("Camera not ready. Wait a moment and try again.")
      return
    }
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], "capture.jpg", { type: "image/jpeg" })
        stopCamera()
        onCapture(file)
      },
      "image/jpeg",
      0.98
    )
  }

  return (
    <div className="space-y-4">
      {title && <h3 className="font-semibold">{title}</h3>}
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
        {stream ? (
          <>
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
            <Camera className="h-12 w-12" />
            <span className="text-sm">Camera off</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!stream ? (
          <Button type="button" onClick={startCamera} disabled={isLoading}>
            {isLoading ? "Opening…" : (
              <>
                <Video className="h-4 w-4 mr-2" />
                Start camera
              </>
            )}
          </Button>
        ) : (
          <>
            <Button type="button" onClick={handleCapture} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white">
              <Camera className="h-4 w-4 mr-2" />
              Capture photo
            </Button>
            <Button type="button" variant="outline" onClick={stopCamera}>
              <VideoOff className="h-4 w-4 mr-2" />
              Stop camera
            </Button>
          </>
        )}
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
