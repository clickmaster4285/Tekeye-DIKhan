import { useEffect, useRef, useState, type FormEvent } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useLocation } from "react-router-dom"
import { ChevronDown, Loader2, Maximize2, Mic, MicOff, Send, Volume2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useVoiceAgent, type VoicePhase } from "@/hooks/use-voice-agent"
import { fetchVoiceAgentStatus } from "@/lib/voice-agent-api"
import { cn } from "@/lib/utils"

const PHASE_LABEL: Record<VoicePhase, string> = {
  off: "Voice agent off",
  wake: 'Say "Hello Customs"',
  listening: "Listening…",
  transcribing: "Listening…",
  thinking: "Working on it…",
  speaking: "Speaking…",
  error: "Voice unavailable",
}

const PHASE_ORB: Record<VoicePhase, string> = {
  off: "bg-slate-500 hover:bg-slate-600",
  wake: "bg-slate-800 hover:bg-slate-900",
  listening: "bg-emerald-600 ring-4 ring-emerald-300 animate-pulse",
  transcribing: "bg-emerald-600 ring-4 ring-emerald-300",
  thinking: "bg-amber-500 ring-4 ring-amber-200",
  speaking: "bg-sky-600 ring-4 ring-sky-300",
  error: "bg-red-600 hover:bg-red-700",
}

/** Floating "Hello Customs" voice agent. Rendered only for roles enabled on the backend. */
export function VoiceAgentWidget() {
  const { data: status } = useQuery({
    queryKey: ["voice-agent-status"],
    queryFn: fetchVoiceAgentStatus,
    staleTime: 5 * 60_000,
    retry: false,
  })
  const agent = useVoiceAgent(status)
  // Keep the orb clear of the assistant page's message box.
  const onAssistantPage = useLocation().pathname === "/assistant"
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [agent.entries, open])

  if (!status?.enabled) return null

  const busy = agent.phase === "thinking" || agent.phase === "transcribing"
  const onOrb = () => {
    if (agent.phase === "off" || agent.phase === "error") void agent.enable()
    else if (agent.phase === "wake") void agent.talkNow()
    else setOpen(true)
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const text = typed.trim()
    if (!text) return
    setTyped("")
    void agent.talkNow(text)
  }

  return (
    <div className={cn("fixed right-4 z-50 flex flex-col items-end gap-2", onAssistantPage ? "bottom-24" : "bottom-4")}>
      {open && (
        <div className="w-[min(360px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">TekEye Voice Agent</p>
              <p className="text-xs text-slate-500">{PHASE_LABEL[agent.phase]}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" asChild title="Open full assistant (chat, reports)">
                <Link to="/assistant" onClick={() => setOpen(false)}>
                  <Maximize2 className="h-4 w-4" />
                </Link>
              </Button>
              {agent.sessionActive && (
                <Button size="sm" variant="ghost" onClick={agent.endSession} title="End conversation">
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)} title="Minimise">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div ref={logRef} className="max-h-72 space-y-2 overflow-y-auto px-3 py-2 text-sm">
            {agent.entries.length === 0 && (
              <p className="text-xs text-slate-500">
                Turn the microphone on, then say “Hello Customs” and ask in English or Urdu — e.g. “What's happening
                at the main gate?”
              </p>
            )}
            {agent.entries.map((e) =>
              e.role === "system" ? (
                <p key={e.id} className="text-center text-[11px] text-slate-400">
                  {e.text}
                </p>
              ) : (
                <div
                  key={e.id}
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-1.5",
                    e.role === "officer" ? "ml-auto bg-slate-900 text-white" : "bg-slate-100 text-slate-900",
                  )}
                >
                  {e.text}
                </div>
              ),
            )}
          </div>

          {agent.phase === "wake" && agent.heard && (
            <p className="px-3 pb-1 text-xs text-slate-500">
              Heard: “{agent.heard}” — start with “Hello Customs”, or tap the mic to talk now.
            </p>
          )}
          {agent.error && <p className="px-3 pb-1 text-xs text-red-600">{agent.error}</p>}

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t px-3 py-2">
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Or type a request…"
              className="h-8 text-sm"
              disabled={busy}
            />
            <Button type="submit" size="sm" disabled={busy || !typed.trim()}>
              <Send className="h-4 w-4" />
            </Button>
            {agent.phase !== "off" && (
              <Button type="button" size="sm" variant="outline" onClick={agent.disable} title="Turn microphone off">
                <MicOff className="h-4 w-4" />
              </Button>
            )}
          </form>
        </div>
      )}

      <div className="flex items-center gap-2">
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "flex max-w-[260px] items-center gap-2 rounded-full bg-white/95 px-3 py-1 text-xs font-medium shadow",
              agent.error ? "text-red-600" : "text-slate-700",
            )}
            title={agent.error || PHASE_LABEL[agent.phase]}
          >
            {(agent.phase === "wake" || agent.phase === "listening") && (
              <span className="h-1.5 w-10 overflow-hidden rounded-full bg-slate-200" aria-hidden>
                <span
                  className="block h-full rounded-full bg-emerald-500 transition-[width] duration-100"
                  style={{ width: `${Math.round(agent.level * 100)}%` }}
                />
              </span>
            )}
            <span className="truncate">{agent.error || PHASE_LABEL[agent.phase]}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onOrb}
          aria-label={PHASE_LABEL[agent.phase]}
          title={agent.phase === "wake" ? "Talk now (skip wake word)" : PHASE_LABEL[agent.phase]}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition",
            PHASE_ORB[agent.phase],
          )}
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : agent.phase === "speaking" ? (
            <Volume2 className="h-6 w-6" />
          ) : agent.phase === "off" || agent.phase === "error" ? (
            <MicOff className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </button>
      </div>
    </div>
  )
}
