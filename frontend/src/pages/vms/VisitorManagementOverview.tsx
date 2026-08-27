import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  Calendar,
  ClipboardCheck,
  FileQuestion,
  UserCheck,
  Ban,
  Car,
  XCircle,
  Ticket,
  ChevronRight,
  FileEdit,
  UserPlus,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ROUTES } from "@/routes/config"
import { fetchVmsOverview } from "@/lib/vms-api"
import { clearanceStatusClass } from "@/lib/visitor-display"
import {
  RecentRegistrationsTable,
  VisitorDeleteDialog,
  VisitorRegistrationActions,
} from "@/components/vms/recent-registrations-table"
import type { VmsOverviewVisitorRow } from "@/lib/vms-api"

export function VisitorManagementOverview() {
  const [deleteTarget, setDeleteTarget] = useState<VmsOverviewVisitorRow | null>(null)
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["vms", "overview"],
    queryFn: fetchVmsOverview,
    refetchInterval: 60_000,
  })

  const statsRow1 = data
    ? [
        { label: "Expected Today", value: String(data.expected_today), icon: Calendar, color: "text-[#155DFC]", bg: "bg-blue-50" },
        { label: "Checked In", value: String(data.checked_in), icon: ClipboardCheck, color: "text-green-600", bg: "bg-green-50" },
        { label: "Pending Docs", value: String(data.pending_docs), icon: FileQuestion, color: "text-amber-600", bg: "bg-amber-50" },
        { label: "Pending Approval", value: String(data.pending_approval), icon: UserCheck, color: "text-violet-600", bg: "bg-violet-50" },
      ]
    : []

  const statsRow2 = data
    ? [
        { label: "Blacklisted Visitors", value: String(data.blacklisted_visitors), icon: Ban, color: "text-red-600", bg: "bg-red-50" },
        { label: "Blacklisted Vehicles", value: String(data.blacklisted_vehicles), icon: Car, color: "text-orange-600", bg: "bg-orange-50" },
        { label: "Rejected Requests", value: String(data.rejected_requests), icon: XCircle, color: "text-rose-600", bg: "bg-rose-50" },
        { label: "Active Passes", value: String(data.active_passes), icon: Ticket, color: "text-[#155DFC]", bg: "bg-blue-50" },
      ]
    : []

  const registeredVisitors = data?.registered_visitors ?? []
  const recentRegistrations = data?.recent_registrations ?? []

  return (
    <div className="flex flex-col">
      <div className="flex flex-col self-stretch gap-9">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[#101727] text-3xl font-bold">Visitor Management Overview</h1>
            <p className="text-[#697282] text-base">
              Live metrics and recent activity from your visitor registrations.
            </p>
          </div>
          {data && (
            <p className="text-[#697282] text-sm shrink-0">
              Registered today: <span className="font-semibold text-[#101727]">{data.visitors_registered_today}</span>
            </p>
          )}
        </div>

        {isError && (
          <Card className="rounded-[10px] border-red-200 bg-red-50">
            <CardContent className="py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-red-800 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{error instanceof Error ? error.message : "Failed to load dashboard"}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stat cards row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="rounded-[10px] border-gray-200 py-6 px-6 animate-pulse">
                  <CardContent className="p-0 h-16 bg-gray-100 rounded" />
                </Card>
              ))
            : statsRow1.map((stat) => (
                <Card key={stat.label} className="rounded-[10px] border-gray-200 py-6 px-6">
                  <CardContent className="p-0 flex justify-between items-start">
                    <div>
                      <p className="text-[#697282] text-base">{stat.label}</p>
                      <p className="text-[#101727] text-[32px] font-bold">{stat.value}</p>
                    </div>
                    <div className={`w-11 h-11 rounded-lg ${stat.bg} flex items-center justify-center ${stat.color}`}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>

        {/* Stat cards row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="rounded-[10px] border-gray-200 py-6 px-6 animate-pulse">
                  <CardContent className="p-0 h-16 bg-gray-100 rounded" />
                </Card>
              ))
            : statsRow2.map((stat) => (
                <Card key={stat.label} className="rounded-[10px] border-gray-200 py-6 px-6">
                  <CardContent className="p-0 flex justify-between items-start">
                    <div>
                      <p className="text-[#697282] text-base">{stat.label}</p>
                      <p className="text-[#101727] text-[32px] font-bold">{stat.value}</p>
                    </div>
                    <div className={`w-11 h-11 rounded-lg ${stat.bg} flex items-center justify-center ${stat.color}`}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>

        {/* Registration Modules */}
        <div className="flex flex-col gap-3">
          <h2 className="text-[#101727] text-lg font-bold">Registration Modules</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link to={ROUTES.PRE_REGISTRATION}>
              <Card className="rounded-lg border-2 border-[#77A2FF] shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <FileEdit className="w-8 h-8 text-[#155DFC] mb-2" />
                  <h3 className="text-[#101727] text-sm font-semibold mb-1">Pre-Registration</h3>
                  <p className="text-[#697282] text-xs leading-snug mb-2 line-clamp-2">
                    Online registration before arrival with visit purpose and department.
                  </p>
                  <span className="text-[#155CFB] text-xs font-medium inline-flex items-center gap-0.5">
                    New Request <ChevronRight className="w-3 h-3" />
                  </span>
                </CardContent>
              </Card>
            </Link>
            <Link to={ROUTES.WALK_IN_REGISTRATION}>
              <Card className="rounded-lg border border-gray-200 hover:border-[#77A2FF]/50 transition-colors">
                <CardContent className="p-4">
                  <UserPlus className="w-8 h-8 text-[#155DFC] mb-2" />
                  <h3 className="text-[#101727] text-sm font-semibold mb-1">Walk-In Registration</h3>
                  <p className="text-[#697282] text-xs leading-snug mb-2 line-clamp-2">
                    On-site registration by receptionist or kiosk.
                  </p>
                  <span className="text-[#155CFB] text-xs font-medium">Start Check-In</span>
                </CardContent>
              </Card>
            </Link>
            <Link to={ROUTES.PRE_REGISTRATION}>
              <Card className="rounded-lg border border-gray-200 hover:border-[#77A2FF]/50 transition-colors">
                <CardContent className="p-4">
                  <ClipboardCheck className="w-8 h-8 text-[#155DFC] mb-2" />
                  <h3 className="text-[#101727] text-sm font-semibold mb-1">Pending Approval</h3>
                  <p className="text-[#697282] text-xs leading-snug mb-2">
                    {data
                      ? `${data.pending_approval} awaiting approval`
                      : "Pending scheduled or walk-in visits"}
                  </p>
                  <span className="text-[#155CFB] text-xs font-medium">Review queue</span>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Registered Visitors table */}
        <Card className="rounded-[10px] border-gray-200 overflow-hidden">
          <div className="pt-4 pl-6 pb-1 flex items-center justify-between pr-6">
            <h2 className="text-[#101727] text-xl font-bold">Registered Visitors</h2>
            {isLoading && <Loader2 className="h-5 w-5 animate-spin text-[#155DFC]" />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-7 text-[#697282] text-sm font-bold">Reg ID</th>
                  <th className="text-left py-3 px-4 text-[#697282] text-sm font-bold">Date</th>
                  <th className="text-left py-3 px-4 text-[#697282] text-sm font-bold">Visitor Name</th>
                  <th className="text-left py-3 px-4 text-[#697282] text-sm font-bold">Organization</th>
                  <th className="text-left py-3 px-4 text-[#697282] text-sm font-bold">Vehicle ID</th>
                  <th className="text-left py-3 px-4 text-[#697282] text-sm font-bold">Status</th>
                  <th className="text-left py-3 px-4 text-[#697282] text-sm font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#697282] text-sm">
                      Loading visitors…
                    </td>
                  </tr>
                ) : registeredVisitors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#697282] text-sm">
                      No approved registrations yet.
                    </td>
                  </tr>
                ) : (
                  registeredVisitors.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="py-5 px-7 text-[#495565] text-xs">{row.reg_id}</td>
                      <td className="py-5 px-4 text-[#495565] text-xs">{row.date}</td>
                      <td className="py-5 px-4 text-[#495565] text-xs">{row.visitor_name}</td>
                      <td className="py-5 px-4 text-[#495565] text-xs">{row.organization}</td>
                      <td className="py-5 px-4 text-[#495565] text-xs">{row.vehicle_id}</td>
                      <td className="py-5 px-4">
                        <span
                          className={`inline-block py-1 px-3 rounded-[21px] text-sm font-medium ${clearanceStatusClass(row.status)}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-5 px-4">
                        <VisitorRegistrationActions row={row} onDeleteClick={setDeleteTarget} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <RecentRegistrationsTable
          rows={recentRegistrations}
          isLoading={isLoading}
          onDeleteClick={setDeleteTarget}
        />
        <VisitorDeleteDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />
      </div>
    </div>
  )
}
