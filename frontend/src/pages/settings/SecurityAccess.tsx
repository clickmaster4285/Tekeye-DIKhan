
import { Shield, Lock, Key, History } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export default function SecurityAccessPage() {
  return (
    <ModulePageLayout
      title="Security & Access"
      description="Password policy, session timeout, and access control settings."
      breadcrumbs={[{ label: "System configuration" }, { label: "Security & Access" }]}
    >
      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-[#3b82f6]" />
              Password Policy
            </CardTitle>
            <CardDescription>Minimum requirements for user passwords</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="min-length">Minimum Length</Label>
              <Input id="min-length" type="number" defaultValue="8" className="max-w-[120px]" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <Label className="font-medium">Require uppercase & numbers</Label>
                <p className="text-sm text-muted-foreground">At least one of each</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <Label className="font-medium">Password expiry (days)</Label>
                <p className="text-sm text-muted-foreground">Force change after N days</p>
              </div>
              <Input type="number" defaultValue="90" className="w-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-[#3b82f6]" />
              Session & Login
            </CardTitle>
            <CardDescription>Session timeout and concurrent login rules</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timeout">Session Timeout (minutes)</Label>
              <Input id="timeout" type="number" defaultValue="30" className="max-w-[120px]" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <Label className="font-medium">Single session per user</Label>
                <p className="text-sm text-muted-foreground">Log out other devices on new login</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-[#3b82f6]" />
              Audit Log
            </CardTitle>
            <CardDescription>Retain login and sensitive action logs for compliance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <Label className="font-medium">Enable audit logging</Label>
                <p className="text-sm text-muted-foreground">Log logins, role changes, and config updates</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white">
            Save Security Settings
          </Button>
        </div>
      </div>
    </ModulePageLayout>
  )
}
