import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ROUTES } from "@/routes/config"
import type { Gate, GateType, DeviceType } from "@/lib/gate-types"
import { GATE_TYPES, DEVICE_TYPES } from "@/lib/gate-types"
import { loadGates, saveGates, loadZones, ensureDefaultZones } from "@/lib/gate-storage"

function generateGateId(): string {
  return `gate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const emptyGate = (gate_zone_id_ref: string = ""): Omit<Gate, "gate_id"> => ({
  gate_name: "",
  gate_type: "Both",
  device_type: "Turnstile",
  device_ip: "",
  device_port: 0,
  gate_zone_id_ref,
  qr_reader_attached: false,
  biometric_reader_attached: false,
  camera_id_ref: "",
  gate_active: true,
})

export default function GateIntegrationPage() {
  const [gates, setGatesState] = useState<Gate[]>([])
  const [zones, setZonesState] = useState<{ zone_id: string; zone_name: string }[]>([])
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState(emptyGate())

  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const z = await ensureDefaultZones()
      const g = await loadGates()
      if (!cancelled) {
        setZonesState(z.map((zone) => ({ zone_id: zone.zone_id, zone_name: zone.zone_name })))
        setGatesState(g)
        setHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    void saveGates(gates)
  }, [gates, hydrated])

  const zoneOptions = useMemo(() => zones, [zones])

  const filteredGates = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return gates
    return gates.filter(
      (g) =>
        (g.gate_name ?? "").toLowerCase().includes(q) ||
        (g.gate_id ?? "").toLowerCase().includes(q) ||
        (g.device_ip ?? "").toLowerCase().includes(q)
    )
  }, [gates, search])

  const getZoneName = (zoneId: string) =>
    zoneOptions.find((z) => z.zone_id === zoneId)?.zone_name ?? zoneId

  const onAdd = () => {
    if (!formData.gate_name?.trim() || !formData.device_ip?.trim() || !formData.gate_zone_id_ref?.trim())
      return
    const port = Number(formData.device_port) || 0
    const newGate: Gate = {
      ...formData,
      gate_id: generateGateId(),
      device_port: port,
    }
    setGatesState((prev) => [newGate, ...prev])
    setFormData(emptyGate())
    setOpen(false)
  }

  const breadcrumbs = [
    { label: "Home", href: ROUTES.DASHBOARD },
    { label: "Visitor Management System" },
    { label: "Access Control" },
    { label: "Gate Integration" },
  ]

  return (
    <>
      <nav className="text-sm text-muted-foreground mb-2">
        {breadcrumbs.map((bc, i) => (
          <span key={`${bc.label}-${i}`}>
            {bc.href ? (
              <Link to={bc.href} className="hover:text-foreground">{bc.label}</Link>
            ) : (
              <span className={i === breadcrumbs.length - 1 ? "text-[#3b82f6]" : "text-foreground"}>
                {bc.label}
              </span>
            )}
            {i < breadcrumbs.length - 1 && <span className="mx-2">/</span>}
          </span>
        ))}
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Gate Integration</h1>
        <p className="text-sm text-muted-foreground">
          Integration with turnstiles, doors, or barriers. Gate registry stored in the database.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <CardTitle>Gates</CardTitle>
              <CardDescription>Add and manage gates with zone, device type, IP, and readers.</CardDescription>
            </div>
            <div className="flex flex-col md:flex-row gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, ID, IP..."
                className="md:w-56"
              />
              <Button onClick={() => { setFormData(emptyGate()); setOpen(true) }}>Add gate</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gate ID</TableHead>
                  <TableHead>Gate name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>IP:Port</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>QR</TableHead>
                  <TableHead>Biometric</TableHead>
                  <TableHead>Camera</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      No gates. Click &quot;Add gate&quot; to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGates.map((g) => (
                    <TableRow key={g.gate_id}>
                      <TableCell className="font-mono text-xs">{g.gate_id.slice(0, 14)}…</TableCell>
                      <TableCell>{g.gate_name ?? "—"}</TableCell>
                      <TableCell>{g.gate_type}</TableCell>
                      <TableCell>{g.device_type}</TableCell>
                      <TableCell className="font-mono text-xs">{g.device_ip}:{g.device_port || "—"}</TableCell>
                      <TableCell title={g.gate_zone_id_ref}>{getZoneName(g.gate_zone_id_ref)}</TableCell>
                      <TableCell>{g.qr_reader_attached ? "Yes" : "No"}</TableCell>
                      <TableCell>{g.biometric_reader_attached ? "Yes" : "No"}</TableCell>
                      <TableCell>{g.camera_id_ref ? g.camera_id_ref.slice(0, 8) + "…" : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={g.gate_active ? "default" : "secondary"}>
                          {g.gate_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) setFormData(emptyGate()) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add gate</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Gate Registry: gate_name, gate_type, device_type, device_ip, device_port, zone, readers, camera, active.
            </p>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Gate name *</Label>
              <Input
                value={formData.gate_name}
                onChange={(e) => setFormData((p) => ({ ...p, gate_name: e.target.value.slice(0, 50) }))}
                placeholder="e.g. Main Turnstile"
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Gate type *</Label>
              <Select
                value={formData.gate_type}
                onValueChange={(v) => setFormData((p) => ({ ...p, gate_type: v as GateType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GATE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Device type *</Label>
              <Select
                value={formData.device_type}
                onValueChange={(v) => setFormData((p) => ({ ...p, device_type: v as DeviceType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Device IP (IPv4) *</Label>
              <Input
                value={formData.device_ip}
                onChange={(e) => setFormData((p) => ({ ...p, device_ip: e.target.value.slice(0, 15) }))}
                placeholder="e.g. 192.168.1.10"
                maxLength={15}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Device port *</Label>
              <Input
                type="number"
                min={0}
                max={65535}
                value={formData.device_port || ""}
                onChange={(e) => setFormData((p) => ({ ...p, device_port: Number(e.target.value) || 0 }))}
                placeholder="e.g. 502"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Zone * (ID + Name)</Label>
              <Select
                value={formData.gate_zone_id_ref}
                onValueChange={(v) => setFormData((p) => ({ ...p, gate_zone_id_ref: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  {zoneOptions.map((z) => (
                    <SelectItem key={z.zone_id} value={z.zone_id}>
                      {z.zone_name} ({z.zone_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {zoneOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">No zones in storage. Add zones to see them here.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Camera ID (optional)</Label>
              <Input
                value={formData.camera_id_ref}
                onChange={(e) => setFormData((p) => ({ ...p, camera_id_ref: e.target.value }))}
                placeholder="Camera registry ref"
              />
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="qr_reader"
                  checked={formData.qr_reader_attached}
                  onCheckedChange={(c) => setFormData((p) => ({ ...p, qr_reader_attached: c }))}
                />
                <Label htmlFor="qr_reader">QR reader attached</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="biometric"
                  checked={formData.biometric_reader_attached}
                  onCheckedChange={(c) => setFormData((p) => ({ ...p, biometric_reader_attached: c }))}
                />
                <Label htmlFor="biometric">Biometric reader attached</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="gate_active"
                  checked={formData.gate_active}
                  onCheckedChange={(c) => setFormData((p) => ({ ...p, gate_active: c }))}
                />
                <Label htmlFor="gate_active">Gate active</Label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={onAdd}>Add gate</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
