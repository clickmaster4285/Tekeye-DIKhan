import { useEffect, useState } from "react"
import { Car, Settings, FileText } from "lucide-react"
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

const STORAGE_KEY = "wms_anpr_settings"

type AnprRow = { gate: string; camera: string; region: string; status: string }

const defaultRows: AnprRow[] = [
  { gate: "Main Gate - JCP", camera: "CAM-G01", region: "PK-Punjab", status: "Active" },
  { gate: "Toll Plaza North", camera: "CAM-TP01", region: "PK-Punjab", status: "Active" },
  { gate: "Warehouse Entry", camera: "CAM-WH-E1", region: "PK-KP", status: "Active" },
]

function loadRows(): AnprRow[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AnprRow[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return defaultRows
}

function saveRows(rows: AnprRow[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

const REGIONS = ["PK-Punjab", "PK-Sindh", "PK-KP", "PK-Balochistan", "PK-Gilgit"]

export default function AnprSettingsPage() {
  const [rows, setRows] = useState<AnprRow[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ gate: "", camera: "", region: "PK-Punjab", status: "Active" })

  useEffect(() => {
    setRows(loadRows())
  }, [])

  useEffect(() => {
    if (rows.length > 0) saveRows(rows)
  }, [rows])

  const openAddForm = () => {
    setForm({ gate: "", camera: "", region: "PK-Punjab", status: "Active" })
    setOpen(true)
  }

  const onSave = () => {
    if (!form.gate.trim() || !form.camera.trim()) return
    setRows((prev) => [{ ...form, gate: form.gate.trim(), camera: form.camera.trim() }, ...prev])
    setForm({ gate: "", camera: "", region: "PK-Punjab", status: "Active" })
    setOpen(false)
  }

  return (
    <ModulePageLayout
      title="ANPR Settings"
      description="Configure Automatic Number Plate Recognition for gates and toll plazas."
      breadcrumbs={[{ label: "WMS" }, { label: "ANPR Settings" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ANPR Cameras</CardTitle>
              <Car className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rows.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Reads Today</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">412</div>
              <p className="text-xs text-muted-foreground mt-1">Plates captured</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Match Rate</CardTitle>
              <Settings className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">96%</div>
              <p className="text-xs text-muted-foreground mt-1">Recognition accuracy</p>
            </CardContent>
          </Card>
        </div>
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle>ANPR Gate Configuration</CardTitle>
              <CardDescription className="break-words">Cameras and rules per gate / toll plaza</CardDescription>
            </div>
            <Button className="w-full bg-[#3b82f6] text-white hover:bg-[#2563eb] sm:w-auto" onClick={openAddForm}>
              Add Gate
            </Button>
          </CardHeader>
          <CardContent className="w-full min-w-0">
            <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
              <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Gate / Location</TableHead>
                  <TableHead>Camera</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.gate}-${row.camera}`}>
                    <TableCell className="font-medium">{row.gate}</TableCell>
                    <TableCell>{row.camera}</TableCell>
                    <TableCell>{row.region}</TableCell>
                    <TableCell><Badge variant="default">{row.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-[#3b82f6]">Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) setForm({ gate: "", camera: "", region: "PK-Punjab", status: "Active" }) }}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Gate</DialogTitle>
            <p className="text-sm text-muted-foreground">ANPR gate configuration. Data saved locally.</p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Gate / Location *</Label>
              <Input
                value={form.gate}
                onChange={(e) => setForm((p) => ({ ...p, gate: e.target.value }))}
                placeholder="e.g. Main Gate - JCP"
              />
            </div>
            <div className="space-y-2">
              <Label>Camera *</Label>
              <Input
                value={form.camera}
                onChange={(e) => setForm((p) => ({ ...p, camera: e.target.value }))}
                placeholder="e.g. CAM-G01"
              />
            </div>
            <div className="space-y-2">
              <Label>Region</Label>
              <Select value={form.region} onValueChange={(v) => setForm((p) => ({ ...p, region: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
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
