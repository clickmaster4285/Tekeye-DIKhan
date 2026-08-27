import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Camera / mic APIs are only exposed on secure contexts (HTTPS or localhost). */
export function getCameraUnavailableMessage(): string {
  if (typeof window === "undefined") return "Camera is not available."
  const host = window.location.hostname
  const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "[::1]"
  if (!window.isSecureContext && !isLoopback) {
    return (
      "Camera is blocked on HTTP when using an IP address. " +
      "Open the app via https://… or http://localhost, or add this origin under " +
      "chrome://flags → “Insecure origins treated as secure”."
    )
  }
  return "Camera API is not available in this browser."
}

export function getCameraErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const n = err.name
    if (n === "NotAllowedError") return "Camera permission denied. Please allow camera access."
    if (n === "NotFoundError") return "No camera found."
    if (n === "NotReadableError") return "Camera is in use by another app."
    if (err.message) return err.message
  }
  return "Could not access camera."
}

/** Safe getUserMedia — avoids crash when mediaDevices is undefined (HTTP + LAN IP). */
export async function requestUserMedia(
  constraints: MediaStreamConstraints
): Promise<MediaStream> {
  const mediaDevices = navigator.mediaDevices
  if (!mediaDevices?.getUserMedia) {
    throw new Error(getCameraUnavailableMessage())
  }
  return mediaDevices.getUserMedia(constraints)
}
