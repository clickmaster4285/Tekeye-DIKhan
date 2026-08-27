
import { Plug, Settings } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"

export default function IntegrationsPage() {
  const integrations = [
    { name: "ERP System", desc: "SAP / Oracle integration for inventory sync", status: "Connected", enabled: true },
    { name: "Customs Portal", desc: "FBR / Customs clearance API", status: "Connected", enabled: true },
    { name: "Email (SMTP)", desc: "Transactional and notification emails", status: "Connected", enabled: true },
    { name: "SMS Gateway", desc: "OTP and alerts via SMS", status: "Configured", enabled: false },
    { name: "Biometric Devices", desc: "Attendance and access control", status: "Connected", enabled: true },
    { name: "CCTV / NVR", desc: "Camera feeds for WMS", status: "Connected", enabled: true },
  ]

  return (
    <ModulePageLayout
      title="Integrations"
      description="Connect external systems, APIs, and third-party services."
      breadcrumbs={[{ label: "System configuration" }, { label: "Integrations" }]}
    >
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-[#3b82f6]" />
              Connected Services
            </CardTitle>
            <CardDescription>Enable or disable integrations and view connection status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {integrations.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-lg border border-border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Plug className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={item.status === "Connected" ? "default" : "secondary"}>
                      {item.status}
                    </Badge>
                    <Switch defaultChecked={item.enabled} />
                    <Button variant="ghost" size="sm" className="text-[#3b82f6]">
                      <Settings className="h-4 w-4 mr-1" />
                      Configure
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
