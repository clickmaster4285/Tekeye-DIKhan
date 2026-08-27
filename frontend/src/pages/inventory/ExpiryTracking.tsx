import { useEffect, useState } from "react"
import { AlertTriangle, Plus } from "lucide-react"
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

const STORAGE_KEY = "wms_expiry_tracking"

type ExpiryRow = {
  id: string
  itemId: string
  desc: string
  expiry: string
  days: number
  priority: string
}

const defaultRows: ExpiryRow[] = [
  { id: "1", itemId: "PR-7822", desc: "Pharma - Temp control", expiry: "2024-02-05", days: 1, priority: "High" },
  { id: "2", itemId: "PR-7821", desc: "Food items - Lot A", expiry: "2024-02-10", days: 6, priority: "Medium" },
]

function loadRows(): ExpiryRow[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return defaultRows
}

function saveRows(rows: ExpiryRow[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

const PRIORITIES = ["High", "Medium", "Low"]

export default function ExpiryTrackingPage() {
  const [rows, setRows] = useState<ExpiryRow[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ itemId: "", desc: "", expiry: "", days: 0, priority: "Medium" })

  useEffect(() => {
    setRows(loadRows())
  }, [])

  useEffect(() => {
    if (rows.length > 0) saveRows(rows)
  }, [rows])

  const openAdd = () => {
    setForm({ itemId: "", desc: "", expiry: "", days: 0, priority: "Medium" })
    setOpen(true)
  }

  const onSave = () => {
    if (!form.itemId.trim() || !form.desc.trim() || !form.expiry.trim()) return
    const newRow: ExpiryRow = {
      id: `exp-${Date.now()}`,
      itemId: form.itemId.trim(),
      desc: form.desc.trim(),
      expiry: form.expiry,
      days: form.days ?? 0,
      priority: form.priority,
    }
    setRows((prev) => [newRow, ...prev])
    setOpen(false)
  }

  return (
    <ModulePageLayout
      title="Expiry Tracking"
      description="Track expiry dates and alerts for perishable items."
      breadcrumbs={[{ label: "WMS" }, { label: "Expiry Tracking" }]}
    >
      <div className="grid gap-6">
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-wrap items-center justify-between gap-4 space-y-0">
            <div className="min-w-0">
              <CardTitle>Expiry Alerts</CardTitle>
              <CardDescription className="break-words">Items expiring within 30 days. Data in localStorage.</CardDescription>
            </div>
            <Button className="w-full flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Expiry Entry
            </Button>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="divide-y rounded-lg border md:hidden">
              {rows.map((row) => (
                <div key={row.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{row.itemId}</p>
                    <Badge variant={row.priority === "High" ? "destructive" : "secondary"}>{row.priority}</Badge>
                  </div>
                  <p className="mt-1 text-sm">{row.desc}</p>
                  <p className="text-xs text-muted-foreground">Expiry: {row.expiry}</p>
                  <p className="text-xs text-muted-foreground">Days Left: {row.days} days</p>
                  <Button variant="ghost" size="sm" className="mt-1 h-7 px-0 text-primary">Dispose</Button>
                </div>
              ))}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                <Table className="min-w-[860px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item ID</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Days Left</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.itemId}</TableCell>
                        <TableCell>{row.desc}</TableCell>
                        <TableCell>{row.expiry}</TableCell>
                        <TableCell>{row.days} days</TableCell>
                        <TableCell>
                          <Badge variant={row.priority === "High" ? "destructive" : "secondary"}>{row.priority}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-primary">Dispose</Button>
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
            <DialogTitle>Add Expiry Entry</DialogTitle>
            <p className="text-sm text-muted-foreground">New expiry alert. Stored in localStorage.</p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Item ID</Label>
              <Input value={form.itemId} onChange={(e) => setForm((f) => ({ ...f, itemId: e.target.value }))} placeholder="e.g. PR-7823" />
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
              <Label>Days Left</Label>
              <Input
                type="number"
                min={0}
                value={form.days || ""}
                onChange={(e) => setForm((f) => ({ ...f, days: parseInt(e.target.value, 10) || 0 }))}
                placeholder="0"
              />
            </div>
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
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
