import { useParams, Link } from "react-router-dom"
import { ArrowLeft, ClipboardCheck } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ROUTES } from "@/routes/config"

const STORAGE_KEY = "wms_cycle_counting_audit"

type CycleCountRow = {
  id: string
  qrCodeNumber?: string
  auditRef: string
  customsStation: string
  godownLocation: string
  auditDate: string
  caseSeizureRef: string
  expectedQty: number
  actualQty: number
  variance: number
  auditedByOfficerName: string
  auditedByBadgeId: string
  status: string
  remarks: string
}

function loadById(id: string): CycleCountRow | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const row = parsed.find((r: { id?: string }) => r.id === id)
    return row ?? null
  } catch {
    return null
  }
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-2 py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value ?? "—"}</span>
    </div>
  )
}

export default function CycleCountingAuditDetailPage() {
  const { id } = useParams<{ id: string }>()
  const row = id ? loadById(id) : null

  if (!id || !row) {
    return (
      <ModulePageLayout
        title="Audit Record Not Found"
        description="The requested record could not be found."
        breadcrumbs={[{ label: "WMS" }, { label: "Inventory Management" }, { label: "Cycle Counting & Audit", href: ROUTES.CYCLE_COUNTING }, { label: "Detail" }]}
      >
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">Record not found or has been removed.</p>
            <Button asChild variant="outline">
              <Link to={ROUTES.CYCLE_COUNTING}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Cycle Counting & Audit
              </Link>
            </Button>
          </CardContent>
        </Card>
      </ModulePageLayout>
    )
  }

  const auditedBy = row.auditedByOfficerName
    ? `${row.auditedByOfficerName}${row.auditedByBadgeId ? ` (${row.auditedByBadgeId})` : ""}`
    : "—"

  return (
    <ModulePageLayout
      title={`Audit: ${row.auditRef}`}
      description="Pakistan Customs cycle count and audit details. Data from localStorage."
      breadcrumbs={[
        { label: "WMS" },
        { label: "Inventory Management" },
        { label: "Cycle Counting & Audit", href: ROUTES.CYCLE_COUNTING },
        { label: row.auditRef },
      ]}
    >
      <div className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.CYCLE_COUNTING}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to list
          </Link>
        </Button>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              {row.auditRef}
            </CardTitle>
            <Badge variant={row.status === "Completed" ? "default" : row.status === "Variance Reported" ? "destructive" : "secondary"}>{row.status}</Badge>
          </CardHeader>
          <CardContent className="grid gap-1">
            <DetailRow label=" QR Code" value={row.qrCodeNumber ?? ""} />
            <DetailRow label="Audit Ref" value={row.auditRef} />
            <DetailRow label="Customs Station" value={row.customsStation} />
            <DetailRow label="Godown/Location" value={row.godownLocation} />
            <DetailRow label="Audit Date" value={row.auditDate} />
            <DetailRow label="Case/Seizure Ref" value={row.caseSeizureRef} />
            <DetailRow label="Expected Qty" value={row.expectedQty} />
            <DetailRow label="Actual Qty" value={row.actualQty} />
            <DetailRow label="Variance" value={row.variance > 0 ? `+${row.variance}` : String(row.variance)} />
            <DetailRow label="Audited By" value={auditedBy} />
            <DetailRow label="Remarks" value={row.remarks} />
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
