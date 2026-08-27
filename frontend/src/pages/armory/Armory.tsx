import {
  ShieldCheck,
  Package,
  KeyRound,
  AlertTriangle,
  Lock,
  User,
  Clock,
  ChevronRight,
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

const STATS = [
  {
    label: "Total Weapons",
    value: 124,
    sub: "Registered in system",
    icon: Package,
    iconBg: "bg-[#dbeafe]",
    iconColor: "text-[#3b82f6]",
  },
  {
    label: "In Armory",
    value: 98,
    sub: "Secured in vault",
    icon: Lock,
    iconBg: "bg-[#dcfce7]",
    iconColor: "text-[#22c55e]",
  },
  {
    label: "Checked Out",
    value: 22,
    sub: "Currently issued",
    icon: KeyRound,
    iconBg: "bg-[#fef9c3]",
    iconColor: "text-[#eab308]",
  },
  {
    label: "Pending Inspection",
    value: 4,
    sub: "Due for audit",
    icon: AlertTriangle,
    iconBg: "bg-[#fee2e2]",
    iconColor: "text-[#ef4444]",
  },
]

const VAULT_RACKS = [
  { id: "V-01", location: "Main vault – Rack A", status: "secure", lastAudit: "Today" },
  { id: "V-02", location: "Main vault – Rack B", status: "secure", lastAudit: "Today" },
  { id: "V-03", location: "Main vault – Rack C", status: "secure", lastAudit: "Yesterday" },
  { id: "V-04", location: "Secondary – Safe 1", status: "secure", lastAudit: "Today" },
  { id: "V-05", location: "Secondary – Safe 2", status: "warning", lastAudit: "3 days ago" },
]

const RECENT_ACTIVITY = [
  { id: 1, type: "Check-out", item: "Weapon #W-2041", user: "Inspector Ahmed", time: "2 hours ago" },
  { id: 2, type: "Check-in", item: "Weapon #W-1892", user: "Sgt. Khan", time: "3 hours ago" },
  { id: 3, type: "Check-out", item: "Weapon #W-2103", user: "Officer Raza", time: "5 hours ago" },
  { id: 4, type: "Inspection", item: "Rack B – Full audit", user: "Armory Admin", time: "6 hours ago" },
  { id: 5, type: "Check-in", item: "Weapon #W-1955", user: "Inspector Ahmed", time: "8 hours ago" },
]

export default function ArmoryPage() {
  return (
    <ModulePageLayout
      title="Armory Dashboard"
      description="Weapons inventory, check-out/check-in activity, and vault status at a glance."
      breadcrumbs={[{ label: "Armory" }, { label: "Dashboard" }]}
    >
      <div className="grid gap-6">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <div className={`rounded-lg p-2 ${stat.iconBg} ${stat.iconColor}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent activity */}
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest check-out, check-in, and inspection events</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                View all
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 sm:hidden">
                {RECENT_ACTIVITY.map((row) => (
                  <div key={row.id} className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Badge
                        variant={
                          row.type === "Check-out"
                            ? "default"
                            : row.type === "Check-in"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {row.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{row.time}</span>
                    </div>
                    <p className="text-sm font-medium">{row.item}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.user}</p>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {RECENT_ACTIVITY.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Badge
                            variant={
                              row.type === "Check-out"
                                ? "default"
                                : row.type === "Check-in"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {row.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{row.item}</TableCell>
                        <TableCell className="text-muted-foreground">{row.user}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {row.time}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Vault & rack status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#3b82f6]" />
                Vault & Rack Status
              </CardTitle>
              <CardDescription>Security status and last audit per location</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {VAULT_RACKS.map((rack) => (
                  <div
                    key={rack.id}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#dbeafe]">
                        <Lock className="h-4 w-4 text-[#3b82f6]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{rack.id}</p>
                        <p className="text-xs text-muted-foreground">{rack.location}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">Audit: {rack.lastAudit}</span>
                      <Badge variant={rack.status === "secure" ? "default" : "destructive"}>
                        {rack.status === "secure" ? "Secure" : "Attention"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {VAULT_RACKS.filter((r) => r.status === "secure").length} secure / {VAULT_RACKS.length}{" "}
                total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions / compliance summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Compliance Summary
            </CardTitle>
            <CardDescription>
              Next scheduled inspections and outstanding actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium text-muted-foreground">Next full audit</p>
                <p className="text-lg font-semibold mt-1">Feb 28, 2025</p>
                <p className="text-xs text-muted-foreground mt-0.5">Scheduled</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium text-muted-foreground">Weapons due for return</p>
                <p className="text-lg font-semibold mt-1">3</p>
                <p className="text-xs text-muted-foreground mt-0.5">Within 24 hours</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Rack requiring attention
                </p>
                <p className="text-lg font-semibold mt-1">V-05</p>
                <p className="text-xs text-muted-foreground mt-0.5">Last audit 3 days ago</p>
              </div>
            </div>
            <Button className="mt-4 w-full bg-[#3b82f6] text-white hover:bg-[#2563eb] sm:w-auto">
              View inspection log
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
