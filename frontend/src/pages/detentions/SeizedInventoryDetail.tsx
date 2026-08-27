import { useParams, Link } from "react-router-dom"
import { ArrowLeft, FileText, Package } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DestructionRecordsPanel } from "@/components/warehouse/destruction-records-panel"
import { ROUTES, getDetentionMemoDetailPath } from "@/routes/config"
import { GoodsLineText, goodsLineCellClass } from "@/components/goods/goods-line-text-field"

const STORAGE_KEY = "wms_seized_inventory"

type GoodsLineItem = {
  id: string
  qrCodeNumber?: string
  description: string
  pctCode: string
  quantity: string
  unit: string
  condition: string
  assessableValuePkr: string
  identificationRef: string
  itemNotes: string
  perishable?: boolean
}

type SeizedRow = {
  id: string
  sourceDetentionId: string
  seizedAt: string
  caseNo: string
  firNumber?: string
  referenceNumber: string
  dateTimeOccurrence: string
  placeOfOccurrence: string
  dateTimeDetention: string
  placeOfDetention: string
  detentionType: string
  directorate: string
  reasonForDetention: string
  whereDeposited: string
  settlementStatus: string
  verificationStatus: string
  briefFacts?: string
  forwardingOfficerRemarks?: string
  accusedName?: string
  accusedCnic?: string
  accusedAddress?: string
  goodsItems?: GoodsLineItem[]
  seizingOfficerNotes?: string
  examiningOfficerNotes?: string
  detentionNotes?: string
  createdAt: string
  updatedAt?: string
}

function loadById(id: string): SeizedRow | null {
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

function DetailRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-2 py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value ?? "—"}</span>
    </div>
  )
}

function formatSeizedDate(d: string) {
  if (!d) return "—"
  try {
    const date = new Date(d)
    return date.toLocaleString()
  } catch {
    return d
  }
}

export default function SeizedInventoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const row = id ? loadById(id) : null

  if (!id || !row) {
    return (
      <ModulePageLayout
        title="Seized Item Not Found"
        description="The requested record could not be found."
        breadcrumbs={[
          { label: "WMS" },
          { label: "Seizure & Receipt" },
          { label: "Seizure Register", href: ROUTES.SEIZURE_REGISTER },
          { label: "Detail" },
        ]}
      >
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">Record not found or has been removed.</p>
            <Button asChild variant="outline">
              <Link to={ROUTES.SEIZURE_REGISTER}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Seizure Register
              </Link>
            </Button>
          </CardContent>
        </Card>
      </ModulePageLayout>
    )
  }

  return (
    <ModulePageLayout
      title={`Seized: ${row.caseNo}`}
      description="Pakistan Customs seized inventory details (transferred from detention). Data from localStorage."
      breadcrumbs={[
        { label: "WMS" },
        { label: "Seizure & Receipt" },
        { label: "Seizure Register", href: ROUTES.SEIZURE_REGISTER },
        { label: row.caseNo },
      ]}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {row.caseNo}
          </CardTitle>
          <Badge variant="default">Seized</Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-sm font-medium mb-2">Seized Information</h4>
            <div className="rounded-lg border p-4">
              <DetailRow label="Seized Date" value={formatSeizedDate(row.seizedAt)} />
              <div className="grid grid-cols-[180px_1fr] gap-2 py-2 border-b border-border/50 last:border-0">
                <span className="text-sm text-muted-foreground">Source Detention</span>
                <span className="text-sm font-medium">
                  <Link to={getDetentionMemoDetailPath(row.sourceDetentionId)} className="text-primary hover:underline">
                    View original detention memo
                  </Link>
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Basic Information</h4>
            <div className="rounded-lg border p-4">
              <DetailRow label="Case No." value={row.caseNo} />
              <DetailRow label="Reference Number" value={row.referenceNumber} />
              <DetailRow label="Date/Time of occurrence" value={row.dateTimeOccurrence} />
              <DetailRow label="Place of occurrence" value={row.placeOfOccurrence} />
              <DetailRow label="Date/Time of detention" value={row.dateTimeDetention} />
              <DetailRow label="Place of detention" value={row.placeOfDetention} />
              <DetailRow label="Detention Type" value={row.detentionType} />
              <DetailRow label="Directorate" value={row.directorate} />
              <DetailRow label="Reason for detention" value={row.reasonForDetention} />
              <DetailRow label="Goods detained at" value={row.whereDeposited} />
              <DetailRow label="Settlement Status" value={row.settlementStatus} />
            </div>
          </div>

          {(row.accusedName || row.accusedCnic || row.accusedAddress) && (
            <div>
              <h4 className="text-sm font-medium mb-2">Accused Person Details</h4>
              <div className="rounded-lg border p-4">
                <DetailRow label="Accused Name" value={row.accusedName} />
                <DetailRow label="CNIC" value={row.accusedCnic} />
                <DetailRow label="Address" value={row.accusedAddress} />
              </div>
            </div>
          )}

          {row.briefFacts && (
            <div>
              <h4 className="text-sm font-medium mb-2">Brief Facts</h4>
              <div className="rounded-lg border p-4">
                <p className="text-sm whitespace-pre-wrap">{row.briefFacts}</p>
              </div>
            </div>
          )}

          {row.goodsItems && row.goodsItems.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Goods Information
              </h4>
              <div className="rounded-lg border overflow-hidden">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead> QR Code</TableHead>
                      <TableHead className="w-[22%]">Description</TableHead>
                      <TableHead>PCT</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Assessable</TableHead>
                      <TableHead>Perishable</TableHead>
                      <TableHead>ID / Chassis</TableHead>
                      <TableHead className="w-[16%]">Item Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {row.goodsItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">{item.qrCodeNumber || "—"}</TableCell>
                        <TableCell className={`${goodsLineCellClass} font-medium`}>
                          <GoodsLineText>{item.description || "—"}</GoodsLineText>
                        </TableCell>
                        <TableCell className="font-mono">{item.pctCode || "—"}</TableCell>
                        <TableCell>{item.quantity || "—"}</TableCell>
                        <TableCell>{item.unit || "—"}</TableCell>
                        <TableCell>{item.condition || "—"}</TableCell>
                        <TableCell>{item.assessableValuePkr || "—"}</TableCell>
                        <TableCell>{item.perishable ? "Yes" : "No"}</TableCell>
                        <TableCell>{item.identificationRef || "—"}</TableCell>
                        <TableCell className={`${goodsLineCellClass} text-muted-foreground`}>
                          <GoodsLineText>{item.itemNotes || "—"}</GoodsLineText>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DestructionRecordsPanel
            detentionMemoId={row.sourceDetentionId}
            caseNo={row.caseNo}
            title="Destruction history"
            description="Warehouse destruction sessions for this seized case — items destroyed, recordings, and stock deductions."
          />

          {(row.seizingOfficerNotes || row.examiningOfficerNotes || row.detentionNotes || row.forwardingOfficerRemarks) && (
            <div>
              <h4 className="text-sm font-medium mb-2">Remarks & Notes</h4>
              <div className="rounded-lg border p-4 space-y-4">
                {row.seizingOfficerNotes && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Seizing Officer Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{row.seizingOfficerNotes}</p>
                  </div>
                )}
                {row.examiningOfficerNotes && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Examining Officer Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{row.examiningOfficerNotes}</p>
                  </div>
                )}
                {row.detentionNotes && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Detention / Customs Clarification Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{row.detentionNotes}</p>
                  </div>
                )}
                {row.forwardingOfficerRemarks && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Forwarding Officer Remarks</p>
                    <p className="text-sm whitespace-pre-wrap">{row.forwardingOfficerRemarks}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <Button asChild variant="outline">
            <Link to={ROUTES.SEIZURE_REGISTER}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Seizure Register
            </Link>
          </Button>
        </CardContent>
      </Card>
    </ModulePageLayout>
  )
}
