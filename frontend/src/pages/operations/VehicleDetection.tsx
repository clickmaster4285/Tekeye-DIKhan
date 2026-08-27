"use client"

import { useRef, useEffect, useState } from "react"
import { Video, Camera } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCameraErrorMessage, requestUserMedia } from "@/lib/utils"

const YOLO_VIDEO_SRC = "/After YOLO object detection (Output Video).mp4"

export default function VehicleDetectionPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [])

  const startCameraFeed = async () => {
    setCameraError(null)
    if (streamRef.current) {
      cameraVideoRef.current?.play()
      setCameraActive(true)
      return
    }
    try {
      const stream = await requestUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream
        cameraVideoRef.current.play().catch(() => {})
      }
      setCameraActive(true)
    } catch (err) {
      setCameraError(getCameraErrorMessage(err))
    }
  }

  const stopCameraFeed = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null
    setCameraActive(false)
    setCameraError(null)
  }

  return (
    <ModulePageLayout
      title="Vehicle Detection"
      description="YOLO vehicle detection output and live camera feed."
      breadcrumbs={[{ label: "AI Analytics" }, { label: "Vehicle Detection" }]}
    >
      <div className="space-y-6">
        {/* Output video from public folder */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" /> Detection output
              </CardTitle>
              <CardDescription>After YOLO object detection (output video)</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border bg-black/5 overflow-hidden">
              <video
                ref={videoRef}
                src={YOLO_VIDEO_SRC}
                controls
                className="w-full max-h-[480px] object-contain"
                playsInline
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </CardContent>
        </Card>

        {/* Camera feed below video */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" /> Camera feed
              </CardTitle>
              <CardDescription>Live camera feed for vehicle detection</CardDescription>
            </div>
            <div className="flex gap-2">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={startCameraFeed}
                  className="rounded-md bg-[#3366FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#2952CC]"
                >
                  Start camera
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCameraFeed}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted/50"
                >
                  Stop camera
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {cameraError && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2 mb-4">
                {cameraError}
              </div>
            )}
            <div className="rounded-lg border border-border bg-black aspect-video max-w-2xl overflow-hidden flex items-center justify-center">
              {cameraActive ? (
                <video
                  ref={cameraVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
                  <Camera className="h-12 w-12 opacity-50" />
                  <span>Camera feed will appear here</span>
                  <span className="text-xs">Click &quot;Start camera&quot; to begin</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
