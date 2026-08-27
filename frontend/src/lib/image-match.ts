/**
 * Frontend-only image matching. Compares a search image with candidate images
 * using canvas-based fingerprinting (downscaled grayscale, normalized) and returns similarity scores.
 * No backend required.
 */

import { API_BASE_URL } from "@/lib/api"

const FINGERPRINT_SIZE = 32

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (!dataUrl.startsWith("data:")) {
      img.crossOrigin = "anonymous"
    }
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = dataUrl
  })
}

/** Normalize fingerprint to zero mean and unit variance so lighting/contrast don't dominate. */
function normalizeFingerprint(fp: number[]): number[] {
  if (fp.length === 0) return []
  let mean = 0
  for (let i = 0; i < fp.length; i++) mean += fp[i]
  mean /= fp.length
  let variance = 0
  for (let i = 0; i < fp.length; i++) {
    const d = fp[i] - mean
    variance += d * d
  }
  const std = Math.sqrt(variance / fp.length) || 1
  return fp.map((x) => (x - mean) / std)
}

/**
 * Draw image to canvas at size x size, get grayscale fingerprint (0–255 per pixel).
 * Returns empty array on CORS or load error.
 */
export async function imageToFingerprint(dataUrl: string, size: number = FINGERPRINT_SIZE): Promise<number[]> {
  const img = await loadImage(dataUrl)
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return []
  ctx.drawImage(img, 0, 0, size, size)
  let data: ImageData
  try {
    data = ctx.getImageData(0, 0, size, size)
  } catch {
    return []
  }
  const out: number[] = []
  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i]
    const g = data.data[i + 1]
    const b = data.data[i + 2]
    out.push(0.299 * r + 0.587 * g + 0.114 * b)
  }
  return out
}

/**
 * Compare two fingerprints (normalized); returns similarity 0–100 (100 = identical).
 * Uses normalized fingerprints so different lighting/contrast still match.
 */
export function compareFingerprints(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0
  const na = normalizeFingerprint(a)
  const nb = normalizeFingerprint(b)
  let sumSq = 0
  for (let i = 0; i < na.length; i++) {
    const d = na[i] - nb[i]
    sumSq += d * d
  }
  const rms = Math.sqrt(sumSq / na.length)
  const maxRms = 4
  const similarity = Math.max(0, 100 - (rms / maxRms) * 100)
  return Math.round(Math.min(100, similarity))
}

export type ImageMatchCandidate = {
  id: number
  full_name: string
  cnic_number?: string
  passport_number?: string
  profile_image?: string
}

function isUsableInlinePhoto(value: string): boolean {
  const s = value.trim()
  if (!s) return false
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/api/")) return true
  if (s.startsWith("data:image/")) return true
  return false
}

function absoluteApiUrl(pathOrUrl: string): string {
  const s = pathOrUrl.trim()
  if (s.startsWith("http://") || s.startsWith("https://")) return s
  const base = API_BASE_URL.replace(/\/$/, "")
  return `${base}${s.startsWith("/") ? s : `/${s}`}`
}

/** Get the best available photo URL from a visitor record (inline blob, API URL, or profile-image endpoint). */
export function getVisitorPhotoUrl(visitor: Record<string, unknown>): string | undefined {
  const v = visitor as {
    id?: number
    profile_image?: string
    profile_image_url?: string
    captured_photo?: string
    photo_capture?: string
    visitorPhotos?: string[]
    visitor_photos?: string[]
    has_captured_photo?: boolean
    has_profile_image?: boolean
    has_visitor_photos?: boolean
    has_photo_capture?: boolean
  }

  const profileUrl = v.profile_image_url
  if (typeof profileUrl === "string" && profileUrl.trim()) {
    return absoluteApiUrl(profileUrl)
  }

  if (v.profile_image && typeof v.profile_image === "string" && isUsableInlinePhoto(v.profile_image)) {
    return v.profile_image.startsWith("data:") || v.profile_image.startsWith("http")
      ? v.profile_image
      : absoluteApiUrl(v.profile_image)
  }
  if (v.captured_photo && typeof v.captured_photo === "string" && isUsableInlinePhoto(v.captured_photo)) {
    return v.captured_photo
  }
  if (v.photo_capture && typeof v.photo_capture === "string" && isUsableInlinePhoto(v.photo_capture)) {
    return v.photo_capture
  }
  const photos = v.visitor_photos ?? v.visitorPhotos
  if (Array.isArray(photos) && photos.length > 0 && typeof photos[0] === "string" && isUsableInlinePhoto(photos[0])) {
    return photos[0]
  }

  const id = v.id
  if (id != null && Number(id) > 0) {
    const hasPhoto =
      v.has_captured_photo === true ||
      v.has_profile_image === true ||
      v.has_visitor_photos === true ||
      v.has_photo_capture === true
    if (hasPhoto) {
      return `${API_BASE_URL.replace(/\/$/, "")}/api/visitors/${id}/profile-image/`
    }
  }

  return undefined
}

export type ImageMatchResult = ImageMatchCandidate & { match_score: number }

/**
 * Match a search image (data URL) against a list of candidates (each with profile_image data URL).
 * Returns candidates sorted by match score descending; only includes score >= minScore.
 * Same image URL => 100% match. Normalized comparison so lighting/contrast matter less.
 */
export async function matchImageInFrontend(
  searchImageDataUrl: string,
  candidates: ImageMatchCandidate[],
  minScore: number = 0
): Promise<ImageMatchResult[]> {
  let searchFp: number[] = []
  try {
    searchFp = await imageToFingerprint(searchImageDataUrl)
  } catch {
    return []
  }
  if (searchFp.length === 0) return []

  const withScores: ImageMatchResult[] = []
  for (const c of candidates) {
    const img = c.profile_image
    if (!img || typeof img !== "string") continue
    if (img === searchImageDataUrl) {
      withScores.push({ ...c, match_score: 100 })
      continue
    }
    try {
      const fp = await imageToFingerprint(img)
      if (fp.length === 0) continue
      const score = compareFingerprints(searchFp, fp)
      if (score >= minScore) {
        withScores.push({ ...c, match_score: score })
      }
    } catch {
      // CORS or load error for this candidate; skip
    }
  }
  withScores.sort((a, b) => b.match_score - a.match_score)
  return withScores
}
