import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ChevronDown, FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { downloadAgentReport, fetchAgentReport, type ReportSection } from "@/lib/voice-agent-api"
import { cn } from "@/lib/utils"

const PREVIEW_ROWS = 8

function SectionChart({ section }: { section: ReportSection }) {
  const data = section.counts.slice(0, 10).map((c) => ({ name: String(c.value), count: c.count }))
  return (
    <div style={{ height: Math.max(90, data.length * 26 + 20) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 4 }}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={130}
            tick={{ fontSize: 11, fill: "#475569" }}
            tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)}
          />
          <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(v) => [v, "Count"]} />
          <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={16}>
            <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "#0f172a" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function Section({ section, defaultOpen }: { section: ReportSection; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const rows = section.rows.slice(0, PREVIEW_ROWS)
  return (
    <div className="border-t border-slate-200 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-slate-900">{section.heading}</span>
          <span className="block truncate text-xs text-slate-500">
            {section.total.toLocaleString()} record(s) · {section.criteria}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-3 px-4 pb-4">
          {section.counts.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">By {section.counts_by.toLowerCase()}</p>
              <SectionChart section={section} />
            </div>
          )}
          {rows.length > 0 && (
            <div className="max-w-full overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    {section.columns.map((c) => (
                      <th key={c.key} className="whitespace-nowrap border-b border-slate-200 px-2.5 py-1.5 font-semibold">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="odd:bg-white even:bg-slate-50/60">
                      {section.columns.map((c) => (
                        <td key={c.key} className="max-w-[240px] truncate border-b border-slate-100 px-2.5 py-1" title={String(r[c.key] ?? "")}>
                          {String(r[c.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {section.rows.length > rows.length || section.truncated ? (
            <p className="text-xs text-slate-500">
              Showing {rows.length} of {section.total.toLocaleString()} — the PDF/Excel include{" "}
              {section.rows.length.toLocaleString()} rows.
            </p>
          ) : null}
          {section.total === 0 && <p className="text-xs text-slate-500">No records matched.</p>}
        </div>
      )}
    </div>
  )
}

/** A compiled agent report: key figures, charts, table previews and PDF / Excel downloads. */
export function ReportCard({ reportId }: { reportId: string }) {
  const { data: report, isLoading, error } = useQuery({
    queryKey: ["agent-report", reportId],
    queryFn: () => fetchAgentReport(reportId),
    staleTime: Infinity,
  })
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null)
  const [downloadError, setDownloadError] = useState("")

  const download = async (format: "pdf" | "xlsx") => {
    setBusy(format)
    setDownloadError("")
    try {
      await downloadAgentReport(reportId, format)
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Download failed")
    } finally {
      setBusy(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
      </div>
    )
  }
  if (error || !report) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">Could not load this report.</div>
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Report</p>
          <p className="truncate text-sm font-semibold text-slate-900">{report.title}</p>
          <p className="text-xs text-slate-500">
            {report.created_at} · {report.created_by}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={() => download("pdf")} disabled={busy !== null}>
            {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => download("xlsx")} disabled={busy !== null}>
            {busy === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Excel
          </Button>
        </div>
      </div>
      {downloadError && <p className="px-4 pt-2 text-xs text-red-600">{downloadError}</p>}
      {report.key_figures.length > 0 && (
        <ul className="space-y-0.5 px-4 py-3 text-xs text-slate-700">
          {report.key_figures.map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
      )}
      <div className="border-t border-slate-200">
        {report.sections.map((s, i) => (
          <Section key={`${s.heading}-${i}`} section={s} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  )
}
