import { API_BASE_URL, getAuthHeaders, getAuthHeadersFormData } from "@/lib/api"

const API = `${API_BASE_URL.replace(/\/$/, "")}/api`

export type PipelineStageState = "pending" | "active" | "completed" | "failed"

export type PipelineStage = {
  key: string
  label: string
  state: PipelineStageState
  phase?: string
}

export type DamageSegment = {
  segment_id: number
  start_frame: number
  end_frame: number
  start_time: number
  end_time: number
  status: string
  recovery_possible: boolean
  technique: "recovery" | "regeneration"
}

export type DamageMap = {
  duration_seconds?: number
  fps?: number
  segments?: DamageSegment[]
  timeline_strip?: string[]
  timeline_legend?: Record<string, string>
  counts?: Record<string, number>
}

export type CorruptionTypeEntry = {
  id: number
  key: string
  name: string
  symptom: string
  primary_technique: string
  detected?: boolean
  frame_count?: number
  technique_applied?: string
}

export type CorruptionReport = {
  types?: CorruptionTypeEntry[]
  detected_count?: number
  catalog_size?: number
}

export type HybridReport = {
  recovery_technique?: string
  regeneration_technique?: Record<string, number>
  breakdown?: { original: number; recovered: number; generated: number }
  principle?: string
  audio_generated_labeled?: boolean
  scene_recovered?: boolean
  content_assessment?: {
    original_content_ratio?: number
    total_visual_loss?: boolean
    scene_recovered?: boolean
    warnings?: string[]
    recommendation?: string
    source_green_ratio?: number
    output_green_ratio?: number
  }
  corruption_report?: CorruptionReport
  gpu?: {
    available?: boolean
    backend?: string
    device?: string
    batch_size?: number
    nvenc?: boolean
  }
}

export type VideoRecoveryJob = {
  id: string
  original_filename: string
  original_url: string | null
  recovered_url: string | null
  original_sha256: string
  status: "uploaded" | "processing" | "completed" | "failed"
  current_stage: string
  stage_logs: Array<Record<string, unknown>>
  forensic_report: Record<string, unknown>
  damage_map: DamageMap
  hybrid_report: HybridReport
  quality_report: Record<string, unknown>
  error_message: string
  pipeline_stages: PipelineStage[]
  created_at: string
  updated_at: string
  completed_at: string | null
}

export async function fetchVideoRecoveryJobs(): Promise<VideoRecoveryJob[]> {
  const res = await fetch(`${API}/video-recovery/jobs/`, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error("Failed to load recovery jobs")
  return res.json()
}

export async function fetchVideoRecoveryJob(id: string): Promise<VideoRecoveryJob> {
  const res = await fetch(`${API}/video-recovery/jobs/${id}/`, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error("Job not found")
  return res.json()
}

export async function uploadVideoForRecovery(file: File): Promise<VideoRecoveryJob> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(`${API}/video-recovery/upload/`, {
    method: "POST",
    headers: getAuthHeadersFormData(),
    body: form,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || "Upload failed")
  }
  return res.json()
}

export async function retryVideoRecovery(id: string): Promise<VideoRecoveryJob> {
  const res = await fetch(`${API}/video-recovery/jobs/${id}/retry/`, {
    method: "POST",
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error("Retry failed")
  return res.json()
}
