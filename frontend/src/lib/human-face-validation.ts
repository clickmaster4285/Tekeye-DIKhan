/**
 * Client-side human face check for visitor/staff photograph upload.
 * Uses BlazeFace plus landmark + skin-tone heuristics to reduce false positives.
 */

import type { Tensor } from "@tensorflow/tfjs"

export const NOT_HUMAN_PICTURE_MESSAGE = "This is not a human picture"
export const NO_FACE_DETECTED_MESSAGE = "Could not detect a face in this photo"

export type HumanFaceValidationMode = "strict" | "staff"

const MIN_FACE_PROBABILITY = 0.88
const STAFF_MIN_FACE_PROBABILITY = 0.7
const STAFF_HIGH_CONFIDENCE = 0.82
const MIN_SKIN_RATIO = 0.1
const STAFF_MIN_SKIN_RATIO = 0.06
const MIN_FACE_AREA_RATIO = 0.015
const MAX_FACE_AREA_RATIO = 0.92

type RawFace = {
  probability?: number | number[] | Tensor
  topLeft?: [number, number] | Tensor
  bottomRight?: [number, number] | Tensor
  landmarks?: Array<[number, number]> | Tensor
}

type BlazeFaceModel = {
  estimateFaces: (
    input: HTMLImageElement | HTMLCanvasElement,
    returnTensors?: boolean
  ) => Promise<RawFace[]>
}

type ParsedFace = {
  probability: number
  topLeft: [number, number]
  bottomRight: [number, number]
  landmarks: Array<[number, number]>
}

let modelPromise: Promise<BlazeFaceModel> | null = null
let modelReady = false

const BLAZEFACE_MODEL_URL = `${import.meta.env.BASE_URL}models/blazeface/model.json`

async function loadFaceModel(): Promise<BlazeFaceModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const tf = await import("@tensorflow/tfjs")
      await import("@tensorflow/tfjs-backend-webgl")
      await tf.setBackend("webgl")
      await tf.ready()
      const blazeface = await import("@tensorflow-models/blazeface")
      const model = (await blazeface.load({ modelUrl: BLAZEFACE_MODEL_URL })) as BlazeFaceModel
      modelReady = true
      return model
    })()
  }
  return modelPromise
}

/** True after BlazeFace has loaded at least once this session. */
export function isHumanFaceModelReady(): boolean {
  return modelReady
}

/** Warm up the model — call when HR/visitor photo UI mounts. */
export function preloadHumanFaceModel(): void {
  void loadFaceModel().catch(() => {
    // ignore — validation will surface errors on capture
  })
}

function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = src
  })
}

function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
  return loadImageFromSrc(dataUrl)
}

async function blobToImage(file: File | Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    return await loadImageFromSrc(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function readNumber(value: unknown): Promise<number> {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (Array.isArray(value) && value.length > 0) return Number(value[0]) || 0
  if (value && typeof value === "object" && "dataSync" in value) {
    const data = (value as Tensor).dataSync()
    return data.length > 0 ? Number(data[0]) : 0
  }
  return 0
}

async function readPoint(value: unknown): Promise<[number, number] | null> {
  if (Array.isArray(value) && value.length >= 2) {
    return [Number(value[0]), Number(value[1])]
  }
  if (value && typeof value === "object" && "dataSync" in value) {
    const data = (value as Tensor).dataSync()
    if (data.length >= 2) return [Number(data[0]), Number(data[1])]
  }
  return null
}

async function parseFace(raw: RawFace): Promise<ParsedFace | null> {
  const probability = await readNumber(raw.probability)
  const topLeft = await readPoint(raw.topLeft)
  const bottomRight = await readPoint(raw.bottomRight)

  if (!topLeft || !bottomRight) return null

  let landmarks: Array<[number, number]> = []
  if (Array.isArray(raw.landmarks)) {
    landmarks = raw.landmarks
      .map((point) => {
        if (Array.isArray(point) && point.length >= 2) {
          return [Number(point[0]), Number(point[1])] as [number, number]
        }
        return null
      })
      .filter((p): p is [number, number] => p != null)
  }

  return { probability, topLeft, bottomRight, landmarks }
}

function hasPlausibleFaceLandmarks(landmarks: Array<[number, number]>): boolean {
  if (landmarks.length < 4) return false

  const [rightEye, leftEye, nose, mouth] = landmarks
  const eyeYDiff = Math.abs(rightEye[1] - leftEye[1])
  const eyeDist = Math.hypot(leftEye[0] - rightEye[0], leftEye[1] - rightEye[1])
  if (eyeDist < 8) return false
  if (eyeYDiff > eyeDist * 0.35) return false
  if (nose[1] <= Math.min(rightEye[1], leftEye[1]) + eyeDist * 0.05) return false
  if (mouth[1] <= nose[1] + eyeDist * 0.05) return false
  return true
}

function faceBoxIsPlausible(
  face: ParsedFace,
  imgWidth: number,
  imgHeight: number,
  mode: HumanFaceValidationMode = "strict"
): boolean {
  const width = Math.abs(face.bottomRight[0] - face.topLeft[0])
  const height = Math.abs(face.bottomRight[1] - face.topLeft[1])
  const minDim = mode === "staff" ? 20 : 24
  if (width < minDim || height < minDim) return false

  const areaRatio = (width * height) / (imgWidth * imgHeight)
  if (areaRatio < MIN_FACE_AREA_RATIO || areaRatio > MAX_FACE_AREA_RATIO) return false

  const aspect = width / height
  if (mode === "staff") {
    return aspect >= 0.3 && aspect <= 2.5
  }
  return aspect >= 0.55 && aspect <= 1.65
}

/** Side/profile poses often fail frontal geometry but still have spread keypoints. */
function hasMinimalFaceStructure(landmarks: Array<[number, number]>): boolean {
  if (landmarks.length < 4) return false
  const xs = landmarks.map((point) => point[0])
  const ys = landmarks.map((point) => point[1])
  const spreadX = Math.max(...xs) - Math.min(...xs)
  const spreadY = Math.max(...ys) - Math.min(...ys)
  return spreadX >= 8 && spreadY >= 8
}

function isSkinPixel(r: number, g: number, b: number): boolean {
  const y = 0.299 * r + 0.587 * g + 0.114 * b
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
  return y > 40 && cr >= 133 && cr <= 173 && cb >= 77 && cb <= 127
}

function skinRatioInBox(
  data: Uint8ClampedArray,
  imgWidth: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const left = Math.max(0, Math.floor(Math.min(x1, x2)))
  const top = Math.max(0, Math.floor(Math.min(y1, y2)))
  const right = Math.min(imgWidth - 1, Math.ceil(Math.max(x1, x2)))
  const bottom = Math.ceil(Math.max(y1, y2))

  let skin = 0
  let total = 0

  for (let y = top; y < bottom; y += 2) {
    for (let x = left; x < right; x += 2) {
      const idx = (y * imgWidth + x) * 4
      if (isSkinPixel(data[idx], data[idx + 1], data[idx + 2])) skin += 1
      total += 1
    }
  }

  return total > 0 ? skin / total : 0
}

function getFaceRegionPixels(
  img: HTMLImageElement,
  face: ParsedFace
): Uint8ClampedArray | null {
  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  try {
    return ctx.getImageData(0, 0, canvas.width, canvas.height).data
  } catch {
    return null
  }
}

function faceSkinRatio(img: HTMLImageElement, face: ParsedFace): number | null {
  const imgWidth = img.naturalWidth || img.width
  const pixels = getFaceRegionPixels(img, face)
  if (!pixels) return null

  return skinRatioInBox(
    pixels,
    imgWidth,
    face.topLeft[0],
    face.topLeft[1],
    face.bottomRight[0],
    face.bottomRight[1]
  )
}

async function isLikelyHumanFace(
  face: ParsedFace,
  img: HTMLImageElement,
  mode: HumanFaceValidationMode
): Promise<boolean> {
  const imgWidth = img.naturalWidth || img.width
  const imgHeight = img.naturalHeight || img.height

  if (!faceBoxIsPlausible(face, imgWidth, imgHeight, mode)) return false

  if (mode === "staff") {
    if (face.probability < STAFF_MIN_FACE_PROBABILITY) return false

    const frontal = hasPlausibleFaceLandmarks(face.landmarks)
    const skinRatio = faceSkinRatio(img, face)

    if (frontal) {
      return skinRatio == null || skinRatio >= STAFF_MIN_SKIN_RATIO
    }

    if (face.probability >= STAFF_HIGH_CONFIDENCE) {
      return true
    }

    if (hasMinimalFaceStructure(face.landmarks)) {
      return skinRatio == null || skinRatio >= STAFF_MIN_SKIN_RATIO
    }

    return false
  }

  if (face.probability < MIN_FACE_PROBABILITY) return false
  if (!hasPlausibleFaceLandmarks(face.landmarks)) return false

  const skinRatio = faceSkinRatio(img, face)
  if (skinRatio == null) return false

  return skinRatio >= MIN_SKIN_RATIO
}

export type HumanFaceValidationResult =
  | { ok: true }
  | { ok: false; message: string }

export type HumanFaceValidationOptions = {
  mode?: HumanFaceValidationMode
}

function rejectionMessage(mode: HumanFaceValidationMode): string {
  return mode === "staff" ? NO_FACE_DETECTED_MESSAGE : NOT_HUMAN_PICTURE_MESSAGE
}

async function validateLoadedImage(
  img: HTMLImageElement,
  mode: HumanFaceValidationMode
): Promise<HumanFaceValidationResult> {
  const model = await loadFaceModel()
  const rawFaces = await model.estimateFaces(img, false)
  const parsedFaces = (
    await Promise.all((rawFaces ?? []).map((face) => parseFace(face)))
  ).filter((face): face is ParsedFace => face != null)

  const failMessage = rejectionMessage(mode)

  if (!parsedFaces.length) {
    return { ok: false, message: failMessage }
  }

  for (const face of parsedFaces) {
    if (await isLikelyHumanFace(face, img, mode)) {
      return { ok: true }
    }
  }

  return { ok: false, message: failMessage }
}

/** Validate an uploaded image file before accepting it. */
export async function validateHumanFaceFile(
  file: File | Blob,
  options?: HumanFaceValidationOptions
): Promise<HumanFaceValidationResult> {
  const mode = options?.mode ?? "strict"
  if (typeof window === "undefined") {
    return { ok: true }
  }

  try {
    const img = await blobToImage(file)
    return await validateLoadedImage(img, mode)
  } catch (err) {
    console.warn("Human face validation failed:", err)
    return { ok: false, message: rejectionMessage(mode) }
  }
}

/**
 * Returns ok when a human face is detected with sufficient confidence and geometry.
 */
export async function validateHumanFaceImage(
  dataUrl: string,
  options?: HumanFaceValidationOptions
): Promise<HumanFaceValidationResult> {
  const mode = options?.mode ?? "strict"
  if (typeof window === "undefined") {
    return { ok: true }
  }

  try {
    const img = await dataUrlToImage(dataUrl)
    return await validateLoadedImage(img, mode)
  } catch (err) {
    console.warn("Human face validation failed:", err)
    return { ok: false, message: rejectionMessage(mode) }
  }
}
