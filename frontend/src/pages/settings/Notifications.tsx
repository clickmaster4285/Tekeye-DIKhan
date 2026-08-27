
import { Bell, Mail, MessageSquare, Shield } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export default function NotificationsPage() {
  return (
    <ModulePageLayout
      title="Notifications"
      description="Configure email, in-app, and SMS notification preferences."
      breadcrumbs={[{ label: "System configuration" }, { label: "Notifications" }]}
    >
      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-[#3b82f6]" />
              Email Notifications
            </CardTitle>
            <CardDescription>Choose which events trigger email alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Visitor pre-registration approved", desc: "When a visit is confirmed" },
              { label: "Low stock alerts", desc: "When inventory falls below reorder point" },
              { label: "Leave request submitted", desc: "When an employee applies for leave" },
              { label: "System alerts", desc: "Critical system and security events" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <Label className="font-medium">{item.label}</Label>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
                <Switch defaultChecked />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-[#3b82f6]" />
              In-App Notifications
            </CardTitle>
            <CardDescription>Show notifications in the dashboard header</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <Label className="font-medium">Enable in-app notifications</Label>
                <p className="text-sm text-muted-foreground">Bell icon in header</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[#3b82f6]" />
              SMS (Optional)
            </CardTitle>
            <CardDescription>OTP and critical alerts via SMS when gateway is configured</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <Label className="font-medium">SMS for OTP</Label>
                <p className="text-sm text-muted-foreground">Login and password reset</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white">
            Save Preferences
          </Button>
        </div>
      </div>
    </ModulePageLayout>
  )
}
