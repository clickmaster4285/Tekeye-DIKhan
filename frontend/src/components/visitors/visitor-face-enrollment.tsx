import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, CheckCircle2, ImagePlus, Loader2, Upload, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useCamera } from "@/hooks/useCamera"
import {
  deleteVisitorFace,
  enrollVisitorFace,
  listVisitorFaces,
  visitorFaceQualityLabel,
  type VisitorFaceList,
} from "@/lib/visitor-face-api"
import { cn } from "@/lib/utils"

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

export function VisitorFaceEnrollment({ visitorId }: { visitorId: number }) {
  const { toast } = useToast()
  const [gallery, setGallery] = useState<VisitorFaceList | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [lastQuality, setLastQuality] = useState<string>("—")
  const [sourceTab, setSourceTab] = useState("webcam")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { videoRef, canvasRef, active, error, start, stop, captureBase64 } = useCamera()

  const required = gallery?.images_required ?? 3
  const maxImages = gallery?.images_max ?? 5
  const count = gallery?.face_count ?? 0
  const progress = Math.min(100, (count / required) * 100)

  const loadGallery = useCallback(async () => {
    const data = await listVisitorFaces(visitorId)
    setGallery(data)
  }, [visitorId])

  useEffect(() => {
    loadGallery().catch((err) =>
      toast({ title: "Could not load face gallery", description: String(err), variant: "destructive" })
    )
  }, [loadGallery, toast])

  const enrollOne = async (image: string) => {
    const result = await enrollVisitorFace(visitorId, image)
    if (!result.accepted) {
      const reason = result.quality?.message || result.error || "Quality check failed"
      setMessage(reason)
      setLastQuality(visitorFaceQualityLabel(result.quality?.quality_score as number | undefined, false))
      return { ok: false, reason }
    }
    const score = result.quality?.quality_score as number | undefined
    setLastQuality(visitorFaceQualityLabel(score, true))
    setMessage(`Accepted (${result.face_count}/${result.images_required})`)
    return { ok: true, reason: "Accepted" }
  }

  const handleCapture = async () => {
    const image = captureBase64()
    if (!image) {
      toast({ title: "No frame captured", description: "Start the camera and try again.", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      const result = await enrollOne(image)
      if (!result.ok) {
        toast({ title: "Image rejected", description: result.reason, variant: "destructive" })
      } else {
        await loadGallery()
      }
    } catch (err) {
      toast({ title: "Capture failed", description: String(err), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const handleFiles = async (list: FileList | File[]) => {
    const files = Array.from(list).filter(isFaceImageFile)
    if (!files.length) {
      toast({ title: "Choose face photos", description: "JPEG or PNG, one person per image.", variant: "destructive" })
      return
    }
    setBusy(true)
    let accepted = 0
    let rejected = 0
    try {
      for (const file of files) {
        if (file.size > MAX_UPLOAD_BYTES) {
          rejected += 1
          continue
        }
        const dataUrl = await readFileAsDataUrl(file)
        const result = await enrollOne(dataUrl)
        if (result.ok) accepted += 1
        else rejected += 1
      }
      await loadGallery()
      toast({
        title: accepted ? "Photos enrolled" : "No photos accepted",
        description: `${accepted} accepted, ${rejected} rejected. One clear face per image.`,
        variant: accepted ? "default" : "destructive",
      })
    } catch (err) {
      toast({ title: "Upload failed", description: String(err), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (faceId: number) => {
    setBusy(true)
    try {
      await deleteVisitorFace(visitorId, faceId)
      await loadGallery()
    } catch (err) {
      toast({ title: "Could not remove photo", description: String(err), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-[18px] font-semibold">
          <Camera className="h-5 w-5 text-[#3b82f6]" /> Face enrollment
        </CardTitle>
        <CardDescription>
          Capture 3–5 clear photos for the visitor gallery. This is used for VMS identity, not staff attendance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_IMAGES}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files)
            e.target.value = ""
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[160px] flex-1">
            <div className="flex items-center justify-between text-sm mb-1">
              <span>Captured</span>
              <span>
                {count} / {required} required · max {maxImages}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <Badge variant={gallery?.is_enrolled ? "default" : "secondary"}>
            {gallery?.is_enrolled ? "Enrolled" : "Need more images"}
          </Badge>
          <Badge variant="outline">Quality: {lastQuality}</Badge>
          {gallery?.is_enrolled && (
            <span className="inline-flex items-center text-sm text-green-600 gap-1">
              <CheckCircle2 className="h-4 w-4" /> Ready for visitor recognition
            </span>
          )}
        </div>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        <div className="grid gap-4 lg:grid-cols-2">
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
              <div className="flex flex-wrap gap-2">
                {!active ? (
                  <Button onClick={start} disabled={busy}>
                    Start camera
                  </Button>
                ) : (
                  <Button variant="outline" onClick={stop} disabled={busy}>
                    Stop camera
                  </Button>
                )}
                <Button onClick={handleCapture} disabled={!active || busy || count >= maxImages}>
                  {busy && sourceTab === "webcam" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Camera className="h-4 w-4 mr-2" />
                  )}
                  Capture
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="upload" className="space-y-3 pt-3">
              <p className="text-sm text-muted-foreground">
                One face per photo. Frontal first, then slight left/right if needed.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={busy || count >= maxImages}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4 mr-2" />
                Upload images
              </Button>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <p className="text-sm font-medium">Gallery</p>
            {gallery?.faces?.length ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {gallery.faces.map((face, index) => (
                  <div key={face.id} className="relative rounded-md border bg-muted/30 overflow-hidden">
                    {face.image_url ? (
                      <img
                        src={face.image_url}
                        alt={`Photo ${index + 1}`}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="aspect-square flex items-center justify-center text-xs text-muted-foreground">
                        Photo {index + 1}
                      </div>
                    )}
                    <span
                      className={cn(
                        "absolute left-1 bottom-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white"
                      )}
                    >
                      {visitorFaceQualityLabel(face.quality_score, true)}
                    </span>
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white disabled:opacity-40"
                      onClick={() => handleDelete(face.id)}
                      disabled={busy}
                      aria-label={`Remove photo ${index + 1}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No enrolled faces yet.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
