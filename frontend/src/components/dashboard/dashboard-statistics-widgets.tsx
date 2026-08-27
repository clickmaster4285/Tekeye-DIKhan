"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Users, Truck, AlertTriangle, Camera, ShieldAlert } from "lucide-react"

export function DashboardStatisticsWidgets() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Statistics</CardTitle>
          <Select defaultValue="week">
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <Label className="text-xs">People Detected</Label>
          </div>
          <p className="text-2xl font-semibold text-foreground mt-1">1,247</p>
          <p className="text-xs text-muted-foreground mt-0.5">In selected range</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Truck className="h-4 w-4" />
            <Label className="text-xs">Vehicles Detected</Label>
          </div>
          <p className="text-2xl font-semibold text-foreground mt-1">382</p>
          <p className="text-xs text-muted-foreground mt-0.5">In selected range</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Camera className="h-4 w-4" />
            <Label className="text-xs">Face Matches Today</Label>
          </div>
          <p className="text-2xl font-semibold text-foreground mt-1">89</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            <Label className="text-xs">Blacklist Encounters</Label>
          </div>
          <p className="text-2xl font-semibold text-red-600 mt-1">2</p>
        </div>
      </CardContent>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-48 rounded-lg border border-dashed border-border bg-muted/20 flex items-center justify-center text-sm text-muted-foreground">
            Alerts by Type (Bar Chart)
          </div>
          <div className="h-48 rounded-lg border border-dashed border-border bg-muted/20 flex items-center justify-center text-sm text-muted-foreground">
            Hourly Activity Heat Map
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
