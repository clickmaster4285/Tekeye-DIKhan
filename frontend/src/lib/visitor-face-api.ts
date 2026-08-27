import { API_BASE_URL, getAuthHeaders } from "@/lib/api"

const API = `${API_BASE_URL}/api`

export type VisitorFaceRecord = {
  id: number
  visitor_id: number
  image_url?: string
  quality_score: number
  is_active: boolean
  created_at?: string | null
  has_embedding?: boolean
}

export type VisitorFaceList = {
  visitor_id: number
  faces: VisitorFaceRecord[]
  face_count: number
  images_required: number
  images_max: number
  is_enrolled: boolean
}

export type VisitorFaceEnrollResult = {
  accepted?: boolean
  error?: string
  quality?: {
    passed?: boolean
    message?: string
    quality_score?: number
    [key: string]: unknown
  }
  face_id?: number
  face_count?: number
  images_required?: number
  images_max?: number
  is_enrolled?: boolean
  visitor_id?: number
  embeddings_created?: number
  rejected?: Array<{ accepted?: boolean; error?: string; quality?: { message?: string } }>
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as Record<string, unknown>
    if (typeof data.detail === "string") return data.detail
    if (typeof data.error === "string") return data.error
    return `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

export async function listVisitorFaces(visitorId: number): Promise<VisitorFaceList> {
  const res = await fetch(`${API}/visitors/${visitorId}/faces/`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as VisitorFaceList
}

export async function enrollVisitorFace(
  visitorId: number,
  image: string
): Promise<VisitorFaceEnrollResult> {
  const res = await fetch(`${API}/visitors/${visitorId}/face/enroll/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ image }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as VisitorFaceEnrollResult
}

export async function enrollVisitorFaces(
  visitorId: number,
  images: string[]
): Promise<VisitorFaceEnrollResult> {
  const res = await fetch(`${API}/visitors/${visitorId}/face/enroll/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ images }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as VisitorFaceEnrollResult
}

export async function deleteVisitorFace(visitorId: number, faceId: number): Promise<void> {
  const res = await fetch(`${API}/visitors/${visitorId}/faces/${faceId}/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  })
  if (!res.ok && res.status !== 404) throw new Error(await parseError(res))
}

export async function enrollVisitorPhotosBestEffort(
  visitorId: number,
  images: string[]
): Promise<void> {
  const batch = images.filter((img) => typeof img === "string" && img.startsWith("data:image")).slice(0, 5)
  if (!visitorId || !batch.length) return
  try {
    await enrollVisitorFaces(visitorId, batch)
  } catch {
    /* Enrollment is best-effort after registration; reception can retry on the visitor page. */
  }
}

export function visitorFaceQualityLabel(score?: number, passed?: boolean): string {
  if (passed === false) return "Rejected"
  if (score == null || Number.isNaN(score)) return "—"
  if (score >= 0.75) return "Excellent"
  if (score >= 0.55) return "Good"
  return "Fair"
}
