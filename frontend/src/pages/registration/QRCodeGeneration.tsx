"use client"

import { useState, useEffect, useCallback } from "react"
// Default import for CJS/ESM compatibility with Vite/Rollup on Linux
import QRCode from "qrcode"
import { Button } from "@/components/ui/button"
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
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { fetchVmsJsonBlob, saveVmsJsonBlob } from "@/lib/vms-list-api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Printer, QrCode } from "lucide-react"

/** Payload encoded in the QR code – when scanned, reader gets name, CNIC, zone, etc. */
export interface QRScanPayload {
  name: string
  cnic: string
  zone: string
  qrCodeId: string
  visitorRefNumber: string
  visitDate: string
  timeValidityStart: string
  timeValidityEnd: string
  entryGate: string
  generatedOn: string
}

const QR_CODES_MODULE = "vms_qr_codes"

const defaultForm = () => ({
  name: "",
  cnic: "",
  qrCodeId: "",
  visitorRefNumber: "",
  visitDate: new Date().toISOString().slice(0, 10),
  timeValidityStart: "09:00",
  timeValidityEnd: "18:00",
  accessZone: "",
  entryGate: "",
  expiryStatus: "active",
  scanCount: "0",
  generatedOn: new Date().toISOString().slice(0, 10),
  generatedBy: "operator",
})

export default function QRCodeGenerationPage() {
  const [formData, setFormData] = useState(defaultForm())
  const [savedQRCodes, setSavedQRCodes] = useState<Record<string, unknown>[]>([])
  const [qrDataUrl, setQrDataUrl] = useState<string>("")

  const [qrHydrated, setQrHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const stored = await fetchVmsJsonBlob<Record<string, unknown>[]>(QR_CODES_MODULE, [])
      if (!cancelled) {
        setSavedQRCodes(Array.isArray(stored) ? stored : [])
        setQrHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!qrHydrated) return
    void saveVmsJsonBlob(QR_CODES_MODULE, savedQRCodes)
  }, [savedQRCodes, qrHydrated])

  // Use stable placeholder when qrCodeId empty so useEffect deps don't change every tick (Date.now() caused infinite loop)
  const payload: QRScanPayload = {
    name: formData.name.trim(),
    cnic: formData.cnic.trim(),
    zone: formData.accessZone || "",
    qrCodeId: formData.qrCodeId.trim() || "QR",
    visitorRefNumber: formData.visitorRefNumber.trim(),
    visitDate: formData.visitDate,
    timeValidityStart: formData.timeValidityStart,
    timeValidityEnd: formData.timeValidityEnd,
    entryGate: formData.entryGate || "",
    generatedOn: formData.generatedOn,
  }

  useEffect(() => {
    const text = JSON.stringify(payload)
    let cancelled = false
    QRCode.toDataURL(text, { width: 220, margin: 2 })
      .then((url) => { if (!cancelled) setQrDataUrl(url) })
      .catch(() => { if (!cancelled) setQrDataUrl("") })
    return () => { cancelled = true }
  }, [
    formData.name,
    formData.cnic,
    formData.accessZone,
    formData.qrCodeId,
    formData.visitorRefNumber,
    formData.visitDate,
    formData.timeValidityStart,
    formData.timeValidityEnd,
    formData.entryGate,
    formData.generatedOn,
  ])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSaveEntry = () => {
    const qrCodeId = formData.qrCodeId.trim() || `QR-${Date.now()}`
    setSavedQRCodes([{ ...formData, qrCodeId }, ...savedQRCodes])
    setFormData(defaultForm())
  }

  const printThermalReceipt = useCallback(() => {
    const receiptHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - ${payload.name || "Visitor"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      width: 80mm; 
      max-width: 80mm; 
      padding: 4mm; 
      font-family: monospace; 
      font-size: 11px; 
      line-height: 1.35;
    }
    .center { text-align: center; }
    .line { border-bottom: 1px dashed #333; margin: 4px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .label { font-weight: bold; }
    img { display: block; margin: 6px auto; width: 50mm; height: 50mm; }
    .footer { margin-top: 6px; font-size: 9px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="center">
    <strong>VISITOR PASS</strong><br>
    <span style="font-size: 9px;">Customs Warehouse</span>
  </div>
  <div class="line"></div>
  <div class="row"><span class="label">Name:</span><span>${payload.name || "—"}</span></div>
  <div class="row"><span class="label">CNIC:</span><span>${payload.cnic || "—"}</span></div>
  <div class="row"><span class="label">Zone:</span><span>${payload.zone || "—"}</span></div>
  <div class="line"></div>
  <div class="row"><span class="label">Ref No:</span><span>${payload.visitorRefNumber || payload.qrCodeId || "—"}</span></div>
  <div class="row"><span class="label">Visit Date:</span><span>${payload.visitDate || "—"}</span></div>
  <div class="row"><span class="label">Time:</span><span>${payload.timeValidityStart || ""} - ${payload.timeValidityEnd || ""}</span></div>
  <div class="row"><span class="label">Gate:</span><span>${payload.entryGate || "—"}</span></div>
  <div class="line"></div>
  <div class="center"><strong>Scan at gate</strong></div>
  <img src="${qrDataUrl}" alt="QR Code" />
  <div class="footer">Generated: ${payload.generatedOn} | ID: ${payload.qrCodeId}</div>
</body>
</html>`
    const win = window.open("", "_blank")
    if (!win) {
      alert("Please allow pop-ups to print the receipt.")
      return
    }
    win.document.write(receiptHtml)
    win.document.close()
    win.focus()
    setTimeout(() => {
      win.print()
      win.close()
    }, 250)
  }, [payload, qrDataUrl])

  const canSave = formData.name.trim() !== "" && formData.cnic.trim() !== ""

  return (
    <ModulePageLayout
      title="QR Code Generation"
      description="Generate QR code with Name, CNIC, Zone. Print thermal receipt; when scanned, the QR returns name, CNIC, zone and other details."
      breadcrumbs={[{ label: "WMS" }, { label: "Seizure & Receipt" }, { label: "QR Code Generation" }]}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details for receipt &amp; QR</CardTitle>
            <CardDescription>Name, CNIC and Zone are encoded in the QR code and shown on the printed receipt.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Name *</Label>
                <Input
                  name="name"
                  placeholder="Full name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="h-10 border-border"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>CNIC *</Label>
                <Input
                  name="cnic"
                  placeholder="e.g. 35201-1234567-1"
                  value={formData.cnic}
                  onChange={handleInputChange}
                  className="h-10 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Zone (Access Zone) *</Label>
                <AccessZoneSelect
                  value={formData.accessZone}
                  onValueChange={(v) => setFormData({ ...formData, accessZone: v })}
                  triggerClassName="h-10 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Visitor Ref Number</Label>
                <Input
                  name="visitorRefNumber"
                  placeholder="Reference Id"
                  value={formData.visitorRefNumber}
                  onChange={handleInputChange}
                  className="h-10 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>QR Code ID</Label>
                <Input
                  name="qrCodeId"
                  placeholder="Auto if empty"
                  value={formData.qrCodeId}
                  onChange={handleInputChange}
                  className="h-10 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Visit Date</Label>
                <Input
                  type="date"
                  name="visitDate"
                  value={formData.visitDate}
                  onChange={handleInputChange}
                  className="h-10 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Time validity start</Label>
                <Input
                  type="time"
                  name="timeValidityStart"
                  value={formData.timeValidityStart}
                  onChange={handleInputChange}
                  className="h-10 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Time validity end</Label>
                <Input
                  type="time"
                  name="timeValidityEnd"
                  value={formData.timeValidityEnd}
                  onChange={handleInputChange}
                  className="h-10 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Entry Gate</Label>
                <Select
                  value={formData.entryGate}
                  onValueChange={(v) => setFormData({ ...formData, entryGate: v })}
                >
                  <SelectTrigger className="h-10 border-border">
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
                <Label>Generated On</Label>
                <Input
                  type="date"
                  name="generatedOn"
                  value={formData.generatedOn}
                  onChange={handleInputChange}
                  className="h-10 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Generated By</Label>
                <Select
                  value={formData.generatedBy}
                  onValueChange={(v) => setFormData({ ...formData, generatedBy: v })}
                >
                  <SelectTrigger className="h-10 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
                onClick={handleSaveEntry}
                disabled={!canSave}
              >
                Save QR Code
              </Button>
              <Button
                variant="outline"
                onClick={printThermalReceipt}
                disabled={!qrDataUrl}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print receipt (thermal)
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code (scan for Name, CNIC, Zone)
            </CardTitle>
            <CardDescription>
              This QR encodes: name, cnic, zone, ref, date, time, gate. Scan to read the same info.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {qrDataUrl ? (
              <div className="flex flex-col items-center gap-4">
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  className="w-48 h-48 object-contain border border-border rounded-lg"
                />
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  Scanned content (JSON): name, cnic, zone, qrCodeId, visitorRefNumber, visitDate, timeValidityStart, timeValidityEnd, entryGate, generatedOn
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
                Fill Name, CNIC and Zone to generate QR.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {savedQRCodes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saved QR Codes</CardTitle>
            <CardDescription>Name, CNIC, Zone and other fields saved for each entry.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-border text-sm">
                <thead className="bg-muted/10">
                  <tr>
                    <th className="p-2 border border-border">Name</th>
                    <th className="p-2 border border-border">CNIC</th>
                    <th className="p-2 border border-border">Zone</th>
                    <th className="p-2 border border-border">QR ID</th>
                    <th className="p-2 border border-border">Visitor Ref</th>
                    <th className="p-2 border border-border">Visit Date</th>
                    <th className="p-2 border border-border">Entry Gate</th>
                    <th className="p-2 border border-border">Generated On</th>
                  </tr>
                </thead>
                <tbody>
                  {savedQRCodes.map((qr: Record<string, unknown>, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/5">
                      <td className="p-2 border border-border">{String(qr.name ?? "—")}</td>
                      <td className="p-2 border border-border">{String(qr.cnic ?? "—")}</td>
                      <td className="p-2 border border-border">{String(qr.accessZone ?? "—")}</td>
                      <td className="p-2 border border-border">{String(qr.qrCodeId ?? "—")}</td>
                      <td className="p-2 border border-border">{String(qr.visitorRefNumber ?? "—")}</td>
                      <td className="p-2 border border-border">{String(qr.visitDate ?? "—")}</td>
                      <td className="p-2 border border-border">{String(qr.entryGate ?? "—")}</td>
                      <td className="p-2 border border-border">{String(qr.generatedOn ?? "—")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

    </ModulePageLayout>
  )
}
