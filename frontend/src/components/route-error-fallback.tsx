import { useRouteError, isRouteErrorResponse, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { ROUTES } from "@/routes/config"

export function RouteErrorFallback() {
  const error = useRouteError()
  let message: string
  let isChunkLoadError = false
  if (isRouteErrorResponse(error)) {
    message =
      error.statusText ||
      (error.data as { message?: string })?.message ||
      "Something went wrong"
  } else if (error instanceof Error) {
    const msg = error.message || ""
    if (
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Loading chunk") ||
      msg.includes("dynamically imported module")
    ) {
      message =
        "This page failed to load. Often caused by a slow or unstable connection, or an outdated cache. Try refreshing the page."
      isChunkLoadError = true
    } else {
      message = msg
    }
  } else {
    message = "Failed to load this page. You can try again or go back."
  }

  const handleRetry = () => {
    window.location.reload()
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6">
      <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <span className="font-medium">Page could not be loaded</span>
      </div>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        {message}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {isChunkLoadError && (
          <Button onClick={handleRetry}>
            Retry
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link to="..">Go back</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to={ROUTES.DASHBOARD}>Dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
