import { useCallback, useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  AudioLines,
  CheckCircle2,
  Circle,
  FileSearch,
  Film,
  Layers,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
  Video,
  Wrench,
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  fetchVideoRecoveryJob,
  fetchVideoRecoveryJobs,
  retryVideoRecovery,
  uploadVideoForRecovery,
  type DamageMap,
  type HybridReport,
  type CorruptionReport,
  type PipelineStage,
  type VideoRecoveryJob,
} from "@/lib/video-recovery-api"
import { syncAuthCookieFromSession } from "@/lib/auth"
import { resolveMediaUrl } from "@/lib/cameras-api"
import { cn } from "@/lib/utils"

const POLL_MS = 3000

type StageMeta = {
  icon: typeof Film
  description: string
  capabilities: string[]
}

const STAGE_META: Record<string, StageMeta> = {
  upload: {
    icon: Upload,
    description: "Damaged video received via upload API.",
    capabilities: ["Secure upload", "Job registration"],
  },
  validate_upload: {
    icon: ShieldCheck,
    description: "Validates file signature, format, size, and basic integrity.",
    capabilities: ["File signature", "Format check", "Size limits", "Integrity scan"],
  },
  preserve: {
    icon: ShieldCheck,
    description: "Read-only copy preserved; SHA-256 hash recorded. Original never modified.",
    capabilities: ["Read-only copy", "SHA-256 hash", "Chain of custody"],
  },
  damage_analysis: {
    icon: FileSearch,
    description: "Deep analysis of container, streams, packets, and frame damage.",
    capabilities: ["Container damage", "Stream damage", "Frame damage", "Corruption detection"],
  },
  damage_map: {
    icon: Layers,
    description: "Timeline classified: valid, damaged, missing, unrecoverable segments.",
    capabilities: ["Segment map", "Recovery vs regeneration routing", "Timeline strip"],
  },
  recovery: {
    icon: Wrench,
    description: "Recovery technique — restore original data without generating new content.",
    capabilities: ["Container recovery", "Stream recovery", "Packet recovery", "Frame decode", "mdat salvage"],
  },
  regeneration: {
    icon: Sparkles,
    description: "Regeneration technique — 12 corruption types routed to restore, interpolate, or generate.",
    capabilities: [
      "Green/black/block/blur restoration",
      "Missing frame interpolation",
      "Frozen frame replacement",
      "Long-gap generation",
    ],
  },
  hybrid_merge: {
    icon: Video,
    description: "Merge original + recovered + AI-generated segments into one timeline.",
    capabilities: ["Source labeling", "Timeline ordering", "Hybrid output"],
  },
  temporal: {
    icon: Sparkles,
    description: "Temporal consistency pass to reduce flicker and motion jumps.",
    capabilities: ["Flicker reduction", "Motion consistency", "Object consistency"],
  },
  audio: {
    icon: AudioLines,
    description: "Parallel audio pipeline — recover, denoise, sync; label generated audio.",
    capabilities: ["Audio extraction", "Noise reduction", "Gap detection", "Sync"],
  },
  reconstruct: {
    icon: Film,
    description: "Encode final hybrid timeline with synchronized audio.",
    capabilities: ["Frame ordering", "Timestamp rebuild", "H.264 encoding"],
  },
  validate: {
    icon: ShieldCheck,
    description: "Quality validation — artifacts, sync, decode verification.",
    capabilities: ["Frame comparison", "Artifact detection", "Sync validation"],
  },
  completed: {
    icon: CheckCircle2,
    description: "Final output ready — recover what is real + regenerate what is lost.",
    capabilities: ["Download", "Quality report", "Hybrid breakdown"],
  },
}

const STRIP_COLORS: Record<string, string> = {
  valid: "bg-emerald-500",
  damaged_recoverable: "bg-amber-400",
  restored: "bg-blue-500",
  unrecoverable: "bg-red-500",
  missing: "bg-violet-500",
  generated: "bg-violet-500",
}

function DamageMapBar({ map }: { map: DamageMap }) {
  const strip = map.timeline_strip ?? []
  const legend = map.timeline_legend ?? {}
  const counts = map.counts ?? {}

  if (!strip.length && !map.segments?.length) return null

  return (
    <div className="space-y-3">
      {strip.length > 0 && (
        <div className="flex h-3 w-full overflow-hidden rounded-full border bg-muted/30">
          {strip.map((status, i) => (
            <div
              key={`${status}-${i}`}
              className={cn("flex-1 min-w-[2px]", STRIP_COLORS[status] ?? "bg-muted")}
              title={legend[status] ?? status}
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-[10px]">
        {Object.entries(legend).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5 text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-full", STRIP_COLORS[key] ?? "bg-muted")} />
            {label}
            {counts[key] != null ? ` (${counts[key]})` : ""}
          </span>
        ))}
      </div>
      {map.segments && map.segments.length > 0 && (
        <div className="rounded-md border divide-y text-xs">
          {map.segments.map((seg) => (
            <div key={seg.segment_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="font-medium">Segment {seg.segment_id}</span>
              <Badge variant="outline" className="text-[10px] capitalize">
                {seg.status.replace(/_/g, " ")}
              </Badge>
              <span className="text-muted-foreground">
                {seg.technique === "recovery" ? "Recovery" : "Regeneration"}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {seg.start_time}s – {seg.end_time}s
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CorruptionTypesSummary({ report }: { report: CorruptionReport }) {
  const types = report.types ?? []
  const detected = types.filter((t) => t.detected)
  if (!types.length) return null

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted-foreground">
        {detected.length} of {report.catalog_size ?? 12} corruption types detected
      </p>
      <div className="divide-y divide-border/60 max-h-64 overflow-y-auto">
        {types.map((t) => (
          <div
            key={t.key}
            className={cn(
              "py-2 text-xs",
              t.detected ? "opacity-100" : "opacity-40"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">
                {t.id}. {t.name}
              </span>
              {t.detected && (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {t.technique_applied?.replace(/_/g, " ") ?? "active"}
                </Badge>
              )}
            </div>
            {t.detected && (t.frame_count ?? 0) > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{t.frame_count} frames</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function HybridSummary({ report }: { report: HybridReport }) {
  if (!report || !Object.keys(report).length) return null
  const regen = report.regeneration_technique ?? {}
  const breakdown = report.breakdown ?? {}
  const content = report.content_assessment

  return (
    <div className="divide-y divide-border/60">
      {content?.total_visual_loss && (
        <p className="text-xs text-amber-700 dark:text-amber-400 pb-2 leading-relaxed">
          Original scene was destroyed in the upload. Output cannot restore the real video — only
          re-processed green pixels.
        </p>
      )}
      <InfoRow label="Scene recovered" value={report.scene_recovered ? "Yes" : "No"} />
      <InfoRow label="Principle" value="Recover original + regenerate gaps" />
      <InfoRow label="Recovery" value={String(report.recovery_technique ?? "—")} />
      <InfoRow label="Original frames kept" value={String(breakdown.original ?? 0)} />
      <InfoRow label="AI-processed frames" value={String(breakdown.recovered ?? 0)} />
      <InfoRow label="Generated frames" value={String(breakdown.generated ?? 0)} />
      <InfoRow label="Restored (AI)" value={String(regen.restored ?? 0)} />
      <InfoRow label="Interpolated" value={String(regen.interpolated ?? 0)} />
      <InfoRow label="Long-gap generated" value={String(regen.generated ?? 0)} />
      {report.gpu?.available && (
        <InfoRow
          label="GPU"
          value={`${report.gpu.device ?? report.gpu.backend ?? "CUDA"}${report.gpu.nvenc ? " + NVENC" : ""}`}
        />
      )}
      {report.audio_generated_labeled && (
        <p className="text-[10px] text-amber-600 pt-2">Generated audio segments are labeled in metadata.</p>
      )}
    </div>
  )
}

function stageIcon(state: PipelineStage["state"]) {
  if (state === "completed") return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
  if (state === "active") return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
  if (state === "failed") return <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
  return <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60" />
}

function progressPercent(stages: PipelineStage[]): number {
  if (!stages.length) return 0
  const done = stages.filter((s) => s.state === "completed").length
  return Math.round((done / stages.length) * 100)
}

function statusBadge(status: VideoRecoveryJob["status"]) {
  const map = {
    completed: "default" as const,
    failed: "destructive" as const,
    processing: "secondary" as const,
    uploaded: "outline" as const,
  }
  return (
    <Badge variant={map[status]} className="capitalize text-[10px]">
      {status}
    </Badge>
  )
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize">{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm border-b border-border/60 last:border-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium break-all">{value ?? "—"}</span>
    </div>
  )
}

function normalizeIssues(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
    .filter((item) => item.length > 0 && item !== "{}" && item !== "None" && item !== "[object Object]")
}

function ForensicSummary({ report }: { report: Record<string, unknown> }) {
  const signature = report.file_signature as Record<string, unknown> | undefined
  const container = report.container_analysis as Record<string, unknown> | undefined
  const codecs = report.codec_detection as Record<string, unknown> | undefined
  const corruption = report.corruption_detection as Record<string, unknown> | undefined
  const ffprobeRaw = report.ffprobe_raw as Record<string, unknown> | undefined
  const videoCodec = (codecs?.video_codecs as Array<Record<string, unknown>> | undefined)?.[0]
  const issues = normalizeIssues(corruption?.issues)
  const recoveryHint = typeof corruption?.recovery_hint === "string" ? corruption.recovery_hint : ""
  const ffprobeError =
    typeof ffprobeRaw?.error === "string" && ffprobeRaw.error.trim() ? ffprobeRaw.error.trim() : ""

  return (
    <div className="divide-y divide-border/60">
      <InfoRow label="Detected format" value={String(signature?.primary_format ?? "—")} />
      <InfoRow label="Container" value={String(container?.format_long_name || container?.format_name || "—")} />
      <InfoRow
        label="Duration"
        value={
          container?.duration_seconds
            ? `${Number(container.duration_seconds).toFixed(1)}s`
            : "—"
        }
      />
      <InfoRow label="File size" value={container?.size_bytes ? `${(Number(container.size_bytes) / 1024 / 1024).toFixed(2)} MB` : "—"} />
      <InfoRow
        label="Video codec"
        value={videoCodec ? `${videoCodec.codec_name} (${videoCodec.width}×${videoCodec.height})` : "—"}
      />
      <InfoRow
        label="Corruption"
        value={
          corruption?.corruption_detected ? (
            <span className="text-destructive">Detected ({String(corruption.severity)})</span>
          ) : (
            <span className="text-emerald-600">None detected</span>
          )
        }
      />
      {recoveryHint && (
        <p className="text-xs text-muted-foreground pt-2 leading-relaxed">{recoveryHint}</p>
      )}
      {ffprobeError && !issues.some((i) => i.includes(ffprobeError.slice(0, 40))) && (
        <div className="pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Probe error</p>
          <p className="text-xs text-destructive/90 break-words">{ffprobeError}</p>
        </div>
      )}
      {issues.length > 0 && (
        <div className="pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Issues found</p>
          <ul className="space-y-1">
            {issues.map((issue, idx) => (
              <li key={`${issue}-${idx}`} className="text-xs text-destructive/90 flex gap-2">
                <span className="shrink-0">•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function QualitySummary({ report }: { report: Record<string, unknown> }) {
  const frameCmp = report.frame_comparison as Record<string, unknown> | undefined
  const artifacts = report.artifact_detection as Record<string, unknown> | undefined
  const sync = report.sync_validation as Record<string, unknown> | undefined
  const content = report.content_assessment as Record<string, unknown> | undefined
  const artifactList = (artifacts?.artifacts_found as string[] | undefined) ?? []

  return (
    <div className="divide-y divide-border/60">
      <InfoRow label="Quality score" value={`${report.quality_score ?? "—"} / 100`} />
      <InfoRow label="Validation" value={report.passed ? "Passed" : "Limited / failed"} />
      <InfoRow label="Scene recovered" value={report.scene_recovered ? "Yes" : "No"} />
      <InfoRow label="Decode check" value={report.decode_validation ? "OK" : "Failed"} />
      <InfoRow
        label="Duration match"
        value={
          frameCmp?.duration_delta_seconds != null
            ? `Δ ${Number(frameCmp.duration_delta_seconds).toFixed(2)}s`
            : "—"
        }
      />
      <InfoRow
        label="A/V sync"
        value={sync?.audio_video_sync_valid ? "Valid" : "Needs review"}
      />
      <InfoRow label="Artifacts" value={String(artifacts?.artifact_count ?? 0)} />
      {artifactList.length > 0 && (
        <ul className="text-[10px] text-amber-700 dark:text-amber-400 space-y-1 pt-2">
          {artifactList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {content?.recommendation ? (
        <p className="text-[10px] text-muted-foreground pt-2">{String(content.recommendation)}</p>
      ) : null}
    </div>
  )
}

function PipelineTimeline({ stages }: { stages: PipelineStage[] }) {
  if (!stages.length) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Upload a damaged video to start the recovery pipeline.
      </p>
    )
  }

  return (
    <div className="space-y-0">
      {stages.map((stage, index) => {
        const meta = STAGE_META[stage.key]
        const Icon = meta?.icon ?? Circle
        const isLast = index === stages.length - 1

        return (
          <div key={stage.key} className="relative flex gap-4 pb-6">
            {!isLast && (
              <span
                className={cn(
                  "absolute left-[15px] top-8 bottom-0 w-px",
                  stage.state === "completed" ? "bg-emerald-500/40" : "bg-border"
                )}
              />
            )}
            <div
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background",
                stage.state === "active" && "border-primary ring-2 ring-primary/20",
                stage.state === "completed" && "border-emerald-500/50 bg-emerald-500/5",
                stage.state === "failed" && "border-destructive bg-destructive/5"
              )}
            >
              {stage.state === "active" ? (
                stageIcon(stage.state)
              ) : stage.state === "completed" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : stage.state === "failed" ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : (
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{stage.label}</p>
                {stage.state === "active" && (
                  <Badge variant="outline" className="text-[10px] h-5">
                    In progress
                  </Badge>
                )}
                {stage.state === "failed" && (
                  <Badge variant="destructive" className="text-[10px] h-5">
                    Failed
                  </Badge>
                )}
              </div>
              {meta && (
                <>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{meta.description}</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {meta.capabilities.map((cap) => (
                      <li
                        key={cap}
                        className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {cap}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function UploadZone({
  onSelect,
  busy,
}: {
  onSelect: (file: File) => void
  busy: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (file) onSelect(file)
    },
    [onSelect]
  )

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="video/*,.mp4,.mov,.avi,.mkv,.webm"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          "w-full rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30",
          busy && "pointer-events-none opacity-60"
        )}
      >
        {busy ? (
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        ) : (
          <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
        )}
        <p className="mt-3 text-sm font-medium">
          {busy ? "Uploading and starting recovery…" : "Drop a damaged video here or click to browse"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">MP4, MOV, AVI, MKV, WebM — max server upload limit</p>
      </button>
    </>
  )
}

export default function VideoRecovery() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const jobsQuery = useQuery({
    queryKey: ["video-recovery-jobs"],
    queryFn: fetchVideoRecoveryJobs,
    refetchInterval: (q) => {
      const jobs = q.state.data as VideoRecoveryJob[] | undefined
      if (jobs?.some((j) => j.status === "processing" || j.status === "uploaded")) return POLL_MS
      return false
    },
  })

  const activeId = selectedId ?? jobsQuery.data?.[0]?.id ?? null

  const jobQuery = useQuery({
    queryKey: ["video-recovery-job", activeId],
    queryFn: () => fetchVideoRecoveryJob(activeId!),
    enabled: Boolean(activeId),
    refetchInterval: (q) => {
      const job = q.state.data as VideoRecoveryJob | undefined
      if (job && (job.status === "processing" || job.status === "uploaded")) return POLL_MS
      return false
    },
  })

  const uploadMutation = useMutation({
    mutationFn: uploadVideoForRecovery,
    onSuccess: (job) => {
      setUploadError(null)
      setSelectedId(job.id)
      void queryClient.invalidateQueries({ queryKey: ["video-recovery-jobs"] })
    },
    onError: (err: Error) => setUploadError(err.message),
  })

  const retryMutation = useMutation({
    mutationFn: retryVideoRecovery,
    onSuccess: (job) => {
      setSelectedId(job.id)
      void queryClient.invalidateQueries({ queryKey: ["video-recovery-jobs"] })
      void queryClient.invalidateQueries({ queryKey: ["video-recovery-job", job.id] })
    },
  })

  const job = jobQuery.data ?? null
  const pct = progressPercent(job?.pipeline_stages ?? [])
  const processing = job?.status === "processing" || job?.status === "uploaded"
  const originalMediaUrl = job?.original_url ? resolveMediaUrl(job.original_url) : null
  const recoveredMediaUrl = job?.recovered_url ? resolveMediaUrl(job.recovered_url) : null

  useEffect(() => {
    syncAuthCookieFromSession()
  }, [])

  return (
    <ModulePageLayout
      title="Video Recovery"
      description="Hybrid engine: recover original data wherever possible, regenerate continuity only where data is permanently lost."
      breadcrumbs={[{ label: "Video Recovery" }]}
      actions={
        job ? (
          <Button
            variant="outline"
            size="sm"
            disabled={retryMutation.isPending || processing}
            onClick={() => retryMutation.mutate(job.id)}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", retryMutation.isPending && "animate-spin")} />
            Re-run recovery
          </Button>
        ) : null
      }
    >
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Sessions */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recovery sessions</CardTitle>
            <CardDescription className="text-xs">Select a job to view pipeline progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <UploadZone
              busy={uploadMutation.isPending}
              onSelect={(file) => uploadMutation.mutate(file)}
            />
            {uploadError && (
              <p className="text-xs text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                {uploadError}
              </p>
            )}
            <Separator />
            <ScrollArea className="h-[min(360px,40vh)] pr-3">
              {jobsQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">Loading sessions…</p>
              ) : !jobsQuery.data?.length ? (
                <p className="text-xs text-muted-foreground">No sessions yet.</p>
              ) : (
                <ul className="space-y-2">
                  {jobsQuery.data.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className={cn(
                          "w-full rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                          activeId === row.id && "border-primary/50 bg-primary/5"
                        )}
                      >
                        <p className="text-xs font-medium truncate">{row.original_filename || "Untitled"}</p>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          {statusBadge(row.status)}
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(row.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main workspace */}
        <div className="space-y-6 min-w-0">
          {!job ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Film className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-4 text-sm font-medium">No session selected</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  Upload a damaged video to begin forensic analysis and automated reconstruction.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {job.error_message && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 space-y-1">
                  <p className="text-sm font-medium text-destructive">Recovery failed</p>
                  <p className="text-sm text-destructive/90">{job.error_message}</p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Metric label="Status" value={job.status} />
                <Metric label="Stage" value={job.current_stage.replace(/_/g, " ")} />
                <Metric
                  label="Quality"
                  value={
                    job.quality_report?.quality_score != null
                      ? `${job.quality_report.quality_score} / 100`
                      : processing
                        ? "Pending"
                        : "—"
                  }
                />
                <Metric
                  label="SHA-256"
                  value={job.original_sha256 ? `${job.original_sha256.slice(0, 12)}…` : "—"}
                />
                <Metric
                  label="Completed"
                  value={job.completed_at ? new Date(job.completed_at).toLocaleString() : "—"}
                />
              </div>

              {Boolean(job.damage_map?.timeline_strip?.length || job.damage_map?.segments?.length) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Damage map</CardTitle>
                    <CardDescription className="text-xs">
                      Timeline classification — recovery vs regeneration routing
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DamageMapBar map={job.damage_map} />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-sm font-semibold">Hybrid pipeline</CardTitle>
                      <CardDescription className="text-xs mt-0.5">{job.original_filename}</CardDescription>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{pct}%</span>
                  </div>
                  <Progress value={pct} className="mt-3 h-2" />
                </CardHeader>
                <CardContent>
                  <PipelineTimeline stages={job.pipeline_stages} />
                </CardContent>
              </Card>

              {(originalMediaUrl || recoveredMediaUrl) && (
                <div className="grid gap-4 md:grid-cols-2">
                  {originalMediaUrl && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Source file</CardTitle>
                        <CardDescription className="text-xs">Original damaged upload</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <video
                          src={originalMediaUrl}
                          controls
                          className="w-full rounded-lg border aspect-video bg-black"
                        />
                      </CardContent>
                    </Card>
                  )}
                  {recoveredMediaUrl && (
                    <Card
                      className={
                        job.hybrid_report?.content_assessment?.total_visual_loss
                          ? "border-amber-500/40"
                          : "border-emerald-500/30"
                      }
                    >
                      <CardHeader className="pb-2">
                        <CardTitle
                          className={
                            job.hybrid_report?.content_assessment?.total_visual_loss
                              ? "text-sm font-semibold text-amber-700 dark:text-amber-400"
                              : "text-sm font-semibold text-emerald-700 dark:text-emerald-400"
                          }
                        >
                          {job.hybrid_report?.scene_recovered === false
                            ? "Processed output (scene not recovered)"
                            : "Recovered output"}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {job.hybrid_report?.content_assessment?.total_visual_loss
                            ? "File decoded and processed, but original footage was destroyed before upload"
                            : "Validated reconstruction"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <video
                          src={recoveredMediaUrl}
                          controls
                          className="w-full rounded-lg border aspect-video bg-black"
                        />
                        <Button variant="outline" size="sm" className="w-full" asChild>
                          <a href={recoveredMediaUrl} target="_blank" rel="noreferrer">
                            Download recovered video
                          </a>
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Boolean(job.hybrid_report && Object.keys(job.hybrid_report).length) && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Hybrid breakdown</CardTitle>
                      <CardDescription className="text-xs">Recovery + regeneration statistics</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <HybridSummary report={job.hybrid_report} />
                    </CardContent>
                  </Card>
                )}
                {Boolean(job.forensic_report && Object.keys(job.forensic_report).length) && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Forensic analysis</CardTitle>
                      <CardDescription className="text-xs">File structure and corruption assessment</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ForensicSummary report={job.forensic_report} />
                    </CardContent>
                  </Card>
                )}
                {Boolean(job.quality_report && Object.keys(job.quality_report).length) && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Quality validation</CardTitle>
                      <CardDescription className="text-xs">Output verification results</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <QualitySummary report={job.quality_report} />
                    </CardContent>
                  </Card>
                )}
                {Boolean(job.hybrid_report?.corruption_report?.types?.length) && (
                  <Card className="md:col-span-2 lg:col-span-3">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">12-type corruption analysis</CardTitle>
                      <CardDescription className="text-xs">
                        Detected damage types and techniques applied per category
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <CorruptionTypesSummary report={job.hybrid_report!.corruption_report!} />
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </ModulePageLayout>
  )
}
