"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
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
import { ChevronDown, Search, Calendar, Zap, User, Truck, Activity, Package, Thermometer, Film, Bookmark, Download, Wrench } from "lucide-react"
import { CameraSelectItems } from "@/components/cameras/camera-select-items"
import { useCameras } from "@/hooks/use-cameras"

const LOCATIONS = ["Peshawar", "Yarik", "DI Khan", "SWH Ratta Kulachi", "Kohat", "Mardan", "Nowshera","Chamkani"]
const RECORDING_TYPES = ["Continuous", "Motion", "Event", "Manual"]
const EVENT_TYPES = ["Alert", "Bookmark", "Incident", "AI event"]

/** Demo clips in `public/ai detection/` — each id maps to exactly one file */
const AI_DETECTION_PLAYBACK = [
  { id: "smog", label: "Smog", file: "smog.mp4" },
  { id: "person", label: "Person", file: "persons.mp4" },
  { id: "vehicle", label: "Vehicle", file: "vehicle.mp4" },
  { id: "vehicles", label: "Vehicles", file: "vehicles.mp4" },
] as const

type AiDetectionPlaybackId = (typeof AI_DETECTION_PLAYBACK)[number]["id"]

const AI_DETECTION_VIDEO_SRC: Record<AiDetectionPlaybackId, string> = {
  smog: "/ai%20detection/smog.mp4",
  person: "/ai%20detection/persons.mp4",
  vehicle: "/ai%20detection/vehicle.mp4",
  vehicles: "/ai%20detection/vehicles.mp4",
}

/** Filters with no demo clip (Person/Vehicle use playback radios above) */
const OTHER_AI_DETECTION_TYPES = ["Fire", "Intrusion", "Loitering"]

function aiDetectionVideoSrc(id: AiDetectionPlaybackId | ""): string | null {
  if (!id) return null
  return AI_DETECTION_VIDEO_SRC[id] ?? null
}

function playbackIdFromFilterLabel(label: string): AiDetectionPlaybackId | "" {
  if (label === "Person") return "person"
  if (label === "Vehicle") return "vehicle"
  return ""
}
const ALERT_PRIORITIES = ["Critical", "High", "Medium", "Low"]
const VEHICLE_TYPES = ["Car", "Truck", "Bus", "Motorcycle", "Bicycle"]
const BEHAVIOR_TYPES = ["Fighting", "Running", "Loitering", "Fallen", "Crowding"]
const OBJECT_TYPES = ["Bag", "Weapon", "Fire", "Smoke", "Package"]
const ANOMALY_TYPES = ["Fever", "Fire", "Hot Spot", "Equipment"]
const PLAYBACK_SPEEDS = ["0.25x", "0.5x", "1x", "2x", "4x", "8x", "16x", "32x"]
const EXPORT_FORMATS = ["MP4", "AVI", "MKV"]
const RESOLUTIONS = ["Original", "1080p", "720p", "480p"]
const SYNC_LAYOUTS = ["2x2", "2x3", "3x3", "4x4"]

const PLAYBACK_RATE: Record<string, number> = {
  "0.25x": 0.25,
  "0.5x": 0.5,
  "1x": 1,
  "2x": 2,
  "4x": 4,
  "8x": 8,
  "16x": 16,
  "32x": 32,
}

export default function PlaybackSearchPage() {
  const { cameras, loading: camerasLoading } = useCameras({ activeOnly: true })
  const videoRef = useRef<HTMLVideoElement>(null)
  const [similarityThreshold, setSimilarityThreshold] = useState(80)
  const [ageRange, setAgeRange] = useState([20, 60])
  const [timelineZoom, setTimelineZoom] = useState(50)
  const [playbackSpeed, setPlaybackSpeed] = useState("1x")
  const [exportFormat, setExportFormat] = useState("MP4")
  const [aiDetectionPlayback, setAiDetectionPlayback] = useState<AiDetectionPlaybackId | "">("")
  const [otherAiFilters, setOtherAiFilters] = useState<string[]>([])
  const [isPlaying, setIsPlaying] = useState(false)

  const activeVideoSrc = aiDetectionVideoSrc(aiDetectionPlayback)

  const setPlayback = (id: AiDetectionPlaybackId | "") => {
    setAiDetectionPlayback(id)
  }

  const togglePlaybackFilter = (label: "Person" | "Vehicle", checked: boolean) => {
    const id = playbackIdFromFilterLabel(label)
    if (checked) {
      setPlayback(id)
      return
    }
    if (aiDetectionPlayback === id) {
      setPlayback("")
    }
  }

  const togglePlay = useCallback(() => {
    const el = videoRef.current
    if (!el || !activeVideoSrc) return
    if (el.paused) {
      void el.play()
    } else {
      el.pause()
    }
  }, [activeVideoSrc])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.playbackRate = PLAYBACK_RATE[playbackSpeed] ?? 1
  }, [playbackSpeed, activeVideoSrc])

  useEffect(() => {
    const el = videoRef.current
    if (!el || !activeVideoSrc) {
      setIsPlaying(false)
      return
    }
    el.load()
    void el.play().catch(() => setIsPlaying(false))
  }, [activeVideoSrc])

  return (
    <ModulePageLayout
      title="Playback & Search — Video review, AI smart search, export & evidence"
      description="Required = Yes means mandatory field. Field Type defines input widget. Developer Notes = implementation context."
      breadcrumbs={[{ label: "AI Analytics" }, { label: "Playback & Search" }]}
    >
      <div className="flex gap-4 flex-col lg:flex-row">
        <ScrollArea className="lg:w-96 shrink-0 border border-border rounded-lg bg-card max-h-[calc(100vh-12rem)]">
          <div className="p-3 space-y-2">
            {/* Basic Search */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                <span className="flex items-center gap-2"><Search className="h-4 w-4" /> Basic Search</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3 pl-1">
                <div>
                  <Label className="text-xs">Location *</Label>
                  <Select><SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Select location" /></SelectTrigger>
                    <SelectContent>{LOCATIONS.map((loc) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}</SelectContent></Select>
                </div>
                <div>
                  <Label className="text-xs">Camera selection *</Label>
                  <Select><SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Select cameras" /></SelectTrigger>
                    <SelectContent><CameraSelectItems cameras={cameras} loading={camerasLoading} /></SelectContent></Select>
                  <p className="text-xs text-muted-foreground mt-0.5">Multi-select</p>
                </div>
                <div><Label className="text-xs">Date from *</Label><Input type="date" className="h-8 mt-1" /></div>
                <div><Label className="text-xs">Date to *</Label><Input type="date" className="h-8 mt-1" /></div>
                <div><Label className="text-xs">Time from</Label><Input type="time" step={1} className="h-8 mt-1" /></div>
                <div><Label className="text-xs">Time to</Label><Input type="time" step={1} className="h-8 mt-1" /></div>
                <div>
                  <Label className="text-xs">Recording type filter</Label>
                  <div className="flex flex-wrap gap-2 mt-1">{RECORDING_TYPES.map((r) => <label key={r} className="flex items-center gap-1 text-xs"><Checkbox />{r}</label>)}</div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Advanced Search */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                <span className="flex items-center gap-2"><Zap className="h-4 w-4" /> Advanced Search</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3 pl-1">
                <div>
                  <Label className="text-xs">AI detection playback *</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Plays matching clip from <span className="font-mono">public/ai detection</span>
                  </p>
                  <RadioGroup
                    value={aiDetectionPlayback || "none"}
                    onValueChange={(v) =>
                      setPlayback(v === "none" ? "" : (v as AiDetectionPlaybackId))
                    }
                    className="mt-2 space-y-1.5"
                  >
                    <label className="flex cursor-pointer items-center gap-2 text-xs">
                      <RadioGroupItem value="none" />
                      None
                    </label>
                    {AI_DETECTION_PLAYBACK.map((item) => (
                      <label
                        key={item.id}
                        className="flex cursor-pointer items-center gap-2 text-xs"
                      >
                        <RadioGroupItem value={item.id} />
                        {item.label}
                      </label>
                    ))}
                  </RadioGroup>
                </div>
                <div><Label className="text-xs">Event type filter</Label><div className="flex flex-wrap gap-2 mt-1">{EVENT_TYPES.map((e) => <label key={e} className="flex items-center gap-1 text-xs"><Checkbox />{e}</label>)}</div></div>
                <div>
                  <Label className="text-xs">Other AI detection types</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Person / Vehicle also play their clips (Vehicle → vehicle.mp4)
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {(["Person", "Vehicle"] as const).map((d) => {
                      const playbackId = playbackIdFromFilterLabel(d)
                      const checked = aiDetectionPlayback === playbackId
                      return (
                        <label key={d} className="flex items-center gap-1 text-xs">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => togglePlaybackFilter(d, v === true)}
                          />
                          {d}
                        </label>
                      )
                    })}
                    {OTHER_AI_DETECTION_TYPES.map((d) => (
                      <label key={d} className="flex items-center gap-1 text-xs">
                        <Checkbox
                          checked={otherAiFilters.includes(d)}
                          onCheckedChange={(v) =>
                            setOtherAiFilters((prev) =>
                              v === true ? [...prev, d] : prev.filter((x) => x !== d)
                            )
                          }
                        />
                        {d}
                      </label>
                    ))}
                  </div>
                </div>
                <div><Label className="text-xs">Alert priority filter</Label><div className="flex flex-wrap gap-2 mt-1">{ALERT_PRIORITIES.map((p) => <label key={p} className="flex items-center gap-1 text-xs"><Checkbox />{p}</label>)}</div></div>
                <div className="flex items-center justify-between"><Label className="text-xs">Has bookmarks only</Label><Switch /></div>
              </CollapsibleContent>
            </Collapsible>

            {/* Smart Search (AI) */}
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                <span className="flex items-center gap-2"><Search className="h-4 w-4" /> Smart Search (AI)</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3 pl-1">
                <p className="text-xs font-medium text-muted-foreground">Person search</p>
                <div><Label className="text-xs">Upload reference photo</Label><Input type="file" accept="image/*" className="h-8 mt-1 text-xs" /></div>
                <div><Label className="text-xs">Similarity threshold (50–99%) * Default 80%</Label><Slider value={[similarityThreshold]} onValueChange={([v]) => setSimilarityThreshold(v)} min={50} max={99} className="mt-1" /><span className="text-xs">{similarityThreshold}%</span></div>
                <div><Label className="text-xs">Gender filter</Label><RadioGroup defaultValue="any" className="flex gap-2 mt-1"><label className="flex items-center gap-1 text-xs"><RadioGroupItem value="any" />Any</label><label className="flex items-center gap-1 text-xs"><RadioGroupItem value="male" />Male</label><label className="flex items-center gap-1 text-xs"><RadioGroupItem value="female" />Female</label></RadioGroup></div>
                <div><Label className="text-xs">Age range (0–100)</Label><Slider value={ageRange} onValueChange={setAgeRange} min={0} max={100} className="mt-1" /></div>
                <div><Label className="text-xs">Clothing color (upper/lower)</Label><Input type="color" className="h-8 w-12 mt-1 p-0.5" /></div>
                <div><Label className="text-xs">Height estimate (cm)</Label><Input type="number" placeholder="Min–Max cm" className="h-8 mt-1" /></div>
                <p className="text-xs font-medium text-muted-foreground mt-2">Vehicle search</p>
                <div><Label className="text-xs">Plate number (wildcard supported)</Label><Input placeholder="Full or partial" className="h-8 mt-1" /></div>
                <div><Label className="text-xs">Vehicle type</Label><Select><SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Select vehicle type" /></SelectTrigger><SelectContent>{VEHICLE_TYPES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">Vehicle color</Label><Input type="color" className="h-8 w-12 mt-1 p-0.5" /></div>
                <div><Label className="text-xs">Upload vehicle image</Label><Input type="file" accept="image/*" className="h-8 mt-1 text-xs" /></div>
                <p className="text-xs font-medium text-muted-foreground mt-2">Behavior search *</p>
                <div className="flex flex-wrap gap-2">{BEHAVIOR_TYPES.map((b) => <label key={b} className="flex items-center gap-1 text-xs"><Checkbox />{b}</label>)}</div>
                <p className="text-xs font-medium text-muted-foreground mt-2">Object search *</p>
                <div className="flex flex-wrap gap-2">{OBJECT_TYPES.map((o) => <label key={o} className="flex items-center gap-1 text-xs"><Checkbox />{o}</label>)}</div>
                <p className="text-xs font-medium text-muted-foreground mt-2">Thermal search</p>
                <div><Label className="text-xs">Temperature above (°C/°F)</Label><Input type="number" placeholder="Min threshold" className="h-8 mt-1" /></div>
                <div><Label className="text-xs">Anomaly type</Label><Select><SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{ANOMALY_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
              </CollapsibleContent>
            </Collapsible>

            {/* Timeline View */}
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                <span className="flex items-center gap-2"><Film className="h-4 w-4" /> Timeline View</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3 pl-1">
                <div><Label className="text-xs">Timeline zoom</Label><Slider value={[timelineZoom]} onValueChange={([v]) => setTimelineZoom(v)} className="mt-1" /></div>
                <div className="flex items-center justify-between"><Label className="text-xs">Event markers on timeline</Label><Switch /></div>
                <p className="text-xs text-muted-foreground">Segment colors: Motion=Blue, Event=Red, etc.</p>
                <div><Label className="text-xs">Playback speed</Label><Select value={playbackSpeed} onValueChange={setPlaybackSpeed}><SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger><SelectContent>{PLAYBACK_SPEEDS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                <div className="flex gap-2"><Button size="sm" variant="outline">Step back</Button><Button size="sm" variant="outline">Step fwd</Button></div>
              </CollapsibleContent>
            </Collapsible>

            {/* Multi-Camera Sync */}
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                <span>Multi-Camera Sync</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3 pl-1">
                <div><Label className="text-xs">Add camera to sync * (max 16)</Label><Select><SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Select cameras" /></SelectTrigger><SelectContent><CameraSelectItems cameras={cameras} loading={camerasLoading} /></SelectContent></Select></div>
                <div><Label className="text-xs">Sync start time *</Label><Input type="datetime-local" className="h-8 mt-1" /></div>
                <div><Label className="text-xs">Layout mode</Label><Select><SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger><SelectContent>{SYNC_LAYOUTS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select></div>
              </CollapsibleContent>
            </Collapsible>

            {/* Bookmarks */}
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                <span className="flex items-center gap-2"><Bookmark className="h-4 w-4" /> Bookmarks</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3 pl-1">
                <div><Label className="text-xs">Bookmark name *</Label><Input placeholder="Name/label" className="h-8 mt-1" /></div>
                <div><Label className="text-xs">Bookmark time</Label><Input type="datetime-local" className="h-8 mt-1" /></div>
                <div><Label className="text-xs">Bookmark notes</Label><Textarea placeholder="Annotation" className="mt-1 min-h-16" /></div>
                <div><Label className="text-xs">Bookmark tags</Label><Input placeholder="Searchable tags" className="h-8 mt-1" /></div>
                <div className="flex items-center justify-between"><Label className="text-xs">Share bookmark</Label><Switch /></div>
              </CollapsibleContent>
            </Collapsible>

            {/* Export */}
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                <span className="flex items-center gap-2"><Download className="h-4 w-4" /> Export</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3 pl-1">
                <p className="text-xs font-medium text-muted-foreground">Video export</p>
                <div><Label className="text-xs">Export name *</Label><Input placeholder="File name" className="h-8 mt-1" /></div>
                <div><Label className="text-xs">Start time *</Label><Input type="datetime-local" className="h-8 mt-1" /></div>
                <div><Label className="text-xs">End time *</Label><Input type="datetime-local" className="h-8 mt-1" /></div>
                <div><Label className="text-xs">Format *</Label><RadioGroup value={exportFormat} onValueChange={setExportFormat} className="flex gap-2 mt-1">{EXPORT_FORMATS.map((f) => <label key={f} className="flex items-center gap-1 text-xs"><RadioGroupItem value={f} />{f}</label>)}</RadioGroup></div>
                <div><Label className="text-xs">Resolution</Label><Select><SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger><SelectContent>{RESOLUTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
                <div className="flex items-center justify-between"><Label className="text-xs">Include audio</Label><Switch /></div>
                <div className="flex items-center justify-between"><Label className="text-xs">Add watermark</Label><Switch /></div>
                <div className="flex items-center justify-between"><Label className="text-xs">Apply encryption</Label><Switch /></div>
                <div className="flex items-center justify-between"><Label className="text-xs">Digital signature</Label><Switch /></div>
                <p className="text-xs font-medium text-muted-foreground mt-2">Evidence package</p>
                <div><Label className="text-xs">Evidence title *</Label><Input placeholder="Package name" className="h-8 mt-1" /></div>
                <div><Label className="text-xs">Case / incident reference</Label><Select><SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Link to incident" /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem></SelectContent></Select></div>
                <div className="flex items-center justify-between"><Label className="text-xs">Include chain of custody *</Label><Switch defaultChecked /></div>
                <div className="flex items-center justify-between"><Label className="text-xs">Include AI analysis</Label><Switch /></div>
                <div><Label className="text-xs">Requestor name *</Label><Input className="h-8 mt-1" /></div>
                <div><Label className="text-xs">Purpose / case number *</Label><Input className="h-8 mt-1" /></div>
              </CollapsibleContent>
            </Collapsible>

            {/* Analysis Tools */}
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                <span className="flex items-center gap-2"><Wrench className="h-4 w-4" /> Analysis Tools</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3 pl-1">
                <p className="text-xs font-medium text-muted-foreground">Video enhancement</p>
                <div className="flex items-center justify-between"><Label className="text-xs">Stabilization</Label><Switch /></div>
                <div className="flex items-center justify-between"><Label className="text-xs">Super resolution</Label><Switch /></div>
                <p className="text-xs font-medium text-muted-foreground mt-2">Measurement</p>
                <Button size="sm" variant="outline" className="w-full">Distance calibration (2 points)</Button>
                <Button size="sm" variant="outline" className="w-full">Measure distance (draw line)</Button>
                <p className="text-xs font-medium text-muted-foreground mt-2">Comparison view *</p>
                <div><Label className="text-xs">Camera A</Label><Select><SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger><SelectContent><CameraSelectItems cameras={cameras} loading={camerasLoading} /></SelectContent></Select></div>
                <div><Label className="text-xs">Camera B</Label><Select><SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger><SelectContent><CameraSelectItems cameras={cameras} loading={camerasLoading} /></SelectContent></Select></div>
                <div><Label className="text-xs">Time offset (seconds)</Label><Input type="number" className="h-8 mt-1" /></div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>

        <div className="flex-1 min-w-0 space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="aspect-video overflow-hidden rounded-lg border border-border bg-black">
                {activeVideoSrc ? (
                  <video
                    ref={videoRef}
                    key={aiDetectionPlayback || "none"}
                    src={activeVideoSrc}
                    className="h-full w-full object-contain"
                    controls
                    playsInline
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                  />
                ) : (
                  <div className="flex h-full min-h-[200px] items-center justify-center bg-muted/30 px-4 text-center text-sm text-muted-foreground">
                    Playback video area — open Advanced Search and select Smog, Person, or
                    Vehicle to play a detection clip
                  </div>
                )}
              </div>
              {activeVideoSrc && aiDetectionPlayback && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Playing:{" "}
                  <span className="font-medium text-foreground">
                    {AI_DETECTION_PLAYBACK.find((d) => d.id === aiDetectionPlayback)?.label}
                  </span>
                  <span className="font-mono text-[10px]">
                    {" "}
                    ({AI_DETECTION_PLAYBACK.find((d) => d.id === aiDetectionPlayback)?.file})
                  </span>
                </p>
              )}
              <div className="mt-3 h-12 rounded border border-border bg-muted/20 flex items-center justify-between px-3">
                <span className="text-xs text-muted-foreground">Timeline (zoom / event markers / segment colors)</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!activeVideoSrc}
                    onClick={() => {
                      const el = videoRef.current
                      if (el) el.currentTime = Math.max(0, el.currentTime - 5)
                    }}
                    aria-label="Step back 5 seconds"
                  >
                    ◀
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!activeVideoSrc}
                    onClick={togglePlay}
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? "❚❚" : "▶"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={!activeVideoSrc}>
                    Step back
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!activeVideoSrc}
                    onClick={() => {
                      const el = videoRef.current
                      if (el) el.currentTime = Math.min(el.duration || 0, el.currentTime + 5)
                    }}
                  >
                    Step fwd
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ModulePageLayout>
  )
}
