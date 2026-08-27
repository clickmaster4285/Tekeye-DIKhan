"use client"

import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Monitor } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MlCameraFeed } from "@/components/cameras/ml-camera-feed"
import { useCameras } from "@/hooks/use-cameras"
import { ROUTES } from "@/routes/config"

const LAYOUTS = ["1x1", "2x2", "3x3", "4x4"] as const

function layoutCount(layout: string): number {
  if (layout === "1x1") return 1
  if (layout === "3x3") return 9
  if (layout === "4x4") return 16
  return 4
}

export function DashboardLiveCameraGrid() {
  const [layout, setLayout] = useState<string>("2x2")
  const [showOverlays, setShowOverlays] = useState(true)
  const { cameras, loading } = useCameras({ activeOnly: true, onlineOnly: true })

  const feeds = useMemo(() => cameras.slice(0, layoutCount(layout)), [cameras, layout])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Monitor className="h-4 w-4" />
          Live Camera Grid
        </CardTitle>
        <div className="flex flex-wrap items-end gap-4 pt-2">
          <div>
            <Label className="text-xs text-muted-foreground">Grid layout</Label>
            <Select value={layout} onValueChange={setLayout}>
              <SelectTrigger className="w-24 h-8 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAYOUTS.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ai-overlays" checked={showOverlays} onCheckedChange={setShowOverlays} />
            <Label htmlFor="ai-overlays" className="text-xs">ML overlays</Label>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.CAMERA_MANAGEMENT}>Manage cameras</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading cameras…</p>
        ) : feeds.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            No cameras connected.{" "}
            <Link to={ROUTES.CAMERA_MANAGEMENT} className="text-[#3b82f6] underline">
              Add cameras
            </Link>
          </div>
        ) : (
          <div
            className={`grid gap-2 ${
              layout === "1x1" ? "grid-cols-1" :
              layout === "3x3" ? "grid-cols-3" :
              layout === "4x4" ? "grid-cols-4" : "grid-cols-2"
            }`}
          >
            {feeds.map((cam) => (
              <MlCameraFeed
                key={cam.id}
                camera={cam}
                pollMl={false}
                pollIntervalMs={800}
                showBrandLogo
                showFullscreenButton
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
