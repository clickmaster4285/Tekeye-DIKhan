"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ACCESS_ZONE_OPTIONS_FALLBACK } from "@/lib/access-zone"
import { useAccessZones } from "@/hooks/use-access-zones"
import { cn } from "@/lib/utils"

type AccessZoneSelectProps = {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  triggerClassName?: string
  disabled?: boolean
  includeAllOption?: boolean
  /** Scope zones to a location; pass "" when location must be chosen first */
  location?: string | null
}

export function AccessZoneSelect({
  value,
  onValueChange,
  placeholder = "Select zone",
  className,
  triggerClassName,
  disabled,
  includeAllOption = true,
  location,
}: AccessZoneSelectProps) {
  const waitingForLocation = location === ""
  const { data, isLoading } = useAccessZones(location)
  let options = data?.options?.length ? data.options : ACCESS_ZONE_OPTIONS_FALLBACK
  if (!includeAllOption) {
    options = options.filter((o) => o.value !== "all")
  }

  return (
    <Select
      value={value || undefined}
      onValueChange={onValueChange}
      disabled={disabled || waitingForLocation || (isLoading && !value)}
    >
      <SelectTrigger className={cn("h-11 border-border", triggerClassName, className)}>
        <SelectValue
          placeholder={
            waitingForLocation
              ? "Select location first"
              : isLoading
                ? "Loading zones…"
                : placeholder
          }
        />
      </SelectTrigger>
      <SelectContent>
        {options.map((z) => (
          <SelectItem key={z.value} value={z.value}>
            {z.label}
            {z.code && z.code !== z.label ? ` (${z.code})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
