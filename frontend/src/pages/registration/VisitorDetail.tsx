import { useParams, Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getVisitor } from "@/lib/visitor-api"
import { getVisitorPhotoUrl } from "@/lib/image-match"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ROUTES } from "@/routes/config"
import {
  ArrowLeft,
  User,
  FileText,
  Image as ImageIcon,
  Mail,
  Building2,
  Car,
  Calendar,
  Shield,
  QrCode,
  Users,
  ListChecks,
} from "lucide-react"
import { getVisitorCreatedBy, type RegistrationSource } from "@/lib/visitor-api"

type VisitorRecordExtended = Record<string, unknown>

function isImageUrl(value: unknown): value is string {
  return typeof value === "string" && (value.startsWith("data:image/") || value.startsWith("blob:"))
}

/** Get value from visitor with optional snake_case and camelCase keys. */
function val(
  v: VisitorRecordExtended,
  snake: string,
  camel?: string
): string {
  const a = v[snake]
  if (a != null && String(a).trim() !== "") return String(a).trim()
  if (camel) {
    const b = v[camel]
    if (b != null && String(b).trim() !== "") return String(b).trim()
  }
  return "—"
}

function DocPreview({ label, src }: { label: string; src: string | undefined }) {
  if (!src || !isImageUrl(src)) return null
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="rounded-lg border border-border bg-muted/20 overflow-hidden inline-block max-w-full">
        <img src={src} alt={label} className="max-h-64 w-auto object-contain" />
      </div>
    </div>
  )
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string
  description?: string
  icon: React.ElementType
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-[18px] font-semibold">
          <Icon className="h-5 w-5 text-[#3b82f6]" /> {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function InfoGrid({ entries }: { entries: { label: string; value: string }[] }) {
  const list = entries.filter((e) => e.value !== "—")
  if (list.length === 0) return <p className="text-sm text-muted-foreground">No information provided.</p>
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
      {list.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function VisitorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const visitorId = id ? parseInt(id, 10) : NaN

  const { data: visitor, isLoading, isError } = useQuery({
    queryKey: ["visitor", visitorId],
    queryFn: async () => {
      const [walkIn, preReg] = await Promise.all([
        getVisitor(visitorId, "walk-in"),
        getVisitor(visitorId, "pre-registration"),
      ])
      return walkIn ?? preReg ?? null
    },
    enabled: Number.isInteger(visitorId),
  })

  const v = visitor as VisitorRecordExtended | null | undefined

  if (isLoading || !id) {
    return (
      <div className="w-full px-4">
        <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">
          {!id ? "Invalid visitor" : "Loading…"}
        </div>
      </div>
    )
  }

  if (isError || !v) {
    return (
      <div className="w-full px-4">
        <nav className="text-base text-muted-foreground mb-6 flex flex-wrap items-center gap-x-2 gap-y-1" aria-label="Breadcrumb">
          <Link to={ROUTES.DASHBOARD} className="hover:text-foreground transition-colors">Home</Link>
          <span aria-hidden className="text-muted-foreground/70">/</span>
          <span className="text-foreground" aria-current="page">Visitor details</span>
        </nav>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive mb-4">Visitor not found.</p>
            <Button variant="outline" size="default" asChild>
              <Link to={ROUTES.DASHBOARD}>Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const fullName = String(v.full_name ?? "Unknown")
  const created = v.created_at ? new Date(String(v.created_at)).toLocaleString() : "—"
  const createdBy = getVisitorCreatedBy({
    created_by: v.created_by as string | undefined,
    registered_by_username: v.registered_by_username as string | undefined,
    registered_by_user_id: v.registered_by_user_id as number | undefined,
  })
  const source = (v.registration_source as RegistrationSource) ?? "walk-in"
  const mainPhoto = getVisitorPhotoUrl(v)
  const capturedPhoto = v.captured_photo ?? v.photoCapture
  const visitorPhotos = Array.isArray(v.visitor_photos)
    ? (v.visitor_photos as string[])
    : Array.isArray(v.visitorPhotos)
      ? (v.visitorPhotos as string[])
      : []
  const minors = Array.isArray(v.visitor_minors)
    ? (v.visitor_minors as VisitorRecordExtended[])
    : Array.isArray(v.visitorMinors)
      ? (v.visitorMinors as VisitorRecordExtended[])
      : []
  const groupMembers = Array.isArray(v.group_members)
    ? (v.group_members as VisitorRecordExtended[])
    : Array.isArray(v.groupMembers)
      ? (v.groupMembers as VisitorRecordExtended[])
      : []
  const visitMode = String(v.visit_mode ?? v.visitMode ?? "individual")
  const groupPartySize = v.group_party_size ?? v.groupPartySize

  const basicEntries = [
    { label: "Full name", value: fullName },
    {
      label: "Visit attendance",
      value:
        visitMode === "group"
          ? `Group visit (${groupPartySize ?? groupMembers.length + 1} people)`
          : "Individual",
    },
    { label: "Visitor type", value: val(v, "visitor_type", "visitorType") },
    { label: "Gender", value: val(v, "gender") },
    { label: "CNIC / ID number", value: val(v, "cnic_number", "cnicNumber") },
    { label: "Passport number", value: val(v, "passport_number", "passportNumber") },
    { label: "Nationality", value: val(v, "nationality") },
    { label: "Date of birth", value: val(v, "date_of_birth", "dateOfBirth") },
  ]

  const contactEntries = [
    { label: "Mobile number", value: val(v, "mobile_number", "mobileNumber") },
    { label: "Email address", value: val(v, "email_address", "emailAddress") },
    { label: "Residential address", value: val(v, "residential_address", "residentialAddress") },
  ]

  const orgEntries = [
    { label: "Organization name", value: val(v, "organization_name", "organizationName") },
    { label: "Organization type", value: val(v, "organization_type", "organizationType") },
    { label: "NTN / Registration no.", value: val(v, "ntn_registration_no", "ntnRegistrationNo") },
    { label: "Designation", value: val(v, "designation") },
    { label: "Office address", value: val(v, "office_address", "officeAddress") },
  ]

  const vehicleEntries = [
    { label: "Vehicle type", value: val(v, "vehicle_type", "vehicleType") },
    { label: "Vehicle number", value: val(v, "vehicle_number", "vehicleNumber") },
    { label: "Registration no.", value: val(v, "vehicle_registration_no", "vehicleRegistrationNo") },
    { label: "License number", value: val(v, "license_no", "licenseNo") },
    { label: "License issue date", value: val(v, "license_issue_date", "licenseIssueDate") },
    { label: "License expiry date", value: val(v, "license_expiry_date", "licenseExpiryDate") },
  ]

  const visitEntries = [
    { label: "Visit purpose", value: val(v, "visit_purpose", "visitPurpose") },
    { label: "Visit description", value: val(v, "visit_purpose_description", "visitPurposeDescription") },
    { label: "Visit type", value: val(v, "visit_type", "visitType") },
    { label: "Department to visit", value: val(v, "department_to_visit", "department") },
    { label: "Department (slot)", value: val(v, "department_for_slot", "departmentForSlot") },
    {
      label: "Host name",
      value: [val(v, "host_officer_name", "hostFullName"), val(v, "host_name", "hostName")].find((x) => x !== "—") ?? "—",
    },
    { label: "Host ID", value: val(v, "host_id", "hostId") },
    { label: "Host designation", value: val(v, "host_officer_designation", "hostDesignation") },
    { label: "Host department", value: val(v, "host_department", "hostDepartment") },
    { label: "Host email", value: val(v, "host_email", "hostEmail") },
    { label: "Host contact", value: val(v, "host_contact_number", "hostContactNumber") },
    { label: "Preferred date", value: val(v, "preferred_visit_date", "preferredDate") },
    { label: "Time slot", value: val(v, "preferred_time_slot", "preferredTimeSlot") },
    { label: "Slot duration", value: val(v, "slot_duration", "slotDuration") },
    { label: "Priority level", value: val(v, "priority_level", "priorityLevel") },
    { label: "Visit date", value: val(v, "visit_date", "visitDate") },
    { label: "Location", value: val(v, "location") },
  ]

  const accessEntries = [
    { label: "Access zone", value: val(v, "access_zone", "accessZone") },
    { label: "Entry gate", value: val(v, "entry_gate", "entryGate") },
    { label: "Time validity start", value: val(v, "time_validity_start", "timeValidityStart") },
    { label: "Time validity end", value: val(v, "time_validity_end", "timeValidityEnd") },
    { label: "QR / Pass ID", value: val(v, "qr_code_id", "qrCodeId") },
    { label: "Visitor reference no.", value: val(v, "visitor_ref_number", "visitorRefNumber") },
    { label: "Reference number", value: val(v, "reference_number", "referenceNumber") },
    { label: "Document type", value: val(v, "document_type", "documentType") },
    { label: "Document number", value: val(v, "document_no", "documentNo") },
    { label: "Issuing authority", value: val(v, "issuing_authority", "issuingAuthority") },
    { label: "Expiry date", value: val(v, "expiry_date", "expiryDate") },
    { label: "Letter ref no.", value: val(v, "letter_ref_no", "letterRefNo") },
    { label: "Support doc type", value: val(v, "support_doc_type", "supportDocType") },
    { label: "Upload procedure", value: val(v, "upload_procedure", "uploadProcedure") },
  ]

  const screeningEntries = [
    { label: "Watchlist check", value: val(v, "watchlist_check_status", "watchlistCheckStatus") },
    { label: "Security level", value: val(v, "security_level", "securityLevel") },
    { label: "Escort required", value: val(v, "escort_mandatory", "escortMandatory") },
    { label: "Guard remarks", value: val(v, "guard_remarks", "guardRemarks") },
    { label: "Max visit duration", value: val(v, "max_visit_duration", "maxVisitDuration") },
    { label: "Allowed departments", value: val(v, "allowed_departments", "allowedDepartments") },
    { label: "Allowed zones", value: val(v, "allowed_zones", "allowedZones") },
    { label: "Additional remarks", value: val(v, "additional_remarks", "additionalRemarks") },
    { label: "Approver required", value: val(v, "approver_required", "approverRequired") },
    { label: "Temporary access granted", value: val(v, "temporary_access_granted", "temporaryAccessGranted") },
  ]

  const metadataEntries = [
    { label: "Created by", value: createdBy },
    { label: "Registration status", value: val(v, "registration_status", "registrationStatus") },
    { label: "Expiry status", value: val(v, "expiry_status", "expiryStatus") },
    { label: "Scan count", value: val(v, "scan_count", "scanCount") },
    { label: "Generated on", value: val(v, "generated_on", "generatedOn") },
    { label: "Generated by", value: val(v, "generated_by", "generatedBy") },
  ]

  const listBackHref = source === "pre-registration" ? ROUTES.PRE_REGISTRATION : ROUTES.WALK_IN_REGISTRATION
  const listBackLabel = source === "pre-registration" ? "Pre-Registration" : "Walk-In Registration"
  const vehicleImagesList = Array.isArray(v.vehicle_images) ? (v.vehicle_images as string[]) : []
  const vehicleImageSingle = v.vehicle_image ?? v.vehicleImage

  return (
    <div className="w-full px-4">
      <nav className="text-base text-muted-foreground mb-6 flex flex-wrap items-center gap-x-2 gap-y-1" aria-label="Breadcrumb">
        <Link to={ROUTES.DASHBOARD} className="hover:text-foreground transition-colors">Home</Link>
        <span aria-hidden className="text-muted-foreground/70">/</span>
        <Link to={listBackHref} className="hover:text-foreground transition-colors">{listBackLabel}</Link>
        <span aria-hidden className="text-muted-foreground/70">/</span>
        <span className="text-[#3b82f6] font-medium" aria-current="page">Visitor details</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="min-w-0 flex items-center gap-3">
          <Button variant="outline" size="default" onClick={() => navigate(-1)} aria-label="Go back" className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight text-foreground truncate">{fullName}</h1>
            <p className="text-base text-muted-foreground mt-1">
              Registered {created}
              {createdBy !== "—" && (
                <span className="ml-2 text-foreground">
                  · Created by <span className="font-medium">{createdBy}</span>
                </span>
              )}
              {source && (
                <span className="ml-2 inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {source === "pre-registration" ? "Pre-Registration" : "Walk-In"}
                </span>
              )}
            </p>
          </div>
        </div>
 
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Basic information" icon={User}>
          <InfoGrid entries={basicEntries} />
        </SectionCard>

        <SectionCard title="Contact & address" icon={Mail}>
          <InfoGrid entries={contactEntries} />
        </SectionCard>

        <SectionCard title="Visitor photo" icon={ImageIcon}>
          {mainPhoto && isImageUrl(mainPhoto) ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border overflow-hidden inline-block bg-muted/20">
                <img src={mainPhoto} alt="Visitor" className="max-h-64 w-auto object-contain" />
              </div>
              {visitorPhotos.filter((url) => isImageUrl(url)).length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {visitorPhotos.filter((url) => isImageUrl(url)).slice(1, 5).map((url, i) => (
                    <div key={i} className="rounded-md border border-border overflow-hidden w-20 h-20 bg-muted/20">
                      <img src={url} alt={`Photo ${i + 2}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : capturedPhoto && isImageUrl(capturedPhoto) ? (
            <div className="rounded-lg border border-border overflow-hidden inline-block bg-muted/20">
              <img src={capturedPhoto} alt="Visitor" className="max-h-64 w-auto object-contain" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No photo captured.</p>
          )}
        </SectionCard>

        <SectionCard title="Organization" icon={Building2}>
          <InfoGrid entries={orgEntries} />
        </SectionCard>

        <SectionCard title="Vehicle & license" icon={Car}>
          <InfoGrid entries={vehicleEntries} />
          {(() => {
            const allVehicleImgs =
              vehicleImagesList.length > 0
                ? vehicleImagesList.filter((url) => isImageUrl(url))
                : typeof vehicleImageSingle === "string" && isImageUrl(vehicleImageSingle)
                  ? [vehicleImageSingle]
                  : []
            if (allVehicleImgs.length === 0) return null
            return (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-sm font-medium text-muted-foreground">Vehicle images</p>
                <div className="flex flex-wrap gap-2">
                  {allVehicleImgs.map((url, i) => (
                    <div key={i} className="rounded-lg border border-border overflow-hidden bg-muted/20">
                      <img src={url} alt={`Vehicle ${i + 1}`} className="max-h-40 w-auto object-contain" />
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </SectionCard>

        <SectionCard title="Visit & host details" icon={Calendar}>
          <InfoGrid entries={visitEntries} />
        </SectionCard>

        <SectionCard title="Access & pass" icon={QrCode}>
          <InfoGrid entries={accessEntries} />
        </SectionCard>

        <SectionCard title="Screening & status" icon={Shield}>
          <InfoGrid entries={screeningEntries} />
        </SectionCard>

        <SectionCard title="Document & visit metadata" icon={ListChecks}>
          <InfoGrid entries={metadataEntries} />
        </SectionCard>
      </div>

      {groupMembers.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[18px] font-semibold">
              <Users className="h-5 w-5 text-[#3b82f6]" /> Group members
            </CardTitle>
            <CardDescription>
              {groupMembers.length} additional member(s) on this shared QR pass.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {groupMembers.map((m, i) => {
              const memberPhotos = Array.isArray(m.photos) ? (m.photos as string[]) : []
              const hasPhotos = memberPhotos.some((url) => typeof url === "string" && isImageUrl(url))
              return (
                <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                  <p className="font-medium text-foreground">
                    {val(m, "name") !== "—" ? val(m, "name") : `Member ${i + 2}`}
                  </p>
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div><dt className="text-muted-foreground">Gender</dt><dd>{val(m, "gender")}</dd></div>
                    <div><dt className="text-muted-foreground">CNIC</dt><dd>{val(m, "cnic_or_b_form", "cnicOrBForm")}</dd></div>
                    <div><dt className="text-muted-foreground">Passport</dt><dd>{val(m, "passport_number", "passportNumber")}</dd></div>
                    <div><dt className="text-muted-foreground">DOB</dt><dd>{val(m, "date_of_birth", "dateOfBirth")}</dd></div>
                    <div><dt className="text-muted-foreground">Mobile</dt><dd>{val(m, "mobile_number", "mobileNumber")}</dd></div>
                    <div><dt className="text-muted-foreground">Email</dt><dd>{val(m, "email_address", "emailAddress")}</dd></div>
                    <div><dt className="text-muted-foreground">Organization</dt><dd>{val(m, "organization_name", "organizationName")}</dd></div>
                    <div><dt className="text-muted-foreground">Designation</dt><dd>{val(m, "designation")}</dd></div>
                  </dl>
                  {hasPhotos && (
                    <div className="pt-2 border-t border-border space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Photographs</p>
                      <div className="flex flex-wrap gap-2">
                        {memberPhotos.map((url, j) =>
                          typeof url === "string" && isImageUrl(url) ? (
                            <div key={j} className="rounded-lg border border-border overflow-hidden bg-muted/20">
                              <img src={url} alt={`Member ${i + 2} – ${j + 1}`} className="max-h-40 w-auto object-contain" />
                            </div>
                          ) : null
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {minors.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[18px] font-semibold">
              <Users className="h-5 w-5 text-[#3b82f6]" /> Accompanying minors
            </CardTitle>
            <CardDescription>{minors.length} minor(s) registered with this visitor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {minors.map((m, i) => {
              const minorPhotos = Array.isArray(m.photos) ? (m.photos as string[]) : []
              const hasMinorPhotos = minorPhotos.some((url) => typeof url === "string" && isImageUrl(url))
              return (
                <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                  <p className="font-medium text-foreground">
                    {val(m, "name") !== "—" ? val(m, "name") : `Minor ${i + 1}`}
                  </p>
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div><dt className="text-muted-foreground">Relation</dt><dd>{val(m, "relation")}</dd></div>
                    <div><dt className="text-muted-foreground">Gender</dt><dd>{val(m, "gender")}</dd></div>
                    <div><dt className="text-muted-foreground">CNIC / B-form</dt><dd>{val(m, "cnic_or_b_form", "cnicOrBForm")}</dd></div>
                    <div><dt className="text-muted-foreground">DOB</dt><dd>{val(m, "date_of_birth", "dateOfBirth")}</dd></div>
                    <div><dt className="text-muted-foreground">Mobile</dt><dd>{val(m, "mobile_number", "mobileNumber")}</dd></div>
                    <div><dt className="text-muted-foreground">Email</dt><dd>{val(m, "email_address", "emailAddress")}</dd></div>
                  </dl>
                  {hasMinorPhotos && (
                    <div className="pt-2 border-t border-border space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Photographs</p>
                      <div className="flex flex-wrap gap-2">
                        {minorPhotos.map((url, j) =>
                          typeof url === "string" && isImageUrl(url) ? (
                            <div key={j} className="rounded-lg border border-border overflow-hidden bg-muted/20">
                              <img src={url} alt={`Minor ${i + 1} – ${j + 1}`} className="max-h-40 w-auto object-contain" />
                            </div>
                          ) : null
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[18px] font-semibold">
            <FileText className="h-5 w-5 text-[#3b82f6]" /> Documents
          </CardTitle>
          <CardDescription>Uploaded ID, application letter, and other documents.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <DocPreview label="ID front / Visitor photograph" src={(v.front_image ?? v.frontImage) as string} />
            <DocPreview label="ID back / Proof of identification" src={(v.back_image ?? v.backImage) as string} />
            <DocPreview label="Application letter" src={(v.application_letter ?? v.applicationLetter) as string} />
            <DocPreview label="Additional document" src={(v.additional_document ?? v.additionalDocument) as string} />
            <DocPreview label="Authorization letter" src={(v.authorization_letter ?? v.authorizationLetter) as string} />
            <DocPreview label="NOC document" src={(v.noc_document ?? v.nocDocument) as string} />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="outline" size="default" asChild>
          <Link to={listBackHref}>Back to list</Link>
        </Button>
      </div>
    </div>
  )
}
