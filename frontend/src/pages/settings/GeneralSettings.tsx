
import { Settings, Building2, Globe, Mail } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export default function GeneralSettingsPage() {
  return (
    <ModulePageLayout
      title="General Settings"
      description="Organization name, timezone, language, and global preferences."
      breadcrumbs={[{ label: "System configuration" }, { label: "General Settings" }]}
    >
      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#3b82f6]" />
              Organization
            </CardTitle>
            <CardDescription>Organization name and contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input id="org-name" defaultValue="Pakistan Customs" className="max-w-md" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-address">Address</Label>
              <Input id="org-address" defaultValue="Customs House, Peshawer" className="max-w-md" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-email">Contact Email</Label>
              <Input id="org-email" type="email" defaultValue="support@customs.gov.pk" className="max-w-md" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-[#3b82f6]" />
              Regional
            </CardTitle>
            <CardDescription>Timezone, language, and date format</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" defaultValue="Asia/Karachi (PKT)" className="max-w-md" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Input id="language" defaultValue="English" className="max-w-md" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-format">Date Format</Label>
              <Input id="date-format" defaultValue="DD/MM/YYYY" className="max-w-md" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-[#3b82f6]" />
              Preferences
            </CardTitle>
            <CardDescription>System-wide behavior and notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <Label htmlFor="maintenance">Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">Disable login during maintenance</p>
              </div>
              <Switch id="maintenance" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <Label htmlFor="audit">Audit Logging</Label>
                <p className="text-sm text-muted-foreground">Log all user actions for compliance</p>
              </div>
              <Switch id="audit" defaultChecked />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white">
            Save Changes
          </Button>
        </div>
      </div>
    </ModulePageLayout>
  )
}
