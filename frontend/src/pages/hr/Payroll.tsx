import { useEffect, useState } from "react"
import { DollarSign, Users, FileText, Calendar } from "lucide-react"
import { ROUTES } from "@/routes/config"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { fetchPayrollRuns, createPayrollRun, processPayrollRun, type PayrollRunRecord } from "@/lib/payroll-api"

function formatPkr(value: string | number | null): string {
  if (value == null) return "—"
  const n = typeof value === "string" ? parseFloat(value) : value
  if (Number.isNaN(n)) return "—"
  return new Intl.NumberFormat("en-PK", { style: "decimal", minimumFractionDigits: 0 }).format(n)
}

export default function PayrollPage() {
  const { toast } = useToast()
  const [runs, setRuns] = useState<PayrollRunRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runOpen, setRunOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [periodLabel, setPeriodLabel] = useState("")
  const [periodStart, setPeriodStart] = useState("")
  const [periodEnd, setPeriodEnd] = useState("")

  const load = () => {
    setLoading(true)
    setError(null)
    fetchPayrollRuns()
      .then(setRuns)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const latest = runs[0]
  const thisMonthLabel = new Date().toISOString().slice(0, 7).replace("-", " ")
  const thisMonthRun = runs.find((r) => r.period_label.toLowerCase().replace(/\s/g, "") === thisMonthLabel.replace(/\s/g, ""))

  const handleCreateAndProcess = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!periodLabel.trim() || !periodStart || !periodEnd) {
      toast({ title: "Fill period label and dates", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const run = await createPayrollRun({
        period_label: periodLabel.trim(),
        period_start: periodStart,
        period_end: periodEnd,
      })
      await processPayrollRun(run.id)
      toast({ title: "Payroll run created and processed" })
      setRunOpen(false)
      setPeriodLabel("")
      setPeriodStart("")
      setPeriodEnd("")
      load()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to run payroll", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModulePageLayout
      title="Payroll"
      description="Process salary, allowances, deductions, and payroll reports."
      breadcrumbs={[{ label: "HR", href: ROUTES.EMPLOYEES }, { label: "Payroll" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Month Payroll</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{thisMonthRun ? formatPkr(thisMonthRun.total_gross) : "—"}</div>
              <p className="text-xs text-muted-foreground mt-1">Gross salary</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{latest?.employee_count ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Last run</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pay Period</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{latest?.period_label ?? "—"}</div>
              <p className="text-xs text-muted-foreground mt-1">Latest</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{latest?.status ?? "—"}</div>
              <p className="text-xs text-muted-foreground mt-1">Latest run</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Payroll Runs</CardTitle>
              <CardDescription>History and status of payroll processing</CardDescription>
            </div>
            <Button
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
              onClick={() => setRunOpen(true)}
            >
              Run Payroll
            </Button>
          </CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive mb-4">{error}</p>}
            {loading ? (
              <p className="text-sm text-muted-foreground py-8">Loading…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Gross (PKR)</TableHead>
                    <TableHead>Net (PKR)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                        No payroll runs. Click &quot;Run Payroll&quot; to create and process a period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    runs.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.period_label}</TableCell>
                        <TableCell>{row.employee_count}</TableCell>
                        <TableCell>{formatPkr(row.total_gross)}</TableCell>
                        <TableCell>{formatPkr(row.total_net)}</TableCell>
                        <TableCell>
                          <Badge variant={row.status === "PROCESSED" ? "default" : "secondary"}>{row.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {row.entries_count > 0 && (
                            <span className="text-sm text-muted-foreground">{row.entries_count} entries</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Run payroll</DialogTitle>
            <DialogDescription>Create a new pay period and process salary for all staff with salary set.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAndProcess} className="space-y-4">
            <div className="space-y-2">
              <Label>Period label *</Label>
              <Input
                placeholder="e.g. Jan 2025"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Period start *</Label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Period end *</Label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRunOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Processing…" : "Create & process"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}
