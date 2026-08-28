import { useCallback, useEffect, useRef, useState } from "react"
import { saveElementAsPdf } from "@/lib/save-report-pdf"
import { toast } from "@/hooks/use-toast"

export function useBatchPdfExport<T>(filename: string) {
  const hostRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)
  const [items, setItems] = useState<T[] | null>(null)

  const start = useCallback((rows: T[]) => {
    if (!rows.length || busyRef.current) return
    busyRef.current = true
    setItems(rows)
  }, [])

  useEffect(() => {
    if (!items?.length) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          if (!hostRef.current || cancelled) return
          await saveElementAsPdf(hostRef.current, filename)
        } catch (error) {
          if (!cancelled) {
            toast({
              title: "Could not export PDF",
              description: error instanceof Error ? error.message : "Please try again.",
              variant: "destructive",
            })
          }
        } finally {
          busyRef.current = false
          if (!cancelled) setItems(null)
        }
      })()
    }, 500)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [items, filename])

  return { hostRef, items, start }
}
