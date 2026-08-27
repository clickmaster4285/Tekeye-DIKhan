import type { Zone } from "@/lib/gate-types"

export type AccessZoneOption = {
  value: string
  label: string
  code?: string
}

/** Fallback when zones have not loaded yet. */
export const ACCESS_ZONE_OPTIONS_FALLBACK: AccessZoneOption[] = [
  { value: "zone-a", label: "Zone A" },
  { value: "zone-b", label: "Zone B" },
  { value: "zone-c", label: "Zone C" },
  { value: "all", label: "All Zones" },
]

const LEGACY_ZONE_LABELS: Record<string, string> = {
  "zone-a": "Zone A",
  "zone-b": "Zone B",
  "zone-c": "Zone C",
  "zone-d": "Zone D",
  all: "All Zones",
}

let labelByZoneId: Record<string, string> = {}

export function setAccessZoneLabelCache(options: AccessZoneOption[]): void {
  labelByZoneId = {}
  for (const opt of options) {
    labelByZoneId[opt.value] = opt.label
    if (opt.code) labelByZoneId[opt.code.toLowerCase()] = opt.label
  }
  labelByZoneId.all = "All Zones"
}

export function zonesToAccessZoneOptions(zones: Zone[]): AccessZoneOption[] {
  const active = zones.filter((z) => z.zone_active !== false)
  const fromRegistry = active.map((z) => ({
    value: z.zone_id,
    label: z.zone_name?.trim() || z.zone_code || z.zone_id,
    code: z.zone_code,
  }))
  if (fromRegistry.length === 0) return [...ACCESS_ZONE_OPTIONS_FALLBACK]
  const hasAll = fromRegistry.some((o) => o.value === "all")
  return hasAll ? fromRegistry : [...fromRegistry, { value: "all", label: "All Zones" }]
}

export function formatAccessZoneLabel(
  zone: string | undefined | null,
  options?: AccessZoneOption[]
): string {
  const raw = (zone ?? "").trim()
  if (!raw) return "—"
  if (options?.length) {
    const hit = options.find((o) => o.value === raw || o.code === raw)
    if (hit) return hit.label
  }
  if (labelByZoneId[raw]) return labelByZoneId[raw]
  const key = raw.toLowerCase()
  return LEGACY_ZONE_LABELS[key] ?? labelByZoneId[key] ?? raw
}

/** Pick a default zone from department name using configured zone labels. */
export function resolveAccessZoneFromDepartment(
  department: string,
  options: AccessZoneOption[] = []
): string {
  if (!options.length) {
    const key = department.toLowerCase()
    if (key.includes("finance")) return "zone-b"
    if (key.includes("ops") || key.includes("operation") || key.includes("it")) return "zone-c"
    return "zone-a"
  }
  const dept = department.toLowerCase()
  const matchByKeyword = (keywords: string[], labelHints: string[]) => {
    if (!keywords.some((k) => dept.includes(k))) return undefined
    return options.find((o) => {
      const label = o.label.toLowerCase()
      return labelHints.some((h) => label.includes(h))
    })?.value
  }
  return (
    matchByKeyword(["hr", "admin"], ["admin", "main", "office"]) ??
    matchByKeyword(["finance"], ["finance", "admin"]) ??
    matchByKeyword(["ops", "operation", "warehouse"], ["warehouse", "ops", "operation"]) ??
    matchByKeyword(["it", "engineering"], ["it", "tech", "admin"]) ??
    options.find((o) => o.value !== "all")?.value ??
    options[0]?.value ??
    ""
  )
}

/** @deprecated Use zones from `useAccessZones()` — kept for imports that expect a static list. */
export const ACCESS_ZONE_OPTIONS = ACCESS_ZONE_OPTIONS_FALLBACK
