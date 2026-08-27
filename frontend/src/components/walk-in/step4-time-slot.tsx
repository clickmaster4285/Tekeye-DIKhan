"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface WalkInTimeSlotFormData {
  preferredDate: string
  preferredTimeSlot: string
  departmentForSlot: string
  slotDuration: string
}

interface WalkInStep4TimeSlotProps {
  formData: WalkInTimeSlotFormData
  updateFormData: (data: Partial<WalkInTimeSlotFormData>) => void
}

export function WalkInStep4TimeSlot({ formData, updateFormData }: WalkInStep4TimeSlotProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Time Slot Booking</h2>
      <p className="text-sm text-muted-foreground">
        Select a date and time slot for your visit based on department availability.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Preferred Date</Label>
          <Input
            type="date"
            value={formData.preferredDate}
            onChange={(e) => updateFormData({ preferredDate: e.target.value })}
            className="h-11 bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Time Slot</Label>
          <Select
            value={formData.preferredTimeSlot}
            onValueChange={(value) => updateFormData({ preferredTimeSlot: value })}
          >
            <SelectTrigger className="h-11 bg-background">
              <SelectValue placeholder="Select time slot" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="09:00">09:00 AM</SelectItem>
              <SelectItem value="09:30">09:30 AM</SelectItem>
              <SelectItem value="10:00">10:00 AM</SelectItem>
              <SelectItem value="10:30">10:30 AM</SelectItem>
              <SelectItem value="11:00">11:00 AM</SelectItem>
              <SelectItem value="11:30">11:30 AM</SelectItem>
              <SelectItem value="14:00">02:00 PM</SelectItem>
              <SelectItem value="14:30">02:30 PM</SelectItem>
              <SelectItem value="15:00">03:00 PM</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Department</Label>
          <Select
            value={formData.departmentForSlot}
            onValueChange={(value) => updateFormData({ departmentForSlot: value })}
          >
            <SelectTrigger className="h-11 bg-background">
              <SelectValue placeholder="Select department" />
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
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Slot Duration</Label>
          <Select
            value={formData.slotDuration}
            onValueChange={(value) => updateFormData({ slotDuration: value })}
          >
            <SelectTrigger className="h-11 bg-background">
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 minutes</SelectItem>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
