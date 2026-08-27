import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { getUserLocationFilter } from "@/lib/location-access";

const API = `${API_BASE_URL}/api`;

export type VmsListRow = { id: string } & Record<string, string>;

const JSON_BLOB_ROW_ID = "__json__";

async function parseApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as Record<string, unknown>;
    if (typeof data.detail === "string") return data.detail;
    return `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function fetchVmsListRows(module: string): Promise<VmsListRow[]> {
  const params = new URLSearchParams({ module });
  const loc = getUserLocationFilter();
  if (loc) params.set("location", loc);

  const res = await fetch(`${API}/vms/lists/?${params}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  const data = (await res.json()) as VmsListRow[];
  return Array.isArray(data) ? data : [];
}

export async function saveVmsListRows(module: string, rows: VmsListRow[]): Promise<void> {
  const loc = getUserLocationFilter() || "";
  const res = await fetch(`${API}/vms/lists/`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ module, rows, location: loc }),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
}

/** Store a JSON array/object under a module (single blob row). */
export async function fetchVmsJsonBlob<T>(module: string, fallback: T): Promise<T> {
  try {
    const rows = await fetchVmsListRows(module);
    const blob = rows.find((r) => r.id === JSON_BLOB_ROW_ID);
    const raw = blob?._json ?? blob?.json;
    if (!raw) return fallback;
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

export async function saveVmsJsonBlob<T>(module: string, data: T): Promise<void> {
  await saveVmsListRows(module, [
    { id: JSON_BLOB_ROW_ID, _json: JSON.stringify(data) },
  ]);
}

/** Remove legacy VMS keys from localStorage (one-time cleanup). */
export function clearLegacyVmsLocalStorage(): void {
  if (typeof window === "undefined") return;
  const keys = [
    "vms_visitors_walkin",
    "vms_visitors_prereg",
    "vms_walkin_draft",
    "vms_prereg_draft",
    "vms_gates_registry",
    "vms_zones",
    "vms_vehicle_entries",
    "vms_vehicle_tracking",
    "qrCodes",
    "vms-blacklist",
    "vms-escort-requirement",
    "vms-zone-restrictions",
    "vms-gate-integration",
    "vms_blacklist_management_rows",
    "vms_watchlist_screening_rows",
    "vms_flagged_visitor_alerts_rows",
    "vms_escort_requirement_rows",
    "vms_upcoming_visits_rows",
    "vms_visitor_history_rows",
    "vms_visitor_notifications_rows",
    "vms_contractor_passes_rows",
    "vms_cargo_delivery_logs_rows",
  ];
  for (const key of keys) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
