import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { fetchMLHealth, type MLHealthResponse } from "@/lib/ml-api"
import { fetchStreamCameras } from "@/lib/cameras-api"

function professionalMlLabel(health: MLHealthResponse): { text: string; tone: "ok" | "warn" | "bad" } {
  if (health.status === "ok") {
    const faces = health.known_faces ?? 0
    const yolo = health.yolo_available ? "YOLO ready" : "YOLO unavailable"
    return {
      text: `Detection online · ${faces} enrolled face${faces === 1 ? "" : "s"} · ${yolo}`,
      tone: health.yolo_available ? "ok" : "warn",
    }
  }
  if (health.status === "disabled") {
    return { text: "Detection engine not configured", tone: "warn" }
  }
  return { text: "Detection engine temporarily unavailable", tone: "bad" }
}

export function MlSystemStatus({ className = "" }: { className?: string }) {
  const [ml, setMl] = useState<{ text: string; tone: "ok" | "warn" | "bad" }>({
    text: "Checking detection engine…",
    tone: "warn",
  })
  const [cameras, setCameras] = useState<string>("")

  useEffect(() => {
    Promise.all([
      fetchMLHealth().catch(() => ({ status: "error" as const })),
      fetchStreamCameras().catch(() => null),
    ]).then(([health, streams]) => {
      setMl(professionalMlLabel(health))
      if (streams) {
        const active = streams.cameras.length
        setCameras(
          active === 1 ? "1 camera connected" : `${active} cameras connected`,
        )
      }
    })
  }, [])

  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs text-muted-foreground ${className}`}>
      <Badge
        variant="outline"
        className={
          ml.tone === "ok"
            ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
            : ml.tone === "bad"
              ? "border-amber-500/40 text-amber-800 dark:text-amber-200"
              : undefined
        }
        title={ml.tone === "bad" ? "AI detection service is not responding. Live views may still work." : undefined}
      >
        {ml.text}
      </Badge>
      {cameras ? <Badge variant="outline">{cameras}</Badge> : null}
    </div>
  )
}
