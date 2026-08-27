"use client"

import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronDown, FolderOpen, Play, BarChart3, Rocket } from "lucide-react"
import { CameraSelectItems } from "@/components/cameras/camera-select-items"
import { useCameras } from "@/hooks/use-cameras"

const BASE_MODELS = ["YOLO", "SSD", "Custom"]
const BATCH_SIZES = ["8", "16", "32", "64"]

export default function AiTrainingPage() {
  const { cameras, loading } = useCameras({ activeOnly: true })

  return (
    <ModulePageLayout
      title="Model Training — AI Analytics"
      description="Datasets, training jobs, evaluation, deployment."
      breadcrumbs={[{ label: "AI Analytics" }, { label: "Training" }]}
    >
      <ScrollArea className="h-[calc(100vh-10rem)]">
        <div className="space-y-6 pb-6">
          {/* Dataset Management */}
          <Card>
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2"><FolderOpen className="h-4 w-4" /> Dataset Management</CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div><Label className="text-sm">Dataset name *</Label><Input placeholder="Training dataset name" className="mt-1" /></div>
                  <div><Label className="text-sm">Upload image / video (multi) *</Label><Input type="file" accept="image/*,video/*" multiple className="mt-1" /></div>
                  <div><Label className="text-sm">Label tool (draw bounding boxes and label) *</Label><div className="mt-1 h-48 rounded border border-dashed border-border bg-muted/20 flex items-center justify-center text-sm text-muted-foreground">Annotation interface</div></div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Training Jobs */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2"><Play className="h-4 w-4" /> Training Jobs</CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div><Label className="text-sm">Job name *</Label><Input placeholder="Training run name" className="mt-1" /></div>
                  <div><Label className="text-sm">Base model *</Label><Select><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{BASE_MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label className="text-sm">Epochs * (default 100)</Label><Input type="number" defaultValue={100} className="w-24 h-8 mt-1" /></div>
                  <div><Label className="text-sm">Learning rate (0.0001–0.1) *</Label><Input type="number" step={0.0001} placeholder="e.g. 0.001" className="w-32 mt-1" /></div>
                  <div><Label className="text-sm">Batch size</Label><Select><SelectTrigger className="w-24 mt-1"><SelectValue /></SelectTrigger><SelectContent>{BATCH_SIZES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label className="text-sm">GPU selection</Label><div className="flex gap-2 mt-1"><label className="flex items-center gap-1 text-sm"><input type="checkbox" /> GPU 0</label><label className="flex items-center gap-1 text-sm"><input type="checkbox" /> GPU 1</label></div></div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Model Evaluation */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Model Evaluation</CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Precision</span><span className="font-medium">94.2%</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Recall</span><span className="font-medium">91.8%</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">mAP score</span><span className="font-medium">92.5%</span></div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Model Deployment */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2"><Rocket className="h-4 w-4" /> Model Deployment</CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div><Label className="text-sm">Deploy to camera(s) *</Label><Select><SelectTrigger className="mt-1"><SelectValue placeholder="Multi-select cameras" /></SelectTrigger><SelectContent><CameraSelectItems cameras={cameras} loading={loading} /></SelectContent></Select><p className="text-xs text-muted-foreground mt-0.5">Push model to edge cameras</p></div>
                  <Button>Deploy model</Button>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>
      </ScrollArea>
    </ModulePageLayout>
  )
}
