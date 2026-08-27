import { API_BASE_URL, getAuthHeaders, getStoredToken } from "@/lib/api";
import { locationLabel, LOCATION_OPTIONS } from "@/lib/locations";

export type ApiUser = {
  id: number;
  username: string;
  email: string;
  role: string;
  phone: string;
  location?: string;
  is_active: boolean;
  full_name?: string;
  cnic?: string;
  office_phone_1?: string;
  office_phone_2?: string;
  fax_no?: string;
  cell_no?: string;
  address?: string;
  designation?: string;
  employee_id?: string;
  posting_date?: string | null;
  collectorate?: string;
  effective_date?: string | null;
  we_boc_role?: string;
  date_joined?: string | null;
  last_login?: string | null;
  can_delete?: boolean;
  allowed_modules?: string[];
};

export function canDeleteUser(user: Pick<ApiUser, "role" | "can_delete">): boolean {
  if (user.can_delete === false) return false;
  if (user.role === "ADMIN" || user.role === "LOCATION_ADMIN") return false;
  return true;
}

export type UserProfilePayload = {
  full_name?: string;
  cnic?: string;
  office_phone_1?: string;
  office_phone_2?: string;
  fax_no?: string;
  cell_no?: string;
  address?: string;
  designation?: string;
  employee_id?: string;
  posting_date?: string | null;
  collectorate?: string;
  effective_date?: string | null;
  we_boc_role?: string;
};

export type CreateUserPayload = UserProfilePayload & {
  username: string;
  email: string;
  password: string;
  role: string;
  phone?: string;
  location?: string;
};

export type UpdateUserPayload = UserProfilePayload & {
  username?: string;
  email?: string;
  password?: string;
  role?: string;
  phone?: string;
  location?: string;
  is_active?: boolean;
  allowed_modules?: string[];
};

export { LOCATION_OPTIONS, locationLabel };

const USERS_ENDPOINT = `${API_BASE_URL}/api/users/`;

async function parseApiError(res: Response): Promise<string> {
  try {
    const j: unknown = await res.json();
    if (typeof j === "string") return j;
    if (j && typeof j === "object") {
      const obj = j as Record<string, unknown>;
      if ("detail" in obj) return String(obj.detail);
      return Object.entries(obj)
        .map(([k, v]) => {
          if (Array.isArray(v)) return `${k}: ${v.join(", ")}`;
          return `${k}: ${String(v)}`;
        })
        .join("; ");
    }
    return res.statusText;
  } catch {
    return res.statusText;
  }
}

function buildUserBody(payload: CreateUserPayload | UpdateUserPayload): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const keys: (keyof UserProfilePayload | keyof CreateUserPayload | "allowed_modules" | "is_active")[] = [
    "username",
    "email",
    "password",
    "role",
    "phone",
    "location",
    "is_active",
    "full_name",
    "cnic",
    "office_phone_1",
    "office_phone_2",
    "fax_no",
    "cell_no",
    "address",
    "designation",
    "employee_id",
    "posting_date",
    "collectorate",
    "effective_date",
    "we_boc_role",
    "allowed_modules",
  ];
  for (const key of keys) {
    if (key in payload && (payload as Record<string, unknown>)[key] !== undefined) {
      const val = (payload as Record<string, unknown>)[key];
      if (typeof val === "string") {
        body[key] = val.trim();
      } else {
        body[key] = val;
      }
    }
  }
  if ("posting_date" in body && body.posting_date === "") body.posting_date = null;
  if ("effective_date" in body && body.effective_date === "") body.effective_date = null;
  return body;
}

export function roleLabel(role: string): string {
  const found = ROLE_OPTIONS.find((r) => r.value === role);
  return found?.label ?? role.replace(/_/g, " ");
}

export const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Super Admin (All Locations)" },
  { value: "IT_SUPERADMIN", label: "IT Super Admin (Central Ops)" },
  { value: "LOCATION_ADMIN", label: "Location Administrator" },
  { value: "OPERATION_MANAGER", label: "Operation Manager" },
  { value: "INSPECTOR", label: "Inspector" },
  { value: "COLLECTOR", label: "Collector" },
  { value: "DEPUTY_COLLECTOR", label: "Deputy Collector" },
  { value: "ASSISTANT_COLLECTOR", label: "Assistant Collector" },
  { value: "RECEPTIONIST", label: "Receptionist" },
  { value: "GUARD", label: "Guard" },
  { value: "HR", label: "Human Resource" },
  { value: "WAREHOUSE_OFFICER", label: "Warehouse Officer" },
  { value: "WAREHOUSE_SUPERINTENDENT", label: "Warehouse Superintendent" },
  { value: "WAREHOUSE_IN_CHARGE", label: "Warehouse In-Charge" },
  { value: "EXAMINATION_OFFICER", label: "Examination Officer" },
  { value: "STOCK_CONTROLLER", label: "Stock Controller" },
  { value: "IT_ADMIN", label: "IT Administrator" },
  { value: "AUDITOR", label: "Auditor" },
  { value: "PRAL", label: "PRAL" },
  { value: "DETECTION_OFFICER", label: "Detection Officer" },
  { value: "FIR_OFFICER", label: "FIR Officer" },
  { value: "INVESTIGATION_OFFICER", label: "Investigation Officer" },
  { value: "SEIZING_OFFICER", label: "Seizing Officer" },
] as const;

export const COLLECTORATE_OPTIONS = [
  { value: "Peshawar", label: "Peshawar" },
  { value: "Kohat", label: "Kohat" },
  { value: "Nowshera", label: "Nowshera" },
  { value: "Mardan", label: "Mardan" },
  { value: "Bannu", label: "Bannu" },
  { value: "Dera Ismail Khan", label: "Dera Ismail Khan" },
  { value: "SWH Ratta Kulachi", label: "SWH Ratta Kulachi" },
  { value: "Swat", label: "Swat" },
  { value: "Abbottabad", label: "Abbottabad" },
  { value: "Mansehra", label: "Mansehra" },
  { value: "Other", label: "Other" },
] as const;

export const WEBOC_ROLE_OPTIONS = [
  { value: "System Administrator", label: "System Administrator" },
  { value: "Collector", label: "Collector" },
  { value: "Deputy Collector", label: "Deputy Collector" },
  { value: "Assistant Collector", label: "Assistant Collector" },
  { value: "Appraiser", label: "Appraiser" },
  { value: "Examiner", label: "Examiner" },
  { value: "Data Entry Operator", label: "Data Entry Operator" },
  { value: "Viewer", label: "Viewer" },
  { value: "Other", label: "Other" },
] as const;

export async function fetchUsers(): Promise<ApiUser[]> {
  if (!getStoredToken()) return [];

  const res = await fetch(USERS_ENDPOINT, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await parseApiError(res));
  const data: unknown = await res.json();
  const rows = Array.isArray(data) ? data : (data as { results?: unknown[] }).results;
  if (!Array.isArray(rows)) return [];
  return rows as ApiUser[];
}

/** Active users at the caller's location (any authenticated role). */
export async function fetchLocationColleagues(options?: {
  excludeSelf?: boolean;
}): Promise<ApiUser[]> {
  if (!getStoredToken()) return [];

  const q = new URLSearchParams();
  if (options?.excludeSelf === false) q.set("excludeSelf", "0");
  const qs = q.toString();
  const res = await fetch(`${USERS_ENDPOINT}colleagues/${qs ? `?${qs}` : ""}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as ApiUser[]) : [];
}

/** Current logged-in user profile (any authenticated role). */
export async function fetchCurrentUser(): Promise<ApiUser> {
  const res = await fetch(`${USERS_ENDPOINT}me/`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return (await res.json()) as ApiUser;
}

function isPlaceholderPhone(value: string | undefined | null): boolean {
  const digits = (value || "").replace(/\D/g, "");
  return !digits || /^0+$/.test(digits);
}

export function pickUserContact(
  user: Pick<ApiUser, "cell_no" | "phone" | "office_phone_1" | "office_phone_2">
): string {
  for (const candidate of [user.cell_no, user.office_phone_1, user.office_phone_2, user.phone]) {
    const v = (candidate || "").trim();
    if (v && !isPlaceholderPhone(v)) return v;
  }
  return "";
}

export async function fetchUserById(id: number): Promise<ApiUser> {
  const res = await fetch(`${USERS_ENDPOINT}${id}/`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await parseApiError(res));
  return (await res.json()) as ApiUser;
}

export async function createUser(payload: CreateUserPayload): Promise<ApiUser> {
  const body = buildUserBody(payload);
  body.username = payload.username.trim();
  body.email = payload.email.trim();
  body.password = payload.password;
  body.role = payload.role;
  if (!body.phone && body.cell_no) {
    body.phone = body.cell_no;
  } else if (!body.phone) {
    body.phone = "0000000000";
  }
  body.location = payload.location || "";

  const res = await fetch(USERS_ENDPOINT, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return (await res.json()) as ApiUser;
}

export async function deleteUser(id: number): Promise<void> {
  const res = await fetch(`${USERS_ENDPOINT}${id}/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
}

export function formatUserDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return value;
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<ApiUser> {
  const body = buildUserBody(payload);
  if (payload.password && payload.password.length >= 6) {
    body.password = payload.password;
  } else {
    delete body.password;
  }
  if (payload.phone !== undefined) {
    body.phone = payload.phone.trim() || (body.cell_no as string) || "0000000000";
  }

  const res = await fetch(`${USERS_ENDPOINT}${id}/`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return (await res.json()) as ApiUser;
}
