"use client"

import { useState, useEffect } from "react"
import { 
  AlertTriangle,
  Camera,
  FileText,
  Image,
  Mic,
  Users,
  MapPin,
  Clock,
  Filter,
  Search,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Bell,
  Calendar,
  ChevronDown,
  Grid,
  Layers,
  Shield,
  Flame,
  Truck,
  Package,
  DollarSign,
  UserX,
  Building,
  AlertCircle,
  Zap,
  Thermometer,
  Video,
  FileAudio,
  FileJson,
  Map,
  Plus,
  X,
  Maximize2,
  ZoomIn,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  Box,
  Scale,
  Ship,
  Plane,
  Train,
  Wifi,
  WifiOff,
  Fingerprint,
  Scan
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Pakistan Customs Incident Types
const INCIDENT_TYPES = [
  { id: "smuggling-attempt", name: "Smuggling Attempt", icon: Package, color: "red" },
  { id: "undervalued-declaration", name: "Undervalued Declaration", icon: DollarSign, color: "orange" },
  { id: "misdeclared-goods", name: "Misdeclared Goods", icon: FileText, color: "yellow" },
  { id: "prohibited-items", name: "Prohibited Items", icon: AlertTriangle, color: "red" },
  { id: "unauthorized-access", name: "Unauthorized Access", icon: UserX, color: "orange" },
  { id: "scanner-alert", name: "Scanner Alert", icon: Scan, color: "yellow" },
  { id: "x-ray-anomaly", name: "X-Ray Anomaly", icon: Camera, color: "orange" },
  { id: "detector-dog-alert", name: "Detector Dog Alert", icon: Users, color: "green" },
  { id: "physical-inspection", name: "Physical Inspection Required", icon: Eye, color: "blue" },
  { id: "document-fraud", name: "Document Fraud", icon: FileText, color: "red" },
  { id: "currency-smuggling", name: "Currency Smuggling", icon: DollarSign, color: "red" },
  { id: "narcotics-detection", name: "Narcotics Detection", icon: AlertTriangle, color: "critical" },
  { id: "weapons-detection", name: "Weapons Detection", icon: Shield, color: "critical" },
  { id: "under-invoicing", name: "Under Invoicing", icon: DollarSign, color: "orange" },
  { id: "mis-declared-value", name: "Mis-declared Value", icon: Scale, color: "yellow" },
  { id: "container-tampering", name: "Container Tampering", icon: Package, color: "red" },
  { id: "seal-breach", name: "Seal Breach", icon: Shield, color: "orange" },
  { id: "transit-violation", name: "Transit Violation", icon: Truck, color: "yellow" },
  { id: "customs-bond-violation", name: "Customs Bond Violation", icon: Building, color: "orange" },
  { id: "anti-smuggling-operation", name: "Anti-Smuggling Operation", icon: Shield, color: "green" }
]

// Pakistan Customs Evidence Types
const EVIDENCE_TYPES = [
  { id: "xray-scan", name: "X-Ray Scan", icon: Scan, color: "blue" },
  { id: "cctv-footage", name: "CCTV Footage", icon: Video, color: "blue" },
  { id: "body-camera", name: "Body Camera", icon: Camera, color: "green" },
  { id: "scanner-image", name: "Scanner Image", icon: Image, color: "purple" },
  { id: "declaration-form", name: "Declaration Form", icon: FileText, color: "yellow" },
  { id: "invoice", name: "Invoice", icon: FileText, color: "indigo" },
  { id: "packing-list", name: "Packing List", icon: FileText, color: "cyan" },
  { id: "bill-of-lading", name: "Bill of Lading", icon: FileText, color: "orange" },
  { id: "airway-bill", name: "Airway Bill", icon: FileText, color: "purple" },
  { id: "container-manifest", name: "Container Manifest", icon: FileText, color: "red" },
  { id: "witness-statement", name: "Officer Statement", icon: Users, color: "yellow" },
  { id: "detector-dog-log", name: "Detector Dog Log", icon: Users, color: "green" },
  { id: "ai-detection-data", name: "AI Detection Data", icon: FileJson, color: "cyan" },
  { id: "thermal-reading", name: "Thermal Reading", icon: Thermometer, color: "orange" },
  { id: "radiation-detection", name: "Radiation Detection", icon: Zap, color: "red" },
  { id: "gps-tracking", name: "GPS Tracking", icon: MapPin, color: "blue" },
  { id: "seal-number", name: "Seal Number", icon: Shield, color: "green" },
  { id: "container-number", name: "Container Number", icon: Box, color: "purple" },
  { id: "vehicle-plate", name: "Vehicle Plate", icon: Truck, color: "orange" },
  { id: "driver-license", name: "Driver License", icon: FileText, color: "yellow" },
  { id: "passport-copy", name: "Passport Copy", icon: FileText, color: "indigo" },
  { id: "commercial-invoice", name: "Commercial Invoice", icon: FileText, color: "cyan" },
  { id: "currency-declaration", name: "Currency Declaration", icon: DollarSign, color: "green" }
]

// Severity Levels
const SEVERITY_LEVELS = [
  { id: "critical", name: "Critical", color: "red" },
  { id: "high", name: "High", color: "orange" },
  { id: "medium", name: "Medium", color: "yellow" },
  { id: "low", name: "Low", color: "blue" },
  { id: "informational", name: "Informational", color: "green" }
]

// Status Types
const STATUS_TYPES = [
  { id: "active", name: "Active", color: "red" },
  { id: "investigating", name: "Under Investigation", color: "yellow" },
  { id: "inspection", name: "Inspection Scheduled", color: "purple" },
  { id: "detained", name: "Goods Detained", color: "orange" },
  { id: "seized", name: "Goods Seized", color: "red" },
  { id: "released", name: "Released", color: "green" },
  { id: "false-alarm", name: "False Alarm", color: "gray" },
  { id: "referred", name: "Referred to Investigation", color: "blue" }
]

// Pakistan Customs Locations
const LOCATIONS = [
  "Karachi Port - Terminal 1",
  "Karachi Port - Terminal 2",
  "Port Qasim - Container Terminal",
  "Jinnah International Airport - Cargo",
  "Allama Iqbal International Airport - Cargo",
  "Islamabad International Airport - Cargo",
  "Torkham Border - Customs Station",
  "Wagah Border - Customs Station",
  "Chaman Border - Customs Station",
  "Wahga Customs Station",
  "Sust Dry Port - Customs Station",
  "Sialkot International Airport - Cargo",
  "Faisalabad Dry Port",
  "Lahore Dry Port",
  "Multan Dry Port",
  "Quetta Dry Port",
  "Peshawar Dry Port",
  "Gwadar Port - Container Terminal",
  "KPT - East Wharf",
  "KPT - West Wharf",
  "Export Processing Zone - Karachi",
  "Container Scanning Facility - Karachi",
  "Container Scanning Facility - Lahore",
  "Container Scanning Facility - Torkham"
]

// Customs Ports of Entry
const PORTS_OF_ENTRY = [
  "Karachi Sea Port",
  "Port Qasim",
  "Gwadar Port",
  "Jinnah International Airport",
  "Allama Iqbal International Airport",
  "Islamabad International Airport",
  "Torkham Land Port",
  "Wagah Land Port",
  "Chaman Land Port",
  "Wahga Land Port",
  "Sust Dry Port",
  "Sialkot International Airport"
]

// Commodity Types
const COMMODITY_TYPES = [
  "Electronics",
  "Textiles",
  "Auto Parts",
  "Pharmaceuticals",
  "Food Items",
  "Chemicals",
  "Machinery",
  "Furniture",
  "Vehicles",
  "Spare Parts",
  "Plastic Products",
  "Leather Goods",
  "Carpets",
  "Sports Goods",
  "Surgical Instruments",
  "Rice",
  "Cotton",
  "Cement",
  "Fertilizer",
  "Petroleum Products"
]

// Countries of Origin/Destination
const COUNTRIES = [
  "China",
  "UAE",
  "Saudi Arabia",
  "Turkey",
  "Afghanistan",
  "Iran",
  "India",
  "Bangladesh",
  "Sri Lanka",
  "Malaysia",
  "Indonesia",
  "Thailand",
  "Vietnam",
  "Japan",
  "South Korea",
  "USA",
  "UK",
  "Germany",
  "Italy",
  "France"
]

// Customs Officer Names
const CUSTOMS_OFFICERS = [
  "Inspector Ahmed Khan",
  "Inspector Fatima Ali",
  "Inspector Usman Malik",
  "Supervisor Rashid Ahmed",
  "Supervisor Saima Javed",
  "Assistant Collector Tariq Mehmood",
  "Deputy Collector Naila Shah",
  "Preventive Officer Imran Khan",
  "Intelligence Officer Zara Ahmed",
  "Canine Handler Sajid Ali",
  "Scanner Operator Bilal Ahmed",
  "Document Verification Officer Asad Malik"
]

// Container Numbers (Pakistan Customs format)
const CONTAINER_NUMBERS = [
  "PCS-1234567",
  "PCS-2345678",
  "PCS-3456789",
  "KPT-4567890",
  "KPT-5678901",
  "QAS-6789012",
  "QAS-7890123",
  "GWD-8901234",
  "GWD-9012345",
  "TKH-0123456",
  "WGH-1234567",
  "CHM-2345678"
]

// Vehicle Plates (Pakistan format)
const VEHICLE_PLATES = [
  "LEJ-1234",
  "ABC-5678",
  "KHI-9012",
  "LHR-3456",
  "ISB-7890",
  "RWP-2345",
  "PSH-6789",
  "QTA-0123",
  "MTN-4567",
  "SWL-8901"
]

// AI Incident Images (Customs related)
const INCIDENT_IMAGES = [
  {
    url: "https://images.unsplash.com/photo-1566576912323-6e1f0475c3b3?w=400&h=300&fit=crop&auto=format",
    caption: "Container scanning at Karachi Port"
  },
  {
    url: "https://images.unsplash.com/photo-1586528116311-8440c5f0b9f3?w=400&h=300&fit=crop&auto=format",
    caption: "X-ray scan showing suspicious items"
  },
  {
    url: "https://images.unsplash.com/photo-1566576912323-6e1f0475c3b3?w=400&h=300&fit=crop&auto=format",
    caption: "Customs inspection at airport cargo"
  },
  {
    url: "https://images.unsplash.com/photo-1586528116311-8440c5f0b9f3?w=400&h=300&fit=crop&auto=format",
    caption: "Detector dog alert at border"
  },
  {
    url: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&h=300&fit=crop&auto=format",
    caption: "Seized contraband items"
  },
  {
    url: "https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=400&h=300&fit=crop&auto=format",
    caption: "Currency smuggling detection"
  },
  {
    url: "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=400&h=300&fit=crop&auto=format",
    caption: "Container examination facility"
  },
  {
    url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=300&fit=crop&auto=format",
    caption: "Border customs checkpoint"
  }
]

interface Evidence {
  id: string
  type: string
  name: string
  url?: string
  timestamp: string
  size?: string
  description?: string
  metadata?: Record<string, any>
  fileNumber?: string
  referenceId?: string
}

interface CustomsIncident {
  id: string
  incidentType: string
  severity: string
  status: string
  title: string
  description: string
  timestamp: string
  date: string
  location: string
  portOfEntry: string
  cameraId?: string
  scannerId?: string
  detectedBy: string
  confidence: number
  imageUrl: string
  evidence: Evidence[]
  reportedBy?: string
  assignedTo?: string
  assignedOfficer?: string
  resolution?: string
  resolvedAt?: string
  createdAt: number
  
  // Customs-specific fields
  containerNumber?: string
  vehiclePlate?: string
  declarationNumber?: string
  invoiceNumber?: string
  countryOfOrigin?: string
  countryOfDestination?: string
  commodity?: string
  declaredValue?: number
  declaredCurrency?: string
  estimatedValue?: number
  weight?: number
  weightUnit?: string
  sealNumber?: string
  passengerName?: string
  passportNumber?: string
  driverName?: string
  licenseNumber?: string
  companyName?: string
  
  // AI detection metadata
  aiMetadata?: {
    detectionModel: string
    detectionConfidence: number
    aiRulesTriggered: string[]
    scannerType?: string
    anomalyType?: string
    objectDetected?: string[]
    densityDetected?: string
    organicMaterial?: boolean
    metallicDensity?: string
    thermalData?: {
      temperature: number
      threshold: number
      hotspotLocation?: string
    }
    radiationData?: {
      level: number
      threshold: number
      isotope?: string
    }
    currencyDetected?: {
      amount: number
      currency: string
      hiddenLocation?: string
    }
    narcoticsDetected?: boolean
    narcoticsType?: string
    confidenceScore?: number
  }
  
  // Witness statements
  witnessStatements?: string[]
  
  // Action taken
  actionsTaken?: string[]
}

export default function CustomsIncidentManagementPage() {
  const [incidents, setIncidents] = useState<CustomsIncident[]>([])
  const [filteredIncidents, setFilteredIncidents] = useState<CustomsIncident[]>([])
  const [selectedIncident, setSelectedIncident] = useState<CustomsIncident | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
  const [showEvidenceModal, setShowEvidenceModal] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [selectedIncidentType, setSelectedIncidentType] = useState<string>("all")
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedLocation, setSelectedLocation] = useState<string>("all")
  const [selectedPort, setSelectedPort] = useState<string>("all")
  const [dateRange, setDateRange] = useState<string>("today")
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
  
  // Form state for new incident
  const [formData, setFormData] = useState({
    incidentType: "smuggling-attempt",
    severity: "medium",
    title: "",
    description: "",
    location: "Karachi Port - Terminal 1",
    portOfEntry: "Karachi Sea Port",
    reportedBy: "",
    assignedOfficer: "",
    containerNumber: "",
    vehiclePlate: "",
    declarationNumber: "",
    commodity: "",
    declaredValue: "",
    countryOfOrigin: "",
    countryOfDestination: ""
  })

  // Generate realistic Pakistan Customs dummy data
  useEffect(() => {
    const generateDummyIncidents = (): CustomsIncident[] => {
      const now = new Date()
      const dummyIncidents: CustomsIncident[] = []
      
      // Generate 20 realistic customs incidents
      for (let i = 0; i < 20; i++) {
        const incidentType = INCIDENT_TYPES[Math.floor(Math.random() * INCIDENT_TYPES.length)]
        const severity = SEVERITY_LEVELS[Math.floor(Math.random() * SEVERITY_LEVELS.length)]
        const status = STATUS_TYPES[Math.floor(Math.random() * STATUS_TYPES.length)]
        const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)]
        const portOfEntry = PORTS_OF_ENTRY[Math.floor(Math.random() * PORTS_OF_ENTRY.length)]
        const countryOfOrigin = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)]
        const countryOfDestination = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)]
        const commodity = COMMODITY_TYPES[Math.floor(Math.random() * COMMODITY_TYPES.length)]
        const containerNumber = CONTAINER_NUMBERS[Math.floor(Math.random() * CONTAINER_NUMBERS.length)]
        const vehiclePlate = VEHICLE_PLATES[Math.floor(Math.random() * VEHICLE_PLATES.length)]
        const officer = CUSTOMS_OFFICERS[Math.floor(Math.random() * CUSTOMS_OFFICERS.length)]
        
        const imageIndex = i % INCIDENT_IMAGES.length
        const imageData = INCIDENT_IMAGES[imageIndex]
        
        const hour = Math.floor(Math.random() * 24)
        const minute = Math.floor(Math.random() * 60)
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        
        const date = new Date(now)
        date.setHours(date.getHours() - Math.floor(Math.random() * 72))
        
        // Generate declared vs estimated values
        const declaredValue = Math.floor(Math.random() * 100000) + 10000
        const estimatedValue = incidentType.id.includes("undervalued") || incidentType.id.includes("under-invoicing") 
          ? Math.floor(declaredValue * (1.5 + Math.random()))
          : declaredValue
        
        // Generate evidence based on incident type
        const evidenceCount = Math.floor(Math.random() * 6) + 3
        const evidence: Evidence[] = []
        
        for (let j = 0; j < evidenceCount; j++) {
          const evidenceType = EVIDENCE_TYPES[Math.floor(Math.random() * EVIDENCE_TYPES.length)]
          
          let metadata = {}
          if (evidenceType.id === 'xray-scan') {
            metadata = {
              scannerType: 'Rapiscan 628XR',
              resolution: '2.5mm',
              density: Math.random() > 0.7 ? 'High density detected' : 'Normal',
              anomalyDetected: Math.random() > 0.6 ? 'Yes' : 'No'
            }
          } else if (evidenceType.id === 'thermal-reading') {
            metadata = {
              temperature: 25 + Math.random() * 15,
              threshold: 32,
              hotspotDetected: Math.random() > 0.7
            }
          } else if (evidenceType.id === 'radiation-detection') {
            metadata = {
              level: Math.random() * 0.5,
              threshold: 0.3,
              alarm: Math.random() > 0.8 ? 'Triggered' : 'Normal'
            }
          } else if (evidenceType.id === 'gps-tracking') {
            metadata = {
              lastLocation: `${24.8 + Math.random()}, ${66.9 + Math.random()}`,
              speed: Math.floor(Math.random() * 60),
              route: 'Karachi - Lahore'
            }
          } else if (evidenceType.id === 'container-number') {
            metadata = {
              containerNumber: containerNumber,
              sealStatus: Math.random() > 0.8 ? 'Tampered' : 'Intact',
              sealNumber: `PK-${Math.floor(Math.random() * 1000000)}`
            }
          } else if (evidenceType.id === 'ai-detection-data') {
            metadata = {
              confidence: 85 + Math.random() * 14,
              model: 'Customs AI Scanner v2.4',
              anomalyScore: Math.floor(Math.random() * 100),
              riskLevel: Math.random() > 0.7 ? 'High' : 'Medium'
            }
          }
          
          evidence.push({
            id: `ev-${i}-${j}-${Date.now()}`,
            type: evidenceType.id,
            name: `${evidenceType.name} - ${date.toISOString().split('T')[0]}`,
            timestamp: date.toISOString(),
            size: `${Math.floor(Math.random() * 20) + 1}.${Math.floor(Math.random() * 9)} MB`,
            description: `${evidenceType.name} captured during inspection`,
            fileNumber: `CUS-EV-${Math.floor(Math.random() * 10000)}`,
            referenceId: `REF-${Math.floor(Math.random() * 100000)}`,
            metadata
          })
        }
        
        // Add witness statements for some incidents
        const witnessStatements = Math.random() > 0.5 ? [
          `Officer ${officer} observed suspicious activity during inspection`,
          "Scanner operator noted anomaly in container scan",
          "Detector dog indicated alert on specific package"
        ].slice(0, Math.floor(Math.random() * 3) + 1) : undefined
        
        // Actions taken
        const actionsTaken = [
          "Container flagged for detailed inspection",
          "Physical examination conducted",
          "Samples collected for laboratory testing",
          "Declaration verified against database",
          "Intelligence report filed",
          "Refer to Anti-Smuggling Organization"
        ].slice(0, Math.floor(Math.random() * 3) + 1)
        
        // Create AI metadata based on incident type
        const aiMetadata = {
          detectionModel: 'Pakistan Customs AI System v1.5',
          detectionConfidence: 80 + Math.floor(Math.random() * 19),
          aiRulesTriggered: [
            'rule-001: undervalued-detection',
            'rule-045: density-anomaly',
            'rule-089: prohibited-items'
          ].slice(0, Math.floor(Math.random() * 3) + 1),
          scannerType: incidentType.id.includes('scanner') || incidentType.id.includes('x-ray') ? 'Rapiscan 628XR' : undefined,
          anomalyType: Math.random() > 0.6 ? 'Density mismatch' : 'Shape anomaly',
          objectDetected: incidentType.id === 'narcotics-detection' ? ['organic material', 'concealed package'] :
                         incidentType.id === 'weapons-detection' ? ['metallic object', 'weapon shape'] :
                         incidentType.id === 'currency-smuggling' ? ['currency notes', 'concealed compartment'] :
                         ['suspicious object'],
          organicMaterial: Math.random() > 0.7,
          metallicDensity: Math.random() > 0.6 ? 'High' : 'Normal',
          confidenceScore: 85 + Math.floor(Math.random() * 14)
        }
        
        // Add thermal data for certain incidents
        if (incidentType.id === 'scanner-alert' || Math.random() > 0.7) {
          aiMetadata.thermalData = {
            temperature: 28 + Math.random() * 15,
            threshold: 32,
            hotspotLocation: Math.random() > 0.5 ? 'Rear of container' : 'Hidden compartment'
          }
        }
        
        // Add currency detection for smuggling incidents
        if (incidentType.id === 'currency-smuggling') {
          aiMetadata.currencyDetected = {
            amount: Math.floor(Math.random() * 5000000) + 100000,
            currency: 'USD',
            hiddenLocation: ['Suitcase lining', 'Vehicle panel', 'False bottom'][Math.floor(Math.random() * 3)]
          }
        }
        
        // Add narcotics detection
        if (incidentType.id === 'narcotics-detection') {
          aiMetadata.narcoticsDetected = true
          aiMetadata.narcoticsType = ['Heroin', 'Hashish', 'Cocaine', 'Methamphetamine'][Math.floor(Math.random() * 4)]
        }
        
        // Incident titles based on customs type
        let title = ""
        let description = ""
        
        switch(incidentType.id) {
          case 'smuggling-attempt':
            title = `Smuggling Attempt - ${commodity}`
            description = `Attempt to smuggle ${commodity} valued at PKR ${estimatedValue.toLocaleString()} detected`
            break
          case 'undervalued-declaration':
            title = `Undervalued Declaration - ${commodity}`
            description = `Declared value PKR ${declaredValue.toLocaleString()} vs estimated PKR ${estimatedValue.toLocaleString()}`
            break
          case 'misdeclared-goods':
            title = `Misdeclared Goods - Container ${containerNumber}`
            description = `${commodity} misdeclared as different category`
            break
          case 'prohibited-items':
            title = `Prohibited Items Detected - ${location}`
            description = `Items prohibited under Customs Act 1969 detected`
            break
          case 'unauthorized-access':
            title = `Unauthorized Access - Restricted Area`
            description = `Individual entered restricted customs area without clearance`
            break
          case 'scanner-alert':
            title = `Scanner Alert - Container ${containerNumber}`
            description = `AI scanner detected anomaly in container scan`
            break
          case 'x-ray-anomaly':
            title = `X-Ray Anomaly - Passenger Baggage`
            description = `Suspicious items detected in baggage scan`
            break
          case 'detector-dog-alert':
            title = `Detector Dog Alert - ${location}`
            description = `K9 unit indicated presence of contraband`
            break
          case 'physical-inspection':
            title = `Physical Inspection Required - ${containerNumber}`
            description = `AI recommends physical inspection based on risk profile`
            break
          case 'document-fraud':
            title = `Document Fraud Detected - Declaration #${Math.floor(Math.random() * 100000)}`
            description = `Forged documents detected during verification`
            break
          case 'currency-smuggling':
            title = `Currency Smuggling Attempt - PKR ${(Math.random() * 10 + 1).toFixed(1)} Million`
            description = `Undisclosed currency detected during inspection`
            break
          case 'narcotics-detection':
            title = `Narcotics Detection Alert - ${location}`
            description = `Suspected narcotics detected by AI scanner`
            break
          case 'weapons-detection':
            title = `Weapons Detection - Security Alert`
            description = `Potential weapons detected in baggage/container`
            break
          case 'under-invoicing':
            title = `Under Invoicing - ${commodity} Shipment`
            description = `Invoice value significantly below market rate`
            break
          case 'container-tampering':
            title = `Container Tampering Detected - ${containerNumber}`
            description = `Container seal shows signs of tampering`
            break
          case 'seal-breach':
            title = `Customs Seal Breach - ${containerNumber}`
            description = `Official customs seal appears compromised`
            break
          default:
            title = `Customs Alert - ${location}`
            description = `Suspicious activity detected by AI system`
        }
        
        dummyIncidents.push({
          id: `customs-incident-${i}-${Date.now()}`,
          incidentType: incidentType.id,
          severity: severity.id,
          status: status.id,
          title,
          description,
          timestamp: timeStr,
          date: date.toISOString().split('T')[0],
          location,
          portOfEntry,
          cameraId: `CAM-CUS-${Math.floor(Math.random() * 50) + 1}`.padStart(8, '0'),
          scannerId: `SCAN-${Math.floor(Math.random() * 20) + 1}`.padStart(6, '0'),
          detectedBy: 'Pakistan Customs AI System',
          confidence: aiMetadata.detectionConfidence,
          imageUrl: imageData.url,
          evidence,
          reportedBy: status.id !== 'active' ? officer : undefined,
          assignedTo: status.id === 'investigating' || status.id === 'inspection' ? 'Investigation Unit' : undefined,
          assignedOfficer: status.id === 'investigating' ? officer : undefined,
          resolution: status.id === 'released' ? 'Goods cleared after inspection' : 
                     status.id === 'seized' ? 'Goods seized under Customs Act Section 156' : undefined,
          resolvedAt: status.id === 'released' || status.id === 'seized' ? date.toISOString() : undefined,
          createdAt: date.getTime(),
          
          // Customs-specific fields
          containerNumber: Math.random() > 0.3 ? containerNumber : undefined,
          vehiclePlate: Math.random() > 0.5 ? vehiclePlate : undefined,
          declarationNumber: `DEC-${Math.floor(Math.random() * 100000)}`,
          invoiceNumber: `INV-${Math.floor(Math.random() * 100000)}`,
          countryOfOrigin,
          countryOfDestination,
          commodity,
          declaredValue,
          declaredCurrency: 'PKR',
          estimatedValue,
          weight: Math.floor(Math.random() * 5000) + 100,
          weightUnit: 'kg',
          sealNumber: `SEAL-${Math.floor(Math.random() * 1000000)}`,
          passengerName: Math.random() > 0.7 ? 'John Doe' : undefined,
          passportNumber: Math.random() > 0.7 ? `PK${Math.floor(Math.random() * 10000000)}` : undefined,
          driverName: Math.random() > 0.6 ? 'Mohammed Ali' : undefined,
          licenseNumber: Math.random() > 0.6 ? `DL-${Math.floor(Math.random() * 100000)}` : undefined,
          companyName: Math.random() > 0.5 ? ['ABC Trading', 'XYZ Imports', 'Global Exports'][Math.floor(Math.random() * 3)] : undefined,
          
          aiMetadata,
          witnessStatements,
          actionsTaken
        })
      }
      
      return dummyIncidents.sort((a, b) => b.createdAt - a.createdAt)
    }

    // Check localStorage first, then generate dummy data
    const stored = localStorage.getItem("customsIncidents")
    if (stored) {
      setIncidents(JSON.parse(stored))
    } else {
      const dummyData = generateDummyIncidents()
      setIncidents(dummyData)
      localStorage.setItem("customsIncidents", JSON.stringify(dummyData))
    }
  }, [])

  // Apply filters
  useEffect(() => {
    let filtered = [...incidents]
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(i => 
        i.title.toLowerCase().includes(term) ||
        i.description.toLowerCase().includes(term) ||
        i.location.toLowerCase().includes(term) ||
        i.containerNumber?.toLowerCase().includes(term) ||
        i.vehiclePlate?.toLowerCase().includes(term) ||
        i.declarationNumber?.toLowerCase().includes(term) ||
        i.commodity?.toLowerCase().includes(term) ||
        i.cameraId?.toLowerCase().includes(term)
      )
    }
    
    if (selectedIncidentType !== 'all') {
      filtered = filtered.filter(i => i.incidentType === selectedIncidentType)
    }
    
    if (selectedSeverity !== 'all') {
      filtered = filtered.filter(i => i.severity === selectedSeverity)
    }
    
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(i => i.status === selectedStatus)
    }
    
    if (selectedLocation !== 'all') {
      filtered = filtered.filter(i => i.location === selectedLocation)
    }
    
    if (selectedPort !== 'all') {
      filtered = filtered.filter(i => i.portOfEntry === selectedPort)
    }
    
    if (activeTab !== 'all') {
      if (activeTab === 'detained') {
        filtered = filtered.filter(i => i.status === 'detained' || i.status === 'seized')
      } else if (activeTab === 'active') {
        filtered = filtered.filter(i => i.status === 'active' || i.status === 'investigating')
      } else if (activeTab === 'scanner') {
        filtered = filtered.filter(i => i.incidentType.includes('scanner') || i.incidentType.includes('x-ray'))
      } else if (activeTab === 'smuggling') {
        filtered = filtered.filter(i => i.incidentType.includes('smuggling') || i.incidentType.includes('currency'))
      }
    }
    
    if (dateRange === 'today') {
      const today = new Date().toISOString().split('T')[0]
      filtered = filtered.filter(i => i.date === today)
    } else if (dateRange === 'week') {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      filtered = filtered.filter(i => new Date(i.date) >= weekAgo)
    } else if (dateRange === 'month') {
      const monthAgo = new Date()
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      filtered = filtered.filter(i => new Date(i.date) >= monthAgo)
    }
    
    setFilteredIncidents(filtered)
  }, [incidents, searchTerm, selectedIncidentType, selectedSeverity, selectedStatus, selectedLocation, selectedPort, dateRange, activeTab])

  // Save to localStorage
  useEffect(() => {
    if (incidents.length > 0) {
      localStorage.setItem("customsIncidents", JSON.stringify(incidents))
    }
  }, [incidents])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const randomImage = INCIDENT_IMAGES[Math.floor(Math.random() * INCIDENT_IMAGES.length)]
    
    const newIncident: CustomsIncident = {
      id: `customs-incident-${Date.now()}`,
      incidentType: formData.incidentType,
      severity: formData.severity,
      status: 'active',
      title: formData.title,
      description: formData.description,
      timestamp: new Date().toLocaleTimeString(),
      date: new Date().toISOString().split('T')[0],
      location: formData.location,
      portOfEntry: formData.portOfEntry,
      cameraId: `CAM-CUS-${Math.floor(Math.random() * 50) + 1}`,
      detectedBy: 'Manual Entry',
      confidence: 100,
      imageUrl: randomImage.url,
      evidence: [],
      reportedBy: formData.reportedBy || undefined,
      assignedOfficer: formData.assignedOfficer || undefined,
      containerNumber: formData.containerNumber || undefined,
      vehiclePlate: formData.vehiclePlate || undefined,
      declarationNumber: formData.declarationNumber || undefined,
      commodity: formData.commodity || undefined,
      declaredValue: formData.declaredValue ? parseInt(formData.declaredValue) : undefined,
      declaredCurrency: 'PKR',
      countryOfOrigin: formData.countryOfOrigin || undefined,
      countryOfDestination: formData.countryOfDestination || undefined,
      aiMetadata: {
        detectionModel: 'Manual Report',
        detectionConfidence: 100,
        aiRulesTriggered: []
      },
      createdAt: Date.now()
    }
    
    setIncidents([newIncident, ...incidents])
    setFormData({
      incidentType: "smuggling-attempt",
      severity: "medium",
      title: "",
      description: "",
      location: "Karachi Port - Terminal 1",
      portOfEntry: "Karachi Sea Port",
      reportedBy: "",
      assignedOfficer: "",
      containerNumber: "",
      vehiclePlate: "",
      declarationNumber: "",
      commodity: "",
      declaredValue: "",
      countryOfOrigin: "",
      countryOfDestination: ""
    })
    setShowModal(false)
  }

  const updateIncidentStatus = (id: string, status: string) => {
    setIncidents(incidents.map(incident => 
      incident.id === id ? { 
        ...incident, 
        status: status as any,
        resolvedAt: status === 'released' || status === 'seized' ? new Date().toISOString() : incident.resolvedAt,
        resolution: status === 'released' ? 'Goods cleared after inspection' : 
                   status === 'seized' ? 'Goods seized under Customs Act Section 156' : incident.resolution
      } : incident
    ))
  }

  const getIncidentTypeIcon = (typeId: string) => {
    const type = INCIDENT_TYPES.find(t => t.id === typeId)
    if (!type) return <AlertTriangle className="w-4 h-4" />
    
    const Icon = type.icon
    return <Icon className="w-4 h-4" />
  }

  const getIncidentTypeName = (typeId: string) => {
    const type = INCIDENT_TYPES.find(t => t.id === typeId)
    return type ? type.name : typeId
  }

  const getSeverityBadge = (severity: string) => {
    switch(severity) {
      case 'critical':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Critical</Badge>
      case 'high':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">High</Badge>
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Medium</Badge>
      case 'low':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Low</Badge>
      case 'informational':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Info</Badge>
      default:
        return <Badge>{severity}</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'active':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Active</Badge>
      case 'investigating':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Under Investigation</Badge>
      case 'inspection':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Inspection Scheduled</Badge>
      case 'detained':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Goods Detained</Badge>
      case 'seized':
        return <Badge className="bg-red-100 text-red-800 border-red-200 font-bold">GOODS SEIZED</Badge>
      case 'released':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Released</Badge>
      case 'false-alarm':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">False Alarm</Badge>
      case 'referred':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Referred to Investigation</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getEvidenceTypeIcon = (typeId: string) => {
    const type = EVIDENCE_TYPES.find(t => t.id === typeId)
    if (!type) return <FileText className="w-4 h-4" />
    
    const Icon = type.icon
    return <Icon className="w-4 h-4" />
  }

  const getEvidenceTypeName = (typeId: string) => {
    const type = EVIDENCE_TYPES.find(t => t.id === typeId)
    return type ? type.name : typeId
  }

  const getStats = () => {
    const active = incidents.filter(i => i.status === 'active').length
    const investigating = incidents.filter(i => i.status === 'investigating').length
    const detained = incidents.filter(i => i.status === 'detained' || i.status === 'seized').length
    const released = incidents.filter(i => i.status === 'released').length
    const critical = incidents.filter(i => i.severity === 'critical').length
    const high = incidents.filter(i => i.severity === 'high').length
    const smuggling = incidents.filter(i => i.incidentType.includes('smuggling')).length
    const undervalued = incidents.filter(i => i.incidentType.includes('undervalued') || i.incidentType.includes('under')).length
    
    const totalValue = incidents.reduce((acc, i) => acc + (i.estimatedValue || 0), 0)
    const seizedValue = incidents.filter(i => i.status === 'seized').reduce((acc, i) => acc + (i.estimatedValue || 0), 0)
    
    const byPort = PORTS_OF_ENTRY.map(port => ({
      port,
      count: incidents.filter(i => i.portOfEntry === port).length
    })).sort((a, b) => b.count - a.count).slice(0, 5)
    
    return { 
      active, investigating, detained, released, critical, high, 
      smuggling, undervalued, totalValue, seizedValue, byPort 
    }
  }

  const stats = getStats()

  return (
    <ModulePageLayout
      title="Pakistan Customs - AI Incident Management"
      description="AI-powered customs incident detection and evidence management system"
      breadcrumbs={[{ label: "Pakistan Customs" }, { label: "AI Incident Management" }]}
    >
      <div className="space-y-6">
        {/* Pakistan Customs Header */}
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-green-700" />
                <div>
                  <h2 className="text-lg font-bold text-green-800">Pakistan Customs Service</h2>
                  <p className="text-sm text-green-600">AI-Powered Incident Detection System • Real-time Monitoring</p>
                </div>
              </div>
              <Badge className="bg-green-600 text-white px-3 py-1">Live • {new Date().toLocaleDateString()}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards - Customized for Customs */}
        <div className="grid gap-4 md:grid-cols-6">
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Incidents</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.active}</div>
              <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Under Investigation</CardTitle>
              <Activity className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.investigating}</div>
              <p className="text-xs text-muted-foreground mt-1">In progress</p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-orange-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Detained/Seized</CardTitle>
              <Package className="h-4 w-4 text-orange-700" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">{stats.detained}</div>
              <p className="text-xs text-muted-foreground mt-1">Goods detained</p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Released</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.released}</div>
              <p className="text-xs text-muted-foreground mt-1">Cleared shipments</p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-red-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Seized Value</CardTitle>
              <DollarSign className="h-4 w-4 text-red-700" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">PKR {(stats.seizedValue / 1000000).toFixed(1)}M</div>
              <p className="text-xs text-muted-foreground mt-1">Estimated value</p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Smuggling Cases</CardTitle>
              <Truck className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.smuggling}</div>
              <p className="text-xs text-muted-foreground mt-1">Anti-smuggling alerts</p>
            </CardContent>
          </Card>
        </div>

        {/* Top Ports Stats */}
        <div className="grid grid-cols-5 gap-2">
          {stats.byPort.map(port => (
            <div key={port.port} className="bg-white p-2 rounded-lg border border-gray-200">
              <div className="text-xs font-medium text-gray-600 truncate">{port.port}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-lg font-bold">{port.count}</span>
                <span className="text-xs text-gray-500">incidents</span>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Filter Tabs */}
        <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="all">All Incidents</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="detained">Detained/Seized</TabsTrigger>
            <TabsTrigger value="scanner">Scanner Alerts</TabsTrigger>
            <TabsTrigger value="smuggling">Smuggling</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Customs Incident Monitoring</CardTitle>
            <CardDescription>AI-detected customs incidents and evidence tracking across all ports of entry</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search container #, declaration #, vehicle..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <select 
                className="px-3 py-2 border border-gray-300 rounded-lg min-w-[180px] bg-white"
                value={selectedIncidentType}
                onChange={(e) => setSelectedIncidentType(e.target.value)}
              >
                <option value="all">All Incident Types</option>
                {INCIDENT_TYPES.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>

              <select 
                className="px-3 py-2 border border-gray-300 rounded-lg min-w-[150px] bg-white"
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
              >
                <option value="all">All Severities</option>
                {SEVERITY_LEVELS.map(sev => (
                  <option key={sev.id} value={sev.id}>{sev.name}</option>
                ))}
              </select>

              <select 
                className="px-3 py-2 border border-gray-300 rounded-lg min-w-[170px] bg-white"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                {STATUS_TYPES.map(status => (
                  <option key={status.id} value={status.id}>{status.name}</option>
                ))}
              </select>

              <select 
                className="px-3 py-2 border border-gray-300 rounded-lg min-w-[180px] bg-white"
                value={selectedPort}
                onChange={(e) => setSelectedPort(e.target.value)}
              >
                <option value="all">All Ports of Entry</option>
                {PORTS_OF_ENTRY.map(port => (
                  <option key={port} value={port}>{port}</option>
                ))}
              </select>

              <select 
                className="px-3 py-2 border border-gray-300 rounded-lg min-w-[150px] bg-white"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
              >
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>

              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
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
                className="bg-green-700 hover:bg-green-800 text-white ml-auto"
                onClick={() => setShowModal(true)}
              >
                <Plus className="h-4 w-4 mr-2" /> Report Incident
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Incidents Display */}
        {viewMode === 'table' ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Incident</TableHead>
                    <TableHead>Type/Severity</TableHead>
                    <TableHead>Location & Port</TableHead>
                    <TableHead>Container/Declaration</TableHead>
                    <TableHead>AI Detection</TableHead>
                    <TableHead>Evidence</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncidents.map((incident) => (
                    <TableRow 
                      key={incident.id} 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedIncident(incident)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-10 rounded overflow-hidden bg-gray-100">
                            <img src={incident.imageUrl} alt="Incident" className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{incident.title}</div>
                            <div className="text-xs text-gray-500 truncate max-w-[200px]">{incident.description}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 mb-1">
                          {getIncidentTypeIcon(incident.incidentType)}
                          <span className="text-xs">{getIncidentTypeName(incident.incidentType)}</span>
                        </div>
                        {getSeverityBadge(incident.severity)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{incident.location}</div>
                        <div className="text-xs text-gray-500">{incident.portOfEntry}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          {incident.date} {incident.timestamp}
                        </div>
                      </TableCell>
                      <TableCell>
                        {incident.containerNumber && (
                          <div className="text-xs font-mono font-bold">{incident.containerNumber}</div>
                        )}
                        {incident.declarationNumber && (
                          <div className="text-xs text-gray-600">{incident.declarationNumber}</div>
                        )}
                        {incident.commodity && (
                          <div className="text-xs text-gray-500">{incident.commodity}</div>
                        )}
                        {incident.estimatedValue && (
                          <div className="text-xs text-green-600 font-medium mt-1">
                            PKR {incident.estimatedValue.toLocaleString()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium">Confidence: {incident.confidence}%</div>
                        <div className="text-xs text-gray-500">by {incident.detectedBy}</div>
                        {incident.aiMetadata?.scannerType && (
                          <div className="text-xs text-blue-600">{incident.aiMetadata.scannerType}</div>
                        )}
                        {incident.aiMetadata?.thermalData && (
                          <div className="text-xs text-orange-600 mt-1">
                            🔥 {incident.aiMetadata.thermalData.temperature.toFixed(1)}°C
                          </div>
                        )}
                        {incident.aiMetadata?.narcoticsDetected && (
                          <div className="text-xs text-red-600 font-bold mt-1">
                            ⚠ NARCOTICS ALERT
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex -space-x-1">
                          {incident.evidence.slice(0, 3).map((ev, idx) => (
                            <div 
                              key={ev.id} 
                              className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center"
                              title={`${getEvidenceTypeName(ev.type)} - ${ev.name}`}
                            >
                              {getEvidenceTypeIcon(ev.type)}
                            </div>
                          ))}
                          {incident.evidence.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs">
                              +{incident.evidence.length - 3}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{incident.evidence.length} items</div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(incident.status)}
                        {incident.assignedOfficer && (
                          <div className="text-xs text-gray-500 mt-1">Officer: {incident.assignedOfficer}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="text-blue-600">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <select 
                            className="text-xs border rounded p-1"
                            value={incident.status}
                            onChange={(e) => {
                              e.stopPropagation()
                              updateIncidentStatus(incident.id, e.target.value)
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {STATUS_TYPES.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIncidents.map((incident) => (
              <Card 
                key={incident.id} 
                className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow border-l-4"
                style={{
                  borderLeftColor: 
                    incident.severity === 'critical' ? '#dc2626' :
                    incident.severity === 'high' ? '#f97316' :
                    incident.severity === 'medium' ? '#eab308' :
                    incident.severity === 'low' ? '#3b82f6' : '#10b981'
                }}
                onClick={() => setSelectedIncident(incident)}
              >
                <div className="relative h-40 bg-gray-100 group">
                  <img src={incident.imageUrl} alt="Incident" className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 flex gap-1">
                    {getSeverityBadge(incident.severity)}
                  </div>
                  <div className="absolute top-2 left-2">
                    {getStatusBadge(incident.status)}
                  </div>
                  <button 
                    className="absolute bottom-2 right-2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedImage(incident.imageUrl)
                      setShowImageModal(true)
                    }}
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                    {incident.confidence}% AI confidence
                  </div>
                </div>
                
                <CardContent className="p-3">
                  <h3 className="font-semibold text-sm mb-1">{incident.title}</h3>
                  <p className="text-xs text-gray-500 mb-2 line-clamp-2">{incident.description}</p>
                  
                  <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                    {getIncidentTypeIcon(incident.incidentType)}
                    <span className="mr-2">{getIncidentTypeName(incident.incidentType)}</span>
                    <MapPin className="w-3 h-3 ml-1" />
                    <span className="truncate">{incident.location}</span>
                  </div>
                  
                  {incident.containerNumber && (
                    <div className="flex items-center gap-1 text-xs font-mono bg-gray-100 p-1 rounded mb-1">
                      <Package className="w-3 h-3" />
                      <span>{incident.containerNumber}</span>
                    </div>
                  )}
                  
                  {incident.estimatedValue && (
                    <div className="flex items-center gap-1 text-xs text-green-700 mb-2">
                      <DollarSign className="w-3 h-3" />
                      <span className="font-medium">PKR {incident.estimatedValue.toLocaleString()}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-1">
                      {incident.evidence.slice(0, 4).map((ev, idx) => (
                        <div 
                          key={ev.id} 
                          className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center"
                          title={getEvidenceTypeName(ev.type)}
                        >
                          {getEvidenceTypeIcon(ev.type)}
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">{incident.evidence.length} evidence</span>
                  </div>
                  
                  {incident.aiMetadata?.narcoticsDetected && (
                    <div className="mt-2 text-xs bg-red-50 text-red-700 p-1 rounded flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Narcotics Detected
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Evidence Types Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Customs Evidence Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
              {EVIDENCE_TYPES.slice(0, 8).map(type => {
                const count = incidents.reduce((acc, inc) => 
                  acc + inc.evidence.filter(e => e.type === type.id).length, 0
                )
                const Icon = type.icon
                return (
                  <div key={type.id} className="text-center">
                    <div className={`w-10 h-10 mx-auto rounded-full bg-${type.color}-100 flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 text-${type.color}-600`} />
                    </div>
                    <div className="text-sm font-bold mt-1">{count}</div>
                    <div className="text-xs text-gray-500">{type.name}</div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Incident Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              onClick={() => setShowModal(false)}
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-semibold mb-4">Report Customs Incident</h2>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Incident Type</label>
                  <select
                    name="incidentType"
                    value={formData.incidentType}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    {INCIDENT_TYPES.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Severity</label>
                  <select
                    name="severity"
                    value={formData.severity}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    {SEVERITY_LEVELS.map(sev => (
                      <option key={sev.id} value={sev.id}>{sev.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Title</label>
                <Input
                  placeholder="Incident title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <textarea
                  placeholder="Describe the incident"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Location</label>
                  <select
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    {LOCATIONS.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Port of Entry</label>
                  <select
                    name="portOfEntry"
                    value={formData.portOfEntry}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    {PORTS_OF_ENTRY.map(port => (
                      <option key={port} value={port}>{port}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Container Number</label>
                  <Input
                    placeholder="e.g., PCS-1234567"
                    name="containerNumber"
                    value={formData.containerNumber}
                    onChange={handleInputChange}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Vehicle Plate</label>
                  <Input
                    placeholder="e.g., LEJ-1234"
                    name="vehiclePlate"
                    value={formData.vehiclePlate}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Declaration Number</label>
                  <Input
                    placeholder="DEC-123456"
                    name="declarationNumber"
                    value={formData.declarationNumber}
                    onChange={handleInputChange}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Commodity</label>
                  <select
                    name="commodity"
                    value={formData.commodity}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select Commodity</option>
                    {COMMODITY_TYPES.map(com => (
                      <option key={com} value={com}>{com}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Declared Value</label>
                  <Input
                    type="number"
                    placeholder="PKR"
                    name="declaredValue"
                    value={formData.declaredValue}
                    onChange={handleInputChange}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Country of Origin</label>
                  <select
                    name="countryOfOrigin"
                    value={formData.countryOfOrigin}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select Country</option>
                    {COUNTRIES.map(country => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Destination</label>
                  <select
                    name="countryOfDestination"
                    value={formData.countryOfDestination}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select Country</option>
                    {COUNTRIES.map(country => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Reported By</label>
                  <Input
                    placeholder="Officer name"
                    name="reportedBy"
                    value={formData.reportedBy}
                    onChange={handleInputChange}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Assign Officer</label>
                  <select
                    name="assignedOfficer"
                    value={formData.assignedOfficer}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select Officer</option>
                    {CUSTOMS_OFFICERS.map(officer => (
                      <option key={officer} value={officer}>{officer}</option>
                    ))}
                  </select>
                </div>
              </div>

              <Button type="submit" className="bg-green-700 hover:bg-green-800 text-white w-full">
                Report Incident
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Incident Details Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              onClick={() => setSelectedIncident(null)}
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-semibold mb-4">Customs Incident Details</h2>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="relative group">
                  <img src={selectedIncident.imageUrl} alt="Incident" className="w-full h-48 object-cover rounded-lg" />
                  <button 
                    className="absolute top-2 right-2 bg-blue-600 text-white p-2 rounded-full"
                    onClick={() => {
                      setSelectedImage(selectedIncident.imageUrl)
                      setShowImageModal(true)
                    }}
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Status</h3>
                    <select 
                      className="text-sm border rounded p-1"
                      value={selectedIncident.status}
                      onChange={(e) => {
                        updateIncidentStatus(selectedIncident.id, e.target.value)
                        setSelectedIncident({...selectedIncident, status: e.target.value as any})
                      }}
                    >
                      {STATUS_TYPES.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <h3 className="font-medium text-sm mb-2">AI Detection Info</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Detected By:</span>
                        <span>{selectedIncident.detectedBy}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Confidence:</span>
                        <span className="font-medium text-green-600">{selectedIncident.confidence}%</span>
                      </div>
                      {selectedIncident.aiMetadata?.scannerType && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Scanner:</span>
                          <span>{selectedIncident.aiMetadata.scannerType}</span>
                        </div>
                      )}
                      {selectedIncident.aiMetadata?.anomalyType && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Anomaly:</span>
                          <span>{selectedIncident.aiMetadata.anomalyType}</span>
                        </div>
                      )}
                      {selectedIncident.aiMetadata?.narcoticsDetected && (
                        <div className="flex justify-between text-red-600 font-bold">
                          <span>Narcotics Alert:</span>
                          <span>{selectedIncident.aiMetadata.narcoticsType}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {selectedIncident.aiMetadata?.thermalData && (
                    <div className="bg-orange-50 p-3 rounded-lg">
                      <h3 className="font-medium text-sm mb-2 flex items-center gap-1">
                        <Thermometer className="w-4 h-4" /> Thermal Data
                      </h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Temperature:</span>
                          <span className="font-medium">{selectedIncident.aiMetadata.thermalData.temperature.toFixed(1)}°C</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Threshold:</span>
                          <span>{selectedIncident.aiMetadata.thermalData.threshold}°C</span>
                        </div>
                        {selectedIncident.aiMetadata.thermalData.hotspotLocation && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Hotspot:</span>
                            <span>{selectedIncident.aiMetadata.thermalData.hotspotLocation}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {selectedIncident.aiMetadata?.currencyDetected && (
                    <div className="bg-green-50 p-3 rounded-lg">
                      <h3 className="font-medium text-sm mb-2 flex items-center gap-1">
                        <DollarSign className="w-4 h-4" /> Currency Detection
                      </h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Amount:</span>
                          <span className="font-bold">{selectedIncident.aiMetadata.currencyDetected.currency} {selectedIncident.aiMetadata.currencyDetected.amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Hidden Location:</span>
                          <span>{selectedIncident.aiMetadata.currencyDetected.hiddenLocation}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-lg">{selectedIncident.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{selectedIncident.description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg">
                  <div>
                    <span className="text-xs text-gray-500">Incident Type</span>
                    <div className="flex items-center gap-1 mt-1">
                      {getIncidentTypeIcon(selectedIncident.incidentType)}
                      <span className="text-sm font-medium">{getIncidentTypeName(selectedIncident.incidentType)}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Severity</span>
                    <div className="mt-1">{getSeverityBadge(selectedIncident.severity)}</div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Date & Time</span>
                    <div className="text-sm mt-1">{selectedIncident.date} {selectedIncident.timestamp}</div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Port of Entry</span>
                    <div className="text-sm mt-1">{selectedIncident.portOfEntry}</div>
                  </div>
                </div>
                
                {/* Customs-specific details */}
                <div className="bg-blue-50 p-3 rounded-lg">
                  <h3 className="font-medium text-sm mb-2">Shipment Details</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {selectedIncident.containerNumber && (
                      <>
                        <span className="text-gray-500">Container:</span>
                        <span className="font-mono">{selectedIncident.containerNumber}</span>
                      </>
                    )}
                    {selectedIncident.declarationNumber && (
                      <>
                        <span className="text-gray-500">Declaration:</span>
                        <span className="font-mono">{selectedIncident.declarationNumber}</span>
                      </>
                    )}
                    {selectedIncident.sealNumber && (
                      <>
                        <span className="text-gray-500">Seal Number:</span>
                        <span>{selectedIncident.sealNumber}</span>
                      </>
                    )}
                    {selectedIncident.commodity && (
                      <>
                        <span className="text-gray-500">Commodity:</span>
                        <span>{selectedIncident.commodity}</span>
                      </>
                    )}
                    {selectedIncident.countryOfOrigin && (
                      <>
                        <span className="text-gray-500">Origin:</span>
                        <span>{selectedIncident.countryOfOrigin}</span>
                      </>
                    )}
                    {selectedIncident.countryOfDestination && (
                      <>
                        <span className="text-gray-500">Destination:</span>
                        <span>{selectedIncident.countryOfDestination}</span>
                      </>
                    )}
                    {selectedIncident.estimatedValue && (
                      <>
                        <span className="text-gray-500">Est. Value:</span>
                        <span className="font-bold text-green-700">PKR {selectedIncident.estimatedValue.toLocaleString()}</span>
                      </>
                    )}
                    {selectedIncident.declaredValue && (
                      <>
                        <span className="text-gray-500">Declared:</span>
                        <span className={selectedIncident.estimatedValue && selectedIncident.declaredValue < selectedIncident.estimatedValue ? 'text-red-600' : 'text-green-600'}>
                          PKR {selectedIncident.declaredValue.toLocaleString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium mb-2">Evidence ({selectedIncident.evidence.length})</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedIncident.evidence.map(ev => (
                      <div 
                        key={ev.id} 
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          setSelectedEvidence(ev)
                          setShowEvidenceModal(true)
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center">
                            {getEvidenceTypeIcon(ev.type)}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{ev.name}</div>
                            <div className="text-xs text-gray-500">{ev.size} • {ev.referenceId}</div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                
                {selectedIncident.actionsTaken && (
                  <div>
                    <h3 className="font-medium mb-2">Actions Taken</h3>
                    <ul className="list-disc list-inside text-sm space-y-1 bg-gray-50 p-2 rounded-lg">
                      {selectedIncident.actionsTaken.map((action, idx) => (
                        <li key={idx}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {selectedIncident.resolution && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <h3 className="font-medium text-sm mb-1">Resolution</h3>
                    <p className="text-sm">{selectedIncident.resolution}</p>
                    <p className="text-xs text-gray-500 mt-1">Resolved: {selectedIncident.resolvedAt}</p>
                  </div>
                )}
                
                {selectedIncident.assignedOfficer && (
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <h3 className="font-medium text-sm mb-1">Assigned Officer</h3>
                    <p className="text-sm">{selectedIncident.assignedOfficer}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evidence View Modal */}
      {showEvidenceModal && selectedEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              onClick={() => setShowEvidenceModal(false)}
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-semibold mb-4">Customs Evidence Details</h2>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded bg-blue-100 flex items-center justify-center">
                  {getEvidenceTypeIcon(selectedEvidence.type)}
                </div>
                <div>
                  <h3 className="font-medium">{selectedEvidence.name}</h3>
                  <p className="text-sm text-gray-500">{getEvidenceTypeName(selectedEvidence.type)}</p>
                </div>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Type:</span>
                  <span className="text-sm">{getEvidenceTypeName(selectedEvidence.type)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">File Number:</span>
                  <span className="text-sm font-mono">{selectedEvidence.fileNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Reference ID:</span>
                  <span className="text-sm">{selectedEvidence.referenceId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Timestamp:</span>
                  <span className="text-sm">{new Date(selectedEvidence.timestamp).toLocaleString()}</span>
                </div>
                {selectedEvidence.size && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Size:</span>
                    <span className="text-sm">{selectedEvidence.size}</span>
                  </div>
                )}
                {selectedEvidence.description && (
                  <div>
                    <span className="text-sm text-gray-500">Description:</span>
                    <p className="text-sm mt-1">{selectedEvidence.description}</p>
                  </div>
                )}
              </div>
              
              {selectedEvidence.metadata && Object.keys(selectedEvidence.metadata).length > 0 && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h3 className="font-medium text-sm mb-2">Evidence Metadata</h3>
                  <div className="space-y-1">
                    {Object.entries(selectedEvidence.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-500">{key}:</span>
                        <span className={typeof value === 'boolean' && value ? 'text-red-600 font-bold' : ''}>
                          {String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowEvidenceModal(false)}>
                  Close
                </Button>
                <Button className="bg-green-700 hover:bg-green-800 text-white">
                  <Download className="w-4 h-4 mr-2" /> Download
                </Button>
              </div>
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
            <img src={selectedImage} alt="Incident" className="max-w-full max-h-[90vh] object-contain" />
          </div>
        </div>
      )}
    </ModulePageLayout>
  )
}