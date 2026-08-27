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

export interface WalkInHostFormData {
  hostId: string
  hostFullName: string
  hostDesignation: string
  hostDepartment: string
}

interface WalkInStep5HostSelectionProps {
  formData: WalkInHostFormData
  updateFormData: (data: Partial<WalkInHostFormData>) => void
}

export function WalkInStep5HostSelection({ formData, updateFormData }: WalkInStep5HostSelectionProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Host Selection</h2>
      <p className="text-sm text-muted-foreground">
        Assign the host or employee you are visiting.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Host ID</Label>
          <Input
            placeholder="Enter or select host"
            value={formData.hostId}
            onChange={(e) => updateFormData({ hostId: e.target.value })}
            className="h-11 bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Host Full Name</Label>
          <Select
            value={formData.hostFullName}
            onValueChange={(value) => updateFormData({ hostFullName: value })}
          >
            <SelectTrigger className="h-11 bg-background">
              <SelectValue placeholder="Select host name" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ali">Ali Ahmed</SelectItem>
              <SelectItem value="khan">Hassan Khan</SelectItem>
              <SelectItem value="sheikh">Muhammad Sheikh</SelectItem>
              <SelectItem value="afzal">Nazia Afzal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Designation</Label>
          <Select
            value={formData.hostDesignation}
            onValueChange={(value) => updateFormData({ hostDesignation: value })}
          >
            <SelectTrigger className="h-11 bg-background">
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
          <Label className="text-sm font-medium text-foreground">Department</Label>
          <Select
            value={formData.hostDepartment}
            onValueChange={(value) => updateFormData({ hostDepartment: value })}
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
      </div>
    </div>
  )
}
