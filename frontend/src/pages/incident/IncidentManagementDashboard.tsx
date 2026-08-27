import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  AlertTriangle,
  Users,
  FileText,
  CheckCircle,
  TrendingUp,
  Activity,
  Shield,
  Eye,
  Plus
} from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ROUTES, getIncidentDetailPath } from "@/routes/config"
import { useToast } from "@/hooks/use-toast"

// Mock data - replace with actual API calls
interface Incident {
  id: number
  title: string
  type: string
  priority: 'Low' | 'Medium' | 'High' | 'Critical'
  status: 'Open' | 'Investigating' | 'Closed'
  assignedTo: string
  createdAt: string
  updatedAt: string
}

const mockIncidents: Incident[] = [
  {
    id: 1,
    title: "Smuggling Attempt - Concealed Goods in Container",
    type: "Smuggling",
    priority: "Critical",
    status: "Investigating",
    assignedTo: "Inspector Ahmed",
    createdAt: "2024-01-15T10:30:00Z",
    updatedAt: "2024-01-15T14:20:00Z"
  },
  {
    id: 2,
    title: "Customs Duty Evasion - Under-declaration",
    type: "Duty Evasion",
    priority: "High",
    status: "Open",
    assignedTo: "Officer Fatima",
    createdAt: "2024-01-14T09:15:00Z",
    updatedAt: "2024-01-14T09:15:00Z"
  },
  {
    id: 3,
    title: "Prohibited Items Seizure - Narcotics",
    type: "Prohibited Items",
    priority: "Critical",
    status: "Closed",
    assignedTo: "Superintendent Khan",
    createdAt: "2024-01-13T16:45:00Z",
    updatedAt: "2024-01-14T11:30:00Z"
  },
  {
    id: 4,
    title: "Border Security Breach",
    type: "Security Breach",
    priority: "High",
    status: "Investigating",
    assignedTo: "Deputy Collector Ali",
    createdAt: "2024-01-12T08:20:00Z",
    updatedAt: "2024-01-12T08:20:00Z"
  }
]

const priorityColors = {
  Low: "bg-blue-100 text-blue-800",
  Medium: "bg-yellow-100 text-yellow-800",
  High: "bg-orange-100 text-orange-800",
  Critical: "bg-red-100 text-red-800"
}

const statusColors = {
  Open: "bg-gray-100 text-gray-800",
  Investigating: "bg-blue-100 text-blue-800",
  Closed: "bg-green-100 text-green-800"
}

export default function IncidentManagementDashboard() {
  const navigate = useNavigate()
  const [incidents] = useState<Incident[]>(mockIncidents)

  const stats = [
    {
      title: "Active Investigations",
      value: incidents.filter(i => i.status === 'Investigating').length.toString(),
      icon: Activity,
      description: "Ongoing customs investigations"
    },
    {
      title: "Seizures This Month",
      value: "47",
      icon: Shield,
      description: "Goods seized under customs act"
    },
    {
      title: "High Priority Cases",
      value: incidents.filter(i => i.priority === 'High' || i.priority === 'Critical').length.toString(),
      icon: AlertTriangle,
      description: "Critical and high priority cases"
    },
    {
      title: "Resolved Cases",
      value: incidents.filter(i => i.status === 'Closed').length.toString(),
      icon: CheckCircle,
      description: "Successfully resolved cases"
    }
  ]

  const recentIncidents = incidents.slice(0, 5)

  return (
    <ModulePageLayout
      title="Incident Management Dashboard"
      description="Comprehensive incident tracking, investigation, and resolution system"
      actions={
        <Button onClick={() => navigate(ROUTES.INCIDENT_CREATION_PAGE)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Incident
        </Button>
      }
    >
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(ROUTES.INCIDENT_CREATION_PAGE)}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center">
              <Plus className="mr-2 h-4 w-4" />
              Report Incident
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">File customs violation report</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(ROUTES.CASE_ASSIGNMENT)}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center">
              <Users className="mr-2 h-4 w-4" />
              Case Assignment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Assign to investigation officers</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(ROUTES.EVIDENCE_COLLECTION)}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center">
              <FileText className="mr-2 h-4 w-4" />
              Evidence Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Manage seized goods & evidence</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(ROUTES.INCIDENT_REPORTING)}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center">
              <TrendingUp className="mr-2 h-4 w-4" />
              Customs Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Generate FBR compliance reports</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Incidents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Incidents</CardTitle>
          <CardDescription>Latest incident reports and their current status</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentIncidents.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell className="font-medium">#{incident.id}</TableCell>
                  <TableCell>{incident.title}</TableCell>
                  <TableCell>{incident.type}</TableCell>
                  <TableCell>
                    <Badge className={priorityColors[incident.priority]}>
                      {incident.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[incident.status]}>
                      {incident.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{incident.assignedTo}</TableCell>
                  <TableCell>{new Date(incident.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(getIncidentDetailPath(incident.id))}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </ModulePageLayout>
  )
}