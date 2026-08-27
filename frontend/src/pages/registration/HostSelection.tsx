import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Check } from "lucide-react"
import { Link } from "react-router-dom"
import { ROUTES } from "@/routes/config"

const steps = [
  { number: 1, label: "Host Master Data" },
  { number: 2, label: "Host Assignment" },
]

export default function HostSelectionPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [activeStatus, setActiveStatus] = useState(true)
  const [hostAcceptanceRequired, setHostAcceptanceRequired] = useState(true)
  const [escortRequired, setEscortRequired] = useState(true)

  return (
    <>
      {/* Breadcrumb */}
          <div className="text-sm text-muted-foreground mb-2">
            Home / Appointment Scheduling / <span className="text-blue-600">Host Selection</span>
          </div>

          {/* Page Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground">Host Selection</h1>
            <p className="text-sm text-muted-foreground">
              Assign host/employee/official as main.
            </p>
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
                      currentStep >= step.number ? "text-[#3b82f6] font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && <div className="w-24 h-[2px] bg-gray-200 mx-4" />}
              </div>
            ))}
          </div>

          {/* Form Content */}
          <div className="bg-white rounded-lg border p-6 mb-6">
            {currentStep === 1 && (
              <>
                <h2 className="text-lg font-semibold mb-6">Host Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Host ID</Label>
                    <Input placeholder="Enter Host ID" />
                    <p className="text-xs text-muted-foreground">Contain employee/department</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Host Full Name</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select host name" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ali">Ali Ahmed</SelectItem>
                        <SelectItem value="khan">Hassan Khan</SelectItem>
                        <SelectItem value="sheikh">Muhammad Sheikh</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Designation</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select designation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="director">Director</SelectItem>
                        <SelectItem value="officer">Officer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Department</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hr">Human Resources</SelectItem>
                        <SelectItem value="it">IT Department</SelectItem>
                        <SelectItem value="ops">Operations</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Employee ID</Label>
                    <Input placeholder="Enter ID" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Official Email Address</Label>
                    <Input type="email" placeholder="Enter email address" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Official Mobile Number</Label>
                    <Input placeholder="Enter number" />
                    <p className="text-xs text-muted-foreground">Allow notification</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Official Location</Label>
                    <Input placeholder="e.g. Location" />
                    <p className="text-xs text-muted-foreground">Floor/Building</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Availability Status</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="busy">Busy</SelectItem>
                        <SelectItem value="away">Away</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Max Visits Per Day</Label>
                    <Input placeholder="Visits Limit" />
                    <p className="text-xs text-muted-foreground">Capacity control</p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm text-muted-foreground">Approval Authority Level</Label>
                    <Select>
                      <SelectTrigger className="md:w-1/2">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="level1">Level 1</SelectItem>
                        <SelectItem value="level2">Level 2</SelectItem>
                        <SelectItem value="level3">Level 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm text-muted-foreground">Active Status</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <button
                        type="button"
                        onClick={() => setActiveStatus(true)}
                        className={`flex items-center gap-2 ${activeStatus ? "text-blue-600" : "text-muted-foreground"}`}
                      >
                        <div className={`w-10 h-5 rounded-full flex items-center p-0.5 transition-colors ${activeStatus ? "bg-blue-600 justify-end" : "bg-gray-300 justify-start"}`}>
                          <div className="w-4 h-4 rounded-full bg-white" />
                        </div>
                        <span className="text-sm">Active</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveStatus(false)}
                        className={`text-sm ${!activeStatus ? "text-blue-600" : "text-muted-foreground"}`}
                      >
                        Inactive
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {currentStep === 2 && (
              <>
                <h2 className="text-lg font-semibold mb-6">Host Assignment Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Selected Official</Label>
                    <Input placeholder="Selected Official Name" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Host Acceptance Required</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Yes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Host Response Status</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Pending" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="declined">Declined</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Host Approval Date</Label>
                    <Input type="date" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm text-muted-foreground">Backup Host ID</Label>
                    <Input placeholder="E.g. backup Official ID" className="md:w-1/2" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm text-muted-foreground">Host Remarks</Label>
                    <Textarea placeholder="Host Remarks here" rows={4} />
                    <p className="text-xs text-muted-foreground">Optional notes</p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm text-muted-foreground">Escort Required</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <button
                        type="button"
                        onClick={() => setEscortRequired(true)}
                        className={`flex items-center gap-2 ${escortRequired ? "text-blue-600" : "text-muted-foreground"}`}
                      >
                        <div className={`w-10 h-5 rounded-full flex items-center p-0.5 transition-colors ${escortRequired ? "bg-blue-600 justify-end" : "bg-gray-300 justify-start"}`}>
                          <div className="w-4 h-4 rounded-full bg-white" />
                        </div>
                        <span className="text-sm">Yes</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEscortRequired(false)}
                        className={`text-sm ${!escortRequired ? "text-blue-600" : "text-muted-foreground"}`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to={ROUTES.APPOINTMENT_SCHEDULING}>
                <Button variant="outline">Cancel</Button>
              </Link>
              <Button variant="link" className="text-blue-600">
                Save & Continue
              </Button>
            </div>
            <div className="flex items-center gap-3">
              {currentStep > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  &larr; Previous
                </Button>
              )}
              {currentStep < 2 ? (
                <Button onClick={() => setCurrentStep(currentStep + 1)} className="bg-blue-600 hover:bg-blue-700">
                  Next &rarr;
                </Button>
              ) : (
                <Button className="bg-green-600 hover:bg-green-700">Next Step &rarr;</Button>
              )}
            </div>
          </div>
    </>
  )
}
