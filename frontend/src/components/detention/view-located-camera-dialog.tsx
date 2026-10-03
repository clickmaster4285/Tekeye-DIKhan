import { useEffect, useState } from "react"
import { Camera } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { MlCameraFeed } from "@/components/cameras/ml-camera-feed"
import { fetchCamera, cameraSourceLabel, isCameraAllocated, type CameraRecord } from "@/lib/cameras-api"
import type { LocatedCameraApi } from "@/lib/detention-memo-api"

export type ViewCameraTarget = {
  cameraId: number
  label: string
  itemDescription?: string
  detectedAt?: string
  evidenceUrl?: string
  zone?: string
  location?: string
}

/** Minimal shape shared by detention goods + note sheet goods. */
export type LocatedCameraGoodsSource = {
  locatedCameraId?: number | null
  locatedCamera?: LocatedCameraApi | null
  description?: string
  product?: string
  detectedAt?: string
  evidenceUrl?: string
}

export function locatedCameraIdOf(
  item: Pick<LocatedCameraGoodsSource, "locatedCameraId" | "locatedCamera">
): number | null {
  const camId = item.locatedCameraId ?? item.locatedCamera?.id
  return camId == null ? null : Number(camId)
}

export function locatedCameraLabel(
  cam: LocatedCameraApi | null | undefined,
  _fallbackId?: number | null
): string {
  if (cam) {
    const name =
      (cam.name || "").trim() ||
      (cam.displayLabel || "").trim() ||
      (cam.code || "").trim()
    if (name) {
      const zone = (cam.zone || "").trim()
      return zone ? `${name} · ${zone}` : name
    }
  }
  return "—"
}

export function buildViewCameraTarget(item: LocatedCameraGoodsSource): ViewCameraTarget | null {
  const cameraId = locatedCameraIdOf(item)
  if (cameraId == null) return null
  return {
    cameraId,
    label: locatedCameraLabel(item.locatedCamera, cameraId),
    itemDescription: item.description?.trim() || item.product?.trim() || undefined,
    detectedAt: item.detectedAt?.trim() || undefined,
    evidenceUrl: item.evidenceUrl?.trim() || undefined,
    zone: item.locatedCamera?.zone?.trim() || undefined,
    location: item.locatedCamera?.location?.trim() || undefined,
  }
}

/** Opens live stream (+ evidence snapshot when available) for an item's located camera. */
export function ViewLocatedCameraDialog({
  target,
  onClose,
}: {
  target: ViewCameraTarget | null
  onClose: () => void
}) {
  const [camera, setCamera] = useState<CameraRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!target) {
      setCamera(null)
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setCamera(null)
    fetchCamera(target.cameraId)
      .then((cam) => {
        if (!cancelled) setCamera(cam)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load camera")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [target])

  const hasEvidence = Boolean(target?.evidenceUrl)

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,72rem)] gap-3 overflow-y-auto p-4 sm:max-w-6xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Camera className="h-4 w-4 shrink-0" />
            {target?.label || "Located camera"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {target?.itemDescription
              ? `Item → Camera → Live View for: ${target.itemDescription}`
              : "Live camera feed for this goods line."}
            {target?.zone ? ` · Zone ${target.zone}` : ""}
            {target?.location ? ` · ${target.location}` : ""}
            {target?.detectedAt ? ` · Detected ${target.detectedAt}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className={hasEvidence ? "grid gap-3 lg:grid-cols-2" : "grid gap-3"}>
          <div className="min-h-[min(55vh,420px)] overflow-hidden rounded-lg border bg-black">
            <div className="border-b border-white/10 px-3 py-2">
              <p className="text-xs font-medium text-white/90">Live camera</p>
            </div>
            {loading ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Loading live feed…</p>
            ) : error ? (
              <p className="p-8 text-center text-sm text-destructive">{error}</p>
            ) : camera ? (
              <div className="space-y-2 p-2 sm:p-3">
                <p className="px-1 text-xs text-muted-foreground">
                  {(camera.name || "").trim() || camera.code || "Camera"}
                  {cameraSourceLabel(camera) ? ` · ${cameraSourceLabel(camera)}` : ""}
                  {camera.zone ? ` · ${camera.zone}` : ""}
                  {camera.location ? ` · ${camera.location}` : ""}
                </p>
                {!isCameraAllocated(camera) ? (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    This camera is not assigned in Camera Distribution. Live stream may not start until it is allocated to an ML server.
                  </p>
                ) : null}
                <MlCameraFeed
                  camera={camera}
                  className="rounded-md"
                  showBrandLogo
                  showFullscreenButton
                />
              </div>
            ) : (
              <p className="p-8 text-center text-sm text-muted-foreground">No camera selected.</p>
            )}
          </div>

          {hasEvidence ? (
            <div className="overflow-hidden rounded-lg border bg-muted/20">
              <div className="border-b px-3 py-2">
                <p className="text-xs font-medium">Evidence snapshot</p>
                {target?.detectedAt ? (
                  <p className="text-[11px] text-muted-foreground">Detected {target.detectedAt}</p>
                ) : null}
              </div>
              <div className="flex min-h-[min(55vh,420px)] items-center justify-center bg-black p-3">
                <img
                  src={target!.evidenceUrl}
                  alt="Detection evidence"
                  className="max-h-[min(50vh,400px)] w-full object-contain"
                />
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ViewCameraButton({
  item,
  onView,
  className,
  variant = "outline",
  size = "sm",
}: {
  item: LocatedCameraGoodsSource
  onView: (target: ViewCameraTarget) => void
  className?: string
  variant?: "outline" | "default" | "secondary" | "ghost"
  size?: "sm" | "default" | "lg" | "icon"
}) {
  const target = buildViewCameraTarget(item)
  if (!target) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className ?? "gap-1 whitespace-nowrap"}
      onClick={() => onView(target)}
    >
      <Camera className="h-3.5 w-3.5" />
      View Camera
    </Button>
  )
}
