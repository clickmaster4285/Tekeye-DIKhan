import { Link } from "react-router-dom"
import { FileText, Package, Paperclip, QrCode, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getDetentionMemoDetailPath, ROUTES } from "@/routes/config"
import type { DetentionMemoApiRecord } from "@/lib/detention-memo-api"
import { GoodsLineText, goodsLineCellClass } from "@/components/goods/goods-line-text-field"

function DetailRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-border/50 py-2 sm:grid-cols-[180px_1fr] sm:gap-2">
      <span className="text-sm text-muted-foreground break-words">{label}</span>
      <span className="text-sm font-medium break-words">{value ?? "—"}</span>
    </div>
  )
}

function getQrCodeUrl(data: string, size = 180) {
  const responsiveSize = typeof window !== "undefined" && window.innerWidth < 640 ? 120 : size
  return `https://api.qrserver.com/v1/create-qr-code/?size=${responsiveSize}x${responsiveSize}&data=${encodeURIComponent(data)}`
}

function getGoodsQrPayload(memoId: string, item: { id: string; qrCodeNumber?: string }): string {
  const ref = item.qrCodeNumber || `${memoId}-${item.id}`
  return `${window.location.origin}${getDetentionMemoDetailPath(memoId)}?goodsQr=${encodeURIComponent(ref)}&view=goods`
}

/** Full detention memo read-only sections — same layout/width as detention memo detail. */
export function DetentionMemoReadOnlyView({ memo }: { memo: DetentionMemoApiRecord }) {
  const qrPayload =
    memo.memoQrCodePayload ||
    `${typeof window !== "undefined" ? window.location.origin : ""}${getDetentionMemoDetailPath(memo.id)}?print=full`
  const qrNumber = memo.memoQrCodeNumber || `DM-${memo.caseNo}`

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:gap-6 md:grid-cols-[1fr_220px]">
        <Card className="border-dashed">
          <CardContent className="pt-5">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Basic Information
            </h4>
            <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
              <DetailRow label="Case No." value={memo.caseNo} />
              <DetailRow label="Detention Memo No." value={memo.referenceNumber || "—"} />
              <DetailRow label="Date/Time of occurrence" value={memo.dateTimeOccurrence} />
              <DetailRow label="Place of occurrence" value={memo.placeOfOccurrence} />
              <DetailRow label="Date/Time of detention" value={memo.dateTimeDetention} />
              <DetailRow label="Place of detention" value={memo.placeOfDetention} />
              <DetailRow label="Detention Type" value={memo.detentionType} />
              <DetailRow label="Directorate" value={memo.directorate} />
              <DetailRow label="Reason for detention" value={memo.reasonForDetention} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <QrCode className="h-4 w-4" /> Memo QR
            </h4>
            <div className="flex justify-center">
              <img
                src={getQrCodeUrl(
                  qrPayload,
                  typeof window !== "undefined" && window.innerWidth < 640 ? 150 : 180
                )}
                alt="Memo QR code"
                className="border rounded-lg p-2 bg-white max-w-full h-auto"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3 break-all">{qrNumber}</p>
            <Button variant="outline" size="sm" className="w-full mt-3" asChild>
              <Link to={`${ROUTES.DETENTION_MEMO}/${encodeURIComponent(memo.id)}?print=qr`}>
                Print QR
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Memo Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
          <DetailRow label="Goods detained at" value={memo.whereDeposited} />
          <DetailRow label="Settlement Status" value={memo.settlementStatus} />
          <DetailRow label="Verification Status" value={memo.verificationStatus} />
        </CardContent>
      </Card>

      {(memo.owner?.name || memo.owner?.cnic || memo.owner?.contact || memo.owner?.picture) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Owner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
              <DetailRow label="Name" value={memo.owner?.name} />
              <DetailRow label="CNIC" value={memo.owner?.cnic} />
              <DetailRow label="Contact" value={memo.owner?.contact} />
            </div>
            {memo.owner?.picture && (
              <img
                src={memo.owner.picture}
                alt="Owner"
                className="max-h-48 rounded-lg border object-contain bg-muted/30 w-full sm:w-auto"
              />
            )}
          </CardContent>
        </Card>
      )}

      {(memo.driver?.name || memo.driver?.cnic || memo.driver?.contact || memo.driver?.picture) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Driver
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
              <DetailRow label="Name" value={memo.driver?.name} />
              <DetailRow label="CNIC" value={memo.driver?.cnic} />
              <DetailRow label="Contact" value={memo.driver?.contact} />
            </div>
            {memo.driver?.picture && (
              <img
                src={memo.driver.picture}
                alt="Driver"
                className="max-h-48 rounded-lg border object-contain bg-muted/30 w-full sm:w-auto"
              />
            )}
          </CardContent>
        </Card>
      )}

      {memo.purposeOfDetention && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Purpose of Detention</CardTitle>
          </CardHeader>
          <CardContent className="rounded-lg border p-4">
            <p className="text-sm whitespace-pre-wrap break-words">{memo.purposeOfDetention}</p>
          </CardContent>
        </Card>
      )}

      {memo.mediaAttachments && memo.mediaAttachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Attached documents & videos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {memo.mediaAttachments.map((att) =>
              att.kind === "video" ? (
                <div key={att.id} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground break-words">
                    {att.originalFilename || "Video"}
                  </p>
                  <video
                    src={att.url}
                    controls
                    className="w-full max-w-2xl rounded-lg border bg-black"
                  >
                    Your browser does not support video playback.
                  </video>
                </div>
              ) : (
                <div key={att.id}>
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

      {memo.briefFacts && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Memo Description</CardTitle>
          </CardHeader>
          <CardContent className="rounded-lg border p-4">
            <p className="text-sm whitespace-pre-wrap break-words">{memo.briefFacts}</p>
          </CardContent>
        </Card>
      )}

      {memo.goodsItems && memo.goodsItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Goods Information
            </CardTitle>
          </CardHeader>
          <CardContent className="rounded-lg border p-0">
            <div className="overflow-x-auto">
              <ScrollArea className="w-full">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>QR Code</TableHead>
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
                    {memo.goodsItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">
                          <div className="space-y-1">
                            <img
                              src={getQrCodeUrl(getGoodsQrPayload(memo.id, item), 56)}
                              alt={`Goods QR ${item.qrCodeNumber || item.id}`}
                              className="h-14 w-14 border rounded p-1 bg-white"
                            />
                            <span className="block text-[10px] text-muted-foreground max-w-[80px] break-all">
                              {item.qrCodeNumber || "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className={`${goodsLineCellClass} font-medium`}>
                          <GoodsLineText>{item.description || "—"}</GoodsLineText>
                        </TableCell>
                        <TableCell className="font-mono">{item.pctCode?.trim() || "—"}</TableCell>
                        <TableCell>{item.quantity || "—"}</TableCell>
                        <TableCell>{item.unit || "—"}</TableCell>
                        <TableCell>{item.condition || "—"}</TableCell>
                        <TableCell>{item.assessableValuePkr?.trim() || "—"}</TableCell>
                        <TableCell>{item.perishable ? "Yes" : "No"}</TableCell>
                        <TableCell>{item.identificationRef || "—"}</TableCell>
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
                                  alt={`Goods ${idx + 1}`}
                                  className="h-10 w-10 object-cover rounded border"
                                />
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}

      {(memo.seizingOfficerNotes ||
        memo.examiningOfficerNotes ||
        memo.detentionNotes ||
        memo.forwardingOfficerRemarks) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Additional Information</CardTitle>
          </CardHeader>
          <CardContent className="rounded-lg border p-4 space-y-4">
            {memo.seizingOfficerNotes && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Seizing Officer Notes
                </p>
                <p className="text-sm whitespace-pre-wrap break-words">{memo.seizingOfficerNotes}</p>
              </div>
            )}
            {memo.examiningOfficerNotes && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Examining Officer Notes
                </p>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {memo.examiningOfficerNotes}
                </p>
              </div>
            )}
            {memo.detentionNotes && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Detention / Customs Clarification Notes
                </p>
                <p className="text-sm whitespace-pre-wrap break-words">{memo.detentionNotes}</p>
              </div>
            )}
            {memo.forwardingOfficerRemarks && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Forwarding Officer Remarks
                </p>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {memo.forwardingOfficerRemarks}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
