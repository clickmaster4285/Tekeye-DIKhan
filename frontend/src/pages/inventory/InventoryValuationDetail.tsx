import { useParams, Link } from "react-router-dom"
import { ArrowLeft, Calculator } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ROUTES } from "@/routes/config"

const STORAGE_KEY = "wms_inventory_valuation"

type ValuationRow = {
  id: string
  qrCodeNumber?: string
  seizureCaseRef: string
  pctCode: string
  descriptionOfGoods: string
  quantity: string
  unit: string
  valuationMethod: string
  assessableValuePkr: string
  dutyPayablePkr: string
  valuationDate: string
  customsStation: string
  valuingOfficerName: string
  status: string
}

function loadById(id: string): ValuationRow | null {
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

export default function InventoryValuationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const row = id ? loadById(id) : null

  if (!id || !row) {
    return (
      <ModulePageLayout
        title="Valuation Not Found"
        description="The requested record could not be found."
        breadcrumbs={[{ label: "WMS" }, { label: "Inventory Management" }, { label: "Inventory Valuation", href: ROUTES.INVENTORY_VALUATION }, { label: "Detail" }]}
      >
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">Record not found or has been removed.</p>
            <Button asChild variant="outline">
              <Link to={ROUTES.INVENTORY_VALUATION}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Inventory Valuation
              </Link>
            </Button>
          </CardContent>
        </Card>
      </ModulePageLayout>
    )
  }

  return (
    <ModulePageLayout
      title={`Valuation: ${row.seizureCaseRef}`}
      description="Pakistan Customs inventory valuation details. Data from localStorage."
      breadcrumbs={[
        { label: "WMS" },
        { label: "Inventory Management" },
        { label: "Inventory Valuation", href: ROUTES.INVENTORY_VALUATION },
        { label: row.seizureCaseRef },
      ]}
    >
      <div className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.INVENTORY_VALUATION}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to list
          </Link>
        </Button>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              {row.seizureCaseRef}
            </CardTitle>
            <Badge variant={row.status === "Approved" ? "default" : "secondary"}>{row.status}</Badge>
          </CardHeader>
          <CardContent className="grid gap-1">
            <DetailRow label=" QR Code" value={row.qrCodeNumber ?? ""} />
            <DetailRow label="Seizure/Case Ref" value={row.seizureCaseRef} />
            <DetailRow label="PCT Code" value={row.pctCode} />
            <DetailRow label="Description" value={row.descriptionOfGoods} />
            <DetailRow label="Quantity" value={row.quantity} />
            <DetailRow label="Unit" value={row.unit} />
            <DetailRow label="Valuation Method" value={row.valuationMethod} />
            <DetailRow label="Assessable Value (PKR)" value={row.assessableValuePkr} />
            <DetailRow label="Duty Payable (PKR)" value={row.dutyPayablePkr} />
            <DetailRow label="Valuation Date" value={row.valuationDate} />
            <DetailRow label="Customs Station" value={row.customsStation} />
            <DetailRow label="Valuing Officer" value={row.valuingOfficerName} />
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
