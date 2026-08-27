import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
import { ROUTES } from "@/routes/config"
import type { VehicleTrackingRecord } from "@/lib/vms-types"
import { loadVehicleTracking, saveVehicleTracking, loadVehicleEntries } from "@/lib/vms-storage"

function generateTrackingId(): string {
  return `tr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const emptyTracking = (
  vehicle_entry_id_ref: string = ""
): Omit<VehicleTrackingRecord, "tracking_id"> => ({
  vehicle_entry_id_ref,
  gps_coordinates: "",
  dwell_time_minutes: 0,
  assigned_loading_area: "",
  movement_log: "[]",
  overstay_alert_sent: false,
  overstay_threshold_minutes: 60,
})

export default function VehicleTrackingPage() {
  const [records, setRecords] = useState<VehicleTrackingRecord[]>([])
  const [entries, setEntries] = useState<{ vehicle_entry_id: string; vehicle_reg_no: string }[]>([])
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState(emptyTracking())

  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const recs = await loadVehicleTracking()
      const all = await loadVehicleEntries()
      if (!cancelled) {
        setRecords(recs)
        setEntries(all.map((e) => ({ vehicle_entry_id: e.vehicle_entry_id, vehicle_reg_no: e.vehicle_reg_no })))
        setHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    void saveVehicleTracking(records)
  }, [records, hydrated])

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase()
    return records.filter((row) => {
      const entry = entries.find((e) => e.vehicle_entry_id === row.vehicle_entry_id_ref)
      const regNo = entry?.vehicle_reg_no ?? ""
      return (
        q.length === 0 ||
        row.tracking_id.toLowerCase().includes(q) ||
        row.vehicle_entry_id_ref.toLowerCase().includes(q) ||
        regNo.toLowerCase().includes(q)
      )
    })
  }, [records, entries, search])

  const onAdd = () => {
    if (!formData.vehicle_entry_id_ref?.trim()) return
    const dwell = Number(formData.dwell_time_minutes) || 0
    const threshold = Number(formData.overstay_threshold_minutes) || 60
    const newRecord: VehicleTrackingRecord = {
      ...formData,
      tracking_id: generateTrackingId(),
      dwell_time_minutes: dwell,
      overstay_threshold_minutes: threshold,
    }
    setRecords((prev) => [newRecord, ...prev])
    setFormData(emptyTracking())
    setOpen(false)
  }

  const openForm = (entryId?: string) => {
    setFormData(emptyTracking(entryId ?? ""))
    setOpen(true)
  }

  const breadcrumbs = [
    { label: "Home", href: ROUTES.DASHBOARD },
    { label: "Visitor Management System" },
    { label: "Vehicle & Contractor Management" },
    { label: "Vehicle Tracking" },
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
        <h1 className="text-2xl font-semibold text-foreground">Vehicle Tracking</h1>
        <p className="text-sm text-muted-foreground">
          Dwell time, loading area, movement log, and overstay alerts. Linked to vehicle entries in the database.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <CardTitle>Tracking records</CardTitle>
              <CardDescription>Link tracking to vehicle entries.</CardDescription>
            </div>
            <div className="flex flex-col md:flex-row gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by tracking ID or reg no..."
                className="md:w-56"
              />
              <Button onClick={() => openForm()}>Add tracking</Button>
              <Button variant="outline" asChild>
                <Link to={ROUTES.VEHICLE_REGISTRATION}>Vehicle Registration</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking ID</TableHead>
                  <TableHead>Vehicle entry</TableHead>
                  <TableHead>Reg no</TableHead>
                  <TableHead>Dwell (min)</TableHead>
                  <TableHead>Loading area</TableHead>
                  <TableHead>Overstay alert</TableHead>
                  <TableHead>Threshold (min)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No tracking records. Add one or create a vehicle entry first.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((row) => {
                    const entry = entries.find((e) => e.vehicle_entry_id === row.vehicle_entry_id_ref)
                    return (
                      <TableRow key={row.tracking_id}>
                        <TableCell className="font-mono text-xs">{row.tracking_id.slice(0, 14)}…</TableCell>
                        <TableCell className="font-mono text-xs">{row.vehicle_entry_id_ref.slice(0, 12)}…</TableCell>
                        <TableCell>{entry?.vehicle_reg_no ?? "—"}</TableCell>
                        <TableCell>{row.dwell_time_minutes}</TableCell>
                        <TableCell>{row.assigned_loading_area || "—"}</TableCell>
                        <TableCell>{row.overstay_alert_sent ? "Yes" : "No"}</TableCell>
                        <TableCell>{row.overstay_threshold_minutes}</TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add tracking record</DialogTitle>
            <p className="text-sm text-muted-foreground">Vehicle Tracking – linked to vehicle entry.</p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Vehicle entry *</Label>
              <Select
                value={formData.vehicle_entry_id_ref}
                onValueChange={(v) => setFormData((p) => ({ ...p, vehicle_entry_id_ref: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle entry" />
                </SelectTrigger>
                <SelectContent>
                  {entries.map((e) => (
                    <SelectItem key={e.vehicle_entry_id} value={e.vehicle_entry_id}>
                      {e.vehicle_reg_no} ({e.vehicle_entry_id.slice(0, 10)}…)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {entries.length === 0 && (
                <p className="text-xs text-muted-foreground">Create a vehicle entry first on Vehicle Registration.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>GPS coordinates (Lat, Long)</Label>
              <Input
                value={formData.gps_coordinates}
                onChange={(e) => setFormData((p) => ({ ...p, gps_coordinates: e.target.value }))}
                placeholder="e.g. 24.8607, 67.0011"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Dwell time (minutes)</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.dwell_time_minutes}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, dwell_time_minutes: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Overstay threshold (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.overstay_threshold_minutes}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, overstay_threshold_minutes: Number(e.target.value) || 60 }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned loading area</Label>
              <Input
                value={formData.assigned_loading_area}
                onChange={(e) => setFormData((p) => ({ ...p, assigned_loading_area: e.target.value }))}
                placeholder="Area code"
                maxLength={20}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Movement log (JSON array)</Label>
              <Input
                value={formData.movement_log}
                onChange={(e) => setFormData((p) => ({ ...p, movement_log: e.target.value }))}
                placeholder='[{"time":"...","location":"..."}]'
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="overstay_alert"
                checked={formData.overstay_alert_sent}
                onCheckedChange={(checked) =>
                  setFormData((p) => ({ ...p, overstay_alert_sent: checked === true }))
                }
              />
              <Label htmlFor="overstay_alert">Overstay alert sent</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={onAdd}>Save tracking</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
