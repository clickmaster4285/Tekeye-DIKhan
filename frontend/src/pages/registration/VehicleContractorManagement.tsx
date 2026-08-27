import { Link } from "react-router-dom"
import { ROUTES } from "@/routes/config"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Truck } from "lucide-react"

export default function VehicleContractorManagementPage() {
  return (
    <>
      <nav className="text-sm text-muted-foreground mb-2">
        <Link to={ROUTES.DASHBOARD} className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Visitor Management System</span>
        <span className="mx-2">/</span>
        <span className="text-[#3b82f6]">Vehicle & Contractor Management</span>
      </nav>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Vehicle & Contractor Management</h1>
        <p className="text-sm text-muted-foreground">Manage vehicle entries and contractor visits.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Vehicle & Contractor Management
          </CardTitle>
          <CardDescription>This module is under the Visitor Management System. Content coming soon.</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </>
  )
}
