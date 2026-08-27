import { getDetentionMemoDetailPath } from "@/routes/config"
import { resolveQrCode, type QrResolveResult } from "@/lib/wms-flow-api"

export type ParsedQrInput = {
  code: string
  memoId?: string
  goodsQr?: string
}

export function parseQrInput(raw: string): ParsedQrInput {
  const trimmed = raw.trim()
  if (!trimmed) return { code: "" }

  const memoPathMatch = trimmed.match(/\/detention-memo\/([^/?#]+)/i)
  if (memoPathMatch) {
    let goodsQr: string | undefined
    try {
      const url = new URL(
        trimmed.includes("://") ? trimmed : `https://local${trimmed.startsWith("/") ? "" : "/"}${trimmed}`
      )
      goodsQr = url.searchParams.get("goodsQr")?.trim() || undefined
    } catch {
      const goodsMatch = trimmed.match(/[?&]goodsQr=([^&]+)/i)
      if (goodsMatch) goodsQr = decodeURIComponent(goodsMatch[1])
    }
    return {
      code: goodsQr || trimmed,
      memoId: decodeURIComponent(memoPathMatch[1]),
      goodsQr,
    }
  }

  return { code: trimmed }
}

function goodsDetailPath(memoId: string, goodsQr: string): string {
  return `${getDetentionMemoDetailPath(memoId)}?goodsQr=${encodeURIComponent(goodsQr)}&view=goods`
}

export function getDetentionNavigationFromQr(
  parsed: ParsedQrInput,
  resolved: QrResolveResult | null
): string | null {
  if (parsed.memoId && parsed.goodsQr) {
    return goodsDetailPath(parsed.memoId, parsed.goodsQr)
  }
  if (parsed.memoId) {
    return getDetentionMemoDetailPath(parsed.memoId)
  }
  if (!resolved) return null

  if (resolved.type === "memo" && resolved.memo?.id) {
    return getDetentionMemoDetailPath(resolved.memo.id)
  }

  if (resolved.type === "goods_line") {
    const memoId = resolved.memo?.id
    const goodsQr = resolved.goods_line?.qrCodeNumber
    if (memoId && goodsQr) return goodsDetailPath(memoId, goodsQr)
  }

  if (resolved.type === "stock") {
    const memoId = resolved.memo?.id
    const goodsQr = resolved.stock?.qrCode
    if (memoId && goodsQr) return goodsDetailPath(memoId, goodsQr)
  }

  return null
}

export async function resolveQrNavigationTarget(raw: string): Promise<string | null> {
  const parsed = parseQrInput(raw)
  if (!parsed.code && !parsed.memoId) return null

  if (parsed.memoId) {
    const direct = getDetentionNavigationFromQr(parsed, null)
    if (direct) return direct
  }

  const resolved = await resolveQrCode(parsed.code)
  return getDetentionNavigationFromQr(parsed, resolved)
}
