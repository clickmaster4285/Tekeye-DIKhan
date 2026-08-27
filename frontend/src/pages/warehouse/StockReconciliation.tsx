import { useEffect, useState } from "react"
import { CheckCircle, AlertCircle, Clock, FileCheck } from "lucide-react"
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
import { Progress } from "@/components/ui/progress"

const STORAGE_KEY = "wms_reconciliation_jobs"

type JobRow = {
  id: string
  wh: string
  zone: string
  type: string
  status: string
  variance: string
}

const defaultRows: JobRow[] = [
  { id: "RC-2024-0892", wh: "Peshawar", zone: "Z-C03", type: "Cycle Count", status: "Completed", variance: "0" },
  { id: "RC-2024-0893", wh: "Peshawar", zone: "Z-B02", type: "Full Count", status: "In Progress", variance: "—" },
  { id: "RC-2024-0891", wh: "Yarik", zone: "Z-A01-N", type: "Cycle Count", status: "Variance", variance: "-3" },
  { id: "RC-2024-0889", wh: "Peshawar", zone: "Z-D04", type: "Spot Check", status: "Completed", variance: "0" },
]

function loadRows(): JobRow[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return defaultRows
}

function saveRows(rows: JobRow[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

const JOB_TYPES = ["Cycle Count", "Full Count", "Spot Check"]
const STATUSES = ["Pending", "In Progress", "Completed", "Variance"]

export default function StockReconciliationPage() {
  const [rows, setRows] = useState<JobRow[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ id: "", wh: "Peshawar", zone: "Z-A01", type: "Cycle Count", status: "Pending", variance: "—" })

  useEffect(() => {
    setRows(loadRows())
  }, [])

  useEffect(() => {
    if (rows.length > 0) saveRows(rows)
  }, [rows])

  const openAdd = () => {
    setForm({ id: "", wh: "Peshawar", zone: "Z-A01", type: "Cycle Count", status: "Pending", variance: "—" })
    setOpen(true)
  }

  const onSave = () => {
    const jobId = form.id.trim() || `RC-2024-${String(Date.now()).slice(-4)}`
    const newRow: JobRow = {
      id: jobId,
      wh: form.wh,
      zone: form.zone,
      type: form.type,
      status: form.status,
      variance: form.variance,
    }
    setRows((prev) => [newRow, ...prev])
    setOpen(false)
  }

  const completed = rows.filter((r) => r.status === "Completed").length
  const inProgress = rows.filter((r) => r.status === "In Progress").length
  const variances = rows.filter((r) => r.status === "Variance").length
  const accuracy = rows.length > 0 ? Math.round((completed / rows.length) * 1000) / 10 : 0

  return (
    <ModulePageLayout
      title="Stock Reconciliation"
      description="Cycle counts, variance resolution, and physical vs system stock alignment."
      breadcrumbs={[{ label: "WMS" }, { label: "Stock Reconciliation" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completed}</div>
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inProgress}</div>
              <p className="text-xs text-muted-foreground mt-1">Active counts</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Variances</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{variances}</div>
              <p className="text-xs text-muted-foreground mt-1">Pending resolution</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Accuracy</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{accuracy}%</div>
              <Progress value={accuracy} className="mt-2 h-2" />
            </CardContent>
          </Card>
        </div>

        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-wrap items-center justify-between gap-4 space-y-0">
            <div className="min-w-0">
              <CardTitle>Reconciliation Jobs</CardTitle>
              <CardDescription className="break-words">Cycle counts and variance reports. Data in localStorage.</CardDescription>
            </div>
            <Button className="w-full flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" onClick={openAdd}>
              New Cycle Count
            </Button>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="divide-y rounded-lg border md:hidden">
              {rows.map((row) => (
                <div key={row.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{row.id}</p>
                    <Badge
                      variant={
                        row.status === "Completed"
                          ? "default"
                          : row.status === "In Progress"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {row.status}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <p className="truncate">Warehouse: <span className="text-foreground">{row.wh}</span></p>
                    <p className="truncate">Zone: <span className="text-foreground">{row.zone}</span></p>
                    <p className="truncate">Type: <span className="text-foreground">{row.type}</span></p>
                    <p className="truncate">Variance: <span className="text-foreground">{row.variance}</span></p>
                  </div>
                  <Button variant="ghost" size="sm" className="mt-1 h-7 px-0 text-primary">View</Button>
                </div>
              ))}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Variance</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.id}</TableCell>
                        <TableCell>{row.wh}</TableCell>
                        <TableCell>{row.zone}</TableCell>
                        <TableCell>{row.type}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.status === "Completed"
                                ? "default"
                                : row.status === "In Progress"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.variance}</TableCell>
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
        <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Cycle Count</DialogTitle>
            <p className="text-sm text-muted-foreground">New reconciliation job. Stored in localStorage.</p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Job ID (optional)</Label>
              <Input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} placeholder="e.g. RC-2024-0894" />
            </div>
            <div className="grid gap-2">
              <Label>Warehouse</Label>
              <Input value={form.wh} onChange={(e) => setForm((f) => ({ ...f, wh: e.target.value }))} placeholder="Peshawar" />
            </div>
            <div className="grid gap-2">
              <Label>Zone</Label>
              <Input value={form.zone} onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))} placeholder="Z-A01" />
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
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
            <div className="grid gap-2">
              <Label>Variance</Label>
              <Input value={form.variance} onChange={(e) => setForm((f) => ({ ...f, variance: e.target.value }))} placeholder="0 or —" />
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
