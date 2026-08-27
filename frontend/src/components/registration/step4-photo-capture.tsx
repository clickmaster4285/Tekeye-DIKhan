"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Camera, Video, VideoOff, AlertCircle } from "lucide-react"
import { getCameraErrorMessage, requestUserMedia } from "@/lib/utils"

export interface PhotoCaptureFormData {
  captureDate: string
  captureTime: string
  capturedBy: string
  cameraLocation: string
  photoQualityScore: string
  faceMatchStatus: string
  capturedPhoto?: string
}

interface Step4PhotoCaptureProps {
  formData: PhotoCaptureFormData
  updateFormData: (data: Partial<PhotoCaptureFormData>) => void
}

export function Step4PhotoCapture({ formData, updateFormData }: Step4PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(formData.capturedPhoto || null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isVideoReady, setIsVideoReady] = useState(false)

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
  }, [stream])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return
    video.srcObject = stream
    const playVideo = async () => {
      try {
        await video.play()
        setIsVideoReady(true)
      } catch (playError) {
        const message =
          playError instanceof Error
            ? playError.message
            : "Could not start camera playback."
        setError(message)
      }
    }
    playVideo()
  }, [stream])

  const startCamera = async () => {
    setError(null)
    setIsLoading(true)
    setIsVideoReady(false)
    try {
      const mediaStream = await requestUserMedia({
        video: { facingMode: "user" },
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
    if (!videoRef.current || !stream || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    if (!video.videoWidth || !video.videoHeight) {
      setError("Camera not ready yet. Please wait a moment and try again.")
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92)
    setCapturedImage(dataUrl)
    updateFormData({ capturedPhoto: dataUrl })
    stopCamera()
    const now = new Date()
    updateFormData({
      captureDate: now.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }),
      captureTime: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
    })
  }

  const handleRetake = () => {
    setCapturedImage(null)
    updateFormData({ capturedPhoto: "" })
    setError(null)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-base font-medium text-foreground">Live Photo Data</h3>

      {/* Camera Capture Area */}
      <div className="flex flex-col items-center justify-center py-6 rounded-lg border border-border bg-muted/20 overflow-hidden">
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm mb-4 px-4 py-2 bg-destructive/10 rounded-md w-full max-w-md">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!stream && !capturedImage && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-20 h-20 rounded-full border-2 border-[#3b82f6] flex items-center justify-center mb-4 bg-muted/50">
              <Camera className="w-10 h-10 text-[#3b82f6]" />
            </div>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
              Click below to turn on your camera. Position your face in the frame, then capture the photo.
            </p>
            <Button
              type="button"
              onClick={startCamera}
              disabled={isLoading}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
            >
              {isLoading ? (
                <>
                  <span className="animate-pulse">Opening camera…</span>
                </>
              ) : (
                <>
                  <Video className="w-4 h-4 mr-2" />
                  Start Camera
                </>
              )}
            </Button>
          </div>
        )}

        {stream && !capturedImage && (
          <div className="w-full max-w-md space-y-4">
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                width={640}
                height={480}
                className="w-full h-full object-cover mirror"
                style={{ transform: "scaleX(-1)" }}
              />
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={stopCamera}
                className="border-border"
              >
                <VideoOff className="w-4 h-4 mr-2" />
                Stop Camera
              </Button>
              <Button
                type="button"
                onClick={handleCapture}
                disabled={!isVideoReady}
                className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
              >
                <Camera className="w-4 h-4 mr-2" />
                Capture Photo
              </Button>
            </div>
          </div>
        )}

        {capturedImage && (
          <div className="w-full max-w-md space-y-4">
            <p className="text-sm font-medium text-foreground">Captured photo</p>
            <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
              <img
                src={capturedImage}
                alt="Captured"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleRetake}
                className="border-border"
              >
                Retake Photo
              </Button>
              <Button
                type="button"
                onClick={startCamera}
                className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
              >
                <Camera className="w-4 h-4 mr-2" />
                Capture Again
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Capture Date</Label>
          <Input
            placeholder="DD/MM/YYYY"
            value={formData.captureDate}
            onChange={(e) => updateFormData({ captureDate: e.target.value })}
            className="h-11 border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Capture Time</Label>
          <Input
            placeholder="--:--"
            value={formData.captureTime}
            onChange={(e) => updateFormData({ captureTime: e.target.value })}
            className="h-11 border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Captured By</Label>
          <Select
            value={formData.capturedBy}
            onValueChange={(value) => updateFormData({ capturedBy: value })}
          >
            <SelectTrigger className="h-11 border-border">
              <SelectValue placeholder="Select inspector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inspector1">Inspector 1</SelectItem>
              <SelectItem value="inspector2">Inspector 2</SelectItem>
              <SelectItem value="inspector3">Inspector 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Camera Location</Label>
          <Select
            value={formData.cameraLocation}
            onValueChange={(value) => updateFormData({ cameraLocation: value })}
          >
            <SelectTrigger className="h-11 border-border">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="entrance">Main Entrance</SelectItem>
              <SelectItem value="lobby">Lobby</SelectItem>
              <SelectItem value="reception">Reception</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Photo Quality Score</Label>
          <Select
            value={formData.photoQualityScore}
            onValueChange={(value) => updateFormData({ photoQualityScore: value })}
          >
            <SelectTrigger className="h-11 border-border">
              <SelectValue placeholder="Select score" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="excellent">Excellent</SelectItem>
              <SelectItem value="good">Good</SelectItem>
              <SelectItem value="fair">Fair</SelectItem>
              <SelectItem value="poor">Poor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Face Match Status</Label>
          <Select
            value={formData.faceMatchStatus}
            onValueChange={(value) => updateFormData({ faceMatchStatus: value })}
          >
            <SelectTrigger className="h-11 border-border">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="matched">Matched</SelectItem>
              <SelectItem value="not-matched">Not Matched</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
