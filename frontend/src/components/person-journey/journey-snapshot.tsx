import { resolveMediaUrl } from "@/lib/cameras-api"
import type { JourneyEventRecord, JourneyPersonRecord } from "@/lib/person-journey-api"

type JourneySnapshotProps = {
  url?: string | null
  alt: string
  className?: string
}

export function JourneySnapshot({
  url,
  alt,
  className = "h-14 w-24 rounded border object-cover bg-muted",
}: JourneySnapshotProps) {
  const src = url ? resolveMediaUrl(url) : ""
  if (!src) {
    return (
      <div
        className={`${className} flex items-center justify-center text-[10px] text-muted-foreground`}
      >
        No image
      </div>
    )
  }
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="inline-block shrink-0">
      <img src={src} alt={alt} className={`${className} hover:opacity-90`} loading="lazy" />
    </a>
  )
}

export function personSnapshotUrl(person: JourneyPersonRecord): string {
  return person.latest_snapshot_url || ""
}

export function eventSnapshotUrl(event: JourneyEventRecord): string {
  return event.snapshot_url || event.snapshot_path || ""
}
