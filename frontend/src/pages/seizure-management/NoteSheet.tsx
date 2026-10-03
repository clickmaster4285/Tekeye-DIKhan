import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  FileDown,
  FilePlus,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
} from "lucide-react"
import { TableActionGroup, TableActionIcon } from "@/components/seizure/table-action-icon"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ROUTES,
  getSeizureMgmtNoteSheetDetailPath,
  getSeizureMgmtNoteSheetEditPath,
} from "@/routes/config"
import {
  canUserDeleteNoteSheet,
  canUserEditNoteSheet,
  deleteNoteSheet,
  fetchNoteSheets,
  type NoteSheetAttachment,
  type NoteSheetItem,
  type NoteSheetRecord,
  type NoteSheetStatus,
  type NoteSheetTimelineStep,
} from "@/lib/seizure-management-api"
import { getStoredUser } from "@/lib/auth"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { saveElementAsPdf } from "@/lib/save-report-pdf"
import NoteSheetReportPrint from "@/components/seizure/NoteSheetReportPrint"

type PeriodPreset = "all" | "today" | "week" | "month" | "custom"

const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100]
const DEFAULT_PAGE_SIZE = 20

const STATUS_META: { id: NoteSheetStatus; label: string; active: string; dot: string }[] = [
  { id: "Draft", label: "Draft", active: "ring-slate-300 bg-slate-50", dot: "bg-slate-400" },
  { id: "Submitted", label: "Submitted", active: "ring-amber-300 bg-amber-50", dot: "bg-amber-500" },
  { id: "Approved", label: "Approved", active: "ring-emerald-300 bg-emerald-50", dot: "bg-emerald-500" },
  { id: "Rejected", label: "Rejected", active: "ring-red-300 bg-red-50", dot: "bg-red-500" },
]

function statusBadge(status: NoteSheetStatus) {
  if (status === "Approved") {
    return (
      <Badge className="rounded-md border-0 bg-sky-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-sky-600">
        Approved
      </Badge>
    )
  }
  if (status === "Submitted") {
    return (
      <Badge className="rounded-md border-0 bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100">
        Submitted
      </Badge>
    )
  }
  if (status === "Rejected") {
    return (
      <Badge className="rounded-md border-0 bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800 hover:bg-red-100">
        Rejected
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-600"
    >
      Draft
    </Badge>
  )
}

function priorityBadge(priority: string | undefined) {
  const p = (priority || "Normal").trim()
  if (!p || p === "Normal") {
    return <span className="text-xs text-muted-foreground">Normal</span>
  }
  if (/high|urgent|critical/i.test(p)) {
    return (
      <Badge className="rounded-md border-0 bg-orange-100 px-1.5 py-0 text-[10px] font-medium text-orange-800 hover:bg-orange-100">
        {p}
      </Badge>
    )
  }
  return <span className="text-xs text-muted-foreground">{p}</span>
}

function printNoteSheet(id: string) {
  window.location.assign(`${getSeizureMgmtNoteSheetDetailPath(id)}?print=full&autoprint=1`)
}

function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function startOfIsoWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const weekday = copy.getDay()
  copy.setDate(copy.getDate() - (weekday === 0 ? 6 : weekday - 1))
  return copy
}

function sheetDay(row: NoteSheetRecord): string | null {
  const raw = row.createdAt || row.dateTime
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return toYmd(d)
}

function formatRangeLabel(from: string, to: string): string {
  const fmt = (value: string) => {
    const [y, m, d] = value.split("-")
    if (!y || !m || !d) return value
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }
  if (!from && !to) return "All time"
  if (from && to && from === to) return fmt(from)
  if (from && to) return `${fmt(from)} – ${fmt(to)}`
  if (from) return `From ${fmt(from)}`
  return `Until ${fmt(to)}`
}

function csvCell(value: unknown): string {
  if (value == null) return '""'
  if (typeof value === "boolean") return csvCell(value ? "Yes" : "No")
  const text = String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  return `"${text.replace(/"/g, '""')}"`
}

function joinNonEmpty(values: Array<string | undefined | null>, sep = "; "): string {
  return values.map((v) => (v || "").trim()).filter(Boolean).join(sep)
}

function formatEvidence(items: string[] | undefined): string {
  return joinNonEmpty(items || [])
}

function formatAttachments(atts: NoteSheetAttachment[] | undefined): string {
  if (!atts?.length) return ""
  return atts
    .map((a) =>
      joinNonEmpty(
        [a.originalFilename, a.fileType ? `(${a.fileType})` : "", a.uploadedAt, a.url],
        " "
      )
    )
    .join(" | ")
}

function formatTimeline(steps: NoteSheetTimelineStep[] | undefined): string {
  if (!steps?.length) return ""
  return steps
    .map((s) => `${s.label}: ${s.at || "—"} (${s.done ? "Done" : "Pending"})`)
    .join(" | ")
}

function formatImageUrls(urls: string[] | undefined): string {
  return joinNonEmpty(urls || [])
}

function detentionMemoLabel(row: NoteSheetRecord): string {
  if (row.detentionMemoId) return "Linked"
  if (row.status === "Approved") return "Ready"
  return ""
}

function emptyGoodsLine(): NoteSheetItem {
  return {
    qrCodeNumber: "",
    product: "",
    description: "",
    pctCode: "",
    quantity: "",
    unit: "",
    condition: "",
    estimatedValue: "",
    assessableValuePkr: "",
    perishable: false,
    identificationRef: "",
    remarks: "",
    itemNotes: "",
    images: [],
  }
}

const NOTE_SHEET_CSV_HEADERS = [
  "Sheet Sr. No",
  "Note Sheet No",
  "Reference Number",
  "Date & Time",
  "Office / Region",
  "Case Number",
  "Priority",
  "Status",
  "Subject",
  "Prepared By",
  "Badge / ID",
  "Designation",
  "Department",
  "Officer Contact",
  "Accused Name",
  "Father Name",
  "CNIC / Passport",
  "Accused Mobile",
  "Accused Address",
  "Business Name",
  "NTN / STRN",
  "Place of Inspection",
  "Warehouse / Shop",
  "GPS Location",
  "Inspection Date",
  "Grounds of Suspicion",
  "Evidence Collected",
  "Preliminary Findings",
  "Additional Notes",
  "Recommendation",
  "Goods Line No",
  "Goods QR Code",
  "Description of Goods",
  "PCT Code",
  "Quantity",
  "Unit",
  "Condition",
  "Assessable Value (PKR)",
  "Perishable",
  "ID / Chassis No",
  "Item Notes",
  "Goods Image URLs",
  "Attachment Count",
  "Attachments",
  "Prepared Signature",
  "Prepared Date",
  "Forward To",
  "Approved By",
  "Approved At",
  "Approval Remarks",
  "Rejection Reason",
  "Submitted At",
  "Viewed At",
  "Detention Memo Status",
  "Created By",
  "Updated By",
  "Created At",
  "Updated At",
  "Timeline",
] as const

function noteSheetCsvRow(
  row: NoteSheetRecord,
  sheetIndex: number,
  item: NoteSheetItem,
  goodsLineNo: number | "",
  hasGoods: boolean
): string {
  return [
    sheetIndex,
    row.noteSheetNo || "",
    row.referenceNumber || "",
    row.dateTime || "",
    row.office || "",
    row.caseNo || "",
    row.priority || "",
    row.status || "",
    row.subject || "",
    row.preparedBy || "",
    row.badgeId || "",
    row.designation || "",
    row.department || "",
    row.officerContact || "",
    row.accusedName || "",
    row.accusedFatherName || "",
    row.accusedCnic || "",
    row.accusedMobile || "",
    row.accusedAddress || "",
    row.businessName || "",
    row.ntnStrn || "",
    row.placeOfInspection || "",
    row.warehouseShop || "",
    row.gpsLocation || "",
    row.inspectionDate || "",
    row.groundsOfSuspicion || "",
    formatEvidence(row.evidenceCollected),
    row.preliminaryFindings || "",
    row.content || "",
    row.recommendation || "",
    goodsLineNo,
    item.qrCodeNumber || "",
    item.product || item.description || "",
    item.pctCode || "",
    item.quantity || "",
    item.unit || "",
    item.condition || "",
    item.assessableValuePkr || item.estimatedValue || "",
    hasGoods ? (item.perishable ? "Yes" : "No") : "",
    item.identificationRef || "",
    item.remarks || item.itemNotes || "",
    formatImageUrls(item.images),
    row.attachments?.length ?? 0,
    formatAttachments(row.attachments),
    row.preparedSignature || "",
    row.preparedDate || "",
    row.forwardTo || "",
    row.approvedBy || "",
    row.approvedAt || "",
    row.approvalRemarks || "",
    row.rejectionReason || "",
    row.submittedAt || "",
    row.viewedAt || "",
    detentionMemoLabel(row),
    row.createdBy || "",
    row.updatedBy || "",
    row.createdAt || "",
    row.updatedAt || "",
    formatTimeline(row.timeline),
  ]
    .map(csvCell)
    .join(",")
}

export default function NoteSheetPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<NoteSheetRecord[]>([])
  const [search, setSearch] = useState("")
  const [period, setPeriod] = useState<PeriodPreset>("all")
  const [statusFilter, setStatusFilter] = useState<NoteSheetStatus | "all">("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pdfRows, setPdfRows] = useState<NoteSheetRecord[] | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const pdfHostRef = useRef<HTMLDivElement>(null)
  const currentUser = getStoredUser()

  const today = toYmd(new Date())
  const weekFrom = toYmd(startOfIsoWeek(new Date()))
  const monthFrom = `${today.slice(0, 7)}-01`

  const activeRange = useMemo(() => {
    if (period === "today") return { from: today, to: today }
    if (period === "week") return { from: weekFrom, to: today }
    if (period === "month") return { from: monthFrom, to: today }
    if (period === "custom") return { from: dateFrom, to: dateTo }
    return { from: "", to: "" }
  }, [period, today, weekFrom, monthFrom, dateFrom, dateTo])

  const load = () => {
    setLoading(true)
    setError(null)
    fetchNoteSheets()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const inActiveRange = (row: NoteSheetRecord) => {
    if (!activeRange.from && !activeRange.to) return true
    const day = sheetDay(row)
    if (!day) return false
    if (activeRange.from && day < activeRange.from) return false
    if (activeRange.to && day > activeRange.to) return false
    return true
  }

  const periodRows = useMemo(() => rows.filter(inActiveRange), [rows, activeRange.from, activeRange.to])

  const counts = useMemo(() => {
    const byDay = (from: string, to: string) =>
      rows.filter((row) => {
        const day = sheetDay(row)
        return Boolean(day && day >= from && day <= to)
      }).length
    const byStatus = (status: NoteSheetStatus) => periodRows.filter((row) => row.status === status).length
    return {
      all: rows.length,
      today: byDay(today, today),
      week: byDay(weekFrom, today),
      month: byDay(monthFrom, today),
      Draft: byStatus("Draft"),
      Submitted: byStatus("Submitted"),
      Approved: byStatus("Approved"),
      Rejected: byStatus("Rejected"),
    }
  }, [rows, periodRows, today, weekFrom, monthFrom])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return periodRows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false
      if (!q) return true
      return (
        (r.noteSheetNo || "").toLowerCase().includes(q) ||
        r.referenceNumber.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        r.caseNo.toLowerCase().includes(q) ||
        (r.office || "").toLowerCase().includes(q) ||
        r.preparedBy.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        (r.priority || "").toLowerCase().includes(q)
      )
    })
  }, [periodRows, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  )
  const pageSerial = (index: number) => (page - 1) * pageSize + index + 1

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, period, dateFrom, dateTo, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const handleDelete = async (row: NoteSheetRecord) => {
    const label = row.noteSheetNo || row.referenceNumber || "this note sheet"
    const approvedHint =
      row.status === "Approved"
        ? " This sheet is already approved. Only a higher official can delete it."
        : ""
    if (!window.confirm(`Delete ${label}? This cannot be undone.${approvedHint}`)) return
    setDeletingId(row.id)
    try {
      await deleteNoteSheet(row.id)
      toast({ title: `${label} deleted` })
      load()
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Could not delete note sheet",
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }

  const exportCsv = () => {
    const lines: string[] = [NOTE_SHEET_CSV_HEADERS.map(csvCell).join(",")]
    filtered.forEach((row, index) => {
      const items = row.items?.length ? row.items : [emptyGoodsLine()]
      const hasGoods = Boolean(row.items?.length)
      items.forEach((item, itemIndex) => {
        lines.push(
          noteSheetCsvRow(row, index + 1, item, hasGoods ? itemIndex + 1 : "", hasGoods)
        )
      })
    })
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `note-sheets-${activeRange.from || "all"}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const pdfBusyRef = useRef(false)

  const exportPdf = () => {
    if (filtered.length === 0 || pdfBusyRef.current) return
    pdfBusyRef.current = true
    setPdfRows(filtered)
  }

  useEffect(() => {
    if (!pdfRows?.length) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          if (!pdfHostRef.current || cancelled) return
          await saveElementAsPdf(pdfHostRef.current, `note-sheets-${activeRange.from || "all"}.pdf`)
        } catch (error) {
          if (!cancelled) {
            toast({
              title: "Could not export PDF",
              description: error instanceof Error ? error.message : "Please try again.",
              variant: "destructive",
            })
          }
        } finally {
          pdfBusyRef.current = false
          if (!cancelled) setPdfRows(null)
        }
      })()
    }, 500)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [pdfRows, activeRange.from])

  const resetFilters = () => {
    setPeriod("all")
    setStatusFilter("all")
    setDateFrom("")
    setDateTo("")
    setSearch("")
    setPage(1)
  }

  const filtersActive = period !== "all" || statusFilter !== "all" || Boolean(search.trim())

  const periodStats: { id: PeriodPreset; label: string; value: number }[] = [
    { id: "all", label: "All time", value: counts.all },
    { id: "today", label: "Today", value: counts.today },
    { id: "week", label: "This week", value: counts.week },
    { id: "month", label: "This month", value: counts.month },
  ]

  return (
    <ModulePageLayout
      title="Note Sheet"
      description="Create and get officer approval on a note sheet before creating a detention memo."
      breadcrumbs={[
        { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
        { label: "Note Sheet" },
      ]}
      actions={
        <Button asChild>
          <Link to={ROUTES.SEIZURE_MGMT_NOTE_SHEET_CREATE}>
            <Plus className="h-4 w-4 mr-2" />
            New Note Sheet
          </Link>
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Summary metrics */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {periodStats.map((stat) => (
            <button
              key={stat.id}
              type="button"
              onClick={() => setPeriod(stat.id)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition-all",
                period === stat.id
                  ? "border-sky-300 bg-sky-50 shadow-sm ring-1 ring-sky-200"
                  : "border-border/80 bg-card hover:border-slate-300 hover:bg-slate-50/80"
              )}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {loading ? "—" : stat.value}
              </p>
            </button>
          ))}
          {STATUS_META.map((stat) => (
            <button
              key={stat.id}
              type="button"
              onClick={() => setStatusFilter((current) => (current === stat.id ? "all" : stat.id))}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition-all",
                statusFilter === stat.id
                  ? cn("shadow-sm ring-1", stat.active)
                  : "border-border/80 bg-card hover:border-slate-300 hover:bg-slate-50/80"
              )}
            >
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span className={cn("h-1.5 w-1.5 rounded-full", stat.dot)} />
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {loading ? "—" : counts[stat.id]}
              </p>
            </button>
          ))}
        </div>

        <Card className="overflow-hidden rounded-xl border-border/80 shadow-sm">
          <CardContent className="space-y-0 p-0">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 border-b bg-slate-50/60 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-border/80">
                  {formatRangeLabel(activeRange.from, activeRange.to)}
                  {statusFilter !== "all" ? ` · ${statusFilter}` : ""}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {filtered.length} of {periodRows.length} shown
                </span>
                {period === "custom" || period === "all" ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value)
                        setPeriod("custom")
                      }}
                      className="h-8 w-[9.5rem] bg-white text-xs"
                      aria-label="From date"
                    />
                    <span className="text-[10px] text-muted-foreground">to</span>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value)
                        setPeriod("custom")
                      }}
                      className="h-8 w-[9.5rem] bg-white text-xs"
                      aria-label="To date"
                    />
                  </div>
                ) : null}
                {filtersActive ? (
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={resetFilters}>
                    Reset
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:ml-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-8 bg-white pl-8 text-sm"
                    placeholder="Search number, subject, case…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 bg-white" disabled={filtered.length === 0}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Export
                      <ChevronDown className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-0 w-max">
                    <DropdownMenuItem onClick={exportCsv}>
                      <Download className="h-4 w-4" />
                      Export CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportPdf}>
                      <FileDown className="h-4 w-4" />
                      Export PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {error ? <p className="px-4 py-2 text-sm text-destructive">{error}</p> : null}

            {/* Table */}
            <div className="w-full max-w-full overflow-x-auto">
              <Table className="min-w-[820px] table-fixed">
                <TableHeader>
                  <TableRow className="border-b bg-slate-50/90 hover:bg-slate-50/90">
                    <TableHead className="sticky left-0 z-20 w-12 bg-slate-50/95 px-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Sr. No
                    </TableHead>
                    <TableHead className="sticky left-12 z-20 w-[10.5rem] bg-slate-50/95 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Note Sheet No.
                    </TableHead>
                    <TableHead className="w-[12rem] max-w-[14rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Subject
                    </TableHead>
                    <TableHead className="w-[5.5rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Case No
                    </TableHead>
                    <TableHead className="w-[6.5rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Prepared By
                    </TableHead>
                    <TableHead className="w-[4.5rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Priority
                    </TableHead>
                    <TableHead className="w-[5.5rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </TableHead>
                    <TableHead className="w-[5.5rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Detention
                    </TableHead>
                    <TableHead className="sticky right-0 z-20 w-[6.5rem] bg-slate-50/95 px-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-14 text-center text-sm text-muted-foreground">
                        Loading note sheets…
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-14 text-center text-sm text-muted-foreground">
                        {rows.length === 0 ? "No note sheets yet." : "No note sheets match these filters."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((row, index) => (
                      <TableRow
                        key={row.id}
                        className="group border-b border-slate-100 transition-colors hover:bg-sky-50/40"
                      >
                        <TableCell className="sticky left-0 z-10 bg-card px-1.5 py-2 text-center text-xs font-medium tabular-nums text-foreground group-hover:bg-sky-50/40">
                          {pageSerial(index)}
                        </TableCell>
                        <TableCell className="sticky left-12 z-10 bg-card px-1.5 py-2 group-hover:bg-sky-50/40">
                          <button
                            type="button"
                            className="max-w-full truncate text-left font-mono text-[12px] font-semibold text-black hover:underline"
                            title={row.noteSheetNo || row.referenceNumber || ""}
                            onClick={() => navigate(getSeizureMgmtNoteSheetDetailPath(row.id))}
                          >
                            {row.noteSheetNo || row.referenceNumber || "—"}
                          </button>
                          {row.office ? (
                            <p className="mt-0.5 max-w-full truncate text-[10px] text-muted-foreground" title={row.office}>
                              {row.office.replace(/^Model Customs Collectorate,?\s*/i, "MCC ")}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="w-[12rem] max-w-[14rem] whitespace-normal px-1.5 py-2">
                          <p
                            className="line-clamp-2 w-full max-w-[14rem] break-words text-sm leading-snug text-foreground"
                            title={row.subject || ""}
                          >
                            {row.subject || "—"}
                          </p>
                        </TableCell>
                        <TableCell className="px-1.5 py-2">
                          <span className="font-mono text-xs tabular-nums text-slate-700">
                            {row.caseNo || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="px-1.5 py-2">
                          <span className="block max-w-full truncate text-sm" title={row.preparedBy || ""}>
                            {row.preparedBy || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="px-1.5 py-2">{priorityBadge(row.priority)}</TableCell>
                        <TableCell className="px-1.5 py-2">{statusBadge(row.status)}</TableCell>
                        <TableCell className="px-1.5 py-2">
                          {row.detentionMemoId ? (
                            <Badge
                              variant="outline"
                              className="rounded-md border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800"
                            >
                              Issued
                            </Badge>
                          ) : row.status === "Approved" ? (
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="h-7 rounded-md border-sky-300 bg-white px-1.5 text-[11px] font-medium text-sky-800 hover:bg-sky-50"
                            >
                              <Link
                                to={`${ROUTES.DETENTION_MEMO_CREATE}?noteSheetId=${encodeURIComponent(row.id)}`}
                              >
                                <FilePlus className="mr-1 h-3 w-3" />
                                Create
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="sticky right-0 z-10 overflow-visible bg-card px-1 py-1.5 text-right group-hover:bg-sky-50/40">
                          <TableActionGroup className="w-auto min-w-0 gap-0">
                            <TableActionIcon
                              label="View"
                              onClick={() => navigate(getSeizureMgmtNoteSheetDetailPath(row.id))}
                            >
                              <Eye className="h-4 w-4" />
                            </TableActionIcon>
                            <TableActionIcon label="Print" onClick={() => printNoteSheet(row.id)}>
                              <Printer className="h-4 w-4" />
                            </TableActionIcon>
                            {(canUserEditNoteSheet(row, currentUser?.role)) && (
                              <TableActionIcon label="Edit" to={getSeizureMgmtNoteSheetEditPath(row.id)}>
                                <Pencil className="h-4 w-4" />
                              </TableActionIcon>
                            )}
                            {canUserDeleteNoteSheet(row, currentUser?.role) && (
                              <TableActionIcon
                                label="Delete"
                                destructive
                                disabled={deletingId === row.id}
                                onClick={() => void handleDelete(row)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </TableActionIcon>
                            )}
                          </TableActionGroup>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {filtered.length > 0 ? (
              <div className="flex flex-col gap-3 border-t bg-slate-50/40 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Rows per page</span>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => {
                      setPageSize(Number(value))
                      setPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 w-[72px] bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={size.toString()}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of{" "}
                    {filtered.length}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1 lg:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="h-8 w-8 bg-white p-0"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="h-8 w-8 bg-white p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-2 text-xs tabular-nums text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page === totalPages}
                    className="h-8 w-8 bg-white p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="h-8 w-8 bg-white p-0"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div
        ref={pdfHostRef}
        aria-hidden
        className="pointer-events-none fixed -left-[100vw] top-0 w-[210mm] opacity-0"
      >
        {pdfRows?.map((row) => (
          <NoteSheetReportPrint key={row.id} row={row} embedded />
        ))}
      </div>
    </ModulePageLayout>
  )
}
