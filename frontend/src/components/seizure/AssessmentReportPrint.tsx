import { getSeizureMgmtAssessmentDetailPath } from "@/routes/config"
import type { DetentionAssessmentRecord } from "@/lib/seizure-management-api"
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
  getQrCodeUrl,
} from "@/components/seizure/official-report-print"

export default function AssessmentReportPrint({
  row,
  memo,
  autoSavePdf = false,
  embedded = false,
}: {
  row: DetentionAssessmentRecord
  memo?: DetentionMemoApiRecord | null
  autoSavePdf?: boolean
  embedded?: boolean
}) {
  const goodsItems = memo?.goodsItems ?? []
  const hasGoods = goodsItems.length > 0
  const showPctCode = goodsItems.some((item) => Boolean(item.pctCode?.trim()))
  const showAssessable = goodsItems.some((item) => Boolean(item.assessableValuePkr?.trim()))
  const attachments = row.attachments ?? []
  const qrPayload = `${window.location.origin}${getSeizureMgmtAssessmentDetailPath(row.id)}?print=full`
  const sheetNo = row.referenceNumber || row.caseNo || "—"
  const qrNumber = sheetNo === "—" ? row.id : sheetNo
  const generatedAt = new Date().toLocaleString()
  const createdAt = formatDate(row.createdAt)
  const totalPages = 2
  const pdfFilename = pdfFilenameFromCaseNo(row.caseNo || row.referenceNumber, row.id)

  const letterhead = (
    <OfficialLetterhead
      title="Assessment"
      subtitle="Seizure Management · Examination, Valuation & Findings"
      qrPayload={qrPayload}
      qrNumber={qrNumber}
      qrAlt="Assessment QR"
      meta={[
        { label: "No.", value: sheetNo },
        { label: "Office", value: memo?.directorate || row.examiningOfficer },
        { label: "Case", value: row.caseNo || memo?.caseNo },
        { label: "Status", value: row.status },
        { label: "Date", value: row.assessmentDate },
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
              <ReportInfoRow label="Assessment No.:" value={sheetNo} />
              <ReportInfoRow label="Assessment Date:" value={row.assessmentDate} />
              <ReportInfoRow label="Case Number:" value={row.caseNo || memo?.caseNo} />
              <ReportInfoRow label="Detention Memo No.:" value={memo?.referenceNumber} />
              <ReportInfoRow label="Document Relevance:" value={row.documentRelevance} />
              <ReportInfoRow label="Status:" value={row.status} />
            </div>
          </div>

          <div className="report-section">
            <div className="section-title">1. Examining Officer</div>
            <div className="box">
              <div className="info-grid">
                <ReportInfoRow label="Officer:" value={row.examiningOfficer} />
                <ReportInfoRow label="Created By:" value={row.createdBy} />
                <ReportInfoRow label="Goods Condition:" value={row.goodsCondition} />
                <ReportInfoRow label="Created On:" value={row.createdAt} />
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
            <div className="section-title">3. Valuation Notes</div>
            <div className="box narrative">{dash(row.valuationNotes)}</div>
          </div>

          <div className="report-section">
            <div className="section-title">4. Findings</div>
            <div className="box narrative">{dash(row.findings)}</div>
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
          {hasGoods && (
            <div className="report-section">
              <div className="section-title">5. Goods Valuation</div>
              <table className="goods-table">
                <thead>
                  <tr>
                    <th style={{ width: "52px" }}>QR</th>
                    <th>Description of Goods</th>
                    <th style={{ width: "44px" }}>Qty</th>
                    <th style={{ width: "42px" }}>Unit</th>
                    <th style={{ width: "78px" }}>Condition</th>
                    {showPctCode && <th style={{ width: "62px" }}>PCT</th>}
                    {showAssessable && <th style={{ width: "90px" }}>Assessable (PKR)</th>}
                  </tr>
                </thead>
                <tbody>
                  {goodsItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.qrCodeNumber ? (
                          <>
                            <img
                              className="goods-qr"
                              src={getQrCodeUrl(item.qrCodeNumber, 48)}
                              alt={item.qrCodeNumber}
                            />
                            <div style={{ fontSize: 7.5, marginTop: 2, wordBreak: "break-all", lineHeight: 1.1 }}>
                              {item.qrCodeNumber}
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{dash(item.description)}</td>
                      <td>{dash(item.quantity)}</td>
                      <td>{dash(item.unit)}</td>
                      <td>{dash(item.condition)}</td>
                      {showPctCode && <td>{dash(item.pctCode)}</td>}
                      {showAssessable && <td>{dash(item.assessableValuePkr)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="report-section">
              <div className="section-title">{hasGoods ? "6" : "5"}. Assessment Documents</div>
              <div className="box">
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: "10.5pt", lineHeight: 1.4 }}>
                  {attachments.map((item) => (
                    <li key={item.id}>
                      {item.originalFilename || item.fileType}
                      {item.fileType ? ` (${item.fileType})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {(row.approvalRemarks || row.rejectionReason) && (
            <div className="report-section">
              <div className="section-title">
                {row.status === "Rejected" ? "Rejection Reason" : "Approval Remarks"}
              </div>
              <div className="box narrative">
                {row.status === "Rejected" ? dash(row.rejectionReason) : dash(row.approvalRemarks)}
              </div>
            </div>
          )}

          <div className="report-section">
            <div className="section-title">Certification &amp; Signatures</div>
            <div className="sign-grid">
              <ReportSignBox
                heading="Examined / Prepared by"
                name={row.examiningOfficer || row.createdBy || ""}
                extra={`Relevance: ${dash(row.documentRelevance)}`}
                date={row.assessmentDate || row.createdAt}
              />
              <ReportSignBox
                heading="Approved / Forwarded by"
                name={row.approvedBy || ""}
                extra={`Status: ${dash(row.status)}`}
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
