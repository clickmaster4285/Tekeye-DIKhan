import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  fetchPendingApprovals,
  approveVisitor,
  denyVisitor,
  type PendingVisitor,
} from "@/lib/vms-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { FileCheck, Check, X, Loader2, User } from "lucide-react"
import { ROUTES } from "@/routes/config"
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

function formatDate(s: string) {
  if (!s) return "—"
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
  } catch {
    return s
  }
}

export default function ApprovalWorkflowPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [denyVisitorId, setDenyVisitorId] = useState<number | null>(null)
  const [denyReason, setDenyReason] = useState("")
  const [denyBy, setDenyBy] = useState("")
  const [approveBy, setApproveBy] = useState("")

  const { data: pending, isLoading, isError, error } = useQuery({
    queryKey: ["vms", "pending-approvals"],
    queryFn: fetchPendingApprovals,
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, approvedBy }: { id: number; approvedBy: string }) =>
      approveVisitor(id, approvedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vms", "pending-approvals"] })
      queryClient.invalidateQueries({ queryKey: ["visitors"] })
      toast({ title: "Visitor approved", description: "Approval recorded." })
    },
    onError: (e) => {
      toast({ title: "Approval failed", description: e.message, variant: "destructive" })
    },
  })

  const denyMutation = useMutation({
    mutationFn: ({ id, rejection_reason, denied_by }: { id: number; rejection_reason: string; denied_by: string }) =>
      denyVisitor(id, { rejection_reason, denied_by }),
    onSuccess: () => {
      setDenyVisitorId(null)
      setDenyReason("")
      setDenyBy("")
      queryClient.invalidateQueries({ queryKey: ["vms", "pending-approvals"] })
      queryClient.invalidateQueries({ queryKey: ["visitors"] })
      toast({ title: "Visitor denied", description: "Security alert created.", variant: "destructive" })
    },
    onError: (e) => {
      toast({ title: "Deny failed", description: e.message, variant: "destructive" })
    },
  })

  const handleApprove = (v: PendingVisitor) => {
    const by = approveBy.trim() || "Guard"
    approveMutation.mutate({ id: v.id, approvedBy: by })
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
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
          <FileCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Approval Workflow</h1>
          <p className="text-sm text-muted-foreground">
            Approve or deny visitors who require host/approver approval. Denials create a security alert.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <Label htmlFor="approve-by" className="text-muted-foreground text-sm whitespace-nowrap">
          Approver name (for new approvals):
        </Label>
        <Input
          id="approve-by"
          placeholder="e.g. Guard name"
          value={approveBy}
          onChange={(e) => setApproveBy(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#3b82f6]" />
        </div>
      )}
      {isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load pending approvals."}
        </div>
      )}
      {pending && pending.length === 0 && !isLoading && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          <p className="font-medium">No pending approvals</p>
          <p className="text-sm mt-1">Visitors with approver required will appear here.</p>
          <Link to={ROUTES.WALK_IN_REGISTRATION} className="text-[#3b82f6] hover:underline text-sm mt-2 inline-block">
            Walk-In Registration
          </Link>
        </div>
      )}
      {pending && pending.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <ul className="divide-y divide-border">
            {pending.map((v) => (
              <li key={v.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-10 w-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-[#3b82f6]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{v.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Host: {v.host_full_name || "—"} · {v.host_department || "—"} · {formatDate(v.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleApprove(v)}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDenyVisitorId(v.id)}
                    disabled={denyMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Deny
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/visitors/${v.id}`}>View</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AlertDialog open={denyVisitorId != null} onOpenChange={(open) => !open && setDenyVisitorId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deny visitor</AlertDialogTitle>
            <AlertDialogDescription>
              This will set the visitor as denied and create a security alert. Provide a reason (required for audit).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="deny-reason">Reason for denial</Label>
              <Textarea
                id="deny-reason"
                placeholder="e.g. Documents not in order"
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="deny-by">Denied by</Label>
              <Input
                id="deny-by"
                placeholder="Your name or role"
                value={denyBy}
                onChange={(e) => setDenyBy(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDenySubmit()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={denyMutation.isPending}
            >
              {denyMutation.isPending ? "Saving…" : "Deny & create alert"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
