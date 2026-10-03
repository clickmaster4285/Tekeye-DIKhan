import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { acknowledgeMobileAlert, fetchMobileAlerts, type MobileAlertRecord } from "@/lib/mobile-admin-api"
import { ROUTES, getEmployeeDetailPath } from "@/routes/config"
import { useToast } from "@/hooks/use-toast"

function tone(severity: string) {
  if (severity === "CRITICAL") return "bg-red-600"
  if (severity === "WARNING") return "bg-amber-500"
  return "bg-sky-600"
}

function ago(iso: string | null) {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return "just now"
  const mins = Math.round(ms / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  return `${hours}h ago`
}

export default function MobileAlertsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: alerts = [], isLoading, error } = useQuery({
    queryKey: ["mobile-alerts"],
    queryFn: fetchMobileAlerts,
  })
  const ack = useMutation({
    mutationFn: acknowledgeMobileAlert,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mobile-alerts"] })
      toast({ title: "Alert acknowledged" })
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  })

  const groups: Record<string, MobileAlertRecord[]> = { CRITICAL: [], WARNING: [], INFO: [] }
  for (const alert of alerts) {
    const key = alert.severity in groups ? alert.severity : "INFO"
    groups[key].push(alert)
  }

  return (
    <ModulePageLayout
      title="Mobile Alerts"
      description="CIIS device, session, and GPS monitoring for field staff."
      breadcrumbs={[{ label: "HR" }, { label: "Mobile Alerts" }]}
    >
      {error ? <p className="text-sm text-destructive mb-4">{String(error)}</p> : null}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading alerts…</p> : null}
      <div className="grid gap-6">
        {(["CRITICAL", "WARNING", "INFO"] as const).map((severity) => (
          <Card key={severity}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${tone(severity)}`} />
                {severity}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {groups[severity].length === 0 ? (
                <p className="text-sm text-muted-foreground">No {severity.toLowerCase()} alerts.</p>
              ) : (
                groups[severity].map((alert) => (
                  <div key={alert.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{alert.staff_name}</p>
                      <Badge variant="outline">{alert.alert_type}</Badge>
                    </div>
                    <p className="text-sm">{alert.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {ago(alert.detected_at)} · device {alert.device_name || alert.device_uuid || "—"} · GPS {ago(alert.last_gps_at)} ·
                      heartbeat {ago(alert.last_heartbeat_at)} · battery {alert.battery_level ?? "—"}% · {alert.device_status || "—"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => ack.mutate(alert.id)}>
                        Acknowledge
                      </Button>
                      {alert.staff_id ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link to={getEmployeeDetailPath(alert.staff_id)}>Open Staff</Link>
                        </Button>
                      ) : null}
                      {alert.staff_id && alert.device_id ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/employees/${alert.staff_id}/device`}>Open Device</Link>
                        </Button>
                      ) : null}
                      <Button size="sm" variant="outline" asChild>
                        <Link to={ROUTES.GPS_TRACKING}>Open Map</Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`${ROUTES.GPS_TRACKING}?user=${alert.user_id}`}>View History</Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </ModulePageLayout>
  )
}
