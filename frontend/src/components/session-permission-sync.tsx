import { useEffect } from "react"
import { getStoredToken } from "@/lib/api"
import { getStoredUser, updateStoredUser } from "@/lib/auth"
import { isGlobalAdmin } from "@/lib/location-access"
import { fetchCurrentUser } from "@/lib/users-api"
import { REALTIME_INVALIDATE_EVENT } from "@/lib/realtime-socket"

/**
 * Soft-refresh session profile when users/hr realtime events arrive so module
 * grant changes apply without a full page reload. Super Admin skips (always full nav).
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

    const onRealtime = (e: Event) => {
      const domains = (e as CustomEvent<{ domains?: string[] }>).detail?.domains || []
      if (domains.some((d) => ["users", "hr"].includes(d))) void refresh()
    }

    window.addEventListener(REALTIME_INVALIDATE_EVENT, onRealtime)
    void refresh()
    return () => {
      window.removeEventListener(REALTIME_INVALIDATE_EVENT, onRealtime)
    }
  }, [])

  return null
}
