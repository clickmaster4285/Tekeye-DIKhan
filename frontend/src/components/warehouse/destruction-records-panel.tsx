import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Eye, Flame, Video } from "lucide-react"
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
import { fetchMemoDistributions, type MemoDistributionRecord } from "@/lib/memo-distribution-api"
import {
  destructionSummary,
  filterDestructionRecords,
  outcomeLabel,
  recordingEntries,
} from "@/lib/destruction-record-utils"
import { getDestructionDetailPath } from "@/routes/config"

type DestructionRecordsPanelProps = {
  detentionMemoId?: string
  caseNo?: string
  qrCode?: string
  title?: string
  description?: string
}

export function DestructionRecordsPanel({
  detentionMemoId,
  caseNo,
  qrCode,
  title = "Destruction history",
  description = "Warehouse destruction sessions linked to this record — items destroyed, recordings, and inventory deductions.",
}: DestructionRecordsPanelProps) {
  const [records, setRecords] = useState<MemoDistributionRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!detentionMemoId && !caseNo) {
      setRecords([])
      return
    }
    let cancelled = false
    setRecords(null)
    setError(null)
    fetchMemoDistributions({
      detentionMemoId: detentionMemoId || undefined,
      caseRef: !detentionMemoId ? caseNo : undefined,
    })
      .then((rows) => {
        if (!cancelled) setRecords(filterDestructionRecords(rows, { qrCode, caseNo }))
      })
      .catch((err) => {
        if (!cancelled) {
          setRecords([])
          setError(err instanceof Error ? err.message : "Could not load destruction records")
        }
      })
    return () => {
      cancelled = true
    }
  }, [detentionMemoId, caseNo, qrCode])

  const summary = useMemo(() => (records ? destructionSummary(records) : null), [records])

  if (!detentionMemoId && !caseNo) {
    return null
  }

  return (
    <Card className="border-orange-200/60 dark:border-orange-900/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-600" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        {summary && summary.totalSessions > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary">{summary.completedSessions} completed</Badge>
            <Badge variant="outline">{summary.itemsDestroyed} item line(s)</Badge>
            {summary.videoCount > 0 && (
              <Badge variant="outline">
                <Video className="h-3 w-3 mr-1" />
                {summary.videoCount} recording(s)
              </Badge>
            )}
            {summary.fireSessions > 0 && (
              <Badge variant="destructive">{summary.fireSessions} fire/smoke alert(s)</Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {records === null ? (
          <p className="text-sm text-muted-foreground py-2">Loading destruction records…</p>
        ) : error ? (
          <p className="text-sm text-destructive py-2">{error}</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No destruction sessions recorded for this case yet.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Recordings</TableHead>
                  <TableHead>Alert</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-xs font-medium">
                      {record.detentionCaseNo || record.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-xs">{record.selectedItems.length}</TableCell>
                    <TableCell className="text-xs">{outcomeLabel(record.outcome, record.status)}</TableCell>
                    <TableCell className="text-xs">
                      {recordingEntries(record).length > 0 ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {recordingEntries(record).length} video(s)
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {record.smokeFireDetected ? (
                        <Badge variant="destructive" className="text-[10px]">Fire/Smoke</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {record.completedAt ? new Date(record.completedAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        <Link to={getDestructionDetailPath(record.id)}>
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Report
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {qrCode && records && records.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            Showing destruction sessions that include stock line QR <span className="font-mono">{qrCode}</span>.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
