import { resolveMediaUrl } from "@/lib/cameras-api"

type TrackingCaptureThumbProps = {
  url?: string | null
  alt: string
  className?: string
  size?: "sm" | "md" | "lg"
  /** When false, render image only (use inside parent links). */
  asLink?: boolean
}

const SIZE_CLASS = {
  sm: "h-12 w-20",
  md: "h-16 w-28",
  lg: "h-40 w-full max-w-md",
}

export function TrackingCaptureThumb({
  url,
  alt,
  className,
  size = "sm",
  asLink = true,
}: TrackingCaptureThumbProps) {
  const src = url ? resolveMediaUrl(url) : ""
  const box = className || `${SIZE_CLASS[size]} rounded border object-cover bg-muted`

  if (!src) {
    return (
      <div
        className={`${box} flex items-center justify-center text-[10px] text-muted-foreground`}
        title="Capture pending"
      >
        No image
      </div>
    )
  }

  const image = (
    <img src={src} alt={alt} className={`${box} hover:opacity-90`} loading="lazy" />
  )

  if (!asLink) {
    return <div className="inline-block shrink-0">{image}</div>
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      {image}
    </a>
  )
}
