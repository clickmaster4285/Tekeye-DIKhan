import React from "react"
import { Users, ClipboardCheck, Clock, UserCheck } from "lucide-react"

interface StatCard {
  label: string
  value: string | number
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  trend?: { value: string; positive: boolean }
}

export function StatsCards() {
  const stats: StatCard[] = [
    {
      label: "Registered Today",
      value: 42,
      icon: <Users className="h-5 w-5" />,
      iconBg: "bg-[#dbeafe]",
      iconColor: "text-[#3b82f6]",
      trend: { value: "", positive: true },
    },
    {
      label: "Pre-Registered",
      value: 18,
      icon: <ClipboardCheck className="h-5 w-5" />,
      iconBg: "bg-[#dcfce7]",
      iconColor: "text-[#22c55e]",
      trend: { value: "", positive: true },
    },
    {
      label: "Pending Check-in",
      value: 5,
      icon: <Clock className="h-5 w-5" />,
      iconBg: "bg-[#fef9c3]",
      iconColor: "text-[#eab308]",
    },
    {
      label: "Active Visitors",
      value: 156,
      icon: <UserCheck className="h-5 w-5" />,
      iconBg: "bg-[#f3e8ff]",
      iconColor: "text-[#a855f7]",
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-background rounded-xl border border-border p-4 flex items-center gap-4"
        >
          <div className={`w-12 h-12 rounded-lg ${stat.iconBg} ${stat.iconColor} flex items-center justify-center`}>
            {stat.icon}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
