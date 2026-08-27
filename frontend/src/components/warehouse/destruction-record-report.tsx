import { useRef } from "react"
import { Link } from "react-router-dom"
import { FileDown, Flame, Package, Printer, Video } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CameraRecord } from "@/lib/cameras-api"
import type { FireSmokeLogRecord, MemoDistributionRecord } from "@/lib/memo-distribution-api"
import { outcomeLabel, recordingEntries, videoUrlForEntry } from "@/lib/destruction-record-utils"
import { getDetentionMemoDetailPath } from "@/routes/config"

type DestructionRecordReportProps = {
  record: MemoDistributionRecord
  logs: FireSmokeLogRecord[]
  cameras?: CameraRecord[]
  showActions?: boolean
}

export function DestructionRecordReport({
  record,
  logs,
  cameras = [],
  showActions = true,
}: DestructionRecordReportProps) {
  const reportRef = useRef<HTMLDivElement>(null)
  const videos = recordingEntries(record)
  const caseLabel = record.detentionCaseNo || record.id.slice(0, 8)

  const handlePrint = () => window.print()

  const handlePdf = async () => {
    if (!reportRef.current) return
    const html2pdf = (await import("html2pdf.js")).default
    await html2pdf()
      .set({
        margin: 10,
        filename: `destruction-report-${caseLabel}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(reportRef.current)
      .save()
  }

  return (
    <div className="space-y-4 w-full">
      {showActions && (
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print report
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void handlePdf()}>
            <FileDown className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
      )}

      <div ref={reportRef} className="space-y-6 bg-background p-1">
        <div className="border-b pb-4">
          <h2 className="text-xl font-bold">Destruction Report — {caseLabel}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Pakistan Customs warehouse destruction evidence and inventory reconciliation report.
          </p>
          <p className="text-xs text-muted-foreground mt-2 font-mono">Session ID: {record.id}</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Session summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Detention case</p>
                <p className="font-medium">{record.detentionCaseNo || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Status</p>
                <p className="font-medium capitalize">{record.status}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Outcome</p>
                <p className="font-medium">{outcomeLabel(record.outcome, record.status)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Performed by</p>
                <p className="font-medium">{record.performedBy || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Location</p>
                <p className="font-medium">{record.locationCode || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Completed</p>
                <p className="font-medium">
                  {record.completedAt ? new Date(record.completedAt).toLocaleString() : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Cameras used</p>
                <p className="font-medium">{record.cameraIds.length || (record.camera ? 1 : 0)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Fire / smoke</p>
                {record.smokeFireDetected ? (
                  <Badge variant="destructive" className="text-[10px]">Detected</Badge>
                ) : (
                  <p className="font-medium">None</p>
                )}
              </div>
              {record.detentionMemoId && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Linked detention memo</p>
                  <Link
                    to={getDetentionMemoDetailPath(record.detentionMemoId)}
                    className="font-medium text-[#3b82f6] underline text-sm print:text-black print:no-underline"
                  >
                    {record.detentionCaseNo || record.detentionMemoId.slice(0, 8)}
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Items destroyed
              </CardTitle>
            </CardHeader>
            <CardContent>
              {record.selectedItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No item breakdown recorded.</p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>QR</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Unit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {record.selectedItems.map((item) => (
                        <TableRow key={`${item.goods_line_id}-${item.qr_code}`}>
                          <TableCell>{item.description || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{item.qr_code || "—"}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {record.inventoryDeductions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Inventory deductions</CardTitle>
                <CardDescription>Stock quantities reduced after verified destruction.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>QR</TableHead>
                        <TableHead>Before</TableHead>
                        <TableHead>Deducted</TableHead>
                        <TableHead>After</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {record.inventoryDeductions.map((d, idx) => (
                        <TableRow key={`${d.stock_id}-${idx}`}>
                          <TableCell>{d.description || d.case_ref || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{d.qr_code || "—"}</TableCell>
                          <TableCell>{d.quantity_before || "—"}</TableCell>
                          <TableCell>{d.quantity_deducted}</TableCell>
                          <TableCell>{d.quantity_after}</TableCell>
                          <TableCell>{d.status || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="h-4 w-4" />
              Camera recordings ({videos.length})
            </CardTitle>
            <CardDescription>Video evidence captured during destruction.</CardDescription>
          </CardHeader>
          <CardContent>
            {videos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recordings saved for this session.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 print:grid-cols-2">
                {videos.map((v) => {
                  const cam = cameras.find((c) => c.id === v.camera_id)
                  const href = videoUrlForEntry(v)
                  if (!href) return null
                  return (
                    <div key={`${v.camera_id}-${v.filename}`} className="space-y-2 rounded-md border p-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-medium">{cam?.name || `Camera ${v.camera_id}`}</p>
                        {v.duration_seconds != null && v.duration_seconds > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {Math.floor(v.duration_seconds / 60)}m {v.duration_seconds % 60}s
                          </Badge>
                        )}
                      </div>
                      {v.includes_ml_overlay && (
                        <Badge variant="secondary" className="text-[10px]">ML fire/smoke overlay</Badge>
                      )}
                      <video src={href} controls className="w-full rounded-md border aspect-video bg-black print:hidden" />
                      <p className="text-xs text-muted-foreground print:text-black">
                        Recording: {v.filename || "recording.mp4"}
                      </p>
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[#3b82f6] underline print:hidden"
                      >
                        Open video file
                      </a>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-4 w-4" />
              Fire / smoke detection log ({logs.length})
            </CardTitle>
            <CardDescription>
              Audit trail stored in database (warehouse_firesmokedetectionlog).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fire or smoke detections for this session.</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Place</TableHead>
                      <TableHead>Camera</TableHead>
                      <TableHead>Detection</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Alert</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{log.warehouseName || "—"}</TableCell>
                        <TableCell className="text-xs">{log.placeOfDetention || "—"}</TableCell>
                        <TableCell className="text-xs">{log.cameraName || "—"}</TableCell>
                        <TableCell className="text-xs">{log.detectionLabel || log.detectionClass}</TableCell>
                        <TableCell className="text-xs">{(log.confidence * 100).toFixed(0)}%</TableCell>
                        <TableCell className="text-xs">
                          {log.alertTriggered ? (
                            <Badge variant="destructive" className="text-[10px]">Sent</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Logged</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground border-t pt-4">
          Generated from warehouse destruction module. Report reflects server-recorded session data, camera evidence,
          inventory deductions, and ML fire/smoke audit logs.
        </p>
      </div>
    </div>
  )
}
