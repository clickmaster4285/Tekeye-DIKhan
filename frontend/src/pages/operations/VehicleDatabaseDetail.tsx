// src/pages/operations/VehicleDatabaseDetail.tsx
"use client"

import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import {
  Car,
  Truck,
  Bike,
  ChevronLeft,
  Clock,
  User,
  IdCard,
  Phone,
  Mail,
  MapPin,
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  History,
  Camera as CameraIcon,
  Building2,
  Download,
  Calendar,
  Fuel,
  Wrench,
  Gauge,
  Palette,
  Hash,
  Users,
  Activity,
  QrCode,
  Printer,
  Copy,
  Edit,
  Trash2
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"

// Types
interface VehicleOwner {
  id: string
  name: string
  cnic: string
  phone: string
  email: string
  relation: "owner" | "driver" | "company" | "authorized"
  designation?: string
  company?: string
}

interface VehicleEntry {
  id: string
  date: string
  timeIn: string
  timeOut: string | null
  gateIn: string
  gateOut: string | null
  purpose: string
  hostName: string
  hostDepartment: string
  zoneVisited: string
  status: "inside" | "exited" | "pending"
  lprConfidence: number
  lprImageIn?: string
  lprImageOut?: string
}

interface VehicleAlert {
  id: string
  type: "stolen" | "suspicious" | "expired" | "violation"
  severity: "low" | "medium" | "high" | "critical"
  message: string
  date: string
  resolved: boolean
}

interface VehicleDocument {
  id: string
  type: string
  name: string
  uploadedDate: string
  verified: boolean
  fileUrl?: string
}

interface Vehicle {
  id: string
  registrationNumber: string
  registrationNumberFormatted: string
  province: string
  make: string
  model: string
  year: number
  color: string
  type: "car" | "motorcycle" | "truck" | "van" | "bus" | "suv" | "other"
  category: "private" | "commercial" | "government" | "diplomatic" | "rental"
  fuelType: "petrol" | "diesel" | "cng" | "electric" | "hybrid"
  engineNumber: string
  chassisNumber: string
  registrationExpiry: string
  insuranceExpiry: string
  fitnessCertificate: string
  status: "active" | "blacklisted" | "pending" | "expired" | "watchlist"
  riskLevel: "low" | "medium" | "high" | "critical"
  
  owners: VehicleOwner[]
  
  images: {
    front?: string
    back?: string
    left?: string
    right?: string
    lpr?: string[]
  }
  
  entries: VehicleEntry[]
  
  totalVisits: number
  firstVisit: string
  lastVisit: string
  averageStayDuration: number
  mostVisitedZone: string
  mostVisitedGate: string
  
  alerts: VehicleAlert[]
  documents: VehicleDocument[]
  
  additionalDetails?: {
    registrationCity?: string
    registrationAuthority?: string
    ownerNationality?: string
    taxStatus?: string
    routePermit?: string
    cargoCapacity?: string
    seatingCapacity?: number
    axleType?: string
  }
}

// Dummy vehicle images
const dummyImages = {
  car: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRLptOjOJenqt7Bz6qsECtviNs6J1SylWar3w&s",
  truck: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQYD5UL1GXpvNSYNEcIHC5--qpwVN6MolRg8A&s",
  motorcycle: "https://images.unsplash.com/photo-1465101046530-73398c7f1a3b?auto=format&fit=crop&w=400&q=80",
  suv: "https://images.unsplash.com/photo-1502877336882-7c3c71a5d2b5?auto=format&fit=crop&w=400&q=80",
  van: "https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=80"
}

// Sample vehicle data
const sampleVehicles: Vehicle[] = [
  {
    id: "V001",
    registrationNumber: "LEG-5678",
    registrationNumberFormatted: "LEG-5678",
    province: "Sindh",
    make: "Toyota",
    model: "Corolla",
    year: 2023,
    color: "White",
    type: "car",
    category: "private",
    fuelType: "petrol",
    engineNumber: "2ZR-123456",
    chassisNumber: "MR053RE4301234567",
    registrationExpiry: "2025-12-31",
    insuranceExpiry: "2024-12-31",
    fitnessCertificate: "FC-2024-12345",
    status: "active",
    riskLevel: "low",
    owners: [
      {
        id: "O001",
        name: "Ahmed Khan",
        cnic: "42201-1234567-8",
        phone: "+92 300 1234567",
        email: "ahmed.khan@email.com",
        relation: "owner",
        designation: "Business Owner"
      }
    ],
    images: {
      front: dummyImages.car,
      back: dummyImages.car,
      left: dummyImages.car,
      right: dummyImages.car,
      lpr: [dummyImages.car, dummyImages.car]
    },
    entries: [
      {
        id: "E001",
        date: "2024-03-15",
        timeIn: "09:30",
        timeOut: "11:45",
        gateIn: "Main Gate",
        gateOut: "Main Gate",
        purpose: "Meeting",
        hostName: "Mr. Jahandad Khan",
        hostDepartment: "HR",
        zoneVisited: "Zone A",
        status: "exited",
        lprConfidence: 98,
        lprImageIn: dummyImages.car,
        lprImageOut: dummyImages.car
      },
      {
        id: "E002",
        date: "2024-03-10",
        timeIn: "14:15",
        timeOut: "16:30",
        gateIn: "Main Gate",
        gateOut: "Main Gate",
        purpose: "Delivery",
        hostName: "Mr. Ali Ahmed",
        hostDepartment: "Operations",
        zoneVisited: "Zone B",
        status: "exited",
        lprConfidence: 97,
        lprImageIn: dummyImages.car,
        lprImageOut: dummyImages.car
      }
    ],
    totalVisits: 15,
    firstVisit: "2024-01-10",
    lastVisit: "2024-03-15",
    averageStayDuration: 125,
    mostVisitedZone: "Zone A",
    mostVisitedGate: "Main Gate",
    alerts: [],
    documents: [
      {
        id: "D001",
        type: "Registration",
        name: "registration.pdf",
        uploadedDate: "2024-01-10",
        verified: true
      },
      {
        id: "D002",
        type: "Insurance",
        name: "insurance.pdf",
        uploadedDate: "2024-01-10",
        verified: true
      }
    ],
    additionalDetails: {
      registrationCity: "Karachi",
      registrationAuthority: "Excise & Taxation Sindh",
      taxStatus: "Paid",
      seatingCapacity: 5
    }
  },
  {
    id: "V002",
    registrationNumber: "TRK-1234",
    registrationNumberFormatted: "TRK-1234",
    province: "Punjab",
    make: "Hino",
    model: "500",
    year: 2020,
    color: "Blue",
    type: "truck",
    category: "commercial",
    fuelType: "diesel",
    engineNumber: "HINO-789012",
    chassisNumber: "HINO1234567890",
    registrationExpiry: "2024-12-31",
    insuranceExpiry: "2024-06-30",
    fitnessCertificate: "FC-2024-67890",
    status: "active",
    riskLevel: "medium",
    owners: [
      {
        id: "O002",
        name: "Bilal Ahmed",
        cnic: "42201-9876543-2",
        phone: "+92 333 5557777",
        email: "bilal.ahmed@email.com",
        relation: "owner",
        designation: "Business Owner"
      }
    ],
    images: {
      front: dummyImages.truck,
      back: dummyImages.truck,
      left: dummyImages.truck,
      right: dummyImages.truck
    },
    entries: [
      {
        id: "E003",
        date: "2024-03-14",
        timeIn: "08:30",
        timeOut: "17:45",
        gateIn: "Commercial Gate",
        gateOut: "Commercial Gate",
        purpose: "Goods Delivery",
        hostName: "Mr. Hassan Khan",
        hostDepartment: "Operations",
        zoneVisited: "Commercial Zone",
        status: "exited",
        lprConfidence: 95,
        lprImageIn: dummyImages.truck,
        lprImageOut: dummyImages.truck
      }
    ],
    totalVisits: 25,
    firstVisit: "2024-01-05",
    lastVisit: "2024-03-14",
    averageStayDuration: 480,
    mostVisitedZone: "Commercial Zone",
    mostVisitedGate: "Commercial Gate",
    alerts: [
      {
        id: "A001",
        type: "expired",
        severity: "medium",
        message: "Insurance expiring soon",
        date: "2024-03-01",
        resolved: false
      }
    ],
    documents: [
      {
        id: "D003",
        type: "Registration",
        name: "registration.pdf",
        uploadedDate: "2024-01-05",
        verified: true
      },
      {
        id: "D004",
        type: "Fitness Certificate",
        name: "fitness.pdf",
        uploadedDate: "2024-01-05",
        verified: true
      }
    ],
    additionalDetails: {
      registrationCity: "Lahore",
      cargoCapacity: "5000 kg",
      axleType: "Double"
    }
  }
]

// Helper Components
const VehicleTypeIcon = ({ type }: { type: string }) => {
  switch(type) {
    case "car": return <Car className="h-5 w-5" />
    case "suv": return <Car className="h-5 w-5" />
    case "truck": return <Truck className="h-5 w-5" />
    case "motorcycle": return <Bike className="h-5 w-5" />
    default: return <Car className="h-5 w-5" />
  }
}

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

const StatusBadge = ({ status }: { status: string }) => {
  const config = {
    active: { color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
    expired: { color: "bg-orange-100 text-orange-800 border-orange-200", icon: Clock },
    pending: { color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
    blacklisted: { color: "bg-red-100 text-red-800 border-red-200", icon: Shield },
    watchlist: { color: "bg-red-100 text-red-800 border-red-200", icon: AlertTriangle }
  }
  const { color, icon: Icon } = config[status as keyof typeof config] || config.pending
  
  return (
    <Badge variant="outline" className={`${color} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

// Main Detail Page Component
export default function VehicleDatabaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")
  const [imageDialogOpen, setImageDialogOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  useEffect(() => {
    // Load from localStorage or use sample data
    const stored = localStorage.getItem("customs-vehicle-database")
    let vehicles: Vehicle[] = []
    
    if (stored) {
      vehicles = JSON.parse(stored)
    } else {
      vehicles = sampleVehicles
      localStorage.setItem("customs-vehicle-database", JSON.stringify(sampleVehicles))
    }
    
    const found = vehicles.find(v => v.id === id)
    setVehicle(found || null)
    setLoading(false)
  }, [id])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString: string, timeString: string) => {
    return `${formatDate(dateString)} at ${timeString}`
  }

  const handleViewImage = (imageUrl: string) => {
    setSelectedImage(imageUrl)
    setImageDialogOpen(true)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExport = () => {
    if (!vehicle) return
    
    const data = {
      registrationNumber: vehicle.registrationNumber,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      type: vehicle.type,
      category: vehicle.category,
      owners: vehicle.owners,
      totalVisits: vehicle.totalVisits,
      lastVisit: vehicle.lastVisit,
      status: vehicle.status,
      riskLevel: vehicle.riskLevel
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vehicle-${vehicle.registrationNumber}.json`
    a.click()
  }

  const handleEdit = () => {
    toast({
      title: "Edit Vehicle",
      description: `Editing ${vehicle?.registrationNumberFormatted}`,
    })
  }

  const handleDuplicate = () => {
    if (!vehicle) return
    const newVehicle = {
      ...vehicle,
      id: `V${Math.floor(Math.random() * 1000)}`,
      registrationNumber: `${vehicle.registrationNumber}-COPY`,
      registrationNumberFormatted: `${vehicle.registrationNumberFormatted}-COPY`,
    }
    const stored = localStorage.getItem("customs-vehicle-database")
    const vehicles = stored ? JSON.parse(stored) : sampleVehicles
    const updatedVehicles = [...vehicles, newVehicle]
    localStorage.setItem("customs-vehicle-database", JSON.stringify(updatedVehicles))
    toast({
      title: "Vehicle Duplicated",
      description: "A copy has been created successfully.",
    })
  }

  const handleDelete = () => {
    if (!vehicle) return
    const stored = localStorage.getItem("customs-vehicle-database")
    const vehicles = stored ? JSON.parse(stored) : sampleVehicles
    const updatedVehicles = vehicles.filter((v: Vehicle) => v.id !== vehicle.id)
    localStorage.setItem("customs-vehicle-database", JSON.stringify(updatedVehicles))
    toast({
      title: "Vehicle Deleted",
      description: `${vehicle.registrationNumberFormatted} has been removed from database.`,
    })
    setDeleteDialogOpen(false)
    navigate("/vehicle-database")
  }

  if (loading) {
    return (
      <ModulePageLayout
        title="Vehicle Detail"
        description="Loading vehicle information..."
        breadcrumbs={[
          { label: "AI Analytics" },
          { label: "Vehicle Database", href: "/vehicle-database" },
          { label: "Loading..." }
        ]}
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Car className="h-12 w-12 animate-pulse text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Loading vehicle details...</p>
          </div>
        </div>
      </ModulePageLayout>
    )
  }

  if (!vehicle) {
    return (
      <ModulePageLayout
        title="Vehicle Not Found"
        description="The requested vehicle could not be found"
        breadcrumbs={[
          { label: "AI Analytics" },
          { label: "Vehicle Database", href: "/vehicle-database" },
          { label: "Not Found" }
        ]}
      >
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col items-center justify-center py-12">
              <Car className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Vehicle Not Found</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                The vehicle with ID "{id}" could not be found in the database. It may have been removed or the URL is incorrect.
              </p>
              <Button onClick={() => navigate("/vehicle-database")}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back to Vehicle Database
              </Button>
            </div>
          </CardContent>
        </Card>
      </ModulePageLayout>
    )
  }

  return (
    <ModulePageLayout
      title={`Vehicle Details - ${vehicle.registrationNumberFormatted}`}
      description={`${vehicle.make} ${vehicle.model} (${vehicle.year}) - ${vehicle.color}`}
      breadcrumbs={[
        { label: "AI Analytics" },
        { label: "Vehicle Database", href: "/vehicle-database" },
        { label: vehicle.registrationNumberFormatted }
      ]}
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate("/vehicle-database")}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Database
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Vehicle Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Vehicle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDuplicate}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Vehicle Header Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Vehicle Images Grid */}
              <div className="md:w-1/3">
                <div className="grid grid-cols-2 gap-2">
                  {/* Front Image */}
                  <div 
                    className="relative aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => vehicle.images.front && handleViewImage(vehicle.images.front)}
                  >
                    {vehicle.images.front ? (
                      <img
                        src={vehicle.images.front}
                        alt="Front view"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-muted flex items-center justify-center">
                        <VehicleTypeIcon type={vehicle.type} />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-1">
                      Front
                    </div>
                  </div>

                  {/* Back Image */}
                  <div 
                    className="relative aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => vehicle.images.back && handleViewImage(vehicle.images.back)}
                  >
                    {vehicle.images.back ? (
                      <img
                        src={vehicle.images.back}
                        alt="Back view"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-muted flex items-center justify-center">
                        <VehicleTypeIcon type={vehicle.type} />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-1">
                      Back
                    </div>
                  </div>

                  {/* Left Image */}
                  <div 
                    className="relative aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => vehicle.images.left && handleViewImage(vehicle.images.left)}
                  >
                    {vehicle.images.left ? (
                      <img
                        src={vehicle.images.left}
                        alt="Left view"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-muted flex items-center justify-center">
                        <VehicleTypeIcon type={vehicle.type} />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-1">
                      Left
                    </div>
                  </div>

                  {/* Right Image */}
                  <div 
                    className="relative aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => vehicle.images.right && handleViewImage(vehicle.images.right)}
                  >
                    {vehicle.images.right ? (
                      <img
                        src={vehicle.images.right}
                        alt="Right view"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-muted flex items-center justify-center">
                        <VehicleTypeIcon type={vehicle.type} />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-1">
                      Right
                    </div>
                  </div>
                </div>

                {/* LPR Images Preview */}
                {vehicle.images.lpr && vehicle.images.lpr.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <CameraIcon className="h-4 w-4" />
                      LPR Captures ({vehicle.images.lpr.length})
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {vehicle.images.lpr.map((img, idx) => (
                        <div
                          key={idx}
                          className="relative h-16 w-24 rounded-lg overflow-hidden border cursor-pointer shrink-0 hover:opacity-80 transition-opacity"
                          onClick={() => handleViewImage(img)}
                        >
                          <img src={img} alt={`LPR ${idx + 1}`} className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Vehicle Basic Info */}
              <div className="flex-1 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <VehicleTypeIcon type={vehicle.type} />
                      <h2 className="text-2xl font-bold">{vehicle.registrationNumberFormatted}</h2>
                    </div>
                    <p className="text-lg text-muted-foreground">{vehicle.make} {vehicle.model} • {vehicle.year}</p>
                  </div>
                  <div className="flex gap-2">
                    <StatusBadge status={vehicle.status} />
                    <RiskLevelBadge level={vehicle.riskLevel} />
                  </div>
                </div>

                {/* Key Information Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Province</p>
                    <p className="font-medium">{vehicle.province}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Color</p>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full" style={{ backgroundColor: vehicle.color.toLowerCase() }} />
                      <p className="font-medium">{vehicle.color}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Category</p>
                    <Badge variant="outline" className="capitalize">{vehicle.category}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Fuel Type</p>
                    <p className="font-medium capitalize">{vehicle.fuelType}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Engine No.</p>
                    <p className="font-mono text-sm">{vehicle.engineNumber}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Chassis No.</p>
                    <p className="font-mono text-sm">{vehicle.chassisNumber}</p>
                  </div>
                </div>

                {/* Expiry Information */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className={`p-3 rounded-lg border ${
                    new Date(vehicle.registrationExpiry) < new Date() 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-green-50 border-green-200'
                  }`}>
                    <p className="text-xs text-muted-foreground">Registration Expiry</p>
                    <p className={`font-medium ${
                      new Date(vehicle.registrationExpiry) < new Date() ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatDate(vehicle.registrationExpiry)}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg border ${
                    new Date(vehicle.insuranceExpiry) < new Date() 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-green-50 border-green-200'
                  }`}>
                    <p className="text-xs text-muted-foreground">Insurance Expiry</p>
                    <p className={`font-medium ${
                      new Date(vehicle.insuranceExpiry) < new Date() ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatDate(vehicle.insuranceExpiry)}
                    </p>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-3 pt-2">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold">{vehicle.totalVisits}</p>
                      <p className="text-xs text-muted-foreground">Total Visits</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold">{Math.round(vehicle.averageStayDuration)}</p>
                      <p className="text-xs text-muted-foreground">Avg Stay (min)</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-sm font-medium truncate">{vehicle.mostVisitedZone}</p>
                      <p className="text-xs text-muted-foreground">Top Zone</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-sm font-medium">{vehicle.mostVisitedGate}</p>
                      <p className="text-xs text-muted-foreground">Top Gate</p>
                    </CardContent>
                  </Card>
                </div>

                {/* First/Last Visit */}
                <div className="flex items-center justify-between text-sm p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>First Visit: {formatDate(vehicle.firstVisit)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Last Visit: {formatDate(vehicle.lastVisit)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for detailed information */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="owners">Owners ({vehicle.owners.length})</TabsTrigger>
            <TabsTrigger value="history">Visit History ({vehicle.entries.length})</TabsTrigger>
            <TabsTrigger value="documents">Documents ({vehicle.documents?.length || 0})</TabsTrigger>
            <TabsTrigger value="alerts">Alerts ({vehicle.alerts.filter(a => !a.resolved).length})</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Registration Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Registration Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Registration No.</p>
                      <p className="font-mono font-bold">{vehicle.registrationNumberFormatted}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Fitness Certificate</p>
                      <p className="font-mono text-sm">{vehicle.fitnessCertificate}</p>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Registration Validity</p>
                      <div className="flex items-center gap-4 mt-1">
                        <Badge variant="outline" className={
                          new Date(vehicle.registrationExpiry) < new Date() 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-green-100 text-green-700'
                        }>
                          {new Date(vehicle.registrationExpiry) < new Date() ? 'Expired' : 'Valid'}
                        </Badge>
                        <span className="text-sm">{formatDate(vehicle.registrationExpiry)}</span>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Insurance Validity</p>
                      <div className="flex items-center gap-4 mt-1">
                        <Badge variant="outline" className={
                          new Date(vehicle.insuranceExpiry) < new Date() 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-green-100 text-green-700'
                        }>
                          {new Date(vehicle.insuranceExpiry) < new Date() ? 'Expired' : 'Valid'}
                        </Badge>
                        <span className="text-sm">{formatDate(vehicle.insuranceExpiry)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Additional Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {vehicle.additionalDetails ? (
                    <div className="space-y-4">
                      {vehicle.additionalDetails.registrationCity && (
                        <div>
                          <p className="text-sm text-muted-foreground">Registration City</p>
                          <p className="font-medium">{vehicle.additionalDetails.registrationCity}</p>
                        </div>
                      )}
                      {vehicle.additionalDetails.registrationAuthority && (
                        <div>
                          <p className="text-sm text-muted-foreground">Registration Authority</p>
                          <p className="font-medium">{vehicle.additionalDetails.registrationAuthority}</p>
                        </div>
                      )}
                      {vehicle.additionalDetails.taxStatus && (
                        <div>
                          <p className="text-sm text-muted-foreground">Tax Status</p>
                          <Badge variant="outline" className={
                            vehicle.additionalDetails.taxStatus === 'Paid' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }>
                            {vehicle.additionalDetails.taxStatus}
                          </Badge>
                        </div>
                      )}
                      {vehicle.additionalDetails.cargoCapacity && (
                        <div>
                          <p className="text-sm text-muted-foreground">Cargo Capacity</p>
                          <p className="font-medium">{vehicle.additionalDetails.cargoCapacity}</p>
                        </div>
                      )}
                      {vehicle.additionalDetails.seatingCapacity && (
                        <div>
                          <p className="text-sm text-muted-foreground">Seating Capacity</p>
                          <p className="font-medium">{vehicle.additionalDetails.seatingCapacity} persons</p>
                        </div>
                      )}
                      {vehicle.additionalDetails.axleType && (
                        <div>
                          <p className="text-sm text-muted-foreground">Axle Type</p>
                          <p className="font-medium">{vehicle.additionalDetails.axleType}</p>
                        </div>
                      )}
                      {vehicle.additionalDetails.routePermit && (
                        <div>
                          <p className="text-sm text-muted-foreground">Route Permit</p>
                          <p className="font-medium">{vehicle.additionalDetails.routePermit}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No additional details available</p>
                  )}
                </CardContent>
              </Card>

              {/* LPR Images */}
              {vehicle.images.lpr && vehicle.images.lpr.length > 0 && (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CameraIcon className="h-5 w-5" />
                      LPR/ANPR Captures
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {vehicle.images.lpr.map((img, idx) => (
                        <div
                          key={idx}
                          className="relative aspect-video rounded-lg overflow-hidden border cursor-pointer group hover:opacity-80 transition-opacity"
                          onClick={() => handleViewImage(img)}
                        >
                          <img src={img} alt={`LPR ${idx + 1}`} className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <CameraIcon className="h-6 w-6 text-white" />
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-1">
                            Capture {idx + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* LPR Confidence Timeline */}
              {vehicle.entries.length > 0 && (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      LPR Recognition History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {vehicle.entries.map((entry) => (
                        <div key={entry.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{formatDate(entry.date)} {entry.timeIn}</span>
                            </div>
                            <Badge variant="outline" className={
                              entry.lprConfidence >= 95 ? 'bg-green-100 text-green-700' :
                              entry.lprConfidence >= 85 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }>
                              {entry.lprConfidence}% Confidence
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  entry.lprConfidence >= 95 ? 'bg-green-500' :
                                  entry.lprConfidence >= 85 ? 'bg-yellow-500' :
                                  'bg-red-500'
                                }`}
                                style={{ width: `${entry.lprConfidence}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Owners Tab */}
          <TabsContent value="owners" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vehicle.owners.map((owner) => (
                <Card key={owner.id}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>{owner.name}</span>
                      <Badge variant="outline" className="capitalize">{owner.relation}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 flex items-center gap-2">
                        <IdCard className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{owner.cnic}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{owner.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate">{owner.email}</span>
                      </div>
                    </div>
                    
                    {(owner.designation || owner.company) && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          {owner.designation && (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span>{owner.designation}</span>
                            </div>
                          )}
                          {owner.company && (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span>{owner.company}</span>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Visit History Tab */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Entry/Exit History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    {vehicle.entries.map((entry) => (
                      <div key={entry.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              entry.status === 'exited' ? 'default' :
                              entry.status === 'inside' ? 'secondary' :
                              'destructive'
                            }>
                              {entry.status.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="bg-blue-50">
                              LPR: {entry.lprConfidence}%
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">ID: {entry.id}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Date</p>
                            <p className="text-sm font-medium">{formatDate(entry.date)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Time In</p>
                            <p className="text-sm font-medium">{entry.timeIn}</p>
                            <p className="text-xs text-muted-foreground">Gate: {entry.gateIn}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Time Out</p>
                            <p className="text-sm font-medium">{entry.timeOut || 'Still Inside'}</p>
                            {entry.gateOut && <p className="text-xs text-muted-foreground">Gate: {entry.gateOut}</p>}
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Duration</p>
                            <p className="text-sm font-medium">
                              {entry.timeOut ? 
                                `${Math.round((new Date(`1970-01-01T${entry.timeOut}`).getTime() - 
                                   new Date(`1970-01-01T${entry.timeIn}`).getTime()) / 60000)} mins` : 
                                'Ongoing'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mt-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Purpose</p>
                            <p className="text-sm">{entry.purpose}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Host</p>
                            <p className="text-sm">{entry.hostName}</p>
                            <p className="text-xs text-muted-foreground">{entry.hostDepartment}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Zone Visited</p>
                            <Badge variant="outline">{entry.zoneVisited}</Badge>
                          </div>
                        </div>

                        {/* LPR Images for this entry */}
                        {(entry.lprImageIn || entry.lprImageOut) && (
                          <div className="mt-3 flex gap-2">
                            {entry.lprImageIn && (
                              <div 
                                className="relative h-16 w-24 rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => handleViewImage(entry.lprImageIn!)}
                              >
                                <img src={entry.lprImageIn} alt="LPR In" className="h-full w-full object-cover" />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] text-center">
                                  Entry
                                </div>
                              </div>
                            )}
                            {entry.lprImageOut && (
                              <div 
                                className="relative h-16 w-24 rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => handleViewImage(entry.lprImageOut!)}
                              >
                                <img src={entry.lprImageOut} alt="LPR Out" className="h-full w-full object-cover" />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] text-center">
                                  Exit
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vehicle.documents && vehicle.documents.length > 0 ? (
                vehicle.documents.map((doc) => (
                  <Card key={doc.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <FileText className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium">{doc.type}</h3>
                            <Badge variant="outline" className={
                              doc.verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }>
                              {doc.verified ? 'Verified' : 'Pending'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{doc.name}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Uploaded: {formatDate(doc.uploadedDate)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="col-span-2">
                  <CardContent className="py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Documents</h3>
                    <p className="text-sm text-muted-foreground">No documents have been uploaded for this vehicle.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            {vehicle.alerts && vehicle.alerts.length > 0 ? (
              <div className="space-y-3">
                {vehicle.alerts.map((alert) => (
                  <Card key={alert.id} className={`border-l-4 ${
                    alert.severity === 'critical' ? 'border-l-red-600' :
                    alert.severity === 'high' ? 'border-l-orange-600' :
                    alert.severity === 'medium' ? 'border-l-yellow-600' :
                    'border-l-blue-600'
                  }`}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <Shield className={`h-6 w-6 ${
                          alert.severity === 'critical' ? 'text-red-600' :
                          alert.severity === 'high' ? 'text-orange-600' :
                          alert.severity === 'medium' ? 'text-yellow-600' :
                          'text-blue-600'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium">{alert.message}</h3>
                            <Badge variant="outline" className={
                              alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                              alert.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                              alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'
                            }>
                              {alert.severity.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className={
                              alert.resolved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }>
                              {alert.resolved ? 'Resolved' : 'Active'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Reported: {formatDateTime(alert.date, '')}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Type: {alert.type.charAt(0).toUpperCase() + alert.type.slice(1)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Active Alerts</h3>
                  <p className="text-sm text-muted-foreground">This vehicle has no alerts or flags.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Image Viewer Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Vehicle Image</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="flex justify-center">
              <img 
                src={selectedImage} 
                alt="Vehicle" 
                className="max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Vehicle</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete {vehicle?.registrationNumberFormatted}? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}