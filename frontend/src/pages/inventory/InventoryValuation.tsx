import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Calculator, Plus, Eye } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CUSTOMS_STATIONS } from "@/lib/case-fir-spec"
import { getInventoryValuationDetailPath } from "@/routes/config"

const STORAGE_KEY = "wms_inventory_valuation"

/** Customs valuation methods per WTO/Customs Act */
const VALUATION_METHODS = [
  "Transaction Value",
  "Transaction Value of Identical Goods",
  "Transaction Value of Similar Goods",
  "Deductive Value",
  "Computed Value",
  "Fallback",
] as const
const STATUSES = ["Pending", "Approved", "Under Review", "Referred"] as const

type ValuationRow = {
  id: string
  qrCodeNumber?: string
  seizureCaseRef: string
  pctCode: string
  descriptionOfGoods: string
  quantity: string
  unit: string
  valuationMethod: string
  assessableValuePkr: string
  dutyPayablePkr: string
  valuationDate: string
  customsStation: string
  valuingOfficerName: string
  status: string
}

const defaultRows: ValuationRow[] = [
  { id: "1", qrCodeNumber: "QR-INV-2024-001", seizureCaseRef: "SZ-2024-001", pctCode: "8471", descriptionOfGoods: "Laptops, notebooks & parts", quantity: "450", unit: "PCS", valuationMethod: "Transaction Value", assessableValuePkr: "5,400,000", dutyPayablePkr: "1,080,000", valuationDate: "2024-02-01", customsStation: "Kohat", valuingOfficerName: "Inspector M. Khan", status: "Approved" },
  { id: "2", qrCodeNumber: "QR-INV-2024-002", seizureCaseRef: "SZ-2024-002", pctCode: "6109", descriptionOfGoods: "T-shirts, knitted, cotton", quantity: "1200", unit: "PCS", valuationMethod: "Transaction Value of Similar Goods", assessableValuePkr: "102,000", dutyPayablePkr: "20,400", valuationDate: "2024-02-03", customsStation: "Customs Peshawar", valuingOfficerName: "ASI Ahmed Raza", status: "Pending" },
  { id: "3", qrCodeNumber: "QR-INV-2024-003", seizureCaseRef: "SZ-2024-003", pctCode: "3004", descriptionOfGoods: "Medicaments, mixed", quantity: "120", unit: "KGS", valuationMethod: "Transaction Value", assessableValuePkr: "1,850,000", dutyPayablePkr: "370,000", valuationDate: "2024-02-05", customsStation: "Nowshera", valuingOfficerName: "Inspector S. Ali", status: "Under Review" },
]

function loadRows(): ValuationRow[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return defaultRows
}

function saveRows(rows: ValuationRow[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

export default function InventoryValuationPage() {
  const [rows, setRows] = useState<ValuationRow[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    qrCodeNumber: "",
    seizureCaseRef: "",
    pctCode: "",
    descriptionOfGoods: "",
    quantity: "",
    unit: "PCS",
    valuationMethod: "Transaction Value",
    assessableValuePkr: "",
    dutyPayablePkr: "",
    valuationDate: new Date().toISOString().slice(0, 10),
    customsStation: "Kohat",
    valuingOfficerName: "",
    status: "Pending",
  })

  useEffect(() => {
    setRows(loadRows())
  }, [])

  useEffect(() => {
    if (rows.length > 0) saveRows(rows)
  }, [rows])

  const openAdd = () => {
    setForm({
      qrCodeNumber: "",
      seizureCaseRef: "",
      pctCode: "",
      descriptionOfGoods: "",
      quantity: "",
      unit: "PCS",
      valuationMethod: "Transaction Value",
      assessableValuePkr: "",
      dutyPayablePkr: "",
      valuationDate: new Date().toISOString().slice(0, 10),
      customsStation: "Kohat",
      valuingOfficerName: "",
      status: "Pending",
    })
    setOpen(true)
  }

  const onSave = () => {
    if (!form.seizureCaseRef.trim() || !form.descriptionOfGoods.trim() || !form.assessableValuePkr.trim() || !form.valuationDate.trim()) return
    const newRow: ValuationRow = {
      id: `invval-${Date.now()}`,
      qrCodeNumber: form.qrCodeNumber.trim() || `QR-INV-${Date.now()}`,
      seizureCaseRef: form.seizureCaseRef.trim(),
      pctCode: form.pctCode.trim(),
      descriptionOfGoods: form.descriptionOfGoods.trim(),
      quantity: form.quantity.trim(),
      unit: form.unit,
      valuationMethod: form.valuationMethod,
      assessableValuePkr: form.assessableValuePkr.trim(),
      dutyPayablePkr: form.dutyPayablePkr.trim(),
      valuationDate: form.valuationDate,
      customsStation: form.customsStation,
      valuingOfficerName: form.valuingOfficerName.trim(),
      status: form.status,
    }
    setRows((prev) => [newRow, ...prev])
    setOpen(false)
  }

  const totalAssessable = rows.reduce((sum, r) => sum + (parseFloat(String(r.assessableValuePkr).replace(/,/g, "")) || 0), 0)
  const totalDuty = rows.reduce((sum, r) => sum + (parseFloat(String(r.dutyPayablePkr).replace(/,/g, "")) || 0), 0)

  return (
    <ModulePageLayout
      title="Inventory Valuation"
      description="Pakistan Customs: Assessable value and duty payable per PCT; customs valuation methods. Data stored in localStorage."
      breadcrumbs={[{ label: "WMS" }, { label: "Inventory Management" }, { label: "Inventory Valuation" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Assessable Value (PKR)</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">PKR {totalAssessable.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Sum of assessable values</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Duty Payable (PKR)</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">PKR {totalDuty.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Sum of duty payable</p>
            </CardContent>
          </Card>
        </div>

        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-wrap items-center justify-between gap-4 space-y-0">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Inventory Valuation
              </CardTitle>
              <CardDescription className="break-words">Pakistan Customs valuation by seizure/case ref, PCT, method, assessable value and duty. Data in localStorage.</CardDescription>
            </div>
            <Button className="w-full flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />
              New Valuation
            </Button>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3 overflow-hidden">
            <div className="divide-y rounded-lg border md:hidden">
              {rows.map((row) => (
                <div key={row.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-mono text-sm font-semibold">{row.qrCodeNumber || "—"}</p>
                    <Badge variant={row.status === "Approved" ? "default" : "secondary"}>{row.status}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <p className="truncate">Case Ref: <span className="text-foreground">{row.seizureCaseRef}</span></p>
                    <p className="truncate">PCT: <span className="text-foreground">{row.pctCode || "—"}</span></p>
                    <p className="col-span-2 truncate">Description: <span className="text-foreground">{row.descriptionOfGoods}</span></p>
                    <p className="truncate">Qty: <span className="text-foreground">{row.quantity} {row.unit}</span></p>
                    <p className="truncate">Method: <span className="text-foreground">{row.valuationMethod}</span></p>
                    <p className="truncate">Assessable: <span className="text-foreground">{row.assessableValuePkr}</span></p>
                    <p className="truncate">Duty: <span className="text-foreground">{row.dutyPayablePkr}</span></p>
                    <p className="truncate">Date: <span className="text-foreground">{row.valuationDate}</span></p>
                    <p className="truncate">Station: <span className="text-foreground">{row.customsStation}</span></p>
                    <p className="col-span-2 truncate">Officer: <span className="text-foreground">{row.valuingOfficerName || "—"}</span></p>
                  </div>
                  <Button variant="ghost" size="sm" asChild className="mt-1 h-7 px-0">
                    <Link to={getInventoryValuationDetailPath(row.id)}>
                      <Eye className="mr-1 h-4 w-4" />
                      View
                    </Link>
                  </Button>
                </div>
              ))}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="max-h-[60vh] w-full max-w-full overflow-x-auto overflow-y-auto rounded-lg border pb-2">
              <Table className="min-w-[1520px]">
              <TableHeader>
                <TableRow>
                  <TableHead> QR Code</TableHead>
                  <TableHead>Seizure/Case Ref</TableHead>
                  <TableHead>PCT Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Valuation Method</TableHead>
                  <TableHead>Assessable Value (PKR)</TableHead>
                  <TableHead>Duty Payable (PKR)</TableHead>
                  <TableHead>Valuation Date</TableHead>
                  <TableHead>Customs Station</TableHead>
                  <TableHead>Valuing Officer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono">{row.qrCodeNumber || "—"}</TableCell>
                    <TableCell className="font-medium">{row.seizureCaseRef}</TableCell>
                    <TableCell className="font-mono">{row.pctCode || "—"}</TableCell>
                    <TableCell className="max-w-[140px] truncate">{row.descriptionOfGoods}</TableCell>
                    <TableCell>{row.quantity}</TableCell>
                    <TableCell>{row.unit}</TableCell>
                    <TableCell className="text-xs">{row.valuationMethod}</TableCell>
                    <TableCell>{row.assessableValuePkr}</TableCell>
                    <TableCell>{row.dutyPayablePkr}</TableCell>
                    <TableCell>{row.valuationDate}</TableCell>
                    <TableCell>{row.customsStation}</TableCell>
                    <TableCell>{row.valuingOfficerName || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === "Approved" ? "default" : "secondary"}>{row.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={getInventoryValuationDetailPath(row.id)}>
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Link>
                      </Button>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Inventory Valuation</DialogTitle>
            <p className="text-sm text-muted-foreground">Pakistan Customs valuation (assessable value & duty). Stored in localStorage.</p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>QR Code Number</Label>
              <Input value={form.qrCodeNumber} onChange={(e) => setForm((f) => ({ ...f, qrCodeNumber: e.target.value }))} placeholder="e.g. QR-INV-2024-001 (auto-generated if left blank)" />
            </div>
            <div className="grid gap-2">
              <Label>Seizure / Case Reference *</Label>
              <Input value={form.seizureCaseRef} onChange={(e) => setForm((f) => ({ ...f, seizureCaseRef: e.target.value }))} placeholder="e.g. SZ-2024-001" />
            </div>
            <div className="grid gap-2">
              <Label>PCT Code (Pakistan Customs Tariff)</Label>
              <Input value={form.pctCode} onChange={(e) => setForm((f) => ({ ...f, pctCode: e.target.value }))} placeholder="e.g. 8471" />
            </div>
            <div className="grid gap-2">
              <Label>Description of Goods *</Label>
              <Input value={form.descriptionOfGoods} onChange={(e) => setForm((f) => ({ ...f, descriptionOfGoods: e.target.value }))} placeholder="Description" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label>Quantity</Label>
                <Input value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="e.g. 450" />
              </div>
              <div className="grid gap-2">
                <Label>Unit</Label>
                <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PCS">PCS</SelectItem>
                    <SelectItem value="KGS">KGS</SelectItem>
                    <SelectItem value="LTR">LTR</SelectItem>
                    <SelectItem value="MTR">MTR</SelectItem>
                    <SelectItem value="CTN">CTN</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Valuation Method</Label>
              <Select value={form.valuationMethod} onValueChange={(v) => setForm((f) => ({ ...f, valuationMethod: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VALUATION_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Assessable Value (PKR) *</Label>
              <Input value={form.assessableValuePkr} onChange={(e) => setForm((f) => ({ ...f, assessableValuePkr: e.target.value }))} placeholder="e.g. 5,400,000" />
            </div>
            <div className="grid gap-2">
              <Label>Duty Payable (PKR)</Label>
              <Input value={form.dutyPayablePkr} onChange={(e) => setForm((f) => ({ ...f, dutyPayablePkr: e.target.value }))} placeholder="e.g. 1,080,000" />
            </div>
            <div className="grid gap-2">
              <Label>Valuation Date *</Label>
              <Input type="date" value={form.valuationDate} onChange={(e) => setForm((f) => ({ ...f, valuationDate: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Customs Station</Label>
              <Select value={form.customsStation} onValueChange={(v) => setForm((f) => ({ ...f, customsStation: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CUSTOMS_STATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Valuing Officer Name</Label>
              <Input value={form.valuingOfficerName} onChange={(e) => setForm((f) => ({ ...f, valuingOfficerName: e.target.value }))} placeholder="Officer name or badge" />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={onSave} className="w-full sm:w-auto">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}
