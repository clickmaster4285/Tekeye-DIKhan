"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Map, Video } from "lucide-react"

export function DashboardMapView() {
  const [mapType, setMapType] = useState("street")
  const [showCameras, setShowCameras] = useState(true)
  const [showAlerts, setShowAlerts] = useState(true)
  const [showCoverage, setShowCoverage] = useState(false)
  const [showZones, setShowZones] = useState(false)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Map className="h-4 w-4" />
          Map View
        </CardTitle>
        <div className="flex flex-wrap gap-4 pt-2">
          <div>
            <Label className="text-xs text-muted-foreground">Map type</Label>
            <Select value={mapType} onValueChange={setMapType}>
              <SelectTrigger className="w-28 h-8 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="satellite">Satellite</SelectItem>
                <SelectItem value="street">Street</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="map-cameras" checked={showCameras} onCheckedChange={setShowCameras} />
            <Label htmlFor="map-cameras" className="text-xs">Camera markers</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="map-alerts" checked={showAlerts} onCheckedChange={setShowAlerts} />
            <Label htmlFor="map-alerts" className="text-xs">Alert markers</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="map-coverage" checked={showCoverage} onCheckedChange={setShowCoverage} />
            <Label htmlFor="map-coverage" className="text-xs">Coverage overlay</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="map-zones" checked={showZones} onCheckedChange={setShowZones} />
            <Label htmlFor="map-zones" className="text-xs">Zone boundaries</Label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="aspect-video rounded-lg border border-border bg-muted/30 flex items-center justify-center text-muted-foreground text-sm">
          Map placeholder ({mapType})
        </div>
        <div>
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
            <Video className="h-3.5 w-3.5" /> Live feed (same stream everywhere)
          </Label>
          <div className="aspect-video rounded-lg border border-border overflow-hidden max-h-40 bg-muted flex items-center justify-center text-muted-foreground text-sm">
            Live feed
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
