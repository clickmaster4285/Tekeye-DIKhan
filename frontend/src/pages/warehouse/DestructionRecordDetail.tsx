import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DestructionRecordReport } from "@/components/warehouse/destruction-record-report"
import { useCameras } from "@/hooks/use-cameras"
import {
  fetchFireSmokeLogs,
  fetchMemoDistributionById,
  type FireSmokeLogRecord,
  type MemoDistributionRecord,
} from "@/lib/memo-distribution-api"
import { ROUTES } from "@/routes/config"

export default function DestructionRecordDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { cameras } = useCameras({ activeOnly: true })
  const [record, setRecord] = useState<MemoDistributionRecord | null | undefined>(undefined)
  const [logs, setLogs] = useState<FireSmokeLogRecord[]>([])

  useEffect(() => {
    if (!id) {
      setRecord(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [full, fireLogs] = await Promise.all([
          fetchMemoDistributionById(id),
          fetchFireSmokeLogs({ distributionId: id }),
        ])
        if (!cancelled) {
          setRecord(full)
          setLogs(fireLogs)
        }
      } catch {
        if (!cancelled) setRecord(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (!id) {
    return (
      <ModulePageLayout
        title="Destruction record not found"
        description="Missing record id."
        breadcrumbs={[{ label: "WMS" }, { label: "Warehouse" }, { label: "Destruction", href: ROUTES.DESTRUCTION }]}
      >
        <Button asChild variant="outline">
          <Link to={ROUTES.DESTRUCTION}>Back to destruction</Link>
        </Button>
      </ModulePageLayout>
    )
  }

  if (record === undefined) {
    return (
      <ModulePageLayout
        title="Destruction report"
        description="Loading…"
        breadcrumbs={[
          { label: "WMS" },
          { label: "Warehouse" },
          { label: "Destruction", href: ROUTES.DESTRUCTION },
          { label: "Report" },
        ]}
      >
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Loading destruction report…</p>
          </CardContent>
        </Card>
      </ModulePageLayout>
    )
  }

  if (!record) {
    return (
      <ModulePageLayout
        title="Destruction record not found"
        description="This session could not be loaded."
        breadcrumbs={[
          { label: "WMS" },
          { label: "Warehouse" },
          { label: "Destruction", href: ROUTES.DESTRUCTION },
          { label: "Report" },
        ]}
      >
        <Button asChild variant="outline">
          <Link to={ROUTES.DESTRUCTION}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to destruction
          </Link>
        </Button>
      </ModulePageLayout>
    )
  }

  const caseLabel = record.detentionCaseNo || record.id.slice(0, 8)

  return (
    <ModulePageLayout
      title={`Destruction report — ${caseLabel}`}
      description="Detailed destruction report with items, recordings, inventory deductions, and fire/smoke audit log."
      breadcrumbs={[
        { label: "WMS" },
        { label: "Warehouse" },
        { label: "Destruction", href: ROUTES.DESTRUCTION },
        { label: caseLabel },
      ]}
    >
      <div className="mb-4">
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.DESTRUCTION}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to destruction
          </Link>
        </Button>
      </div>
      <DestructionRecordReport record={record} logs={logs} cameras={cameras} />
    </ModulePageLayout>
  )
}
