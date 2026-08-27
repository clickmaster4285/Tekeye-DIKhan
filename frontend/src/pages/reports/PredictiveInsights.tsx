"use client"

import { useState, useEffect } from "react"
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  Lightbulb,
  Car,
  Users,
  Package,
  Clock,
  Calendar,
  BarChart3,
  LineChart,
  PieChart,
  Gauge,
  Shield,
  Zap,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
  Eye,
  Thermometer,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Target,
  TrendingDown
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Mock data for gate peak hours
const GATES = ["North Gate", "South Gate", "East Gate", "West Gate", "Main Entrance", "Customs Gate"]
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

interface GatePeakHour {
  gate: string
  day: string
  peakHour: string
  predictedVolume: number
  confidence: number
  trend: 'up' | 'down' | 'stable'
  comparisonToLastWeek: number
}

interface CargoQueuePrediction {
  date: string
  day: string
  predictedQueueLength: number
  maxCapacity: number
  utilization: number
  peakTime: string
  averageWaitTime: number
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical'
}

interface RiskScoreDistribution {
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low' | 'Minimal'
  predictedCount: number
  percentage: number
  changeFromLastWeek: number
  color: string
}

interface ModelDriftMetric {
  modelName: string
  accuracy: number
  baselineAccuracy: number
  driftPercentage: number
  falsePositiveRate: number
  falsePositiveTrend: 'up' | 'down' | 'stable'
  lastUpdated: string
  status: 'Healthy' | 'Warning' | 'Critical'
}

export default function PredictiveInsightsPage() {
  const [selectedGate, setSelectedGate] = useState<string>("all")
  const [selectedDay, setSelectedDay] = useState<string>("all")
  const [timeHorizon, setTimeHorizon] = useState<string>("7days")
  const [activeTab, setActiveTab] = useState("overview")
  const [refreshing, setRefreshing] = useState(false)

  // Mock data for gate peak hours
  const gatePeakHours: GatePeakHour[] = DAYS.flatMap(day =>
    GATES.map(gate => ({
      gate,
      day,
      peakHour: `${Math.floor(Math.random() * 4) + 7}:00 - ${Math.floor(Math.random() * 4) + 11}:00`,
      predictedVolume: Math.floor(Math.random() * 300) + 200,
      confidence: Math.floor(Math.random() * 15) + 80,
      trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as 'up' | 'down' | 'stable',
      comparisonToLastWeek: Math.floor(Math.random() * 20) - 5
    }))
  )

  // Mock data for cargo queue predictions
  const cargoQueuePredictions: CargoQueuePrediction[] = DAYS.map((day, index) => ({
    date: `2024-03-${15 + index}`,
    day,
    predictedQueueLength: Math.floor(Math.random() * 40) + 20,
    maxCapacity: 80,
    utilization: Math.floor(Math.random() * 60) + 30,
    peakTime: `${Math.floor(Math.random() * 4) + 9}:00`,
    averageWaitTime: Math.floor(Math.random() * 45) + 15,
    riskLevel: ['Low', 'Medium', 'High', 'Critical'][Math.floor(Math.random() * 4)] as any
  }))

  // Mock data for risk score distribution
  const riskDistribution: RiskScoreDistribution[] = [
    { riskLevel: 'Critical', predictedCount: 24, percentage: 3, changeFromLastWeek: 8, color: 'red' },
    { riskLevel: 'High', predictedCount: 86, percentage: 11, changeFromLastWeek: -2, color: 'orange' },
    { riskLevel: 'Medium', predictedCount: 215, percentage: 27, changeFromLastWeek: 5, color: 'yellow' },
    { riskLevel: 'Low', predictedCount: 312, percentage: 39, changeFromLastWeek: -3, color: 'blue' },
    { riskLevel: 'Minimal', predictedCount: 163, percentage: 20, changeFromLastWeek: -8, color: 'green' }
  ]

  // Mock data for model drift
  const modelDriftMetrics: ModelDriftMetric[] = [
    { 
      modelName: 'License Plate Recognition', 
      accuracy: 94.2, 
      baselineAccuracy: 96.8, 
      driftPercentage: -2.6,
      falsePositiveRate: 3.8,
      falsePositiveTrend: 'up',
      lastUpdated: '2 hours ago',
      status: 'Warning'
    },
    { 
      modelName: 'Face Detection', 
      accuracy: 97.5, 
      baselineAccuracy: 97.2, 
      driftPercentage: 0.3,
      falsePositiveRate: 2.1,
      falsePositiveTrend: 'down',
      lastUpdated: '2 hours ago',
      status: 'Healthy'
    },
    { 
      modelName: 'Object Classification', 
      accuracy: 95.8, 
      baselineAccuracy: 96.5, 
      driftPercentage: -0.7,
      falsePositiveRate: 3.2,
      falsePositiveTrend: 'stable',
      lastUpdated: '2 hours ago',
      status: 'Warning'
    },
    { 
      modelName: 'Thermal Detection', 
      accuracy: 91.3, 
      baselineAccuracy: 95.1, 
      driftPercentage: -3.8,
      falsePositiveRate: 6.7,
      falsePositiveTrend: 'up',
      lastUpdated: '2 hours ago',
      status: 'Critical'
    },
    { 
      modelName: 'Intrusion Detection', 
      accuracy: 98.1, 
      baselineAccuracy: 98.3, 
      driftPercentage: -0.2,
      falsePositiveRate: 1.8,
      falsePositiveTrend: 'stable',
      lastUpdated: '2 hours ago',
      status: 'Healthy'
    }
  ]

  // Filter gate peak hours
  const filteredGatePeaks = gatePeakHours.filter(item => {
    if (selectedGate !== 'all' && item.gate !== selectedGate) return false
    if (selectedDay !== 'all' && item.day !== selectedDay) return false
    return true
  })

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1500)
  }

  const getTrendIcon = (trend: string, value: number) => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3 text-green-600" />
    if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-600" />
    return <Minus className="h-3 w-3 text-gray-400" />
  }

  const getRiskBadge = (risk: string) => {
    switch(risk) {
      case 'Critical':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Critical</Badge>
      case 'High':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">High</Badge>
      case 'Medium':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Medium</Badge>
      case 'Low':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Low</Badge>
      default:
        return <Badge variant="outline">{risk}</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Healthy':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Healthy</Badge>
      case 'Warning':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Warning</Badge>
      case 'Critical':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Critical</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <ModulePageLayout
      title="Predictive Insights & AI Analytics"
      description="AI-driven forecasts for gate traffic, cargo examination queues, risk distribution, and model performance monitoring"
      breadcrumbs={[{ label: "AI Analytics" }, { label: "Predictive Insights" }]}
    >
      <div className="space-y-6">
        {/* Header with actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Predictive Analytics</h2>
            <p className="text-muted-foreground">
              AI-powered forecasts and early warnings for proactive decision making
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Select value={timeHorizon} onValueChange={setTimeHorizon}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Time horizon" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Next 24 hours</SelectItem>
                <SelectItem value="7days">Next 7 days</SelectItem>
                <SelectItem value="30days">Next 30 days</SelectItem>
                <SelectItem value="90days">Next 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 md:max-w-3xl md:grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="gate-traffic" className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              Gate Traffic
            </TabsTrigger>
            <TabsTrigger value="cargo-queue" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Cargo Queue
            </TabsTrigger>
            <TabsTrigger value="model-drift" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Model Drift
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6 space-y-6">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600">Demand Forecast</p>
                      <p className="text-3xl font-bold text-blue-700">+8.4%</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 mt-2">Expected visitor increase (7d)</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-amber-600">Stock-Out Risk</p>
                      <p className="text-3xl font-bold text-amber-700">12</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-amber-600" />
                    </div>
                  </div>
                  <p className="text-xs text-amber-600 mt-2">QR Codes at risk (14d)</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600">High-Risk Visitors</p>
                      <p className="text-3xl font-bold text-purple-700">110</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <Users className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                  <p className="text-xs text-purple-600 mt-2">Predicted for next week</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600">Model Confidence</p>
                      <p className="text-3xl font-bold text-green-700">94%</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                      <Brain className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                  <p className="text-xs text-green-600 mt-2">Average accuracy</p>
                </CardContent>
              </Card>
            </div>

            {/* Risk Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-orange-600" />
                  Risk Score Distribution Forecast
                </CardTitle>
                <CardDescription>
                  Predicted high-risk visitor count for the coming week
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {riskDistribution.map((risk) => (
                    <div key={risk.riskLevel} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full bg-${risk.color}-500`} />
                          <span className="font-medium">{risk.riskLevel}</span>
                          <Badge variant="outline" className="text-xs">
                            {risk.predictedCount} visitors
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{risk.percentage}%</span>
                          <span className={`text-xs ${
                            risk.changeFromLastWeek > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {risk.changeFromLastWeek > 0 ? '+' : ''}{risk.changeFromLastWeek}%
                          </span>
                        </div>
                      </div>
                      <Progress value={risk.percentage} className={`h-2 bg-${risk.color}-100`} />
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-orange-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-orange-800">High-Risk Alert</p>
                      <p className="text-sm text-orange-700 mt-1">
                        Predicted 110 high-risk visitors next week (+8% vs last week). 
                        Critical and High risk categories show increasing trend.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-600" />
                  AI-Generated Insights
                </CardTitle>
                <CardDescription>
                  Recommendations based on predictive analytics and current trends
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { 
                    title: "North Gate predicted to exceed capacity Tue-Thu 08:00-10:00", 
                    type: "Gate Traffic", 
                    priority: "High",
                    action: "Consider opening additional lanes"
                  },
                  { 
                    title: "Cargo examination queue expected to peak Friday (82% utilization)", 
                    type: "Customs", 
                    priority: "Medium",
                    action: "Schedule additional staff for Friday shift"
                  },
                  { 
                    title: "Model drift detected in Thermal Detection (accuracy -3.8%)", 
                    type: "AI Model", 
                    priority: "Critical",
                    action: "Review training data and retrain model"
                  },
                  { 
                    title: "High-risk visitor count trending upward (+8% week-over-week)", 
                    type: "Security", 
                    priority: "High",
                    action: "Increase screening at Main Entrance"
                  },
                  { 
                    title: "South Gate predicted to have lowest traffic Thursday afternoon", 
                    type: "Gate Traffic", 
                    priority: "Info",
                    action: "Opportunity for maintenance window"
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex flex-col md:flex-row md:items-start justify-between gap-4 rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-start gap-2">
                        {item.priority === 'Critical' && <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />}
                        {item.priority === 'High' && <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />}
                        {item.priority === 'Medium' && <Activity className="h-4 w-4 text-yellow-600 mt-0.5" />}
                        {item.priority === 'Info' && <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5" />}
                        <p className="font-medium text-foreground">{item.title}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">
                          {item.type}
                        </Badge>
                        <Badge 
                          variant={
                            item.priority === "Critical" ? "destructive" :
                            item.priority === "High" ? "default" :
                            item.priority === "Medium" ? "secondary" :
                            "outline"
                          }
                          className="text-xs"
                        >
                          {item.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        <span className="font-medium">Suggested action:</span> {item.action}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="md:self-center">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" className="w-full">
                  Load more insights
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gate Traffic Tab - Predicted Peak Hours */}
          <TabsContent value="gate-traffic" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Car className="h-5 w-5 text-blue-600" />
                      Predicted Peak Visitor Hours per Gate
                    </CardTitle>
                    <CardDescription>
                      AI forecast for the coming week based on historical patterns and current trends
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={selectedGate} onValueChange={setSelectedGate}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Select gate" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Gates</SelectItem>
                        {GATES.map(gate => (
                          <SelectItem key={gate} value={gate}>{gate}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedDay} onValueChange={setSelectedDay}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Select day" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Days</SelectItem>
                        {DAYS.map(day => (
                          <SelectItem key={day} value={day}>{day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                  <Table className="min-w-[980px]">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Gate</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead>Predicted Peak Hours</TableHead>
                        <TableHead>Expected Volume</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead>vs Last Week</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredGatePeaks.slice(0, 15).map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.gate}</TableCell>
                          <TableCell>{item.day}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-50">
                              <Clock className="h-3 w-3 mr-1" />
                              {item.peakHour}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.predictedVolume}</span>
                              <span className="text-xs text-muted-foreground">visitors</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={item.confidence} className="w-16 h-2" />
                              <span className="text-sm">{item.confidence}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {getTrendIcon(item.trend, item.comparisonToLastWeek)}
                              <span className={`text-sm ${
                                item.comparisonToLastWeek > 0 ? 'text-green-600' : 
                                item.comparisonToLastWeek < 0 ? 'text-red-600' : ''
                              }`}>
                                {item.comparisonToLastWeek > 0 ? '+' : ''}{item.comparisonToLastWeek}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Busiest Day</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">Thursday</div>
                      <p className="text-xs text-muted-foreground">North Gate: 08:00-10:00</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Peak Hour Average</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">09:00 - 11:00</div>
                      <p className="text-xs text-muted-foreground">Across all gates</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Confidence Range</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">82-97%</div>
                      <p className="text-xs text-muted-foreground">Prediction accuracy</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cargo Queue Tab */}
          <TabsContent value="cargo-queue" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-amber-600" />
                  Cargo Examination Queue Prediction by Day
                </CardTitle>
                <CardDescription>
                  Forecasted queue lengths, wait times, and utilization for customs examination
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Queue predictions table */}
                  <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                    <Table className="min-w-[980px]">
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Day</TableHead>
                          <TableHead>Predicted Queue</TableHead>
                          <TableHead>Utilization</TableHead>
                          <TableHead>Peak Time</TableHead>
                          <TableHead>Avg Wait Time</TableHead>
                          <TableHead>Risk Level</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cargoQueuePredictions.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.date}</TableCell>
                            <TableCell className="font-medium">{item.day}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.predictedQueueLength}</span>
                                <span className="text-xs text-muted-foreground">/ {item.maxCapacity}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={item.utilization} className="w-16 h-2" />
                                <span className="text-sm">{item.utilization}%</span>
                              </div>
                            </TableCell>
                            <TableCell>{item.peakTime}</TableCell>
                            <TableCell>{item.averageWaitTime} min</TableCell>
                            <TableCell>{getRiskBadge(item.riskLevel)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Critical alert for Friday */}
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-800">Critical Queue Alert - Friday</p>
                        <p className="text-sm text-red-700 mt-1">
                          Queue predicted to reach 78 vehicles (98% utilization) with 65min average wait time.
                          Recommended: Add 2 additional examination stations and notify customs supervisors.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Queue trend visualization */}
            <Card>
              <CardHeader>
                <CardTitle>Queue Trend Forecast</CardTitle>
                <CardDescription>Predicted queue length over the next 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 rounded-lg border bg-gradient-to-b from-muted/20 to-muted/40 flex flex-col items-center justify-center">
                  <LineChart className="h-12 w-12 text-muted-foreground/50 mb-2" />
                  <span className="text-sm text-muted-foreground">Queue length trend chart</span>
                  <div className="flex gap-4 mt-4">
                    {DAYS.slice(0, 5).map((day, i) => (
                      <div key={day} className="text-center">
                        <div className="text-xs text-muted-foreground">{day.substring(0, 3)}</div>
                        <div className="text-sm font-semibold">{40 + i * 8}</div>
                        <div className="w-8 h-16 bg-blue-200 mt-1 rounded-sm relative">
                          <div 
                            className="absolute bottom-0 w-full bg-blue-600 rounded-sm" 
                            style={{ height: `${60 + i * 8}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Model Drift Tab */}
          <TabsContent value="model-drift" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  Model Drift Early Warning System
                </CardTitle>
                <CardDescription>
                  Monitor AI accuracy trends and false positive feedback to detect model degradation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Model metrics table */}
                  <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                    <Table className="min-w-[1100px]">
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Model</TableHead>
                          <TableHead>Current Accuracy</TableHead>
                          <TableHead>Baseline</TableHead>
                          <TableHead>Drift</TableHead>
                          <TableHead>False Positive Rate</TableHead>
                          <TableHead>FP Trend</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last Updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {modelDriftMetrics.map((model, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{model.modelName}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className={model.accuracy < model.baselineAccuracy ? 'text-red-600' : 'text-green-600'}>
                                  {model.accuracy}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{model.baselineAccuracy}%</TableCell>
                            <TableCell>
                              <span className={model.driftPercentage < 0 ? 'text-red-600' : 'text-green-600'}>
                                {model.driftPercentage > 0 ? '+' : ''}{model.driftPercentage}%
                              </span>
                            </TableCell>
                            <TableCell>{model.falsePositiveRate}%</TableCell>
                            <TableCell>
                              {model.falsePositiveTrend === 'up' && <TrendingUp className="h-4 w-4 text-red-600" />}
                              {model.falsePositiveTrend === 'down' && <TrendingDown className="h-4 w-4 text-green-600" />}
                              {model.falsePositiveTrend === 'stable' && <Minus className="h-4 w-4 text-gray-400" />}
                            </TableCell>
                            <TableCell>{getStatusBadge(model.status)}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{model.lastUpdated}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Critical drift alert */}
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-800">Critical Model Drift Detected</p>
                        <p className="text-sm text-red-700 mt-1">
                          Thermal Detection model accuracy has dropped 3.8% below baseline with increasing false positives (6.7%).
                          Recommend immediate review of training data and model retraining.
                        </p>
                        <Button variant="outline" size="sm" className="mt-2 bg-white">
                          Investigate Model
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Warning summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Models at Risk</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-amber-600">2</div>
                        <p className="text-xs text-muted-foreground">Warning status</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Critical Models</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600">1</div>
                        <p className="text-xs text-muted-foreground">Requires immediate action</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Avg False Positive</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">3.5%</div>
                        <p className="text-xs text-muted-foreground">+0.7% from baseline</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Run New Prediction Card */}
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Run New Prediction</CardTitle>
              <CardDescription>Select module and time horizon for AI forecast</CardDescription>
            </div>
            <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 sm:w-auto">
              <Zap className="h-4 w-4 mr-2" />
              Generate Forecast
            </Button>
          </CardHeader>
        </Card>
      </div>
    </ModulePageLayout>
  )
}

// Helper component for minus icon
function Minus(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
    </svg>
  )
}