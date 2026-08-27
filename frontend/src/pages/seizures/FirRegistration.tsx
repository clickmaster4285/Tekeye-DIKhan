import { useEffect, useState } from "react"
import { FileText, Scale, Plus, Search } from "lucide-react"
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
  type FirRegistrationForm,
  type FirStatus,
  FIR_TABLE_COLUMNS,
  CUSTOMS_STATIONS,
} from "@/lib/case-fir-spec"

const STORAGE_KEY = "wms_fir_registration"

const FIR_STATUSES: FirStatus[] = [
  "Registered",
  "Under Investigation",
  "Challan Filed",
  "In Court",
  "Closed",
]

function emptyForm(): FirRegistrationForm {
  return {
    firNumber: "",
    registrationDate: new Date().toISOString().slice(0, 10),
    registrationTime: new Date().toTimeString().slice(0, 5),
    customsOfficeStation: "Customs Peshawer",
    stationCode: "",
    districtRegion: "",
    complainantName: "",
    complainantFatherName: "",
    complainantCnic: "",
    complainantAddress: "",
    complainantContact: "",
    complainantEmail: "",
    accusedName: "",
    accusedFatherName: "",
    accusedCnic: "",
    accusedAddress: "",
    accusedUnknown: "No",
    accusedNationality: "",
    accusedOccupation: "",
    dateOfOccurrence: "",
    timeOfOccurrence: "",
    placeOfOccurrence: "",
    placeDetails: "",
    descriptionOfOffence: "",
    sectionOfLaw: "",
    sectionDetails: "",
    propertyInvolved: "No",
    propertyDescription: "",
    propertyValue: "",
    currency: "PKR",
    witness1Name: "",
    witness1Address: "",
    witness1Contact: "",
    witness2Name: "",
    witness2Address: "",
    witness2Contact: "",
    investigationOfficerName: "",
    investigationOfficerBadgeId: "",
    investigationOfficerContact: "",
    seizureReference: "",
    seizureId: "",
    caseNumber: "",
    status: "Registered",
    remarks: "",
  }
}

type StoredFir = FirRegistrationForm & { id: string }

function ensureFirShape(r: Record<string, unknown>): StoredFir {
  const base = emptyForm()
  const id = String(r.id ?? `fir-${Date.now()}`)
  return {
    ...base,
    ...r,
    id,
    firNumber: String(r.firNumber ?? r.no ?? ""),
    registrationDate: String(r.registrationDate ?? r.date ?? ""),
    customsOfficeStation: String(r.customsOfficeStation ?? r.station ?? base.customsOfficeStation),
    status: (r.status as FirStatus) ?? base.status,
    complainantName: String(r.complainantName ?? ""),
    accusedName: String(r.accusedName ?? ""),
    placeOfOccurrence: String(r.placeOfOccurrence ?? ""),
    sectionOfLaw: String(r.sectionOfLaw ?? ""),
    investigationOfficerName: String(r.investigationOfficerName ?? ""),
    seizureReference: String(r.seizureReference ?? r.seizureId ?? ""),
  }
}

const defaultRows: StoredFir[] = [
  { ...emptyForm(), id: "fir-1", firNumber: "FIR-2024-0841", registrationDate: "2024-02-04", customsOfficeStation: "Kohat", complainantName: "Customs Dept", accusedName: "Accused A", placeOfOccurrence: "Port Qasim", sectionOfLaw: "Customs Act S.2", investigationOfficerName: "IO Khan", seizureReference: "SZ-2024-001", status: "Registered" },
  { ...emptyForm(), id: "fir-2", firNumber: "FIR-2024-0840", registrationDate: "2024-02-03", customsOfficeStation: "Mardan", complainantName: "Customs Dept", accusedName: "Accused B", placeOfOccurrence: "Peshawar", sectionOfLaw: "Customs Act", investigationOfficerName: "IO Ahmed", status: "Under Investigation" },
]

function loadRows(): StoredFir[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(ensureFirShape)
    }
  } catch {}
  return defaultRows
}

function saveRows(rows: StoredFir[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

function generateFirNumber(): string {
  return `FIR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000 + 1000))}`
}

export default function FirRegistrationPage() {
  const [rows, setRows] = useState<StoredFir[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FirRegistrationForm>(emptyForm())
  const [search, setSearch] = useState("")

  useEffect(() => {
    setRows(loadRows())
  }, [])

  useEffect(() => {
    if (rows.length > 0) saveRows(rows)
  }, [rows])

  const openAddForm = () => {
    setForm({ ...emptyForm(), firNumber: generateFirNumber() })
    setOpen(true)
  }

  const setFormField = <K extends keyof FirRegistrationForm>(key: K, value: FirRegistrationForm[K]) => {
    setForm((p) => ({ ...p, [key]: value }))
  }

  const onSave = () => {
    if (!form.complainantName?.trim() || !form.registrationDate) return
    const firNumber = form.firNumber.trim() || generateFirNumber()
    const newRow: StoredFir = { ...form, firNumber, id: `fir-${Date.now()}` }
    setRows((prev) => [newRow, ...prev])
    setForm(emptyForm())
    setOpen(false)
  }

  const filtered = rows.filter(
    (r) =>
      !search.trim() ||
      r.firNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.customsOfficeStation.toLowerCase().includes(search.toLowerCase()) ||
      r.complainantName?.toLowerCase().includes(search.toLowerCase()) ||
      r.accusedName?.toLowerCase().includes(search.toLowerCase()) ||
      r.seizureReference?.toLowerCase().includes(search.toLowerCase())
  )
  const underInvestigation = rows.filter((r) => r.status === "Under Investigation").length
  const canSave = form.registrationDate.trim() !== "" && form.complainantName?.trim() !== ""

  return (
    <ModulePageLayout
      title="FIR Registration"
      description="Register and manage FIR (First Information Report) with all required fields: complainant, accused, occurrence, property, witnesses, and investigation."
      breadcrumbs={[{ label: "WMS" }, { label: "FIR Registration" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total FIRs</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rows.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
              <Scale className="h-4 w-4 text-[#3b82f6]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rows.length}</div>
              <p className="text-xs text-muted-foreground mt-1">New FIRs</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Under Investigation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{underInvestigation}</div>
              <p className="text-xs text-muted-foreground mt-1">Active</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>FIR Register</CardTitle>
              <CardDescription>All FIR records with complainant, accused, occurrence, witnesses, and investigation details</CardDescription>
            </div>
            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by FIR no, station, complainant..."
                  className="w-full pl-8 sm:w-64"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button className="w-full bg-[#3b82f6] text-white hover:bg-[#2563eb] sm:w-auto" onClick={openAddForm}>
                <Plus className="h-4 w-4 mr-2" /> New FIR
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 md:hidden">
              {filtered.map((row) => (
                <div key={row.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{row.firNumber}</p>
                    <Badge variant="outline">{row.status}</Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Date:</span> {row.registrationDate}</p>
                    <p><span className="text-muted-foreground">Station:</span> {row.customsOfficeStation}</p>
                    <p><span className="text-muted-foreground">Complainant:</span> {row.complainantName || "—"}</p>
                    <p><span className="text-muted-foreground">Accused:</span> {row.accusedName || (row.accusedUnknown === "Yes" ? "Unknown" : "—")}</p>
                    <p><span className="text-muted-foreground">Occurrence:</span> {row.placeOfOccurrence || "—"}</p>
                    <p><span className="text-muted-foreground">Law:</span> {row.sectionOfLaw || "—"}</p>
                    <p><span className="text-muted-foreground">Investigation Officer:</span> {row.investigationOfficerName || "—"}</p>
                    <p><span className="text-muted-foreground">Seizure Ref:</span> {row.seizureReference || "—"}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="mt-2 px-0 text-[#3b82f6]">View</Button>
                </div>
              ))}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    {FIR_TABLE_COLUMNS.map((col) => (
                      <TableHead key={col}>{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.firNumber}</TableCell>
                      <TableCell>{row.registrationDate}</TableCell>
                      <TableCell>{row.customsOfficeStation}</TableCell>
                      <TableCell>{row.complainantName || "—"}</TableCell>
                      <TableCell>{row.accusedName || (row.accusedUnknown === "Yes" ? "Unknown" : "—")}</TableCell>
                      <TableCell>{row.placeOfOccurrence || "—"}</TableCell>
                      <TableCell>{row.sectionOfLaw || "—"}</TableCell>
                      <TableCell>{row.investigationOfficerName || "—"}</TableCell>
                      <TableCell>{row.seizureReference || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-[#3b82f6]">View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) setForm(emptyForm()); setOpen(isOpen) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>New FIR – First Information Report</DialogTitle>
            <CardDescription>Complete all sections: FIR details, complainant, accused, occurrence, property, witnesses, investigation.</CardDescription>
          </DialogHeader>
          <Tabs defaultValue="fir" className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-5">
              <TabsTrigger value="fir">FIR Details</TabsTrigger>
              <TabsTrigger value="complainant">Complainant</TabsTrigger>
              <TabsTrigger value="accused">Accused</TabsTrigger>
              <TabsTrigger value="occurrence">Occurrence</TabsTrigger>
              <TabsTrigger value="witnesses">Witnesses & IO</TabsTrigger>
            </TabsList>

            <TabsContent value="fir" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>FIR Number *</Label>
                  <Input value={form.firNumber} onChange={(e) => setFormField("firNumber", e.target.value)} placeholder="Auto-generated if empty" />
                </div>
                <div className="space-y-2">
                  <Label>Registration Date *</Label>
                  <Input type="date" value={form.registrationDate} onChange={(e) => setFormField("registrationDate", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Registration Time</Label>
                  <Input type="time" value={form.registrationTime} onChange={(e) => setFormField("registrationTime", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Customs Office / Police Station *</Label>
                  <Select value={form.customsOfficeStation} onValueChange={(v) => setFormField("customsOfficeStation", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CUSTOMS_STATIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Station Code</Label>
                  <Input value={form.stationCode} onChange={(e) => setFormField("stationCode", e.target.value)} placeholder="e.g. CUS-KHI-01" />
                </div>
                <div className="space-y-2">
                  <Label>District / Region</Label>
                  <Input value={form.districtRegion} onChange={(e) => setFormField("districtRegion", e.target.value)} placeholder="e.g. Yarik South" />
                </div>
                <div className="space-y-2">
                  <Label>Seizure Reference</Label>
                  <Input value={form.seizureReference} onChange={(e) => setFormField("seizureReference", e.target.value)} placeholder="e.g. SZ-2024-001" />
                </div>
                <div className="space-y-2">
                  <Label>Case Number (if linked)</Label>
                  <Input value={form.caseNumber} onChange={(e) => setFormField("caseNumber", e.target.value)} placeholder="e.g. CF-2024-0841" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Status *</Label>
                  <Select value={form.status} onValueChange={(v) => setFormField("status", v as FirStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIR_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Remarks</Label>
                  <Textarea value={form.remarks} onChange={(e) => setFormField("remarks", e.target.value)} placeholder="Additional remarks" rows={2} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="complainant" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Complainant / Informant Name *</Label>
                  <Input value={form.complainantName} onChange={(e) => setFormField("complainantName", e.target.value)} placeholder="Full name" required />
                </div>
                <div className="space-y-2">
                  <Label>Father Name</Label>
                  <Input value={form.complainantFatherName} onChange={(e) => setFormField("complainantFatherName", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>CNIC / ID Number</Label>
                  <Input value={form.complainantCnic} onChange={(e) => setFormField("complainantCnic", e.target.value)} placeholder="e.g. 35201-1234567-1" />
                </div>
                <div className="space-y-2">
                  <Label>Contact Number</Label>
                  <Input value={form.complainantContact} onChange={(e) => setFormField("complainantContact", e.target.value)} placeholder="Phone" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.complainantEmail} onChange={(e) => setFormField("complainantEmail", e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Address</Label>
                  <Textarea value={form.complainantAddress} onChange={(e) => setFormField("complainantAddress", e.target.value)} placeholder="Full address" rows={2} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="accused" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Accused Name</Label>
                  <Input value={form.accusedName} onChange={(e) => setFormField("accusedName", e.target.value)} placeholder="Full name or Unknown" />
                </div>
                <div className="space-y-2">
                  <Label>Accused Unknown?</Label>
                  <Select value={form.accusedUnknown} onValueChange={(v) => setFormField("accusedUnknown", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Father Name</Label>
                  <Input value={form.accusedFatherName} onChange={(e) => setFormField("accusedFatherName", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>CNIC / ID Number</Label>
                  <Input value={form.accusedCnic} onChange={(e) => setFormField("accusedCnic", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Nationality</Label>
                  <Input value={form.accusedNationality} onChange={(e) => setFormField("accusedNationality", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Occupation</Label>
                  <Input value={form.accusedOccupation} onChange={(e) => setFormField("accusedOccupation", e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Address</Label>
                  <Textarea value={form.accusedAddress} onChange={(e) => setFormField("accusedAddress", e.target.value)} placeholder="Address of accused" rows={2} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="occurrence" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date of Occurrence *</Label>
                  <Input type="date" value={form.dateOfOccurrence} onChange={(e) => setFormField("dateOfOccurrence", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Time of Occurrence</Label>
                  <Input type="time" value={form.timeOfOccurrence} onChange={(e) => setFormField("timeOfOccurrence", e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Place of Occurrence *</Label>
                  <Input value={form.placeOfOccurrence} onChange={(e) => setFormField("placeOfOccurrence", e.target.value)} placeholder="e.g. Port Qasim, Warehouse X" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Place Details</Label>
                  <Textarea value={form.placeDetails} onChange={(e) => setFormField("placeDetails", e.target.value)} placeholder="Detailed location description" rows={2} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Description of Offence / Narration *</Label>
                  <Textarea value={form.descriptionOfOffence} onChange={(e) => setFormField("descriptionOfOffence", e.target.value)} placeholder="Facts of the case" rows={4} required />
                </div>
                <div className="space-y-2">
                  <Label>Section of Law *</Label>
                  <Input value={form.sectionOfLaw} onChange={(e) => setFormField("sectionOfLaw", e.target.value)} placeholder="e.g. Customs Act S.2(1)" />
                </div>
                <div className="space-y-2">
                  <Label>Section Details</Label>
                  <Input value={form.sectionDetails} onChange={(e) => setFormField("sectionDetails", e.target.value)} placeholder="Sub-section or clause" />
                </div>
                <div className="space-y-2">
                  <Label>Property Involved?</Label>
                  <Select value={form.propertyInvolved} onValueChange={(v) => setFormField("propertyInvolved", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Property Value</Label>
                  <Input value={form.propertyValue} onChange={(e) => setFormField("propertyValue", e.target.value)} placeholder="Amount" />
                </div>
                <div className="space-y-2">
                  <Label>Estimated Value</Label>
                  <Select value={form.currency} onValueChange={(v) => setFormField("currency", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PKR">PKR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Property Description</Label>
                  <Textarea value={form.propertyDescription} onChange={(e) => setFormField("propertyDescription", e.target.value)} placeholder="Description of seized/affected property" rows={2} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="witnesses" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Witness 1 Name</Label>
                  <Input value={form.witness1Name} onChange={(e) => setFormField("witness1Name", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Witness 1 Contact</Label>
                  <Input value={form.witness1Contact} onChange={(e) => setFormField("witness1Contact", e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Witness 1 Address</Label>
                  <Input value={form.witness1Address} onChange={(e) => setFormField("witness1Address", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Witness 2 Name</Label>
                  <Input value={form.witness2Name} onChange={(e) => setFormField("witness2Name", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Witness 2 Contact</Label>
                  <Input value={form.witness2Contact} onChange={(e) => setFormField("witness2Contact", e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Witness 2 Address</Label>
                  <Input value={form.witness2Address} onChange={(e) => setFormField("witness2Address", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Investigation Officer Name *</Label>
                  <Input value={form.investigationOfficerName} onChange={(e) => setFormField("investigationOfficerName", e.target.value)} placeholder="IO name" />
                </div>
                <div className="space-y-2">
                  <Label>IO Badge / ID Number</Label>
                  <Input value={form.investigationOfficerBadgeId} onChange={(e) => setFormField("investigationOfficerBadgeId", e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>IO Contact</Label>
                  <Input value={form.investigationOfficerContact} onChange={(e) => setFormField("investigationOfficerContact", e.target.value)} />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex flex-col-reverse justify-end gap-2 border-t pt-4 sm:flex-row">
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={onSave} disabled={!canSave} className="w-full sm:w-auto">Save FIR</Button>
          </div>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}
