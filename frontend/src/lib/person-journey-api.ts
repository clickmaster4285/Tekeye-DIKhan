import { API_BASE_URL, getAuthHeaders } from "@/lib/api";

const API = `${API_BASE_URL}/api/person-journey`;

export type JourneyPersonType = "staff" | "visitor" | "unknown";
export type JourneyPersonStatus = "active" | "finished" | "merged";

export type JourneyPersonRecord = {
  uuid: string;
  /** Global person ID (PJ-00042). Never a camera track id. */
  person_id?: string;
  code: string;
  person_type: JourneyPersonType;
  display_name: string;
  /** True when an operator manually named this person — ingest must not overwrite. */
  name_locked?: boolean;
  staff_name?: string;
  visitor_name?: string;
  latest_camera_name?: string;
  latest_zone?: string;
  latest_seen_at?: string | null;
  latest_snapshot_url?: string;
  status: JourneyPersonStatus;
  identity_state?: string;
  created_at?: string;
  active_tracklet_count?: number;
  /** Per-camera tracklets linked to this global person, e.g. C01-T18492 */
  tracklet_ids?: string[];
};

export type JourneyEventRecord = {
  id: number;
  event_type: string;
  title: string;
  description?: string;
  camera_name?: string;
  camera_code?: string;
  zone?: string;
  gate?: string;
  confidence?: number | null;
  match_score?: number | null;
  bbox?: number[];
  snapshot_path?: string;
  snapshot_url?: string;
  /** Global person ID (PJ-#####) */
  person_id?: string;
  person_code?: string;
  person_name?: string;
  /** Per-camera tracklet (C##-T#####) — distinct from person_id */
  tracklet_id?: string;
  local_track_id?: number | null;
  camera?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export type JourneyTrackletRecord = {
  id: number;
  tracklet_id: string;
  track_id: number;
  person_id?: string;
  camera_name?: string;
  camera_zone?: string;
  status: string;
  started_at: string;
  ended_at?: string | null;
  last_bbox?: number[];
  start_bbox?: number[];
  end_bbox?: number[];
  movement_direction?: string;
  entry_zone?: string;
  exit_zone?: string;
  quality?: number | null;
};

export type JourneyPersonDetail = JourneyPersonRecord & {
  events?: JourneyEventRecord[];
  tracks?: JourneyTrackletRecord[];
};

export type JourneySummary = {
  active_now: number;
  unknown_today: number;
  visitors_today?: number;
  staff_recognized_24h: number;
  events_24h: number;
  by_type: Record<string, number>;
};

export type JourneyCameraCapture = {
  camera_id: number;
  camera_name: string;
  camera_code?: string;
  zone?: string;
  snapshot_url?: string;
  event_id: number;
  detection_event_id?: number | null;
  event_type?: string;
  title?: string;
  confidence?: number | null;
  captured_at: string;
};

export type JourneyPersonsQuery = {
  q?: string;
  person_type?: JourneyPersonType;
  status?: JourneyPersonStatus;
  active_only?: boolean;
  page?: number;
  page_size?: number;
};

export type JourneyPersonsPage = {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: JourneyPersonRecord[];
};

function buildParams(query: Record<string, string | boolean | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === "") continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export async function fetchJourneySummary(): Promise<JourneySummary> {
  const res = await fetch(`${API}/summary/`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to load journey summary");
  return res.json();
}

export async function fetchJourneyPersons(query: JourneyPersonsQuery = {}): Promise<JourneyPersonsPage> {
  const res = await fetch(
    `${API}/persons/${buildParams({
      q: query.q,
      person_type: query.person_type,
      status: query.status,
      active_only: query.active_only ? "true" : undefined,
      page: query.page ?? 1,
      page_size: query.page_size ?? 20,
    })}`,
    { headers: getAuthHeaders() }
  );
  if (!res.ok) throw new Error("Failed to load journey persons");
  const data = await res.json();
  if (Array.isArray(data)) {
    return {
      count: data.length,
      page: 1,
      page_size: data.length || 20,
      total_pages: 1,
      results: data,
    };
  }
  return {
    count: Number(data.count ?? 0),
    page: Number(data.page ?? 1),
    page_size: Number(data.page_size ?? query.page_size ?? 20),
    total_pages: Number(data.total_pages ?? 1),
    results: data.results ?? [],
  };
}

export async function fetchJourneyLive(minutes = 30): Promise<JourneyPersonRecord[]> {
  const res = await fetch(`${API}/live/?minutes=${minutes}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to load live journey");
  const data = await res.json();
  return data.results ?? [];
}

export async function fetchJourneyPersonDetail(uuid: string): Promise<JourneyPersonDetail> {
  const res = await fetch(`${API}/persons/${uuid}/`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Person journey not found");
  return res.json();
}

export async function renameJourneyPerson(uuid: string, displayName: string): Promise<JourneyPersonRecord> {
  const res = await fetch(`${API}/persons/${uuid}/`, {
    method: "PATCH",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: displayName.trim() }),
  });
  if (!res.ok) {
    let detail = "Failed to save name";
    try {
      const data = await res.json();
      detail = data.display_name?.[0] || data.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

/** The person really doesn't exist (HTTP 404) — as opposed to a timeout or server error. */
export class JourneyPersonNotFoundError extends Error {
  constructor() {
    super("Person journey not found")
    this.name = "JourneyPersonNotFoundError"
  }
}

export async function fetchJourneyTimeline(
  uuid: string,
  dateFrom?: string,
  dateTo?: string,
  refresh = true
): Promise<{ person: JourneyPersonRecord; events: JourneyEventRecord[] }> {
  const res = await fetch(
    `${API}/persons/${uuid}/timeline/${buildParams({
      date_from: dateFrom,
      date_to: dateTo,
      refresh: refresh ? "true" : undefined,
    })}`,
    { headers: getAuthHeaders() }
  );
  if (res.status === 404) throw new JourneyPersonNotFoundError();
  if (!res.ok) throw new Error("Failed to load timeline");
  return res.json();
}

export async function fetchJourneyCameraCaptures(
  uuid: string,
  options: { refresh?: boolean; hours?: number } = {}
): Promise<{ person: JourneyPersonRecord; results: JourneyCameraCapture[] }> {
  const { refresh = true, hours = 0 } = options;
  const res = await fetch(
    `${API}/persons/${uuid}/camera-captures/${buildParams({
      refresh: refresh ? "true" : undefined,
      hours: String(hours),
    })}`,
    { headers: getAuthHeaders() }
  );
  if (!res.ok) throw new Error("Failed to load camera captures");
  return res.json();
}

export async function fetchJourneyCameraSightings(hours = 0): Promise<JourneyEventRecord[]> {
  const res = await fetch(`${API}/camera-sightings/?hours=${hours}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to load camera sightings");
  const data = await res.json();
  return data.results ?? [];
}

export async function fetchJourneyRecentEvents(limit = 40): Promise<JourneyEventRecord[]> {
  const res = await fetch(`${API}/events/recent/?limit=${limit}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to load recent journey events");
  const data = await res.json();
  return data.results ?? [];
}

export function journeyPersonId(person: { person_id?: string; code: string }): string {
  return (person.person_id || person.code || "").trim();
}

export function journeyPersonTypeLabel(type: JourneyPersonType): string {
  if (type === "staff") return "Staff";
  if (type === "visitor") return "Visitor";
  return "Unknown";
}

export function journeyEventIconType(eventType: string): "camera" | "user" | "zone" | "alert" | "attendance" {
  if (eventType.includes("attendance")) return "attendance";
  if (eventType.includes("zone")) return "zone";
  if (eventType.includes("weapon") || eventType.includes("alert") || eventType.includes("watchlist")) return "alert";
  if (eventType.includes("staff") || eventType.includes("recognized")) return "user";
  return "camera";
}
