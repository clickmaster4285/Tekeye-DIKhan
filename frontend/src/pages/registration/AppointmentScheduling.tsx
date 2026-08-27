import { Calendar, Clock, UserCheck, Users, MoreVertical } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { ROUTES } from "@/routes/config"

const stats = [
  {
    label: "Scheduled Today",
    value: "24",
    icon: Calendar,
    bgColor: "bg-blue-50",
    iconColor: "text-blue-500",
  },
  {
    label: "Confirmed",
    value: "18",
    icon: UserCheck,
    bgColor: "bg-green-50",
    iconColor: "text-green-500",
  },
  {
    label: "Pending Approval",
    value: "6",
    icon: Clock,
    bgColor: "bg-yellow-50",
    iconColor: "text-yellow-500",
  },
  {
    label: "Available Slots",
    value: "32",
    icon: Users,
    bgColor: "bg-purple-50",
    iconColor: "text-purple-500",
  },
]

const modules = [
  {
    icon: Clock,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    title: "Time Slot Booking",
    description: "Schedule your visit based on the department availability.",
    link: ROUTES.TIME_SLOT_BOOKING,
    linkText: "View Slots",
  },
  {
    icon: UserCheck,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    title: "Host Selection",
    description: "Select the one who host to visit.",
    link: ROUTES.HOST_SELECTION,
    linkText: "Select Host",
  },
  {
    icon: Calendar,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    title: "Visit Purpose",
    description: "Select visit type (official, meeting, contractor, interview, etc.)",
    link: ROUTES.VISIT_PURPOSE,
    linkText: "Set Purpose",
  },
]

const recentAppointments = [
  {
    id: 1,
    name: "Ahmed Ali",
    avatar: "",
    type: "Official visit",
    department: "Human Relations",
    status: "Confirmed",
    statusColor: "bg-green-100 text-green-700",
    time: "9:15 AM",
  },
  {
    id: 2,
    name: "Hassan Sheikh",
    avatar: "",
    type: "Vendor Meeting",
    department: "IT Department",
    status: "Confirmed",
    statusColor: "bg-green-100 text-green-700",
    time: "11:45 AM",
  },
  {
    id: 3,
    name: "Muhammad Khan",
    avatar: "",
    type: "Interview",
    department: "Operations",
    status: "Pending",
    statusColor: "bg-yellow-100 text-yellow-700",
    time: "1:30 PM",
  },
  {
    id: 4,
    name: "Ayaan Mirza",
    avatar: "",
    type: "Contractor",
    department: "Maintenance",
    status: "",
    statusColor: "",
    time: "3:00 PM",
  },
]

export default function AppointmentSchedulingPage() {
  return (
    <>
      {/* Breadcrumb */}
          <div className="text-sm text-muted-foreground mb-2">
            Home / Appointment Scheduling / <span className="text-blue-600">Overview</span>
          </div>

          {/* Page Title */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Appointment Scheduling Overview</h1>
              <p className="text-sm text-muted-foreground">
                Manage appointment bookings, host assignments, and visit schedules efficiently.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar size={16} />
              <span>Today, January 22, 2025</span>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, index) => (
              <div key={index} className="bg-white rounded-lg border p-4 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={stat.iconColor} size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-semibold">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Scheduling Modules */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Scheduling Modules</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {modules.map((module, index) => (
                <div key={index} className="bg-white rounded-lg border p-6">
                  <div className={`w-10 h-10 rounded-lg ${module.iconBg} flex items-center justify-center mb-4`}>
                    <module.icon className={module.iconColor} size={20} />
                  </div>
                  <h3 className="font-semibold mb-2">{module.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{module.description}</p>
                  <Link to={module.link} className="text-blue-600 text-sm font-medium hover:underline">
                    {module.linkText} &rarr;
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Calendar View */}
          <div className="mb-8">
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Calendar className="text-orange-600" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold">Calendar View</h3>
                  <p className="text-sm text-muted-foreground">Department-wise and officer-wise visit calendar</p>
                </div>
              </div>
              <Link to={ROUTES.CALENDAR_VIEW} className="text-blue-600 text-sm font-medium hover:underline">
                Open Calendar &rarr;
              </Link>
            </div>
          </div>

          {/* Recent Appointments */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Appointments</h2>
              <Link to="#" className="text-blue-600 text-sm font-medium hover:underline">
                View All
              </Link>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Visitor Name</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Department</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Time</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAppointments.map((appointment) => (
                    <tr key={appointment.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={appointment.avatar || "/placeholder.svg"} />
                            <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                              {appointment.name.split(" ").map((n) => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">{appointment.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{appointment.type}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{appointment.department}</td>
                      <td className="px-4 py-3">
                        {appointment.status && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${appointment.statusColor}`}>
                            {appointment.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{appointment.time}</td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
    </>
  )
}
