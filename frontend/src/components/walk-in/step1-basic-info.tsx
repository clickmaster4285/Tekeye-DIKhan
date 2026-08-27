"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Camera, Car, MapPin, Video, VideoOff, AlertCircle } from "lucide-react"
import { getCameraErrorMessage, requestUserMedia } from "@/lib/utils"

interface WalkInStep1Props {
  formData: {
    registrationType: string
    fullName: string
    cnicPassport: string
    nationality: string
    mobileNumber: string
    photoCapture: string
    visitPurpose: string
    department: string
    hostName: string
    location: string
    vehicleName: string
    vehicleType: string
    vehicleNumberPlate: string
    driverName: string
    driverLicenseNo: string
    driverContact: string
    vehiclePhoto: string
  }
  updateFormData: (data: Partial<WalkInStep1Props["formData"]>) => void
}

export function WalkInStep1BasicInfo({
  formData,
  updateFormData,
}: WalkInStep1Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [showCameraPanel, setShowCameraPanel] = useState(false)
  const [captureMode, setCaptureMode] = useState<"visitor" | "vehicle">("visitor")
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

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

  // Once stream is set, attach to video and play (ref is ready after render)
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
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
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
    if (captureMode === "vehicle") {
      updateFormData({ vehiclePhoto: dataUrl })
    } else {
      updateFormData({ photoCapture: dataUrl })
    }
    stopCamera()
    setShowCameraPanel(false)
    setError(null)
  }

  const openPhotoCapture = () => {
    setCaptureMode("visitor")
    setShowCameraPanel(true)
    setError(null)
  }

  const openVehiclePhotoCapture = () => {
    setCaptureMode("vehicle")
    setShowCameraPanel(true)
    setError(null)
  }

  const closePhotoCapture = () => {
    stopCamera()
    setShowCameraPanel(false)
    setError(null)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">
        Basic Visitor Information
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Registration Type */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Registration Type
          </Label>
          <Select
            value={formData.registrationType}
            onValueChange={(value) =>
              updateFormData({ registrationType: value })
            }
          >
            <SelectTrigger className="w-full h-9 bg-background">
              <SelectValue placeholder="Walk-in" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="walk-in">Walk-in</SelectItem>
              <SelectItem value="appointment">Appointment</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Full Name */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Full Name <span className="text-red-500">*</span>{" "}
            <span className="text-muted-foreground text-sm">(as per CNIC/Passport)</span>
          </Label>
          <Input
            placeholder="e.g. Muhammad Ali Hassan"
            value={formData.fullName}
            onChange={(e) => updateFormData({ fullName: e.target.value })}
            className="bg-background"
          />
        </div>

        {/* CNIC / Passport Number */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            CNIC / Passport Number <span className="text-red-500">*</span>
          </Label>
          <Input
            placeholder="XXXXX-XXXXXXX-X"
            value={formData.cnicPassport}
            onChange={(e) => updateFormData({ cnicPassport: e.target.value })}
            className="bg-background"
          />
        </div>

        {/* Nationality */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Nationality <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.nationality}
            onValueChange={(value) => updateFormData({ nationality: value })}
          >
            <SelectTrigger className="w-full h-9 bg-background">
              <SelectValue placeholder="Pakistani" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pakistani">Pakistani</SelectItem>
              <SelectItem value="indian">Indian</SelectItem>
              <SelectItem value="american">American</SelectItem>
              <SelectItem value="british">British</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Number */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Mobile Number <span className="text-red-500">*</span>
          </Label>
          <Input
            placeholder="0300-0000000"
            value={formData.mobileNumber}
            onChange={(e) => updateFormData({ mobileNumber: e.target.value })}
            className="bg-background"
          />
        </div>

        {/* Photo Capture */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Photo Capture
          </Label>
          <div className="relative">
            <Input
              placeholder="Take Photo"
              value={formData.photoCapture ? "Photo captured" : ""}
              readOnly
              onClick={openPhotoCapture}
              className="bg-background pr-10 cursor-pointer"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={openPhotoCapture}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            >
              <Camera className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
          {formData.photoCapture && (
            <div className="mt-2 flex items-center gap-2">
              <img
                src={formData.photoCapture}
                alt="Captured"
                className="h-14 w-14 rounded object-cover border border-border"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openPhotoCapture}
                className="text-xs"
              >
                Retake
              </Button>
            </div>
          )}
          {/* Camera panel - inline below field when opened */}
          {showCameraPanel && (
            <div className="mt-4 p-4 rounded-lg border border-border bg-muted/20 space-y-3">
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm py-2 px-3 bg-destructive/10 rounded-md">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {!stream && (
                <div className="flex flex-col items-start gap-3">
                  {!error && (
                    <p className="text-sm text-muted-foreground">
                      {captureMode === "vehicle"
                        ? "Click Start Camera to capture the vehicle photo."
                        : "Click Start Camera to open your camera, then capture your photo."}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={startCamera}
                      disabled={isLoading}
                      className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
                    >
                      {isLoading ? "Opening…" : <><Video className="w-4 h-4 mr-2" /> {error ? "Try again" : "Start Camera"}</>}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={closePhotoCapture}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {stream && (
                <div className="space-y-3">
                  <div className="relative rounded overflow-hidden bg-black aspect-video max-w-sm">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                      style={{ transform: "scaleX(-1)" }}
                    />
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCapture}
                      className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      {captureMode === "vehicle" ? "Capture vehicle photo" : "Capture Photo"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => { stopCamera(); setShowCameraPanel(false); }}>
                      <VideoOff className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Visit Purpose */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Visit Purpose <span className="text-red-500">*</span>
          </Label>
          <Input
            placeholder="Enter the brief purpose of this visit"
            value={formData.visitPurpose}
            onChange={(e) => updateFormData({ visitPurpose: e.target.value })}
            className="bg-background"
          />
        </div>

        {/* Department */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Department <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.department}
            onValueChange={(value) => updateFormData({ department: value })}
          >
            <SelectTrigger className="w-full h-9 bg-background">
              <SelectValue placeholder="Select the department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="clearance">Customs Clearance</SelectItem>
              <SelectItem value="appraisal">Appraisal</SelectItem>
              <SelectItem value="enforcement">Enforcement</SelectItem>
              <SelectItem value="intelligence">Intelligence</SelectItem>
              <SelectItem value="legal">Legal</SelectItem>
              <SelectItem value="bonded-warehouse">Bonded Warehouse</SelectItem>
              <SelectItem value="transit">Transit</SelectItem>
              <SelectItem value="preventive">Preventive</SelectItem>
              <SelectItem value="valuation">Valuation</SelectItem>
              <SelectItem value="ict">ICT</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="hr">Human Resources</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Host Name */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Host Name
          </Label>
          <Select
            value={formData.hostName}
            onValueChange={(value) => updateFormData({ hostName: value })}
          >
            <SelectTrigger className="w-full h-9 bg-background">
              <SelectValue placeholder="Select the hosting official Name" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="john-doe">John Doe</SelectItem>
              <SelectItem value="jane-smith">Jane Smith</SelectItem>
              <SelectItem value="ahmed-ali">Ahmed Ali</SelectItem>
              <SelectItem value="sarah-khan">Sarah Khan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Location
          </Label>
          <div className="relative">
            <Input
              placeholder="Choose on map"
              value={formData.location}
              onChange={(e) => updateFormData({ location: e.target.value })}
              className="bg-background pr-10"
              readOnly
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            >
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </div>

      {/* Vehicle Information */}
      <div className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-base font-medium text-foreground flex items-center gap-2">
          <Car className="w-4 h-4" /> Vehicle Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Vehicle name / make</Label>
            <Input
              placeholder="e.g. Toyota Corolla"
              value={formData.vehicleName}
              onChange={(e) => updateFormData({ vehicleName: e.target.value })}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Vehicle type</Label>
            <Select
              value={formData.vehicleType}
              onValueChange={(value) => updateFormData({ vehicleType: value })}
            >
<SelectTrigger className="w-full h-9 bg-background">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
              <SelectContent>
                <SelectItem value="car">Car</SelectItem>
                <SelectItem value="motorcycle">Motorcycle</SelectItem>
                <SelectItem value="van">Van</SelectItem>
                <SelectItem value="truck">Truck</SelectItem>
                <SelectItem value="bus">Bus</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Number plate</Label>
            <Input
              placeholder="e.g. ABC-1234"
              value={formData.vehicleNumberPlate}
              onChange={(e) => updateFormData({ vehicleNumberPlate: e.target.value })}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Driver name</Label>
            <Input
              placeholder="Full name of driver"
              value={formData.driverName}
              onChange={(e) => updateFormData({ driverName: e.target.value })}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Driver license no.</Label>
            <Input
              placeholder="License number"
              value={formData.driverLicenseNo}
              onChange={(e) => updateFormData({ driverLicenseNo: e.target.value })}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Driver contact</Label>
            <Input
              placeholder="Phone number"
              value={formData.driverContact}
              onChange={(e) => updateFormData({ driverContact: e.target.value })}
              className="bg-background"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-sm font-medium text-foreground">Vehicle photo</Label>
            <div className="relative">
              <Input
                placeholder="Take photo of vehicle"
                value={formData.vehiclePhoto ? "Vehicle photo captured" : ""}
                readOnly
                onClick={openVehiclePhotoCapture}
                className="bg-background pr-10 cursor-pointer"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={openVehiclePhotoCapture}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              >
                <Camera className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            {formData.vehiclePhoto && (
              <div className="mt-2 flex items-center gap-2">
                <img
                  src={formData.vehiclePhoto}
                  alt="Vehicle"
                  className="h-20 rounded object-cover border border-border"
                />
                <Button type="button" variant="outline" size="sm" onClick={openVehiclePhotoCapture} className="text-xs">
                  Retake
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
