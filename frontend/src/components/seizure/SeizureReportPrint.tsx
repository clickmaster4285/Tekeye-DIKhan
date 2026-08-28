import { getSeizureMgmtSeizureReportDetailPath } from "@/routes/config"
import type {
  DetentionAssessmentRecord,
  RecoveryMemoRecord,
  SeizureReportRecord,
} from "@/lib/seizure-management-api"
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

export default function SeizureReportPrint({
  row,
  memo,
  assessment,
  recovery,
  autoSavePdf = false,
  embedded = false,
}: {
  row: SeizureReportRecord
  memo?: DetentionMemoApiRecord | null
  assessment?: DetentionAssessmentRecord | null
  recovery?: RecoveryMemoRecord | null
  autoSavePdf?: boolean
  embedded?: boolean
}) {
  const qrPayload = `${window.location.origin}${getSeizureMgmtSeizureReportDetailPath(row.id)}?print=full`
  const sheetNo = row.referenceNumber || row.caseNo || "—"
  const qrNumber = sheetNo === "—" ? row.id : sheetNo
  const generatedAt = new Date().toLocaleString()
  const createdAt = formatDate(row.createdAt)
  const totalPages = 2
  const pdfFilename = pdfFilenameFromCaseNo(row.caseNo || row.referenceNumber, row.id)

  const letterhead = (
    <OfficialLetterhead
      title="Seizure Report"
      subtitle="Seizure Management · Final Report of Detention, Assessment & Recovery"
      qrPayload={qrPayload}
      qrNumber={qrNumber}
      qrAlt="Seizure Report QR"
      meta={[
        { label: "No.", value: sheetNo },
        { label: "Office", value: memo?.directorate || row.preparedBy },
        { label: "Case", value: row.caseNo || memo?.caseNo },
        { label: "Status", value: row.status },
        { label: "Date", value: row.reportDate },
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
              <ReportInfoRow label="Seizure Report No.:" value={sheetNo} />
              <ReportInfoRow label="Report Date:" value={row.reportDate} />
              <ReportInfoRow label="Case Number:" value={row.caseNo || memo?.caseNo} />
              <ReportInfoRow label="Detention Memo No.:" value={memo?.referenceNumber} />
              <ReportInfoRow label="Prepared By:" value={row.preparedBy} />
              <ReportInfoRow label="Status:" value={row.status} />
            </div>
          </div>

          <div className="report-section">
            <div className="section-title">1. Preparing Officer</div>
            <div className="box">
              <div className="info-grid">
                <ReportInfoRow label="Officer:" value={row.preparedBy} />
                <ReportInfoRow label="Submitted At:" value={row.submittedAt} />
                <ReportInfoRow label="Created On:" value={row.createdAt} />
                <ReportInfoRow label="Updated On:" value={row.updatedAt} />
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
                <ReportInfoRow label="Reason for Detention:" value={memo?.reasonForDetention} />
              </div>
            </div>
          </div>

          <div className="report-section">
            <div className="section-title">3. Summary</div>
            <div className="box narrative">{dash(row.summary)}</div>
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
          <div className="report-section">
            <div className="section-title">4. Recovery + Assessment Sheet</div>
            <div className="box narrative">{dash(row.recoveryAssessmentNotes)}</div>
          </div>

          <div className="report-section">
            <div className="section-title">5. Linked Assessment</div>
            <div className="box">
              {assessment ? (
                <div className="info-grid">
                  <ReportInfoRow label="Assessment Date:" value={assessment.assessmentDate} />
                  <ReportInfoRow label="Examining Officer:" value={assessment.examiningOfficer} />
                  <ReportInfoRow label="Status:" value={assessment.status} />
                  <ReportInfoRow label="Document Relevance:" value={assessment.documentRelevance} />
                  <ReportInfoRow label="Goods Condition:" value={assessment.goodsCondition} />
                  <ReportInfoRow label="Findings:" value={assessment.findings} span2 />
                </div>
              ) : (
                <span className="narrative">No assessment linked</span>
              )}
            </div>
          </div>

          <div className="report-section">
            <div className="section-title">6. Linked Recovery Memo</div>
            <div className="box">
              {recovery ? (
                <div className="info-grid">
                  <ReportInfoRow label="Category:" value={recovery.category} />
                  <ReportInfoRow label="Recovery Date:" value={recovery.recoveryDate} />
                  <ReportInfoRow label="Recovery Officer:" value={recovery.recoveryOfficer} />
                  <ReportInfoRow label="Approval Status:" value={recovery.approvalStatus} />
                  <ReportInfoRow label="Quantity:" value={recovery.quantity} />
                  <ReportInfoRow label="Approved By:" value={recovery.approvedBy} />
                  <ReportInfoRow label="Goods Description:" value={recovery.goodsDescription} span2 />
                  <ReportInfoRow label="Remarks:" value={recovery.remarks} span2 />
                </div>
              ) : (
                <span className="narrative">No recovery memo linked</span>
              )}
            </div>
          </div>

          <div className="report-section">
            <div className="section-title">7. Certification &amp; Signatures</div>
            <div className="sign-grid">
              <ReportSignBox
                heading="Prepared by"
                name={row.preparedBy || ""}
                extra={`Report Date: ${dash(row.reportDate)}`}
                date={row.reportDate || row.createdAt}
              />
              <ReportSignBox
                heading="Submitted / Recorded"
                name={row.preparedBy || ""}
                extra={`Status: ${dash(row.status)}`}
                date={row.submittedAt}
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
