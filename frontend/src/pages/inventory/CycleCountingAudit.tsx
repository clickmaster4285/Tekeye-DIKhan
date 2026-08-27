import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ClipboardCheck, Plus, Eye } from "lucide-react"
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
import { CUSTOMS_STATIONS } from "@/lib/case-fir-spec"
import { getCycleCountingDetailPath } from "@/routes/config"

const STORAGE_KEY = "wms_cycle_counting_audit"

const STATUSES = ["Pending", "In Progress", "Completed", "Variance Reported"] as const

type CycleCountRow = {
  id: string
  qrCodeNumber?: string
  auditRef: string
  customsStation: string
  godownLocation: string
  auditDate: string
  caseSeizureRef: string
  expectedQty: number
  actualQty: number
  variance: number
  auditedByOfficerName: string
  auditedByBadgeId: string
  status: string
  remarks: string
}

const defaultRows: CycleCountRow[] = [
  { id: "1", qrCodeNumber: "QR-AUD-2024-001", auditRef: "AUD-2024-001", customsStation: "DI Khan", godownLocation: "Bonded Godown A - Bay 12", auditDate: "2024-02-01", caseSeizureRef: "SZ-2024-001", expectedQty: 450, actualQty: 448, variance: -2, auditedByOfficerName: "Inspector M. Khan", auditedByBadgeId: "PC-8841", status: "Completed", remarks: "Shortage of 2 PCS noted" },
  { id: "2", qrCodeNumber: "QR-AUD-2024-002", auditRef: "AUD-2024-002", customsStation: "Customs Peshawar", godownLocation: "Transit Shed B", auditDate: "2024-02-03", caseSeizureRef: "SZ-2024-002", expectedQty: 1200, actualQty: 1200, variance: 0, auditedByOfficerName: "ASI Ahmed Raza", auditedByBadgeId: "PC-7722", status: "Completed", remarks: "" },
  { id: "3", qrCodeNumber: "QR-AUD-2024-003", auditRef: "AUD-2024-003", customsStation: "Yarik", godownLocation: "Bonded Godown C - Bay 05", auditDate: "2024-02-05", caseSeizureRef: "SZ-2024-003", expectedQty: 120, actualQty: 118, variance: -2, auditedByOfficerName: "Inspector S. Ali", auditedByBadgeId: "PC-9901", status: "Variance Reported", remarks: "Physical count short" },
]

function loadRows(): CycleCountRow[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return defaultRows
}

function saveRows(rows: CycleCountRow[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

export default function CycleCountingAuditPage() {
  const [rows, setRows] = useState<CycleCountRow[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    qrCodeNumber: "",
    auditRef: "",
    customsStation: "DI Khan",
    godownLocation: "",
    auditDate: new Date().toISOString().slice(0, 10),
    caseSeizureRef: "",
    expectedQty: 0,
    actualQty: 0,
    auditedByOfficerName: "",
    auditedByBadgeId: "",
    status: "Pending",
    remarks: "",
  })

  useEffect(() => {
    setRows(loadRows())
  }, [])

  useEffect(() => {
    if (rows.length > 0) saveRows(rows)
  }, [rows])

  const openAdd = () => {
    setForm({
      qrCodeNumber: "",
      auditRef: "",
      customsStation: "DI Khan",
      godownLocation: "",
      auditDate: new Date().toISOString().slice(0, 10),
      caseSeizureRef: "",
      expectedQty: 0,
      actualQty: 0,
      auditedByOfficerName: "",
      auditedByBadgeId: "",
      status: "Pending",
      remarks: "",
    })
    setOpen(true)
  }

  const onSave = () => {
    if (!form.auditRef.trim() || !form.godownLocation.trim() || !form.auditDate.trim()) return
    const expected = form.expectedQty || 0
    const actual = form.actualQty || 0
    const newRow: CycleCountRow = {
      id: `cc-${Date.now()}`,
      qrCodeNumber: form.qrCodeNumber.trim() || `QR-AUD-${Date.now()}`,
      auditRef: form.auditRef.trim(),
      customsStation: form.customsStation,
      godownLocation: form.godownLocation.trim(),
      auditDate: form.auditDate,
      caseSeizureRef: form.caseSeizureRef.trim(),
      expectedQty: expected,
      actualQty: actual,
      variance: actual - expected,
      auditedByOfficerName: form.auditedByOfficerName.trim(),
      auditedByBadgeId: form.auditedByBadgeId.trim(),
      status: form.status,
      remarks: form.remarks.trim(),
    }
    setRows((prev) => [newRow, ...prev])
    setOpen(false)
  }

  return (
    <ModulePageLayout
      title="Cycle Counting & Audit"
      description="Pakistan Customs: Physical count and audit of godown stock; variance and auditing officer. Data stored in localStorage."
      breadcrumbs={[{ label: "WMS" }, { label: "Inventory Management" }, { label: "Cycle Counting & Audit" }]}
    >
      <div className="grid gap-6">
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-wrap items-center justify-between gap-4 space-y-0">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Cycle Counting & Audit
              </CardTitle>
              <CardDescription className="break-words">Audit ref, customs station, godown location, case/seizure ref and auditing officer. Data in localStorage.</CardDescription>
            </div>
            <Button className="w-full flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />
              New Audit
            </Button>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3 overflow-hidden">
            <div className="divide-y rounded-lg border md:hidden">
              {rows.map((row) => (
                <div key={row.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-mono text-sm font-semibold">{row.qrCodeNumber || "—"}</p>
                    <Badge variant={row.status === "Completed" ? "default" : row.status === "Variance Reported" ? "destructive" : "secondary"}>
                      {row.status}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <p className="truncate">Audit Ref: <span className="text-foreground">{row.auditRef}</span></p>
                    <p className="truncate">Date: <span className="text-foreground">{row.auditDate}</span></p>
                    <p className="truncate">Station: <span className="text-foreground">{row.customsStation}</span></p>
                    <p className="truncate">Case Ref: <span className="text-foreground">{row.caseSeizureRef || "—"}</span></p>
                    <p className="col-span-2 truncate">Location: <span className="text-foreground">{row.godownLocation}</span></p>
                    <p className="truncate">Expected: <span className="text-foreground">{row.expectedQty}</span></p>
                    <p className="truncate">Actual: <span className="text-foreground">{row.actualQty}</span></p>
                    <p className="truncate">
                      Variance:{" "}
                      <span className={row.variance !== 0 ? "font-medium text-amber-600" : "text-foreground"}>
                        {row.variance > 0 ? "+" : ""}{row.variance}
                      </span>
                    </p>
                    <p className="col-span-2 truncate">Audited By: <span className="text-foreground">{row.auditedByOfficerName ? `${row.auditedByOfficerName} (${row.auditedByBadgeId || "—"})` : "—"}</span></p>
                  </div>
                  <Button variant="ghost" size="sm" asChild className="mt-1 h-7 px-0">
                    <Link to={getCycleCountingDetailPath(row.id)}>
                      <Eye className="mr-1 h-4 w-4" />
                      View
                    </Link>
                  </Button>
                </div>
              ))}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="max-h-[60vh] w-full max-w-full overflow-x-auto overflow-y-auto rounded-lg border pb-2">
              <Table className="min-w-[1320px]">
              <TableHeader>
                <TableRow>
                  <TableHead> QR Code</TableHead>
                  <TableHead>Audit Ref</TableHead>
                  <TableHead>Customs Station</TableHead>
                  <TableHead>Godown/Location</TableHead>
                  <TableHead>Audit Date</TableHead>
                  <TableHead>Case/Seizure Ref</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>Variance</TableHead>
                  <TableHead>Audited By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono">{row.qrCodeNumber || "—"}</TableCell>
                    <TableCell className="font-medium">{row.auditRef}</TableCell>
                    <TableCell>{row.customsStation}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[140px] truncate">{row.godownLocation}</TableCell>
                    <TableCell>{row.auditDate}</TableCell>
                    <TableCell>{row.caseSeizureRef || "—"}</TableCell>
                    <TableCell>{row.expectedQty}</TableCell>
                    <TableCell>{row.actualQty}</TableCell>
                    <TableCell>
                      <span className={row.variance !== 0 ? "text-amber-600 font-medium" : ""}>
                        {row.variance > 0 ? "+" : ""}{row.variance}
                      </span>
                    </TableCell>
                    <TableCell>{row.auditedByOfficerName ? `${row.auditedByOfficerName} (${row.auditedByBadgeId || "—"})` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === "Completed" ? "default" : row.status === "Variance Reported" ? "destructive" : "secondary"}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={getCycleCountingDetailPath(row.id)}>
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Link>
                      </Button>
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
            <DialogTitle>New Cycle Count / Audit</DialogTitle>
            <p className="text-sm text-muted-foreground">Pakistan Customs physical count and audit. Stored in localStorage.</p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>QR Code Number</Label>
              <Input value={form.qrCodeNumber} onChange={(e) => setForm((f) => ({ ...f, qrCodeNumber: e.target.value }))} placeholder="e.g. QR-AUD-2024-003 (auto-generated if blank)" />
            </div>
            <div className="grid gap-2">
              <Label>Audit Reference *</Label>
              <Input value={form.auditRef} onChange={(e) => setForm((f) => ({ ...f, auditRef: e.target.value }))} placeholder="e.g. AUD-2024-003" />
            </div>
            <div className="grid gap-2">
              <Label>Customs Station</Label>
              <Select value={form.customsStation} onValueChange={(v) => setForm((f) => ({ ...f, customsStation: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CUSTOMS_STATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Godown / Location *</Label>
              <Input value={form.godownLocation} onChange={(e) => setForm((f) => ({ ...f, godownLocation: e.target.value }))} placeholder="e.g. Bonded Godown A - Bay 12" />
            </div>
            <div className="grid gap-2">
              <Label>Audit Date *</Label>
              <Input type="date" value={form.auditDate} onChange={(e) => setForm((f) => ({ ...f, auditDate: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Case / Seizure Reference</Label>
              <Input value={form.caseSeizureRef} onChange={(e) => setForm((f) => ({ ...f, caseSeizureRef: e.target.value }))} placeholder="e.g. SZ-2024-001" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label>Expected Qty</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.expectedQty || ""}
                  onChange={(e) => setForm((f) => ({ ...f, expectedQty: parseInt(e.target.value, 10) || 0 }))}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label>Actual Qty</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.actualQty || ""}
                  onChange={(e) => setForm((f) => ({ ...f, actualQty: parseInt(e.target.value, 10) || 0 }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Audited By (Officer Name)</Label>
              <Input value={form.auditedByOfficerName} onChange={(e) => setForm((f) => ({ ...f, auditedByOfficerName: e.target.value }))} placeholder="Officer name" />
            </div>
            <div className="grid gap-2">
              <Label>Officer Badge / ID</Label>
              <Input value={form.auditedByBadgeId} onChange={(e) => setForm((f) => ({ ...f, auditedByBadgeId: e.target.value }))} placeholder="e.g. PC-8841" />
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
              <Label>Remarks</Label>
              <Input value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="Optional" />
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
