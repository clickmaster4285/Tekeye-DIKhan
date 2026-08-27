import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Clock, LogIn, UserCheck, Calendar, Camera, Eye, Edit, Trash2, FileDown } from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CameraCapture } from "@/components/camera-capture"
import {
  AttendancePdfReport,
  attendancePersonKey,
  buildAttendancePdfPages,
  downloadAttendancePdf,
  filterAttendanceByPeriod,
  formatWorkingTime,
  periodLabel,
  type AttendancePeriod,
} from "@/components/hr/attendance-pdf-report"
import { useToast } from "@/hooks/use-toast"
import { getStoredUser } from "@/lib/auth"
import { fetchStaff, type StaffRecord } from "@/lib/staff-api"
import { resolveMediaUrl } from "@/lib/cameras-api"
import {
  fetchAttendance,
  fetchAttendanceById,
  updateAttendance,
  deleteAttendance,
  markCheckIn,
  markCheckOut,
  recognizeAndMarkAttendance,
  getTodayRecordForUser,
  type AttendanceRecord,
} from "@/lib/attendance-api"
import { fetchMLHealth, type MLHealthResponse } from "@/lib/ml-api"
import { ROUTES } from "@/routes/config"

function formatTime(iso: string | null): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  } catch {
    return "—"
  }
}

function statusFromRecord(r: AttendanceRecord): string {
  if (r.status === "late") return "Late"
  if (r.status === "present") return "Present"
  if (r.status === "half_day") return "Half day"
  if (r.status === "absent") return "Absent"
  if (r.check_in && r.check_out) return "Present"
  if (r.check_in) return "Present"
  return "Absent"
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(value: string): string | null {
  if (!value.trim()) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

type MarkType = "check_in" | "check_out"
type MarkMode = "manual" | "face"

export default function AttendancePage() {
  const currentUser = getStoredUser()
  const { toast } = useToast()
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [staff, setStaff] = useState<StaffRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [markType, setMarkType] = useState<MarkType>("check_in")
  const [markMode, setMarkMode] = useState<MarkMode>("face")
  const [mlHealth, setMlHealth] = useState<MLHealthResponse | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>(() =>
    String(getStoredUser()?.id ?? "")
  )
  const [cameraOpen, setCameraOpen] = useState(false)
  const [markError, setMarkError] = useState<string | null>(null)
  const [marking, setMarking] = useState(false)
  const [filterDate, setFilterDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [period, setPeriod] = useState<AttendancePeriod>("day")
  const [selectedPersonKey, setSelectedPersonKey] = useState<string>("all")
  /** Drives the hidden PDF DOM (may briefly differ from table filter during export). */
  const [pdfExportPersonKey, setPdfExportPersonKey] = useState<string>("all")
  const [pdfExporting, setPdfExporting] = useState(false)
  const pdfReportRef = useRef<HTMLDivElement>(null)
  const [viewRecord, setViewRecord] = useState<AttendanceRecord | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null)
  const [editForm, setEditForm] = useState({ date: "", check_in: "", check_out: "" })
  const [editSaving, setEditSaving] = useState(false)
  const [deleteRecord, setDeleteRecord] = useState<AttendanceRecord | null>(null)
  const [deleteSaving, setDeleteSaving] = useState(false)

  const loadData = () => {
    setLoading(true)
    Promise.all([fetchAttendance(), fetchStaff()])
      .then(([attData, staffData]) => {
        setAttendance(attData)
        setStaff(staffData)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
    const timer = window.setInterval(loadData, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    fetchMLHealth()
      .then(setMlHealth)
      .catch(() => setMlHealth({ status: "error", message: "Could not reach ML service." }))
  }, [])

  const todayStr = new Date().toISOString().slice(0, 10)
  const presentToday = attendance.filter((r) => r.check_in && r.date === todayStr).length
  const periodAttendance = useMemo(
    () => filterAttendanceByPeriod(attendance, period, filterDate),
    [attendance, period, filterDate]
  )
  const personOptions = useMemo(() => {
    const pages = buildAttendancePdfPages(periodAttendance, staff)
    return pages.map((p) => ({ key: p.key, name: p.name }))
  }, [periodAttendance, staff])

  useEffect(() => {
    if (selectedPersonKey === "all") return
    if (!personOptions.some((p) => p.key === selectedPersonKey)) {
      setSelectedPersonKey("all")
    }
  }, [personOptions, selectedPersonKey])

  useEffect(() => {
    if (!pdfExporting) setPdfExportPersonKey(selectedPersonKey)
  }, [selectedPersonKey, pdfExporting])

  const filteredAttendance = useMemo(() => {
    if (selectedPersonKey === "all") return periodAttendance
    return periodAttendance.filter((r) => attendancePersonKey(r) === selectedPersonKey)
  }, [periodAttendance, selectedPersonKey])

  const pdfSourceAttendance = useMemo(() => {
    if (pdfExportPersonKey === "all") return periodAttendance
    return periodAttendance.filter((r) => attendancePersonKey(r) === pdfExportPersonKey)
  }, [periodAttendance, pdfExportPersonKey])

  const thisMonth = attendance.filter((r) => r.date?.startsWith(todayStr.slice(0, 7))).length
  const pdfPages = useMemo(
    () => buildAttendancePdfPages(pdfSourceAttendance, staff),
    [pdfSourceAttendance, staff]
  )
  const selectedPersonName =
    selectedPersonKey === "all"
      ? null
      : personOptions.find((p) => p.key === selectedPersonKey)?.name ?? null

  const handleExport = () => {
    const rows = filteredAttendance.map((r) => ({
      date: r.date,
      username: r.username,
      check_in: r.check_in ?? "",
      check_out: r.check_out ?? "",
      status: statusFromRecord(r),
    }))
    const headers = ["Date", "Username", "Check-in", "Check-out", "Status"]
    const csv = [headers.join(","), ...rows.map((r) => [r.date, r.username, r.check_in, r.check_out, r.status].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    const personSlug = selectedPersonName
      ? selectedPersonName.replace(/[^a-zA-Z0-9-_]+/g, "_")
      : "all"
    a.download = `attendance-${period}-${filterDate}-${personSlug}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleExportPdf = async (personKey?: string) => {
    const targetKey = personKey ?? selectedPersonKey
    const recordsForPdf =
      targetKey === "all"
        ? periodAttendance
        : periodAttendance.filter((r) => attendancePersonKey(r) === targetKey)

    if (recordsForPdf.length === 0) {
      toast({
        title: "No records to export",
        description: "Change the period, date, or person and try again.",
        variant: "destructive",
      })
      return
    }

    const personLabel =
      targetKey === "all"
        ? "all"
        : (personOptions.find((p) => p.key === targetKey)?.name ?? "person").replace(
            /[^a-zA-Z0-9-_]+/g,
            "_"
          )

    setPdfExporting(true)
    setPdfExportPersonKey(targetKey)
    try {
      // Wait for React to render the filtered PDF pages
      await new Promise((r) => setTimeout(r, 350))
      const el = pdfReportRef.current
      if (!el) throw new Error("PDF report not ready")
      await downloadAttendancePdf(el, `attendance-${period}-${filterDate}-${personLabel}.pdf`)
      toast({
        title: "PDF downloaded",
        description:
          targetKey === "all"
            ? periodLabel(period, filterDate)
            : `${personOptions.find((p) => p.key === targetKey)?.name ?? "Person"} · ${periodLabel(period, filterDate)}`,
      })
    } catch (err) {
      toast({
        title: "PDF export failed",
        description: err instanceof Error ? err.message : "Could not generate PDF",
        variant: "destructive",
      })
    } finally {
      setPdfExporting(false)
      setPdfExportPersonKey(selectedPersonKey)
    }
  }

  const handleView = (row: AttendanceRecord) => {
    setViewRecord(row)
    setViewLoading(true)
    fetchAttendanceById(row.id)
      .then(setViewRecord)
      .catch((err) => {
        toast({
          title: "Could not load record",
          description: err instanceof Error ? err.message : "Failed to load",
          variant: "destructive",
        })
      })
      .finally(() => setViewLoading(false))
  }

  const openEdit = (row: AttendanceRecord) => {
    setEditRecord(row)
    setEditForm({
      date: row.date,
      check_in: toDatetimeLocal(row.check_in),
      check_out: toDatetimeLocal(row.check_out),
    })
  }

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editRecord) return
    setEditSaving(true)
    try {
      await updateAttendance(editRecord.id, {
        date: editForm.date,
        check_in: fromDatetimeLocal(editForm.check_in),
        check_out: fromDatetimeLocal(editForm.check_out),
      })
      toast({ title: "Attendance updated" })
      setEditRecord(null)
      loadData()
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Could not update record",
        variant: "destructive",
      })
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteRecord) return
    setDeleteSaving(true)
    try {
      await deleteAttendance(deleteRecord.id)
      toast({ title: "Attendance deleted", description: "The record has been removed." })
      setDeleteRecord(null)
      loadData()
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Could not delete record",
        variant: "destructive",
      })
    } finally {
      setDeleteSaving(false)
    }
  }

  const userIdNum = selectedUserId ? Number(selectedUserId) : currentUser?.id ?? 0
  const todayRecord = userIdNum ? getTodayRecordForUser(attendance, userIdNum) : undefined
  const canCheckOut = markType === "check_out" && todayRecord

  const handleFaceScan = (file: File) => {
    setMarkError(null)
    setMarking(true)
    recognizeAndMarkAttendance(file, { autoMark: true })
      .then((result) => {
        if (!result.recognized) {
          setMarkError(result.message ?? "Face not recognized.")
          return
        }
        setCameraOpen(false)
        loadData()
        const action =
          result.attendance === "check_in"
            ? "Check-in"
            : result.attendance === "check_out"
              ? "Check-out"
              : result.attendance === "already_complete"
                ? "Already complete for today"
                : "Recognized"
        toast({
          title: `${action}: ${result.username ?? "staff"}`,
          description: `Similarity ${(result.similarity * 100).toFixed(0)}%`,
        })
      })
      .catch((err) => setMarkError(err instanceof Error ? err.message : "Face recognition failed"))
      .finally(() => setMarking(false))
  }

  const handleMarkWithPhoto = (file: File) => {
    setMarkError(null)
    setMarking(true)
    if (markType === "check_in") {
      markCheckIn(userIdNum, file)
        .then(() => {
          setCameraOpen(false)
          loadData()
          toast({ title: "Check-in recorded", description: "Attendance marked successfully." })
        })
        .catch((err) => setMarkError(err instanceof Error ? err.message : "Failed to mark check-in"))
        .finally(() => setMarking(false))
    } else {
      if (!todayRecord) {
        setMarkError("No check-in record found for today. Mark check-in first.")
        setMarking(false)
        return
      }
      markCheckOut(todayRecord.id, file)
        .then(() => {
          setCameraOpen(false)
          loadData()
          toast({ title: "Check-out recorded", description: "Attendance updated successfully." })
        })
        .catch((err) => setMarkError(err instanceof Error ? err.message : "Failed to mark check-out"))
        .finally(() => setMarking(false))
    }
  }

  const staffOptions = [
    ...(currentUser ? [{ id: currentUser.id, label: `Me (${currentUser.username})` }] : []),
    ...staff
      .filter((s) => s.user != null && s.user !== currentUser?.id)
      .map((s) => ({ id: s.user!, label: `${s.full_name ?? "—"} — ${s.department ?? ""}` })),
  ]


  return (
    <ModulePageLayout
      title="Attendance"
      description="InsightFace check-in/out records, face enrollment, CCTV monitor, and reports."
      breadcrumbs={[{ label: "HR" }, { label: "Attendance" }]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.FACE_ENROLLMENT}>Face Enrollment</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.ATTENDANCE_MONITOR}>Monitor</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.ATTENDANCE_DASHBOARD}>Dashboard</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.ATTENDANCE_REPORTS}>Reports</Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Present Today
              </CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{presentToday}</div>
              <p className="text-xs text-muted-foreground mt-1">Checked in today</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Records
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{attendance.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Attendance entries</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Late Today
              </CardTitle>
              <LogIn className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">—</div>
              <p className="text-xs text-muted-foreground mt-1">After 09:15</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                This Month
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{thisMonth}</div>
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </CardContent>
          </Card>
        </div>

        <Card className="w-full min-w-0">
          <CardHeader>
            <CardTitle>Mark attendance (camera)</CardTitle>
           
          </CardHeader>
          <CardContent className="space-y-4 w-full min-w-0">
            {/* {mlHealth && (
              <p className="text-xs text-muted-foreground">
                ML:{" "}
                {mlHealth.status === "ok"
                  ? `connected — ${mlHealth.known_faces ?? 0} known face(s)${mlHealth.yolo_available ? ", YOLO ready" : ", YOLO weights missing"}`
                  : mlHealth.message ?? mlHealth.status}
              </p>
            )} */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label>Mode</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={markMode === "face" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMarkMode("face")}
                  >
                    Face scan
                  </Button>
                  <Button
                    type="button"
                    variant={markMode === "manual" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMarkMode("manual")}
                  >
                    Manual
                  </Button>
                </div>
              </div>
              {markMode === "manual" && (
                <>
                  <div className="space-y-2">
                    <Label>Staff</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger className="w-full sm:w-56">
                        <SelectValue placeholder="Select staff" />
                      </SelectTrigger>
                      <SelectContent>
                        {staffOptions.map((opt) => (
                          <SelectItem key={opt.id} value={String(opt.id)}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={markType === "check_in" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMarkType("check_in")}
                      >
                        Check-in
                      </Button>
                      <Button
                        type="button"
                        variant={markType === "check_out" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMarkType("check_out")}
                      >
                        Check-out
                      </Button>
                    </div>
                  </div>
                </>
              )}
              <Button
                className="w-full bg-[#3b82f6] text-white hover:bg-[#2563eb] sm:w-auto"
                disabled={
                  markMode === "manual" &&
                  (!userIdNum || (markType === "check_out" && !todayRecord))
                }
                onClick={() => {
                  setMarkError(null)
                  setCameraOpen(true)
                }}
              >
                <Camera className="h-4 w-4 mr-2" />
                {markMode === "face" ? "Open camera & scan face" : "Open camera & mark"}
              </Button>
            </div>
            {markMode === "manual" && markType === "check_out" && !todayRecord && selectedUserId && (
              <p className="text-sm text-amber-600">No check-in found for today. Mark check-in first.</p>
            )}
            <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
              <DialogContent className="w-[95vw] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {markMode === "face"
                      ? "Face scan — auto check-in/out"
                      : `${markType === "check_in" ? "Check-in" : "Check-out"} — capture photo`}
                  </DialogTitle>
                </DialogHeader>
                {markError && (
                  <p className="text-sm text-destructive">{markError}</p>
                )}
                <CameraCapture
                  title={markMode === "face" ? "Scan face for attendance" : "Capture attendance photo"}
                  description={
                    markMode === "face"
                      ? "Look at the camera. The system will recognize staff and mark check-in or check-out automatically."
                      : "Position the staff member in frame and capture. The photo will be saved with the attendance record."
                  }
                  onCapture={markMode === "face" ? handleFaceScan : handleMarkWithPhoto}
                  onCancel={() => setCameraOpen(false)}
                />
                {marking && <p className="text-sm text-muted-foreground">Saving…</p>}
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle>
                {period === "day"
                  ? "Day Attendance"
                  : period === "week"
                    ? "Week Attendance"
                    : "Month Attendance"}
              </CardTitle>
              <CardDescription>
                {periodLabel(period, filterDate)}
                {selectedPersonName ? ` · ${selectedPersonName}` : ""}
              </CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
              <Select value={period} onValueChange={(v) => setPeriod(v as AttendancePeriod)}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">1 Day</SelectItem>
                  <SelectItem value="week">1 Week</SelectItem>
                  <SelectItem value="month">1 Month</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                className="w-full sm:w-40"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                title={
                  period === "day"
                    ? "Select day"
                    : period === "week"
                      ? "Any date in the week"
                      : "Any date in the month"
                }
              />
              <Select value={selectedPersonKey} onValueChange={setSelectedPersonKey}>
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue placeholder="Select person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {personOptions.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleExport} className="w-full sm:w-auto">
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleExportPdf()}
                disabled={pdfExporting || periodAttendance.length === 0}
                className="w-full sm:w-auto"
              >
                <FileDown className="h-4 w-4 mr-2" />
                {pdfExporting
                  ? "Preparing PDF…"
                  : selectedPersonKey === "all"
                    ? "Download PDF (all)"
                    : "Download PDF"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="text-sm text-destructive mb-4">{error}</p>
            )}
            {loading ? (
              <p className="text-sm text-muted-foreground py-8">Loading attendance…</p>
            ) : (
            <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
            <Table className="min-w-[960px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Working time</TableHead>
                  <TableHead>Clip</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttendance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      {attendance.length === 0
                        ? "No attendance records yet."
                        : `No records for ${periodLabel(period, filterDate)}. Change the period or date.`}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAttendance.map((row) => {
                    const status = statusFromRecord(row)
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-muted-foreground">{row.date}</TableCell>
                        <TableCell className="font-medium">{row.staff_name ?? "—"}</TableCell>
                        <TableCell>{formatTime(row.check_in)}</TableCell>
                        <TableCell>{formatTime(row.check_out)}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatWorkingTime(row.check_in, row.check_out)}
                        </TableCell>
                        <TableCell>
                          {row.video ? (
                            <video
                              src={resolveMediaUrl(row.video)}
                              controls
                              preload="metadata"
                              poster={row.image ? resolveMediaUrl(row.image) : undefined}
                              className="h-16 w-28 rounded border bg-black object-cover"
                            />
                          ) : row.image ? (
                            <a
                              href={resolveMediaUrl(row.image)}
                              target="_blank"
                              rel="noreferrer"
                              className="block h-12 w-16 overflow-hidden rounded border bg-muted"
                            >
                              <img
                                src={resolveMediaUrl(row.image)}
                                alt={`${row.staff_name ?? row.username ?? "Employee"} attendance`}
                                className="h-full w-full object-cover"
                              />
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              status === "Present" ? "default" : status === "Late" ? "secondary" : "outline"
                            }
                          >
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground text-sm">
                          {row.source || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600"
                              title="View"
                              onClick={() => handleView(row)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-indigo-600"
                              title="Download this person's PDF"
                              disabled={pdfExporting}
                              onClick={() => void handleExportPdf(attendancePersonKey(row))}
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-600"
                              title="Edit"
                              onClick={() => openEdit(row)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600"
                              title="Delete"
                              onClick={() => setDeleteRecord(row)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
            </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={viewRecord !== null} onOpenChange={(open) => !open && setViewRecord(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Attendance record</DialogTitle>
            </DialogHeader>
            {viewRecord && (
              <div className="space-y-4 text-sm">
                {viewLoading && (
                  <p className="text-muted-foreground">Refreshing record…</p>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">Employee</p>
                    <p className="font-medium">{viewRecord.staff_name ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Username</p>
                    <p className="font-medium">{viewRecord.username ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-mono">{viewRecord.date}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p>{statusFromRecord(viewRecord)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Check-in</p>
                    <p>{formatTime(viewRecord.check_in)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Check-out</p>
                    <p>{formatTime(viewRecord.check_out)}</p>
                  </div>
                </div>
                {(viewRecord.video || viewRecord.image) && (
                  <div className="space-y-2">
                    <p className="text-muted-foreground">Proof clip</p>
                    {viewRecord.video ? (
                      <video
                        src={resolveMediaUrl(viewRecord.video)}
                        controls
                        preload="metadata"
                        poster={viewRecord.image ? resolveMediaUrl(viewRecord.image) : undefined}
                        className="max-h-64 w-full rounded border bg-black object-contain"
                      />
                    ) : viewRecord.image ? (
                      <img
                        src={resolveMediaUrl(viewRecord.image)}
                        alt="Attendance proof"
                        className="max-h-64 w-full rounded border object-contain"
                      />
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={editRecord !== null} onOpenChange={(open) => !open && setEditRecord(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit attendance</DialogTitle>
            </DialogHeader>
            {editRecord && (
              <form onSubmit={handleEditSave} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {editRecord.staff_name ?? editRecord.username ?? `Record #${editRecord.id}`}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Date</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-check-in">Check-in</Label>
                  <Input
                    id="edit-check-in"
                    type="datetime-local"
                    value={editForm.check_in}
                    onChange={(e) => setEditForm((f) => ({ ...f, check_in: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-check-out">Check-out</Label>
                  <Input
                    id="edit-check-out"
                    type="datetime-local"
                    value={editForm.check_out}
                    onChange={(e) => setEditForm((f) => ({ ...f, check_out: e.target.value }))}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditRecord(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={editSaving}>
                    {editSaving ? "Saving…" : "Save changes"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteRecord !== null} onOpenChange={(open) => !open && setDeleteRecord(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete attendance record?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the attendance entry for{" "}
                <strong>{deleteRecord?.staff_name ?? deleteRecord?.username ?? "this employee"}</strong> on{" "}
                <strong>{deleteRecord?.date}</strong>. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteSaving}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteSaving}
                onClick={(e) => {
                  e.preventDefault()
                  handleDeleteConfirm()
                }}
              >
                {deleteSaving ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {(pdfPages.length > 0 || pdfExporting) && (
          <AttendancePdfReport
            pages={pdfPages}
            period={period}
            anchorDate={filterDate}
            reportRef={pdfReportRef}
          />
        )}
      </div>
    </ModulePageLayout>
  )
}
