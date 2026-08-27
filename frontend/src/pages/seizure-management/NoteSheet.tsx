import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Eye, FilePlus, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react"
import { TableActionGroup, TableActionIcon } from "@/components/seizure/table-action-icon"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  type NoteSheetRecord,
  type NoteSheetStatus,
} from "@/lib/seizure-management-api"
import { getStoredUser } from "@/lib/auth"
import { toast } from "@/hooks/use-toast"

function statusBadge(status: NoteSheetStatus) {
  if (status === "Approved") return <Badge>Approved</Badge>
  if (status === "Submitted") return <Badge variant="secondary">Submitted</Badge>
  if (status === "Rejected") return <Badge variant="destructive">Rejected</Badge>
  return <Badge variant="outline">Draft</Badge>
}

function printNoteSheet(id: string) {
  window.location.assign(`${getSeizureMgmtNoteSheetDetailPath(id)}?print=full&autoprint=1`)
}

export default function NoteSheetPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<NoteSheetRecord[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const currentUser = getStoredUser()

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        (r.noteSheetNo || "").toLowerCase().includes(q) ||
        r.referenceNumber.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        r.caseNo.toLowerCase().includes(q) ||
        (r.office || "").toLowerCase().includes(q) ||
        r.preparedBy.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        (r.priority || "").toLowerCase().includes(q)
    )
  }, [rows, search])

  return (
    <ModulePageLayout
      title="Note Sheet"
      description="Create and get officer approval on a note sheet before creating a detention memo."
      breadcrumbs={[
        { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
        { label: "Note Sheet" },
      ]}
    >
      <Card className="rounded-[10px] border-gray-200">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search note sheet no, subject, case..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button asChild>
              <Link to={ROUTES.SEIZURE_MGMT_NOTE_SHEET_CREATE}>
                <Plus className="h-4 w-4 mr-2" />
                New Note Sheet
              </Link>
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Table className="table-fixed w-full" containerClassName="overflow-x-hidden">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[12%]">Note Sheet No.</TableHead>
                <TableHead className="w-[18%]">Subject</TableHead>
                <TableHead className="w-[10%]">Case No</TableHead>
                <TableHead className="w-[16%]">Office</TableHead>
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
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No note sheets yet.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id}>
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
    </ModulePageLayout>
  )
}
