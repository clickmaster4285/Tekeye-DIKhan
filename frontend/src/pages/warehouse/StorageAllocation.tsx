import { useEffect, useState } from "react"
import { Package, CheckCircle, Clock, AlertCircle, Plus } from "lucide-react"
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

const STORAGE_KEY = "wms_storage_allocations"

type AllocationRow = {
  id: string
  ref: string
  QR_Code: string
  product: string
  qty: number
  wh: string
  priority: string
}

const defaultRows: AllocationRow[] = [
  { id: "1", ref: "ALC-2024-0841", QR_Code: "QR_Code-7821", product: "Electronics - Category A", qty: 120, wh: "Peshawar", priority: "High" },
  { id: "2", ref: "ALC-2024-0842", QR_Code: "QR_Code-9103", product: "Textiles - Bulk", qty: 500, wh: "Peshawar", priority: "Normal" },
  { id: "3", ref: "ALC-2024-0843", QR_Code: "QR_Code-4452", product: "Pharma - Temp Control", qty: 80, wh: "DI Khan", priority: "High" },
  { id: "4", ref: "ALC-2024-0844", QR_Code: "QR_Code-2298", product: "General Merchandise", qty: 200, wh: "Yarik", priority: "Normal" },
]

function loadRows(): AllocationRow[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return defaultRows
}

function saveRows(rows: AllocationRow[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

export default function StorageAllocationPage() {
  const [rows, setRows] = useState<AllocationRow[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ref: "", QR_Code: "", product: "", qty: 0, wh: "Peshawar", priority: "Normal" })

  useEffect(() => {
    setRows(loadRows())
  }, [])

  useEffect(() => {
    if (rows.length > 0) saveRows(rows)
  }, [rows])

  const openAdd = () => {
    setForm({ ref: "", QR_Code: "", product: "", qty: 0, wh: "Peshawar", priority: "Normal" })
    setOpen(true)
  }

  const onSave = () => {
    if (!form.ref.trim() || !form.QR_Code.trim() || !form.product.trim()) return
    const newRow: AllocationRow = {
      id: `alc-${Date.now()}`,
      ref: form.ref.trim(),
      QR_Code: form.QR_Code.trim(),
      product: form.product.trim(),
      qty: form.qty || 0,
      wh: form.wh,
      priority: form.priority,
    }
    setRows((prev) => [newRow, ...prev])
    setOpen(false)
  }

  const pending = rows.length
  const allocated = 0
  const reserved = 0
  const overflows = 0

  return (
    <ModulePageLayout
      title="Storage Allocation"
      description="Allocate and reserve storage locations for incoming and existing inventory."
      breadcrumbs={[{ label: "WMS" }, { label: "Storage Allocation" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Allocated</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allocated}</div>
              <p className="text-xs text-muted-foreground mt-1">Locations in use</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pending}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting allocation</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Reserved</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reserved}</div>
              <p className="text-xs text-muted-foreground mt-1">Reserved for inbound</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Overflows</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overflows}</div>
              <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
            </CardContent>
          </Card>
        </div>

        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-wrap items-center justify-between gap-4 space-y-0">
            <div className="min-w-0">
              <CardTitle>Allocation Queue</CardTitle>
              <CardDescription className="break-words">Items pending storage allocation. Data in localStorage.</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
              <Input placeholder="Search by QR_Code or PO..." className="w-full sm:w-64" />
              <Button variant="outline" className="w-full sm:w-auto">Auto-allocate</Button>
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" onClick={openAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add to Queue
              </Button>
            </div>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="divide-y rounded-lg border md:hidden">
              {rows.map((row) => (
                <div key={row.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{row.ref}</p>
                    <Badge variant={row.priority === "High" ? "destructive" : "secondary"}>
                      {row.priority}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <p className="truncate">QR: <span className="text-foreground">{row.QR_Code}</span></p>
                    <p className="truncate">Qty: <span className="text-foreground">{row.qty}</span></p>
                    <p className="col-span-2 truncate">Product: <span className="text-foreground">{row.product}</span></p>
                    <p className="truncate">Warehouse: <span className="text-foreground">{row.wh}</span></p>
                  </div>
                  <Button variant="ghost" size="sm" className="mt-1 h-7 px-0 text-primary">Allocate</Button>
                </div>
              ))}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>QR_Code</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.ref}</TableCell>
                        <TableCell>{row.QR_Code}</TableCell>
                        <TableCell>{row.product}</TableCell>
                        <TableCell>{row.qty}</TableCell>
                        <TableCell>{row.wh}</TableCell>
                        <TableCell>
                          <Badge variant={row.priority === "High" ? "destructive" : "secondary"}>
                            {row.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-primary">Allocate</Button>
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
            <DialogTitle>Add to Allocation Queue</DialogTitle>
            <p className="text-sm text-muted-foreground">New allocation. Stored in localStorage.</p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Reference</Label>
              <Input value={form.ref} onChange={(e) => setForm((f) => ({ ...f, ref: e.target.value }))} placeholder="e.g. ALC-2024-0845" />
            </div>
            <div className="grid gap-2">
              <Label>QR_Code</Label>
              <Input value={form.QR_Code} onChange={(e) => setForm((f) => ({ ...f, QR_Code: e.target.value }))} placeholder="e.g. QR_Code-1234" />
            </div>
            <div className="grid gap-2">
              <Label>Product</Label>
              <Input value={form.product} onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))} placeholder="Product name" />
            </div>
            <div className="grid gap-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={0}
                value={form.qty || ""}
                onChange={(e) => setForm((f) => ({ ...f, qty: parseInt(e.target.value, 10) || 0 }))}
                placeholder="0"
              />
            </div>
            <div className="grid gap-2">
              <Label>Warehouse</Label>
              <Input value={form.wh} onChange={(e) => setForm((f) => ({ ...f, wh: e.target.value }))} placeholder="Peshawar" />
            </div>
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
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
