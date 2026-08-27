"use client"

import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronDown, MapPin, Minus, Hash } from "lucide-react"
import { CameraSelectItems } from "@/components/cameras/camera-select-items"
import { useCameras } from "@/hooks/use-cameras"

const ZONE_TYPES = ["Intrusion", "Loitering", "Counting", "Guard"]
const OBJECT_TYPES = ["Person", "Vehicle", "Any"]

export default function AiZonesPage() {
  const { cameras, loading } = useCameras({ activeOnly: true })

  return (
    <ModulePageLayout
      title="Detection Zones — AI Analytics"
      description="Required = Yes means mandatory. Draw tools for zone shape and line."
      breadcrumbs={[{ label: "AI Analytics" }, { label: "Zones" }]}
    >
      <ScrollArea className="h-[calc(100vh-10rem)]">
        <div className="space-y-6 pb-6">
          <Card>
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Intrusion Zone</CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div><Label className="text-sm">Zone name *</Label><Input placeholder="Name for the zone" className="mt-1" /></div>
                  <div><Label className="text-sm">Zone type</Label><Select><SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{ZONE_TYPES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label className="text-sm">Zone shape (draw polygon on camera view)</Label><div className="mt-1 h-32 rounded border border-dashed border-border bg-muted/20 flex items-center justify-center text-sm text-muted-foreground">Draw tool — Polygon</div></div>
                  <div><Label className="text-sm">Assigned camera *</Label><Select><SelectTrigger className="mt-1"><SelectValue placeholder="Select camera" /></SelectTrigger><SelectContent><CameraSelectItems cameras={cameras} loading={loading} /></SelectContent></Select></div>
                  <div><Label className="text-sm">Active schedule (24/7 or custom)</Label><Input placeholder="Schedule selector" className="mt-1" /></div>
                  <div><Label className="text-sm">Object types to detect *</Label><div className="flex gap-4 mt-1">{OBJECT_TYPES.map((o) => <label key={o} className="flex items-center gap-1 text-sm"><Checkbox />{o}</label>)}</div></div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2"><Minus className="h-4 w-4" /> Line Crossing</CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div><Label className="text-sm">Line name *</Label><Input placeholder="Name for virtual line" className="mt-1" /></div>
                  <div><Label className="text-sm">Line coordinates (draw line on camera view) *</Label><div className="mt-1 h-32 rounded border border-dashed border-border bg-muted/20 flex items-center justify-center text-sm text-muted-foreground">Draw tool — Line</div></div>
                  <div><Label className="text-sm">Direction *</Label><RadioGroup className="flex gap-4 mt-1"><label className="flex items-center gap-2"><RadioGroupItem value="inbound" />Inbound</label><label className="flex items-center gap-2"><RadioGroupItem value="outbound" />Outbound</label><label className="flex items-center gap-2"><RadioGroupItem value="both" />Both</label></RadioGroup></div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2"><Hash className="h-4 w-4" /> Counting Zone</CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div><Label className="text-sm">Zone name *</Label><Input placeholder="Name for counting zone" className="mt-1" /></div>
                  <div><Label className="text-sm">Max occupancy (alert when exceeded)</Label><Input type="number" className="w-32 mt-1" /></div>
                  <div><Label className="text-sm">Count direction *</Label><RadioGroup className="flex gap-4 mt-1"><label className="flex items-center gap-2"><RadioGroupItem value="in" />In</label><label className="flex items-center gap-2"><RadioGroupItem value="out" />Out</label><label className="flex items-center gap-2"><RadioGroupItem value="both" />Both</label></RadioGroup></div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>
      </ScrollArea>
    </ModulePageLayout>
  )
}
