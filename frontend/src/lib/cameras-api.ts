import { API_BASE_URL, getAuthHeaders, getStoredToken } from "@/lib/api";

export type CameraPurpose =
  | "general_objects"
  | "custom_objects"
  | "smoke_fire"
  | "weapon"
  | "face_recognition"
  | "attendance"
  | "anpr"
  // Legacy (normalized server-side)
  | "object_detection"
  | "surveillance"
  | "zone_monitoring"
  | "thermal";

/** All selectable AI models — default when creating a camera. */
export const ALL_CAMERA_PURPOSES: CameraPurpose[] = [
  "general_objects",
  "custom_objects",
  "smoke_fire",
  "weapon",
  "face_recognition",
  "attendance",
  "anpr",
];

export type NvrBrand = "hikvision" | "dahua" | "uniview" | "generic";

export type SiteRecord = {
  id: number;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  nvr_count: number;
  camera_count: number;
  created_at?: string;
  updated_at?: string;
};

export type SiteWritePayload = {
  code: string;
  name: string;
  description?: string;
  is_active?: boolean;
};

export type NvrRecord = {
  id: number;
  site: number;
  site_code: string;
  site_name: string;
  name: string;
  ip_address: string;
  port: number;
  username: string;
  password_set: boolean;
  brand: NvrBrand;
  brand_label: string;
  stream_path_template: string;
  is_active: boolean;
  camera_count: number;
  created_at?: string;
  updated_at?: string;
};

export type NvrWritePayload = {
  site: number;
  name: string;
  ip_address: string;
  port?: number;
  username?: string;
  password?: string;
  brand?: NvrBrand;
  stream_path_template?: string;
  is_active?: boolean;
};

export type CameraRecord = {
  id: number;
  code: string;
  name: string;
  nvr: number;
  channel: number;
  channel_label: string;
  site_code: string;
  site_name: string;
  nvr_name: string;
  nvr_ip: string;
  location: string;
  zone: string;
  purpose: CameraPurpose;
  purposes: CameraPurpose[];
  purpose_label: string;
  purpose_labels?: string[];
  status: string;
  is_active: boolean;
  ml_enabled: boolean;
  is_rtsp: boolean;
  ml_stream_key?: string;
  ml_live_stream_url?: string;
  raw_stream_url?: string;
  /** @deprecated Use ml_live_stream_url — Django proxy removed */
  stream_path?: string;
  /** @deprecated Use ml_live_stream_url */
  ml_live_stream_path?: string;
  created_at?: string;
  updated_at?: string;
};

export type CameraWritePayload = {
  name: string;
  nvr: number;
  channel: number;
  zone?: string;
  purpose?: CameraPurpose;
  purposes?: CameraPurpose[];
  status?: string;
  is_active?: boolean;
};

export type CameraPurposeOption = { value: CameraPurpose; label: string };
export type NvrBrandOption = { value: NvrBrand; label: string };

export type ClipStatus = "pending" | "recording" | "ready" | "failed" | "skipped" | "";

export type DetectionEvent = {
  id: number;
  camera: number;
  camera_code: string;
  name?: string;
  camera_name?: string;
  site_code?: string;
  site_name?: string;
  nvr_name?: string;
  channel?: number;
  zone?: string;
  class_name: string;
  label: string;
  employee_name?: string;
  personal_number?: string;
  local_track_id?: number | null;
  global_track_id?: number | null;
  person_identity_id?: number | null;
  person_qr?: string;
  track_event?: string;
  confidence: number;
  bbox: [number, number, number, number];
  is_alert: boolean;
  clip_status?: ClipStatus;
  clip_url?: string;
  created_at: string;
};

export type DetectionSummary = {
  detections_today: number;
  classes_tracked: number;
  alerts_today: number;
};

export type DetectionEventsPage = {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  /** Snapshot tip — reuse on page > 1 so new inserts don't shift offsets. */
  as_of?: string | null;
  as_of_id?: number | null;
  results: DetectionEvent[];
};

export type DetectionEventsQuery = {
  page?: number;
  page_size?: number;
  camera?: number;
  site?: string;
  site_id?: number;
  nvr?: number;
  channel?: number;
  zone?: string;
  date_from?: string;
  date_to?: string;
  q?: string;
  is_alert?: boolean;
  class_name?: string;
  vehicle_only?: boolean;
  as_of?: string;
  as_of_id?: number;
};

export type StreamCameraMeta = {
  id: number;
  code: string;
  label: string;
  location: string;
  site_label: string;
  site_code: string;
  nvr_name: string;
  channel: number;
  purpose: CameraPurpose;
  purpose_label: string;
  ml_enabled: boolean;
  is_rtsp: boolean;
  ml_stream_key?: string;
  ml_live_stream_url?: string;
  raw_stream_url?: string;
  /** @deprecated Use ml_live_stream_url */
  stream_path?: string;
  /** @deprecated Use ml_live_stream_url */
  ml_live_stream_path?: string;
};

const API = `${API_BASE_URL}/api`;

export function getMlLiveMjpegUrl(
  camera: Pick<CameraRecord, "id" | "ml_stream_key" | "ml_live_stream_url" | "ml_live_stream_path">
): string | null {
  return getMlLiveMultipartUrl(camera)
}

/** Continuous multipart MJPEG — one connection, smooth browser playback. */
export function getMlLiveMultipartUrl(
  camera: Pick<
    CameraRecord,
    "id" | "ml_stream_key" | "ml_live_stream_url" | "ml_live_stream_path" | "purpose" | "purposes"
  >
): string | null {
  const direct = (camera.ml_live_stream_url || "").trim()
  const streamKey = (camera.ml_stream_key || "").trim()
  const route = streamKey || `cam-${camera.id}`
  let url = ""
  if (direct.startsWith("/ml/")) {
    if (direct.endsWith("/jpeg")) url = `${direct.slice(0, -"/jpeg".length)}/mjpeg`
    else if (direct.includes("/jpeg")) url = direct.replace(/\/jpeg(\/|$)/, "/mjpeg$1")
    else if (direct.includes("/mjpeg")) url = direct
    else url = direct
  } else {
    url = `/ml/live/cam/${encodeURIComponent(route)}/mjpeg`
  }

  // Always attach purposes so ML gates models even if Django URL is stale
  const purposeList = (camera.purposes?.length
    ? camera.purposes
    : camera.purpose
      ? [camera.purpose]
      : []
  ).map((p) => String(p).trim()).filter(Boolean)
  if (purposeList.length && !/[?&]purposes=/.test(url)) {
    const params = new URLSearchParams()
    params.set("purposes", purposeList.join(","))
    if (camera.purpose) params.set("purpose", camera.purpose)
    url += (url.includes("?") ? "&" : "?") + params.toString()
  }
  return url
}

export function getRawMjpegUrl(
  camera: Pick<CameraRecord, "id" | "ml_stream_key" | "raw_stream_url">
): string | null {
  const direct = (camera.raw_stream_url || "").trim();
  if (direct) return direct;
  return null;
}

/** @deprecated Django MJPEG proxy removed — use getMlLiveMjpegUrl or getRawMjpegUrl */
export function getCameraMjpegUrl(streamPath: string): string {
  const base = API_BASE_URL.replace(/\/$/, "");
  const path = streamPath.startsWith("/") ? streamPath : `/${streamPath}`;
  const token = getStoredToken();
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${base}${path}${qs}`;
}

function parseList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as { results?: T[] }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

function formatApiError(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null) {
    if ("detail" in err && typeof (err as { detail: unknown }).detail === "string") {
      return (err as { detail: string }).detail;
    }
    return Object.entries(err)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : String(v)}`)
      .join("; ");
  }
  return fallback;
}

export function getPreviewMjpegUrl(nvrId: number, channel: number): string {
  const base = API_BASE_URL.replace(/\/$/, "");
  const token = getStoredToken();
  const params = new URLSearchParams({ nvr_id: String(nvrId), channel: String(channel) });
  if (token) params.set("token", token);
  return `${base}/api/cameras/preview/mjpeg/?${params}`;
}

/** Resolve a Django media path or absolute URL against the API host. */
export function resolveMediaUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  const base = API_BASE_URL.replace(/\/$/, "");
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return `${base}${parsed.pathname}${parsed.search}`;
    } catch {
      return trimmed;
    }
  }
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${base}${path}`;   
}
    
// ——— Sites ———

export async function fetchSites(): Promise<SiteRecord[]> {
  const res = await fetch(`${API}/sites/`, { headers: getAuthHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load sites (${res.status})`);
  return parseList<SiteRecord>(await res.json());
}

export async function createSite(payload: SiteWritePayload): Promise<SiteRecord> {
  const res = await fetch(`${API}/sites/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ is_active: true, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(data, "Failed to create site"));
  return data;
}

export async function updateSite(id: number, payload: Partial<SiteWritePayload>): Promise<SiteRecord> {
  const res = await fetch(`${API}/sites/${id}/`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update site (${res.status})`);
  return res.json();
}

export async function deleteSite(id: number): Promise<void> {
  const res = await fetch(`${API}/sites/${id}/`, { method: "DELETE", headers: getAuthHeaders() });
  if (!res.ok && res.status !== 204) throw new Error(`Failed to delete site (${res.status})`);
}

// ——— NVRs ———

export async function fetchNvrs(siteId?: number): Promise<NvrRecord[]> {
  const qs = siteId != null ? `?site=${siteId}` : "";
  const res = await fetch(`${API}/nvrs/${qs}`, { headers: getAuthHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load NVRs (${res.status})`);
  return parseList<NvrRecord>(await res.json());
}

export async function fetchNvrBrands(): Promise<NvrBrandOption[]> {
  const res = await fetch(`${API}/nvrs/brands/`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to load NVR brands");
  return res.json();
}

export async function createNvr(payload: NvrWritePayload): Promise<NvrRecord> {
  const res = await fetch(`${API}/nvrs/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ port: 554, username: "admin", brand: "hikvision", is_active: true, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(data, "Failed to create NVR"));
  return data;
}

export async function updateNvr(id: number, payload: Partial<NvrWritePayload>): Promise<NvrRecord> {
  const res = await fetch(`${API}/nvrs/${id}/`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update NVR (${res.status})`);
  return res.json();
}

export async function deleteNvr(id: number): Promise<void> {
  const res = await fetch(`${API}/nvrs/${id}/`, { method: "DELETE", headers: getAuthHeaders() });
  if (!res.ok && res.status !== 204) throw new Error(`Failed to delete NVR (${res.status})`);
}

export async function bulkCreateCameras(
  nvrId: number,
  payload: {
    channel_count: number
    name_prefix?: string
    zone?: string
    purpose?: CameraPurpose
    purposes?: CameraPurpose[]
  }
): Promise<{ created: CameraRecord[]; skipped_channels: number[]; count: number }> {
  const res = await fetch(`${API}/nvrs/${nvrId}/bulk-cameras/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(data, "Bulk camera creation failed"));
  return data;
}

// ——— Cameras ———

export async function fetchCamera(id: number): Promise<CameraRecord> {
  const res = await fetch(`${API}/cameras/${id}/`, { headers: getAuthHeaders(), cache: "no-store" });
  if (res.status === 404) throw new Error("Camera not found");
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error(`Failed to load camera (${res.status})`);
  return res.json();
}

export async function fetchCameras(params?: { nvr?: number; location?: string }): Promise<CameraRecord[]> {
  const search = new URLSearchParams();
  if (params?.nvr != null) search.set("nvr", String(params.nvr));
  if (params?.location) search.set("location", params.location);
  const qs = search.toString() ? `?${search}` : "";
  const res = await fetch(`${API}/cameras/${qs}`, { headers: getAuthHeaders(), cache: "no-store" });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error(`Failed to load cameras (${res.status})`);
  return parseList<CameraRecord>(await res.json());
}

export async function fetchCameraPurposes(): Promise<CameraPurposeOption[]> {
  const res = await fetch(`${API}/cameras/purposes/`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to load camera purposes");
  return res.json();
}

export async function createCamera(payload: CameraWritePayload): Promise<CameraRecord> {
  const res = await fetch(`${API}/cameras/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      status: "Online",
      is_active: true,
      zone: "",
      purpose: ALL_CAMERA_PURPOSES[0],
      purposes: [...ALL_CAMERA_PURPOSES],
      ...payload,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(data, "Failed to create camera"));
  return data;
}

export async function updateCamera(id: number, payload: Partial<CameraWritePayload>): Promise<CameraRecord> {
  const res = await fetch(`${API}/cameras/${id}/`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update camera (${res.status})`);
  return res.json();
}

export async function deleteCamera(id: number): Promise<void> {
  const res = await fetch(`${API}/cameras/${id}/`, { method: "DELETE", headers: getAuthHeaders() });
  if (!res.ok && res.status !== 204) throw new Error(`Failed to delete camera (${res.status})`);
}

export async function fetchMlLiveDetections(cameraId: number): Promise<{
  detections: Array<{
    class_name: string;
    label: string;
    confidence: number;
    bbox: [number, number, number, number];
    alert?: boolean;
    track_id?: number | null;
    person_qr?: string | null;
  }>;
  count: number;
  frame_width?: number;
  frame_height?: number;
  display_width?: number;
  display_height?: number;
}> {
  const res = await fetch(`${API}/cameras/${cameraId}/ml-live/detections/?save=false`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(formatApiError(err, "ML live detections failed"));
  }
  return res.json();
}

export async function detectOnCamera(cameraId: number): Promise<{
  detections: Array<{
    class_name: string;
    label: string;
    confidence: number;
    bbox: [number, number, number, number];
    alert?: boolean;
  }>;
  count: number;
}> {
  const res = await fetch(`${API}/cameras/${cameraId}/detect/`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(data, `Detection failed (${res.status})`));
  return data;
}

export async function fetchDetectionEventsPage(
  query: DetectionEventsQuery = {}
): Promise<DetectionEventsPage> {
  const params = new URLSearchParams();
  if (query.page != null) params.set("page", String(query.page));
  if (query.page_size != null) params.set("page_size", String(query.page_size));
  if (query.camera != null) params.set("camera", String(query.camera));
  if (query.site) params.set("site", query.site);
  if (query.site_id != null) params.set("site_id", String(query.site_id));
  if (query.nvr != null) params.set("nvr", String(query.nvr));
  if (query.channel != null) params.set("channel", String(query.channel));
  if (query.zone) params.set("zone", query.zone);
  if (query.date_from) params.set("date_from", query.date_from);
  if (query.date_to) params.set("date_to", query.date_to);
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.class_name?.trim()) params.set("class_name", query.class_name.trim());
  if (query.vehicle_only) params.set("vehicle_only", "true");
  if (query.is_alert === true) params.set("is_alert", "true");
  if (query.is_alert === false) params.set("is_alert", "false");
  if (query.as_of) params.set("as_of", query.as_of);
  if (query.as_of_id != null) params.set("as_of_id", String(query.as_of_id));

  const res = await fetch(`${API}/cameras/detection-events/?${params}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load detection events (${res.status})`);
  return res.json();
}

/** @deprecated Use fetchDetectionEventsPage for server-side pagination and filters. */
export async function fetchDetectionEvents(limit = 50, cameraId?: number): Promise<DetectionEvent[]> {
  const page = await fetchDetectionEventsPage({
    page: 1,
    page_size: limit,
    camera: cameraId,
  });
  return page.results;
}

export async function fetchDetectionSummary(): Promise<DetectionSummary> {
  const res = await fetch(`${API}/cameras/detection-summary/`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to load detection summary");
  return res.json();
}

export async function fetchStreamCameras(): Promise<{
  cameras: StreamCameraMeta[];
  ml_service_enabled: boolean;
  ml_service_public_url?: string;
}> {
  const res = await fetch(`${API}/cameras/streams/`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load streams (${res.status})`);
  return res.json();
}

/** Display label for camera source (no credentials exposed). */
export function cameraSourceLabel(cam: Pick<CameraRecord, "site_name" | "nvr_name" | "channel" | "nvr_ip">): string {
  return `${cam.site_name} · ${cam.nvr_name} · Ch ${cam.channel}`;
}

export type PersonJourneySighting = {
  camera_id: number;
  camera_code: string;
  camera_name: string;
  site_code: string;
  zone: string;
  local_track_id: number | null;
  global_track_id?: number | null;
  started_at: string;
  ended_at: string | null;
  label: string;
  snapshot_url?: string;
  clip_status?: string;
  snapshot_urls?: string[];
};

export type PersonJourney = {
  qr_code_number: string;
  person_type: string;
  display_name: string;
  staff_id: number | null;
  visitor_id: number | null;
  first_seen_at: string;
  last_seen_at: string;
  sightings_count: number;
  snapshot_url?: string;
  global_track_id?: number | null;
  path: PersonJourneySighting[];
};

export async function fetchPersonJourney(qrCode: string): Promise<PersonJourney> {
  const code = encodeURIComponent(qrCode.trim());
  const res = await fetch(`${API}/cameras/persons/${code}/journey/`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load person journey (${res.status})`);
  return res.json();
}

export type PersonIdentitySummary = {
  qr_code_number: string;
  person_type: string;
  display_name: string;
  staff_id: number | null;
  visitor_id: number | null;
  first_seen_at: string;
  last_seen_at: string;
  snapshot_url?: string;
};

export async function fetchPersonIdentities(limit = 50): Promise<{
  count: number;
  results: PersonIdentitySummary[];
}> {
  const res = await fetch(`${API}/cameras/persons/?limit=${limit}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load persons (${res.status})`);
  return res.json();
}

export type PlateCapture = {
  timestamp: string;
  camera_key: string;
  plate_number: string;
  det_conf: number;
  ocr_conf: number;
  plate_image: string;
  frame_image: string;
  accepted: boolean;
};

export type PlateCaptureSummary = {
  anpr_cameras: number;
  reads_today: number;
  accepted_today: number;
  unique_plates_today: number;
  match_rate: number;
  total_captures: number;
};

export async function fetchPlateCaptures(opts?: {
  page?: number;
  page_size?: number;
  camera_key?: string;
  q?: string;
  plate_number?: string;
  date_from?: string;
  date_to?: string;
  cleanup?: boolean;
}): Promise<{
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  summary: PlateCaptureSummary;
  cleanup?: { removed_rows: number; deleted_files: number };
  results: PlateCapture[];
}> {
  const params = new URLSearchParams();
  params.set("page", String(opts?.page ?? 1));
  params.set("page_size", String(opts?.page_size ?? 25));
  if (opts?.camera_key) params.set("camera_key", opts.camera_key);
  if (opts?.q) params.set("q", opts.q);
  if (opts?.plate_number) params.set("plate_number", opts.plate_number);
  if (opts?.date_from) params.set("date_from", opts.date_from);
  if (opts?.date_to) params.set("date_to", opts.date_to);
  params.set("cleanup", opts?.cleanup === true ? "true" : "false");
  const res = await fetch(`${API}/cameras/plate-captures/?${params.toString()}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load plate captures (${res.status})`);
  return res.json();
}

export type VehicleJourneySighting = {
  index: number;
  timestamp: string;
  camera_key: string;
  camera_name: string;
  camera_code: string;
  location: string;
  zone: string;
  plate_number: string;
  det_conf: number;
  ocr_conf: number;
  plate_image: string;
  frame_image: string;
};

export type VehicleJourneyCamera = {
  camera_key: string;
  camera_name: string;
  location: string;
  zone: string;
};

export type VehicleJourney = {
  plate_key: string;
  plate_number: string;
  ocr_variants: string[];
  sighting_count: number;
  pass_count: number;
  camera_count: number;
  cameras: VehicleJourneyCamera[];
  route: string[];
  first_seen: string;
  last_seen: string;
  first_camera: string;
  last_camera: string;
  plate_image: string;
  frame_image: string;
  path?: VehicleJourneySighting[];
};

export type VehicleJourneySummary = {
  total_vehicles: number;
  repeat_vehicles: number;
  multi_camera: number;
  total_sightings: number;
};

export async function fetchVehicleJourneys(opts?: {
  page?: number;
  page_size?: number;
  q?: string;
  min_passes?: number;
  date_from?: string;
  date_to?: string;
}): Promise<{
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  min_passes: number;
  summary: VehicleJourneySummary;
  results: VehicleJourney[];
}> {
  const params = new URLSearchParams();
  params.set("page", String(opts?.page ?? 1));
  params.set("page_size", String(opts?.page_size ?? 25));
  params.set("min_passes", String(opts?.min_passes ?? 2));
  if (opts?.q) params.set("q", opts.q);
  if (opts?.date_from) params.set("date_from", opts.date_from);
  if (opts?.date_to) params.set("date_to", opts.date_to);
  const res = await fetch(`${API}/cameras/vehicle-journeys/?${params.toString()}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load vehicle journeys (${res.status})`);
  return res.json();
}

export async function fetchVehicleJourney(plateKey: string): Promise<VehicleJourney> {
  const key = encodeURIComponent(plateKey.trim());
  const res = await fetch(`${API}/cameras/vehicle-journeys/${key}/`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) throw new Error("No journey found for this plate.");
  if (!res.ok) throw new Error(`Failed to load vehicle journey (${res.status})`);
  return res.json();
}
