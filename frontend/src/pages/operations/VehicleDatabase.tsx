// src/pages/operations/VehicleDatabase.tsx
"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Search, 
  Upload, 
  Camera, 
  Phone, 
  Mail, 
  IdCard,
  User,
  Calendar,
  MapPin,
  Download,
  Car,
  Truck,
  Bike,
  FileText,
  Shield,
  Clock,
  Eye,
  History,
  AlertTriangle,
  CheckCircle,
  XCircle,
  QrCode,
  Filter,
  ChevronLeft,
  ChevronRight,
  Fuel,
  Wrench,
  Gauge,
  Palette,
  Hash,
  Building2,
  Users,
  Camera as CameraIcon,
  Image as ImageIcon,
  Activity,
  Plus,
  RefreshCw,
  Printer,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  BarChart3,
  Fingerprint,
  QrCode as QrCodeIcon
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { getVehicleDatabaseDetailPath } from "@/routes/config"

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
  car: "https://miro.medium.com/v2/resize:fit:1400/1*qre-gAVNTuazaUPvNw2w-Q.jpeg",
  truck: "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=400&q=80",
  motorcycle: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcREr50YLuEgNaPh2bYOxgM7rR11H9pLIWQVaA&s",
  suv: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRV2EmTviiWkhhw8oDHvlFA_KhszHSJZ_PqDw&s",
  van: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRgmJMhTFIouAOuPdEcA26uVKPPkw5BFGYPhw&s",
  bus:"https://cpimg.tistatic.com/5770042/b/4/roadways-bus-body.jpg"
}

// Sample vehicle data
const generateSampleVehicles = (): Vehicle[] => {
  return [
    // ...existing vehicles...
    // Added vehicles
    {
      id: "V007",
      registrationNumber: "MH20EE7602",
      registrationNumberFormatted: "MH20EE7602",
      province: "Islamabad",
      make: "Toyota",
      model: "Corolla",
      year: 2024,
      color: "White",
      type: "car",
      category: "government",
      fuelType: "petrol",
      engineNumber: "2ZR-789012",
      chassisNumber: "GOV1234567890",
      registrationExpiry: "2025-12-31",
      insuranceExpiry: "2024-12-31",
      fitnessCertificate: "FC-2024-90123",
      status: "active",
      riskLevel: "low",
      owners: [
        {
          id: "O008",
          name: "Government of Pakistan",
          cnic: "MH20EE7602",
          phone: "+92 51 1234567",
          email: "transport@gov.pk",
          relation: "owner",
          company: "Ministry of Interior"
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
          id: "E010",
          date: "2024-03-15",
          timeIn: "09:00",
          timeOut: null,
          gateIn: "Main Gate",
          gateOut: null,
          purpose: "Official Duty",
          hostName: "Secretary",
          hostDepartment: "Administration",
          zoneVisited: "Government Zone",
          status: "inside",
          lprConfidence: 99,
          lprImageIn: dummyImages.car,
          lprImageOut: null
        }
      ],
      totalVisits: 50,
      firstVisit: "2024-01-02",
      lastVisit: "2024-03-15",
      averageStayDuration: 480,
      mostVisitedZone: "Government Zone",
      mostVisitedGate: "Main Gate",
      alerts: [],
      documents: [
        {
          id: "D011",
          type: "Government Registration",
          name: "gov_registration.pdf",
          uploadedDate: "2024-01-02",
          verified: true
        }
      ]
    },
    {
      id: "V008",
      registrationNumber: "MH20EE7602",
      registrationNumberFormatted: "MH20EE7602",
      province: "Sindh",
      make: "Suzuki",
      model: "Wagon R",
      year: 2023,
      color: "Gray",
      type: "car",
      category: "rental",
      fuelType: "cng",
      engineNumber: "K12M-123456",
      chassisNumber: "RENT1234567890",
      registrationExpiry: "2024-08-31",
      insuranceExpiry: "2024-08-31",
      fitnessCertificate: "FC-2024-45678",
      status: "active",
      riskLevel: "medium",
      owners: [
        {
          id: "O009",
          name: "Rent-A-Car Pakistan",
          cnic: "NTN-9876543",
          phone: "+92 21 1234567",
          email: "rentals@rentacar.pk",
          relation: "company",
          company: "Rent-A-Car Pakistan"
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
          id: "E011",
          date: "2024-03-14",
          timeIn: "13:15",
          timeOut: "15:30",
          gateIn: "Main Gate",
          gateOut: "Main Gate",
          purpose: "Business Meeting",
          hostName: "Mr. Ali Ahmed",
          hostDepartment: "IT",
          zoneVisited: "Zone B",
          status: "exited",
          lprConfidence: 94,
          lprImageIn: dummyImages.car,
          lprImageOut: dummyImages.car
        },
        {
          id: "E012",
          date: "2024-03-12",
          timeIn: "11:00",
          timeOut: "13:15",
          gateIn: "Main Gate",
          gateOut: "Main Gate",
          purpose: "Delivery",
          hostName: "Mr. Hassan Khan",
          hostDepartment: "Operations",
          zoneVisited: "Zone A",
          status: "exited",
          lprConfidence: 96,
          lprImageIn: dummyImages.car,
          lprImageOut: dummyImages.car
        },
        {
          id: "E013",
          date: "2024-03-10",
          timeIn: "09:30",
          timeOut: "11:45",
          gateIn: "Main Gate",
          gateOut: "Main Gate",
          purpose: "Meeting",
          hostName: "Mr. Jahandad Khan",
          hostDepartment: "HR",
          zoneVisited: "Zone A",
          status: "exited",
          lprConfidence: 95,
          lprImageIn: dummyImages.car,
          lprImageOut: dummyImages.car
        }
      ],
      totalVisits: 22,
      firstVisit: "2024-01-20",
      lastVisit: "2024-03-14",
      averageStayDuration: 135,
      mostVisitedZone: "Zone A",
      mostVisitedGate: "Main Gate",
      alerts: [
        {
          id: "A004",
          type: "expired",
          severity: "medium",
          message: "Insurance expiring in 30 days",
          date: "2024-07-01",
          resolved: false
        }
      ],
      documents: [
        {
          id: "D012",
          type: "Registration",
          name: "registration.pdf",
          uploadedDate: "2024-01-20",
          verified: true
        },
        {
          id: "D013",
          type: "Rental Agreement",
          name: "agreement.pdf",
          uploadedDate: "2024-01-20",
          verified: true
        }
      ],
      additionalDetails: {
        registrationCity: "Karachi",
        taxStatus: "Paid"
      }
    },
    // Three more vehicles (examples)
    {
      id: "V009",
      registrationNumber: "WB-39A-3583",
      registrationNumberFormatted: "WB-39A-3583",
      province: "Punjab",
      make: "Daewoo",
      model: "Express",
      year: 2026,
      color: "Blue",
      type: "bus",
      category: "commercial",
      fuelType: "diesel",
      engineNumber: "DW-2026-001",
      chassisNumber: "DWEXP2026001",
      registrationExpiry: "2027-12-31",
      insuranceExpiry: "2026-12-31",
      fitnessCertificate: "FC-2026-001",
      status: "active",
      riskLevel: "medium",
      owners: [
        {
          id: "O010",
          name: "Daewoo Pakistan",
          cnic: "NTN-2026",
          phone: "+92 42 1234567",
          email: "info@daewoo.pk",
          relation: "company",
          company: "Daewoo Pakistan"
        }
      ],
      images: {
        front: dummyImages.bus,
        back: dummyImages.bus,
        left: dummyImages.bus,
        right: dummyImages.bus
      },
      entries: [
        {
          id: "E014",
          date: "2026-03-11",
          timeIn: "08:00",
          timeOut: "18:00",
          gateIn: "Bus Gate",
          gateOut: "Bus Gate",
          purpose: "Passenger Service",
          hostName: "Operations",
          hostDepartment: "Transport",
          zoneVisited: "Bus Zone",
          status: "exited",
          lprConfidence: 97,
          lprImageIn: dummyImages.truck,
          lprImageOut: dummyImages.truck
        }
      ],
      totalVisits: 100,
      firstVisit: "2026-01-01",
      lastVisit: "2026-03-11",
      averageStayDuration: 600,
      mostVisitedZone: "Bus Zone",
      mostVisitedGate: "Bus Gate",
      alerts: [],
      documents: [
        {
          id: "D014",
          type: "Bus Registration",
          name: "bus_registration.pdf",
          uploadedDate: "2026-01-01",
          verified: true
        }
      ],
      additionalDetails: {
        registrationCity: "Lahore",
        seatingCapacity: 50
      }
    },
    {
      id: "V010",
      registrationNumber: "M25DJC",
      registrationNumberFormatted: "M25DJC",
      province: "Sindh",
      make: "Suzuki",
      model: "Carry",
      year: 2026,
      color: "White",
      type: "van",
      category: "commercial",
      fuelType: "petrol",
      engineNumber: "SZ-2026-002",
      chassisNumber: "SZCARRY2026002",
      registrationExpiry: "2027-06-30",
      insuranceExpiry: "2026-06-30",
      fitnessCertificate: "FC-2026-002",
      status: "active",
      riskLevel: "low",
      owners: [
        {
          id: "O011",
          name: "Suzuki Pakistan",
          cnic: "NTN-2026",
          phone: "+92 21 1234567",
          email: "info@suzuki.pk",
          relation: "company",
          company: "Suzuki Pakistan"
        }
      ],
      images: {
        front: dummyImages.van,
        back: dummyImages.van,
        left: dummyImages.van,
        right: dummyImages.van
      },
      entries: [
        {
          id: "E015",
          date: "2026-03-10",
          timeIn: "09:00",
          timeOut: "17:00",
          gateIn: "Van Gate",
          gateOut: "Van Gate",
          purpose: "Goods Delivery",
          hostName: "Logistics",
          hostDepartment: "Transport",
          zoneVisited: "Van Zone",
          status: "exited",
          lprConfidence: 95,
          lprImageIn: dummyImages.van,
          lprImageOut: dummyImages.van
        }
      ],
      totalVisits: 60,
      firstVisit: "2026-01-10",
      lastVisit: "2026-03-10",
      averageStayDuration: 480,
      mostVisitedZone: "Van Zone",
      mostVisitedGate: "Van Gate",
      alerts: [],
      documents: [
        {
          id: "D015",
          type: "Van Registration",
          name: "van_registration.pdf",
          uploadedDate: "2026-01-10",
          verified: true
        }
      ],
      additionalDetails: {
        registrationCity: "Karachi",
        cargoCapacity: "800 kg"
      }
    },
    {
      id: "V011",
      registrationNumber: "DBR-53",
      registrationNumberFormatted: "DBR-53",
      province: "Punjab",
      make: "Honda",
      model: "CD 70",
      year: 2026,
      color: "Red",
      type: "motorcycle",
      category: "private",
      fuelType: "petrol",
      engineNumber: "HD-2026-003",
      chassisNumber: "HDCD702026003",
      registrationExpiry: "2027-12-31",
      insuranceExpiry: "2026-12-31",
      fitnessCertificate: "FC-2026-003",
      status: "active",
      riskLevel: "low",
      owners: [
        {
          id: "O012",
          name: "Ali Raza",
          cnic: "35202-1234567-9",
          phone: "+92 300 1234567",
          email: "ali.raza@email.com",
          relation: "owner"
        }
      ],
      images: {
        front: dummyImages.motorcycle,
        back: dummyImages.motorcycle,
        left: dummyImages.motorcycle,
        right: dummyImages.motorcycle
      },
      entries: [
        {
          id: "E016",
          date: "2026-03-09",
          timeIn: "08:30",
          timeOut: "10:00",
          gateIn: "Bike Gate",
          gateOut: "Bike Gate",
          purpose: "Personal",
          hostName: "Self",
          hostDepartment: "N/A",
          zoneVisited: "Bike Zone",
          status: "exited",
          lprConfidence: 92,
          lprImageIn: dummyImages.motorcycle,
          lprImageOut: dummyImages.motorcycle
        }
      ],
      totalVisits: 10,
      firstVisit: "2026-02-01",
      lastVisit: "2026-03-09",
      averageStayDuration: 90,
      mostVisitedZone: "Bike Zone",
      mostVisitedGate: "Bike Gate",
      alerts: [],
      documents: [
        {
          id: "D016",
          type: "Bike Registration",
          name: "bike_registration.pdf",
          uploadedDate: "2026-02-01",
          verified: true
        }
      ],
      additionalDetails: {
        registrationCity: "Faisalabad"
      }
    }
  ];
}

// Helper Components
const VehicleTypeIcon = ({ type }: { type: string }) => {
  switch(type) {
    case "car": return <Car className="h-4 w-4" />
    case "suv": return <Car className="h-4 w-4" />
    case "truck": return <Truck className="h-4 w-4" />
    case "motorcycle": return <Bike className="h-4 w-4" />
    case "van": return <Truck className="h-4 w-4" />
    default: return <Car className="h-4 w-4" />
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

const VehicleImagePlaceholder = ({ type }: { type: string }) => (
  <div className="flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg">
    {type === "car" && <Car className="h-8 w-8 text-gray-400" />}
    {type === "suv" && <Car className="h-8 w-8 text-gray-400" />}
    {type === "truck" && <Truck className="h-8 w-8 text-gray-400" />}
    {type === "motorcycle" && <Bike className="h-8 w-8 text-gray-400" />}
    <span className="text-xs text-gray-400 mt-1">No Image</span>
  </div>
)

// Main Component
export default function VehicleDatabasePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  
  const [searchFilters, setSearchFilters] = useState({
    registrationNumber: "",
    province: "",
    make: "",
    model: "",
    color: "",
    type: "",
    category: "",
    ownerName: "",
    ownerCnic: "",
    ownerPhone: "",
    status: "",
    riskLevel: ""
  })
  
  const [activeTab, setActiveTab] = useState("all")
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [lprSearchMode, setLprSearchMode] = useState(false)
  const [lprImage, setLprImage] = useState<string | null>(null)
  const [quickViewVehicle, setQuickViewVehicle] = useState<Vehicle | null>(null)
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Load data from localStorage or generate sample
  useEffect(() => {
    loadVehicles()
  }, [])

  const loadVehicles = () => {
    const stored = localStorage.getItem("customs-vehicle-database")
    if (stored) {
      setVehicles(JSON.parse(stored))
    } else {
      const sample = generateSampleVehicles()
      setVehicles(sample)
      localStorage.setItem("customs-vehicle-database", JSON.stringify(sample))
    }
  }

  // Filter vehicles when search filters change
  useEffect(() => {
    const filtered = vehicles.filter(vehicle => {
      // Filter by status tab
      if (activeTab !== "all" && vehicle.status !== activeTab) return false
      
      // Filter by search criteria
      const matchesRegNumber = vehicle.registrationNumber.toLowerCase().includes(searchFilters.registrationNumber.toLowerCase()) ||
                               vehicle.registrationNumberFormatted.toLowerCase().includes(searchFilters.registrationNumber.toLowerCase())
      const matchesProvince = !searchFilters.province || vehicle.province.toLowerCase().includes(searchFilters.province.toLowerCase())
      const matchesMake = !searchFilters.make || vehicle.make.toLowerCase().includes(searchFilters.make.toLowerCase())
      const matchesModel = !searchFilters.model || vehicle.model.toLowerCase().includes(searchFilters.model.toLowerCase())
      const matchesColor = !searchFilters.color || vehicle.color.toLowerCase().includes(searchFilters.color.toLowerCase())
      const matchesType = !searchFilters.type || vehicle.type === searchFilters.type
      const matchesCategory = !searchFilters.category || vehicle.category === searchFilters.category
      const matchesOwnerName = vehicle.owners.some(o => o.name.toLowerCase().includes(searchFilters.ownerName.toLowerCase()))
      const matchesOwnerCnic = vehicle.owners.some(o => o.cnic.includes(searchFilters.ownerCnic))
      const matchesOwnerPhone = vehicle.owners.some(o => o.phone.includes(searchFilters.ownerPhone))
      const matchesStatus = !searchFilters.status || vehicle.status === searchFilters.status
      const matchesRiskLevel = !searchFilters.riskLevel || vehicle.riskLevel === searchFilters.riskLevel
      
      if (searchFilters.registrationNumber && !matchesRegNumber) return false
      if (searchFilters.province && !matchesProvince) return false
      if (searchFilters.make && !matchesMake) return false
      if (searchFilters.model && !matchesModel) return false
      if (searchFilters.color && !matchesColor) return false
      if (searchFilters.type && !matchesType) return false
      if (searchFilters.category && !matchesCategory) return false
      if (searchFilters.ownerName && !matchesOwnerName) return false
      if (searchFilters.ownerCnic && !matchesOwnerCnic) return false
      if (searchFilters.ownerPhone && !matchesOwnerPhone) return false
      if (searchFilters.status && !matchesStatus) return false
      if (searchFilters.riskLevel && !matchesRiskLevel) return false
      
      return true
    })
    
    setFilteredVehicles(filtered)
    setCurrentPage(1)
  }, [vehicles, searchFilters, activeTab])

  const handleFilterChange = (key: string, value: string) => {
    setSearchFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const clearFilters = () => {
    setSearchFilters({
      registrationNumber: "",
      province: "",
      make: "",
      model: "",
      color: "",
      type: "",
      category: "",
      ownerName: "",
      ownerCnic: "",
      ownerPhone: "",
      status: "",
      riskLevel: ""
    })
    setActiveTab("all")
  }

  const handleViewDetails = (vehicle: Vehicle) => {
    navigate(getVehicleDatabaseDetailPath(vehicle.id))
  }

  const handleQuickView = (vehicle: Vehicle) => {
    setQuickViewVehicle(vehicle)
    setQuickViewOpen(true)
  }

  const handleEdit = (vehicle: Vehicle) => {
    toast({
      title: "Edit Vehicle",
      description: `Editing ${vehicle.registrationNumberFormatted}`,
    })
  }

  const handleDelete = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (selectedVehicle) {
      const updatedVehicles = vehicles.filter(v => v.id !== selectedVehicle.id)
      setVehicles(updatedVehicles)
      localStorage.setItem("customs-vehicle-database", JSON.stringify(updatedVehicles))
      toast({
        title: "Vehicle Deleted",
        description: `${selectedVehicle.registrationNumberFormatted} has been removed from database.`,
      })
      setDeleteDialogOpen(false)
      setSelectedVehicle(null)
    }
  }

  const handleDuplicate = (vehicle: Vehicle) => {
    const newVehicle = {
      ...vehicle,
      id: `V${Math.floor(Math.random() * 1000)}`,
      registrationNumber: `${vehicle.registrationNumber}-COPY`,
      registrationNumberFormatted: `${vehicle.registrationNumberFormatted}-COPY`,
    }
    const updatedVehicles = [...vehicles, newVehicle]
    setVehicles(updatedVehicles)
    localStorage.setItem("customs-vehicle-database", JSON.stringify(updatedVehicles))
    toast({
      title: "Vehicle Duplicated",
      description: "A copy has been created successfully.",
    })
  }

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => {
      loadVehicles()
      setRefreshing(false)
      toast({
        title: "Database Refreshed",
        description: "Vehicle data has been refreshed.",
      })
    }, 1000)
  }

  const handleAddVehicle = (newVehicle: Partial<Vehicle>) => {
    // In a real app, this would open a form
    toast({
      title: "Add Vehicle",
      description: "Vehicle registration form would open here.",
    })
  }

  const handleLprSearch = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      setLprImage(e.target?.result as string)
      // Simulate LPR processing
      setTimeout(() => {
        setSearchFilters(prev => ({
          ...prev,
          registrationNumber: "LEG-5678"
        }))
        toast({
          title: "LPR Detection Complete",
          description: "Plate number LEG-5678 detected and applied to search.",
        })
      }, 2000)
    }
    reader.readAsDataURL(file)
  }

  const getStatusCount = (status: string) => {
    if (status === "all") return vehicles.length
    return vehicles.filter(v => v.status === status).length
  }

  const getTypeCount = (type: string) => {
    return vehicles.filter(v => v.type === type).length
  }

  const getCategoryCount = (category: string) => {
    return vehicles.filter(v => v.category === category).length
  }

  const getAlertCount = () => {
    return vehicles.reduce((acc, v) => acc + v.alerts.filter(a => !a.resolved).length, 0)
  }

  const getInsideCount = () => {
    return vehicles.filter(v => v.entries.some(e => e.status === "inside")).length
  }

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredVehicles.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredVehicles.length / itemsPerPage)

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
      title="Vehicle Database"
      description="LPR/ANPR vehicle tracking system - Complete vehicle records, owner information, and entry/exit history"
      breadcrumbs={[{ label: "AI Analytics" }, { label: "Vehicle Database" }]}
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Vehicles</p>
                  <p className="text-2xl font-bold text-blue-900">{vehicles.length}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Car className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
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
          
          <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Inside Premises</p>
                  <p className="text-2xl font-bold text-orange-900">{getInsideCount()}</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <Activity className="h-5 w-5 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Alerts</p>
                  <p className="text-2xl font-bold text-red-900">{getAlertCount()}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Watchlist</p>
                  <p className="text-2xl font-bold text-purple-900">{getStatusCount("watchlist") + getStatusCount("blacklisted")}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vehicle Type Distribution */}
        <div className="grid gap-4 md:grid-cols-5">
          <Badge variant="outline" className="justify-between py-2 px-3 bg-blue-50">
            <span className="flex items-center gap-1"><Car className="h-3 w-3" /> Cars/SUVs</span>
            <span className="font-bold">{getTypeCount("car") + getTypeCount("suv")}</span>
          </Badge>
          <Badge variant="outline" className="justify-between py-2 px-3 bg-purple-50">
            <span className="flex items-center gap-1"><Truck className="h-3 w-3" /> Commercial</span>
            <span className="font-bold">{getTypeCount("truck") + getTypeCount("van")}</span>
          </Badge>
          <Badge variant="outline" className="justify-between py-2 px-3 bg-green-50">
            <span className="flex items-center gap-1"><Bike className="h-3 w-3" /> Motorcycles</span>
            <span className="font-bold">{getTypeCount("motorcycle")}</span>
          </Badge>
          <Badge variant="outline" className="justify-between py-2 px-3 bg-yellow-50">
            <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> Diplomatic/Govt</span>
            <span className="font-bold">{getCategoryCount("diplomatic") + getCategoryCount("government")}</span>
          </Badge>
          <Badge variant="outline" className="justify-between py-2 px-3 bg-red-50">
            <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Expired</span>
            <span className="font-bold">{getStatusCount("expired")}</span>
          </Badge>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Vehicle
            </Button>
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1">
              {filteredVehicles.length} vehicle{filteredVehicles.length !== 1 ? 's' : ''} found
            </Badge>
          </div>
        </div>

        {/* Filters Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Vehicle Search Filters
              <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto h-8">
                Clear All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* LPR/ANPR Search */}
                <div className="space-y-2 md:col-span-2 lg:col-span-1">
                  <Label htmlFor="lpr-search" className="flex items-center gap-2 text-sm">
                    <CameraIcon className="h-4 w-4" />
                    LPR/ANPR Search
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="lpr-search"
                        placeholder="Search by plate number..."
                        value={searchFilters.registrationNumber}
                        onChange={(e) => handleFilterChange("registrationNumber", e.target.value)}
                        className="pl-9 h-9"
                      />
                    </div>
                    <Dialog open={lprSearchMode} onOpenChange={setLprSearchMode}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9">
                          <Camera className="h-4 w-4 mr-2" />
                          Upload Plate
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>LPR/ANPR Image Upload</DialogTitle>
                          <DialogDescription>
                            Upload an image of the license plate for automatic recognition
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="border-2 border-dashed rounded-lg p-8 text-center">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              id="lpr-upload"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleLprSearch(file)
                              }}
                            />
                            <label
                              htmlFor="lpr-upload"
                              className="cursor-pointer flex flex-col items-center gap-2"
                            >
                              <Camera className="h-8 w-8 text-muted-foreground" />
                              <span className="text-sm font-medium">Click to upload or drag and drop</span>
                              <span className="text-xs text-muted-foreground">JPG, PNG up to 5MB</span>
                            </label>
                          </div>
                          {lprImage && (
                            <div className="relative">
                              <img src={lprImage} alt="Uploaded plate" className="rounded-lg max-h-48 mx-auto" />
                              <Progress value={100} className="mt-2" />
                              <p className="text-xs text-center text-muted-foreground mt-1">Processing...</p>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* Registration Number */}
                <div className="space-y-2">
                  <Label htmlFor="reg-filter" className="flex items-center gap-2 text-sm">
                    <Hash className="h-4 w-4" />
                    Registration No.
                  </Label>
                  <Input
                    id="reg-filter"
                    placeholder="e.g., LEG-5678"
                    value={searchFilters.registrationNumber}
                    onChange={(e) => handleFilterChange("registrationNumber", e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* Province */}
                <div className="space-y-2">
                  <Label htmlFor="province-filter" className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4" />
                    Province
                  </Label>
                  <Select
                    value={searchFilters.province}
                    onValueChange={(value) => handleFilterChange("province", value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Provinces" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Provinces</SelectItem>
                      <SelectItem value="Sindh">Sindh</SelectItem>
                      <SelectItem value="Punjab">Punjab</SelectItem>
                      <SelectItem value="KPK">KPK</SelectItem>
                      <SelectItem value="Balochistan">Balochistan</SelectItem>
                      <SelectItem value="Islamabad">Islamabad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Make */}
                <div className="space-y-2">
                  <Label htmlFor="make-filter" className="flex items-center gap-2 text-sm">
                    <Car className="h-4 w-4" />
                    Make
                  </Label>
                  <Input
                    id="make-filter"
                    placeholder="e.g., Toyota"
                    value={searchFilters.make}
                    onChange={(e) => handleFilterChange("make", e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* Model */}
                <div className="space-y-2">
                  <Label htmlFor="model-filter" className="flex items-center gap-2 text-sm">
                    <Car className="h-4 w-4" />
                    Model
                  </Label>
                  <Input
                    id="model-filter"
                    placeholder="e.g., Corolla"
                    value={searchFilters.model}
                    onChange={(e) => handleFilterChange("model", e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* Color */}
                <div className="space-y-2">
                  <Label htmlFor="color-filter" className="flex items-center gap-2 text-sm">
                    <Palette className="h-4 w-4" />
                    Color
                  </Label>
                  <Select
                    value={searchFilters.color}
                    onValueChange={(value) => handleFilterChange("color", value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Colors" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Colors</SelectItem>
                      <SelectItem value="White">White</SelectItem>
                      <SelectItem value="Black">Black</SelectItem>
                      <SelectItem value="Silver">Silver</SelectItem>
                      <SelectItem value="Gray">Gray</SelectItem>
                      <SelectItem value="Red">Red</SelectItem>
                      <SelectItem value="Blue">Blue</SelectItem>
                      <SelectItem value="Green">Green</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Vehicle Type */}
                <div className="space-y-2">
                  <Label htmlFor="type-filter" className="flex items-center gap-2 text-sm">
                    <Car className="h-4 w-4" />
                    Vehicle Type
                  </Label>
                  <Select
                    value={searchFilters.type}
                    onValueChange={(value) => handleFilterChange("type", value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="car">Car</SelectItem>
                      <SelectItem value="suv">SUV</SelectItem>
                      <SelectItem value="motorcycle">Motorcycle</SelectItem>
                      <SelectItem value="truck">Truck</SelectItem>
                      <SelectItem value="van">Van</SelectItem>
                      <SelectItem value="bus">Bus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category-filter" className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4" />
                    Category
                  </Label>
                  <Select
                    value={searchFilters.category}
                    onValueChange={(value) => handleFilterChange("category", value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="commercial">Commercial</SelectItem>
                      <SelectItem value="government">Government</SelectItem>
                      <SelectItem value="diplomatic">Diplomatic</SelectItem>
                      <SelectItem value="rental">Rental</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Owner Name */}
                <div className="space-y-2">
                  <Label htmlFor="owner-filter" className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4" />
                    Owner Name
                  </Label>
                  <Input
                    id="owner-filter"
                    placeholder="Search by owner name"
                    value={searchFilters.ownerName}
                    onChange={(e) => handleFilterChange("ownerName", e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* Owner CNIC */}
                <div className="space-y-2">
                  <Label htmlFor="owner-cnic-filter" className="flex items-center gap-2 text-sm">
                    <IdCard className="h-4 w-4" />
                    Owner CNIC
                  </Label>
                  <Input
                    id="owner-cnic-filter"
                    placeholder="XXXXX-XXXXXXX-X"
                    value={searchFilters.ownerCnic}
                    onChange={(e) => handleFilterChange("ownerCnic", e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label htmlFor="status-filter" className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    Status
                  </Label>
                  <Select
                    value={searchFilters.status}
                    onValueChange={(value) => handleFilterChange("status", value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="watchlist">Watchlist</SelectItem>
                      <SelectItem value="blacklisted">Blacklisted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Risk Level */}
                <div className="space-y-2">
                  <Label htmlFor="risk-filter" className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4" />
                    Risk Level
                  </Label>
                  <Select
                    value={searchFilters.riskLevel}
                    onValueChange={(value) => handleFilterChange("riskLevel", value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Risk Levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Risk Levels</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground">
                <TabsTrigger value="all" className="px-4">
                  All ({getStatusCount("all")})
                </TabsTrigger>
                <TabsTrigger value="active" className="px-4">
                  Active ({getStatusCount("active")})
                </TabsTrigger>
                <TabsTrigger value="expired" className="px-4">
                  Expired ({getStatusCount("expired")})
                </TabsTrigger>
                <TabsTrigger value="watchlist" className="px-4">
                  Watchlist ({getStatusCount("watchlist")})
                </TabsTrigger>
                <TabsTrigger value="blacklisted" className="px-4">
                  Blacklisted ({getStatusCount("blacklisted")})
                </TabsTrigger>
                <TabsTrigger value="pending" className="px-4">
                  Pending ({getStatusCount("pending")})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Vehicle Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[80px]">Image</TableHead>
                    <TableHead>Registration</TableHead>
                    <TableHead>Vehicle Details</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Last Visit</TableHead>
                    <TableHead>Visits</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentItems.map((vehicle) => (
                    <TableRow key={vehicle.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => handleViewDetails(vehicle)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="relative h-12 w-20 rounded-md overflow-hidden border">
                          {vehicle.images.front ? (
                            <img 
                              src={vehicle.images.front} 
                              alt={vehicle.registrationNumber}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <VehicleImagePlaceholder type={vehicle.type} />
                          )}
                          {vehicle.alerts.filter(a => !a.resolved).length > 0 && (
                            <div className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-mono font-bold">{vehicle.registrationNumberFormatted}</p>
                          <p className="text-xs text-muted-foreground">{vehicle.province}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{vehicle.make} {vehicle.model}</p>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">{vehicle.year}</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="flex items-center gap-1">
                              <Palette className="h-3 w-3" />
                              {vehicle.color}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant="outline" className="text-[10px] px-1">
                              <VehicleTypeIcon type={vehicle.type} />
                              <span className="ml-1 capitalize">{vehicle.type}</span>
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1 capitalize">
                              {vehicle.category}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{vehicle.owners[0]?.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {vehicle.owners[0]?.phone}
                          </p>
                          {vehicle.owners.length > 1 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{vehicle.owners.length - 1} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={vehicle.status} />
                      </TableCell>
                      <TableCell>
                        <RiskLevelBadge level={vehicle.riskLevel} />
                      </TableCell>
                      <TableCell>
                        {vehicle.entries.length > 0 ? (
                          <div>
                            <p className="text-sm">{formatDate(vehicle.entries[0].date)}</p>
                            <p className="text-xs text-muted-foreground">{vehicle.entries[0].timeIn}</p>
                            <Badge variant="outline" className="text-[10px] mt-1">
                              {vehicle.entries[0].status}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No visits</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {vehicle.totalVisits}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleViewDetails(vehicle)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickView(vehicle)}>
                              <Activity className="h-4 w-4 mr-2" />
                              Quick View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(vehicle)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(vehicle)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDelete(vehicle)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {filteredVehicles.length > itemsPerPage && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredVehicles.length)} of {filteredVehicles.length} vehicles
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
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
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick View Dialog */}
      <Dialog open={quickViewOpen} onOpenChange={setQuickViewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Quick Vehicle View</DialogTitle>
            <DialogDescription>
              Summary information for {quickViewVehicle?.registrationNumberFormatted}
            </DialogDescription>
          </DialogHeader>
          {quickViewVehicle && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-32 h-32 rounded-lg overflow-hidden border">
                  {quickViewVehicle.images.front ? (
                    <img 
                      src={quickViewVehicle.images.front} 
                      alt={quickViewVehicle.registrationNumber}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <VehicleImagePlaceholder type={quickViewVehicle.type} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold">{quickViewVehicle.registrationNumberFormatted}</h3>
                    <StatusBadge status={quickViewVehicle.status} />
                    <RiskLevelBadge level={quickViewVehicle.riskLevel} />
                  </div>
                  <p className="text-muted-foreground">{quickViewVehicle.make} {quickViewVehicle.model} • {quickViewVehicle.year}</p>
                  <p className="text-sm mt-2">Owner: {quickViewVehicle.owners[0]?.name}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">{quickViewVehicle.totalVisits}</p>
                    <p className="text-xs text-muted-foreground">Total Visits</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">{quickViewVehicle.entries.filter(e => e.status === "inside").length}</p>
                    <p className="text-xs text-muted-foreground">Currently Inside</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">{quickViewVehicle.alerts.filter(a => !a.resolved).length}</p>
                    <p className="text-xs text-muted-foreground">Active Alerts</p>
                  </CardContent>
                </Card>
              </div>
              
              <div className="border rounded-lg p-3">
                <h4 className="font-medium mb-2">Recent Activity</h4>
                {quickViewVehicle.entries.slice(0, 3).map(entry => (
                  <div key={entry.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                    <span>{formatDate(entry.date)} {entry.timeIn}</span>
                    <span>{entry.gateIn} → {entry.zoneVisited}</span>
                    <Badge variant="outline" className="text-xs">{entry.status}</Badge>
                  </div>
                ))}
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setQuickViewOpen(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  setQuickViewOpen(false)
                  handleViewDetails(quickViewVehicle)
                }}>
                  View Full Details
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Vehicle</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedVehicle?.registrationNumberFormatted}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 py-3">
            {selectedVehicle?.images.front && (
              <img 
                src={selectedVehicle.images.front} 
                alt={selectedVehicle.registrationNumber}
                className="w-16 h-16 object-cover rounded-lg border"
              />
            )}
            <div>
              <p className="font-medium">{selectedVehicle?.make} {selectedVehicle?.model}</p>
              <p className="text-sm text-muted-foreground">Owner: {selectedVehicle?.owners[0]?.name}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete Vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Vehicle Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Vehicle</DialogTitle>
            <DialogDescription>
              Register a new vehicle in the database
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Registration Number</Label>
                <Input placeholder="e.g., LEG-5678" />
              </div>
              <div className="space-y-2">
                <Label>Province</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sindh">Sindh</SelectItem>
                    <SelectItem value="punjab">Punjab</SelectItem>
                    <SelectItem value="kpk">KPK</SelectItem>
                    <SelectItem value="balochistan">Balochistan</SelectItem>
                    <SelectItem value="islamabad">Islamabad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Make</Label>
                <Input placeholder="e.g., Toyota" />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input placeholder="e.g., Corolla" />
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Input type="number" placeholder="2024" />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Input placeholder="e.g., White" />
              </div>
              <div className="space-y-2">
                <Label>Vehicle Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="car">Car</SelectItem>
                    <SelectItem value="suv">SUV</SelectItem>
                    <SelectItem value="truck">Truck</SelectItem>
                    <SelectItem value="motorcycle">Motorcycle</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="diplomatic">Diplomatic</SelectItem>
                    <SelectItem value="rental">Rental</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fuel Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select fuel type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="petrol">Petrol</SelectItem>
                    <SelectItem value="diesel">Diesel</SelectItem>
                    <SelectItem value="cng">CNG</SelectItem>
                    <SelectItem value="electric">Electric</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setAddDialogOpen(false)
              toast({
                title: "Vehicle Added",
                description: "New vehicle has been registered successfully.",
              })
            }}>
              Add Vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Currently Inside Vehicles Widget */}
  <div className="fixed bottom-4 right-4 w-80">
        <Card className="shadow-lg border-blue-200">
          <CardHeader className="bg-blue-50 py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              Vehicles Inside Premises
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 max-h-60 overflow-y-auto">
            <div className="space-y-2">
              {vehicles
                .filter(v => v.entries.some(e => e.status === "inside"))
                .map(vehicle => {
                  const currentEntry = vehicle.entries.find(e => e.status === "inside")
                  return (
                    <div key={vehicle.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-mono font-bold text-sm">{vehicle.registrationNumberFormatted}</p>
                        <p className="text-xs text-muted-foreground">{vehicle.make} {vehicle.model}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="bg-green-100 text-green-700 text-xs">
                          Since {currentEntry?.timeIn}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">{currentEntry?.zoneVisited}</p>
                      </div>
                    </div>
                  )
                })}
              {vehicles.filter(v => v.entries.some(e => e.status === "inside")).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No vehicles inside</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick LPR Button */}
      <div className="fixed bottom-4 left-4 z-50">
        <Button 
          className="rounded-full h-12 w-12 shadow-lg bg-blue-600 hover:bg-blue-700"
          onClick={() => setLprSearchMode(true)}
        >
          <CameraIcon className="h-5 w-5" />
        </Button>
      </div>
    </ModulePageLayout>
  )
}