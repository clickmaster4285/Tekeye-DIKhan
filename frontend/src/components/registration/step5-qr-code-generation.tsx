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
import { AccessZoneSelect } from "@/components/vms/access-zone-select"

export interface QRCodeFormData {
  qrCodeId: string
  visitorRefNumber: string
  visitDate: string
  timeValidityStart: string
  timeValidityEnd: string
  accessZone: string
  entryGate: string
  expiryStatus: string
  scanCount: string
  generatedOn: string
  generatedBy: string
}

interface Step5QRCodeGenerationProps {
  formData: QRCodeFormData
  updateFormData: (data: Partial<QRCodeFormData>) => void
}

export function Step5QRCodeGeneration({ formData, updateFormData }: Step5QRCodeGenerationProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-base font-medium text-foreground">QR Code Metadata</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">QR Code ID</Label>
          <Input
            placeholder="Enter system generated ID"
            value={formData.qrCodeId}
            onChange={(e) => updateFormData({ qrCodeId: e.target.value })}
            className="h-11 border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Visitor Reference Number</Label>
          <Input
            placeholder="Enter Reference Id"
            value={formData.visitorRefNumber}
            onChange={(e) => updateFormData({ visitorRefNumber: e.target.value })}
            className="h-11 border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Visit Date</Label>
          <Input
            placeholder="DD/MM/YYYY"
            value={formData.visitDate}
            onChange={(e) => updateFormData({ visitDate: e.target.value })}
            className="h-11 border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Time Validity</Label>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Start time"
              value={formData.timeValidityStart}
              onChange={(e) => updateFormData({ timeValidityStart: e.target.value })}
              className="h-11 border-border flex-1"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <Input
              placeholder="End time"
              value={formData.timeValidityEnd}
              onChange={(e) => updateFormData({ timeValidityEnd: e.target.value })}
              className="h-11 border-border flex-1"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            Access Zone <span className="text-destructive">*</span>
          </Label>
          <AccessZoneSelect
            value={formData.accessZone}
            onValueChange={(value) => updateFormData({ accessZone: value })}
            triggerClassName="h-11 border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Entry Gate</Label>
          <Select
            value={formData.entryGate}
            onValueChange={(value) => updateFormData({ entryGate: value })}
          >
            <SelectTrigger className="h-11 border-border">
              <SelectValue placeholder="Select gate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="main-gate">Main Gate</SelectItem>
              <SelectItem value="gate-1">Gate 1</SelectItem>
              <SelectItem value="gate-2">Gate 2</SelectItem>
              <SelectItem value="vip-gate">VIP Gate</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Expiry Status</Label>
          <Select
            value={formData.expiryStatus}
            onValueChange={(value) => updateFormData({ expiryStatus: value })}
          >
            <SelectTrigger className="h-11 border-border">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Scan Count</Label>
          <Input
            placeholder="Enter count"
            value={formData.scanCount}
            onChange={(e) => updateFormData({ scanCount: e.target.value })}
            className="h-11 border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Generated On</Label>
          <Input
            placeholder="DD/MM/YYYY"
            value={formData.generatedOn}
            onChange={(e) => updateFormData({ generatedOn: e.target.value })}
            className="h-11 border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Generated By</Label>
          <Select
            value={formData.generatedBy}
            onValueChange={(value) => updateFormData({ generatedBy: value })}
          >
            <SelectTrigger className="h-11 border-border">
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="operator">Operator</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
