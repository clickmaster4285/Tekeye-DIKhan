import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchVmsAnalytics } from "@/lib/vms-api"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BarChart3, Loader2, Users, LogIn, AlertTriangle, CheckCircle, XCircle } from "lucide-react"

export default function VmsReportsAnalyticsPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["vms", "analytics", fromDate, toDate],
    queryFn: () => fetchVmsAnalytics(fromDate, toDate),
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Daily, weekly, monthly analytics: active visitors, zone occupancy, security events.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <Label htmlFor="from">From</Label>
          <Input
            id="from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 w-40"
          />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <Input
            id="to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 w-40"
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#3b82f6]" />
        </div>
      )}
      {isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load analytics."}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
            <Users className="h-8 w-8 text-[#3b82f6]/80 shrink-0" />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Visitors registered</p>
              <p className="text-2xl font-semibold text-foreground">{data.visitors_registered}</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
            <LogIn className="h-8 w-8 text-green-600/80 shrink-0" />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">In building now</p>
              <p className="text-2xl font-semibold text-foreground">{data.in_building_now}</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
            <BarChart3 className="h-8 w-8 text-amber-600/80 shrink-0" />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Zone scans (range)</p>
              <p className="text-2xl font-semibold text-foreground">{data.zone_scans_in_range}</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive/80 shrink-0" />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Alerts in range</p>
              <p className="text-2xl font-semibold text-foreground">{data.alerts_in_range}</p>
            </div>
          </div>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive shrink-0" />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Unacknowledged alerts</p>
              <p className="text-2xl font-semibold text-destructive">{data.alerts_unacknowledged}</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
            <CheckCircle className="h-8 w-8 text-green-600/80 shrink-0" />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Approved (range)</p>
              <p className="text-2xl font-semibold text-foreground">{data.approved_in_range}</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
            <XCircle className="h-8 w-8 text-destructive/80 shrink-0" />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Denied (range)</p>
              <p className="text-2xl font-semibold text-foreground">{data.denied_in_range}</p>
            </div>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
            <Users className="h-8 w-8 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Pending approvals</p>
              <p className="text-2xl font-semibold text-foreground">{data.pending_approvals}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
