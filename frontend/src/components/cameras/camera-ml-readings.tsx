import { useState } from "react"
import { Activity, AlertTriangle, Scan } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CameraRecord } from "@/lib/cameras-api"

export type MlReading = {
  label: string
  confidence: number
  bbox: [number, number, number, number]
  alert?: boolean
}

type CameraMlReadingsProps = {
  camera: CameraRecord
  readings: MlReading[]
  lastScanAt: Date | null
  scanning: boolean
  error: string | null
}

export function CameraMlReadings({
  camera,
  readings,
  lastScanAt,
  scanning,
  error,
}: CameraMlReadingsProps) {
  const alertCount = readings.filter((r) => r.alert).length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#3b82f6]" />
            Model status
          </CardTitle>
          <CardDescription>Live inference for this camera.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">ML active</Badge>
            {scanning && <Badge variant="outline">Scanning…</Badge>}
          </div>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-muted-foreground">Detections</dt>
              <dd className="font-semibold text-lg">{readings.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Alerts</dt>
              <dd className="font-semibold text-lg text-amber-600">{alertCount}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Last scan</dt>
              <dd>{lastScanAt ? lastScanAt.toLocaleTimeString() : "—"}</dd>
            </div>
          </dl>
          {error && (
            <p className="text-xs text-amber-600 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 dark:bg-amber-950/30">
              {error}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Staff face vectors are loaded from the database when photos are saved.
            Run <code className="text-[11px]">python manage.py sync_staff_faces</code> to rebuild embeddings if needed.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Scan className="h-4 w-4" />
            Current readings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {readings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Waiting for model scan…
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Alert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readings.map((r, i) => (
                    <TableRow key={`${r.label}-${i}`}>
                      <TableCell className="font-medium">
                        {r.label === "unknown" ? (
                          <Badge variant="outline" className="text-amber-700 border-amber-300">
                            unknown
                          </Badge>
                        ) : (
                          r.label
                        )}
                      </TableCell>
                      <TableCell>{(r.confidence * 100).toFixed(0)}%</TableCell>
                      <TableCell>
                        {r.alert ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Yes
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function useMlReadingsState() {
  const [readings, setReadings] = useState<MlReading[]>([])
  const [lastScanAt, setLastScanAt] = useState<Date | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDetections = (boxes: MlReading[]) => {
    setReadings(boxes)
    setLastScanAt(new Date())
    setScanning(false)
    setError(null)
  }

  const onScanStart = () => setScanning(true)
  const onScanError = (msg: string) => {
    setScanning(false)
    setError(msg)
  }

  return { readings, lastScanAt, scanning, error, onDetections, onScanStart, onScanError }
}
