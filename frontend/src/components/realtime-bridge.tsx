"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { isAuthenticated } from "@/lib/auth"
import {
  DOMAIN_QUERY_PREFIXES,
  REALTIME_INVALIDATE_EVENT,
  startRealtimeSocket,
  stopRealtimeSocket,
  type RealtimeInvalidateDetail,
} from "@/lib/realtime-socket"

/**
 * Connects Socket.IO while the user is logged in and invalidates React Query
 * caches when the backend emits realtime:invalidate.
 */
export function RealtimeBridge() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const syncSocket = () => {
      if (isAuthenticated()) {
        // Rebuild so auth token on the handshake stays current after login.
        stopRealtimeSocket()
        startRealtimeSocket()
      } else {
        stopRealtimeSocket()
      }
    }

    syncSocket()

    const onInvalidate = (e: Event) => {
      const detail = (e as CustomEvent<RealtimeInvalidateDetail>).detail
      const domains = detail?.domains || []
      const seen = new Set<string>()
      for (const domain of domains) {
        const prefixes = DOMAIN_QUERY_PREFIXES[domain] || [[domain]]
        for (const prefix of prefixes) {
          const key = prefix.join("/")
          if (seen.has(key)) continue
          seen.add(key)
          void queryClient.invalidateQueries({ queryKey: prefix })
        }
      }
    }

    window.addEventListener(REALTIME_INVALIDATE_EVENT, onInvalidate)
    window.addEventListener("storage", syncSocket)
    window.addEventListener("tekeye-auth-changed", syncSocket)
    return () => {
      window.removeEventListener(REALTIME_INVALIDATE_EVENT, onInvalidate)
      window.removeEventListener("storage", syncSocket)
      window.removeEventListener("tekeye-auth-changed", syncSocket)
      stopRealtimeSocket()
    }
  }, [queryClient])

  return null
}
