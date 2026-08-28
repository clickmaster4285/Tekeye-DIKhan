import { useEffect, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { FileDown, Printer, ChevronDown } from "lucide-react"
import { clearSavePdfQueryParam, saveElementAsPdf } from "@/lib/save-report-pdf"
import { toast } from "@/hooks/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const CUSTOMS_LOGO_SRC = "/pakistan-customs-logo.png"

export function getQrCodeUrl(data: string, size = 120) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`
}

export function formatDate(value?: string): string {
  if (!value?.trim()) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

export function dash(value?: string | null): string {
  const text = (value || "").trim()
  return text || "—"
}

function logoUrl(): string {
  if (typeof window === "undefined") return CUSTOMS_LOGO_SRC
  if (CUSTOMS_LOGO_SRC.startsWith("http")) return CUSTOMS_LOGO_SRC
  return `${window.location.origin}${CUSTOMS_LOGO_SRC}`
}

export const OFFICIAL_REPORT_CHROME_CSS = `
  :root { color-scheme: light; }
  body { margin: 0; background: white !important; color: #111827 !important; }
  aside, nav, header:not(.ns-letterhead), .sidebar, .main-nav, .breadcrumbs, [role="navigation"] {
    display: none !important;
  }
  .print-action {
    display: flex;
    justify-content: center;
    padding: 10px 0 6px;
  }
  main, .main-content {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
  }
`

export const OFFICIAL_REPORT_LAYOUT_CSS = `
  .print-pages { width: 100%; overflow: visible; }
  .print-page {
    width: min(210mm, 100%);
    min-height: auto;
    box-sizing: border-box;
    padding: 0;
    margin: 0 auto 16px;
    background: #fff;
    font-family: "Times New Roman", Times, serif;
    color: #142033;
    display: flex;
    flex-direction: column;
    border: 1px solid #e5e7eb;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .ns-page-body {
    flex: 1;
    padding: 8mm 12mm 6mm;
    box-sizing: border-box;
  }

  .ns-letterhead {
    flex-shrink: 0;
    background: #0f2744;
    color: #fff;
    padding: 8mm 12mm 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .ns-letterhead-top {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 96px;
    gap: 12px;
    align-items: start;
    padding-bottom: 8px;
  }
  .ns-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .ns-logo-wrap {
    width: 16mm;
    height: 16mm;
    background: #fff;
    border-radius: 4px;
    padding: 2mm;
    box-sizing: border-box;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.25);
  }
  .ns-logo-wrap img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
  .ns-gov {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #d4a017;
  }
  .ns-auth {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-top: 2px;
    color: #e8eef6;
  }
  .ns-doc-title {
    font-size: 22px;
    font-weight: 800;
    line-height: 1.15;
    margin-top: 4px;
    letter-spacing: 0.02em;
  }
  .ns-doc-sub {
    margin-top: 3px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10px;
    color: #c5d4e8;
  }
  .ns-gold-rule {
    height: 3px;
    background: linear-gradient(90deg, #d4a017 0%, #f1d48a 45%, #d4a017 100%);
    width: 100%;
  }
  .ns-gold-rule-footer { height: 2px; }
  .ns-letterhead-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    padding: 7px 0 8px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8.5px;
    color: #d7e2f0;
  }
  .ns-letterhead-meta strong {
    color: #f1d48a;
    font-weight: 700;
    margin-right: 4px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .ns-header-right { text-align: center; }
  .qr-container img {
    width: 80px;
    height: 80px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 3px;
    background: #fff;
  }
  .ns-qr-caption {
    font-size: 7.5px;
    font-family: ui-monospace, monospace;
    margin-top: 4px;
    word-break: break-all;
    color: #d7e2f0;
    line-height: 1.2;
  }

  .section-title {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0 0 8px;
    color: #0f2744;
    border-bottom: 2px solid #d4a017;
    padding-bottom: 6px;
    line-height: 1.4;
  }
  .box {
    border: 1.5px solid #d8dee6;
    border-radius: 3px;
    padding: 10px 12px;
    background: #fff;
    line-height: 1.45;
  }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px 14px;
  }
  .info-row {
    display: grid;
    grid-template-columns: 148px minmax(0, 1fr);
    gap: 6px;
    font-size: 10pt;
    line-height: 1.45;
    padding: 2px 0;
  }
  .info-label { font-weight: 700; color: #374151; }
  .span-2 { grid-column: 1 / -1; }
  .narrative {
    font-size: 10.5pt;
    line-height: 1.4;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .report-section {
    margin-top: 12px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .goods-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 8.5pt;
  }
  .goods-table th, .goods-table td {
    border: 1.5px solid #d1d5db;
    padding: 6px 5px;
    text-align: left;
    vertical-align: top;
    word-break: break-word;
    overflow-wrap: anywhere;
    line-height: 1.35;
  }
  .goods-table th {
    background: #0f2744;
    color: #fff;
    font-weight: 800;
    font-size: 8pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .goods-table tbody tr:nth-child(even) { background: #f4f7fb; }
  .goods-qr {
    width: 32px;
    height: 32px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 2px;
    background: #fff;
    display: block;
  }
  .sign-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 8px;
  }
  .sign-box {
    border: 1.5px solid #d8dee6;
    min-height: 132px;
    padding: 12px;
  }
  .sign-line {
    margin-top: 32px;
    border-top: 1.5px solid #0f2744;
    padding-top: 8px;
    font-size: 9pt;
    line-height: 1.45;
  }

  .ns-footer {
    flex-shrink: 0;
    margin-top: auto;
    padding: 0 12mm 7mm;
    font-family: Arial, Helvetica, sans-serif;
  }
  .ns-footer-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 8px;
    color: #0f2744;
    padding-top: 6px;
  }
  .ns-footer-muted { color: #5b6b7c; padding-top: 3px; }
  .ns-confidential {
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 700;
    color: #0f2744;
  }
  .ns-footer-center { font-weight: 700; }

  @media print {
    @page { size: A4; margin: 0; }
    body { margin: 0; }
    .print-action { display: none !important; }
    aside, nav, header:not(.ns-letterhead), .sidebar, .main-nav, .breadcrumbs, [role="navigation"] {
      display: none !important;
    }
    main, .main-content {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
    }
    .print-pages { margin: 0; padding: 0; }
    .print-page {
      width: 210mm !important;
      min-height: 297mm !important;
      height: 297mm !important;
      margin: 0 auto;
      border: none;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .ns-page-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
    }
    .ns-footer {
      margin-top: auto;
      flex-shrink: 0;
    }
    .page-break-after { break-after: page; page-break-after: always; }
  }
`

export const OFFICIAL_REPORT_PRINT_CSS = `${OFFICIAL_REPORT_CHROME_CSS}
${OFFICIAL_REPORT_LAYOUT_CSS}`

export function OfficialLetterhead({
  title,
  subtitle,
  qrPayload,
  qrNumber,
  qrAlt,
  meta,
}: {
  title: string
  subtitle: string
  qrPayload: string
  qrNumber: string
  qrAlt?: string
  meta: Array<{ label: string; value: string }>
}) {
  return (
    <header className="ns-letterhead">
      <div className="ns-letterhead-top">
        <div className="ns-brand">
          <div className="ns-logo-wrap">
            <img src={logoUrl()} alt="Pakistan Customs" />
          </div>
          <div className="ns-brand-text">
            <div className="ns-gov">Government of Pakistan</div>
            <div className="ns-auth">Pakistan Customs Authority</div>
            <div className="ns-doc-title">{title}</div>
            <div className="ns-doc-sub">{subtitle}</div>
          </div>
        </div>
        <div className="ns-header-right">
          <div className="qr-container">
            <img src={getQrCodeUrl(qrPayload, 100)} alt={qrAlt || `${title} QR`} />
            <div className="ns-qr-caption">{qrNumber}</div>
          </div>
        </div>
      </div>
      <div className="ns-gold-rule" />
      <div className="ns-letterhead-meta">
        {meta.map((item) => (
          <span key={item.label}>
            <strong>{item.label}</strong> {dash(item.value)}
          </span>
        ))}
      </div>
    </header>
  )
}

export function OfficialFooter({
  page,
  total,
  sheetNo,
  generatedAt,
  createdAt,
}: {
  page: number
  total: number
  sheetNo: string
  generatedAt: string
  createdAt: string
}) {
  return (
    <footer className="ns-footer">
      <div className="ns-gold-rule ns-gold-rule-footer" />
      <div className="ns-footer-row">
        <span className="ns-confidential">Confidential · For official use only</span>
        <span className="ns-footer-center">{sheetNo}</span>
        <span>
          Page {page} of {total}
        </span>
      </div>
      <div className="ns-footer-row ns-footer-muted">
        <span>Generated {generatedAt}</span>
        <span>Record created {createdAt}</span>
        <span>Pakistan Customs · TekEye</span>
      </div>
    </footer>
  )
}

export function ReportInfoRow({
  label,
  value,
  span2,
}: {
  label: string
  value?: string | null
  span2?: boolean
}) {
  return (
    <div className={span2 ? "info-row span-2" : "info-row"}>
      <span className="info-label">{label}</span> {dash(value)}
    </div>
  )
}

export function ReportSignBox({
  heading,
  name,
  extra,
  signature,
  date,
}: {
  heading: string
  name: string
  extra: string
  signature?: string
  date?: string
}) {
  return (
    <div className="sign-box">
      <div style={{ fontWeight: 800, fontSize: 10, textTransform: "uppercase" }}>{heading}</div>
      <div style={{ fontSize: 10, marginTop: 6 }}>Name: {dash(name)}</div>
      <div style={{ fontSize: 10 }}>{extra}</div>
      <div className="sign-line">
        Signature / Stamp
        <div style={{ marginTop: 2 }}>{signature ? dash(signature) : <>&nbsp;</>}</div>
        <div>Date: {dash(date)}</div>
      </div>
    </div>
  )
}

export function OfficialReportPrintFrame({
  autoSavePdf = false,
  pdfFilename,
  documentTitle,
  embedded = false,
  children,
}: {
  autoSavePdf?: boolean
  pdfFilename: string
  documentTitle: string
  embedded?: boolean
  children: ReactNode
}) {
  const pagesRef = useRef<HTMLDivElement>(null)
  const [savingPdf, setSavingPdf] = useState(false)

  const handlePrint = () => window.print()

  const handleSaveAsPdf = async () => {
    if (!pagesRef.current || savingPdf) return
    setSavingPdf(true)
    try {
      await saveElementAsPdf(pagesRef.current, pdfFilename)
      clearSavePdfQueryParam()
    } catch (error) {
      toast({
        title: "Could not save PDF",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSavingPdf(false)
    }
  }

  useEffect(() => {
    if (embedded) return
    const previousTitle = document.title
    document.title = documentTitle.trim() || previousTitle
    return () => {
      document.title = previousTitle
    }
  }, [documentTitle, embedded])

  useEffect(() => {
    if (!autoSavePdf) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      if (cancelled) return
      void handleSaveAsPdf()
    }, 500)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // Run once when the print view is opened with savepdf=1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSavePdf])

  return (
    <div className="bg-white text-black" data-report-root>
      <style>{embedded ? OFFICIAL_REPORT_LAYOUT_CSS : OFFICIAL_REPORT_PRINT_CSS}</style>
      {!embedded && (
      <div className="print-action relative z-[60]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2" disabled={savingPdf}>
              {savingPdf ? "Saving PDF…" : "Print"}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="min-w-0 w-max">
            <DropdownMenuItem onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              Print
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void handleSaveAsPdf()} disabled={savingPdf}>
              <FileDown className="h-4 w-4" />
              Save as PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      )}
      <div ref={pagesRef} className="print-pages">
        {children}
      </div>
    </div>
  )
}
