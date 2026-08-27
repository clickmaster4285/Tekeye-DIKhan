"use client"

import { useEffect, useRef } from "react"
import { QRCodeCanvas } from "qrcode.react"
import { formatAccessZoneLabel } from "@/lib/access-zone"

/** QR code size: 5cm × 5cm when printed, centered. */
const QR_SIZE_CM = 5
const PAPER_WIDTH_MM = 50
const PPI = 96
const MM_PER_INCH = 25.4

const qrSizePx = Math.round((QR_SIZE_CM * 10 * PPI) / MM_PER_INCH)

export interface PrintQROnSaveProps {
  qrPayload: string
  qrCodeId?: string
  visitorName?: string
  visitorCNIC?: string
  accessZone?: string
  validFrom?: string
  validTo?: string
  visitMode?: string
  groupPartySize?: number
  groupMemberSummary?: string
  onDone: () => void
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function PrintQROnSave({
  qrPayload,
  visitorName,
  visitorCNIC,
  accessZone,
  validFrom,
  validTo,
  qrCodeId,
  visitMode,
  groupPartySize,
  groupMemberSummary,
  onDone,
}: PrintQROnSaveProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const printedRef = useRef(false)
  const fromProp = validFrom ?? ""
  const toProp = validTo ?? ""

  useEffect(() => {
    if (printedRef.current) return
    printedRef.current = true

    const printQR = async () => {
      const canvas = containerRef.current?.querySelector("canvas")
      if (!canvas) {
        onDone()
        return
      }

      await new Promise(resolve => setTimeout(resolve, 100))
      await new Promise(requestAnimationFrame)

      try {
        const dataUrl = canvas.toDataURL("image/png")

        const formatTimeForReceipt = (value: string | undefined | null, defaultTime: string): string => {
          const s = value != null ? String(value).trim() : ""
          if (!s) return defaultTime
          const isoMatch = /T(\d{1,2}):(\d{2})/.exec(s)
          if (isoMatch) return `${isoMatch[1].padStart(2, "0")}:${isoMatch[2]}`
          const timeMatch = /^(\d{1,2}):(\d{2})(?::\d{2})?(\s*[AP]?M?)?$/i.exec(s)
          if (timeMatch) return `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}${timeMatch[3] ? ` ${timeMatch[3].trim()}` : ""}`
          return s
        }

        const formatDate = () => {
          return new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        }

        const fromTime = formatTimeForReceipt(fromProp, "00:00")
        const toTime = formatTimeForReceipt(toProp, "23:59")
        const zoneLabel = escapeHtml(formatAccessZoneLabel(accessZone))
        const safeName = escapeHtml(visitorName || "Guest")
        const safeCnic = escapeHtml(visitorCNIC || "CNIC Number")
        const isGroup = visitMode === "group"
        const groupVisitRow = isGroup
          ? `<tr>
                    <td class="label-col">Visit</td>
                    <td class="value-col">Group (${groupPartySize ?? "—"} people)</td>
                  </tr>`
          : ""
        const groupMembersRow =
          isGroup && groupMemberSummary
            ? `<tr>
                    <td class="label-col">Members</td>
                    <td class="value-col">${escapeHtml(groupMemberSummary)}</td>
                  </tr>`
            : ""

        const printWindow = window.open("", "_blank")
        if (!printWindow) {
          console.error("Popup blocked. Please allow popups for this site.")
          onDone()
          return
        }

        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>TEKEYE - QR Code</title>
              <style>
                * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                }
                
                html, body {
                  width: ${PAPER_WIDTH_MM}mm;
                  height: auto;
                  margin: 0;
                  padding: 0.5mm;
                  padding-left: 5mm;
                  background: white;
                  font-family: monospace;
                }
                
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 0.5mm 0;
                  font-size: 10px;
                  line-height: 1.15;
                }
                
                th, td {
                  padding: 0.3mm 0.2mm;
                  text-align: left;
                  border-bottom: 1px solid #ddd;
                  vertical-align: top;
                }
                
                th {
                  font-weight: bold;
                  font-size: 9px;
                  background: #f8f9fa;
                  text-align: center;
                  padding: 0.2mm;
                }
                
                td {
                  font-size: 9px;
                }
                
                .label-col {
                  width: 35%;
                  font-weight: bold;
                }
                
                .value-col {
                  width: 65%;
                  font-weight: normal;
                }
                
                .header {
                  text-align: center;
                  margin-bottom: 0.8mm;
                }
                
                .header h1 {
                  font-size: 17px;
                  font-weight: 900;
                  margin-bottom: 0.3mm;
                  letter-spacing: 1.05px;
                }
                
                .header .subtitle {
                  font-size: 11px;
                  font-weight: bold;
                }
                
                .divider-solid {
                  border-top: 1.5px solid black;
                  margin: 0.5mm 0;
                }
                
                .divider-dashed {
                  border-top: 1px dashed black;
                  margin: 0.5mm 0;
                }
                
                .qr-section {
                  text-align: center;
                  margin: 0.5mm 0;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                }
                
                #qr-img {
                  width: ${QR_SIZE_CM}cm;
                  height: ${QR_SIZE_CM}cm;
                  object-fit: contain;
                  display: block;
                  margin-left: auto;
                  margin-right: auto;
                }
                
                .qr-label {
                  font-size: 10px;
                  font-weight: bold;
                  margin-top: 0.3mm;
                  letter-spacing: 0.6px;
                }
                
                .payload-preview {
                  font-size: 8px;
                  word-break: break-all;
                  text-align: center;
                  margin: 0.5mm 0;
                  line-height: 1.25;
                  max-height: 3.5mm;
                  overflow: hidden;
                }
                
                .footer {
                  text-align: center;
                  font-size: 10px;
                  margin-top: 0.5mm;
                  line-height: 1.25;
                }
                
                .footer-powered {
                  border-top: 1.5px solid black;
                  margin-top: 0.5mm;
                  padding-top: 0.3mm;
                  font-size: 9px;
                }
                
                @media print {
                  @page {
                    size: ${PAPER_WIDTH_MM}mm auto;
                    margin: 0;
                  }
                  
                  body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                  }
                  
                  table {
                    font-size: 9px;
                  }
                  
                  th, td {
                    padding: 0.2mm 0.1mm;
                  }
                }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>TEKEYE</h1>
                <h1>PAKISTAN CUSTOMS</h1>
                <div class="subtitle">VISITOR PASS</div>
              </div>
              
              <div class="divider-solid"></div>
              
              <!-- Visitor Info Table -->
              <table>
                <thead>
                  <tr>
                    <th colspan="2" style="text-align: center; font-size: 9px; padding: 0.3mm;">VISITOR INFORMATION</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="label-col">Name</td>
                    <td class="value-col">${safeName}</td>
                  </tr>
                  <tr>
                    <td class="label-col">CNIC</td>
                    <td class="value-col">${safeCnic}</td>
                  </tr>
                  ${groupVisitRow}
                  ${groupMembersRow}
                  <tr>
                    <td class="label-col">Zone</td>
                    <td class="value-col">${zoneLabel}</td>
                  </tr>
                  <tr>
                    <td class="label-col">Date</td>
                    <td class="value-col">${formatDate()}</td>
                  </tr>
                   <tr>
                    <td class="label-col">TIME VALIDITY</td>
                    <td class="value-col">${fromTime} to ${toTime}</td>
                  </tr>
                </tbody>
              </table>
              
              <div class="divider-dashed"></div>
              
              <div class="qr-section">
                <img id="qr-img" src="${dataUrl}" alt="QR Code" />
                <div class="qr-label">SCAN ME</div>
              </div>
              
              <div class="divider-dashed"></div>

              <div class="footer">
                <div>Thank you for visiting PAKISTAN CUSTOMS</div>
                <div class="footer-powered">Powered by TEKEYE - PAKISTAN CUSTOMS</div>
              </div>
            </body>
          </html>
        `)

        printWindow.document.close()

        const img = printWindow.document.getElementById('qr-img') as HTMLImageElement
        
        if (img.complete) {
          printWindow.print()
          setTimeout(() => {
            printWindow.close()
            onDone()
          }, 500)
        } else {
          img.onload = () => {
            printWindow.print()
            setTimeout(() => {
              printWindow.close()
              onDone()
            }, 500)
          }
        }

      } catch (error) {
        console.error('Print error:', error)
        onDone()
      }
    }

    printQR()
  }, [qrPayload, visitorName, visitorCNIC, accessZone, validFrom, validTo, qrCodeId, onDone])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        left: "-9999px",
        top: 0,
        width: qrSizePx,
        height: qrSizePx,
        pointerEvents: "none",
        opacity: 0,
        zIndex: -1
      }}
    >
      <QRCodeCanvas 
        value={qrPayload} 
        size={qrSizePx} 
        level="M"
        includeMargin={false}
      />
    </div>
  )
}
