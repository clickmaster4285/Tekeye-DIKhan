"use client"

import { useState, useEffect } from "react"
import { 
  Car, 
  Camera, 
  Plus, 
  X, 
  MapPin, 
  AlertTriangle, 
  Clock, 
  Filter,
  Search,
  Download,
  ChevronDown,
  Eye,
  CheckCircle,
  XCircle,
  Gauge,
  TrendingUp,
  Calendar,
  Image as ImageIcon,
  Shield,
  Ban,
  ZoomIn,
  Maximize2,
  Truck,
  Scale,
  Ruler,
  Package,
  FileText,
  ClipboardCheck
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Location configurations
const LOCATIONS = [
  { id: "peshawar", name: "Peshawar", lat: 34.0151, lng: 71.5249, tolls: ["Ring Road Toll", "GT Road Toll", "University Road Checkpost"] },
  { id: "yarik", name: "Yarik", lat: 34.0151, lng: 71.5249, tolls: ["Yarik Plaza", "North Entry", "Yarik Bridge"] },
  { id: "di-khan", name: "DI Khan", lat: 31.8178, lng: 70.9324, tolls: ["DI Khan South", "Main Entry", "Industrial Area Gate"] },
  { id: "swh-ratta-kulachi", name: "SWH Ratta Kulachi", lat: 31.8620, lng: 70.8980, tolls: ["SWH Gate", "Main Entry", "Warehouse Yard"] },
  { id: "kohat", name: "Kohat", lat: 33.5828, lng: 71.4373, tolls: ["Kohat Tunnel", "City Entry", "Kohat University Gate"] },
  { id: "mardan", name: "Mardan", lat: 34.1989, lng: 72.0231, tolls: ["Mardan Toll Plaza", "Industrial Area", "Charsadda Road"] },
  { id: "nowshera", name: "Nowshera", lat: 33.9907, lng: 71.9981, tolls: ["Nowshera Bridge", "Khattak Toll", "Motorway Interchange"] },
  { id: "chamkani", name: "Chamkani", lat: 34.0151, lng: 71.5249, tolls: ["Chamkani Checkpoint", "Border Entry", "Customs Gate"] }
]

// Real camera-captured vehicle images with visible number plates
const VEHICLE_IMAGES = [
  {
    url: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=300&fit=crop&auto=format",
    plate: "LEJ-1234",
    detected: "LEJ-1234",
    confidence: 99.2
  },
  {
    url: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=400&h=300&fit=crop&auto=format",
    plate: "ABC-5678",
    detected: "ABC-5678",
    confidence: 98.7
  },
  {
    url: "https://images.unsplash.com/photo-1568605117036-5fe5e7fa0ab9?w=400&h=300&fit=crop&auto=format",
    plate: "XYZ-9012",
    detected: "XYZ-9012",
    confidence: 99.1
  },
  {
    url: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=400&h=300&fit=crop&auto=format",
    plate: "KHI-3456",
    detected: "KHI-3456",
    confidence: 97.8
  },
  {
    url: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400&h=300&fit=crop&auto=format",
    plate: "LHR-7890",
    detected: "LHR-7890",
    confidence: 98.9
  },
  {
    url: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=300&fit=crop&auto=format",
    plate: "ISB-2345",
    detected: "ISB-2345",
    confidence: 99.4
  },
  {
    url: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=400&h=300&fit=crop&auto=format",
    plate: "RWP-6789",
    detected: "RWP-6789",
    confidence: 98.2
  },
  {
    url: "https://images.unsplash.com/photo-1568605117036-5fe5e7fa0ab9?w=400&h=300&fit=crop&auto=format",
    plate: "FSD-0123",
    detected: "FSD-0123",
    confidence: 97.5
  },
  {
    url: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=400&h=300&fit=crop&auto=format",
    plate: "MTN-4567",
    detected: "MTN-4567",
    confidence: 96.8
  },
  {
    url: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400&h=300&fit=crop&auto=format",
    plate: "SWL-8901",
    detected: "SWL-8901",
    confidence: 98.1
  }
]

// Oversize vehicle images for customs
const OVERSIZE_VEHICLES = [
  {
    url: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=400&h=300&fit=crop&auto=format",
    plate: "OVS-1234",
    type: "Heavy Truck",
    dimensions: "18.5m x 3.2m x 4.1m",
    weight: "42 tons"
  },
  {
    url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=300&fit=crop&auto=format",
    plate: "OVS-5678",
    type: "Container Truck",
    dimensions: "16.2m x 2.8m x 3.9m",
    weight: "38 tons"
  },
  {
    url: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=400&h=300&fit=crop&auto=format",
    plate: "OVS-9012",
    type: "Dump Truck",
    dimensions: "14.8m x 3.0m x 3.8m",
    weight: "35 tons"
  }
]

interface ANPREntry {
  id: string
  time: string
  date: string
  plate: string
  detectedPlate: string
  location: string
  tollPlaza: string
  lane: string
  status: 'OK' | 'Flagged' | 'Watchlist' | 'Blacklist' | 'VIP'
  confidence: number
  vehicleType: 'Car' | 'Truck' | 'Bus' | 'Motorcycle' | 'SUV' | 'Van' | 'Pickup' | 'Heavy Truck' | 'Container' | 'Dump Truck'
  vehicleColor: string
  speed: number
  imageUrl: string
  imageMetadata: {
    timestamp: string
    cameraId: string
    cameraAngle: string
    weather: 'Clear' | 'Rain' | 'Fog' | 'Night'
  }
  driverName?: string
  company?: string
  violation?: string
  timestamp: number
  // Oversize vehicle fields
  isOversize?: boolean
  oversizeFlag?: 'Height' | 'Width' | 'Length' | 'Weight' | 'Combination'
  oversizeDetails?: {
    height?: number
    width?: number
    length?: number
    weight?: number
    dimensions: string
    permitRequired: boolean
    permitPresent?: boolean
    customsRouting: 'Inspection' | 'Weighbridge' | 'Direct' | 'Quarantine'
    examinationRequired: boolean
    examinationType?: 'Physical' | 'X-Ray' | 'Radiation' | 'Customs'
    customsDeclaration?: string
    cargoType?: 'General' | 'Hazardous' | 'Perishable' | 'High Value' | 'Restricted'
  }
}

export default function JcpTollPlazaEntryPage() {
  const [entries, setEntries] = useState<ANPREntry[]>([])
  const [filteredEntries, setFilteredEntries] = useState<ANPREntry[]>([])
  const [showModal, setShowModal] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedOversizeFilter, setSelectedOversizeFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [dateRange, setDateRange] = useState<string>("today")
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
  const [selectedEntry, setSelectedEntry] = useState<ANPREntry | null>(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("all")
  const [customsRoutingDialog, setCustomsRoutingDialog] = useState(false)
  const [selectedOversizeEntry, setSelectedOversizeEntry] = useState<ANPREntry | null>(null)
  const [customsAction, setCustomsAction] = useState<string>("")
  
  const [formData, setFormData] = useState({
    time: "",
    plate: "",
    location: "Peshawar",
    tollPlaza: "Ring Road Toll",
    lane: "Lane 1",
    status: "OK",
    vehicleType: "Car",
    vehicleColor: "",
    speed: "60",
    isOversize: false,
    oversizeHeight: "",
    oversizeWidth: "",
    oversizeLength: "",
    oversizeWeight: "",
    customsRouting: "Inspection",
    cargoType: "General"
  })

  // Initialize with realistic dummy records including oversize vehicles
  useEffect(() => {
    // Create entries with varied data including oversize vehicles
    const initialEntries: ANPREntry[] = [
      {
        id: "entry-1",
        time: "08:23",
        date: "2024-03-15",
        plate: "LEJ-1234",
        detectedPlate: "LEJ-1234",
        location: "Peshawar",
        tollPlaza: "Ring Road Toll",
        lane: "Lane 2",
        status: "OK",
        confidence: 99.2,
        vehicleType: "Car",
        vehicleColor: "White",
        speed: 65,
        imageUrl: VEHICLE_IMAGES[0].url,
        imageMetadata: {
          timestamp: "2024-03-15 08:23:45",
          cameraId: "CAM-0042",
          cameraAngle: "Front View",
          weather: "Clear"
        },
        timestamp: 1710487425000
      },
      {
        id: "entry-2",
        time: "09:15",
        date: "2024-03-15",
        plate: "ABC-5678",
        detectedPlate: "ABC-5678",
        location: "Kohat",
        tollPlaza: "Kohat Tunnel",
        lane: "Lane 1",
        status: "VIP",
        confidence: 98.7,
        vehicleType: "SUV",
        vehicleColor: "Black",
        speed: 55,
        imageUrl: VEHICLE_IMAGES[1].url,
        imageMetadata: {
          timestamp: "2024-03-15 09:15:22",
          cameraId: "CAM-0087",
          cameraAngle: "Front View",
          weather: "Clear"
        },
        driverName: "Government Official",
        company: "District Administration",
        timestamp: 1710490522000
      },
      {
        id: "entry-3",
        time: "10:42",
        date: "2024-03-15",
        plate: "XYZ-9012",
        detectedPlate: "XYZ-9012",
        location: "Mardan",
        tollPlaza: "Industrial Area",
        lane: "Lane 3",
        status: "Flagged",
        confidence: 99.1,
        vehicleType: "Truck",
        vehicleColor: "Blue",
        speed: 45,
        imageUrl: VEHICLE_IMAGES[2].url,
        imageMetadata: {
          timestamp: "2024-03-15 10:42:33",
          cameraId: "CAM-0123",
          cameraAngle: "Side View",
          weather: "Clear"
        },
        violation: "Expired registration",
        timestamp: 1710495753000
      },
      {
        id: "entry-4",
        time: "11:07",
        date: "2024-03-15",
        plate: "KHI-3456",
        detectedPlate: "KHI-3456",
        location: "Nowshera",
        tollPlaza: "Khattak Toll",
        lane: "Lane 2",
        status: "OK",
        confidence: 97.8,
        vehicleType: "Van",
        vehicleColor: "Silver",
        speed: 70,
        imageUrl: VEHICLE_IMAGES[3].url,
        imageMetadata: {
          timestamp: "2024-03-15 11:07:18",
          cameraId: "CAM-0056",
          cameraAngle: "Rear View",
          weather: "Rain"
        },
        timestamp: 1710497238000
      },
      {
        id: "entry-5",
        time: "12:30",
        date: "2024-03-15",
        plate: "LHR-7890",
        detectedPlate: "LHR-7890",
        location: "DI Khan",
        tollPlaza: "Main Entry",
        lane: "Lane 1",
        status: "Watchlist",
        confidence: 98.9,
        vehicleType: "Car",
        vehicleColor: "Red",
        speed: 82,
        imageUrl: VEHICLE_IMAGES[4].url,
        imageMetadata: {
          timestamp: "2024-03-15 12:30:45",
          cameraId: "CAM-0094",
          cameraAngle: "Front View",
          weather: "Clear"
        },
        violation: "Suspicious vehicle - under surveillance",
        timestamp: 1710502245000
      },
      {
        id: "entry-6",
        time: "13:48",
        date: "2024-03-15",
        plate: "ISB-2345",
        detectedPlate: "ISB-2345",
        location: "Chamkani",
        tollPlaza: "Border Entry",
        lane: "Lane 4",
        status: "OK",
        confidence: 99.4,
        vehicleType: "SUV",
        vehicleColor: "Gray",
        speed: 60,
        imageUrl: VEHICLE_IMAGES[5].url,
        imageMetadata: {
          timestamp: "2024-03-15 13:48:12",
          cameraId: "CAM-0078",
          cameraAngle: "Entry Gate",
          weather: "Fog"
        },
        timestamp: 1710506892000
      },
      {
        id: "entry-7",
        time: "14:22",
        date: "2024-03-15",
        plate: "RWP-6789",
        detectedPlate: "RWP-6789",
        location: "Yarik",
        tollPlaza: "Yarik Bridge",
        lane: "Lane 2",
        status: "Blacklist",
        confidence: 98.2,
        vehicleType: "Pickup",
        vehicleColor: "White",
        speed: 75,
        imageUrl: VEHICLE_IMAGES[6].url,
        imageMetadata: {
          timestamp: "2024-03-15 14:22:30",
          cameraId: "CAM-0033",
          cameraAngle: "Overhead",
          weather: "Clear"
        },
        violation: "Stolen vehicle reported",
        timestamp: 1710508950000
      },
      {
        id: "entry-8",
        time: "15:05",
        date: "2024-03-15",
        plate: "FSD-0123",
        detectedPlate: "FSD-0123",
        location: "Peshawar",
        tollPlaza: "University Road Checkpost",
        lane: "Lane 3",
        status: "OK",
        confidence: 97.5,
        vehicleType: "Bus",
        vehicleColor: "Green",
        speed: 40,
        imageUrl: VEHICLE_IMAGES[7].url,
        imageMetadata: {
          timestamp: "2024-03-15 15:05:55",
          cameraId: "CAM-0156",
          cameraAngle: "Side View",
          weather: "Clear"
        },
        company: "Daewoo Express",
        timestamp: 1710511555000
      },
      {
        id: "entry-9",
        time: "16:37",
        date: "2024-03-15",
        plate: "MTN-4567",
        detectedPlate: "MTN-4567",
        location: "Kohat",
        tollPlaza: "City Entry",
        lane: "Lane 1",
        status: "Flagged",
        confidence: 96.8,
        vehicleType: "Car",
        vehicleColor: "Blue",
        speed: 68,
        imageUrl: VEHICLE_IMAGES[8].url,
        imageMetadata: {
          timestamp: "2024-03-15 16:37:42",
          cameraId: "CAM-0112",
          cameraAngle: "Front View",
          weather: "Rain"
        },
        violation: "No insurance",
        timestamp: 1710517062000
      },
      {
        id: "entry-10",
        time: "17:50",
        date: "2024-03-15",
        plate: "SWL-8901",
        detectedPlate: "SWL-8901",
        location: "Mardan",
        tollPlaza: "Charsadda Road",
        lane: "Lane 2",
        status: "VIP",
        confidence: 98.1,
        vehicleType: "SUV",
        vehicleColor: "Black",
        speed: 72,
        imageUrl: VEHICLE_IMAGES[9].url,
        imageMetadata: {
          timestamp: "2024-03-15 17:50:18",
          cameraId: "CAM-0067",
          cameraAngle: "Entry Gate",
          weather: "Night"
        },
        driverName: "CEO",
        company: "Mardan Industries",
        timestamp: 1710521418000
      },
      // Oversize vehicles for customs examination
      {
        id: "oversize-1",
        time: "09:30",
        date: "2024-03-15",
        plate: "OVS-1234",
        detectedPlate: "OVS-1234",
        location: "Chamkani",
        tollPlaza: "Customs Gate",
        lane: "Lane 5",
        status: "Flagged",
        confidence: 98.5,
        vehicleType: "Heavy Truck",
        vehicleColor: "Red",
        speed: 35,
        imageUrl: OVERSIZE_VEHICLES[0].url,
        imageMetadata: {
          timestamp: "2024-03-15 09:30:22",
          cameraId: "CAM-0201",
          cameraAngle: "Overhead",
          weather: "Clear"
        },
        company: "Oversize Logistics",
        isOversize: true,
        oversizeFlag: "Combination",
        oversizeDetails: {
          height: 4.1,
          width: 3.2,
          length: 18.5,
          weight: 42,
          dimensions: "18.5m x 3.2m x 4.1m",
          permitRequired: true,
          permitPresent: false,
          customsRouting: "Inspection",
          examinationRequired: true,
          examinationType: "Physical",
          cargoType: "General",
          customsDeclaration: "CD-2024-0892"
        },
        timestamp: 1710495022000
      },
      {
        id: "oversize-2",
        time: "11:15",
        date: "2024-03-15",
        plate: "OVS-5678",
        detectedPlate: "OVS-5678",
        location: "Chamkani",
        tollPlaza: "Customs Gate",
        lane: "Lane 5",
        status: "Flagged",
        confidence: 97.9,
        vehicleType: "Container",
        vehicleColor: "Blue",
        speed: 30,
        imageUrl: OVERSIZE_VEHICLES[1].url,
        imageMetadata: {
          timestamp: "2024-03-15 11:15:45",
          cameraId: "CAM-0202",
          cameraAngle: "Side View",
          weather: "Clear"
        },
        company: "Global Shipping",
        isOversize: true,
        oversizeFlag: "Height",
        oversizeDetails: {
          height: 3.9,
          width: 2.8,
          length: 16.2,
          weight: 38,
          dimensions: "16.2m x 2.8m x 3.9m",
          permitRequired: true,
          permitPresent: true,
          customsRouting: "Weighbridge",
          examinationRequired: true,
          examinationType: "X-Ray",
          cargoType: "High Value",
          customsDeclaration: "CD-2024-0895"
        },
        timestamp: 1710501345000
      },
      {
        id: "oversize-3",
        time: "14:45",
        date: "2024-03-15",
        plate: "OVS-9012",
        detectedPlate: "OVS-9012",
        location: "Chamkani",
        tollPlaza: "Customs Gate",
        lane: "Lane 5",
        status: "Flagged",
        confidence: 98.2,
        vehicleType: "Dump Truck",
        vehicleColor: "Yellow",
        speed: 25,
        imageUrl: OVERSIZE_VEHICLES[2].url,
        imageMetadata: {
          timestamp: "2024-03-15 14:45:33",
          cameraId: "CAM-0203",
          cameraAngle: "Entry Gate",
          weather: "Clear"
        },
        company: "Mining Corp",
        isOversize: true,
        oversizeFlag: "Weight",
        oversizeDetails: {
          height: 3.8,
          width: 3.0,
          length: 14.8,
          weight: 35,
          dimensions: "14.8m x 3.0m x 3.8m",
          permitRequired: true,
          permitPresent: true,
          customsRouting: "Quarantine",
          examinationRequired: true,
          examinationType: "Radiation",
          cargoType: "Restricted",
          customsDeclaration: "CD-2024-0901"
        },
        timestamp: 1710513933000
      }
    ]

    // Sort by timestamp (newest first)
    const sortedEntries = initialEntries.sort((a, b) => b.timestamp - a.timestamp)
    
    setEntries(sortedEntries)
    setFilteredEntries(sortedEntries)
    
    localStorage.setItem("anprEntries", JSON.stringify(sortedEntries))
  }, [])

  // Apply filters
  useEffect(() => {
    let filtered = [...entries]
    
    if (selectedLocation !== 'all') {
      filtered = filtered.filter(e => e.location === selectedLocation)
    }
    
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(e => e.status === selectedStatus)
    }

    if (selectedOversizeFilter !== 'all') {
      if (selectedOversizeFilter === 'oversize') {
        filtered = filtered.filter(e => e.isOversize === true)
      } else if (selectedOversizeFilter === 'normal') {
        filtered = filtered.filter(e => !e.isOversize)
      }
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(e => 
        e.plate.toLowerCase().includes(term) ||
        e.detectedPlate.toLowerCase().includes(term) ||
        e.location.toLowerCase().includes(term) ||
        e.tollPlaza.toLowerCase().includes(term) ||
        e.vehicleType.toLowerCase().includes(term) ||
        e.vehicleColor.toLowerCase().includes(term) ||
        e.imageMetadata.cameraId.toLowerCase().includes(term)
      )
    }
    
    if (dateRange === 'today') {
      const today = new Date().toISOString().split('T')[0]
      filtered = filtered.filter(e => e.date === today)
    } else if (dateRange === 'week') {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      filtered = filtered.filter(e => new Date(e.date) >= weekAgo)
    }

    // Apply tab filter
    if (activeTab === "oversize") {
      filtered = filtered.filter(e => e.isOversize === true)
    } else if (activeTab === "customs") {
      filtered = filtered.filter(e => e.isOversize === true && e.oversizeDetails?.examinationRequired === true)
    }
    
    setFilteredEntries(filtered)
  }, [entries, selectedLocation, selectedStatus, selectedOversizeFilter, searchTerm, dateRange, activeTab])

  // Save to localStorage whenever entries change
  useEffect(() => {
    if (entries.length > 0) {
      localStorage.setItem("anprEntries", JSON.stringify(entries))
    }
  }, [entries])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined
    
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }))
    
    // Update toll plaza options when location changes
    if (name === 'location') {
      const location = LOCATIONS.find(l => l.name === value)
      if (location) {
        setFormData(prev => ({ ...prev, tollPlaza: location.tolls[0] }))
      }
    }
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const randomImage = formData.isOversize 
      ? OVERSIZE_VEHICLES[Math.floor(Math.random() * OVERSIZE_VEHICLES.length)].url
      : VEHICLE_IMAGES[Math.floor(Math.random() * VEHICLE_IMAGES.length)].url
    
    const newEntry: ANPREntry = {
      id: `entry-${Date.now()}`,
      time: formData.time,
      date: new Date().toISOString().split('T')[0],
      plate: formData.plate.toUpperCase(),
      detectedPlate: formData.plate.toUpperCase(),
      location: formData.location,
      tollPlaza: formData.tollPlaza,
      lane: formData.lane,
      status: formData.status as any,
      confidence: 99.5,
      vehicleType: formData.vehicleType as any,
      vehicleColor: formData.vehicleColor,
      speed: parseInt(formData.speed),
      imageUrl: randomImage,
      imageMetadata: {
        timestamp: new Date().toLocaleString(),
        cameraId: `CAM-${Math.floor(Math.random() * 100) + 1}`.padStart(6, '0'),
        cameraAngle: 'Front View',
        weather: 'Clear'
      },
      timestamp: Date.now(),
      ...(formData.isOversize && {
        isOversize: true,
        oversizeFlag: "Combination",
        oversizeDetails: {
          height: parseFloat(formData.oversizeHeight) || 4.0,
          width: parseFloat(formData.oversizeWidth) || 2.8,
          length: parseFloat(formData.oversizeLength) || 16.0,
          weight: parseFloat(formData.oversizeWeight) || 35,
          dimensions: `${formData.oversizeLength || 16.0}m x ${formData.oversizeWidth || 2.8}m x ${formData.oversizeHeight || 4.0}m`,
          permitRequired: true,
          permitPresent: false,
          customsRouting: formData.customsRouting as any,
          examinationRequired: true,
          cargoType: formData.cargoType as any
        }
      })
    }
    
    setEntries([newEntry, ...entries])
    setFormData({
      time: "",
      plate: "",
      location: "Peshawar",
      tollPlaza: "Ring Road Toll",
      lane: "Lane 1",
      status: "OK",
      vehicleType: "Car",
      vehicleColor: "",
      speed: "60",
      isOversize: false,
      oversizeHeight: "",
      oversizeWidth: "",
      oversizeLength: "",
      oversizeWeight: "",
      customsRouting: "Inspection",
      cargoType: "General"
    })
    setShowModal(false)
  }

  const handleCustomsRouting = (entry: ANPREntry) => {
    setSelectedOversizeEntry(entry)
    setCustomsRoutingDialog(true)
  }

  const submitCustomsRouting = () => {
    if (selectedOversizeEntry && customsAction) {
      const updatedEntries = entries.map(entry => {
        if (entry.id === selectedOversizeEntry.id && entry.oversizeDetails) {
          return {
            ...entry,
            oversizeDetails: {
              ...entry.oversizeDetails,
              customsRouting: customsAction as any,
              examinationRequired: customsAction !== 'Direct'
            }
          }
        }
        return entry
      })
      setEntries(updatedEntries)
      setCustomsRoutingDialog(false)
      setSelectedOversizeEntry(null)
      setCustomsAction("")
    }
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'OK':
        return <Badge className="bg-green-100 text-green-800 border-green-200">OK</Badge>
      case 'Flagged':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Flagged</Badge>
      case 'Watchlist':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Watchlist</Badge>
      case 'Blacklist':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Blacklist</Badge>
      case 'VIP':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">VIP</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getOversizeBadge = (oversizeDetails: any) => {
    const routingColors = {
      'Inspection': 'bg-orange-100 text-orange-800 border-orange-200',
      'Weighbridge': 'bg-blue-100 text-blue-800 border-blue-200',
      'Direct': 'bg-green-100 text-green-800 border-green-200',
      'Quarantine': 'bg-red-100 text-red-800 border-red-200'
    }
    
    return (
      <div className="space-y-1">
        <Badge className="bg-purple-100 text-purple-800 border-purple-200 flex items-center gap-1">
          <Truck className="w-3 h-3" /> Oversize
        </Badge>
        <Badge className={routingColors[oversizeDetails.customsRouting as keyof typeof routingColors]}>
          {oversizeDetails.customsRouting}
        </Badge>
      </div>
    )
  }

  const getStats = () => {
    const today = new Date().toISOString().split('T')[0]
    const todayEntries = entries.filter(e => e.date === today)
    const flaggedEntries = entries.filter(e => ['Flagged', 'Watchlist', 'Blacklist'].includes(e.status))
    const oversizeEntries = entries.filter(e => e.isOversize === true)
    const customsEntries = entries.filter(e => e.isOversize === true && e.oversizeDetails?.examinationRequired === true)
    
    return {
      today: todayEntries.length,
      flagged: flaggedEntries.length,
      oversize: oversizeEntries.length,
      customs: customsEntries.length,
      locations: new Set(entries.map(e => e.location)).size,
      avgConfidence: Math.round(entries.reduce((acc, e) => acc + e.confidence, 0) / entries.length)
    }
  }

  const stats = getStats()

  if (entries.length === 0) {
    return (
      <ModulePageLayout
        title="JCP/Toll Plaza Entry (ANPR)"
        description="AI-powered Automatic Number Plate Recognition system with customs examination routing"
        breadcrumbs={[{ label: "AI Analytics" }, { label: "JCP/Toll Plaza Entry" }]}
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Camera className="w-12 h-12 text-gray-300 mx-auto mb-4 animate-pulse" />
            <p className="text-gray-500">Loading ANPR data...</p>
          </div>
        </div>
      </ModulePageLayout>
    )
  }

  return (
    <ModulePageLayout
      title="JCP/Toll Plaza Entry (ANPR)"
      description="AI-powered Automatic Number Plate Recognition system with customs examination routing for oversize vehicles"
      breadcrumbs={[{ label: "AI Analytics" }, { label: "JCP/Toll Plaza Entry" }]}
    >
      <div className="space-y-6">
        {/* Stats Cards - Added Oversize Stats */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Entries Today</CardTitle>
              <Car className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.today}</div>
              <p className="text-xs text-muted-foreground mt-1">ANPR captures</p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Cameras</CardTitle>
              <Camera className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">16</div>
              <p className="text-xs text-muted-foreground mt-1">Across {stats.locations} locations</p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Flagged Vehicles</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.flagged}</div>
              <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Oversize Vehicles</CardTitle>
              <Truck className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.oversize}</div>
              <p className="text-xs text-muted-foreground mt-1">Customs routing</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Customs Exam</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.customs}</div>
              <p className="text-xs text-muted-foreground mt-1">Pending inspection</p>
            </CardContent>
          </Card>
        </div>

        {/* Location Quick Stats */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
          {LOCATIONS.map(loc => {
            const count = entries.filter(e => e.location === loc.name).length
            const flagged = entries.filter(e => e.location === loc.name && ['Flagged', 'Watchlist', 'Blacklist'].includes(e.status)).length
            const oversize = entries.filter(e => e.location === loc.name && e.isOversize).length
            
            return (
              <button
                key={loc.id}
                onClick={() => setSelectedLocation(loc.name === selectedLocation ? 'all' : loc.name)}
                className={`p-2 rounded-lg border transition-all ${
                  selectedLocation === loc.name 
                    ? 'bg-blue-50 border-blue-300 shadow-sm' 
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="text-xs font-medium">{loc.name}</div>
                <div className="text-sm font-bold mt-1">{count}</div>
                {flagged > 0 && (
                  <div className="text-xs text-red-600 mt-1">{flagged} flagged</div>
                )}
                {oversize > 0 && (
                  <div className="text-xs text-purple-600">{oversize} oversize</div>
                )}
              </button>
            )
          })}
        </div>

        {/* Tabs for different views */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              All Entries
            </TabsTrigger>
            <TabsTrigger value="oversize" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Oversize Vehicles
            </TabsTrigger>
            <TabsTrigger value="customs" className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Customs Routing
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>ANPR Monitoring with Customs Integration</CardTitle>
            <CardDescription>Real-time vehicle detection, oversize detection, and customs examination routing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="w-full sm:flex-1 sm:min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search plate, camera ID, location..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <select 
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 sm:min-w-[150px] sm:w-auto"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
              >
                <option value="all">All Locations</option>
                {LOCATIONS.map(loc => (
                  <option key={loc.id} value={loc.name}>{loc.name}</option>
                ))}
              </select>

              <select 
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 sm:min-w-[150px] sm:w-auto"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="OK">OK</option>
                <option value="Flagged">Flagged</option>
                <option value="Watchlist">Watchlist</option>
                <option value="Blacklist">Blacklist</option>
                <option value="VIP">VIP</option>
              </select>

              <select 
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 sm:min-w-[150px] sm:w-auto"
                value={selectedOversizeFilter}
                onChange={(e) => setSelectedOversizeFilter(e.target.value)}
              >
                <option value="all">All Vehicles</option>
                <option value="oversize">Oversize Only</option>
                <option value="normal">Normal Vehicles</option>
              </select>

              <select 
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 sm:min-w-[150px] sm:w-auto"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
              >
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="all">All Time</option>
              </select>

              <div className="flex overflow-hidden rounded-lg border border-gray-300">
                <button
                  className={`px-3 py-2 ${viewMode === 'table' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600'}`}
                  onClick={() => setViewMode('table')}
                >
                  Table
                </button>
                <button
                  className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600'}`}
                  onClick={() => setViewMode('grid')}
                >
                  Grid
                </button>
              </div>

              <Button
                className="ml-0 w-full bg-[#3b82f6] text-white hover:bg-[#2563eb] sm:ml-auto sm:w-auto"
                onClick={() => setShowModal(true)}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Entry
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Entries Display */}
        {viewMode === 'table' ? (
          <Card className="w-full min-w-0">
            <CardContent className="w-full min-w-0 p-0">
              <div className="w-full max-w-full overflow-x-auto pb-2">
              <Table className="min-w-[1420px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Camera Capture</TableHead>
                    <TableHead>Plate Detection</TableHead>
                    <TableHead>Time & Location</TableHead>
                    <TableHead>Vehicle Details</TableHead>
                    <TableHead>Oversize/Customs</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow key={entry.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelectedEntry(entry)}>
                      <TableCell>
                        <div className="relative group">
                          <div className="w-20 h-16 rounded overflow-hidden bg-gray-100">
                            <img src={entry.imageUrl} alt="Vehicle" className="w-full h-full object-cover" />
                          </div>
                          <button 
                            className="absolute top-0 right-0 bg-blue-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedImage(entry.imageUrl)
                              setShowImageModal(true)
                            }}
                          >
                            <ZoomIn className="w-3 h-3" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono font-bold text-sm">{entry.plate}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Camera className="w-3 h-3" />
                          Detected: {entry.detectedPlate}
                        </div>
                        <div className="text-xs text-green-600">{entry.confidence}% match</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{entry.time}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {entry.location}
                        </div>
                        <div className="text-xs text-gray-500">{entry.tollPlaza}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{entry.vehicleColor} {entry.vehicleType}</div>
                        <div className="text-xs text-gray-500">Speed: {entry.speed} km/h</div>
                        {entry.company && <div className="text-xs text-gray-500">{entry.company}</div>}
                      </TableCell>
                      <TableCell>
                        {entry.isOversize && entry.oversizeDetails ? (
                          <div className="space-y-1">
                            {getOversizeBadge(entry.oversizeDetails)}
                            <div className="text-xs text-gray-500 mt-1">
                              {entry.oversizeDetails.dimensions}
                            </div>
                            {entry.oversizeDetails.examinationRequired && (
                              <Badge variant="outline" className="text-xs border-amber-200 bg-amber-50">
                                Exam Required
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">Standard</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(entry.status)}
                        {entry.violation && (
                          <div className="text-xs text-red-600 mt-1 max-w-[150px] truncate" title={entry.violation}>
                            ⚠ {entry.violation}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="text-blue-600">
                            <Eye className="w-4 h-4 mr-1" /> View
                          </Button>
                          {entry.isOversize && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-purple-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCustomsRouting(entry)
                              }}
                            >
                              <ClipboardCheck className="w-4 h-4 mr-1" /> Route
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEntries.map((entry) => (
              <Card key={entry.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedEntry(entry)}>
                <div className="relative h-40 bg-gray-100 group">
                  <img src={entry.imageUrl} alt="Vehicle" className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2">
                    {getStatusBadge(entry.status)}
                  </div>
                  {entry.isOversize && (
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                        <Truck className="w-3 h-3 mr-1" /> Oversize
                      </Badge>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm font-mono">
                    {entry.plate}
                  </div>
                  <button 
                    className="absolute top-2 left-12 bg-blue-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedImage(entry.imageUrl)
                      setShowImageModal(true)
                    }}
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-2 right-2 bg-green-600 text-white px-2 py-1 rounded text-xs">
                    {entry.confidence}%
                  </div>
                </div>
                <CardContent className="p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-sm font-medium">{entry.vehicleColor} {entry.vehicleType}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {entry.time} - {entry.date}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {entry.location}
                      </div>
                    </div>
                  </div>
                  {entry.isOversize && entry.oversizeDetails && (
                    <div className="mt-2 p-2 bg-purple-50 rounded-lg">
                      <div className="text-xs font-medium text-purple-700 mb-1">Customs Routing:</div>
                      <div className="text-xs text-purple-600">{entry.oversizeDetails.customsRouting}</div>
                      <div className="text-xs text-gray-500 mt-1">{entry.oversizeDetails.dimensions}</div>
                    </div>
                  )}
                  {entry.violation && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 p-1 rounded">
                      ⚠ {entry.violation}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>Today's ANPR Summary with Customs Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700 mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="font-medium">Peak Hours</span>
                </div>
                <p className="text-lg font-bold">08:00 - 10:00</p>
                <p className="text-sm text-blue-600">142 vehicles</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 mb-1">
                  <Car className="w-4 h-4" />
                  <span className="font-medium">Most Common</span>
                </div>
                <p className="text-lg font-bold">Cars (45%)</p>
                <p className="text-sm text-green-600">Followed by SUVs</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-purple-700 mb-1">
                  <Truck className="w-4 h-4" />
                  <span className="font-medium">Oversize Today</span>
                </div>
                <p className="text-lg font-bold">{stats.oversize}</p>
                <p className="text-sm text-purple-600">Requires customs</p>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-orange-700 mb-1">
                  <ClipboardCheck className="w-4 h-4" />
                  <span className="font-medium">Customs Queue</span>
                </div>
                <p className="text-lg font-bold">{stats.customs}</p>
                <p className="text-sm text-orange-600">Pending examination</p>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-amber-700 mb-1">
                  <Scale className="w-4 h-4" />
                  <span className="font-medium">Avg Oversize Wt</span>
                </div>
                <p className="text-lg font-bold">38.3 tons</p>
                <p className="text-sm text-amber-600">Heavy vehicles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Entry Modal with Oversize Fields */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              onClick={() => setShowModal(false)}
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-semibold mb-4">Add ANPR Entry</h2>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Time (HH:MM)"
                  name="time"
                  value={formData.time}
                  onChange={handleInputChange}
                  required
                />
                <Input
                  placeholder="Speed (km/h)"
                  name="speed"
                  type="number"
                  value={formData.speed}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <Input
                placeholder="Plate Number (e.g., LEJ-1234)"
                name="plate"
                value={formData.plate}
                onChange={handleInputChange}
                required
                className="font-mono"
              />

              <div className="grid grid-cols-2 gap-3">
                <select
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  {LOCATIONS.map(loc => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))}
                </select>

                <select
                  name="tollPlaza"
                  value={formData.tollPlaza}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  {LOCATIONS.find(l => l.name === formData.location)?.tolls.map(toll => (
                    <option key={toll} value={toll}>{toll}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <select
                  name="lane"
                  value={formData.lane}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option>Lane 1</option>
                  <option>Lane 2</option>
                  <option>Lane 3</option>
                  <option>Lane 4</option>
                </select>

                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option>OK</option>
                  <option>Flagged</option>
                  <option>Watchlist</option>
                  <option>Blacklist</option>
                  <option>VIP</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <select
                  name="vehicleType"
                  value={formData.vehicleType}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option>Car</option>
                  <option>SUV</option>
                  <option>Truck</option>
                  <option>Bus</option>
                  <option>Van</option>
                  <option>Pickup</option>
                  <option>Motorcycle</option>
                  <option>Heavy Truck</option>
                  <option>Container</option>
                  <option>Dump Truck</option>
                </select>

                <Input
                  placeholder="Vehicle Color"
                  name="vehicleColor"
                  value={formData.vehicleColor}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <Separator className="my-4" />
              
              {/* Oversize Vehicle Section */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isOversize"
                  name="isOversize"
                  checked={formData.isOversize}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, isOversize: checked as boolean }))
                  }
                />
                <Label htmlFor="isOversize" className="text-sm font-medium flex items-center gap-2">
                  <Truck className="h-4 w-4 text-purple-600" />
                  Oversize Vehicle (Requires Customs Examination)
                </Label>
              </div>

              {formData.isOversize && (
                <div className="space-y-4 pl-6 border-l-2 border-purple-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">Height (m)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        name="oversizeHeight"
                        value={formData.oversizeHeight}
                        onChange={handleInputChange}
                        placeholder="4.1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Width (m)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        name="oversizeWidth"
                        value={formData.oversizeWidth}
                        onChange={handleInputChange}
                        placeholder="3.2"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Length (m)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        name="oversizeLength"
                        value={formData.oversizeLength}
                        onChange={handleInputChange}
                        placeholder="18.5"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Weight (tons)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        name="oversizeWeight"
                        value={formData.oversizeWeight}
                        onChange={handleInputChange}
                        placeholder="42"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-gray-500">Customs Routing</Label>
                    <select
                      name="customsRouting"
                      value={formData.customsRouting}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                    >
                      <option value="Inspection">Physical Inspection</option>
                      <option value="Weighbridge">Weighbridge</option>
                      <option value="Quarantine">Quarantine</option>
                      <option value="Direct">Direct (with permit)</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs text-gray-500">Cargo Type</Label>
                    <select
                      name="cargoType"
                      value={formData.cargoType}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                    >
                      <option value="General">General</option>
                      <option value="Hazardous">Hazardous</option>
                      <option value="Perishable">Perishable</option>
                      <option value="High Value">High Value</option>
                      <option value="Restricted">Restricted</option>
                    </select>
                  </div>
                </div>
              )}

              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full mt-4">
                Save Entry
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Customs Routing Dialog */}
      <Dialog open={customsRoutingDialog} onOpenChange={setCustomsRoutingDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-purple-600" />
              Customs Examination Routing
            </DialogTitle>
            <DialogDescription>
              Assign routing for oversize vehicle {selectedOversizeEntry?.plate}
            </DialogDescription>
          </DialogHeader>
          
          {selectedOversizeEntry && selectedOversizeEntry.oversizeDetails && (
            <div className="space-y-4">
              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-purple-700 mb-2">Vehicle Details</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600">Type:</div>
                  <div className="font-medium">{selectedOversizeEntry.vehicleType}</div>
                  <div className="text-gray-600">Dimensions:</div>
                  <div className="font-medium">{selectedOversizeEntry.oversizeDetails.dimensions}</div>
                  <div className="text-gray-600">Weight:</div>
                  <div className="font-medium">{selectedOversizeEntry.oversizeDetails.weight} tons</div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Customs Action</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={customsAction === 'Inspection' ? 'default' : 'outline'}
                    className={customsAction === 'Inspection' ? 'bg-orange-600' : ''}
                    onClick={() => setCustomsAction('Inspection')}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Physical Inspection
                  </Button>
                  <Button
                    variant={customsAction === 'Weighbridge' ? 'default' : 'outline'}
                    className={customsAction === 'Weighbridge' ? 'bg-blue-600' : ''}
                    onClick={() => setCustomsAction('Weighbridge')}
                  >
                    <Scale className="h-4 w-4 mr-2" />
                    Weighbridge
                  </Button>
                  <Button
                    variant={customsAction === 'Quarantine' ? 'default' : 'outline'}
                    className={customsAction === 'Quarantine' ? 'bg-red-600' : ''}
                    onClick={() => setCustomsAction('Quarantine')}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Quarantine
                  </Button>
                  <Button
                    variant={customsAction === 'Direct' ? 'default' : 'outline'}
                    className={customsAction === 'Direct' ? 'bg-green-600' : ''}
                    onClick={() => setCustomsAction('Direct')}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Direct (Permit)
                  </Button>
                </div>
              </div>

              {customsAction && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm text-blue-700">
                    {customsAction === 'Inspection' && 'Vehicle will be directed to physical inspection bay for detailed customs examination.'}
                    {customsAction === 'Weighbridge' && 'Vehicle will be routed to weighbridge for weight verification and documentation.'}
                    {customsAction === 'Quarantine' && 'Vehicle will be held in quarantine area for agricultural/biological inspection.'}
                    {customsAction === 'Direct' && 'Vehicle cleared for direct passage (permit verified).'}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCustomsRoutingDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-purple-600 hover:bg-purple-700"
              onClick={submitCustomsRouting}
              disabled={!customsAction}
            >
              Confirm Routing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Entry Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              onClick={() => setSelectedEntry(null)}
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-semibold mb-4">ANPR Entry Details</h2>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="relative group">
                  <img src={selectedEntry.imageUrl} alt="Vehicle" className="w-full h-48 object-cover rounded-lg" />
                  <button 
                    className="absolute top-2 right-2 bg-blue-600 text-white p-2 rounded-full"
                    onClick={() => {
                      setSelectedImage(selectedEntry.imageUrl)
                      setShowImageModal(true)
                    }}
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="mt-3 bg-gray-50 p-3 rounded-lg">
                  <h3 className="font-medium text-sm text-gray-700 mb-2">Camera Capture Info</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Camera ID:</span>
                      <span className="font-mono">{selectedEntry.imageMetadata.cameraId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Angle:</span>
                      <span>{selectedEntry.imageMetadata.cameraAngle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Weather:</span>
                      <span>{selectedEntry.imageMetadata.weather}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Capture Time:</span>
                      <span>{selectedEntry.imageMetadata.timestamp}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-sm text-gray-700 mb-3">Plate Recognition</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Detected Plate</span>
                      <span className="font-mono font-bold text-lg bg-green-100 px-3 py-1 rounded">
                        {selectedEntry.detectedPlate}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Confidence</span>
                      <span className={`font-medium ${
                        selectedEntry.confidence >= 98 ? 'text-green-600' :
                        selectedEntry.confidence >= 95 ? 'text-blue-600' :
                        'text-yellow-600'
                      }`}>{selectedEntry.confidence}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Status</span>
                      {getStatusBadge(selectedEntry.status)}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-sm text-gray-700 mb-3">Vehicle Details</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Type</span>
                      <span className="text-sm">{selectedEntry.vehicleColor} {selectedEntry.vehicleType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Speed</span>
                      <span className="text-sm">{selectedEntry.speed} km/h</span>
                    </div>
                    {selectedEntry.driverName && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Driver</span>
                        <span className="text-sm">{selectedEntry.driverName}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-sm text-gray-700 mb-3">Location Details</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Location</span>
                      <span className="text-sm">{selectedEntry.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Toll Plaza</span>
                      <span className="text-sm">{selectedEntry.tollPlaza}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Lane</span>
                      <span className="text-sm">{selectedEntry.lane}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Date/Time</span>
                      <span className="text-sm">{selectedEntry.date} {selectedEntry.time}</span>
                    </div>
                  </div>
                </div>

                {selectedEntry.isOversize && selectedEntry.oversizeDetails && (
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="font-medium text-sm text-purple-700 mb-3 flex items-center gap-2">
                      <Truck className="w-4 h-4" />
                      Customs Examination Details
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Dimensions</span>
                        <span className="text-sm font-medium">{selectedEntry.oversizeDetails.dimensions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Weight</span>
                        <span className="text-sm font-medium">{selectedEntry.oversizeDetails.weight} tons</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Permit Required</span>
                        <Badge className={selectedEntry.oversizeDetails.permitPresent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {selectedEntry.oversizeDetails.permitPresent ? 'Present' : 'Missing'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Customs Routing</span>
                        <Badge className={
                          selectedEntry.oversizeDetails.customsRouting === 'Inspection' ? 'bg-orange-100 text-orange-800' :
                          selectedEntry.oversizeDetails.customsRouting === 'Weighbridge' ? 'bg-blue-100 text-blue-800' :
                          selectedEntry.oversizeDetails.customsRouting === 'Quarantine' ? 'bg-red-100 text-red-800' :
                          'bg-green-100 text-green-800'
                        }>
                          {selectedEntry.oversizeDetails.customsRouting}
                        </Badge>
                      </div>
                      {selectedEntry.oversizeDetails.customsDeclaration && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Declaration #</span>
                          <span className="text-sm font-mono">{selectedEntry.oversizeDetails.customsDeclaration}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Examination</span>
                        <Badge variant="outline" className={selectedEntry.oversizeDetails.examinationRequired ? 'border-amber-200 bg-amber-50' : ''}>
                          {selectedEntry.oversizeDetails.examinationRequired ? 'Required' : 'Not Required'}
                        </Badge>
                      </div>
                      {selectedEntry.oversizeDetails.examinationType && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Exam Type</span>
                          <span className="text-sm">{selectedEntry.oversizeDetails.examinationType}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {selectedEntry.violation && (
              <div className="mt-4 p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">Alert: {selectedEntry.violation}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setSelectedEntry(null)}>
                Close
              </Button>
              {selectedEntry.isOversize && (
                <Button 
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => {
                    setSelectedEntry(null)
                    handleCustomsRouting(selectedEntry)
                  }}
                >
                  <ClipboardCheck className="w-4 h-4 mr-2" /> Customs Routing
                </Button>
              )}
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Download className="w-4 h-4 mr-2" /> Export Data
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {showImageModal && selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              className="absolute top-4 right-4 text-white bg-black/50 p-2 rounded-full hover:bg-black/70"
              onClick={() => setShowImageModal(false)}
            >
              <X className="w-6 h-6" />
            </button>
            <img src={selectedImage} alt="Vehicle Capture" className="max-w-full max-h-[90vh] object-contain" />
          </div>
        </div>
      )}
    </ModulePageLayout>
  )
}