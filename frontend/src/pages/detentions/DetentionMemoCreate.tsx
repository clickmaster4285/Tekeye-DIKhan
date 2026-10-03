import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft, ChevronDown, Plus, Trash2, Copy, Camera, X } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ROUTES, getDetentionMemoDetailPath, getDetentionMemoListPath, getDetentionMemoScanUrl, getDetentionMemoSectionCrumb } from "@/routes/config"
import { CUSTOMS_STATIONS } from "@/lib/case-fir-spec"
import { toast } from "@/hooks/use-toast"
import { firstMissingField, reportMissingField } from "@/lib/form-missing-field"
import { cn } from "@/lib/utils"
import { GoodsQrDisplay, getGoodsQrImageUrl } from "@/components/goods/goods-qr-display"
import {
  GoodsLineTextField,
  GoodsTableColGroup,
  GOODS_TABLE_MIN_WIDTH,
  goodsControlCellClass,
  goodsControlWrapClass,
  goodsHeadClass,
  goodsLineCellClass,
  goodsPlaceholderClass,
  goodsSelectTriggerClass,
  goodsTableClass,
} from "@/components/goods/goods-line-text-field"
import { getStoredUser } from "@/lib/auth"
import {
  createDetentionMemo,
  fetchDetentionMemoById,
  updateDetentionMemo,
  type DetentionMemoApiRecord,
  type LocatedCameraApi,
} from "@/lib/detention-memo-api"
import { useCameras } from "@/hooks/use-cameras"
import type { CameraRecord } from "@/lib/cameras-api"
import {
  canUserFullyEditSeizureDocs,
  fetchNoteSheetById,
  fetchNoteSheets,
  linkNoteSheetToDetention,
  type NoteSheetRecord,
} from "@/lib/seizure-management-api"

const DETENTION_TYPES = ["Claimed", "Un-Claimed"] as const
const REASONS = [
  "Verification of Documents",
  "Inability to pay duty and taxes",
  "Pending clearance from Customs",
  "Pending Examination",
  "Pending Departure",
  "Unclaimed",
  "Others",
] as const
const WAREHOUSES = [
  "State Warehouse, Kohat Tunnel",
  "State Warehouse, Bannu",
  "State Warehouse, Salt House, Kohat",
  "State Warehouse, D.I Khan",
] as const
const SELECT_WAREHOUSE_PLACEHOLDER = "__select_warehouse__"
const DIRECTORATES = ["MCC D.I Khan AFU Import", "MCC Peshawar", "MCC YARIK", "MCC DI Khan"] as const
const GOODS_CONDITIONS = ["Seized", "Detained", "Under Examination", "Pending Clearance", "Unclaimed"] as const
const GOODS_UNITS = ["PCS", "KGS", "LTR", "MTR", "CTN", "BOX", "BAG", "DOZ", "SET", "Other"] as const

function sanitizeCnicInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 13)
}

function isValidCnic(value: string): boolean {
  return /^\d{13}$/.test(value)
}

function generateUniqueQrCodeNumber(): string {
  return `QR-DM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

const getQrCodeUrl = getGoodsQrImageUrl

function generateMemoQrCodeNumber(): string {
  return `DM-MEMO-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

export type GoodsLineItem = {
  id: string
  qrCodeNumber: string
  description: string
  pctCode: string
  quantity: string
  unit: string
  condition: string
  assessableValuePkr: string
  identificationRef: string
  itemNotes: string
  perishable: boolean
  images: string[]
  imageFiles: File[]
  /** Camera zone used to filter the located-camera list. */
  locatedZone: string
  /** Camera DB id where this item was located/detected. */
  locatedCameraId: number | null
  /** Cached camera details for display (name, zone, …). */
  locatedCamera?: LocatedCameraApi | null
  detectedAt: string
  detectionEventId: number | null
}

const emptyGoodsItem = (): GoodsLineItem => ({
  id: `gi-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  qrCodeNumber: generateUniqueQrCodeNumber(),
  description: "",
  pctCode: "",
  quantity: "",
  unit: "PCS",
  condition: "Seized",
  assessableValuePkr: "",
  identificationRef: "",
  itemNotes: "",
  perishable: false,
  images: [],
  imageFiles: [],
  locatedZone: "",
  locatedCameraId: null,
  detectedAt: "",
  detectionEventId: null,
})

function normalizeLocationKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "")
}

function camerasForDetentionLocation(
  cameras: CameraRecord[],
  locationOfDetention: string
): CameraRecord[] {
  const active = cameras.filter((c) => c.is_active)
  const key = normalizeLocationKey(locationOfDetention)
  if (!key) return active
  return active.filter((c) => {
    const loc = normalizeLocationKey(c.location || c.site_code || "")
    const site = normalizeLocationKey(c.site_name || "")
    return loc.includes(key) || key.includes(loc) || site.includes(key) || key.includes(site)
  })
}

function uniqueCameraZones(cameras: CameraRecord[]): string[] {
  const zones = new Set<string>()
  for (const cam of cameras) {
    const z = (cam.zone || "").trim()
    if (z) zones.add(z)
  }
  return Array.from(zones).sort((a, b) => a.localeCompare(b))
}

function camerasForZone(cameras: CameraRecord[], zone: string): CameraRecord[] {
  const z = zone.trim().toLowerCase()
  if (!z) return []
  return cameras.filter((c) => (c.zone || "").trim().toLowerCase() === z)
}

function cameraOptionLabel(cam: CameraRecord): string {
  return (cam.name || "").trim() || cam.code || "Camera"
}

function noteSheetDateTime(value: string | undefined | null): string {
  if (!value?.trim()) return ""
  return value.trim().replace("T", " ").slice(0, 16)
}

function goodsFromNoteSheet(ns: NoteSheetRecord): GoodsLineItem[] {
  if (!ns.items?.length) return []
  return ns.items
    .filter(
      (it) =>
        (it.product || it.description || "").trim() ||
        it.quantity.trim()
    )
    .map((it) => ({
      ...emptyGoodsItem(),
      description: it.product || it.description || "",
      pctCode: "",
      quantity: it.quantity || "",
      unit: it.unit?.trim() || "PCS",
      condition: it.condition || "Detained",
      assessableValuePkr: "",
      identificationRef: it.identificationRef || "",
      itemNotes: it.remarks || it.itemNotes || "",
      perishable: Boolean(it.perishable),
      images: it.images || [],
      imageFiles: [],
      ...(it.qrCodeNumber ? { qrCodeNumber: it.qrCodeNumber } : {}),
    }))
}

export default function DetentionMemoCreatePage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { id: editId } = useParams<{ id?: string }>()
  const isEdit = Boolean(editId)
  const listPath = getDetentionMemoListPath(pathname)
  const listSection = getDetentionMemoSectionCrumb(pathname)
  const [searchParams] = useSearchParams()
  const noteSheetIdParam = searchParams.get("noteSheetId")?.trim() || ""
  const [noteSheetId, setNoteSheetId] = useState(noteSheetIdParam)
  const [availableNoteSheets, setAvailableNoteSheets] = useState<NoteSheetRecord[]>([])
  const [linkedNoteSheet, setLinkedNoteSheet] = useState<NoteSheetRecord | null>(null)
  const [existingMemo, setExistingMemo] = useState<DetentionMemoApiRecord | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(isEdit)
  const [caseNo, setCaseNo] = useState("")
  const [dateTimeOccurrence, setDateTimeOccurrence] = useState(() => {
    const d = new Date()
    return d.toISOString().slice(0, 16).replace("T", " ")
  })
  const [placeOfOccurrence, setPlaceOfOccurrence] = useState("")
  const [dateTimeDetention, setDateTimeDetention] = useState(() => {
    const d = new Date()
    return d.toISOString().slice(0, 16).replace("T", " ")
  })
  const [placeOfDetention, setPlaceOfDetention] = useState("")
  const [detentionType, setDetentionType] = useState("")
  const [referenceNumber, setReferenceNumber] = useState("")
  const [directorate, setDirectorate] = useState("MCC D.I Khan AFU Import")
  const [reasonForDetention, setReasonForDetention] = useState("")
  const [locationOfDetention, setLocationOfDetention] = useState("")
  const [gdNumber, setGdNumber] = useState("")
  const [whereDeposited, setWhereDeposited] = useState(SELECT_WAREHOUSE_PLACEHOLDER)
  const [searchChassisNumber, setSearchChassisNumber] = useState("")
  const [receiptOfficer, setReceiptOfficer] = useState("")
  const [settlementStatus, setSettlementStatus] = useState("")
  const [gdNumber2] = useState("")
  const [verificationStatus, setVerificationStatus] = useState("")
  const [briefFacts, setBriefFacts] = useState("")
  const [forwardingOfficerRemarks, setForwardingOfficerRemarks] = useState("")
  // Owner fields
  const [ownerName, setOwnerName] = useState("")
  const [ownerCnic, setOwnerCnic] = useState("")
  const [ownerContact, setOwnerContact] = useState("")
  const [ownerPhotoFile, setOwnerPhotoFile] = useState<File | null>(null)
  const [ownerPhotoPreviewUrl, setOwnerPhotoPreviewUrl] = useState<string | null>(null)
  // Driver fields
  const [driverName, setDriverName] = useState("")
  const [driverCnic, setDriverCnic] = useState("")
  const [driverContact, setDriverContact] = useState("")
  const [driverPhotoFile, setDriverPhotoFile] = useState<File | null>(null)
  const [driverPhotoPreviewUrl, setDriverPhotoPreviewUrl] = useState<string | null>(null)
  // Documents & videos (uploaded to server with memo)
  const [documentFiles, setDocumentFiles] = useState<File[]>([])
  const [videoFiles, setVideoFiles] = useState<File[]>([])
  // Purpose of Detention (rich text)
  const [purposeOfDetention, setPurposeOfDetention] = useState("")
  // Goods items
  const [goodsItems, setGoodsItems] = useState<GoodsLineItem[]>([])
  const [seizingOfficerNotes, setSeizingOfficerNotes] = useState("")
  const [examiningOfficerNotes, setExaminingOfficerNotes] = useState("")
  const [detentionNotes, setDetentionNotes] = useState("")
  // QR preview dialog
  const [previewQrData, setPreviewQrData] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")
  const [invalidField, setInvalidField] = useState("")

  const { cameras: allCameras } = useCameras({ activeOnly: true, allocatedOnly: true })
  const locationCameras = useMemo(
    () => camerasForDetentionLocation(allCameras, locationOfDetention),
    [allCameras, locationOfDetention]
  )
  const availableZones = useMemo(() => uniqueCameraZones(locationCameras), [locationCameras])

  // If location/zone list changes, drop cameras that no longer belong.
  useEffect(() => {
    setGoodsItems((prev) =>
      prev.map((item) => {
        if (item.locatedCameraId == null) return item
        const cam = locationCameras.find((c) => c.id === item.locatedCameraId)
        if (!cam) return { ...item, locatedCameraId: null, locatedZone: item.locatedZone }
        const zone = (cam.zone || "").trim()
        if (item.locatedZone && zone && item.locatedZone !== zone) {
          return { ...item, locatedCameraId: null }
        }
        return item.locatedZone ? item : { ...item, locatedZone: zone }
      })
    )
  }, [locationCameras])

  useEffect(() => {
    return () => {
      if (ownerPhotoPreviewUrl) URL.revokeObjectURL(ownerPhotoPreviewUrl)
      if (driverPhotoPreviewUrl) URL.revokeObjectURL(driverPhotoPreviewUrl)
    }
  }, [ownerPhotoPreviewUrl, driverPhotoPreviewUrl])

  useEffect(() => {
    if (!editId) return
    if (!canUserFullyEditSeizureDocs(getStoredUser()?.role)) {
      toast({
        title: "Not allowed",
        description: "Only Super Admin or Location Admin can edit detention memos.",
        variant: "destructive",
      })
      navigate(getDetentionMemoDetailPath(editId, pathname))
      return
    }
    let cancelled = false
    setLoadingEdit(true)
    fetchDetentionMemoById(editId)
      .then((memo) => {
        if (cancelled) return
        setExistingMemo(memo)
        setCaseNo(memo.caseNo || "")
        setReferenceNumber(memo.referenceNumber || "")
        setDateTimeOccurrence(memo.dateTimeOccurrence || "")
        setPlaceOfOccurrence(memo.placeOfOccurrence || "")
        setDateTimeDetention(memo.dateTimeDetention || "")
        setPlaceOfDetention(memo.placeOfDetention || "")
        setDetentionType(memo.detentionType || "")
        setDirectorate(memo.directorate || "MCC D.I Khan AFU Import")
        setReasonForDetention(memo.reasonForDetention || "")
        setLocationOfDetention(memo.locationOfDetention || "")
        setGdNumber(memo.gdNumber || "")
        setWhereDeposited(memo.whereDeposited || SELECT_WAREHOUSE_PLACEHOLDER)
        setSearchChassisNumber(memo.searchChassisNumber || "")
        setReceiptOfficer(memo.receiptOfficer || "")
        setSettlementStatus(memo.settlementStatus || "")
        setVerificationStatus(memo.verificationStatus || "")
        setBriefFacts(memo.briefFacts || "")
        setForwardingOfficerRemarks(memo.forwardingOfficerRemarks || "")
        setPurposeOfDetention(memo.purposeOfDetention || "")
        setOwnerName(memo.owner?.name || "")
        setOwnerCnic(sanitizeCnicInput(memo.owner?.cnic || ""))
        setOwnerContact(memo.owner?.contact || "")
        setDriverName(memo.driver?.name || "")
        setDriverCnic(sanitizeCnicInput(memo.driver?.cnic || ""))
        setDriverContact(memo.driver?.contact || "")
        setSeizingOfficerNotes(memo.seizingOfficerNotes || "")
        setExaminingOfficerNotes(memo.examiningOfficerNotes || "")
        setDetentionNotes(memo.detentionNotes || "")
        setGoodsItems(
          (memo.goodsItems || []).map((g) => ({
            ...emptyGoodsItem(),
            id: g.id || crypto.randomUUID(),
            qrCodeNumber: g.qrCodeNumber || "",
            description: g.description || "",
            quantity: g.quantity || "",
            unit: g.unit || "PCS",
            condition: g.condition || "Detained",
            identificationRef: g.identificationRef || "",
            itemNotes: g.itemNotes || "",
            perishable: Boolean(g.perishable),
            images: g.images || [],
            imageFiles: [],
            locatedCameraId: g.locatedCameraId ?? g.locatedCamera?.id ?? null,
            locatedCamera: g.locatedCamera ?? null,
            locatedZone: g.locatedCamera?.zone || "",
            detectedAt: g.detectedAt || "",
            detectionEventId: g.detectionEventId ?? null,
          }))
        )
      })
      .catch((e) => {
        if (cancelled) return
        toast({
          title: "Failed to load detention memo",
          description: e instanceof Error ? e.message : "Not found",
          variant: "destructive",
        })
        navigate(listPath)
      })
      .finally(() => {
        if (!cancelled) setLoadingEdit(false)
      })
    return () => {
      cancelled = true
    }
  }, [editId, navigate, pathname, listPath])

  const applyNoteSheetPrefill = (ns: NoteSheetRecord) => {
    setLinkedNoteSheet(ns)
    setNoteSheetId(ns.id)
    if (ns.caseNo) setCaseNo(ns.caseNo)
    if (ns.accusedName) setOwnerName(ns.accusedName)
    if (ns.accusedCnic) setOwnerCnic(sanitizeCnicInput(ns.accusedCnic))
    if (ns.accusedMobile) setOwnerContact(ns.accusedMobile)
    const place = ns.placeOfInspection || ns.warehouseShop || ""
    if (place) {
      setPlaceOfOccurrence(place)
      setPlaceOfDetention(place)
      setLocationOfDetention(ns.warehouseShop || place)
    }
    const inspectionDt = noteSheetDateTime(ns.inspectionDate || ns.dateTime)
    if (inspectionDt) {
      setDateTimeOccurrence(inspectionDt)
      setDateTimeDetention(inspectionDt)
    }
    if (ns.groundsOfSuspicion) {
      setReasonForDetention("Others")
    }
    const findings =
      [ns.preliminaryFindings, ns.content, ns.groundsOfSuspicion].filter((x) => x?.trim()).join("\n\n") ||
      ""
    if (findings) {
      setBriefFacts(findings)
      setPurposeOfDetention(findings)
    }
    if (ns.preparedBy) setReceiptOfficer(ns.preparedBy)
    const goods = goodsFromNoteSheet(ns)
    if (goods.length) setGoodsItems(goods)
  }

  useEffect(() => {
    fetchNoteSheets({ available: true })
      .then((list) => {
        setAvailableNoteSheets(list)
        if (noteSheetIdParam && !list.find((n) => n.id === noteSheetIdParam)) {
          fetchNoteSheetById(noteSheetIdParam)
            .then((ns) => applyNoteSheetPrefill(ns))
            .catch(() => undefined)
        } else if (noteSheetIdParam) {
          const ns = list.find((n) => n.id === noteSheetIdParam)
          if (ns) applyNoteSheetPrefill(ns)
        } else if (list.length === 1) {
          applyNoteSheetPrefill(list[0])
        }
      })
      .catch(() => setAvailableNoteSheets([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount / noteSheetIdParam
  }, [noteSheetIdParam])

  const addGoodsLine = () => setGoodsItems((prev) => [...prev, emptyGoodsItem()])
  const removeGoodsLine = (id: string) => setGoodsItems((prev) => prev.filter((i) => i.id !== id))
  const updateGoodsLine = (
    id: string,
    field: keyof GoodsLineItem,
    value: string | boolean | File[]
  ) => {
    setGoodsItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)))
  }

  const handleOwnerPictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setOwnerPhotoFile(file ?? null)
    if (ownerPhotoPreviewUrl) URL.revokeObjectURL(ownerPhotoPreviewUrl)
    setOwnerPhotoPreviewUrl(file ? URL.createObjectURL(file) : null)
    e.target.value = ""
  }
  const clearOwnerPhoto = () => {
    setOwnerPhotoFile(null)
    if (ownerPhotoPreviewUrl) URL.revokeObjectURL(ownerPhotoPreviewUrl)
    setOwnerPhotoPreviewUrl(null)
  }
  const handleDriverPictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setDriverPhotoFile(file ?? null)
    if (driverPhotoPreviewUrl) URL.revokeObjectURL(driverPhotoPreviewUrl)
    setDriverPhotoPreviewUrl(file ? URL.createObjectURL(file) : null)
    e.target.value = ""
  }
  const clearDriverPhoto = () => {
    setDriverPhotoFile(null)
    if (driverPhotoPreviewUrl) URL.revokeObjectURL(driverPhotoPreviewUrl)
    setDriverPhotoPreviewUrl(null)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied!", description: "QR code number copied to clipboard." })
  }

  const handleSave = async () => {
    setFormError("")
    const normalizedOwnerCnic = ownerCnic.trim()
    const normalizedDriverCnic = driverCnic.trim()
    const missing = firstMissingField([
      {
        id: "dm-note-sheet",
        label: "Approved Note Sheet",
        missing: !isEdit && !noteSheetId,
        message: "Select an approved note sheet before creating the detention memo.",
      },
      {
        id: "dm-datetime-detention",
        label: "Date/time of detention",
        missing: !dateTimeDetention.trim(),
      },
      {
        id: "dm-place-detention",
        label: "Place of detention",
        missing: !placeOfDetention.trim(),
      },
      {
        id: "dm-reason",
        label: "Reason for detention",
        missing: !reasonForDetention.trim(),
      },
      {
        id: "dm-owner-cnic",
        label: "Owner CNIC",
        title: "Invalid Owner CNIC",
        missing: Boolean(normalizedOwnerCnic) && !isValidCnic(normalizedOwnerCnic),
        message: "Owner CNIC must be exactly 13 digits (without dashes).",
      },
      {
        id: "dm-driver-cnic",
        label: "Driver CNIC",
        title: "Invalid Driver CNIC",
        missing: Boolean(normalizedDriverCnic) && !isValidCnic(normalizedDriverCnic),
        message: "Driver CNIC must be exactly 13 digits (without dashes).",
      },
      {
        id: "dm-goods",
        label: "Description of Goods",
        missing: !goodsItems.some((g) => g.description.trim()),
        message: "Add at least one goods line with a description.",
      },
    ])
    if (missing) {
      setInvalidField(missing.id)
      setFormError(missing.message ?? `${missing.label} is required`)
      reportMissingField(missing)
      return
    }
    setInvalidField("")

    const currentUser = getStoredUser()
    const memoQrCodeNumber = isEdit
      ? existingMemo?.memoQrCodeNumber || generateMemoQrCodeNumber()
      : generateMemoQrCodeNumber()
    const payload: Record<string, unknown> = {
      caseNo: caseNo || `DM-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      referenceNumber,
      dateTimeOccurrence,
      placeOfOccurrence,
      dateTimeDetention,
      placeOfDetention,
      detentionType,
      directorate,
      reasonForDetention,
      locationOfDetention,
      gdNumber,
      gdNumber2,
      whereDeposited: whereDeposited === SELECT_WAREHOUSE_PLACEHOLDER ? "" : whereDeposited,
      searchChassisNumber,
      receiptOfficer,
      settlementStatus,
      verificationStatus,
      briefFacts,
      forwardingOfficerRemarks,
      purposeOfDetention,
      owner: { name: ownerName, cnic: normalizedOwnerCnic, contact: ownerContact },
      driver: { name: driverName, cnic: normalizedDriverCnic, contact: driverContact },
      goodsItems: goodsItems.map((item) => ({
        id: item.id,
        qrCodeNumber: item.qrCodeNumber,
        description: item.description,
        // PCT / assessable value are assessment-stage fields — not captured on detention memo
        pctCode: "",
        quantity: item.quantity,
        unit: item.unit,
        condition: item.condition,
        assessableValuePkr: "",
        identificationRef: item.identificationRef,
        itemNotes: item.itemNotes,
        perishable: item.perishable,
        images: item.images || [],
        locatedCameraId: item.locatedCameraId,
        detectedAt: item.detectedAt || "",
        detectionEventId: item.detectionEventId,
      })),
      seizingOfficerNotes,
      examiningOfficerNotes,
      detentionNotes,
      createdBy:
        existingMemo?.createdBy ||
        (currentUser?.full_name || "").trim() ||
        currentUser?.username?.trim() ||
        "ASO Portal",
      updatedBy:
        (currentUser?.full_name || "").trim() || currentUser?.username?.trim() || "ASO Portal",
      memoQrCodeNumber,
      memoQrCodePayload: isEdit && existingMemo?.id
        ? getDetentionMemoScanUrl(existingMemo.id)
        : existingMemo?.memoQrCodePayload || "",
      clientOrigin: window.location.origin,
    }

    // Collect goods images
    const goodsImagesMap: Record<string, File[]> = {}
    for (const item of goodsItems) {
      if (item.imageFiles && item.imageFiles.length > 0) {
        goodsImagesMap[item.id] = item.imageFiles
      }
    }

    setSaving(true)
    try {
      if (isEdit && existingMemo) {
        await updateDetentionMemo(existingMemo, payload)
        toast({ title: "Updated", description: "Detention memo saved." })
        navigate(getDetentionMemoDetailPath(existingMemo.id, pathname))
        return
      }

      const created = await createDetentionMemo(payload, {
        ownerPhoto: ownerPhotoFile,
        driverPhoto: driverPhotoFile,
        documents: documentFiles,
        videos: videoFiles,
        goodsImages: goodsImagesMap,
      })
      try {
        await linkNoteSheetToDetention(noteSheetId, created.id)
      } catch (linkErr) {
        const msg = linkErr instanceof Error ? linkErr.message : "Link failed"
        setFormError(msg)
        toast({
          title: "Memo saved, but note sheet link failed",
          description: msg,
          variant: "destructive",
        })
        navigate(listPath)
        return
      }
      toast({ title: "Saved", description: "Detention memo saved and linked to approved note sheet." })
      navigate(listPath)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save detention memo."
      console.error("Detention memo save failed", e)
      setFormError(msg)
      toast({
        title: "Save failed",
        description: msg,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = () => {
    void handleSave()
  }

  if (loadingEdit) {
    return (
      <ModulePageLayout
        title="Edit Detention Memo"
        description="Loading detention memo…"
        breadcrumbs={[
          listSection,
          { label: "Detention Memo", href: listPath },
          { label: "Edit" },
        ]}
      >
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      </ModulePageLayout>
    )
  }

  return (
    <ModulePageLayout
      title={isEdit ? "Edit Detention Memo" : "Detention Memo / Create"}
      description={
        isEdit
          ? "Update detention memo fields. Super Admin and Location Admin can edit any memo."
          : "Add a new detention memo (prepared after the detention). All fields as per Pakistan Customs detention memo. Data is saved to the server database."
      }
      breadcrumbs={[
        listSection,
        { label: "Detention Memo", href: listPath },
        { label: isEdit ? "Edit" : "Create" },
      ]}
    >
      <div className="w-full min-h-[calc(100vh-12rem)] overflow-y-auto">
        <div className="mb-4 flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={isEdit && editId ? getDetentionMemoDetailPath(editId, pathname) : listPath}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {isEdit ? "Back to memo" : "Back to list"}
            </Link>
          </Button>
        </div>
        {!isEdit ? (
          <p className="mb-4 text-sm text-muted-foreground rounded-md bg-muted/60 px-3 py-2 border border-border/50">
            Detention memo is created only after an approved note sheet. Upload supporting documents below.
          </p>
        ) : null}

        {!isEdit ? (
        <Card className="mb-6 border-blue-100 bg-blue-50/40">
          <CardContent className="pt-6 space-y-3">
            <Label htmlFor="dm-note-sheet">Approved Note Sheet <span className="text-red-600">*</span></Label>
            <Select
              value={noteSheetId || undefined}
              onValueChange={(v) => {
                setFormError("")
                if (invalidField === "dm-note-sheet") setInvalidField("")
                const ns =
                  availableNoteSheets.find((n) => n.id === v) ||
                  (linkedNoteSheet?.id === v ? linkedNoteSheet : null)
                if (ns) {
                  applyNoteSheetPrefill(ns)
                } else {
                  setNoteSheetId(v)
                  fetchNoteSheetById(v)
                    .then((full) => applyNoteSheetPrefill(full))
                    .catch(() => undefined)
                }
              }}
            >
              <SelectTrigger
                id="dm-note-sheet"
                className="w-full"
                aria-invalid={invalidField === "dm-note-sheet"}
              >
                <SelectValue placeholder="Select approved note sheet" />
              </SelectTrigger>
              <SelectContent>
                {linkedNoteSheet && !availableNoteSheets.find((n) => n.id === linkedNoteSheet.id) && (
                  <SelectItem value={linkedNoteSheet.id}>
                    {linkedNoteSheet.noteSheetNo || linkedNoteSheet.referenceNumber || linkedNoteSheet.subject} ({linkedNoteSheet.status})
                  </SelectItem>
                )}
                {availableNoteSheets.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.noteSheetNo || n.referenceNumber || n.subject || n.id} — {n.preparedBy || "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableNoteSheets.length === 0 && !linkedNoteSheet && (
              <p className="text-sm text-amber-800">
                No approved note sheets available.{" "}
                <Link to={ROUTES.SEIZURE_MGMT_NOTE_SHEET} className="text-primary underline">
                  Create / approve a note sheet
                </Link>{" "}
                first.
              </p>
            )}
          </CardContent>
        </Card>
        ) : null}

        <div className="space-y-4 w-full">
          {/* Basic Information */}
          <Collapsible defaultOpen>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer flex flex-row items-center justify-between hover:bg-muted/50 rounded-t-lg">
                  <CardTitle className="text-base">Basic Information</CardTitle>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Case No.</Label>
                    <Input value={caseNo} onChange={(e) => setCaseNo(e.target.value)} placeholder="e.g. DM-2024-001" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Reference Number</Label>
                    <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="Reference No" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Date/Time of occurrence</Label>
                    <Input
                      type="datetime-local"
                      value={dateTimeOccurrence.replace(" ", "T")}
                      onChange={(e) => setDateTimeOccurrence(e.target.value.replace("T", " "))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Place of occurrence</Label>
                    <Input value={placeOfOccurrence} onChange={(e) => setPlaceOfOccurrence(e.target.value)} placeholder="Place of occurrence" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dm-datetime-detention">Date/time of detention <span className="text-red-600">*</span></Label>
                    <Input
                      id="dm-datetime-detention"
                      type="datetime-local"
                      value={dateTimeDetention.replace(" ", "T")}
                      aria-invalid={invalidField === "dm-datetime-detention"}
                      onChange={(e) => {
                        setDateTimeDetention(e.target.value.replace("T", " "))
                        if (invalidField === "dm-datetime-detention") setInvalidField("")
                      }}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dm-place-detention">Place of detention <span className="text-red-600">*</span></Label>
                    <Select
                      value={placeOfDetention}
                      onValueChange={(v) => {
                        setPlaceOfDetention(v)
                        if (invalidField === "dm-place-detention") setInvalidField("")
                      }}
                    >
                      <SelectTrigger id="dm-place-detention" className="w-full" aria-invalid={invalidField === "dm-place-detention"}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {CUSTOMS_STATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    {/* <Label>Detention Type</Label>
                    <Select value={detentionType} onValueChange={setDetentionType}>
                      <SelectTrigger><SelectValue placeholder="Select Detention Type" /></SelectTrigger>
                      <SelectContent>
                        {DETENTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select> */}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Owner & Driver Details */}
          <Collapsible>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer flex flex-row items-center justify-between hover:bg-muted/50 rounded-t-lg">
                  <CardTitle className="text-base">Owner & Driver Details (Optional)</CardTitle>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-6">
                  {/* Owner Section */}
                  <div>
                    <h4 className="font-medium text-sm mb-3">Owner</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Owner Name</Label>
                        <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Full name" />
                      </div>
                      <div className="grid gap-2">
                        <Label>CNIC</Label>
                        <Input
                          id="dm-owner-cnic"
                          value={ownerCnic}
                          aria-invalid={invalidField === "dm-owner-cnic"}
                          onChange={(e) => {
                            setOwnerCnic(sanitizeCnicInput(e.target.value))
                            if (invalidField === "dm-owner-cnic") setInvalidField("")
                          }}
                          placeholder="13 digits (e.g. 1234512345671)"
                          inputMode="numeric"
                          maxLength={13}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Contact</Label>
                        <Input value={ownerContact} onChange={(e) => setOwnerContact(e.target.value)} placeholder="Phone number" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Picture</Label>
                        <Input type="file" accept="image/*" onChange={handleOwnerPictureChange} />
                        {ownerPhotoPreviewUrl && (
                          <div className="mt-2 flex items-center gap-2">
                            <img src={ownerPhotoPreviewUrl} alt="Owner" className="h-12 w-12 rounded object-cover border" />
                            <Button variant="ghost" size="sm" type="button" onClick={clearOwnerPhoto}>Remove</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Driver Section */}
                  <div>
                    <h4 className="font-medium text-sm mb-3">Driver</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Driver Name</Label>
                        <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Full name" />
                      </div>
                      <div className="grid gap-2">
                        <Label>CNIC</Label>
                        <Input
                          id="dm-driver-cnic"
                          value={driverCnic}
                          aria-invalid={invalidField === "dm-driver-cnic"}
                          onChange={(e) => {
                            setDriverCnic(sanitizeCnicInput(e.target.value))
                            if (invalidField === "dm-driver-cnic") setInvalidField("")
                          }}
                          placeholder="13 digits (e.g. 1234512345671)"
                          inputMode="numeric"
                          maxLength={13}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Contact</Label>
                        <Input value={driverContact} onChange={(e) => setDriverContact(e.target.value)} placeholder="Phone number" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Picture</Label>
                        <Input type="file" accept="image/*" onChange={handleDriverPictureChange} />
                        {driverPhotoPreviewUrl && (
                          <div className="mt-2 flex items-center gap-2">
                            <img src={driverPhotoPreviewUrl} alt="Driver" className="h-12 w-12 rounded object-cover border" />
                            <Button variant="ghost" size="sm" type="button" onClick={clearDriverPhoto}>Remove</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Detention Information */}
          <Collapsible defaultOpen>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer flex flex-row items-center justify-between hover:bg-muted/50 rounded-t-lg">
                  <CardTitle className="text-base">Detention Information</CardTitle>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Directorate <span className="text-red-600">*</span></Label>
                    <Select value={directorate} onValueChange={setDirectorate}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DIRECTORATES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dm-reason">Reason for detention <span className="text-red-600">*</span></Label>
                    <Select
                      value={reasonForDetention || undefined}
                      onValueChange={(v) => {
                        setReasonForDetention(v)
                        if (invalidField === "dm-reason") setInvalidField("")
                      }}
                    >
                      <SelectTrigger id="dm-reason" className="w-full" aria-invalid={invalidField === "dm-reason"}>
                        <SelectValue placeholder="Select Reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Location of Detention</Label>
                    <Select value={locationOfDetention} onValueChange={setLocationOfDetention}>
                      <SelectTrigger><SelectValue placeholder="Select Detention Location" /></SelectTrigger>
                      <SelectContent>
                        {CUSTOMS_STATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Good Detained at</Label>
                    <Select value={whereDeposited} onValueChange={setWhereDeposited}>
                      <SelectTrigger><SelectValue placeholder="Select Warehouse" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_WAREHOUSE_PLACEHOLDER}>Select Warehouse</SelectItem>
                        {WAREHOUSES.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Search Chassis Number</Label>
                    <div className="flex gap-2">
                      <Input value={searchChassisNumber} onChange={(e) => setSearchChassisNumber(e.target.value)} placeholder="Chassis No" />
                      <Button type="button" variant="outline" size="sm">Search</Button>
                    </div>
                  </div>
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Receipt Officer receiving Detained Goods <span className="text-red-600">*</span></Label>
                    <Input value={receiptOfficer} onChange={(e) => setReceiptOfficer(e.target.value)} placeholder="Officer name" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Settlement Status</Label>
                    <RadioGroup value={settlementStatus} onValueChange={setSettlementStatus} className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value="Fully Settled" />
                        <span>Fully Settled</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value="Partial Settled" />
                        <span>Partial Settled</span>
                      </label>
                    </RadioGroup>
                  </div>
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Docs Upload</Label>
                    <Input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
                      onChange={(e) => setDocumentFiles(Array.from(e.target.files ?? []))}
                    />
                    {documentFiles.length > 0 && (
                      <ul className="text-sm text-muted-foreground space-y-0.5 list-disc pl-5">
                        {documentFiles.map((f, i) => (
                          <li key={`${f.name}-${i}-${f.lastModified}`}>{f.name}</li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Supporting documents are uploaded with Save/Submit.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Verification Status</Label>
                    <RadioGroup value={verificationStatus} onValueChange={setVerificationStatus} className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value="Verified" />
                        <span>Verified</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value="Not Verified" />
                        <span>Not Verified</span>
                      </label>
                    </RadioGroup>
                  </div>
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Brief Facts <span className="text-red-600">*</span></Label>
                    <Textarea value={briefFacts} onChange={(e) => setBriefFacts(e.target.value)} placeholder="Brief facts of detention" rows={4} />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Purpose of Detention */}
          <Collapsible defaultOpen>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer flex flex-row items-center justify-between hover:bg-muted/50 rounded-t-lg">
                  <CardTitle className="text-base">Purpose of Detention (Rich Text)</CardTitle>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="grid gap-2">
                    <Label>Detailed purpose of detention</Label>
                    <Textarea
                      value={purposeOfDetention}
                      onChange={(e) => setPurposeOfDetention(e.target.value)}
                      placeholder="Describe the legal basis, suspected violations, or reasons for detention. Use **bold**, *italic*, - for lists (markdown accepted)."
                      rows={6}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Supports markdown: **bold**, *italic*, • lists, etc.
                    </p>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Goods Information with QR Code */}
          <Collapsible defaultOpen>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer flex flex-row items-center justify-between hover:bg-muted/50 rounded-t-lg">
                  <CardTitle className="text-base">Goods Information</CardTitle>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground mb-4">
                    List of seized/detained goods. <strong>Each item gets a unique QR code</strong> for scanning.
                    Pick <strong>Zone</strong> first, then <strong>Located Camera</strong> (name + zone).
                    Only <strong>assigned</strong> cameras (Camera Distribution) are listed.
                    {locationOfDetention
                      ? ` Location: ${locationOfDetention}.`
                      : " Select Location of Detention to load zones/cameras."}
                  </p>
                  <div
                    id="dm-goods"
                    tabIndex={-1}
                    className={
                      invalidField === "dm-goods"
                        ? "rounded-md ring-2 ring-red-500 ring-offset-2 outline-none"
                        : undefined
                    }
                  >
                  <div className="max-w-full overflow-x-auto rounded-md border border-border/70">
                    <Table
                      className={goodsTableClass}
                      containerClassName="overflow-visible"
                      style={{ minWidth: GOODS_TABLE_MIN_WIDTH, width: GOODS_TABLE_MIN_WIDTH }}
                    >
                      <GoodsTableColGroup />
                      <TableHeader>
                        <TableRow className="border-b bg-muted/40 hover:bg-muted/40">
                          <TableHead className={goodsHeadClass}>QR Code</TableHead>
                          <TableHead className={goodsHeadClass}>
                            Description <span className="normal-case text-red-600">*</span>
                          </TableHead>
                          <TableHead className={goodsHeadClass}>Qty</TableHead>
                          <TableHead className={goodsHeadClass}>Unit</TableHead>
                          <TableHead className={goodsHeadClass}>Condition</TableHead>
                          <TableHead className={cn(goodsHeadClass, "text-center")}>Perish.</TableHead>
                          <TableHead className={goodsHeadClass}>ID / Chassis</TableHead>
                          <TableHead className={goodsHeadClass}>Item Notes</TableHead>
                          <TableHead className={goodsHeadClass}>Images</TableHead>
                          <TableHead className={goodsHeadClass}>Camera Zone</TableHead>
                          <TableHead className={goodsHeadClass}>Located Camera</TableHead>
                          <TableHead className={goodsHeadClass} />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {goodsItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={12} className="text-muted-foreground text-center py-6">
                              No goods added. Click "Add line" to add seized/detained items.
                            </TableCell>
                          </TableRow>
                        ) : (
                          goodsItems.map((item, idx) => {
                            const zoneCameras = camerasForZone(locationCameras, item.locatedZone)
                            const selectedCam =
                              item.locatedCameraId != null
                                ? zoneCameras.find((c) => c.id === item.locatedCameraId) ||
                                  locationCameras.find((c) => c.id === item.locatedCameraId) ||
                                  null
                                : null
                            const cameraSelectOptions =
                              selectedCam && !zoneCameras.some((c) => c.id === selectedCam.id)
                                ? [selectedCam, ...zoneCameras]
                                : zoneCameras
                            return (
                            <TableRow key={item.id} className={idx % 2 === 1 ? "bg-muted/10" : ""}>
                              <TableCell className={goodsControlCellClass}>
                                <GoodsQrDisplay
                                  code={item.qrCodeNumber}
                                  size={72}
                                  onCopy={() => copyToClipboard(item.qrCodeNumber)}
                                  onView={() => setPreviewQrData(item.qrCodeNumber)}
                                />
                              </TableCell>
                              <TableCell className={goodsLineCellClass}>
                                <div className="min-w-0 max-w-full overflow-hidden">
                                  <GoodsLineTextField
                                    value={item.description}
                                    onChange={(e) => {
                                      updateGoodsLine(item.id, "description", e.target.value)
                                      if (invalidField === "dm-goods") setInvalidField("")
                                    }}
                                    placeholder="Description of goods"
                                    title="Description of goods"
                                    aria-invalid={invalidField === "dm-goods" && idx === 0}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className={goodsControlCellClass}>
                                <div className={goodsControlWrapClass}>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={item.quantity}
                                    onChange={(e) => updateGoodsLine(item.id, "quantity", e.target.value)}
                                    placeholder="Qty"
                                    title="Qty"
                                    className={goodsPlaceholderClass}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className={goodsControlCellClass}>
                                <div className={goodsControlWrapClass}>
                                  <Select value={item.unit} onValueChange={(v) => updateGoodsLine(item.id, "unit", v)}>
                                    <SelectTrigger className={goodsSelectTriggerClass} title="Unit">
                                      <SelectValue placeholder="Unit" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {GOODS_UNITS.map((u) => (
                                        <SelectItem key={u} value={u}>{u}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </TableCell>
                              <TableCell className={goodsControlCellClass}>
                                <div className={goodsControlWrapClass}>
                                  <Select value={item.condition} onValueChange={(v) => updateGoodsLine(item.id, "condition", v)}>
                                    <SelectTrigger className={goodsSelectTriggerClass} title="Condition">
                                      <SelectValue placeholder="Condition" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {GOODS_CONDITIONS.map((c) => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </TableCell>
                              <TableCell className={goodsControlCellClass}>
                                <div className={cn(goodsControlWrapClass, "justify-center pt-2")}>
                                  <Checkbox
                                    checked={item.perishable}
                                    onCheckedChange={(checked) => updateGoodsLine(item.id, "perishable", !!checked)}
                                    aria-label="Perishable"
                                  />
                                </div>
                              </TableCell>
                              <TableCell className={goodsControlCellClass}>
                                <div className={goodsControlWrapClass}>
                                  <Input
                                    value={item.identificationRef}
                                    onChange={(e) => updateGoodsLine(item.id, "identificationRef", e.target.value)}
                                    placeholder="Chassis / Serial"
                                    title="Chassis / Serial"
                                    className={goodsPlaceholderClass}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className={goodsLineCellClass}>
                                <div className="min-w-0 max-w-full overflow-hidden">
                                  <GoodsLineTextField
                                    value={item.itemNotes}
                                    onChange={(e) => updateGoodsLine(item.id, "itemNotes", e.target.value)}
                                    placeholder="Officer notes"
                                    title="Officer notes for this item"
                                  />
                                </div>
                              </TableCell>
                              <TableCell className={goodsControlCellClass}>
                                <div className={cn(goodsControlWrapClass, "flex-col gap-1")}>
                                  <label className="cursor-pointer inline-flex h-9 w-full items-center justify-center gap-1 rounded-md border border-input bg-background px-2 text-xs font-medium hover:bg-muted/60">
                                    <Camera className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">
                                      {item.imageFiles.length + (item.images?.length || 0)}/10
                                    </span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      multiple
                                      className="hidden"
                                      onChange={(e) => {
                                        const files = Array.from(e.target.files ?? [])
                                        const currentCount = item.imageFiles.length + (item.images?.length || 0)
                                        const availableSlots = 10 - currentCount
                                        const newFiles = files.slice(0, availableSlots)
                                        updateGoodsLine(item.id, "imageFiles", [...item.imageFiles, ...newFiles])
                                        e.target.value = ""
                                      }}
                                    />
                                  </label>
                                  {(item.imageFiles.length > 0 || (item.images?.length ?? 0) > 0) && (
                                    <div className="flex flex-wrap gap-1">
                                      {item.images?.map((imgUrl, imgIdx) => (
                                        <img key={`existing-${imgIdx}`} src={imgUrl} alt={`Goods ${imgIdx + 1}`} className="h-7 w-7 object-cover rounded border" />
                                      ))}
                                      {item.imageFiles.map((file, fileIdx) => (
                                        <div key={`new-${fileIdx}`} className="relative">
                                          <img src={URL.createObjectURL(file)} alt={`New ${fileIdx + 1}`} className="h-7 w-7 object-cover rounded border" />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newFiles = [...item.imageFiles]
                                              newFiles.splice(fileIdx, 1)
                                              updateGoodsLine(item.id, "imageFiles", newFiles)
                                            }}
                                            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                                          >
                                            <X className="h-2 w-2" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className={goodsControlCellClass}>
                                <div className={goodsControlWrapClass}>
                                  <Select
                                    value={item.locatedZone || "__none__"}
                                    onValueChange={(v) => {
                                      const zone = v === "__none__" ? "" : v
                                      setGoodsItems((prev) =>
                                        prev.map((row) =>
                                          row.id === item.id
                                            ? { ...row, locatedZone: zone, locatedCameraId: null, locatedCamera: null }
                                            : row
                                        )
                                      )
                                    }}
                                  >
                                    <SelectTrigger className={goodsSelectTriggerClass} title="Camera zone">
                                      <SelectValue placeholder="Select zone" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">Select zone</SelectItem>
                                      {availableZones.map((zone) => (
                                        <SelectItem key={zone} value={zone}>
                                          {zone}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </TableCell>
                              <TableCell className={goodsControlCellClass}>
                                <div className={goodsControlWrapClass}>
                                  <Select
                                    value={item.locatedCameraId != null ? String(item.locatedCameraId) : "__none__"}
                                    onValueChange={(v) => {
                                      const camId = v === "__none__" ? null : Number(v)
                                      const cam =
                                        camId != null
                                          ? zoneCameras.find((c) => c.id === camId) ||
                                            locationCameras.find((c) => c.id === camId)
                                          : undefined
                                      setGoodsItems((prev) =>
                                        prev.map((row) =>
                                          row.id === item.id
                                            ? {
                                                ...row,
                                                locatedCameraId:
                                                  Number.isFinite(camId as number) ? (camId as number) : null,
                                                locatedZone: cam?.zone?.trim() || row.locatedZone,
                                                locatedCamera: cam
                                                  ? {
                                                      id: cam.id,
                                                      code: cam.code,
                                                      name: cam.name,
                                                      zone: cam.zone,
                                                      location: cam.location,
                                                      displayLabel: cam.name || cam.code,
                                                    }
                                                  : null,
                                              }
                                            : row
                                        )
                                      )
                                    }}
                                    disabled={!item.locatedZone}
                                  >
                                    <SelectTrigger className={goodsSelectTriggerClass} title="Located camera">
                                      <SelectValue placeholder={item.locatedZone ? "Select camera" : "Pick zone first"}>
                                        {selectedCam ? cameraOptionLabel(selectedCam) : undefined}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">Not set</SelectItem>
                                      {cameraSelectOptions.map((cam) => (
                                        <SelectItem key={cam.id} value={String(cam.id)}>
                                          {cameraOptionLabel(cam)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </TableCell>
                              <TableCell className={goodsControlCellClass}>
                                <div className={cn(goodsControlWrapClass, "justify-center")}>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-destructive hover:text-destructive"
                                    onClick={() => removeGoodsLine(item.id)}
                                    aria-label="Remove line"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      addGoodsLine()
                      if (invalidField === "dm-goods") setInvalidField("")
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add line
                  </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Upload Videos */}
          <Collapsible>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer flex flex-row items-center justify-between hover:bg-muted/50 rounded-t-lg">
                  <CardTitle className="text-base">Upload Videos</CardTitle>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-2">
                  <Input
                    type="file"
                    accept="video/*"
                    multiple
                    className="max-w-md"
                    onChange={(e) => setVideoFiles(Array.from(e.target.files ?? []))}
                  />
                  {videoFiles.length > 0 && (
                    <ul className="text-sm text-muted-foreground space-y-0.5 list-disc pl-5">
                      {videoFiles.map((f, i) => (
                        <li key={`${f.name}-${i}-${f.lastModified}`}>{f.name}</li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Officer Details directly Assisting in Detention */}
          <Collapsible>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer flex flex-row items-center justify-between hover:bg-muted/50 rounded-t-lg">
                  <CardTitle className="text-base">Officer Details directly Assisting in Detention</CardTitle>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">Officer name, badge, role.</p>
                  <Input className="mt-2 max-w-md" placeholder="Officer name" />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Remarks & Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Remarks & Notes</CardTitle>
              <p className="text-sm text-muted-foreground font-normal">
                Officer notes for seizure/detention. All fields are saved with the memo in the database.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Seizing Officer Notes <span className="text-red-600">*</span></Label>
                <Textarea
                  value={seizingOfficerNotes}
                  onChange={(e) => setSeizingOfficerNotes(e.target.value)}
                  placeholder="Reason for seizure, observations at scene, grounds for detention (e.g. documents not clear, duty unpaid, misdeclaration)."
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label>Examining Officer Notes</Label>
                <Textarea
                  value={examiningOfficerNotes}
                  onChange={(e) => setExaminingOfficerNotes(e.target.value)}
                  placeholder="Examination findings, condition of goods, quantity/description verification."
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label>Detention / Customs Clarification Notes</Label>
                <Textarea
                  value={detentionNotes}
                  onChange={(e) => setDetentionNotes(e.target.value)}
                  placeholder="Additional notes on why customs is not clear (e.g. pending lab test, valuation dispute, legal hold)."
                  rows={2}
                />
              </div>
              <div className="grid gap-2">
                <Label>Forwarding Officer Remarks <span className="text-red-600">*</span></Label>
                <Textarea
                  value={forwardingOfficerRemarks}
                  onChange={(e) => setForwardingOfficerRemarks(e.target.value)}
                  placeholder="Remarks by forwarding officer; recommendation or next steps."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Collapsible defaultOpen>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer flex flex-row items-center justify-between hover:bg-muted/50 rounded-t-lg">
                  <CardTitle className="text-base">Audit Log</CardTitle>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Created By</Label>
                    <Input
                      value={
                        (getStoredUser()?.full_name || "").trim() ||
                        getStoredUser()?.username ||
                        "—"
                      }
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Created On</Label>
                    <Input value={new Date().toLocaleString()} readOnly className="bg-muted" />
                  </div>
                  <p className="text-xs text-muted-foreground md:col-span-2">
                    Full audit history (create / update events) is available on the detention memo
                    detail page after save.
                  </p>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Actions */}
          <div className="flex flex-col gap-3 pb-8">
            {formError && (
              <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                {formError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Saving…" : isEdit ? "Save Changes" : "Save"}
              </Button>
              <Button onClick={() => void handleSubmit()} disabled={saving}>
                {saving ? "Saving…" : "Submit"}
              </Button>
              <Button variant="outline" asChild>
                <Link to={listPath}>Cancel</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Preview Dialog */}
      <Dialog open={!!previewQrData} onOpenChange={() => setPreviewQrData(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code Preview</DialogTitle>
            <DialogDescription>
              Scan this QR code to identify the detained goods item.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {previewQrData && (
              <>
                <img
                  src={getQrCodeUrl(previewQrData, 250)}
                  alt="Large QR Code"
                  width={250}
                  height={250}
                  className="border rounded-md p-2 bg-white"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='250' viewBox='0 0 250 250'%3E%3Crect width='250' height='250' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='16'%3EQR Error%3C/text%3E%3C/svg%3E"
                  }}
                />
                <div className="text-center">
                  <p className="font-mono text-sm bg-muted px-2 py-1 rounded break-all">{previewQrData}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => copyToClipboard(previewQrData)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Number
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}