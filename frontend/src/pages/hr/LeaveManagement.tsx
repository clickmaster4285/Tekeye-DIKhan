import { useEffect, useState } from "react"
import { Calendar, Clock, CheckCircle, Send } from "lucide-react"
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  fetchLeaveTypes,
  fetchLeaveRequests,
  createLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  type LeaveRequestRecord,
  type LeaveTypeRecord,
} from "@/lib/leave-api"
import { fetchStaff, type StaffRecord } from "@/lib/staff-api"

export default function LeaveManagementPage() {
  const { toast } = useToast()
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRecord[]>([])
  const [requests, setRequests] = useState<LeaveRequestRecord[]>([])
  const [staff, setStaff] = useState<StaffRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ staff: "", leave_type: "", from_date: "", to_date: "", days: "", reason: "" })
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.all([fetchLeaveTypes(), fetchLeaveRequests(), fetchStaff()])
      .then(([types, reqs, staffList]) => {
        setLeaveTypes(types)
        setRequests(reqs)
        setStaff(staffList)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const pending = requests.filter((r) => r.status === "PENDING")
  const approvedThisMonth = requests.filter(
    (r) => r.status === "APPROVED" && r.approved_at && r.approved_at.slice(0, 7) === today.slice(0, 7)
  )
  const onLeaveToday = requests.filter(
    (r) => r.status === "APPROVED" && r.from_date <= today && r.to_date >= today
  )
  const avgBalance = staff.length ? Math.round(staff.reduce((s, e) => s + (e.leave_balance ?? 0), 0) / staff.length) : 0

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const staffId = Number(form.staff)
    const leaveTypeId = Number(form.leave_type)
    const days = Number(form.days)
    if (!staffId || !leaveTypeId || !form.from_date || !form.to_date || !days) {
      toast({ title: "Fill required fields", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      await createLeaveRequest({
        staff: staffId,
        leave_type: leaveTypeId,
        from_date: form.from_date,
        to_date: form.to_date,
        days,
        reason: form.reason || undefined,
      })
      toast({ title: "Leave request submitted" })
      setNewOpen(false)
      setForm({ staff: "", leave_type: "", from_date: "", to_date: "", days: "", reason: "" })
      load()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to submit", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async (id: number) => {
    try {
      await approveLeaveRequest(id)
      toast({ title: "Leave approved" })
      load()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to approve", variant: "destructive" })
    }
  }

  const handleReject = async () => {
    if (rejectId == null) return
    try {
      await rejectLeaveRequest(rejectId, rejectReason)
      toast({ title: "Leave rejected" })
      setRejectId(null)
      setRejectReason("")
      load()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to reject", variant: "destructive" })
    }
  }

  return (
    <ModulePageLayout
      title="Leave Management"
      description="Apply, approve, and track employee leave requests and balances."
      breadcrumbs={[{ label: "HR", href: ROUTES.EMPLOYEES }, { label: "Leave Management" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approval</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pending.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting action</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved This Month</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{approvedThisMonth.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Leave requests</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">On Leave Today</CardTitle>
              <Calendar className="h-4 w-4 text-[#3b82f6]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{onLeaveToday.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Employees absent</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Balance</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgBalance}</div>
              <p className="text-xs text-muted-foreground mt-1">Days (annual leave)</p>
            </CardContent>
          </Card>
        </div>

        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Leave Requests</CardTitle>
              <CardDescription>Pending and recent leave applications</CardDescription>
            </div>
            <Button
              className="w-full bg-[#3b82f6] text-white hover:bg-[#2563eb] sm:w-auto"
              onClick={() => setNewOpen(true)}
            >
              <Send className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive mb-4">{error}</p>}
            {loading ? (
              <p className="text-sm text-muted-foreground py-8">Loading…</p>
            ) : (
              <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
              <Table className="min-w-[920px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        No leave requests. Click &quot;New Request&quot; to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    requests.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.staff_name}</TableCell>
                        <TableCell>{row.leave_type_name}</TableCell>
                        <TableCell>{row.from_date}</TableCell>
                        <TableCell>{row.to_date}</TableCell>
                        <TableCell>{row.days}</TableCell>
                        <TableCell>
                          <Badge variant={row.status === "APPROVED" ? "default" : row.status === "REJECTED" ? "destructive" : "secondary"}>
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {row.status === "PENDING" && (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" className="text-green-600" onClick={() => handleApprove(row.id)}>
                                Approve
                              </Button>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRejectId(row.id)}>
                                Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New leave request</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Employee *</Label>
              <Select value={form.staff} onValueChange={(v) => setForm((f) => ({ ...f, staff: v }))} required>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.full_name ?? "—"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Leave type *</Label>
              <Select value={form.leave_type} onValueChange={(v) => setForm((f) => ({ ...f, leave_type: v }))} required>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name} ({t.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From date *</Label>
                <Input type="date" value={form.from_date} onChange={(e) => setForm((f) => ({ ...f, from_date: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>To date *</Label>
                <Input type="date" value={form.to_date} onChange={(e) => setForm((f) => ({ ...f, to_date: e.target.value }))} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Days *</Label>
              <Input type="number" min={1} value={form.days} onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} rows={2} />
            </div>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)} className="w-full sm:w-auto">Cancel</Button>
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">{submitting ? "Submitting…" : "Submit"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectId != null} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject leave request</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} placeholder="Rejection reason" />
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setRejectId(null)} className="w-full sm:w-auto">Cancel</Button>
            <Button variant="destructive" onClick={handleReject} className="w-full sm:w-auto">Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}
