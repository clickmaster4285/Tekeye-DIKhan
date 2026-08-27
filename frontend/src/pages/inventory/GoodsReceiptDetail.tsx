import { useParams, Link } from "react-router-dom"
import { ArrowLeft, Package } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ROUTES } from "@/routes/config"

const STORAGE_KEY = "wms_goods_receipt"

type GoodsReceiptRow = {
  id: string
  qrCodeNumber?: string
  grNo: string
  gdNo: string
  customsStation: string
  portOfEntry: string
  caseSeizureRef: string
  consigneeImporterName: string
  pctCode: string
  descriptionOfGoods: string
  quantity: string
  unit: string
  receiptDate: string
  godownWarehouse: string
  examiningOfficerName: string
  status: string
}

function loadById(id: string): GoodsReceiptRow | null {
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
  const v = value ?? "—"
  return (
    <div className="grid grid-cols-[180px_1fr] gap-2 py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{v || "—"}</span>
    </div>
  )
}

export default function GoodsReceiptDetailPage() {
  const { id } = useParams<{ id: string }>()
  const row = id ? loadById(id) : null

  if (!id || !row) {
    return (
      <ModulePageLayout
        title="Goods Receipt Not Found"
        description="The requested record could not be found."
        breadcrumbs={[{ label: "WMS" }, { label: "Inventory Management" }, { label: "Goods Receipt", href: ROUTES.GOODS_RECEIPT }, { label: "Detail" }]}
      >
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">Record not found or has been removed.</p>
            <Button asChild variant="outline">
              <Link to={ROUTES.GOODS_RECEIPT}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Goods Receipt
              </Link>
            </Button>
          </CardContent>
        </Card>
      </ModulePageLayout>
    )
  }

  return (
    <ModulePageLayout
      title={`Goods Receipt: ${row.grNo}`}
      description="Pakistan Customs GR/GD receipt details. Data from localStorage."
      breadcrumbs={[
        { label: "WMS" },
        { label: "Inventory Management" },
        { label: "Goods Receipt", href: ROUTES.GOODS_RECEIPT },
        { label: row.grNo },
      ]}
    >
      <div className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.GOODS_RECEIPT}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to list
          </Link>
        </Button>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {row.grNo}
            </CardTitle>
            <Badge variant={row.status === "Examined" ? "default" : row.status === "Pending" ? "secondary" : "outline"}>{row.status}</Badge>
          </CardHeader>
          <CardContent className="grid gap-1">
            <DetailRow label=" QR Code" value={row.qrCodeNumber ?? ""} />
            <DetailRow label="GR No (Goods Receipt)" value={row.grNo} />
            <DetailRow label="GD No (Goods Declaration)" value={row.gdNo} />
            <DetailRow label="Customs Station" value={row.customsStation} />
            <DetailRow label="Port of Entry" value={row.portOfEntry} />
            <DetailRow label="Case/Seizure Ref" value={row.caseSeizureRef} />
            <DetailRow label="Consignee/Importer" value={row.consigneeImporterName} />
            <DetailRow label="PCT Code" value={row.pctCode} />
            <DetailRow label="Description of Goods" value={row.descriptionOfGoods} />
            <DetailRow label="Quantity" value={row.quantity} />
            <DetailRow label="Unit" value={row.unit} />
            <DetailRow label="Receipt Date" value={row.receiptDate} />
            <DetailRow label="Godown/Warehouse" value={row.godownWarehouse} />
            <DetailRow label="Examining Officer" value={row.examiningOfficerName} />
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
