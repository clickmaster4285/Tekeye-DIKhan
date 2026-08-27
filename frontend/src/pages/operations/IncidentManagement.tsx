"use client"

import { useState } from "react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ChevronDown,
  FilePlus,
  Search,
  FolderOpen,
  ShieldCheck,
  MessageSquare,
  Paperclip,
  FileText,
} from "lucide-react"

const INCIDENT_TYPES = ["Security", "Breach/Theft", "Assault", "Fire", "Medical", "Custom"]
const PRIORITIES = ["Critical", "High", "Med", "Low"]
const SEVERITIES = ["Major", "Moderate", "Minor"]
const INCIDENT_STATUSES = ["New", "In Progress", "Under Review", "Resolved", "Closed"]
const ROOT_CAUSES = ["Human error", "System failure", "External", "Policy gap", "Other"]
const EVIDENCE_TYPES = ["Video", "Snapshot", "Document", "Audio", "Other"]
const CASE_STATUSES = ["Open", "In Progress", "Resolved", "Closed"]
const EXPORT_FORMATS = ["PDF Package", "ZIP Archive"]
const MOCK_LOCATIONS = ["Building A", "Gate 1", "Parking Lot", "Warehouse B", "Lobby"]
const MOCK_USERS = ["John Smith", "Jane Doe", "Security Lead", "Operations"]
const REPORT_TEMPLATES = ["Standard Incident", "Security Breach", "Custom"]

export default function IncidentManagementPage() {
  const [includeCustody, setIncludeCustody] = useState(true)
  const [encryptExport, setEncryptExport] = useState(false)
  const [aiDetectionData, setAiDetectionData] = useState(false)

  return (
    <ModulePageLayout
      title="Incident Management"
      description="Creation, investigation, evidence management, and case closure. * Required = Yes."
      breadcrumbs={[{ label: "AI Analytics" }, { label: "Incident Management" }]}
    >
      <ScrollArea className="h-[calc(100vh-10rem)]">
        <div className="space-y-6 pb-6">
          {/* 1. Incident Creation */}
          <Card>
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <FilePlus className="h-4 w-4" /> Create Incident
                </CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Incident title *</Label>
                      <Input placeholder="Short descriptive title" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">Incident type *</Label>
                      <Select><SelectTrigger className="mt-1"><SelectValue placeholder="Classify type" /></SelectTrigger><SelectContent>{INCIDENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div>
                      <Label className="text-sm">Priority *</Label>
                      <Select><SelectTrigger className="mt-1"><SelectValue placeholder="Priority level" /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div>
                      <Label className="text-sm">Severity *</Label>
                      <Select><SelectTrigger className="mt-1"><SelectValue placeholder="Impact severity" /></SelectTrigger><SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div>
                      <Label className="text-sm">Incident date/time *</Label>
                      <Input type="datetime-local" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">Location *</Label>
                      <Select><SelectTrigger className="mt-1"><SelectValue placeholder="Where it happened" /></SelectTrigger><SelectContent>{MOCK_LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm">Description * (rich text)</Label>
                      <Textarea placeholder="Detailed description" className="mt-1 min-h-[100px]" />
                    </div>
                    <div>
                      <Label className="text-sm">Affected persons (multi-select people IDs)</Label>
                      <Select><SelectTrigger className="mt-1"><SelectValue placeholder="Persons involved" /></SelectTrigger><SelectContent>{MOCK_USERS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div>
                      <Label className="text-sm">Affected assets</Label>
                      <Input placeholder="Assets or property affected" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">Reported by *</Label>
                      <Select><SelectTrigger className="mt-1"><SelectValue placeholder="Who reported" /></SelectTrigger><SelectContent>{MOCK_USERS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div>
                      <Label className="text-sm">Assign to</Label>
                      <Select><SelectTrigger className="mt-1"><SelectValue placeholder="Investigator" /></SelectTrigger><SelectContent>{MOCK_USERS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div>
                      <Label className="text-sm">Due date</Label>
                      <Input type="date" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">Linked alerts (multi-select alert IDs)</Label>
                      <Input placeholder="Related alerts" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">Tags</Label>
                      <Input placeholder="Searchable classification tags" className="mt-1" />
                    </div>
                  </div>
                  <Button>Create Incident</Button>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* 2. Investigations */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4" /> Investigations
                </CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-6">
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Investigation view</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Incident status *</Label>
                        <Select><SelectTrigger className="mt-1"><SelectValue placeholder="Current status" /></SelectTrigger><SelectContent>{INCIDENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-sm">Investigation notes (rich text)</Label>
                        <Textarea placeholder="Detailed investigator notes" className="mt-1 min-h-[80px]" />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-sm">Timeline of events (chronological list)</Label>
                        <Textarea placeholder="Ordered sequence of events — one per line" className="mt-1 min-h-[80px]" />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-sm">Findings (rich text)</Label>
                        <Textarea placeholder="Investigation conclusions" className="mt-1 min-h-[80px]" />
                      </div>
                      <div>
                        <Label className="text-sm">Root cause</Label>
                        <Select><SelectTrigger className="mt-1"><SelectValue placeholder="Why it occurred" /></SelectTrigger><SelectContent>{ROOT_CAUSES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
                      </div>
                      <div>
                        <Input placeholder="Or enter custom root cause" className="mt-1" />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-sm">Actions taken</Label>
                        <Textarea placeholder="Steps taken in response" className="mt-1 min-h-[60px]" />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-sm">Recommendations</Label>
                        <Textarea placeholder="Preventive recommendations" className="mt-1 min-h-[60px]" />
                      </div>
                    </div>
                  </div>
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Collaboration</h4>
                    <div>
                      <Label className="text-sm">Add comment</Label>
                      <Textarea placeholder="Team collaboration notes (use @username to mention)" className="mt-1 min-h-[60px]" />
                      <Button size="sm" className="mt-2">Submit</Button>
                    </div>
                    <div>
                      <Label className="text-sm">Share with users</Label>
                      <Select><SelectTrigger className="mt-1"><SelectValue placeholder="Give view access" /></SelectTrigger><SelectContent>{MOCK_USERS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* 3. Evidence Management */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip className="h-4 w-4" /> Evidence Management
                </CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-6">
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Evidence collection</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Evidence name *</Label>
                        <Input placeholder="Name/label for evidence item" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-sm">Evidence type *</Label>
                        <Select><SelectTrigger className="mt-1"><SelectValue placeholder="Classify type" /></SelectTrigger><SelectContent>{EVIDENCE_TYPES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select>
                      </div>
                      <div>
                        <Label className="text-sm">Upload file</Label>
                        <Input type="file" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-sm">Link video clip (playback search tool)</Label>
                        <div className="mt-1 h-10 rounded border border-dashed border-border bg-muted/20 flex items-center justify-center text-xs text-muted-foreground">Playback search — link recorded video</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch id="ai-detection" checked={aiDetectionData} onCheckedChange={setAiDetectionData} />
                        <Label htmlFor="ai-detection" className="text-sm cursor-pointer">Include AI detection data</Label>
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-sm">Evidence notes</Label>
                        <Textarea placeholder="Context about this evidence" className="mt-1 min-h-[60px]" />
                      </div>
                    </div>
                  </div>
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Chain of custody</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Custodian name *</Label>
                        <Input placeholder="Person responsible for evidence" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-sm">Transfer timestamp (auto)</Label>
                        <div className="mt-1 px-3 py-2 rounded border border-border bg-muted/30 text-sm">{new Date().toLocaleString()}</div>
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-sm">Reason for transfer</Label>
                        <Input placeholder="Why custody changed" className="mt-1" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="custody-sign" />
                        <Label htmlFor="custody-sign" className="text-sm cursor-pointer">Digital signature *</Label>
                        <Button size="sm" variant="outline">Sign</Button>
                      </div>
                    </div>
                  </div>
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Evidence export</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Export format *</Label>
                        <RadioGroup defaultValue="pdf" className="flex gap-4 mt-1">
                          {EXPORT_FORMATS.map((f) => (
                            <label key={f} className="flex items-center gap-2 text-sm">
                              <RadioGroupItem value={f.toLowerCase().replace(" ", "-")} />
                              {f}
                            </label>
                          ))}
                        </RadioGroup>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch id="custody-doc" checked={includeCustody} onCheckedChange={setIncludeCustody} />
                        <Label htmlFor="custody-doc" className="text-sm cursor-pointer">Include chain of custody doc *</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch id="encrypt" checked={encryptExport} onCheckedChange={setEncryptExport} />
                        <Label htmlFor="encrypt" className="text-sm cursor-pointer">Encrypt export</Label>
                      </div>
                      {encryptExport && (
                        <div>
                          <Label className="text-sm">Password</Label>
                          <Input type="password" placeholder="Password protect package" className="mt-1" />
                        </div>
                      )}
                    </div>
                    <Button variant="outline">Export evidence</Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* 4. Case Management */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Case Management
                </CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-6">
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Case status</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Case number (auto)</Label>
                        <div className="mt-1 px-3 py-2 rounded border border-border bg-muted/30 text-sm font-mono">INC-2026-00142</div>
                      </div>
                      <div>
                        <Label className="text-sm">Case status (auto)</Label>
                        <Select><SelectTrigger className="mt-1"><SelectValue placeholder="Current status" /></SelectTrigger><SelectContent>{CASE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                      </div>
                    </div>
                  </div>
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Case closure</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Label className="text-sm">Resolution summary *</Label>
                        <Textarea placeholder="Brief resolution description" className="mt-1 min-h-[80px]" />
                      </div>
                      <div>
                        <Label className="text-sm">Closure date *</Label>
                        <Input type="date" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-sm">Closure approved by *</Label>
                        <Select><SelectTrigger className="mt-1"><SelectValue placeholder="Supervisor who approved" /></SelectTrigger><SelectContent>{MOCK_USERS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>
                      </div>
                    </div>
                    <Button>Close case</Button>
                  </div>
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Case reports</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Report template</Label>
                        <Select><SelectTrigger className="mt-1"><SelectValue placeholder="Report format" /></SelectTrigger><SelectContent>{REPORT_TEMPLATES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
                      </div>
                      <div className="flex items-end">
                        <Button variant="outline"><FileText className="h-4 w-4 mr-2" /> Generate report (PDF)</Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>
      </ScrollArea>
    </ModulePageLayout>
  )
}
