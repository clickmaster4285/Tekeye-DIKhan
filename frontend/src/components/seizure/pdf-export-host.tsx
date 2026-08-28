import type { ReactNode, RefObject } from "react"

export function PdfExportHost({
  hostRef,
  children,
}: {
  hostRef: RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  return (
    <div
      ref={hostRef}
      aria-hidden
      className="pointer-events-none fixed -left-[100vw] top-0 w-[210mm] opacity-0"
    >
      {children}
    </div>
  )
}
