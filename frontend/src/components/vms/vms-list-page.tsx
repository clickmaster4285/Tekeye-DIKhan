import { useCallback, useEffect, useMemo, useState } from "react"
import { fetchVmsListRows, saveVmsListRows, type VmsListRow } from "@/lib/vms-list-api"
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

type RecordRow = { id: string } & Record<string, string>

type Column = {
  key: string
  label: string
  render?: (row: RecordRow) => React.ReactNode
}

type Field = {
  key: string
  label: string
  placeholder?: string
}

type Breadcrumb = {
  label: string
  href?: string
}

type Props = {
  title: string
  description: string
  storageKey: string
  columns: Column[]
  formFields: Field[]
  initialRows: Record<string, string>[]
  breadcrumbs: Breadcrumb[]
  filterField?: string
}

export function VmsListPage({
  title,
  description,
  storageKey,
  columns,
  formFields,
  initialRows: _initialRows,
  breadcrumbs,
  filterField,
}: Props) {
  const [rows, setRows] = useState<RecordRow[]>([])
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)

  const effectiveFilterField = filterField ?? columns[0]?.key ?? ""

  const persistRows = useCallback(
    async (next: RecordRow[]) => {
      await saveVmsListRows(storageKey, next as VmsListRow[])
    },
    [storageKey]
  )

  const reload = useCallback(async () => {
    setLoading(true)
    setSaveError(null)
    try {
      const fromApi = await fetchVmsListRows(storageKey)
      const withoutBlob = fromApi.filter((r) => r.id !== "__json__")
      setRows(withoutBlob as RecordRow[])
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to load records")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [storageKey])

  useEffect(() => {
    void reload()
  }, [reload])

  const filterOptions = useMemo(() => {
    if (!effectiveFilterField) return []
    return Array.from(
      new Set(
        rows
          .map((r) => String(r[effectiveFilterField] ?? "").trim())
          .filter((v) => v.length > 0)
      )
    )
  }, [effectiveFilterField, rows])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesFilter =
        filter === "all" ||
        (effectiveFilterField && String(row[effectiveFilterField] ?? "") === filter)
      const matchesSearch =
        q.length === 0 ||
        columns.some((c) => String(row[c.key] ?? "").toLowerCase().includes(q)) ||
        String(row.id ?? "").toLowerCase().includes(q)
      return matchesFilter && matchesSearch
    })
  }, [columns, effectiveFilterField, filter, rows, search])

  const openAddForm = () => {
    setFormData({})
    setOpen(true)
  }

  const onAdd = async () => {
    const payload: Record<string, string> = {}
    for (const field of formFields) {
      payload[field.key] = (formData[field.key] ?? "").trim()
    }
    if (Object.values(payload).some((v) => !v)) return
    const newRow: RecordRow = {
      id: `row-${Date.now()}`,
      ...payload,
    }
    const next = [newRow, ...rows]
    setRows(next)
    setFormData({})
    setOpen(false)
    try {
      await persistRows(next)
      setSaveError(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save")
      void reload()
    }
  }

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
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>Records stored in the database.</CardDescription>
            </div>
            <div className="flex flex-col md:flex-row gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search records..."
                className="md:w-56"
              />
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="md:w-52">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {filterOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={openAddForm}>Add</Button>
            </div>
          </div>
          {saveError && (
            <p className="text-sm text-destructive mt-2">{saveError}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c.key}>{c.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                      No records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      {columns.map((c) => (
                        <TableCell key={`${row.id}-${c.key}`}>
                          {c.render ? c.render(row) : (row[c.key] ?? "—")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) setFormData({}) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {formFields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label>{field.label}</Label>
                <Input
                  value={formData[field.key] ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void onAdd()}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
