import { useQuery } from "@tanstack/react-query"
import { fetchSecurityDashboard } from "@/lib/vms-api"
import { Button } from "@/components/ui/button"
import { ShieldCheck, Loader2, AlertTriangle, User } from "lucide-react"
import { Link } from "react-router-dom"
import { ROUTES } from "@/routes/config"

function formatDate(s: string) {
  if (!s) return "—"
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
  } catch {
    return s
  }
}

export default function SecurityScreeningPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["vms", "security-dashboard"],
    queryFn: fetchSecurityDashboard,
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Security & Screening</h1>
          <p className="text-sm text-muted-foreground">
            Watchlist check, duplicate scan, photo quality, face match. View current alerts and stats.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#3b82f6]" />
        </div>
      )}
      {isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load security dashboard."}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase">Visitors today</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{data.visitors_today}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase">In building</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{data.in_building}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase">Alerts today</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{data.alerts_today}</p>
            </div>
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase">Unacknowledged</p>
              <p className="text-2xl font-semibold text-destructive mt-1">{data.alerts_unacknowledged}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h2 className="font-medium text-foreground">Recent alerts</h2>
            </div>
            {data.recent_alerts.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No unacknowledged alerts.</div>
            ) : (
              <ul className="divide-y divide-border">
                {data.recent_alerts.map((a) => (
                  <li key={a.id} className="p-4 flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {a.alert_type.replace(/_/g, " ")} · {a.severity}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">{a.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {a.visitor_name && (
                          <>
                            <User className="h-3 w-3 inline mr-1" />
                            {a.visitor_name}
                          </>
                        )}
                        {" · "}
                        {formatDate(a.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button variant="outline" asChild>
            <Link to={ROUTES.CHECK_IN_OUT}>Check-in / Check-out</Link>
          </Button>
        </>
      )}
    </div>
  )
}
