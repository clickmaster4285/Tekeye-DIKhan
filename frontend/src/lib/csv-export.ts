export function csvCell(value: unknown): string {
  if (value == null) return '""'
  if (typeof value === "boolean") return csvCell(value ? "Yes" : "No")
  const text = String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  return `"${text.replace(/"/g, '""')}"`
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const name = filename.toLowerCase().endsWith(".csv") ? filename : `${filename}.csv`
  const lines = [headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))]
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function joinList(values: Array<string | undefined | null> | undefined, sep = "; "): string {
  return (values || []).map((v) => (v || "").trim()).filter(Boolean).join(sep)
}
