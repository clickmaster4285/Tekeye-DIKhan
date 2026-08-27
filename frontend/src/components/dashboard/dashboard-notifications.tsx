"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Bell } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function DashboardNotifications() {
  const [unreadCount] = useState(5)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full px-1 text-xs">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem>Mark all read</DropdownMenuItem>
        <DropdownMenuItem>New alert: Intrusion at Gate-01</DropdownMenuItem>
        <DropdownMenuItem>Camera Warehouse-2 offline</DropdownMenuItem>
        <DropdownMenuItem>Fire alert cleared</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
