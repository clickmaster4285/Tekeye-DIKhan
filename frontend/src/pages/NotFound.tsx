import { Link } from "react-router-dom"
import { Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ROUTES } from "@/routes/config"

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#f8fafc] px-4">
      <div className="text-center">
        <p className="text-8xl font-bold text-[#3b82f6]/20">404</p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>
      <Button asChild>
        <Link to={ROUTES.DASHBOARD} className="gap-2">
          <Home className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </Button>
    </div>
  )
}
