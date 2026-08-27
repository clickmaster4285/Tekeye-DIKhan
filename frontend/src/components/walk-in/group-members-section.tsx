"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { validateHumanFaceImage, NOT_HUMAN_PICTURE_MESSAGE } from "@/lib/human-face-validation"
import {
  defaultGroupMember,
  MAX_GROUP_MEMBER_PHOTOS,
  MAX_GROUP_PARTY_SIZE,
  MIN_GROUP_PARTY_SIZE,
  type GroupVisitMember,
} from "@/components/walk-in/group-member"
import { useToast } from "@/hooks/use-toast"
import { getCameraErrorMessage, requestUserMedia } from "@/lib/utils"

const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/jpg", "image/png"]

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

type GroupMembersSectionProps = {
  partySize: number
  members: GroupVisitMember[]
  onPartySizeChange: (size: number) => void
  onMembersChange: (members: GroupVisitMember[]) => void
}

export function GroupMembersSection({
  partySize,
  members,
  onPartySizeChange,
  onMembersChange,
}: GroupMembersSectionProps) {
  const { toast } = useToast()
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [cameraOpen, setCameraOpen] = useState<number | null>(null)
  const [uploadTarget, setUploadTarget] = useState<number | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoValidating, setPhotoValidating] = useState(false)
  const [sizeInput, setSizeInput] = useState(String(partySize))

  useEffect(() => {
    setSizeInput(String(partySize))
  }, [partySize])

  const applyPartySize = (raw: string) => {
    const n = parseInt(raw, 10)
    if (Number.isNaN(n)) return
    const clamped = Math.min(MAX_GROUP_PARTY_SIZE, Math.max(MIN_GROUP_PARTY_SIZE, n))
    onPartySizeChange(clamped)
    setSizeInput(String(clamped))
  }

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (cameraOpen === null) {
      stopCamera()
      return
    }
    setCameraError(null)
    setCameraLoading(true)
    requestUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch((err) => {
        setCameraError(getCameraErrorMessage(err))
      })
      .finally(() => setCameraLoading(false))
    return () => stopCamera()
  }, [cameraOpen, stopCamera])

  const tryAddPhoto = async (memberIndex: number, dataUrl: string): Promise<boolean> => {
    const member = { ...defaultGroupMember(), ...members[memberIndex] }
    const photos = Array.isArray(member.photos) ? member.photos : []
    if (photos.length >= MAX_GROUP_MEMBER_PHOTOS) return false

    setPhotoError(null)
    setPhotoValidating(true)
    try {
      const result = await validateHumanFaceImage(dataUrl)
      if (!result.ok) {
        setPhotoError(result.message)
        toast({
          title: NOT_HUMAN_PICTURE_MESSAGE,
          description: "Only clear photos of a person's face are allowed.",
          variant: "destructive",
        })
        return false
      }
      const next = [...members]
      next[memberIndex] = {
        ...member,
        photos: [...photos, dataUrl],
      }
      onMembersChange(next)
      return true
    } finally {
      setPhotoValidating(false)
    }
  }

  const captureFromCamera = async () => {
    const index = cameraOpen
    if (index === null) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !streamRef.current || !canvas) return
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) {
      setCameraError("Camera not ready. Wait a moment and try again.")
      return
    }
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    canvas.width = w
    canvas.height = h
    ctx.drawImage(video, 0, 0, w, h)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92)
    const accepted = await tryAddPhoto(index, dataUrl)
    if (accepted) {
      setCameraOpen(null)
      stopCamera()
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = uploadTarget
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || index === null) {
      setUploadTarget(null)
      return
    }
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoError("Format must be JPG or PNG.")
      return
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoError("Image size must be max 2MB.")
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      await tryAddPhoto(index, dataUrl)
    } catch {
      setPhotoError("Failed to read file.")
    } finally {
      setUploadTarget(null)
    }
  }

  const removePhoto = (memberIndex: number, photoIndex: number) => {
    const member = { ...defaultGroupMember(), ...members[memberIndex] }
    const photos = (member.photos ?? []).filter((_, i) => i !== photoIndex)
    const next = [...members]
    next[memberIndex] = { ...member, photos }
    onMembersChange(next)
  }

  const setMember = (index: number, patch: Partial<GroupVisitMember>) => {
    const next = [...members]
    next[index] = { ...defaultGroupMember(), ...next[index], ...patch }
    onMembersChange(next)
  }

  return (
    <div className="space-y-4 border-t border-border pt-6">
      <input
        ref={imageInputRef}
        type="file"
        accept={ALLOWED_PHOTO_TYPES.join(",")}
        className="sr-only"
        onChange={(e) => void handlePhotoUpload(e)}
        aria-hidden
      />

      <div className="space-y-4">
        <div>
          <Label className="text-[22px] font-bold text-foreground">Group visit</Label>
          <p className="mt-1 text-sm text-muted-foreground">
            One shared QR code for the whole group. Enter the leader above, then each additional
            person below with photo and details.
          </p>
        </div>

        <div className="max-w-xs space-y-2">
          <Label className="text-sm font-medium">
            Total people in group <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            min={MIN_GROUP_PARTY_SIZE}
            max={MAX_GROUP_PARTY_SIZE}
            inputMode="numeric"
            value={sizeInput}
            onChange={(e) => {
              setSizeInput(e.target.value)
              const n = parseInt(e.target.value, 10)
              if (!Number.isNaN(n) && n >= MIN_GROUP_PARTY_SIZE && n <= MAX_GROUP_PARTY_SIZE) {
                applyPartySize(e.target.value)
              }
            }}
            onBlur={() => {
              const n = parseInt(sizeInput, 10)
              if (Number.isNaN(n) || n < MIN_GROUP_PARTY_SIZE) {
                applyPartySize(String(MIN_GROUP_PARTY_SIZE))
              } else if (n > MAX_GROUP_PARTY_SIZE) {
                applyPartySize(String(MAX_GROUP_PARTY_SIZE))
              } else {
                applyPartySize(sizeInput)
              }
            }}
            className="h-10"
            placeholder={`${MIN_GROUP_PARTY_SIZE}–${MAX_GROUP_PARTY_SIZE}`}
          />
          <p className="text-xs text-muted-foreground">
            Includes the group leader ({MIN_GROUP_PARTY_SIZE}–{MAX_GROUP_PARTY_SIZE} people).
          </p>
        </div>
      </div>

      <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-[#1C398E]">
        Primary visitor above is the <strong>group leader</strong>. All {partySize} people share one
        QR pass at check-in.
      </p>

      <div className="space-y-6">
        {members.map((m, index) => {
          const member = { ...defaultGroupMember(), ...m }
          const memberPhotos = Array.isArray(member.photos) ? member.photos : []
          return (
            <div key={index} className="rounded-lg border border-border bg-muted/10 p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Group member {index + 2} of {partySize}
                </span>
              </div>

              <div className="mb-6 space-y-2">
                <Label className="text-base font-medium">Photograph</Label>
                <div className="flex flex-col items-start gap-4 sm:flex-row">
                  <div className="flex max-w-[280px] shrink-0 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 px-3 py-6">
                    {cameraOpen !== index ? (
                      <>
                        <Camera className="h-8 w-8 text-primary" />
                        <p className="text-center text-xs text-muted-foreground">
                          Face photo required (max {MAX_GROUP_MEMBER_PHOTOS})
                        </p>
                        <Button
                          type="button"
                          className="w-full"
                          disabled={photoValidating || memberPhotos.length >= MAX_GROUP_MEMBER_PHOTOS}
                          onClick={() => {
                            setCameraOpen(index)
                            setPhotoError(null)
                          }}
                        >
                          Capture from camera
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          disabled={photoValidating || memberPhotos.length >= MAX_GROUP_MEMBER_PHOTOS}
                          onClick={() => {
                            setUploadTarget(index)
                            setPhotoError(null)
                            setTimeout(() => imageInputRef.current?.click(), 0)
                          }}
                        >
                          Upload Photo
                        </Button>
                      </>
                    ) : (
                      <div className="w-full space-y-2">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="max-h-40 w-full rounded-md bg-muted object-cover"
                        />
                        <canvas ref={canvasRef} className="hidden" />
                        {cameraError && (
                          <p className="text-center text-sm text-destructive">{cameraError}</p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            className="flex-1"
                            disabled={cameraLoading || photoValidating}
                            onClick={() => void captureFromCamera()}
                          >
                            {photoValidating ? "Checking…" : "Take photo"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setCameraOpen(null)
                              setCameraError(null)
                              stopCamera()
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                    {photoError && cameraOpen !== index && (
                      <p className="text-center text-sm text-destructive">{photoError}</p>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="mb-2 text-sm text-muted-foreground">Captured images</p>
                    <div className="flex gap-2 overflow-x-auto">
                      {Array.from({ length: MAX_GROUP_MEMBER_PHOTOS }, (_, i) => (
                        <div key={i} className="relative h-24 w-20 shrink-0">
                          {memberPhotos[i] ? (
                            <>
                              <img
                                src={memberPhotos[i]}
                                alt=""
                                className="h-full w-full rounded border object-cover"
                              />
                              <button
                                type="button"
                                className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                                onClick={() => removePhoto(index, i)}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                              {i + 1}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={member.name}
                    onChange={(e) => setMember(index, { name: e.target.value })}
                    placeholder="Full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select
                    value={member.gender || undefined}
                    onValueChange={(v) => setMember(index, { gender: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    CNIC <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={member.cnicOrBForm}
                    onChange={(e) => setMember(index, { cnicOrBForm: e.target.value })}
                    placeholder="00000-0000000-0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Passport</Label>
                  <Input
                    value={member.passportNumber}
                    onChange={(e) => setMember(index, { passportNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nationality</Label>
                  <Select
                    value={member.nationality || undefined}
                    onValueChange={(v) => setMember(index, { nationality: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nationality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pakistani">Pakistani</SelectItem>
                      <SelectItem value="american">American</SelectItem>
                      <SelectItem value="british">British</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date of birth</Label>
                  <Input
                    type="date"
                    value={member.dateOfBirth}
                    onChange={(e) => setMember(index, { dateOfBirth: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Mobile <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={member.mobileNumber}
                    onChange={(e) => setMember(index, { mobileNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={member.emailAddress}
                    onChange={(e) => setMember(index, { emailAddress: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Input
                    value={member.organizationName}
                    onChange={(e) => setMember(index, { organizationName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <Input
                    value={member.designation}
                    onChange={(e) => setMember(index, { designation: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Address</Label>
                  <Textarea
                    value={member.residentialAddress}
                    onChange={(e) => setMember(index, { residentialAddress: e.target.value })}
                    className="min-h-16 resize-none"
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
