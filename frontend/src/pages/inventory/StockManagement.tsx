import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Layers, Plus, TrendingUp, AlertTriangle, Eye } from "lucide-react"
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
import { getStockManagementDetailPath } from "@/routes/config"
import {
  STOCK_STORAGE_KEY,
  WMS_STOCK_UPDATED_EVENT,
  loadStockRows,
  type WmsStockRow,
} from "@/lib/wms-stock-storage"

const STORAGE_KEY = STOCK_STORAGE_KEY

const CONDITIONS = ["Seized", "Detained", "Bonded", "Transit", "Released", "Under Disposal"] as const
const CUSTODY_OPTIONS = ["Customs Godown", "Bonded Warehouse", "Transit Shed", "Quarantine", "Court Custody", "Other"] as const
const STATUSES = ["In Custody", "Released", "Disposed", "Under Litigation"] as const

type StockRow = WmsStockRow & {
  customsStation: string
  custody: string
  custodianOfficerName: string
}

const defaultRows: StockRow[] = [
  { id: "1", qrCodeNumber: "QR-STK-2024-001", seizureCaseRef: "SZ-2024-001", pctCode: "8471", descriptionOfGoods: "Laptops, notebooks & parts", customsStation: "Kohat", godownWarehouse: "Bonded Godown A", quantity: "450", unitOfMeasure: "PCS", condition: "Seized", custody: "Customs Godown", custodianOfficerName: "Inspector M. Khan", status: "In Custody" },
  { id: "2", qrCodeNumber: "QR-STK-2024-002", seizureCaseRef: "SZ-2024-002", pctCode: "6109", descriptionOfGoods: "T-shirts, knitted, cotton", customsStation: "Customs Peshawar", godownWarehouse: "Transit Shed B", quantity: "85", unitOfMeasure: "PCS", condition: "Detained", custody: "Transit Shed", custodianOfficerName: "ASI Ahmed Raza", status: "In Custody" },
  { id: "3", qrCodeNumber: "QR-STK-2024-003", seizureCaseRef: "SZ-2024-003", pctCode: "3004", descriptionOfGoods: "Medicaments, mixed", customsStation: "Nowshera", godownWarehouse: "Bonded Godown C", quantity: "12", unitOfMeasure: "KGS", condition: "Seized", custody: "Customs Godown", custodianOfficerName: "Inspector S. Ali", status: "In Custody" },
]

function normalizeStockRow(row: WmsStockRow): StockRow {
  return {
    ...row,
    customsStation: row.customsStation || "",
    custody: row.custody || "Customs Godown",
    custodianOfficerName: row.custodianOfficerName || "",
  }
}

function loadRows(): StockRow[] {
  const stored = loadStockRows()
  if (stored.length > 0) return stored.map(normalizeStockRow)
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map((row: WmsStockRow) => normalizeStockRow(row))
    }
  } catch {}
  return defaultRows
}

function saveRows(rows: StockRow[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

const UNITS = ["PCS", "KGS", "LTR", "MTR", "CTN", "BOX", "BAG", "DOZ", "SET", "Other"] as const

export default function StockManagementPage() {
  const [rows, setRows] = useState<StockRow[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    qrCodeNumber: "",
    seizureCaseRef: "",
    pctCode: "",
    descriptionOfGoods: "",
    customsStation: "Kohat",
    godownWarehouse: "",
    quantity: "",
    unitOfMeasure: "PCS",
    condition: "Seized",
    custody: "Customs Godown",
    custodianOfficerName: "",
    status: "In Custody",
  })

  useEffect(() => {
    const refresh = () => setRows(loadRows())
    refresh()
    window.addEventListener(WMS_STOCK_UPDATED_EVENT, refresh)
    window.addEventListener("storage", refresh)
    window.addEventListener("focus", refresh)
    return () => {
      window.removeEventListener(WMS_STOCK_UPDATED_EVENT, refresh)
      window.removeEventListener("storage", refresh)
      window.removeEventListener("focus", refresh)
    }
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
      customsStation: "Kohat",
      godownWarehouse: "",
      quantity: "",
      unitOfMeasure: "PCS",
      condition: "Seized",
      custody: "Customs Godown",
      custodianOfficerName: "",
      status: "In Custody",
    })
    setOpen(true)
  }

  const onSave = () => {
    if (!form.seizureCaseRef.trim() || !form.descriptionOfGoods.trim()) return
    const newRow: StockRow = {
      id: `stk-${Date.now()}`,
      qrCodeNumber: form.qrCodeNumber.trim() || `QR-STK-${Date.now()}`,
      seizureCaseRef: form.seizureCaseRef.trim(),
      pctCode: form.pctCode.trim(),
      descriptionOfGoods: form.descriptionOfGoods.trim(),
      customsStation: form.customsStation,
      godownWarehouse: form.godownWarehouse.trim(),
      quantity: form.quantity.trim(),
      unitOfMeasure: form.unitOfMeasure,
      condition: form.condition,
      custody: form.custody,
      custodianOfficerName: form.custodianOfficerName.trim(),
      status: form.status,
    }
    setRows((prev) => [newRow, ...prev])
    setOpen(false)
  }

  const inCustodyCount = rows.filter((r) => r.status === "In Custody").length
  const seizedCount = rows.filter((r) => r.condition === "Seized" || r.condition === "Detained").length

  return (
    <ModulePageLayout
      title="Stock Management"
      description="Pakistan Customs: Seized/detained goods stock by PCT, godown, custody and condition. Data stored in localStorage."
      breadcrumbs={[{ label: "WMS" }, { label: "Inventory Management" }, { label: "Stock Management" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Lots</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rows.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Seizure/case lots</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Custody</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inCustodyCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Lots in customs custody</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Seized / Detained</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{seizedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Under seizure/detention</p>
            </CardContent>
          </Card>
        </div>

        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-wrap items-center justify-between gap-4 space-y-0">
            <div className="min-w-0">
              <CardTitle>Stock by Godown / Custody</CardTitle>
              <CardDescription className="break-words">Pakistan Customs stock: seizure ref, PCT, description, custody and condition. Data in localStorage.</CardDescription>
            </div>
            <Button className="w-full flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Stock Lot
            </Button>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3 overflow-hidden">
            <div className="divide-y rounded-lg border md:hidden">
              {rows.map((row) => (
                <div key={row.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-mono text-sm font-semibold">{row.qrCodeNumber || "—"}</p>
                    <Badge variant={row.status === "In Custody" ? "default" : "secondary"}>{row.status}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <p className="truncate">Case Ref: <span className="text-foreground">{row.seizureCaseRef}</span></p>
                    <p className="truncate">PCT: <span className="text-foreground">{row.pctCode || "—"}</span></p>
                    <p className="col-span-2 truncate">Description: <span className="text-foreground">{row.descriptionOfGoods}</span></p>
                    <p className="truncate">Station: <span className="text-foreground">{row.customsStation}</span></p>
                    <p className="truncate">Warehouse: <span className="text-foreground">{row.godownWarehouse || "—"}</span></p>
                    <p className="truncate">Qty: <span className="text-foreground">{row.quantity} {row.unitOfMeasure}</span></p>
                    <p className="truncate">Condition: <span className="text-foreground">{row.condition}</span></p>
                    <p className="col-span-2 truncate">Custody: <span className="text-foreground">{row.custody}</span></p>
                  </div>
                  <Button variant="ghost" size="sm" asChild className="mt-1 h-7 px-0">
                    <Link to={getStockManagementDetailPath(row.id)}>
                      <Eye className="mr-1 h-4 w-4" />
                      View
                    </Link>
                  </Button>
                </div>
              ))}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="max-h-[60vh] w-full max-w-full overflow-x-auto overflow-y-auto rounded-lg border pb-2">
              <Table className="min-w-[1380px]">
              <TableHeader>
                <TableRow>
                  <TableHead> QR Code</TableHead>
                  <TableHead>Seizure/Case Ref</TableHead>
                  <TableHead>PCT Code</TableHead>
                  <TableHead>Description of Goods</TableHead>
                  <TableHead>Customs Station</TableHead>
                  <TableHead>Godown/Warehouse</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Custody</TableHead>
                  <TableHead>Custodian Officer</TableHead>
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
                    <TableCell className="max-w-[160px] truncate">{row.descriptionOfGoods}</TableCell>
                    <TableCell>{row.customsStation}</TableCell>
                    <TableCell>{row.godownWarehouse || "—"}</TableCell>
                    <TableCell>{row.quantity}</TableCell>
                    <TableCell>{row.unitOfMeasure}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.condition}</Badge>
                    </TableCell>
                    <TableCell>{row.custody}</TableCell>
                    <TableCell>{row.custodianOfficerName || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === "In Custody" ? "default" : "secondary"}>{row.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={getStockManagementDetailPath(row.id)}>
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
            <DialogTitle>Add Stock Lot</DialogTitle>
            <p className="text-sm text-muted-foreground">Pakistan Customs seized/detained stock. Stored in localStorage.</p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>QR Code Number</Label>
              <Input value={form.qrCodeNumber} onChange={(e) => setForm((f) => ({ ...f, qrCodeNumber: e.target.value }))} placeholder="e.g. QR-STK-2024-001 (auto-generated if blank)" />
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
              <Label>Godown / Warehouse</Label>
              <Input value={form.godownWarehouse} onChange={(e) => setForm((f) => ({ ...f, godownWarehouse: e.target.value }))} placeholder="e.g. Bonded Godown A" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label>Quantity</Label>
                <Input value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="e.g. 450" />
              </div>
              <div className="grid gap-2">
                <Label>Unit of Measure</Label>
                <Select value={form.unitOfMeasure} onValueChange={(v) => setForm((f) => ({ ...f, unitOfMeasure: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Condition</Label>
              <Select value={form.condition} onValueChange={(v) => setForm((f) => ({ ...f, condition: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Custody</Label>
              <Select value={form.custody} onValueChange={(v) => setForm((f) => ({ ...f, custody: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CUSTODY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Custodian Officer Name</Label>
              <Input value={form.custodianOfficerName} onChange={(e) => setForm((f) => ({ ...f, custodianOfficerName: e.target.value }))} placeholder="Officer name or badge" />
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
