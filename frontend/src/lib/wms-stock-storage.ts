import type { DetentionMemoApiRecord, DetentionMemoGoodsLineApi } from "@/lib/detention-memo-api"
import { fetchDetentionMemoById } from "@/lib/detention-memo-api"
import { apiStockToWmsRow, promoteSeizure } from "@/lib/wms-flow-api"

export const STOCK_STORAGE_KEY = "wms_stock_management"
export const SEIZED_STORAGE_KEY = "wms_seized_inventory"
export const WMS_STOCK_UPDATED_EVENT = "wms-stock-updated"

export type DepositSeizeInput = {
  id: string
  detentionMemoId?: string
  caseSeizureRef?: string
  treasuryChallanNo?: string
  firNo?: string
  depositDate?: string
  customsStation?: string
  bankTreasuryName?: string
  amount?: string
  remarks?: string
}

export type WmsStockRow = {
  id: string
  qrCodeNumber?: string
  seizureCaseRef: string
  pctCode: string
  descriptionOfGoods: string
  customsStation?: string
  godownWarehouse: string
  quantity: string
  unitOfMeasure: string
  condition: string
  custody?: string
  custodianOfficerName?: string
  status: string
  detentionMemoId?: string
  detentionCaseNo?: string
  referenceNumber?: string
}

export type SeizedInventoryRecord = DetentionMemoApiRecord & {
  id: string
  sourceDetentionId: string
  seizedAt: string
  dispositionStatus?: string
}

export type DestructionSyncInput = {
  detentionMemoId: string
  detentionCaseNo: string
  referenceNumber?: string
  selectedItems: Array<{
    goodsLineId: string
    qrCode: string
    quantity: string
    description?: string
  }>
  inventoryDeductions: Array<{
    stock_id?: string
    client_row_id?: string
    qr_code?: string
    case_ref?: string
    description?: string
    quantity_after?: string
    quantity_deducted?: string
    status?: string
  }>
  updatedGoodsLines?: Array<{
    id: string
    qrCodeNumber: string
    quantity: string
    condition: string
  }>
}

export function loadStockRows(): WmsStockRow[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STOCK_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as WmsStockRow[]) : []
  } catch {
    return []
  }
}

export function saveStockRows(rows: WmsStockRow[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(rows))
}

export function loadSeizedInventory(): SeizedInventoryRecord[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(SEIZED_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SeizedInventoryRecord[]) : []
  } catch {
    return []
  }
}

export function saveSeizedInventory(rows: SeizedInventoryRecord[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(SEIZED_STORAGE_KEY, JSON.stringify(rows))
}

export function notifyWmsStockUpdated() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(WMS_STOCK_UPDATED_EVENT))
}

function upsertSeizedMemoEntry(memo: DetentionMemoApiRecord, settlementStatus = "Forwarded to seizure"): void {
  const memoId = memo.id
  const seizedList = loadSeizedInventory()
  const existingIdx = seizedList.findIndex((s) => s.sourceDetentionId === memoId)
  const seizedEntry: SeizedInventoryRecord = {
    ...memo,
    id: existingIdx >= 0 ? seizedList[existingIdx].id : `seized-${Date.now()}`,
    sourceDetentionId: memoId,
    seizedAt: new Date().toISOString(),
    dispositionStatus: memo.dispositionStatus || "In Warehouse",
    settlementStatus: memo.settlementStatus || settlementStatus,
  }
  if (existingIdx >= 0) seizedList[existingIdx] = { ...seizedList[existingIdx], ...seizedEntry }
  else seizedList.unshift(seizedEntry)
  saveSeizedInventory(seizedList)
}

function upsertStockRowsFromMemo(memo: DetentionMemoApiRecord): boolean {
  const caseNo = (memo.caseNo || "").trim()
  const memoId = memo.id
  const stockRows = loadStockRows()
  const nextStock = [...stockRows]
  let stockChanged = false

  for (const g of memo.goodsItems || []) {
    const qr = (g.qrCodeNumber || "").trim()
    const clientId = `stock-${caseNo || memoId}-${g.id}`
    const idx = nextStock.findIndex(
      (r) =>
        r.id === clientId ||
        (qr && r.qrCodeNumber?.toLowerCase() === qr.toLowerCase()) ||
        (r.detentionMemoId === memoId && r.descriptionOfGoods === g.description)
    )
    const row: WmsStockRow = {
      id: clientId,
      qrCodeNumber: g.qrCodeNumber || "",
      seizureCaseRef: caseNo,
      detentionCaseNo: caseNo,
      detentionMemoId: memoId,
      referenceNumber: memo.referenceNumber || "",
      pctCode: g.pctCode || "",
      descriptionOfGoods: g.description || "",
      godownWarehouse: memo.whereDeposited || "",
      customsStation: memo.placeOfDetention || "",
      quantity: g.quantity || "0",
      unitOfMeasure: g.unit || "PCS",
      condition: g.condition || "Seized",
      status: "In Custody",
    }
    if (idx >= 0) {
      nextStock[idx] = { ...nextStock[idx], ...row }
    } else {
      nextStock.push(row)
    }
    stockChanged = true
  }

  if (stockChanged) {
    saveStockRows(nextStock)
    notifyWmsStockUpdated()
  }
  return stockChanged
}

function upsertDepositOnlyStockRow(deposit: DepositSeizeInput): void {
  const caseNo = (deposit.caseSeizureRef || deposit.treasuryChallanNo || "—").trim()
  const memoId = deposit.detentionMemoId?.trim() || `deposit-${deposit.id}`
  const clientId = `stock-deposit-${deposit.id}`
  const stockRows = loadStockRows()
  const idx = stockRows.findIndex((r) => r.id === clientId || (r.detentionMemoId === memoId && !r.qrCodeNumber))
  const row: WmsStockRow = {
    id: clientId,
    seizureCaseRef: caseNo,
    detentionCaseNo: caseNo,
    detentionMemoId: memoId,
    referenceNumber: deposit.treasuryChallanNo || "",
    pctCode: "",
    descriptionOfGoods: `Deposit custody — ${deposit.depositDate || "forwarded from deposit account"}`,
    godownWarehouse: deposit.bankTreasuryName || "",
    customsStation: deposit.customsStation || "",
    quantity: deposit.amount || "1",
    unitOfMeasure: "PCS",
    condition: "Seized",
    status: "In Custody",
  }
  const nextStock = [...stockRows]
  if (idx >= 0) nextStock[idx] = { ...nextStock[idx], ...row }
  else nextStock.push(row)
  saveStockRows(nextStock)
  notifyWmsStockUpdated()
}

function upsertDepositOnlySeizedEntry(deposit: DepositSeizeInput, reason: string): void {
  const memoId = deposit.detentionMemoId?.trim() || `deposit-${deposit.id}`
  const seizedList = loadSeizedInventory()
  const existingIdx = seizedList.findIndex((s) => s.sourceDetentionId === memoId)
  const seizedEntry: SeizedInventoryRecord = {
    id: existingIdx >= 0 ? seizedList[existingIdx].id : `seized-${Date.now()}`,
    sourceDetentionId: memoId,
    seizedAt: new Date().toISOString(),
    caseNo: deposit.caseSeizureRef || deposit.treasuryChallanNo || "—",
    firNumber: deposit.firNo || "",
    referenceNumber: deposit.treasuryChallanNo || "",
    dateTimeOccurrence: deposit.depositDate || "",
    placeOfOccurrence: deposit.customsStation || "",
    dateTimeDetention: deposit.depositDate || "",
    placeOfDetention: deposit.customsStation || "",
    detentionType: "Deposit",
    directorate: "",
    reasonForDetention: reason,
    whereDeposited: deposit.bankTreasuryName || "",
    settlementStatus: "Forwarded to seizure",
    verificationStatus: "Registered",
    createdAt: deposit.depositDate || new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
    goodsItems: [],
  }
  if (existingIdx >= 0) seizedList[existingIdx] = { ...seizedList[existingIdx], ...seizedEntry }
  else seizedList.unshift(seizedEntry)
  saveSeizedInventory(seizedList)
}

/** When a detention is seized: API + local seizure register and stock rows. */
export async function promoteDetentionToSeizedAndInventory(
  memo: DetentionMemoApiRecord,
  opts?: { depositAccountId?: string; source?: string; remarks?: string }
): Promise<boolean> {
  if (typeof window === "undefined") return false
  try {
    const result = await promoteSeizure({
      detentionMemoId: memo.id,
      depositAccountId: opts?.depositAccountId,
      source: opts?.source || "detention_memo",
      remarks: opts?.remarks,
    })
    upsertSeizedMemoEntry({
      ...memo,
      settlementStatus: memo.settlementStatus || "Forwarded to seizure",
      dispositionStatus: memo.dispositionStatus || "In Warehouse",
    })
    const stockRows = loadStockRows()
    const nextStock = [...stockRows]
    for (const apiRow of result.stockItems) {
      const mapped = apiStockToWmsRow(apiRow)
      const idx = nextStock.findIndex(
        (r) =>
          r.id === mapped.id ||
          (mapped.qrCodeNumber && r.qrCodeNumber?.toLowerCase() === mapped.qrCodeNumber.toLowerCase())
      )
      if (idx >= 0) nextStock[idx] = { ...nextStock[idx], ...mapped }
      else nextStock.unshift(mapped)
    }
    if (result.stockItems.length === 0) upsertStockRowsFromMemo(memo)
    else saveStockRows(nextStock)
    notifyWmsStockUpdated()
    return true
  } catch {
    upsertSeizedMemoEntry(memo)
    upsertStockRowsFromMemo(memo)
    notifyWmsStockUpdated()
    return true
  }
}

/** Deposit / release flows: load linked memo goods when possible, else create deposit stock row. */
export async function promoteDepositToSeizedAndInventory(
  deposit: DepositSeizeInput,
  reason = "Forwarded to seizure register from Deposit Account Register."
): Promise<boolean> {
  if (typeof window === "undefined") return false
  const memoId = deposit.detentionMemoId?.trim()
  if (memoId) {
    try {
      const memo = await fetchDetentionMemoById(memoId)
      return promoteDetentionToSeizedAndInventory(memo, {
        depositAccountId: deposit.id,
        source: "deposit_forward",
        remarks: reason,
      })
    } catch {
      // Fall through to deposit-only row when memo is unavailable.
    }
  }
  upsertDepositOnlySeizedEntry(deposit, reason)
  upsertDepositOnlyStockRow(deposit)
  return true
}

function terminalStatus(qty: string | number): string {
  return Number(qty) <= 0 ? "Destructed" : "In Custody"
}

export function applyStockDeductions(
  deductions: Array<{
    stock_id?: string
    client_row_id?: string
    case_ref?: string
    qr_code?: string
    description?: string
    quantity_after?: string
    status?: string
  }>
) {
  const rows = loadStockRows()
  let changed = false
  const next = [...rows]

  for (const d of deductions) {
    const qr = (d.qr_code || "").trim().toLowerCase()
    const caseRef = (d.case_ref || "").trim().toLowerCase()
    const stockId = (d.stock_id || "").trim()
    const clientRowId = (d.client_row_id || "").trim()
    const after = d.quantity_after ?? "0"
    const status = d.status || terminalStatus(after)

    const idx = next.findIndex((row) => {
      if (clientRowId && row.id === clientRowId) return true
      if (stockId && row.id === stockId) return true
      if (qr && row.qrCodeNumber?.toLowerCase() === qr) return true
      if (qr && caseRef && row.seizureCaseRef?.toLowerCase() === caseRef) return true
      return false
    })

    if (idx >= 0) {
      next[idx] = {
        ...next[idx],
        quantity: after,
        status,
        condition: Number(after) <= 0 ? "Destructed" : next[idx].condition,
      }
      changed = true
      continue
    }

    if (qr || caseRef) {
      next.push({
        id: clientRowId || stockId || `stock-${qr || caseRef}`,
        qrCodeNumber: d.qr_code || "",
        seizureCaseRef: d.case_ref || "",
        descriptionOfGoods: d.description || "",
        pctCode: "",
        godownWarehouse: "",
        quantity: after,
        unitOfMeasure: "",
        condition: Number(after) <= 0 ? "Destructed" : "Seized",
        status,
      })
      changed = true
    }
  }

  if (changed) saveStockRows(next)
  return next
}

function deductGoodsLineQty(current: string, deduct: string): string {
  const after = Math.max(0, Number(current || 0) - Number(deduct || 0))
  return String(after)
}

function matchGoodsLine(
  line: DetentionMemoGoodsLineApi,
  item: { goodsLineId: string; qrCode: string; description?: string }
): boolean {
  const id = (line.id || "").trim()
  const qr = (line.qrCodeNumber || "").trim().toLowerCase()
  const itemQr = (item.qrCode || "").trim().toLowerCase()
  if (item.goodsLineId && id === item.goodsLineId) return true
  if (itemQr && qr && qr === itemQr) return true
  if (item.description && line.description === item.description) return true
  return false
}

/** Update seized inventory snapshot when destruction completes. */
export function applySeizedInventoryDestruction(input: DestructionSyncInput) {
  const seized = loadSeizedInventory()
  let changed = false
  const next = seized.map((entry) => {
    const matchesMemo =
      entry.sourceDetentionId === input.detentionMemoId ||
      (input.detentionCaseNo &&
        entry.caseNo &&
        entry.caseNo.toLowerCase() === input.detentionCaseNo.toLowerCase())
    if (!matchesMemo) return entry

    const goodsItems = (entry.goodsItems || []).map((line) => {
      const hit = input.selectedItems.find((item) => matchGoodsLine(line, item))
      if (!hit) return line
      const after = deductGoodsLineQty(line.quantity, hit.quantity)
      changed = true
      return {
        ...line,
        quantity: after,
        condition: Number(after) <= 0 ? "Destructed" : line.condition,
      }
    })

    const allDestructed =
      goodsItems.length > 0 && goodsItems.every((g) => Number(g.quantity) <= 0 || g.condition === "Destructed")

    return {
      ...entry,
      goodsItems,
      dispositionStatus: allDestructed ? "Destructed" : "Partially Destructed",
      settlementStatus: allDestructed ? "Destructed" : entry.settlementStatus,
    }
  })

  if (changed) saveSeizedInventory(next)
  return next
}

/** Sync stock, seized register, and local memo-facing state after backend destruction. */
export function applyDestructionAcrossModules(input: DestructionSyncInput) {
  if (input.inventoryDeductions.length > 0) {
    applyStockDeductions(input.inventoryDeductions)
  } else if (input.selectedItems.length > 0) {
    applyStockDeductions(
      input.selectedItems.map((item) => ({
        qr_code: item.qrCode,
        case_ref: input.detentionCaseNo,
        description: item.description,
        quantity_after: "0",
        status: "Destructed",
      }))
    )
  }

  applySeizedInventoryDestruction(input)

  if (input.updatedGoodsLines?.length) {
    const seized = loadSeizedInventory()
    const next = seized.map((entry) => {
      if (entry.sourceDetentionId !== input.detentionMemoId) return entry
      const goodsItems = (entry.goodsItems || []).map((line) => {
        const hit = input.updatedGoodsLines!.find(
          (u) => u.id === line.id || u.qrCodeNumber === line.qrCodeNumber
        )
        return hit ? { ...line, quantity: hit.quantity, condition: hit.condition } : line
      })
      return { ...entry, goodsItems, dispositionStatus: input.detentionCaseNo ? "Destructed" : entry.dispositionStatus }
    })
    saveSeizedInventory(next)
  }

  return {
    stock: loadStockRows(),
    seized: loadSeizedInventory(),
  }
}

/** Merge authoritative backend stock rows into localStorage (for Stock Management UI). */
export function mergeBackendStockRows(
  backendRows: Array<{
    id: string
    detentionMemoId: string | null
    caseRef: string
    qrCode: string
    description: string
    quantity: string
    unit: string
    status: string
  }>,
  detentionCaseNo?: string
) {
  if (backendRows.length === 0) return loadStockRows()
  const rows = loadStockRows()
  const next = [...rows]
  let changed = false

  for (const b of backendRows) {
    const qr = b.qrCode.toLowerCase()
    const caseRef = b.caseRef.toLowerCase()
    const idx = next.findIndex(
      (r) =>
        r.id === b.id ||
        (qr && r.qrCodeNumber?.toLowerCase() === qr) ||
        (caseRef && r.seizureCaseRef?.toLowerCase() === caseRef && qr && r.qrCodeNumber?.toLowerCase() === qr)
    )
    const mapped: WmsStockRow = {
      id: b.id,
      qrCodeNumber: b.qrCode,
      seizureCaseRef: b.caseRef,
      detentionCaseNo: detentionCaseNo || b.caseRef,
      detentionMemoId: b.detentionMemoId || undefined,
      pctCode: "",
      descriptionOfGoods: b.description,
      godownWarehouse: "",
      quantity: b.quantity,
      unitOfMeasure: b.unit,
      condition: b.status,
      status: b.status,
    }
    if (idx >= 0) {
      next[idx] = { ...next[idx], ...mapped }
      changed = true
    } else {
      next.push(mapped)
      changed = true
    }
  }

  if (changed) saveStockRows(next)
  return next
}

export function stockRowsForSync(): WmsStockRow[] {
  const stock = loadStockRows()
  const seized = loadSeizedInventory()
  if (seized.length === 0) return stock
  return stock.map((row) => {
    const hit = seized.find(
      (s) =>
        (s.sourceDetentionId && row.detentionMemoId === s.sourceDetentionId) ||
        (s.caseNo && row.seizureCaseRef && s.caseNo.toLowerCase() === row.seizureCaseRef.toLowerCase())
    )
    if (!hit) return row
    return {
      ...row,
      detentionMemoId: hit.sourceDetentionId || row.detentionMemoId,
      detentionCaseNo: hit.caseNo || row.detentionCaseNo,
      referenceNumber: hit.referenceNumber || row.referenceNumber,
    }
  })
}
