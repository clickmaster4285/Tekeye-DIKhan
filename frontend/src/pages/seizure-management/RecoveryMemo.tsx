import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Loader2, Plus, Search, Eye } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { TableActionGroup, TableActionIcon } from "@/components/seizure/table-action-icon"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ROUTES, getSeizureMgmtRecoveryMemoDetailPath } from "@/routes/config"
import { fetchRecoveryMemos, type RecoveryMemoRecord } from "@/lib/seizure-management-api"

function approvalBadge(status: RecoveryMemoRecord["approvalStatus"]) {
  if (status === "Approved") return <Badge>Approved</Badge>
  if (status === "Pending Approval") return <Badge variant="secondary">Pending Approval</Badge>
  if (status === "Rejected") return <Badge variant="destructive">Rejected</Badge>
  return <Badge variant="outline">Draft</Badge>
}

export default function RecoveryMemoPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<RecoveryMemoRecord[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchRecoveryMemos()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.caseNo.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.recoveryOfficer.toLowerCase().includes(q)
    )
  }, [rows, search])

  return (
    <ModulePageLayout
      title="Recovery Memo"
      description="Create recovery memos by category (Dangerous/Chemical, Perishable, Other). Sent to approval by a separate recovery officer."
      breadcrumbs={[
        { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
        { label: "Recovery Memo" },
        { label: "Create Recovery Memo" },
      ]}
    >
      <Card className="rounded-[10px] border-gray-200">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search case, category, officer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button asChild>
              <Link to={ROUTES.SEIZURE_MGMT_RECOVERY_MEMO_CREATE}>
                <Plus className="h-4 w-4 mr-2" />
                Create Recovery Memo
              </Link>
            </Button>
          </div>

          <Table className="table-fixed w-full" containerClassName="overflow-x-hidden">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[18%]">Case No</TableHead>
                <TableHead className="w-[18%]">Category</TableHead>
                <TableHead className="w-[16%]">Recovery Date</TableHead>
                <TableHead className="w-[22%]">Officer</TableHead>
                <TableHead className="w-[16%]">Approval</TableHead>
                <TableHead className="w-[7.5rem] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No recovery memos yet.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium truncate" title={row.caseNo}>{row.caseNo}</TableCell>
                    <TableCell className="truncate" title={row.category}>{row.category}</TableCell>
                    <TableCell className="truncate">{row.recoveryDate}</TableCell>
                    <TableCell className="truncate" title={row.recoveryOfficer}>{row.recoveryOfficer}</TableCell>
                    <TableCell>{approvalBadge(row.approvalStatus)}</TableCell>
                    <TableCell className="overflow-visible p-2 text-right align-middle">
                      <TableActionGroup>
                        <TableActionIcon
                          label="View"
                          onClick={() => navigate(getSeizureMgmtRecoveryMemoDetailPath(row.id))}
                        >
                          <Eye className="h-4 w-4" />
                        </TableActionIcon>
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
