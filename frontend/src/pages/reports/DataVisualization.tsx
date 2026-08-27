"use client"

import { useState } from "react"
import { 
  BarChart3, 
  PieChart, 
  LineChart, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  GitBranch, 
  Download, 
  Calendar, 
  Filter, 
  RefreshCw, 
  Maximize2, 
  MoreVertical,
  Eye,
  Save,
  Share2,
  Clock,
  Activity,
  Shield,
  Car,
  Thermometer,
  Camera,
  Bell,
  Zap
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const timeRanges = ["Last 24 hours", "Last 7 days", "Last 30 days", "Last 90 days", "Custom range"]
const chartTypes = ["Bar Chart", "Line Chart", "Area Chart", "Pie Chart", "Heat Map"]
const dataSources = ["AI Analytics", "Security Events", "Gate Access", "Thermal Sensors", "All Sources"]

export default function DataVisualizationPage() {
  const [selectedTimeRange, setSelectedTimeRange] = useState("Last 7 days")
  const [selectedChartType, setSelectedChartType] = useState("Bar Chart")
  const [selectedDataSource, setSelectedDataSource] = useState("All Sources")
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <ModulePageLayout
      title="Data Visualization & Analytics"
      description="Interactive dashboards and advanced analytics for AI performance, security events, gate analytics, and custom reporting."
      breadcrumbs={[{ label: "AI Analytics" }, { label: "Data Visualization" }]}
    >
      <div className="w-full min-w-0 space-y-6">
        {/* Enhanced Quick Actions Bar */}
        <div className="flex flex-col items-start justify-between gap-4 rounded-lg border bg-muted/30 p-4 lg:flex-row lg:items-center">
          <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto">
            <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                {timeRanges.map((range) => (
                  <SelectItem key={range} value={range}>{range}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedChartType} onValueChange={setSelectedChartType}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <BarChart3 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Chart type" />
              </SelectTrigger>
              <SelectContent>
                {chartTypes.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedDataSource} onValueChange={setSelectedDataSource}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <Activity className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Data source" />
              </SelectTrigger>
              <SelectContent>
                {dataSources.map((source) => (
                  <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-9 w-9">
                <Filter className="h-4 w-4" />
              </Button>
              
              <Button variant="outline" size="icon" className="h-9 w-9">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex w-full flex-col items-center gap-2 sm:flex-row lg:w-auto">
            <div className="relative flex-1 lg:flex-none">
              <Input 
                placeholder="Search dashboards..." 
                className="pl-8 h-9 w-full lg:w-[200px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Eye className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            <Button variant="outline" className="h-9 w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button className="h-9 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 sm:w-auto">
              <Zap className="h-4 w-4 mr-2" />
              New Dashboard
            </Button>
          </div>
        </div>

        {/* Main Analytics Tabs */}
        <Tabs defaultValue="ai-performance" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 lg:max-w-4xl lg:grid-cols-4">
            <TabsTrigger value="ai-performance" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800">
              <TrendingUp className="h-4 w-4" />
              AI Performance
            </TabsTrigger>
            <TabsTrigger value="security-events" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800">
              <Shield className="h-4 w-4" />
              Security Events
            </TabsTrigger>
            <TabsTrigger value="gate-analytics" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800">
              <Car className="h-4 w-4" />
              Gate Analytics
            </TabsTrigger>
            <TabsTrigger value="visualization-studio" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800">
              <BarChart3 className="h-4 w-4" />
              Visualization Studio
            </TabsTrigger>
          </TabsList>

          {/* AI Performance Tab */}
          <TabsContent value="ai-performance" className="mt-6 space-y-6">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Overall Accuracy</p>
                      <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">98.5%</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <Progress value={98.5} className="mt-4 h-2 bg-blue-200 dark:bg-blue-800" />
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">↑ 2.3% from last month</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">Model Precision</p>
                      <p className="text-3xl font-bold text-green-700 dark:text-green-300">96.2%</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                      <BarChart3 className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <Progress value={96.2} className="mt-4 h-2 bg-green-200 dark:bg-green-800" />
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-200 dark:border-purple-800">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Model Recall</p>
                      <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">95.8%</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                      <LineChart className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                  <Progress value={95.8} className="mt-4 h-2 bg-purple-200 dark:bg-purple-800" />
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">F1 Score</p>
                      <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">96.0%</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                      <PieChart className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                  </div>
                  <Progress value={96.0} className="mt-4 h-2 bg-amber-200 dark:bg-amber-800" />
                </CardContent>
              </Card>
            </div>

            {/* Main Charts */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle>Model Accuracy Trend</CardTitle>
                    <CardDescription>Performance over last 30 days</CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Download as PNG</DropdownMenuItem>
                      <DropdownMenuItem>Download as CSV</DropdownMenuItem>
                      <DropdownMenuItem>View full screen</DropdownMenuItem>
                      <DropdownMenuItem>Share</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border bg-gradient-to-b from-muted/20 to-muted/40 p-8 flex flex-col items-center justify-center gap-2 min-h-[300px] relative group hover:shadow-md transition-all">
                    <LineChart className="h-16 w-16 text-muted-foreground/50" />
                    <span className="text-sm text-muted-foreground">Interactive accuracy trend chart</span>
                    <Badge variant="secondary" className="absolute top-4 right-4 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      +2.3% vs last month
                    </Badge>
                    <div className="absolute bottom-4 left-4 flex gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span>Object Detection</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>Face Recognition</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle>Performance by Category</CardTitle>
                    <CardDescription>Accuracy breakdown by detection type</CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Download</DropdownMenuItem>
                      <DropdownMenuItem>View details</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border bg-gradient-to-b from-muted/20 to-muted/40 p-8 flex flex-col items-center justify-center gap-2 min-h-[300px] relative group hover:shadow-md transition-all">
                    <BarChart3 className="h-16 w-16 text-muted-foreground/50" />
                    <span className="text-sm text-muted-foreground">Category performance comparison</span>
                    <div className="absolute bottom-4 left-4 space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>Object Detection: 99.2%</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span>Face Recognition: 97.8%</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                        <span>License Plate: 96.5%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Model Performance Table */}
            <Card>
              <CardHeader>
                <CardTitle>Model Performance Metrics</CardTitle>
                <CardDescription>Detailed accuracy metrics by model version and category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <div className="grid grid-cols-6 gap-4 p-4 bg-muted/50 font-medium text-sm">
                    <div>Model Version</div>
                    <div>Object Detection</div>
                    <div>Face Recognition</div>
                    <div>License Plate</div>
                    <div>Thermal</div>
                    <div>Overall</div>
                  </div>
                  <Separator />
                  {[
                    { version: "v2.5.0", object: 99.2, face: 97.8, plate: 96.5, thermal: 98.2, overall: 98.5 },
                    { version: "v2.4.0", object: 98.1, face: 96.5, plate: 95.2, thermal: 97.1, overall: 97.2 },
                    { version: "v2.3.0", object: 97.5, face: 95.2, plate: 93.8, thermal: 96.0, overall: 95.8 },
                  ].map((model, i) => (
                    <div key={i} className="grid grid-cols-6 gap-4 p-4 text-sm hover:bg-muted/30">
                      <div className="font-medium">{model.version}</div>
                      <div>{model.object}%</div>
                      <div>{model.face}%</div>
                      <div>{model.plate}%</div>
                      <div>{model.thermal}%</div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{model.overall}%</span>
                        <Progress value={model.overall} className="w-12 h-1.5" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Events Tab */}
          <TabsContent value="security-events" className="mt-6 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Alert Volume by Severity</CardTitle>
                  <CardDescription>Distribution of security alerts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border bg-gradient-to-b from-muted/20 to-muted/40 p-8 flex flex-col items-center justify-center gap-2 min-h-[300px] relative group">
                    <PieChart className="h-16 w-16 text-muted-foreground/50" />
                    <span className="text-sm text-muted-foreground">Severity distribution chart</span>
                    <div className="absolute bottom-4 left-4 space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span>Critical: 12% (156 alerts)</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                        <span>High: 23% (298 alerts)</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        <span>Medium: 35% (454 alerts)</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span>Low: 30% (389 alerts)</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Alert Volume by Category</CardTitle>
                  <CardDescription>Breakdown by alert type</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border bg-gradient-to-b from-muted/20 to-muted/40 p-8 flex flex-col items-center justify-center gap-2 min-h-[300px] relative group">
                    <BarChart3 className="h-16 w-16 text-muted-foreground/50" />
                    <span className="text-sm text-muted-foreground">Category breakdown chart</span>
                    <div className="absolute bottom-4 left-4 space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        <span>Intrusion: 245 alerts</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                        <span>Thermal: 156 alerts</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                        <span>Zone: 189 alerts</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                        <span>System: 98 alerts</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Alert Timeline</CardTitle>
                <CardDescription>Alert volume trend over selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border bg-gradient-to-b from-muted/20 to-muted/40 p-8 flex flex-col items-center justify-center gap-2 min-h-[200px]">
                  <LineChart className="h-12 w-12 text-muted-foreground/50" />
                  <span className="text-sm text-muted-foreground">24-hour alert volume trend</span>
                  <div className="flex gap-4 mt-2">
                    <Badge variant="outline">Peak: 14:00 - 156 alerts</Badge>
                    <Badge variant="outline">Avg: 89 alerts/hour</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gate Analytics Tab */}
          <TabsContent value="gate-analytics" className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              {["Gate 01 - North Entrance", "Gate 02 - South Entrance", "Gate 03 - East Entrance"].map((gate, i) => (
                <Card key={gate} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2 bg-gradient-to-r from-muted/30 to-transparent">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        {gate}
                      </CardTitle>
                      <Badge variant={i === 0 ? "default" : "secondary"}>
                        {i === 0 ? "Busiest" : `Load ${70 + i * 10}%`}
                      </Badge>
                    </div>
                    <CardDescription>Total flow: {1245 + i * 234} vehicles</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Peak hour</span>
                        <span className="font-medium">08:00 - 09:00</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>Inbound</span>
                          <span className="font-medium">{567 + i * 89}</span>
                        </div>
                        <Progress value={60 + i * 5} className="h-2" />
                        <div className="flex justify-between text-xs mt-2">
                          <span>Outbound</span>
                          <span className="font-medium">{678 + i * 145}</span>
                        </div>
                        <Progress value={70 + i * 3} className="h-2" />
                      </div>
                      <div className="pt-2 border-t grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Avg wait time</span>
                          <p className="font-medium">{45 + i * 5} sec</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Utilization</span>
                          <p className="font-medium">{65 + i * 8}%</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Per-Gate Flow Comparison</CardTitle>
                <CardDescription>Real-time traffic analysis across all access points</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border bg-gradient-to-b from-muted/20 to-muted/40 p-8 flex flex-col items-center justify-center gap-2 min-h-[300px]">
                  <BarChart3 className="h-16 w-16 text-muted-foreground/50" />
                  <span className="text-sm text-muted-foreground">Comparative flow analysis chart</span>
                  <div className="flex gap-6 mt-4">
                    {["Gate 01", "Gate 02", "Gate 03"].map((gate, i) => (
                      <div key={gate} className="text-center">
                        <div className="text-xs text-muted-foreground">{gate}</div>
                        <div className="text-lg font-semibold">{1245 + i * 234}</div>
                        <Badge variant="outline" className="mt-1">+{12 + i}%</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t bg-muted/10 px-6 py-3">
                <div className="flex w-full flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Last updated: 2 minutes ago
                  </span>
                  <Button variant="ghost" size="sm">View detailed report →</Button>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Visualization Studio Tab */}
          <TabsContent value="visualization-studio" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle>Visualization Studio</CardTitle>
                    <CardDescription>Build and view custom charts from your data sources</CardDescription>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button variant="outline" size="sm" className="w-full sm:w-auto">
                      <Save className="h-4 w-4 mr-2" />
                      Save View
                    </Button>
                    <Button variant="outline" size="sm" className="w-full sm:w-auto">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="visitors" className="w-full">
                  <TabsList className="grid w-full grid-cols-1 sm:max-w-md sm:grid-cols-3">
                    <TabsTrigger value="visitors" className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Visitors
                    </TabsTrigger>
                    <TabsTrigger value="inventory" className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Inventory
                    </TabsTrigger>
                    <TabsTrigger value="hr" className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      HR
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="visitors" className="mt-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="rounded-lg border border-border bg-gradient-to-b from-muted/20 to-muted/40 p-8 flex flex-col items-center justify-center gap-3 min-h-[280px] hover:shadow-md transition-all group">
                        <BarChart3 className="h-12 w-12 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
                        <span className="text-sm font-medium">Visitor Volume by Day</span>
                        <span className="text-xs text-muted-foreground">Daily traffic patterns and trends</span>
                        <Button variant="ghost" size="sm" className="mt-2">Configure Chart →</Button>
                      </div>
                      <div className="rounded-lg border border-border bg-gradient-to-b from-muted/20 to-muted/40 p-8 flex flex-col items-center justify-center gap-3 min-h-[280px] hover:shadow-md transition-all group">
                        <PieChart className="h-12 w-12 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
                        <span className="text-sm font-medium">Visit Purpose Breakdown</span>
                        <span className="text-xs text-muted-foreground">Distribution by visit type</span>
                        <Button variant="ghost" size="sm" className="mt-2">Configure Chart →</Button>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="inventory" className="mt-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="rounded-lg border border-border bg-gradient-to-b from-muted/20 to-muted/40 p-8 flex flex-col items-center justify-center gap-3 min-h-[280px] hover:shadow-md transition-all group">
                        <LineChart className="h-12 w-12 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
                        <span className="text-sm font-medium">Stock Level Trends</span>
                        <span className="text-xs text-muted-foreground">Historical inventory levels</span>
                        <Button variant="ghost" size="sm" className="mt-2">Configure Chart →</Button>
                      </div>
                      <div className="rounded-lg border border-border bg-gradient-to-b from-muted/20 to-muted/40 p-8 flex flex-col items-center justify-center gap-3 min-h-[280px] hover:shadow-md transition-all group">
                        <BarChart3 className="h-12 w-12 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
                        <span className="text-sm font-medium">Warehouse Utilization</span>
                        <span className="text-xs text-muted-foreground">Space usage by facility</span>
                        <Button variant="ghost" size="sm" className="mt-2">Configure Chart →</Button>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="hr" className="mt-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="rounded-lg border border-border bg-gradient-to-b from-muted/20 to-muted/40 p-8 flex flex-col items-center justify-center gap-3 min-h-[280px] hover:shadow-md transition-all group">
                        <BarChart3 className="h-12 w-12 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
                        <span className="text-sm font-medium">Attendance by Department</span>
                        <span className="text-xs text-muted-foreground">Daily attendance patterns</span>
                        <Button variant="ghost" size="sm" className="mt-2">Configure Chart →</Button>
                      </div>
                      <div className="rounded-lg border border-border bg-gradient-to-b from-muted/20 to-muted/40 p-8 flex flex-col items-center justify-center gap-3 min-h-[280px] hover:shadow-md transition-all group">
                        <PieChart className="h-12 w-12 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
                        <span className="text-sm font-medium">Leave Balance Distribution</span>
                        <span className="text-xs text-muted-foreground">PTO allocation by team</span>
                        <Button variant="ghost" size="sm" className="mt-2">Configure Chart →</Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Saved Views Section */}
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Saved Dashboards & Views</CardTitle>
              <CardDescription>Your customized analytics configurations</CardDescription>
            </div>
            <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 sm:w-auto">
              <Zap className="h-4 w-4 mr-2" />
              New Dashboard
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { name: "AI Performance Overview", icon: TrendingUp, color: "blue", charts: 6, views: 234 },
                { name: "Security Command Center", icon: Shield, color: "red", charts: 8, views: 156 },
                { name: "Gate Operations Dashboard", icon: Car, color: "green", charts: 5, views: 89 },
                { name: "Visitor Analytics", icon: Users, color: "purple", charts: 4, views: 67 },
                { name: "Inventory Management", icon: Activity, color: "amber", charts: 7, views: 45 },
                { name: "HR Analytics", icon: BarChart3, color: "pink", charts: 3, views: 34 },
              ].map((view) => {
                const Icon = view.icon
                const colorClasses = {
                  blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
                  red: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
                  green: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
                  purple: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
                  amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
                  pink: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400",
                }
                
                return (
                  <div
                    key={view.name}
                    className="group rounded-lg border border-border p-4 hover:shadow-md transition-all cursor-pointer bg-gradient-to-b from-background to-muted/20"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-2 rounded-lg ${colorClasses[view.color as keyof typeof colorClasses]}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="secondary" className="text-xs">{view.charts} charts</Badge>
                    </div>
                    <h4 className="font-medium mb-1">{view.name}</h4>
                    <p className="text-xs text-muted-foreground mb-3">{view.views} views · Last viewed 2d ago</p>
                    <div className="flex gap-2">
                      <Button variant="default" size="sm" className="w-full opacity-0 group-hover:opacity-100 transition-opacity">
                        Open Dashboard
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest dashboard views and exports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { action: "Exported AI Performance Report", time: "5 minutes ago", user: "John Smith" },
                { action: "Created new Gate Analytics view", time: "2 hours ago", user: "Sarah Johnson" },
                { action: "Shared Security Dashboard", time: "1 day ago", user: "Mike Chen" },
              ].map((activity, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-lg bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">by {activity.user}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{activity.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}