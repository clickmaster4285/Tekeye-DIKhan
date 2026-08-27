import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { BookOpen, Eye, Package, Plus, Trash2 } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CUSTOMS_STATIONS } from "@/lib/case-fir-spec"
import { getDepositAccountRegisterDetailPath } from "@/routes/config"
import {
  fetchDepositAccounts,
  createDepositAccountEntry,
  updateDepositAccountEntry,
  deleteDepositAccountEntry,
  type DepositAccountRow,
} from "@/lib/deposit-account-api"
import { toast } from "@/components/ui/use-toast"
import { promoteDepositToSeizedAndInventory } from "@/lib/wms-stock-storage"

const DEPOSIT_TYPES = ["Detention", "Bail", "Security", "Duty", "Fine", "Other"] as const
const STATUSES = ["Pending", "Posted", "Reversed", "Released", "Forwarded to seizure"] as const
const DEPOSIT_STATUS_RELEASED = "Released"
const DEPOSIT_STATUS_FORWARDED_SEIZURE = "Forwarded to seizure"

function isDepositSeizeDisabled(row: DepositAccountRow): boolean {
  const s = (row.status || "").trim()
  return s === DEPOSIT_STATUS_RELEASED || s === DEPOSIT_STATUS_FORWARDED_SEIZURE
}

const emptyForm = () => ({
  treasuryChallanNo: "",
  depositType: "Detention",
  caseSeizureRef: "",
  firNo: "",
  customsStation: "DI Khan",
  amount: "",
  depositDate: new Date().toISOString().slice(0, 10),
  bankTreasuryName: "",
  status: "Pending",
  remarks: "",
})

export default function DepositAccountRegisterPage() {
  const [rows, setRows] = useState<DepositAccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DepositAccountRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const reload = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const list = await fetchDepositAccounts()
      setRows(list)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load deposits."
      setLoadError(msg)
      toast({ title: "Could not load register", description: msg, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const openAdd = () => {
    setForm(emptyForm())
    setOpen(true)
  }

  const onSave = async () => {
    if (!form.depositDate.trim()) {
      toast({ title: "Deposit date required", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      await createDepositAccountEntry({
        treasuryChallanNo: form.treasuryChallanNo.trim(),
        depositType: form.depositType,
        caseSeizureRef: form.caseSeizureRef.trim(),
        firNo: form.firNo.trim(),
        customsStation: form.customsStation,
        amount: form.amount.trim(),
        depositDate: form.depositDate,
        bankTreasuryName: form.bankTreasuryName.trim(),
        status: form.status,
        remarks: form.remarks.trim(),
      })
      toast({ title: "Saved", description: "Deposit entry saved to the database." })
      setOpen(false)
      await reload()
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Could not save entry.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSeize = async (row: DepositAccountRow) => {
    if (isDepositSeizeDisabled(row)) {
      toast({ title: "Cannot seize", description: "This deposit is already released or forwarded to seizure.", variant: "destructive" })
      return
    }
    const stamp = new Date().toISOString().slice(0, 10)
    const line = `[${stamp}] Seize: forwarded to seizure register from Deposit Account Register.`
    const mergedRemarks = [row.remarks?.trim(), line].filter(Boolean).join("\n")
    try {
      await updateDepositAccountEntry(row.id, {
        status: DEPOSIT_STATUS_FORWARDED_SEIZURE,
        remarks: mergedRemarks,
      })
    } catch (e) {
      toast({
        title: "Seize failed",
        description: e instanceof Error ? e.message : "Could not update deposit on the server.",
        variant: "destructive",
      })
      return
    }
    const synced = await promoteDepositToSeizedAndInventory(
      { ...row, remarks: mergedRemarks },
      "Seized from Deposit Account Register — forwarded to seizure register."
    )
    if (!synced) {
      toast({
        title: "Partial sync",
        description: "Deposit updated but seizure/stock sync failed. Retry from detention memo if needed.",
        variant: "destructive",
      })
      return
    }
    toast({
      title: "Seized",
      description: "Entry added to Seizure Register and Stock Management.",
    })
    await reload()
  }

  const handleDeleteClick = (row: DepositAccountRow) => {
    setDeleteTarget(row)
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDepositAccountEntry(deleteTarget.id)
      toast({
        title: "Deleted",
        description: "Deposit entry has been removed.",
      })
      setDeleteConfirmOpen(false)
      setDeleteTarget(null)
      await reload()
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Could not delete entry.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ModulePageLayout
      title="Deposit Account Register"
      description="Pakistan Customs: treasury challans and deposits (bail, security, duty, detention). Records detained goods moved into deposit accounts; detention-type rows can be pushed from Detention Memo."
      breadcrumbs={[{ label: "WMS" }, { label: "Detentions" }, { label: "Deposit Account Register" }]}
    >
      <div className="grid gap-6">
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-wrap items-center justify-between gap-4 space-y-0">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Deposit Account Register
              </CardTitle>
              <CardDescription className="break-words">
                Treasury challans linked to case/seizure and FIR. Use <strong>Seize</strong> to forward a line to the Seizure Register when goods must be seized (same as Release Inventory → Transfer to Seizure). View opens the deposit detail.
              </CardDescription>
            </div>
            <Button className="w-full flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />
              New Entry
            </Button>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            {loadError && (
              <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {loadError}
              </div>
            )}
            {loading && rows.length === 0 && (
              <p className="text-sm text-muted-foreground py-8">Loading deposit entries…</p>
            )}
            {!loading && rows.length === 0 && !loadError && (
              <p className="text-sm text-muted-foreground py-8">
                No deposit entries yet. Use <strong>New Entry</strong>, or raise a detention in <strong>Detention Memo</strong> and click <strong>Deposit</strong> to add a detention row automatically.
              </p>
            )}
            {rows.length > 0 && (
              <>
                <div className="divide-y rounded-lg border md:hidden">
                  {rows.map((row) => (
                    <div key={row.id} className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{row.treasuryChallanNo || "—"}</p>
                        <Badge variant={row.status === "Posted" ? "default" : row.status === "Pending" ? "secondary" : "outline"}>
                          {row.status || "—"}
                        </Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <p className="truncate text-muted-foreground">Type: <span className="text-foreground">{row.depositType}</span></p>
                        <p className="truncate text-muted-foreground">Date: <span className="text-foreground">{row.depositDate || "—"}</span></p>
                        <p className="truncate text-muted-foreground">Case Ref: <span className="text-foreground">{row.caseSeizureRef || "—"}</span></p>
                        <p className="truncate text-muted-foreground">FIR: <span className="text-foreground">{row.firNo || "—"}</span></p>
                        <p className="truncate text-muted-foreground">Station: <span className="text-foreground">{row.customsStation || "—"}</span></p>
                        <p className="truncate text-muted-foreground">Amount: <span className="text-foreground">{row.amount || "—"}</span></p>
                        <p className="col-span-2 truncate text-muted-foreground">Bank/Treasury: <span className="text-foreground">{row.bankTreasuryName || "—"}</span></p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Button variant="outline" size="sm" className="h-8 px-2" asChild>
                          <Link to={getDepositAccountRegisterDetailPath(row.id)}>
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            View
                          </Link>
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 px-2"
                          disabled={isDepositSeizeDisabled(row)}
                          title={
                            isDepositSeizeDisabled(row)
                              ? "Already released or forwarded to seizure"
                              : "Forward to Seizure Register and mark deposit row"
                          }
                          onClick={() => void handleSeize(row)}
                        >
                          <Package className="h-3.5 w-3.5 mr-1" />
                          Seize
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 px-2"
                          title="Delete this deposit entry"
                          onClick={() => handleDeleteClick(row)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden w-full min-w-0 md:block">
                  <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                    <Table className="min-w-[1280px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Treasury Challan No</TableHead>
                          <TableHead>Deposit Type</TableHead>
                          <TableHead>Case/Seizure Ref</TableHead>
                          <TableHead>FIR No</TableHead>
                          <TableHead>Customs Station</TableHead>
                          <TableHead>Average Value</TableHead>
                          <TableHead>Deposit Date</TableHead>
                          <TableHead>Bank/Treasury</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="min-w-[180px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.treasuryChallanNo || "—"}</TableCell>
                            <TableCell>{row.depositType}</TableCell>
                            <TableCell>{row.caseSeizureRef || "—"}</TableCell>
                            <TableCell>{row.firNo || "—"}</TableCell>
                            <TableCell>{row.customsStation || "—"}</TableCell>
                            <TableCell>{row.amount || "—"}</TableCell>
                            <TableCell>{row.depositDate || "—"}</TableCell>
                            <TableCell>{row.bankTreasuryName || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={row.status === "Posted" ? "default" : row.status === "Pending" ? "secondary" : "outline"}>
                                {row.status || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-wrap items-center justify-end gap-1">
                                <Button variant="outline" size="sm" className="h-8 px-2" asChild>
                                  <Link to={getDepositAccountRegisterDetailPath(row.id)}>
                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                    View
                                  </Link>
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-8 px-2"
                                  disabled={isDepositSeizeDisabled(row)}
                                  title={
                                    isDepositSeizeDisabled(row)
                                      ? "Already released or forwarded to seizure"
                                      : "Forward to Seizure Register and mark deposit row"
                                  }
                                  onClick={() => void handleSeize(row)}
                                >
                                  <Package className="h-3.5 w-3.5 mr-1" />
                                  Seize
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-8 px-2"
                                  title="Delete this deposit entry"
                                  onClick={() => handleDeleteClick(row)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deposit Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the deposit entry{deleteTarget?.treasuryChallanNo ? ` (${deleteTarget.treasuryChallanNo})` : ""}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-4 justify-end">
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Deposit Entry</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Add a treasury challan deposit. For <strong>Detention</strong>, use Case/Seizure ref = detention case number when not coming from Detention Memo.
            </p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Treasury Challan No</Label>
              <Input
                value={form.treasuryChallanNo}
                onChange={(e) => setForm((f) => ({ ...f, treasuryChallanNo: e.target.value }))}
                placeholder="Leave blank until challan issued; fill when posting"
              />
            </div>
            <div className="grid gap-2">
              <Label>Deposit Type</Label>
              <Select value={form.depositType} onValueChange={(v) => setForm((f) => ({ ...f, depositType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPOSIT_TYPES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Case / Seizure Reference</Label>
              <Input
                value={form.caseSeizureRef}
                onChange={(e) => setForm((f) => ({ ...f, caseSeizureRef: e.target.value }))}
                placeholder="e.g. case no from detention memo"
              />
            </div>
            <div className="grid gap-2">
              <Label>FIR No</Label>
              <Input value={form.firNo} onChange={(e) => setForm((f) => ({ ...f, firNo: e.target.value }))} placeholder="e.g. FIR-2024-0841" />
            </div>
            <div className="grid gap-2">
              <Label>Customs Station</Label>
              <Select value={form.customsStation} onValueChange={(v) => setForm((f) => ({ ...f, customsStation: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CUSTOMS_STATIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Amount / average value (PKR)</Label>
              <Input value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="e.g. 125,000 or leave blank until valued" />
            </div>
            <div className="grid gap-2">
              <Label>Deposit Date *</Label>
              <Input type="date" value={form.depositDate} onChange={(e) => setForm((f) => ({ ...f, depositDate: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Bank / Treasury Name</Label>
              <Input
                value={form.bankTreasuryName}
                onChange={(e) => setForm((f) => ({ ...f, bankTreasuryName: e.target.value }))}
                placeholder="e.g. State Bank Treasury"
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Remarks</Label>
              <Input value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={() => void onSave()} disabled={saving} className="w-full sm:w-auto">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}
