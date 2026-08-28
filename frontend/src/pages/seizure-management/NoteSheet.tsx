import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Download, Eye, FileDown, FilePlus, Loader2, Pencil, Plus, Printer, Search, Trash2, ChevronDown } from "lucide-react"
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

const STATUS_META: { id: NoteSheetStatus; label: string; active: string; dot: string }[] = [
  { id: "Draft", label: "Draft", active: "ring-slate-300 bg-slate-50", dot: "bg-slate-400" },
  { id: "Submitted", label: "Submitted", active: "ring-amber-300 bg-amber-50", dot: "bg-amber-500" },
  { id: "Approved", label: "Approved", active: "ring-emerald-300 bg-emerald-50", dot: "bg-emerald-500" },
  { id: "Rejected", label: "Rejected", active: "ring-red-300 bg-red-50", dot: "bg-red-500" },
]

function statusBadge(status: NoteSheetStatus) {
  if (status === "Approved") return <Badge>Approved</Badge>
  if (status === "Submitted") return <Badge variant="secondary">Submitted</Badge>
  if (status === "Rejected") return <Badge variant="destructive">Rejected</Badge>
  return <Badge variant="outline">Draft</Badge>
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
  "Record ID",
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
  "Goods Line ID",
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
  "Forward To User ID",
  "Approved By",
  "Approved At",
  "Approval Remarks",
  "Rejection Reason",
  "Submitted At",
  "Viewed At",
  "Detention Memo Status",
  "Detention Memo ID",
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
    row.id,
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
    item.id || "",
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
    row.forwardToUserId ?? "",
    row.approvedBy || "",
    row.approvedAt || "",
    row.approvalRemarks || "",
    row.rejectionReason || "",
    row.submittedAt || "",
    row.viewedAt || "",
    detentionMemoLabel(row),
    row.detentionMemoId || "",
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

  const pdfExporting = Boolean(pdfRows?.length)

  const exportPdf = () => {
    if (filtered.length === 0 || pdfExporting) return
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
      <Card className="rounded-[10px] border-gray-200 overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-x divide-y lg:divide-y-0 divide-gray-100 border-b">
          {periodStats.map((stat) => (
            <button
              key={stat.id}
              type="button"
              onClick={() => setPeriod(stat.id)}
              className={cn(
                "p-3.5 text-left transition-colors",
                period === stat.id ? "bg-blue-50" : "bg-white hover:bg-gray-50"
              )}
            >
              <p className="text-[11px] text-[#697282]">{stat.label}</p>
              <p className="text-xl font-bold text-[#101727] tabular-nums">{loading ? "—" : stat.value}</p>
            </button>
          ))}
          {STATUS_META.map((stat) => (
            <button
              key={stat.id}
              type="button"
              onClick={() => setStatusFilter((current) => (current === stat.id ? "all" : stat.id))}
              className={cn(
                "p-3.5 text-left transition-colors",
                statusFilter === stat.id ? stat.active : "bg-white hover:bg-gray-50"
              )}
            >
              <p className="text-[11px] text-[#697282] flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", stat.dot)} />
                {stat.label}
              </p>
              <p className="text-xl font-bold text-[#101727] tabular-nums">{loading ? "—" : counts[stat.id]}</p>
            </button>
          ))}
        </div>

        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-[#697282]">
                {formatRangeLabel(activeRange.from, activeRange.to)}
                {statusFilter !== "all" ? ` · ${statusFilter}` : ""}
                {" · "}
                {filtered.length} shown
              </p>
              {period === "custom" || period === "all" ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value)
                      setPeriod("custom")
                    }}
                    className="h-9 w-[10.5rem]"
                    aria-label="From date"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value)
                      setPeriod("custom")
                    }}
                    className="h-9 w-[10.5rem]"
                    aria-label="To date"
                  />
                </div>
              ) : null}
              {filtersActive ? (
                <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                  Reset
                </Button>
              ) : null}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-9"
                  placeholder="Search number, subject, case…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={filtered.length === 0 || pdfExporting}
                  >
                    {pdfExporting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {pdfExporting ? "Exporting PDF…" : "Export"}
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={exportCsv}>
                    <Download className="h-4 w-4" />
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportPdf} disabled={pdfExporting}>
                    <FileDown className="h-4 w-4" />
                    Export PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Table className="table-fixed w-full" containerClassName="overflow-x-hidden">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[4.5rem]">Sr. No</TableHead>
                <TableHead className="w-[12%]">Note Sheet No.</TableHead>
                <TableHead className="w-[16%]">Subject</TableHead>
                <TableHead className="w-[10%]">Case No</TableHead>
                <TableHead className="w-[14%]">Office</TableHead>
                <TableHead className="w-[8%]">Priority</TableHead>
                <TableHead className="w-[12%]">Prepared By</TableHead>
                <TableHead className="w-[8%]">Status</TableHead>
                <TableHead className="w-[8%]">Detention Memo</TableHead>
                <TableHead className="w-[7.5rem] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    {rows.length === 0 ? "No note sheets yet." : "No note sheets match these filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground tabular-nums">{index + 1}</TableCell>
                    <TableCell className="font-medium font-mono text-sm truncate" title={row.noteSheetNo || row.referenceNumber || ""}>
                      {row.noteSheetNo || row.referenceNumber || "—"}
                    </TableCell>
                    <TableCell className="truncate" title={row.subject || ""}>
                      {row.subject || "—"}
                    </TableCell>
                    <TableCell className="truncate" title={row.caseNo || ""}>
                      {row.caseNo || "—"}
                    </TableCell>
                    <TableCell className="truncate" title={row.office || ""}>
                      {row.office || "—"}
                    </TableCell>
                    <TableCell className="truncate">{row.priority || "—"}</TableCell>
                    <TableCell className="truncate" title={row.preparedBy || ""}>
                      {row.preparedBy || "—"}
                    </TableCell>
                    <TableCell>{statusBadge(row.status)}</TableCell>
                    <TableCell>
                      {row.detentionMemoId ? (
                        <Badge variant="outline">Linked</Badge>
                      ) : row.status === "Approved" ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Ready</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="overflow-visible p-2 text-right align-middle">
                      <TableActionGroup>
                        <TableActionIcon
                          label="View"
                          onClick={() => navigate(getSeizureMgmtNoteSheetDetailPath(row.id))}
                        >
                          <Eye className="h-4 w-4" />
                        </TableActionIcon>
                        <TableActionIcon label="Print" onClick={() => printNoteSheet(row.id)}>
                          <Printer className="h-4 w-4" />
                        </TableActionIcon>
                        {(row.status === "Draft" || row.status === "Rejected") && (
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
                        {row.status === "Approved" && !row.detentionMemoId && (
                          <TableActionIcon
                            label="Create Detention Memo"
                            to={`${ROUTES.DETENTION_MEMO_CREATE}?noteSheetId=${encodeURIComponent(row.id)}`}
                          >
                            <FilePlus className="h-4 w-4" />
                          </TableActionIcon>
                        )}
                      </TableActionGroup>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div
        ref={pdfHostRef}
        aria-hidden
        className="pointer-events-none fixed left-[-10000px] top-0 w-[210mm] bg-white"
      >
        {pdfRows?.map((row) => (
          <NoteSheetReportPrint key={row.id} row={row} embedded />
        ))}
      </div>
    </ModulePageLayout>
  )
}
