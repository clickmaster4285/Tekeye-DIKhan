import QRCode from "qrcode"

export function pdfFilenameFromCaseNo(caseNo?: string | null, fallback = "report"): string {
  const raw = (caseNo || "").trim() || fallback
  const safe = raw
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  return `${safe || fallback}.pdf`
}

export function clearSavePdfQueryParam() {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  if (!url.searchParams.has("savepdf")) return
  url.searchParams.delete("savepdf")
  window.history.replaceState({}, "", url)
}

async function waitForElementImages(element: HTMLElement, timeoutMs = 4000): Promise<void> {
  const images = Array.from(element.querySelectorAll("img"))
  await Promise.race([
    Promise.all(
      images.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true })
              img.addEventListener("error", () => resolve(), { once: true })
            }),
      ),
    ),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, timeoutMs)
    }),
  ])
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Inline remote QR / same-origin images so html2canvas does not lose them. */
async function inlineImagesForPdf(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"))
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src") || img.src || ""
      if (!src || src.startsWith("data:")) return

      const qrMatch = src.match(/api\.qrserver\.com\/[^'"]*[?&]data=([^&]+)/i)
      if (qrMatch) {
        try {
          img.src = await QRCode.toDataURL(decodeURIComponent(qrMatch[1]), {
            width: 240,
            margin: 1,
            errorCorrectionLevel: "M",
          })
        } catch {
          img.removeAttribute("src")
        }
        return
      }

      try {
        const url = new URL(src, window.location.href)
        if (url.origin !== window.location.origin) return
        const res = await fetch(url.href)
        if (!res.ok) return
        img.src = await blobToDataUrl(await res.blob())
      } catch {
        // Leave remote/broken images out rather than tainting the canvas.
      }
    }),
  )
}

/**
 * Prefer the report's own <style> block (the print layout the user designed).
 * Promote @media print rules so the off-screen iframe uses the same CSS as Print.
 */
function collectPrintStyles(element: HTMLElement): string {
  const chunks: string[] = []
  const seen = new Set<HTMLStyleElement>()
  const take = (styleEl: HTMLStyleElement | null | undefined) => {
    if (!styleEl || seen.has(styleEl) || !styleEl.textContent) return
    seen.add(styleEl)
    chunks.push(styleEl.textContent)
  }

  const reportRoot = element.closest("[data-report-root]") as HTMLElement | null
  reportRoot?.querySelectorAll(":scope > style").forEach((el) => take(el as HTMLStyleElement))
  element.parentElement?.querySelectorAll(":scope > style").forEach((el) => take(el as HTMLStyleElement))
  element.querySelectorAll("style").forEach((el) => take(el as HTMLStyleElement))

  if (chunks.length === 0) {
    document.querySelectorAll("style").forEach((el) => {
      const text = el.textContent || ""
      if (text.includes(".print-page") || text.includes(".ns-letterhead")) take(el as HTMLStyleElement)
    })
  }

  return chunks.join("\n").replace(/@media\s+print\s*\{/gi, "@media all {")
}

/**
 * Build a PDF that matches browser Print → Save as PDF:
 * same 210mm × 297mm pages, same print CSS from the report component, no layout overrides.
 */
export async function saveElementAsPdf(element: HTMLElement, filename: string): Promise<void> {
  const name = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`
  await waitForElementImages(element)
  if (document.fonts?.ready) await document.fonts.ready

  const pageNodes = Array.from(element.querySelectorAll<HTMLElement>(".print-page"))
  const targets = pageNodes.length > 0 ? pageNodes : [element]
  const printCss = collectPrintStyles(element)

  const iframe = document.createElement("iframe")
  iframe.setAttribute("aria-hidden", "true")
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;"
  document.body.appendChild(iframe)

  try {
    const idoc = iframe.contentDocument
    if (!idoc) throw new Error("Could not create PDF render frame")

    idoc.open()
    idoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      html, body { margin: 0; padding: 0; background: #fff; color: #142033; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      ${printCss}
      aside, nav, header:not(.ns-letterhead), .sidebar, .main-nav, .breadcrumbs,
      [role="navigation"], .print-action {
        display: none !important;
      }
      /* Lock each sheet to one A4 page — matches Print view, prevents overlap from reflow */
      .print-page {
        width: 210mm !important;
        min-height: 297mm !important;
        height: 297mm !important;
        margin: 0 !important;
        border: none !important;
        box-shadow: none !important;
        overflow: hidden !important;
      }
    </style></head><body></body></html>`)
    idoc.close()

    const html2canvas = (await import("html2canvas")).default
    const { jsPDF } = await import("jspdf")
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()

    for (let i = 0; i < targets.length; i++) {
      idoc.body.innerHTML = targets[i].outerHTML
      const clone = idoc.body.firstElementChild as HTMLElement | null
      if (!clone) continue

      clone.style.cssText +=
        ";margin:0;position:static;left:auto;top:auto;width:210mm;height:297mm;min-height:297mm;background:#fff;overflow:hidden;"

      await inlineImagesForPdf(clone)
      await waitForElementImages(clone)
      await new Promise((resolve) => window.setTimeout(resolve, 80))

      const width = Math.max(1, Math.ceil(clone.offsetWidth))
      const height = Math.max(1, Math.ceil(clone.offsetHeight))
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll("link[rel='stylesheet']").forEach((el) => el.remove())
          clonedDoc.documentElement.style.background = "#fff"
          clonedDoc.documentElement.style.color = "#142033"
          if (clonedDoc.body) {
            clonedDoc.body.style.background = "#fff"
            clonedDoc.body.style.color = "#142033"
            clonedDoc.body.style.margin = "0"
            clonedDoc.body.style.padding = "0"
          }
        },
      })

      const imgData = canvas.toDataURL("image/jpeg", 0.96)
      // One HTML page → exactly one PDF page (same as Print)
      if (i > 0) pdf.addPage()
      pdf.addImage(imgData, "JPEG", 0, 0, pageW, pageH, undefined, "FAST")
    }

    pdf.save(name)
  } finally {
    iframe.remove()
  }
}
