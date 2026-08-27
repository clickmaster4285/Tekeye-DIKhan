import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { QrCode, ScanLine, Search, UserCheck, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { getStoredUser } from "@/lib/auth"
import { fetchVisitors, updateVisitor, type RegistrationSource, type VisitorRecord } from "@/lib/visitor-api"

type GuardVisitor = {
  id: number
  source: RegistrationSource
  name: string
  qrCodeId: string
  host: string
  purpose: string
  status: string
  entryTime: string
}

function toDisplayDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function resolveVisitorDisplayName(row: Record<string, unknown>, id: number): string {
  const stored = String(row.full_name ?? "").trim()
  if (stored && stored !== "Unknown Visitor") return stored

  const extra = (row.extra_data ?? row) as Record<string, unknown>
  const draft = extra.draft_form_data
  const sources = [extra, typeof draft === "object" && draft !== null ? draft : null].filter(Boolean) as Record<
    string,
    unknown
  >[]

  for (const src of sources) {
    for (const key of ["fullName", "full_name", "name"]) {
      const val = src[key]
      if (typeof val === "string" && val.trim() && val.trim() !== "Unknown Visitor") {
        return val.trim()
      }
    }
  }

  const cnic = String(row.cnic_number ?? row.cnic_passport ?? "").trim()
  if (cnic) return cnic

  const qr = String(row.qr_code_id ?? row.qrCodeId ?? row.visitor_ref_number ?? "").trim()
  if (qr) return qr

  return stored || `Visitor #${id}`
}

function mapGuardVisitor(row: VisitorRecord & Record<string, unknown>, source: RegistrationSource): GuardVisitor {
  const qrCodeId = String(row.qr_code_id ?? row.qrCodeId ?? row.visitor_ref_number ?? "").trim()
  const regStatus = String(row.registration_status ?? "approved")
  const entryTimeRaw = String(row.guard_entry_time ?? row.check_in_time ?? row.entry_time ?? "").trim()
  let status = "Expected"
  if (entryTimeRaw) status = "Checked In"
  else if (regStatus === "draft") status = "Draft"

  return {
    id: row.id,
    source,
    name: resolveVisitorDisplayName(row, row.id),
    qrCodeId,
    host: String(row.host_officer_name ?? row.host_full_name ?? row.hostFullName ?? row.host_name ?? "—"),
    purpose: String(row.visit_purpose ?? row.visitPurpose ?? "—"),
    status,
    entryTime: entryTimeRaw,
  }
}

type CheckInParams = {
  qrCode: string
  visitorId?: number
}

export default function GuardReceptionPanelPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [scanMode, setScanMode] = useState<"scan" | "manual">("scan")
  const [qrInput, setQrInput] = useState("")
  const [search, setSearch] = useState("")
  const [guardName, setGuardName] = useState("")
  const [lastCheckedIn, setLastCheckedIn] = useState<GuardVisitor | null>(null)
  const [listFilter, setListFilter] = useState<"all" | "expected" | "checked-in">("all")

  useEffect(() => {
    const user = getStoredUser()
    if (user?.username && !guardName) {
      setGuardName(user.username)
    }
  }, [guardName])

  const walkInQuery = useQuery({
    queryKey: ["visitors", "walk-in", "guard-panel"],
    queryFn: () => fetchVisitors("walk-in"),
  })
  const preRegQuery = useQuery({
    queryKey: ["visitors", "pre-registration", "guard-panel"],
    queryFn: () => fetchVisitors("pre-registration"),
  })

  const visitors = useMemo(() => {
    const walkin = (walkInQuery.data ?? []).map((v) =>
      mapGuardVisitor(v as VisitorRecord & Record<string, unknown>, "walk-in")
    )
    const prereg = (preRegQuery.data ?? []).map((v) =>
      mapGuardVisitor(v as VisitorRecord & Record<string, unknown>, "pre-registration")
    )
    return [...walkin, ...prereg].sort((a, b) => b.id - a.id)
  }, [walkInQuery.data, preRegQuery.data])

  const checkedInVisitors = useMemo(
    () =>
      visitors
        .filter((v) => v.status === "Checked In")
        .sort((a, b) => {
          const ta = new Date(a.entryTime).getTime()
          const tb = new Date(b.entryTime).getTime()
          return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta)
        }),
    [visitors]
  )

  const filteredVisitors = useMemo(() => {
    let list = visitors
    if (listFilter === "expected") {
      list = list.filter((v) => v.status === "Expected" || v.status === "Draft")
    } else if (listFilter === "checked-in") {
      list = list.filter((v) => v.status === "Checked In")
    }
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((v) => {
      return (
        v.name.toLowerCase().includes(q) ||
        v.qrCodeId.toLowerCase().includes(q) ||
        v.host.toLowerCase().includes(q) ||
        v.purpose.toLowerCase().includes(q) ||
        v.source.toLowerCase().includes(q)
      )
    })
  }, [search, visitors, listFilter])

  const checkInMutation = useMutation({
    mutationFn: async ({ qrCode, visitorId }: CheckInParams) => {
      const normalizedInput = qrCode.trim().toLowerCase()
      if (!normalizedInput && visitorId == null) {
        throw new Error("Please scan or enter a QR code number.")
      }

      let matched: GuardVisitor | undefined
      if (visitorId != null) {
        matched = visitors.find((v) => v.id === visitorId)
      } else {
        matched = visitors.find((v) => v.qrCodeId.trim().toLowerCase() === normalizedInput)
      }
      if (!matched) {
        throw new Error("No visitor found for this QR code. Check the number and try again.")
      }
      if (matched.status === "Checked In") {
        throw new Error(`${matched.name} is already checked in.`)
      }
      if (!matched.qrCodeId && !visitorId) {
        throw new Error("This visitor has no QR code assigned.")
      }

      const now = new Date().toISOString()
      const updated = await updateVisitor(
        matched.id,
        {
          guard_entry_time: now,
          check_in_time: now,
          scanned_qr_code: qrCode.trim() || matched.qrCodeId,
          checked_in_by: guardName.trim() || "Guard",
          flow_stage: "checked-in",
        },
        matched.source,
        { registrationStatus: "sent" }
      )
      if (!updated) throw new Error("Could not update visitor record.")

      return {
        ...matched,
        status: "Checked In",
        entryTime: now,
      } satisfies GuardVisitor
    },
    onSuccess: (checkedIn) => {
      setLastCheckedIn(checkedIn)
      setQrInput("")
      setListFilter("checked-in")
      queryClient.invalidateQueries({ queryKey: ["visitors", "walk-in"] })
      queryClient.invalidateQueries({ queryKey: ["visitors", "pre-registration"] })
      toast({
        title: "Entrance recorded",
        description: `${checkedIn.name} checked in at ${toDisplayDateTime(checkedIn.entryTime)}.`,
      })
    },
    onError: (err) => {
      toast({
        title: "Check-in failed",
        description: err instanceof Error ? err.message : "Unable to mark entrance time.",
        variant: "destructive",
      })
    },
  })

  const handleMarkEntry = () => {
    checkInMutation.mutate({ qrCode: qrInput })
  }

  const handleRowCheckIn = (visitor: GuardVisitor) => {
    checkInMutation.mutate({
      qrCode: visitor.qrCodeId || `QR-${visitor.id}`,
      visitorId: visitor.id,
    })
  }

  const handleScanFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text?.trim()) {
        toast({ title: "Clipboard is empty", variant: "destructive" })
        return
      }
      setQrInput(text.trim())
      toast({ title: "QR captured", description: "Code ready — click Mark Entrance Time." })
    } catch {
      toast({
        title: "Scan not available",
        description: "Paste or type the QR code number manually.",
        variant: "destructive",
      })
    }
  }

  const isLoading = walkInQuery.isLoading || preRegQuery.isLoading

  return (
    <div className="w-full px-4 sm:px-6 space-y-6">
      <nav
        className="text-base text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1"
        aria-label="Breadcrumb"
      >
        <span>Home</span>
        <span aria-hidden className="text-muted-foreground/70">/</span>
        <span>Visitor Management System</span>
        <span aria-hidden className="text-muted-foreground/70">/</span>
        <span className="text-[#3b82f6] font-medium">Guard & Reception Panel</span>
      </nav>

      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">Guard & Reception Panel</h1>
        <p className="text-base text-muted-foreground mt-1">
          Scan or enter a visitor QR code, then mark entrance. Checked-in visitors appear in the list below.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#3b82f6]" />
            Entrance Check-In
          </CardTitle>
          <CardDescription>
            Use scan mode with a USB scanner, or type the QR number, then mark entrance time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={scanMode === "scan" ? "default" : "outline"}
              onClick={() => setScanMode("scan")}
              type="button"
            >
              <ScanLine className="h-4 w-4 mr-2" />
              Scan
            </Button>
            <Button
              variant={scanMode === "manual" ? "default" : "outline"}
              onClick={() => setScanMode("manual")}
              type="button"
            >
              <QrCode className="h-4 w-4 mr-2" />
              Enter QR Number
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label htmlFor="guard-qr-input">
                {scanMode === "scan" ? "Scanned QR code number" : "QR code number"}
              </Label>
              <Input
                id="guard-qr-input"
                placeholder="e.g. QR-4"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && qrInput.trim()) handleMarkEntry()
                }}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label htmlFor="guard-name">Guard name</Label>
              <Input
                id="guard-name"
                placeholder="Guard name"
                value={guardName}
                onChange={(e) => setGuardName(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {scanMode === "scan" && (
              <Button type="button" variant="outline" onClick={handleScanFromClipboard}>
                <ScanLine className="h-4 w-4 mr-2" />
                Capture from scanner
              </Button>
            )}
            <Button
              type="button"
              onClick={handleMarkEntry}
              disabled={checkInMutation.isPending || !qrInput.trim()}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              {checkInMutation.isPending ? "Marking…" : "Mark Entrance Time"}
            </Button>
          </div>

          {lastCheckedIn && (
            <div className="rounded-md border bg-green-500/5 border-green-500/40 px-3 py-2 text-sm">
              <span className="font-medium text-green-700 dark:text-green-400">Last check-in: </span>
              {lastCheckedIn.name} ({lastCheckedIn.qrCodeId || `ID ${lastCheckedIn.id}`}) —{" "}
              {toDisplayDateTime(lastCheckedIn.entryTime)}
            </div>
          )}
        </CardContent>
      </Card>

      {checkedInVisitors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-green-600" />
              Visitors on premises ({checkedInVisitors.length})
            </CardTitle>
            <CardDescription>Visitors who have been checked in at the gate.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {checkedInVisitors.slice(0, 20).map((v) => (
                <li
                  key={`${v.source}-${v.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm border rounded-md px-3 py-2"
                >
                  <span className="font-medium">{v.name}</span>
                  <span className="text-muted-foreground font-mono text-xs">{v.qrCodeId || "—"}</span>
                  <span className="text-muted-foreground text-xs">{toDisplayDateTime(v.entryTime)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-[#3b82f6]" />
            Visitor Lookup
          </CardTitle>
          <CardDescription>Search visitors and check them in from the table.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Search visitor / QR code / host..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={listFilter === "all" ? "default" : "outline"}
                onClick={() => setListFilter("all")}
              >
                All
              </Button>
              <Button
                type="button"
                size="sm"
                variant={listFilter === "expected" ? "default" : "outline"}
                onClick={() => setListFilter("expected")}
              >
                Expected
              </Button>
              <Button
                type="button"
                size="sm"
                variant={listFilter === "checked-in" ? "default" : "outline"}
                onClick={() => setListFilter("checked-in")}
              >
                Checked In
              </Button>
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="px-3 py-2 text-left text-xs uppercase text-muted-foreground">Visitor</th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-muted-foreground">Source</th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-muted-foreground">QR Code</th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-muted-foreground">Host</th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-muted-foreground">Purpose</th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-muted-foreground">Status</th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-muted-foreground">Entrance Time</th>
                  <th className="px-3 py-2 text-right text-xs uppercase text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-sm text-center text-muted-foreground">
                      Loading visitors…
                    </td>
                  </tr>
                ) : filteredVisitors.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-sm text-center text-muted-foreground">
                      No visitors found.
                    </td>
                  </tr>
                ) : (
                  filteredVisitors.map((v) => (
                    <tr key={`${v.source}-${v.id}`} className="border-b last:border-b-0">
                      <td className="px-3 py-2 text-sm font-medium">{v.name}</td>
                      <td className="px-3 py-2 text-sm text-muted-foreground capitalize">
                        {v.source.replace("-", " ")}
                      </td>
                      <td className="px-3 py-2 text-sm font-mono">{v.qrCodeId || "—"}</td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">{v.host || "—"}</td>
                      <td
                        className="px-3 py-2 text-sm text-muted-foreground max-w-[220px] truncate"
                        title={v.purpose}
                      >
                        {v.purpose || "—"}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <Badge
                          variant="outline"
                          className={
                            v.status === "Checked In"
                              ? "border-green-200 text-green-700 bg-green-50"
                              : v.status === "Draft"
                                ? "border-amber-200 text-amber-700"
                                : ""
                          }
                        >
                          {v.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">
                        {toDisplayDateTime(v.entryTime)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant={v.status === "Checked In" ? "secondary" : "outline"}
                          onClick={() => handleRowCheckIn(v)}
                          disabled={v.status === "Checked In" || checkInMutation.isPending}
                        >
                          {v.status === "Checked In" ? "Checked In" : "Check In"}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
