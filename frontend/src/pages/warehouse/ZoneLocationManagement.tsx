"use client"

import { useEffect, useState } from "react"
import { MapPin, Layers, Box, Plus, AlertCircle, Loader2, RefreshCw } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LOCATION_OPTIONS, locationLabel } from "@/lib/locations"
import { getUserLocationFilter } from "@/lib/location-access"
import { fetchWarehouses, fetchZones, updateZone, createZone, deleteZone, ensureWarehouseZones, type SiteZoneRecord, type WarehouseRecord } from "@/lib/warehouse-zones-api"
import { zoneSecurityBadge } from "@/lib/warehouse-zones"

export default function ZoneLocationManagementPage() {
  const [locations, setLocations] = useState<string[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string | undefined>(undefined)
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | undefined>(undefined)
  const [zones, setZones] = useState<SiteZoneRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingZone, setEditingZone] = useState<SiteZoneRecord | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [newZoneDialogOpen, setNewZoneDialogOpen] = useState(false)
  const [zoneForm, setZoneForm] = useState({
    code: "",
    name: "",
    security_level: "standard" as "standard" | "restricted" | "high",
    sort_order: 1,
    description: "",
    is_active: true,
  })
  const [ensureLoading, setEnsureLoading] = useState(false)
  const locationFilter = getUserLocationFilter()
  const isLocationScoped = Boolean(locationFilter)

  const resetZoneForm = () => {
    setZoneForm({
      code: "",
      name: "",
      security_level: "standard",
      sort_order: zones.length + 1 || 1,
      description: "",
      is_active: true,
    })
  }

  // Initialize locations — lock to user's site for location admins
  useEffect(() => {
    if (locationFilter) {
      setLocations([locationFilter])
      setSelectedLocation(locationFilter)
      return
    }
    const locs = LOCATION_OPTIONS.map((o) => o.value)
    setLocations(locs)
    if (locs.length > 0) setSelectedLocation(locs[0])
  }, [locationFilter])

  // Load warehouses when location changes
  useEffect(() => {
    if (!selectedLocation) return
    loadWarehouses()
  }, [selectedLocation])

  // Load zones when warehouse changes
  useEffect(() => {
    if (!selectedWarehouse) return
    loadZones()
  }, [selectedWarehouse])

  const loadWarehouses = async () => {
    try {
      setError(null)
      const data = await fetchWarehouses(selectedLocation)
      setWarehouses(data)
      if (data.length > 0 && !selectedWarehouse) {
        setSelectedWarehouse(data[0].id)
      } else if (data.length === 0) {
        setZones([])
        setSelectedWarehouse(undefined)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load warehouses")
      setWarehouses([])
      setZones([])
    }
  }

  const loadZones = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchZones({ warehouse: selectedWarehouse })
      setZones(data.sort((a, b) => a.sort_order - b.sort_order))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load zones")
      setZones([])
    } finally {
      setLoading(false)
    }
  }

  const handleEnsureZones = async () => {
    if (!selectedWarehouse) return
    try {
      setEnsureLoading(true)
      setError(null)
      await ensureWarehouseZones(selectedWarehouse)
      await loadZones()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ensure zones")
    } finally {
      setEnsureLoading(false)
    }
  }

  const handleEditZone = (zone: SiteZoneRecord) => {
    setEditingZone({
      ...zone,
      description: zone.description || zone.purpose,
    })
    setEditDialogOpen(true)
  }

  const handleSaveZone = async () => {
    if (!editingZone) return
    try {
      setError(null)
      await updateZone(editingZone.id, {
        name: editingZone.name,
        description: editingZone.description,
        purpose: editingZone.description,
        is_active: editingZone.is_active,
      })
      setEditDialogOpen(false)
      setEditingZone(null)
      await loadZones()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update zone")
    }
  }

  const handleCreateZone = async () => {
    if (!selectedWarehouse) return
    try {
      setError(null)
      await createZone({
        warehouse: selectedWarehouse,
        code: zoneForm.code,
        name: zoneForm.name,
        purpose: zoneForm.description,
        security_level: zoneForm.security_level,
        sort_order: zoneForm.sort_order,
        description: zoneForm.description,
        is_active: zoneForm.is_active,
      })
      setNewZoneDialogOpen(false)
      resetZoneForm()
      await loadZones()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create zone")
    }
  }

  const handleDeleteZone = async (zoneId: string) => {
    if (!window.confirm("Remove this zone from the warehouse?")) return
    try {
      setError(null)
      await deleteZone(zoneId)
      await loadZones()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete zone")
    }
  }

  const selectedWarehouseObj = warehouses.find((w) => w.id === selectedWarehouse)
  const totalZones = zones.length
  const activeZones = zones.filter((z) => z.is_active).length

  return (
    <ModulePageLayout
      title="Zone & Location Management"
      description="All warehouses start with the same canonical zones. You can add new zones or remove zones for the selected warehouse."
      breadcrumbs={[{ label: "WMS" }, { label: "Zone & Location Management" }]}
    >
      <div className="grid gap-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="location-select">Location</Label>
              <Select
                value={selectedLocation}
                onValueChange={setSelectedLocation}
                disabled={isLocationScoped}
              >
                <SelectTrigger
                  id="location-select"
                  className="w-full md:w-80 h-11 text-sm bg-background border-border rounded-md focus:ring-2 focus:ring-[#3b82f6]/20"
                >
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc} value={loc} className="py-2.5">
                      {locationLabel(loc)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="warehouse-select">Warehouse</Label>
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger
                  id="warehouse-select"
                  className="w-full md:w-80 h-11 text-sm bg-background border-border rounded-md focus:ring-2 focus:ring-[#3b82f6]/20"
                >
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id} className="py-2.5">
                      {wh.code} - {wh.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Zones</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalZones}</div>
              <p className="text-xs text-muted-foreground mt-1">{activeZones} active</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Warehouse</CardTitle>
              <Box className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{selectedWarehouseObj?.code || "—"}</div>
              <p className="text-xs text-muted-foreground mt-1">{selectedWarehouseObj?.status || "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Security</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{zones.filter((z) => z.security_level === "high").length}</div>
              <p className="text-xs text-muted-foreground mt-1">High security zones</p>
            </CardContent>
          </Card>
        </div>

        {/* Zones Table */}
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-wrap items-center justify-between gap-4 space-y-0">
            <div className="min-w-0">
              <CardTitle>Zone Hierarchy</CardTitle>
              <CardDescription className="wrap-break-word">
                Canonical zones from master database. Edit description and active status only.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnsureZones}
                disabled={!selectedWarehouse || ensureLoading}
              >
                {ensureLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Ensure Zones
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  resetZoneForm()
                  setNewZoneDialogOpen(true)
                }}
                disabled={!selectedWarehouse}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Zone
              </Button>
            </div>
          </CardHeader>

          <CardContent className="w-full min-w-0 space-y-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : zones.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No zones for this warehouse. Click "Ensure Zones" to create the 7 canonical zones.</p>
              </div>
            ) : (
              <>
                {/* Mobile View */}
                <div className="divide-y rounded-lg border md:hidden">
                  {zones.map((zone) => (
                    <div key={zone.id} className="p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="truncate text-sm font-semibold">{zone.code}</p>
                        <Badge variant={zoneSecurityBadge(zone.security_level)}>
                          {zone.security_level}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{zone.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{zone.description || zone.purpose}</p>
                      <div className="mt-2 text-xs space-y-1">
                        <p>Status: <span className={zone.is_active ? "text-green-600" : "text-red-600"}>{zone.is_active ? "Active" : "Inactive"}</span></p>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-0 text-primary"
                          onClick={() => handleEditZone(zone)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-0 text-destructive"
                          onClick={() => handleDeleteZone(zone.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop View */}
                <div className="hidden md:block">
                  <div className="w-full overflow-x-auto rounded-lg border">
                    <Table className="min-w-250">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Purpose</TableHead>
                          <TableHead>Security</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {zones.map((zone) => (
                          <TableRow key={zone.id}>
                            <TableCell className="font-medium">{zone.code}</TableCell>
                            <TableCell>{zone.name}</TableCell>
                            <TableCell className="max-w-[320px] truncate text-sm text-muted-foreground">
                              {zone.description || zone.purpose}
                            </TableCell>
                            <TableCell>
                              <Badge variant={zoneSecurityBadge(zone.security_level)}>
                                {zone.security_level}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={zone.is_active ? "default" : "secondary"}>
                                {zone.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-primary"
                                  onClick={() => handleEditZone(zone)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => handleDeleteZone(zone.id)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Zone Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Zone</DialogTitle>
            <p className="text-sm text-muted-foreground">Only description and active status can be edited.</p>
          </DialogHeader>

          {editingZone && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label className="font-medium">Code (read-only)</Label>
                <p className="text-sm font-mono bg-muted p-2 rounded">{editingZone.code}</p>
              </div>

              <div className="grid gap-2">
                <Label className="font-medium">Name (read-only)</Label>
                <p className="text-sm bg-muted p-2 rounded">{editingZone.name}</p>
              </div>

              <div className="grid gap-2">
<Label htmlFor="description">Purpose / Description</Label>
              <textarea
                id="description"
                className="border rounded-md p-2 text-sm resize-none h-24"
                value={editingZone.description}
                onChange={(e) =>
                  setEditingZone({ ...editingZone, description: e.target.value })
                }
                placeholder="Visitor or operational purpose"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="is_active">Status</Label>
                <Select
                  value={editingZone.is_active ? "active" : "inactive"}
                  onValueChange={(val) =>
                    setEditingZone({
                      ...editingZone,
                      is_active: val === "active",
                    })
                  }
                >
                  <SelectTrigger id="is_active">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false)
                setEditingZone(null)
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button onClick={handleSaveZone} className="w-full sm:w-auto">
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={newZoneDialogOpen} onOpenChange={setNewZoneDialogOpen}>
        <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Zone</DialogTitle>
            <p className="text-sm text-muted-foreground">Create a new warehouse-specific zone for the selected warehouse.</p>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="zone-code">Zone code</Label>
              <Input
                id="zone-code"
                value={zoneForm.code}
                onChange={(e) => setZoneForm({ ...zoneForm, code: e.target.value.trim().toUpperCase() })}
                placeholder="e.g. Z-XX"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="zone-name">Name</Label>
              <Input
                id="zone-name"
                value={zoneForm.name}
                onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                placeholder="Zone name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="zone-description">Purpose / Description</Label>
              <textarea
                id="zone-description"
                className="border rounded-md p-2 text-sm resize-none h-24"
                value={zoneForm.description}
                onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })}
                placeholder="Visitor or operational purpose"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="zone-security">Security level</Label>
              <Select
                value={zoneForm.security_level}
                onValueChange={(value) => setZoneForm({ ...zoneForm, security_level: value as "standard" | "restricted" | "high" })}
              >
                <SelectTrigger id="zone-security">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="restricted">Restricted</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="zone-sort">Sort order</Label>
              <Input
                id="zone-sort"
                type="number"
                min={1}
                value={zoneForm.sort_order}
                onChange={(e) => setZoneForm({ ...zoneForm, sort_order: Number(e.target.value) || 1 })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="zone-active">Status</Label>
              <Select
                value={zoneForm.is_active ? "active" : "inactive"}
                onValueChange={(value) => setZoneForm({ ...zoneForm, is_active: value === "active" })}
              >
                <SelectTrigger id="zone-active">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setNewZoneDialogOpen(false)
                resetZoneForm()
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button onClick={handleCreateZone} className="w-full sm:w-auto">
              Create Zone
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}
