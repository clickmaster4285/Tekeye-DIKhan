"use client"

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

export interface WalkInVisitPurposeFormData {
  visitType: string
  visitPurposeDescription: string
  referenceNumber: string
}

interface WalkInStep6VisitPurposeProps {
  formData: WalkInVisitPurposeFormData
  updateFormData: (data: Partial<WalkInVisitPurposeFormData>) => void
}

export function WalkInStep6VisitPurpose({ formData, updateFormData }: WalkInStep6VisitPurposeProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Visit Purpose</h2>
      <p className="text-sm text-muted-foreground">
        Select visitor type and describe the purpose of your visit.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Visit Type</Label>
          <Select
            value={formData.visitType}
            onValueChange={(value) => updateFormData({ visitType: value })}
          >
            <SelectTrigger className="h-11 bg-background">
              <SelectValue placeholder="Select visit type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="official">Official</SelectItem>
              <SelectItem value="vendor">Vendor</SelectItem>
              <SelectItem value="interview">Interview</SelectItem>
              <SelectItem value="contractor">Contractor</SelectItem>
              <SelectItem value="meeting">Meeting</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Reference Number</Label>
          <Input
            placeholder="Optional reference"
            value={formData.referenceNumber}
            onChange={(e) => updateFormData({ referenceNumber: e.target.value })}
            className="h-11 bg-background"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label className="text-sm font-medium text-foreground">Visit Purpose / Description</Label>
          <Textarea
            placeholder="Describe the purpose of your visit"
            rows={3}
            value={formData.visitPurposeDescription}
            onChange={(e) => updateFormData({ visitPurposeDescription: e.target.value })}
            className="bg-background resize-none"
          />
        </div>
      </div>
    </div>
  )
}
