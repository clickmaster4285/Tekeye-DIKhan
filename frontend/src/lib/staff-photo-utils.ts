import type { UploadValue } from "@/components/hr/add-staff/step2-documents-upload"
import { staffMediaPathFromUrl } from "@/lib/staff-api"
import { preloadHumanFaceModel, validateHumanFaceFile } from "@/lib/human-face-validation"

/** First newly uploaded file — used as profile_image on save. */
export function primaryStaffPhotoFile(photos: UploadValue[]): File | undefined {
  const match = photos.find((p) => p.file instanceof File)
  return match?.file ?? undefined
}

export function newStaffPhotoFiles(photos: UploadValue[]): File[] {
  return photos.map((p) => p.file).filter((f): f is File => f instanceof File)
}

/** Server-stored photo paths to retain on update (existing previews only). */
export function existingStaffPhotoPaths(photos: UploadValue[]): string[] {
  return photos
    .filter((p) => !(p.file instanceof File) && p.previewUrl)
    .map((p) => staffMediaPathFromUrl(p.previewUrl!))
    .filter(Boolean)
}

function revokeBlobUrl(url: string | null | undefined): void {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url)
}

/** Show previews immediately; face check runs afterward. */
export function createStaffPhotoPreviews(files: File[]): UploadValue[] {
  return files.map((file) => ({
    file,
    previewUrl: URL.createObjectURL(file),
    validating: true,
  }))
}

/**
 * Merge newly accepted uploads. New files replace server-only previews (edit mode)
 * so profile_image always maps to the latest upload.
 */
export function mergeStaffPhotos(prev: UploadValue[], accepted: UploadValue[], max = 5): UploadValue[] {
  if (accepted.length === 0) return prev.slice(0, max)

  const keptFiles = prev.filter((p) => p.file instanceof File)
  const next = [...accepted, ...keptFiles].slice(0, max)
  const keptPreviewUrls = new Set(next.map((p) => p.previewUrl).filter(Boolean))

  for (const p of prev) {
    if (p.previewUrl && !keptPreviewUrls.has(p.previewUrl)) {
      revokeBlobUrl(p.previewUrl)
    }
  }

  return next
}

/** Revoke blob preview URLs on component unmount. */
export function revokeStaffUploadBlobs(uploads: {
  staffPhotos: UploadValue[]
  cnicFront: UploadValue
  cnicBack: UploadValue
  appointmentLetter: UploadValue
  additionalDocument: UploadValue
}): void {
  for (const p of uploads.staffPhotos) revokeBlobUrl(p.previewUrl)
  for (const item of [
    uploads.cnicFront,
    uploads.cnicBack,
    uploads.appointmentLetter,
    uploads.additionalDocument,
  ]) {
    revokeBlobUrl(item.previewUrl)
  }
}

type StaffPhotoUploadOptions = {
  files: File[]
  currentCount: number
  max?: number
  setPhotos: (update: (prev: UploadValue[]) => UploadValue[]) => void
  onValidationError: (message: string) => void
}

/**
 * Add staff photos with instant preview, then validate faces in the background.
 * Invalid photos are removed after the check completes.
 */
export async function ingestStaffPhotoFiles({
  files,
  currentCount,
  max = 5,
  setPhotos,
  onValidationError,
}: StaffPhotoUploadOptions): Promise<void> {
  const remaining = Math.max(0, max - currentCount)
  const batch = files.slice(0, remaining)
  if (batch.length === 0) return

  const staged = createStaffPhotoPreviews(batch)
  setPhotos((prev) => mergeStaffPhotos(prev, staged))
  preloadHumanFaceModel()

  await Promise.all(
    staged.map(async (item) => {
      if (!item.file) return
      const result = await validateHumanFaceFile(item.file, { mode: "staff" })
      setPhotos((prev) => {
        const idx = prev.findIndex((p) => p.previewUrl === item.previewUrl)
        if (idx === -1) return prev
        if (!result.ok) {
          revokeBlobUrl(item.previewUrl)
          onValidationError(result.message)
          return prev.filter((_, i) => i !== idx)
        }
        return prev.map((p, i) => (i === idx ? { ...p, validating: false } : p))
      })
    })
  )
}
