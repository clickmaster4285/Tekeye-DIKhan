import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, Video } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MlCameraFeed } from "@/components/cameras/ml-camera-feed"
import { CameraMlReadings, useMlReadingsState } from "@/components/cameras/camera-ml-readings"
import { MlSystemStatus } from "@/components/cameras/ml-system-status"
import { fetchCamera, cameraSourceLabel, type CameraRecord } from "@/lib/cameras-api"
import { ROUTES } from "@/routes/config"

type CameraManagementViewProps = {
  backHref?: string
  backLabel?: string
}

export function CameraManagementView({
  backHref = ROUTES.CAMERA_MANAGEMENT,
  backLabel = "Camera Management",
}: CameraManagementViewProps) {
  const { id } = useParams<{ id: string }>()
  const [camera, setCamera] = useState<CameraRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const ml = useMlReadingsState()

  useEffect(() => {
    const camId = Number(id)
    if (!id || Number.isNaN(camId)) {
      setError("Invalid camera id")
      setLoading(false)
      return
    }
    setLoading(true)
    fetchCamera(camId)
      .then(setCamera)
      .catch((err) => setError(err instanceof Error ? err.message : "Camera not found"))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <ModulePageLayout
        title="Camera view"
        description="Loading live feed…"
        breadcrumbs={[{ label: backLabel, href: backHref }, { label: "View" }]}
      >
        <p className="text-sm text-muted-foreground py-12 text-center">Loading camera…</p>
      </ModulePageLayout>
    )
  }

  if (error || !camera) {
    return (
      <ModulePageLayout
        title="Camera view"
        description="Could not load camera"
        breadcrumbs={[{ label: backLabel, href: backHref }, { label: "View" }]}
      >
        <p className="text-sm text-destructive mb-4">{error ?? "Not found"}</p>
        <Button variant="outline" asChild>
          <Link to={backHref}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to list
          </Link>
        </Button>
      </ModulePageLayout>
    )
  }

  return (
    <ModulePageLayout
      title={camera.name}
      description={`${cameraSourceLabel(camera)} · ${camera.zone}`}
      breadcrumbs={[
        { label: backLabel, href: backHref },
        { label: camera.name },
      ]}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={backHref}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to cameras
            </Link>
          </Button>
          <MlSystemStatus />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Video className="h-5 w-5" />
                Live feed
              </CardTitle>
              <CardDescription>
                Channel {camera.channel}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 pb-4 px-4">
              <MlCameraFeed
                camera={camera}
                pollMl
                pollIntervalMs={2500}
                className="rounded-lg border"
                showBrandLogo
                showFullscreenButton
                onScanStart={ml.onScanStart}
                onDetections={ml.onDetections}
                onMlError={ml.onScanError}
              />
            </CardContent>
          </Card>

          <div className="lg:col-span-1">
            <CameraMlReadings
              camera={camera}
              readings={ml.readings}
              lastScanAt={ml.lastScanAt}
              scanning={ml.scanning}
              error={ml.error}
            />
          </div>
        </div>
      </div>
    </ModulePageLayout>
  )
}

export default function CameraManagementViewPage() {
  return <CameraManagementView />
}

export function AnalyticsCameraManagementViewPage() {
  return (
    <CameraManagementView
      backHref={ROUTES.ANALYTICS_CAMERA_MANAGEMENT}
      backLabel="Camera Management"
    />
  )
}

export function CameraIntegrationViewPage() {
  return (
    <CameraManagementView
      backHref={ROUTES.CAMERA_INTEGRATION}
      backLabel="Camera Integration"
    />
  )
}
