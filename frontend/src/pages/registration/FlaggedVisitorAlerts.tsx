import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { ROUTES } from "@/routes/config"
import {
  acknowledgeSecurityAlert,
  fetchSecurityAlerts,
  type SecurityAlertRecord,
} from "@/lib/vms-api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { AlertTriangle, Bell, Loader2, CheckCircle2 } from "lucide-react"

function formatDate(s: string) {
  if (!s) return "—"
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
  } catch {
    return s
  }
}

function severityClass(severity: string) {
  if (severity === "critical") return "bg-destructive/10 text-destructive"
  if (severity === "high") return "bg-amber-500/10 text-amber-700"
  return "bg-muted text-muted-foreground"
}

export default function FlaggedVisitorAlertsPage() {
  const [filterAck, setFilterAck] = useState<boolean | undefined>(undefined)
  const queryClient = useQueryClient()

  const { data: alerts, isLoading, isError, error } = useQuery({
    queryKey: ["vms", "security-alerts", filterAck],
    queryFn: () => fetchSecurityAlerts({ acknowledged: filterAck }),
  })

  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: number) => acknowledgeSecurityAlert(alertId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["vms", "security-alerts"] })
      toast({ title: "Alert acknowledged" })
    },
    onError: (err: Error) => {
      toast({ title: "Failed to acknowledge", description: err.message, variant: "destructive" })
    },
  })

  return (
    <>
      <nav className="text-sm text-muted-foreground mb-2">
        <Link to={ROUTES.DASHBOARD} className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Visitor Management System</span>
        <span className="mx-2">/</span>
        <span className="text-[#3b82f6]">Flagged Visitor Alerts</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Flagged Visitor Alerts</h1>
        <p className="text-sm text-muted-foreground">
          Live security alerts from watchlist hits, blacklist matches, and zone access incidents.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Security alerts
          </CardTitle>
          <CardDescription>
            Alerts are created automatically when screening or gate scans detect a risk.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load alerts."}
            </div>
          )}

          {alerts && (
            <div className="rounded-lg border border-border overflow-hidden">
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
                      className={`p-4 flex items-start justify-between gap-4 ${
                        !a.acknowledged ? "bg-amber-500/5" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-lg ${severityClass(
                            a.severity
                          )}`}
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground capitalize">
                            {a.alert_type.replace(/_/g, " ")}
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">{a.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Severity: {a.severity}
                            {a.zone && ` · Zone: ${a.zone}`}
                            {a.gate && ` · Gate: ${a.gate}`}
                            {a.visitor_name && ` · Visitor: ${a.visitor_name}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(a.created_at)}
                            {a.acknowledged && a.acknowledged_at && (
                              <> · Acknowledged {formatDate(a.acknowledged_at)}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        {!a.acknowledged && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={acknowledgeMutation.isPending}
                            onClick={() => acknowledgeMutation.mutate(a.id)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Acknowledge
                          </Button>
                        )}
                        {a.visitor && (
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/visitors/${a.visitor}`}>View visitor</Link>
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
