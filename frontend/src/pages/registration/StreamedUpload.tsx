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
import { Check, ChevronLeft, ChevronRight, Upload } from "lucide-react"
import { cn } from "@/lib/utils"

const steps = [
  { id: 1, label: "Identity Documents" },
  { id: 2, label: "Supporting Documents" },
]

export default function StreamedUploadPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    // Step 1 - Identity Documents
    documentType: "",
    documentNo: "",
    issuingAuthority: "",
    expiryDate: "",
    frontImage: "",
    backImage: "",
    // Step 2 - Supporting Documents
    supportDocType: "",
    applicationLetter: "",
    letterRefNo: "",
    additionalDocument: "",
    uploadProcedure: "",
  })

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <>
      {/* Breadcrumb */}
          <div className="text-sm text-muted-foreground mb-2">
            Home / Visitor Registration / <span className="text-[#3b82f6]">Document Upload</span>
          </div>

          {/* Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground">Document Upload</h1>
            <p className="text-sm text-muted-foreground">
              Upload the required documents to complete the visit requirements.
            </p>
          </div>

          {/* Form Container */}
          <div className="bg-background rounded-lg border border-border p-6">
            {/* Step Indicator */}
            <div className="flex items-center justify-center mb-8">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className="flex items-center">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                        currentStep > step.id
                          ? "bg-[#3b82f6] text-white"
                          : currentStep === step.id
                            ? "bg-[#3b82f6] text-white"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {currentStep > step.id ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        step.id
                      )}
                    </div>
                    <span
                      className={cn(
                        "ml-2 text-sm font-medium",
                        currentStep >= step.id
                          ? "text-[#3b82f6]"
                          : "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        "w-24 h-0.5 mx-4",
                        currentStep > step.id ? "bg-[#3b82f6]" : "bg-muted"
                      )}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1 - Identity Documents */}
            {currentStep === 1 && (
              <div>
                <h2 className="text-lg font-medium text-foreground mb-6">Basic Visitor Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Document Type */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Document Type</Label>
                    <Select
                      value={formData.documentType}
                      onValueChange={(value) => setFormData({ ...formData, documentType: value })}
                    >
                      <SelectTrigger className="h-10 border-border">
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cnic">CNIC</SelectItem>
                        <SelectItem value="passport">Passport</SelectItem>
                        <SelectItem value="driving-license">Driving License</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Document No. */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Document No.</Label>
                    <Input
                      type="text"
                      placeholder="Enter document ID number"
                      value={formData.documentNo}
                      onChange={(e) => setFormData({ ...formData, documentNo: e.target.value })}
                      className="h-10 border-border"
                    />
                  </div>

                  {/* Issuing Authority */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Issuing Authority</Label>
                    <Select
                      value={formData.issuingAuthority}
                      onValueChange={(value) => setFormData({ ...formData, issuingAuthority: value })}
                    >
                      <SelectTrigger className="h-10 border-border">
                        <SelectValue placeholder="Select issuing authority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nadra">NADRA</SelectItem>
                        <SelectItem value="passport-office">Passport Office</SelectItem>
                        <SelectItem value="excise">Excise & Taxation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Expiry Date */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Expiry Date</Label>
                    <Input
                      type="text"
                      placeholder="Enter the date (DD/MM/YYYY)"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="h-10 border-border"
                    />
                  </div>

                  {/* Front Image */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Front Image</Label>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Upload document front side"
                        value={formData.frontImage}
                        readOnly
                        className="h-10 border-border pr-10"
                      />
                      <Upload className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Back Image */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Back Image</Label>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Upload document back side"
                        value={formData.backImage}
                        readOnly
                        className="h-10 border-border pr-10"
                      />
                      <Upload className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 - Supporting Documents */}
            {currentStep === 2 && (
              <div>
                <h2 className="text-lg font-medium text-foreground mb-6">Supporting Documents</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Document Type */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Document Type</Label>
                    <Select
                      value={formData.supportDocType}
                      onValueChange={(value) => setFormData({ ...formData, supportDocType: value })}
                    >
                      <SelectTrigger className="h-10 border-border">
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="application">Application Letter</SelectItem>
                        <SelectItem value="noc">NOC</SelectItem>
                        <SelectItem value="invitation">Invitation Letter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Application Letter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Application Letter</Label>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Upload application letter"
                        value={formData.applicationLetter}
                        readOnly
                        className="h-10 border-border pr-10"
                      />
                      <Upload className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Letter Ref. No. */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Letter Ref. No.</Label>
                    <Input
                      type="text"
                      placeholder="Enter ref"
                      value={formData.letterRefNo}
                      onChange={(e) => setFormData({ ...formData, letterRefNo: e.target.value })}
                      className="h-10 border-border"
                    />
                  </div>

                  {/* Upload Procedure */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Upload Procedure</Label>
                    <Select
                      value={formData.uploadProcedure}
                      onValueChange={(value) => setFormData({ ...formData, uploadProcedure: value })}
                    >
                      <SelectTrigger className="h-10 border-border">
                        <SelectValue placeholder="Select procedure" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual Upload</SelectItem>
                        <SelectItem value="scan">Scan & Upload</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Additional Document */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Additional Document</Label>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Upload additional document"
                        value={formData.additionalDocument}
                        readOnly
                        className="h-10 border-border pr-10"
                      />
                      <Upload className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                {currentStep > 1 && (
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    className="bg-transparent border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6]/10"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                )}
                <Button
                  onClick={handleNext}
                  className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
                >
                  {currentStep === 2 ? "Submit" : "Next"}
                  {currentStep < 2 && <ChevronRight className="w-4 h-4 ml-1" />}
                </Button>
              </div>
            </div>
          </div>
    </>
  )
}
