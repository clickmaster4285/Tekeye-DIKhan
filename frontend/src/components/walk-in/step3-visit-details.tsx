"use client"

import { useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Button } from "@/components/ui/button"
import { Clock, Pencil, Calendar, Shield, AlertCircle, Users, CheckCircle } from "lucide-react"
import { useFormik } from "formik"
import * as Yup from "yup"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { AccessZoneSelect } from "@/components/vms/access-zone-select"
import { getStoredUser } from "@/lib/auth"
import { canSeeAllLocations } from "@/lib/location-access"
import { LOCATION_OPTIONS, locationLabel } from "@/lib/locations"

export interface WalkInStep3VisitDetailsFormData {
  location?: string
  accessZone?: string
  visitPurpose: string
  visitPurposeDescription: string
  department: string
  departmentForSlot: string
  hostFullName: string
  hostDesignation: string
  hostDepartment: string
  hostEmail: string
  hostContactNumber: string
  preferredDate: string
  preferredTimeSlot: string
  slotDuration: string
  priorityLevel: string
  securityLevel?: string
  allowedDepartments?: string
  entryGate?: string
  maxVisitDuration?: string
  allowedZones?: string
  timeValidityStart?: string
  timeValidityEnd?: string
  additionalRemarks?: string
  escortMandatory?: string
}

interface WalkInStep3VisitDetailsProps {
  formData: WalkInStep3VisitDetailsFormData
  updateFormData: (data: Partial<WalkInStep3VisitDetailsFormData>) => void
  onCancel?: () => void
  onReset?: () => void
  onPrevious?: () => void
  onSaveToDraft?: () => void
  onSaveAndContinue?: () => void
}

const visitPurposeOptions = [
  { value: "hearing-and-adjudication", label: "Hearing and Adjudication" },
  { value: "license-renewal", label: "License Renewal" },
  { value: "auction-verification", label: "Auction verification" },
  { value: "Meeting", label: "Meeting" },
  { value: "delivery", label: "Delivery" },
  { value: "Maintenance", label: "Maintenance" },
  { value: "Consultation", label: "Consultation" },
  { value: "Other", label: "Other" },
]

const departmentOptions = [
  { value: "enforcement", label: "Enforcement", color: "bg-blue-100 text-blue-800" },
  { value: "hr", label: "Human Resource", color: "bg-green-100 text-green-800" },
  { value: "it", label: "IT Department", color: "bg-purple-100 text-purple-800" },
  { value: "operations", label: "Operations", color: "bg-orange-100 text-orange-800" },
  { value: "finance", label: "Finance", color: "bg-emerald-100 text-emerald-800" },
]

const securityLevelOptions = [
  { value: "standard", label: "Standard", description: "Regular access" },
  { value: "elevated", label: "Elevated", description: "Additional verification" },
  { value: "high", label: "High", description: "Strict clearance required" },
]

const entryGateOptions = [
  { value: "main", label: "Main Gate", description: "Main entrance" },
  { value: "side", label: "Side Gate", description: "Side entrance" },
  { value: "rear", label: "Rear Gate", description: "Rear entrance" },
  { value: "vip", label: "VIP Entrance", description: "Special access" },
]

const priorityLevelOptions = [
  { value: "normal", label: "Normal", color: "bg-gray-100 text-gray-800", icon: Users },
  { value: "urgent", label: "Urgent", color: "bg-orange-100 text-orange-800", icon: AlertCircle },
  { value: "high-security", label: "High Security", color: "bg-red-100 text-red-800", icon: Shield },
]

export function WalkInStep3VisitDetails({
  formData,
  updateFormData,
  onCancel,
  onReset,
  onPrevious,
  onSaveToDraft,
  onSaveAndContinue,
}: WalkInStep3VisitDetailsProps) {
  const { toast } = useToast()
  const user = getStoredUser()
  const canPickLocation = canSeeAllLocations(user?.role)
  const userLocation = user?.location ?? ""

  const visitLocation = formData.location || ""
  const zoneLocationScope = useMemo(() => {
    if (canPickLocation) return visitLocation
    return userLocation || visitLocation
  }, [canPickLocation, visitLocation, userLocation])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [])

  useEffect(() => {
    if (!canPickLocation && userLocation && formData.location !== userLocation) {
      updateFormData({ location: userLocation })
    }
  }, [canPickLocation, userLocation, formData.location, updateFormData])

  const handleCheckAvailability = () => {
    if (!formik.values.hostFullName) {
      toast({
        title: "No host selected",
        description: "Please select a host officer first.",
        variant: "destructive",
      })
      return
    }

    // Get host name based on selected value
    const hostName = 
      formik.values.hostFullName === "jahandad" ? "Mr. Jahandad Khan" :
      formik.values.hostFullName === "ali" ? "Mr. Ali Ahmed" :
      formik.values.hostFullName === "khan" ? "Mr. Hassan Khan" :
      formik.values.hostFullName

    // Show success toast with host availability
    toast({
      title: "Host Available",
      description: (
        <div className="flex flex-col gap-1 mt-1">
          <p className="font-medium">{hostName} is available</p>
          <p className="text-xs text-muted-foreground">
            {formik.values.hostDesignation} • {formik.values.hostDepartment ? departmentOptions.find(d => d.value === formik.values.hostDepartment)?.label : ''}
          </p>
          <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
            <CheckCircle className="h-3 w-3" />
            Ready to accept visitors
          </p>
        </div>
      ),
      duration: 5000,
    })
  }

  const formik = useFormik({
    initialValues: {
      visitPurpose: formData.visitPurpose || "",
      visitPurposeDescription: formData.visitPurposeDescription || "",
      department: formData.department || formData.departmentForSlot || "",
      hostFullName: formData.hostFullName || "",
      hostDesignation: formData.hostDesignation || "",
      hostDepartment: formData.hostDepartment || "",
      hostEmail: formData.hostEmail || "",
      hostContactNumber: formData.hostContactNumber || "",
      preferredDate: formData.preferredDate || "",
      preferredTimeSlot: formData.preferredTimeSlot || "",
      slotDuration: formData.slotDuration || "",
      priorityLevel: formData.priorityLevel || "normal",
      securityLevel: formData.securityLevel || "",
      allowedDepartments: formData.allowedDepartments || "",
      entryGate: formData.entryGate || "",
      maxVisitDuration: formData.maxVisitDuration || "",
      location: formData.location || "",
      allowedZones: formData.allowedZones || "",
      timeValidityStart: formData.timeValidityStart || "",
      timeValidityEnd: formData.timeValidityEnd || "",
      additionalRemarks: formData.additionalRemarks || "",
      escortMandatory: formData.escortMandatory ?? "yes",
    },
    enableReinitialize: true,
    validationSchema: Yup.object().shape({
      visitPurpose: Yup.string().trim().required("Visit purpose is required"),
      department: Yup.string().trim().required("Department to visit is required"),
    }),
    onSubmit: (values) => {
      updateFormData(values)
      if (onSaveAndContinue) {
        onSaveAndContinue()
      }
    },
  })

  const getDepartmentLabel = (value: string) => {
    return departmentOptions.find(d => d.value === value)?.label || value
  }

  const getDepartmentColor = (value: string) => {
    return departmentOptions.find(d => d.value === value)?.color || "bg-gray-100 text-gray-800"
  }

  return (
    <div className="space-y-8">
      {/* Header with icon */}
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="p-2 rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
          <Calendar className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Visit Details</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure visit purpose, host information, and security settings
          </p>
        </div>
      </div>

      {/* Main grid - 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visit Purpose */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground flex items-center gap-1">
            Visit Purpose
            <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formik.values.visitPurpose || undefined}
            onValueChange={(v) => {
              formik.setFieldValue("visitPurpose", v)
              updateFormData({ visitPurpose: v })
            }}
          >
            <SelectTrigger className="w-full h-11 text-base bg-background border-border focus:ring-2 focus:ring-[#3b82f6]/20">
              <SelectValue placeholder="Select visit purpose" />
            </SelectTrigger>
            <SelectContent>
              {visitPurposeOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="py-2.5">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formik.touched.visitPurpose && formik.errors.visitPurpose && (
            <p className="text-sm text-destructive flex items-center gap-1 mt-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {String(formik.errors.visitPurpose)}
            </p>
          )}
        </div>

        {/* Visit Description */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Visit Description</Label>
          <Input
            name="visitPurposeDescription"
            placeholder="e.g., To discuss security matters, license renewal, etc."
            value={formik.values.visitPurposeDescription}
            onChange={(e) => {
              formik.handleChange(e)
              updateFormData({ visitPurposeDescription: e.target.value })
            }}
            className="h-11 text-base bg-background border-border focus:ring-2 focus:ring-[#3b82f6]/20"
          />
        </div>

        {/* Department to Visit */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground flex items-center gap-1">
            Department to Visit
            <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formik.values.department || undefined}
            onValueChange={(v) => {
              formik.setFieldValue("department", v)
              updateFormData({ department: v, departmentForSlot: v })
            }}
          >
            <SelectTrigger className="w-full h-11 text-base bg-background border-border focus:ring-2 focus:ring-[#3b82f6]/20">
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {departmentOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="py-2.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={o.color}>
                      {o.label}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formik.touched.department && formik.errors.department && (
            <p className="text-sm text-destructive flex items-center gap-1 mt-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {String(formik.errors.department)}
            </p>
          )}
        </div>

        {/* Host Officer Name */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Host Officer Name</Label>
          <Select
            value={formik.values.hostFullName || undefined}
            onValueChange={(v) => {
              const host = v === "jahandad"
                ? { hostDesignation: "Manager HR", hostDepartment: "hr", hostEmail: "jahandad123@email.com", hostContactNumber: "051-1234567" }
                : v === "ali"
                  ? { hostDesignation: "IT Officer", hostDepartment: "it", hostEmail: "ali@email.com", hostContactNumber: "051-7654321" }
                  : v === "khan"
                    ? { hostDesignation: "Operations Director", hostDepartment: "operations", hostEmail: "khan@email.com", hostContactNumber: "051-1122334" }
                    : {}
              formik.setValues({ ...formik.values, hostFullName: v, ...host })
              updateFormData({ hostFullName: v, ...host })
            }}
          >
            <SelectTrigger className="w-full h-11 text-base bg-background border-border focus:ring-2 focus:ring-[#3b82f6]/20">
              <SelectValue placeholder="Select host officer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="jahandad" className="py-2.5">Mr. Jahandad Khan (HR)</SelectItem>
              <SelectItem value="ali" className="py-2.5">Mr. Ali Ahmed (IT)</SelectItem>
              <SelectItem value="khan" className="py-2.5">Mr. Hassan Khan (Operations)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Hosting Officer Details Card */}
      {formik.values.hostFullName && (
        <div className="rounded-xl border border-[#3b82f6]/20 bg-gradient-to-br from-[#eff6ff] to-white p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#3b82f6]/10">
                <Users className="h-5 w-5 text-[#3b82f6]" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Hosting Officer Details</h3>
            </div>
            <Badge variant="outline" className="bg-white">
              On Duty
              <CheckCircle className="h-3.5 w-3.5 ml-1 text-green-600" />
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1 p-3 bg-white/50 rounded-lg">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Officer Name</Label>
              <p className="text-base font-medium text-foreground">
                {formik.values.hostFullName === "jahandad"
                  ? "Mr. Jahandad Khan"
                  : formik.values.hostFullName === "ali"
                    ? "Mr. Ali Ahmed"
                    : formik.values.hostFullName === "khan"
                      ? "Mr. Hassan Khan"
                      : formik.values.hostFullName || "—"}
              </p>
            </div>
            
            <div className="space-y-1 p-3 bg-white/50 rounded-lg">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Designation</Label>
              <p className="text-base font-medium text-foreground">
                {formik.values.hostDesignation || "—"}
              </p>
            </div>
            
            <div className="space-y-1 p-3 bg-white/50 rounded-lg">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Department</Label>
              {formik.values.hostDepartment ? (
                <Badge className={getDepartmentColor(formik.values.hostDepartment)}>
                  {getDepartmentLabel(formik.values.hostDepartment)}
                </Badge>
              ) : (
                <p className="text-base font-medium text-foreground">—</p>
              )}
            </div>
            
            <div className="space-y-1 p-3 bg-white/50 rounded-lg">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Email</Label>
              <p className="text-base font-medium text-foreground break-all">
                {formik.values.hostEmail || "—"}
              </p>
            </div>
            
            <div className="space-y-1 p-3 bg-white/50 rounded-lg">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Contact Number</Label>
              <p className="text-base font-medium text-foreground">
                {formik.values.hostContactNumber || "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#3b82f6]/10">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-[#3366CC] hover:text-[#2952CC] hover:bg-[#3b82f6]/5"
            >
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit Details
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCheckAvailability}
              className="border-[#3366CC]/20 text-[#3366CC] hover:bg-[#3366CC]/5"
            >
              <Clock className="h-4 w-4 mr-1.5" />
              Check Availability
            </Button>
          </div>
        </div>
      )}

      {/* Priority Level Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">Priority Level</h3>
          <Badge variant="outline" className="text-xs">
            Optional
          </Badge>
        </div>
        
        <RadioGroup
          value={formik.values.priorityLevel || "normal"}
          onValueChange={(v) => {
            formik.setFieldValue("priorityLevel", v)
            updateFormData({ priorityLevel: v })
          }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {priorityLevelOptions.map((option) => {
            const Icon = option.icon
            return (
              <div key={option.value} className="relative">
                <RadioGroupItem
                  value={option.value}
                  id={`priority-${option.value}`}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={`priority-${option.value}`}
                  className={`
                    flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer
                    transition-all duration-200
                    ${formik.values.priorityLevel === option.value
                      ? 'border-[#3b82f6] bg-[#3b82f6]/5'
                      : 'border-border hover:border-[#3b82f6]/50 hover:bg-muted/50'
                    }
                  `}
                >
                  <div className={`
                    p-2 rounded-lg
                    ${option.value === 'normal' ? 'bg-gray-100' : ''}
                    ${option.value === 'urgent' ? 'bg-orange-100' : ''}
                    ${option.value === 'high-security' ? 'bg-red-100' : ''}
                  `}>
                    <Icon className={`
                      h-5 w-5
                      ${option.value === 'normal' ? 'text-gray-600' : ''}
                      ${option.value === 'urgent' ? 'text-orange-600' : ''}
                      ${option.value === 'high-security' ? 'text-red-600' : ''}
                    `} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{option.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {option.value === 'normal' && 'Standard processing'}
                      {option.value === 'urgent' && 'Priority handling'}
                      {option.value === 'high-security' && 'Enhanced security checks'}
                    </p>
                  </div>
                </Label>
              </div>
            )
          })}
        </RadioGroup>
      </div>

      {/* Security Clearance Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">Security Clearance</h3>
          <Badge variant="outline" className="text-xs">
            Advanced Settings
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Security Level</Label>
            <Select
              value={formik.values.securityLevel || undefined}
              onValueChange={(v) => {
                formik.setFieldValue("securityLevel", v)
                updateFormData({ securityLevel: v })
              }}
            >
              <SelectTrigger className="w-full h-11 text-base bg-background border-border">
                <SelectValue placeholder="Select security level" />
              </SelectTrigger>
              <SelectContent>
                {securityLevelOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="py-2.5">
                    <div>
                      <span className="font-medium">{o.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">({o.description})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Maximum Visit Duration</Label>
            <div className="relative">
              <Input
                placeholder="e.g., 2 hours"
                value={formik.values.maxVisitDuration}
                onChange={(e) => {
                  formik.setFieldValue("maxVisitDuration", e.target.value)
                  updateFormData({ maxVisitDuration: e.target.value })
                }}
                className="h-11 text-base bg-background border-border pr-20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                hours
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Time limit for the visit</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Allowed Departments</Label>
            <Select
              value={formik.values.allowedDepartments || undefined}
              onValueChange={(v) => {
                formik.setFieldValue("allowedDepartments", v)
                updateFormData({ allowedDepartments: v })
              }}
            >
              <SelectTrigger className="w-full h-11 text-base bg-background border-border">
                <SelectValue placeholder="Select departments" />
              </SelectTrigger>
              <SelectContent>
                {departmentOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="py-2.5">
                    <Badge variant="outline" className={o.color}>
                      {o.label}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              Visit Location
              {canPickLocation ? <span className="text-destructive"> *</span> : null}
            </Label>
            {canPickLocation ? (
              <Select
                value={formik.values.location || undefined}
                onValueChange={(v) => {
                  formik.setFieldValue("location", v)
                  formik.setFieldValue("allowedZones", "")
                  updateFormData({ location: v, allowedZones: "", accessZone: "" })
                }}
              >
                <SelectTrigger className="w-full h-11 text-base bg-background border-border">
                  <SelectValue placeholder="Select location for this visit" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="py-2.5">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex h-11 items-center rounded-md border border-border bg-muted/30 px-3 text-base text-foreground">
                {locationLabel(zoneLocationScope) || "—"}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {canPickLocation
                ? "Choose the site first — zones below are loaded for this location."
                : "Zones are limited to your assigned location."}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Allowed Zones</Label>
            <AccessZoneSelect
              value={formik.values.allowedZones || ""}
              onValueChange={(v) => {
                formik.setFieldValue("allowedZones", v)
                updateFormData({ allowedZones: v, accessZone: v })
              }}
              location={canPickLocation ? visitLocation : zoneLocationScope || ""}
              includeAllOption={false}
              placeholder="Select zone"
              triggerClassName="w-full h-11 text-base bg-background border-border"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Entry Gate</Label>
            <Select
              value={formik.values.entryGate || undefined}
              onValueChange={(v) => {
                formik.setFieldValue("entryGate", v)
                updateFormData({ entryGate: v })
              }}
            >
              <SelectTrigger className="w-full h-11 text-base bg-background border-border">
                <SelectValue placeholder="Select entry gate" />
              </SelectTrigger>
              <SelectContent>
                {entryGateOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="py-2.5">
                    <div>
                      <span className="font-medium">{o.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">({o.description})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground flex items-center gap-1">
              Time Validity
              <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Input
                  type="time"
                  placeholder="Start"
                  value={formik.values.timeValidityStart}
                  onChange={(e) => {
                    formik.setFieldValue("timeValidityStart", e.target.value)
                    updateFormData({ timeValidityStart: e.target.value })
                  }}
                  className="h-11 text-base bg-background border-border pl-10"
                />
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              <div className="relative">
                <Input
                  type="time"
                  placeholder="End"
                  value={formik.values.timeValidityEnd}
                  onChange={(e) => {
                    formik.setFieldValue("timeValidityEnd", e.target.value)
                    updateFormData({ timeValidityEnd: e.target.value })
                  }}
                  className="h-11 text-base bg-background border-border pl-10"
                />
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Remarks */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">Additional Remarks</Label>
        <Textarea
          placeholder="Add any special instructions, requirements, or notes..."
          value={formik.values.additionalRemarks}
          onChange={(e) => {
            formik.setFieldValue("additionalRemarks", e.target.value)
            updateFormData({ additionalRemarks: e.target.value })
          }}
          className="min-h-24 text-base bg-background border-border resize-none focus:ring-2 focus:ring-[#3b82f6]/20"
        />
      </div>

      {/* Escort Mandatory */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Escort Required</h3>
        <RadioGroup
          value={formik.values.escortMandatory || "yes"}
          onValueChange={(v) => {
            formik.setFieldValue("escortMandatory", v)
            updateFormData({ escortMandatory: v })
          }}
          className="flex flex-row gap-6"
        >
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="yes" id="escort-yes" />
            <Label htmlFor="escort-yes" className="text-base font-medium cursor-pointer flex items-center gap-2">
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Required</Badge>
            </Label>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="no" id="escort-no" />
            <Label htmlFor="escort-no" className="text-base font-medium cursor-pointer flex items-center gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Not Required</Badge>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 border-t border-border">
        <div className="flex items-center gap-3">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="h-11 px-6 border-border text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
          )}
          {onReset && (
            <Button
              type="button"
              variant="ghost"
              onClick={onReset}
              className="h-11 px-6 text-[#3366CC] hover:bg-[#3366CC]/5"
            >
              Reset Form
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onPrevious && (
            <Button
              type="button"
              variant="outline"
              onClick={onPrevious}
              className="h-11 px-6 border-border"
            >
              Previous
            </Button>
          )}
          {onSaveToDraft && (
            <Button
              type="button"
              variant="outline"
              onClick={onSaveToDraft}
              className="h-11 px-6 border-border bg-transparent hover:bg-muted"
            >
              Save to draft
            </Button>
          )}
          {onSaveAndContinue && (
            <Button
              type="button"
              onClick={() => formik.submitForm()}
              className="h-11 px-8 bg-[#3366FF] hover:bg-[#2952CC] text-white"
            >
              Save & Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}