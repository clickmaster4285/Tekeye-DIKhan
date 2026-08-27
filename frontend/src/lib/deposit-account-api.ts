/**
 * Deposit Account Register API — linked to detention memos for detention-type deposits.
 */
import { API_BASE_URL, getAuthHeaders } from "@/lib/api"

const BASE = `${API_BASE_URL}/api/deposit-accounts`

function errorMessage(res: Response, body: unknown): string {
  if (res.status === 400 && body && typeof body === "object" && !Array.isArray(body)) {
    const err = body as Record<string, unknown>
    const parts = Object.entries(err).map(([k, v]) =>
      `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`
    )
    if (parts.length) return parts.join("; ")
  }
  if (body && typeof body === "object" && "detail" in body) {
    return String((body as { detail: unknown }).detail)
  }
  return `Request failed (${res.status})`
}

export type DepositAccountRow = {
  id: string
  detentionMemoId?: string
  /** Case no. of linked detention memo (if any). */
  linkedMemoCaseNo?: string
  treasuryChallanNo: string
  depositType: string
  caseSeizureRef: string
  firNo: string
  customsStation: string
  amount: string
  depositDate: string
  bankTreasuryName: string
  status: string
  remarks: string
  /** ISO timestamps from API (list/detail). */
  createdAt?: string
  updatedAt?: string
}

export async function fetchDepositAccounts(): Promise<DepositAccountRow[]> {
  const res = await fetch(`${BASE}/list/`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // ignore
  }
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as DepositAccountRow[]
}

export async function fetchDepositAccountById(id: string): Promise<DepositAccountRow> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}/read/`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // ignore
  }
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as DepositAccountRow
}

export async function createDepositAccountEntry(
  payload: Record<string, unknown>
): Promise<DepositAccountRow> {
  const res = await fetch(`${BASE}/create/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // ignore
  }
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as DepositAccountRow
}

export type DepositAccountPatch = Partial<{
  detentionMemoId: string
  treasuryChallanNo: string
  depositType: string
  caseSeizureRef: string
  firNo: string
  customsStation: string
  amount: string
  depositDate: string
  bankTreasuryName: string
  status: string
  remarks: string
}>

export async function updateDepositAccountEntry(
  id: string,
  patch: DepositAccountPatch
): Promise<DepositAccountRow> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}/update/`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(patch),
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // ignore
  }
  if (!res.ok) throw new Error(errorMessage(res, body))
  return body as DepositAccountRow
}

export async function deleteDepositAccountEntry(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}/delete/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  })
  if (!res.status.toString().startsWith("2")) {
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      // ignore
    }
    throw new Error(errorMessage(res, body))
  }
}
