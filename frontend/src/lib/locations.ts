/** Customs station / office locations for user assignment and registration scoping. */
export const LOCATION_OPTIONS = [
  { value: "PESHAWAR", label: "Peshawar (Head Office)" },
  { value: "KOHAT", label: "Kohat" },
  { value: "NOWSHERA", label: "Nowshera" },
  { value: "MARDAN", label: "Mardan" },
  { value: "DI_KHAN", label: "DI Khan" },
  { value: "SWH_RATTA_KULACHI", label: "SWH Ratta Kulachi" },
] as const;

export type LocationCode = (typeof LOCATION_OPTIONS)[number]["value"];

export function locationLabel(code: string | null | undefined): string {
  if (!code) return "—";
  const found = LOCATION_OPTIONS.find((o) => o.value === code);
  return found?.label ?? code.replace(/_/g, " ");
}
