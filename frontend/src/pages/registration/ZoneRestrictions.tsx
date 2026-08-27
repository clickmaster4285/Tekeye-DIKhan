import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ROUTES } from "@/routes/config"
import { locationLabel } from "@/lib/locations"
import { ZONE_TYPES } from "@/lib/gate-types"
import { fetchZones, updateZone, type SiteZoneRecord } from "@/lib/warehouse-zones-api"
import { getUserLocationFilter } from "@/lib/location-access"
import { loadGates } from "@/lib/gate-storage"

interface ZoneRestrictionFormData {
  zone_id: string
  zone_code: string
  zone_name: string
  warehouse_name: string
  warehouse_location: string
  category: string
  vms_zone_type: "Public" | "Restricted" | "High Security" | "Admin"
  requires_escort: boolean
  access_hours_start: string
  access_hours_end: string
  weekend_access: boolean
  max_occupancy: number
  allowed_categories: string[]
  gate_ids: string[]
  camera_ids: string[]
  zone_active: boolean
}

function mapSiteZoneToForm(zone: SiteZoneRecord): ZoneRestrictionFormData {
  return {
    zone_id: zone.id,
    zone_code: zone.code,
    zone_name: zone.name,
    warehouse_name: zone.warehouse_name,
    warehouse_location: zone.warehouse_location,
    category: zone.category,
    vms_zone_type: zone.vms_zone_type,
    requires_escort: zone.requires_escort,
    access_hours_start: zone.access_hours_start,
    access_hours_end: zone.access_hours_end,
    weekend_access: zone.weekend_access,
    max_occupancy: zone.max_occupancy,
    allowed_categories: zone.allowed_visitor_categories,
    gate_ids: zone.gate_ids,
    camera_ids: zone.camera_ids,
    zone_active: zone.is_active,
  }
}

function createEmptyForm(): ZoneRestrictionFormData {
  return {
    zone_id: "",
    zone_code: "",
    zone_name: "",
    warehouse_name: "",
    warehouse_location: "",
    category: "",
    vms_zone_type: "Public",
    requires_escort: false,
    access_hours_start: "06:00",
    access_hours_end: "22:00",
    weekend_access: false,
    max_occupancy: 0,
    allowed_categories: [],
    gate_ids: [],
    camera_ids: [],
    zone_active: true,
  }
}

export default function ZoneRestrictionsPage() {
  const locationFilter = getUserLocationFilter()
  const [open, setOpen] = useState(false)
  const [selectedZone, setSelectedZone] = useState<SiteZoneRecord | null>(null)
  const [formData, setFormData] = useState<ZoneRestrictionFormData>(createEmptyForm())
  const [gates, setGates] = useState<{ gate_id: string; gate_name: string }[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const zonesQuery = useQuery({
    queryKey: ["site-zones", locationFilter],
    queryFn: async () => fetchZones(locationFilter ? { location: locationFilter } : undefined),
    staleTime: 60_000,
  })

  useQuery({
    queryKey: ["vms-gates"],
    queryFn: async () => loadGates(),
    onSuccess: (result) => {
      setGates(result.map((gate) => ({ gate_id: gate.gate_id, gate_name: gate.gate_name })))
    },
  })

  const availableZones = zonesQuery.data ?? []
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)

  const filteredZones = useMemo(() => {
    const q = search.trim().toLowerCase()
    return availableZones.filter((zone) => {
      const matchesType =
        !typeFilter || typeFilter === "all" || zone.vms_zone_type === typeFilter
      const matchesSearch =
        q.length === 0 ||
        [
          zone.code,
          zone.name,
          zone.warehouse_code,
          zone.warehouse_name,
          zone.category,
          zone.vms_zone_type,
        ].some((value) => value?.toString().toLowerCase().includes(q))
      return matchesType && matchesSearch
    })
  }, [availableZones, search, typeFilter])

  const startEdit = (zone: SiteZoneRecord) => {
    setSelectedZone(zone)
    setFormData(mapSiteZoneToForm(zone))
    setSaveError(null)
    setOpen(true)
  }

  const closeDialog = () => {
    setOpen(false)
    setSelectedZone(null)
    setFormData(createEmptyForm())
    setSaveError(null)
  }

  const onSave = async () => {
    if (!selectedZone) return
    try {
      setSaving(true)
      setSaveError(null)
      await updateZone(selectedZone.id, {
        requires_escort: formData.requires_escort,
        access_hours_start: formData.access_hours_start,
        access_hours_end: formData.access_hours_end,
        weekend_access: formData.weekend_access,
        max_occupancy: formData.max_occupancy,
        allowed_visitor_categories: formData.allowed_categories,
        gate_ids: formData.gate_ids,
        camera_ids: formData.camera_ids,
        vms_zone_type: formData.vms_zone_type,
        is_active: formData.zone_active,
      })
      await zonesQuery.refetch()
      closeDialog()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update zone")
    } finally {
      setSaving(false)
    }
  }

  const breadcrumbs = [
    { label: "Home", href: ROUTES.DASHBOARD },
    { label: "Visitor Management System" },
    { label: "Access Control" },
    { label: "Zone Restrictions" },
  ]

  const locationFilterLabel = locationFilter ? locationLabel(locationFilter) : "All locations"

  return (
    <>
      <nav className="text-sm text-muted-foreground mb-2">
        {breadcrumbs.map((bc, i) => (
          <span key={`${bc.label}-${i}`}>
            {bc.href ? (
              <Link to={bc.href} className="hover:text-foreground">
                {bc.label}
              </Link>
            ) : (
              <span
                className={
                  i === breadcrumbs.length - 1 ? "text-[#3b82f6]" : "text-foreground"
                }
              >
                {bc.label}
              </span>
            )}
            {i < breadcrumbs.length - 1 && <span className="mx-2">/</span>}
          </span>
        ))}
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Zone Restrictions</h1>
        <p className="text-sm text-muted-foreground">
          Manage visitor access rules on shared WMS zone records. Zones are created by Warehouse Setup and shared across VMS.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Showing zones for: <span className="font-medium text-foreground">{locationFilterLabel}</span>
        </p>
      </div>

      {zonesQuery.isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            {zonesQuery.error instanceof Error ? zonesQuery.error.message : "Failed to load zones."}
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-4">
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Zones are no longer stored in a separate VMS blob. This page edits access fields on shared SiteZone records from the warehouse system.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle>Zone access rules</CardTitle>
              <CardDescription>
                Select a zone to update escort, occupancy, schedule, and linked gates.
              </CardDescription>
            </div>
            <div className="flex flex-col md:flex-row gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search zone code, name, warehouse..."
                className="md:w-72"
              />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="md:w-48 h-11 text-sm bg-background border-border rounded-md focus:ring-2 focus:ring-[#3b82f6]/20">
                  <SelectValue placeholder="Zone type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="py-2.5">
                    All
                  </SelectItem>
                  {ZONE_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="py-2.5">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Warehouse</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>VMS Type</TableHead>
                <TableHead>Security</TableHead>
                <TableHead>Weekend</TableHead>
                <TableHead>Active</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {zonesQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading zones…
                  </TableCell>
                </TableRow>
              ) : filteredZones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No zones found for your location.
                  </TableCell>
                </TableRow>
              ) : (
                filteredZones.map((zone) => (
                  <TableRow key={zone.id}>
                    <TableCell>{zone.warehouse_name}</TableCell>
                    <TableCell>{locationLabel(zone.warehouse_location)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{zone.name}</div>
                      <div className="text-xs text-muted-foreground">{zone.code}</div>
                    </TableCell>
                    <TableCell>{zone.vms_zone_type}</TableCell>
                    <TableCell>{zone.security_level}</TableCell>
                    <TableCell>{zone.weekend_access ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <Badge variant={zone.is_active ? "default" : "secondary"}>
                        {zone.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => startEdit(zone)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) closeDialog(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Zone Access</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Update visitor access rules for this shared warehouse zone.
            </p>
          </DialogHeader>

          {saveError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2 rounded-md border bg-muted p-4">
              <div className="text-sm text-muted-foreground">Warehouse</div>
              <div className="font-medium">{formData.warehouse_name}</div>
              <div className="text-sm text-muted-foreground">Zone</div>
              <div className="font-medium">{formData.zone_name} ({formData.zone_code})</div>
              <div className="space-y-1.5">
                <Label>Zone type</Label>
                <Select value={formData.vms_zone_type} onValueChange={(v) => setFormData((prev) => ({ ...prev, vms_zone_type: v as ZoneRestrictionFormData["vms_zone_type"] }))}>
                  <SelectTrigger className="w-full h-11 text-sm bg-background border-border rounded-md focus:ring-2 focus:ring-[#3b82f6]/20">
                    <SelectValue placeholder="Select zone type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ZONE_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="py-2.5">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Max occupancy</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.max_occupancy}
                  onChange={(e) => setFormData((prev) => ({ ...prev, max_occupancy: Number(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Access hours start</Label>
                <Input
                  type="time"
                  value={formData.access_hours_start}
                  onChange={(e) => setFormData((prev) => ({ ...prev, access_hours_start: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Access hours end</Label>
                <Input
                  type="time"
                  value={formData.access_hours_end}
                  onChange={(e) => setFormData((prev) => ({ ...prev, access_hours_end: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Allowed visitor categories</Label>
              <Input
                value={formData.allowed_categories.join(", ")}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    allowed_categories: e.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="e.g. contractor, staff"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Gate IDs</Label>
              <div className="flex flex-wrap gap-3 rounded-md border p-3">
                {gates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No gates available.</p>
                ) : (
                  gates.map((gate) => (
                    <div key={gate.gate_id} className="flex items-center gap-2">
                      <Checkbox
                        id={`gate-${gate.gate_id}`}
                        checked={formData.gate_ids.includes(gate.gate_id)}
                        onCheckedChange={(checked) => {
                          setFormData((prev) => ({
                            ...prev,
                            gate_ids:
                              checked === true
                                ? [...prev.gate_ids, gate.gate_id]
                                : prev.gate_ids.filter((id) => id !== gate.gate_id),
                          }))
                        }}
                      />
                      <Label htmlFor={`gate-${gate.gate_id}`} className="text-sm font-normal cursor-pointer">
                        {gate.gate_name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Camera IDs</Label>
              <Input
                value={formData.camera_ids.join(", ")}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    camera_ids: e.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="Comma-separated camera IDs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="requires_escort"
                  checked={formData.requires_escort}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, requires_escort: checked }))}
                />
                <Label htmlFor="requires_escort">Requires escort</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="weekend_access"
                  checked={formData.weekend_access}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, weekend_access: checked }))}
                />
                <Label htmlFor="weekend_access">Weekend access</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="zone_active"
                  checked={formData.zone_active}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, zone_active: checked }))}
                />
                <Label htmlFor="zone_active">Zone active</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button onClick={onSave} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
