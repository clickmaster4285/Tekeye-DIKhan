import { API_BASE_URL, getAuthHeaders } from "@/lib/api";

const API = `${API_BASE_URL}/api/person-journey`;

export type JourneyPersonType = "staff" | "visitor" | "unknown";
export type JourneyPersonStatus = "active" | "finished" | "merged";

export type JourneyPersonRecord = {
  uuid: string;
  code: string;
  person_type: JourneyPersonType;
  display_name: string;
  staff_name?: string;
  visitor_name?: string;
  latest_camera_name?: string;
  latest_zone?: string;
  latest_seen_at?: string | null;
  latest_snapshot_url?: string;
  status: JourneyPersonStatus;
  created_at?: string;
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
  person_code?: string;
  person_name?: string;
  camera?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export type JourneyPersonDetail = JourneyPersonRecord & {
  events?: JourneyEventRecord[];
  tracks?: Array<{
    id: number;
    track_id: number;
    camera_name?: string;
    status: string;
    started_at: string;
    ended_at?: string | null;
    last_bbox?: number[];
  }>;
};

export type JourneySummary = {
  active_now: number;
  unknown_today: number;
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
};

function buildParams(query: Record<string, string | boolean | undefined>): string {
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

export async function fetchJourneyPersons(query: JourneyPersonsQuery = {}): Promise<JourneyPersonRecord[]> {
  const res = await fetch(
    `${API}/persons/${buildParams({
      q: query.q,
      person_type: query.person_type,
      status: query.status,
      active_only: query.active_only ? "true" : undefined,
    })}`,
    { headers: getAuthHeaders() }
  );
  if (!res.ok) throw new Error("Failed to load journey persons");
  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
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
  if (!res.ok) throw new Error("Failed to load timeline");
  return res.json();
}

export async function fetchJourneyCameraCaptures(
  uuid: string,
  options: { refresh?: boolean; hours?: number } = {}
): Promise<{ person: JourneyPersonRecord; results: JourneyCameraCapture[] }> {
  const { refresh = true, hours = 48 } = options;
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

export async function fetchJourneyCameraSightings(hours = 2): Promise<JourneyEventRecord[]> {
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
