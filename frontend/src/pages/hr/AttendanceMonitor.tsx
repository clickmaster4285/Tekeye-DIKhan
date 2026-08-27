import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Loader2, Play, Square, ScanFace } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useCamera } from "@/hooks/useCamera"
import { usePolling } from "@/hooks/usePolling"
import { API_BASE_URL, getAuthHeadersFormData } from "@/lib/api"
import { recognitionApi, type CctvOverview, type IdentifyResult } from "@/lib/recognition-api"
import { ROUTES } from "@/routes/config"

export default function AttendanceMonitorPage() {
  const { toast } = useToast()
  const [overview, setOverview] = useState<CctvOverview | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastResult, setLastResult] = useState<IdentifyResult | null>(null)
  const [looping, setLooping] = useState(false)
  const [snapshotUrls, setSnapshotUrls] = useState<Record<number, string>>({})
  const { videoRef, canvasRef, active, error, start, stop, captureBase64 } = useCamera()
  const autoStartedRef = useRef(false)
  const userStoppedRef = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const data = await recognitionApi.cctvOverview()
      setOverview(data)
    } catch {
      /* ignore transient poll errors */
    }
  }, [])

  usePolling(refresh, 2000, true)

  // Auto-start all connected cameras once when CCTV data first loads
  useEffect(() => {
    const cameras = overview?.cameras || []
    if (!cameras.length || autoStartedRef.current || userStoppedRef.current) return
    const running = overview?.running_count ?? 0
    if (running >= cameras.length) {
      autoStartedRef.current = true
      return
    }
    autoStartedRef.current = true
    void recognitionApi
      .cctvAction("start_all")
      .then(() => refresh())
      .catch(() => {
        autoStartedRef.current = false
      })
  }, [overview?.cameras, overview?.running_count, refresh])

  useEffect(() => {
    let cancelled = false
    const cameras = overview?.cameras || []
    const load = async () => {
      const next: Record<number, string> = {}
      await Promise.all(
        cameras
          .filter((c) => c.runtime?.has_snapshot)
          .map(async (cam) => {
            try {
              const res = await fetch(
                `${API_BASE_URL}/api/recognition/cctv/cameras/${cam.id}/snapshot/?t=${Date.now()}`,
                { headers: getAuthHeadersFormData(), cache: "no-store" }
              )
              if (!res.ok) return
              const blob = await res.blob()
              if (cancelled) return
              next[cam.id] = URL.createObjectURL(blob)
            } catch {
              /* ignore */
            }
          })
      )
      if (cancelled) {
        Object.values(next).forEach((u) => URL.revokeObjectURL(u))
        return
      }
      setSnapshotUrls((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u))
        return next
      })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [overview?.running_count, overview?.cameras])

  useEffect(() => {
    return () => {
      Object.values(snapshotUrls).forEach((u) => URL.revokeObjectURL(u))
    }
  }, [snapshotUrls])

  const startAll = async () => {
    setBusy(true)
    userStoppedRef.current = false
    autoStartedRef.current = true
    try {
      await recognitionApi.cctvAction("start_all")
      await refresh()
      toast({ title: "CCTV workers started" })
    } catch (err) {
      toast({ title: "Failed to start CCTV", description: String(err), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const stopAll = async () => {
    setBusy(true)
    userStoppedRef.current = true
    try {
      await recognitionApi.cctvAction("stop_all")
      await refresh()
      toast({ title: "CCTV workers stopped" })
    } catch (err) {
      toast({ title: "Failed to stop CCTV", description: String(err), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const identifyOnce = useCallback(async () => {
    const image = captureBase64()
    if (!image) return
    try {
      const result = await recognitionApi.identify(image, true, "webcam")
      setLastResult(result)
    } catch (err) {
      setLastResult({ matched: false, message: String(err) })
    }
  }, [captureBase64])

  usePolling(identifyOnce, 2500, looping && active)

  return (
    <ModulePageLayout
      title="Attendance Monitor"
      description="Webcam identify loop or InsightFace CCTV workers on attendance cameras."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.FACE_ENROLLMENT}>Enrollment</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={ROUTES.ATTENDANCE}>Records</Link>
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="webcam">
        <TabsList>
          <TabsTrigger value="webcam">Webcam</TabsTrigger>
          <TabsTrigger value="cctv">CCTV</TabsTrigger>
        </TabsList>

        <TabsContent value="webcam" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Live webcam</CardTitle>
                <CardDescription>Auto-marks attendance when a trained face is recognized.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                  <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2 flex-wrap">
                  {!active ? (
                    <Button onClick={start}>Start camera</Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setLooping(false)
                        stop()
                      }}
                    >
                      Stop camera
                    </Button>
                  )}
                  <Button
                    variant={looping ? "destructive" : "secondary"}
                    disabled={!active}
                    onClick={() => setLooping((v) => !v)}
                  >
                    <ScanFace className="h-4 w-4 mr-2" />
                    {looping ? "Stop identify loop" : "Start identify loop"}
                  </Button>
                  <Button variant="outline" disabled={!active} onClick={identifyOnce}>
                    Identify once
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Last result</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {!lastResult && <p className="text-muted-foreground">No identification yet.</p>}
                {lastResult && (
                  <>
                    <Badge variant={lastResult.matched ? "default" : "secondary"}>
                      {lastResult.matched ? "Matched" : "No match"}
                    </Badge>
                    <div>{lastResult.message}</div>
                    {lastResult.staff_name && <div className="font-medium">{lastResult.staff_name}</div>}
                    {typeof lastResult.confidence === "number" && (
                      <div>Confidence: {(lastResult.confidence * 100).toFixed(1)}%</div>
                    )}
                    {lastResult.attendance && (
                      <div className="rounded-md border p-3 space-y-1">
                        <div>Action: {lastResult.attendance.action}</div>
                        <div>{lastResult.attendance.message}</div>
                        {lastResult.attendance.status && <div>Status: {lastResult.attendance.status}</div>}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cctv" className="space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            <Button onClick={startAll} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Start all
            </Button>
            <Button variant="outline" onClick={stopAll} disabled={busy}>
              <Square className="h-4 w-4 mr-2" />
              Stop all
            </Button>
            <Badge variant="secondary">
              Cameras: {overview?.cameras?.length ?? 0} · Running: {overview?.running_count ?? 0}
            </Badge>
          </div>

          {(overview?.cameras || []).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">
                No active cameras found. Add cameras in Camera Management — they will appear here and
                start automatically for attendance.
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(overview?.cameras || []).map((cam) => (
              <Card key={cam.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{cam.name}</CardTitle>
                  <CardDescription>
                    {cam.location || "Camera"} ·{" "}
                    {cam.runtime?.running
                      ? cam.runtime.connected
                        ? "Connected"
                        : "Starting…"
                      : "Stopped"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="aspect-video overflow-hidden rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground">
                    {snapshotUrls[cam.id] ? (
                      <img src={snapshotUrls[cam.id]} alt={cam.name} className="h-full w-full object-cover" />
                    ) : (
                      "No live snapshot"
                    )}
                  </div>
                  {cam.runtime?.last_error && (
                    <p className="text-xs text-destructive">{cam.runtime.last_error}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        recognitionApi
                          .cameraAction(cam.id, "start")
                          .then(refresh)
                          .catch((err) =>
                            toast({ title: "Start failed", description: String(err), variant: "destructive" })
                          )
                      }
                    >
                      Start
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        recognitionApi
                          .cameraAction(cam.id, "stop")
                          .then(refresh)
                          .catch((err) =>
                            toast({ title: "Stop failed", description: String(err), variant: "destructive" })
                          )
                      }
                    >
                      Stop
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-80 overflow-auto text-sm">
              {(overview?.events || []).slice(0, 30).map((ev, idx) => (
                <div key={idx} className="rounded border px-3 py-2 flex justify-between gap-2">
                  <span>
                    {String(ev.time || "")} · {String(ev.camera_name || "")} · {String(ev.message || "")}
                  </span>
                  <span className="text-muted-foreground">
                    {typeof ev.confidence === "number" ? `${(Number(ev.confidence) * 100).toFixed(0)}%` : ""}
                  </span>
                </div>
              ))}
              {!overview?.events?.length && (
                <p className="text-muted-foreground">No events yet. Start CCTV workers after enrolling faces.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </ModulePageLayout>
  )
}
