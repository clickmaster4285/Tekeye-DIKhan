import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow,border-color,background-color] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'hover:border-[#A9D1EF] hover:bg-white dark:hover:bg-background',
        'focus-visible:border-[#A9D1EF] focus-visible:bg-white focus-visible:ring-[#A9D1EF]/30 dark:focus-visible:bg-background',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
