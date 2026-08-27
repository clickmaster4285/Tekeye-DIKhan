import { useState } from "react"
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
import { Camera, ChevronLeft, ChevronRight } from "lucide-react"

export default function PhotoCapturePage() {
  const [formData, setFormData] = useState({
    captureDate: "",
    captureTime: "",
    capturedBy: "",
    cameraLocation: "",
    photoQualityScore: "",
    faceMatchStatus: "",
  })

  return (
    <>
      {/* Breadcrumb */}
          <div className="text-sm text-muted-foreground mb-2">
            Home / Visitor Registration / <span className="text-[#3b82f6]">Photo Capture</span>
          </div>

          {/* Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground">Photo Capture</h1>
            <p className="text-sm text-muted-foreground">
              Upload the required documents to complete the visit requirements.
            </p>
          </div>

          {/* Form Container */}
          <div className="bg-background rounded-lg border border-border p-6">
            {/* Section Title */}
            <h2 className="text-lg font-medium text-foreground mb-6">Live Photo Data</h2>

            {/* Camera Capture Area */}
            <div className="flex flex-col items-center justify-center py-8 mb-6">
              <div className="w-16 h-16 rounded-full border-2 border-[#3b82f6] flex items-center justify-center mb-4">
                <Camera className="w-8 h-8 text-[#3b82f6]" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Capture a live photo for visitor identification
              </p>
              <Button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white">
                <Camera className="w-4 h-4 mr-2" />
                Capture Photo
              </Button>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Capture Date */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Capture Date</Label>
                <Input
                  type="text"
                  placeholder="DD/MM/YYYY"
                  value={formData.captureDate}
                  onChange={(e) => setFormData({ ...formData, captureDate: e.target.value })}
                  className="h-10 border-border"
                />
              </div>

              {/* Capture Time */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Capture Time</Label>
                <Input
                  type="text"
                  placeholder="--:--"
                  value={formData.captureTime}
                  onChange={(e) => setFormData({ ...formData, captureTime: e.target.value })}
                  className="h-10 border-border"
                />
              </div>

              {/* Captured By */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Captured By</Label>
                <Select
                  value={formData.capturedBy}
                  onValueChange={(value) => setFormData({ ...formData, capturedBy: value })}
                >
                  <SelectTrigger className="h-10 border-border">
                    <SelectValue placeholder="Select inspector" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inspector1">Inspector 1</SelectItem>
                    <SelectItem value="inspector2">Inspector 2</SelectItem>
                    <SelectItem value="inspector3">Inspector 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Camera Location */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Camera Location</Label>
                <Select
                  value={formData.cameraLocation}
                  onValueChange={(value) => setFormData({ ...formData, cameraLocation: value })}
                >
                  <SelectTrigger className="h-10 border-border">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrance">Main Entrance</SelectItem>
                    <SelectItem value="lobby">Lobby</SelectItem>
                    <SelectItem value="reception">Reception</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Photo Quality Score */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Photo Quality Score</Label>
                <Select
                  value={formData.photoQualityScore}
                  onValueChange={(value) => setFormData({ ...formData, photoQualityScore: value })}
                >
                  <SelectTrigger className="h-10 border-border">
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

              {/* Face Match Status */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Face Match Status</Label>
                <Select
                  value={formData.faceMatchStatus}
                  onValueChange={(value) => setFormData({ ...formData, faceMatchStatus: value })}
                >
                  <SelectTrigger className="h-10 border-border">
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

            {/* Action Buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
              <div className="flex items-center gap-3">
                <Button variant="outline" className="border-border bg-transparent">
                  Cancel
                </Button>
                <Button variant="link" className="text-[#3b82f6] p-0">
                  Save & Continue
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" className="bg-transparent border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6]/10">
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <Button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white">
                  Next Step
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
    </>
  )
}
