import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AccessZoneSelect } from "@/components/vms/access-zone-select"
import { ChevronLeft, ChevronRight, Check } from "lucide-react"
import { Link } from "react-router-dom"
import { ROUTES } from "@/routes/config"

const steps = [
  { number: 1, label: "Visit Type Master" },
  { number: 2, label: "Visit Details" },
]

export default function VisitPurposePage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    // Step 1
    visitTypeId: "",
    visitTypeName: "",
    visitDescription: "",
    securityLevel: "",
    approvalWorkflow: "",
    allowedDepartments: "",
    allowedZones: "",
    maxVisitDuration: "",
    documentRequirements: "",
    escortMandatory: "yes",
    activeStatus: "active",
    // Step 2
    visitType: "",
    visitPurposeDescription: "",
    referenceNumber: "",
    isRepeatVisit: "",
    previousVisitId: "",
    confidentialVisit: "",
    supportingNotes: "",
  })

  const handleNext = () => {
    if (currentStep < 2) setCurrentStep(currentStep + 1)
  }

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  return (
    <>
      {/* Breadcrumb */}
          <div className="mb-2">
            <nav className="text-sm text-muted-foreground">
              <Link to={ROUTES.DASHBOARD} className="hover:text-foreground">Home</Link>
              <span className="mx-2">/</span>
              <Link to={ROUTES.APPOINTMENT_SCHEDULING} className="hover:text-foreground">Appointment Scheduling</Link>
              <span className="mx-2">/</span>
              <span className="text-[#3b82f6]">Visit Purpose</span>
            </nav>
          </div>

          {/* Page Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground">Visit Purpose</h1>
            <p className="text-sm text-muted-foreground">Select visitor type (official, vendor, interview and contractor).</p>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-4 mb-8">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      currentStep > step.number
                        ? "bg-[#3b82f6] text-white"
                        : currentStep === step.number
                        ? "bg-[#3b82f6] text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {currentStep > step.number ? <Check size={16} /> : step.number}
                  </div>
                  <span
                    className={`text-sm ${
                      currentStep >= step.number ? "text-[#3b82f6] font-medium" : "text-gray-500"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className="w-24 h-[2px] bg-gray-200 mx-4">
                    <div
                      className={`h-full bg-[#3b82f6] transition-all ${
                        currentStep > step.number ? "w-full" : "w-0"
                      }`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            {currentStep === 1 && (
              <div>
                <h2 className="text-lg font-semibold mb-6">Visit Type Master</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Visit Type ID</label>
                    <Input
                      placeholder="Enter Visit ID"
                      value={formData.visitTypeId}
                      onChange={(e) => setFormData({ ...formData, visitTypeId: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">System assigns requirement</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Visit Type Name</label>
                    <Input
                      placeholder="Select Visit name"
                      value={formData.visitTypeName}
                      onChange={(e) => setFormData({ ...formData, visitTypeName: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2">Visit Description</label>
                    <Textarea
                      placeholder="Enter visit explanation"
                      rows={3}
                      value={formData.visitDescription}
                      onChange={(e) => setFormData({ ...formData, visitDescription: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Security Level</label>
                    <Select value={formData.securityLevel} onValueChange={(v) => setFormData({ ...formData, securityLevel: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Approval Workflow</label>
                    <Select value={formData.approvalWorkflow} onValueChange={(v) => setFormData({ ...formData, approvalWorkflow: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Workflow Level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single Approval Level</SelectItem>
                        <SelectItem value="dual">Dual Approval Level</SelectItem>
                        <SelectItem value="multi">Multi-Level Approval</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">(Required Approval Level)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Allowed Departments</label>
                    <Select value={formData.allowedDepartments} onValueChange={(v) => setFormData({ ...formData, allowedDepartments: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department(s)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        <SelectItem value="hr">Human Resources</SelectItem>
                        <SelectItem value="it">IT Department</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="operations">Operations</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Allowed Zones</label>
                    <AccessZoneSelect
                      value={formData.allowedZones}
                      onValueChange={(v) => setFormData({ ...formData, allowedZones: v })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Maximum Visit Duration</label>
                    <Input
                      placeholder="Duration"
                      value={formData.maxVisitDuration}
                      onChange={(e) => setFormData({ ...formData, maxVisitDuration: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">(Require Duration)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Document Requirements</label>
                    <Select value={formData.documentRequirements} onValueChange={(v) => setFormData({ ...formData, documentRequirements: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="File/File" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="id">ID Proof Required</SelectItem>
                        <SelectItem value="nda">NDA Required</SelectItem>
                        <SelectItem value="both">ID + NDA Required</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">(Mandatory Uploads)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Escort Mandatory</label>
                    <div className="flex items-center gap-6 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="escortMandatory"
                          checked={formData.escortMandatory === "yes"}
                          onChange={() => setFormData({ ...formData, escortMandatory: "yes" })}
                          className="w-4 h-4 text-[#3b82f6]"
                        />
                        <span className="text-sm">Yes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="escortMandatory"
                          checked={formData.escortMandatory === "no"}
                          onChange={() => setFormData({ ...formData, escortMandatory: "no" })}
                          className="w-4 h-4 text-[#3b82f6]"
                        />
                        <span className="text-sm">No</span>
                      </label>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2">Active Status</label>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="activeStatus"
                          checked={formData.activeStatus === "active"}
                          onChange={() => setFormData({ ...formData, activeStatus: "active" })}
                          className="w-4 h-4 text-[#3b82f6]"
                        />
                        <span className="text-sm">Active</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="activeStatus"
                          checked={formData.activeStatus === "inactive"}
                          onChange={() => setFormData({ ...formData, activeStatus: "inactive" })}
                          className="w-4 h-4 text-[#3b82f6]"
                        />
                        <span className="text-sm">Inactive</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div>
                <h2 className="text-lg font-semibold mb-6">Visit Details</h2>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Visit Type</label>
                    <Select value={formData.visitType} onValueChange={(v) => setFormData({ ...formData, visitType: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="official">Official Visit</SelectItem>
                        <SelectItem value="vendor">Vendor Meeting</SelectItem>
                        <SelectItem value="interview">Interview</SelectItem>
                        <SelectItem value="contractor">Contractor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Visit Purpose Description</label>
                    <Textarea
                      placeholder="Enter visit explanation"
                      rows={3}
                      value={formData.visitPurposeDescription}
                      onChange={(e) => setFormData({ ...formData, visitPurposeDescription: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Reference Number</label>
                      <Select value={formData.referenceNumber} onValueChange={(v) => setFormData({ ...formData, referenceNumber: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select reference number" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ref-001">REF-001</SelectItem>
                          <SelectItem value="ref-002">REF-002</SelectItem>
                          <SelectItem value="ref-003">REF-003</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Is Repeat Visit</label>
                      <Select value={formData.isRepeatVisit} onValueChange={(v) => setFormData({ ...formData, isRepeatVisit: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Previous Visit ID</label>
                      <Input
                        placeholder="Auto-generated"
                        value={formData.previousVisitId}
                        onChange={(e) => setFormData({ ...formData, previousVisitId: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Confidential Visit</label>
                      <Select value={formData.confidentialVisit} onValueChange={(v) => setFormData({ ...formData, confidentialVisit: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Supporting Notes</label>
                    <Textarea
                      placeholder="Enter additional remarks"
                      rows={3}
                      value={formData.supportingNotes}
                      onChange={(e) => setFormData({ ...formData, supportingNotes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-3">
              <Button variant="outline" className="bg-transparent">Cancel</Button>
              <Button variant="link" className="text-[#3b82f6]">Save & Continue</Button>
            </div>
            <div className="flex items-center gap-3">
              {currentStep > 1 && (
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  className="bg-[#3b82f6] text-white hover:bg-[#2563eb] border-0"
                >
                  <ChevronLeft size={16} className="mr-1" />
                  Previous
                </Button>
              )}
              <Button
                onClick={handleNext}
                className="bg-[#3b82f6] text-white hover:bg-[#2563eb]"
              >
                {currentStep === 2 ? "Next Step" : "Next"}
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </div>
    </>
  )
}
