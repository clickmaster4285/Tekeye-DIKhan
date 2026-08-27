import { useEffect, useState } from "react"
import { Handshake, Plus } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const STORAGE_KEY = "wms_handover_requests"

type HandoverRow = { ref: string; by: string; date: string; status: string }

const defaultRows: HandoverRow[] = [
  { ref: "HO-2024-0841", by: "Yarik Collectorate", date: "2024-02-04", status: "Pending" },
  { ref: "HO-2024-0840", by: "Peshawar Collectorate", date: "2024-02-03", status: "Completed" },
]

function loadRows(): HandoverRow[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as HandoverRow[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return defaultRows
}

function saveRows(rows: HandoverRow[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

const REQUESTERS = ["Yarik Collectorate", "Peshawar Collectorate", "Peshawar Collectorate", "Rawalpindi Collectorate"]
const STATUSES = ["Pending", "Completed"]

export default function HandoverRequestsPage() {
  const [rows, setRows] = useState<HandoverRow[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ by: "Yarik Collectorate", date: "", status: "Pending" })

  useEffect(() => {
    setRows(loadRows())
  }, [])

  useEffect(() => {
    if (rows.length > 0) saveRows(rows)
  }, [rows])

  const openAddForm = () => {
    setForm({ by: "Yarik Collectorate", date: new Date().toISOString().slice(0, 10), status: "Pending" })
    setOpen(true)
  }

  const onSave = () => {
    const ref = `HO-2024-${String(Date.now()).slice(-4)}`
    const date = form.date || new Date().toISOString().slice(0, 10)
    setRows((prev) => [{ ref, by: form.by, date, status: form.status }, ...prev])
    setForm({ by: "Yarik Collectorate", date: "", status: "Pending" })
    setOpen(false)
  }

  return (
    <ModulePageLayout
      title="Handover Requests"
      description="Manage handover requests and approvals."
      breadcrumbs={[{ label: "WMS" }, { label: "Handover Requests" }]}
    >
      <div className="grid gap-6">
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Handover Requests</CardTitle>
              <CardDescription className="break-words">Pending and completed handovers</CardDescription>
            </div>
            <Button className="w-full bg-[#3b82f6] text-white hover:bg-[#2563eb] sm:w-auto" onClick={openAddForm}>
              <Plus className="h-4 w-4 mr-2" /> New Handover Request
            </Button>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="divide-y rounded-lg border md:hidden">
              {rows.map((row) => (
                <div key={row.ref} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{row.ref}</p>
                    <Badge variant={row.status === "Completed" ? "default" : "secondary"}>{row.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Requested By: {row.by}</p>
                  <p className="text-xs text-muted-foreground">Date: {row.date}</p>
                  <Button variant="ghost" size="sm" className="mt-1 h-7 px-0 text-[#3b82f6]">View</Button>
                </div>
              ))}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ref</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.ref}>
                        <TableCell className="font-medium">{row.ref}</TableCell>
                        <TableCell>{row.by}</TableCell>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>
                          <Badge variant={row.status === "Completed" ? "default" : "secondary"}>{row.status}</Badge>
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

      <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) setForm({ by: "Yarik Collectorate", date: "", status: "Pending" }) }}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Handover Request</DialogTitle>
            <p className="text-sm text-muted-foreground">Ref will be auto-generated. Data saved locally.</p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Requested By</Label>
              <Select value={form.by} onValueChange={(v) => setForm((p) => ({ ...p, by: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUESTERS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col-reverse justify-end gap-2 pt-2 sm:flex-row">
              <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">Cancel</Button>
              <Button onClick={onSave} className="w-full sm:w-auto">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}
