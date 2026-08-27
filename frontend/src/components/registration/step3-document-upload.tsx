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
import { Upload } from "lucide-react"

export interface DocumentUploadFormData {
  documentType: string
  documentNo: string
  issuingAuthority: string
  expiryDate: string
  frontImage: string
  backImage: string
  supportDocType: string
  applicationLetter: string
  letterRefNo: string
  additionalDocument: string
  uploadProcedure: string
}

interface Step3DocumentUploadProps {
  formData: DocumentUploadFormData
  updateFormData: (data: Partial<DocumentUploadFormData>) => void
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

export function Step3DocumentUpload({ formData, updateFormData }: Step3DocumentUploadProps) {
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    field: keyof DocumentUploadFormData
  ) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      updateFormData({ [field]: dataUrl })
    } catch {
      // ignore file read errors for now
    }
  }

  return (
    <div className="space-y-8">
      {/* Identity Documents */}
      <div>
        <h3 className="text-base font-medium text-foreground mb-4">Identity Documents</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Document Type</Label>
            <Select
              value={formData.documentType}
              onValueChange={(value) => updateFormData({ documentType: value })}
            >
              <SelectTrigger className="h-11 border-border">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cnic">CNIC</SelectItem>
                <SelectItem value="passport">Passport</SelectItem>
                <SelectItem value="driving-license">Driving License</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Document No.</Label>
            <Input
              placeholder="Enter document ID number"
              value={formData.documentNo}
              onChange={(e) => updateFormData({ documentNo: e.target.value })}
              className="h-11 border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Issuing Authority</Label>
            <Select
              value={formData.issuingAuthority}
              onValueChange={(value) => updateFormData({ issuingAuthority: value })}
            >
              <SelectTrigger className="h-11 border-border">
                <SelectValue placeholder="Select issuing authority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nadra">NADRA</SelectItem>
                <SelectItem value="passport-office">Passport Office</SelectItem>
                <SelectItem value="excise">Excise & Taxation</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Expiry Date</Label>
            <Input
              placeholder="DD/MM/YYYY"
              value={formData.expiryDate}
              onChange={(e) => updateFormData({ expiryDate: e.target.value })}
              className="h-11 border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Front Image</Label>
            <div className="relative">
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(event) => handleFileChange(event, "frontImage")}
                className="h-11 border-border pr-10 cursor-pointer"
              />
              <Upload className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Back Image</Label>
            <div className="relative">
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(event) => handleFileChange(event, "backImage")}
                className="h-11 border-border pr-10 cursor-pointer"
              />
              <Upload className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      {/* Supporting Documents */}
      <div>
        <h3 className="text-base font-medium text-foreground mb-4">Supporting Documents</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Document Type</Label>
            <Select
              value={formData.supportDocType}
              onValueChange={(value) => updateFormData({ supportDocType: value })}
            >
              <SelectTrigger className="h-11 border-border">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="application">Application Letter</SelectItem>
                <SelectItem value="noc">NOC</SelectItem>
                <SelectItem value="invitation">Invitation Letter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Application Letter</Label>
            <div className="relative">
              <Input
                type="file"
                accept=".pdf,image/*"
                onChange={(event) => handleFileChange(event, "applicationLetter")}
                className="h-11 border-border pr-10 cursor-pointer"
              />
              <Upload className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Letter Ref. No.</Label>
            <Input
              placeholder="Enter ref"
              value={formData.letterRefNo}
              onChange={(e) => updateFormData({ letterRefNo: e.target.value })}
              className="h-11 border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Upload Procedure</Label>
            <Select
              value={formData.uploadProcedure}
              onValueChange={(value) => updateFormData({ uploadProcedure: value })}
            >
              <SelectTrigger className="h-11 border-border">
                <SelectValue placeholder="Select procedure" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual Upload</SelectItem>
                <SelectItem value="scan">Scan & Upload</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-sm text-muted-foreground">Additional Document</Label>
            <div className="relative">
              <Input
                type="file"
                accept=".pdf,image/*"
                onChange={(event) => handleFileChange(event, "additionalDocument")}
                className="h-11 border-border pr-10 cursor-pointer"
              />
              <Upload className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
