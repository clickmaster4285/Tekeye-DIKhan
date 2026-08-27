import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Check } from "lucide-react"
import { Link } from "react-router-dom"
import { ROUTES } from "@/routes/config"

const steps = [
  { number: 1, label: "Slot Configuration" },
  { number: 2, label: "Visitor Slot Booking" },
]

export default function TimeSlotBookingPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [slotApprovalRequired, setSlotApprovalRequired] = useState(true)
  const [emergencySlotEnabled, setEmergencySlotEnabled] = useState("enabled")
  const [slotStatus, setSlotStatus] = useState("active")
  const [visitPriority, setVisitPriority] = useState("normal")
  const [approverRequired, setApproverRequired] = useState(true)
  const [bookingStatus, setBookingStatus] = useState("pending")
  const [bookingCreatedBy, setBookingCreatedBy] = useState("visitor")

  return (
    <>
      {/* Breadcrumb */}
          <div className="text-sm text-muted-foreground mb-2">
            Home / Appointment Scheduling / <span className="text-blue-600">Time Slot Booking</span>
          </div>

          {/* Page Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground">Time Slot Booking</h1>
            <p className="text-sm text-muted-foreground">
              Schedule a time for the visit based on the department availability.
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
                <h2 className="text-lg font-semibold mb-6">Slot Configuration (Admin/Department Level)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Department ID</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="D-Dept-103" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="d1">D-Dept-103</SelectItem>
                        <SelectItem value="d2">D-Dept-104</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">System-generated department ID</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Department Name</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hr">Human Resources</SelectItem>
                        <SelectItem value="it">IT Department</SelectItem>
                        <SelectItem value="ops">Operations</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Working Days</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select days" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mon-fri">Monday - Friday</SelectItem>
                        <SelectItem value="mon-sat">Monday - Saturday</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Select the working days for this department</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Working Hours</Label>
                    <div className="flex items-center gap-2">
                      <Input type="time" placeholder="09:00 AM" className="flex-1" />
                      <span className="text-muted-foreground">to</span>
                      <Input type="time" placeholder="05:00 PM" className="flex-1" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Slot Duration</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Buffer Time</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select for (Rest / Meal)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 minutes</SelectItem>
                        <SelectItem value="10">10 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Gap between each slot</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Max Visitors per Slot</Label>
                    <Input placeholder="Set maximum capacity" />
                    <p className="text-xs text-muted-foreground">Capacity Control</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Security Level</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm text-muted-foreground">Holiday Calendar</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select calendar Sync" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default Calendar</SelectItem>
                        <SelectItem value="custom">Custom Calendar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Slot Approval Required</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <button
                        type="button"
                        onClick={() => setSlotApprovalRequired(true)}
                        className={`flex items-center gap-2 ${slotApprovalRequired ? "text-blue-600" : "text-muted-foreground"}`}
                      >
                        <div className={`w-10 h-5 rounded-full flex items-center p-0.5 transition-colors ${slotApprovalRequired ? "bg-blue-600 justify-end" : "bg-gray-300 justify-start"}`}>
                          <div className="w-4 h-4 rounded-full bg-white" />
                        </div>
                        <span className="text-sm">Yes</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlotApprovalRequired(false)}
                        className={`text-sm ${!slotApprovalRequired ? "text-blue-600" : "text-muted-foreground"}`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Emergency Slot Enabled</Label>
                    <div className="flex items-center gap-6 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="emergency"
                          checked={emergencySlotEnabled === "enabled"}
                          onChange={() => setEmergencySlotEnabled("enabled")}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className={`text-sm ${emergencySlotEnabled === "enabled" ? "text-blue-600" : "text-muted-foreground"}`}>Enabled</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="emergency"
                          checked={emergencySlotEnabled === "disabled"}
                          onChange={() => setEmergencySlotEnabled("disabled")}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className={`text-sm ${emergencySlotEnabled === "disabled" ? "text-blue-600" : "text-muted-foreground"}`}>Disabled</span>
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm text-muted-foreground">Slot Status</Label>
                    <div className="flex items-center gap-6 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="slotStatus"
                          checked={slotStatus === "active"}
                          onChange={() => setSlotStatus("active")}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className={`text-sm ${slotStatus === "active" ? "text-blue-600" : "text-muted-foreground"}`}>Active</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="slotStatus"
                          checked={slotStatus === "inactive"}
                          onChange={() => setSlotStatus("inactive")}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className={`text-sm ${slotStatus === "inactive" ? "text-blue-600" : "text-muted-foreground"}`}>Inactive</span>
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}

            {currentStep === 2 && (
              <>
                <h2 className="text-lg font-semibold mb-6">Visitor Slot Booking</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Booking ID</Label>
                    <Input placeholder="BKN-VR-01" disabled className="bg-gray-50" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Visitor ID</Label>
                    <Input placeholder="Visitor ID here" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Department ID</Label>
                    <Input placeholder="HR-01" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Preferred Date</Label>
                    <Input type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Available Slot ID</Label>
                    <Input placeholder="S-SLO-01" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Slot Start & End Time</Label>
                    <div className="flex items-center gap-2">
                      <Input type="time" className="flex-1" />
                      <span className="text-muted-foreground">to</span>
                      <Input type="time" className="flex-1" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Expected Duration</Label>
                    <Input placeholder="--:--" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Entry Gate</Label>
                    <Input placeholder="Gate here" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Visit Priority</Label>
                    <div className="flex items-center gap-6 mt-2">
                      {["normal", "urgent", "vip"].map((priority) => (
                        <label key={priority} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="visitPriority"
                            checked={visitPriority === priority}
                            onChange={() => setVisitPriority(priority)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className={`text-sm capitalize ${visitPriority === priority ? "text-blue-600" : "text-muted-foreground"}`}>
                            {priority === "vip" ? "VIP" : priority.charAt(0).toUpperCase() + priority.slice(1)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Approver Required</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <button
                        type="button"
                        onClick={() => setApproverRequired(true)}
                        className={`flex items-center gap-2 ${approverRequired ? "text-blue-600" : "text-muted-foreground"}`}
                      >
                        <div className={`w-10 h-5 rounded-full flex items-center p-0.5 transition-colors ${approverRequired ? "bg-blue-600 justify-end" : "bg-gray-300 justify-start"}`}>
                          <div className="w-4 h-4 rounded-full bg-white" />
                        </div>
                        <span className="text-sm">Yes</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setApproverRequired(false)}
                        className={`text-sm ${!approverRequired ? "text-blue-600" : "text-muted-foreground"}`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Booking Status</Label>
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {["pending", "approved", "rejected", "rescheduled"].map((status) => (
                        <label key={status} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="bookingStatus"
                            checked={bookingStatus === status}
                            onChange={() => setBookingStatus(status)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className={`text-sm capitalize ${bookingStatus === status ? "text-blue-600" : "text-muted-foreground"}`}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Booking Created By</Label>
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {["visitor", "reception", "admin"].map((creator) => (
                        <label key={creator} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="bookingCreatedBy"
                            checked={bookingCreatedBy === creator}
                            onChange={() => setBookingCreatedBy(creator)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className={`text-sm capitalize ${bookingCreatedBy === creator ? "text-blue-600" : "text-muted-foreground"}`}>
                            {creator.charAt(0).toUpperCase() + creator.slice(1)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm text-muted-foreground">Booking Created On</Label>
                    <Input type="date" className="md:w-1/2" />
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
