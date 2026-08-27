"use client"

import { useEffect, useMemo, useState } from "react"
import { MlCameraFeed } from "@/components/cameras/ml-camera-feed"
import { MlSystemStatus } from "@/components/cameras/ml-system-status"
import type { CameraRecord } from "@/lib/cameras-api"
import { cameraSourceLabel } from "@/lib/cameras-api"
import { useCameras } from "@/hooks/use-cameras"
import { LOCATION_OPTIONS } from "@/lib/locations"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  LayoutGrid,
  ChevronDown,
  Star,
  Search,
  Video,
  Move,
  Camera,
  Mic,
  Volume2,
  ZoomIn,
  Monitor,
  Square,
  Circle,
} from "lucide-react"

const LAYOUTS = ["1x1", "2x2", "3x3", "4x4", "6x6", "Custom"]
const CAMERA_TYPES = ["Fixed", "PTZ", "Thermal", "360"]
const CAMERA_STATUSES = ["Online", "Offline", "Recording", "Alert"]
const TRACK_TYPES = ["Person", "Vehicle", "Any"]
const DE_NOISE = ["Off", "Low", "Med", "High"]
const ROTATIONS = ["0", "90", "180", "270"]
const ASPECT_RATIOS = ["4:3", "16:9", "Original"]
const STREAM_PROFILES = ["Main", "Sub"]

function gridCount(layout: string): number {
  if (layout === "1x1") return 1
  if (layout === "2x2") return 4
  if (layout === "3x3") return 9
  if (layout === "4x4") return 16
  if (layout === "6x6") return 36
  return 4
}

export default function LiveCameraGridPage() {
  const { cameras: allCameras } = useCameras({ activeOnly: true, onlineOnly: true })
  const [cameras, setCameras] = useState<CameraRecord[]>([])
  const [locationFilter, setLocationFilter] = useState("all")
  const [layout, setLayout] = useState("2x2")
  const [videoWallMode, setVideoWallMode] = useState(false)
  const [layoutName, setLayoutName] = useState("")
  const [cameraSearch, setCameraSearch] = useState("")
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true)
  const [showObjectLabels, setShowObjectLabels] = useState(true)
  const [showConfidence, setShowConfidence] = useState(false)
  const [showTempOverlay, setShowTempOverlay] = useState(false)
  const [showCameraName, setShowCameraName] = useState(true)
  const [showTimestamp, setShowTimestamp] = useState(true)
  const [brightness, setBrightness] = useState(0)
  const [contrast, setContrast] = useState(0)
  const [sharpness, setSharpness] = useState(50)
  const [ptzSpeed, setPtzSpeed] = useState(5)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [enableAutoTrack, setEnableAutoTrack] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [micEnabled, setMicEnabled] = useState(false)
  const [speakerVolume, setSpeakerVolume] = useState(50)
  const [snapshotComment, setSnapshotComment] = useState("")

  useEffect(() => {
    if (locationFilter === "all") setCameras(allCameras)
    else setCameras(allCameras.filter((c) => c.location === locationFilter))
  }, [allCameras, locationFilter])

  const sidebarCameras = useMemo(() => {
    const q = cameraSearch.trim().toLowerCase()
    if (!q) return allCameras
    return allCameras.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.site_name.toLowerCase().includes(q) ||
        c.nvr_name.toLowerCase().includes(q) ||
        String(c.channel).includes(q) ||
        cameraSourceLabel(c).toLowerCase().includes(q)
    )
  }, [allCameras, cameraSearch])

  const gridCameras = useMemo(() => cameras.slice(0, gridCount(layout)), [cameras, layout])

  return (
    <ModulePageLayout
      title="Live View — Real-time camera monitoring and control"
      description="Required: Yes = mandatory field. Field Type defines input widget. Developer notes: implementation context."
      breadcrumbs={[{ label: "AI Analytics" }, { label: "Live View" }]}
    >
      <MlSystemStatus className="mb-4" />
      <div className="flex gap-4 flex-col lg:flex-row">
        <ScrollArea className="lg:w-80 shrink-0 border border-border rounded-lg bg-card">
          <div className="p-3 space-y-2">
            {/* I. Camera Grid */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                <span className="flex items-center gap-2"><LayoutGrid className="h-4 w-4" /> Camera Grid</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3 pl-1">
                <div>
                  <Label className="text-xs">Layout type *</Label>
                  <Select value={layout} onValueChange={setLayout}>
                    <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LAYOUTS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Video wall mode</Label>
                  <Switch checked={videoWallMode} onCheckedChange={setVideoWallMode} />
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Layout name" value={layoutName} onChange={(e) => setLayoutName(e.target.value)} className="h-8" />
                  <Button size="sm">Save</Button>
                </div>
                <div>
                  <Label className="text-xs">Load layout</Label>
                  <Select>
                    <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Saved layouts" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default 2x2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">Double-click a cell for full screen</p>
              </CollapsibleContent>
            </Collapsible>

            {/* II. Camera Selection */}
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                <span className="flex items-center gap-2"><Search className="h-4 w-4" /> Camera Selection</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3 pl-1">
                <Input placeholder="Search camera by name/ID" value={cameraSearch} onChange={(e) => setCameraSearch(e.target.value)} className="h-8" />
                <div>
                  <Label className="text-xs">Filter by location</Label>
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="All locations" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {LOCATION_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Filter by type</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {CAMERA_TYPES.map((t) => <label key={t} className="flex items-center gap-1 text-xs"><Checkbox />{t}</label>)}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Filter by status</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {CAMERA_STATUSES.map((s) => <label key={s} className="flex items-center gap-1 text-xs"><Checkbox />{s}</label>)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">Star icon = Add to favorites. Expand tree for camera groups.</div>
                <div className="border rounded p-2 max-h-40 overflow-y-auto space-y-1">
                  {sidebarCameras.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-1">No cameras in database.</p>
                  ) : (
                    sidebarCameras.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-sm gap-2">
                        <span className="truncate">{c.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">Ch {c.channel}</span>
                      </div>
                    ))
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* III. Video Display - Overlays */}
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                <span className="flex items-center gap-2"><Video className="h-4 w-4" /> Video Display</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3 pl-1">
                <p className="text-xs font-medium text-muted-foreground">Overlays</p>
                {([
                  [showBoundingBoxes, setShowBoundingBoxes, "Show bounding boxes"],
                  [showObjectLabels, setShowObjectLabels, "Show object labels"],
                  [showConfidence, setShowConfidence, "Show confidence score"],
                  [showTempOverlay, setShowTempOverlay, "Show temperature overlay"],
                  [showCameraName, setShowCameraName, "Show camera name"],
                  [showTimestamp, setShowTimestamp, "Show timestamp"],
                ] as [boolean, React.Dispatch<React.SetStateAction<boolean>>, string][]).map(([val, set, lbl]) => (
                  <div key={lbl} className="flex items-center justify-between">
                    <Label className="text-xs">{lbl}</Label>
                    <Switch checked={!!val} onCheckedChange={(c) => set(c)} />
                  </div>
                ))}
                <p className="text-xs font-medium text-muted-foreground mt-2">Enhancement</p>
                <div><Label className="text-xs">Brightness (-50 to +50)</Label><Slider value={[brightness]} onValueChange={([v]) => setBrightness(v)} min={-50} max={50} className="mt-1" /></div>
                <div><Label className="text-xs">Contrast (-50 to +50)</Label><Slider value={[contrast]} onValueChange={([v]) => setContrast(v)} min={-50} max={50} className="mt-1" /></div>
                <div><Label className="text-xs">Sharpness (0-100)</Label><Slider value={[sharpness]} onValueChange={([v]) => setSharpness(v)} min={0} max={100} className="mt-1" /></div>
                <div><Label className="text-xs">De-noise</Label><Select><SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger><SelectContent>{DE_NOISE.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
                <div className="flex items-center justify-between"><Label className="text-xs">De-fog mode</Label><Switch /></div>
                <div className="flex items-center justify-between"><Label className="text-xs">Night mode</Label><Switch /></div>
              </CollapsibleContent>
            </Collapsible>

            {/* IV. PTZ Control */}
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                <span className="flex items-center gap-2"><Move className="h-4 w-4" /> PTZ Control</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3 pl-1">
                <p className="text-xs font-medium text-muted-foreground">Manual control</p>
                <div className="grid grid-cols-3 gap-1">
                  <div /><Button size="icon" variant="outline" className="h-8 w-8">↑</Button><div />
                  <Button size="icon" variant="outline" className="h-8 w-8">←</Button><div className="rounded bg-muted flex items-center justify-center text-xs">PTZ</div><Button size="icon" variant="outline" className="h-8 w-8">→</Button>
                  <div /><Button size="icon" variant="outline" className="h-8 w-8">↓</Button><div />
                </div>
                <div className="flex gap-2"><Button size="sm" variant="outline">Zoom +</Button><Button size="sm" variant="outline">Zoom -</Button></div>
                <div><Label className="text-xs">PTZ speed (1-10)</Label><Slider value={[ptzSpeed]} onValueChange={([v]) => setPtzSpeed(v)} min={1} max={10} className="mt-1" /></div>
                <div><Label className="text-xs">Focus mode</Label><RadioGroup defaultValue="auto" className="flex gap-2 mt-1"><label className="flex items-center gap-1 text-xs"><RadioGroupItem value="auto" />Auto</label><label className="flex items-center gap-1 text-xs"><RadioGroupItem value="manual" />Manual</label></RadioGroup></div>
                <p className="text-xs font-medium text-muted-foreground mt-2">Presets</p>
                <Input placeholder="Preset name *" className="h-8" />
                <Input type="number" placeholder="Preset number (1-256) *" className="h-8" min={1} max={256} />
                <div className="flex gap-2"><Select><SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Go to preset" /></SelectTrigger><SelectContent><SelectItem value="1">Preset 1</SelectItem></SelectContent></Select><Button size="sm">Go</Button></div>
                <div className="flex gap-2"><Button size="sm" variant="outline" className="flex-1">Save current position</Button><Button size="sm" variant="destructive">Delete preset</Button></div>
                <p className="text-xs font-medium text-muted-foreground mt-2">Tours</p>
                <Input placeholder="Tour name *" className="h-8" />
                <Input type="number" placeholder="Dwell time (sec)" defaultValue={5} className="h-8" />
                <Button size="sm" variant="outline" className="w-full">Start / Stop tour</Button>
              </CollapsibleContent>
            </Collapsible>

            {/* V. Auto-Tracking */}
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                <span>Auto-Tracking</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3 pl-1">
                <div className="flex items-center justify-between"><Label className="text-xs">Enable auto-track</Label><Switch checked={enableAutoTrack} onCheckedChange={setEnableAutoTrack} /></div>
                <div><Label className="text-xs">Track object type</Label><div className="flex flex-wrap gap-2 mt-1">{TRACK_TYPES.map((t) => <label key={t} className="flex items-center gap-1 text-xs"><Checkbox />{t}</label>)}</div></div>
              </CollapsibleContent>
            </Collapsible>

            {/* VI. Recording */}
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                <span className="flex items-center gap-2"><Circle className="h-4 w-4" /> Recording</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3 pl-1">
                {!isRecording ? <Button size="sm" className="w-full bg-red-600 hover:bg-red-700" onClick={() => setIsRecording(true)}>Start manual record</Button> : <Button size="sm" variant="outline" className="w-full" onClick={() => setIsRecording(false)}>Stop recording</Button>}
                <Button size="sm" variant="outline" className="w-full gap-2"><Camera className="h-4 w-4" /> Take snapshot</Button>
                <Input placeholder="Snapshot comment" value={snapshotComment} onChange={(e) => setSnapshotComment(e.target.value)} className="h-8" />
              </CollapsibleContent>
            </Collapsible>

            {/* VII. Audio */}
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                <span className="flex items-center gap-2"><Mic className="h-4 w-4" /> Audio</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3 pl-1">
                <div className="flex items-center justify-between"><Label className="text-xs">Enable microphone</Label><Switch checked={micEnabled} onCheckedChange={setMicEnabled} /></div>
                <div><Label className="text-xs">Speaker volume (0-100)</Label><Slider value={[speakerVolume]} onValueChange={([v]) => setSpeakerVolume(v)} min={0} max={100} className="mt-1" /></div>
                <div className="flex gap-2"><Input placeholder="Broadcast message" className="h-8 flex-1" /><Button size="sm">Send</Button></div>
              </CollapsibleContent>
            </Collapsible>

            {/* VIII. Digital Zoom */}
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                <span className="flex items-center gap-2"><ZoomIn className="h-4 w-4" /> Digital zoom</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3 pl-1">
                <div><Label className="text-xs">Zoom level (1x-16x)</Label><Slider value={[zoomLevel]} onValueChange={([v]) => setZoomLevel(v)} min={1} max={16} className="mt-1" /></div>
                <p className="text-xs text-muted-foreground">Click-to-zoom region: select area on video to zoom</p>
              </CollapsibleContent>
            </Collapsible>

            {/* IX. Display Settings */}
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                <span className="flex items-center gap-2"><Monitor className="h-4 w-4" /> Display</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3 pl-1">
                <div><Label className="text-xs">Aspect ratio</Label><RadioGroup defaultValue="16:9" className="flex gap-2 mt-1">{ASPECT_RATIOS.map((a) => <label key={a} className="flex items-center gap-1 text-xs"><RadioGroupItem value={a} />{a}</label>)}</RadioGroup></div>
                <div><Label className="text-xs">Rotation</Label><Select><SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger><SelectContent>{ROTATIONS.map((r) => <SelectItem key={r} value={r}>{r}°</SelectItem>)}</SelectContent></Select></div>
                <div className="flex items-center justify-between"><Label className="text-xs">DeInterlace</Label><Switch /></div>
                <div><Label className="text-xs">Stream profile (Sub = lower bandwidth)</Label><RadioGroup defaultValue="main" className="flex gap-2 mt-1">{STREAM_PROFILES.map((s) => <label key={s} className="flex items-center gap-1 text-xs"><RadioGroupItem value={s} />{s}</label>)}</RadioGroup></div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>

        <div className="flex-1 min-w-0">
          <Card>
            <CardContent className="p-4">
              {gridCameras.length === 0 ? (
                <div className="aspect-video rounded-lg border border-dashed flex items-center justify-center text-sm text-muted-foreground">
                  No cameras configured. Add cameras in Camera Integration.
                </div>
              ) : (
                <div
                  className={`grid gap-2 rounded-lg border border-border bg-muted/20 p-2 ${
                    layout === "1x1" ? "grid-cols-1" :
                    layout === "2x2" ? "grid-cols-2" :
                    layout === "3x3" ? "grid-cols-3" :
                    layout === "4x4" ? "grid-cols-4" :
                    layout === "6x6" ? "grid-cols-6" : "grid-cols-2"
                  }`}
                >
                  {gridCameras.map((cam) => (
                    <div
                      key={cam.id}
                      className="relative rounded overflow-hidden border border-border hover:border-[#A9D1EF]"
                    >
                      <MlCameraFeed
                        camera={cam}
                        pollMl={false}
                        showOverlay={showBoundingBoxes}
                        showBrandLogo
                        showFullscreenButton
                      />
                      {showCameraName && (
                        <span className="absolute top-1 left-1 z-20 text-xs font-medium bg-black/60 text-white px-1.5 py-0.5 rounded pointer-events-none">
                          {cam.name}
                        </span>
                      )}
                      {showTimestamp && (
                        <span className="absolute top-1 right-1 z-20 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded pointer-events-none">
                          {new Date().toLocaleTimeString()}
                        </span>
                      )}
                      <span className="absolute bottom-1 left-1 z-20 text-xs text-white/90 bg-black/60 px-1.5 py-0.5 rounded pointer-events-none">
                        {cam.location} • {cam.zone}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ModulePageLayout>
  )
}
