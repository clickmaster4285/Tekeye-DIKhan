import { useMemo, useState } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Link } from "react-router-dom"
import { ROUTES, getVisitorDetailPath } from "@/routes/config"
import {
  fetchVisitors,
  getVisitor,
  type RegistrationSource,
  type VisitorRecord,
} from "@/lib/visitor-api"
import { getVisitorPhotoUrl } from "@/lib/image-match"

type RegistrationType = "pre" | "walk-in"

type CalendarEvent = {
  visitorId: number
  source: RegistrationSource
  visitorName: string
  type: RegistrationType
  date: string
  time: string
  host: string
  department: string
  status: "Scheduled" | "Checked-In" | "Pending"
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function parseDateKey(value: unknown): string | null {
  if (value == null || value === "") return null
  const s = String(value).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return toDateKey(d)
}

function formatEventTime(visitor: Record<string, unknown>): string {
  const slot =
    visitor.preferred_time_slot ??
    visitor.preferred_time_slot_walkin ??
    visitor.time_validity_start
  if (slot != null && String(slot).trim()) {
    const raw = String(slot).trim()
    if (/^\d{1,2}:\d{2}/.test(raw)) {
      const [h, m] = raw.split(":").map(Number)
      const d = new Date()
      d.setHours(h, m, 0, 0)
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    }
    return raw
  }
  const created = visitor.created_at
  if (created) {
    const d = new Date(String(created))
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    }
  }
  return "—"
}

function formatDepartment(value: unknown): string {
  const s = String(value ?? "").trim()
  if (!s) return "—"
  return s
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function mapVisitorToEvent(
  visitor: VisitorRecord & Record<string, unknown>,
  source: RegistrationSource
): CalendarEvent | null {
  const date =
    parseDateKey(visitor.preferred_visit_date) ??
    parseDateKey(visitor.visit_date) ??
    parseDateKey(visitor.preferred_date) ??
    parseDateKey(visitor.created_at)
  if (!date) return null

  const regStatus = String(visitor.registration_status ?? "approved")
  const hasCheckIn = Boolean(
    (visitor.guard_entry_time as string | undefined)?.trim() ||
      (visitor.check_in_time as string | undefined)?.trim()
  )
  let status: CalendarEvent["status"] = "Scheduled"
  if (hasCheckIn) status = "Checked-In"
  else if (regStatus === "draft") status = "Pending"

  const type: RegistrationType = source === "pre-registration" ? "pre" : "walk-in"

  return {
    visitorId: visitor.id,
    source,
    visitorName: visitor.full_name || "Unknown Visitor",
    type,
    date,
    time: formatEventTime(visitor),
    host: String(
      visitor.host_officer_name ??
        visitor.host_full_name ??
        visitor.hostFullName ??
        visitor.host_name ??
        ""
    ).trim() || "—",
    department: formatDepartment(visitor.department_to_visit),
    status,
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase()
  return "??"
}

export default function CalendarViewPage() {
  const today = useMemo(() => new Date(), [])
  const [currentMonth, setCurrentMonth] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  )
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateKey(today))

  const preRegQuery = useQuery({
    queryKey: ["visitors", "pre-registration", "calendar"],
    queryFn: () => fetchVisitors("pre-registration"),
  })
  const walkInQuery = useQuery({
    queryKey: ["visitors", "walk-in", "calendar"],
    queryFn: () => fetchVisitors("walk-in"),
  })

  const isLoading = preRegQuery.isLoading || walkInQuery.isLoading
  const isError = preRegQuery.isError || walkInQuery.isError
  const loadError =
    (preRegQuery.error instanceof Error && preRegQuery.error.message) ||
    (walkInQuery.error instanceof Error && walkInQuery.error.message) ||
    "Failed to load visitors"

  const allEvents = useMemo(() => {
    const events: CalendarEvent[] = []
    for (const v of preRegQuery.data ?? []) {
      const e = mapVisitorToEvent(v as VisitorRecord & Record<string, unknown>, "pre-registration")
      if (e) events.push(e)
    }
    for (const v of walkInQuery.data ?? []) {
      const e = mapVisitorToEvent(v as VisitorRecord & Record<string, unknown>, "walk-in")
      if (e) events.push(e)
    }
    return events
  }, [preRegQuery.data, walkInQuery.data])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of allEvents) {
      const bucket = map.get(event.date) ?? []
      bucket.push(event)
      map.set(event.date, bucket)
    }
    for (const [, bucket] of map) {
      bucket.sort((a, b) => a.time.localeCompare(b.time))
    }
    return map
  }, [allEvents])

  const monthLabel = currentMonth.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  })

  const calendarCells = useMemo(() => {
    const startOfMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1
    )
    const startDay = startOfMonth.getDay()
    const gridStart = new Date(startOfMonth)
    gridStart.setDate(startOfMonth.getDate() - startDay)

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      return d
    })
  }, [currentMonth])

  const selectedEvents = eventsByDate.get(selectedDate) ?? []

  const detailQueries = useQueries({
    queries: selectedEvents.map((event) => ({
      queryKey: ["visitors", event.source, "calendar-detail", event.visitorId],
      queryFn: () => getVisitor(event.visitorId, event.source),
      enabled: selectedEvents.length > 0,
      staleTime: 60_000,
    })),
  })

  const photoByVisitorId = useMemo(() => {
    const map = new Map<number, string>()
    selectedEvents.forEach((event, index) => {
      const detail = detailQueries[index]?.data
      if (!detail) return
      const url = getVisitorPhotoUrl(detail as Record<string, unknown>)
      if (url) map.set(event.visitorId, url)
    })
    return map
  }, [selectedEvents, detailQueries])

  const prevMonth = () =>
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  const nextMonth = () =>
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))

  const totalThisMonth = useMemo(() => {
    const y = currentMonth.getFullYear()
    const m = currentMonth.getMonth()
    return allEvents.filter((e) => {
      const d = new Date(e.date + "T12:00:00")
      return d.getFullYear() === y && d.getMonth() === m
    }).length
  }, [allEvents, currentMonth])

  return (
    <>
      <div className="mb-2">
        <nav className="text-sm text-muted-foreground">
          <Link to={ROUTES.DASHBOARD} className="hover:text-foreground">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link to={ROUTES.PRE_REGISTRATION} className="hover:text-foreground">
            Visitor Registration
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[#3b82f6]">Calendar View</span>
        </nav>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Calendar View</h1>
        <p className="text-sm text-muted-foreground">
          Pre-registrations and walk-ins by visit date from your database.
          {totalThisMonth > 0 && (
            <span className="ml-1">
              {totalThisMonth} visit{totalThisMonth === 1 ? "" : "s"} in {monthLabel}.
            </span>
          )}
        </p>
      </div>

      {isError && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" onClick={prevMonth} disabled={isLoading}>
              <ChevronLeft size={16} className="mr-1" />
              Previous
            </Button>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {monthLabel}
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </h2>
            <Button variant="outline" onClick={nextMonth} disabled={isLoading}>
              Next
              <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-2">
            {DAYS.map((day) => (
              <div
                key={day}
                className="text-xs font-semibold text-muted-foreground text-center py-2"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarCells.map((dateObj) => {
              const dateKey = toDateKey(dateObj)
              const dayEvents = eventsByDate.get(dateKey) ?? []
              const isCurrentMonth = dateObj.getMonth() === currentMonth.getMonth()
              const isSelected = selectedDate === dateKey
              const isToday = dateKey === toDateKey(today)

              return (
                <button
                  key={dateKey + String(dateObj.getTime())}
                  type="button"
                  onClick={() => setSelectedDate(dateKey)}
                  className={cn(
                    "min-h-[92px] border rounded-md p-2 text-left transition",
                    isSelected
                      ? "border-[#3b82f6] bg-[#3b82f6]/5"
                      : "border-border hover:border-[#3b82f6]/50",
                    !isCurrentMonth && "opacity-45"
                  )}
                >
                  <div
                    className={cn(
                      "text-sm font-medium mb-1",
                      isToday && "text-[#3b82f6] font-semibold"
                    )}
                  >
                    {dateObj.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={`${event.source}-${event.visitorId}`}
                        className={cn(
                          "text-[11px] px-1.5 py-0.5 rounded truncate",
                          event.type === "pre"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        )}
                        title={`${event.visitorName} (${event.time})`}
                      >
                        {event.type === "pre" ? "PR" : "WI"} - {event.visitorName}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] text-muted-foreground">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-4 mt-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-blue-100 border border-blue-200 dark:bg-blue-900/40" />
              <span>Pre-Registration</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200 dark:bg-emerald-900/40" />
              <span>Walk-In Registration</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-base font-semibold mb-1">Selected Date</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading visitors…
            </div>
          ) : selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No visits scheduled on this date.</p>
          ) : (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {selectedEvents.map((event, index) => {
                const photoUrl = photoByVisitorId.get(event.visitorId)
                const detailLoading = detailQueries[index]?.isLoading
                return (
                  <div
                    key={`${event.source}-${event.visitorId}`}
                    className="border border-border rounded-md p-3"
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <Avatar className="h-12 w-12 shrink-0">
                        {photoUrl ? (
                          <AvatarImage src={photoUrl} alt={event.visitorName} />
                        ) : null}
                        <AvatarFallback className="text-xs">
                          {detailLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            getInitials(event.visitorName)
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm truncate">{event.visitorName}</p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[11px] shrink-0",
                              event.type === "pre"
                                ? "border-blue-200 text-blue-700"
                                : "border-emerald-200 text-emerald-700"
                            )}
                          >
                            {event.type === "pre" ? "Pre-Registration" : "Walk-In"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{event.time}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1 pl-[60px]">
                      <p>Host: {event.host}</p>
                      <p>Department: {event.department}</p>
                      <p>
                        Status:{" "}
                        <span
                          className={cn(
                            "font-medium",
                            event.status === "Checked-In" && "text-green-600",
                            event.status === "Pending" && "text-amber-600"
                          )}
                        >
                          {event.status}
                        </span>
                      </p>
                      <Link
                        to={getVisitorDetailPath(event.visitorId)}
                        className="inline-block text-[#3b82f6] hover:underline mt-1"
                      >
                        View full details
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
