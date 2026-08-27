import { useCallback, useState } from "react"
import { Link } from "react-router-dom"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { usePolling } from "@/hooks/usePolling"
import { recognitionApi, type DashboardSummary } from "@/lib/recognition-api"
import { ROUTES } from "@/routes/config"

export default function AttendanceDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)

  const refresh = useCallback(async () => {
    try {
      setSummary(await recognitionApi.dashboardSummary())
    } catch {
      /* ignore */
    }
  }, [])

  usePolling(refresh, 15000, true)

  const s = summary?.summary

  return (
    <ModulePageLayout
      title="Attendance Dashboard"
      description="Live InsightFace attendance stats for today."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.ATTENDANCE}>Records</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={ROUTES.ATTENDANCE_REPORTS}>Daily report</Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          ["Total staff", s?.total_employees],
          ["Trained faces", s?.trained_faces],
          ["Present today", s?.present_today],
          ["Late today", s?.late_today],
          ["Absent today", s?.absent_today],
          ["Checked out", s?.checked_out_today],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-3xl">{value ?? "—"}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Card>
          <CardHeader>
            <CardTitle>By department</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(summary?.department_stats || []).map((row) => (
              <div key={row.department} className="flex justify-between border-b py-2">
                <span>{row.department}</span>
                <span className="text-muted-foreground">
                  {row.present_count} present · {row.late_count} late · {row.total} records
                </span>
              </div>
            ))}
            {!summary?.department_stats?.length && (
              <p className="text-muted-foreground">No attendance records yet today.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>{summary?.date || ""}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm max-h-80 overflow-auto">
            {(summary?.recent_activity || []).map((row) => (
              <div key={String(row.id)} className="rounded border px-3 py-2">
                <div className="font-medium">{String(row.staff_name || row.username || "Unknown")}</div>
                <div className="text-muted-foreground">
                  {String(row.status || "")} · {String(row.source || "")} · in{" "}
                  {row.check_in ? new Date(String(row.check_in)).toLocaleTimeString() : "—"}
                  {row.check_out
                    ? ` · out ${new Date(String(row.check_out)).toLocaleTimeString()}`
                    : ""}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
