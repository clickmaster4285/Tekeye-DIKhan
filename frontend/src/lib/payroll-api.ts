import { API_BASE_URL, getAuthHeaders } from "@/lib/api"

export type PayrollEntryRecord = {
  id: number
  run: number
  staff: number
  staff_name: string
  employee_id: string | null
  basic_salary: string
  allowances: string
  gross_salary: string
  income_tax: string
  eobi_or_sss: string
  other_deductions: string
  net_salary: string
  created_at: string
}

export type PayrollRunRecord = {
  id: number
  period_label: string
  period_start: string
  period_end: string
  status: "DRAFT" | "PROCESSED" | "LOCKED"
  total_gross: string | null
  total_net: string | null
  employee_count: number
  created_by: number | null
  created_at: string
  processed_at: string | null
  entries: PayrollEntryRecord[]
  entries_count: number
}

const BASE = `${API_BASE_URL}/api`

export async function fetchPayrollRuns(): Promise<PayrollRunRecord[]> {
  const res = await fetch(`${BASE}/payroll-runs/`, { headers: getAuthHeaders(), cache: "no-store" })
  if (res.status === 401) throw new Error("Unauthorized")
  if (!res.ok) throw new Error(`Failed to load payroll runs (${res.status})`)
  const data = await res.json()
  return Array.isArray(data) ? data : data?.results ?? []
}

export async function createPayrollRun(payload: {
  period_label: string
  period_start: string
  period_end: string
}): Promise<PayrollRunRecord> {
  const res = await fetch(`${BASE}/payroll-runs/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  if (res.status === 401) throw new Error("Unauthorized")
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = typeof err === "object" && err !== null ? Object.entries(err).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`).join("; ") : `Failed to create payroll run (${res.status})`
    throw new Error(msg)
  }
  return res.json()
}

export async function processPayrollRun(id: number): Promise<PayrollRunRecord> {
  const res = await fetch(`${BASE}/payroll-runs/${id}/process/`, { method: "POST", headers: getAuthHeaders() })
  if (res.status === 401) throw new Error("Unauthorized")
  if (!res.ok) throw new Error(`Failed to process payroll (${res.status})`)
  return res.json()
}
