import type { ReactNode } from "react"

import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/** Keep goods-table columns from growing; text wraps and scrolls inside a fixed box. */
export const goodsLineCellClass =
  "max-w-0 overflow-hidden whitespace-normal align-middle"

export const goodsTableClass = "table-fixed w-full min-w-[1420px]"

export const goodsPlaceholderClass =
  "placeholder:text-muted-foreground placeholder:opacity-100"

export const goodsSelectTriggerClass =
  "h-9 w-full min-w-0 *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:overflow-visible"

const fieldClass =
  "h-20 min-h-20 max-h-20 w-full min-w-0 py-2 leading-5 [field-sizing:fixed] field-sizing-fixed resize-none overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] placeholder:text-muted-foreground placeholder:opacity-100 placeholder:whitespace-pre-wrap"

export function GoodsLineTextField({
  className,
  ...props
}: React.ComponentProps<typeof Textarea>) {
  return <Textarea rows={4} className={cn(fieldClass, className)} {...props} />
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
        "max-h-20 overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-5",
        className,
      )}
    >
      {children}
    </div>
  )
}
