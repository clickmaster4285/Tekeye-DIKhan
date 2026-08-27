import { useEffect, useState } from "react"
import { useParams, Link, useSearchParams, useLocation } from "react-router-dom"
import { ArrowLeft, FileText, Package, QrCode, Printer, FileOutput, Users, Paperclip } from "lucide-react"
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
import { ROUTES, getDetentionMemoDetailPath, getDetentionMemoListPath, getDetentionMemoSectionCrumb } from "@/routes/config"
import { ScrollArea } from "@/components/ui/scroll-area"
import DetentionMemoReportPrint from "@/components/detention/DetentionMemoReportPrint"
import DetentionMemoQRPrint from "@/components/detention/DetentionMemoQRPrint"
import { DestructionRecordsPanel } from "@/components/warehouse/destruction-records-panel"
import { WmsFlowOverviewPanel } from "@/components/warehouse/wms-flow-overview-panel"
import { fetchDetentionMemoById, type DetentionMemoApiRecord } from "@/lib/detention-memo-api"
import { GoodsLineText, goodsLineCellClass } from "@/components/goods/goods-line-text-field"

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
  images?: string[]
}

function DetailRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-border/50 py-2 sm:grid-cols-[180px_1fr] sm:gap-2">
      <span className="text-sm text-muted-foreground break-words">{label}</span>
      <span className="text-sm font-medium break-words">{value ?? "—"}</span>
    </div>
  )
}

function getQrCodeUrl(data: string, size = 180) {
  // Use responsive sizes based on screen
  const responsiveSize = typeof window !== 'undefined' && window.innerWidth < 640 ? 120 : size
  return `https://api.qrserver.com/v1/create-qr-code/?size=${responsiveSize}x${responsiveSize}&data=${encodeURIComponent(data)}`
}

function getGoodsQrPayload(memoId: string, item: GoodsLineItem): string {
  const ref = item.qrCodeNumber || `${memoId}-${item.id}`
  return `${window.location.origin}${getDetentionMemoDetailPath(memoId)}?goodsQr=${encodeURIComponent(ref)}&view=goods`
}

function goodsMatchesQr(item: GoodsLineItem, memoId: string, qr: string): boolean {
  const q = qr.trim().toLowerCase()
  if (!q) return true
  return (
    (item.qrCodeNumber || "").toLowerCase() === q ||
    item.id.toLowerCase() === q ||
    `${memoId}-${item.id}`.toLowerCase() === q
  )
}

function GoodsInformationBlock({
  memoId,
  items,
  highlightQr,
}: {
  memoId: string
  items: GoodsLineItem[]
  highlightQr?: string
}) {
  const highlight = highlightQr?.trim().toLowerCase() || ""

  if (!items.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No goods line matched this QR code.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" />
          Goods Information
        </CardTitle>
      </CardHeader>
      <CardContent className="rounded-lg border p-0">
        <div className="space-y-3 p-3 sm:hidden">
          {items.map((item) => {
            const isHighlight =
              highlight &&
              ((item.qrCodeNumber || "").toLowerCase() === highlight ||
                item.id.toLowerCase() === highlight)
            return (
              <div
                key={item.id}
                className={`rounded-md border bg-background p-3 ${isHighlight ? "ring-2 ring-primary" : ""}`}
              >
                <div className="mb-3 flex items-start gap-3">
                  <img
                    src={getQrCodeUrl(getGoodsQrPayload(memoId, item), 56)}
                    alt={`Goods QR ${item.qrCodeNumber || item.id}`}
                    className="h-14 w-14 rounded border bg-white p-1"
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">QR Number</p>
                    <p className="break-all text-xs font-medium">{item.qrCodeNumber || "—"}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div><span className="text-muted-foreground">Description: </span><GoodsLineText className="inline-block align-top max-h-20 font-medium">{item.description || "—"}</GoodsLineText></div>
                  <div><span className="text-muted-foreground">PCT Code: </span>{item.pctCode?.trim() || "—"}</div>
                  <div><span className="text-muted-foreground">Qty/Unit: </span>{item.quantity || "—"} / {item.unit || "—"}</div>
                  <div><span className="text-muted-foreground">Condition: </span>{item.condition || "—"}</div>
                  <div><span className="text-muted-foreground">Assessable Value (PKR): </span>{item.assessableValuePkr?.trim() || "—"}</div>
                  <div><span className="text-muted-foreground">Perishable: </span>{item.perishable ? "Yes" : "No"}</div>
                  <div><span className="text-muted-foreground">ID/Chassis: </span><span className="break-words">{item.identificationRef || "—"}</span></div>
                  <div><span className="text-muted-foreground">Notes: </span><GoodsLineText className="inline-block align-top max-h-20">{item.itemNotes || "—"}</GoodsLineText></div>
                </div>
                <div className="mt-3">
                  <p className="mb-1 text-xs text-muted-foreground">Images</p>
                  {item.images && item.images.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {item.images.map((imgUrl, idx) => (
                        <img
                          key={idx}
                          src={imgUrl}
                          alt={`Goods image ${idx + 1}`}
                          className="h-12 w-12 rounded border object-cover"
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <ScrollArea className="w-full">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead> QR Code</TableHead>
                  <TableHead className="w-[22%]">Description</TableHead>
                  <TableHead>PCT Code</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Assessable Value (PKR)</TableHead>
                  <TableHead>Perishable</TableHead>
                  <TableHead>ID / Chassis</TableHead>
                  <TableHead className="w-[16%]">Item Notes</TableHead>
                  <TableHead>Images</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isHighlight =
                    highlight &&
                    ((item.qrCodeNumber || "").toLowerCase() === highlight ||
                      item.id.toLowerCase() === highlight)
                  return (
                    <TableRow
                      key={item.id}
                      className={isHighlight ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : undefined}
                    >
                      <TableCell className="font-mono text-xs">
                        <div className="space-y-1">
                          <img
                            src={getQrCodeUrl(getGoodsQrPayload(memoId, item), typeof window !== 'undefined' && window.innerWidth < 640 ? 40 : 56)}
                            alt={`Goods QR ${item.qrCodeNumber || item.id}`}
                            className="h-10 w-10 sm:h-14 sm:w-14 border rounded p-1 bg-white"
                          />
                          <span className="block text-[10px] text-muted-foreground max-w-[60px] sm:max-w-[80px] break-all">
                            {item.qrCodeNumber || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className={`${goodsLineCellClass} font-medium`}>
                        <GoodsLineText>{item.description || "—"}</GoodsLineText>
                      </TableCell>
                      <TableCell className="font-mono break-words">{item.pctCode?.trim() || "—"}</TableCell>
                      <TableCell>{item.quantity || "—"}</TableCell>
                      <TableCell>{item.unit || "—"}</TableCell>
                      <TableCell>{item.condition || "—"}</TableCell>
                      <TableCell className="break-words min-w-[80px]">{item.assessableValuePkr?.trim() || "—"}</TableCell>
                      <TableCell>{item.perishable ? "Yes" : "No"}</TableCell>
                      <TableCell className="break-words min-w-[100px]">{item.identificationRef || "—"}</TableCell>
                      <TableCell className={`${goodsLineCellClass} text-muted-foreground`}>
                        <GoodsLineText>{item.itemNotes || "—"}</GoodsLineText>
                      </TableCell>
                      <TableCell>
                        {item.images && item.images.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.images.map((imgUrl, idx) => (
                              <img
                                key={idx}
                                src={imgUrl}
                                alt={`Goods image ${idx + 1}`}
                                className="h-8 w-8 sm:h-10 sm:w-10 object-cover rounded border"
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DetentionMemoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { pathname } = useLocation()
  const listPath = getDetentionMemoListPath(pathname)
  const listSection = getDetentionMemoSectionCrumb(pathname)
  const [searchParams] = useSearchParams()
  const [row, setRow] = useState<DetentionMemoApiRecord | null | undefined>(undefined)
  const printMode = searchParams.get("print")
  const autoPrint = searchParams.get("autoprint") === "1"
  const autoSavePdf = searchParams.get("savepdf") === "1"
  const isPrintMode = printMode === "qr" || printMode === "full"
  const goodsQrFilter = searchParams.get("goodsQr")?.trim() || ""
  const goodsOnlyView = searchParams.get("view") === "goods" && !!goodsQrFilter

  useEffect(() => {
    if (!id) {
      setRow(null)
      return
    }
    let cancelled = false
    setRow(undefined)
    fetchDetentionMemoById(id)
      .then((data) => {
        if (!cancelled) setRow(data)
      })
      .catch(() => {
        if (!cancelled) setRow(null)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (isPrintMode && autoPrint && row) {
      const timer = window.setTimeout(() => window.print(), 350)
      return () => window.clearTimeout(timer)
    }
  }, [isPrintMode, autoPrint, row])

  if (!id) {
    return (
      <ModulePageLayout
        title="Detention Memo Not Found"
        description="The requested record could not be found."
        breadcrumbs={[
          listSection,
          { label: "Detention Memo", href: listPath },
          { label: "Detail" },
        ]}
      >
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">Record not found or has been removed.</p>
            <Button asChild variant="outline">
              <Link to={listPath}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Detention Memo
              </Link>
            </Button>
          </CardContent>
        </Card>
      </ModulePageLayout>
    )
  }

  if (row === undefined) {
    return (
      <ModulePageLayout
        title="Detention Memo"
        description="Loading record…"
        breadcrumbs={[
          listSection,
          { label: "Detention Memo", href: listPath },
          { label: "Detail" },
        ]}
      >
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Loading detention memo…</p>
          </CardContent>
        </Card>
      </ModulePageLayout>
    )
  }

  if (!row) {
    return (
      <ModulePageLayout
        title="Detention Memo Not Found"
        description="The requested record could not be found."
        breadcrumbs={[
          listSection,
          { label: "Detention Memo", href: listPath },
          { label: "Detail" },
        ]}
      >
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">Record not found or has been removed.</p>
            <Button asChild variant="outline">
              <Link to={listPath}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Detention Memo
              </Link>
            </Button>
          </CardContent>
        </Card>
      </ModulePageLayout>
    )
  }

  const qrPayload = row.memoQrCodePayload || `${window.location.origin}${getDetentionMemoDetailPath(row.id)}?print=full`
  const qrNumber = row.memoQrCodeNumber || `DM-${row.caseNo}`

  if (printMode === "qr") {
    return (
      <DetentionMemoQRPrint
        caseNo={row.caseNo}
        referenceNumber={row.referenceNumber}
        createdBy={row.createdBy || "ASO Portal"}
        createdAt={row.createdAt}
        qrPayload={qrPayload}
        qrNumber={qrNumber}
      />
    )
  }

  if (printMode === "full") {
    return (
      <DetentionMemoReportPrint
        row={row}
        qrPayload={qrPayload}
        qrNumber={qrNumber}
        autoSavePdf={autoSavePdf}
      />
    )
  }

  if (goodsOnlyView) {
    const visibleGoods = (row.goodsItems || []).filter((item) =>
      goodsMatchesQr(item, row.id, goodsQrFilter)
    )
    const goodsLabel =
      visibleGoods[0]?.description ||
      visibleGoods[0]?.qrCodeNumber ||
      goodsQrFilter

    return (
      <ModulePageLayout
        title={`Goods: ${goodsLabel}`}
        description={`Goods line from detention memo ${row.caseNo}.`}
        breadcrumbs={[
          listSection,
          { label: "Detention Memo", href: listPath },
          { label: row.caseNo, href: `${listPath}/${encodeURIComponent(row.id)}` },
          { label: "Goods" },
        ]}
      >
        <div className="grid gap-4 sm:gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={listPath}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to list
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`${listPath}/${encodeURIComponent(row.id)}`}>
                <FileText className="h-4 w-4 mr-2" />
                View full memo
              </Link>
            </Button>
          </div>
          <GoodsInformationBlock
            memoId={row.id}
            items={visibleGoods}
            highlightQr={goodsQrFilter}
          />
        </div>
      </ModulePageLayout>
    )
  }

  // Normal view (screen) – includes sidebar via ModulePageLayout
  return (
    <ModulePageLayout
      title={`Detention Memo: ${row.caseNo}`}
      description={
        row.referenceNumber
          ? `Memo No. ${row.referenceNumber} · Pakistan Customs detention memo details.`
          : "Pakistan Customs detention memo details. Data from the database."
      }
      breadcrumbs={[
        listSection,
        { label: "Detention Memo", href: listPath },
        { label: row.caseNo },
      ]}
    >
      {/* Global print style to hide sidebar if user accidentally prints this view */}
      <style>{`
        @media print {
          aside, nav, header, .sidebar, .main-nav, .breadcrumbs {
            display: none !important;
          }
          main, .main-content, .print-keep {
            margin-left: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>
      <div className="grid gap-4 sm:gap-6 print-keep">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between px-4 sm:px-6">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <FileText className="h-5 w-5 flex-shrink-0" />
                <span className="break-words">{row.caseNo}</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {row.referenceNumber ? (
                  <>
                    Detention Memo No.{" "}
                    <span className="font-semibold text-foreground">{row.referenceNumber}</span>
                  </>
                ) : (
                  "Detention memo details and printable report."
                )}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Badge variant={row.verificationStatus === "Verified" ? "default" : "secondary"} className="w-fit">
                {row.verificationStatus}
              </Badge>
              <Button variant="outline" asChild size="sm" className="w-full sm:w-auto">
                <Link to={`${listPath}/${encodeURIComponent(row.id)}?print=full`}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print Report
                </Link>
              </Button>
              <Button variant="default" asChild size="sm" className="w-full sm:w-auto">
                <Link to={`${listPath}/${encodeURIComponent(row.id)}?print=full&savepdf=1`}>
                  <FileOutput className="h-4 w-4 mr-2" />
                  Save as PDF
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
            <div className="grid gap-4 sm:gap-6 md:grid-cols-[1fr_220px]">
              <Card className="border-dashed">
                <CardContent className="pt-5">
                  <h4 className="text-sm font-semibold mb-3">Basic Information</h4>
                  <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
                    <DetailRow label="Case No." value={row.caseNo} />
                    <DetailRow label="Detention Memo No." value={row.referenceNumber || "—"} />
                    <DetailRow label="Date/Time of occurrence" value={row.dateTimeOccurrence} />
                    <DetailRow label="Place of occurrence" value={row.placeOfOccurrence} />
                    <DetailRow label="Date/Time of detention" value={row.dateTimeDetention} />
                    <DetailRow label="Place of detention" value={row.placeOfDetention} />
                    <DetailRow label="Detention Type" value={row.detentionType} />
                    <DetailRow label="Directorate" value={row.directorate} />
                    <DetailRow label="Reason for detention" value={row.reasonForDetention} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><QrCode className="h-4 w-4" /> Memo QR</h4>
                  <div className="flex justify-center">
                    <img
                      src={getQrCodeUrl(qrPayload, typeof window !== 'undefined' && window.innerWidth < 640 ? 150 : 180)}
                      alt="Memo QR code"
                      className="border rounded-lg p-2 bg-white max-w-full h-auto"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 break-all">{qrNumber}</p>
                  <Button variant="outline" size="sm" className="w-full mt-3" asChild>
                    <Link to={`${listPath}/${encodeURIComponent(row.id)}?print=qr`}>
                      Print QR
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Memo Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
                <DetailRow label="Goods detained at" value={row.whereDeposited} />
                <DetailRow label="Settlement Status" value={row.settlementStatus} />
                <DetailRow label="Verification Status" value={row.verificationStatus} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Audit Log</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
                  <DetailRow label="Created By" value={row.createdBy || "—"} />
                  <DetailRow label="Created On" value={row.createdAt} />
                  <DetailRow label="Updated By" value={row.updatedBy || "—"} />
                  <DetailRow label="Updated On" value={row.updatedAt ?? row.createdAt} />
                </div>
                {(row.auditLog?.length ?? 0) > 0 ? (
                  <ol className="relative border-l border-muted-foreground/30 ml-2 space-y-4">
                    {row.auditLog!.map((entry) => (
                      <li key={entry.id} className="ml-4">
                        <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border bg-primary border-primary" />
                        <p className="text-sm font-medium">
                          {entry.actionLabel || entry.action}
                          {entry.performedBy ? ` · ${entry.performedBy}` : ""}
                        </p>
                        {entry.message ? (
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{entry.message}</p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "—"}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
                )}
              </CardContent>
            </Card>

            {(row.owner?.name || row.owner?.cnic || row.owner?.contact || row.owner?.picture) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Owner
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
                    <DetailRow label="Name" value={row.owner?.name} />
                    <DetailRow label="CNIC" value={row.owner?.cnic} />
                    <DetailRow label="Contact" value={row.owner?.contact} />
                  </div>
                  {row.owner?.picture && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Photo</p>
                      <img
                        src={row.owner.picture}
                        alt="Owner"
                        className="max-h-48 rounded-lg border object-contain bg-muted/30 w-full sm:w-auto"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {(row.driver?.name || row.driver?.cnic || row.driver?.contact || row.driver?.picture) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Driver
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
                    <DetailRow label="Name" value={row.driver?.name} />
                    <DetailRow label="CNIC" value={row.driver?.cnic} />
                    <DetailRow label="Contact" value={row.driver?.contact} />
                  </div>
                  {row.driver?.picture && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Photo</p>
                      <img
                        src={row.driver.picture}
                        alt="Driver"
                        className="max-h-48 rounded-lg border object-contain bg-muted/30 w-full sm:w-auto"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {row.purposeOfDetention && (
              <Card>
                <CardHeader><CardTitle className="text-base">Purpose of Detention</CardTitle></CardHeader>
                <CardContent className="rounded-lg border p-4">
                  <p className="text-sm whitespace-pre-wrap break-words">{row.purposeOfDetention}</p>
                </CardContent>
              </Card>
            )}

            {row.mediaAttachments && row.mediaAttachments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Attached documents & videos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {row.mediaAttachments.map((att) =>
                    att.kind === "video" ? (
                      <div key={att.id} className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground break-words">{att.originalFilename || "Video"}</p>
                        <video src={att.url} controls className="w-full max-w-2xl rounded-lg border bg-black">
                          Your browser does not support video playback.
                        </video>
                      </div>
                    ) : (
                      <div key={att.id} className="flex flex-wrap items-center gap-3">
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary underline-offset-4 hover:underline break-words"
                        >
                          {att.originalFilename || "Download document"}
                        </a>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            )}

            {row.briefFacts && (
              <Card>
                <CardHeader><CardTitle className="text-base">Memo Description</CardTitle></CardHeader>
                <CardContent className="rounded-lg border p-4">
                  <p className="text-sm whitespace-pre-wrap break-words">{row.briefFacts}</p>
                </CardContent>
              </Card>
            )}

            {row.goodsItems && row.goodsItems.length > 0 && (
              <GoodsInformationBlock memoId={row.id} items={row.goodsItems} />
            )}

            <WmsFlowOverviewPanel detentionMemoId={row.id} caseNo={row.caseNo} />

            <DestructionRecordsPanel
              detentionMemoId={row.id}
              caseNo={row.caseNo}
              title="Destruction history"
              description="All warehouse destruction sessions for this detention — view detailed reports with camera evidence and inventory deductions."
            />

            {(row.seizingOfficerNotes || row.examiningOfficerNotes || row.detentionNotes || row.forwardingOfficerRemarks) && (
              <Card>
                <CardHeader><CardTitle className="text-base">Additional Information</CardTitle></CardHeader>
                <CardContent className="rounded-lg border p-4 space-y-4">
                  {row.seizingOfficerNotes && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Seizing Officer Notes</p>
                      <p className="text-sm whitespace-pre-wrap break-words">{row.seizingOfficerNotes}</p>
                    </div>
                  )}
                  {row.examiningOfficerNotes && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Examining Officer Notes</p>
                      <p className="text-sm whitespace-pre-wrap break-words">{row.examiningOfficerNotes}</p>
                    </div>
                  )}
                  {row.detentionNotes && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Detention / Customs Clarification Notes</p>
                      <p className="text-sm whitespace-pre-wrap break-words">{row.detentionNotes}</p>
                    </div>
                  )}
                  {row.forwardingOfficerRemarks && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Forwarding Officer Remarks</p>
                      <p className="text-sm whitespace-pre-wrap break-words">{row.forwardingOfficerRemarks}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to={listPath}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to list
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}