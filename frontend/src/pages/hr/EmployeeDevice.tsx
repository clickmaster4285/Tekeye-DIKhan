import { useParams, Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { fetchStaffById } from "@/lib/staff-api"
import {
  disableMobileAccess,
  fetchMobileDevices,
  revokeMobileDevice,
  terminateMobileDeviceSession,
  type MobileDeviceRecord,
} from "@/lib/mobile-admin-api"
import { ROUTES, getEmployeeDetailPath } from "@/routes/config"
import { useToast } from "@/hooks/use-toast"

function fmt(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—"
  return String(value)
}

function when(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString()
}

export default function EmployeeDevicePage() {
  const { id } = useParams()
  const staffId = Number(id)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: staff, isLoading: staffLoading } = useQuery({
    queryKey: ["staff", staffId],
    queryFn: () => fetchStaffById(staffId),
    enabled: Number.isFinite(staffId),
  })
  const userId = Number(staff?.user_details?.id ?? staff?.user_id ?? staff?.user)
  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["mobile-devices", userId],
    queryFn: () => fetchMobileDevices({ userId }),
    enabled: Number.isFinite(userId),
  })

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["mobile-devices", userId] })
    void queryClient.invalidateQueries({ queryKey: ["staff"] })
  }

  const revoke = useMutation({
    mutationFn: (device: MobileDeviceRecord) => revokeMobileDevice(device.id, "Revoked from staff device page"),
    onSuccess: () => {
      toast({ title: "Device revoked" })
      refresh()
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  })
  const terminate = useMutation({
    mutationFn: (device: MobileDeviceRecord) => terminateMobileDeviceSession(device.id),
    onSuccess: () => {
      toast({ title: "Session terminated. Staff must sign in again." })
      refresh()
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  })
  const disable = useMutation({
    mutationFn: (device: MobileDeviceRecord) => disableMobileAccess(device.id),
    onSuccess: () => {
      toast({ title: "Mobile access disabled" })
      refresh()
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  })

  return (
    <ModulePageLayout
      title="Staff device"
      description="Registered CIIS PWA device, session, and GPS heartbeat status."
      breadcrumbs={[
        { label: "HR" },
        { label: "Employees", href: ROUTES.EMPLOYEES },
        { label: staff?.full_name || "Employee", href: getEmployeeDetailPath(staffId) },
        { label: "Device" },
      ]}
    >
      {staffLoading || isLoading ? <p className="text-sm text-muted-foreground mb-4">Loading device…</p> : null}
      <div className="mb-4">
        <Button variant="outline" asChild>
          <Link to={getEmployeeDetailPath(staffId)}>Back to employee</Link>
        </Button>
      </div>
      {devices.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            No CIIS mobile app is registered for this employee.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {devices.map((device) => (
            <Card key={device.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {device.device_name || "CIIS PWA"}
                  <Badge variant={device.logged_in ? "default" : "outline"}>
                    {device.logged_in ? "Logged in" : device.session_status || "Signed out"}
                  </Badge>
                  <Badge variant={device.is_revoked ? "destructive" : "secondary"}>{device.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
                <p><span className="text-muted-foreground">Staff name:</span> {fmt(device.staff_name)}</p>
                <p><span className="text-muted-foreground">Device UUID:</span> <span className="break-all">{device.device_uuid}</span></p>
                <p><span className="text-muted-foreground">Platform:</span> {fmt(device.platform)}</p>
                <p><span className="text-muted-foreground">OS:</span> {fmt(device.os_version)}</p>
                <p><span className="text-muted-foreground">Browser:</span> {fmt(device.browser)}</p>
                <p><span className="text-muted-foreground">CIIS app version:</span> {fmt(device.app_version || device.pwa_version)}</p>
                <p><span className="text-muted-foreground">Registered at:</span> {when(device.registered_at)}</p>
                <p><span className="text-muted-foreground">Last seen:</span> {when(device.last_seen_at)}</p>
                <p><span className="text-muted-foreground">Last GPS:</span> {when(device.last_gps_at)}</p>
                <p><span className="text-muted-foreground">Battery:</span> {device.battery_level ?? "—"}%</p>
                <p><span className="text-muted-foreground">GPS status:</span> {fmt(device.last_gps_status)}</p>
                <p><span className="text-muted-foreground">Session status:</span> {fmt(device.session_status)}</p>
                <p><span className="text-muted-foreground">Device status:</span> {fmt(device.status)}</p>
                <div className="sm:col-span-2 flex flex-wrap gap-2 pt-3">
                  <Button variant="outline" onClick={() => terminate.mutate(device)}>
                    Terminate session / Force re-login
                  </Button>
                  <Button variant="outline" onClick={() => disable.mutate(device)}>
                    Disable mobile access
                  </Button>
                  <Button variant="destructive" onClick={() => revoke.mutate(device)}>
                    Revoke device
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to={ROUTES.GPS_TRACKING}>Open map</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ModulePageLayout>
  )
}
