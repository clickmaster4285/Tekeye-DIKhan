import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  Camera,
  Car,
  ChevronLeft,
  Clock,
  MapPin,
  Route,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ROUTES } from "@/routes/config"
import {
  fetchVehicleJourney,
  resolveMediaUrl,
  type VehicleJourneySighting,
} from "@/lib/cameras-api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10) || "Unknown"
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
}

function SightingThumb({ src, alt, onClick }: { src: string; alt: string; onClick?: () => void }) {
  const url = resolveMediaUrl(src)
  if (!url) return <div className="h-24 w-40 rounded border bg-muted shrink-0" />
  return (
    <button type="button" onClick={onClick} className="block shrink-0 overflow-hidden rounded border bg-muted">
      <img src={url} alt={alt} className="h-24 w-40 object-cover" />
    </button>
  )
}

function TimelineItem({
  stop,
  onPreview,
}: {
  stop: VehicleJourneySighting
  onPreview: (s: VehicleJourneySighting) => void
}) {
  return (
    <div className="flex gap-4 pb-6 last:pb-0">
      <div className="flex flex-col items-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border bg-muted">
          <Camera className="h-4 w-4" />
        </div>
        <div className="mt-2 min-h-[24px] w-px flex-1 bg-border" />
      </div>
      <div className="flex flex-1 flex-col gap-3 pt-0.5 sm:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{stop.camera_name || stop.camera_key || "Camera"}</p>
            <Badge variant="outline" className="text-[10px]">
              Pass {stop.index}
            </Badge>
          </div>
          <p className="mt-0.5 font-mono text-sm tracking-wide">{stop.plate_number}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDateTime(stop.timestamp)}
            </span>
            {stop.location || stop.zone ? (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {stop.zone || stop.location}
              </span>
            ) : null}
            <span>
              det {(Number(stop.det_conf) * 100).toFixed(0)}% · ocr {(Number(stop.ocr_conf) * 100).toFixed(0)}%
            </span>
          </div>
        </div>
        <SightingThumb src={stop.plate_image || stop.frame_image} alt={stop.plate_number} onClick={() => onPreview(stop)} />
      </div>
    </div>
  )
}

export default function VehicleJourneyDetailPage() {
  const { plateKey } = useParams<{ plateKey: string }>()
  const [preview, setPreview] = useState<VehicleJourneySighting | null>(null)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["vehicle-journey", plateKey],
    queryFn: () => fetchVehicleJourney(plateKey!),
    enabled: !!plateKey,
    refetchInterval: 15_000,
  })

  const path = data?.path ?? []
  const groupedByDate = useMemo(() => {
    const map = new Map<string, VehicleJourneySighting[]>()
    for (const stop of path) {
      const day = (stop.timestamp || "").slice(0, 10) || "unknown"
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(stop)
    }
    return Array.from(map.entries())
  }, [path])

  if (isLoading) {
    return (
      <ModulePageLayout title="Vehicle Journey" description="Loading timeline...">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </ModulePageLayout>
    )
  }

  if (isError || !data) {
    return (
      <ModulePageLayout title="Vehicle Journey" description="Journey not found">
        <p className="mb-4 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "No journey found for this plate."}
        </p>
        <Button asChild variant="outline">
          <Link to={ROUTES.VEHICLE_JOURNEY}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
      </ModulePageLayout>
    )
  }

  return (
    <ModulePageLayout
      title={data.plate_number}
      description={`Vehicle journey — ${data.pass_count} ${data.pass_count === 1 ? "pass" : "passes"} across ${data.camera_count} ${data.camera_count === 1 ? "camera" : "cameras"}`}
      breadcrumbs={[
        { label: "AI Computer Vision" },
        { label: "Vehicle Journey", href: ROUTES.VEHICLE_JOURNEY },
        { label: data.plate_number },
      ]}
    >
      <div className="space-y-6">
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.VEHICLE_JOURNEY}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            All journeys
          </Link>
        </Button>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex gap-4">
                {data.plate_image ? (
                  <img
                    src={resolveMediaUrl(data.plate_image)}
                    alt={data.plate_number}
                    className="h-20 w-36 rounded-lg border object-cover bg-muted"
                  />
                ) : (
                  <div className="flex h-20 w-36 items-center justify-center rounded-lg border bg-muted">
                    <Car className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-semibold tracking-wide">
                    <Route className="h-5 w-5" />
                    {data.plate_number}
                  </h2>
                  <p className="mt-1 font-mono text-sm text-muted-foreground">{data.plate_key}</p>
                  {data.ocr_variants.length > 1 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      OCR variants: {data.ocr_variants.join(", ")}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>
                  {data.pass_count} {data.pass_count === 1 ? "pass" : "passes"}
                </Badge>
                <Badge variant="outline">{data.sighting_count} reads</Badge>
              </div>
            </div>
            <div className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground">First seen</p>
                <p className="font-medium">{data.first_camera || "—"}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(data.first_seen)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last seen</p>
                <p className="font-medium">{data.last_camera || "—"}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(data.last_seen)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Route</p>
                <p className="font-medium">{data.route?.join(" → ") || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {data.cameras.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Cameras on this journey
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.cameras.map((cam) => (
                  <Badge key={cam.camera_key} variant="secondary" className="gap-1">
                    {cam.camera_name || cam.camera_key}
                    {cam.location ? <span className="font-normal text-muted-foreground">· {cam.location}</span> : null}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Journey timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {groupedByDate.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sightings recorded for this plate.</p>
            ) : (
              <div className="space-y-8">
                {groupedByDate.map(([day, stops]) => (
                  <div key={day}>
                    <p className="mb-4 text-sm font-medium text-muted-foreground">{dayLabel(stops[0]?.timestamp || day)}</p>
                    {stops.map((stop) => (
                      <TimelineItem key={`${stop.camera_key}-${stop.timestamp}-${stop.index}`} stop={stop} onPreview={setPreview} />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[92vh] w-[min(96vw,88rem)] max-w-none overflow-y-auto sm:max-w-[88rem]">
          <DialogHeader>
            <DialogTitle className="pr-8 text-xl">
              {preview?.plate_number} · {preview?.camera_name || preview?.camera_key}
            </DialogTitle>
          </DialogHeader>
          {preview ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm text-muted-foreground">Plate crop</p>
                <img
                  src={resolveMediaUrl(preview.plate_image)}
                  alt="plate"
                  className="max-h-[70vh] w-full rounded-lg border bg-black object-contain"
                />
              </div>
              <div>
                <p className="mb-2 text-sm text-muted-foreground">Full frame</p>
                <img
                  src={resolveMediaUrl(preview.frame_image)}
                  alt="frame"
                  className="max-h-[70vh] w-full rounded-lg border bg-black object-contain"
                />
              </div>
              <p className="text-sm text-muted-foreground lg:col-span-2">
                {formatDateTime(preview.timestamp)} · {preview.camera_name || preview.camera_key}
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}
