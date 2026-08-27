import { useState, useCallback, useEffect } from "react"
import { Outlet } from "react-router-dom"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { ActivityLogger } from "@/components/activity-logger"
import { OfficerGpsReporter } from "@/components/gps/officer-gps-reporter"
import { SessionPermissionSync } from "@/components/session-permission-sync"
import { getStoredUser } from "@/lib/auth"
import { getNavSectionsForRole, type NavGroup, type NavItem } from "@/routes/config"
import { prefetchHrefsIdle, prefetchPriorityPages } from "@/routes/prefetch"

function collectNavHrefs(limit = 80): string[] {
  const user = getStoredUser()
  const sections = getNavSectionsForRole(user?.role, user?.allowed_modules)
  const hrefs: string[] = ["/"]
  const walk = (nodes: (NavItem | NavGroup)[]) => {
    for (const node of nodes) {
      if ("href" in node) {
        hrefs.push(node.href)
        continue
      }
      if (node.overviewHref) hrefs.push(node.overviewHref)
      walk(node.children)
    }
  }
  for (const section of sections) walk(section.items)
  return [...new Set(hrefs)].slice(0, limit)
}

export function DashboardLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), [])
  const setMobileOpen = useCallback((open: boolean) => setMobileSidebarOpen(open), [])

  useEffect(() => {
    prefetchPriorityPages()
    const id = window.setTimeout(() => prefetchHrefsIdle(collectNavHrefs()), 50)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <div className="flex min-h-screen min-w-0 max-w-full overflow-x-hidden bg-[#f8fafc]">
      <ActivityLogger />
      <OfficerGpsReporter />
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
