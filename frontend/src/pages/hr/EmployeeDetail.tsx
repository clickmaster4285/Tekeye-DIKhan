import { useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchStaffById,
  downloadStaffDocument,
  deleteStaff,
  resolveStaffPhotoGallery,
  type StaffRecord,
} from "@/lib/staff-api"
import { API_BASE_URL } from "@/lib/api"
import { ROUTES } from "@/routes/config"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { StaffAvatar } from "@/components/hr/staff-avatar"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  ArrowLeft,
  User,
  Phone,
  Briefcase,
  Banknote,
  Shield,
  AlertCircle,
  FileText,
  BarChart3,
  Pencil,
  Trash2,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/** Build full URL for a document path returned by the API */
function documentUrl(path: string | null | undefined): string | null {
  if (!path || !String(path).trim()) return null
  const p = String(path).trim()
  if (p.startsWith("http")) return p
  const base = API_BASE_URL.replace(/\/$/, "")
  return p.startsWith("/") ? `${base}${p}` : `${base}/media/${p}`
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp)$/i
const PDF_EXT = /\.pdf$/i

function DocumentPreviewItem({
  staffId,
  field,
  label,
  filePath,
}: {
  staffId: number
  field: string
  label: string
  filePath: string | null | undefined
}) {
  const [imageError, setImageError] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const url = documentUrl(filePath)
  if (!url) return null

  const isImage = IMAGE_EXT.test(url)
  const isPdf = PDF_EXT.test(url)
  const fileName = url.split("/").pop() ?? "document"

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadStaffDocument(staffId, field, fileName)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
        {isImage && (
          <>
            {!imageError ? (
              <div className="relative">
                <img
                  src={url}
                  alt={label}
                  className="max-h-64 w-full object-contain object-left-top bg-muted/30"
                  onError={() => setImageError(true)}
                />
                <div className="absolute bottom-2 right-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={downloading}
                    className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {downloading ? "…" : "Download"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-4">
                <p className="text-sm text-muted-foreground">Image preview unavailable</p>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center gap-2 self-start rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <FileText className="h-4 w-4" />
                  {downloading ? "…" : "Download"}
                </button>
              </div>
            )}
          </>
        )}
        {isPdf && (
          <div className="space-y-2 p-2">
            <iframe
              src={url}
              title={label}
              className="w-full h-64 rounded border-0 bg-white"
            />
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="text-sm text-[#3b82f6] hover:underline disabled:opacity-50"
            >
              {downloading ? "…" : "Download"}
            </button>
          </div>
        )}
        {!isImage && !isPdf && (
          <div className="flex flex-wrap items-center gap-2 p-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 text-left text-sm text-[#3b82f6] hover:underline disabled:opacity-50"
            >
              <FileText className="h-4 w-4 shrink-0" />
              {fileName}
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {downloading ? "…" : "Download"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function val(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—"
  return String(v).trim() || "—"
}

function DetailSection({
  title,
  icon: Icon,
  children,
  description,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  description?: string
}) {
  return (
    <Card>
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

function DetailGrid({ items }: { items: [string, string][] }) {
  const list = items.filter(([, value]) => value !== "—")
  if (list.length === 0) {
    return <p className="text-sm text-muted-foreground">No information provided.</p>
  }
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
      {list.map(([label, value]) => (
        <div key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const staffId = id ? parseInt(id, 10) : NaN

  const { data: staff, isLoading, isError } = useQuery({
    queryKey: ["staff", staffId],
    queryFn: () => fetchStaffById(staffId),
    enabled: Number.isInteger(staffId),
  })

  if (isLoading || !id) {
    return (
      <div className="w-full px-4 sm:px-6 py-8">
        <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">
          {!id ? "Invalid employee" : "Loading…"}
        </div>
      </div>
    )
  }

  if (isError || !staff) {
    return (
      <div className="w-full px-4 sm:px-6 py-8">
        <p className="text-destructive mb-4">Employee not found.</p>
        <Button variant="outline" asChild>
          <Link to={ROUTES.EMPLOYEES}>Back to Employees</Link>
        </Button>
      </div>
    )
  }

  const s = staff as StaffRecord
  const created = s.created_at ? new Date(s.created_at).toLocaleString() : "—"

  return (
    <div className="w-full px-4 sm:px-6 py-6">
      <nav
        className="text-base text-muted-foreground mb-6 flex flex-wrap items-center gap-x-2 gap-y-1"
        aria-label="Breadcrumb"
      >
        <Link to={ROUTES.DASHBOARD} className="hover:text-foreground transition-colors">
          Home
        </Link>
        <span aria-hidden className="text-muted-foreground/70">
          /
        </span>
        <Link to={ROUTES.EMPLOYEES} className="hover:text-foreground transition-colors">
          Employees
        </Link>
        <span aria-hidden className="text-muted-foreground/70">
          /
        </span>
        <span className="text-[#3b82f6] font-medium" aria-current="page">
          Employee details
        </span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="min-w-0 flex items-center gap-3">
          <Button
            variant="outline"
            size="default"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 min-w-0">
            <StaffAvatar
              profileImage={s.profile_image}
              fullName={s.full_name}
              className="h-40 w-40 shrink-0"
              fallbackClassName="text-2xl bg-muted"
            />
            <div className="min-w-0 text-center sm:text-left">
              <h1 className="text-[22px] font-bold tracking-tight text-foreground truncate">
                {val(s.full_name)}
              </h1>
              <p className="text-base text-muted-foreground mt-1 truncate">
                {val(s.designation)} · {val(s.department)}
                {s.employee_id ? ` · ID ${s.employee_id}` : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Added {created}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {s.user != null && <Badge variant="default">Linked account</Badge>}
          <Button variant="outline" size="sm" asChild>
            <Link to={`/employees/${s.id}/edit`}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {resolveStaffPhotoGallery(s).length > 0 && (
        <div className="mb-8">
          <p className="text-sm font-medium text-muted-foreground mb-3">Recognition photos</p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {resolveStaffPhotoGallery(s).map((url, idx) => (
              <img
                key={`${url}-${idx}`}
                src={url}
                alt={`${s.full_name ?? "Staff"} photo ${idx + 1}`}
                className="h-40 w-32 shrink-0 rounded-md border border-border object-contain bg-muted"
                decoding="async"
              />
            ))}
          </div>
        </div>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete employee?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {val(s.full_name)} from the system. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true)
                try {
                  await deleteStaff(s.id)
                  toast({ title: "Employee deleted", description: "The record has been removed." })
                  queryClient.removeQueries({ queryKey: ["staff", s.id] })
                  void queryClient.invalidateQueries({ queryKey: ["staff"] })
                  navigate(ROUTES.EMPLOYEES)
                } catch (err) {
                  toast({
                    title: "Delete failed",
                    description: err instanceof Error ? err.message : "Could not delete employee",
                    variant: "destructive",
                  })
                } finally {
                  setDeleting(false)
                  setDeleteOpen(false)
                }
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DetailSection title="Personal information" icon={User}>
          <DetailGrid
            items={[
              ["Personal number", val(s.personal_number ?? s.user)],
              ["First name", val(s.first_name)],
              ["Last name", val(s.last_name)],
              ["Father's name", val(s.father_name)],
              ["Date of birth", s.date_of_birth ? new Date(s.date_of_birth).toLocaleDateString() : "—"],
              ["Gender", val(s.gender)],
              ["CNIC", val(s.cnic)],
              ["National ID / Passport", val(s.national_id)],
              ["Marital status", val(s.marital_status)],
              ["Blood group", val(s.blood_group)],
              ["Qualification", val(s.qualification)],
            ]}
          />
        </DetailSection>

        <DetailSection title="Contact information" icon={Phone}>
          <DetailGrid
            items={[
              ["Email", val(s.email)],
              ["Phone (primary)", val(s.phone_primary ?? s.phone)],
              ["Phone (alternate)", val(s.phone_alternate)],
              ["Street address", val(s.street_address ?? s.address)],
              ["City", val(s.city)],
              ["State / Province", val(s.state)],
              ["Country", val(s.country)],
              ["Postal code", val(s.postal_code)],
            ]}
          />
        </DetailSection>

        <DetailSection title="Job / Employment" icon={Briefcase}>
          <DetailGrid
            items={[
              ["Employee ID", val(s.employee_id)],
              ["BPS", val(s.bps)],
              ["Designation", val(s.designation)],
              ["Department", val(s.department)],
              ["Branch / Office", val(s.branch_location)],
              ["Current place of posting", val(s.current_posting)],
              ["Transferred from", val(s.transferred_from)],
              ["Transferred to", val(s.transferred_to)],
              ["Collectorate / Collector name", val(s.collector_name)],
              ["Manager / Supervisor", val(s.manager)],
              ["Employment type", val(s.employment_type)],
              ["Date of joining", s.joining_date ? new Date(s.joining_date).toLocaleDateString() : "—"],
              ["Probation end date", s.probation_end_date ? new Date(s.probation_end_date).toLocaleDateString() : "—"],
              ["Work shift start", val(s.work_shift_start)],
              ["Work shift end", val(s.work_shift_end)],
              ["Job status", val(s.job_status)],
            ]}
          />
        </DetailSection>

        <DetailSection title="Salary & compensation" icon={Banknote}>
          <DetailGrid
            items={[
              ["Salary", val(s.salary)],
              ["Bank account", val(s.bank_account)],
              ["IBAN", val(s.iban)],
              ["Salary type", val(s.salary_type)],
              ["Tax ID / SSN", val(s.tax_id)],
              ["Allowances / benefits", val(s.allowances)],
            ]}
          />
        </DetailSection>

        <DetailSection title="Access & login" icon={Shield}>
          <DetailGrid
            items={[
              ["Role", val(s.role)],
              ["Role / Access level", val(s.role_access_level)],
              ["System permissions", val(s.system_permissions)],
              ["Linked user", s.user_details ? `${s.user_details.username} (${s.user_details.role})` : "—"],
            ]}
          />
        </DetailSection>

        <DetailSection title="Emergency contact" icon={AlertCircle}>
          <DetailGrid
            items={[
              ["Name", val(s.emergency_contact_name ?? s.emergency_contact)],
              ["Relationship", val(s.emergency_contact_relationship)],
              ["Phone", val(s.emergency_contact_phone)],
              ["Address", val(s.emergency_contact_address)],
            ]}
          />
        </DetailSection>

        <DetailSection title="Documents / compliance" icon={FileText}>
          <div className="space-y-6">
            <DocumentPreviewItem staffId={s.id} field="resume_file" label="Resume / CV" filePath={s.resume_file} />
            <DocumentPreviewItem staffId={s.id} field="joining_letter_file" label="Joining letter" filePath={s.joining_letter_file} />
            <DocumentPreviewItem staffId={s.id} field="contract_file" label="Contract / Agreement" filePath={s.contract_file} />
            <DocumentPreviewItem staffId={s.id} field="id_proof_file" label="ID proof" filePath={s.id_proof_file} />
            <DocumentPreviewItem staffId={s.id} field="tax_form_file" label="Tax form" filePath={s.tax_form_file} />
            <DocumentPreviewItem staffId={s.id} field="certificates_file" label="Certificates / Education" filePath={s.certificates_file} />
            {!s.resume_file && !s.joining_letter_file && !s.contract_file && !s.id_proof_file && !s.tax_form_file && !s.certificates_file && (
              <p className="text-sm text-muted-foreground">No documents attached.</p>
            )}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm pt-2 border-t">
              <dt className="text-muted-foreground">Background check status</dt>
              <dd className="font-medium text-foreground">{val(s.background_check_status)}</dd>
            </dl>
          </div>
        </DetailSection>

        <DetailSection title="Optional / HR analytics" icon={BarChart3}>
          <DetailGrid
            items={[
              ["Skills & competencies", val(s.skills_competencies)],
              ["Languages known", val(s.languages_known)],
              ["Performance rating", val(s.performance_rating)],
              ["Last appraisal date", s.last_appraisal_date ? new Date(s.last_appraisal_date).toLocaleDateString() : "—"],
              ["Leave balance", val(s.leave_balance)],
              ["Notes", val(s.notes)],
            ]}
          />
        </DetailSection>
      </div>

      <div className="mt-8 flex gap-3">
        <Button variant="outline" asChild>
          <Link to={ROUTES.EMPLOYEES}>Back to Employees</Link>
        </Button>
      </div>
    </div>
  )
}
