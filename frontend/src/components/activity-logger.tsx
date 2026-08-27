import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import { reportActivityLog } from "@/lib/logs-api"
import { ROUTES } from "@/routes/config"

const DEBOUNCE_MS = 500

/**
 * Reports the current route as an activity for full-app logs. Renders nothing.
 * Only runs when user is authenticated (DashboardLayout is only shown when logged in).
 * Debounced so rapid navigation does not spam the API.
 */
export function ActivityLogger() {
  const location = useLocation()
  const prevPathRef = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const pendingPathRef = useRef<string | null>(null)

  useEffect(() => {
    const pathname = location.pathname || "/"
    if (pathname === ROUTES.LOGIN) return
    if (prevPathRef.current === pathname) return

    pendingPathRef.current = pathname
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      const path = pendingPathRef.current
      if (!path || prevPathRef.current === path) {
        timerRef.current = null
        return
      }
      prevPathRef.current = path
      const action = path === "/" || path === "" ? "Viewed / (Dashboard)" : `Viewed ${path}`
      void reportActivityLog(action)
      timerRef.current = null
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [location.pathname])

  return null
}
