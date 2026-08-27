import { useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { FileText, Search, X, Hash, FileDown } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import tariffData from "@/data/tariff-2025-26.json"

export type TariffRow = {
  pctCode: string
  description: string
  cd: number
}

const rows: TariffRow[] = tariffData as TariffRow[]

const CHAPTERS = [
  { id: "01", label: "Ch.01 Live animals" },
  { id: "02", label: "Ch.02 Meat" },
  { id: "03", label: "Ch.03 Fish" },
  { id: "04", label: "Ch.04 Dairy" },
  { id: "05", label: "Ch.05 Hair / Bristles" },
]

/** Split full data into 3 tabs for Excel: Tab1 Ch01-02, Tab2 Ch03-04, Tab3 Ch05+ */
function getDataByTabs(data: TariffRow[]): { name: string; rows: TariffRow[] }[] {
  const tab1 = data.filter((r) => r.pctCode.startsWith("01") || r.pctCode.startsWith("02"))
  const tab2 = data.filter((r) => r.pctCode.startsWith("03") || r.pctCode.startsWith("04"))
  const tab3 = data.filter((r) => !r.pctCode.startsWith("01") && !r.pctCode.startsWith("02") && !r.pctCode.startsWith("03") && !r.pctCode.startsWith("04"))
  return [
    { name: "Ch 01-02 Live animals & Meat", rows: tab1 },
    { name: "Ch 03-04 Fish & Dairy", rows: tab2 },
    { name: "Ch 05+ Other", rows: tab3 },
  ]
}

function downloadHsCodesExcel() {
  const tabs = getDataByTabs(rows)
  const wb = XLSX.utils.book_new()
  for (const tab of tabs) {
    const sheetData = tab.rows.map((r) => ({
      "PCT Code": r.pctCode,
      "Description": r.description,
      "CD (%)": r.cd,
    }))
    const ws = XLSX.utils.json_to_sheet(sheetData)
    const safeName = tab.name.slice(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, safeName)
  }
  XLSX.writeFile(wb, "Pakistan-Customs-Tariff-2025-26-HS-Codes.xlsx")
}

export default function HSCodesFilePage() {
  const [search, setSearch] = useState("")
  const [chapterFilter, setChapterFilter] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = rows
    if (chapterFilter) {
      list = list.filter((r) => r.pctCode.startsWith(chapterFilter))
    }
    if (!search.trim()) return list
    const q = search.trim().toLowerCase()
    return list.filter(
      (r) =>
        r.pctCode.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        String(r.cd).includes(q)
    )
  }, [search, chapterFilter])

  return (
    <ModulePageLayout
      title="HS Codes file"
      description="Pakistan Customs Tariff FY 2025-26. Search by PCT code, description, or CD (%)"
      breadcrumbs={[{ label: "WMS" }, { label: "Warehouse" }, { label: "HS Codes file" }]}
    >
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="bg-muted/30 border-b border-border/60 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </span>
                Pakistan Customs Tariff FY 2025-26
              </CardTitle>
              <CardDescription className="mt-1.5">
                PCT Code, Description and CD (%). Download as Excel with whole data in 3 tabs (Ch 01-02, Ch 03-04, Ch 05+).
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={downloadHsCodesExcel}
              >
                <FileDown className="h-4 w-4" />
                Download Excel (3 tabs)
              </Button>
              <Badge variant="secondary" className="w-fit font-mono text-xs">
                <Hash className="mr-1 h-3 w-3" />
                {rows.length} codes
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          {/* Search + filters */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by code, description or CD (%)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-9 pr-9"
              />
              {search && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium">Chapter:</span>
              {CHAPTERS.map((ch) => (
                <Button
                  key={ch.id}
                  type="button"
                  variant={chapterFilter === ch.id ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setChapterFilter(chapterFilter === ch.id ? null : ch.id)}
                >
                  {ch.id}
                </Button>
              ))}
              {chapterFilter && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() => setChapterFilter(null)}
                >
                  All
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-lg border border-border/80 bg-card">
            <div className="overflow-auto max-h-[calc(100vh-340px)]">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/80 bg-muted/50 hover:bg-muted/50">
                    <TableHead className="sticky top-0 z-10 w-[130px] min-w-[130px] border-b border-border/80 bg-muted/80 font-semibold backdrop-blur-sm">
                      PCT Code
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 min-w-[200px] border-b border-border/80 bg-muted/80 font-semibold backdrop-blur-sm">
                      Description
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 w-[90px] min-w-[90px] border-b border-border/80 bg-muted/80 text-right font-semibold backdrop-blur-sm">
                      CD (%)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-center text-muted-foreground py-12"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Search className="h-10 w-10 opacity-40" />
                          <p className="font-medium">No matching HS codes</p>
                          <p className="text-sm">
                            Try a different search or clear the chapter filter.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r, i) => (
                      <TableRow
                        key={r.pctCode}
                        className={cn(
                          "border-border/60 transition-colors hover:bg-muted/40",
                          i % 2 === 1 && "bg-muted/20"
                        )}
                      >
                        <TableCell className="font-mono text-sm font-medium text-foreground/90">
                          <span className="inline-flex rounded bg-muted/60 px-2 py-0.5">
                            {r.pctCode}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm leading-snug text-foreground/90">
                          {r.description}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={cn(
                              "min-w-[2.25rem] font-mono font-semibold tabular-nums",
                              r.cd === 0 && "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
                              r.cd > 0 && r.cd < 15 && "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
                              r.cd >= 15 && "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                            )}
                          >
                            {r.cd}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              Showing <strong className="font-semibold text-foreground">{filtered.length}</strong> of{" "}
              <strong className="font-semibold text-foreground">{rows.length}</strong> entries
            </span>
            {chapterFilter && (
              <span className="text-xs">
                Chapter {chapterFilter} filter active
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </ModulePageLayout>
  )
}
