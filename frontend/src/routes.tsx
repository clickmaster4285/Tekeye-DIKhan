/**
 * App router
 *
 * Structure:
 *   /           → AuthGuard (checks login)
 *   /login      → Login page
 *   /           → DashboardLayout (sidebar + header)
 *     /         → Dashboard (home)
 *     /pre-registration, /warehouse-setup, ... → other pages
 *   /*          → 404 Not found
 */
import { Suspense, useEffect, useState } from "react"
import { createBrowserRouter } from "react-router-dom"
import { AuthGuard } from "@/components/auth-guard"
import { DashboardLayout } from "@/components/dashboard-layout"
import { RouteErrorFallback } from "@/components/route-error-fallback"
import { Spinner } from "@/components/ui/spinner"
import { ROUTES } from "@/routes/config"
import { DASHBOARD_ROUTES } from "@/routes/route-list"
import { PAGES } from "@/routes/lazy-pages"

/** Avoid a spinner flash when the chunk is already cached. */
function DelayedRouteSpinner() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), 120)
    return () => window.clearTimeout(id)
  }, [])
  if (!show) return <div className="min-h-[8rem]" aria-hidden />
  return (
    <div className="flex items-center justify-center py-10">
      <Spinner className="h-6 w-6 text-[#3b82f6]" />
    </div>
  )
}

function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<DelayedRouteSpinner />}>{children}</Suspense>
}

// Build dashboard routes from the list: each item is either index (home) or path + page
const dashboardChildren = DASHBOARD_ROUTES.map((item) => {
  const Page = PAGES[item.page as keyof typeof PAGES]
  const el = <LazyRoute>{Page && <Page />}</LazyRoute>
  if (item.index) return { index: true as const, element: el }
  return { path: item.path!, element: el }
})

export const router = createBrowserRouter([
  {
    path: ROUTES.DASHBOARD,
    element: <AuthGuard />,
    errorElement: <RouteErrorFallback />,
    children: [
      { path: "login", element: <LazyRoute><PAGES.Login /></LazyRoute> },
      {
        element: <DashboardLayout />,
        errorElement: <RouteErrorFallback />,
        children: dashboardChildren,
      },
      { path: "*", element: <LazyRoute><PAGES.NotFound /></LazyRoute> },
    ],
  },
])
