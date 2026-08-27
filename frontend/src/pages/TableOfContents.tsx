import { Link } from "react-router-dom"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { ROUTES } from "@/routes/config"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { List } from "lucide-react"

const MODULES: { name: string; description: string; href: string }[] = [
  { name: "Dashboard", description: "Main dashboard – real-time overview", href: ROUTES.DASHBOARD },
  { name: "Live View", description: "Camera live feed & PTZ controls", href: ROUTES.LIVE_CAMERA_GRID },
  { name: "Playback & Search", description: "Video playback, AI smart search, export", href: ROUTES.PLAYBACK_SEARCH },
  { name: "AI Analytics", description: "AI models, zones, rules, training", href: ROUTES.ANALYTICS_DASHBOARD },
  { name: "Thermal Imaging", description: "Temperature monitoring, fever & fire detection", href: ROUTES.THERMAL_IMAGING },
  { name: "Camera Management", description: "Camera add/configure/group/health", href: ROUTES.CAMERA_MANAGEMENT },
  { name: "Alerts & Notifications", description: "Alert rules, management, channels, escalation", href: ROUTES.ALERTS_NOTIFICATIONS },
  { name: "Incident Management", description: "Incident creation, investigation, evidence", href: ROUTES.INCIDENT_MANAGEMENT },
  { name: "People Database", description: "Face recognition, enrollment, attendance", href: ROUTES.PEOPLE_DATABASE },
  { name: "Vehicle Database", description: "LPR/ANPR, vehicle lists, tracking", href: ROUTES.VEHICLE_DATABASE },
  { name: "Reports & Analytics", description: "50+ report types, scheduling, export", href: ROUTES.REPORTS },
  { name: "Access Control", description: "Door, barrier, visitor management integration", href: ROUTES.ACCESS_CONTROL },
  { name: "Configuration", description: "System, network, storage, email, security settings", href: ROUTES.GENERAL_SETTINGS },
  { name: "Administration", description: "Users, roles, licenses, audit, backup, API", href: ROUTES.USER_ROLE_MANAGEMENT },
  { name: "Mobile App", description: "iOS & Android feature specification", href: ROUTES.MOBILE_APP },
  { name: "Integrations & API", description: "REST API, webhooks, 3rd-party integrations", href: ROUTES.INTEGRATIONS },
  { name: "Roles & Permissions", description: "All user roles with permission matrix", href: ROUTES.ROLES_PERMISSIONS },
  { name: "Database Tables", description: "Key database tables & field reference", href: ROUTES.DATABASE_TABLES },
]

export default function TableOfContentsPage() {
  return (
    <ModulePageLayout
      title="Table of Contents"
      description="Navigation index for all modules and sheets."
      breadcrumbs={[{ label: "Table of Contents" }]}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            All modules
          </CardTitle>
          <CardDescription>
            Jump to any module in the system. This page is the navigation index for all sheets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((mod) => (
              <li key={mod.href}>
                <Link
                  to={mod.href}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50 hover:border-[#A9D1EF]"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">{mod.name}</span>
                    <p className="text-sm text-muted-foreground mt-0.5">{mod.description}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </ModulePageLayout>
  )
}
