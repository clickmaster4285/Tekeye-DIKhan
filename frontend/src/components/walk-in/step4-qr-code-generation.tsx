"use client"

import { useEffect, useMemo } from "react"
import { QRCodeCanvas } from "qrcode.react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { QrCode } from "lucide-react"
import { formatAccessZoneLabel, resolveAccessZoneFromDepartment } from "@/lib/access-zone"
import { useAccessZones } from "@/hooks/use-access-zones"
import { AccessZoneSelect } from "@/components/vms/access-zone-select"
import { buildVisitorQrPayload } from "@/components/walk-in/group-member"
import type { GroupVisitMember } from "@/components/walk-in/group-member"

/** Same as print-qr-on-save: 5cm × 5cm equivalent at 96 PPI */
const QR_SIZE_CM = 5
const PPI = 96
const MM_PER_INCH = 25.4
const qrSizePx = Math.round((QR_SIZE_CM * 10 * PPI) / MM_PER_INCH)

export interface WalkInStep4QRCodeFormData {
  location?: string
  qrCodeId: string
  accessZone: string
  entryGate: string
  timeValidityStart: string
  timeValidityEnd: string
  visitorRefNumber: string
  visitDate: string
  cnicNumber?: string
  securityLevel: string
  maxVisitDuration: string
  allowedDepartments: string
  additionalRemarks: string
  escortMandatory: string
}

interface WalkInStep4QRCodeGenerationProps {
  formData: WalkInStep4QRCodeFormData & { cnicNumber?: string; fullName?: string; visitPurpose?: string; department?: string }
  updateFormData: (data: Partial<WalkInStep4QRCodeFormData>) => void
  onCancel?: () => void
  onReset?: () => void
  onPrevious?: () => void
  onPrint?: () => void
  onFinish?: () => void
}

export function WalkInStep4QRCodeGeneration({
  formData,
  updateFormData,
  onCancel,
  onReset,
  onPrevious,
  onPrint,
  onFinish,
}: WalkInStep4QRCodeGenerationProps) {
  const { data: zoneData } = useAccessZones(formData.location ?? undefined)
  const zoneOptions = zoneData?.options ?? []

  const department =
    (formData as { department?: string }).department ??
    (formData as { departmentForSlot?: string }).departmentForSlot ??
    ""

  useEffect(() => {
    if (formData.accessZone?.trim()) return
    const defaultZone = resolveAccessZoneFromDepartment(department, zoneOptions)
    if (defaultZone) updateFormData({ accessZone: defaultZone })
  }, [department, formData.accessZone, updateFormData, zoneOptions])
  const extended = formData as {
    fullName?: string
    visitPurpose?: string
    department?: string
    visitMode?: string
    groupPartySize?: number
    groupMembers?: GroupVisitMember[]
    mobileNumber?: string
  }

  const qrPayload = useMemo(
    () =>
      buildVisitorQrPayload({
        fullName: extended.fullName ?? "",
        cnicNumber: formData.cnicNumber ?? "",
        visitDate: formData.visitDate ?? "",
        timeValidityStart: formData.timeValidityStart ?? "",
        timeValidityEnd: formData.timeValidityEnd ?? "",
        accessZone: formData.accessZone ?? "",
        entryGate: formData.entryGate ?? "",
        qrCodeId: formData.qrCodeId ?? "",
        visitorRefNumber: formData.visitorRefNumber ?? "",
        visitPurpose: extended.visitPurpose ?? "",
        department: extended.department ?? "",
        visitMode: extended.visitMode,
        groupPartySize: extended.groupPartySize,
        groupMembers: extended.groupMembers,
        mobileNumber: extended.mobileNumber,
      }),
    [
      extended.fullName,
      formData.cnicNumber,
      formData.visitDate,
      formData.timeValidityStart,
      formData.timeValidityEnd,
      formData.accessZone,
      formData.entryGate,
      formData.qrCodeId,
      formData.visitorRefNumber,
      extended.visitPurpose,
      extended.department,
      extended.visitMode,
      extended.groupPartySize,
      extended.groupMembers,
      extended.mobileNumber,
    ]
  )

  const visitorName = ((formData as { fullName?: string }).fullName ?? "").trim() || "Guest"
  const visitorCNIC = (formData.cnicNumber ?? "").trim() || "CNIC Number"
  const formatTime = (value: string, defaultTime: string): string => {
    const s = (value ?? "").trim()
    if (!s) return defaultTime
    const isoMatch = /T(\d{1,2}):(\d{2})/.exec(s)
    if (isoMatch) return `${isoMatch[1].padStart(2, "0")}:${isoMatch[2]}`
    const timeMatch = /^(\d{1,2}):(\d{2})(?::\d{2})?(\s*[AP]?M?)?$/i.exec(s)
    if (timeMatch) return `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}${timeMatch[3] ? ` ${timeMatch[3].trim()}` : ""}`
    return s
  }
  const validFrom = formatTime(formData.timeValidityStart ?? "", "00:00")
  const validTo = formatTime(formData.timeValidityEnd ?? "", "23:59")
  /** Same as print-qr-on-save formatDate() */
  const passDate = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
  const zoneLabel = formatAccessZoneLabel(formData.accessZone, zoneOptions)
  const isGroup = extended.visitMode === "group"
  const partySize = extended.groupPartySize ?? 0
  const memberNames = (extended.groupMembers ?? [])
    .map((m) => m.name.trim())
    .filter(Boolean)

  return (
    <div className="space-y-8">
      <Label className="text-[22px] font-bold text-foreground">QR Code Generation</Label>
      <p className="text-sm text-muted-foreground">
        QR code is generated from the information you added. Select an access zone, then print the pass or finish to save.
      </p>

      <div className="max-w-md space-y-2">
        <Label className="text-sm font-medium text-foreground">
          Access Zone <span className="text-destructive">*</span>
        </Label>
        <AccessZoneSelect
          value={formData.accessZone}
          onValueChange={(value) => updateFormData({ accessZone: value })}
          location={formData.location ?? ""}
          includeAllOption={false}
          placeholder="Select zone (required)"
          triggerClassName="h-11 border-border"
        />
      </div>

      {/* Exact same format as print-qr-on-save (pass slip layout) */}
      <div className="rounded-lg border-2 border-[#93c5fd] bg-white overflow-hidden p-4">
        <div
          id="visitor-pass-step4"
          style={{
            width: "50mm",
            maxWidth: "100%",
            margin: "0 auto",
            padding: "2px 5px",
            background: "white",
            fontFamily: "monospace",
            color: "black",
            fontSize: "10px",
            lineHeight: 1.15,
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "2px" }}>
            <h1 style={{ fontSize: "17px", fontWeight: 900, marginBottom: "1px", letterSpacing: "1.05px" }}>TEKEYE</h1>
            <h1 style={{ fontSize: "17px", fontWeight: 900, marginBottom: "1px", letterSpacing: "1.05px" }}>PAKISTAN CUSTOMS</h1>
            <div style={{ fontSize: "11px", fontWeight: "bold" }}>VISITOR PASS</div>
          </div>

          <div style={{ borderTop: "1.5px solid black", margin: "1.5px 0" }} />

          <table style={{ width: "100%", borderCollapse: "collapse", margin: "1.5px 0", fontSize: "10px" }}>
            <thead>
              <tr>
                <th colSpan={2} style={{ textAlign: "center", fontSize: "9px", padding: "0.3mm", fontWeight: "bold", background: "#f8f9fa" }}>VISITOR INFORMATION</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ width: "35%", fontWeight: "bold", padding: "0.3mm 0.2mm", borderBottom: "1px solid #ddd", verticalAlign: "top", fontSize: "9px" }}>Name</td>
                <td style={{ width: "65%", padding: "0.3mm 0.2mm", borderBottom: "1px solid #ddd", verticalAlign: "top", fontSize: "9px" }}>{visitorName}</td>
              </tr>
              <tr>
                <td style={{ width: "35%", fontWeight: "bold", padding: "0.3mm 0.2mm", borderBottom: "1px solid #ddd", verticalAlign: "top", fontSize: "9px" }}>CNIC</td>
                <td style={{ width: "65%", padding: "0.3mm 0.2mm", borderBottom: "1px solid #ddd", verticalAlign: "top", fontSize: "9px" }}>{visitorCNIC}</td>
              </tr>
              {isGroup && (
                <>
                  <tr>
                    <td style={{ width: "35%", fontWeight: "bold", padding: "0.3mm 0.2mm", borderBottom: "1px solid #ddd", verticalAlign: "top", fontSize: "9px" }}>Visit</td>
                    <td style={{ width: "65%", padding: "0.3mm 0.2mm", borderBottom: "1px solid #ddd", verticalAlign: "top", fontSize: "9px" }}>Group ({partySize} people)</td>
                  </tr>
                  {memberNames.length > 0 && (
                    <tr>
                      <td style={{ width: "35%", fontWeight: "bold", padding: "0.3mm 0.2mm", borderBottom: "1px solid #ddd", verticalAlign: "top", fontSize: "9px" }}>Members</td>
                      <td style={{ width: "65%", padding: "0.3mm 0.2mm", borderBottom: "1px solid #ddd", verticalAlign: "top", fontSize: "9px" }}>
                        {memberNames.slice(0, 4).join(", ")}
                        {memberNames.length > 4 ? ` +${memberNames.length - 4}` : ""}
                      </td>
                    </tr>
                  )}
                </>
              )}
              <tr>
                <td style={{ width: "35%", fontWeight: "bold", padding: "0.3mm 0.2mm", borderBottom: "1px solid #ddd", verticalAlign: "top", fontSize: "9px" }}>Zone</td>
                <td style={{ width: "65%", padding: "0.3mm 0.2mm", borderBottom: "1px solid #ddd", verticalAlign: "top", fontSize: "9px" }}>{zoneLabel}</td>
              </tr>
              <tr>
                <td style={{ width: "35%", fontWeight: "bold", padding: "0.3mm 0.2mm", borderBottom: "1px solid #ddd", verticalAlign: "top", fontSize: "9px" }}>Date</td>
                <td style={{ width: "65%", padding: "0.3mm 0.2mm", borderBottom: "1px solid #ddd", verticalAlign: "top", fontSize: "9px" }}>{passDate}</td>
              </tr>
              <tr>
                <td style={{ width: "35%", fontWeight: "bold", padding: "0.3mm 0.2mm", borderBottom: "1px solid #ddd", verticalAlign: "top", fontSize: "9px" }}>TIME VALIDITY</td>
                <td style={{ width: "65%", padding: "0.3mm 0.2mm", borderBottom: "1px solid #ddd", verticalAlign: "top", fontSize: "9px" }}>{validFrom} to {validTo}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ borderTop: "1px dashed black", margin: "1.5px 0" }} />

          <div style={{ textAlign: "center", margin: "1.5px 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: `${QR_SIZE_CM}cm`, height: `${QR_SIZE_CM}cm`, marginLeft: "auto", marginRight: "auto", overflow: "hidden" }}>
              <QRCodeCanvas value={qrPayload} size={qrSizePx} level="M" includeMargin={false} style={{ width: "100%", height: "100%", display: "block" }} />
            </div>
            <div style={{ fontSize: "10px", fontWeight: "bold", marginTop: "0.3mm", letterSpacing: "0.6px" }}>SCAN ME</div>
          </div>

          <div style={{ borderTop: "1px dashed black", margin: "1.5px 0" }} />

          <div style={{ textAlign: "center", fontSize: "10px", marginTop: "1.5px", lineHeight: 1.25 }}>Thank you for visiting PAKISTAN CUSTOMS</div>
          <div style={{ borderTop: "1.5px solid black", marginTop: "1.5px", paddingTop: "0.3mm", fontSize: "9px", textAlign: "center" }}>Powered by TEKEYE - PAKISTAN CUSTOMS</div>
        </div>
      </div>

      {/* Action buttons: Previous, Print, Finish */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 border-t border-border">
        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-[#CCCCCC] bg-white px-4 py-2.5 text-base font-normal text-[#3366CC] transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="rounded-md border border-[#CCCCCC] bg-white px-4 py-2.5 text-base font-normal text-[#3366CC] transition-colors hover:bg-gray-50"
            >
              Reset Form
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onPrevious && (
            <button
              type="button"
              onClick={onPrevious}
              className="rounded-md border border-border bg-white px-4 py-2.5 text-base font-normal text-foreground hover:bg-muted/50"
            >
              Previous
            </button>
          )}
          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="rounded-md border border-[#3366FF] bg-white px-4 py-2.5 text-base font-normal text-[#3366FF] hover:bg-[#3366FF]/10 flex items-center gap-2"
            >
              <QrCode className="h-4 w-4" />
              Print
            </button>
          )}
          {onFinish && (
            <button
              type="button"
              onClick={onFinish}
              className="shrink-0 rounded-md bg-[#3366FF] px-5 py-2.5 text-base font-normal text-white transition-colors hover:bg-[#2952CC]"
            >
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
