import { useNavigate } from "react-router-dom"
import { UserPlus, Users } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ROUTES } from "@/routes/config"

export default function RecruitmentPage() {
  const navigate = useNavigate()

  return (
    <ModulePageLayout
      title="Recruitment"
      description="Hire and onboard staff into the collectorate directory."
      breadcrumbs={[{ label: "Human Resource" }, { label: "Recruitment" }]}
      actions={
        <Button onClick={() => navigate(ROUTES.ADD_STAFF)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add staff
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-5 w-5 text-[#155DFC]" />
              New hire
            </CardTitle>
            <CardDescription>Create a staff record, photos, and face enrollment.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(ROUTES.ADD_STAFF)}>Open add staff</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-[#155DFC]" />
              Staff directory
            </CardTitle>
            <CardDescription>Review existing employees and edit profiles.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate(ROUTES.EMPLOYEES)}>
              Open employees
            </Button>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
