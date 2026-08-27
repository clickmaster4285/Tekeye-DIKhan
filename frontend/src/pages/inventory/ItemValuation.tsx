import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
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

const STORAGE_KEY = "wms_item_valuations"

type ValuationRow = {
  id: string
  itemId: string
  desc: string
  value: string
  date: string
  status: string
}

const defaultRows: ValuationRow[] = [
  { id: "1", itemId: "ITM-7821", desc: "Electronics - Category A", value: "55,000", date: "2024-02-04", status: "Approved" },
  { id: "2", itemId: "ITM-7822", desc: "Textiles - Bulk", value: "125,000", date: "2024-02-03", status: "Pending" },
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

const STATUSES = ["Pending", "Approved", "Rejected"]

export default function ItemValuationPage() {
  const [rows, setRows] = useState<ValuationRow[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ itemId: "", desc: "", value: "", date: "", status: "Pending" })

  useEffect(() => {
    setRows(loadRows())
  }, [])

  useEffect(() => {
    if (rows.length > 0) saveRows(rows)
  }, [rows])

  const openAdd = () => {
    setForm({
      itemId: "",
      desc: "",
      value: "",
      date: new Date().toISOString().slice(0, 10),
      status: "Pending",
    })
    setOpen(true)
  }

  const onSave = () => {
    if (!form.itemId.trim() || !form.desc.trim() || !form.value.trim() || !form.date.trim()) return
    const newRow: ValuationRow = {
      id: `val-${Date.now()}`,
      itemId: form.itemId.trim(),
      desc: form.desc.trim(),
      value: form.value.trim(),
      date: form.date,
      status: form.status,
    }
    setRows((prev) => [newRow, ...prev])
    setOpen(false)
  }

  return (
    <ModulePageLayout
      title="Item Valuation"
      description="Valuation of items for auction and disposal."
      breadcrumbs={[{ label: "WMS" }, { label: "Item Valuation" }]}
    >
      <div className="grid gap-6">
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-wrap items-center justify-between gap-4 space-y-0">
            <div className="min-w-0">
              <CardTitle>Valuation Register</CardTitle>
              <CardDescription className="break-words">Items valued for auction. Data in localStorage.</CardDescription>
            </div>
            <Button className="w-full flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />
              New Valuation
            </Button>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="divide-y rounded-lg border md:hidden">
              {rows.map((row) => (
                <div key={row.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{row.itemId}</p>
                    <Badge variant="outline">{row.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm">{row.desc}</p>
                  <p className="text-xs text-muted-foreground">Valuation: {row.value} PKR</p>
                  <p className="text-xs text-muted-foreground">Date: {row.date}</p>
                  <Button variant="ghost" size="sm" className="mt-1 h-7 px-0 text-primary">View</Button>
                </div>
              ))}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item ID</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Valuation (PKR)</TableHead>
                      <TableHead>Valuation Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.itemId}</TableCell>
                        <TableCell>{row.desc}</TableCell>
                        <TableCell>{row.value}</TableCell>
                        <TableCell>{row.date}</TableCell>
                        <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
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
            <DialogTitle>New Valuation</DialogTitle>
            <p className="text-sm text-muted-foreground">New valuation entry. Stored in localStorage.</p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Item ID</Label>
              <Input value={form.itemId} onChange={(e) => setForm((f) => ({ ...f, itemId: e.target.value }))} placeholder="e.g. ITM-7823" />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input value={form.desc} onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))} placeholder="Item description" />
            </div>
            <div className="grid gap-2">
              <Label>Valuation (PKR)</Label>
              <Input value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} placeholder="e.g. 55,000" />
            </div>
            <div className="grid gap-2">
              <Label>Valuation Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
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
