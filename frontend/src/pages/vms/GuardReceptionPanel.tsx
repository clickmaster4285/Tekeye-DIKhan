import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  fetchActiveVisitors,
  fetchPendingApprovals,
  zoneScan,
  approveVisitor,
  denyVisitor,
  type ActiveVisitor,
  type PendingVisitor,
  type ZoneScanResult,
} from "@/lib/vms-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { UserRound, QrCode, Loader2, User, Check, X } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { AccessZoneSelect } from "@/components/vms/access-zone-select"
import { useAccessZones } from "@/hooks/use-access-zones"

const GATES = ["main-gate", "gate-1", "gate-2", "vip-gate"]
/** Radix Select does not allow value=""; use for optional gate and treat as empty when submitting */
const GATE_PLACEHOLDER = "__none__"

function formatDate(s: string | undefined) {
  if (!s) return "—"
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
  } catch {
    return s
  }
}

export default function GuardReceptionPanel() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: zoneData } = useAccessZones()
  const defaultZone = zoneData?.options.find((z) => z.value !== "all")?.value ?? ""
  const [qrCodeId, setQrCodeId] = useState("")
  const [zone, setZone] = useState("")
  const [gate, setGate] = useState(GATE_PLACEHOLDER)
  const [scanType, setScanType] = useState<"entry" | "exit">("entry")
  const [lastResult, setLastResult] = useState<ZoneScanResult | null>(null)
  const [approveBy, setApproveBy] = useState("")
  const [denyVisitorId, setDenyVisitorId] = useState<number | null>(null)
  const [denyReason, setDenyReason] = useState("")
  const [denyBy, setDenyBy] = useState("")

  const { data: active, isLoading: activeLoading } = useQuery({
    queryKey: ["vms", "active-visitors"],
    queryFn: fetchActiveVisitors,
  })
  const { data: pending, isLoading: pendingLoading } = useQuery({
    queryKey: ["vms", "pending-approvals"],
    queryFn: fetchPendingApprovals,
  })

  const scanMutation = useMutation({
    mutationFn: () =>
      zoneScan({
        qr_code_id: qrCodeId.trim(),
        zone: zone || defaultZone,
        gate: gate === GATE_PLACEHOLDER ? "" : gate,
        scan_type: scanType,
      }),
    onSuccess: (data) => {
      setLastResult(data)
      queryClient.invalidateQueries({ queryKey: ["vms", "active-visitors"] })
      if (data.allowed) toast({ title: "Access granted", description: data.message })
      else toast({ title: "Access denied", description: data.message, variant: "destructive" })
    },
    onError: (e) => toast({ title: "Scan failed", description: e.message, variant: "destructive" }),
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, approvedBy }: { id: number; approvedBy: string }) => approveVisitor(id, approvedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vms", "pending-approvals"] })
      queryClient.invalidateQueries({ queryKey: ["visitors"] })
      toast({ title: "Visitor approved" })
    },
    onError: (e) => toast({ title: "Approval failed", description: e.message, variant: "destructive" }),
  })

  const denyMutation = useMutation({
    mutationFn: ({ id, rejection_reason, denied_by }: { id: number; rejection_reason: string; denied_by: string }) =>
      denyVisitor(id, { rejection_reason, denied_by }),
    onSuccess: () => {
      setDenyVisitorId(null)
      setDenyReason("")
      setDenyBy("")
      queryClient.invalidateQueries({ queryKey: ["vms", "pending-approvals"] })
      toast({ title: "Visitor denied", variant: "destructive" })
    },
    onError: (e) => toast({ title: "Deny failed", description: e.message, variant: "destructive" }),
  })

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault()
    if (!qrCodeId.trim() || !zone) {
      toast({ title: "Enter QR code and select zone", variant: "destructive" })
      return
    }
    scanMutation.mutate()
  }

  const handleApprove = (v: PendingVisitor) => {
    approveMutation.mutate({ id: v.id, approvedBy: approveBy.trim() || "Guard" })
  }

  const handleDenySubmit = () => {
    if (denyVisitorId == null) return
    denyMutation.mutate({
      id: denyVisitorId,
      rejection_reason: denyReason.trim() || "No reason provided.",
      denied_by: denyBy.trim() || "Guard",
    })
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
          <UserRound className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Guard & Reception Panel</h1>
          <p className="text-sm text-muted-foreground">
            Quick scan, check-in/out, and reception workflows. View active visitors and pending approvals.
          </p>
        </div>
      </div>

      {/* Quick scan */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-medium text-foreground mb-4 flex items-center gap-2">
          <QrCode className="h-4 w-4 text-[#3b82f6]" />
          Quick scan
        </h2>
        <form onSubmit={handleScan} className="flex flex-wrap items-end gap-4">
          <div className="min-w-[180px]">
            <Label htmlFor="qr">QR Code ID</Label>
            <Input
              id="qr"
              placeholder="e.g. QR-1"
              value={qrCodeId}
              onChange={(e) => setQrCodeId(e.target.value)}
              className="mt-1 font-mono"
            />
          </div>
          <div className="min-w-[120px]">
            <Label>Zone</Label>
            <AccessZoneSelect
              value={zone}
              onValueChange={setZone}
              triggerClassName="mt-1"
              includeAllOption={false}
            />
          </div>
          <div className="min-w-[120px]">
            <Label>Gate</Label>
            <Select value={gate} onValueChange={setGate}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GATE_PLACEHOLDER}>—</SelectItem>
                {GATES.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[100px]">
            <Label>Type</Label>
            <Select value={scanType} onValueChange={(v) => setScanType(v as "entry" | "exit")}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entry">Entry</SelectItem>
                <SelectItem value="exit">Exit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={scanMutation.isPending}>
            {scanMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4 mr-1" />}
            Scan
          </Button>
        </form>
        {lastResult && (
          <div
            className={`mt-4 rounded-lg border p-3 text-sm ${
              lastResult.allowed ? "border-green-500/50 bg-green-500/5" : "border-destructive/50 bg-destructive/5"
            }`}
          >
            {lastResult.allowed ? "Access granted" : "Access denied"} — {lastResult.message}
            {lastResult.visitor_name && ` · ${lastResult.visitor_name}`}
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Active visitors */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="font-medium text-foreground">Active visitors</span>
            {active && <span className="text-sm text-muted-foreground">{active.length} in building</span>}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {activeLoading ? (
              <div className="p-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : !active?.length ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No one in building.</div>
            ) : (
              <ul className="divide-y divide-border">
                {(active as ActiveVisitor[]).map((v) => (
                  <li key={v.id} className="p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-[#3b82f6]/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-[#3b82f6]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate text-sm">{v.full_name}</p>
                        <p className="text-xs text-muted-foreground">{v.access_zone || "—"} · {formatDate(v.updated_at)}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" asChild className="shrink-0">
                      <Link to={`/visitors/${v.id}`}>View</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Pending approvals */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="font-medium text-foreground">Pending approvals</span>
            {pending && <span className="text-sm text-muted-foreground">{pending.length} pending</span>}
          </div>
          <div className="p-2 border-b border-border">
            <Label className="text-xs text-muted-foreground">Approver name</Label>
            <Input
              placeholder="Your name"
              value={approveBy}
              onChange={(e) => setApproveBy(e.target.value)}
              className="h-8 text-sm mt-0.5"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {pendingLoading ? (
              <div className="p-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : !pending?.length ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No pending approvals.</div>
            ) : (
              <ul className="divide-y divide-border">
                {pending.map((v) => (
                  <li key={v.id} className="p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate text-sm">{v.full_name}</p>
                      <p className="text-xs text-muted-foreground">{v.host_full_name || "—"} · {formatDate(v.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        className="h-7 bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(v)}
                        disabled={approveMutation.isPending}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7" onClick={() => setDenyVisitorId(v.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7" asChild>
                        <Link to={`/visitors/${v.id}`}>View</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={denyVisitorId != null} onOpenChange={(open) => !open && setDenyVisitorId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deny visitor</AlertDialogTitle>
            <AlertDialogDescription>Provide a reason for denial. This will create a security alert.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="deny-reason">Reason</Label>
              <Textarea id="deny-reason" value={denyReason} onChange={(e) => setDenyReason(e.target.value)} className="mt-1" rows={2} />
            </div>
            <div>
              <Label htmlFor="deny-by">Denied by</Label>
              <Input id="deny-by" value={denyBy} onChange={(e) => setDenyBy(e.target.value)} className="mt-1" />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDenySubmit() }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={denyMutation.isPending}
            >
              {denyMutation.isPending ? "Saving…" : "Deny"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
