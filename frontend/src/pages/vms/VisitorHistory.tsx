import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchVisitors, type VisitorRecord } from "@/lib/visitor-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Link } from "react-router-dom"
import { History, Loader2, User, Search } from "lucide-react"

function formatDate(s: string | null | undefined) {
  if (!s) return "—"
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
  } catch {
    return s
  }
}

export default function VisitorHistory() {
  const [search, setSearch] = useState("")

  const { data: visitors, isLoading, isError, error } = useQuery({
    queryKey: ["visitors"],
    queryFn: fetchVisitors,
  })

  const sorted = useMemo(() => {
    if (!visitors) return []
    const list = [...(visitors as VisitorRecord[])]
    list.sort((a, b) => {
      const ta = new Date(a.created_at).getTime()
      const tb = new Date(b.created_at).getTime()
      return tb - ta
    })
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      return list.filter(
        (v) =>
          v.full_name?.toLowerCase().includes(q) ||
          v.cnic_number?.toLowerCase().includes(q) ||
          v.passport_number?.toLowerCase().includes(q) ||
          (v as Record<string, unknown>).host_full_name?.toString().toLowerCase().includes(q)
      )
    }
    return list
  }, [visitors, search])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
          <History className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Visitor History</h1>
          <p className="text-sm text-muted-foreground">
            View past visitor records and visit history. Search by name, CNIC, passport, or host.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <Label htmlFor="history-search" className="text-muted-foreground text-sm">Search</Label>
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="history-search"
            placeholder="Name, CNIC, passport, or host..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#3b82f6]" />
        </div>
      )}
      {isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load visitors."}
        </div>
      )}
      {sorted && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-medium text-foreground">
            Visitor records ({sorted.length})
          </div>
          {sorted.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No visitors match the search.</div>
          ) : (
            <ul className="divide-y divide-border">
              {sorted.map((v) => (
                <li key={v.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-[#3b82f6]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{v.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(v as Record<string, unknown>).host_full_name != null && `Host: ${String((v as Record<string, unknown>).host_full_name)} · `}
                        Department: {v.department_to_visit || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Registered {formatDate(v.created_at)}
                        {v.flow_stage && ` · ${v.flow_stage}`}
                        {v.approval_status && ` · ${v.approval_status}`}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/visitors/${v.id}`}>View</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
