import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Printer, FileDown } from "lucide-react"
import html2pdf from "html2pdf.js"
import { getDetentionMemoDetailPath } from "@/routes/config"
import { pdfFilenameFromCaseNo } from "@/lib/save-report-pdf"

type GoodsLineItem = {
  id: string
  qrCodeNumber?: string
  description: string
  pctCode: string
  quantity: string
  unit: string
  condition: string
  assessableValuePkr: string
  identificationRef: string
  itemNotes: string
  perishable?: boolean
}

type DetentionMemoRow = {
  [key: string]: unknown
  id: string
  caseNo: string
  firNumber?: string
  referenceNumber: string
  dateTimeOccurrence: string
  placeOfOccurrence: string
  dateTimeDetention: string
  placeOfDetention: string
  detentionType: string
  directorate: string
  reasonForDetention: string
  whereDeposited: string
  settlementStatus: string
  verificationStatus: string
  briefFacts?: string
  forwardingOfficerRemarks?: string
  accusedName?: string
  accusedCnic?: string
  accusedAddress?: string
  goodsItems?: GoodsLineItem[]
  seizingOfficerNotes?: string
  examiningOfficerNotes?: string
  detentionNotes?: string
  createdAt: string
  updatedAt?: string
  createdBy?: string
  memoQrCodeNumber?: string
  memoQrCodePayload?: string
}

interface DetentionMemoReportProps {
  row: DetentionMemoRow
  qrPayload: string
  qrNumber: string
}

function getQrCodeUrl(data: string, size = 180) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`
}

function getGoodsQrPayload(memoId: string, item: GoodsLineItem): string {
  const ref = item.qrCodeNumber || `${memoId}-${item.id}`
  return `${window.location.origin}${getDetentionMemoDetailPath(memoId)}?goodsQr=${encodeURIComponent(ref)}&view=goods`
}

function formatDate(value?: string): string {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString()
}

export default function DetentionMemoReport({ row, qrPayload, qrNumber }: DetentionMemoReportProps) {
  const reportRef = useRef<HTMLDivElement>(null)
  const goodsItems = row.goodsItems ?? []
  const hasGoods = goodsItems.length > 0
  const showPctCode = goodsItems.some((item) => Boolean(item.pctCode?.trim()))
  const showAssessable = goodsItems.some((item) => Boolean(item.assessableValuePkr?.trim()))
  const showPerishable = goodsItems.some((item) => Boolean(item.perishable))
  const showIdentificationRef = goodsItems.some((item) => Boolean(item.identificationRef?.trim()))
  const showNotes = goodsItems.some((item) => Boolean(item.itemNotes?.trim()))
  const optionalCols = [showPctCode, showAssessable, showPerishable, showIdentificationRef, showNotes].filter(Boolean).length
  const useLandscape = optionalCols >= 2 || goodsItems.length > 8

  const handlePrint = () => {
    window.print()
  }

  const handleSaveAsPDF = () => {
    if (!reportRef.current) return

    const element = reportRef.current
    const opt = {
      margin: [8, 8, 8, 8] as [number, number, number, number],
      filename: pdfFilenameFromCaseNo(row.caseNo, row.id),
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        // Match A4 CSS width (~210mm at 96dpi) so capture matches print layout
        windowWidth: useLandscape ? 1123 : 794,
      },
      jsPDF: {
        orientation: useLandscape ? ("landscape" as const) : ("portrait" as const),
        unit: "mm" as const,
        format: "a4" as const,
      },
      pagebreak: { mode: ["css", "legacy"] as const },
    }

    html2pdf().set(opt).from(element).save()
  }

  return (
    <div className="fixed inset-0 overflow-auto bg-neutral-200 z-50 w-screen h-screen">
      <style>{`
        :root {
          color-scheme: light;
        }
        body, html {
          background: #e5e7eb;
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
        }
        .report-container {
          display: flex;
          justify-content: center;
          padding: 1rem 0 2rem;
        }
        .report-sheet {
          /* Exact A4 page geometry for screen preview */
          width: 210mm;
          min-height: 297mm;
          max-width: 210mm;
          margin: 0 auto;
          background: #fff;
          border: 1px solid #d1d5db;
          box-sizing: border-box;
          padding: 12mm;
          box-shadow: 0 8px 24px rgba(17, 24, 39, 0.12);
          overflow: hidden;
        }
        .report-sheet.landscape-preview {
          width: 297mm;
          max-width: 297mm;
          min-height: 210mm;
        }
        .header-section {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 100px;
          gap: 0.75rem;
          align-items: start;
          border-bottom: 2px solid #111827;
          padding-bottom: 0.75rem;
        }
        .header-title {
          font-size: 1.25rem;
          font-weight: 700;
          line-height: 1.25;
        }
        .header-subtitle {
          margin-top: 0.25rem;
          font-size: 0.8rem;
          color: #4b5563;
        }
        .section-title {
          font-size: 0.85rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 0.4rem;
          color: #1f2937;
        }
        .box {
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 0.65rem 0.75rem;
          background: #fff;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.35rem 1rem;
        }
        .info-row {
          display: grid;
          grid-template-columns: 150px minmax(0, 1fr);
          gap: 0.35rem;
          font-size: 0.8rem;
          line-height: 1.35;
        }
        .info-label {
          font-weight: 600;
          color: #374151;
        }
        .report-section {
          margin-top: 0.85rem;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .goods-table-wrap {
          width: 100%;
          overflow: hidden;
        }
        .goods-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 0.72rem;
        }
        .goods-table th,
        .goods-table td {
          border: 1px solid #d1d5db;
          padding: 0.3rem 0.25rem;
          text-align: left;
          vertical-align: top;
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        .goods-table th {
          background: #f3f4f6;
          font-weight: 700;
          font-size: 0.68rem;
          line-height: 1.2;
        }
        .goods-table tbody tr:nth-child(even) {
          background: #f9fafb;
        }
        .goods-qr {
          width: 40px;
          height: 40px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          padding: 2px;
          background: #fff;
          display: block;
        }
        .footer {
          margin-top: 0.85rem;
          border-top: 1px solid #d1d5db;
          padding-top: 0.4rem;
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          font-size: 0.7rem;
          color: #4b5563;
        }
        .qr-container {
          text-align: center;
        }
        .qr-container img {
          width: 90px;
          height: 90px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 3px;
          background: #fff;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 ${useLandscape ? "landscape" : "portrait"};
            margin: 10mm;
          }
          html, body {
            background: white !important;
            color: #111827 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .report-container {
            display: block;
            padding: 0;
            margin: 0;
            background: #fff;
          }
          .report-sheet,
          .report-sheet.landscape-preview {
            width: 100% !important;
            max-width: none !important;
            min-height: auto !important;
            margin: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .report-section {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .info-grid,
          .header-section {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .goods-table {
            font-size: 8pt;
          }
          .goods-table th {
            font-size: 7.5pt;
          }
          .goods-table th,
          .goods-table td {
            padding: 3px 2px;
          }
          .goods-qr {
            width: 32px;
            height: 32px;
          }
          .info-row {
            font-size: 9pt;
            grid-template-columns: 140px minmax(0, 1fr);
          }
          .footer {
            font-size: 8pt;
          }
          .qr-container img {
            width: 80px;
            height: 80px;
          }
        }
        @media screen and (max-width: 900px) {
          .report-sheet,
          .report-sheet.landscape-preview {
            width: 100%;
            max-width: 100%;
            min-height: auto;
            margin: 0;
            border-radius: 0;
            padding: 1rem;
          }
          .header-section {
            grid-template-columns: 1fr;
          }
          .info-grid {
            grid-template-columns: 1fr;
          }
          .info-row {
            grid-template-columns: 130px minmax(0, 1fr);
          }
        }
      `}</style>

      <div className="no-print sticky top-0 z-50 flex gap-2 bg-white border-b shadow-sm p-4">
        <Button onClick={handlePrint} variant="default" className="gap-2">
          <Printer className="h-4 w-4" />
          Print Report
        </Button>
        <Button onClick={handleSaveAsPDF} variant="secondary" className="gap-2">
          <FileDown className="h-4 w-4" />
          Save as PDF
        </Button>
      </div>

      <div ref={reportRef} className="report-container">
        <div className={`report-sheet${useLandscape ? " landscape-preview" : ""}`}>
          {/* Header Section */}
          <div className="header-section">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-600 font-semibold">Pakistan Customs Authority</div>
              <div className="header-title mt-1">Detention Memo Report</div>
              <div className="header-subtitle">Official customs document for goods detention and inventory</div>
            </div>
            <div className="qr-container">
              <img
                src={getQrCodeUrl(qrPayload, 100)}
                alt="Memo QR Code"
              />
              <div className="text-[9px] mt-1.5 font-mono text-gray-700 break-all">{qrNumber}</div>
            </div>
          </div>

          {/* Key Information Section */}
          <div className="report-section box">
            <div className="info-grid">
              <div className="info-row">
                <span className="info-label">Memo Number:</span> {row.caseNo}
              </div>
              <div className="info-row">
                <span className="info-label">Reference Number:</span> {row.referenceNumber || "—"}
              </div>
              <div className="info-row">
                <span className="info-label">Detention Type:</span> {row.detentionType || "—"}
              </div>
              <div className="info-row">
                <span className="info-label">Created By:</span> {row.createdBy || "ASO Portal"}
              </div>
              <div className="info-row">
                <span className="info-label">Created Date:</span> {row.createdAt || "—"}
              </div>
              <div className="info-row">
                <span className="info-label">Updated Date:</span> {formatDate(row.updatedAt || row.createdAt)}
              </div>
              <div className="info-row">
                <span className="info-label">Verification Status:</span> {row.verificationStatus || "—"}
              </div>
            </div>
          </div>

          {/* Basic Information Section */}
          <div className="report-section">
            <div className="section-title">Basic Information</div>
            <div className="box">
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-label">Date/Time of Occurrence:</span> {row.dateTimeOccurrence || "—"}
                </div>
                <div className="info-row">
                  <span className="info-label">Place of Occurrence:</span> {row.placeOfOccurrence || "—"}
                </div>
                <div className="info-row">
                  <span className="info-label">Date/Time of Detention:</span> {row.dateTimeDetention || "—"}
                </div>
                <div className="info-row">
                  <span className="info-label">Place of Detention:</span> {row.placeOfDetention || "—"}
                </div>
                <div className="info-row">
                  <span className="info-label">Directorate:</span> {row.directorate || "—"}
                </div>
                <div className="info-row">
                  <span className="info-label">Where Deposited:</span> {row.whereDeposited || "—"}
                </div>
                <div className="info-row">
                  <span className="info-label">Settlement Status:</span> {row.settlementStatus || "—"}
                </div>
                <div className="info-row">
                  <span className="info-label">Reason for Detention:</span> {row.reasonForDetention || "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Brief Facts Section */}
          {row.briefFacts && (
            <div className="report-section">
              <div className="section-title">Memo Description</div>
              <div className="box">
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{row.briefFacts}</div>
              </div>
            </div>
          )}

          {/* Goods Information Section */}
          {hasGoods && (
            <div className="report-section">
              <div className="section-title">Goods Information</div>
              <div className="goods-table-wrap">
                <table className="goods-table">
                  <thead>
                    <tr>
                      <th style={{ width: "52px" }}>QR</th>
                      <th>Description</th>
                      <th style={{ width: "48px" }}>Qty</th>
                      <th style={{ width: "42px" }}>Unit</th>
                      <th style={{ width: "72px" }}>Condition</th>
                      {showAssessable && <th style={{ width: "78px" }}>Value (PKR)</th>}
                      {showPctCode && <th style={{ width: "64px" }}>PCT</th>}
                      {showPerishable && <th style={{ width: "52px" }}>Perish.</th>}
                      {showIdentificationRef && <th style={{ width: "88px" }}>ID/Chassis</th>}
                      {showNotes && <th>Notes</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {goodsItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <img
                            src={getQrCodeUrl(getGoodsQrPayload(row.id, item), 48)}
                            alt={`Goods QR ${item.qrCodeNumber || item.id}`}
                            className="goods-qr"
                          />
                          {item.qrCodeNumber && (
                            <div className="text-[7pt] mt-0.5 leading-tight break-all">{item.qrCodeNumber}</div>
                          )}
                        </td>
                        <td style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>{item.description || "—"}</td>
                        <td>{item.quantity || "—"}</td>
                        <td>{item.unit || "—"}</td>
                        <td>{item.condition || "—"}</td>
                        {showAssessable && <td>{item.assessableValuePkr || "—"}</td>}
                        {showPctCode && <td>{item.pctCode || "—"}</td>}
                        {showPerishable && <td>{item.perishable ? "Yes" : "No"}</td>}
                        {showIdentificationRef && <td>{item.identificationRef || "—"}</td>}
                        {showNotes && <td style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>{item.itemNotes || "—"}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Additional Notes Section */}
          {(row.seizingOfficerNotes || row.examiningOfficerNotes || row.detentionNotes || row.forwardingOfficerRemarks) && (
            <div className="report-section">
              <div className="section-title">Additional Notes & Remarks</div>
              <div className="space-y-2">
                {row.seizingOfficerNotes && (
                  <div className="box">
                    <div className="text-[9pt] font-bold text-gray-700 mb-1">Seizing Officer Notes:</div>
                    <div className="text-[9pt] whitespace-pre-wrap">{row.seizingOfficerNotes}</div>
                  </div>
                )}
                {row.examiningOfficerNotes && (
                  <div className="box">
                    <div className="text-[9pt] font-bold text-gray-700 mb-1">Examining Officer Notes:</div>
                    <div className="text-[9pt] whitespace-pre-wrap">{row.examiningOfficerNotes}</div>
                  </div>
                )}
                {row.detentionNotes && (
                  <div className="box">
                    <div className="text-[9pt] font-bold text-gray-700 mb-1">Detention / Customs Notes:</div>
                    <div className="text-[9pt] whitespace-pre-wrap">{row.detentionNotes}</div>
                  </div>
                )}
                {row.forwardingOfficerRemarks && (
                  <div className="box">
                    <div className="text-[9pt] font-bold text-gray-700 mb-1">Forwarding Officer Remarks:</div>
                    <div className="text-[9pt] whitespace-pre-wrap">{row.forwardingOfficerRemarks}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Section */}
          <div className="footer">
            <span>Generated: {new Date().toLocaleString()}</span>
            <span>Detention Memo System • Pakistan Customs</span>
          </div>
        </div>
      </div>
    </div>
  )
}
