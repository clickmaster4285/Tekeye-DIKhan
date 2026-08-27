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
  LayoutDashboard,
  Bell,
  ListChecks,
  Mail,
  ArrowUpCircle,
  Clock,
} from "lucide-react"
import { CameraSelectItems } from "@/components/cameras/camera-select-items"
import { useCameras } from "@/hooks/use-cameras"

const SEVERITIES = ["Critical", "High", "Medium", "Low"]
const ALERT_TYPES = ["Thermal", "Zone", "System", "Intrusion", "Fire", "LPR", "Face"]
const ALERT_STATUSES = ["New", "Assigned", "Acknowledged", "Escalated"]
const SORT_OPTIONS = ["Time", "Severity", "Type", "Camera"]
const RESOLUTION_STATUSES = ["New", "Acknowledged", "In Progress", "Resolved"]
const ROOT_CAUSES = ["Human error", "System failure", "False detection", "Other"]
const FALSE_POSITIVE_REASONS = ["Lighting", "Shadow", "Object misclassification", "Other"]
const ESCALATION_CONDITIONS = ["Not Acknowledged", "Not Assigned", "Not Resolved"]
const MOCK_ZONES = ["Zone 1", "Zone 2", "Intrusion-A", "Counting-1"]
const MOCK_LOCATIONS = ["Building A", "Gate 1", "Parking Lot", "Warehouse B"]
const MOCK_USERS = ["John Smith", "Jane Doe", "Security Lead", "Operations"]
const MOCK_GROUPS = ["Security Team", "Operations", "Management"]
const ACTIONS_ON_TRIGGER = ["Email", "SMS", "Push", "Webhook"]

export default function AlertsNotificationsPage() {
  const { cameras, loading: camerasLoading } = useCameras({ activeOnly: true })
  const [includeSnapshot, setIncludeSnapshot] = useState(true)
  const [includeVideoLink, setIncludeVideoLink] = useState(false)
  const [enableSiren, setEnableSiren] = useState(false)
  const [enableStrobe, setEnableStrobe] = useState(false)
  const [markFalsePositive, setMarkFalsePositive] = useState(false)
  const [cooldown, setCooldown] = useState(60)

  return (
    <ModulePageLayout
      title="Alerts & Notifications — Rules, management, multi-channel delivery, escalation"
      description="* Required = Yes. Filter and manage alerts; configure rules, channels, escalation, SLA."
      breadcrumbs={[{ label: "AI Analytics" }, { label: "Alerts & Notifications" }]}
    >
      <ScrollArea className="h-[calc(100vh-10rem)]">
        <div className="space-y-6 pb-6">
          {/* 1. Alert Dashboard — Active Alerts */}
          <Card>
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" /> Alert Dashboard
                </CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <h4 className="font-medium text-sm">Active alerts — filters</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Alert severity filter - multi‑select via dropdown (simulated) */}
                    <div>
                      <Label className="text-sm">Alert severity filter</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select severities" />
                        </SelectTrigger>
                        <SelectContent>
                          {SEVERITIES.map((s) => (
                            <SelectItem key={s} value={s}>
                              <div className="flex items-center gap-2">
                                <Checkbox className="pointer-events-none" /> {s}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Alert type filter - multi‑select via dropdown */}
                    <div>
                      <Label className="text-sm">Alert type filter</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select types" />
                        </SelectTrigger>
                        <SelectContent>
                          {ALERT_TYPES.slice(0, 4).map((t) => (
                            <SelectItem key={t} value={t}>
                              <div className="flex items-center gap-2">
                                <Checkbox className="pointer-events-none" /> {t}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Camera filter - multi‑select dropdown */}
                    <div>
                      <Label className="text-sm">Camera filter</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Multi-select cameras" />
                        </SelectTrigger>
                        <SelectContent>
                          <CameraSelectItems cameras={cameras} loading={camerasLoading} />
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Location filter - single‑select dropdown */}
                    <div>
                      <Label className="text-sm">Location filter</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Filter by location" />
                        </SelectTrigger>
                        <SelectContent>
                          {MOCK_LOCATIONS.map((l) => (
                            <SelectItem key={l} value={l}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Status filter - multi‑select via dropdown */}
                    <div>
                      <Label className="text-sm">Status filter</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          {ALERT_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              <div className="flex items-center gap-2">
                                <Checkbox className="pointer-events-none" /> {s}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Sort by - single‑select dropdown */}
                    <div>
                      <Label className="text-sm">Sort by</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Order alerts" />
                        </SelectTrigger>
                        <SelectContent>
                          {SORT_OPTIONS.map((o) => (
                            <SelectItem key={o} value={o}>{o}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="rounded border border-border bg-muted/20 p-4">
                    <div className="text-sm font-medium mb-2">Active alerts list</div>
                    <div className="text-xs text-muted-foreground">Filtered alerts appear here.</div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* 2. Alert Management */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4" /> Alert Management
                </CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Alert ID (read-only)</Label>
                      <div className="mt-1 px-3 py-2 rounded border border-border bg-muted/30 text-sm font-mono">ALT-2026-00892</div>
                    </div>
                    <div>
                      <Label className="text-sm">Alert type (read-only)</Label>
                      <div className="mt-1 px-3 py-2 rounded border border-border bg-muted/30 text-sm">Intrusion</div>
                    </div>
                    <div>
                      <Label className="text-sm">Alert subtype (read-only)</Label>
                      <div className="mt-1 px-3 py-2 rounded border border-border bg-muted/30 text-sm">Zone breach</div>
                    </div>
                    <div>
                      <Label className="text-sm">Severity *</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                        <SelectContent>
                          {SEVERITIES.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Status (auto)</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {RESOLUTION_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Camera name (read-only)</Label>
                      <div className="mt-1 px-3 py-2 rounded border border-border bg-muted/30 text-sm">Gate-01</div>
                    </div>
                    <div>
                      <Label className="text-sm">Location (read-only)</Label>
                      <div className="mt-1 px-3 py-2 rounded border border-border bg-muted/30 text-sm">Gate 1</div>
                    </div>
                    <div>
                      <Label className="text-sm">Detection time (auto)</Label>
                      <div className="mt-1 px-3 py-2 rounded border border-border bg-muted/30 text-sm">{new Date().toLocaleString()}</div>
                    </div>
                    <div>
                      <Label className="text-sm">Confidence score (auto)</Label>
                      <div className="mt-1 px-3 py-2 rounded border border-border bg-muted/30 text-sm">94%</div>
                    </div>
                    <div>
                      <Label className="text-sm">SLA status</Label>
                      <div className="mt-1 px-3 py-2 rounded border border-border bg-muted/30 text-sm">On Time</div>
                    </div>
                    <div>
                      <Label className="text-sm">Assigned to</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Assign responsibility" />
                        </SelectTrigger>
                        <SelectContent>
                          {MOCK_USERS.map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Link to incident</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Existing incidents" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inc1">INC-2026-00142</SelectItem>
                          <SelectItem value="inc2">INC-2026-00141</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Tags</Label>
                      <Input placeholder="Tag input for classification" className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Thumbnail image (auto)</Label>
                      <div className="mt-1 h-24 rounded border border-dashed border-border bg-muted/20 flex items-center justify-center text-xs text-muted-foreground">Snapshot at detection</div>
                    </div>
                    <div>
                      <Label className="text-sm">Video clip preview (auto)</Label>
                      <div className="mt-1 h-24 rounded border border-dashed border-border bg-muted/20 flex items-center justify-center text-xs text-muted-foreground">Short clip player</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label className="text-sm">Acknowledgment notes</Label>
                      <Textarea placeholder="Notes when acknowledging" className="mt-1 min-h-[60px]" />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm">Investigation notes</Label>
                      <Textarea placeholder="Ongoing investigation details" className="mt-1 min-h-[60px]" />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm">Resolution notes</Label>
                      <Textarea placeholder="How incident was resolved" className="mt-1 min-h-[60px]" />
                    </div>
                    <div>
                      <Label className="text-sm">Root cause</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Why event occurred" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROOT_CAUSES.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Input placeholder="Custom root cause" className="mt-1" />
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2">
                      <Switch id="false-pos" checked={markFalsePositive} onCheckedChange={setMarkFalsePositive} />
                      <Label htmlFor="false-pos" className="text-sm cursor-pointer">Mark as false positive</Label>
                    </div>
                    {markFalsePositive && (
                      <>
                        <div>
                          <Label className="text-sm">False positive reason</Label>
                          <Select>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select reason" />
                            </SelectTrigger>
                            <SelectContent>
                              {FALSE_POSITIVE_REASONS.map((r) => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Input placeholder="Custom reason" className="mt-1" />
                        </div>
                      </>
                    )}
                  </div>
                  <Button>Acknowledge</Button>
                  <Button variant="outline" className="ml-2">Resolve</Button>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* 3. Alert Rules */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListChecks className="h-4 w-4" /> Alert Rules
                </CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Rule name *</Label>
                      <Input placeholder="Unique rule name" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">Alert type trigger *</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Event type that triggers" />
                        </SelectTrigger>
                        <SelectContent>
                          {ALERT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm">Rule description</Label>
                      <Textarea placeholder="What the rule does" className="mt-1 min-h-[60px]" />
                    </div>
                    <div>
                      <Label className="text-sm">Cameras in scope *</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Multi-select cameras" />
                        </SelectTrigger>
                        <SelectContent>
                          <CameraSelectItems cameras={cameras} loading={camerasLoading} />
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Zones in scope</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Detection zones" />
                        </SelectTrigger>
                        <SelectContent>
                          {MOCK_ZONES.map((z) => (
                            <SelectItem key={z} value={z}>{z}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Severity assignment *</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Default severity" />
                        </SelectTrigger>
                        <SelectContent>
                          {SEVERITIES.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Time schedule (days/hours active)</Label>
                      <div className="mt-1 h-10 rounded border border-dashed border-border bg-muted/20 flex items-center justify-center text-xs text-muted-foreground">Schedule picker</div>
                    </div>
                    <div>
                      <Label className="text-sm">Cooldown period (sec, default 60)</Label>
                      <Input type="number" value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} className="mt-1 w-24" />
                    </div>
                    <div>
                      <Label className="text-sm">Actions on trigger *</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select actions" />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTIONS_ON_TRIGGER.map((a) => (
                            <SelectItem key={a} value={a}>
                              <div className="flex items-center gap-2">
                                <Checkbox className="pointer-events-none" /> {a}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Auto-assign to</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="User" />
                        </SelectTrigger>
                        <SelectContent>
                          {MOCK_USERS.map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Auto-escalate after (min)</Label>
                      <Input type="number" placeholder="Minutes" className="mt-1 w-28" />
                    </div>
                    <div>
                      <Label className="text-sm">Rule priority (1–100)</Label>
                      <Input type="number" min={1} max={100} placeholder="Evaluation order" className="mt-1 w-24" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="rule-status" defaultChecked />
                      <Label htmlFor="rule-status" className="text-sm cursor-pointer">Rule status (Active/Inactive) *</Label>
                    </div>
                  </div>
                  <Button>Save rule</Button>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* 4. Notification Channels */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Notification Channels
                </CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-6">
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Email</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Label className="text-sm">SMTP recipients</Label>
                        <Input placeholder="Email addresses" className="mt-1" />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-sm">Subject template (e.g. {"{alert_type}"}, {"{camera}"})</Label>
                        <Input placeholder="Subject template with variables" className="mt-1" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch id="snap" checked={includeSnapshot} onCheckedChange={setIncludeSnapshot} />
                        <Label htmlFor="snap" className="text-sm cursor-pointer">Include snapshot</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch id="vidlink" checked={includeVideoLink} onCheckedChange={setIncludeVideoLink} />
                        <Label htmlFor="vidlink" className="text-sm cursor-pointer">Include video link</Label>
                      </div>
                    </div>
                  </div>
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">SMS</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">SMS recipients</Label>
                        <Input placeholder="Phone numbers" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-sm">Message template (max 160 chars)</Label>
                        <Input placeholder="SMS message" className="mt-1" maxLength={160} />
                      </div>
                      <div>
                        <Label className="text-sm">Target user groups</Label>
                        <Select>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select groups" />
                          </SelectTrigger>
                          <SelectContent>
                            {MOCK_GROUPS.map((g) => (
                              <SelectItem key={g} value={g}>
                                <div className="flex items-center gap-2">
                                  <Checkbox className="pointer-events-none" /> {g}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Webhook</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Label className="text-sm">Webhook URL</Label>
                        <Input placeholder="Endpoint for POST alert data" className="mt-1 font-mono" />
                      </div>
                      <div>
                        <Label className="text-sm">Authentication header (Bearer/API key)</Label>
                        <Input type="password" placeholder="Header value" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-sm">Payload format</Label>
                        <RadioGroup defaultValue="json" className="flex gap-4 mt-1">
                          <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="json" /> JSON</label>
                          <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="xml" /> XML</label>
                        </RadioGroup>
                      </div>
                    </div>
                  </div>
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Physical alarms</h4>
                    <p className="text-xs text-muted-foreground">Requires integration</p>
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2">
                        <Switch id="siren" checked={enableSiren} onCheckedChange={setEnableSiren} />
                        <Label htmlFor="siren" className="text-sm cursor-pointer">Enable siren</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch id="strobe" checked={enableStrobe} onCheckedChange={setEnableStrobe} />
                        <Label htmlFor="strobe" className="text-sm cursor-pointer">Enable strobe light</Label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* 5. Escalation */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowUpCircle className="h-4 w-4" /> Escalation
                </CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-6">
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Escalation rules</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Rule name</Label>
                        <Input placeholder="Escalation rule name" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-sm">Escalate after (minutes)</Label>
                        <Input type="number" placeholder="Minutes" className="mt-1 w-28" />
                      </div>
                      <div>
                        <Label className="text-sm">Escalation condition</Label>
                        <Select>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="When to escalate" />
                          </SelectTrigger>
                          <SelectContent>
                            {ESCALATION_CONDITIONS.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Escalation paths</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-sm">Level 1</Label>
                        <Select>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="User or group" />
                          </SelectTrigger>
                          <SelectContent>
                            {MOCK_USERS.map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                            {MOCK_GROUPS.map((g) => (
                              <SelectItem key={g} value={g}>{g}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm">Level 2</Label>
                        <Select>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="User or group" />
                          </SelectTrigger>
                          <SelectContent>
                            {MOCK_USERS.map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                            {MOCK_GROUPS.map((g) => (
                              <SelectItem key={g} value={g}>{g}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm">Level 3 (final — senior command)</Label>
                        <Select>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="User or group" />
                          </SelectTrigger>
                          <SelectContent>
                            {MOCK_USERS.map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                            {MOCK_GROUPS.map((g) => (
                              <SelectItem key={g} value={g}>{g}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* 6. SLA Settings */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" /> SLA Settings
                </CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <p className="text-sm text-muted-foreground">Maximum response time (minutes) for each severity. All required.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-sm">Critical alert SLA (min) *</Label>
                      <Input type="number" placeholder="e.g. 5" className="mt-1 w-24" />
                    </div>
                    <div>
                      <Label className="text-sm">High alert SLA (min) *</Label>
                      <Input type="number" placeholder="e.g. 15" className="mt-1 w-24" />
                    </div>
                    <div>
                      <Label className="text-sm">Medium alert SLA (min) *</Label>
                      <Input type="number" placeholder="e.g. 30" className="mt-1 w-24" />
                    </div>
                    <div>
                      <Label className="text-sm">Low alert SLA (min) *</Label>
                      <Input type="number" placeholder="e.g. 60" className="mt-1 w-24" />
                    </div>
                  </div>
                  <Button>Save SLA settings</Button>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>
      </ScrollArea>
    </ModulePageLayout>
  )
}