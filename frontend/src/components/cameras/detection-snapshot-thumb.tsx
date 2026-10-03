import { resolveMediaUrl, type DetectionEvent } from "@/lib/cameras-api"

const GENERIC_LABELS = new Set(["unknown", "person", "face", ""])
const GLOBAL_ID_RE = /^(?:gp|go|gv|t)\d+$/i

function isGlobalId(value: string): boolean {
  return GLOBAL_ID_RE.test(value.trim())
}

/** Recognized staff / face name only (no global id). */
export function detectionPersonName(row: DetectionEvent): string | null {
  const employee = row.employee_name?.trim()
  if (employee) return employee

  const label = row.label?.trim() ?? ""
  const cls = (row.class_name || "").toLowerCase()
  if (
    (cls === "person" || cls === "face") &&
    label &&
    !GENERIC_LABELS.has(label.toLowerCase()) &&
    !isGlobalId(label)
  ) {
    return label
  }

  return null
}

/** Display text: global id + actual label/name when both exist. */
export function detectionDisplayLabel(row: DetectionEvent): string {
  const gid = (row.person_qr || "").trim()
  const person = detectionPersonName(row)
  const rawLabel = (row.label || "").trim()
  const cls = (row.class_name || "").trim()

  let name = person || ""
  if (!name) {
    if (rawLabel && !GENERIC_LABELS.has(rawLabel.toLowerCase()) && !isGlobalId(rawLabel)) {
      name = rawLabel
    } else {
      name = cls || rawLabel || "object"
    }
  }

  if (gid && name && gid.toLowerCase() === name.toLowerCase()) {
    name = cls || "person"
  }
  if (gid && name && !name.toLowerCase().includes(gid.toLowerCase())) {
    return `${gid} ${name}`
  }
  return gid || name
}

type DetectionSnapshotThumbProps = {
  row: DetectionEvent
}

/**
 * Thumbnail for detection clips. Name sits in a fixed bottom bar — the clip is
 * already annotated with a box/label, and object-cover crops make bbox % positions wrong.
 */
export function DetectionSnapshotThumb({ row }: DetectionSnapshotThumbProps) {
  const display = detectionDisplayLabel(row)
  const url = resolveMediaUrl(row.clip_url!)

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="relative inline-block"
    >
      <img
        src={url}
        alt={`Detection ${display}`}
        className="h-14 w-24 rounded border object-cover bg-muted hover:opacity-90"
        loading="lazy"
      />
      {display && (
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 truncate rounded-b bg-black/80 px-1 py-0.5 text-center text-[9px] font-semibold leading-tight text-white shadow"
          title={display}
        >
          {display}
        </span>
      )}
    </a>
  )
}
