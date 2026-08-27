import { API_BASE_URL, getAuthHeaders, getAuthHeadersFormData, getStoredToken } from "@/lib/api";

/** Staff record as returned by the backend (list/detail). */
export type StaffRecord = {
  id: number;
  user: number | string | null;
  user_id?: number | string | null;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  father_name?: string | null;
  cnic: string;
  national_id?: string;
  date_of_birth?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  blood_group?: string | null;
  profile_image: string | null;
  staff_photos?: string[] | null;
  staff_photo_urls?: string[] | null;
  email?: string | null;
  phone_primary?: string | null;
  phone_alternate?: string | null;
  phone?: string | null; // Aliased for backward compatibility
  address?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  employee_id?: string | null;
  designation: string;
  department: string;
  branch_location?: string | null;
  manager?: string | null;
  employment_type?: string | null;
  joining_date?: string;
  probation_end_date?: string | null;
  work_shift_start?: string | null;
  work_shift_end?: string | null;
  job_status?: string | null;
  salary?: string | null;
  bank_account?: string | null;
  iban?: string | null;
  salary_type?: string | null;
  tax_id?: string | null;
  allowances?: string | null;
  role_access_level?: string | null;
  system_permissions?: string | null;
  emergency_contact?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_relationship?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_address?: string | null;
  resume_file?: string | null;
  joining_letter_file?: string | null;
  contract_file?: string | null;
  id_proof_file?: string | null;
  tax_form_file?: string | null;
  certificates_file?: string | null;
  background_check_status?: string | null;
  skills_competencies?: string | null;
  languages_known?: string | null;
  performance_rating?: string | null;
  last_appraisal_date?: string | null;
  leave_balance?: number | null;
  notes?: string | null;
  created_at?: string;
  // Custom fields from HEAD
  personal_number?: string | null;
  bps?: string | null;
  qualification?: string | null;
  current_posting?: string | null;
  collector_name?: string | null;
  transferred_from?: string | null;
  transferred_to?: string | null;
  role?: string | null;
  /** Source of the staff row (`database` = API / local store). */
  record_source?: "database";
  user_details?: {
    id: number;
    username: string;
    email: string;
    role: string;
    phone: string;
    is_active: boolean;
  } | null;
};

const STAFF_ENDPOINT = `${API_BASE_URL}/api/staff/`;

function useStaffRestApi(): boolean {
  return Boolean(getStoredToken());
}

async function parseApiError(res: Response): Promise<string> {
  try {
    const j: unknown = await res.json();
    if (typeof j === "string") return j;
    if (j && typeof j === "object" && "detail" in j) {
      const d = (j as { detail: unknown }).detail;
      if (Array.isArray(d)) return d.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(", ");
      return String(d);
    }
    if (j && typeof j === "object") {
      return Object.entries(j as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
        .join("; ");
    }
    return res.statusText;
  } catch {
    return res.statusText;
  }
}

/** True when profile_image is a user-uploaded or API path (not a placeholder URL). */
export function hasStaffProfileImage(profileImage: string | null | undefined): boolean {
  const p = (profileImage ?? "").trim();
  if (!p) return false;
  if (p.includes("pravatar.cc")) return false;
  return true;
}

/** Resolve staff photo URL for display; returns undefined when there is no real image. */
export function resolveStaffProfileImageUrl(
  profileImage: string | null | undefined
): string | undefined {
  if (!hasStaffProfileImage(profileImage)) return undefined;
  const p = profileImage!.trim();
  if (p.startsWith("data:")) return p;
  if (p.startsWith("http")) return p;
  return `${API_BASE_URL}${p.startsWith("/") ? "" : "/"}${p}`;
}

/** All staff photo URLs for gallery display (falls back to profile_image). */
export function resolveStaffPhotoGallery(staff: {
  staff_photo_urls?: string[] | null;
  staff_photos?: string[] | null;
  profile_image?: string | null;
}): string[] {
  const fromUrls = (staff.staff_photo_urls ?? []).filter(Boolean) as string[];
  if (fromUrls.length) return fromUrls;
  const fromPaths = (staff.staff_photos ?? [])
    .map((p) => resolveStaffProfileImageUrl(p))
    .filter((u): u is string => Boolean(u));
  if (fromPaths.length) return fromPaths;
  const primary = resolveStaffProfileImageUrl(staff.profile_image);
  return primary ? [primary] : [];
}

/** Extract stored media path from an absolute or relative staff photo URL. */
export function staffMediaPathFromUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return "";
  const base = API_BASE_URL.replace(/\/$/, "");
  let path = trimmed;
  if (path.startsWith(base)) path = path.slice(base.length);
  if (path.startsWith("/media/")) path = path.slice("/media/".length);
  if (path.startsWith("media/")) path = path.slice("media/".length);
  if (path.startsWith("/")) path = path.slice(1);
  return path.startsWith("staff/") ? path : "";
}

export function staffInitials(fullName: string | null | undefined): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return parts
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Map Django staff JSON to `StaffRecord` (list or detail). */
export function normalizeApiStaff(row: Record<string, unknown>): StaffRecord {
  const userDetails = row.user_details as StaffRecord["user_details"] | undefined;
  const rawProfile = row.profile_image;
  const profile_image =
    rawProfile === null || rawProfile === undefined
      ? null
      : hasStaffProfileImage(String(rawProfile))
        ? String(rawProfile)
        : null;
  const base = row as unknown as StaffRecord;
  const staff_photo_urls = Array.isArray(row.staff_photo_urls)
    ? (row.staff_photo_urls as string[]).filter(Boolean)
    : undefined;
  const staff_photos = Array.isArray(row.staff_photos)
    ? (row.staff_photos as string[]).filter(Boolean)
    : undefined;
  return {
    ...base,
    id: Number(row.id),
    profile_image,
    staff_photos: staff_photos ?? null,
    staff_photo_urls: staff_photo_urls ?? null,
    phone: base.phone ?? base.phone_primary ?? null,
    user: base.user ?? userDetails?.username ?? null,
    user_details: userDetails ?? null,
    current_posting: base.current_posting ?? base.branch_location ?? null,
    father_name: (row.father_name as string) ?? base.father_name ?? null,
    personal_number: (row.personal_number as string) ?? base.personal_number ?? null,
  };
}

// Local-only storage key (used when backend is not connected).
const LOCAL_STAFF_STORE_KEY = "tekeye.hr.staff.local.v1";

type LocalStaffRecord = {
  id: number;
  savedAt: string;
  payload: Record<string, unknown>;
  draft: string | null;
};

type StoredFile = {
  name: string;
  type: string;
  dataUrl: string;
};

type AddStaffDraft = {
  v: 1;
  savedAt: string;
  employeeCategory: "new" | "existing";
  currentStep: number;
  form: Record<string, unknown>;
  staffPhotos: (StoredFile | null)[];
  cnicFront: StoredFile | null;
  cnicBack: StoredFile | null;
  appointmentLetter: StoredFile | null;
  additionalDocument: StoredFile | null;
};

function getDraftProfileImageDataUrl(item: LocalStaffRecord): string | null {
  if (!item.draft) return null;
  try {
    const parsed = JSON.parse(item.draft) as AddStaffDraft;
    const first = parsed?.staffPhotos?.find((x) => x && typeof x.dataUrl === "string") as StoredFile | undefined;
    if (first?.dataUrl && first.dataUrl.startsWith("data:image/")) return first.dataUrl;
  } catch {
    // ignore
  }
  return null;
}

function readLocalStaffStore(): LocalStaffRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STAFF_STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as LocalStaffRecord[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalStaffStore(items: LocalStaffRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_STAFF_STORE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function localToStaffRecord(item: LocalStaffRecord): StaffRecord {
  const p = item.payload ?? {};
  const s = p as unknown as Partial<CreateStaffPayload> & Record<string, unknown>;
  const profileFromDraft = getDraftProfileImageDataUrl(item);

  return {
    id: item.id,
    user: (s.login_username as string) ?? (s.username as string) ?? (s.personal_number as string) ?? null,
    full_name: String(s.full_name ?? ""),
    father_name: (s.father_name as string) ?? null,
    cnic: String(s.cnic ?? ""),
    date_of_birth: (s.date_of_birth as string) ?? null,
    gender: (s.gender as string) ?? null,
    // In local-only mode, we store the image inside the saved draft as a data URL.
    profile_image: profileFromDraft ?? null,
    email: (s.email as string) ?? null,
    phone: (s.phone as string) ?? null,
    address: (s.address as string) ?? null,
    designation: String(s.designation ?? ""),
    department: String(s.department ?? ""),
    employment_type: (s.employment_type as string) ?? null,
    joining_date: (s.joining_date as string) ?? undefined,
    personal_number: (s.personal_number as string) ?? `PN${Math.floor(100000 + Math.random() * 900000)}`,
    bps: (s.bps as string) ?? null,
    qualification: (s.qualification as string) ?? null,
    current_posting: (s.current_posting as string) ?? null,
    collector_name: (s.collector_name as string) ?? null,
    transferred_from: (s.transferred_from as string) ?? null,
    transferred_to: (s.transferred_to as string) ?? null,
    role: (s.role as string) ?? null,
    emergency_contact: (s.emergency_contact as string) ?? null,
    emergency_contact_name: (s.emergency_contact_name as string) ?? null,
    emergency_contact_relationship: (s.emergency_contact_relationship as string) ?? null,
    emergency_contact_phone: (s.emergency_contact_phone as string) ?? (s.emergency_contact as string) ?? null,
    emergency_contact_address: (s.emergency_contact_address as string) ?? null,
    created_at: item.savedAt,
  } as StaffRecord;
}

// sample data used when there are no staff records in localStorage
const DEFAULT_STAFF: StaffRecord[] = [
   {
    id: 1,
    user: "499948",
    personal_number: "499948",
    full_name: "Ali Khan",
    cnic: "12345-6789012-3",
    profile_image: null,
    designation: "Inspector",
    department: "Enforcement",
    phone: "0301-1234567",
    bank_account: "PK12ABCD1234567890123456",
    employment_type: "Permanent",
    joining_date: "2015-03-15",
    bps: "16",
    qualification: "B.A. Criminology",
    current_posting: "AC ASD, Nowshera & Mardan",
    collector_name: "Ahmed Raza",
    role: "Field Operations",
    emergency_contact: true,
    emergency_contact_name: "Salma Khan",
    emergency_contact_relationship: "Wife",
    emergency_contact_phone: "0300-1112233",
    emergency_contact_address: "House #45, Peshawar",
    transferred_from: "HQ (Peshawar)",
    transferred_to: "AC ASD, Nowshera",
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    user: "285591",
    personal_number: "285591",
    full_name: "Sara Ahmed",
    cnic: "23456-7890123-4",
    profile_image: null,
    designation: "Assistant Collector",
    department: "Intelligence",
    phone: "0302-2345678",
    bank_account: "PK34EFGH2345678901234567",
    employment_type: "Contract",
    joining_date: "2018-07-20",
    bps: "17",
    qualification: "M.Sc. Security Studies",
    current_posting: "AC (HQ-I)",
    collector_name: "Bilal Tariq",
    role: "Data Analysis",
    emergency_contact: true,
    emergency_contact_name: "Ayesha Ahmed",
    emergency_contact_relationship: "Mother",
    emergency_contact_phone: "0301-4455667",
    emergency_contact_address: "Street 12, Lahore",
    transferred_from: "AC (HQ-I)",
    transferred_to: "ASD, Kohat",
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    user: "707664",
    personal_number: "707664",
    full_name: "Mustafa Ali",
    cnic: "34567-8901234-5",
    profile_image: null,
    designation: "Deputy Collector",
    department: "Legal",
    phone: "0303-3456789",
    bank_account: "PK56IJKL3456789012345678",
    employment_type: "Permanent",
    joining_date: "2012-01-10",
    bps: "18",
    qualification: "LL.B",
    current_posting: "AC ASD, D.I. Khan-I & II",
    collector_name: "Hassan Javed",
    role: "Legal Affairs",
    emergency_contact: true,
    emergency_contact_name: "Nadia Ali",
    emergency_contact_relationship: "Sister",
    emergency_contact_phone: "0302-5566778",
    emergency_contact_address: "Block B, Karachi",
    transferred_from: "SWH, Peshawar (HQ)",
    transferred_to: "AC ASD, D.I. Khan-I",
    created_at: new Date().toISOString()
  },
  {
    id: 4,
    user: "878685",
    personal_number: "878685",
    full_name: "Fatima Noor",
    cnic: "45678-9012345-6",
    profile_image: null,
    designation: "Inspector",
    department: "Human Resources",
    phone: "0304-4567890",
    bank_account: "PK78MNOP4567890123456789",
    employment_type: "Permanent",
    joining_date: "2016-05-05",
    bps: "16",
    qualification: "MBA HR",
    current_posting: "AC ASD, Hazara",
    collector_name: "Shahbaz Khan",
    role: "HR Operations",
    emergency_contact: true,
    emergency_contact_name: "Zoya Noor",
    emergency_contact_relationship: "Mother",
    emergency_contact_phone: "0303-6677889",
    emergency_contact_address: "Street 5, Islamabad",
    transferred_from: "DC ASD, Peshawar/Kohat & Bannu",
    transferred_to: "AC ASD, Hazara",
    created_at: new Date().toISOString()
  },
  {
    id: 5,
    user: "691102",
    personal_number: "691102",
    full_name: "Rao Sheikh",
    cnic: "56789-0123456-7",
    profile_image: null,
    designation: "Assistant Inspector",
    department: "Operations",
    phone: "0305-5678901",
    bank_account: "PK90QRST5678901234567890",
    employment_type: "Contract",
    joining_date: "2019-09-12",
    bps: "15",
    qualification: "B.Sc. Public Administration",
    current_posting: "ASD, D.I. Khan",
    collector_name: "Asif Iqbal",
    role: "Operational Support",
    emergency_contact: true,
    emergency_contact_name: "Sadia Rao",
    emergency_contact_relationship: "Wife",
    emergency_contact_phone: "0304-7788990",
    emergency_contact_address: "House 10, Multan",
    transferred_from: "ASD, Hazara",
    transferred_to: "ASD, D.I. Khan",
    created_at: new Date().toISOString()
  }
];

const LOCAL_STAFF_STORE_VERSION = 2; // bump when default data format changes

export async function fetchStaff(): Promise<StaffRecord[]> {
  if (useStaffRestApi()) {
    const res = await fetch(STAFF_ENDPOINT, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await parseApiError(res));
    const data: unknown = await res.json();
    const rows = Array.isArray(data) ? data : (data as { results?: unknown[] }).results;
    if (!Array.isArray(rows)) return [];
    return rows.map((x) => normalizeApiStaff(x as Record<string, unknown>));
  }

  let storedItems = readLocalStaffStore();

  const initialCheck =
    storedItems.length === 0 ||
    storedItems.some((it) => {
      try {
        const p = it.payload as { personal_number?: string };
        return !p.personal_number || (typeof p.personal_number === "string" && !p.personal_number.startsWith("PN"));
      } catch {
        return true;
      }
    });

  if (initialCheck) {
    const items = DEFAULT_STAFF.map((s) => ({
      id: s.id,
      savedAt: s.created_at || new Date().toISOString(),
      payload: s,
      draft: null,
      v: LOCAL_STAFF_STORE_VERSION,
    }));
    writeLocalStaffStore(items as LocalStaffRecord[]);
    return DEFAULT_STAFF;
  }

  let updated = false;
  storedItems = storedItems.map((it) => {
    const rec = localToStaffRecord(it);
    const def = DEFAULT_STAFF.find((d) => d.id === rec.id);
    if (!def) return it;

    const needsMerge =
      (!rec.phone || rec.phone === "—") ||
      (!rec.transferred_from || rec.transferred_from === "—") ||
      (!rec.transferred_to || rec.transferred_to === "—");
    if (!needsMerge) return it;

    updated = true;
    const mergedPayload = {
      ...(it.payload ?? {}),
      phone: def.phone,
      transferred_from: def.transferred_from,
      transferred_to: def.transferred_to,
    } as Record<string, unknown>;
    return { ...it, payload: mergedPayload };
  });

  if (updated) {
    writeLocalStaffStore(storedItems);
  }

  return storedItems.map(localToStaffRecord);
}

/** Employee directory — database / local staff only. */
export async function fetchEmployeesDirectory(): Promise<StaffRecord[]> {
  const apiStaff = await fetchStaff();
  return apiStaff.map((s) => ({
    ...s,
    record_source: s.record_source ?? ("database" as const),
  }));
}

export async function fetchStaffById(id: number): Promise<StaffRecord> {
  if (useStaffRestApi()) {
    const res = await fetch(`${STAFF_ENDPOINT}${id}/`, { headers: getAuthHeaders() });
    if (res.status === 404) throw new Error("Staff not found");
    if (!res.ok) throw new Error(await parseApiError(res));
    const data = (await res.json()) as Record<string, unknown>;
    return normalizeApiStaff(data);
  }

  const items = readLocalStaffStore();
  const found = items.find((x) => x.id === id);
  if (!found) throw new Error("Staff not found");
  return localToStaffRecord(found);
}

/** URL for downloading a staff document (requires auth when used via fetch). */
export function getStaffDocumentDownloadUrl(staffId: number, field: string): string {
  return `${STAFF_ENDPOINT}${staffId}/document/${field}/`;
}

/** Trigger download of a staff document (uses auth). */
export async function downloadStaffDocument(
  staffId: number,
  field: string,
  fileName: string
): Promise<void> {
  if (useStaffRestApi()) {
    const res = await fetch(getStaffDocumentDownloadUrl(staffId, field), {
      headers: getAuthHeadersFormData(),
    });
    if (!res.ok) throw new Error(await parseApiError(res));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "document";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }
  throw new Error("Document download is not available in local-only mode.");
}

/** Full HR template payload accepted by backend. */
export type CreateStaffPayload = {
  // Common fields
  full_name: string;
  first_name?: string;
  last_name?: string;
  father_name?: string;
  email?: string;
  phone?: string;
  phone_primary?: string;
  phone_alternate?: string;
  cnic: string;
  national_id?: string;
  address: string;
  street_address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  date_of_birth: string;
  gender?: string;
  marital_status?: string;
  blood_group?: string;
  
  // Employment
  employee_id?: string;
  personal_number?: string;
  designation: string;
  department: string;
  joining_date: string;
  date_of_joining?: string;
  employment_type?: string;
  job_status?: string;
  branch_location?: string;
  manager?: string;
  bps?: string;
  qualification?: string | string[];
  current_posting?: string;
  collector_name?: string;
  transferred_from?: string;
  transferred_to?: string;
  
  // Account/Auth
  username?: string;
  login_username?: string;
  password?: string;
  role: string;
  role_access_level?: string;
  system_permissions?: string;
  has_login?: boolean;

  // Financial
  salary?: string;
  salary_type?: string;
  bank_account?: string;
  iban?: string;
  tax_id?: string;
  allowances?: string;

  // Emergency & Misc
  emergency_contact: string;
  emergency_contact_name?: string;
  emergency_contact_relationship?: string;
  emergency_contact_phone?: string;
  emergency_contact_address?: string;
  notes?: string;
  leave_balance?: number | string;
  performance_rating?: string;
  last_appraisal_date?: string;
  probation_end_date?: string;
  work_shift_start?: string;
  work_shift_end?: string;
  background_check_status?: string;
  skills_competencies?: string;
  languages_known?: string;

  // Files
  profile_image?: File | null;
  staff_photos?: File[] | null;
  staff_photos_keep?: string[] | null;
  resume_file?: File | null;
  joining_letter_file?: File | null;
  contract_file?: File | null;
  id_proof_file?: File | null;
  tax_form_file?: File | null;
  certificates_file?: File | null;
  cnic_front?: File | null;
  cnic_back?: File | null;
  appointment_letter?: File | null;
  additional_document?: File | null;
};

/** Resolve a staff media path for display in forms. */
export function resolveStaffMediaUrl(path: string | null | undefined): string | undefined {
  if (!path?.trim()) return undefined;
  const p = path.trim();
  if (p.startsWith("data:") || p.startsWith("http")) return p;
  return `${API_BASE_URL}${p.startsWith("/") ? "" : "/"}${p}`;
}

const STAFF_FILE_FIELD_MAP: Record<string, string> = {
  cnic_front: "id_proof_file",
  cnic_back: "certificates_file",
  appointment_letter: "joining_letter_file",
  additional_document: "contract_file",
};

function buildStaffMultipartFormData(
  payload: CreateStaffPayload,
  options?: { omitReadonly?: boolean },
): FormData {
  const fd = new FormData();
  const r = payload as Record<string, unknown>;
  const skip = new Set([
    "has_login",
    "login_username",
    "password",
    "username",
    "role",
    "staff_photos",
    "staff_photo_files",
    "staff_photos_keep",
    "cnic_front",
    "cnic_back",
    "appointment_letter",
    "additional_document",
    "profile_image",
  ]);
  if (options?.omitReadonly) {
    skip.add("cnic");
    skip.add("national_id");
  }

  const fullName = String(r.full_name ?? "").trim();
  if (fullName) fd.append("full_name", fullName);

  const personalNumber = String(r.personal_number ?? "").trim();
  if (personalNumber) fd.append("personal_number", personalNumber);

  const fatherName = String(r.father_name ?? "").trim();
  if (fatherName) fd.append("father_name", fatherName);

  const phonePrimary = String(r.phone_primary ?? r.phone ?? "").trim();
  if (phonePrimary) fd.append("phone_primary", phonePrimary);

  const national = String(r.national_id ?? r.cnic ?? "").trim();
  if (national && !options?.omitReadonly) {
    fd.append("national_id", national);
    if (r.cnic) fd.append("cnic", String(r.cnic).trim());
  }

  for (const key of Object.keys(r)) {
    if (skip.has(key)) continue;
    const v = r[key];
    if (v === undefined || v === null) continue;
    if (v instanceof File) {
      fd.append(key, v);
      continue;
    }
    if (Array.isArray(v)) continue;
    if (typeof v === "object") continue;
    if (key === "phone_primary" || key === "phone" || key === "cnic" || key === "national_id" || key === "full_name" || key === "personal_number" || key === "father_name") continue;
    const s = String(v).trim();
    if (s === "") continue;
    fd.append(key, s);
  }

  const lb = r.leave_balance;
  if (lb !== undefined && lb !== null && String(lb).trim() !== "") {
    fd.append("leave_balance", String(lb));
  }

  const explicitProfile = r.profile_image instanceof File ? r.profile_image : null;
  const photos = r.staff_photos;
  const photoFiles = Array.isArray(photos) ? photos.filter((f): f is File => f instanceof File) : [];
  if (photoFiles.length > 0) {
    for (const file of photoFiles) {
      fd.append("staff_photo_files", file);
    }
  } else if (explicitProfile instanceof File) {
    fd.append("profile_image", explicitProfile);
  }

  const keep = r.staff_photos_keep;
  if (Array.isArray(keep) && keep.length > 0) {
    fd.append("staff_photos_keep", JSON.stringify(keep.filter(Boolean)));
  }

  for (const [sourceKey, targetKey] of Object.entries(STAFF_FILE_FIELD_MAP)) {
    const file = r[sourceKey];
    if (file instanceof File) {
      fd.append(targetKey, file);
    }
  }

  return fd;
}

export async function createStaff(payload: CreateStaffPayload): Promise<StaffRecord> {
  if (useStaffRestApi()) {
    const fd = buildStaffMultipartFormData(payload);
    const res = await fetch(STAFF_ENDPOINT, {
      method: "POST",
      headers: getAuthHeadersFormData(),
      body: fd,
    });
    if (!res.ok) throw new Error(await parseApiError(res));
    const created = normalizeApiStaff((await res.json()) as Record<string, unknown>);

    if (payload.has_login && payload.password && payload.email) {
      const username =
        String(payload.login_username || payload.username || payload.email.split("@")[0] || `staff_${created.id}`).trim();
      const phone =
        String(payload.phone || payload.phone_primary || payload.emergency_contact_phone || "0000000000").trim();
      const cu = await fetch(`${STAFF_ENDPOINT}${created.id}/create_user/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username,
          email: payload.email.trim(),
          password: payload.password,
          role: payload.role || "RECEPTIONIST",
          phone: phone || "0000000000",
        }),
      });
      if (!cu.ok) {
        throw new Error(`Employee saved but login was not created: ${await parseApiError(cu)}`);
      }
    }

    return created;
  }

  const items = readLocalStaffStore();
  const item: LocalStaffRecord = {
    id: Date.now(),
    savedAt: new Date().toISOString(),
    payload: payload as unknown as Record<string, unknown>,
    draft: null,
  };
  writeLocalStaffStore([item, ...items]);
  return localToStaffRecord(item);
}

/** Update staff (PATCH). Supports partial payload and file fields via FormData. */
export async function updateStaff(
  id: number,
  payload: Partial<CreateStaffPayload>
): Promise<StaffRecord> {
  if (useStaffRestApi()) {
    const hasFile = Object.values(payload).some((v) => v instanceof File);
    const hasPhotoKeep = Array.isArray(payload.staff_photos_keep) && payload.staff_photos_keep.length > 0;
    const hasNewPhotos = Array.isArray(payload.staff_photos) && payload.staff_photos.some((f) => f instanceof File);
    if (hasFile || hasPhotoKeep || hasNewPhotos) {
      const fd = buildStaffMultipartFormData(payload as CreateStaffPayload, { omitReadonly: true });
      const res = await fetch(`${STAFF_ENDPOINT}${id}/`, {
        method: "PATCH",
        headers: getAuthHeadersFormData(),
        body: fd,
      });
      if (res.status === 404) throw new Error("Staff not found");
      if (!res.ok) throw new Error(await parseApiError(res));
      return normalizeApiStaff((await res.json()) as Record<string, unknown>);
    }

    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (v === undefined) continue;
      if (v instanceof File) continue;
      body[k] = v;
    }
    if (payload.phone && !payload.phone_primary) {
      body.phone_primary = payload.phone;
    }
    const res = await fetch(`${STAFF_ENDPOINT}${id}/`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    if (res.status === 404) throw new Error("Staff not found");
    if (!res.ok) throw new Error(await parseApiError(res));
    return normalizeApiStaff((await res.json()) as Record<string, unknown>);
  }

  const items = readLocalStaffStore();
  const idx = items.findIndex((x) => x.id === id);
  if (idx < 0) throw new Error("Staff not found");
  const prev = items[idx];
  const next: LocalStaffRecord = {
    ...prev,
    payload: { ...(prev.payload ?? {}), ...(payload as unknown as Record<string, unknown>) },
  };
  const updated = [...items];
  updated[idx] = next;
  writeLocalStaffStore(updated);
  return localToStaffRecord(next);
}

/** Delete staff (hard delete). */
export async function deleteStaff(id: number): Promise<void> {
  if (useStaffRestApi()) {
    const res = await fetch(`${STAFF_ENDPOINT}${id}/`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (res.status === 404) throw new Error("Staff not found");
    if (!res.ok) throw new Error(await parseApiError(res));
    return;
  }

  const items = readLocalStaffStore();
  const next = items.filter((x) => x.id !== id);
  if (next.length === items.length) throw new Error("Staff not found");
  writeLocalStaffStore(next);
}
