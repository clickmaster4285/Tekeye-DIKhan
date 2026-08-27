import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { registerSW } from "virtual:pwa-register"
import { router } from "./routes"
import { queryClient } from "@/lib/query-client"
import { AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired } from "@/lib/auth"
import { stopOfficerGpsTracking } from "@/lib/officer-gps-session"
import "./index.css"

// Production SW can linger and break live MJPEG (/ml multipart). Keep SW off in dev
// and strip any leftover registration so streams reach Vite's proxy.
async function setupServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
  if (import.meta.env.DEV) {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((r) => r.unregister()))
    if ("caches" in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    return
  }
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      const check = () => {
        void registration.update()
      }
      window.setInterval(check, 30 * 60 * 1000)
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check()
      })
    },
  })
}

void setupServiceWorker()

window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, () => {
  queryClient.clear()
  void stopOfficerGpsTracking({ endDuty: false })
})

const originalFetch = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const res = await originalFetch(input, init)
  if (res.status !== 401) return res
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
  const isLogin = /\/login|\/auth\/token|\/api\/auth\//i.test(url)
  const isMedia = /\/media\//i.test(url)
  if (!isLogin && !isMedia) handleSessionExpired()
  return res
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
