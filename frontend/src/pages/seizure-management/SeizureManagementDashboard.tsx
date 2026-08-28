import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  ClipboardCheck,
  FileText,
  Package,
  Clock,
  ChevronRight,
  Loader2,
  RefreshCw,
  StickyNote,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ROUTES,
  getDetentionMemoDetailPath,
  getSeizureMgmtAssessmentDetailPath,
  getSeizureMgmtNoteSheetDetailPath,
  getSeizureMgmtRecoveryMemoDetailPath,
  getSeizureMgmtSeizureReportDetailPath,
} from "@/routes/config"
import {
  DETENTION_WINDOW_DAYS,
  emptySeizureMgmtOverview,
  fetchSeizureMgmtOverview,
  type SeizureMgmtActivity,
  type SeizureMgmtOverview,
} from "@/lib/seizure-management-api"

const pipeline = [
  { key: "noteSheets", label: "Note Sheet", href: ROUTES.SEIZURE_MGMT_NOTE_SHEET },
  { key: "detentionMemos", label: "Detention", href: ROUTES.DETENTION_MEMO },
  { key: "assessments", label: "Assessment", href: ROUTES.SEIZURE_MGMT_ASSESSMENT },
  { key: "recoveryMemos", label: "Recovery", href: ROUTES.SEIZURE_MGMT_RECOVERY_MEMO },
  { key: "seizureReports", label: "Seizure Report", href: ROUTES.SEIZURE_MGMT_SEIZURE_REPORT },
] as const

const pipelineChartConfig = {
  count: { label: "Records", color: "#155DFC" },
} satisfies ChartConfig

function formatWhen(iso?: string): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function activityHref(row: SeizureMgmtActivity): string {
  if (row.kind === "note_sheet") return getSeizureMgmtNoteSheetDetailPath(row.id)
  if (row.kind === "detention") return getDetentionMemoDetailPath(row.id)
  if (row.kind === "assessment") return getSeizureMgmtAssessmentDetailPath(row.id)
  if (row.kind === "recovery") return getSeizureMgmtRecoveryMemoDetailPath(row.id)
  return getSeizureMgmtSeizureReportDetailPath(row.id)
}

function kindLabel(kind: SeizureMgmtActivity["kind"]): string {
  if (kind === "note_sheet") return "Note sheet"
  if (kind === "detention") return "Detention"
  if (kind === "assessment") return "Assessment"
  if (kind === "recovery") return "Recovery"
  return "Seizure report"
}

export default function SeizureManagementDashboardPage() {
  const { data, isLoading, isError, error, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["seizure-mgmt", "overview"],
    queryFn: fetchSeizureMgmtOverview,
    refetchInterval: 15_000,
  })

  const overview: SeizureMgmtOverview = data ?? emptySeizureMgmtOverview
  const windowDays = overview.detentionWindowDays ?? DETENTION_WINDOW_DAYS
  const overdueCount = overview.detentionOverdue

  const stats = [
    {
      label: "Note Sheets",
      value: overview.noteSheets,
      today: overview.noteSheetsToday,
      pending: overview.noteSheetsPending,
      icon: StickyNote,
      color: "text-sky-600",
      bg: "bg-sky-50",
      href: ROUTES.SEIZURE_MGMT_NOTE_SHEET,
    },
    {
      label: "Detention Memos",
      value: overview.detentionMemos,
      today: overview.detentionsToday,
      pending: overdueCount,
      pendingLabel: "overdue",
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
      href: ROUTES.DETENTION_MEMO,
    },
    {
      label: "Assessments",
      value: overview.assessments,
      today: overview.assessmentsToday,
      pending: overview.assessmentsPending,
      icon: ClipboardCheck,
      color: "text-green-600",
      bg: "bg-green-50",
      href: ROUTES.SEIZURE_MGMT_ASSESSMENT,
    },
    {
      label: "Recovery Memos",
      value: overview.recoveryMemos,
      today: overview.recoveriesToday,
      pending: overview.recoveryPendingApproval,
      icon: Package,
      color: "text-violet-600",
      bg: "bg-violet-50",
      href: ROUTES.SEIZURE_MGMT_RECOVERY_MEMO,
    },
    {
      label: "Seizure Reports",
      value: overview.seizureReportsSubmitted,
      today: overview.seizureReportsToday,
      pending: overview.seizureReportsDraft,
      pendingLabel: "drafts",
      icon: FileText,
      color: "text-amber-600",
      bg: "bg-amber-50",
      href: ROUTES.SEIZURE_MGMT_SEIZURE_REPORT,
    },
  ]

  const pendingRows = [
    {
      label: "Note sheets awaiting approval",
      count: overview.noteSheetsPending,
      href: ROUTES.SEIZURE_MGMT_NOTE_SHEET,
    },
    {
      label: "Approved note sheets ready for detention",
      count: overview.noteSheetsApprovedAvailable,
      href: ROUTES.DETENTION_MEMO,
    },
    {
      label: "Assessments pending approval",
      count: overview.assessmentsPending,
      href: ROUTES.SEIZURE_MGMT_ASSESSMENT,
    },
    {
      label: "Recovery memos pending approval",
      count: overview.recoveryPendingApproval,
      href: ROUTES.SEIZURE_MGMT_RECOVERY_MEMO,
    },
    {
      label: `${windowDays}-day recovery window alerts`,
      count: overdueCount,
      href: ROUTES.SEIZURE_MGMT_DETENTION_REPORTING,
      alert: overdueCount > 0,
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[#101727] text-3xl font-bold">Seizure Management</h1>
          <p className="text-[#697282] text-base mt-1">
            Live detention → assessment → recovery → seizure report lifecycle.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {isLoading
              ? "Loading live counts…"
              : `Updated ${formatWhen(dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : overview.generatedAt)}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {isError ? (
        <Card className="rounded-[10px] border-red-200 bg-red-50">
          <CardContent className="py-4 text-sm text-red-800">
            Could not load live seizure data{error instanceof Error ? `: ${error.message}` : "."}
          </CardContent>
        </Card>
      ) : null}

      {overdueCount > 0 && (
        <Card className="rounded-[10px] border-amber-200 bg-amber-50">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1 text-sm text-amber-900">
              <span className="font-semibold">{overdueCount}</span> detention case(s) exceed the{" "}
              {windowDays}-day recovery window.
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to={ROUTES.SEIZURE_MGMT_DETENTION_REPORTING}>View</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.href} className="block">
            <Card className="rounded-[10px] border-gray-200 py-5 px-5 h-full hover:border-primary/40 transition-colors">
              <CardContent className="p-0 flex items-center gap-3">
                <div className={`rounded-lg p-3 ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[#697282] text-sm truncate">{stat.label}</p>
                  <p className="text-2xl font-bold text-[#101727]">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin inline" /> : stat.value}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {stat.today} today
                    {stat.pending
                      ? ` · ${stat.pending} ${stat.pendingLabel || "pending"}`
                      : ""}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="rounded-[10px] border-gray-200">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-[#101727] mb-4">Live pipeline</h2>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-6">
            {pipeline.map((stage, index) => (
              <Link
                key={stage.key}
                to={stage.href}
                className="rounded-lg border border-gray-100 bg-gray-50/80 p-3 hover:bg-gray-50"
              >
                <p className="text-xs text-[#697282]">
                  {index + 1}. {stage.label}
                </p>
                <p className="text-xl font-bold text-[#101727] mt-1">
                  {isLoading ? "—" : overview[stage.key]}
                </p>
              </Link>
            ))}
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading graph…</p>
          ) : (
            <ChartContainer config={pipelineChartConfig} className="aspect-auto h-[220px] w-full">
              <BarChart
                data={pipeline.map((stage) => ({
                  name: stage.label,
                  count: overview[stage.key],
                }))}
                margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-[10px] border-gray-200">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-[#101727] mb-4">Pending Actions</h2>
            <div className="space-y-1">
              {pendingRows.map((row) => (
                <Link
                  key={row.label}
                  to={row.href}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-muted/30 rounded px-1"
                >
                  <span className="text-sm text-[#697282] flex items-center gap-1">
                    {row.alert ? <Clock className="h-4 w-4" /> : null}
                    {row.label}
                  </span>
                  <Badge variant={row.alert ? "destructive" : row.count > 0 ? "secondary" : "outline"}>
                    {isLoading ? "—" : row.count}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[10px] border-gray-200">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-[#101727] mb-4">Quick Links</h2>
            <div className="space-y-2">
              {pipeline.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-[#101727] group-hover:text-primary">{link.label}</p>
                    <p className="text-xs text-[#697282]">{overview[link.key]} records</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-primary" />
                </Link>
              ))}
              <Link
                to={ROUTES.SEIZURE_MGMT_REPORTS}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div>
                  <p className="text-sm font-medium text-[#101727] group-hover:text-primary">Reports</p>
                  <p className="text-xs text-[#697282]">Detention, recovery, and seizure summaries</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-primary" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[10px] border-gray-200">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-[#101727] mb-4">Recent activity</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading activity…</p>
          ) : overview.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No seizure records yet.</p>
          ) : (
            <div className="divide-y">
              {overview.recentActivity.map((row) => (
                <Link
                  key={`${row.kind}-${row.id}`}
                  to={activityHref(row)}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-muted/30 -mx-1 px-1 rounded"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#101727] truncate">{row.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {kindLabel(row.kind)}
                      {row.subtitle ? ` · ${row.subtitle}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {row.status ? <Badge variant="outline">{row.status}</Badge> : null}
                    <span className="text-xs text-muted-foreground">{formatWhen(row.at)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
