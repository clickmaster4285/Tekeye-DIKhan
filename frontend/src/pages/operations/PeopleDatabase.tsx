"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Upload, 
  Camera, 
  Phone, 
  Mail, 
  IdCard,
  User,
  Download,
  Shield,
  Clock,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Globe,
  Briefcase,
  Users,
  Filter,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { getPeopleDatabaseDetailPath } from "@/routes/config"

// Types
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

const isRenderableImageUrl = (v: string | undefined | null): v is string => {
  if (!v) return false
  const s = v.trim()
  if (!s) return false
  return s.startsWith("data:image/") || s.startsWith("http://") || s.startsWith("https://")
}

const getAvatarUrl = (person: Pick<Person, "id" | "name" | "imageUrl">) => {
  if (isRenderableImageUrl(person.imageUrl)) return person.imageUrl
  const seed = encodeURIComponent(person.id || person.name || "person")
  return `https://i.pravatar.cc/150?u=${seed}`
}

const STORAGE_KEY = "customs-people-database"

type ImageSearchState = {
  fileName: string
  dataUrl: string
}

const loadInitialPeople = (): Person[] => {
  if (typeof window === "undefined") return []
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored) as Person[]
    const sample = generateSampleData()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sample))
    return sample
  } catch {
    return []
  }
}

// Sample Data Generator
const generateSampleData = (): Person[] => {
  return [
    {
      id: "1",
      name: "Ahmed Khan",
      cnic: "42201-1234567-8",
      phone: "+92 300 1234567",
      email: "ahmed.khan@email.com",
      address: "House #123, Block A, Gulshan-e-Iqbal, Karachi",
      dateOfBirth: "1985-05-15",
      nationality: "Pakistani",
      passportNumber: "AB1234567",
      enrollmentDate: "2024-01-10",
      status: "active",
      imageUrl: "/avatars/ahmed.jpg",
      fingerprintRegistered: true,
      faceRegistered: true,
      riskLevel: "low",
      organization: "Karachi Trading Co.",
      designation: "Logistics Manager",
      organizationType: "private",
      vehicleInfo: {
        type: "car",
        number: "KHI-1234",
        registrationNo: "KHI-2024-5678",
        licenseNo: "DL-56789"
      },
      emergencyContact: {
        name: "Fatima Ahmed",
        relation: "Spouse",
        phone: "+92 300 7654321"
      },
      visits: [
        {
          id: "v1",
          date: "2024-03-15",
          timeIn: "09:30",
          timeOut: "11:45",
          purpose: "License Renewal",
          hostName: "Mr. Jahandad Khan",
          hostDepartment: "HR",
          zones: ["Zone A - Administrative", "Zone B - Secure Area"],
          status: "completed",
          securityLevel: "standard",
          escortRequired: false,
          qrCodeId: "QR-2024-001"
        },
        {
          id: "v2",
          date: "2024-03-10",
          timeIn: "14:15",
          timeOut: "16:30",
          purpose: "Meeting",
          hostName: "Mr. Ali Ahmed",
          hostDepartment: "IT",
          zones: ["Zone A - Administrative"],
          status: "completed",
          securityLevel: "standard",
          escortRequired: false,
          qrCodeId: "QR-2024-002"
        },
        {
          id: "v3",
          date: "2024-03-01",
          timeIn: "10:00",
          timeOut: "12:00",
          purpose: "Document Submission",
          hostName: "Mr. Hassan Khan",
          hostDepartment: "Operations",
          zones: ["Zone A - Administrative", "Zone C - Restricted"],
          status: "completed",
          securityLevel: "elevated",
          escortRequired: true,
          qrCodeId: "QR-2024-003"
        }
      ],
      alerts: [
        {
          id: "a1",
          type: "system",
          severity: "low",
          message: "Multiple access attempts in short period",
          date: "2024-03-14",
          resolved: true
        }
      ],
      documents: [
        {
          id: "d1",
          type: "CNIC",
          name: "cnic_front.jpg",
          uploadedDate: "2024-01-10",
          verified: true
        },
        {
          id: "d2",
          type: "Passport",
          name: "passport.pdf",
          uploadedDate: "2024-01-10",
          verified: true
        },
        {
          id: "d3",
          type: "Business License",
          name: "license.pdf",
          uploadedDate: "2024-01-10",
          verified: true
        }
      ],
      restrictedZones: ["Zone D - Command Center"],
      lastKnownLocation: "Zone A - Administrative"
    },
    {
      id: "2",
      name: "Fatima Akhtar",
      cnic: "42201-7654321-5",
      phone: "+92 321 9876543",
      email: "fatima.akhtar@email.com",
      address: "Flat #45, Heights Tower, DHA Phase 6, Lahore",
      dateOfBirth: "1990-08-22",
      nationality: "Pakistani",
      enrollmentDate: "2024-01-15",
      status: "active",
      imageUrl: "/avatars/fatima.jpg",
      fingerprintRegistered: true,
      faceRegistered: true,
      riskLevel: "low",
      organization: "Lahore Chamber of Commerce",
      designation: "Secretary",
      organizationType: "ngo",
      vehicleInfo: {
        type: "car",
        number: "LHR-5678",
        registrationNo: "LHR-2024-1234",
        licenseNo: "DL-98765"
      },
      emergencyContact: {
        name: "Ali Akhtar",
        relation: "Brother",
        phone: "+92 321 1234567"
      },
      visits: [
        {
          id: "v4",
          date: "2024-03-14",
          timeIn: "10:30",
          timeOut: "12:45",
          purpose: "Meeting",
          hostName: "Mr. Jahandad Khan",
          hostDepartment: "HR",
          zones: ["Zone A - Administrative"],
          status: "completed",
          securityLevel: "standard",
          escortRequired: false,
          qrCodeId: "QR-2024-004"
        },
        {
          id: "v5",
          date: "2024-03-12",
          timeIn: "15:00",
          timeOut: "17:00",
          purpose: "Consultation",
          hostName: "Mr. Ali Ahmed",
          hostDepartment: "IT",
          zones: ["Zone A - Administrative", "Zone B - Secure Area"],
          status: "completed",
          securityLevel: "elevated",
          escortRequired: true,
          qrCodeId: "QR-2024-005"
        }
      ],
      alerts: [],
      documents: [
        {
          id: "d4",
          type: "CNIC",
          name: "cnic_front.jpg",
          uploadedDate: "2024-01-15",
          verified: true
        },
        {
          id: "d5",
          type: "Organization Letter",
          name: "authorization.pdf",
          uploadedDate: "2024-01-15",
          verified: true
        }
      ],
      restrictedZones: ["Zone C - Restricted", "Zone D - Command Center"],
      lastKnownLocation: "Zone A - Administrative"
    },
    {
      id: "3",
      name: "Bilal Ahmed",
      cnic: "42201-9876543-2",
      phone: "+92 333 5557777",
      email: "bilal.ahmed@email.com",
      address: "Street #5, G-10/4, Islamabad",
      dateOfBirth: "1975-11-30",
      nationality: "Pakistani",
      passportNumber: "CD7654321",
      enrollmentDate: "2024-02-01",
      status: "watchlist",
      imageUrl: "/avatars/bilal.jpg",
      fingerprintRegistered: true,
      faceRegistered: true,
      riskLevel: "medium",
      organization: "Islamabad Traders",
      designation: "Business Owner",
      organizationType: "private",
      vehicleInfo: {
        type: "suv",
        number: "ISL-9012",
        registrationNo: "ISL-2024-3456",
        licenseNo: "DL-34567"
      },
      emergencyContact: {
        name: "Sara Bilal",
        relation: "Spouse",
        phone: "+92 333 5558888"
      },
      visits: [
        {
          id: "v6",
          date: "2024-03-13",
          timeIn: "11:00",
          timeOut: "13:30",
          purpose: "Auction verification",
          hostName: "Mr. Hassan Khan",
          hostDepartment: "Operations",
          zones: ["Zone A - Administrative", "Zone C - Restricted"],
          status: "completed",
          securityLevel: "high",
          escortRequired: true,
          qrCodeId: "QR-2024-006"
        },
        {
          id: "v7",
          date: "2024-03-08",
          timeIn: "09:45",
          timeOut: "11:15",
          purpose: "License Renewal",
          hostName: "Mr. Ali Ahmed",
          hostDepartment: "IT",
          zones: ["Zone A - Administrative"],
          status: "completed",
          securityLevel: "standard",
          escortRequired: false,
          qrCodeId: "QR-2024-007"
        }
      ],
      alerts: [
        {
          id: "a2",
          type: "security",
          severity: "high",
          message: "Attempted access to restricted zone without escort",
          date: "2024-03-13",
          resolved: false
        },
        {
          id: "a3",
          type: "compliance",
          severity: "medium",
          message: "Document verification pending for high-value auction",
          date: "2024-03-10",
          resolved: false
        }
      ],
      documents: [
        {
          id: "d6",
          type: "CNIC",
          name: "cnic_front.jpg",
          uploadedDate: "2024-02-01",
          verified: true
        },
        {
          id: "d7",
          type: "Business Registration",
          name: "ntn_certificate.pdf",
          uploadedDate: "2024-02-01",
          verified: false
        }
      ],
      restrictedZones: ["Zone D - Command Center", "Zone E - Evidence Room"],
      watchlistReason: "Multiple high-value auction participations requiring enhanced scrutiny",
      lastKnownLocation: "Zone C - Restricted",
      associatedWith: ["Ahmed Khan", "Imran Ali"]
    },
    {
      id: "4",
      name: "Imran Ali",
      cnic: "42201-4567890-1",
      phone: "+92 345 1237890",
      email: "imran.ali@email.com",
      address: "House #78, Sector F-7/3, Islamabad",
      dateOfBirth: "1988-03-18",
      nationality: "Pakistani",
      passportNumber: "EF3456789",
      enrollmentDate: "2024-01-20",
      status: "blacklisted",
      imageUrl: "/avatars/imran.jpg",
      fingerprintRegistered: true,
      faceRegistered: true,
      riskLevel: "critical",
      organization: "Alpha Imports",
      designation: "Import Manager",
      organizationType: "private",
      vehicleInfo: {
        type: "car",
        number: "ISL-4567",
        registrationNo: "ISL-2024-7890",
        licenseNo: "DL-45678"
      },
      emergencyContact: {
        name: "Zainab Imran",
        relation: "Spouse",
        phone: "+92 345 1237891"
      },
      visits: [
        {
          id: "v8",
          date: "2024-02-28",
          timeIn: "14:30",
          timeOut: "15:45",
          purpose: "Hearing and Adjudication",
          hostName: "Mr. Hassan Khan",
          hostDepartment: "Operations",
          zones: ["Zone C - Restricted", "Zone E - Evidence Room"],
          status: "completed",
          securityLevel: "high",
          escortRequired: true,
          qrCodeId: "QR-2024-008"
        },
        {
          id: "v9",
          date: "2024-02-15",
          timeIn: "10:15",
          timeOut: "11:30",
          purpose: "Document Submission",
          hostName: "Mr. Ali Ahmed",
          hostDepartment: "IT",
          zones: ["Zone A - Administrative"],
          status: "completed",
          securityLevel: "elevated",
          escortRequired: true,
          qrCodeId: "QR-2024-009"
        }
      ],
      alerts: [
        {
          id: "a4",
          type: "security",
          severity: "critical",
          message: "Attempted to photograph classified documents",
          date: "2024-02-28",
          resolved: false
        },
        {
          id: "a5",
          type: "compliance",
          severity: "high",
          message: "False declaration in import documents",
          date: "2024-02-20",
          resolved: false
        },
        {
          id: "a6",
          type: "security",
          severity: "critical",
          message: "Physical altercation with security personnel",
          date: "2024-02-28",
          resolved: false
        }
      ],
      documents: [
        {
          id: "d8",
          type: "CNIC",
          name: "cnic_front.jpg",
          uploadedDate: "2024-01-20",
          verified: true
        },
        {
          id: "d9",
          type: "Passport",
          name: "passport.pdf",
          uploadedDate: "2024-01-20",
          verified: true
        }
      ],
      restrictedZones: ["All Zones"],
      blacklistReason: "Security violation - unauthorized photography in restricted area",
      lastKnownLocation: "Zone E - Evidence Room",
      associatedWith: ["Bilal Ahmed"]
    },
    {
      id: "5",
      name: "Sara Khan",
      cnic: "42201-3456789-4",
      phone: "+92 334 4567890",
      email: "sara.khan@email.com",
      address: "Apartment #302, Executive Heights, Karachi",
      dateOfBirth: "1992-07-10",
      nationality: "Pakistani",
      enrollmentDate: "2024-02-10",
      status: "pending",
      imageUrl: "/avatars/sara.jpg",
      fingerprintRegistered: false,
      faceRegistered: true,
      riskLevel: "low",
      organization: "Customs Broker Association",
      designation: "Junior Broker",
      organizationType: "private",
      emergencyContact: {
        name: "Ahmed Khan",
        relation: "Father",
        phone: "+92 334 4567891"
      },
      visits: [
        {
          id: "v10",
          date: "2024-03-16",
          timeIn: "09:00",
          timeOut: null,
          purpose: "License Application",
          hostName: "Mr. Jahandad Khan",
          hostDepartment: "HR",
          zones: ["Zone A - Administrative"],
          status: "ongoing",
          securityLevel: "standard",
          escortRequired: false,
          qrCodeId: "QR-2024-010"
        }
      ],
      alerts: [
        {
          id: "a7",
          type: "system",
          severity: "medium",
          message: "Fingerprint registration pending",
          date: "2024-03-16",
          resolved: false
        }
      ],
      documents: [
        {
          id: "d10",
          type: "CNIC",
          name: "cnic_front.jpg",
          uploadedDate: "2024-02-10",
          verified: true
        },
        {
          id: "d11",
          type: "Training Certificate",
          name: "certificate.pdf",
          uploadedDate: "2024-02-10",
          verified: false
        }
      ],
      restrictedZones: ["Zone B - Secure Area", "Zone C - Restricted"],
      lastKnownLocation: "Zone A - Administrative"
    }
  ]
}

// Risk Level Badge Component
const RiskLevelBadge = ({ level }: { level: string }) => {
  const config = {
    low: { color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
    medium: { color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: AlertTriangle },
    high: { color: "bg-orange-100 text-orange-800 border-orange-200", icon: AlertTriangle },
    critical: { color: "bg-red-100 text-red-800 border-red-200", icon: Shield }
  }
  const { color, icon: Icon } = config[level as keyof typeof config] || config.low
  
  return (
    <Badge variant="outline" className={`${color} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </Badge>
  )
}

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const config = {
    active: { color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
    inactive: { color: "bg-gray-100 text-gray-800 border-gray-200", icon: XCircle },
    pending: { color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
    blacklisted: { color: "bg-red-100 text-red-800 border-red-200", icon: Shield },
    watchlist: { color: "bg-orange-100 text-orange-800 border-orange-200", icon: AlertTriangle }
  }
  const { color, icon: Icon } = config[status as keyof typeof config] || config.inactive
  
  return (
    <Badge variant="outline" className={`${color} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

// Main Component
export default function PeopleDatabasePage() {
  const navigate = useNavigate()
  const [searchFilters, setSearchFilters] = useState({
    name: "",
    cnic: "",
    phone: "",
    email: "",
    nationality: "",
    organization: "",
    riskLevel: "",
    status: ""
  })
  
  const [activeTab, setActiveTab] = useState("all")
  const [people] = useState<Person[]>(() => loadInitialPeople())
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [imageSearch, setImageSearch] = useState<ImageSearchState | null>(null)

  const normalizedImageSearchToken = (imageSearch?.fileName || "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .trim()

  const imageInputId = "people-image-search"

  const handleFilterChange = (key: string, value: string) => {
    setSearchFilters(prev => ({
      ...prev,
      [key]: value
    }))
    setCurrentPage(1)
  }

  const imageMatchesPerson = (person: Person) => {
    if (!imageSearch) return true
    // Match exact data URL
    if (person.imageUrl && person.imageUrl.startsWith("data:image/")) {
      if (imageSearch.dataUrl && person.imageUrl === imageSearch.dataUrl) return true
    }
    // Match by filename (ignore extension and path)
    if (person.imageUrl) {
      const storedFile = person.imageUrl.split("/").pop()?.split(".")[0]?.toLowerCase() || ""
      const uploadedFile = imageSearch.fileName.split(".")[0]?.toLowerCase() || ""
      if (storedFile && uploadedFile && storedFile === uploadedFile) return true
    }
    // Match by person name
    if (person.name && normalizedImageSearchToken) {
      const name = person.name.toLowerCase()
      if (name.includes(normalizedImageSearchToken.replace(/[-_]+/g, " "))) return true
    }
    return false
  }

  const filteredPeople = people.filter(person => {
    // Filter by status tab
    if (activeTab !== "all" && person.status !== activeTab) return false
    
    // Filter by search criteria
    const matchesName = person.name.toLowerCase().includes(searchFilters.name.toLowerCase())
    const matchesCNIC = person.cnic.includes(searchFilters.cnic)
    const matchesPhone = person.phone.includes(searchFilters.phone)
    const matchesEmail = person.email.toLowerCase().includes(searchFilters.email.toLowerCase())
    const matchesNationality = !searchFilters.nationality || person.nationality.toLowerCase().includes(searchFilters.nationality.toLowerCase())
    const matchesOrganization = !searchFilters.organization || (person.organization?.toLowerCase() || "").includes(searchFilters.organization.toLowerCase())
    const matchesRiskLevel = !searchFilters.riskLevel || person.riskLevel === searchFilters.riskLevel
    const matchesStatus = !searchFilters.status || person.status === searchFilters.status
    
    // If any filter has value, match accordingly
    if (searchFilters.name && !matchesName) return false
    if (searchFilters.cnic && !matchesCNIC) return false
    if (searchFilters.phone && !matchesPhone) return false
    if (searchFilters.email && !matchesEmail) return false
    if (searchFilters.nationality && !matchesNationality) return false
    if (searchFilters.organization && !matchesOrganization) return false
    if (searchFilters.riskLevel && !matchesRiskLevel) return false
    if (searchFilters.status && !matchesStatus) return false
    if (!imageMatchesPerson(person)) return false
    
    return true
  })

  const clearFilters = () => {
    setSearchFilters({
      name: "",
      cnic: "",
      phone: "",
      email: "",
      nationality: "",
      organization: "",
      riskLevel: "",
      status: ""
    })
    setActiveTab("all")
    setCurrentPage(1)
  }

  const handleViewDetails = (person: Person) => {
    navigate(getPeopleDatabaseDetailPath(person.id))
  }

  const exportCsv = () => {
    const rows = filteredPeople
    const headers = [
      "ID",
      "Name",
      "CNIC",
      "Passport",
      "Phone",
      "Email",
      "Nationality",
      "Organization",
      "Designation",
      "Risk Level",
      "Status",
      "Enrollment Date",
      "Last Visit Date",
      "Total Visits",
    ]

    const escape = (v: unknown) => {
      const s = String(v ?? "")
      // If it includes special chars, wrap with quotes and escape quotes.
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const lastVisit = (p: Person) => (p.visits?.length ? p.visits[0]!.date : "")

    const lines = [
      headers.join(","),
      ...rows.map((p) =>
        [
          p.id,
          p.name,
          p.cnic,
          p.passportNumber || "",
          p.phone,
          p.email,
          p.nationality,
          p.organization || "",
          p.designation || "",
          p.riskLevel,
          p.status,
          p.enrollmentDate,
          lastVisit(p),
          p.visits?.length ?? 0,
        ]
          .map(escape)
          .join(",")
      ),
    ].join("\n")

    const blob = new Blob([lines], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
    a.download = `people-database-${stamp}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const handleImageUploadClick = () => {
    const el = document.getElementById(imageInputId) as HTMLInputElement | null
    el?.click()
  }

  const handleImageSelected = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : ""
      if (!dataUrl.startsWith("data:image/")) return
      setImageSearch({ fileName: file.name || "image", dataUrl })
      setCurrentPage(1)
    }
    reader.readAsDataURL(file)
  }

  const getRiskLevelCount = (level: string) => {
    return people.filter(p => p.riskLevel === level).length
  }

  const getStatusCount = (status: string) => {
    if (status === "all") return people.length
    return people.filter(p => p.status === status).length
  }

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredPeople.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredPeople.length / itemsPerPage)

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber)

  // Format date helper
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <ModulePageLayout
      title="People Database"
      description="Complete visitor tracking system for Pakistan Customs - facial recognition, biometric enrollment, and visit history"
      breadcrumbs={[{ label: "AI Analytics" }, { label: "People Database" }]}
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="bg-linear-to-br from-blue-50 to-white border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Visitors</p>
                  <p className="text-2xl font-bold text-blue-900">{people.length}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-linear-to-br from-green-50 to-white border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Active</p>
                  <p className="text-2xl font-bold text-green-900">{getStatusCount("active")}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-linear-to-br from-yellow-50 to-white border-yellow-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">Watchlist</p>
                  <p className="text-2xl font-bold text-yellow-900">{getStatusCount("watchlist")}</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-linear-to-br from-orange-50 to-white border-orange-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">High Risk</p>
                  <p className="text-2xl font-bold text-orange-900">{getRiskLevelCount("high") + getRiskLevelCount("critical")}</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <Shield className="h-5 w-5 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-linear-to-br from-red-50 to-white border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Blacklisted</p>
                  <p className="text-2xl font-bold text-red-900">{getStatusCount("blacklisted")}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Advanced Search Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-sm font-medium text-muted-foreground">Search by any field</h3>
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 self-start sm:self-auto">
                  Clear All
                </Button>
              </div>
              
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="picture-search" className="flex items-center gap-2 text-sm">
                      <Camera className="h-4 w-4" />
                      Find by Picture
                    </Label>
                    <input
                      id={imageInputId}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageSelected(e.target.files?.[0] ?? null)}
                    />
                    <Button variant="outline" className="w-full justify-start" size="sm" onClick={handleImageUploadClick}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Image
                    </Button>
                    {imageSearch ? (
                      <div className="flex items-center gap-3 rounded-md border bg-muted/20 p-2">
                        <img
                          src={imageSearch.dataUrl}
                          alt="Uploaded search"
                          className="h-10 w-10 rounded object-cover border bg-background"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{imageSearch.fileName}</p>
                          <p className="text-xs text-muted-foreground">Filtering results by image (demo)</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => setImageSearch(null)}
                        >
                          Clear
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <Separator className="lg:hidden" />
                  <div className="space-y-2">
                    <Label htmlFor="name-filter" className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4" />
                      Full Name
                    </Label>
                    <Input
                      id="name-filter"
                      placeholder="Search by name..."
                      value={searchFilters.name}
                      onChange={(e) => handleFilterChange("name", e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnic-filter" className="flex items-center gap-2 text-sm">
                      <IdCard className="h-4 w-4" />
                      CNIC Number
                    </Label>
                    <Input
                      id="cnic-filter"
                      placeholder="XXXXX-XXXXXXX-X"
                      value={searchFilters.cnic}
                      onChange={(e) => handleFilterChange("cnic", e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="phone-filter" className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4" />
                      Phone Number
                    </Label>
                    <Input
                      id="phone-filter"
                      placeholder="03XX-XXXXXXX"
                      value={searchFilters.phone}
                      onChange={(e) => handleFilterChange("phone", e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-filter" className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4" />
                      Email
                    </Label>
                    <Input
                      id="email-filter"
                      placeholder="email@example.com"
                      value={searchFilters.email}
                      onChange={(e) => handleFilterChange("email", e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nationality-filter" className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4" />
                      Nationality
                    </Label>
                    <Input
                      id="nationality-filter"
                      placeholder="e.g., Pakistani"
                      value={searchFilters.nationality}
                      onChange={(e) => handleFilterChange("nationality", e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="organization-filter" className="flex items-center gap-2 text-sm">
                      <Briefcase className="h-4 w-4" />
                      Organization
                    </Label>
                    <Input
                      id="organization-filter"
                      placeholder="Company name"
                      value={searchFilters.organization}
                      onChange={(e) => handleFilterChange("organization", e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="risk-filter" className="flex items-center gap-2 text-sm">
                      <Shield className="h-4 w-4" />
                      Risk Level
                    </Label>
                    <select
                      id="risk-filter"
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={searchFilters.riskLevel}
                      onChange={(e) => handleFilterChange("riskLevel", e.target.value)}
                    >
                      <option value="">All Risk Levels</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status-filter" className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" />
                      Status
                    </Label>
                    <select
                      id="status-filter"
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={searchFilters.status}
                      onChange={(e) => handleFilterChange("status", e.target.value)}
                    >
                      <option value="">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="pending">Pending</option>
                      <option value="watchlist">Watchlist</option>
                      <option value="blacklisted">Blacklisted</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground">
                  <TabsTrigger value="all" className="px-4">
                    All ({getStatusCount("all")})
                  </TabsTrigger>
                  <TabsTrigger value="active" className="px-4">
                    Active ({getStatusCount("active")})
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="px-4">
                    Pending ({getStatusCount("pending")})
                  </TabsTrigger>
                  <TabsTrigger value="watchlist" className="px-4">
                    Watchlist ({getStatusCount("watchlist")})
                  </TabsTrigger>
                  <TabsTrigger value="blacklisted" className="px-4">
                    Blacklisted ({getStatusCount("blacklisted")})
                  </TabsTrigger>
                  <TabsTrigger value="inactive" className="px-4">
                    Inactive ({getStatusCount("inactive")})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="px-3 py-1">
                {filteredPeople.length} record{filteredPeople.length !== 1 ? 's' : ''} found
              </Badge>
              <Button variant="outline" size="sm" className="h-8" onClick={exportCsv}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* People Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-62.5">Visitor</TableHead>
                    <TableHead>CNIC / Passport</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Visit</TableHead>
                    <TableHead>Total Visits</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentItems.map((person) => (
                    <TableRow key={person.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={getAvatarUrl(person)} alt={person.name} />
                            <AvatarFallback>
                              {person.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{person.name}</p>
                            <p className="text-xs text-muted-foreground">ID: {person.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm">{person.cnic}</p>
                          {person.passportNumber && (
                            <p className="text-xs text-muted-foreground">Passport: {person.passportNumber}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm">{person.phone}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-37.5">{person.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{person.organization || "—"}</p>
                          <p className="text-xs text-muted-foreground">{person.designation || "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RiskLevelBadge level={person.riskLevel} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={person.status} />
                      </TableCell>
                      <TableCell>
                        {person.visits.length > 0 ? (
                          <div>
                            <p className="text-sm">{formatDate(person.visits[0].date)}</p>
                            <p className="text-xs text-muted-foreground">{person.visits[0].timeIn}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No visits</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50">
                          {person.visits.length}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(person)}
                          className="h-8 px-2"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {filteredPeople.length > itemsPerPage && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredPeople.length)} of {filteredPeople.length} records
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModulePageLayout>
  )
}