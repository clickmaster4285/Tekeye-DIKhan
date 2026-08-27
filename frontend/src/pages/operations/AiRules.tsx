"use client"

import { useState } from "react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"

const TRIGGER_EVENTS = ["Intrusion", "Line cross", "Loitering", "Face match", "LPR hit", "Fire", "Fighting", "Fall"]
const SEVERITIES = ["Critical", "High", "Medium", "Low"]
const ALERT_ACTIONS = ["Email", "SMS", "App", "Webhook", "Record"]

export default function AiRulesPage() {
  const [confidenceMin, setConfidenceMin] = useState(70)

  return (
    <ModulePageLayout
      title="AI Rules — AI Analytics"
      description="Required = Yes means mandatory. Configure triggers, zones, and alert actions."
      breadcrumbs={[{ label: "AI Analytics" }, { label: "Rules" }]}
    >
      <ScrollArea className="h-[calc(100vh-10rem)]">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base">Rule configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><Label className="text-sm">Rule name *</Label><Input placeholder="Unique rule identifier" className="mt-1" /></div>
            <div><Label className="text-sm">Rule description</Label><Textarea placeholder="What the rule does" className="mt-1 min-h-20" /></div>
            <div><Label className="text-sm">Trigger event type *</Label><Select><SelectTrigger className="mt-1"><SelectValue placeholder="What AI event triggers" /></SelectTrigger><SelectContent>{TRIGGER_EVENTS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-sm">Assigned zone *</Label><Select><SelectTrigger className="mt-1"><SelectValue placeholder="Zone that triggers rule" /></SelectTrigger><SelectContent><SelectItem value="z1">Zone 1</SelectItem></SelectContent></Select></div>
            <div><Label className="text-sm">Confidence minimum (0–100%)</Label><Slider value={[confidenceMin]} onValueChange={([v]) => setConfidenceMin(v)} min={0} max={100} className="mt-1" /><span className="text-sm">{confidenceMin}%</span></div>
            <div><Label className="text-sm">Time schedule (when rule is active)</Label><Input placeholder="Schedule selector" className="mt-1" /></div>
            <div><Label className="text-sm">Cooldown period (sec, default 30)</Label><Input type="number" defaultValue={30} className="w-24 h-8 mt-1" /></div>
            <div><Label className="text-sm">Dwell time minimum (sec)</Label><Input type="number" className="w-24 h-8 mt-1" /></div>
            <div><Label className="text-sm">Alert severity *</Label><Select><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-sm">Alert action</Label><div className="flex flex-wrap gap-4 mt-1">{ALERT_ACTIONS.map((a) => <label key={a} className="flex items-center gap-1 text-sm"><Checkbox />{a}</label>)}</div></div>
            <div className="flex items-center justify-between"><Label className="text-sm">Rule status (Active/Inactive)</Label><Switch defaultChecked /></div>
            <div className="pt-4"><button type="button" className="text-sm font-medium text-primary hover:underline">+ Add another rule</button></div>
          </CardContent>
        </Card>
      </ScrollArea>
    </ModulePageLayout>
  )
}
