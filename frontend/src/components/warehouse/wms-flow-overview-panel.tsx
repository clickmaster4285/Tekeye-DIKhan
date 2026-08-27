import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Package, Warehouse } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  fetchWarehouseStock,
  fetchWmsOverview,
  type WmsOverview,
  type WmsStockApiRow,
} from "@/lib/wms-flow-api"
import { ROUTES } from "@/routes/config"

type WmsFlowOverviewPanelProps = {
  detentionMemoId?: string
  caseNo?: string
  title?: string
  description?: string
}

function formatWhen(value?: string) {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

function overviewFromStock(
  stock: WmsStockApiRow[],
  detentionMemoId?: string,
  caseNo?: string
): WmsOverview {
  const inCustody = stock.filter((s) => (s.status || "").toLowerCase() === "in custody")
  const released = stock.filter((s) => (s.status || "").toLowerCase().includes("release"))
  const destructed = stock.filter((s) => (s.status || "").toLowerCase().includes("destruct"))
  const qty = (rows: WmsStockApiRow[]) =>
    String(rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0))

  return {
    found: stock.length > 0,
    memo: {
      id: detentionMemoId || "",
      caseNo: caseNo || stock[0]?.case_ref || "",
    },
    summary: {
      totalGoodsLines: stock.length,
      totalGoodsQuantity: qty(stock),
      deposited: false,
      depositCount: 0,
      seized: stock.length > 0,
      seizureCount: stock.length > 0 ? 1 : 0,
      released: released.length > 0,
      releaseCount: released.length,
      inInventoryCount: inCustody.length,
      inInventoryQuantity: qty(inCustody),
      releasedQuantity: qty(released),
      destructedCount: destructed.length,
      destructedQuantity: qty(destructed),
      destructionSessionCount: 0,
    },
    stockItems: stock.map((s) => ({
      id: s.id,
      qrCode: s.qr_code,
      caseRef: s.case_ref,
      description: s.description,
      quantity: String(s.quantity),
      unit: s.unit || "PCS",
      status: s.status,
      godownWarehouse: s.godown_warehouse,
    })),
    timeline: [],
  }
}

export function WmsFlowOverviewPanel({
  detentionMemoId,
  caseNo,
  title = "Warehouse flow",
  description = "Deposit, seizure, inventory, release, and destruction status for this detention.",
}: WmsFlowOverviewPanelProps) {
  const [data, setData] = useState<WmsOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!detentionMemoId && !caseNo) {
      setData({ found: false })
      return
    }

    let cancelled = false
    setData(null)
    setError(null)

    ;(async () => {
      try {
        const overview = await fetchWmsOverview({
          detentionMemoId: detentionMemoId || undefined,
          caseNo: caseNo || undefined,
        })
        if (!cancelled) setData(overview)
      } catch {
        try {
          const stock = await fetchWarehouseStock({
            detentionMemoId: detentionMemoId || undefined,
            caseRef: caseNo || undefined,
          })
          if (!cancelled) setData(overviewFromStock(stock, detentionMemoId, caseNo))
        } catch (err) {
          if (!cancelled) {
            setData({ found: false })
            setError(err instanceof Error ? err.message : "Could not load warehouse flow")
          }
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [detentionMemoId, caseNo])

  if (!detentionMemoId && !caseNo) return null

  const summary = data?.summary
  const stockItems = data?.stockItems || []
  const releases = data?.releases || []
  const deposits = data?.deposits || []
  const seizures = data?.seizures || []
  const timeline = data?.timeline || []

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Warehouse className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        {summary && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary">{summary.totalGoodsLines} goods line(s)</Badge>
            {summary.deposited && <Badge variant="outline">{summary.depositCount} deposit(s)</Badge>}
            {summary.seized && <Badge variant="outline">Seized</Badge>}
            <Badge variant="outline">{summary.inInventoryCount} in custody</Badge>
            {summary.released && <Badge variant="outline">{summary.releaseCount} release(s)</Badge>}
            {summary.destructedCount > 0 && (
              <Badge variant="destructive">{summary.destructedCount} destroyed</Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {data === null ? (
          <p className="text-sm text-muted-foreground py-2">Loading warehouse flow…</p>
        ) : error ? (
          <p className="text-sm text-destructive py-2">{error}</p>
        ) : !data.found && stockItems.length === 0 && deposits.length === 0 && seizures.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No warehouse activity recorded for this detention yet.{" "}
            <Link to={ROUTES.DEPOSIT_ACCOUNT_REGISTER} className="underline underline-offset-2">
              Open deposit register
            </Link>
            {" · "}
            <Link to={ROUTES.RELEASE_INVENTORY} className="underline underline-offset-2">
              Release inventory
            </Link>
          </p>
        ) : (
          <>
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-md border p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">In custody qty</p>
                  <p className="text-sm font-semibold">{summary.inInventoryQuantity || "0"}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Released qty</p>
                  <p className="text-sm font-semibold">{summary.releasedQuantity || "0"}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Destroyed qty</p>
                  <p className="text-sm font-semibold">{summary.destructedQuantity || "0"}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total lines</p>
                  <p className="text-sm font-semibold">{summary.totalGoodsLines}</p>
                </div>
              </div>
            )}

            {stockItems.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" />
                  Stock lines
                </p>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>QR</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs font-mono">{item.qrCode || "—"}</TableCell>
                          <TableCell className="text-xs max-w-[220px] truncate">
                            {item.description || "—"}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {item.quantity} {item.unit}
                          </TableCell>
                          <TableCell className="text-xs">{item.godownWarehouse || "—"}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline">{item.status || "—"}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {(deposits.length > 0 || seizures.length > 0 || releases.length > 0) && (
              <div className="grid gap-3 sm:grid-cols-3">
                {deposits.length > 0 && (
                  <div className="rounded-md border p-3 space-y-1">
                    <p className="text-xs font-medium">Deposits</p>
                    {deposits.slice(0, 4).map((d) => (
                      <p key={d.id} className="text-xs text-muted-foreground truncate">
                        {d.caseSeizureRef || d.id.slice(0, 8)} · {d.status}
                      </p>
                    ))}
                  </div>
                )}
                {seizures.length > 0 && (
                  <div className="rounded-md border p-3 space-y-1">
                    <p className="text-xs font-medium">Seizures</p>
                    {seizures.slice(0, 4).map((s) => (
                      <p key={s.id} className="text-xs text-muted-foreground truncate">
                        {s.caseNo} · {formatWhen(s.seizedAt)}
                      </p>
                    ))}
                  </div>
                )}
                {releases.length > 0 && (
                  <div className="rounded-md border p-3 space-y-1">
                    <p className="text-xs font-medium">Releases</p>
                    {releases.slice(0, 4).map((r) => (
                      <p key={r.id} className="text-xs text-muted-foreground truncate">
                        {r.qrCode || "—"} · {formatWhen(r.releasedAt)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {timeline.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Lifecycle timeline</p>
                <ul className="space-y-2">
                  {timeline.slice(0, 8).map((ev) => (
                    <li key={ev.id} className="text-xs border-l-2 border-border pl-3">
                      <span className="font-medium">{ev.event_type}</span>
                      {ev.description ? ` — ${ev.description}` : ""}
                      <span className="block text-muted-foreground">{formatWhen(ev.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
