import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { Eye, Pencil, Copy, Trash2, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { useToast } from "@/hooks/use-toast"
import { deleteVisitor } from "@/lib/visitor-api"
import type { VmsOverviewVisitorRow } from "@/lib/vms-api"
import {
  clearanceStatusClass,
  priorityClass,
  visitorDetailHref,
  visitorEditHref,
} from "@/lib/visitor-display"

export function VisitorDeleteDialog({
  target,
  onClose,
}: {
  target: VmsOverviewVisitorRow | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [deleting, setDeleting] = useState(false)

  const confirmDelete = async () => {
    if (!target) return
    const source = target.registration_source === "walk-in" ? "walk-in" : "pre-registration"
    setDeleting(true)
    try {
      await deleteVisitor(target.id, source)
      toast({ title: "Deleted", description: `${target.visitor_name} removed.` })
      await queryClient.invalidateQueries({ queryKey: ["vms", "overview"] })
      onClose()
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Could not delete visitor.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={target != null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete registration?</AlertDialogTitle>
          <AlertDialogDescription>
            Remove {target?.visitor_name} (Reg {target?.reg_id})? This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void confirmDelete()
            }}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

type RecentRegistrationsTableProps = {
  rows: VmsOverviewVisitorRow[]
  isLoading?: boolean
  title?: string
  className?: string
  onDeleteClick: (row: VmsOverviewVisitorRow) => void
}

export function VisitorRegistrationActions({
  row,
  onDeleteClick,
}: {
  row: VmsOverviewVisitorRow
  onDeleteClick: (row: VmsOverviewVisitorRow) => void
}) {
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleCopy = async () => {
    const text = `Reg ${row.reg_id} — ${row.visitor_name}`
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied", description: "Registration reference copied." })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8 text-[#4A5565]" asChild>
        <Link to={visitorDetailHref(row)} aria-label="View visitor">
          <Eye className="h-4 w-4" />
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-[#4A5565]"
        onClick={() => navigate(visitorEditHref(row))}
        aria-label="Edit registration"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-[#4A5565]"
        onClick={() => void handleCopy()}
        aria-label="Copy reference"
      >
        <Copy className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-[#4A5565] hover:text-destructive"
        onClick={() => onDeleteClick(row)}
        aria-label="Delete visitor"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function RecentRegistrationsTable({
  rows,
  isLoading = false,
  title = "Recent Registrations",
  className,
  onDeleteClick,
}: RecentRegistrationsTableProps) {
  return (
    <Card
        className={`min-w-0 max-w-full overflow-hidden rounded-[10px] border border-gray-200 ${className ?? ""}`}
      >
        <div className="flex items-center justify-between pb-1 pl-4 pt-4 pr-4 sm:pl-6">
          <h2 className="text-lg font-bold text-[#101727] sm:text-xl">{title}</h2>
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-[#155DFC]" />}
        </div>
        <div className="max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[640px] sm:min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-7 py-3 text-left text-sm font-bold text-[#697282]">Reg ID</th>
                <th className="px-5 py-3 text-left text-sm font-bold text-[#697282]">Visitor Name</th>
                <th className="px-5 py-3 text-left text-sm font-bold text-[#697282]">Host Name</th>
                <th className="px-5 py-3 text-left text-sm font-bold text-[#697282]">Date & Time</th>
                <th className="px-5 py-3 text-left text-sm font-bold text-[#697282]">Priority Level</th>
                <th className="px-5 py-3 text-left text-sm font-bold text-[#697282]">Status</th>
                <th className="px-5 py-3 text-left text-sm font-bold text-[#697282]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-[#697282]">
                    Loading registrations…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-[#697282]">
                    No registrations found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-7 py-5 text-xs text-[#495565]">{row.reg_id}</td>
                    <td className="px-5 py-5 text-xs text-[#495565]">{row.visitor_name}</td>
                    <td className="px-5 py-5 text-xs text-[#495565]">{row.host_name}</td>
                    <td className="px-5 py-5 text-xs text-[#495565]">{row.date_time}</td>
                    <td className="px-5 py-5">
                      <span
                        className={`inline-block rounded-[21px] px-3 py-1 text-sm font-medium ${priorityClass(row.priority)}`}
                      >
                        {row.priority}
                      </span>
                    </td>
                    <td className="px-5 py-5">
                      <span
                        className={`inline-block rounded-[21px] px-3 py-1 text-sm font-medium ${clearanceStatusClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-5">
                      <VisitorRegistrationActions row={row} onDeleteClick={onDeleteClick} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
  )
}
