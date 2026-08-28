import { getSeizureMgmtRecoveryMemoDetailPath } from "@/routes/config"
import type { RecoveryMemoRecord } from "@/lib/seizure-management-api"
import type { DetentionMemoApiRecord } from "@/lib/detention-memo-api"
import { pdfFilenameFromCaseNo } from "@/lib/save-report-pdf"
import {
  OfficialFooter,
  OfficialLetterhead,
  OfficialReportPrintFrame,
  ReportInfoRow,
  ReportSignBox,
  dash,
  formatDate,
} from "@/components/seizure/official-report-print"

export default function RecoveryMemoReportPrint({
  row,
  memo,
  autoSavePdf = false,
  embedded = false,
}: {
  row: RecoveryMemoRecord
  memo?: DetentionMemoApiRecord | null
  autoSavePdf?: boolean
  embedded?: boolean
}) {
  const qrPayload = `${window.location.origin}${getSeizureMgmtRecoveryMemoDetailPath(row.id)}?print=full`
  const sheetNo = row.referenceNumber || row.caseNo || "—"
  const qrNumber = sheetNo === "—" ? row.id : sheetNo
  const generatedAt = new Date().toLocaleString()
  const createdAt = formatDate(row.createdAt)
  const totalPages = 2
  const pdfFilename = pdfFilenameFromCaseNo(row.caseNo || row.referenceNumber, row.id)

  const letterhead = (
    <OfficialLetterhead
      title="Recovery Memo"
      subtitle="Seizure Management · Recovery of Detained Goods"
      qrPayload={qrPayload}
      qrNumber={qrNumber}
      qrAlt="Recovery Memo QR"
      meta={[
        { label: "No.", value: sheetNo },
        { label: "Office", value: memo?.directorate || row.recoveryOfficer },
        { label: "Case", value: row.caseNo || memo?.caseNo },
        { label: "Status", value: row.approvalStatus },
        { label: "Date", value: row.recoveryDate },
      ]}
    />
  )

  return (
    <OfficialReportPrintFrame
      autoSavePdf={autoSavePdf}
      pdfFilename={pdfFilename}
      documentTitle={(row.caseNo || row.referenceNumber || "").trim()}
      embedded={embedded}
    >
      <div className="print-page page-break-after">
        {letterhead}
        <div className="ns-page-body">
          <div className="report-section box">
            <div className="info-grid">
              <ReportInfoRow label="Recovery Memo No.:" value={sheetNo} />
              <ReportInfoRow label="Recovery Date:" value={row.recoveryDate} />
              <ReportInfoRow label="Case Number:" value={row.caseNo || memo?.caseNo} />
              <ReportInfoRow label="Detention Memo No.:" value={memo?.referenceNumber} />
              <ReportInfoRow label="Category:" value={row.category} />
              <ReportInfoRow label="Status:" value={row.approvalStatus} />
            </div>
          </div>

          <div className="report-section">
            <div className="section-title">1. Recovery Officer</div>
            <div className="box">
              <div className="info-grid">
                <ReportInfoRow label="Officer:" value={row.recoveryOfficer} />
                <ReportInfoRow label="Created By:" value={row.createdBy} />
                <ReportInfoRow label="Quantity:" value={row.quantity} />
                <ReportInfoRow label="Deposit Account:" value={row.depositAccountId} />
              </div>
            </div>
          </div>

          <div className="report-section">
            <div className="section-title">2. Linked Detention Memo</div>
            <div className="box">
              <div className="info-grid">
                <ReportInfoRow label="Case Number:" value={memo?.caseNo} />
                <ReportInfoRow label="Memo Number:" value={memo?.referenceNumber} />
                <ReportInfoRow label="Place of Detention:" value={memo?.placeOfDetention} />
                <ReportInfoRow label="Date/Time of Detention:" value={memo?.dateTimeDetention} />
                <ReportInfoRow label="Directorate:" value={memo?.directorate} />
                <ReportInfoRow label="Where Deposited:" value={memo?.whereDeposited} />
              </div>
            </div>
          </div>

          <div className="report-section">
            <div className="section-title">3. Goods Description</div>
            <div className="box narrative">{dash(row.goodsDescription)}</div>
          </div>

          <div className="report-section">
            <div className="section-title">4. Remarks</div>
            <div className="box narrative">{dash(row.remarks)}</div>
          </div>
        </div>
        <OfficialFooter
          page={1}
          total={totalPages}
          sheetNo={sheetNo}
          generatedAt={generatedAt}
          createdAt={createdAt}
        />
      </div>

      <div className="print-page">
        {letterhead}
        <div className="ns-page-body">
          {(row.approvalRemarks || row.rejectionReason) && (
            <div className="report-section">
              <div className="section-title">
                {row.approvalStatus === "Rejected" ? "5. Rejection Reason" : "5. Approval Remarks"}
              </div>
              <div className="box narrative">
                {row.approvalStatus === "Rejected"
                  ? dash(row.rejectionReason)
                  : dash(row.approvalRemarks || row.rejectionReason)}
              </div>
            </div>
          )}

          <div className="report-section">
            <div className="section-title">
              {row.approvalRemarks || row.rejectionReason ? "6" : "5"}. Certification &amp; Signatures
            </div>
            <div className="sign-grid">
              <ReportSignBox
                heading="Prepared by"
                name={row.recoveryOfficer || row.createdBy || ""}
                extra={`Category: ${dash(row.category)}`}
                date={row.recoveryDate || row.createdAt}
              />
              <ReportSignBox
                heading="Approved / Forwarded by"
                name={row.approvedBy || ""}
                extra={`Status: ${dash(row.approvalStatus)}`}
                date={row.approvedAt}
              />
            </div>
          </div>
        </div>
        <OfficialFooter
          page={totalPages}
          total={totalPages}
          sheetNo={sheetNo}
          generatedAt={generatedAt}
          createdAt={createdAt}
        />
      </div>
    </OfficialReportPrintFrame>
  )
}
