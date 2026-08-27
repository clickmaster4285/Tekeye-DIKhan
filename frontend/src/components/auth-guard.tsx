import { useEffect, useState } from "react"
import { useLocation, useNavigate, Outlet } from "react-router-dom"
import { Shield } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { Toaster } from "@/components/ui/toaster"
import { AUTH_SESSION_KEY, AUTH_USER_UPDATED_EVENT, getStoredUser, goToSafeMediaNext } from "@/lib/auth"
import { getHomeRouteForRole, isPathAllowedForRole } from "@/lib/role-access"
import { ROUTES, isLoginRoute } from "@/routes/config"
import { clearLegacyVmsLocalStorage } from "@/lib/vms-list-api"

function isAuthenticatedSession(): boolean {
  return typeof window !== "undefined" && sessionStorage.getItem(AUTH_SESSION_KEY) === "true"
}

function isPathAllowedNow(pathname: string): boolean {
  const auth = isAuthenticatedSession()
  const isLoginPage = isLoginRoute(pathname)
  const user = getStoredUser()
  if (!isLoginPage && !auth) return false
  if (isLoginPage && auth) return false
  if (auth && !isPathAllowedForRole(pathname, user?.role, user?.allowed_modules)) return false
  return true
}

export function AuthGuard() {
  const location = useLocation()
  const navigate = useNavigate()
  const [authTick, setAuthTick] = useState(0)

  useEffect(() => {
    clearLegacyVmsLocalStorage()
  }, [])

  useEffect(() => {
    const onUserUpdated = () => setAuthTick((n) => n + 1)
    window.addEventListener(AUTH_USER_UPDATED_EVENT, onUserUpdated)
    return () => window.removeEventListener(AUTH_USER_UPDATED_EVENT, onUserUpdated)
  }, [])

  const allowed = isPathAllowedNow(location.pathname)

  useEffect(() => {
    const auth = isAuthenticatedSession()
    const isLoginPage = isLoginRoute(location.pathname)
    const user = getStoredUser()
    const homeRoute = getHomeRouteForRole(user?.role, user?.allowed_modules)

    if (!isLoginPage && !auth) {
      navigate(ROUTES.LOGIN, { replace: true })
      return
    }
    if (isLoginPage && auth) {
      if (goToSafeMediaNext(new URLSearchParams(location.search).get("next"))) {
        return
      }
      navigate(homeRoute, { replace: true })
      return
    }
    if (auth && !isPathAllowedForRole(location.pathname, user?.role, user?.allowed_modules)) {
      navigate(homeRoute, { replace: true })
    }
  }, [location.pathname, location.search, navigate, authTick])

  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#3b82f6] text-white shadow-lg">
            <Shield className="h-7 w-7" />
          </div>
          <Spinner className="h-8 w-8 text-[#3b82f6]" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Outlet />
      <Toaster />
    </>
  )
}
