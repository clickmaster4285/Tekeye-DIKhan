import { useCallback, useEffect, useRef } from "react"

export function useLoginParallax(enabled = true) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      if (e.clientX > rect.right) return
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      el.style.setProperty("--px", String(x))
      el.style.setProperty("--py", String(y))
    }

    window.addEventListener("mousemove", onMove, { passive: true })
    return () => window.removeEventListener("mousemove", onMove)
  }, [enabled])

  return ref
}

export function useCardSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  const onMove = useCallback((e: React.MouseEvent<T>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    el.style.setProperty("--spot-x", `${x}%`)
    el.style.setProperty("--spot-y", `${y}%`)
  }, [])

  const onLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.setProperty("--spot-x", "50%")
    el.style.setProperty("--spot-y", "30%")
  }, [])

  return { ref, onMove, onLeave }
}
