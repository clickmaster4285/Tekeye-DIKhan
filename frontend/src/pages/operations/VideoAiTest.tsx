import { useEffect, useMemo, useState } from "react"
import { Flame, Loader2, Shield, User, Car, Video } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import { resolveMediaUrl } from "@/lib/cameras-api"
import { analyzeVideoFile, type VideoAnalyzeHit, type VideoAnalyzeResult } from "@/lib/ml-api"
import { ROUTES } from "@/routes/config"

function formatTime(seconds: number): string {
  const total = Math.max(0, Number(seconds) || 0)
  const mm = Math.floor(total / 60)
  const ss = total % 60
  return `${String(mm).padStart(2, "0")}:${ss.toFixed(1).padStart(4, "0")}`
}

function kindBadge(kind: string) {
  if (kind === "known") return "Staff"
  if (kind === "unknown") return "Unknown"
  if (kind === "vehicle") return "Vehicle"
  if (kind === "weapon") return "Weapon"
  if (kind === "fire") return "Fire"
  return kind
}

export default function VideoAiTestPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [person, setPerson] = useState(true)
  const [vehicle, setVehicle] = useState(true)
  const [weapon, setWeapon] = useState(true)
  const [fire, setFire] = useState(true)
  const [matchStaff, setMatchStaff] = useState(true)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState("")
  const [result, setResult] = useState<VideoAnalyzeResult | null>(null)

  const videoPreview = useMemo(
    () => (videoFile ? URL.createObjectURL(videoFile) : ""),
    [videoFile]
  )

  useEffect(() => {
    return () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview)
    }
  }, [videoPreview])

  const runAnalyze = async () => {
    if (!videoFile) {
      toast({
        title: "Upload a video",
        description: "Choose an MP4 (or similar) file to test.",
        variant: "destructive",
      })
      return
    }
    if (!person && !vehicle && !weapon && !fire) {
      toast({
        title: "Select detections",
        description: "Turn on at least one of Person, Vehicle, Weapon, or Fire.",
        variant: "destructive",
      })
      return
    }
    setRunning(true)
    setResult(null)
    setProgress(0)
    setProgressMessage("Uploading…")
    try {
      const data = await analyzeVideoFile(videoFile, {
        person,
        vehicle,
        weapon,
        fire,
        matchStaff: person && matchStaff,
        sampleFps: 0.5,
        onProgress: (job) => {
          setProgress(Math.max(0, Math.min(100, job.progress || 0)))
          if (job.message) setProgressMessage(job.message)
        },
      })
      setResult(data)
      toast({
        title: data.hit_count ? `Tagged ${data.hit_count} detections` : "Video tagged",
        description: data.hit_count
          ? "Download the tagged video or review the hit list."
          : "No selected objects were found. The output video was still generated.",
      })
    } catch (err) {
      toast({
        title: "AI test failed",
        description: err instanceof Error ? err.message : "Could not analyze the video.",
        variant: "destructive",
      })
    } finally {
      setRunning(false)
      setProgress(0)
      setProgressMessage("")
    }
  }

  const outputSrc = result?.output_url ? resolveMediaUrl(result.output_url) : ""
  const downloadName = result?.output_name || outputSrc.split("/").pop() || "tagged.mp4"
  const hits: VideoAnalyzeHit[] = result?.hits || []

  return (
    <ModulePageLayout
      title="Video AI Test"
      description="Upload a video, choose what to detect, match attendance staff by face, and download a tagged MP4."
      breadcrumbs={[
        { label: "AI Analytics", href: ROUTES.ANALYTICS_DASHBOARD },
        { label: "Video AI Test" },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Video className="h-4 w-4" />
              Test file
            </CardTitle>
            <CardDescription>
              Person tags use the same enrolled staff faces as attendance. Unknown people stay labeled unknown.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  MP4, AVI, or MKV — max 1 GB / 2 hours
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm">What do you want to detect?</Label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={person} onCheckedChange={(v) => setPerson(v === true)} />
                <User className="h-4 w-4" />
                Person (known / unknown)
              </label>
              {person ? (
                <label className="ml-6 flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox checked={matchStaff} onCheckedChange={(v) => setMatchStaff(v === true)} />
                  Match attendance staff names
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={vehicle} onCheckedChange={(v) => setVehicle(v === true)} />
                <Car className="h-4 w-4" />
                Vehicle
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={weapon} onCheckedChange={(v) => setWeapon(v === true)} />
                <Shield className="h-4 w-4" />
                Weapon
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={fire} onCheckedChange={(v) => setFire(v === true)} />
                <Flame className="h-4 w-4" />
                Fire & smoke
              </label>
            </div>
            <Button className="w-full" onClick={() => void runAnalyze()} disabled={running}>
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Tagging video…
                </>
              ) : (
                "Run AI"
              )}
            </Button>
            {running ? (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {progressMessage || "Working…"} ({progress}%)
                </p>
                <p className="text-xs text-muted-foreground">
                  Keep this page open. A few minutes of video can take several minutes on this GPU.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {result ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Staff named</p>
                    <p className="text-2xl font-semibold">{result.known_staff?.length || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Unknown people</p>
                    <p className="text-2xl font-semibold">{result.unknown_people || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Vehicles / weapons / fire</p>
                    <p className="text-2xl font-semibold">
                      {(result.vehicles || 0) + (result.weapons || 0) + (result.fires || 0)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Length</p>
                    <p className="text-2xl font-semibold">{formatTime(result.duration_sec || 0)}</p>
                  </CardContent>
                </Card>
              </div>
              {outputSrc ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Tagged video</CardTitle>
                    <CardDescription>
                      Staff names appear on the tag when the face matches attendance enrollment.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <video src={outputSrc} controls className="w-full rounded-md border bg-black" />
                    <Button asChild variant="outline" size="sm">
                      <a href={outputSrc} download={downloadName}>
                        Download tagged video
                      </a>
                    </Button>
                    {result.known_staff?.length ? (
                      <p className="text-sm text-muted-foreground">
                        Recognized: {result.known_staff.join(", ")}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Detections</CardTitle>
                </CardHeader>
                <CardContent>
                  {hits.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No detections for the selected types.</p>
                  ) : (
                    <div className="max-h-[420px] space-y-2 overflow-y-auto">
                      {hits.slice(0, 200).map((hit, index) => (
                        <div
                          key={`${hit.t}-${index}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <span className="font-mono text-xs">{formatTime(hit.t)}</span>
                          <Badge variant="outline">{kindBadge(hit.kind)}</Badge>
                          <span className="min-w-0 flex-1 truncate">{hit.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {Math.round((hit.confidence || 0) * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Upload a video, choose Person / Vehicle / Weapon / Fire, then click Run AI.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ModulePageLayout>
  )
}
