import { useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { ROUTES } from "@/routes/config"
import { fetchVisitors, type VisitorRecord } from "@/lib/visitor-api"
import { markVisitorScreening, rescreenVisitors } from "@/lib/vms-api"
import { getVisitorPhotoUrl } from "@/lib/image-match"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Ban, Flag, Info, Loader2, MoreHorizontal, RefreshCw, Search, Shield, User } from "lucide-react"

type ScreeningExtra = {
  match?: string
  score?: number
  source?: string
  remarks?: string
  screened_at?: string
}

type VisitorWithScreening = VisitorRecord & {
  screening?: ScreeningExtra
  _source?: "walk-in" | "pre-registration"
  residential_address?: string
  mobile_number?: string
  visit_date?: string
  preferred_visit_date?: string
  profile_image_url?: string
}

type WatchlistRow = {
  id: number
  visitor: string
  phone: string
  location: string
  lastVisit: string
  documentType: string
  documentNumber: string
  match: string
  score: string
  remarks: string
  source: string
  photoUrl: string | null
}

function formatDate(s: string) {
  if (!s) return "—"
  try {
    return new Date(s).toLocaleDateString(undefined, { dateStyle: "short" })
  } catch {
    return s
  }
}

async function fetchAllVisitors(): Promise<VisitorWithScreening[]> {
  const [walkIn, preReg] = await Promise.all([
    fetchVisitors("walk-in"),
    fetchVisitors("pre-registration"),
  ])
  const walkInTagged = walkIn.map((v) => ({ ...v, _source: "walk-in" as const }))
  const preRegTagged = preReg.map((v) => ({ ...v, _source: "pre-registration" as const }))
  return [...walkInTagged, ...preRegTagged]
}

function mapMatchStatus(v: VisitorWithScreening): string {
  const screening = v.screening
  if (screening?.match && ["Yes", "No", "Potential"].includes(screening.match)) {
    return screening.match
  }
  const status = (v.watchlist_check_status || "").toLowerCase()
  if (status === "flagged" || status === "blacklisted") return "Yes"
  if (status === "potential") return "Potential"
  return "No"
}

function mapScore(v: VisitorWithScreening): string {
  const score = v.screening?.score
  if (score != null && score > 0) return `${score}%`
  return "0%"
}

function mapRemarks(v: VisitorWithScreening): string {
  if (v.screening?.remarks) return v.screening.remarks
  const status = (v.watchlist_check_status || "").toLowerCase()
  if (!status) return "Not screened yet"
  if (status === "cleared") return "No watchlist or blacklist match"
  return v.watchlist_check_status ?? "—"
}

function visitorToWatchlistRow(v: VisitorWithScreening): WatchlistRow {
  const raw = v as Record<string, unknown>
  const cnic = String(v.cnic_number || raw.cnic_passport || "").trim()
  const passport = String(v.passport_number || "").trim()
  const documentType = cnic ? "CNIC" : passport ? "Passport" : "—"
  const documentNumber = cnic || passport || "—"
  const phone = String(v.phone || raw.mobile_number || "").trim() || "—"
  const location =
    String(raw.residential_address || v.location || "").trim() || "—"
  const lastVisitRaw =
    String(raw.visit_date || raw.preferred_visit_date || v.created_at || "").trim()

  return {
    id: v.id,
    visitor: v.full_name || "Unknown",
    phone,
    location,
    lastVisit: formatDate(lastVisitRaw),
    documentType,
    documentNumber,
    match: mapMatchStatus(v),
    score: mapScore(v),
    remarks: mapRemarks(v),
    source: v._source ?? v.registration_source ?? "—",
    photoUrl: getVisitorPhotoUrl(v as Record<string, unknown>),
  }
}

function MatchBadge({ match }: { match: string }) {
  const base = "px-3 py-1 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap"
  if (match === "Yes") {
    return <span className={`${base} bg-red-100 text-red-700`}>High Risk</span>
  }
  if (match === "Potential") {
    return <span className={`${base} bg-yellow-100 text-yellow-700`}>Potential</span>
  }
  return <span className={`${base} bg-green-100 text-green-700`}>Clear</span>
}

function DocumentTypeBadge({ type }: { type: string }) {
  const base = "px-3 py-1 rounded-full text-xs font-semibold"
  if (type === "CNIC") {
    return <span className={`${base} bg-blue-100 text-blue-700`}>CNIC</span>
  }
  if (type === "Passport") {
    return <span className={`${base} bg-purple-100 text-purple-700`}>Passport</span>
  }
  return <span className="text-muted-foreground text-sm">—</span>
}

type PendingMark = {
  visitorId: number
  visitorName: string
  action: "flagged" | "blacklisted"
}

export default function WatchlistScreeningPage() {
  const [search, setSearch] = useState("")
  const [matchFilter, setMatchFilter] = useState<string>("all")
  const [pendingMark, setPendingMark] = useState<PendingMark | null>(null)
  const queryClient = useQueryClient()

  const { data: visitors, isLoading, isError, error } = useQuery({
    queryKey: ["visitors", "watchlist-screening"],
    queryFn: fetchAllVisitors,
  })

  const rescreenMutation = useMutation({
    mutationFn: () => rescreenVisitors(),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["visitors", "watchlist-screening"] })
      toast({
        title: "Re-screen complete",
        description: `${data.screened} visitor(s) screened against watchlist and blacklist.`,
      })
    },
    onError: (err: Error) => {
      toast({ title: "Re-screen failed", description: err.message, variant: "destructive" })
    },
  })

  const markMutation = useMutation({
    mutationFn: (payload: PendingMark) =>
      markVisitorScreening(payload.visitorId, payload.action),
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["visitors", "watchlist-screening"] })
      void queryClient.invalidateQueries({ queryKey: ["visitors", "screening"] })
      void queryClient.invalidateQueries({ queryKey: ["vms", "screening-summary"] })
      void queryClient.invalidateQueries({ queryKey: ["vms", "security-alerts"] })
      setPendingMark(null)
      toast({
        title: variables.action === "blacklisted" ? "Visitor blacklisted" : "Visitor flagged",
        description: `${variables.visitorName} is now marked as ${data.watchlist_check_status}. Future registrations with the same ID will be checked automatically.`,
      })
    },
    onError: (err: Error) => {
      toast({ title: "Action failed", description: err.message, variant: "destructive" })
    },
  })

  const rows = useMemo(() => {
    if (!visitors) return []
    return visitors.map(visitorToWatchlistRow)
  }, [visitors])

  const filtered = useMemo(() => {
    let list = rows
    if (matchFilter !== "all") {
      list = list.filter((r) => r.match === matchFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (r) =>
          r.visitor.toLowerCase().includes(q) ||
          r.documentNumber.toLowerCase().includes(q) ||
          r.phone.toLowerCase().includes(q) ||
          r.source.toLowerCase().includes(q)
      )
    }
    return list
  }, [rows, search, matchFilter])

  const matchCounts = useMemo(() => {
    const counts = { all: rows.length, Yes: 0, Potential: 0, No: 0 }
    rows.forEach((r) => {
      if (r.match === "Yes") counts.Yes += 1
      else if (r.match === "Potential") counts.Potential += 1
      else counts.No += 1
    })
    return counts
  }, [rows])

  return (
    <>
      <nav className="text-sm text-muted-foreground mb-2">
        <Link to={ROUTES.DASHBOARD} className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Visitor Management System</span>
        <span className="mx-2">/</span>
        <span className="text-[#3b82f6]">Watchlist Screening</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Watchlist Screening</h1>
          <p className="text-sm text-muted-foreground">
            All visitors from walk-in and pre-registration, screened against the internal watchlist.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={rescreenMutation.isPending}
          onClick={() => rescreenMutation.mutate()}
        >
          {rescreenMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Re-screen all
        </Button>
      </div>

      <Alert className="mb-4 border-[#3b82f6]/30 bg-[#3b82f6]/5">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Visitors are loaded from walk-in and pre-registration. Use <strong>Flag</strong> or{" "}
          <strong>Blacklist</strong> in Actions to mark a person — their CNIC/passport is saved to
          the security lists. When they register again (walk-in or pre-reg), status is checked
          automatically: blacklisted, flagged, or clear.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Registered visitors
          </CardTitle>
          <CardDescription>
            {rows.length} visitor(s) from walk-in and pre-registration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="watchlist-search">Search</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="watchlist-search"
                  placeholder="Name, document, phone, or source..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="min-w-[160px]">
              <Label>Match status</Label>
              <select
                value={matchFilter}
                onChange={(e) => setMatchFilter(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">All ({matchCounts.all})</option>
                <option value="No">Clear ({matchCounts.No})</option>
                <option value="Potential">Potential ({matchCounts.Potential})</option>
                <option value="Yes">High Risk ({matchCounts.Yes})</option>
              </select>
            </div>
          </div>

          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#3b82f6]" />
            </div>
          )}
          {isError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load visitors."}
            </div>
          )}

          {!isLoading && !isError && (
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">ID</TableHead>
                    <TableHead>Profile</TableHead>
                    <TableHead>Visitor Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Last Visit</TableHead>
                    <TableHead>Document Type</TableHead>
                    <TableHead>Document Number</TableHead>
                    <TableHead>Match Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                        No visitors match the filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs">{row.id}</TableCell>
                        <TableCell>
                          <div className="h-12 w-12 rounded-full overflow-hidden bg-[#3b82f6]/10 flex items-center justify-center border-2 border-gray-200">
                            {row.photoUrl ? (
                              <img
                                src={row.photoUrl}
                                alt={row.visitor}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  ;(e.target as HTMLImageElement).style.display = "none"
                                }}
                              />
                            ) : (
                              <User className="h-5 w-5 text-[#3b82f6]" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{row.visitor}</TableCell>
                        <TableCell className="text-sm">{row.phone}</TableCell>
                        <TableCell className="text-sm max-w-[140px] truncate" title={row.location}>
                          {row.location}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{row.lastVisit}</TableCell>
                        <TableCell>
                          <DocumentTypeBadge type={row.documentType} />
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {row.documentNumber}
                        </TableCell>
                        <TableCell>
                          <MatchBadge match={row.match} />
                        </TableCell>
                        <TableCell className="text-sm font-medium">{row.score}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate" title={row.remarks}>
                          {row.remarks}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground capitalize whitespace-nowrap">
                          {row.source}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline" className="h-8 gap-1">
                                Actions
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link to={`/visitors/${row.id}`}>View details</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={markMutation.isPending}
                                onClick={() =>
                                  setPendingMark({
                                    visitorId: row.id,
                                    visitorName: row.visitor,
                                    action: "flagged",
                                  })
                                }
                              >
                                <Flag className="h-4 w-4 mr-2 text-amber-600" />
                                Mark as flagged
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={markMutation.isPending}
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  setPendingMark({
                                    visitorId: row.id,
                                    visitorName: row.visitor,
                                    action: "blacklisted",
                                  })
                                }
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Mark as blacklist
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={pendingMark != null} onOpenChange={(open) => !open && setPendingMark(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingMark?.action === "blacklisted" ? "Blacklist visitor?" : "Flag visitor?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMark?.action === "blacklisted" ? (
                <>
                  <strong>{pendingMark.visitorName}</strong> will be added to the blacklist. They
                  will be blocked on registration screening and gate access. Anyone registering with
                  the same CNIC or passport will also be marked blacklisted.
                </>
              ) : (
                <>
                  <strong>{pendingMark?.visitorName}</strong> will be added to the watchlist as
                  flagged. Future registrations with the same ID will be checked and marked
                  accordingly.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={markMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={markMutation.isPending || !pendingMark}
              onClick={(e) => {
                e.preventDefault()
                if (pendingMark) markMutation.mutate(pendingMark)
              }}
              className={
                pendingMark?.action === "blacklisted"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {markMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : pendingMark?.action === "blacklisted" ? (
                "Blacklist"
              ) : (
                "Flag"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
