import { useMemo, useState } from "react"
import { resolveMediaUrl, type DetectionEvent } from "@/lib/cameras-api"

const GENERIC_LABELS = new Set(["unknown", "person", "face", ""])

export function detectionPersonName(row: DetectionEvent): string | null {
  const employee = row.employee_name?.trim()
  if (employee) return employee

  const label = row.label?.trim() ?? ""
  const cls = (row.class_name || "").toLowerCase()
  if ((cls === "person" || cls === "face") && label && !GENERIC_LABELS.has(label.toLowerCase())) {
    return label
  }

  return null
}

type DetectionSnapshotThumbProps = {
  row: DetectionEvent
}

export function DetectionSnapshotThumb({ row }: DetectionSnapshotThumbProps) {
  const personName = detectionPersonName(row)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const url = resolveMediaUrl(row.clip_url!)

  const namePosition = useMemo(() => {
    if (!personName || !dims || !row.bbox || row.bbox.length < 4) {
      return { left: "2px", top: "2px" }
    }
    const [x1, y1] = row.bbox
    const left = Math.min(90, Math.max(0, (x1 / dims.w) * 100))
    const top = Math.min(82, Math.max(0, (y1 / dims.h) * 100 - 14))
    return { left: `${left}%`, top: `${top}%` }
  }, [personName, dims, row.bbox])

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="relative inline-block"
    >
      <img
        src={url}
        alt={personName ? `Detection ${personName}` : `Detection ${row.label}`}
        className="h-14 w-24 rounded border object-cover bg-muted hover:opacity-90"
        loading="lazy"
        onLoad={(e) => {
          const img = e.currentTarget
          if (img.naturalWidth > 0) {
            setDims({ w: img.naturalWidth, h: img.naturalHeight })
          }
        }}
      />
      {personName && (
        <span
          className="pointer-events-none absolute z-10 max-w-[calc(100%-4px)] truncate rounded bg-black/80 px-1 py-0.5 text-[9px] font-semibold leading-tight text-white shadow"
          style={namePosition}
          title={personName}
        >
          {personName}
        </span>
      )}
    </a>
  )
}
