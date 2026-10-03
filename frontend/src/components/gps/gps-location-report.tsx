import { FileDown, MapPin } from "lucide-react"
import { GpsMiniMap } from "@/components/gps/gps-mini-map"
import { StaffAvatar } from "@/components/hr/staff-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { GpsClosestPoint, GpsHistoryPoint, GpsOfficer, GpsReportPeriod } from "@/lib/gps-tracking-api"
import { resolveLocationName } from "@/lib/gps-geofences"
import {
  formatClock,
  formatClockWithSeconds,
  formatReportDate,
  getMonthRange,
  getWeekRange,
  gpsPeriodLabel,
  mapsLinkForCoords,
  trailDistanceKm,
} from "@/lib/gps-utils"
import { cn } from "@/lib/utils"

type GpsLocationReportProps = {
  officer: GpsOfficer | null
  reportDate: string
  reportPeriod: GpsReportPeriod
  lookupTime: string
  onReportDateChange: (value: string) => void
  onReportPeriodChange: (value: GpsReportPeriod) => void
  onLookupTimeChange: (value: string) => void
  points: GpsHistoryPoint[]
  closest: GpsClosestPoint | null
  /** Exact reverse-geocoded names keyed by rounded lat,lng */
  locationNames?: Record<string, string>
  locationNamesLoading?: boolean
  totalCount?: number
  sampled?: boolean
  loading?: boolean
  error?: string | null
  pdfExporting?: boolean
  onPrintPdf?: () => void
  onFocusPoint?: (lat: number, lng: number) => void
}

function periodRangeText(period: GpsReportPeriod, reportDate: string): string {
  if (period === "day") return formatReportDate(reportDate)
  if (period === "week") {
    const { start, end } = getWeekRange(reportDate)
    return `${formatReportDate(start)} – ${formatReportDate(end)}`
  }
  const { start, end } = getMonthRange(reportDate)
  return `${formatReportDate(start)} – ${formatReportDate(end)}`
}

export function GpsLocationReport({
  officer,
  reportDate,
  reportPeriod,
  lookupTime,
  onReportDateChange,
  onReportPeriodChange,
  onLookupTimeChange,
  points,
  closest,
  locationNames,
  locationNamesLoading,
  totalCount,
  sampled,
  loading,
  error,
  pdfExporting,
  onPrintPdf,
  onFocusPoint,
}: GpsLocationReportProps) {
  const name = officer?.name ?? "—"
  const first = points[0]
  const last = points[points.length - 1]
  const distanceKm = trailDistanceKm(points)
  const showDateCol = reportPeriod !== "day"
  const trackingLabel =
    first && last
      ? `${formatClockWithSeconds(first.recordedAt)} – ${formatClockWithSeconds(last.recordedAt)}`
      : "No GPS points"
  const pointsLabel =
    sampled && totalCount != null && totalCount > points.length
      ? `${points.length} of ${totalCount} shown`
      : `${points.length} shown`

  return (
    <section className="rounded-xl border bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <StaffAvatar
            profileImage={officer?.profileImage}
            fullName={officer?.name}
            className="size-14 border"
            fallbackClassName="bg-[#EBF2FF] text-sm font-semibold text-[#155DFC]"
          />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold sm:text-lg">
              {name} — GPS Location Report
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {gpsPeriodLabel(reportPeriod, reportDate)}
            </p>
            <p className="text-sm text-muted-foreground">
              Employee: {name}
              {officer?.employeeId ? ` · ${officer.employeeId}` : ""}
            </p>
            <p className="text-sm text-muted-foreground">Period: {trackingLabel}</p>
          </div>
        </div>

        <div className="grid w-full max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Period</Label>
            <Select
              value={reportPeriod}
              onValueChange={(v) => onReportPeriodChange(v as GpsReportPeriod)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[2000]">
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="gps-report-date" className="text-xs text-muted-foreground">
              {reportPeriod === "month" ? "Month date" : reportPeriod === "week" ? "Week date" : "Report date"}
            </Label>
            <Input
              id="gps-report-date"
              type="date"
              value={reportDate}
              onChange={(e) => onReportDateChange(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gps-lookup-time" className="text-xs text-muted-foreground">
              Lookup time
            </Label>
            <Input
              id="gps-lookup-time"
              type="time"
              step={60}
              value={lookupTime}
              onChange={(e) => onLookupTimeChange(e.target.value)}
              className="h-9"
              disabled={reportPeriod !== "day"}
              title={reportPeriod !== "day" ? "Time lookup is available for day reports" : undefined}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Export</Label>
            <Button
              type="button"
              className="h-9 w-full"
              disabled={!officer || pdfExporting || loading}
              onClick={onPrintPdf}
            >
              <FileDown className="h-4 w-4" />
              {pdfExporting ? "Saving…" : "PDF"}
            </Button>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Range: {periodRangeText(reportPeriod, reportDate)}
      </p>

      {closest ? (
        <div className="mt-4 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-[#155DFC] text-white hover:bg-[#155DFC]">Closest fix</Badge>
            <p className="text-sm font-medium">
              Requested {formatClockWithSeconds(closest.requestedAt)} → reported{" "}
              {formatClockWithSeconds(closest.recordedAt)}
              {closest.deltaSeconds != null ? (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  (
                  {closest.deltaSeconds < 60
                    ? `±${closest.deltaSeconds}s`
                    : `±${Math.round(closest.deltaSeconds / 60)} min`}
                  )
                </span>
              ) : null}
            </p>
          </div>
          <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <div className="sm:col-span-1">
              <dt className="text-xs text-muted-foreground">Location</dt>
              <dd className="font-medium">
                {resolveLocationName(closest.latitude, closest.longitude, locationNames, {
                  loading: Boolean(locationNamesLoading) && locationNames == null,
                  pointLocationName: closest.locationName,
                })}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Map link</dt>
              <dd className="font-medium">
                <a
                  href={closest.mapsUrl || mapsLinkForCoords(closest.latitude, closest.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#155DFC] hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Open in Google Maps
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Accuracy</dt>
              <dd className="font-medium">
                {closest.accuracy != null ? `${Math.round(closest.accuracy)} m` : "—"}
                <span className="ml-2 text-muted-foreground">· {closest.status ?? "—"}</span>
              </dd>
            </div>
          </dl>
          {onFocusPoint ? (
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[#155DFC] hover:underline"
              onClick={() => onFocusPoint(closest.latitude, closest.longitude)}
            >
              <MapPin className="h-3.5 w-3.5" />
              Show on map
            </button>
          ) : null}
        </div>
      ) : lookupTime && reportPeriod === "day" && !loading ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No GPS point found near {lookupTime} on {formatReportDate(reportDate)}.
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                {showDateCol ? <th className="px-2 py-2 font-semibold">Date</th> : null}
                <th className="px-2 py-2 font-semibold">Time</th>
                <th className="px-2 py-2 font-semibold">Location</th>
                <th className="px-2 py-2 font-semibold">Map</th>
                <th className="px-2 py-2 font-semibold">Accuracy</th>
                <th className="px-2 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={showDateCol ? 6 : 5}
                    className="px-2 py-8 text-center text-muted-foreground"
                  >
                    Loading GPS points…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={showDateCol ? 6 : 5} className="px-2 py-8 text-center text-destructive">
                    {error}
                  </td>
                </tr>
              ) : points.length === 0 ? (
                <tr>
                  <td
                    colSpan={showDateCol ? 6 : 5}
                    className="px-2 py-8 text-center text-muted-foreground"
                  >
                    No GPS records for this employee in {periodRangeText(reportPeriod, reportDate)}.
                  </td>
                </tr>
              ) : (
                points.map((point) => {
                  const isClosest =
                    closest &&
                    point.recordedAt &&
                    closest.recordedAt &&
                    point.recordedAt === closest.recordedAt
                  const locationName = resolveLocationName(
                    point.latitude,
                    point.longitude,
                    locationNames,
                    {
                      loading: Boolean(locationNamesLoading) && locationNames == null && !point.locationName,
                      pointLocationName: point.locationName,
                    }
                  )
                  const stillResolving = locationName === "Looking up…"
                  const mapUrl = point.mapsUrl || mapsLinkForCoords(point.latitude, point.longitude)
                  return (
                    <tr
                      key={`${point.recordedAt}-${point.latitude}-${point.longitude}`}
                      className={cn(
                        "border-b last:border-0",
                        isClosest && "bg-[#EFF6FF]",
                        onFocusPoint && "cursor-pointer hover:bg-muted/50"
                      )}
                      onClick={() => onFocusPoint?.(point.latitude, point.longitude)}
                    >
                      {showDateCol ? (
                        <td className="whitespace-nowrap px-2 py-2">
                          {point.recordedAt
                            ? new Date(point.recordedAt).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                              })
                            : "—"}
                        </td>
                      ) : null}
                      <td className="whitespace-nowrap px-2 py-2 font-medium">
                        {formatClockWithSeconds(point.recordedAt)}
                      </td>
                      <td
                        className="max-w-[16rem] px-2 py-2"
                        title={stillResolving ? "Resolving place name…" : locationName}
                      >
                        {stillResolving ? (
                          <span className="text-muted-foreground">Looking up…</span>
                        ) : (
                          <span className="line-clamp-2 font-medium">{locationName}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">
                        <a
                          href={mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-[#155DFC] hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          Open map
                        </a>
                      </td>
                      <td className="px-2 py-2">
                        {point.accuracy != null ? `${Math.round(point.accuracy)} m` : "—"}
                      </td>
                      <td className="px-2 py-2">{point.status ?? "—"}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="min-w-0">
          <p className="mb-2 text-sm font-semibold">{name}&apos;s Route</p>
          <GpsMiniMap points={points} />
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{first ? formatClock(first.recordedAt) : "—"}</span>
            <span className="font-medium tracking-wide text-foreground">GPS ROUTE</span>
            <span>{last ? formatClock(last.recordedAt) : "—"}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg bg-[#F8FAFC] p-4">
        <h3 className="text-sm font-semibold">Summary</h3>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3 sm:block">
            <dt className="text-muted-foreground">Employee</dt>
            <dd className="font-medium">{name}</dd>
          </div>
          <div className="flex justify-between gap-3 sm:block">
            <dt className="text-muted-foreground">GPS tracking</dt>
            <dd className="font-medium">
              {first && last
                ? `${formatClock(first.recordedAt)} → ${formatClock(last.recordedAt)}`
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3 sm:block">
            <dt className="text-muted-foreground">GPS points</dt>
            <dd className="font-medium">{pointsLabel}</dd>
          </div>
          <div className="flex justify-between gap-3 sm:block">
            <dt className="text-muted-foreground">Total distance</dt>
            <dd className="font-medium">{distanceKm.toFixed(2)} km</dd>
          </div>
          <div className="flex justify-between gap-3 sm:block">
            <dt className="text-muted-foreground">First location</dt>
            <dd className="font-medium">{formatClock(first?.recordedAt)}</dd>
          </div>
          <div className="flex justify-between gap-3 sm:block">
            <dt className="text-muted-foreground">Last location</dt>
            <dd className="font-medium">{formatClock(last?.recordedAt)}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
