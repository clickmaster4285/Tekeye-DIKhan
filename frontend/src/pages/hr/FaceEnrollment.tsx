import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Camera, CheckCircle2, ImagePlus, Loader2, Sparkles, Upload, X } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useCamera } from "@/hooks/useCamera"
import { fetchStaff, type StaffRecord } from "@/lib/staff-api"
import { recognitionApi, type FaceEnrollment } from "@/lib/recognition-api"
import { ROUTES } from "@/routes/config"
import { cn } from "@/lib/utils"

type PendingImage = {
  id: string
  name: string
  previewUrl: string
  file: File
  status: "pending" | "uploading" | "accepted" | "rejected"
  message?: string
}

const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp,image/bmp,.jpg,.jpeg,.png,.webp,.bmp"
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

function isFaceImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true
  return /\.(jpe?g|png|webp|bmp)$/i.test(file.name)
}

export default function FaceEnrollmentPage() {
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const [staffList, setStaffList] = useState<StaffRecord[]>([])
  const [staffId, setStaffId] = useState<string>(searchParams.get("staff") || "")
  const [enrollment, setEnrollment] = useState<FaceEnrollment | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [sourceTab, setSourceTab] = useState("webcam")
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { videoRef, canvasRef, active, error, start, stop, captureBase64 } = useCamera()

  const required = enrollment?.images_required ?? 5
  const progress = Math.min(100, ((enrollment?.total_images ?? 0) / required) * 100)
  const pendingCount = pendingImages.filter((img) => img.status === "pending" || img.status === "rejected").length

  const selectedStaff = useMemo(
    () => staffList.find((s) => String(s.id) === staffId),
    [staffList, staffId]
  )

  useEffect(() => {
    fetchStaff()
      .then(setStaffList)
      .catch((err) => toast({ title: "Failed to load staff", description: String(err), variant: "destructive" }))
  }, [toast])

  useEffect(() => {
    return () => {
      pendingImages.forEach((img) => URL.revokeObjectURL(img.previewUrl))
    }
    // Intentionally unmount-only; revoke individual URLs in add/remove/clear handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const addFiles = (list: FileList | File[]) => {
    const files = Array.from(list)
    const skipped: string[] = []
    const next: PendingImage[] = []
    for (const file of files) {
      if (!isFaceImageFile(file)) {
        skipped.push(`${file.name} (not an image)`)
        continue
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        skipped.push(`${file.name} (over 8 MB)`)
        continue
      }
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        file,
        status: "pending",
      })
    }
    if (next.length) {
      setPendingImages((prev) => [...prev, ...next])
      setSourceTab("upload")
    }
    if (skipped.length) {
      toast({
        title: "Some files were skipped",
        description: skipped.slice(0, 4).join(", "),
        variant: "destructive",
      })
    }
  }

  const removePending = (id: string) => {
    setPendingImages((prev) => {
      const item = prev.find((img) => img.id === id)
      if (item) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((img) => img.id !== id)
    })
  }

  const clearPending = () => {
    setPendingImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.previewUrl))
      return []
    })
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const enrollOneImage = async (image: string) => {
    const result = await recognitionApi.capture(Number(staffId), image)
    if (!result.accepted) {
      const reason = result.quality?.message || "Quality check failed"
      setMessage(reason)
      return { ok: false, reason }
    }
    setMessage(`Accepted (${result.total_images}/${result.images_required})`)
    return { ok: true, reason: "Accepted" }
  }

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
      const result = await enrollOneImage(image)
      if (!result.ok) {
        toast({
          title: "Image rejected",
          description: result.reason,
          variant: "destructive",
        })
      } else {
        await loadEnrollment(Number(staffId))
      }
    } catch (err) {
      toast({ title: "Capture failed", description: String(err), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const handleUpload = async () => {
    if (!staffId) {
      toast({ title: "Select a staff member first", variant: "destructive" })
      return
    }
    const queue = pendingImages.filter((img) => img.status === "pending" || img.status === "rejected")
    if (!queue.length) {
      toast({ title: "Choose photos first", description: "Add JPEG or PNG face photos to enroll." })
      return
    }
    setBusy(true)
    let accepted = 0
    let rejected = 0
    try {
      for (const item of queue) {
        setPendingImages((prev) =>
          prev.map((img) => (img.id === item.id ? { ...img, status: "uploading", message: "Checking face…" } : img))
        )
        try {
          const dataUrl = await readFileAsDataUrl(item.file)
          const result = await enrollOneImage(dataUrl)
          if (result.ok) {
            accepted += 1
            setPendingImages((prev) =>
              prev.map((img) =>
                img.id === item.id ? { ...img, status: "accepted", message: "Accepted" } : img
              )
            )
          } else {
            rejected += 1
            setPendingImages((prev) =>
              prev.map((img) =>
                img.id === item.id ? { ...img, status: "rejected", message: result.reason } : img
              )
            )
          }
        } catch (err) {
          rejected += 1
          setPendingImages((prev) =>
            prev.map((img) =>
              img.id === item.id ? { ...img, status: "rejected", message: String(err) } : img
            )
          )
        }
      }
      await loadEnrollment(Number(staffId))
      toast({
        title: accepted ? "Photos enrolled" : "No photos accepted",
        description: `${accepted} accepted, ${rejected} rejected. Face must be clear and one person only.`,
        variant: accepted ? "default" : "destructive",
      })
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
      description="Capture from a webcam or upload face photos, then train InsightFace embeddings for attendance."
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
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_IMAGES}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files)
          e.target.value = ""
        }}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Staff & progress</CardTitle>
            <CardDescription>Select staff, add photos from camera or files, then train.</CardDescription>
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
                {busy && sourceTab === "webcam" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Camera className="h-4 w-4 mr-2" />
                )}
                Capture
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSourceTab("upload")
                  fileInputRef.current?.click()
                }}
                disabled={busy}
              >
                <ImagePlus className="h-4 w-4 mr-2" />
                Upload images
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
            <CardTitle>Face photos</CardTitle>
            <CardDescription>Use the webcam or upload existing photos. One clear face per image.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={sourceTab} onValueChange={setSourceTab}>
              <TabsList>
                <TabsTrigger value="webcam">
                  <Camera className="h-4 w-4" />
                  Webcam
                </TabsTrigger>
                <TabsTrigger value="upload">
                  <Upload className="h-4 w-4" />
                  Upload
                </TabsTrigger>
              </TabsList>

              <TabsContent value="webcam" className="space-y-3 pt-3">
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
              </TabsContent>

              <TabsContent value="upload" className="space-y-3 pt-3">
                <div
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors",
                    dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 bg-muted/20"
                  )}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
                  }}
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Drop face photos here</p>
                  <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP · up to 8 MB each · multiple files OK</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose files
                  </Button>
                </div>

                {pendingImages.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {pendingImages.length} selected · {pendingCount} ready to enroll
                      </p>
                      <Button type="button" variant="ghost" size="sm" onClick={clearPending} disabled={busy}>
                        Clear
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {pendingImages.map((img) => (
                        <div key={img.id} className="relative rounded-md border bg-muted/30 overflow-hidden">
                          <img src={img.previewUrl} alt={img.name} className="aspect-square w-full object-cover" />
                          <button
                            type="button"
                            className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white disabled:opacity-40"
                            onClick={() => removePending(img.id)}
                            disabled={busy && img.status === "uploading"}
                            aria-label={`Remove ${img.name}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <div
                            className={cn(
                              "px-1.5 py-1 text-[10px] leading-tight",
                              img.status === "accepted" && "bg-green-600/90 text-white",
                              img.status === "rejected" && "bg-destructive/90 text-white",
                              img.status === "uploading" && "bg-primary/90 text-primary-foreground",
                              img.status === "pending" && "bg-background/90 text-muted-foreground"
                            )}
                          >
                            {img.status === "uploading" ? "Checking…" : img.message || img.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button onClick={handleUpload} disabled={busy || !staffId || pendingCount === 0}>
                  {busy && sourceTab === "upload" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Enroll selected photos
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
