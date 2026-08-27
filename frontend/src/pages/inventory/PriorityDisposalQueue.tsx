import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

const STORAGE_KEY = "wms_priority_disposal_queue"

type QueueRow = {
  id: string
  priority: number
  itemId: string
  desc: string
  expiry: string
  status: string
}

const defaultRows: QueueRow[] = [
  { id: "1", priority: 1, itemId: "PR-7822", desc: "Pharma - Temp control", expiry: "2024-02-05", status: "Queued" },
  { id: "2", priority: 2, itemId: "PR-7821", desc: "Food items - Lot A", expiry: "2024-02-10", status: "Queued" },
]

function loadRows(): QueueRow[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return defaultRows
}

function saveRows(rows: QueueRow[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

export default function PriorityDisposalQueuePage() {
  const [rows, setRows] = useState<QueueRow[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ itemId: "", desc: "", expiry: "", priority: 1 })

  useEffect(() => {
    setRows(loadRows())
  }, [])

  useEffect(() => {
    if (rows.length > 0) saveRows(rows)
  }, [rows])

  const openAdd = () => {
    const nextPriority = rows.length > 0 ? Math.max(...rows.map((r) => r.priority)) + 1 : 1
    setForm({ itemId: "", desc: "", expiry: "", priority: nextPriority })
    setOpen(true)
  }

  const onSave = () => {
    if (!form.itemId.trim() || !form.desc.trim() || !form.expiry.trim()) return
    const newRow: QueueRow = {
      id: `pdq-${Date.now()}`,
      priority: form.priority,
      itemId: form.itemId.trim(),
      desc: form.desc.trim(),
      expiry: form.expiry,
      status: "Queued",
    }
    setRows((prev) => [newRow, ...prev])
    setOpen(false)
  }

  return (
    <ModulePageLayout
      title="Priority Disposal Queue"
      description="Queue of items prioritized for disposal."
      breadcrumbs={[{ label: "WMS" }, { label: "Priority Disposal Queue" }]}
    >
      <div className="grid gap-6">
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-wrap items-center justify-between gap-4 space-y-0">
            <div className="min-w-0">
              <CardTitle>Disposal Queue</CardTitle>
              <CardDescription className="break-words">Items ordered by priority for disposal. Data in localStorage.</CardDescription>
            </div>
            <Button className="w-full flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add to Queue
            </Button>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="divide-y rounded-lg border md:hidden">
              {rows.map((row) => (
                <div key={row.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">Priority {row.priority}</p>
                    <Badge variant="secondary">{row.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Item: {row.itemId}</p>
                  <p className="text-sm">{row.desc}</p>
                  <p className="text-xs text-muted-foreground">Expiry: {row.expiry}</p>
                  <Button variant="ghost" size="sm" className="mt-1 h-7 px-0 text-primary">Process</Button>
                </div>
              ))}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                <Table className="min-w-[860px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Priority</TableHead>
                      <TableHead>Item ID</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.priority}</TableCell>
                        <TableCell>{row.itemId}</TableCell>
                        <TableCell>{row.desc}</TableCell>
                        <TableCell>{row.expiry}</TableCell>
                        <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-primary">Process</Button>
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
            <DialogTitle>Add to Disposal Queue</DialogTitle>
            <p className="text-sm text-muted-foreground">New queue entry. Stored in localStorage.</p>
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
              <Label>Priority (number)</Label>
              <Input
                type="number"
                min={1}
                value={form.priority || ""}
                onChange={(e) => setForm((f) => ({ ...f, priority: parseInt(e.target.value, 10) || 1 }))}
                placeholder="1"
              />
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
