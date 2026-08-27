import { useEffect, useState } from "react"
import { Package, TrendingUp, AlertTriangle, RotateCcw, Plus } from "lucide-react"
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

const STORAGE_KEY = "wms_inventory_tracking"

type InventoryRow = {
  id: string
  QR_Code: string
  product: string
  wh: string
  loc: string
  qty: number
  status: string
}

const defaultRows: InventoryRow[] = [
  { id: "1", QR_Code: "QR_Code-7821", product: "Electronics - Category A", wh: "Peshawar", loc: "Z-C03-A-12-04", qty: 450, status: "In Stock" },
  { id: "2", QR_Code: "QR_Code-9103", product: "Textiles - Bulk", wh: "Peshawar", loc: "Z-B02-B-08-01", qty: 1200, status: "In Stock" },
  { id: "3", QR_Code: "QR_Code-4452", product: "Pharma - Temp Control", wh: "DI Khan", loc: "Z-CLD-01-02", qty: 85, status: "Low Stock" },
  { id: "4", QR_Code: "QR_Code-2298", product: "General Merchandise", wh: "Yarik", loc: "Z-A01-N-05-03", qty: 320, status: "In Stock" },
  { id: "5", QR_Code: "QR_Code-6671", product: "Automotive Parts", wh: "Peshawar", loc: "Z-B02-C-15-02", qty: 12, status: "Reorder" },
]

function loadRows(): InventoryRow[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return defaultRows
}

function saveRows(rows: InventoryRow[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

const STATUSES = ["In Stock", "Low Stock", "Reorder"]

export default function InventoryTrackingPage() {
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ QR_Code: "", product: "", wh: "Peshawar", loc: "", qty: 0, status: "In Stock" })

  useEffect(() => {
    setRows(loadRows())
  }, [])

  useEffect(() => {
    if (rows.length > 0) saveRows(rows)
  }, [rows])

  const openAdd = () => {
    setForm({ QR_Code: "", product: "", wh: "Peshawar", loc: "", qty: 0, status: "In Stock" })
    setOpen(true)
  }

  const onSave = () => {
    if (!form.QR_Code.trim() || !form.product.trim() || !form.loc.trim()) return
    const newRow: InventoryRow = {
      id: `inv-${Date.now()}`,
      QR_Code: form.QR_Code.trim(),
      product: form.product.trim(),
      wh: form.wh,
      loc: form.loc.trim(),
      qty: form.qty || 0,
      status: form.status,
    }
    setRows((prev) => [newRow, ...prev])
    setOpen(false)
  }

  const totalQR_Codes = rows.length
  const totalUnits = rows.reduce((s, r) => s + r.qty, 0)
  const lowStock = rows.filter((r) => r.status === "Low Stock" || r.status === "Reorder").length

  return (
    <ModulePageLayout
      title="Inventory Tracking"
      description="Real-time visibility of stock levels, movements, and locations across warehouses."
      breadcrumbs={[{ label: "WMS" }, { label: "Inventory Tracking" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total QR_Codes</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalQR_Codes}</div>
              <p className="text-xs text-muted-foreground mt-1">Active products</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Units</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUnits.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">In stock</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStock}</div>
              <p className="text-xs text-muted-foreground mt-1">Below reorder point</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Movements Today</CardTitle>
              <RotateCcw className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">—</div>
              <p className="text-xs text-muted-foreground mt-1">In / Out / Transfer</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-4 flex-wrap">
            <div>
              <CardTitle>Inventory by Location</CardTitle>
              <CardDescription>Current stock levels per warehouse and zone. Data in localStorage.</CardDescription>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Input placeholder="Search QR_Code or product..." className="w-48" />
              <Button variant="outline">Export</Button>
              <Button variant="outline">Refresh</Button>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>QR_Code</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.QR_Code}</TableCell>
                    <TableCell>{row.product}</TableCell>
                    <TableCell>{row.wh}</TableCell>
                    <TableCell className="font-mono text-xs">{row.loc}</TableCell>
                    <TableCell>{row.qty}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "In Stock"
                            ? "default"
                            : row.status === "Low Stock"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
            <p className="text-sm text-muted-foreground">New item. Stored in localStorage.</p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>QR_Code</Label>
              <Input value={form.QR_Code} onChange={(e) => setForm((f) => ({ ...f, QR_Code: e.target.value }))} placeholder="e.g. QR_Code-1234" />
            </div>
            <div className="grid gap-2">
              <Label>Product</Label>
              <Input value={form.product} onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))} placeholder="Product name" />
            </div>
            <div className="grid gap-2">
              <Label>Warehouse</Label>
              <Input value={form.wh} onChange={(e) => setForm((f) => ({ ...f, wh: e.target.value }))} placeholder="Peshawar" />
            </div>
            <div className="grid gap-2">
              <Label>Location</Label>
              <Input value={form.loc} onChange={(e) => setForm((f) => ({ ...f, loc: e.target.value }))} placeholder="e.g. Z-C03-A-12-04" />
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
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={onSave}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}
