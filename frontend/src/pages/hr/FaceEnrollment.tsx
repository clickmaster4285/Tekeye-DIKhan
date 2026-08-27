import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Camera, CheckCircle2, Loader2, Sparkles } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useCamera } from "@/hooks/useCamera"
import { fetchStaff, type StaffRecord } from "@/lib/staff-api"
import { recognitionApi, type FaceEnrollment } from "@/lib/recognition-api"
import { ROUTES } from "@/routes/config"

export default function FaceEnrollmentPage() {
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const [staffList, setStaffList] = useState<StaffRecord[]>([])
  const [staffId, setStaffId] = useState<string>(searchParams.get("staff") || "")
  const [enrollment, setEnrollment] = useState<FaceEnrollment | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const { videoRef, canvasRef, active, error, start, stop, captureBase64 } = useCamera()

  const required = enrollment?.images_required ?? 5
  const progress = Math.min(100, ((enrollment?.total_images ?? 0) / required) * 100)

  const selectedStaff = useMemo(
    () => staffList.find((s) => String(s.id) === staffId),
    [staffList, staffId]
  )

  useEffect(() => {
    fetchStaff()
      .then(setStaffList)
      .catch((err) => toast({ title: "Failed to load staff", description: String(err), variant: "destructive" }))
  }, [toast])

  const loadEnrollment = useCallback(async (id: number) => {
    const data = await recognitionApi.enrollmentStatus(id)
    setEnrollment(data)
  }, [])

  useEffect(() => {
    if (!staffId) {
      setEnrollment(null)
      return
    }
    loadEnrollment(Number(staffId)).catch((err) =>
      toast({ title: "Enrollment status failed", description: String(err), variant: "destructive" })
    )
  }, [staffId, loadEnrollment, toast])

  const handleCapture = async () => {
    if (!staffId) {
      toast({ title: "Select a staff member first", variant: "destructive" })
      return
    }
    const image = captureBase64()
    if (!image) {
      toast({ title: "No frame captured", description: "Start the camera and try again.", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      const result = await recognitionApi.capture(Number(staffId), image)
      if (!result.accepted) {
        setMessage(result.quality?.message || "Quality check failed")
        toast({
          title: "Image rejected",
          description: result.quality?.message || "Improve lighting / face the camera",
          variant: "destructive",
        })
      } else {
        setMessage(`Accepted (${result.total_images}/${result.images_required})`)
        await loadEnrollment(Number(staffId))
      }
    } catch (err) {
      toast({ title: "Capture failed", description: String(err), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const handleTrain = async () => {
    if (!staffId) return
    setBusy(true)
    try {
      const result = await recognitionApi.train(Number(staffId))
      setEnrollment(result.enrollment)
      toast({
        title: "Face trained",
        description: `Embedding dim ${result.embedding_dim} from ${result.images_used} images`,
      })
    } catch (err) {
      toast({ title: "Training failed", description: String(err), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModulePageLayout
      title="Face Enrollment"
      description="Capture at least 5 quality face images, then train InsightFace embeddings for attendance."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.ATTENDANCE}>Records</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={ROUTES.ATTENDANCE_MONITOR}>Live Monitor</Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Staff & progress</CardTitle>
            <CardDescription>Select staff, capture images, then train.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Staff member</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.full_name}
                      {s.employee_id ? ` (${s.employee_id})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedStaff && (
              <div className="rounded-lg border p-3 text-sm space-y-1">
                <div className="font-medium">{selectedStaff.full_name}</div>
                <div className="text-muted-foreground">
                  {selectedStaff.department} · {selectedStaff.designation}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Images</span>
                <span>
                  {enrollment?.total_images ?? 0} / {required}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant={enrollment?.is_enrolled ? "default" : "secondary"}>
                  {enrollment?.is_enrolled ? "Enrolled" : "Need more images"}
                </Badge>
                <Badge variant={enrollment?.is_trained ? "default" : "outline"}>
                  {enrollment?.is_trained ? "Trained" : "Not trained"}
                </Badge>
              </div>
              {message && <p className="text-sm text-muted-foreground">{message}</p>}
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleCapture} disabled={!active || busy || !staffId}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Camera className="h-4 w-4 mr-2" />}
                Capture
              </Button>
              <Button
                variant="secondary"
                onClick={handleTrain}
                disabled={busy || !enrollment?.is_enrolled || !!enrollment?.is_trained}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Train embeddings
              </Button>
              {enrollment?.is_trained && (
                <span className="inline-flex items-center text-sm text-green-600 gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Ready for recognition
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Webcam</CardTitle>
            <CardDescription>Face the camera with good lighting. One person only.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              {!active ? (
                <Button onClick={start}>Start camera</Button>
              ) : (
                <Button variant="outline" onClick={stop}>
                  Stop camera
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
