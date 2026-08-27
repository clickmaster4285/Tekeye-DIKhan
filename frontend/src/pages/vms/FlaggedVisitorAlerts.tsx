import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchSecurityAlerts, type SecurityAlertRecord } from "@/lib/vms-api"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { AlertTriangle, Loader2, Bell } from "lucide-react"

function formatDate(s: string) {
  if (!s) return "—"
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
  } catch {
    return s
  }
}

export default function FlaggedVisitorAlerts() {
  const [filterAck, setFilterAck] = useState<boolean | undefined>(undefined)

  const { data: alerts, isLoading, isError, error } = useQuery({
    queryKey: ["vms", "security-alerts", filterAck],
    queryFn: () => fetchSecurityAlerts({ acknowledged: filterAck }),
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Flagged Visitor Alerts</h1>
          <p className="text-sm text-muted-foreground">
            View and manage security alerts for flagged visitors and access incidents.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={filterAck === undefined ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterAck(undefined)}
        >
          All
        </Button>
        <Button
          variant={filterAck === false ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterAck(false)}
        >
          Unacknowledged
        </Button>
        <Button
          variant={filterAck === true ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterAck(true)}
        >
          Acknowledged
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#3b82f6]" />
        </div>
      )}
      {isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load alerts."}
        </div>
      )}
      {alerts && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-medium text-foreground">
            Alerts ({alerts.length})
          </div>
          {alerts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
              <Bell className="h-10 w-10 text-muted-foreground/50" />
              No alerts match the filter.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(alerts as SecurityAlertRecord[]).map((a) => (
                <li
                  key={a.id}
                  className={`p-4 flex items-start justify-between gap-4 ${!a.acknowledged ? "bg-amber-500/5" : ""}`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-lg ${
                        a.severity === "high" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"
                      }`}
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{a.alert_type}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{a.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Severity: {a.severity}
                        {a.zone && ` · Zone: ${a.zone}`}
                        {a.gate && ` · Gate: ${a.gate}`}
                        {a.visitor_name && ` · Visitor: ${a.visitor_name}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(a.created_at)}
                        {a.acknowledged && a.acknowledged_at && ` · Acknowledged ${formatDate(a.acknowledged_at)}`}
                      </p>
                    </div>
                  </div>
                  {a.visitor && (
                    <Button size="sm" variant="outline" asChild className="shrink-0">
                      <Link to={`/visitors/${a.visitor}`}>View visitor</Link>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
