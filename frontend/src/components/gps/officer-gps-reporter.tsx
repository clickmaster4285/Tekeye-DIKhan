import { useEffect } from "react"
import { startOfficerGpsTracking, stopOfficerGpsTracking } from "@/lib/officer-gps-session"

/**
 * Starts GPS as soon as the user is in the app (login / restored session).
 * Renders nothing. Duty is stopped on logout, not on page navigation.
 */
export function OfficerGpsReporter() {
  useEffect(() => {
    void startOfficerGpsTracking()
    return () => {
      void stopOfficerGpsTracking({ endDuty: false })
    }
  }, [])
  return null
}
