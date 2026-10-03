/**
 * "Hello Customs" voice session manager.
 *
 * off → wake (listening only for "Hello Customs") → listening ⇄ transcribing → thinking → speaking → listening …
 * An idle timeout or the officer ending the conversation returns to wake mode.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  closeVoiceSession,
  sendVoiceTurn,
  startVoiceSession,
  transcribeUtterance,
  type VoiceAgentStatus,
} from "@/lib/voice-agent-api"
import { VoiceCapture } from "@/lib/voice-capture"

export type VoicePhase = "off" | "wake" | "listening" | "transcribing" | "thinking" | "speaking" | "error"

export type VoiceEntry = { id: number; role: "officer" | "agent" | "system"; text: string }

const MAX_ENTRIES = 30
const URDU_SCRIPT = /[؀-ۿ]/
const MIC_PREF_KEY = "tekeye-voice-mic"

function saveMicPref(on: boolean) {
  try {
    if (on) localStorage.setItem(MIC_PREF_KEY, "on")
    else localStorage.removeItem(MIC_PREF_KEY)
  } catch {
    /* storage unavailable */
  }
}

function micPrefOn(): boolean {
  try {
    return localStorage.getItem(MIC_PREF_KEY) === "on"
  } catch {
    return false
  }
}

function pickVoice(text: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.localService) // on-device voices only
  const lang = URDU_SCRIPT.test(text) ? "ur" : "en"
  return voices.find((v) => v.lang.toLowerCase().startsWith(lang)) || voices[0] || null
}

export function useVoiceAgent(status: VoiceAgentStatus | undefined) {
  const navigate = useNavigate()
  const location = useLocation()
  const [phase, setPhase] = useState<VoicePhase>("off")
  const [entries, setEntries] = useState<VoiceEntry[]>([])
  const [error, setError] = useState("")
  const [level, setLevel] = useState(0)
  /** Last thing heard while waiting for the wake word (shows the mic and speech service are working). */
  const [heard, setHeard] = useState("")

  const captureRef = useRef<VoiceCapture | null>(null)
  const sessionRef = useRef<string | null>(null)
  const idleTimerRef = useRef<number | null>(null)
  const busyRef = useRef(false)
  const queuedWavRef = useRef<Blob | null>(null)
  const entryIdRef = useRef(0)
  const screenRef = useRef("")
  screenRef.current = `${location.pathname}${location.search}`

  const addEntry = useCallback((role: VoiceEntry["role"], text: string) => {
    setEntries((prev) => [...prev, { id: ++entryIdRef.current, role, text }].slice(-MAX_ENTRIES))
  }, [])

  const clearIdle = () => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = null
  }

  const speak = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      if (!text || !("speechSynthesis" in window)) return resolve()
      captureRef.current?.pause()
      setPhase("speaking")
      const u = new SpeechSynthesisUtterance(text)
      const voice = pickVoice(text)
      if (voice) {
        u.voice = voice
        u.lang = voice.lang
      }
      let done = false
      const finish = () => {
        if (done) return
        done = true
        window.clearTimeout(safety)
        resolve()
      }
      // Some browsers occasionally never fire onend.
      const safety = window.setTimeout(finish, 4000 + text.length * 90)
      u.onend = finish
      u.onerror = finish
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
    })
  }, [])

  const toWake = useCallback(() => {
    clearIdle()
    sessionRef.current = null
    captureRef.current?.setEndSilence(700)
    captureRef.current?.resume()
    setPhase(captureRef.current?.running ? "wake" : "off")
  }, [])

  const endSession = useCallback(
    (note?: string) => {
      const sid = sessionRef.current
      if (sid) void closeVoiceSession(sid)
      if (note) addEntry("system", note)
      toWake()
    },
    [addEntry, toWake],
  )

  const listen = useCallback(() => {
    if (!sessionRef.current) return toWake()
    setPhase("listening")
    captureRef.current?.setEndSilence(900)
    captureRef.current?.resume()
    clearIdle()
    const idleMs = (status?.idle_timeout_sec ?? 45) * 1000
    idleTimerRef.current = window.setTimeout(() => endSession("Session ended after inactivity."), idleMs)
  }, [endSession, status?.idle_timeout_sec, toWake])

  const handleUtterance = useCallback(
    async (text: string) => {
      const sid = sessionRef.current
      if (!sid) return
      clearIdle()
      captureRef.current?.pause()
      addEntry("officer", text)
      setPhase("thinking")
      try {
        const res = await sendVoiceTurn(sid, text, screenRef.current)
        for (const action of res.ui_actions) {
          if (action.type === "navigate" && action.path.startsWith("/")) navigate(action.path)
          // Spoken report requests: show the report (with PDF / Excel downloads) on the assistant page.
          if (action.type === "report") navigate(`/assistant?report=${encodeURIComponent(action.report_id)}`)
        }
        addEntry("agent", res.reply)
        await speak(res.reply)
        if (res.session_status === "closed") toWake()
        else listen()
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong."
        addEntry("system", msg)
        await speak(msg)
        listen()
      }
    },
    [addEntry, listen, navigate, speak, toWake],
  )

  const activate = useCallback(
    async (firstRequest = "") => {
      if (sessionRef.current) return
      captureRef.current?.pause()
      setPhase("thinking")
      try {
        const s = await startVoiceSession()
        sessionRef.current = s.session_id
        addEntry("system", "Session started")
        if (firstRequest.trim()) {
          await handleUtterance(firstRequest.trim())
        } else {
          addEntry("agent", s.greeting)
          await speak(s.greeting)
          listen()
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start the voice agent.")
        toWake()
      }
    },
    [addEntry, handleUtterance, listen, speak, toWake],
  )

  const onSegment = useCallback(
    async (wav: Blob) => {
      if (busyRef.current) {
        // Waiting for the wake word the mic stays open: keep the newest clip rather than
        // dropping "Hello Customs" because a noise clip is still being transcribed.
        if (!sessionRef.current) queuedWavRef.current = wav
        return
      }
      busyRef.current = true
      const active = Boolean(sessionRef.current)
      if (active) {
        captureRef.current?.pause()
        setPhase("transcribing")
      }
      try {
        const tr = await transcribeUtterance(wav, active ? "active" : "wake")
        setError("")
        if (!active) {
          if (tr.text.trim()) setHeard(tr.text.trim())
          if (tr.wake) {
            queuedWavRef.current = null
            setHeard("")
            await activate(tr.remainder || "")
          }
        } else if (tr.text.trim()) {
          await handleUtterance(tr.text.trim())
        } else {
          listen()
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Speech service error.")
        if (active) listen()
      } finally {
        busyRef.current = false
      }
      const queued = queuedWavRef.current
      queuedWavRef.current = null
      if (queued && !sessionRef.current) void onSegmentRef.current(queued)
    },
    [activate, handleUtterance, listen],
  )

  // Keep the capture callback pointed at the latest closure.
  const onSegmentRef = useRef(onSegment)
  onSegmentRef.current = onSegment

  const enable = useCallback(async () => {
    setError("")
    if (!captureRef.current) {
      captureRef.current = new VoiceCapture({
        onSegment: (wav) => void onSegmentRef.current(wav),
        onSpeechStart: () => clearIdle(),
        onLevel: setLevel,
        endSilenceMs: 700,
      })
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("Microphone needs HTTPS (or localhost). Open the dashboard over https://.")
      setPhase("error")
      return
    }
    try {
      await captureRef.current.start()
      await captureRef.current.ensureRunning()
      window.speechSynthesis?.getVoices() // warm the voice list
      saveMicPref(true)
      setPhase("wake")
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ""
      setError(
        name === "NotAllowedError"
          ? "Microphone permission was blocked. Allow it from the address bar, then turn the mic on again."
          : name === "NotFoundError"
            ? "No microphone was found on this computer."
            : "Microphone is unavailable (it may be in use by another app).",
      )
      captureRef.current?.stop()
      setPhase("error")
    }
  }, [])

  const disable = useCallback(() => {
    const sid = sessionRef.current
    if (sid) void closeVoiceSession(sid)
    sessionRef.current = null
    clearIdle()
    window.speechSynthesis?.cancel()
    captureRef.current?.stop()
    saveMicPref(false)
    setLevel(0)
    setHeard("")
    setPhase("off")
  }, [])

  // Turn the mic back on after a page reload when the officer had it on and permission is already granted.
  const autoTriedRef = useRef(false)
  useEffect(() => {
    if (!status?.enabled || autoTriedRef.current || !micPrefOn()) return
    autoTriedRef.current = true
    const perms = navigator.permissions?.query({ name: "microphone" as PermissionName })
    void perms
      ?.then((p) => {
        if (p.state === "granted") void enable()
      })
      .catch(() => {})
    // Browsers may keep audio suspended until the first click/key on the page.
    const wake = () => void captureRef.current?.ensureRunning()
    window.addEventListener("pointerdown", wake)
    window.addEventListener("keydown", wake)
    return () => {
      window.removeEventListener("pointerdown", wake)
      window.removeEventListener("keydown", wake)
    }
  }, [enable, status?.enabled])

  /** Push-to-talk / typed request: start a session without the wake word. */
  const talkNow = useCallback(
    async (typed?: string) => {
      if (!captureRef.current?.running) await enable()
      await captureRef.current?.ensureRunning()
      if (sessionRef.current) {
        if (typed?.trim()) await handleUtterance(typed.trim())
        return
      }
      await activate(typed || "")
    },
    [activate, enable, handleUtterance],
  )

  useEffect(() => () => disable(), [disable])

  return {
    phase,
    entries,
    error,
    level,
    heard,
    sessionActive: Boolean(sessionRef.current),
    enable,
    disable,
    talkNow,
    endSession: () => endSession("Session closed."),
  }
}
