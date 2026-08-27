"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { Thermometer, Palette, Gauge } from "lucide-react"

const COLOR_PALETTES = ["Ironbow", "Rainbow", "White-Hot", "Black-Hot"]
const MOCK_THERMAL_CAMERAS = [
  { id: "THERM-01", name: "Gate Thermal", location: "Main Gate", minTemp: 18.5, maxTemp: 32.1 },
  { id: "THERM-02", name: "Entrance Thermal", location: "Building A", minTemp: 19.2, maxTemp: 28.7 },
  { id: "THERM-03", name: "Warehouse Thermal", location: "Warehouse", minTemp: 20.1, maxTemp: 35.4 },
]

export function ThermalVideoGrid() {
  const [selectedCamera, setSelectedCamera] = useState<string>(MOCK_THERMAL_CAMERAS[0].id)
  const [colorPalette, setColorPalette] = useState<string>("Ironbow")
  const [tempScale, setTempScale] = useState<"celsius" | "fahrenheit">("celsius")
  const [gridLayout, setGridLayout] = useState<string>("2x2")

  const currentCamera = MOCK_THERMAL_CAMERAS.find((c) => c.id === selectedCamera)
  const displayMin = currentCamera ? (tempScale === "celsius" ? currentCamera.minTemp : (currentCamera.minTemp * 9/5 + 32)) : 0
  const displayMax = currentCamera ? (tempScale === "celsius" ? currentCamera.maxTemp : (currentCamera.maxTemp * 9/5 + 32)) : 0
  const tempUnit = tempScale === "celsius" ? "°C" : "°F"

  const gridCols = gridLayout === "1x1" ? "grid-cols-1" : gridLayout === "2x2" ? "grid-cols-2" : gridLayout === "3x3" ? "grid-cols-3" : "grid-cols-4"
  const gridRows = gridLayout === "1x1" ? 1 : gridLayout === "2x2" ? 2 : gridLayout === "3x3" ? 3 : 4

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Thermometer className="h-4 w-4" />
          Thermal Video Grid
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-sm">Assign thermal camera *</Label>
            <Select value={selectedCamera} onValueChange={setSelectedCamera}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOCK_THERMAL_CAMERAS.map((cam) => (
                  <SelectItem key={cam.id} value={cam.id}>
                    {cam.name} — {cam.location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">Color palette</Label>
            <Select value={colorPalette} onValueChange={setColorPalette}>
              <SelectTrigger className="mt-1">
                <SelectValue />
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
            <RadioGroup value={tempScale} onValueChange={(v) => setTempScale(v as "celsius" | "fahrenheit")} className="flex gap-4 mt-1">
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-sm">Grid layout</Label>
            <Select value={gridLayout} onValueChange={setGridLayout}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1x1">1x1</SelectItem>
                <SelectItem value="2x2">2x2</SelectItem>
                <SelectItem value="3x3">3x3</SelectItem>
                <SelectItem value="4x4">4x4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-sm">Min temp display (auto)</Label>
              <div className="mt-1 px-3 py-2 rounded border border-border bg-muted/30 text-sm font-medium flex items-center gap-2">
                <Gauge className="h-4 w-4 text-blue-500" />
                {displayMin.toFixed(1)}{tempUnit}
              </div>
            </div>
            <div className="flex-1">
              <Label className="text-sm">Max temp display (auto)</Label>
              <div className="mt-1 px-3 py-2 rounded border border-border bg-muted/30 text-sm font-medium flex items-center gap-2">
                <Gauge className="h-4 w-4 text-red-500" />
                {displayMax.toFixed(1)}{tempUnit}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-black/90 p-2">
          <div className={`grid ${gridCols} gap-2`}>
            {Array.from({ length: gridRows * (gridLayout === "1x1" ? 1 : gridLayout === "2x2" ? 2 : gridLayout === "3x3" ? 3 : 4) }).map((_, i) => {
              const cam = MOCK_THERMAL_CAMERAS[i % MOCK_THERMAL_CAMERAS.length]
              const useLiveFeed = i === 0
              return (
                <div
                  key={i}
                  className="relative aspect-video rounded border border-muted-foreground/30 overflow-hidden bg-black flex flex-col items-center justify-center"
                  style={!useLiveFeed ? {
                    background: colorPalette === "Ironbow"
                      ? "linear-gradient(to bottom right, #000080, #0000FF, #00FFFF, #FFFF00, #FF8000, #FF0000)"
                      : colorPalette === "Rainbow"
                      ? "linear-gradient(to bottom right, #8B00FF, #4B0082, #0000FF, #00FF00, #FFFF00, #FF7F00, #FF0000)"
                      : colorPalette === "White-Hot"
                      ? "linear-gradient(to bottom right, #000000, #333333, #666666, #999999, #CCCCCC, #FFFFFF)"
                      : "linear-gradient(to bottom right, #FFFFFF, #CCCCCC, #999999, #666666, #333333, #000000)"
                  } : undefined}
                >
                  {useLiveFeed ? (
                    <div className="absolute inset-0 w-full h-full flex items-center justify-center text-white/60 text-sm">
                      Live feed
                    </div>
                  ) : null}
                  <div className="absolute top-1 left-1 flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs bg-black/50 text-white">
                      {cam.name}
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-black/50 text-white border-white/30">
                      {colorPalette}
                    </Badge>
                  </div>
                  <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between text-xs">
                    <span className="bg-black/50 px-1.5 py-0.5 rounded text-white">
                      Min: {tempScale === "celsius" ? cam.minTemp : (cam.minTemp * 9/5 + 32).toFixed(1)}{tempUnit}
                    </span>
                    <span className="bg-black/50 px-1.5 py-0.5 rounded text-white">
                      Max: {tempScale === "celsius" ? cam.maxTemp : (cam.maxTemp * 9/5 + 32).toFixed(1)}{tempUnit}
                    </span>
                  </div>
                  {!useLiveFeed && <div className="text-xs text-white/60">Thermal Feed {i + 1}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
