import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  type CaseFileForm,
  type CaseType,
  type CaseCategory,
  type CasePriority,
  type CaseStatus,
  CASE_TABLE_COLUMNS,
} from "@/lib/case-fir-spec"

const STORAGE_KEY = "wms_case_file_creation"

const CASE_TYPES: CaseType[] = ["Criminal", "Civil", "Administrative"]
const CASE_CATEGORIES: CaseCategory[] = ["Smuggling", "Tax Evasion", "Contraband", "Counterfeit", "Other"]
const CASE_PRIORITIES: CasePriority[] = ["Low", "Medium", "High", "Critical"]
const CASE_STATUSES: CaseStatus[] = ["Investigation", "Prosecution", "In Court", "Appeal", "Concluded", "Closed"]

function emptyForm(): CaseFileForm {
  return {
    caseId: "",
    caseNumber: "",
    firReference: "",
    seizureId: "",
    caseType: "Criminal",
    caseCategory: "Smuggling",
    casePriority: "Medium",
    caseStatus: "Investigation",
    caseOpeningDate: new Date().toISOString().slice(0, 10),
    caseClosureDate: "",
    leadInvestigatorName: "",
    leadInvestigatorBadgeId: "",
    accusedName: "",
    accusedId: "",
    primaryCharge: "",
    chargeLegalReference: "",
    courtName: "",
    courtType: "",
    courtCaseNumber: "",
    judgeName: "",
    nextHearingDate: "",
    prosecutorName: "",
    prosecutorContact: "",
    defenseCounselName: "",
    remarks: "",
  }
}

type StoredCase = CaseFileForm & { id: string }

function ensureCaseShape(r: Record<string, unknown>): StoredCase {
  const base = emptyForm()
  const id = String(r.id ?? r.caseId ?? `cf-${Date.now()}`)
  return {
    ...base,
    ...r,
    id,
    caseId: String(r.caseId ?? id),
    caseNumber: String(r.caseNumber ?? ""),
    firReference: String(r.firReference ?? r.fir ?? ""),
    seizureId: String(r.seizureId ?? ""),
    caseType: (r.caseType as CaseType) ?? base.caseType,
    caseCategory: (r.caseCategory as CaseCategory) ?? base.caseCategory,
    casePriority: (r.casePriority as CasePriority) ?? base.casePriority,
    caseStatus: (r.caseStatus as CaseStatus) ?? base.caseStatus,
    caseOpeningDate: String(r.caseOpeningDate ?? r.created ?? ""),
    accusedName: String(r.accusedName ?? ""),
    primaryCharge: String(r.primaryCharge ?? ""),
    courtName: String(r.courtName ?? ""),
    nextHearingDate: String(r.nextHearingDate ?? ""),
  }
}

const defaultRows: StoredCase[] = [
  { ...emptyForm(), id: "cf-1", caseId: "CF-2024-0841", caseNumber: "CN-2024-0841", firReference: "FIR-2024-0841", seizureId: "SZ-2024-001", caseOpeningDate: "2024-02-04", accusedName: "Accused A", primaryCharge: "Customs Act S.2", courtName: "Customs Court Yarik", nextHearingDate: "2024-03-01", caseStatus: "In Court" },
  { ...emptyForm(), id: "cf-2", caseId: "CF-2024-0840", caseNumber: "CN-2024-0840", firReference: "FIR-2024-0840", seizureId: "SZ-2024-002", caseOpeningDate: "2024-02-03", accusedName: "Accused B", primaryCharge: "Tax Evasion", courtName: "Peshawar High Court", caseStatus: "Investigation" },
]

function loadRows(): StoredCase[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(ensureCaseShape)
    }
  } catch {}
  return defaultRows
}

function saveRows(rows: StoredCase[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

function generateCaseId(): string {
  return `CF-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000 + 1000))}`
}

export default function CaseFileCreationPage() {
  const [rows, setRows] = useState<StoredCase[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CaseFileForm>(emptyForm())

  useEffect(() => {
    setRows(loadRows())
  }, [])

  useEffect(() => {
    if (rows.length > 0) saveRows(rows)
  }, [rows])

  const openAddForm = () => {
    setForm({ ...emptyForm(), caseId: generateCaseId(), caseNumber: generateCaseId().replace("CF-", "CN-") })
    setOpen(true)
  }

  const setFormField = <K extends keyof CaseFileForm>(key: K, value: CaseFileForm[K]) => {
    setForm((p) => ({ ...p, [key]: value }))
  }

  const onSave = () => {
    if (!form.firReference?.trim()) return
    const caseId = form.caseId.trim() || generateCaseId()
    const newRow: StoredCase = { ...form, caseId, id: `cf-${Date.now()}` }
    setRows((prev) => [newRow, ...prev])
    setForm(emptyForm())
    setOpen(false)
  }

  const canSave = form.firReference?.trim() !== ""

  return (
    <ModulePageLayout
      title="Case File Creation"
      description="Create and manage case files with full details: FIR reference, seizure, type, category, investigation, accused, charges, court, and hearings."
      breadcrumbs={[{ label: "WMS" }, { label: "Case File Creation" }]}
    >
      <div className="grid gap-6">
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Case Files</CardTitle>
              <CardDescription className="break-words">
                All case records with FIR ref, seizure, type, category, accused, charges, court, and next hearing
              </CardDescription>
            </div>
            <Button className="w-full bg-[#3b82f6] text-white hover:bg-[#2563eb] sm:w-auto" onClick={openAddForm}>
              <Plus className="h-4 w-4 mr-2" /> New Case File
            </Button>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="max-h-[62vh] divide-y overflow-y-auto overflow-x-hidden rounded-lg border md:hidden">
              {rows.map((row) => (
                <div key={row.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{row.caseId}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.caseNumber || "—"} • {row.firReference || "—"}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">{row.caseStatus}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <p className="truncate text-muted-foreground">Type: <span className="text-foreground">{row.caseType}</span></p>
                    <p className="truncate text-muted-foreground">Priority: <span className="text-foreground">{row.casePriority}</span></p>
                    <p className="truncate text-muted-foreground">Accused: <span className="text-foreground">{row.accusedName || "—"}</span></p>
                    <p className="truncate text-muted-foreground">Court: <span className="text-foreground">{row.courtName || "—"}</span></p>
                    <p className="col-span-2 truncate text-muted-foreground">Hearing: <span className="text-foreground">{row.nextHearingDate || "—"}</span></p>
                  </div>
                  <Button variant="ghost" size="sm" className="mt-1 h-7 px-0 text-[#3b82f6]">View</Button>
                </div>
              ))}
            </div>
            <div className="hidden w-full min-w-0 md:block">
              <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
              <Table className="min-w-[1350px]">
                <TableHeader>
                  <TableRow>
                    {CASE_TABLE_COLUMNS.map((col) => (
                      <TableHead key={col}>{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.caseId}</TableCell>
                      <TableCell>{row.caseNumber}</TableCell>
                      <TableCell>{row.firReference}</TableCell>
                      <TableCell>{row.seizureId || "—"}</TableCell>
                      <TableCell>{row.caseType}</TableCell>
                      <TableCell>{row.caseCategory}</TableCell>
                      <TableCell>{row.casePriority}</TableCell>
                      <TableCell><Badge variant="outline">{row.caseStatus}</Badge></TableCell>
                      <TableCell>{row.accusedName || "—"}</TableCell>
                      <TableCell>{row.primaryCharge || "—"}</TableCell>
                      <TableCell>{row.courtName || "—"}</TableCell>
                      <TableCell>{row.nextHearingDate || "—"}</TableCell>
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

      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) setForm(emptyForm()); setOpen(isOpen) }}>
        <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>New Case File</DialogTitle>
            <CardDescription>Link to FIR and seizure; set case type, category, investigation, accused, charges, and court details.</CardDescription>
          </DialogHeader>
          <Tabs defaultValue="case" className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
              <TabsTrigger value="case">Case & FIR</TabsTrigger>
              <TabsTrigger value="parties">Parties & Charges</TabsTrigger>
              <TabsTrigger value="court">Court & Hearing</TabsTrigger>
            </TabsList>

            <TabsContent value="case" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Case ID *</Label>
                  <Input value={form.caseId} onChange={(e) => setFormField("caseId", e.target.value)} placeholder="Auto-generated if empty" />
                </div>
                <div className="space-y-2">
                  <Label>Case Number</Label>
                  <Input value={form.caseNumber} onChange={(e) => setFormField("caseNumber", e.target.value)} placeholder="e.g. CN-2024-0841" />
                </div>
                <div className="space-y-2">
                  <Label>FIR Reference *</Label>
                  <Input value={form.firReference} onChange={(e) => setFormField("firReference", e.target.value)} placeholder="e.g. FIR-2024-0841" required />
                </div>
                <div className="space-y-2">
                  <Label>Seizure ID</Label>
                  <Input value={form.seizureId} onChange={(e) => setFormField("seizureId", e.target.value)} placeholder="e.g. SZ-2024-001" />
                </div>
                <div className="space-y-2">
                  <Label>Case Type *</Label>
                  <Select value={form.caseType} onValueChange={(v) => setFormField("caseType", v as CaseType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CASE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Case Category *</Label>
                  <Select value={form.caseCategory} onValueChange={(v) => setFormField("caseCategory", v as CaseCategory)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CASE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Case Priority</Label>
                  <Select value={form.casePriority} onValueChange={(v) => setFormField("casePriority", v as CasePriority)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CASE_PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Case Status *</Label>
                  <Select value={form.caseStatus} onValueChange={(v) => setFormField("caseStatus", v as CaseStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CASE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Case Opening Date *</Label>
                  <Input type="date" value={form.caseOpeningDate} onChange={(e) => setFormField("caseOpeningDate", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Case Closure Date</Label>
                  <Input type="date" value={form.caseClosureDate} onChange={(e) => setFormField("caseClosureDate", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Lead Investigator Name</Label>
                  <Input value={form.leadInvestigatorName} onChange={(e) => setFormField("leadInvestigatorName", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Lead Investigator Badge / ID</Label>
                  <Input value={form.leadInvestigatorBadgeId} onChange={(e) => setFormField("leadInvestigatorBadgeId", e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Remarks</Label>
                  <Textarea value={form.remarks} onChange={(e) => setFormField("remarks", e.target.value)} rows={2} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="parties" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Accused Name</Label>
                  <Input value={form.accusedName} onChange={(e) => setFormField("accusedName", e.target.value)} placeholder="Full name" />
                </div>
                <div className="space-y-2">
                  <Label>Accused ID / CNIC</Label>
                  <Input value={form.accusedId} onChange={(e) => setFormField("accusedId", e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Primary Charge *</Label>
                  <Input value={form.primaryCharge} onChange={(e) => setFormField("primaryCharge", e.target.value)} placeholder="e.g. Customs Act S.2(1)" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Charge Legal Reference</Label>
                  <Input value={form.chargeLegalReference} onChange={(e) => setFormField("chargeLegalReference", e.target.value)} placeholder="Section, clause, act" />
                </div>
                <div className="space-y-2">
                  <Label>Prosecutor Name</Label>
                  <Input value={form.prosecutorName} onChange={(e) => setFormField("prosecutorName", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Prosecutor Contact</Label>
                  <Input value={form.prosecutorContact} onChange={(e) => setFormField("prosecutorContact", e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Defense Counsel Name</Label>
                  <Input value={form.defenseCounselName} onChange={(e) => setFormField("defenseCounselName", e.target.value)} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="court" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Court Name</Label>
                  <Input value={form.courtName} onChange={(e) => setFormField("courtName", e.target.value)} placeholder="e.g. Customs Court Yarik" />
                </div>
                <div className="space-y-2">
                  <Label>Court Type</Label>
                  <Input value={form.courtType} onChange={(e) => setFormField("courtType", e.target.value)} placeholder="e.g. Magistrate, District" />
                </div>
                <div className="space-y-2">
                  <Label>Court Case Number</Label>
                  <Input value={form.courtCaseNumber} onChange={(e) => setFormField("courtCaseNumber", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Judge Name</Label>
                  <Input value={form.judgeName} onChange={(e) => setFormField("judgeName", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Next Hearing Date</Label>
                  <Input type="date" value={form.nextHearingDate} onChange={(e) => setFormField("nextHearingDate", e.target.value)} />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex flex-col-reverse justify-end gap-2 border-t pt-4 sm:flex-row">
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={onSave} disabled={!canSave} className="w-full sm:w-auto">Save Case File</Button>
          </div>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}
