import { Copy, Eye } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function getGoodsQrImageUrl(data: string, size = 72) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`
}

type GoodsQrDisplayProps = {
  /** Human-readable QR number shown under the image. */
  code?: string | null
  /** Payload encoded in the QR image (defaults to `code`). */
  imageData?: string | null
  size?: number
  className?: string
  onCopy?: () => void
  onView?: () => void
}

/**
 * Shared QR column layout: image on top, code + actions underneath (centered).
 */
export function GoodsQrDisplay({
  code,
  imageData,
  size = 72,
  className,
  onCopy,
  onView,
}: GoodsQrDisplayProps) {
  const label = (code || "").trim()
  const payload = (imageData || code || "").trim()

  if (!payload && !label) {
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <div className={cn("flex w-full min-w-0 flex-col items-center gap-1.5", className)}>
      {payload ? (
        <img
          src={getGoodsQrImageUrl(payload, size)}
          alt={label ? `QR ${label}` : "QR Code"}
          width={size}
          height={size}
          className="shrink-0 rounded-sm border border-border bg-white p-0.5"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='10'%3EQR%3C/text%3E%3C/svg%3E"
          }}
        />
      ) : null}
      {label ? (
        <span
          className="max-w-full truncate px-1 text-center font-mono text-[10px] leading-tight text-muted-foreground"
          title={label}
        >
          {label}
        </span>
      ) : null}
      {(onCopy || onView) && (
        <div className="flex items-center justify-center gap-0.5">
          {onCopy ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px]"
              onClick={onCopy}
            >
              <Copy className="mr-0.5 h-3 w-3" />
              Copy
            </Button>
          ) : null}
          {onView ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px]"
              onClick={onView}
            >
              <Eye className="mr-0.5 h-3 w-3" />
              View
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}
