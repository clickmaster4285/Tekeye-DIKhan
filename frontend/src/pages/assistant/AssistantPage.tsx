import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowUp,
  Bot,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquarePlus,
  Mic,
  PanelLeft,
  ShieldAlert,
  Square,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AssistantMarkdown } from "@/components/assistant/assistant-markdown"
import { ReportCard } from "@/components/assistant/report-card"
import { VoiceCapture } from "@/lib/voice-capture"
import {
  fetchChatSession,
  fetchVoiceAgentStatus,
  listChatSessions,
  sendVoiceTurn,
  startVoiceSession,
  transcribeUtterance,
  type ChatSession,
  type VoiceUiAction,
} from "@/lib/voice-agent-api"
import { cn } from "@/lib/utils"

type Message = {
  id: string
  role: "user" | "assistant" | "error"
  text: string
  tools?: string[]
  reports?: string[]
  links?: { label: string; path: string }[]
}

const TOOL_LABELS: Record<string, string> = {
  search_cameras: "Searched cameras",
  camera_details: "Checked camera",
  search_detections: "Searched detections",
  search_vehicles: "Searched ANPR",
  search_people: "Searched people",
  person_journey: "Traced journey",
  officer_locations: "Located officers",
  search_records: "Searched records",
  generate_report: "Generated report",
  create_incident: "Prepared incident",
  perform_action: "Prepared change",
  ui_navigate: "Found screen",
  ui_open_camera: "Found camera",
}

const SUGGESTIONS = [
  "How many detention memos are there by detention type?",
  "Generate a PDF report of detections in the last 7 days grouped by class",
  "Show pending note sheets and who prepared them",
  "Find staff member Muhamad Ijaz",
  "Which cameras have unresolved health alerts?",
  "Approve note sheet NS-REG-056",
]

const THINKING_HINTS = ["Planning", "Searching TekEye records", "Checking results", "Writing the answer"]

let seq = 0
const nextId = () => `m${Date.now()}-${seq++}`

function toolChips(tools: string[] = []): string[] {
  const labels = tools.map((t) => TOOL_LABELS[t] || (t.includes(".") ? "Completed change" : "")).filter(Boolean)
  return [...new Set(labels)]
}

function linksFrom(actions: VoiceUiAction[]): { label: string; path: string }[] {
  return actions
    .filter((a): a is Extract<VoiceUiAction, { type: "navigate" }> => a.type === "navigate" && a.path.startsWith("/"))
    .map((a) => ({ label: a.camera_id ? "Open camera live view" : `Open ${a.path}`, path: a.path }))
}

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      title="Copy"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true)
          window.setTimeout(() => setDone(false), 1500)
        })
      }}
      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function ChatList({
  sessions,
  activeId,
  onSelect,
  onNew,
}: {
  sessions: ChatSession[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Button onClick={onNew} className="w-full justify-start gap-2" variant="outline">
          <MessageSquarePlus className="h-4 w-4" /> New chat
        </Button>
      </div>
      <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recent</p>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {sessions.length === 0 && <p className="px-2 py-2 text-xs text-slate-400">No conversations yet.</p>}
        {sessions.map((s) => (
          <button
            key={s.session_id}
            type="button"
            onClick={() => onSelect(s.session_id)}
            className={cn(
              "w-full rounded-md px-2.5 py-2 text-left transition",
              s.session_id === activeId ? "bg-slate-200/70" : "hover:bg-slate-100",
            )}
          >
            <span className="block truncate text-sm text-slate-800">{s.title}</span>
            <span className="block text-[11px] text-slate-400">{relativeTime(s.updated_at)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AssistantPage() {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const activeId = params.get("session")
  const reportParam = params.get("report")

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["voice-agent-status"],
    queryFn: fetchVoiceAgentStatus,
    staleTime: 5 * 60_000,
    retry: false,
  })
  const { data: sessions = [] } = useQuery({
    queryKey: ["assistant-chats"],
    queryFn: listChatSessions,
    enabled: !!status?.enabled,
  })

  const [messages, setMessages] = useState<Message[]>([])
  const [pending, setPending] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [loadingChat, setLoadingChat] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [dictating, setDictating] = useState(false)
  const [dictateError, setDictateError] = useState("")

  const skipLoadRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const captureRef = useRef<VoiceCapture | null>(null)

  // Load the transcript when switching to an existing chat.
  useEffect(() => {
    if (!activeId) {
      setMessages([])
      setPending(null)
      return
    }
    if (skipLoadRef.current === activeId) return
    let cancelled = false
    setLoadingChat(true)
    fetchChatSession(activeId)
      .then((chat) => {
        if (cancelled) return
        setMessages(
          chat.transcript.map((t) => ({
            id: nextId(),
            role: t.role,
            text: t.text,
            tools: t.tools,
            reports: t.reports,
          })),
        )
        setPending(chat.awaiting_confirmation ? chat.pending_summary : null)
      })
      .catch(() => !cancelled && setMessages([{ id: nextId(), role: "error", text: "Could not open this conversation." }]))
      .finally(() => !cancelled && setLoadingChat(false))
    return () => {
      cancelled = true
    }
  }, [activeId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, sending, pending])

  useEffect(() => {
    if (!sending) return
    const started = Date.now()
    setElapsed(0)
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [sending])

  useEffect(() => () => captureRef.current?.stop(), [])

  // Auto-grow the composer.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  const selectChat = useCallback(
    (id: string | null) => {
      skipLoadRef.current = null
      setListOpen(false)
      if (!id) {
        setMessages([])
        setPending(null)
      }
      setParams(id ? { session: id } : {}, { replace: false })
    },
    [setParams],
  )

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim()
      if (!text || sending) return
      setInput("")
      setPending(null)
      setMessages((m) => [...m, { id: nextId(), role: "user", text }])
      setSending(true)
      try {
        let id = activeId
        if (!id) {
          const created = await startVoiceSession("chat")
          id = created.session_id
          skipLoadRef.current = id
          setParams({ session: id }, { replace: true })
        }
        const res = await sendVoiceTurn(id, text, "/assistant")
        setMessages((m) => [
          ...m,
          {
            id: nextId(),
            role: "assistant",
            text: res.reply,
            tools: res.tools_used,
            reports: res.reports,
            links: linksFrom(res.ui_actions),
          },
        ])
        setPending(res.awaiting_confirmation ? res.pending_summary : null)
        void queryClient.invalidateQueries({ queryKey: ["assistant-chats"] })
      } catch (e) {
        setMessages((m) => [
          ...m,
          { id: nextId(), role: "error", text: e instanceof Error ? e.message : "The assistant is unavailable." },
        ])
      } finally {
        setSending(false)
        inputRef.current?.focus()
      }
    },
    [activeId, queryClient, sending, setParams],
  )

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send(input)
    }
  }

  const toggleDictation = async () => {
    setDictateError("")
    if (dictating) {
      captureRef.current?.stop()
      captureRef.current = null
      setDictating(false)
      return
    }
    const capture = new VoiceCapture({
      endSilenceMs: 1200,
      onSegment: (wav) => {
        capture.stop()
        captureRef.current = null
        setDictating(false)
        transcribeUtterance(wav, "active")
          .then((r) => r.text && setInput((prev) => (prev ? `${prev} ${r.text}` : r.text)))
          .catch((err) => setDictateError(err instanceof Error ? err.message : "Speech service unavailable"))
      },
    })
    try {
      await capture.start()
      captureRef.current = capture
      setDictating(true)
    } catch {
      setDictateError("Microphone permission was denied.")
    }
  }

  if (statusLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }
  if (!status?.enabled) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
        <ShieldAlert className="mx-auto mb-2 h-8 w-8 text-slate-400" />
        <p className="font-medium text-slate-900">TekEye Assistant isn't enabled for your role</p>
        <p className="mt-1 text-sm text-slate-500">Ask an administrator if you need access.</p>
      </div>
    )
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")
  const empty = messages.length === 0 && !loadingChat

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[480px] overflow-hidden rounded-xl border border-slate-200 bg-white md:h-[calc(100dvh-6rem)]">
      {/* Conversation list */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-slate-50/70 lg:block">
        <ChatList sessions={sessions} activeId={activeId} onSelect={selectChat} onNew={() => selectChat(null)} />
      </aside>
      {listOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-72 max-w-[85vw] bg-white shadow-xl">
            <div className="flex justify-end p-2">
              <Button size="sm" variant="ghost" onClick={() => setListOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="h-[calc(100%-3rem)]">
              <ChatList sessions={sessions} activeId={activeId} onSelect={selectChat} onNew={() => selectChat(null)} />
            </div>
          </div>
          <button type="button" className="flex-1 bg-black/30" aria-label="Close" onClick={() => setListOpen(false)} />
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
          <Button size="sm" variant="ghost" className="lg:hidden" onClick={() => setListOpen(true)} title="Conversations">
            <PanelLeft className="h-4 w-4" />
          </Button>
          <Bot className="h-5 w-5 text-blue-600" />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
            {sessions.find((s) => s.session_id === activeId)?.title || "TekEye Assistant"}
          </p>
          <span className="hidden text-xs text-slate-400 sm:inline">Model: {status.provider}</span>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
            {reportParam && <ReportCard reportId={reportParam} />}

            {loadingChat && (
              <div className="flex justify-center py-10 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}

            {empty && (
              <div className="pt-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                  <Bot className="h-6 w-6 text-blue-600" />
                </div>
                <h1 className="text-xl font-semibold text-slate-900">How can I help, Officer?</h1>
                <p className="mx-auto mt-1 max-w-lg text-sm text-slate-500">
                  Ask about cameras, detections, cases, staff, visitors or infrastructure — misspellings are fine. I can
                  also approve, update and create records (you confirm every change) and build PDF / Excel reports.
                </p>
                <div className="mx-auto mt-6 grid max-w-2xl gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-slate-100 px-4 py-2.5 text-sm text-slate-900 [overflow-wrap:anywhere]">
                    {m.text}
                  </div>
                </div>
              ) : m.role === "error" ? (
                <div key={m.id} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {m.text}
                </div>
              ) : (
                <div key={m.id} className="group flex gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    {toolChips(m.tools).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {toolChips(m.tools).map((t) => (
                          <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <AssistantMarkdown text={m.text} />
                    {m.reports?.map((r) => <ReportCard key={r} reportId={r} />)}
                    {m.links && m.links.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {m.links.map((l) => (
                          <Link
                            key={l.path}
                            to={l.path}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                          >
                            <ExternalLink className="h-3 w-3" /> {l.label}
                          </Link>
                        ))}
                      </div>
                    )}
                    {pending && m === lastAssistant && !sending && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Confirm change</p>
                        <p className="mt-1 text-sm text-slate-800">{pending}</p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" onClick={() => void send("yes")}>
                            <Check className="h-4 w-4" /> Confirm
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void send("no")}>
                            <X className="h-4 w-4" /> Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="opacity-0 transition group-hover:opacity-100">
                      <CopyButton text={m.text} />
                    </div>
                  </div>
                </div>
              ),
            )}

            {sending && (
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {THINKING_HINTS[Math.min(THINKING_HINTS.length - 1, Math.floor(elapsed / 6))]}… {elapsed > 2 && `${elapsed}s`}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 px-3 py-3">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus-within:border-slate-400">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder={pending ? "Type yes / no, or ask something else…" : "Message TekEye Assistant…"}
                className="max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-slate-400"
                disabled={sending}
              />
              {status.stt_configured && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => void toggleDictation()}
                  title={dictating ? "Stop dictation" : "Dictate"}
                  className={cn("h-8 w-8 shrink-0", dictating && "text-red-600")}
                >
                  {dictating ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                onClick={() => void send(input)}
                disabled={sending || !input.trim()}
                className="h-8 w-8 shrink-0 rounded-full"
                title="Send"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-slate-400">
              {dictating
                ? "Listening… speak, then pause."
                : dictateError ||
                  "Every change needs your confirmation and is audit-logged. Check important figures before acting."}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
