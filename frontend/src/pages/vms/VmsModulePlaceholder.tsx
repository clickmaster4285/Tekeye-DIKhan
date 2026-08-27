import { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ROUTES } from "@/routes/config"

interface VmsModulePlaceholderProps {
  title: string
  description: string
  models?: string
  icon?: ReactNode
}

export function VmsModulePlaceholder({ title, description, models, icon }: VmsModulePlaceholderProps) {
  return (
    <div className="">
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        {icon && (
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
            {icon}
          </div>
        )}
        <h1 className="text-xl font-semibold text-foreground tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {models && (
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium">Models:</span> {models}
          </p>
        )}
        <Link
          to={ROUTES.WALK_IN_REGISTRATION}
          className="mt-6 inline-flex items-center text-sm font-medium text-[#3b82f6] hover:underline"
        >
          Go to Walk-In Registration
        </Link>
      </div>
    </div>
  )
}
