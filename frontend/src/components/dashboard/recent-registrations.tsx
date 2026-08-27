import { useQuery } from "@tanstack/react-query"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MoreHorizontal } from "lucide-react"
import { fetchVisitors, getVisitorCreatedBy, type VisitorRecord } from "@/lib/visitor-api"

interface Registration {
  id: number
  name: string
  avatar?: string
  initials: string
  type: string
  department: string
  status: "Checked In" | "Approved" | "Pending Docs" | "Checked In"
  time: string
  createdBy: string
}

function formatTime(value: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

function mapVisitor(visitor: VisitorRecord): Registration {
  const parts = visitor.full_name?.trim().split(/\s+/).filter(Boolean) ?? []
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0]
        ? parts[0].slice(0, 2).toUpperCase()
        : "??"
  return {
    id: visitor.id,
    name: visitor.full_name || "Unknown Visitor",
    initials,
    avatar: "",
    type: "Visitor",
    department: visitor.department_to_visit || "—",
    status: "Approved",
    time: formatTime(visitor.created_at),
  }
}

export function RecentRegistrations() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["visitors", "pre-registration"],
    queryFn: () => fetchVisitors("pre-registration"),
  })

  const registrations = (data ?? []).map(mapVisitor).slice(0, 6)

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Checked In":
        return "bg-[#dbeafe] text-[#3b82f6]"
      case "Approved":
        return "bg-[#dcfce7] text-[#22c55e]"
      case "Pending Docs":
        return "bg-[#fef9c3] text-[#ca8a04]"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">Recent Registrations</h2>
        <button className="text-sm text-[#3b82f6] hover:underline">View All</button>
      </div>
      <div className="bg-background rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Visitor Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Type
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Department
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Created by
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Time
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr className="border-b border-border last:border-0">
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Loading registrations…
                </td>
              </tr>
            ) : isError ? (
              <tr className="border-b border-border last:border-0">
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-destructive">
                  {error instanceof Error ? error.message : "Failed to load registrations."}
                </td>
              </tr>
            ) : registrations.length === 0 ? (
              <tr className="border-b border-border last:border-0">
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No registrations found.
                </td>
              </tr>
            ) : (
              registrations.map((registration) => (
                <tr key={registration.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={registration.avatar || "/placeholder.svg"} />
                        <AvatarFallback className="text-xs">{registration.initials}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-foreground">{registration.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">{registration.type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">{registration.department || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusStyle(registration.status)}`}
                    >
                      {registration.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">{registration.createdBy}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">{registration.time}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="p-1 rounded hover:bg-muted transition-colors">
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
