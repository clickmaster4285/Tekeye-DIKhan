import { z } from "zod"

/** Backend expects YYYY-MM-DD or null for date fields. */
const dateOrNull = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null
    const s = String(v).trim()
    if (!s) return null
    return parseDateToYYYYMMDD(s)
  })

function parseDateToYYYYMMDD(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  const dmyMatch = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/.exec(trimmed)
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch
    const m = String(parseInt(month!, 10)).padStart(2, "0")
    const d = String(parseInt(day!, 10)).padStart(2, "0")
    return `${year}-${m}-${d}`
  }
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Valid visitor types (backend choices). */
const visitorTypeEnum = z.enum(["general", "employee", "vip", "contractor"])
const genderEnum = z.enum(["male", "female", "other"])
const nationalityEnum = z.enum(["pakistan", "usa", "uk", "uae", "other"])
const visitPurposeEnum = z.enum([
  "meeting",
  "interview",
  "delivery",
  "maintenance",
  "consultation",
  "other",
])
const departmentEnum = z.enum([
  "hr",
  "it",
  "finance",
  "operations",
  "marketing",
  "admin",
  "enforcement",
])
const hostDesignationEnum = z.enum([
  "manager",
  "director",
  "executive",
  "officer",
])
const timeSlotEnum = z.enum([
  "09:00-10:00",
  "10:00-11:00",
  "11:00-12:00",
  "12:00-13:00",
  "14:00-15:00",
  "15:00-16:00",
  "16:00-17:00",
])
const expectedDurationEnum = z.enum([
  "30min",
  "1hr",
  "2hr",
  "halfday",
  "fullday",
])
const preferredViewVisitEnum = z.enum([
  "in-host",
  "logins",
  "high-security",
])
const documentTypeEnum = z.enum(["cnic", "passport", "driving-license"])
const issuingAuthorityEnum = z.enum([
  "nadra",
  "passport-office",
  "excise",
])
const supportDocTypeEnum = z.enum(["application", "noc", "invitation"])
const uploadProcedureEnum = z.enum(["manual", "scan"])
const entryGateEnum = z.enum(["main-gate", "gate-1", "gate-2", "vip-gate"])
const expiryStatusEnum = z.enum(["active", "expired", "revoked"])
const generatedByEnum = z.enum(["system", "admin", "operator"])

const optionalString = (maxLen: number) =>
  z
    .string()
    .optional()
    .default("")
    .transform((s) => String(s ?? "").trim().slice(0, maxLen))

/** Optional choice: enum value or empty string (backend blank=True). */
const optionalChoice = <T extends [string, ...string[]]>(enumSchema: z.ZodEnum<T>) =>
  z.union([enumSchema, z.literal("")]).default("")

const createPayloadSchema = z.object({
  visitor_type: visitorTypeEnum,
  full_name: z.string().min(1, "Full name is required").max(200).trim(),
  gender: optionalChoice(genderEnum),
  cnic_number: optionalString(20),
  passport_number: optionalString(30),
  nationality: nationalityEnum,
  date_of_birth: dateOrNull,
  mobile_number: z.string().min(1, "Mobile number is required").max(30).trim(),
  email_address: optionalString(254),
  residential_address: z.string().optional().default(""),
  visit_purpose: visitPurposeEnum,
  visit_description: optionalString(255),
  department_to_visit: departmentEnum,
  host_officer_name: optionalString(150),
  host_officer_designation: optionalChoice(hostDesignationEnum),
  preferred_visit_date: dateOrNull,
  preferred_time_slot: optionalChoice(timeSlotEnum),
  expected_duration: optionalChoice(expectedDurationEnum),
  preferred_view_visit: optionalChoice(preferredViewVisitEnum),
  document_type: optionalChoice(documentTypeEnum),
  document_no: optionalString(100),
  issuing_authority: optionalChoice(issuingAuthorityEnum),
  expiry_date: dateOrNull,
  front_image: z.string().optional().default(""),
  back_image: z.string().optional().default(""),
  support_doc_type: optionalChoice(supportDocTypeEnum),
  application_letter: z.string().optional().default(""),
  letter_ref_no: optionalString(100),
  additional_document: z.string().optional().default(""),
  upload_procedure: optionalChoice(uploadProcedureEnum),
  organization_name: optionalString(200),
  organization_type: optionalString(100),
  ntn_registration_no: optionalString(100),
  designation: optionalString(100),
  office_address: z.string().optional().default(""),
  capture_date: z.string().optional().default(""),
  capture_time: z.string().optional().default(""),
  captured_by: optionalString(150),
  camera_location: optionalString(150),
  photo_quality_score: optionalString(50),
  face_match_status: optionalString(50),
  captured_photo: z.string().optional().default(""),
  disclaimer_accepted: z.boolean(),
  terms_accepted: z.boolean(),
  previous_visit_reference: optionalString(100),
  registration_type: z.string().optional().default(""),
  cnic_passport: optionalString(30),
  visit_purpose_description: z.string().optional().default(""),
  visit_type: z.string().optional().default(""),
  reference_number: optionalString(100),
  preferred_date: z.union([z.string(), z.null()]).optional().default(""),
  preferred_time_slot_walkin: z.string().optional().default(""),
  department_for_slot: z.string().optional().default(""),
  slot_duration: z.string().optional().default(""),
  host_id: z.string().optional().default(""),
  host_full_name: optionalString(150),
  host_designation: z.string().optional().default(""),
  host_department: z.string().optional().default(""),
  host_email: z.string().optional().default(""),
  host_contact_number: z.string().optional().default(""),
  watchlist_check_status: z.string().optional().default(""),
  approver_required: z.string().optional().default(""),
  temporary_access_granted: z.string().optional().default(""),
  guard_remarks: z.string().optional().default(""),
  qr_code_id: z.string().optional().default(""),
  visitor_ref_number: z.string().optional().default(""),
  visit_date: dateOrNull,
  time_validity_start: z.string().optional().default(""),
  time_validity_end: z.string().optional().default(""),
  access_zone: z.string().min(1, "Access zone is required").max(64),
  entry_gate: optionalChoice(entryGateEnum),
  expiry_status: optionalChoice(expiryStatusEnum),
  scan_count: z.number().int().min(0),
  generated_on: dateOrNull,
  generated_by: optionalChoice(generatedByEnum),
})

export type VisitorCreatePayload = z.infer<typeof createPayloadSchema>

function toStr(v: unknown): string {
  if (v == null) return ""
  return String(v).trim()
}
function toNum(v: unknown): number {
  if (v === "" || v == null) return 0
  const n = Number(v)
  return Number.isNaN(n) || n < 0 ? 0 : Math.floor(n)
}

/** Map pre-registration form data to backend payload and validate. */
export function buildPreRegistrationPayload(formData: Record<string, unknown>): VisitorCreatePayload {
  const visitorTypeMap: Record<string, string> = {
    individual: "general",
    company: "general",
    contractor: "contractor",
  }
  const raw = {
    visitor_type: visitorTypeMap[toStr(formData.visitorType)] || "general",
    full_name: toStr(formData.fullName) || "Unknown Visitor",
    gender: toStr(formData.gender),
    cnic_number: toStr(formData.cnicNumber),
    passport_number: toStr(formData.passportNumber),
    nationality: toStr(formData.nationality) || "other",
    date_of_birth: formData.dateOfBirth,
    mobile_number: toStr(formData.mobileNumber) || "N/A",
    email_address: toStr(formData.emailAddress),
    residential_address: toStr(formData.residentialAddress),
    visit_purpose: toStr(formData.visitPurpose) || "other",
    visit_description: toStr(formData.visitDescription),
    department_to_visit: toStr(formData.departmentToVisit) || "admin",
    host_officer_name: toStr(formData.hostOfficerName),
    host_officer_designation: toStr(formData.hostOfficerDesignation),
    preferred_visit_date: formData.preferredVisitDate,
    preferred_time_slot: toStr(formData.preferredTimeSlot),
    expected_duration: toStr(formData.expectedDuration),
    preferred_view_visit: toStr(formData.preferredViewVisit) || "in-host",
    document_type: toStr(formData.documentType),
    document_no: toStr(formData.documentNo),
    issuing_authority: toStr(formData.issuingAuthority),
    expiry_date: formData.expiryDate,
    front_image: toStr(formData.frontImage),
    back_image: toStr(formData.backImage),
    support_doc_type: toStr(formData.supportDocType),
    application_letter: toStr(formData.applicationLetter),
    letter_ref_no: toStr(formData.letterRefNo),
    additional_document: toStr(formData.additionalDocument),
    upload_procedure: toStr(formData.uploadProcedure),
    organization_name: toStr(formData.organizationName),
    organization_type: toStr(formData.organizationType),
    ntn_registration_no: toStr(formData.ntnRegistrationNo),
    designation: toStr(formData.designation),
    office_address: toStr(formData.officeAddress),
    capture_date: toStr(formData.captureDate),
    capture_time: toStr(formData.captureTime),
    captured_by: toStr(formData.capturedBy),
    camera_location: toStr(formData.cameraLocation),
    photo_quality_score: toStr(formData.photoQualityScore),
    face_match_status: toStr(formData.faceMatchStatus),
    captured_photo: toStr(formData.capturedPhoto),
    disclaimer_accepted: Boolean(formData.disclaimerAccepted),
    terms_accepted: Boolean(formData.termsAccepted),
    previous_visit_reference: toStr(formData.previousVisitReference),
    qr_code_id: toStr(formData.qrCodeId),
    visitor_ref_number: toStr(formData.visitorRefNumber),
    visit_date: formData.visitDate,
    time_validity_start: toStr(formData.timeValidityStart),
    time_validity_end: toStr(formData.timeValidityEnd),
    access_zone: toStr(formData.accessZone),
    entry_gate: toStr(formData.entryGate),
    expiry_status: toStr(formData.expiryStatus),
    scan_count: toNum(formData.scanCount),
    generated_on: formData.generatedOn,
    generated_by: toStr(formData.generatedBy),
    registration_type: "pre-registration",
    cnic_passport: toStr(formData.cnicNumber) || toStr(formData.passportNumber),
    visit_purpose_description: toStr(formData.visitDescription),
    visit_type: "",
    reference_number: toStr(formData.previousVisitReference),
    preferred_date: formData.preferredVisitDate ?? "",
    preferred_time_slot_walkin: "",
    department_for_slot: "",
    slot_duration: "",
    host_id: "",
    host_full_name: toStr(formData.hostOfficerName),
    host_designation: toStr(formData.hostOfficerDesignation),
    host_department: toStr(formData.departmentToVisit),
    host_email: "",
    host_contact_number: "",
    watchlist_check_status: "",
    approver_required: "",
    temporary_access_granted: "",
    guard_remarks: "",
  }
  return createPayloadSchema.parse(raw) as VisitorCreatePayload
}

/** Map walk-in form data to backend payload and validate. */
export function buildWalkInPayload(formData: Record<string, unknown>): VisitorCreatePayload {
  const nationalityMap: Record<string, string> = {
    pakistani: "pakistan",
    american: "usa",
    british: "uk",
    indian: "other",
    uae: "uae",
    other: "other",
  }
  const visitorTypeMap: Record<string, string> = {
    individual: "general",
    "company-rep": "general",
    contractor: "contractor",
  }
  const departmentMap: Record<string, string> = {
    hr: "hr",
    operations: "operations",
    finance: "finance",
    marketing: "marketing",
    engineering: "it",
    sales: "marketing",
    enforcement: "enforcement",
  }
  const allowedVisitPurpose = new Set([
    "meeting",
    "interview",
    "delivery",
    "maintenance",
    "consultation",
    "other",
  ])
  const visitPurpose = toStr(formData.visitPurpose)
  const normalizedVisitPurpose = allowedVisitPurpose.has(visitPurpose)
    ? visitPurpose
    : "other"
  const departmentValue =
    departmentMap[toStr(formData.department)] ||
    departmentMap[toStr(formData.departmentForSlot)] ||
    "admin"
  const visitorType = visitorTypeMap[toStr(formData.visitorType)] || "general"
  const cnic = toStr(formData.cnicNumber) || toStr(formData.cnicPassport)

  const raw = {
    visitor_type: visitorType,
    full_name: toStr(formData.fullName),
    gender: toStr(formData.gender),
    cnic_number: cnic,
    passport_number: toStr(formData.passportNumber),
    nationality: nationalityMap[toStr(formData.nationality)] || "other",
    date_of_birth: formData.dateOfBirth ?? null,
    mobile_number: toStr(formData.mobileNumber),
    email_address: toStr(formData.emailAddress),
    residential_address: toStr(formData.residentialAddress),
    visit_purpose: normalizedVisitPurpose,
    visit_description:
      toStr(formData.visitPurposeDescription) || toStr(formData.visitPurpose) || "",
    department_to_visit: departmentValue,
    host_officer_name: toStr(formData.hostFullName) || toStr(formData.hostName) || "",
    host_officer_designation: toStr(formData.hostDesignation) || "",
    preferred_visit_date: formData.preferredDate,
    preferred_time_slot: "",
    expected_duration: "",
    preferred_view_visit: "",
    document_type: toStr(formData.documentType),
    document_no: toStr(formData.documentNo),
    issuing_authority: toStr(formData.issuingAuthority),
    expiry_date: formData.expiryDate,
    front_image: toStr(formData.frontImage),
    back_image: toStr(formData.backImage),
    support_doc_type: toStr(formData.supportDocType),
    application_letter: toStr(formData.applicationLetter),
    letter_ref_no: toStr(formData.letterRefNo),
    additional_document: toStr(formData.additionalDocument),
    upload_procedure: toStr(formData.uploadProcedure),
    disclaimer_accepted: false,
    terms_accepted: false,
    previous_visit_reference: toStr(formData.referenceNumber) || "",
    qr_code_id: toStr(formData.qrCodeId),
    visitor_ref_number: toStr(formData.visitorRefNumber),
    visit_date: formData.visitDate,
    time_validity_start: toStr(formData.timeValidityStart) || "00:00",
    time_validity_end: toStr(formData.timeValidityEnd) || "23:59",
    access_zone: toStr(formData.accessZone),
    entry_gate: toStr(formData.entryGate),
    expiry_status: toStr(formData.expiryStatus) || "active",
    scan_count: toNum(formData.scanCount),
    generated_on: formData.generatedOn,
    generated_by: toStr(formData.generatedBy),
    registration_type: toStr(formData.registrationType) || "walk-in",
    cnic_passport: cnic,
    visit_purpose_description: toStr(formData.visitPurposeDescription),
    visit_type: toStr(formData.visitType),
    reference_number: toStr(formData.referenceNumber),
    preferred_date: formData.preferredDate ?? "",
    preferred_time_slot_walkin: toStr(formData.preferredTimeSlot),
    department_for_slot: toStr(formData.departmentForSlot),
    slot_duration: toStr(formData.slotDuration),
    host_id: toStr(formData.hostId),
    host_full_name: toStr(formData.hostFullName),
    host_designation: toStr(formData.hostDesignation),
    host_department: toStr(formData.hostDepartment),
    host_email: toStr(formData.hostEmail),
    host_contact_number: toStr(formData.hostContactNumber),
    watchlist_check_status: toStr(formData.watchlistCheckStatus),
    approver_required: toStr(formData.approverRequired),
    temporary_access_granted: toStr(formData.temporaryAccessGranted),
    guard_remarks: toStr(formData.guardRemarks),
    capture_date: "",
    capture_time: "",
    captured_by: "",
    camera_location: "",
    photo_quality_score: "",
    face_match_status: "",
    captured_photo: toStr(formData.photoCapture),
    organization_name: toStr(formData.organizationName),
    organization_type: toStr(formData.organizationType),
    ntn_registration_no: toStr(formData.ntnRegistrationNo),
    designation: toStr(formData.designation),
    office_address: toStr(formData.officeAddress),
  }
  return createPayloadSchema.parse(raw) as VisitorCreatePayload
}

/** Validate and return first error message, or null if valid. */
export function validatePreRegistrationForm(formData: Record<string, unknown>): string | null {
  try {
    buildPreRegistrationPayload(formData)
    return null
  } catch (err) {
    if (err instanceof z.ZodError) {
      const first = err.errors[0]
      return first?.message ?? "Invalid form data"
    }
    return err instanceof Error ? err.message : "Validation failed"
  }
}

/** Validate walk-in form and return first error message, or null if valid. */
export function validateWalkInForm(formData: Record<string, unknown>): string | null {
  try {
    buildWalkInPayload(formData)
    return null
  } catch (err) {
    if (err instanceof z.ZodError) {
      const first = err.errors[0]
      return first?.message ?? "Invalid form data"
    }
    return err instanceof Error ? err.message : "Validation failed"
  }
}
