"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Bell } from "lucide-react"

const SEVERITIES = ["Critical", "High", "Medium", "Low"]

export function DashboardAlertFeed() {
  const [maxAlerts, setMaxAlerts] = useState(20)
  const [playSound, setPlaySound] = useState(false)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Alert Feed
        </CardTitle>
        <div className="flex flex-wrap gap-4 pt-2">
          <div>
            <Label className="text-xs text-muted-foreground">Severity</Label>
            <div className="flex gap-2 mt-1">
              {SEVERITIES.map((s) => (
                <label key={s} className="flex items-center gap-1.5 text-sm">
                  <Checkbox />
                  {s}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Max alerts</Label>
            <Input type="number" min={10} max={100} value={maxAlerts} onChange={(e) => setMaxAlerts(Number(e.target.value) || 20)} className="w-20 h-8 mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Refresh</Label>
            <Select defaultValue="10">
              <SelectTrigger className="w-24 h-8 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5s</SelectItem>
                <SelectItem value="10">10s</SelectItem>
                <SelectItem value="30">30s</SelectItem>
                <SelectItem value="60">60s</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="alert-sound" checked={playSound} onCheckedChange={setPlaySound} />
            <Label htmlFor="alert-sound" className="text-xs">Play sound</Label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 max-h-[220px] overflow-y-auto">
          <li className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="destructive">Critical</Badge>
              <span className="text-muted-foreground">Fire</span>
              <span>Warehouse-2</span>
            </div>
            <span className="text-muted-foreground text-xs">8 min ago</span>
          </li>
          <li className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">High</Badge>
              <span className="text-muted-foreground">Intrusion</span>
              <span>Gate-01</span>
            </div>
            <span className="text-muted-foreground text-xs">2 min ago</span>
          </li>
          <li className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Medium</Badge>
              <span className="text-muted-foreground">Motion</span>
              <span>Parking-A</span>
            </div>
            <span className="text-muted-foreground text-xs">5 min ago</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  )
}
