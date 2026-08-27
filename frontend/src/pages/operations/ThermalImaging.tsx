"use client"

import { useState } from "react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
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
import { ThermalVideoGrid } from "@/components/thermal/thermal-video-grid"
import {
  ChevronDown,
  Thermometer,
  MapPin,
  Settings,
  UserCheck,
  Flame,
  Wrench,
  BarChart3,
  FileText,
  Calendar,
} from "lucide-react"

const MOCK_THERMAL_CAMERAS = ["Gate Thermal", "Entrance Thermal", "Warehouse Thermal", "Hall Thermal"]
const COLOR_PALETTES = ["Ironbow", "Rainbow", "White-Hot", "Black-Hot"]
const ZONE_SHAPES = ["Point", "Area", "Line"]
const CALIBRATION_TYPES = ["Auto", "Manual", "Blackbody"]
const SCREENING_MODES = ["Kiosk", "Walk-through"]
const CHART_TYPES = ["Line", "Bar", "Heatmap"]
const ANOMALY_SENSITIVITY = ["Low", "Med", "High"]
const ALERT_FREQUENCY = ["Once", "Hourly", "Daily", "Weekly"]

export default function ThermalImagingPage() {
  const [feverThreshold, setFeverThreshold] = useState(37.5)
  const [hotSpotThreshold, setHotSpotThreshold] = useState(70)
  const [anomalySensitivity, setAnomalySensitivity] = useState([50])
  const [emissivity, setEmissivity] = useState(0.96)

  return (
    <ModulePageLayout
      title="Thermal Imaging — Temperature Monitoring, Fever & Fire Detection"
      description="Required = Yes means mandatory. Field Type defines input widget. Developer Notes = implementation context."
      breadcrumbs={[{ label: "AI Analytics" }, { label: "Thermal Imaging" }]}
    >
      <ScrollArea className="h-[calc(100vh-10rem)]">
        <div className="space-y-6 pb-6">
          {/* Thermal Video Grid */}
          <ThermalVideoGrid />

          {/* Temperature Monitoring */}
          <Card>
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Thermometer className="h-4 w-4" />
                  Temperature Monitoring
                </CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-6">
                  {/* Live Monitoring */}
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Live Monitoring</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Assign thermal camera *</Label>
                        <Select>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select thermal camera" />
                          </SelectTrigger>
                          <SelectContent>
                            {MOCK_THERMAL_CAMERAS.map((cam) => (
                              <SelectItem key={cam} value={cam}>
                                {cam}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm">Color palette</Label>
                        <Select>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {COLOR_PALETTES.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm">Temperature scale *</Label>
                        <RadioGroup defaultValue="celsius" className="flex gap-4 mt-1">
                          <label className="flex items-center gap-2 text-sm">
                            <RadioGroupItem value="celsius" />
                            °C
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <RadioGroupItem value="fahrenheit" />
                            °F
                          </label>
                        </RadioGroup>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-sm">Min temp display (auto)</Label>
                          <div className="mt-1 px-3 py-2 rounded border border-border bg-muted/30 text-sm">
                            18.5°C
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm">Max temp display (auto)</Label>
                          <div className="mt-1 px-3 py-2 rounded border border-border bg-muted/30 text-sm">
                            32.1°C
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Measurement Zones */}
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Measurement Zones</h4>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm">Zone name *</Label>
                        <Input placeholder="Name the measurement zone" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-sm">Zone shape *</Label>
                        <RadioGroup defaultValue="point" className="flex gap-4 mt-1">
                          {ZONE_SHAPES.map((shape) => (
                            <label key={shape} className="flex items-center gap-2 text-sm">
                              <RadioGroupItem value={shape.toLowerCase()} />
                              {shape}
                            </label>
                          ))}
                        </RadioGroup>
                      </div>
                      <div>
                        <Label className="text-sm">Zone coordinates (draw zone on thermal image) *</Label>
                        <div className="mt-1 h-32 rounded border border-dashed border-border bg-muted/20 flex items-center justify-center text-sm text-muted-foreground">
                          Draw tool — Draw zone on thermal image
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm">High temp threshold (°C/°F)</Label>
                          <Input type="number" placeholder="Alert above this temperature" className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-sm">Low temp threshold (°C/°F)</Label>
                          <Input type="number" placeholder="Alert below this temperature" className="mt-1" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch id="alert-threshold" />
                        <Label htmlFor="alert-threshold" className="text-sm cursor-pointer">
                          Alert on threshold breach
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Calibration */}
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Calibration</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Calibration type *</Label>
                        <RadioGroup defaultValue="auto" className="flex gap-4 mt-1">
                          {CALIBRATION_TYPES.map((type) => (
                            <label key={type} className="flex items-center gap-2 text-sm">
                              <RadioGroupItem value={type.toLowerCase()} />
                              {type}
                            </label>
                          ))}
                        </RadioGroup>
                      </div>
                      <div>
                        <Label className="text-sm">Ambient temperature (°C/°F)</Label>
                        <Input type="number" placeholder="Environmental temperature" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-sm">Measurement distance (meters)</Label>
                        <Input type="number" placeholder="Distance to target" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-sm">Emissivity value (0.0-1.0)</Label>
                        <div className="mt-1 flex items-center gap-2">
                          <Slider
                            value={[emissivity]}
                            onValueChange={(v) => setEmissivity(v[0])}
                            min={0}
                            max={1}
                            step={0.01}
                            className="flex-1"
                          />
                          <span className="text-sm w-16 text-right">{emissivity.toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Default: 0.96</p>
                      </div>
                      <div>
                        <Label className="text-sm">Humidity % (0-100)</Label>
                        <Input type="number" min={0} max={100} placeholder="Humidity compensation" className="mt-1" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Fever Detection */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Fever Detection
                </CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-6">
                  {/* Fever Screening */}
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Fever Screening</h4>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Switch id="enable-fever" defaultChecked />
                        <Label htmlFor="enable-fever" className="text-sm cursor-pointer">
                          Enable fever detection *
                        </Label>
                      </div>
                      <div>
                        <Label className="text-sm">Fever threshold (°C) *</Label>
                        <div className="mt-1 flex items-center gap-2">
                          <Slider
                            value={[feverThreshold]}
                            onValueChange={(v) => setFeverThreshold(v[0])}
                            min={36}
                            max={42}
                            step={0.1}
                            className="flex-1"
                          />
                          <span className="text-sm w-16 text-right">{feverThreshold.toFixed(1)}°C</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Default: 37.5°C. Temperature above = fever alert</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch id="require-face" />
                        <Label htmlFor="require-face" className="text-sm cursor-pointer">
                          Require face detection (only screen detected faces)
                        </Label>
                      </div>
                      <div>
                        <Label className="text-sm">Forehead ROI offset (px)</Label>
                        <Input type="number" placeholder="Adjust forehead region offset" className="mt-1 w-32" />
                      </div>
                      <div>
                        <Label className="text-sm">Screening mode *</Label>
                        <RadioGroup defaultValue="kiosk" className="flex gap-4 mt-1">
                          {SCREENING_MODES.map((mode) => (
                            <label key={mode} className="flex items-center gap-2 text-sm">
                              <RadioGroupItem value={mode.toLowerCase().replace("-", "")} />
                              {mode}
                            </label>
                          ))}
                        </RadioGroup>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch id="display-result" />
                        <Label htmlFor="display-result" className="text-sm cursor-pointer">
                          Display result on screen (show Normal/Fever on display)
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch id="combine-face-rec" />
                        <Label htmlFor="combine-face-rec" className="text-sm cursor-pointer">
                          Combine with face recognition (ID person if fever detected)
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Access Integration */}
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Access Integration</h4>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Switch id="deny-access" />
                        <Label htmlFor="deny-access" className="text-sm cursor-pointer">
                          Deny access on fever (block door if fever detected)
                        </Label>
                      </div>
                      <div>
                        <Label className="text-sm">Notification recipient (Email/Phone)</Label>
                        <Input placeholder="Who to notify on fever" className="mt-1" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Fire Detection */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Flame className="h-4 w-4" />
                  Fire Detection
                </CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-6">
                  {/* Hot Spot Monitoring */}
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Hot Spot Monitoring</h4>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Switch id="enable-hotspot" defaultChecked />
                        <Label htmlFor="enable-hotspot" className="text-sm cursor-pointer">
                          Enable hot spot detection *
                        </Label>
                      </div>
                      <div>
                        <Label className="text-sm">Hot spot temp threshold (°C/°F) *</Label>
                        <div className="mt-1 flex items-center gap-2">
                          <Slider
                            value={[hotSpotThreshold]}
                            onValueChange={(v) => setHotSpotThreshold(v[0])}
                            min={50}
                            max={150}
                            step={1}
                            className="flex-1"
                          />
                          <span className="text-sm w-16 text-right">{hotSpotThreshold}°C</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Default: 70°C. Temperature above - fire risk</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch id="spreading-detection" />
                        <Label htmlFor="spreading-detection" className="text-sm cursor-pointer">
                          Spreading detection (alert if hot spot grows)
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Emergency Protocol */}
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Emergency Protocol</h4>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Switch id="auto-fire-alarm" />
                        <Label htmlFor="auto-fire-alarm" className="text-sm cursor-pointer">
                          Auto trigger fire alarm (activate fire alarm system)
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground">Developer Notes: Requires integration</p>
                      <div>
                        <Label className="text-sm">Emergency contact (Phone/Email)</Label>
                        <Input placeholder="Who to call on fire detection" className="mt-1" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Equipment Monitoring */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Equipment Monitoring
                </CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-6">
                  {/* Electrical Equipment */}
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Electrical Equipment</h4>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm">Equipment name *</Label>
                        <Input placeholder="Name of monitored equipment" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-sm">Max operating temp (°C/°F) *</Label>
                        <Input type="number" placeholder="Alert if exceeded" className="mt-1" />
                      </div>
                    </div>
                  </div>

                  {/* Mechanical Equipment */}
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Mechanical Equipment</h4>
                    <div>
                      <Label className="text-sm">Maintenance alert temp (°C/°F) *</Label>
                      <Input type="number" placeholder="Predictive maintenance threshold" className="mt-1" />
                    </div>
                  </div>

                  {/* Maintenance Alerts */}
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Maintenance Alerts</h4>
                    <div>
                      <Label className="text-sm">Alert frequency</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="How often to repeat alerts" />
                        </SelectTrigger>
                        <SelectContent>
                          {ALERT_FREQUENCY.map((freq) => (
                            <SelectItem key={freq} value={freq.toLowerCase()}>
                              {freq}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Thermal Analytics */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Thermal Analytics
                </CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-6">
                  {/* Temperature Trends */}
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Temperature Trends</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Report period *</Label>
                        <div className="mt-1 flex items-center gap-2">
                          <Input type="date" className="flex-1" />
                          <span className="text-sm text-muted-foreground">to</span>
                          <Input type="date" className="flex-1" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm">Zone selection *</Label>
                        <Select>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Zones to include in trend" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Zones</SelectItem>
                            <SelectItem value="zone1">Zone 1</SelectItem>
                            <SelectItem value="zone2">Zone 2</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm">Chart type</Label>
                        <RadioGroup defaultValue="line" className="flex gap-4 mt-1">
                          {CHART_TYPES.map((type) => (
                            <label key={type} className="flex items-center gap-2 text-sm">
                              <RadioGroupItem value={type.toLowerCase()} />
                              {type}
                            </label>
                          ))}
                        </RadioGroup>
                      </div>
                    </div>
                    <div className="h-48 rounded border border-dashed border-border bg-muted/20 flex items-center justify-center text-sm text-muted-foreground">
                      Chart placeholder — Temperature trend visualization
                    </div>
                  </div>

                  {/* Anomaly Detection */}
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Anomaly Detection</h4>
                    <div>
                      <Label className="text-sm">Anomaly sensitivity</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="AI sensitivity for anomalies" />
                        </SelectTrigger>
                        <SelectContent>
                          {ANOMALY_SENSITIVITY.map((sens) => (
                            <SelectItem key={sens} value={sens.toLowerCase()}>
                              {sens}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Predictive Maintenance */}
                  <div className="border-l-2 border-primary/30 pl-4 space-y-4">
                    <h4 className="font-medium text-sm">Predictive Maintenance</h4>
                    <div>
                      <Label className="text-sm">Trend threshold days</Label>
                      <Input type="number" placeholder="Days of trend before alerting" className="mt-1 w-32" />
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Temperature Logs */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Temperature Logs
                </CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Log date range *</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Input type="date" className="flex-1" />
                        <span className="text-sm text-muted-foreground">to</span>
                        <Input type="date" className="flex-1" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">Zone filter</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Filter by zone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Zones</SelectItem>
                          <SelectItem value="zone1">Zone 1</SelectItem>
                          <SelectItem value="zone2">Zone 2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Temperature range filter (min)</Label>
                      <Input type="number" placeholder="Min temp" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">Temperature range filter (max)</Label>
                      <Input type="number" placeholder="Max temp" className="mt-1" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline">Export Logs (CSV)</Button>
                    <Button variant="outline">Export Logs (PDF)</Button>
                  </div>
                  <div className="rounded border border-border bg-muted/20 p-4">
                    <div className="text-sm font-medium mb-2">Temperature Log Table</div>
                    <div className="text-xs text-muted-foreground">Log entries will appear here after filtering</div>
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
