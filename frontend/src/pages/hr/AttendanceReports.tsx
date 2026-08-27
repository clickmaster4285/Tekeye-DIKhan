import { useCallback, useState } from "react"
import { Link } from "react-router-dom"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { recognitionApi, type DailyReport } from "@/lib/recognition-api"
import { ROUTES } from "@/routes/config"

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export default function AttendanceReportsPage() {
  const { toast } = useToast()
  const [date, setDate] = useState(todayIso())
  const [report, setReport] = useState<DailyReport | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      setReport(await recognitionApi.dailyReport(date))
    } catch (err) {
      toast({ title: "Failed to load report", description: String(err), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }, [date, toast])

  return (
    <ModulePageLayout
      title="Attendance Daily Report"
      description="Present, late, and absent staff for a selected date."
      actions={
        <Button variant="outline" asChild>
          <Link to={ROUTES.ATTENDANCE_DASHBOARD}>Dashboard</Link>
        </Button>
      }
    >
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-2">
            <Label htmlFor="report-date">Date</Label>
            <Input id="report-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button onClick={load} disabled={busy}>
            {busy ? "Loading…" : "Load report"}
          </Button>
        </CardContent>
      </Card>

      {report && (
        <>
          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Present</CardDescription>
                <CardTitle>{report.totals.present}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Late</CardDescription>
                <CardTitle>{report.totals.late}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Absent</CardDescription>
                <CardTitle>{report.totals.absent}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Attendance — {report.date}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>In</TableHead>
                      <TableHead>Out</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.attendance.map((row) => (
                      <TableRow key={String(row.id)}>
                        <TableCell>{String(row.staff_name || row.username || "—")}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{String(row.status || "—")}</Badge>
                        </TableCell>
                        <TableCell>
                          {row.check_in ? new Date(String(row.check_in)).toLocaleTimeString() : "—"}
                        </TableCell>
                        <TableCell>
                          {row.check_out ? new Date(String(row.check_out)).toLocaleTimeString() : "—"}
                        </TableCell>
                        <TableCell>{String(row.source || "—")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Absent</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Department</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.absent.map((row) => (
                      <TableRow key={row.staff_id}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.employee_id || "—"}</TableCell>
                        <TableCell>{row.department}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!report.absent.length && (
                  <p className="text-sm text-muted-foreground mt-2">Everyone present.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </ModulePageLayout>
  )
}
