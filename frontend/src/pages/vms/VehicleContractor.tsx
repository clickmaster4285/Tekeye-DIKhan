import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchVehicles, createVehicle, type VehicleRecord } from "@/lib/vms-api"
import { fetchVisitors } from "@/lib/visitor-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { getStoredUser } from "@/lib/auth"
import { isViewOnlyForVehicleModule } from "@/lib/role-access"
import { Truck, Loader2, Plus } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const VEHICLE_TYPES = ["car", "motorcycle", "van", "truck", "contractor", "other"]

export default function VehicleContractorPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [visitorId, setVisitorId] = useState("")
  const [plateNumber, setPlateNumber] = useState("")
  const [vehicleType, setVehicleType] = useState("car")
  const [contractorCompany, setContractorCompany] = useState("")
  const [driverName, setDriverName] = useState("")
  const [remarks, setRemarks] = useState("")

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vms", "vehicles"],
    queryFn: () => fetchVehicles(),
  })
  const { data: visitors } = useQuery({
    queryKey: ["visitors"],
    queryFn: fetchVisitors,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createVehicle({
        visitor: Number(visitorId),
        plate_number: plateNumber.trim(),
        vehicle_type: vehicleType,
        contractor_company: contractorCompany.trim() || undefined,
        driver_name: driverName.trim() || undefined,
        remarks: remarks.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vms", "vehicles"] })
      toast({ title: "Vehicle added", description: "Vehicle logged for visitor." })
      setPlateNumber("")
      setContractorCompany("")
      setDriverName("")
      setRemarks("")
    },
    onError: (e) => {
      toast({ title: "Failed to add vehicle", description: e.message, variant: "destructive" })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const vid = Number(visitorId)
    if (!vid || !plateNumber.trim()) {
      toast({ title: "Select visitor and enter plate number", variant: "destructive" })
      return
    }
    createMutation.mutate()
  }

  const currentUser = getStoredUser()
  const viewOnly = isViewOnlyForVehicleModule(currentUser?.role)

  function formatDate(s: string) {
    try {
      return new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
    } catch {
      return s
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
          <Truck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Vehicle & Contractor</h1>
          <p className="text-sm text-muted-foreground">
            Log visitor vehicles or contractor access.
          </p>
        </div>
      </div>

      {viewOnly ? (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground">You have view-only access for Vehicle Management. Creation is disabled.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <Label>Visitor</Label>
          <Select value={visitorId} onValueChange={setVisitorId} required>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select visitor" />
            </SelectTrigger>
            <SelectContent>
              {visitors?.map((v) => (
                <SelectItem key={v.id} value={String(v.id)}>
                  {v.full_name} (ID {v.id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="plate">Plate number</Label>
            <Input
              id="plate"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              placeholder="e.g. ABC-1234"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Vehicle type</Label>
            <Select value={vehicleType} onValueChange={setVehicleType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="contractor">Contractor company (optional)</Label>
            <Input
              id="contractor"
              value={contractorCompany}
              onChange={(e) => setContractorCompany(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="driver">Driver name (optional)</Label>
            <Input
              id="driver"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="remarks">Remarks (optional)</Label>
          <Input
            id="remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="mt-1"
          />
        </div>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Add vehicle
          </Button>
        </form>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-medium text-foreground">Recent vehicles</div>
        {isLoading ? (
          <div className="p-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !vehicles?.length ? (
          <div className="p-6 text-center text-muted-foreground text-sm">No vehicles logged yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {(vehicles as VehicleRecord[]).map((v) => (
              <li key={v.id} className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium">{v.plate_number} · {v.vehicle_type}</p>
                  <p className="text-sm text-muted-foreground">{v.visitor_name} · {formatDate(v.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
