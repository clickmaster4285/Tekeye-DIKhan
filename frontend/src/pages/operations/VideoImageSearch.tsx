import { useEffect, useMemo, useState } from "react"
import { Clock, Download, ImagePlus, Loader2, ScanSearch, Video } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import { resolveMediaUrl } from "@/lib/cameras-api"
import { searchImageInVideo, type VideoSearchResponse } from "@/lib/ml-api"
import { ROUTES } from "@/routes/config"

const CLIP_OPTIONS = ["2", "3", "4", "5"] as const

function formatTime(seconds: number): string {
  const total = Math.max(0, Number(seconds) || 0)
  const mm = Math.floor(total / 60)
  const ss = total % 60
  return `${String(mm).padStart(2, "0")}:${ss.toFixed(1).padStart(4, "0")}`
}

function formatScore(score: number): string {
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`
}

export default function VideoImageSearchPage() {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [clipSeconds, setClipSeconds] = useState("4")
  const [searching, setSearching] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState("")
  const [result, setResult] = useState<VideoSearchResponse | null>(null)

  const imagePreview = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : ""),
    [imageFile]
  )
  const videoPreview = useMemo(
    () => (videoFile ? URL.createObjectURL(videoFile) : ""),
    [videoFile]
  )

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])
  useEffect(() => {
    return () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview)
    }
  }, [videoPreview])

  const runSearch = async () => {
    if (!imageFile || !videoFile) {
      toast({
        title: "Upload both files",
        description: "Choose a query photo and a video to search.",
        variant: "destructive",
      })
      return
    }
    setSearching(true)
    setResult(null)
    setProgress(0)
    setProgressMessage("Uploading…")
    try {
      const data = await searchImageInVideo(imageFile, videoFile, {
        clipSeconds: Number(clipSeconds) || 4,
        faceThreshold: 0.45,
        reidThreshold: 0.88,
        onProgress: (job) => {
          setProgress(Math.max(0, Math.min(100, job.progress || 0)))
          if (job.message) setProgressMessage(job.message)
        },
      })
      setResult(data)
      if (!data.segments?.length) {
        toast({
          title: "No match found",
          description: "Try a clearer face/body photo, a shorter clip, or a longer clip length.",
        })
      } else {
        toast({
          title: `Found ${data.segments.length} clip${data.segments.length === 1 ? "" : "s"}`,
          description: `Matched at ${data.hit_count} frame${data.hit_count === 1 ? "" : "s"} in the video.`,
        })
      }
    } catch (err) {
      toast({
        title: "Search failed",
        description: err instanceof Error ? err.message : "Could not search the video.",
        variant: "destructive",
      })
    } finally {
      setSearching(false)
      setProgress(0)
      setProgressMessage("")
    }
  }

  return (
    <ModulePageLayout
      title="Find in Video"
      description="Upload a photo and a video. The model finds that person or object, marks the time, and cuts a 2–5 second clip."
      breadcrumbs={[{ label: "AI Analytics", href: ROUTES.ANALYTICS_DASHBOARD }, { label: "Find in Video" }]}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScanSearch className="h-4 w-4" />
              Search files
            </CardTitle>
            <CardDescription>
              Use a clear front-facing photo of the person (preferred) or vehicle. Matches are verified twice to reduce wrong clips.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm">Query image</Label>
              <Input
                type="file"
                accept="image/*"
                className="mt-1"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Query"
                  className="mt-2 h-36 w-full rounded-md border object-contain bg-muted"
                />
              ) : (
                <div className="mt-2 flex h-36 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Face, full body, or vehicle photo
                </div>
              )}
            </div>
            <div>
              <Label className="text-sm">Video</Label>
              <Input
                type="file"
                accept="video/mp4,video/avi,video/x-matroska,video/*"
                className="mt-1"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
              />
              {videoPreview ? (
                <video src={videoPreview} controls className="mt-2 w-full rounded-md border bg-black" />
              ) : (
                <div className="mt-2 flex h-24 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                  <Video className="mr-2 h-4 w-4" />
                  MP4, AVI, or MKV
                </div>
              )}
            </div>
            <div>
              <Label className="text-sm">Clip length</Label>
              <Select value={clipSeconds} onValueChange={setClipSeconds}>
                <SelectTrigger className="mt-1 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIP_OPTIONS.map((sec) => (
                    <SelectItem key={sec} value={sec}>
                      {sec} seconds
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={() => void runSearch()} disabled={searching}>
              {searching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning video…
                </>
              ) : (
                "Find in video"
              )}
            </Button>
            {searching ? (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {progressMessage || "Scanning…"} ({progress}%)
                </p>
                <p className="text-xs text-muted-foreground">
                  A 1-hour recording usually takes 5–15 minutes (face photo) or 15–25 minutes (vehicle/object). Keep this page open.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {result ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Matches</p>
                    <p className="text-2xl font-semibold">{result.segments.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Video length</p>
                    <p className="text-2xl font-semibold">{formatTime(result.video?.duration_sec || 0)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Detected as</p>
                    <p className="text-2xl font-semibold capitalize">{result.query?.label || "image"}</p>
                  </CardContent>
                </Card>
              </div>
              {result.segments.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    No matching person or object was found in this video.
                  </CardContent>
                </Card>
              ) : (
                result.segments.map((segment, index) => {
                  const clipSrc = segment.clip_url ? resolveMediaUrl(segment.clip_url) : ""
                  const previewSrc = segment.preview_url ? resolveMediaUrl(segment.preview_url) : ""
                  return (
                    <Card key={`${segment.peak_t_sec}-${index}`}>
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <CardTitle className="text-base">
                            Clip {index + 1}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(segment.start_sec)} – {formatTime(segment.end_sec)}
                            </Badge>
                            <Badge>{formatScore(segment.peak_score)}</Badge>
                            <Badge variant="outline">{segment.match_type}</Badge>
                          </div>
                        </div>
                        <CardDescription>
                          Peak at {formatTime(segment.peak_t_sec)} · {segment.hit_count} matching frames
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-3 md:grid-cols-[160px_1fr]">
                        {previewSrc ? (
                          <img
                            src={previewSrc}
                            alt={`Match ${index + 1}`}
                            className="h-36 w-full rounded-md border object-cover bg-muted"
                          />
                        ) : (
                          <div className="h-36 rounded-md border bg-muted" />
                        )}
                        <div className="min-w-0 space-y-2">
                          {clipSrc ? (
                            <video src={clipSrc} controls className="w-full rounded-md border bg-black" />
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Timestamp marked, but a clip could not be cut (ffmpeg missing).
                            </p>
                          )}
                          {clipSrc ? (
                            <Button asChild variant="outline" size="sm">
                              <a href={clipSrc} download={`clip-${index + 1}.mp4`}>
                                <Download className="mr-2 h-4 w-4" />
                                Download clip
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Upload a photo and a video, then click Find in video. Matching 2–5 second clips will appear here with timestamps.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ModulePageLayout>
  )
}
