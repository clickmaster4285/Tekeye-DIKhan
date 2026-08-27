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

const STORAGE_KEY = "wms_auction_lots"

type LotRow = {
  id: string
  no: string
  desc: string
  reserve: string
  status: string
}

const defaultRows: LotRow[] = [
  { id: "1", no: "LOT-2024-0841", desc: "Electronics - Category A", reserve: "PKR 50,000", status: "Draft" },
  { id: "2", no: "LOT-2024-0840", desc: "Textiles - Bulk", reserve: "PKR 120,000", status: "Published" },
]

function loadRows(): LotRow[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return defaultRows
}

function saveRows(rows: LotRow[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

const STATUSES = ["Draft", "Published", "Sold", "Cancelled"]

export default function LotCreationPage() {
  const [rows, setRows] = useState<LotRow[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ no: "", desc: "", reserve: "", status: "Draft" })

  useEffect(() => {
    setRows(loadRows())
  }, [])

  useEffect(() => {
    if (rows.length > 0) saveRows(rows)
  }, [rows])

  const openAdd = () => {
    setForm({ no: "", desc: "", reserve: "", status: "Draft" })
    setOpen(true)
  }

  const onSave = () => {
    if (!form.no.trim() || !form.desc.trim() || !form.reserve.trim()) return
    const newRow: LotRow = {
      id: `lot-${Date.now()}`,
      no: form.no.trim(),
      desc: form.desc.trim(),
      reserve: form.reserve.trim(),
      status: form.status,
    }
    setRows((prev) => [newRow, ...prev])
    setOpen(false)
  }

  return (
    <ModulePageLayout
      title="Lot Creation"
      description="Create and manage auction lots."
      breadcrumbs={[{ label: "WMS" }, { label: "Lot Creation" }]}
    >
      <div className="grid gap-6">
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-wrap items-center justify-between gap-4 space-y-0">
            <div className="min-w-0">
              <CardTitle>Auction Lots</CardTitle>
              <CardDescription className="break-words">Create and manage lots for auction. Data in localStorage.</CardDescription>
            </div>
            <Button className="w-full flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" /> Create Lot
            </Button>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="divide-y rounded-lg border md:hidden">
              {rows.map((row) => (
                <div key={row.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{row.no}</p>
                    <Badge variant="outline">{row.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm">{row.desc}</p>
                  <p className="text-xs text-muted-foreground">Reserve: {row.reserve}</p>
                  <Button variant="ghost" size="sm" className="mt-1 h-7 px-0 text-primary">Edit</Button>
                </div>
              ))}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot No</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Reserve Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.no}</TableCell>
                        <TableCell>{row.desc}</TableCell>
                        <TableCell>{row.reserve}</TableCell>
                        <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-primary">Edit</Button>
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
            <DialogTitle>Create Lot</DialogTitle>
            <p className="text-sm text-muted-foreground">New auction lot. Stored in localStorage.</p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Lot No</Label>
              <Input value={form.no} onChange={(e) => setForm((f) => ({ ...f, no: e.target.value }))} placeholder="e.g. LOT-2024-0842" />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input value={form.desc} onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))} placeholder="Lot description" />
            </div>
            <div className="grid gap-2">
              <Label>Reserve Price</Label>
              <Input value={form.reserve} onChange={(e) => setForm((f) => ({ ...f, reserve: e.target.value }))} placeholder="e.g. PKR 50,000" />
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
