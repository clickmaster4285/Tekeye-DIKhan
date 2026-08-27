"use client"

import { useEffect, useState } from "react"
import { Warehouse, MapPin, Package, Plus, ListOrdered, AlertCircle, Loader2 } from "lucide-react"
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
import { fetchWarehouses, createWarehouse, ensureWarehouseZones, type WarehouseRecord } from "@/lib/warehouse-zones-api"
import { WAREHOUSE_STATUSES } from "@/lib/warehouse-zones"
import { CREATE_WAREHOUSE_FLOW, WAREHOUSE_TABLE_COLUMNS } from "@/lib/warehouse-module-spec"

export default function WarehouseSetupPage() {
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ensureLoading, setEnsureLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showFlow, setShowFlow] = useState(false)
  const [open, setOpen] = useState(false)

  const [form, setForm] = useState({
    code: "",
    name: "",
    location_code: "",
    status: "ACTIVE",
    description: "",
  })

  useEffect(() => {
    loadWarehouses()
  }, [])

  const loadWarehouses = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchWarehouses()
      setWarehouses(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load warehouses")
      setWarehouses([])
    } finally {
      setLoading(false)
    }
  }

  const openAdd = () => {
    setForm({
      code: "",
      name: "",
      location_code: "",
      status: "ACTIVE",
      description: "",
    })
    setOpen(true)
  }

  const onSave = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.location_code.trim()) {
      setError("Code, name, and location are required")
      return
    }

    try {
      setSaving(true)
      setError(null)
      const newWarehouse = await createWarehouse({
        code: form.code.trim(),
        name: form.name.trim(),
        location_code: form.location_code,
        status: form.status,
        description: form.description.trim(),
      })

      // Automatically ensure zones for the new warehouse
      try {
        await ensureWarehouseZones(newWarehouse.id)
      } catch (zoneErr) {
        console.warn("Failed to ensure zones, but warehouse was created:", zoneErr)
      }

      await loadWarehouses()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create warehouse")
    } finally {
      setSaving(false)
    }
  }

  const handleEnsureZones = async (warehouseId: string) => {
    try {
      setEnsureLoading(warehouseId)
      setError(null)
      await ensureWarehouseZones(warehouseId)
      await loadWarehouses()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ensure zones")
    } finally {
      setEnsureLoading(null)
    }
  }

  const activeCount = warehouses.filter((w) => w.status === "ACTIVE").length
  const totalZones = warehouses.reduce((sum, w) => sum + w.zone_count, 0)

  return (
    <ModulePageLayout
      title="Warehouse Setup"
      description="Master warehouse management from backend database."
      breadcrumbs={[{ label: "WMS" }, { label: "Warehouse Setup" }]}
    >
      <div className="grid gap-6">
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <ListOrdered className="h-5 w-5" />
                Warehouse Setup Flow
              </CardTitle>
              <CardDescription className="break-words">
                Create Warehouse → Automatically seed 7 canonical zones → Activate
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setShowFlow(!showFlow)}>
              {showFlow ? "Hide" : "Show"} steps
            </Button>
          </CardHeader>
          {showFlow && (
            <CardContent className="pt-0">
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                {CREATE_WAREHOUSE_FLOW.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </CardContent>
          )}
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Warehouses</CardTitle>
              <Warehouse className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{warehouses.length}</div>
              <p className="text-xs text-muted-foreground mt-1">{activeCount} active</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Zones</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalZones}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all warehouses</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Locations</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{LOCATION_OPTIONS.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Customs locations</p>
            </CardContent>
          </Card>
        </div>

        {/* Warehouses Table */}
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-wrap items-center justify-between gap-4 space-y-0">
            <div className="min-w-0">
              <CardTitle>Warehouse List</CardTitle>
              <CardDescription className="break-words">
                Master warehouses from database. Create new warehouse with auto-seeded 7 canonical zones.
              </CardDescription>
            </div>
            <Button
              className="w-full flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
              onClick={openAdd}
              disabled={saving}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Warehouse
            </Button>
          </CardHeader>

          <CardContent className="w-full min-w-0 space-y-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : warehouses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No warehouses yet. Create one to get started.</p>
              </div>
            ) : (
              <>
                {/* Mobile View */}
                <div className="divide-y rounded-lg border md:hidden">
                  {warehouses.map((row) => (
                    <div key={row.id} className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{row.code}</p>
                        <Badge variant={row.status === "ACTIVE" ? "default" : "secondary"}>
                          {row.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm">{row.name}</p>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <p className="truncate">
                          Location: <span className="text-foreground">{locationLabel(row.location_code)}</span>
                        </p>
                        <p className="truncate">
                          Zones: <span className="text-foreground">{row.zone_count}/7</span>
                        </p>
                      </div>
                      <div className="mt-2 flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-0 text-primary"
                          onClick={() => handleEnsureZones(row.id)}
                          disabled={ensureLoading === row.id}
                        >
                          {ensureLoading === row.id && (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          )}
                          Ensure Zones
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop View */}
                <div className="hidden md:block">
                  <div className="w-full overflow-x-auto rounded-lg border">
                    <Table className="min-w-[900px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Zones</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {warehouses.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.code}</TableCell>
                            <TableCell>{row.name}</TableCell>
                            <TableCell>{locationLabel(row.location_code)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {row.zone_count}/7
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={row.status === "ACTIVE" ? "default" : "secondary"}>
                                {row.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-primary"
                                onClick={() => handleEnsureZones(row.id)}
                                disabled={ensureLoading === row.id}
                              >
                                {ensureLoading === row.id && (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                )}
                                Ensure Zones
                              </Button>
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

      {/* Create Warehouse Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Warehouse</DialogTitle>
            <p className="text-sm text-muted-foreground">
              New warehouse will automatically get the 7 canonical zones seeded.
            </p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Warehouse Code</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. WH-PSH-01"
              />
            </div>
            <div className="grid gap-2">
              <Label>Warehouse Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Peshawar Customs Warehouse"
              />
            </div>
            <div className="grid gap-2">
              <Label>Location</Label>
              <Select value={form.location_code} onValueChange={(v) => setForm((f) => ({ ...f, location_code: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_OPTIONS.map((loc) => (
                    <SelectItem key={loc.value} value={loc.value}>
                      {loc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Description (optional)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Additional details"
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="w-full sm:w-auto"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={onSave} className="w-full sm:w-auto" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ModulePageLayout>
  )
}
