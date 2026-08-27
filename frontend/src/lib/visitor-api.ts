import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { filterByUserLocation, getUserLocationFilter } from "@/lib/location-access";
import { getStoredUser } from "@/lib/auth";

const API = `${API_BASE_URL}/api`;

export type RegistrationSource = "walk-in" | "pre-registration";

export type RegistrationStatus = "draft" | "approved" | "sent";

export type VisitorRecord = {
  id: number;
  full_name: string;
  visitor_type: string;
  department_to_visit: string;
  cnic_number: string;
  passport_number: string;
  created_at: string;
  location?: string;
  registered_by_user_id?: number;
  registered_by_username?: string;
  /** Display name of the user who created this registration */
  created_by?: string;
  registration_source?: RegistrationSource;
  registration_status?: RegistrationStatus;
  profile_image?: string;
  watchlist_check_status?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
};

/** Alias used by VisitorEdit */
export type VisitorDetail = VisitorRecord;

export function getVisitorCreatedBy(
  visitor: Pick<VisitorRecord, "created_by" | "registered_by_username" | "registered_by_user_id">
): string {
  const label =
    (visitor.created_by && String(visitor.created_by).trim()) ||
    (visitor.registered_by_username && String(visitor.registered_by_username).trim()) ||
    "";
  if (label) return label;
  if (visitor.registered_by_user_id) return `User #${visitor.registered_by_user_id}`;
  return "—";
}

function registrationMeta(): Pick<
  VisitorRecord,
  "location" | "registered_by_user_id" | "registered_by_username"
> {
  const user = getStoredUser();
  const location = user?.location || getUserLocationFilter() || undefined;
  return {
    location,
    registered_by_user_id: user?.id,
    registered_by_username: user?.username,
  };
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as Record<string, unknown>;
    if (typeof data.detail === "string") return data.detail;
    return Object.entries(data)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
      .join("; ");
  } catch {
    return `Request failed (${res.status})`;
  }
}

function mapVisitor(raw: Record<string, unknown>): VisitorRecord {
  const id = Number(raw.id);
  return {
    id,
    full_name: String(raw.full_name ?? "Unknown Visitor"),
    visitor_type: String(raw.visitor_type ?? "general"),
    department_to_visit: String(raw.department_to_visit ?? "admin"),
    cnic_number: String(raw.cnic_number ?? raw.cnic_passport ?? ""),
    passport_number: String(raw.passport_number ?? ""),
    created_at: String(raw.created_at ?? new Date().toISOString()),
    location: raw.location as string | undefined,
    registered_by_user_id: raw.registered_by_user_id as number | undefined,
    registered_by_username: raw.registered_by_username as string | undefined,
    created_by: (raw.created_by as string) || (raw.registered_by_username as string) || undefined,
    registration_source: (raw.registration_source as RegistrationSource) || undefined,
    registration_status: (raw.registration_status as RegistrationStatus) || "approved",
    profile_image: raw.profile_image as string | undefined,
    watchlist_check_status: raw.watchlist_check_status as string | undefined,
    email: (raw.email as string) || (raw.email_address as string),
    phone: (raw.phone as string) || (raw.mobile_number as string),
    ...raw,
  };
}

export const STORAGE_QUOTA_MESSAGE =
  "Could not save registration. Try fewer or smaller images.";

export const STORAGE_QUOTA_SINGLE_MESSAGE =
  "Registration is too large. Try fewer or smaller images.";

export async function fetchVisitors(
  source: RegistrationSource = "pre-registration"
): Promise<VisitorRecord[]> {
  const params = new URLSearchParams({ registration_source: source });
  const loc = getUserLocationFilter();
  if (loc) params.set("location", loc);

  const res = await fetch(`${API}/visitors/list/?${params}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as Record<string, unknown>[];
  const rows = data.map((r) => mapVisitor(r));
  return filterByUserLocation(rows);
}

export async function createVisitor(
  payload: Record<string, unknown>,
  source: RegistrationSource = "pre-registration"
): Promise<VisitorRecord> {
  const body = {
    ...payload,
    ...registrationMeta(),
    registration_source: source,
    registration_status: payload.registration_status ?? "approved",
  };
  const res = await fetch(`${API}/visitors/create/?registration_source=${encodeURIComponent(source)}`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as Record<string, unknown>;
  return mapVisitor(data);
}

export async function saveDraftToStore(
  payload: Record<string, unknown>,
  source: RegistrationSource = "pre-registration"
): Promise<VisitorRecord> {
  return createVisitor(
    { ...payload, registration_status: "draft" },
    source
  );
}

export async function updateVisitor(
  id: number,
  payload: Record<string, unknown>,
  source: RegistrationSource = "walk-in",
  options?: { registrationStatus?: RegistrationStatus }
): Promise<VisitorRecord | null> {
  const body: Record<string, unknown> = {
    ...payload,
    registration_source: source,
  };
  if (options?.registrationStatus) {
    body.registration_status = options.registrationStatus;
  }
  const res = await fetch(`${API}/visitors/${id}/update/`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as Record<string, unknown>;
  return mapVisitor(data);
}

export async function getVisitor(
  id: number,
  _source: RegistrationSource = "walk-in"
): Promise<VisitorRecord | null> {
  const res = await fetch(`${API}/visitors/${id}/read/`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as Record<string, unknown>;
  const record = mapVisitor(data);
  const loc = getUserLocationFilter();
  if (loc && record.location && record.location !== loc) return null;
  return record;
}

export async function deleteVisitor(
  id: number,
  _source: RegistrationSource = "walk-in"
): Promise<void> {
  const res = await fetch(`${API}/visitors/${id}/delete/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (res.status === 404) return;
  if (!res.ok) throw new Error(await parseError(res));
}

export async function isCnicExists(cnic: string): Promise<boolean> {
  const normalized = String(cnic || "").trim();
  if (!normalized) return false;
  const res = await fetch(
    `${API}/visitors/check-cnic/?cnic=${encodeURIComponent(normalized)}`,
    { headers: getAuthHeaders(), cache: "no-store" }
  );
  if (!res.ok) return false;
  const data = (await res.json()) as { exists?: boolean };
  return Boolean(data.exists);
}

export function getErrorToastMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Something went wrong. Please try again.";
}
