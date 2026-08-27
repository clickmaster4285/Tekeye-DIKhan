import { API_BASE_URL, getAuthHeaders, getAuthHeadersFormData } from "@/lib/api";

export type MLHealthResponse = {
  status: "ok" | "disabled" | "error";
  message?: string;
  yolo_available?: boolean;
  yolo_weights?: string | null;
  known_faces?: number;
  face_source?: string;
};

/** When false (e.g. production server without ml_services), skip all ML API calls. */
export function isMlEnabled(): boolean {
  const raw = import.meta.env?.VITE_ML_ENABLED;
  if (raw === undefined || raw === "") return true;
  const v = String(raw).trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export type MLDetection = {
  class_id: number;
  class_name: string;
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
  alert?: boolean;
};

export async function fetchMLHealth(): Promise<MLHealthResponse> {
  if (!isMlEnabled()) {
    return { status: "disabled", message: "ML disabled in this deployment." };
  }
  const response = await fetch(`${API_BASE_URL}/api/ml/health/`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error("Unauthorized");
  return data as MLHealthResponse;
}

export async function detectImage(
  imageFile: File,
  options?: { conf?: number; recognizeFaces?: boolean }
): Promise<{ detections: MLDetection[]; count: number }> {
  if (!isMlEnabled()) {
    throw new Error("ML is disabled on this server.");
  }
  const form = new FormData();
  form.append("image", imageFile);
  const params = new URLSearchParams();
  if (options?.conf != null) params.set("conf", String(options.conf));
  const url = `${API_BASE_URL}/api/ml/detect/${params.toString() ? `?${params}` : ""}`;
  const response = await fetch(url, {
    method: "POST",
    headers: getAuthHeadersFormData(),
    body: form,
  });
  if (response.status === 401) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(typeof err?.detail === "string" ? err.detail : `Detection failed (${response.status})`);
  }
  return response.json();
}

export async function reloadKnownFaces(): Promise<{ reloaded: boolean; known_faces: number }> {
  if (!isMlEnabled()) {
    return { reloaded: false, known_faces: 0 };
  }
  const response = await fetch(`${API_BASE_URL}/api/ml/reload-faces/`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (response.status === 401) throw new Error("Unauthorized");
  if (!response.ok) throw new Error(`Failed to reload faces (${response.status})`);
  return response.json();
}
