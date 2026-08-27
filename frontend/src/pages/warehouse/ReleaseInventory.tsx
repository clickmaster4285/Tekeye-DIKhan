import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, Package, Warehouse, LogOut } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ROUTES } from "@/routes/config"
import { CUSTOMS_STATIONS } from "@/lib/case-fir-spec"
import { Checkbox } from "@/components/ui/checkbox"
import { fetchDetentionMemoById, updateDetentionMemo } from "@/lib/detention-memo-api"
import {
  fetchDepositAccounts,
  updateDepositAccountEntry,
  type DepositAccountRow,
} from "@/lib/deposit-account-api"
import { promoteDepositToSeizedAndInventory } from "@/lib/wms-stock-storage"
const RELEASE_STORAGE_KEY = "wms_release_inventory"
const RELEASE_ALERT_DAYS = 60
const DEPOSIT_STATUS_RELEASED = "Released"
const DEPOSIT_STATUS_FORWARDED_SEIZURE = "Forwarded to seizure"

function isDepositTerminal(row: DepositRow): boolean {
  const s = (row.status || "").trim()
  return s === DEPOSIT_STATUS_RELEASED || s === DEPOSIT_STATUS_FORWARDED_SEIZURE
}

const WAREHOUSE_OPTIONS = [
  "State Warehouse, Kohat Tunnel",
  "State Warehouse, Bannu",
  "State Warehouse, Salt House, Kohat",
  "State Warehouse, D.I Khan",
  "Bonded Godown A",
  "Bonded Godown B",
  "Transit Shed",
  "Customs House Peshawar",
  "Customs House Yarik",
]

type DepositRow = DepositAccountRow

type ReleaseRecord = {
  id: string
  qrCodeNumber: string
  warehouse: string
  firNumber: string
  stackCount: string
  treasuryChallanNo: string
  caseSeizureRef: string
  customsStation: string
  depositDate: string
  amount: string
  bankTreasuryName: string
  sourceDepositId: string
  releasedAt: string
  remarks: string
}

function loadReleaseRecords(): ReleaseRecord[] {
  try {
    const raw = window.localStorage.getItem(RELEASE_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {}
  return []
}

function saveReleaseRecords(rows: ReleaseRecord[]) {
  window.localStorage.setItem(RELEASE_STORAGE_KEY, JSON.stringify(rows))
}

function daysInDeposit(depositDate: string): number | null {
  if (!depositDate || !depositDate.trim()) return null
  try {
    const d = new Date(depositDate)
    const now = new Date()
    return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  } catch {
    return null
  }
}

export default function ReleaseInventoryPage() {
  const [depositRows, setDepositRows] = useState<DepositRow[]>([])
  const [releaseRecords, setReleaseRecords] = useState<ReleaseRecord[]>([])
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [releaseForm, setReleaseForm] = useState({
    qrCodeNumber: "",
    warehouse: "",
    firNumber: "",
    stackCount: "",
    treasuryChallanNo: "",
    caseSeizureRef: "",
    customsStation: "",
    depositDate: "",
    amount: "",
    bankTreasuryName: "",
    remarks: "",
  })
  const [releaseSourceDeposit, setReleaseSourceDeposit] = useState<DepositRow | null>(null)
  const [closeLinkedMemoOnRelease, setCloseLinkedMemoOnRelease] = useState(true)
  const [releaseSaving, setReleaseSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const d = await fetchDepositAccounts()
        if (!cancelled) setDepositRows(d)
      } catch {
        if (!cancelled) setDepositRows([])
      }
    })()
    setReleaseRecords(loadReleaseRecords())
    return () => {
      cancelled = true
    }
  }, [])

  const detentionDeposits = useMemo(
    () => depositRows.filter((r) => r.depositType === "Detention"),
    [depositRows]
  )

  const handleTransferToSeizure = async (row: DepositRow) => {
    const stamp = new Date().toISOString().slice(0, 10)
    const line = `[${stamp}] Forwarded to seizure register: documents not furnished.`
    const mergedRemarks = [row.remarks?.trim(), line].filter(Boolean).join("\n")
    try {
      await updateDepositAccountEntry(row.id, {
        status: DEPOSIT_STATUS_FORWARDED_SEIZURE,
        remarks: mergedRemarks,
      })
    } catch (e) {
      window.alert(
        `Could not update deposit on server: ${e instanceof Error ? e.message : "unknown error"}. Transfer was not recorded.`
      )
      return
    }
    const synced = await promoteDepositToSeizedAndInventory(
      { ...row, remarks: mergedRemarks },
      "Documents not furnished — goods transferred from Deposit Account Register to seizure."
    )
    if (synced) {
      window.alert(
        "Deposit marked as forwarded.\n\nAdded to Seizure Register and Stock Management.\n\nView under Seizure & Receipt → Seizure Register."
      )
      void fetchDepositAccounts().then(setDepositRows).catch(() => setDepositRows([]))
    } else {
      window.alert("Server updated but local seizure/stock sync failed. Refresh and retry if needed.")
    }
  }

  const openReleaseDialog = (row: DepositRow) => {
    setCloseLinkedMemoOnRelease(true)
    setReleaseSourceDeposit(row)
    setReleaseForm({
      qrCodeNumber: "",
      warehouse: row.bankTreasuryName || "",
      firNumber: row.firNo || "",
      stackCount: "",
      treasuryChallanNo: row.treasuryChallanNo || "",
      caseSeizureRef: row.caseSeizureRef || "",
      customsStation: row.customsStation || "",
      depositDate: row.depositDate || "",
      amount: row.amount || "",
      bankTreasuryName: row.bankTreasuryName || "",
      remarks: row.remarks || "",
    })
    setReleaseOpen(true)
  }

  const handleReleaseSubmit = async () => {
    if (!releaseForm.qrCodeNumber.trim()) {
      window.alert("QR Code number is required.")
      return
    }
    if (!releaseForm.warehouse.trim()) {
      window.alert("Warehouse (from which) is required.")
      return
    }
    if (!releaseSourceDeposit) return
    const releasedAt = new Date().toISOString().slice(0, 19).replace("T", " ")
    const record: ReleaseRecord = {
      id: `rel-${Date.now()}`,
      qrCodeNumber: releaseForm.qrCodeNumber.trim(),
      warehouse: releaseForm.warehouse.trim(),
      firNumber: releaseForm.firNumber.trim(),
      stackCount: releaseForm.stackCount.trim(),
      treasuryChallanNo: releaseForm.treasuryChallanNo.trim(),
      caseSeizureRef: releaseForm.caseSeizureRef.trim(),
      customsStation: releaseForm.customsStation.trim(),
      depositDate: releaseForm.depositDate,
      amount: releaseForm.amount.trim(),
      bankTreasuryName: releaseForm.bankTreasuryName.trim(),
      sourceDepositId: releaseSourceDeposit.id,
      releasedAt,
      remarks: releaseForm.remarks.trim(),
    }
    const depositRemarkParts = [
      releaseSourceDeposit.remarks?.trim(),
      releaseForm.remarks.trim(),
      `Released to party ${releasedAt}; QR ${releaseForm.qrCodeNumber.trim()}; warehouse ${releaseForm.warehouse.trim()}.`,
    ].filter(Boolean)
    setReleaseSaving(true)
    try {
      await updateDepositAccountEntry(releaseSourceDeposit.id, {
        status: DEPOSIT_STATUS_RELEASED,
        treasuryChallanNo: releaseForm.treasuryChallanNo.trim(),
        caseSeizureRef: releaseForm.caseSeizureRef.trim(),
        firNo: releaseForm.firNumber.trim(),
        customsStation: releaseForm.customsStation.trim(),
        depositDate: releaseForm.depositDate,
        amount: releaseForm.amount.trim(),
        bankTreasuryName: releaseForm.bankTreasuryName.trim(),
        remarks: depositRemarkParts.join("\n"),
      })
      const memoId = releaseSourceDeposit.detentionMemoId?.trim()
      if (closeLinkedMemoOnRelease && memoId) {
        try {
          const memo = await fetchDetentionMemoById(memoId)
          await updateDetentionMemo(memo, { settlementStatus: "Fully Settled" })
        } catch (e) {
          window.alert(
            `Deposit was marked Released but the linked detention memo could not be updated: ${e instanceof Error ? e.message : "unknown error"}. You can settle the memo manually.`
          )
        }
      }
    } catch (e) {
      window.alert(
        `Could not save deposit release on server: ${e instanceof Error ? e.message : "unknown error"}. Local release record was not added.`
      )
      return
    } finally {
      setReleaseSaving(false)
    }
    const next = [record, ...releaseRecords]
    setReleaseRecords(next)
    saveReleaseRecords(next)
    setReleaseOpen(false)
    setReleaseSourceDeposit(null)
    void fetchDepositAccounts().then(setDepositRows).catch(() => setDepositRows([]))
    const hadMemo = !!releaseSourceDeposit.detentionMemoId?.trim()
    let doneMsg = "Release saved. Deposit line closed as Released."
    if (hadMemo && closeLinkedMemoOnRelease) {
      doneMsg += " Linked detention memo settlement set to Fully Settled."
    } else if (hadMemo && !closeLinkedMemoOnRelease) {
      doneMsg += " Linked memo was left unchanged (option unchecked)."
    }
    window.alert(doneMsg)
  }

  return (
    <ModulePageLayout
      title="Release Inventory"
      description="When documents are furnished, release inventory and close the deposit (and optionally settle the linked detention memo). When documents are not furnished, transfer the detention deposit line to the Seizure Register."
      breadcrumbs={[{ label: "WMS" }, { label: "Warehouse" }, { label: "Release Inventory" }]}
    >
      <div className="grid gap-6">
        <Card className="w-full min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5" />
              Warehouse flow
            </CardTitle>
            <CardDescription>
              Detention memos linked to <strong>Deposit Account Register</strong> cover goods held pending documents.
              If the accused produces the required documents, use <strong>Release Inventory</strong> to release goods from warehouse and close the deposit; the linked memo can be settled in the same step.
              If documents are <strong>not</strong> furnished, use <strong>Transfer to Seizure</strong> so the goods are recorded under Seizure &amp; Receipt.
              Rows in deposit longer than <strong>2 months</strong> are highlighted as a reminder; transfer is allowed whenever documentary compliance fails.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Released inventory records */}
        <Card className="w-full min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5" />
              Released inventory records
            </CardTitle>
            <CardDescription>
              Complete info for each release: QR Code, Warehouse (from which), FIR, Number of stacks, Treasury Challan, Case Ref, and dates.
            </CardDescription>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="divide-y rounded-lg border md:hidden">
              {releaseRecords.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No release records yet. Use &quot;Release Inventory&quot; on a detention deposit row below to add one.
                </div>
              ) : (
                releaseRecords.map((r) => (
                  <div key={r.id} className="p-3">
                    <p className="truncate font-mono text-sm font-semibold">{r.qrCodeNumber}</p>
                    <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <p className="truncate">Warehouse: <span className="text-foreground">{r.warehouse || "—"}</span></p>
                      <p className="truncate">FIR: <span className="text-foreground">{r.firNumber || "—"}</span></p>
                      <p className="truncate">Stacks: <span className="text-foreground">{r.stackCount || "—"}</span></p>
                      <p className="truncate">Challan: <span className="text-foreground">{r.treasuryChallanNo || "—"}</span></p>
                      <p className="col-span-2 truncate">Case Ref: <span className="text-foreground">{r.caseSeizureRef || "—"}</span></p>
                      <p className="truncate">Station: <span className="text-foreground">{r.customsStation || "—"}</span></p>
                      <p className="truncate">Deposit Date: <span className="text-foreground">{r.depositDate || "—"}</span></p>
                      <p className="col-span-2 truncate">Released: <span className="text-foreground">{r.releasedAt || "—"}</span></p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="max-h-[50vh] w-full max-w-full overflow-x-auto overflow-y-auto rounded-lg border pb-2">
                <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                    <TableHead> QR Code</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>FIR No</TableHead>
                    <TableHead>Stacks</TableHead>
                    <TableHead>Treasury Challan</TableHead>
                    <TableHead>Case/Seizure Ref</TableHead>
                    <TableHead>Customs Station</TableHead>
                    <TableHead>Deposit Date</TableHead>
                    <TableHead>Released At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {releaseRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                        No release records yet. Use &quot;Release Inventory&quot; on a detention deposit row below to add one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    releaseRecords.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono">{r.qrCodeNumber}</TableCell>
                        <TableCell>{r.warehouse || "—"}</TableCell>
                        <TableCell className="font-mono">{r.firNumber || "—"}</TableCell>
                        <TableCell>{r.stackCount || "—"}</TableCell>
                        <TableCell>{r.treasuryChallanNo || "—"}</TableCell>
                        <TableCell>{r.caseSeizureRef || "—"}</TableCell>
                        <TableCell>{r.customsStation || "—"}</TableCell>
                        <TableCell>{r.depositDate || "—"}</TableCell>
                        <TableCell>{r.releasedAt || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detention deposit accounts */}
        <Card className="w-full min-w-0">
          <CardHeader>
            <CardTitle>Detention deposit accounts</CardTitle>
            <CardDescription>
              Detention-type deposit lines from the register. Released or forwarded rows stay visible for audit; actions are disabled once finished.
            </CardDescription>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="divide-y rounded-lg border md:hidden">
              {detentionDeposits.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No detention-type deposit accounts. Add entries in Detentions → Deposit Account Register with type &quot;Detention&quot;.
                </div>
              ) : (
                detentionDeposits.map((row) => {
                  const days = daysInDeposit(row.depositDate)
                  const overTwoMonths = days !== null && days > RELEASE_ALERT_DAYS
                  const terminal = isDepositTerminal(row)
                  return (
                    <div key={row.id} className={terminal ? "p-3 opacity-70" : "p-3"}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{row.treasuryChallanNo}</p>
                        <Badge variant={terminal ? "secondary" : "outline"}>{row.status}</Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <p className="truncate">Case Ref: <span className="text-foreground">{row.caseSeizureRef || "—"}</span></p>
                        <p className="truncate">FIR: <span className="text-foreground">{row.firNo || "—"}</span></p>
                        <p className="truncate">Station: <span className="text-foreground">{row.customsStation}</span></p>
                        <p className="truncate">Deposit Date: <span className="text-foreground">{row.depositDate}</span></p>
                        <p className="truncate">Days: <span className="text-foreground">{days !== null ? days : "—"}</span></p>
                        <p className="col-span-2 truncate">
                          Alert:{" "}
                          <span className="text-foreground">
                            {terminal ? "No further action" : overTwoMonths ? "In deposit >2 mo" : "—"}
                          </span>
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Button
                          variant="default"
                          size="sm"
                          disabled={terminal}
                          onClick={() => openReleaseDialog(row)}
                        >
                          <LogOut className="h-4 w-4 mr-1" />
                          Release
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={terminal}
                          onClick={() => void handleTransferToSeizure(row)}
                        >
                          <Package className="h-4 w-4 mr-1" />
                          Transfer
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="max-h-[60vh] w-full max-w-full overflow-x-auto overflow-y-auto rounded-lg border pb-2">
                <Table className="min-w-[1320px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Treasury Challan</TableHead>
                    <TableHead>Case/Seizure Ref</TableHead>
                    <TableHead>FIR No</TableHead>
                    <TableHead>Customs Station</TableHead>
                    <TableHead>Deposit Date</TableHead>
                    <TableHead>Days in deposit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="min-w-[200px]">Alert</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detentionDeposits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No detention-type deposit accounts. Add entries in Detentions → Deposit Account Register with type &quot;Detention&quot;.
                      </TableCell>
                    </TableRow>
                  ) : (
                    detentionDeposits.map((row) => {
                      const days = daysInDeposit(row.depositDate)
                      const overTwoMonths = days !== null && days > RELEASE_ALERT_DAYS
                      const terminal = isDepositTerminal(row)
                      return (
                        <TableRow key={row.id} className={terminal ? "opacity-70" : undefined}>
                          <TableCell className="font-medium">{row.treasuryChallanNo}</TableCell>
                          <TableCell>{row.caseSeizureRef || "—"}</TableCell>
                          <TableCell className="font-mono">{row.firNo || "—"}</TableCell>
                          <TableCell>{row.customsStation}</TableCell>
                          <TableCell>{row.depositDate}</TableCell>
                          <TableCell>{days !== null ? days : "—"}</TableCell>
                          <TableCell>
                            <Badge variant={terminal ? "secondary" : "outline"}>{row.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {terminal ? (
                              <span className="text-muted-foreground text-xs">No further action</span>
                            ) : overTwoMonths ? (
                              <span
                                className="inline-flex items-center gap-1 text-amber-700 text-xs font-medium bg-amber-100 px-2 py-1 rounded"
                                title="Exceeded 2 months in deposit — consider documentary follow-up or transfer to seizure."
                              >
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                In deposit &gt;2 mo
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 flex-wrap">
                              <Button
                                variant="default"
                                size="sm"
                                disabled={terminal}
                                onClick={() => openReleaseDialog(row)}
                                title={
                                  terminal
                                    ? "This deposit is already Released or forwarded to seizure"
                                    : "Documents furnished — release goods and close deposit"
                                }
                              >
                                <LogOut className="h-4 w-4 mr-1" />
                                Release Inventory
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={terminal}
                                onClick={() => void handleTransferToSeizure(row)}
                                title={
                                  terminal
                                    ? "This deposit is already Released or forwarded to seizure"
                                    : "Documents not furnished — send goods to seizure register"
                                }
                              >
                                <Package className="h-4 w-4 mr-1" />
                                Transfer to Seizure
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
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              After transfer, view records under <Link to={ROUTES.SEIZURE_REGISTER} className="text-primary hover:underline">Seizure & Receipt → Seizure Register</Link>.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Release Inventory dialog */}
      <Dialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Release Inventory</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Record release of specific items. QR Code number is required. Enter warehouse (from which), FIR, and number of stacks.
            </p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>QR Code Number *</Label>
              <Input
                value={releaseForm.qrCodeNumber}
                onChange={(e) => setReleaseForm((f) => ({ ...f, qrCodeNumber: e.target.value }))}
                placeholder="e.g. QR-REL-2024-001"
              />
            </div>
            <div className="grid gap-2">
              <Label>Warehouse (from which) *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={releaseForm.warehouse}
                onChange={(e) => setReleaseForm((f) => ({ ...f, warehouse: e.target.value }))}
              >
                <option value="">Select warehouse</option>
                {WAREHOUSE_OPTIONS.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>FIR Number</Label>
              <Input
                value={releaseForm.firNumber}
                onChange={(e) => setReleaseForm((f) => ({ ...f, firNumber: e.target.value }))}
                placeholder="e.g. FIR-2024-0845"
              />
            </div>
            <div className="grid gap-2">
              <Label>Number of stacks</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={releaseForm.stackCount}
                onChange={(e) => setReleaseForm((f) => ({ ...f, stackCount: e.target.value }))}
                placeholder="How many stacks"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label>Treasury Challan</Label>
                <Input
                  value={releaseForm.treasuryChallanNo}
                  onChange={(e) => setReleaseForm((f) => ({ ...f, treasuryChallanNo: e.target.value }))}
                  placeholder="TCH No"
                />
              </div>
              <div className="grid gap-2">
                <Label>Case/Seizure Ref</Label>
                <Input
                  value={releaseForm.caseSeizureRef}
                  onChange={(e) => setReleaseForm((f) => ({ ...f, caseSeizureRef: e.target.value }))}
                  placeholder="Case ref"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Customs Station</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={releaseForm.customsStation}
                onChange={(e) => setReleaseForm((f) => ({ ...f, customsStation: e.target.value }))}
              >
                <option value="">Select</option>
                {CUSTOMS_STATIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label>Deposit Date</Label>
                <Input
                  type="date"
                  value={releaseForm.depositDate}
                  onChange={(e) => setReleaseForm((f) => ({ ...f, depositDate: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Amount (PKR)</Label>
                <Input
                  value={releaseForm.amount}
                  onChange={(e) => setReleaseForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="Amount"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Bank / Treasury name</Label>
              <Input
                value={releaseForm.bankTreasuryName}
                onChange={(e) => setReleaseForm((f) => ({ ...f, bankTreasuryName: e.target.value }))}
                placeholder="Bank or treasury"
              />
            </div>
            <div className="grid gap-2">
              <Label>Remarks</Label>
              <Input
                value={releaseForm.remarks}
                onChange={(e) => setReleaseForm((f) => ({ ...f, remarks: e.target.value }))}
                placeholder="Optional remarks"
              />
            </div>
            {releaseSourceDeposit?.detentionMemoId?.trim() ? (
              <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
                <Checkbox
                  id="close-linked-memo"
                  checked={closeLinkedMemoOnRelease}
                  onCheckedChange={(v) => setCloseLinkedMemoOnRelease(v === true)}
                  className="mt-0.5"
                />
                <label htmlFor="close-linked-memo" className="text-sm leading-snug cursor-pointer">
                  Documents received — when saving, set the linked detention memo settlement to{" "}
                  <strong>Fully Settled</strong> (closes the case on the memo).
                </label>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setReleaseOpen(false)} disabled={releaseSaving} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={() => void handleReleaseSubmit()} disabled={releaseSaving} className="w-full sm:w-auto">
              {releaseSaving ? "Saving…" : "Save release record"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}
