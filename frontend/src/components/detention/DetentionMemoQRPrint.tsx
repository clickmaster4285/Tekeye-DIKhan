import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

interface DetentionMemoQRPrintProps {
  caseNo: string
  referenceNumber: string
  createdBy: string
  createdAt: string
  qrPayload: string
  qrNumber: string
}

function getQrCodeUrl(data: string, size = 1200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`
}

function formatSlipDate(value: string): string {
  const raw = (value || "").trim()
  if (!raw) return "—"
  const parsed = new Date(raw.includes("T") || raw.includes(" ") ? raw : `${raw}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default function DetentionMemoQRPrint({
  caseNo,
  createdAt,
  qrPayload,
}: DetentionMemoQRPrintProps) {
  const detentionNumber = (caseNo || "").trim() || "—"
  const dateLabel = formatSlipDate(createdAt)

  return (
    <div className="fixed inset-0 z-50 flex h-screen w-screen flex-col overflow-auto bg-white">
      <style>{`
        aside, nav, header, .sidebar, .main-nav, .breadcrumbs, [role="navigation"] {
          display: none !important;
        }
        main, .main-content {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
        }
        @media print {
          .no-print { display: none !important; }
          html, body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          .qr-a4-page {
            min-height: auto !important;
            height: auto !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .qr-slip-card {
            width: 100% !important;
            max-width: 190mm !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="no-print flex gap-2 border-b bg-white p-4 shadow-sm">
        <Button type="button" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print A4 Slip
        </Button>
      </div>

      <div className="qr-a4-page flex flex-1 items-center justify-center bg-slate-100 p-4 print:bg-white print:p-0">
        <div className="qr-slip-card flex w-full max-w-[190mm] flex-col items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-8 shadow-sm print:border-0 print:shadow-none">
          <header className="mb-5 text-center print:mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pakistan Customs Authority
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 print:text-2xl">
              Detention Memo QR Slip
            </h1>
          </header>

          <img
            src={getQrCodeUrl(qrPayload, 1200)}
            alt={`Detention QR ${detentionNumber}`}
            width={640}
            height={640}
            className="h-[min(78vw,640px)] w-[min(78vw,640px)] max-w-full border border-slate-200 bg-white p-1.5 print:h-[155mm] print:w-[155mm] print:max-w-none print:p-1"
          />

          <p className="mt-4 text-center text-3xl font-bold tracking-wide text-slate-900 print:mt-5 print:text-4xl">
            {detentionNumber}
          </p>
          <p className="mt-1 text-center text-lg font-medium text-slate-700 print:mt-2 print:text-2xl">
            {dateLabel}
          </p>
        </div>
      </div>
    </div>
  )
}
