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

export type VideoSearchSegment = {
  start_sec: number;
  end_sec: number;
  peak_t_sec: number;
  peak_score: number;
  match_type: string;
  class_name: string;
  hit_count: number;
  clip_seconds: number;
  preview_url?: string;
  clip_url?: string;
};

export type VideoSearchResponse = {
  job_id: string;
  hit_count: number;
  query: {
    has_face: boolean;
    has_reid: boolean;
    label: string;
    preview_url?: string;
  };
  video: {
    duration_sec: number;
    fps: number;
    frames_scanned: number;
    clip_seconds: number;
  };
  segments: VideoSearchSegment[];
};

export type VideoSearchJob = {
  job_id: string;
  status: "queued" | "running" | "done" | "error" | string;
  progress: number;
  message?: string;
  error?: string | null;
  result?: VideoSearchResponse;
};

export async function startImageInVideoSearch(
  imageFile: File,
  videoFile: File,
  options?: {
    clipSeconds?: number;
    faceThreshold?: number;
    reidThreshold?: number;
    sampleFps?: number;
  }
): Promise<VideoSearchJob> {
  if (!isMlEnabled()) {
    throw new Error("ML is disabled on this server.");
  }
  const form = new FormData();
  form.append("image", imageFile);
  form.append("video", videoFile);
  form.append("clip_seconds", String(options?.clipSeconds ?? 4));
  if (options?.faceThreshold != null) form.append("face_threshold", String(options.faceThreshold));
  if (options?.reidThreshold != null) form.append("reid_threshold", String(options.reidThreshold));
  if (options?.sampleFps != null) form.append("sample_fps", String(options.sampleFps));
  const response = await fetch(`${API_BASE_URL}/api/ml/search/video/`, {
    method: "POST",
    headers: getAuthHeadersFormData(),
    body: form,
  });
  if (response.status === 401) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      typeof err?.detail === "string" ? err.detail : `Video search failed (${response.status})`
    );
  }
  return response.json();
}

export async function fetchVideoSearchJob(jobId: string): Promise<VideoSearchJob> {
  const response = await fetch(
    `${API_BASE_URL}/api/ml/search/video/?job_id=${encodeURIComponent(jobId)}`,
    { headers: getAuthHeaders(), cache: "no-store" }
  );
  if (response.status === 401) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      typeof err?.detail === "string" ? err.detail : `Could not read search status (${response.status})`
    );
  }
  return response.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function searchImageInVideo(
  imageFile: File,
  videoFile: File,
  options?: {
    clipSeconds?: number;
    faceThreshold?: number;
    reidThreshold?: number;
    sampleFps?: number;
    onProgress?: (job: VideoSearchJob) => void;
  }
): Promise<VideoSearchResponse> {
  const started = await startImageInVideoSearch(imageFile, videoFile, options);
  options?.onProgress?.(started);
  const jobId = started.job_id;
  if (!jobId) throw new Error("Search did not start (missing job id).");

  const deadline = Date.now() + 90 * 60 * 1000; // 90 min for 1-hour recordings
  while (Date.now() < deadline) {
    const row = await fetchVideoSearchJob(jobId);
    options?.onProgress?.(row);
    if (row.status === "done" && row.result) {
      return row.result;
    }
    if (row.status === "error") {
      throw new Error(row.error || row.message || "Video search failed.");
    }
    await sleep(2500);
  }
  throw new Error("Search timed out. Try a shorter export or lower camera bitrate.");
}
