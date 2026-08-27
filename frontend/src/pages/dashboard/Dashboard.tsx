import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  Calendar,
  Users,
  ClipboardCheck,
  AlertCircle,
  Package,
  BarChart3,
  UsersRound,
  CalendarDays,
  Loader2,
} from "lucide-react"
import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ROUTES } from "@/routes/config"
import { getStoredUser } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { fetchVmsOverview } from "@/lib/vms-api"
import type { VmsOverviewVisitorRow } from "@/lib/vms-api"
import { DashboardRtspCameraGrid } from "@/components/dashboard/dashboard-rtsp-camera-grid"
import { CityControlGrid } from "@/components/dashboard/city-control-grid"
import { LiveAlerts } from "@/components/dashboard/live-alerts"
import {
  RecentRegistrationsTable,
  VisitorDeleteDialog,
} from "@/components/vms/recent-registrations-table"

type DashboardStatCardProps = {
  title: string
  value: string
  footnote: string
  footnoteClassName?: string
  icon: ReactNode
  iconWrapClassName: string
  loading?: boolean
}

function DashboardStatCard({
  title,
  value,
  footnote,
  footnoteClassName,
  icon,
  iconWrapClassName,
  loading,
}: DashboardStatCardProps) {
  return (
    <Card className="flex h-full min-w-0 flex-col gap-0 rounded-[10px] border-gray-200 py-0 shadow-sm">
      <CardContent className="flex h-full min-w-0 flex-col p-3 sm:p-5">
        <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
          <p className="min-w-0 text-[11px] font-medium leading-snug text-[#4A5565] sm:text-sm lg:text-base">
            {title}
          </p>
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11 lg:h-12 lg:w-12",
              iconWrapClassName
            )}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-[#155DFC] sm:h-6 sm:w-6" /> : icon}
          </div>
        </div>
        <p className="text-2xl font-bold leading-none text-[#101727] sm:text-3xl lg:text-[32px]">
          {loading ? "—" : value}
        </p>
        <p className={cn("mt-2 text-[10px] leading-tight sm:text-xs", footnoteClassName)}>{footnote}</p>
      </CardContent>
    </Card>
  )
}

export function Dashboard() {
  const welcomeName = getStoredUser()?.username?.trim() || "User"
  const [deleteTarget, setDeleteTarget] = useState<VmsOverviewVisitorRow | null>(null)

  const { data: vms, isLoading: vmsLoading } = useQuery({
    queryKey: ["vms", "overview"],
    queryFn: fetchVmsOverview,
    refetchInterval: 60_000,
  })

  const stat = (n: number | undefined) => (vmsLoading ? "—" : String(n ?? 0))

  return (
    <div className="flex min-h-full w-full min-w-0 max-w-full flex-col">
      <div className="flex min-w-0 flex-1 flex-col gap-8 sm:gap-11">
        <div className="flex min-w-0 flex-col gap-7 self-stretch sm:gap-9">
          {/* Welcome */}
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="break-words text-2xl font-bold tracking-tight text-[#101727] sm:text-3xl">
              Welcome Back {welcomeName}!
            </h1>
            <p className="text-sm text-[#697282] sm:text-base">
              Manage your data, appointments, warehouse and resources efficiently.
            </p>
          </div>

          {/* Stat cards: 2×2 on mobile/tablet, 4 across on lg+ */}
          <div className="grid w-full min-w-0 grid-cols-2 grid-rows-2 items-stretch gap-3 sm:gap-4 lg:grid-cols-4 lg:grid-rows-1 lg:gap-6">
            <DashboardStatCard
              title="Total Visitors Today"
              value={stat(vms?.visitors_registered_today)}
              footnote="Registered today"
              footnoteClassName="text-[#4A5565]"
              iconWrapClassName="bg-blue-50"
              icon={<Users className="h-5 w-5 text-[#155DFC] sm:h-6 sm:w-6" />}
              loading={vmsLoading}
            />
            <DashboardStatCard
              title="Active Check-ins"
              value={stat(vms?.checked_in)}
              footnote="Currently on premises"
              footnoteClassName="text-[#4A5565]"
              iconWrapClassName="bg-green-50"
              icon={<ClipboardCheck className="h-5 w-5 text-[#00A63E] sm:h-6 sm:w-6" />}
              loading={vmsLoading}
            />
            <DashboardStatCard
              title="Pending Approvals"
              value={stat(vms?.pending_approval)}
              footnote="Requires attention"
              footnoteClassName="text-[#F54900]"
              iconWrapClassName="bg-orange-50"
              icon={<AlertCircle className="h-5 w-5 text-[#F54900] sm:h-6 sm:w-6" />}
              loading={vmsLoading}
            />
            <DashboardStatCard
              title="Expected Today"
              value={stat(vms?.expected_today)}
              footnote="Scheduled or walk-in visits"
              footnoteClassName="text-[#9810FA]"
              iconWrapClassName="bg-violet-50"
              icon={<Calendar className="h-5 w-5 text-[#9810FA] sm:h-6 sm:w-6" />}
              loading={vmsLoading}
            />
          </div>

          <DashboardRtspCameraGrid />

          {/* City Control Grid & Live Alerts */}
          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
            <div className="lg:col-span-2">
              <CityControlGrid />
            </div>
            <LiveAlerts />
          </div>

          {/* Calendar View banner */}
          <div
            className="flex flex-col gap-4 rounded-[10px] p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:p-6"
            style={{ background: "linear-gradient(180deg, #155DFC, #1447E6)" }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white/20 sm:h-16 sm:w-16">
                <Calendar className="h-7 w-7 text-white sm:h-8 sm:w-8" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white sm:text-xl">Calendar View</h2>
                <p className="text-sm text-blue-100">
                  View and manage all appointments, bookings, and scheduled visits.
                </p>
              </div>
            </div>
            <Link to={ROUTES.CALENDAR_VIEW} className="w-full shrink-0 sm:w-auto">
              <Button className="w-full gap-2 rounded-[10px] bg-white px-6 py-[11px] text-[#155DFC] hover:bg-white/90 sm:w-auto">
                <CalendarDays className="h-5 w-5" />
                <span className="text-base font-medium">View Calendar</span>
              </Button>
            </Link>
          </div>

          {/* At a Glance */}
          <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
            <h2 className="text-xl font-bold text-[#101727] sm:text-2xl">At a Glance</h2>
            <div className="grid min-w-0 grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-10">
              {/* Visitor Management */}
              <Card className="min-w-0 overflow-hidden rounded-[10px] border-gray-200">
                <CardContent className="p-0">
                  <div className="flex h-12 items-center bg-blue-50 px-4 sm:px-6">
                    <Users className="h-6 w-6 text-[#155DFC]" />
                  </div>
                  <div className="flex flex-col gap-3.5 px-4 py-5 sm:px-6 sm:py-6">
                    <h3 className="text-lg font-bold text-[#101828] sm:text-[22px]">Visitor Management</h3>
                    <p className="text-sm text-[#6A7282] sm:text-lg">
                      Manage visitor registrations, check-ins, check-outs, and access control.
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="flex min-w-0 flex-col gap-1 rounded-[10px] bg-blue-50 p-3">
                        <span className="text-sm text-[#155DFC]">Today&apos;s Visits</span>
                        <span className="text-xl font-bold text-[#1C398E]">
                          {vmsLoading ? "—" : vms?.expected_today ?? 0}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1 rounded-[10px] bg-green-50 p-3">
                        <span className="text-sm text-[#00A63E]">Checked In</span>
                        <span className="text-xl font-bold text-[#0D542B]">
                          {vmsLoading ? "—" : vms?.checked_in ?? 0}
                        </span>
                      </div>
                    </div>
                    <Link to={ROUTES.VISITOR_MANAGEMENT_OVERVIEW}>
                      <Button className="w-full rounded-lg bg-[#155DFC] py-2.5 text-white hover:bg-[#155DFC]/90">
                        <span className="text-sm font-medium">View Details</span>
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Warehouse Management */}
              <Card className="min-w-0 overflow-hidden rounded-[10px] border-gray-200">
                <CardContent className="p-0">
                  <div className="flex h-12 items-center bg-violet-50 px-4 sm:px-6">
                    <Package className="h-6 w-6 text-[#9810FA]" />
                  </div>
                  <div className="flex flex-col gap-3.5 px-4 py-5 sm:px-6 sm:py-6">
                    <h3 className="text-lg font-bold text-[#101828] sm:text-[22px]">Warehouse Management</h3>
                    <p className="text-sm text-[#6A7282] sm:text-lg">
                      Track inventory, collections, kept items and warehouse operations in real-time.
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="flex flex-col bg-blue-50 p-3 gap-1 rounded-[10px] min-w-0">
                        <span className="text-[#155DFC] text-sm">Active Operations</span>
                        <span className="text-[#1C398E] text-xl font-bold">142</span>
                      </div>
                      <div className="flex flex-col bg-orange-50 p-3 gap-1 rounded-[10px] min-w-0">
                        <span className="text-[#F54900] text-sm">Pending Items</span>
                        <span className="text-[#7E2A0C] text-xl font-bold">38</span>
                      </div>
                    </div>
                    <Link to={ROUTES.OPERATIONS_DASHBOARD}>
                      <Button className="w-full bg-[#9810FA] hover:bg-[#9810FA]/90 text-white rounded-lg py-2.5">
                        <span className="text-sm font-medium">View Details</span>
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* AI Analytics */}
              <Card className="min-w-0 overflow-hidden rounded-[10px] border-gray-200">
                <CardContent className="p-0">
                  <div className="flex h-12 items-center bg-cyan-50 px-4 sm:px-6">
                    <BarChart3 className="h-6 w-6 text-[#0092B8]" />
                  </div>
                  <div className="flex flex-col gap-3.5 px-4 py-5 sm:px-6 sm:py-6">
                    <h3 className="text-lg font-bold text-[#101828] sm:text-[22px]">AI Analytics</h3>
                    <p className="text-sm text-[#6A7282] sm:text-lg">
                      Advanced insights and predictive analytics for visits and operations.
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="flex flex-col bg-[#FDF8F0] p-3 gap-1 rounded-[10px] min-w-0">
                        <span className="text-[#FC7115] text-sm">Peak Hours</span>
                        <span className="text-sm font-bold leading-tight text-[#8E4B1C] sm:text-xl">10AM - 2PM</span>
                      </div>
                      <div className="flex flex-col bg-green-50 p-3 gap-1 rounded-[10px] min-w-0">
                        <span className="text-[#00A63E] text-sm">Efficiency</span>
                        <span className="text-[#0D542B] text-xl font-bold">93%</span>
                      </div>
                    </div>
                    <Link to={ROUTES.ANALYTICS_DASHBOARD}>
                      <Button className="w-full bg-[#0092B8] hover:bg-[#0092B8]/90 text-white rounded-lg py-2.5">
                        <span className="text-sm font-medium">View Details</span>
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Human Resources */}
              <Card className="min-w-0 overflow-hidden rounded-[10px] border-gray-200">
                <CardContent className="p-0">
                  <div className="flex h-12 items-center bg-emerald-50 px-4 sm:px-6">
                    <UsersRound className="h-6 w-6 text-[#009966]" />
                  </div>
                  <div className="flex flex-col gap-3.5 px-4 py-5 sm:px-6 sm:py-6">
                    <h3 className="text-lg font-bold text-[#101828] sm:text-[22px]">Human Resources</h3>
                    <p className="text-sm text-[#6A7282] sm:text-lg">
                      Employee management, attendance and performance tracking, and HR process
                      automation.
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="flex flex-col bg-[#F1FFEF] p-3 gap-1 rounded-[10px] min-w-0">
                        <span className="text-[#019639] text-sm">Employees</span>
                        <span className="text-[#1C620C] text-xl font-bold">142</span>
                      </div>
                      <div className="flex flex-col bg-green-50 p-3 gap-1 rounded-[10px] min-w-0">
                        <span className="text-[#00A63E] text-sm">Present Today</span>
                        <span className="text-[#0D542B] text-xl font-bold">131</span>
                      </div>
                    </div>
                    <Link to={ROUTES.EMPLOYEES}>
                      <Button className="w-full bg-[#009966] hover:bg-[#009966]/90 text-white rounded-lg py-2.5">
                        <span className="text-sm font-medium">View Details</span>
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <RecentRegistrationsTable
            rows={vms?.recent_registrations ?? []}
            isLoading={vmsLoading}
            onDeleteClick={setDeleteTarget}
          />
          <VisitorDeleteDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />
        </div>
      </div>
    </div>
  )
}
