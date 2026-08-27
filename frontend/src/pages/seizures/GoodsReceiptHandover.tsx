"use client"

import { useState, useEffect } from "react"
import { Package, ArrowRightLeft, CheckCircle, ListOrdered } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  STANDARD_RECEIPT_FLOW,
  RECEIPT_TABLE_COLUMNS,
  type ReceiptRegistrationForm,
} from "@/lib/warehouse-module-spec"

const STORAGE_KEY = "goodsRecords"

const emptyForm: ReceiptRegistrationForm = {
  receiptNumber: "",
  receiptType: "Purchase",
  receiptDate: "",
  receiptTime: "",
  expectedReceiptDate: "",
  actualReceiptDate: "",
  receiptStatus: "Scheduled",
  priority: "Standard",
  supplierId: "",
  supplierName: "",
  supplierContact: "",
  purchaseOrderNumber: "",
  invoiceNumber: "",
  invoiceDate: "",
  billOfLadingNumber: "",
  containerNumber: "",
  sealNumber: "",
  carrierName: "",
  vehicleRegistration: "",
  driverName: "",
  driverLicense: "",
  gateEntryNumber: "",
  gateEntryDateTime: "",
  numberOfLineItems: "",
  totalPackages: "",
  totalGrossWeight: "",
  totalVolume: "",
  declaredValue: "",
  currency: "",
  unloadingBayNumber: "",
  unloadingStartTime: "",
  unloadingEndTime: "",
  inspectionRequired: "",
  inspectorName: "",
  physicalCountDone: "",
  sealIntact: "",
  acceptanceStatus: "Fully Accepted",
  acceptedBy: "",
  acceptanceDateTime: "",
  storageZoneAssigned: "",
  putAwayRequired: "Yes",
  quarantineRequired: "No",
  receiptValue: "",
  remarks: "",
}

type StoredReceipt = ReceiptRegistrationForm & { id: string }

function getDefaultForm(): ReceiptRegistrationForm {
  return { ...emptyForm }
}

function generateReceiptNumber(): string {
  return `GR-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`
}

export default function GoodsReceiptHandoverPage() {
  const [records, setRecords] = useState<StoredReceipt[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showFlow, setShowFlow] = useState(false)
  const [formData, setFormData] = useState<ReceiptRegistrationForm>(getDefaultForm())

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setRecords(parsed)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (records.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  }, [records])

  const handleChange = (key: keyof ReceiptRegistrationForm, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const openNewReceipt = () => {
    setFormData({ ...getDefaultForm(), receiptNumber: generateReceiptNumber(), receiptDate: new Date().toISOString().slice(0, 10) })
    setShowModal(true)
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const receiptNumber = formData.receiptNumber.trim() || generateReceiptNumber()
    const newRecord: StoredReceipt = { ...formData, receiptNumber, id: `gr-${Date.now()}` }
    setRecords((prev) => [newRecord, ...prev])
    setFormData(getDefaultForm())
    setShowModal(false)
  }

  const receiptsToday = records.filter(
    (r) => r.receiptDate === new Date().toISOString().slice(0, 10)
  ).length
  const handoversPending = records.filter(
    (r) => r.receiptStatus === "In Progress" || r.receiptStatus === "Scheduled"
  ).length
  const completed = records.filter((r) => r.receiptStatus === "Completed").length

  return (
    <ModulePageLayout
      title="Goods Receipt & Handover"
      description="Record goods receipt and handover per Standard Receipt Flow: ASN → Gate Entry → Unloading → Inspection → Acceptance → Put-away → Inventory Update."
      breadcrumbs={[{ label: "WMS" }, { label: "Goods Receipt & Handover" }]}
    >
      <div className="grid gap-6">
        {/* Flow guide (spec) */}
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <ListOrdered className="h-5 w-5" />
                Standard Receipt Flow
              </CardTitle>
              <CardDescription className="break-words">ASN Received → Appointment → Gate Entry → Unloading → Inspection → Acceptance → Put-away → Inventory Update → Closure</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setShowFlow(!showFlow)}>
              {showFlow ? "Hide" : "Show"} steps
            </Button>
          </CardHeader>
          {showFlow && (
            <CardContent className="pt-0">
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                {STANDARD_RECEIPT_FLOW.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </CardContent>
          )}
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Receipts Today</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{receiptsToday}</div>
              <p className="text-xs text-muted-foreground mt-1">Goods received</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Handovers Pending</CardTitle>
              <ArrowRightLeft className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{handoversPending}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting handover</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completed}</div>
              <p className="text-xs text-muted-foreground mt-1">Completed receipts</p>
            </CardContent>
          </Card>
        </div>

        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
            <div className="min-w-0">
              <CardTitle>Receipt & Handover Register</CardTitle>
              <CardDescription className="break-words">Spec-aligned receipt records (Receipt Number, Type, Supplier, PO, Invoice, Gate Entry, Acceptance, Status)</CardDescription>
            </div>
            <Button className="mt-4 w-full bg-[#3b82f6] text-white hover:bg-[#2563eb] sm:mt-0 sm:w-auto" onClick={openNewReceipt}>
              New Receipt
            </Button>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="divide-y rounded-lg border md:hidden">
              {records.map((row) => (
                <div key={row.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{row.receiptNumber || "—"}</p>
                    <Badge variant={row.receiptStatus === "Completed" ? "default" : "secondary"}>
                      {row.receiptStatus}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <p className="truncate text-muted-foreground">Type: <span className="text-foreground">{row.receiptType || "—"}</span></p>
                    <p className="truncate text-muted-foreground">Date: <span className="text-foreground">{row.receiptDate || "—"}</span></p>
                    <p className="truncate text-muted-foreground">Supplier: <span className="text-foreground">{row.supplierName || "—"}</span></p>
                    <p className="truncate text-muted-foreground">PO: <span className="text-foreground">{row.purchaseOrderNumber || "—"}</span></p>
                    <p className="truncate text-muted-foreground">Invoice: <span className="text-foreground">{row.invoiceNumber || "—"}</span></p>
                    <p className="truncate text-muted-foreground">Gate Entry: <span className="text-foreground">{row.gateEntryNumber || "—"}</span></p>
                    <p className="truncate text-muted-foreground">Packages: <span className="text-foreground">{row.totalPackages || "—"}</span></p>
                    <p className="truncate text-muted-foreground">Acceptance: <span className="text-foreground">{row.acceptanceStatus || "—"}</span></p>
                  </div>
                  <Button variant="ghost" size="sm" className="mt-1 h-7 px-0 text-[#3b82f6]">View</Button>
                </div>
              ))}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                <Table className="min-w-[1280px]">
                  <TableHeader>
                    <TableRow>
                      {RECEIPT_TABLE_COLUMNS.map((col) => (
                        <TableHead key={col}>{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.receiptNumber}</TableCell>
                        <TableCell>{row.receiptType}</TableCell>
                        <TableCell>{row.receiptDate}</TableCell>
                        <TableCell>{row.supplierName}</TableCell>
                        <TableCell>{row.purchaseOrderNumber}</TableCell>
                        <TableCell>{row.invoiceNumber}</TableCell>
                        <TableCell>{row.gateEntryNumber}</TableCell>
                        <TableCell>{row.totalPackages}</TableCell>
                        <TableCell>{row.acceptanceStatus}</TableCell>
                        <TableCell>
                          <Badge variant={row.receiptStatus === "Completed" ? "default" : "secondary"}>
                            {row.receiptStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-[#3b82f6]">View</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Receipt / Handover</DialogTitle>
            <CardDescription>Receipt Registration per spec: ASN, Gate Entry, Inspection, Acceptance, Put-away.</CardDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Receipt Number</Label>
                <Input value={formData.receiptNumber} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Receipt Type</Label>
                <Select value={formData.receiptType} onValueChange={(v) => handleChange("receiptType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Purchase", "Import", "Return", "Transfer", "Sample", "Consignment", "Bonded"].map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Receipt Date *</Label>
                <Input
                  type="date"
                  value={formData.receiptDate}
                  onChange={(e) => handleChange("receiptDate", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Receipt Status</Label>
                <Select value={formData.receiptStatus} onValueChange={(v) => handleChange("receiptStatus", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                    <SelectItem value="On Hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Supplier Name *</Label>
                <Input
                  value={formData.supplierName}
                  onChange={(e) => handleChange("supplierName", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Supplier Contact</Label>
                <Input
                  value={formData.supplierContact}
                  onChange={(e) => handleChange("supplierContact", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Purchase Order Number</Label>
                <Input
                  value={formData.purchaseOrderNumber}
                  onChange={(e) => handleChange("purchaseOrderNumber", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Invoice Number</Label>
                <Input
                  value={formData.invoiceNumber}
                  onChange={(e) => handleChange("invoiceNumber", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Bill of Lading / AWB</Label>
                <Input
                  value={formData.billOfLadingNumber}
                  onChange={(e) => handleChange("billOfLadingNumber", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Container Number(s)</Label>
                <Input
                  value={formData.containerNumber}
                  onChange={(e) => handleChange("containerNumber", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Gate Entry Number</Label>
                <Input
                  value={formData.gateEntryNumber}
                  onChange={(e) => handleChange("gateEntryNumber", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Gate Entry Date/Time</Label>
                <Input
                  type="datetime-local"
                  value={formData.gateEntryDateTime}
                  onChange={(e) => handleChange("gateEntryDateTime", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Total Packages/Cartons</Label>
                <Input
                  type="number"
                  value={formData.totalPackages}
                  onChange={(e) => handleChange("totalPackages", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Total Gross Weight (kg)</Label>
                <Input
                  value={formData.totalGrossWeight}
                  onChange={(e) => handleChange("totalGrossWeight", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Declared Value</Label>
                <Input
                  value={formData.declaredValue}
                  onChange={(e) => handleChange("declaredValue", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input
                  value={formData.currency}
                  onChange={(e) => handleChange("currency", e.target.value)}
                  placeholder="e.g. USD, PKR"
                />
              </div>
              <div className="space-y-2">
                <Label>Acceptance Status</Label>
                <Select value={formData.acceptanceStatus} onValueChange={(v) => handleChange("acceptanceStatus", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fully Accepted">Fully Accepted</SelectItem>
                    <SelectItem value="Partially Accepted">Partially Accepted</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                    <SelectItem value="Conditional">Conditional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Accepted By</Label>
                <Input
                  value={formData.acceptedBy}
                  onChange={(e) => handleChange("acceptedBy", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Storage Zone Assigned</Label>
                <Input
                  value={formData.storageZoneAssigned}
                  onChange={(e) => handleChange("storageZoneAssigned", e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Remarks</Label>
                <Input
                  value={formData.remarks}
                  onChange={(e) => handleChange("remarks", e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col-reverse justify-end gap-2 pt-4 sm:flex-row">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto" disabled={!formData.receiptDate.trim() || !formData.supplierName.trim()}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}
