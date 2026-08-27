import { type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function TableActionGroup({ children }: { children: ReactNode }) {
  return (
    <div className="ml-auto flex w-[6.5rem] flex-wrap items-center justify-end gap-0.5">
      {children}
    </div>
  )
}

export function TableActionIcon({
  label,
  onClick,
  to,
  disabled,
  destructive,
  children,
}: {
  label: string
  onClick?: () => void
  to?: string
  disabled?: boolean
  destructive?: boolean
  children: ReactNode
}) {
  const className = cn(
    "h-8 w-8 shrink-0",
    destructive && "text-destructive hover:text-destructive hover:bg-destructive/10"
  )
  if (to) {
    return (
      <Button variant="ghost" size="icon" className={className} disabled={disabled} asChild>
        <Link to={to} title={label} aria-label={label}>
          {children}
        </Link>
      </Button>
    )
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {children}
    </Button>
  )
}
