import { useCallback, useEffect, useState } from "react"
import { fetchCameras, type CameraRecord } from "@/lib/cameras-api"

export function useCameras(options?: { activeOnly?: boolean; onlineOnly?: boolean }) {
  const [cameras, setCameras] = useState<CameraRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchCameras()
      .then((rows) => {
        let list = rows
        if (options?.activeOnly) list = list.filter((c) => c.is_active)
        if (options?.onlineOnly) list = list.filter((c) => c.status === "Online")
        setCameras(list)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load cameras"))
      .finally(() => setLoading(false))
  }, [options?.activeOnly, options?.onlineOnly])

  useEffect(() => {
    reload()
    const onUpdate = () => reload()
    window.addEventListener("camera-integration-updated", onUpdate)
    window.addEventListener("focus", onUpdate)
    return () => {
      window.removeEventListener("camera-integration-updated", onUpdate)
      window.removeEventListener("focus", onUpdate)
    }
  }, [reload])

  return { cameras, loading, error, reload }
}
