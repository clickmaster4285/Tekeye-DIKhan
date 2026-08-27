"use client"

import { useState } from "react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronDown, Box, User, Car, Wrench, Activity } from "lucide-react"

const VEHICLE_SUBTYPES = ["Car", "Truck", "Bus", "Motorcycle", "Bicycle"]
const FPS_OPTIONS = ["5", "10", "15", "20", "30"]
const LPR_REGIONS = ["US", "EU", "UK", "PK", "Other"]

export default function AiModelsPage() {
  const [confidenceThreshold, setConfidenceThreshold] = useState(80)
  const [recognitionThreshold, setRecognitionThreshold] = useState(85)
  const [lprThreshold, setLprThreshold] = useState(80)

  return (
    <ModulePageLayout
      title="AI Models — AI Detection & Analytics"
      description="Required = Yes means mandatory. Field Type defines input widget. Developer Notes = implementation context."
      breadcrumbs={[{ label: "AI Analytics" }, { label: "AI Models" }]}
    >
      <ScrollArea className="h-[calc(100vh-10rem)]">
        <div className="space-y-6 pb-6">
          {/* Object Detection */}
          <Card>
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2"><Box className="h-4 w-4" /> Object Detection</CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {["Person", "Vehicle", "Animal", "Weapon", "Fire", "Package/Bag"].map((label, i) => (
                      <div key={label} className="flex items-center justify-between">
                        <Label className="text-sm">Enable {label.replace("/", " / ")} detection</Label>
                        <Switch />
                      </div>
                    ))}
                  </div>
                  <div><Label className="text-sm">Vehicle sub-types</Label><Select><SelectTrigger className="mt-1 w-full max-w-xs"><SelectValue placeholder="Select vehicle type" /></SelectTrigger><SelectContent>{VEHICLE_SUBTYPES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label className="text-sm">Detection confidence threshold (50–99%) * Default 80%</Label><Slider value={[confidenceThreshold]} onValueChange={([v]) => setConfidenceThreshold(v)} min={50} max={99} className="mt-1" /><span className="text-sm">{confidenceThreshold}%</span></div>
                  <div><Label className="text-sm">Max objects per frame (default 10)</Label><Input type="number" defaultValue={10} className="w-24 h-8" /></div>
                  <div><Label className="text-sm">Frame processing rate (FPS, default 15)</Label><Select><SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger><SelectContent>{FPS_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Face Recognition */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Face Recognition</CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div className="flex items-center justify-between"><Label className="text-sm">Enable face detection</Label><Switch /></div>
                  <div className="flex items-center justify-between"><Label className="text-sm">Enable face recognition *</Label><Switch defaultChecked /></div>
                  <div><Label className="text-sm">Recognition threshold (50–99%) * Default 85%</Label><Slider value={[recognitionThreshold]} onValueChange={([v]) => setRecognitionThreshold(v)} min={50} max={99} className="mt-1" /><span className="text-sm">{recognitionThreshold}%</span></div>
                  <div><Label className="text-sm">Min face size (px, default 80)</Label><Input type="number" defaultValue={80} className="w-24 h-8" /></div>
                  {["Age estimation", "Gender estimation", "Mask detection", "Liveness check (anti-spoofing)", "Gait recognition"].map((l) => (
                    <div key={l} className="flex items-center justify-between"><Label className="text-sm">Enable {l}</Label><Switch /></div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* LPR */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2"><Car className="h-4 w-4" /> LPR (License Plate Recognition)</CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div className="flex items-center justify-between"><Label className="text-sm">Enable LPR</Label><Switch /></div>
                  <div><Label className="text-sm">LPR confidence threshold (50–99%) * Default 80%</Label><Slider value={[lprThreshold]} onValueChange={([v]) => setLprThreshold(v)} min={50} max={99} className="mt-1" /><span className="text-sm">{lprThreshold}%</span></div>
                  <div><Label className="text-sm">Supported regions</Label><div className="flex flex-wrap gap-2 mt-1">{LPR_REGIONS.map((r) => <label key={r} className="flex items-center gap-1 text-sm"><Checkbox />{r}</label>)}</div></div>
                  <div className="flex items-center justify-between"><Label className="text-sm">Enable speed estimation (requires calibration)</Label><Switch /></div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Behavior Analysis */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Behavior Analysis</CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  {["Fighting", "Fall", "Harassing", "Loitering", "Crowd analysis", "Unusual movement", "Unlawful dumping", "Wrong direction"].map((b) => (
                    <div key={b} className="flex items-center justify-between"><Label className="text-sm">Enable {b.toLowerCase()} detection</Label><Switch /></div>
                  ))}
                  <div><Label className="text-sm">Loitering time threshold (sec, default 10)</Label><Input type="number" defaultValue={10} className="w-24 h-8" /></div>
                  <div><Label className="text-sm">Crowd size threshold (persons, default 10)</Label><Input type="number" defaultValue={10} className="w-24 h-8" /></div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>
      </ScrollArea>
    </ModulePageLayout>
  )
}
