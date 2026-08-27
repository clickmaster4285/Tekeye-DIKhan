import type { VmsOverviewVisitorRow } from "@/lib/vms-api"
import { ROUTES, getVisitorDetailPath } from "@/routes/config"

export function clearanceStatusClass(status: string): string {
  const s = status.toLowerCase()
  if (s.includes("blacklist") || s.includes("rejected")) {
    return "bg-[#FFE2E2] text-[#C10007]"
  }
  if (s.includes("pending")) {
    return "bg-[#FCEDD7] text-[#BB411E]"
  }
  return "bg-green-100 text-[#008235]"
}

export function priorityClass(priority: string): string {
  const p = priority.toLowerCase()
  if (p === "urgent") return "bg-[#FFE2E2] text-[#C10007]"
  if (p === "high") return "bg-[#DEEAFC] text-[#1D4CDD]"
  return "bg-green-100 text-[#008235]"
}

export function visitorDetailHref(row: VmsOverviewVisitorRow): string {
  const source =
    row.registration_source === "walk-in" ? "walk-in" : "pre-registration"
  return `${getVisitorDetailPath(row.id)}?source=${encodeURIComponent(source)}`
}

export function visitorEditHref(row: VmsOverviewVisitorRow): string {
  return row.registration_source === "walk-in"
    ? ROUTES.WALK_IN_REGISTRATION
    : ROUTES.PRE_REGISTRATION
}
