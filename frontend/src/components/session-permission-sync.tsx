import { useEffect } from "react"
import { getStoredToken } from "@/lib/api"
import { getStoredUser, updateStoredUser } from "@/lib/auth"
import { isGlobalAdmin } from "@/lib/location-access"
import { fetchCurrentUser } from "@/lib/users-api"

/**
 * Soft-refresh session profile on tab focus so module grant changes apply
 * without a full page reload. Super Admin skips (always full nav).
 */
export function SessionPermissionSync() {
  useEffect(() => {
    let busy = false

    const refresh = async () => {
      if (busy) return
      if (!getStoredToken()) return
      const user = getStoredUser()
      if (!user || isGlobalAdmin(user.role)) return
      if (document.visibilityState === "hidden") return
      busy = true
      try {
        const me = await fetchCurrentUser()
        const nextModules = Array.isArray(me.allowed_modules) ? me.allowed_modules : []
        const prev = user.allowed_modules ?? []
        const same =
          prev.length === nextModules.length && prev.every((m, i) => m === nextModules[i])
        if (!same || me.role !== user.role) {
          updateStoredUser({
            allowed_modules: nextModules,
            role: me.role,
            full_name: me.full_name,
            location: me.location,
            is_active: me.is_active,
          })
        }
      } catch {
        /* ignore — offline / transient */
      } finally {
        busy = false
      }
    }

    const onVis = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", onVis)
    void refresh()
    return () => {
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [])

  return null
}
