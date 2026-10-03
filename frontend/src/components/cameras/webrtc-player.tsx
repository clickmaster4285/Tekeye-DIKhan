"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { getStoredToken } from "@/lib/api"
import { cn } from "@/lib/utils"

export type WebRtcPlayerHandle = {
  videoElement: () => HTMLVideoElement | null
}

type WebRtcPlayerProps = {
  /** Hub signaling URL, e.g. /api/ops/servers/1/webrtc/?stream_key=cam-12 */
  signalingUrl: string
  className?: string
  muted?: boolean
  onPlaying?: () => void
  onError?: (message: string) => void
  /** Bump to force renegotiation */
  restartKey?: number
  /** Abort and call onError if no live media within this many ms */
  connectTimeoutMs?: number
}

function withToken(url: string): string {
  const token = getStoredToken()
  if (!token || !url) return url
  if (url.includes("token=")) return url
  const sep = url.includes("?") ? "&" : "?"
  return `${url}${sep}token=${encodeURIComponent(token)}`
}

/**
 * Low-latency viewing path: browser ↔ Django ↔ go2rtc (RTSP).
 * AI path stays on MJPEG / ML; this player is for live wall display.
 */
export const WebRtcPlayer = forwardRef<WebRtcPlayerHandle, WebRtcPlayerProps>(
  function WebRtcPlayer(
    {
      signalingUrl,
      className,
      muted = true,
      onPlaying,
      onError,
      restartKey = 0,
      connectTimeoutMs = 45000,
    },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const pcRef = useRef<RTCPeerConnection | null>(null)
    const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting")

    const onPlayingRef = useRef(onPlaying)
    const onErrorRef = useRef(onError)
    onPlayingRef.current = onPlaying
    onErrorRef.current = onError

    useImperativeHandle(ref, () => ({
      videoElement: () => videoRef.current,
    }))

    useEffect(() => {
      let cancelled = false
      const video = videoRef.current
      if (!video || !signalingUrl) return

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      })
      pcRef.current = pc

      pc.addTransceiver("video", { direction: "recvonly" })
      pc.addTransceiver("audio", { direction: "recvonly" })

      let gotTrack = false
      const fail = (message: string) => {
        if (cancelled) return
        setStatus("error")
        onErrorRef.current?.(message)
      }

      const timeoutId = window.setTimeout(() => {
        if (!cancelled && !gotTrack) {
          fail("WebRTC connect timeout")
        }
      }, Math.max(3000, connectTimeoutMs))

      pc.ontrack = (ev) => {
        if (cancelled) return
        gotTrack = true
        const [stream] = ev.streams
        if (stream) {
          video.srcObject = stream
          void video.play().catch(() => {
            /* autoplay policies — muted should allow */
          })
          setStatus("live")
          onPlayingRef.current?.()
        }
      }

      pc.onconnectionstatechange = () => {
        if (cancelled) return
        const state = pc.connectionState
        if (state === "failed" || state === "closed") {
          fail(`WebRTC ${state}`)
        }
      }

      const ac = new AbortController()

      const run = async () => {
        try {
          setStatus("connecting")
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)

          await new Promise<void>((resolve) => {
            if (pc.iceGatheringState === "complete") {
              resolve()
              return
            }
            const t = window.setTimeout(() => resolve(), 1200)
            pc.onicegatheringstatechange = () => {
              if (pc.iceGatheringState === "complete") {
                window.clearTimeout(t)
                resolve()
              }
            }
          })

          const sdp = pc.localDescription?.sdp
          if (!sdp) throw new Error("No local SDP")

          const res = await fetch(withToken(signalingUrl), {
            method: "POST",
            headers: {
              "Content-Type": "application/sdp",
              Accept: "application/sdp, text/plain, */*",
            },
            body: sdp,
            signal: ac.signal,
          })

          if (!res.ok) {
            let detail = `HTTP ${res.status}`
            try {
              const data = await res.json()
              if (data?.detail) detail = String(data.detail)
            } catch {
              const text = await res.text().catch(() => "")
              if (text) detail = text.slice(0, 200)
            }
            throw new Error(detail)
          }

          const answer = await res.text()
          if (cancelled) return
          await pc.setRemoteDescription({ type: "answer", sdp: answer })
        } catch (err) {
          if (cancelled) return
          if (err instanceof DOMException && err.name === "AbortError") {
            fail("WebRTC aborted")
            return
          }
          const message = err instanceof Error ? err.message : "WebRTC failed"
          fail(message)
        }
      }

      void run()

      return () => {
        cancelled = true
        window.clearTimeout(timeoutId)
        ac.abort()
        try {
          pc.getReceivers().forEach((r) => r.track?.stop())
          pc.close()
        } catch {
          /* ignore */
        }
        pcRef.current = null
        if (video) video.srcObject = null
      }
    }, [signalingUrl, restartKey, connectTimeoutMs])

    return (
      <video
        ref={videoRef}
        className={cn("h-full w-full bg-black object-contain", className)}
        autoPlay
        playsInline
        muted={muted}
        data-status={status}
      />
    )
  },
)
