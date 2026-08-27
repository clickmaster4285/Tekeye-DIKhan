import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ROUTES } from "@/routes/config"
import type { VehicleEntry, VehicleStatus, VehicleType } from "@/lib/vms-types"
import { VEHICLE_TYPES, VEHICLE_STATUSES } from "@/lib/vms-types"
import { getStoredUser } from "@/lib/auth"
import { isViewOnlyForVehicleModule } from "@/lib/role-access"
import {
  loadVehicleEntries,
  saveVehicleEntries,
  getGateIdsForVehicle,
} from "@/lib/vms-storage"
import { loadGates } from "@/lib/gate-storage"
import { format } from "date-fns"

function generateId(): string {
  return `ve-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const emptyEntry = (): Omit<VehicleEntry, "vehicle_entry_id" | "entry_datetime"> => ({
  visit_id_ref: "",
  vehicle_reg_no: "",
  anpr_image: "",
  vehicle_type: "Car",
  vehicle_make: "",
  vehicle_color: "",
  driver_name: "",
  driver_cnic: "",
  container_no: "",
  seal_no: "",
  declaration_no: "",
  entry_gate_id: "",
  parking_bay_assigned: "",
  exit_datetime: "",
  exit_gate_id: "",
  status: "Inside",
})

export default function VehicleRegistrationPage() {
  const [entries, setEntries] = useState<VehicleEntry[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState(emptyEntry())

  const [hydrated, setHydrated] = useState(false)
  const [gateOptions, setGateOptions] = useState<string[]>([])
  const [gateNameById, setGateNameById] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const list = await loadVehicleEntries()
      const gates = await getGateIdsForVehicle()
      const allGates = await loadGates()
      if (!cancelled) {
        setEntries(list)
        setGateOptions(gates)
        setGateNameById(Object.fromEntries(allGates.map((g) => [g.gate_id, g.gate_name])))
        setHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    void saveVehicleEntries(entries)
  }, [entries, hydrated])

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter((row) => {
      const matchStatus = statusFilter === "all" || (row.status ?? "") === statusFilter
      const matchSearch =
        q.length === 0 ||
        [
          row.vehicle_reg_no,
          row.driver_name,
          row.driver_cnic,
          row.vehicle_entry_id,
          row.visit_id_ref,
        ].some((v) => (v ?? "").toLowerCase().includes(q))
      return matchStatus && matchSearch
    })
  }, [entries, search, statusFilter])

  const onAdd = () => {
    if (
      !formData.vehicle_reg_no?.trim() ||
      !formData.driver_name?.trim() ||
      !formData.driver_cnic?.trim() ||
      !formData.entry_gate_id?.trim()
    )
      return
    const newEntry: VehicleEntry = {
      ...formData,
      vehicle_entry_id: generateId(),
      entry_datetime: new Date().toISOString(),
    }
    setEntries((prev) => [newEntry, ...prev])
    setFormData(emptyEntry())
    setOpen(false)
  }

  const onExit = (entry: VehicleEntry) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.vehicle_entry_id === entry.vehicle_entry_id
          ? {
              ...e,
              exit_datetime: new Date().toISOString(),
              exit_gate_id: e.exit_gate_id || e.entry_gate_id,
              status: "Exited" as VehicleStatus,
            }
          : e
      )
    )
  }

  const breadcrumbs = [
        { label: "Home", href: ROUTES.DASHBOARD },
        { label: "Visitor Management System" },
        { label: "Vehicle & Contractor Management" },
        { label: "Vehicle Registration" },
  ]

  const currentUser = getStoredUser()
  const viewOnly = isViewOnlyForVehicleModule(currentUser?.role)

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
        <h1 className="text-2xl font-semibold text-foreground">
          Vehicle Registration
        </h1>
        <p className="text-sm text-muted-foreground">
          Capture vehicle number, driver details, ANPR image, and entry/exit. Data stored in the database.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <CardTitle>Vehicle entries</CardTitle>
              <CardDescription>
                Important info in list; open Add for full registration form.
              </CardDescription>
            </div>
              <div className="flex flex-col md:flex-row gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reg no, driver, visit ID..."
                className="md:w-56"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="md:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {VEHICLE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" asChild>
                <Link to={ROUTES.VEHICLE_TRACKING}>Vehicle Tracking</Link>
              </Button>
              {viewOnly ? (
                <div className="flex items-center text-sm text-muted-foreground px-2">View-only: creation disabled</div>
              ) : (
                <Button onClick={() => setOpen(true)}>Add vehicle entry</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle Entry ID</TableHead>
                  <TableHead>Visit ID</TableHead>
                  <TableHead>Reg. No</TableHead>
                  <TableHead>Vehicle Type</TableHead>
                  <TableHead>Driver Name</TableHead>
                  <TableHead>Driver CNIC</TableHead>
                  <TableHead>Entry Date & Time</TableHead>
                  <TableHead>Entry Gate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="text-center text-muted-foreground py-8"
                    >
                      No vehicle entries. Add one to start.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEntries.map((row) => (
                    <TableRow key={row.vehicle_entry_id}>
                      <TableCell className="font-mono text-xs">
                        {row.vehicle_entry_id.slice(0, 14)}…
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.visit_id_ref || "—"}
                      </TableCell>
                      <TableCell>{row.vehicle_reg_no ?? "—"}</TableCell>
                      <TableCell>{row.vehicle_type ?? "—"}</TableCell>
                      <TableCell>{row.driver_name ?? "—"}</TableCell>
                      <TableCell>{row.driver_cnic ?? "—"}</TableCell>
                      <TableCell>
                        {row.entry_datetime
                          ? format(new Date(row.entry_datetime), "dd MMM yyyy HH:mm")
                          : "—"}
                      </TableCell>
                      <TableCell title={row.entry_gate_id}>
                        {gateNameById[row.entry_gate_id] || row.entry_gate_id || "—"}
                      </TableCell>
                      <TableCell>{row.status ?? "—"}</TableCell>
                      <TableCell>
                        {row.status === "Inside" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onExit(row)}
                          >
                            Mark exit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add vehicle entry</DialogTitle>
            <p className="text-sm text-muted-foreground">
              All Vehicle Registration fields (Vehicle Entry ID and Entry Date & Time are auto-generated).
            </p>
          </DialogHeader>
          <Tabs defaultValue="main">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="main">Registration & Driver</TabsTrigger>
              <TabsTrigger value="cargo">Cargo / WeBOC</TabsTrigger>
              <TabsTrigger value="gates">Gates & Status</TabsTrigger>
            </TabsList>
            <TabsContent value="main" className="space-y-3 pt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Visit ID (Reference) *</Label>
                  <Input
                    value={formData.visit_id_ref}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, visit_id_ref: e.target.value }))
                    }
                    placeholder="Links to Visit"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Registration Number *</Label>
                  <Input
                    value={formData.vehicle_reg_no}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        vehicle_reg_no: e.target.value.slice(0, 15),
                      }))
                    }
                    placeholder="OCR from ANPR (max 15)"
                    maxLength={15}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>ANPR Captured Image</Label>
                <Input
                  value={formData.anpr_image}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, anpr_image: e.target.value }))
                  }
                  placeholder="File path or data URL (captured from camera)"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Vehicle Type *</Label>
                  <Select
                    value={formData.vehicle_type}
                    onValueChange={(v) =>
                      setFormData((p) => ({ ...p, vehicle_type: v as VehicleType }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Make / Model (optional)</Label>
                  <Input
                    value={formData.vehicle_make}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        vehicle_make: e.target.value.slice(0, 50),
                      }))
                    }
                    placeholder="Max 50"
                    maxLength={50}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Color (optional)</Label>
                  <Input
                    value={formData.vehicle_color}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        vehicle_color: e.target.value.slice(0, 20),
                      }))
                    }
                    placeholder="Max 20"
                    maxLength={20}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Driver Name *</Label>
                  <Input
                    value={formData.driver_name}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        driver_name: e.target.value.slice(0, 50),
                      }))
                    }
                    placeholder="Max 50"
                    maxLength={50}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Driver CNIC *</Label>
                  <Input
                    value={formData.driver_cnic}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        driver_cnic: e.target.value.slice(0, 15),
                      }))
                    }
                    placeholder="15 digits"
                    maxLength={15}
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="cargo" className="space-y-3 pt-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Container Number (required for trucks)</Label>
                  <Input
                    value={formData.container_no}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        container_no: e.target.value.slice(0, 20),
                      }))
                    }
                    placeholder="Max 20"
                    maxLength={20}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Seal Number (required if sealed)</Label>
                  <Input
                    value={formData.seal_no}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        seal_no: e.target.value.slice(0, 20),
                      }))
                    }
                    placeholder="Max 20"
                    maxLength={20}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Related Declaration Number (WeBOC)</Label>
                  <Input
                    value={formData.declaration_no}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        declaration_no: e.target.value.slice(0, 30),
                      }))
                    }
                    placeholder="Link to WeBOC, max 30"
                    maxLength={30}
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="gates" className="space-y-3 pt-3">
              <p className="text-sm text-muted-foreground">
                Entry Date & Time is set automatically on save. Exit fields are set when you click &quot;Mark exit&quot; on the list.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Entry Gate *</Label>
                  <Select
                    value={formData.entry_gate_id}
                    onValueChange={(v) =>
                      setFormData((p) => ({ ...p, entry_gate_id: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select entry gate" />
                    </SelectTrigger>
                    <SelectContent>
                      {gateOptions.map((id) => (
                        <SelectItem key={id} value={id}>
                          {gateNameById[id] || id} ({id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {gateOptions.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Add gates in Gate Integration first.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Parking Bay Assigned (optional)</Label>
                  <Input
                    value={formData.parking_bay_assigned}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        parking_bay_assigned: e.target.value.slice(0, 10),
                      }))
                    }
                    placeholder="Max 10"
                    maxLength={10}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Vehicle Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) =>
                    setFormData((p) => ({ ...p, status: v as VehicleStatus }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onAdd}>Save entry</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
