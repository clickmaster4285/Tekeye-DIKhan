import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"
import { Separator } from "@/components/ui/separator"

interface DetentionMemoQRPrintProps {
    caseNo: string
    referenceNumber: string
    createdBy: string
    createdAt: string
    qrPayload: string
    qrNumber: string
}

function getQrCodeUrl(data: string, size = 180) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`
}

export default function DetentionMemoQRPrint({
    caseNo,
    referenceNumber,
    createdBy,
    createdAt,
    qrPayload,
    qrNumber,
}: DetentionMemoQRPrintProps) {
    return (
        <div className="fixed inset-0 overflow-auto bg-white z-50 w-screen h-screen flex flex-col">
            <style>{`
        * {
          margin: 0;
          padding: 0;
        }
        body, html {
          background: white;
          color: black;
          margin: 0;
          padding: 0;
        }
        aside, nav, header, .sidebar, .main-nav, .breadcrumbs, [role="navigation"] {
          display: none !important;
        }
        main, .main-content {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
        }
        @media print {
          * {
            margin: 0;
            padding: 0;
          }
          body, html {
            background: white;
            color: black;
            margin: 0;
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 12mm;
          }
          .qr-print-container {
            width: 100%;
            background: white;
            color: black;
            margin: 0;
            padding: 0;
          }
        }
      `}</style>
            <div className="no-print flex gap-2 bg-white border-b shadow-sm p-4">
                <Button onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-2" /> Print
                </Button>
            </div>
            <div className="flex-1 overflow-auto bg-white">
                <div className="mx-auto max-w-[600px] border rounded-xl p-8 print:border-0 print:rounded-none print:p-0">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold">Detention Memo QR Slip</h1>
                            <p className="text-sm text-gray-600 mt-1">Scan QR code to open full detention memo report.</p>
                        </div>
                    </div>
                    <Separator className="mb-6" />
                    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-start">
                        <div className="flex justify-center">
                            <img
                                src={getQrCodeUrl(qrPayload, 220)}
                                alt="Memo QR Code"
                                className="border rounded-lg p-2 bg-white shadow-sm"
                            />
                        </div>
                        <div className="space-y-3">
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Memo Number</p>
                                <p className="text-lg font-semibold">{caseNo}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">QR Reference</p>
                                <p className="text-sm font-mono">{qrNumber}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Reference Number</p>
                                <p className="text-sm">{referenceNumber || "—"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Created By</p>
                                <p className="text-sm">{createdBy || "ASO Portal"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Date Created</p>
                                <p className="text-sm">{createdAt || "—"}</p>
                            </div>
                        </div>
                    </div>
                    <Separator className="my-6" />
                    <div className="text-xs text-gray-500 text-center">
                        <p>Pakistan Customs Authority • Detention Memo System</p>
                        <p className="mt-1">Generated: {new Date().toLocaleString()}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
