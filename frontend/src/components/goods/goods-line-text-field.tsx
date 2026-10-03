import type { ReactNode } from "react"

import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/**
 * Column widths for the goods line editor (must sum to goodsTableClass min-width).
 * Applied via <colgroup> so table-fixed cannot let textareas blow out neighbors.
 */
export const GOODS_COL_WIDTHS = [
  118, // QR
  200, // Description
  76, // Qty
  92, // Unit
  140, // Condition
  64, // Perishable
  132, // ID / Chassis
  180, // Item Notes
  88, // Images
  140, // Camera Zone
  160, // Located Camera
  48, // Delete
] as const

export const GOODS_TABLE_MIN_WIDTH = GOODS_COL_WIDTHS.reduce((a, b) => a + b, 0)

export function GoodsTableColGroup() {
  return (
    <colgroup>
      {GOODS_COL_WIDTHS.map((w, i) => (
        <col key={i} style={{ width: w, minWidth: w }} />
      ))}
    </colgroup>
  )
}

export const goodsLineCellClass =
  "align-top p-2 overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere]"

export const goodsTableClass = cn(
  "w-full table-fixed border-separate border-spacing-0 text-sm",
)

export const goodsPlaceholderClass =
  "h-9 w-full min-w-0 max-w-full shadow-none placeholder:text-muted-foreground placeholder:opacity-100"

export const goodsSelectTriggerClass =
  "h-9 w-full min-w-0 max-w-full shadow-none *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:truncate"

export const goodsHeadClass =
  "h-9 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap align-bottom overflow-hidden"

/** Pins short controls to the top of the row (matches textarea top). */
export const goodsControlWrapClass =
  "flex h-[4.5rem] w-full min-w-0 max-w-full items-start overflow-hidden"

export const goodsControlCellClass =
  "align-top p-2 overflow-hidden whitespace-normal"

/** Must override Textarea's default field-sizing-content or the box grows over adjacent columns. */
const fieldClass =
  "field-sizing-fixed h-[4.5rem] min-h-[4.5rem] max-h-[4.5rem] w-full max-w-full min-w-0 box-border py-2 text-sm leading-5 resize-none overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] placeholder:text-muted-foreground placeholder:opacity-100 placeholder:whitespace-pre-wrap shadow-none"

export function GoodsLineTextField({
  className,
  style,
  ...props
}: React.ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      rows={3}
      className={cn(fieldClass, className)}
      style={{ fieldSizing: "fixed", ...style }}
      {...props}
    />
  )
}

export function GoodsLineText({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-5",
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Shared body cell for goods detail / read-only tables. */
export const goodsDetailCellClass =
  "align-middle px-2 py-3 text-sm whitespace-normal break-words [overflow-wrap:anywhere]"

