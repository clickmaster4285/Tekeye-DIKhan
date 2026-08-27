/**
 * Warehouse & Zone shared constants and utilities.
 * Mirrors backend zone_catalog.py
 */

export const CUSTOMS_WAREHOUSE_ZONES = [
  {
    code: "Z-IN",
    name: "Receiving Area",
    security_level: "standard",
    sort_order: 1,
    description: "Goods receiving and initial inspection zone",
  },
  {
    code: "Z-DA",
    name: "Detained Articles",
    security_level: "restricted",
    sort_order: 2,
    description: "Temporarily held goods under investigation",
  },
  {
    code: "Z-SZ",
    name: "Seizure Zone",
    security_level: "high",
    sort_order: 3,
    description: "Seized/confiscated goods (high security)",
  },
  {
    code: "Z-EX",
    name: "Examination Zone",
    security_level: "restricted",
    sort_order: 4,
    description: "Goods under examination and testing",
  },
  {
    code: "Z-ST",
    name: "General Stock",
    security_level: "standard",
    sort_order: 5,
    description: "General storage and warehousing",
  },
  {
    code: "Z-DI",
    name: "Disposal Zone",
    security_level: "restricted",
    sort_order: 6,
    description: "Goods marked for destruction or disposal",
  },
  {
    code: "Z-RL",
    name: "Release Zone",
    security_level: "standard",
    sort_order: 7,
    description: "Cleared goods ready for collection/release",
  },
] as const

export function getZoneByCode(code: string) {
  return CUSTOMS_WAREHOUSE_ZONES.find((z) => z.code === code)
}

export function zoneLabel(code: string | null | undefined): string {
  if (!code) return "—"
  const zone = getZoneByCode(code)
  return zone ? zone.name : code
}

export function zoneSecurityBadge(level: string): "default" | "secondary" | "destructive" {
  switch (level) {
    case "high":
      return "destructive"
    case "restricted":
      return "secondary"
    default:
      return "default"
  }
}

export const ZONE_SECURITY_LEVELS = [
  { value: "standard", label: "Standard" },
  { value: "restricted", label: "Restricted" },
  { value: "high", label: "High" },
] as const

export const WAREHOUSE_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "INACTIVE", label: "Inactive" },
] as const
