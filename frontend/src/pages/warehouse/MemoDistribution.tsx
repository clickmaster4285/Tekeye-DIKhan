import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AlertTriangle, Camera, Eye, Package, Play, Square, Video } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { MlCameraFeed } from "@/components/cameras/ml-camera-feed"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCameras } from "@/hooks/use-cameras"
import { cameraSourceLabel } from "@/lib/cameras-api"
import { fetchDetentionMemos, type DetentionMemoApiRecord } from "@/lib/detention-memo-api"
import {
  completeMemoDistribution,
  fetchDestructionAlerts,
  fetchFireSmokeLogs,
  fetchMemoDistributions,
  fetchWarehouseStock,
  reportDestructionDetection,
  startMemoDistribution,
  type DestructionAlertRecord,
  type FireSmokeLogRecord,
  type MemoDistributionRecord,
  type SelectedDestructionItem,
  type WarehouseStockRecord,
} from "@/lib/memo-distribution-api"
import {
  applyDestructionAcrossModules,
  loadStockRows,
  mergeBackendStockRows,
  stockRowsForSync,
} from "@/lib/wms-stock-storage"
import { syncWarehouseStock } from "@/lib/memo-distribution-api"
import type { CameraRecord } from "@/lib/cameras-api"
import { API_BASE_URL } from "@/lib/api"
import { recordingEntries, videoUrlForEntry } from "@/lib/destruction-record-utils"
import { getDestructionDetailPath, ROUTES } from "@/routes/config"

type ItemSelection = {
  selected: boolean
  quantity: string
}

export default function MemoDistributionPage() {
  const navigate = useNavigate()
  const { cameras, loading: camerasLoading } = useCameras({ activeOnly: true })
  const [memos, setMemos] = useState<DetentionMemoApiRecord[]>([])
  const [history, setHistory] = useState<MemoDistributionRecord[]>([])
  const [selectedMemoId, setSelectedMemoId] = useState("")
  const [selectedCameraIds, setSelectedCameraIds] = useState<number[]>([])
  const [itemSelections, setItemSelections] = useState<Record<string, ItemSelection>>({})
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null)
  const [recordingElapsed, setRecordingElapsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<MemoDistributionRecord | null>(null)
  const [activeAlerts, setActiveAlerts] = useState<DestructionAlertRecord[]>([])
  const [fireSmokeLogs, setFireSmokeLogs] = useState<FireSmokeLogRecord[]>([])
  const [backendStock, setBackendStock] = useState<WarehouseStockRecord[]>([])
  const selectedMemo = useMemo(
    () => memos.find((m) => m.id === selectedMemoId) ?? null,
    [memos, selectedMemoId]
  )

  const selectedCameras = useMemo(
    () => cameras.filter((c) => selectedCameraIds.includes(c.id)),
    [cameras, selectedCameraIds]
  )

  const selectedItems = useMemo((): SelectedDestructionItem[] => {
    if (!selectedMemo?.goodsItems) return []
    return selectedMemo.goodsItems
      .filter((g) => itemSelections[g.id]?.selected)
      .map((g) => ({
        goodsLineId: g.id,
        description: g.description || "",
        qrCode: g.qrCodeNumber || "",
        quantity: itemSelections[g.id]?.quantity || g.quantity || "1",
        unit: g.unit || "PCS",
      }))
      .filter((item) => Number(item.quantity) > 0)
  }, [selectedMemo, itemSelections])

  const inventoryMatch = useMemo(() => {
    if (!selectedMemo) return []
    const localStock = loadStockRows()
    const caseNo = (selectedMemo.caseNo || "").trim().toLowerCase()
    const qrs = (selectedMemo.goodsItems || [])
      .map((g) => (g.qrCodeNumber || "").trim().toLowerCase())
      .filter(Boolean)

    const backendMatches = backendStock.filter((row) => Number(row.quantity) > 0)
    if (backendMatches.length > 0) return backendMatches

    return localStock.filter((row) => {
      const ref = (row.seizureCaseRef || "").trim().toLowerCase()
      const qr = (row.qrCodeNumber || "").trim().toLowerCase()
      if (caseNo && ref && (ref === caseNo || ref.includes(caseNo))) return true
      if (qr && qrs.includes(qr)) return true
      return false
    })
  }, [selectedMemo, backendStock])

  const refreshBackendStock = useCallback(async (memoId: string) => {
    try {
      const rows = await fetchWarehouseStock(memoId)
      setBackendStock(rows)
      mergeBackendStockRows(rows)
      return rows
    } catch {
      setBackendStock([])
      return []
    }
  }, [])

  useEffect(() => {
    if (!selectedMemoId) {
      setBackendStock([])
      return
    }
    void refreshBackendStock(selectedMemoId)
  }, [selectedMemoId, refreshBackendStock])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [memoRows, distRows] = await Promise.all([fetchDetentionMemos(), fetchMemoDistributions()])
      setMemos(memoRows)
      setHistory(distRows)
      try {
        setActiveAlerts(await fetchDestructionAlerts({ unacknowledgedOnly: true }))
      } catch {
        setActiveAlerts([])
      }
      try {
        setFireSmokeLogs(await fetchFireSmokeLogs())
      } catch {
        setFireSmokeLogs([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!recording || !recordingStartedAt) {
      setRecordingElapsed(0)
      return
    }
    const tick = () => setRecordingElapsed(Math.floor((Date.now() - recordingStartedAt) / 1000))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [recording, recordingStartedAt])

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    return `${m}:${String(s).padStart(2, "0")}`
  }

  useEffect(() => {
    if (!selectedMemo?.goodsItems?.length) {
      setItemSelections({})
      return
    }
    const next: Record<string, ItemSelection> = {}
    for (const g of selectedMemo.goodsItems) {
      next[g.id] = { selected: true, quantity: g.quantity || "1" }
    }
    setItemSelections(next)
  }, [selectedMemoId, selectedMemo])

  const toggleCamera = (cameraId: number, checked: boolean) => {
    setSelectedCameraIds((prev) => {
      if (checked) return prev.includes(cameraId) ? prev : [...prev, cameraId]
      return prev.filter((id) => id !== cameraId)
    })
  }

  const toggleItem = (goodsLineId: string, checked: boolean) => {
    setItemSelections((prev) => ({
      ...prev,
      [goodsLineId]: {
        selected: checked,
        quantity: prev[goodsLineId]?.quantity || "1",
      },
    }))
  }

  const setItemQuantity = (goodsLineId: string, quantity: string) => {
    setItemSelections((prev) => ({
      ...prev,
      [goodsLineId]: {
        selected: prev[goodsLineId]?.selected ?? true,
        quantity,
      },
    }))
  }

  const handleDetections = useCallback(
    (camera: CameraRecord) =>
      async (boxes: Array<{
        class_name?: string
        label: string
        confidence: number
        bbox?: [number, number, number, number]
        alert?: boolean
      }>) => {
        if (!sessionId || !recording) return
        const alertBoxes = boxes.filter((b) => {
          const text = `${b.class_name || ""} ${b.label || ""}`.toLowerCase()
          return b.alert || /fire|smoke|flame|burning/.test(text)
        })
        if (alertBoxes.length === 0) return

        try {
          const result = await reportDestructionDetection(sessionId, {
            cameraId: camera.id,
            detections: alertBoxes.map((b) => ({
              class_name: b.class_name || b.label,
              label: b.label,
              confidence: b.confidence,
              bbox: b.bbox,
              alert: true,
            })),
          })
          if (result.logCreated && result.log) {
            setFireSmokeLogs((prev) => [result.log!, ...prev])
          }
          if (result.alertCreated && result.alert) {
            setActiveAlerts((prev) => [result.alert!, ...prev])
          }
        } catch {
          // Avoid interrupting the recording UI on transient ML errors.
        }
      },
    [sessionId, recording]
  )

  const onStartRecording = async () => {
    if (!selectedMemoId || selectedCameraIds.length === 0 || selectedItems.length === 0) return
    setProcessing(true)
    setError(null)
    setLastResult(null)
    try {
      await syncWarehouseStock(stockRowsForSync())
      const session = await startMemoDistribution({
        detentionMemoId: selectedMemoId,
        cameraIds: selectedCameraIds,
        selectedItems,
      })
      setSessionId(session.id)
      setRecording(true)
      setRecordingStartedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start recording")
    } finally {
      setProcessing(false)
    }
  }

  const onStopAndProcess = async () => {
    if (!sessionId) return
    setProcessing(true)
    setError(null)
    try {
      const result = await completeMemoDistribution(sessionId)
      setLastResult(result)
      setRecording(false)
      setRecordingStartedAt(null)
      const completedMemoId = result.detentionMemoId
      setSessionId(null)
      const [memoRows, distRows] = await Promise.all([fetchDetentionMemos(), fetchMemoDistributions()])
      setMemos(memoRows)
      setHistory(distRows)
      const updatedMemo = memoRows.find((m) => m.id === completedMemoId)
      applyDestructionAcrossModules({
        detentionMemoId: completedMemoId,
        detentionCaseNo: result.detentionCaseNo || updatedMemo?.caseNo || "",
        referenceNumber: updatedMemo?.referenceNumber,
        selectedItems: result.selectedItems.map((item) => ({
          goodsLineId: item.goods_line_id,
          qrCode: item.qr_code,
          quantity: item.quantity,
          description: item.description,
        })),
        inventoryDeductions: result.inventoryDeductions,
        updatedGoodsLines: (updatedMemo?.goodsItems || []).map((g) => ({
          id: g.id,
          qrCodeNumber: g.qrCodeNumber,
          quantity: g.quantity,
          condition: g.condition,
        })),
      })
      if (completedMemoId) {
        const backendRows = await refreshBackendStock(completedMemoId)
        mergeBackendStockRows(backendRows, updatedMemo?.caseNo)
        if (updatedMemo?.goodsItems?.length) {
          const next: Record<string, ItemSelection> = {}
          for (const g of updatedMemo.goodsItems) {
            next[g.id] = {
              selected: Number(g.quantity) > 0,
              quantity: g.quantity || "0",
            }
          }
          setItemSelections(next)
        }
      }
      try {
        setActiveAlerts(await fetchDestructionAlerts({ unacknowledgedOnly: true }))
      } catch {
        setActiveAlerts([])
      }
      try {
        setFireSmokeLogs(
          await fetchFireSmokeLogs({
            distributionId: result.id,
            detentionMemoId: completedMemoId,
          })
        )
      } catch {
        // keep live-session logs already shown
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete distribution")
      setRecording(false)
      setRecordingStartedAt(null)
    } finally {
      setProcessing(false)
    }
  }

  const canStart =
    Boolean(selectedMemoId) &&
    selectedCameraIds.length > 0 &&
    selectedItems.length > 0 &&
    !recording &&
    !processing

  return (
    <ModulePageLayout
      title="Destruction"
      description="Select a detention and goods lines, choose one or more cameras, record evidence, and process destruction. Inventory is reduced for selected items. Smoke/fire detections alert super admin and warehouse staff at that location."
      breadcrumbs={[{ label: "WMS" }, { label: "Warehouse" }, { label: "Destruction" }]}
    >
      {activeAlerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {activeAlerts.slice(0, 3).map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
            >
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Smoke / fire alert</p>
                <p>{alert.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {alert.cameraName} · {new Date(alert.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Select detention
              </CardTitle>
              <CardDescription>Choose the detention memo, then select item(s) and quantities.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Detention memo</Label>
                <Select value={selectedMemoId || undefined} onValueChange={setSelectedMemoId} disabled={recording}>
                  <SelectTrigger>
                    <SelectValue placeholder={loading ? "Loading…" : "Select detention"} />
                  </SelectTrigger>
                  <SelectContent>
                    {memos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.caseNo || m.referenceNumber || m.id.slice(0, 8)}
                        {m.dispositionStatus ? ` · ${m.dispositionStatus}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedMemo && (
                <div className="rounded-md border p-3 text-sm space-y-2">
                  <p><span className="text-muted-foreground">Case:</span> {selectedMemo.caseNo || "—"}</p>
                  <p><span className="text-muted-foreground">FIR:</span> {selectedMemo.firNumber || "—"}</p>
                  <p>
                    <span className="text-muted-foreground">Disposition:</span>{" "}
                    {selectedMemo.dispositionStatus || "—"}
                  </p>
                  <Badge variant={inventoryMatch.length > 0 ? "default" : "secondary"}>
                    {inventoryMatch.length > 0
                      ? `In inventory (${inventoryMatch.length} stock row(s))`
                      : "Not in warehouse stock"}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    Selected item quantities will be subtracted from stock on completion when matched.
                  </p>
                  <Button variant="link" className="h-auto p-0 text-xs" asChild>
                    <Link to={ROUTES.WAREHOUSE_DETENTION_MEMO}>View detention memos</Link>
                  </Button>
                </div>
              )}

              {selectedMemo && (selectedMemo.goodsItems?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <Label>Goods to destroy</Label>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10" />
                          <TableHead>Description</TableHead>
                          <TableHead className="w-24">Qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedMemo.goodsItems || []).map((g) => {
                          const sel = itemSelections[g.id]
                          return (
                            <TableRow key={g.id}>
                              <TableCell>
                                <Checkbox
                                  checked={sel?.selected ?? false}
                                  disabled={recording}
                                  onCheckedChange={(v) => toggleItem(g.id, v === true)}
                                  aria-label={`Select ${g.description || "item"}`}
                                />
                              </TableCell>
                              <TableCell className="text-xs">
                                <p>{g.description || "—"}</p>
                                <p className="text-muted-foreground">Max: {g.quantity} {g.unit}</p>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  className="h-8 text-xs"
                                  value={sel?.quantity ?? g.quantity}
                                  disabled={recording || !sel?.selected}
                                  onChange={(e) => setItemQuantity(g.id, e.target.value)}
                                />
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedItems.length} item(s) selected for destruction.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Cameras (select one or more)</Label>
                <div className="rounded-md border divide-y max-h-40 overflow-y-auto">
                  {camerasLoading ? (
                    <p className="p-3 text-sm text-muted-foreground">Loading cameras…</p>
                  ) : cameras.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No active cameras configured.</p>
                  ) : (
                    cameras.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedCameraIds.includes(c.id)}
                          disabled={recording}
                          onCheckedChange={(v) => toggleCamera(c.id, v === true)}
                        />
                        <span className="flex-1">
                          {c.name}
                          {` (${cameraSourceLabel(c)})`}
                        </span>
                        {c.location && (
                          <Badge variant="outline" className="text-[10px]">{c.location}</Badge>
                        )}
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedCameraIds.length} camera(s) selected. Full-session recording runs on all feeds until you
                  click Stop & process. Videos include ML fire/smoke overlays when the ML service is running.
                </p>
                {recording && (
                  <p className="text-xs font-medium text-destructive">
                    Recording elapsed: {formatElapsed(recordingElapsed)} — all cameras capturing full evidence.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-2">
                {!recording ? (
                  <Button onClick={() => void onStartRecording()} disabled={!canStart} className="w-full">
                    <Play className="h-4 w-4 mr-2" />
                    Start recording
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={() => void onStopAndProcess()}
                    disabled={processing}
                    className="w-full"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop & process
                  </Button>
                )}
              </div>

              {error && (
                <p className="text-sm text-destructive rounded border border-destructive/30 bg-destructive/5 px-2 py-1.5">
                  {error}
                </p>
              )}

              {lastResult && (
                <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 text-sm space-y-1">
                  <p className="font-medium text-green-800 dark:text-green-300">Destruction completed</p>
                  <p>
                    Outcome:{" "}
                    <strong>
                      {lastResult.outcome === "inventory_deducted" ? "Inventory deducted" : "Marked Destructed"}
                    </strong>
                  </p>
                  {lastResult.smokeFireDetected && (
                    <p className="text-amber-700 dark:text-amber-400">Smoke/fire was detected during this session.</p>
                  )}
                  {lastResult.inventoryDeductions.length > 0 && (
                    <ul className="text-xs list-disc pl-4">
                      {lastResult.inventoryDeductions.map((d) => (
                        <li key={d.stock_id}>
                          {d.description || d.qr_code || d.case_ref}: −{d.quantity_deducted} (remaining {d.quantity_after})
                        </li>
                      ))}
                    </ul>
                  )}
                  {(lastResult.videoUrl || lastResult.cameraVideos.length > 0) && (
                    <div className="space-y-1 pt-1">
                      <p className="text-xs font-medium">Recorded videos</p>
                      {recordingEntries(lastResult).map((v) => {
                        const cam = cameras.find((c) => c.id === v.camera_id)
                        const href = videoUrlForEntry(v)
                        if (!href) return null
                        return (
                          <a
                            key={`${v.camera_id}-${v.filename}`}
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-[#3b82f6] underline text-xs"
                          >
                            {cam?.name || `Camera ${v.camera_id}`} — {v.filename || "recording"}
                          </a>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <Video className="h-4 w-4" />
                Live cameras
                {recording && (
                  <Badge variant="destructive" className="animate-pulse">
                    REC {formatElapsed(recordingElapsed)} · {selectedCameras.length} feed
                    {selectedCameras.length === 1 ? "" : "s"}
                  </Badge>
                )}
                {!recording && selectedCameras.length > 0 && (
                  <Badge variant="secondary">{selectedCameras.length} selected</Badge>
                )}
              </CardTitle>
              <CardDescription>
                All selected cameras stream with live ML detection. Full-length videos are saved from every camera for
                the entire session. Each fire/smoke detection is logged and alerts warehouse staff.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedCameras.length === 0 ? (
                <div className="aspect-video rounded-lg border border-dashed flex items-center justify-center text-sm text-muted-foreground">
                  <Camera className="h-5 w-5 mr-2" />
                  Select one or more cameras to preview streams
                </div>
              ) : (
                <div
                  className={
                    selectedCameras.length === 1
                      ? "grid grid-cols-1 gap-4"
                      : "grid grid-cols-1 md:grid-cols-2 gap-4"
                  }
                >
                  {selectedCameras.map((cam) => (
                    <div key={cam.id} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{cam.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {cameraSourceLabel(cam)}
                            {cam.location ? ` · ${cam.location}` : ""}
                          </p>
                        </div>
                        {recording && (
                          <Badge variant="destructive" className="shrink-0 text-[10px] animate-pulse">
                            REC
                          </Badge>
                        )}
                      </div>
                      <MlCameraFeed
                        camera={cam}
                        pollMl={recording}
                        pollIntervalMs={recording ? 500 : 800}
                        showBrandLogo={selectedCameras.length === 1}
                        showFullscreenButton
                        className="rounded-lg border aspect-video"
                        onDetections={recording ? handleDetections(cam) : undefined}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Fire & smoke detection log
              </CardTitle>
              <CardDescription>
                Every smoke/fire detection is recorded with time, warehouse, place, camera, case, and ML data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fireSmokeLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No fire/smoke detections logged yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border max-h-[360px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Case / FIR</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead>Place</TableHead>
                        <TableHead>Camera</TableHead>
                        <TableHead>Detection</TableHead>
                        <TableHead>Conf.</TableHead>
                        <TableHead>Alert</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fireSmokeLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            <p>{log.detentionCaseNo || "—"}</p>
                            <p className="text-muted-foreground">{log.detentionFirNumber || "—"}</p>
                          </TableCell>
                          <TableCell className="text-xs">
                            <p>{log.warehouseName || "—"}</p>
                            <p className="text-muted-foreground">{log.locationCode || "—"}</p>
                          </TableCell>
                          <TableCell className="text-xs">
                            <p>{log.placeOfDetention || "—"}</p>
                            {log.placeOfOccurrence && (
                              <p className="text-muted-foreground">{log.placeOfOccurrence}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            <p>{log.cameraName || "—"}</p>
                            <p className="text-muted-foreground">
                              {[log.cameraCode, log.cameraIp, log.cameraZone, log.cameraSiteLabel]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </p>
                          </TableCell>
                          <TableCell className="text-xs">
                            <p>{log.detectionLabel || log.detectionClass}</p>
                            <p className="text-muted-foreground">×{log.detectionCount}</p>
                          </TableCell>
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Destruction records</CardTitle>
              <CardDescription>Click a row to view items destroyed, camera recordings, and fire/smoke logs.</CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No destruction records yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Case</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Cameras</TableHead>
                        <TableHead>Recordings</TableHead>
                        <TableHead>Outcome</TableHead>
                        <TableHead>Alert</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((h) => (
                        <TableRow
                          key={h.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(getDestructionDetailPath(h.id))}
                        >
                          <TableCell>{h.detentionCaseNo || h.detentionMemoId.slice(0, 8)}</TableCell>
                          <TableCell className="text-xs">{h.selectedItems.length || "—"}</TableCell>
                          <TableCell className="text-xs">{h.cameraIds.length || (h.camera ? 1 : 0)}</TableCell>
                          <TableCell className="text-xs">
                            {recordingEntries(h).length > 0 ? (
                              <Badge variant="secondary" className="text-[10px]">
                                {recordingEntries(h).length} video{recordingEntries(h).length === 1 ? "" : "s"}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            {h.outcome === "inventory_deducted"
                              ? "Inventory deducted"
                              : h.outcome === "destructed"
                                ? "Destructed"
                                : h.status}
                          </TableCell>
                          <TableCell>
                            {h.smokeFireDetected ? (
                              <Badge variant="destructive" className="text-[10px]">Fire/Smoke</Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {h.completedAt ? new Date(h.completedAt).toLocaleString() : "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(getDestructionDetailPath(h.id))
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </ModulePageLayout>
  )
}
