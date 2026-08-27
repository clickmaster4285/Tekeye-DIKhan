import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  ClipboardCheck,
  Eye,
  Loader2,
  Package,
  PackageOpen,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { TableActionGroup, TableActionIcon } from "@/components/seizure/table-action-icon"
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
  getDetentionMemoDetailPath,
  getSeizureMgmtAssessmentDetailPath,
  getSeizureMgmtAssessmentEditPath,
} from "@/routes/config"
import { fetchDetentionMemos, type DetentionMemoApiRecord } from "@/lib/detention-memo-api"
import {
  deleteAssessment,
  fetchAssessments,
  type DetentionAssessmentRecord,
} from "@/lib/seizure-management-api"
import { toast } from "@/hooks/use-toast"

function goodsSummary(memo: DetentionMemoApiRecord): string {
  const items = memo.goodsItems ?? []
  if (items.length === 0) return "—"
  if (items.length === 1) return items[0].description || "1 item"
  return `${items.length} items`
}

function goodsValue(memo: DetentionMemoApiRecord): string {
  const items = memo.goodsItems ?? []
  if (items.length === 0) return "—"
  const total = items.reduce((sum, g) => {
    const n = parseFloat(String(g.assessableValuePkr ?? "").replace(/,/g, ""))
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
  return total > 0 ? `PKR ${total.toLocaleString()}` : "—"
}

function recoveryMemoCreateHref(detentionMemoId: string, assessmentId: string) {
  return `${ROUTES.SEIZURE_MGMT_RECOVERY_MEMO_CREATE}?detentionMemoId=${encodeURIComponent(detentionMemoId)}&assessmentId=${encodeURIComponent(assessmentId)}`
}

function assessmentStatusBadge(assessment: DetentionAssessmentRecord | undefined) {
  if (!assessment) {
    return (
      <Badge variant="outline" className="text-amber-700 border-amber-300">
        Pending
      </Badge>
    )
  }
  if (assessment.status === "Approved") return <Badge>Approved</Badge>
  if (assessment.status === "Submitted") return <Badge variant="secondary">Submitted</Badge>
  if (assessment.status === "Rejected") return <Badge variant="destructive">Rejected</Badge>
  return <Badge variant="outline">Draft</Badge>
}

export default function DetentionAssessmentPage() {
  const navigate = useNavigate()
  const [memos, setMemos] = useState<DetentionMemoApiRecord[]>([])
  const [assessments, setAssessments] = useState<DetentionAssessmentRecord[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    Promise.all([fetchDetentionMemos(), fetchAssessments()])
      .then(([m, a]) => {
        setMemos(m)
        setAssessments(a)
      })
      .catch((e) => {
        setMemos([])
        setAssessments([])
        toast({
          title: "Failed to load assessments",
          description: e instanceof Error ? e.message : "Could not load data",
          variant: "destructive",
        })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const assessmentByMemoId = useMemo(() => {
    const map = new Map<string, DetentionAssessmentRecord>()
    for (const a of assessments) map.set(a.detentionMemoId, a)
    return map
  }, [assessments])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return memos
    return memos.filter((m) => {
      const assessment = assessmentByMemoId.get(m.id)
      return (
        (m.caseNo || "").toLowerCase().includes(q) ||
        (m.referenceNumber || "").toLowerCase().includes(q) ||
        (m.placeOfDetention || "").toLowerCase().includes(q) ||
        (m.owner?.name || "").toLowerCase().includes(q) ||
        (assessment?.examiningOfficer || "").toLowerCase().includes(q) ||
        (assessment?.documentRelevance || "").toLowerCase().includes(q) ||
        (assessment?.status || "").toLowerCase().includes(q)
      )
    })
  }, [memos, search, assessmentByMemoId])

  const stats = useMemo(() => {
    const assessed = memos.filter((m) => assessmentByMemoId.has(m.id)).length
    const approved = memos.filter((m) => assessmentByMemoId.get(m.id)?.status === "Approved").length
    const pendingApproval = memos.filter(
      (m) => assessmentByMemoId.get(m.id)?.status === "Submitted"
    ).length
    return {
      total: memos.length,
      pending: memos.length - assessed,
      pendingApproval,
      approved,
    }
  }, [memos, assessmentByMemoId])

  const handleDelete = async (id: string) => {
    try {
      await deleteAssessment(id)
      toast({ title: "Assessment deleted" })
      load()
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Failed to delete",
        variant: "destructive",
      })
    }
  }

  return (
    <ModulePageLayout
      title="Detention Assessment"
      description="Review each detention memo, record findings, upload documents, and send for approval."
      breadcrumbs={[
        { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
        { label: "Detention" },
        { label: "Assessment" },
      ]}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="rounded-[10px]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Detention Memos</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[10px]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending Assessment</p>
            <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[10px]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending Approval</p>
            <p className="text-2xl font-bold text-blue-700">{stats.pendingApproval}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[10px]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Approved</p>
            <p className="text-2xl font-bold text-green-700">{stats.approved}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[10px] border-gray-200">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search case no, memo no, place, owner..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button asChild>
              <Link to={ROUTES.SEIZURE_MGMT_ASSESSMENT_CREATE}>
                <Plus className="h-4 w-4 mr-2" />
                New Assessment
              </Link>
            </Button>
          </div>

          <Table className="table-fixed w-full" containerClassName="overflow-x-hidden">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[10%]">Case No</TableHead>
                  <TableHead className="w-[12%]">Detention Memo No</TableHead>
                  <TableHead className="w-[10%]">Detention Date</TableHead>
                  <TableHead className="w-[12%]">Place</TableHead>
                  <TableHead className="w-[8%]">Type</TableHead>
                  <TableHead className="w-[10%]">Owner</TableHead>
                  <TableHead className="w-[10%]">Goods</TableHead>
                  <TableHead className="w-[8%]">Value</TableHead>
                  <TableHead className="w-[8%]">Verification</TableHead>
                  <TableHead className="w-[8%]">Assessment</TableHead>
                  <TableHead className="w-[7.5rem] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Loading detention memos...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      No detention memos found. Create a detention memo first.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((memo) => {
                    const assessment = assessmentByMemoId.get(memo.id)
                    const isApproved = assessment?.status === "Approved"

                    return (
                      <TableRow key={memo.id}>
                        <TableCell className="font-medium truncate" title={memo.caseNo || ""}>
                          {memo.caseNo || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs truncate" title={memo.referenceNumber || ""}>
                          {memo.referenceNumber || "—"}
                        </TableCell>
                        <TableCell className="truncate">
                          {memo.dateTimeDetention?.slice(0, 10) || "—"}
                        </TableCell>
                        <TableCell className="truncate" title={memo.placeOfDetention}>
                          {memo.placeOfDetention || "—"}
                        </TableCell>
                        <TableCell className="truncate">{memo.detentionType || "—"}</TableCell>
                        <TableCell className="truncate" title={memo.owner?.name}>
                          {memo.owner?.name || "—"}
                        </TableCell>
                        <TableCell className="truncate" title={goodsSummary(memo)}>
                          {goodsSummary(memo)}
                        </TableCell>
                        <TableCell className="truncate">{goodsValue(memo)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{memo.verificationStatus || "—"}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5 min-w-0">
                            {assessmentStatusBadge(assessment)}
                            {assessment?.documentRelevance &&
                              assessment.documentRelevance !== "Pending" && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {assessment.documentRelevance}
                                </p>
                              )}
                            {assessment?.examiningOfficer && (
                              <p className="text-xs text-muted-foreground truncate">
                                {assessment.examiningOfficer}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="overflow-visible p-2 text-right align-middle">
                          <TableActionGroup>
                            <TableActionIcon label="View memo" to={getDetentionMemoDetailPath(memo.id)}>
                              <Eye className="h-4 w-4" />
                            </TableActionIcon>
                            {assessment ? (
                              <>
                                <TableActionIcon
                                  label={
                                    assessment.status === "Draft" || assessment.status === "Rejected"
                                      ? "Edit assessment"
                                      : "View assessment"
                                  }
                                  onClick={() =>
                                    navigate(
                                      assessment.status === "Draft" ||
                                        assessment.status === "Rejected"
                                        ? getSeizureMgmtAssessmentEditPath(assessment.id)
                                        : getSeizureMgmtAssessmentDetailPath(assessment.id)
                                    )
                                  }
                                >
                                  <ClipboardCheck className="h-4 w-4" />
                                </TableActionIcon>
                                {isApproved && assessment.documentRelevance === "Relevant" && (
                                  <TableActionIcon label="Release" to={ROUTES.RELEASE_INVENTORY}>
                                    <PackageOpen className="h-4 w-4" />
                                  </TableActionIcon>
                                )}
                                {isApproved && assessment.documentRelevance === "Not Relevant" && (
                                  <TableActionIcon
                                    label="Create recovery memo"
                                    to={recoveryMemoCreateHref(
                                      assessment.detentionMemoId,
                                      assessment.id
                                    )}
                                  >
                                    <Package className="h-4 w-4" />
                                  </TableActionIcon>
                                )}
                                {assessment.status !== "Approved" && (
                                  <TableActionIcon
                                    label="Delete assessment"
                                    destructive
                                    onClick={() => void handleDelete(assessment.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </TableActionIcon>
                                )}
                              </>
                            ) : (
                              <TableActionIcon
                                label="Assess"
                                to={`${ROUTES.SEIZURE_MGMT_ASSESSMENT_CREATE}?detentionMemoId=${encodeURIComponent(memo.id)}`}
                              >
                                <ClipboardCheck className="h-4 w-4" />
                              </TableActionIcon>
                            )}
                          </TableActionGroup>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
        </CardContent>
      </Card>
    </ModulePageLayout>
  )
}
