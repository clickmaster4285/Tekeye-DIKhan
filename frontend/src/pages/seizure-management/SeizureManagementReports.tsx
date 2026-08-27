import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { FileText, ClipboardCheck, Package, BarChart3, Loader2 } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ROUTES } from "@/routes/config"
import { fetchDetentionMemos } from "@/lib/detention-memo-api"
import {
  fetchSeizureMgmtOverview,
  type SeizureMgmtOverview,
} from "@/lib/seizure-management-api"

const reportLinks = [
  {
    title: "Detention Reporting",
    description: "Detention memos, 60-day window, assessment coverage",
    href: ROUTES.SEIZURE_MGMT_DETENTION_REPORTING,
    icon: FileText,
  },
  {
    title: "Recovery Reporting",
    description: "Recovery memos by category and approval status",
    href: ROUTES.SEIZURE_MGMT_RECOVERY_REPORTING,
    icon: Package,
  },
  {
    title: "Assessment Register",
    description: "All examination assessments",
    href: ROUTES.SEIZURE_MGMT_ASSESSMENT,
    icon: ClipboardCheck,
  },
  {
    title: "Seizure Reports",
    description: "Submitted seizure reports",
    href: ROUTES.SEIZURE_MGMT_SEIZURE_REPORT,
    icon: BarChart3,
  },
]

const emptyOverview: SeizureMgmtOverview = {
  noteSheets: 0,
  noteSheetsPending: 0,
  noteSheetsApprovedAvailable: 0,
  assessments: 0,
  assessmentsPending: 0,
  recoveryMemos: 0,
  recoveryPendingApproval: 0,
  seizureReports: 0,
  seizureReportsSubmitted: 0,
}

export default function SeizureManagementReportsPage() {
  const [detentionTotal, setDetentionTotal] = useState(0)
  const [overview, setOverview] = useState<SeizureMgmtOverview>(emptyOverview)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchDetentionMemos().catch(() => []),
      fetchSeizureMgmtOverview().catch(() => emptyOverview),
    ])
      .then(([memos, ov]) => {
        setDetentionTotal(memos.length)
        setOverview(ov)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <ModulePageLayout
      title="Seizure Management Reports"
      description="Central hub for detention, recovery, assessment, and seizure report summaries."
      breadcrumbs={[
        { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT },
        { label: "Reports" },
      ]}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Card className="rounded-[10px]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Detentions</p>
            <p className="text-xl font-bold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : detentionTotal}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-[10px]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Assessments</p>
            <p className="text-xl font-bold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : overview.assessments}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-[10px]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Recovery Memos</p>
            <p className="text-xl font-bold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : overview.recoveryMemos}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-[10px]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Submitted Reports</p>
            <p className="text-xl font-bold">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                overview.seizureReportsSubmitted
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportLinks.map((item) => (
          <Card key={item.href} className="rounded-[10px] border-gray-200 hover:border-primary/30 transition-colors">
            <CardContent className="p-6 flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-blue-50 p-3">
                  <item.icon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[#101727]">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                </div>
              </div>
              <Button variant="outline" className="w-full sm:w-auto self-start" asChild>
                <Link to={item.href}>Open report</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </ModulePageLayout>
  )
}
