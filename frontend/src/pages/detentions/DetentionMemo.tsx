import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { AlertTriangle, BookOpen, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, Package, Plus, Printer, Search, Edit2, Trash2 } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { TableActionGroup, TableActionIcon } from "@/components/seizure/table-action-icon"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ROUTES, getDetentionMemoCreatePath, getDetentionMemoDetailPath, getDetentionMemoEditPath, getDetentionMemoSectionCrumb } from "@/routes/config"
import { fetchDetentionMemos, deleteDetentionMemo, type DetentionMemoApiRecord } from "@/lib/detention-memo-api"
import { createDepositAccountEntry, fetchDepositAccounts } from "@/lib/deposit-account-api"
import { promoteDetentionToSeizedAndInventory } from "@/lib/wms-stock-storage"
import { toast } from "@/components/ui/use-toast"
import { ExportMenu } from "@/components/seizure/export-menu"
import DetentionMemoReportPrint from "@/components/detention/DetentionMemoReportPrint"
import { downloadDetentionMemoCsv } from "@/lib/detention-memo-csv"
import { useBatchPdfExport } from "@/hooks/use-batch-pdf-export"
import { PdfExportHost } from "@/components/seizure/pdf-export-host"
import { canUserFullyEditSeizureDocs } from "@/lib/seizure-management-api"
import { getStoredUser } from "@/lib/auth"
const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100]
const DEFAULT_PAGE_SIZE = 20
const DETENTION_ALERT_DAYS = 60

type DetentionMemoRow = DetentionMemoApiRecord & {
  serialNo?: number
  year?: number
}

function extractSerialInfo(caseNo: string): { serialNo: number; year: number } | null {
  const match = caseNo.match(/(\d+)\/(\d{4})/)
  if (match) {
    return { serialNo: parseInt(match[1], 10), year: parseInt(match[2], 10) }
  }
  return null
}

function isDetentionOverTwoMonths(dateTimeDetention: string): boolean {
  if (!dateTimeDetention?.trim()) return false
  try {
    const det = new Date(dateTimeDetention.replace(" ", "T"))
    const days = (new Date().getTime() - det.getTime()) / (1000 * 60 * 60 * 24)
    return days > DETENTION_ALERT_DAYS
  } catch {
    return false
  }
}

function printMemo(id: string, pathname?: string) {
  const reportUrl = `${getDetentionMemoDetailPath(id, pathname)}?print=full&autoprint=1`
  window.location.assign(reportUrl)
}

function printQr(id: string, pathname?: string) {
  const reportUrl = `${getDetentionMemoDetailPath(id, pathname)}?print=qr&autoprint=1`
  window.location.assign(reportUrl)
}

export default function DetentionMemoPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const listSection = getDetentionMemoSectionCrumb(pathname)
  const createPath = getDetentionMemoCreatePath(pathname)
  const [rows, setRows] = useState<DetentionMemoRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [caseNumberSearch, setCaseNumberSearch] = useState("")
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [page, setPage] = useState(1)
  const [memoIdsWithDeposit, setMemoIdsWithDeposit] = useState<Set<string>>(() => new Set())
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DetentionMemoRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    Promise.all([fetchDetentionMemos(), fetchDepositAccounts().catch(() => [])])
      .then(([list, deposits]) => {
        if (cancelled) return
        const ids = new Set<string>()
        for (const d of deposits) {
          const mid = d.detentionMemoId?.trim()
          if (mid) ids.add(mid)
        }
        setMemoIdsWithDeposit(ids)
        const mapped = list.map((r) => {
          const serialInfo = extractSerialInfo(r.caseNo)
          return {
            ...r,
            updatedAt: r.updatedAt ?? r.createdAt,
            createdBy: r.createdBy ?? "ASO Portal",
            serialNo: serialInfo?.serialNo,
            year: serialInfo?.year,
          }
        })
        setRows(mapped)
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load detention memos.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filteredRows = useMemo(() => {
    if (!caseNumberSearch.trim()) return rows
    const q = caseNumberSearch.trim().toLowerCase()
    return rows.filter(
      (r) =>
        r.caseNo.toLowerCase().includes(q) ||
        (r.referenceNumber ?? "").toLowerCase().includes(q)
    )
  }, [rows, caseNumberSearch])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const pageRows = useMemo(() => filteredRows.slice((page - 1) * pageSize, page * pageSize), [filteredRows, page, pageSize])

  const handleSearch = () => setPage(1)
  const handleClear = () => { setCaseNumberSearch(""); setPage(1) }

  const pdf = useBatchPdfExport<DetentionMemoRow>(`detention-memos-${new Date().toISOString().slice(0, 10)}.pdf`)

  const exportCsv = () => {
    downloadDetentionMemoCsv(`detention-memos-${new Date().toISOString().slice(0, 10)}.csv`, filteredRows)
  }

  const handleSeize = async (row: DetentionMemoRow) => {
    const ok = await promoteDetentionToSeizedAndInventory(row)
    if (ok) {
      alert(
        `✓ Case ${row.caseNo || row.id} added to Seizure Register and Stock Management.\n` +
          "All goods lines are in stock with the detention case number linked."
      )
    } else {
      alert("✗ Could not add to Seizure Register.")
    }
  }

  const handleDeposit = async (row: DetentionMemoRow) => {
    if (memoIdsWithDeposit.has(row.id)) return
    try {
      await createDepositAccountEntry({
        detentionMemoId: row.id,
        treasuryChallanNo: "",
        depositType: "Detention",
        caseSeizureRef: row.caseNo,
        firNo: "",
        customsStation: row.placeOfDetention,
        amount: "",
        depositDate: new Date().toISOString().slice(0, 10),
        bankTreasuryName: "",
        status: "Pending",
        remarks:
          `Detention deposit linked to memo ${row.caseNo}` +
          (row.referenceNumber ? ` (ref ${row.referenceNumber})` : ""),
      })
      setMemoIdsWithDeposit((prev) => new Set(prev).add(row.id))
      alert(
        "Deposit entry saved on the server.\n\nGo to Detentions → Deposit Account Register to add treasury challan, amount, or bank details when issued."
      )
    } catch (e) {
      alert(
        `Could not save deposit: ${e instanceof Error ? e.message : "unknown error"}\n\nCheck that the API is running (VITE_API_BASE_URL).`
      )
    }
  }

  const handleDeleteClick = (row: DetentionMemoRow) => {
    setDeleteTarget(row)
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDetentionMemo(deleteTarget.id)
      toast({
        title: "Deleted",
        description: `Detention memo ${deleteTarget.caseNo} has been removed.`,
      })
      setDeleteConfirmOpen(false)
      setDeleteTarget(null)
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id))
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Could not delete memo.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleEdit = (row: DetentionMemoRow) => {
    if (canUserFullyEditSeizureDocs(getStoredUser()?.role)) {
      navigate(getDetentionMemoEditPath(row.id, pathname))
      return
    }
    navigate(getDetentionMemoDetailPath(row.id, pathname))
  }

  const stats = useMemo(() => {
    const verified = rows.filter((r) => r.verificationStatus === "Verified").length
    const alerts = rows.filter((r) => isDetentionOverTwoMonths(r.dateTimeDetention)).length
    return {
      total: rows.length,
      verified,
      pending: rows.length - verified,
      alerts,
    }
  }, [rows])

  const pageSerial = (index: number) => (page - 1) * pageSize + index + 1

  return (
    <ModulePageLayout
      title="Detention Memo"
      description="Create, view, and print detention memo records. Deposit is available once per memo."
      breadcrumbs={[listSection, { label: "Detention Memo" }]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" asChild>
            <Link to={ROUTES.SEIZURE_MGMT_NOTE_SHEET}>
              <Plus className="mr-1.5 h-4 w-4" />
              Note Sheet
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={createPath}>Create Memo</Link>
          </Button>
          <ExportMenu
            disabled={filteredRows.length === 0}
            onExportCsv={exportCsv}
            onExportPdf={() => pdf.start(filteredRows)}
          />
        </div>
      }
    >
      <div className="space-y-4">
        {loadError ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadError}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Total Memos", value: stats.total, tone: "text-foreground" },
            { label: "Verified", value: stats.verified, tone: "text-emerald-700" },
            { label: "Pending Verify", value: stats.pending, tone: "text-amber-700" },
            { label: "Over 60 Days", value: stats.alerts, tone: "text-orange-700" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border/80 bg-card px-3 py-3 shadow-sm"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${stat.tone}`}>
                {loading ? "—" : stat.value}
              </p>
            </div>
          ))}
        </div>

        <Card className="overflow-hidden rounded-xl border-border/80 shadow-sm">
          <CardContent className="space-y-0 p-0">
            <div className="flex flex-col gap-3 border-b bg-slate-50/60 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={caseNumberSearch}
                    onChange={(e) => {
                      setCaseNumberSearch(e.target.value)
                      setPage(1)
                    }}
                    placeholder="Search case or memo no…"
                    className="h-8 bg-white pl-8 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
                {caseNumberSearch ? (
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={handleClear}>
                    Clear
                  </Button>
                ) : null}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {filteredRows.length} of {rows.length} shown
                </span>
              </div>
              <Link
                className="text-xs font-medium text-sky-700 hover:underline"
                to={ROUTES.DEPOSIT_ACCOUNT_REGISTER}
              >
                Deposit Account Register →
              </Link>
            </div>

            {/* Mobile */}
            <div className="space-y-2 p-3 md:hidden">
              {loading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
              ) : pageRows.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-10 text-center text-muted-foreground">
                  <Package className="mx-auto mb-2 h-8 w-8 opacity-30" />
                  No detention memos found
                </div>
              ) : (
                pageRows.map((row, index) => {
                  const isAlert = isDetentionOverTwoMonths(row.dateTimeDetention)
                  return (
                    <div key={row.id} className="rounded-xl border bg-card p-3 shadow-sm">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Sr. {pageSerial(index)}
                          </p>
                          <p className="truncate font-mono text-sm font-semibold text-black">{row.caseNo}</p>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">
                            {row.referenceNumber || "—"}
                          </p>
                        </div>
                        {row.verificationStatus === "Verified" ? (
                          <Badge className="rounded-md border-0 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 hover:bg-emerald-100">
                            Verified
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                          >
                            {row.verificationStatus || "Pending"}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Date</p>
                          <p className="tabular-nums">{row.dateTimeDetention?.slice(0, 16) || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Created by</p>
                          <p className="truncate">{row.createdBy || "—"}</p>
                        </div>
                        {isAlert ? (
                          <div className="col-span-2">
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                              <AlertTriangle className="h-3 w-3" /> Over 60 days
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap justify-end gap-0.5 border-t pt-2">
                        <TableActionIcon label="View" to={getDetentionMemoDetailPath(row.id, pathname)}>
                          <Eye className="h-4 w-4" />
                        </TableActionIcon>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Print" aria-label="Print">
                              <Printer className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => printQr(row.id, pathname)}>Print QR Code</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => printMemo(row.id, pathname)}>Print Full Report</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <TableActionIcon
                          label={memoIdsWithDeposit.has(row.id) ? "Already deposited" : "Add to Deposit Account"}
                          disabled={memoIdsWithDeposit.has(row.id)}
                          onClick={() => void handleDeposit(row)}
                        >
                          <BookOpen className="h-4 w-4" />
                        </TableActionIcon>
                        <TableActionIcon label="Seize" onClick={() => void handleSeize(row)}>
                          <Package className="h-4 w-4" />
                        </TableActionIcon>
                        <TableActionIcon label="Edit" onClick={() => handleEdit(row)}>
                          <Edit2 className="h-4 w-4" />
                        </TableActionIcon>
                        <TableActionIcon label="Delete" destructive onClick={() => handleDeleteClick(row)}>
                          <Trash2 className="h-4 w-4" />
                        </TableActionIcon>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden w-full max-w-full overflow-x-auto md:block">
              <Table className="min-w-[920px] table-fixed">
                <TableHeader>
                  <TableRow className="border-b bg-slate-50/90 hover:bg-slate-50/90">
                    <TableHead className="w-12 px-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Sr. No
                    </TableHead>
                    <TableHead className="w-[9rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Case No
                    </TableHead>
                    <TableHead className="w-[8rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Memo No
                    </TableHead>
                    <TableHead className="w-[8rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Date
                    </TableHead>
                    <TableHead className="w-[5.5rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </TableHead>
                    <TableHead className="w-[7rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Posted
                    </TableHead>
                    <TableHead className="w-[7rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Updated
                    </TableHead>
                    <TableHead className="w-[4rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Alert
                    </TableHead>
                    <TableHead className="w-[6.5rem] px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Created By
                    </TableHead>
                    <TableHead className="sticky right-0 z-20 w-[7.5rem] bg-slate-50/95 px-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-14 text-center text-sm text-muted-foreground">
                        Loading detention memos…
                      </TableCell>
                    </TableRow>
                  ) : pageRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-14 text-center text-sm text-muted-foreground">
                        <Package className="mx-auto mb-2 h-8 w-8 opacity-30" />
                        No detention memos found
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((row, index) => {
                      const isAlert = isDetentionOverTwoMonths(row.dateTimeDetention)
                      return (
                        <TableRow
                          key={row.id}
                          className="group border-b border-slate-100 transition-colors hover:bg-sky-50/40"
                        >
                          <TableCell className="px-1.5 py-2 text-center text-xs font-medium tabular-nums text-foreground">
                            {pageSerial(index)}
                          </TableCell>
                          <TableCell className="px-1.5 py-2">
                            <button
                              type="button"
                              className="max-w-full truncate text-left font-mono text-[12px] font-semibold text-black hover:underline"
                              title={row.caseNo}
                              onClick={() => navigate(getDetentionMemoDetailPath(row.id, pathname))}
                            >
                              {row.caseNo || "—"}
                            </button>
                          </TableCell>
                          <TableCell className="px-1.5 py-2">
                            <span
                              className="block max-w-full truncate font-mono text-[11px] text-black"
                              title={row.referenceNumber || ""}
                            >
                              {row.referenceNumber || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="px-1.5 py-2 text-xs tabular-nums text-slate-700">
                            {row.dateTimeDetention?.slice(0, 16) || "—"}
                          </TableCell>
                          <TableCell className="px-1.5 py-2">
                            {row.verificationStatus === "Verified" ? (
                              <Badge className="rounded-md border-0 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 hover:bg-emerald-100">
                                Verified
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                              >
                                {row.verificationStatus || "Pending"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="px-1.5 py-2 text-xs tabular-nums text-slate-600">
                            {(row.createdAt || "").slice(0, 10) || "—"}
                          </TableCell>
                          <TableCell className="px-1.5 py-2 text-xs tabular-nums text-slate-600">
                            {(row.updatedAt ?? row.createdAt ?? "").toString().slice(0, 10) || "—"}
                          </TableCell>
                          <TableCell className="px-1.5 py-2">
                            {isAlert ? (
                              <span
                                className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 p-1 text-amber-700"
                                title="Over 60 days — consider transfer to Seizure Register"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="px-1.5 py-2">
                            <span className="block max-w-full truncate text-xs" title={row.createdBy || ""}>
                              {row.createdBy || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="sticky right-0 z-10 overflow-visible bg-card px-1 py-1.5 text-right group-hover:bg-sky-50/40">
                            <TableActionGroup className="w-auto min-w-0 gap-0">
                              <TableActionIcon label="View" to={getDetentionMemoDetailPath(row.id, pathname)}>
                                <Eye className="h-4 w-4" />
                              </TableActionIcon>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Print" aria-label="Print">
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => printQr(row.id, pathname)}>Print QR Code</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => printMemo(row.id, pathname)}>Print Full Report</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <TableActionIcon
                                label={memoIdsWithDeposit.has(row.id) ? "Already deposited" : "Add to Deposit Account"}
                                disabled={memoIdsWithDeposit.has(row.id)}
                                onClick={() => void handleDeposit(row)}
                              >
                                <BookOpen className="h-4 w-4" />
                              </TableActionIcon>
                              <TableActionIcon label="Seize" onClick={() => void handleSeize(row)}>
                                <Package className="h-4 w-4" />
                              </TableActionIcon>
                              <TableActionIcon label="Edit" onClick={() => handleEdit(row)}>
                                <Edit2 className="h-4 w-4" />
                              </TableActionIcon>
                              <TableActionIcon label="Delete" destructive onClick={() => handleDeleteClick(row)}>
                                <Trash2 className="h-4 w-4" />
                              </TableActionIcon>
                            </TableActionGroup>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {filteredRows.length > 0 ? (
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
                    {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredRows.length)} of{" "}
                    {filteredRows.length}
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

        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Detention Memo?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the detention memo for case {deleteTarget?.caseNo}. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex justify-end gap-4">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <PdfExportHost hostRef={pdf.hostRef}>
        {pdf.items?.map((row) => (
          <DetentionMemoReportPrint key={row.id} row={row} embedded />
        ))}
      </PdfExportHost>
    </ModulePageLayout>
  )
}