import { useState, useEffect } from "react"
import { Link, useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getVisitor, updateVisitor, type VisitorDetail } from "@/lib/visitor-api"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Save, User, Calendar, Building2, FileCheck } from "lucide-react"

function toStr(v: unknown): string {
  if (v == null || v === undefined) return ""
  return String(v).trim()
}

function visitorToForm(visitor: VisitorDetail): Record<string, string> {
  return {
    full_name: toStr(visitor.full_name),
    gender: toStr(visitor.gender),
    cnic_number: toStr(visitor.cnic_number),
    passport_number: toStr(visitor.passport_number),
    nationality: toStr(visitor.nationality),
    date_of_birth: visitor?.date_of_birth ? String(visitor.date_of_birth).slice(0, 10) : "",
    mobile_number: toStr(visitor.mobile_number),
    email_address: toStr(visitor.email_address),
    residential_address: toStr(visitor.residential_address),
    visit_purpose: toStr(visitor.visit_purpose),
    visit_description: toStr(visitor.visit_description),
    department_to_visit: toStr(visitor.department_to_visit),
    host_officer_name: toStr(visitor.host_officer_name),
    host_officer_designation: toStr(visitor.host_officer_designation),
    preferred_visit_date: visitor?.preferred_visit_date ? String(visitor.preferred_visit_date).slice(0, 10) : "",
    preferred_time_slot: toStr(visitor.preferred_time_slot),
    organization_name: toStr(visitor.organization_name),
    organization_type: toStr(visitor.organization_type),
    designation: toStr(visitor.designation),
    office_address: toStr(visitor.office_address),
    document_type: toStr(visitor.document_type),
    document_no: toStr(visitor.document_no),
    issuing_authority: toStr(visitor.issuing_authority),
    expiry_date: visitor?.expiry_date ? String(visitor.expiry_date).slice(0, 10) : "",
  }
}

function formToPatchPayload(form: Record<string, string>): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  const keys = Object.keys(form) as (keyof typeof form)[]
  keys.forEach((key) => {
    const v = form[key]
    if (key === "date_of_birth" || key === "preferred_visit_date" || key === "expiry_date") {
      payload[key] = v && v.trim() ? v.trim() : null
    } else {
      payload[key] = v ?? ""
    }
  })
  return payload
}

export default function VisitorEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const visitorId = id != null ? Number(id) : NaN
  const isValidId = !Number.isNaN(visitorId) && visitorId > 0

  const { data: visitor, isLoading, isError, error } = useQuery({
    queryKey: ["visitor", visitorId],
    queryFn: () => getVisitor(visitorId),
    enabled: isValidId,
  })

  const [form, setForm] = useState<Record<string, string>>({})
  useEffect(() => {
    if (visitor) setForm(visitorToForm(visitor))
  }, [visitor])

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateVisitor(visitorId, payload, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visitor", visitorId] })
      queryClient.invalidateQueries({ queryKey: ["visitors"] })
      toast({ title: "Visitor updated", description: "Changes have been saved." })
      navigate(`/visitors/${visitorId}`, { replace: true })
    },
    onError: (err) => {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Could not update visitor.",
        variant: "destructive",
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(formToPatchPayload(form))
  }

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  if (!isValidId) {
    return (
      <div className="w-full max-w-200 mx-auto space-y-6">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-5 py-8 text-sm text-destructive">
          Invalid visitor ID.
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-200 mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <nav className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          <span aria-hidden className="text-muted-foreground/70">/</span>
          <Link to="/pre-registration" className="hover:text-foreground transition-colors">Visitor Registration</Link>
          <span aria-hidden className="text-muted-foreground/70">/</span>
          <Link to={`/visitors/${visitorId}`} className="hover:text-foreground transition-colors">Visitor details</Link>
          <span aria-hidden className="text-muted-foreground/70">/</span>
          <span className="text-[#3b82f6] font-medium" aria-current="page">Edit</span>
        </nav>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="shrink-0 w-full sm:w-auto">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Spinner className="h-10 w-10 text-[#3b82f6]" />
          <p className="text-sm text-muted-foreground">Loading visitor…</p>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-5 py-8 text-sm text-destructive">
          <p className="font-medium">Failed to load visitor</p>
          <p className="mt-1 text-destructive/90">{error instanceof Error ? error.message : "Something went wrong."}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(-1)}>
            Go back
          </Button>
        </div>
      )}

      {visitor && Object.keys(form).length > 0 && (
        <form onSubmit={handleSubmit} className="space-y-6 pb-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Edit visitor</h1>
            <Button type="submit" disabled={updateMutation.isPending} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white shrink-0">
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>

          {/* Personal */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
                <User className="h-4 w-4" strokeWidth={2} />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Personal information</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" value={form.full_name ?? ""} onChange={(e) => updateField("full_name", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Input id="gender" value={form.gender ?? ""} onChange={(e) => updateField("gender", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="cnic_number">CNIC</Label>
                <Input id="cnic_number" value={form.cnic_number ?? ""} onChange={(e) => updateField("cnic_number", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="passport_number">Passport</Label>
                <Input id="passport_number" value={form.passport_number ?? ""} onChange={(e) => updateField("passport_number", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="nationality">Nationality</Label>
                <Input id="nationality" value={form.nationality ?? ""} onChange={(e) => updateField("nationality", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="date_of_birth">Date of birth</Label>
                <Input id="date_of_birth" type="date" value={form.date_of_birth ?? ""} onChange={(e) => updateField("date_of_birth", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="mobile_number">Mobile</Label>
                <Input id="mobile_number" value={form.mobile_number ?? ""} onChange={(e) => updateField("mobile_number", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="email_address">Email</Label>
                <Input id="email_address" type="email" value={form.email_address ?? ""} onChange={(e) => updateField("email_address", e.target.value)} className="mt-1" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="residential_address">Residential address</Label>
                <Input id="residential_address" value={form.residential_address ?? ""} onChange={(e) => updateField("residential_address", e.target.value)} className="mt-1" />
              </div>
            </div>
          </section>

          {/* Visit */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
                <Calendar className="h-4 w-4" strokeWidth={2} />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Visit details</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="visit_purpose">Visit purpose</Label>
                <Input id="visit_purpose" value={form.visit_purpose ?? ""} onChange={(e) => updateField("visit_purpose", e.target.value)} className="mt-1" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="visit_description">Description</Label>
                <Input id="visit_description" value={form.visit_description ?? ""} onChange={(e) => updateField("visit_description", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="department_to_visit">Department to visit</Label>
                <Input id="department_to_visit" value={form.department_to_visit ?? ""} onChange={(e) => updateField("department_to_visit", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="host_officer_name">Host officer name</Label>
                <Input id="host_officer_name" value={form.host_officer_name ?? ""} onChange={(e) => updateField("host_officer_name", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="host_officer_designation">Host designation</Label>
                <Input id="host_officer_designation" value={form.host_officer_designation ?? ""} onChange={(e) => updateField("host_officer_designation", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="preferred_visit_date">Preferred visit date</Label>
                <Input id="preferred_visit_date" type="date" value={form.preferred_visit_date ?? ""} onChange={(e) => updateField("preferred_visit_date", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="preferred_time_slot">Preferred time slot</Label>
                <Input id="preferred_time_slot" value={form.preferred_time_slot ?? ""} onChange={(e) => updateField("preferred_time_slot", e.target.value)} className="mt-1" />
              </div>
            </div>
          </section>

          {/* Organization */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
                <Building2 className="h-4 w-4" strokeWidth={2} />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Organization</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="organization_name">Organization name</Label>
                <Input id="organization_name" value={form.organization_name ?? ""} onChange={(e) => updateField("organization_name", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="organization_type">Organization type</Label>
                <Input id="organization_type" value={form.organization_type ?? ""} onChange={(e) => updateField("organization_type", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="designation">Designation</Label>
                <Input id="designation" value={form.designation ?? ""} onChange={(e) => updateField("designation", e.target.value)} className="mt-1" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="office_address">Office address</Label>
                <Input id="office_address" value={form.office_address ?? ""} onChange={(e) => updateField("office_address", e.target.value)} className="mt-1" />
              </div>
            </div>
          </section>

          {/* Identity document */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
                <FileCheck className="h-4 w-4" strokeWidth={2} />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Identity document</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="document_type">Document type</Label>
                <Input id="document_type" value={form.document_type ?? ""} onChange={(e) => updateField("document_type", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="document_no">Document number</Label>
                <Input id="document_no" value={form.document_no ?? ""} onChange={(e) => updateField("document_no", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="issuing_authority">Issuing authority</Label>
                <Input id="issuing_authority" value={form.issuing_authority ?? ""} onChange={(e) => updateField("issuing_authority", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="expiry_date">Expiry date</Label>
                <Input id="expiry_date" type="date" value={form.expiry_date ?? ""} onChange={(e) => updateField("expiry_date", e.target.value)} className="mt-1" />
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white">
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
