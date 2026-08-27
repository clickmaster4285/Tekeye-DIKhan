import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Camera, Clock3, MapPin } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ROUTES } from "@/routes/config"
import { TrackingCaptureThumb } from "@/components/object-tracking/tracking-capture-thumb"
import {
  fetchTrackedObjectDetail,
  formatDuration,
  objectTypeLabel,
} from "@/lib/object-tracking-api"

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    return iso
  }
}

export default function ObjectTrackingDetailPage() {
  const { uuid = "" } = useParams()

  const detailQuery = useQuery({
    queryKey: ["object-tracking-detail", uuid],
    queryFn: () => fetchTrackedObjectDetail(uuid),
    enabled: Boolean(uuid),
    refetchInterval: 8000,
  })

  const obj = detailQuery.data
  const visits = obj?.visits ?? []
  const tracks = obj?.tracks ?? []

  return (
    <ModulePageLayout
      title={obj?.code || "Object detail"}
      description="Global identity timeline with visits, tracks, entry/exit and duration."
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.OBJECT_TRACKING}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      }
    >
      {detailQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : detailQuery.isError || !obj ? (
        <p className="text-sm text-destructive">Could not load this tracked object.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Identity</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  {obj.code}
                  <Badge variant="secondary">{objectTypeLabel(obj.object_type)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm capitalize">{obj.class_name || obj.label || "—"}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Presence</CardDescription>
                <CardTitle className="text-2xl">{obj.is_present ? "Present" : "Exited"}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground flex items-center gap-2">
                <Camera className="h-4 w-4" />
                {obj.latest_camera_name || "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>First / last seen</CardDescription>
                <CardTitle className="text-base">{formatDateTime(obj.first_seen_at)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Last {formatDateTime(obj.last_seen_at)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Current visit duration</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Clock3 className="h-5 w-5" />
                  {obj.is_present
                    ? formatDuration(
                        Math.max(0, (Date.now() - new Date(obj.entry_at).getTime()) / 1000),
                      )
                    : formatDuration(obj.duration_seconds)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Visits: {visits.length}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Primary capture</CardTitle>
              <CardDescription>First saved snapshot for this global identity</CardDescription>
            </CardHeader>
            <CardContent>
              <TrackingCaptureThumb
                url={obj.snapshot_url}
                alt={obj.code}
                size="lg"
                className="h-56 w-full max-w-xl rounded-md border object-contain bg-muted/30"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visit timeline</CardTitle>
              <CardDescription>
                Each leave/return creates a new visit with its own entry, exit, duration and capture.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Capture</TableHead>
                    <TableHead>#</TableHead>
                    <TableHead>Camera</TableHead>
                    <TableHead>Local track</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Last seen</TableHead>
                    <TableHead>Exit</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        No visits yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visits.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <TrackingCaptureThumb url={v.snapshot_url} alt={`${obj.code} visit ${v.id}`} size="sm" />
                        </TableCell>
                        <TableCell>{v.id}</TableCell>
                        <TableCell>{v.camera_name || "—"}</TableCell>
                        <TableCell>#{v.local_track_id ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDateTime(v.entry_at)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDateTime(v.last_seen_at)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDateTime(v.exit_at)}</TableCell>
                        <TableCell>
                          {v.status === "active"
                            ? formatDuration(
                                Math.max(0, (Date.now() - new Date(v.entry_at).getTime()) / 1000),
                              )
                            : formatDuration(v.duration_seconds)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={v.status === "active" ? "default" : "outline"}>
                            {v.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">ByteTrack sessions</CardTitle>
              <CardDescription>Local track IDs linked to this global identity</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Track ID</TableHead>
                    <TableHead>Camera</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Ended</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tracks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No track sessions.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tracks.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>#{t.local_track_id}</TableCell>
                        <TableCell>{t.camera_name || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDateTime(t.started_at)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDateTime(t.ended_at)}</TableCell>
                        <TableCell>
                          <Badge variant={t.status === "active" ? "default" : "outline"}>
                            {t.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Camera history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(obj.camera_history || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No camera history yet.</p>
              ) : (
                (obj.camera_history || []).slice().reverse().map((row, idx) => (
                  <div key={`${row.camera_id}-${row.at}-${idx}`} className="text-sm flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    Camera #{row.camera_id} · {formatDateTime(row.at)}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </ModulePageLayout>
  )
}
