"use client"

import { useState, useEffect } from "react"
import { 
  FileText, 
  Download, 
  Calendar, 
  Filter, 
  BarChart3, 
  PieChart, 
  LineChart,
  TrendingUp,
  Car,
  Users,
  Clock,
  MapPin,
  ChevronDown,
  Eye,
  Printer,
  Mail,
  FileSpreadsheet,
  FilePieChart,
  Grid3X3,
  LayoutGrid,
  Maximize2,
  X
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Mock data for gate throughput
const GATES = ["North Gate", "South Gate", "East Gate", "West Gate", "Main Entrance", "Service Gate", "Customs Gate"]
const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`)

interface GateHourlyData {
  gate: string
  hour: string
  vehicles: {
    cars: number
    trucks: number
    buses: number
    motorcycles: number
    total: number
  }
  persons: {
    drivers: number
    passengers: number
    pedestrians: number
    total: number
  }
  occupancy: {
    avgOccupancy: number
    peakOccupancy: number
  }
  timestamp: string
}

interface ReportTemplate {
  id: string
  name: string
  category: string
  lastRun: string
  schedule: string
  format: 'PDF' | 'Excel' | 'CSV' | 'HTML'
  size: string
}

export default function ReportsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedGate, setSelectedGate] = useState("all")
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [showReportPreview, setShowReportPreview] = useState(false)
  const [selectedReport, setSelectedReport] = useState<ReportTemplate | null>(null)
  const [gateData, setGateData] = useState<GateHourlyData[]>([])
  const [selectedHour, setSelectedHour] = useState<string>("all")

  // Generate mock gate throughput data
  useEffect(() => {
    const mockData: GateHourlyData[] = []
    
    GATES.forEach(gate => {
      HOURS.forEach(hour => {
        // Skip some hours for realism
        if (Math.random() > 0.3) {
          const cars = Math.floor(Math.random() * 80) + 20
          const trucks = Math.floor(Math.random() * 30) + 5
          const buses = Math.floor(Math.random() * 15) + 2
          const motorcycles = Math.floor(Math.random() * 25) + 5
          
          const vehicles = cars + trucks + buses + motorcycles
          const avgOccupancy = gate.includes('Gate') ? 2.3 : 1.8
          
          mockData.push({
            gate,
            hour,
            vehicles: {
              cars,
              trucks,
              buses,
              motorcycles,
              total: vehicles
            },
            persons: {
              drivers: vehicles,
              passengers: Math.floor(vehicles * (avgOccupancy - 1)),
              pedestrians: Math.floor(Math.random() * 50) + 10,
              total: Math.floor(vehicles * avgOccupancy) + Math.floor(Math.random() * 50) + 10
            },
            occupancy: {
              avgOccupancy,
              peakOccupancy: avgOccupancy + 0.7
            },
            timestamp: `${selectedDate} ${hour}`
          })
        }
      })
    })
    
    setGateData(mockData)
  }, [selectedDate])

  // Filter gate data
  const filteredGateData = gateData.filter(data => {
    if (selectedGate !== 'all' && data.gate !== selectedGate) return false
    if (selectedHour !== 'all' && data.hour !== selectedHour) return false
    return true
  })

  // Calculate totals
  const totalVehicles = filteredGateData.reduce((sum, data) => sum + data.vehicles.total, 0)
  const totalPersons = filteredGateData.reduce((sum, data) => sum + data.persons.total, 0)
  const avgOccupancy = filteredGateData.length > 0 
    ? (filteredGateData.reduce((sum, data) => sum + data.occupancy.avgOccupancy, 0) / filteredGateData.length).toFixed(1)
    : 0

  const reportTemplates: ReportTemplate[] = [
    { id: "1", name: "Gate Throughput Report (Hourly)", category: "Gate Analytics", lastRun: "Today, 06:00", schedule: "Hourly", format: "Excel", size: "2.4 MB" },
    { id: "2", name: "Visitor Summary (Daily)", category: "VMS", lastRun: "Today, 00:00", schedule: "Daily", format: "PDF", size: "1.8 MB" },
    { id: "3", name: "Vehicle Count by Gate", category: "Gate Analytics", lastRun: "Yesterday", schedule: "Daily", format: "Excel", size: "3.1 MB" },
    { id: "4", name: "Peak Hours Analysis", category: "Gate Analytics", lastRun: "Mon, 08:00", schedule: "Weekly", format: "PDF", size: "4.2 MB" },
    { id: "5", name: "Customs Clearance Summary", category: "Customs", lastRun: "Yesterday", schedule: "On-demand", format: "CSV", size: "0.9 MB" },
    { id: "6", name: "Person Flow Analysis", category: "Gate Analytics", lastRun: "Today, 06:00", schedule: "Hourly", format: "HTML", size: "5.3 MB" },
    { id: "7", name: "Gate Occupancy Report", category: "Gate Analytics", lastRun: "Yesterday", schedule: "Daily", format: "Excel", size: "2.7 MB" },
    { id: "8", name: "Inventory Valuation", category: "WMS", lastRun: "Yesterday", schedule: "Weekly", format: "PDF", size: "3.5 MB" },
  ]

  const filteredReports = reportTemplates.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.category.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || report.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const categories = Array.from(new Set(reportTemplates.map(r => r.category)))

  const getFormatBadge = (format: string) => {
    const colors = {
      PDF: "bg-red-100 text-red-800 border-red-200",
      Excel: "bg-green-100 text-green-800 border-green-200",
      CSV: "bg-blue-100 text-blue-800 border-blue-200",
      HTML: "bg-purple-100 text-purple-800 border-purple-200"
    }
    return <Badge className={colors[format as keyof typeof colors]}>{format}</Badge>
  }

  return (
    <ModulePageLayout
      title="Reports & Analysis"
      description="Generate, schedule, and download comprehensive reports across all modules with real-time gate throughput analysis"
      breadcrumbs={[{ label: "AI Analytics" }, { label: "Reports & Analysis" }]}
    >
      <div className="space-y-6">
        {/* Main Tabs */}
        <Tabs defaultValue="gate-throughput" className="w-full">
          <TabsList className="grid w-full grid-cols-1 bg-muted/50 p-1 sm:max-w-2xl sm:grid-cols-2">
            <TabsTrigger value="gate-throughput" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Gate Throughput Report
            </TabsTrigger>
            <TabsTrigger value="report-library" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Report Library
            </TabsTrigger>
          </TabsList>

          {/* Gate Throughput Report Tab */}
          <TabsContent value="gate-throughput" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Car className="h-5 w-5 text-blue-600" />
                      Gate Throughput Analysis
                    </CardTitle>
                    <CardDescription>
                      Real-time vehicle and person counts per gate per hour with occupancy tracking
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Printer className="h-4 w-4 mr-2" />
                      Print
                    </Button>
                    <Button variant="outline" size="sm">
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Excel (.xlsx)
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <FileText className="h-4 w-4 mr-2" />
                          PDF Document
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <FilePieChart className="h-4 w-4 mr-2" />
                          CSV Format
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Filters */}
                <div className="flex flex-wrap gap-4 bg-muted/30 p-4 rounded-lg">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs text-muted-foreground">Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div className="min-w-[180px]">
                    <Label className="text-xs text-muted-foreground">Gate</Label>
                    <Select value={selectedGate} onValueChange={setSelectedGate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gate" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Gates</SelectItem>
                        {GATES.map(gate => (
                          <SelectItem key={gate} value={gate}>{gate}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="min-w-[150px]">
                    <Label className="text-xs text-muted-foreground">Hour</Label>
                    <Select value={selectedHour} onValueChange={setSelectedHour}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select hour" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        <SelectItem value="all">All Hours</SelectItem>
                        {HOURS.map(hour => (
                          <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end gap-2">
                    <Button variant="outline" size="sm" className="h-10">
                      <Filter className="h-4 w-4 mr-2" />
                      Apply Filters
                    </Button>
                    <div className="flex border rounded-lg overflow-hidden h-10">
                      <button
                        className={`px-3 py-2 ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
                        onClick={() => setViewMode('table')}
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </button>
                      <button
                        className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
                        onClick={() => setViewMode('grid')}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-600">Total Vehicles</p>
                          <p className="text-3xl font-bold text-blue-700">{totalVehicles.toLocaleString()}</p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <Car className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                      <p className="text-xs text-blue-600 mt-2">Across all gates and hours</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-600">Total Persons</p>
                          <p className="text-3xl font-bold text-green-700">{totalPersons.toLocaleString()}</p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                          <Users className="h-6 w-6 text-green-600" />
                        </div>
                      </div>
                      <p className="text-xs text-green-600 mt-2">Including pedestrians</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-purple-600">Avg Occupancy</p>
                          <p className="text-3xl font-bold text-purple-700">{avgOccupancy}</p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                          <Users className="h-6 w-6 text-purple-600" />
                        </div>
                      </div>
                      <p className="text-xs text-purple-600 mt-2">Persons per vehicle</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-amber-600">Peak Hour</p>
                          <p className="text-3xl font-bold text-amber-700">08:00</p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                          <Clock className="h-6 w-6 text-amber-600" />
                        </div>
                      </div>
                      <p className="text-xs text-amber-600 mt-2">1,247 vehicles</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Gate Throughput Table/Grid */}
                {viewMode === 'table' ? (
                  <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                    <Table className="min-w-[1200px]">
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Gate</TableHead>
                          <TableHead>Hour</TableHead>
                          <TableHead colSpan={4} className="text-center border-x">Vehicle Count</TableHead>
                          <TableHead colSpan={3} className="text-center border-x">Person Count</TableHead>
                          <TableHead>Occupancy</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                        <TableRow className="bg-muted/30">
                          <TableHead></TableHead>
                          <TableHead></TableHead>
                          <TableHead className="text-xs font-normal">Cars</TableHead>
                          <TableHead className="text-xs font-normal">Trucks</TableHead>
                          <TableHead className="text-xs font-normal">Buses</TableHead>
                          <TableHead className="text-xs font-normal border-r">Mcycles</TableHead>
                          <TableHead className="text-xs font-normal">Drivers</TableHead>
                          <TableHead className="text-xs font-normal">Pass.</TableHead>
                          <TableHead className="text-xs font-normal border-r">Peds</TableHead>
                          <TableHead className="text-xs font-normal">Avg/Peak</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredGateData.slice(0, 20).map((data, index) => (
                          <TableRow key={index} className="hover:bg-muted/30">
                            <TableCell className="font-medium">{data.gate}</TableCell>
                            <TableCell>{data.hour}</TableCell>
                            <TableCell>{data.vehicles.cars}</TableCell>
                            <TableCell>{data.vehicles.trucks}</TableCell>
                            <TableCell>{data.vehicles.buses}</TableCell>
                            <TableCell className="border-r">{data.vehicles.motorcycles}</TableCell>
                            <TableCell>{data.persons.drivers}</TableCell>
                            <TableCell>{data.persons.passengers}</TableCell>
                            <TableCell className="border-r">{data.persons.pedestrians}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <span className="text-sm">{data.occupancy.avgOccupancy.toFixed(1)}</span>
                                <span className="text-xs text-muted-foreground">/</span>
                                <span className="text-xs text-amber-600">{data.occupancy.peakOccupancy.toFixed(1)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filteredGateData.length > 20 && (
                      <div className="p-4 text-center text-sm text-muted-foreground border-t">
                        Showing 20 of {filteredGateData.length} records
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredGateData.slice(0, 12).map((data, index) => (
                      <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow">
                        <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-blue-600" />
                              {data.gate}
                            </CardTitle>
                            <Badge variant="outline">{data.hour}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                <Car className="h-3 w-3" /> Vehicles
                              </p>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Cars:</span>
                                  <span className="font-medium">{data.vehicles.cars}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Trucks:</span>
                                  <span className="font-medium">{data.vehicles.trucks}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Buses:</span>
                                  <span className="font-medium">{data.vehicles.buses}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Mcycles:</span>
                                  <span className="font-medium">{data.vehicles.motorcycles}</span>
                                </div>
                                <Separator className="my-1" />
                                <div className="flex justify-between font-semibold">
                                  <span>Total:</span>
                                  <span className="text-blue-600">{data.vehicles.total}</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                <Users className="h-3 w-3" /> Persons
                              </p>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Drivers:</span>
                                  <span className="font-medium">{data.persons.drivers}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Pass.:</span>
                                  <span className="font-medium">{data.persons.passengers}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Peds:</span>
                                  <span className="font-medium">{data.persons.pedestrians}</span>
                                </div>
                                <Separator className="my-1" />
                                <div className="flex justify-between font-semibold">
                                  <span>Total:</span>
                                  <span className="text-green-600">{data.persons.total}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t flex justify-between items-center">
                            <div className="text-xs">
                              <span className="text-muted-foreground">Occupancy: </span>
                              <span className="font-medium">{data.occupancy.avgOccupancy.toFixed(1)}</span>
                              <span className="text-muted-foreground"> avg</span>
                            </div>
                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                              <Maximize2 className="h-3 w-3 mr-1" /> Details
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Charts Section */}
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Vehicles by Gate</CardTitle>
                      <CardDescription>Distribution across gates</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 rounded-lg border bg-gradient-to-b from-muted/20 to-muted/40 flex flex-col items-center justify-center">
                        <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-2" />
                        <span className="text-sm text-muted-foreground">Bar chart showing vehicle distribution by gate</span>
                        <div className="flex gap-4 mt-4">
                          {GATES.slice(0, 4).map(gate => (
                            <div key={gate} className="text-center">
                              <div className="text-xs text-muted-foreground">{gate.split(' ')[0]}</div>
                              <div className="text-sm font-semibold">{Math.floor(Math.random() * 500) + 200}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Hourly Throughput Pattern</CardTitle>
                      <CardDescription>Peak hours analysis</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 rounded-lg border bg-gradient-to-b from-muted/20 to-muted/40 flex flex-col items-center justify-center">
                        <LineChart className="h-12 w-12 text-muted-foreground/50 mb-2" />
                        <span className="text-sm text-muted-foreground">Line chart showing hourly trends</span>
                        <div className="flex gap-2 mt-4">
                          {['06:00', '08:00', '12:00', '17:00', '20:00'].map(time => (
                            <Badge key={time} variant={time === '08:00' ? 'default' : 'outline'}>
                              {time}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
              <CardFooter className="border-t bg-muted/10 px-6 py-3">
                  <div className="flex w-full flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Last updated: {new Date().toLocaleTimeString()}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setShowReportPreview(true)}>
                    <Eye className="h-4 w-4 mr-2" /> Preview Full Report
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Report Library Tab */}
          <TabsContent value="report-library" className="mt-6">
            <Card>
              <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <CardTitle>Report Library</CardTitle>
                  <CardDescription>Pre-built and scheduled reports with export options</CardDescription>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                  <div className="relative">
                    <Input
                      placeholder="Search reports..."
                      className="w-full pl-8 sm:w-64"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <FileText className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                  <Button className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto">
                    <FileText className="h-4 w-4 mr-2" />
                    New Report
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="w-full min-w-0">
                <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Last Run</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report) => (
                      <TableRow key={report.id} className="cursor-pointer hover:bg-muted/30" onClick={() => {
                        setSelectedReport(report)
                        setShowReportPreview(true)
                      }}>
                        <TableCell className="font-medium">{report.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{report.category}</Badge>
                        </TableCell>
                        <TableCell>{getFormatBadge(report.format)}</TableCell>
                        <TableCell className="text-muted-foreground">{report.lastRun}</TableCell>
                        <TableCell>{report.schedule}</TableCell>
                        <TableCell>{report.size}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="text-blue-600">
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>Download as PDF</DropdownMenuItem>
                              <DropdownMenuItem>Download as Excel</DropdownMenuItem>
                              <DropdownMenuItem>Download as CSV</DropdownMenuItem>
                              <DropdownMenuItem>Email Report</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Report Preview Dialog */}
      <Dialog open={showReportPreview} onOpenChange={setShowReportPreview}>
        <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              {selectedReport ? selectedReport.name : "Gate Throughput Report"}
            </DialogTitle>
            <DialogDescription>
              {selectedReport ? `Generated: ${selectedReport.lastRun} • Format: ${selectedReport.format}` : "Vehicles and persons per gate per hour analysis"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Report Header */}
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Gate Throughput Analysis</h3>
                <p className="text-sm text-muted-foreground">Date: {selectedDate}</p>
              </div>
              <Badge className="bg-blue-100 text-blue-800">Live Data</Badge>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm text-blue-600">Total Vehicles</div>
                <div className="text-2xl font-bold text-blue-700">{totalVehicles.toLocaleString()}</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-sm text-green-600">Total Persons</div>
                <div className="text-2xl font-bold text-green-700">{totalPersons.toLocaleString()}</div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="text-sm text-purple-600">Active Gates</div>
                <div className="text-2xl font-bold text-purple-700">{GATES.length}</div>
              </div>
            </div>

            {/* Preview Table */}
            <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
              <Table className="min-w-[760px]">
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Gate</TableHead>
                    <TableHead>Hour</TableHead>
                    <TableHead>Vehicles</TableHead>
                    <TableHead>Persons</TableHead>
                    <TableHead>Occupancy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGateData.slice(0, 10).map((data, index) => (
                    <TableRow key={index}>
                      <TableCell>{data.gate}</TableCell>
                      <TableCell>{data.hour}</TableCell>
                      <TableCell>{data.vehicles.total}</TableCell>
                      <TableCell>{data.persons.total}</TableCell>
                      <TableCell>{data.occupancy.avgOccupancy.toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredGateData.length > 10 && (
              <p className="text-sm text-muted-foreground text-center">
                Showing 10 of {filteredGateData.length} records
              </p>
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm">
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowReportPreview(false)}>
                Cancel
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}