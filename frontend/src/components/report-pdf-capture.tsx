import { useEffect, useRef } from "react"
import { saveElementAsPdf } from "@/lib/save-report-pdf"

type ReportPdfCaptureProps = {
  filename: string
  children: React.ReactNode
  onDone: (error?: unknown) => void
}

/** Renders a report off-screen and downloads it as a PDF, then unmounts. */
export function ReportPdfCapture({ filename, children, onDone }: ReportPdfCaptureProps) {
  const ref = useRef<HTMLDivElement>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void saveElementAsPdf(el, filename)
        .then(() => {
          if (!cancelled) onDoneRef.current()
        })
        .catch((error) => {
          if (!cancelled) onDoneRef.current(error)
        })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [filename])

  return (
    <div
      ref={ref}
      aria-hidden
      className="pdf-capture-root"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: "210mm",
        background: "#fff",
        opacity: 0,
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {children}
    </div>
  )
}
