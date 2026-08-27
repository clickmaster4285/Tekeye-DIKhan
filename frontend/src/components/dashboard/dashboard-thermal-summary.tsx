"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Thermometer, Flame, AlertCircle } from "lucide-react"

export function DashboardThermalSummary() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Thermometer className="h-4 w-4" />
          Thermal Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border p-3">
            <Label className="text-xs text-muted-foreground">Highest temp camera</Label>
            <p className="text-sm font-medium text-foreground mt-0.5">Warehouse-2 (38.2°C)</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <Label className="text-xs text-muted-foreground">Fever detections today</Label>
            <p className="text-xl font-semibold text-foreground mt-0.5">0</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <Label className="text-xs text-muted-foreground">Fire alerts active</Label>
            <p className="text-xl font-semibold text-foreground mt-0.5">1</p>
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Temperature range filter (°C)</Label>
          <Slider defaultValue={[30]} min={20} max={50} step={1} className="mt-2" />
        </div>
      </CardContent>
    </Card>
  )
}
