"use client"

import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { fetchVisitors } from "@/lib/visitor-api"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  AlertTriangle,
  Briefcase,
  Camera,
  Car,
  CheckCircle,
  ChevronLeft,
  Clock,
  Calendar,
  FileText,
  Fingerprint,
  Globe,
  History,
  IdCard,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
  XCircle,
} from "lucide-react"
import { ROUTES } from "@/routes/config"

interface VisitRecord {
  id: string
  date: string
  timeIn: string
  timeOut: string | null
  purpose: string
  hostName: string
  hostDepartment: string
  zones: string[]
  status: "completed" | "ongoing" | "cancelled"
  securityLevel: "standard" | "elevated" | "high"
  escortRequired: boolean
  qrCodeId: string
}

interface AlertRecord {
  id: string
  type: "security" | "system" | "compliance"
  severity: "low" | "medium" | "high" | "critical"
  message: string
  date: string
  resolved: boolean
}

interface DocumentRecord {
  id: string
  type: string
  name: string
  uploadedDate: string
  verified: boolean
}

interface Person {
  id: string
  name: string
  cnic: string
  phone: string
  email: string
  address: string
  dateOfBirth: string
  nationality: string
  passportNumber?: string
  enrollmentDate: string
  status: "active" | "inactive" | "pending" | "blacklisted" | "watchlist"
  imageUrl?: string
  fingerprintRegistered: boolean
  faceRegistered: boolean
  riskLevel: "low" | "medium" | "high" | "critical"
  organization?: string
  designation?: string
  organizationType?: string
  vehicleInfo?: {
    type: string
    number: string
    registrationNo: string
    licenseNo: string
  }
  emergencyContact?: {
    name: string
    relation: string
    phone: string
  }
  visits: VisitRecord[]
  alerts: AlertRecord[]
  documents: DocumentRecord[]
  restrictedZones: string[]
  watchlistReason?: string
  blacklistReason?: string
  lastKnownLocation?: string
  associatedWith?: string[]
}

const STORAGE_KEY = "customs-people-database"

type VisitorRecordLoose = Record<string, unknown> & { id?: number }

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function val(v: Record<string, unknown>, snake: string, camel?: string): string {
  const a = v[snake]
  if (a != null && String(a).trim() !== "") return String(a).trim()
  if (camel) {
    const b = v[camel]
    if (b != null && String(b).trim() !== "") return String(b).trim()
  }
  return "—"
}

function normalizeCnic(value: string) {
  return String(value || "").replace(/\D/g, "")
}

function registrationKey(prefix: string, r: VisitorRecordLoose, idx: number) {
  const cnic = normalizeCnic(String(r.cnic_number ?? r.cnicNumber ?? ""))
  const idPart = typeof r.id === "number" ? String(r.id) : ""
  return `${prefix}-${idPart || cnic || "row"}-${idx}`
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((n) => n[0]?.toUpperCase()).join("") || "?"
}

function isRenderableImageUrl(v: string | undefined | null): v is string {
  if (!v) return false
  const s = v.trim()
  if (!s) return false
  return s.startsWith("data:image/") || s.startsWith("http://") || s.startsWith("https://")
}

function getAvatarUrl(person: { id: string; name: string; imageUrl?: string }) {
  if (isRenderableImageUrl(person.imageUrl)) return person.imageUrl
  const seed = encodeURIComponent(person.id || person.name || "person")
  return `https://i.pravatar.cc/150?u=${seed}`
}

const RiskLevelBadge = ({ level }: { level: string }) => {
  const config: Record<
    string,
    { color: string; icon: typeof CheckCircle }
  > = {
    low: { color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
    medium: { color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: AlertTriangle },
    high: { color: "bg-orange-100 text-orange-800 border-orange-200", icon: AlertTriangle },
    critical: { color: "bg-red-100 text-red-800 border-red-200", icon: Shield },
  }
  const { color, icon: Icon } = config[level] || config.low
  return (
    <Badge variant="outline" className={`${color} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </Badge>
  )
}

const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<
    string,
    { color: string; icon: typeof CheckCircle }
  > = {
    active: { color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
    inactive: { color: "bg-gray-100 text-gray-800 border-gray-200", icon: XCircle },
    pending: { color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
    blacklisted: { color: "bg-red-100 text-red-800 border-red-200", icon: Shield },
    watchlist: { color: "bg-orange-100 text-orange-800 border-orange-200", icon: AlertTriangle },
  }
  const { color, icon: Icon } = config[status] || config.inactive
  return (
    <Badge variant="outline" className={`${color} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

export default function PeopleDatabaseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [people] = useState<Person[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      return stored ? (JSON.parse(stored) as Person[]) : []
    } catch {
      return []
    }
  })

  const [visitorRecords, setVisitorRecords] = useState<{
    prereg: VisitorRecordLoose[]
    walkin: VisitorRecordLoose[]
  }>({ prereg: [], walkin: [] })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [prereg, walkin] = await Promise.all([
          fetchVisitors("pre-registration"),
          fetchVisitors("walk-in"),
        ])
        if (!cancelled) {
          setVisitorRecords({
            prereg: prereg as VisitorRecordLoose[],
            walkin: walkin as VisitorRecordLoose[],
          })
        }
      } catch {
        if (!cancelled) setVisitorRecords({ prereg: [], walkin: [] })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const person = useMemo(() => {
    const needle = String(id ?? "")
    return people.find((p) => String(p.id) === needle) ?? null
  }, [people, id])

  const relatedRegistrations = useMemo(() => {
    if (!person) return { prereg: [] as VisitorRecordLoose[], walkin: [] as VisitorRecordLoose[] }
    const cnicN = normalizeCnic(person.cnic)
    const byCnic = (r: VisitorRecordLoose) => normalizeCnic(String(r.cnic_number ?? r.cnicNumber ?? "")) === cnicN && cnicN !== ""
    return {
      prereg: visitorRecords.prereg.filter(byCnic),
      walkin: visitorRecords.walkin.filter(byCnic),
    }
  }, [person, visitorRecords])

  if (!person) {
    return (
      <ModulePageLayout
        title="Visitor Profile"
        description="Person not found in People Database"
        breadcrumbs={[{ label: "AI Analytics" }, { label: "People Database", href: ROUTES.PEOPLE_DATABASE }, { label: "Profile" }]}
      >
        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm text-muted-foreground">We couldn’t find this record. It may have been deleted or your local data was reset.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate(-1)}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button asChild>
                <Link to={ROUTES.PEOPLE_DATABASE}>Go to People Database</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </ModulePageLayout>
    )
  }

  return (
    <ModulePageLayout
      title="Visitor Profile"
      description="Complete visitor history and tracking information"
      breadcrumbs={[{ label: "AI Analytics" }, { label: "People Database", href: ROUTES.PEOPLE_DATABASE }, { label: person.name }]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6 bg-gradient-to-r from-blue-50 to-white">
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
                  <AvatarImage src={getAvatarUrl(person)} alt={person.name} />
                  <AvatarFallback className="text-2xl">{initials(person.name)}</AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <User className="h-6 w-6" />
                      {person.name}
                    </h2>
                    <RiskLevelBadge level={person.riskLevel} />
                    <StatusBadge status={person.status} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <IdCard className="h-4 w-4" /> CNIC
                      </p>
                      <p className="font-medium">{person.cnic}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <IdCard className="h-4 w-4" /> Passport
                      </p>
                      <p className="font-medium">{person.passportNumber || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Globe className="h-4 w-4" /> Nationality
                      </p>
                      <p className="font-medium">{person.nationality}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-4 w-4" /> Enrolled
                      </p>
                      <p className="font-medium">{formatDate(person.enrollmentDate)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-4 w-4" /> Date of Birth
                      </p>
                      <p className="font-medium">{person.dateOfBirth ? formatDate(person.dateOfBirth) : "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-4 w-4" /> Last Location
                      </p>
                      <p className="font-medium">{person.lastKnownLocation || "—"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="p-6">
              <ScrollArea className="h-[calc(100vh-360px)] pr-4">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-full ${person.fingerprintRegistered ? "bg-green-100" : "bg-gray-100"}`}>
                            <Fingerprint className={`h-6 w-6 ${person.fingerprintRegistered ? "text-green-600" : "text-gray-400"}`} />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Fingerprint</p>
                            <p className="font-medium">{person.fingerprintRegistered ? "Registered" : "Not Registered"}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-full ${person.faceRegistered ? "bg-green-100" : "bg-gray-100"}`}>
                            <Camera className={`h-6 w-6 ${person.faceRegistered ? "text-green-600" : "text-gray-400"}`} />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Face Recognition</p>
                            <p className="font-medium">{person.faceRegistered ? "Registered" : "Not Registered"}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{person.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{person.email}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                          <span className="text-sm">{person.address}</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {person.emergencyContact ? (
                          <>
                            <p className="font-medium">Emergency Contact</p>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {person.emergencyContact.name} ({person.emergencyContact.relation})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span>{person.emergencyContact.phone}</span>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">No emergency contact on file.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {person.organization ? (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Briefcase className="h-5 w-5" />
                            Organization
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <p>
                            <span className="font-medium">Name:</span> {person.organization}
                          </p>
                          <p>
                            <span className="font-medium">Type:</span> {person.organizationType || "—"}
                          </p>
                          <p>
                            <span className="font-medium">Designation:</span> {person.designation || "—"}
                          </p>
                        </CardContent>
                      </Card>
                    ) : null}

                    {person.vehicleInfo ? (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Car className="h-5 w-5" />
                            Vehicle Information
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <p>
                            <span className="font-medium">Type:</span> {person.vehicleInfo.type}
                          </p>
                          <p>
                            <span className="font-medium">Number:</span> {person.vehicleInfo.number}
                          </p>
                          <p>
                            <span className="font-medium">Registration:</span> {person.vehicleInfo.registrationNo}
                          </p>
                          <p>
                            <span className="font-medium">License:</span> {person.vehicleInfo.licenseNo}
                          </p>
                        </CardContent>
                      </Card>
                    ) : null}
                  </div>

                  {person.associatedWith && person.associatedWith.length > 0 ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <User className="h-5 w-5" />
                          Associated Persons ({person.associatedWith.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {person.associatedWith.map((name) => (
                            <Badge key={name} variant="outline" className="bg-purple-50 text-purple-700">
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  {(relatedRegistrations.prereg.length > 0 || relatedRegistrations.walkin.length > 0) ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Registration Records
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {relatedRegistrations.prereg.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Pre-Registration ({relatedRegistrations.prereg.length})</p>
                            <div className="space-y-3">
                              {relatedRegistrations.prereg.slice(0, 5).map((r, idx) => (
                                <div key={registrationKey("prereg", r, idx)} className="rounded-lg border p-4">
                                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                    <div className="space-y-1">
                                      <p className="font-medium">{val(r, "full_name", "fullName")}</p>
                                      <p className="text-sm text-muted-foreground">
                                        Purpose: {val(r, "visit_purpose", "visitPurpose")} • Dept: {val(r, "department_to_visit", "department")}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        Host: {val(r, "host_officer_name", "hostFullName")} • Slot: {val(r, "preferred_time_slot", "preferredTimeSlot")}
                                      </p>
                                    </div>
                                    {typeof r.id === "number" ? (
                                      <Button asChild variant="outline" size="sm" className="h-8">
                                        <Link to={`/visitors/${r.id}`}>Open</Link>
                                      </Button>
                                    ) : null}
                                  </div>
                                  <Separator className="my-3" />
                                  <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                                    <div>
                                      <dt className="text-muted-foreground">Visitor type</dt>
                                      <dd className="font-medium">{val(r, "visitor_type", "visitorType")}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-muted-foreground">Phone</dt>
                                      <dd className="font-medium">{val(r, "mobile_number", "mobileNumber")}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-muted-foreground">Email</dt>
                                      <dd className="font-medium">{val(r, "email_address", "emailAddress")}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-muted-foreground">Access zone</dt>
                                      <dd className="font-medium">{val(r, "access_zone", "accessZone")}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-muted-foreground">Entry gate</dt>
                                      <dd className="font-medium">{val(r, "entry_gate", "entryGate")}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-muted-foreground">Valid from</dt>
                                      <dd className="font-medium">{val(r, "time_validity_start", "timeValidityStart")}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-muted-foreground">Valid to</dt>
                                      <dd className="font-medium">{val(r, "time_validity_end", "timeValidityEnd")}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-muted-foreground">QR / Pass ID</dt>
                                      <dd className="font-medium">{val(r, "qr_code_id", "qrCodeId")}</dd>
                                    </div>
                                  </dl>
                                </div>
                              ))}
                              {relatedRegistrations.prereg.length > 5 ? (
                                <p className="text-xs text-muted-foreground">Showing first 5 pre-registration records.</p>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        {relatedRegistrations.walkin.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Walk-In ({relatedRegistrations.walkin.length})</p>
                            <div className="space-y-3">
                              {relatedRegistrations.walkin.slice(0, 5).map((r, idx) => (
                                <div key={registrationKey("walkin", r, idx)} className="rounded-lg border p-4">
                                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                    <div className="space-y-1">
                                      <p className="font-medium">{val(r, "full_name", "fullName")}</p>
                                      <p className="text-sm text-muted-foreground">
                                        Purpose: {val(r, "visit_purpose", "visitPurpose")} • Dept: {val(r, "department_to_visit", "department")}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        Host: {val(r, "host_officer_name", "hostFullName")} • Zone: {val(r, "access_zone", "accessZone")}
                                      </p>
                                    </div>
                                    {typeof r.id === "number" ? (
                                      <Button asChild variant="outline" size="sm" className="h-8">
                                        <Link to={`/visitors/${r.id}`}>Open</Link>
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                              {relatedRegistrations.walkin.length > 5 ? (
                                <p className="text-xs text-muted-foreground">Showing first 5 walk-in records.</p>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Registration Records
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          No Pre-Registration / Walk-In records found for this CNIC in local storage.
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {person.alerts.length > 0 ? (
                    <Card className="border-red-200">
                      <CardHeader className="bg-red-50">
                        <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                          <AlertTriangle className="h-5 w-5" />
                          Security Alerts ({person.alerts.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="space-y-3">
                          {person.alerts.map((alert) => (
                            <div key={alert.id} className="flex items-start gap-3 p-3 bg-red-50/50 rounded-lg">
                              <Shield
                                className={`h-5 w-5 mt-0.5 ${
                                  alert.severity === "critical"
                                    ? "text-red-600"
                                    : alert.severity === "high"
                                      ? "text-orange-600"
                                      : alert.severity === "medium"
                                        ? "text-yellow-600"
                                        : "text-blue-600"
                                }`}
                              />
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium">{alert.message}</p>
                                  <Badge
                                    variant="outline"
                                    className={
                                      alert.severity === "critical"
                                        ? "bg-red-100 text-red-800"
                                        : alert.severity === "high"
                                          ? "bg-orange-100 text-orange-800"
                                          : alert.severity === "medium"
                                            ? "bg-yellow-100 text-yellow-800"
                                            : "bg-blue-100 text-blue-800"
                                    }
                                  >
                                    {alert.severity}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {formatDate(alert.date)} • {alert.resolved ? "Resolved" : "Pending"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  {(person.watchlistReason || person.blacklistReason) ? (
                    <Card className="border-orange-200">
                      <CardHeader className="bg-orange-50">
                        <CardTitle className="text-lg flex items-center gap-2 text-orange-700">
                          <AlertTriangle className="h-5 w-5" />
                          {person.blacklistReason ? "Blacklist Reason" : "Watchlist Reason"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <p className="text-sm">{person.blacklistReason || person.watchlistReason}</p>
                      </CardContent>
                    </Card>
                  ) : null}

                  {person.restrictedZones.length > 0 ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Shield className="h-5 w-5" />
                          Restricted Zones
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {person.restrictedZones.map((zone) => (
                            <Badge key={zone} variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              {zone}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Visit History ({person.visits.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {person.visits.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No visit history found.</p>
                        ) : (
                          person.visits.map((visit) => (
                            <div key={visit.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={
                                      visit.status === "completed" ? "default" : visit.status === "ongoing" ? "secondary" : "destructive"
                                    }
                                  >
                                    {visit.status}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={
                                      visit.securityLevel === "high"
                                        ? "bg-red-50 text-red-700"
                                        : visit.securityLevel === "elevated"
                                          ? "bg-orange-50 text-orange-700"
                                          : "bg-blue-50 text-blue-700"
                                    }
                                  >
                                    {visit.securityLevel}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">QR: {visit.qrCodeId}</p>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
                                <div>
                                  <p className="text-xs text-muted-foreground">Date</p>
                                  <p className="text-sm font-medium">{formatDate(visit.date)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Time</p>
                                  <p className="text-sm font-medium">
                                    {visit.timeIn} - {visit.timeOut || "Ongoing"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Purpose</p>
                                  <p className="text-sm font-medium">{visit.purpose}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Host</p>
                                  <p className="text-sm font-medium">{visit.hostName}</p>
                                  <p className="text-xs text-muted-foreground">{visit.hostDepartment}</p>
                                </div>
                              </div>

                              <div className="mt-3">
                                <p className="text-xs text-muted-foreground mb-1">Zones Visited:</p>
                                <div className="flex flex-wrap gap-2">
                                  {visit.zones.map((zone) => (
                                    <Badge key={zone} variant="outline" className="bg-blue-50">
                                      {zone}
                                    </Badge>
                                  ))}
                                </div>
                              </div>

                              <div className="mt-3 flex items-center gap-2">
                                <Badge variant="outline" className="bg-purple-50 text-purple-700">
                                  Escort: {visit.escortRequired ? "Required" : "Not Required"}
                                </Badge>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Documents ({person.documents.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {person.documents.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No documents found.</p>
                        ) : (
                          person.documents.map((doc) => (
                            <div key={doc.id} className="flex items-center gap-3 p-3 border rounded-lg">
                              <FileText className="h-8 w-8 text-blue-600" />
                              <div className="flex-1">
                                <p className="font-medium">{doc.type}</p>
                                <p className="text-xs text-muted-foreground">{doc.name}</p>
                                <p className="text-xs text-muted-foreground">Uploaded: {formatDate(doc.uploadedDate)}</p>
                              </div>
                              <Badge
                                variant="outline"
                                className={doc.verified ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}
                              >
                                {doc.verified ? "Verified" : "Pending"}
                              </Badge>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}

