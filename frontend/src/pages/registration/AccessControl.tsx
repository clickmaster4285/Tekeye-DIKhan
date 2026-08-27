import { Link } from "react-router-dom"
import { ROUTES } from "@/routes/config"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DoorOpen } from "lucide-react"

export default function AccessControlPage() {
  return (
    <>
      <nav className="text-sm text-muted-foreground mb-2">
        <Link to={ROUTES.DASHBOARD} className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Visitor Management System</span>
        <span className="mx-2">/</span>
        <span className="text-[#3b82f6]">Access Control</span>
      </nav>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Access Control</h1>
        <p className="text-sm text-muted-foreground">Manage visitor access permissions and zones.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DoorOpen className="h-5 w-5" />
            Access Control
          </CardTitle>
          <CardDescription>This module is under the Visitor Management System. Content coming soon.</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </>
  )
}
