import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { registerSW } from "virtual:pwa-register"
import { router } from "./routes"
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
