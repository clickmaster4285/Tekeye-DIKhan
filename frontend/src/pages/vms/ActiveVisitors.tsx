import { useQuery } from "@tanstack/react-query"
import { fetchActiveVisitors, type ActiveVisitor } from "@/lib/vms-api"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { ROUTES } from "@/routes/config"
import { Users, Loader2, User } from "lucide-react"

function formatDate(s: string | undefined) {
  if (!s) return "—"
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
  } catch {
    return s
  }
}

export default function ActiveVisitorsPage() {
  const { data: active, isLoading, isError, error } = useQuery({
    queryKey: ["vms", "active-visitors"],
    queryFn: fetchActiveVisitors,
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Active Visitors</h1>
          <p className="text-sm text-muted-foreground">
            Visitors currently in the building (checked in, not yet exited).
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
          {error instanceof Error ? error.message : "Failed to load active visitors."}
        </div>
      )}
      {active && active.length === 0 && !isLoading && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          <p className="font-medium">No active visitors</p>
          <p className="text-sm mt-1">Visitors who have checked in will appear here until they exit.</p>
          <Link to={ROUTES.CHECK_IN_OUT} className="text-[#3b82f6] hover:underline text-sm mt-2 inline-block">
            Check-in / Check-out
          </Link>
        </div>
      )}
      {active && active.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Users className="h-4 w-4 text-[#3b82f6]" />
            <span className="font-medium text-foreground">{active.length} in building</span>
          </div>
          <ul className="divide-y divide-border">
            {(active as ActiveVisitor[]).map((v) => (
              <li key={v.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-[#3b82f6]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{v.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Host: {v.host_full_name || "—"} · Zone: {v.access_zone || "—"} · Updated {formatDate(v.updated_at)}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" asChild className="shrink-0">
                  <Link to={`/visitors/${v.id}`}>View</Link>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
