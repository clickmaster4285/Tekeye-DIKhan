"use client"

import { useState, useEffect } from "react"
import { Plus, ListOrdered } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
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
  SEIZURE_REGISTRATION_FLOW,
  SEIZURE_TABLE_COLUMNS,
  type SeizureRegistrationForm,
} from "@/lib/warehouse-module-spec"

const STORAGE_KEY = "seizureEntries"

const emptyForm: SeizureRegistrationForm = {
  seizureReferenceNumber: "",
  caseNumber: "",
  incidentNumber: "",
  seizureDate: "",
  seizureTime: "",
  seizureLocation: "",
  gpsCoordinates: "",
  locationType: "",
  jurisdiction: "",
  customsOfficeCode: "",
  seizureAuthorityType: "",
  legalBasisForSeizure: "",
  courtOrderNumber: "",
  primaryAgency: "",
  leadOfficerName: "",
  leadOfficerBadgeId: "",
  subjectType: "",
  subjectName: "",
  subjectIdPassport: "",
  subjectAddress: "",
  subjectContact: "",
  seizureType: "",
  seizureCategory: "",
  discoveryMethod: "",
  totalNumberOfItems: "",
  totalGrossWeight: "",
  totalEstimatedValue: "",
  currency: "",
  temporaryStorageLocation: "",
  custodianName: "",
  description: "",
  status: "Registered",
}

function getDefaultForm(): SeizureRegistrationForm {
  return { ...emptyForm }
}

type StoredSeizure = SeizureRegistrationForm & { id: string }

export default function NewSeizureEntryPage() {
  const [entries, setEntries] = useState<StoredSeizure[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showFlow, setShowFlow] = useState(false)
  const [formData, setFormData] = useState<SeizureRegistrationForm>(getDefaultForm())

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setEntries(parsed)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (entries.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }, [entries])

  const handleChange = (key: keyof SeizureRegistrationForm, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const ref = formData.seizureReferenceNumber.trim() ||
      `SZ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000 + 1000))}`
    const withRef = { ...formData, seizureReferenceNumber: ref }
    const newEntry: StoredSeizure = { ...withRef, id: `sz-${Date.now()}` }
    setEntries((prev) => [newEntry, ...prev])
    setFormData(getDefaultForm())
    setShowModal(false)
  }

  const requiredForSubmit = formData.seizureLocation.trim() && formData.seizureDate

  return (
    <ModulePageLayout
      title="New Seizure Entry"
      description="Record new seizure cases per Seizure Registration & Intake flow. Authority verification, legal document check, evidence tagging, chain of custody."
      breadcrumbs={[{ label: "WMS" }, { label: "New Seizure Entry" }]}
    >
      <div className="grid gap-6">
        {/* Flow guide (spec) */}
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <ListOrdered className="h-5 w-5" />
                Standard Seizure Registration Flow
              </CardTitle>
              <CardDescription className="break-words">Follow this flow: Seizure Event → Authority Verification → Documentation → Chain of Custody → System Registration</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setShowFlow(!showFlow)}>
              {showFlow ? "Hide" : "Show"} steps
            </Button>
          </CardHeader>
          {showFlow && (
            <CardContent className="pt-0">
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                {SEIZURE_REGISTRATION_FLOW.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </CardContent>
          )}
        </Card>

        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Create Seizure Entry</CardTitle>
              <CardDescription className="break-words">Enter seizure details per spec. Attach supporting documents where applicable.</CardDescription>
            </div>
            <Button className="w-full bg-[#3b82f6] text-white hover:bg-[#2563eb] sm:w-auto" onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4 mr-2" /> New Entry
            </Button>
          </CardHeader>
        </Card>

        <Card className="w-full min-w-0">
          <CardHeader>
            <CardTitle>Recent Seizure Entries</CardTitle>
            <CardDescription>Latest seizure records (spec-aligned columns)</CardDescription>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="divide-y rounded-lg border md:hidden">
              {entries.map((row) => (
                <div key={row.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{row.seizureReferenceNumber || row.id}</p>
                    <Badge variant="outline">{row.status}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <p className="truncate text-muted-foreground">Case: <span className="text-foreground">{row.caseNumber || "—"}</span></p>
                    <p className="truncate text-muted-foreground">Date/Time: <span className="text-foreground">{row.seizureDate || "—"} {row.seizureTime || ""}</span></p>
                    <p className="col-span-2 truncate text-muted-foreground">Location: <span className="text-foreground">{row.seizureLocation || "—"}</span></p>
                    <p className="truncate text-muted-foreground">Subject: <span className="text-foreground">{row.subjectName || "—"}</span></p>
                    <p className="truncate text-muted-foreground">Type: <span className="text-foreground">{row.seizureType || "—"}</span></p>
                    <p className="truncate text-muted-foreground">Items: <span className="text-foreground">{row.totalNumberOfItems || "—"}</span></p>
                    <p className="truncate text-muted-foreground">Value: <span className="text-foreground">{row.totalEstimatedValue || "—"} {row.currency || ""}</span></p>
                  </div>
                  <Button variant="ghost" size="sm" className="mt-1 h-7 px-0 text-[#3b82f6]">View</Button>
                </div>
              ))}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                <Table className="min-w-[1400px]">
                  <TableHeader>
                    <TableRow>
                      {SEIZURE_TABLE_COLUMNS.map((col) => (
                        <TableHead key={col}>{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.seizureReferenceNumber || row.id}</TableCell>
                        <TableCell>{row.caseNumber}</TableCell>
                        <TableCell>{row.seizureDate}</TableCell>
                        <TableCell>{row.seizureTime}</TableCell>
                        <TableCell>{row.seizureLocation}</TableCell>
                        <TableCell>{row.locationType}</TableCell>
                        <TableCell>{row.primaryAgency}</TableCell>
                        <TableCell>{row.subjectName}</TableCell>
                        <TableCell>{row.seizureType}</TableCell>
                        <TableCell>{row.totalNumberOfItems}</TableCell>
                        <TableCell>{row.totalEstimatedValue} {row.currency}</TableCell>
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
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Seizure Entry</DialogTitle>
            <CardDescription>Seizure Registration & Intake – authority verification, legal document check, evidence tagging.</CardDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Seizure Reference Number</Label>
                <Input
                  placeholder="Auto if empty"
                  value={formData.seizureReferenceNumber}
                  onChange={(e) => handleChange("seizureReferenceNumber", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Case Number</Label>
                <Input
                  value={formData.caseNumber}
                  onChange={(e) => handleChange("caseNumber", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Seizure Date *</Label>
                <Input
                  type="date"
                  value={formData.seizureDate}
                  onChange={(e) => handleChange("seizureDate", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Seizure Time</Label>
                <Input
                  type="time"
                  value={formData.seizureTime}
                  onChange={(e) => handleChange("seizureTime", e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Seizure Location / Address *</Label>
                <Input
                  placeholder="Location/Address"
                  value={formData.seizureLocation}
                  onChange={(e) => handleChange("seizureLocation", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>GPS Coordinates</Label>
                <Input
                  value={formData.gpsCoordinates}
                  onChange={(e) => handleChange("gpsCoordinates", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Location Type</Label>
                <Select value={formData.locationType} onValueChange={(v) => handleChange("locationType", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {["Port", "Airport", "Land Border", "Warehouse", "Premises", "Vehicle", "Other"].map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Primary Agency</Label>
                <Input
                  value={formData.primaryAgency}
                  onChange={(e) => handleChange("primaryAgency", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Lead Officer Name</Label>
                <Input
                  value={formData.leadOfficerName}
                  onChange={(e) => handleChange("leadOfficerName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Lead Officer Badge/ID</Label>
                <Input
                  value={formData.leadOfficerBadgeId}
                  onChange={(e) => handleChange("leadOfficerBadgeId", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Subject Type</Label>
                <Select value={formData.subjectType} onValueChange={(v) => handleChange("subjectType", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Individual">Individual</SelectItem>
                    <SelectItem value="Company">Company</SelectItem>
                    <SelectItem value="Unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject Name / Company</Label>
                <Input
                  value={formData.subjectName}
                  onChange={(e) => handleChange("subjectName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Subject ID/Passport</Label>
                <Input
                  value={formData.subjectIdPassport}
                  onChange={(e) => handleChange("subjectIdPassport", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Seizure Type</Label>
                <Select value={formData.seizureType} onValueChange={(v) => handleChange("seizureType", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {["Contraband", "Prohibited Goods", "Smuggled Goods", "Undeclared Goods", "Counterfeit", "Tax Evasion", "Other"].map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Seizure Category</Label>
                <Select value={formData.seizureCategory} onValueChange={(v) => handleChange("seizureCategory", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Import">Import</SelectItem>
                    <SelectItem value="Export">Export</SelectItem>
                    <SelectItem value="Transit">Transit</SelectItem>
                    <SelectItem value="Domestic">Domestic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discovery Method</Label>
                <Select value={formData.discoveryMethod} onValueChange={(v) => handleChange("discoveryMethod", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {["X-ray", "Physical Examination", "K9 Unit", "Intelligence", "Random Check", "Tip-off", "Surveillance"].map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Total Number of Items</Label>
                <Input
                  type="number"
                  value={formData.totalNumberOfItems}
                  onChange={(e) => handleChange("totalNumberOfItems", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Total Gross Weight (kg)</Label>
                <Input
                  value={formData.totalGrossWeight}
                  onChange={(e) => handleChange("totalGrossWeight", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Total Estimated Value</Label>
                <Input
                  value={formData.totalEstimatedValue}
                  onChange={(e) => handleChange("totalEstimatedValue", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Estimated Value</Label>
                <Input
                  placeholder="e.g. USD, PKR"
                  value={formData.currency}
                  onChange={(e) => handleChange("currency", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Temporary Storage Location</Label>
                <Input
                  value={formData.temporaryStorageLocation}
                  onChange={(e) => handleChange("temporaryStorageLocation", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Custodian Name</Label>
                <Input
                  value={formData.custodianName}
                  onChange={(e) => handleChange("custodianName", e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description / Remarks</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => handleChange("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Registered">Registered</SelectItem>
                    <SelectItem value="Under Investigation">Under Investigation</SelectItem>
                    <SelectItem value="Pending Court">Pending Court</SelectItem>
                    <SelectItem value="Concluded">Concluded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col-reverse justify-end gap-2 pt-4 sm:flex-row">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto" disabled={!requiredForSubmit}>
                Save Entry
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}
