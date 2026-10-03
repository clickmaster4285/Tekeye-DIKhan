/**
 * TekEye voice agent ("Hello Customs") — backend API client.
 */
import { API_BASE_URL, getAuthHeaders, getAuthHeadersFormData } from "@/lib/api"

export type VoiceAgentStatus = {
  enabled: boolean
  provider: string
  stt_configured: boolean
  idle_timeout_sec: number
  greeting: string
}

export type VoiceUiAction =
  | { type: "navigate"; path: string; camera_id?: number }
  | { type: "report"; report_id: string; title: string }

export type VoiceTurnResult = {
  reply: string
  ui_actions: VoiceUiAction[]
  tools_used: string[]
  reports: string[]
  session_status: "active" | "closed"
  awaiting_confirmation: boolean
  pending_summary: string | null
}

export type ChatSession = {
  session_id: string
  title: string
  mode: "voice" | "chat"
  status: "active" | "closed"
  turn_count: number
  updated_at: string
}

export type TranscriptEntry = {
  role: "user" | "assistant"
  text: string
  at: string
  tools?: string[]
  reports?: string[]
  pending?: string | null
}

export type ChatSessionDetail = ChatSession & {
  transcript: TranscriptEntry[]
  awaiting_confirmation: boolean
  pending_summary: string | null
}

export type ReportSection = {
  heading: string
  dataset: string
  description: string
  criteria: string
  total: number
  counts_by: string
  counts: { value: string; count: number }[]
  columns: { key: string; label: string }[]
  rows: Record<string, string | number | boolean>[]
  truncated: boolean
}

export type AgentReport = {
  id: string
  title: string
  summary: string
  key_figures: string[]
  sections: ReportSection[]
  created_at: string
  created_by: string
}

export type TranscribeResult = {
  text: string
  language: string
  confidence: number | null
  wake?: boolean
  remainder?: string
}

const base = `${API_BASE_URL}/api/voice-agent`

async function readJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = (body as { reply?: string; detail?: string }).reply || (body as { detail?: string }).detail
    throw new Error(detail || `Voice agent error (HTTP ${res.status})`)
  }
  return body as T
}

export async function fetchVoiceAgentStatus(): Promise<VoiceAgentStatus> {
  return readJson(await fetch(`${base}/status/`, { headers: getAuthHeaders() }))
}

export async function startVoiceSession(
  mode: "voice" | "chat" = "voice",
): Promise<ChatSession & { greeting: string }> {
  return readJson(
    await fetch(`${base}/sessions/`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ mode }) }),
  )
}

export async function listChatSessions(): Promise<ChatSession[]> {
  const body = await readJson<{ sessions: ChatSession[] }>(
    await fetch(`${base}/sessions/?mode=chat`, { headers: getAuthHeaders() }),
  )
  return body.sessions
}

export async function fetchChatSession(sessionId: string): Promise<ChatSessionDetail> {
  return readJson(await fetch(`${base}/sessions/${sessionId}/`, { headers: getAuthHeaders() }))
}

export async function renameChatSession(sessionId: string, title: string): Promise<ChatSession> {
  return readJson(
    await fetch(`${base}/sessions/${sessionId}/`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title }),
    }),
  )
}

export async function fetchAgentReport(reportId: string): Promise<AgentReport> {
  return readJson(await fetch(`${base}/reports/${reportId}/`, { headers: getAuthHeaders() }))
}

/** Download the compiled report file (auth header required, so not a plain link). */
export async function downloadAgentReport(reportId: string, format: "pdf" | "xlsx"): Promise<void> {
  const res = await fetch(`${base}/reports/${reportId}/${format}/`, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`)
  const disposition = res.headers.get("Content-Disposition") || ""
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] || `report.${format}`
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export async function sendVoiceTurn(sessionId: string, text: string, screenPath: string): Promise<VoiceTurnResult> {
  return readJson(
    await fetch(`${base}/sessions/${sessionId}/turn/`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ text, screen: { path: screenPath } }),
    }),
  )
}

export async function closeVoiceSession(sessionId: string): Promise<void> {
  await fetch(`${base}/sessions/${sessionId}/close/`, { method: "POST", headers: getAuthHeaders() }).catch(() => {})
}

export async function transcribeUtterance(wav: Blob, mode: "wake" | "active"): Promise<TranscribeResult> {
  const form = new FormData()
  form.append("audio", wav, "utterance.wav")
  form.append("mode", mode)
  return readJson(
    await fetch(`${base}/transcribe/`, { method: "POST", headers: getAuthHeadersFormData(), body: form }),
  )
}
