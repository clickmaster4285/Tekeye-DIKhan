import { useEffect, useState } from "react"
import { Leaf, Package, AlertTriangle, Plus } from "lucide-react"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

const STORAGE_KEY = "wms_perishable_items"

type PerishableRow = {
  id: string
  desc: string
  expiry: string
  status: string
}

const defaultRows: PerishableRow[] = [
  { id: "PR-7821", desc: "Food items - Lot A", expiry: "2024-02-10", status: "Active" },
  { id: "PR-7822", desc: "Pharma - Temp control", expiry: "2024-02-05", status: "Expiring Soon" },
]

function loadRows(): PerishableRow[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return defaultRows
}

function saveRows(rows: PerishableRow[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

const STATUSES = ["Active", "Expiring Soon", "Disposed"]

export default function PerishableRegisterPage() {
  const [rows, setRows] = useState<PerishableRow[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ id: "", desc: "", expiry: "", status: "Active" })

  useEffect(() => {
    setRows(loadRows())
  }, [])

  useEffect(() => {
    if (rows.length > 0) saveRows(rows)
  }, [rows])

  const openAdd = () => {
    setForm({ id: "", desc: "", expiry: "", status: "Active" })
    setOpen(true)
  }

  const onSave = () => {
    if (!form.id.trim() || !form.desc.trim() || !form.expiry.trim()) return
    const newRow: PerishableRow = {
      id: form.id.trim(),
      desc: form.desc.trim(),
      expiry: form.expiry,
      status: form.status,
    }
    setRows((prev) => [newRow, ...prev])
    setOpen(false)
  }

  const total = rows.length
  const expiringSoon = rows.filter((r) => r.status === "Expiring Soon").length
  const disposed = rows.filter((r) => r.status === "Disposed").length

  return (
    <ModulePageLayout
      title="Perishable Register"
      description="Register and track perishable goods."
      breadcrumbs={[{ label: "WMS" }, { label: "Perishable Register" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
              <Leaf className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{total}</div>
              <p className="text-xs text-muted-foreground mt-1">Perishable items</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Expiring Soon</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{expiringSoon}</div>
              <p className="text-xs text-muted-foreground mt-1">Within 7 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Disposed This Month</CardTitle>
              <Package className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{disposed}</div>
              <p className="text-xs text-muted-foreground mt-1">Completed</p>
            </CardContent>
          </Card>
        </div>
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-wrap items-center justify-between gap-4 space-y-0">
            <div className="min-w-0">
              <CardTitle>Perishable Register</CardTitle>
              <CardDescription className="break-words">All perishable items and expiry status. Data in localStorage.</CardDescription>
            </div>
            <Button className="w-full flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Perishable Item
            </Button>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="divide-y rounded-lg border md:hidden">
              {rows.map((row) => (
                <div key={row.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{row.id}</p>
                    <Badge variant={row.status === "Expiring Soon" ? "destructive" : "default"}>{row.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm">{row.desc}</p>
                  <p className="text-xs text-muted-foreground">Expiry Date: {row.expiry}</p>
                  <Button variant="ghost" size="sm" className="mt-1 h-7 px-0 text-primary">View</Button>
                </div>
              ))}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item ID</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.id}</TableCell>
                        <TableCell>{row.desc}</TableCell>
                        <TableCell>{row.expiry}</TableCell>
                        <TableCell>
                          <Badge variant={row.status === "Expiring Soon" ? "destructive" : "default"}>{row.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-primary">View</Button>
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
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Perishable Item</DialogTitle>
            <p className="text-sm text-muted-foreground">New item. Stored in localStorage.</p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Item ID</Label>
              <Input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} placeholder="e.g. PR-7823" />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input value={form.desc} onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))} placeholder="Description" />
            </div>
            <div className="grid gap-2">
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={form.expiry}
                onChange={(e) => setForm((f) => ({ ...f, expiry: e.target.value }))}
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
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={onSave} className="w-full sm:w-auto">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}
