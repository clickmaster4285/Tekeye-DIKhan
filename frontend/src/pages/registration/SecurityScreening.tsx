import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { ROUTES } from "@/routes/config"
import { fetchVisitors, type VisitorRecord } from "@/lib/visitor-api"
import {
  fetchScreeningSummary,
  rescreenVisitors,
  type ScreeningSummary,
} from "@/lib/vms-api"
import { getVisitorPhotoUrl } from "@/lib/image-match"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { ShieldCheck, Loader2, Search, User, RefreshCw } from "lucide-react"

type ScreeningExtra = {
  match?: string
  score?: number
  source?: string
  remarks?: string
  screened_at?: string
}

type VisitorWithScreening = VisitorRecord & {
  screening?: ScreeningExtra
  _source?: string
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

function statusBadgeClass(status: string) {
  switch (status) {
    case "cleared":
      return "bg-green-500/10 text-green-700"
    case "flagged":
      return "bg-amber-500/10 text-amber-700"
    case "potential":
      return "bg-yellow-500/10 text-yellow-700"
    case "blacklisted":
      return "bg-red-500/10 text-red-700"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function statusLabel(status: string) {
  if (!status) return "Not checked"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function SecurityScreeningPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const queryClient = useQueryClient()

  const { data: visitors, isLoading, isError, error } = useQuery({
    queryKey: ["visitors", "screening"],
    queryFn: fetchAllVisitors,
  })

  const { data: summary } = useQuery({
    queryKey: ["vms", "screening-summary"],
    queryFn: fetchScreeningSummary,
  })

  const rescreenMutation = useMutation({
    mutationFn: () => rescreenVisitors(),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["visitors", "screening"] })
      void queryClient.invalidateQueries({ queryKey: ["vms", "screening-summary"] })
      toast({
        title: "Re-screen complete",
        description: `${data.screened} visitor(s) screened against watchlist and blacklist.`,
      })
    },
    onError: (err: Error) => {
      toast({ title: "Re-screen failed", description: err.message, variant: "destructive" })
    },
  })

  const counts: ScreeningSummary = summary ?? {
    total: visitors?.length ?? 0,
    cleared: 0,
    flagged: 0,
    potential: 0,
    blacklisted: 0,
    not_checked: 0,
  }

  const filtered = useMemo(() => {
    if (!visitors) return []
    let list = visitors
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (v) =>
          v.full_name?.toLowerCase().includes(q) ||
          v.cnic_number?.toLowerCase().includes(q) ||
          v.passport_number?.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== "all") {
      if (statusFilter === "not_checked") {
        list = list.filter((v) => !v.watchlist_check_status)
      } else {
        list = list.filter((v) => (v.watchlist_check_status ?? "") === statusFilter)
      }
    }
    return list
  }, [visitors, search, statusFilter])

  const renderProfileImage = (v: VisitorRecord) => {
    const src = getVisitorPhotoUrl(v as Record<string, unknown>)
    if (src) {
      return (
        <img
          src={src}
          alt={v.full_name || "Visitor"}
          className="h-full w-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.style.display = "none"
          }}
        />
      )
    }
    return <User className="h-5 w-5 text-[#3b82f6]" />
  }

  return (
    <>
      <nav className="text-sm text-muted-foreground mb-2">
        <Link to={ROUTES.DASHBOARD} className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Visitor Management System</span>
        <span className="mx-2">/</span>
        <span className="text-[#3b82f6]">Security & Screening</span>
      </nav>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Security & Screening</h1>
          <p className="text-sm text-muted-foreground">
            Live screening results from watchlist and blacklist checks on all registered visitors.
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {(
          [
            ["all", counts.total, "Total"],
            ["cleared", counts.cleared, "Cleared"],
            ["flagged", counts.flagged, "Flagged"],
            ["potential", counts.potential, "Potential"],
            ["blacklisted", counts.blacklisted, "Blacklisted"],
            ["not_checked", counts.not_checked, "Not checked"],
          ] as const
        ).map(([key, count, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              statusFilter === key ? "border-[#3b82f6] bg-[#3b82f6]/5" : "border-border hover:bg-muted/50"
            }`}
          >
            <p className="text-2xl font-semibold text-foreground">{count}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </button>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Visitor list
          </CardTitle>
          <CardDescription>Filter by name, CNIC, passport, or screening status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Search visitor</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Name, CNIC, or passport..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="min-w-[160px]">
              <Label>Screening status</Label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">All ({counts.total})</option>
                <option value="cleared">Cleared ({counts.cleared})</option>
                <option value="flagged">Flagged ({counts.flagged})</option>
                <option value="potential">Potential ({counts.potential})</option>
                <option value="blacklisted">Blacklisted ({counts.blacklisted})</option>
                <option value="not_checked">Not checked ({counts.not_checked})</option>
              </select>
            </div>
          </div>

          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[#3b82f6]" />
            </div>
          )}
          {isError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load visitors."}
            </div>
          )}

          {!isLoading && !isError && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border font-medium text-foreground">
                Visitors {filtered.length > 0 ? `(${filtered.length})` : ""}
              </div>
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No visitors match the filters.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {filtered.map((v) => {
                    const screening = (v as VisitorWithScreening).screening
                    const status = v.watchlist_check_status ?? ""
                    return (
                      <li
                        key={`${v.registration_source ?? "v"}-${v.id}`}
                        className="p-4 flex items-center justify-between gap-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-10 w-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center shrink-0 overflow-hidden">
                            {renderProfileImage(v)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-foreground truncate">
                                {v.full_name || "Unknown"}
                              </p>
                              <span
                                className={`inline-block text-xs px-2 py-0.5 rounded ${statusBadgeClass(
                                  status
                                )}`}
                              >
                                {statusLabel(status)}
                              </span>
                              {v._source ? (
                                <span className="text-xs text-muted-foreground">({v._source})</span>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {v.cnic_number && <span>CNIC: {v.cnic_number}</span>}
                              {v.cnic_number && v.passport_number && <span> · </span>}
                              {v.passport_number && <span>Passport: {v.passport_number}</span>}
                              {!v.cnic_number && !v.passport_number && "No ID documents"}
                              {v.created_at && <span> · Added: {formatDate(v.created_at)}</span>}
                            </p>
                            {screening && (screening.remarks || screening.score !== undefined) && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {screening.source && screening.source !== "none" && (
                                  <span className="capitalize">{screening.source} · </span>
                                )}
                                {screening.score !== undefined && screening.score > 0 && (
                                  <span>Score: {screening.score}% · </span>
                                )}
                                {screening.remarks}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/visitors/${v.id}`}>View Details</Link>
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
