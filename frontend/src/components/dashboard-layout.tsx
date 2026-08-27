import { useState, useCallback } from "react"
import { Outlet } from "react-router-dom"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { ActivityLogger } from "@/components/activity-logger"
import { SessionPermissionSync } from "@/components/session-permission-sync"

export function DashboardLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), [])
  const setMobileOpen = useCallback((open: boolean) => setMobileSidebarOpen(open), [])

  return (
    <div className="flex min-h-screen min-w-0 max-w-full overflow-x-hidden bg-[#f8fafc]">
      <ActivityLogger />
      <SessionPermissionSync />
      <Sidebar mobileOpen={mobileSidebarOpen} onMobileOpenChange={setMobileOpen} />
      <div className="flex min-w-0 w-full max-w-full flex-1 flex-col md:ml-[333px]">
        <Header onMenuClick={openMobileSidebar} />
        <main className="flex-1 min-w-0 w-full max-w-full px-3 pt-20 pb-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
