import { useCallback, useEffect, useRef, useState } from "react"
import { getCameraErrorMessage, requestUserMedia } from "@/lib/utils"

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(async () => {
    try {
      setError(null)
      const stream = await requestUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setActive(true)
    } catch (err) {
      setError(getCameraErrorMessage(err))
      setActive(false)
    }
  }, [])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setActive(false)
  }, [])

  const captureBase64 = useCallback((quality = 0.85, maxWidth = 640): string | null => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return null

    const scale = Math.min(1, maxWidth / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/jpeg", quality)
  }, [])

  useEffect(() => () => stop(), [stop])

  return { videoRef, canvasRef, active, error, start, stop, captureBase64 }
}
