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

/** Head office stays Peshawar. This deployment is the DI Khan site. */
export const HEAD_OFFICE_LOCATION = "PESHAWAR" as const;
export const THIS_SITE_LOCATION = "DI_KHAN" as const satisfies LocationCode;

export function matchesThisSite(code?: string | null, name?: string | null): boolean {
  const normalized = (code || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  const label = (name || "").trim().toLowerCase();
  return (
    normalized === THIS_SITE_LOCATION ||
    normalized.replace(/_/g, "") === "DIKHAN" ||
    normalized.includes("DI_KHAN") ||
    label.includes("di khan") ||
    label.includes("d.i. khan") ||
    label.includes("dera ismail")
  );
}

export function locationLabel(code: string | null | undefined): string {
  if (!code) return "—";
  const found = LOCATION_OPTIONS.find((o) => o.value === code);
  return found?.label ?? code.replace(/_/g, " ");
}

/** Map free-text posting / branch fields onto a system location code when possible. */
export function inferLocationCode(...parts: Array<string | null | undefined>): LocationCode | "" {
  const blobs = parts.filter(Boolean).join(" ").toUpperCase();
  if (!blobs) return "";
  const normalized = blobs.replace(/\s+/g, "_");
  for (const opt of LOCATION_OPTIONS) {
    if (normalized.includes(opt.value) || blobs.includes(opt.label.toUpperCase())) {
      return opt.value;
    }
  }
  return "";
}
