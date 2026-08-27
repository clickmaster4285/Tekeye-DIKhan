import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { zoneScan, type ZoneScanResult } from "@/lib/vms-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { LogIn, QrCode, Loader2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AccessZoneSelect } from "@/components/vms/access-zone-select"
import { useAccessZones } from "@/hooks/use-access-zones"

const GATES = ["main-gate", "gate-1", "gate-2", "vip-gate"]
/** Radix Select does not allow value=""; use for optional gate and treat as empty when submitting */
const GATE_PLACEHOLDER = "__none__"

export default function CheckInOutPage() {
  const { toast } = useToast()
  const { data: zoneData } = useAccessZones()
  const defaultZone = zoneData?.options.find((z) => z.value !== "all")?.value ?? ""
  const [qrCodeId, setQrCodeId] = useState("")
  const [zone, setZone] = useState("")
  const [gate, setGate] = useState(GATE_PLACEHOLDER)
  const [scanType, setScanType] = useState<"entry" | "exit">("entry")
  const [lastResult, setLastResult] = useState<ZoneScanResult | null>(null)

  const scanMutation = useMutation({
    mutationFn: () =>
      zoneScan({
        qr_code_id: qrCodeId.trim(),
        zone: zone || defaultZone,
        gate: gate === GATE_PLACEHOLDER ? "" : gate,
        scan_type: scanType,
      }),
    onSuccess: (data) => {
      setLastResult(data)
      if (data.allowed) {
        toast({
          title: "Access granted",
          description: data.message,
        })
      } else {
        toast({
          title: "Access denied",
          description: data.message,
          variant: "destructive",
        })
      }
    },
    onError: (e) => {
      toast({ title: "Scan failed", description: e.message, variant: "destructive" })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!qrCodeId.trim()) {
      toast({ title: "Enter QR code ID", variant: "destructive" })
      return
    }
    if (!zone) {
      toast({ title: "Select zone", variant: "destructive" })
      return
    }
    scanMutation.mutate()
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
          <LogIn className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Check-in / Check-out</h1>
          <p className="text-sm text-muted-foreground">
            Scan visitor QR at entry or exit. Updates flow_stage and logs zone access.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <Label htmlFor="qr">QR Code ID</Label>
          <Input
            id="qr"
            placeholder="e.g. QR-1 or scan result"
            value={qrCodeId}
            onChange={(e) => setQrCodeId(e.target.value)}
            className="mt-1 font-mono"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Zone</Label>
            <AccessZoneSelect
              value={zone}
              onValueChange={setZone}
              triggerClassName="mt-1"
              includeAllOption={false}
            />
          </div>
          <div>
            <Label>Gate</Label>
            <Select value={gate} onValueChange={setGate}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GATE_PLACEHOLDER}>—</SelectItem>
                {GATES.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Scan type</Label>
          <Select value={scanType} onValueChange={(v) => setScanType(v as "entry" | "exit")}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="entry">Entry</SelectItem>
              <SelectItem value="exit">Exit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full" disabled={scanMutation.isPending}>
          {scanMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <QrCode className="h-4 w-4 mr-2" />
          )}
          Submit scan
        </Button>
      </form>

      {lastResult && (
        <div
          className={`rounded-xl border p-4 ${
            lastResult.allowed
              ? "border-green-500/50 bg-green-500/5"
              : "border-destructive/50 bg-destructive/5"
          }`}
        >
          <p className="font-medium">{lastResult.allowed ? "Access granted" : "Access denied"}</p>
          <p className="text-sm text-muted-foreground mt-1">{lastResult.message}</p>
          {lastResult.visitor_name && (
            <p className="text-sm mt-1">Visitor: {lastResult.visitor_name} · Stage: {lastResult.flow_stage ?? "—"}</p>
          )}
        </div>
      )}
    </div>
  )
}
