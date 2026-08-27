import { useMemo, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, FileText, Loader2, Route, User } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ROUTES } from "@/routes/config"
import { fetchActivityLogs, type ActivityLogRecord } from "@/lib/logs-api"

type GroupedLogs = {
  key: string
  dayName: string
  dateLabel: string
  items: ActivityLogRecord[]
}

type JourneyStep = {
  id: number
  label: string
  rawAction: string
  time: string
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function formatDateTime(value: string | null | undefined): string {
  const d = toDate(value)
  if (!d) return "—"
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function formatTimeOnly(value: string | null | undefined): string {
  const d = toDate(value)
  if (!d) return "—"
  return d.toLocaleTimeString(undefined, { timeStyle: "short" })
}

function parseJourneyLabel(action: string): string | null {
  const cleaned = (action || "").trim()
  if (!cleaned) return null
  if (/^GET\s+\/api\/activity-logs/i.test(cleaned)) return null
  const viewedMatch = cleaned.match(/^Viewed\s+(.+)$/i)
  if (viewedMatch?.[1]) return viewedMatch[1].trim()
  const postMatch = cleaned.match(/^POST\s+(.+)$/i)
  if (postMatch?.[1]) return `POST ${postMatch[1].trim()}`
  const getMatch = cleaned.match(/^GET\s+(.+)$/i)
  if (getMatch?.[1]) return `GET ${getMatch[1].trim()}`
  return cleaned
}

function buildJourneyFlow(logs: ActivityLogRecord[]): JourneyStep[] {
  const sorted = [...logs].sort((a, b) => {
    const at = toDate(a.time)?.getTime() ?? 0
    const bt = toDate(b.time)?.getTime() ?? 0
    return at - bt
  })

  const flow: JourneyStep[] = []
  for (const log of sorted) {
    const label = parseJourneyLabel(log.action)
    if (!label) continue
    const previous = flow[flow.length - 1]
    // Collapse consecutive same steps to make the journey readable.
    if (previous?.label === label) continue
    flow.push({
      id: log.id,
      label,
      rawAction: log.action,
      time: log.time,
    })
  }
  return flow
}

function groupLogsByDate(logs: ActivityLogRecord[]): GroupedLogs[] {
  const byDate = new Map<string, GroupedLogs>()
  for (const log of logs) {
    const d = toDate(log.time)
    if (!d) continue
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, {
        key: dateKey,
        dayName: d.toLocaleDateString(undefined, { weekday: "long" }),
        dateLabel: d.toLocaleDateString(undefined, { dateStyle: "long" }),
        items: [],
      })
    }
    byDate.get(dateKey)!.items.push(log)
  }
  return Array.from(byDate.values()).map((group) => ({
    ...group,
    items: [...group.items].sort((a, b) => {
      const at = toDate(a.time)?.getTime() ?? 0
      const bt = toDate(b.time)?.getTime() ?? 0
      return bt - at
    }),
  }))
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  )
}

export default function ActivityLogDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const username = searchParams.get("username")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["activity-log-detail", id, username],
    queryFn: () => fetchActivityLogs({ page: 1, page_size: 1000, username: username ?? undefined }),
    enabled: !!id,
  })

  const results = data?.results ?? []
  const selectedLog = results.find((log) => String(log.id) === String(id)) ?? null
  const selectedUsername = selectedLog?.username ?? username ?? "Unknown user"
  const userJourney = results.filter((log) => (log.username ?? "") === (selectedLog?.username ?? username ?? ""))
  const filteredJourney = useMemo(() => {
    return userJourney.filter((log) => {
      const logDate = toDate(log.time)
      if (!logDate) return false
      if (dateFrom) {
        const from = new Date(`${dateFrom}T00:00:00`)
        if (logDate < from) return false
      }
      if (dateTo) {
        const to = new Date(`${dateTo}T23:59:59`)
        if (logDate > to) return false
      }
      return true
    })
  }, [dateFrom, dateTo, userJourney])
  const groupedJourney = groupLogsByDate(filteredJourney)
  const flowSteps = buildJourneyFlow(filteredJourney)

  return (
    <ModulePageLayout
      title="Log Details"
      description="User activity journey grouped by day and date."
      breadcrumbs={[
        { label: "System configuration" },
        { label: "Logs", href: ROUTES.LOGS },
        { label: "Detail" },
      ]}
    >
      <div className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.LOGS}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to logs
          </Link>
        </Button>

        {isLoading && (
          <Card>
            <CardContent className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#3b82f6]" />
            </CardContent>
          </Card>
        )}

        {isError && (
          <Card>
            <CardContent className="pt-6">
              <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error instanceof Error ? error.message : "Failed to load log details"}
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-[#3b82f6]" />
                  {selectedUsername}
                </CardTitle>
                <CardDescription>Selected activity and user context.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Meta label="Log ID" value={id ?? "—"} />
                <Meta label="IP Address" value={selectedLog?.ip_address ?? "—"} />
                <Meta label="Device" value={selectedLog?.device ?? "—"} />
                <Meta label="Browser" value={selectedLog?.browser ?? "—"} />
                <Meta label="OS" value={selectedLog?.os ?? "—"} />
                <Meta label="City" value={selectedLog?.city ?? "—"} />
                <Meta label="Country" value={selectedLog?.country ?? "—"} />
                <Meta label="Selected Time" value={formatDateTime(selectedLog?.time)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Route className="h-5 w-5 text-[#3b82f6]" />
                  Journey Flow Map
                </CardTitle>
                <CardDescription>
                  Complete flow from first visit to latest activity.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {flowSteps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No mapped flow available for this user.</p>
                ) : (
                  <div className="space-y-2">
                    {flowSteps.map((step, index) => (
                      <div key={step.id} className="rounded-md border bg-muted/20 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">
                              {index === 0 ? "First" : `Step ${index + 1}`}: {step.label}
                            </p>
                            <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title={step.rawAction}>
                              {step.rawAction}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatDateTime(step.time)}
                          </div>
                        </div>
                        {index < flowSteps.length - 1 && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <ArrowRight className="h-3.5 w-3.5" />
                            then
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#3b82f6]" />
                  User Journey
                </CardTitle>
                <CardDescription>
                  Activity mapped date-wise and day-wise for this user.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 rounded-md border p-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    <Button type="button" variant="ghost" onClick={() => { setDateFrom(""); setDateTo("") }}>
                      Clear date filter
                    </Button>
                  </div>
                </div>
                {groupedJourney.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No journey records found for this user in selected date range.</p>
                ) : (
                  <div className="space-y-6">
                    {groupedJourney.map((group) => (
                      <div key={group.key} className="rounded-lg border p-4">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {group.dayName}
                          </Badge>
                          <span className="text-sm font-medium">{group.dateLabel}</span>
                        </div>
                        <div className="space-y-2">
                          {group.items.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-mono text-xs">{entry.action || "—"}</p>
                              </div>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock3 className="h-3.5 w-3.5" />
                                {formatTimeOnly(entry.time)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ModulePageLayout>
  )
}
