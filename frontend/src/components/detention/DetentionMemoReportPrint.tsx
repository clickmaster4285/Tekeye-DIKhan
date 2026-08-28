import { getDetentionMemoDetailPath } from "@/routes/config"
import type { DetentionMemoApiRecord, DetentionMemoGoodsLineApi } from "@/lib/detention-memo-api"
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

interface DetentionMemoReportPrintProps {
  row: DetentionMemoApiRecord
  qrPayload?: string
  qrNumber?: string
  autoSavePdf?: boolean
  embedded?: boolean
}

function getGoodsQrPayload(memoId: string, item: DetentionMemoGoodsLineApi): string {
  const ref = item.qrCodeNumber || `${memoId}-${item.id}`
  return `${window.location.origin}${getDetentionMemoDetailPath(memoId)}?goodsQr=${encodeURIComponent(ref)}&view=goods`
}

function hasPerson(person?: { name?: string; cnic?: string; contact?: string }) {
  return Boolean(person?.name?.trim() || person?.cnic?.trim() || person?.contact?.trim())
}

export default function DetentionMemoReportPrint({
  row,
  qrPayload,
  qrNumber,
  autoSavePdf = false,
  embedded = false,
}: DetentionMemoReportPrintProps) {
  const goodsItems = row.goodsItems ?? []
  const hasGoods = goodsItems.length > 0
  const showPctCode = goodsItems.some((item) => Boolean(item.pctCode?.trim()))
  const showAssessable = goodsItems.some((item) => Boolean(item.assessableValuePkr?.trim()))
  const showPerishable = goodsItems.some((item) => Boolean(item.perishable))
  const showIdentificationRef = goodsItems.some((item) => Boolean(item.identificationRef?.trim()))
  const showNotes = goodsItems.some((item) => Boolean(item.itemNotes?.trim()))
  const hasAdditionalNotes = Boolean(
    row.seizingOfficerNotes || row.examiningOfficerNotes || row.detentionNotes || row.forwardingOfficerRemarks
  )
  const payload =
    qrPayload ||
    row.memoQrCodePayload ||
    `${window.location.origin}${getDetentionMemoDetailPath(row.id)}?print=full`
  const number = qrNumber || row.memoQrCodeNumber || row.referenceNumber || row.caseNo || row.id
  const sheetNo = row.referenceNumber || row.caseNo || "—"
  const generatedAt = new Date().toLocaleString()
  const createdAt = formatDate(row.createdAt)
  const totalPages = 2
  const pdfFilename = pdfFilenameFromCaseNo(row.caseNo || row.referenceNumber, row.id)

  const letterhead = (
    <OfficialLetterhead
      title="Detention Memo"
      subtitle="Seizure Management · Goods Detention & Inventory"
      qrPayload={payload}
      qrNumber={number}
      qrAlt="Detention Memo QR"
      meta={[
        { label: "No.", value: sheetNo },
        { label: "Office", value: row.directorate },
        { label: "Case", value: row.caseNo },
        { label: "Status", value: row.verificationStatus || row.settlementStatus },
        { label: "Date", value: row.dateTimeDetention || row.dateTimeOccurrence },
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
              <ReportInfoRow label="Detention Memo No.:" value={sheetNo} />
              <ReportInfoRow label="Case Number:" value={row.caseNo} />
              <ReportInfoRow label="Detention Type:" value={row.detentionType} />
              <ReportInfoRow label="Created By:" value={row.createdBy} />
              <ReportInfoRow label="Created Date:" value={row.createdAt} />
              <ReportInfoRow label="Verification:" value={row.verificationStatus} />
            </div>
          </div>

          <div className="report-section">
            <div className="section-title">1. Occurrence &amp; Detention</div>
            <div className="box">
              <div className="info-grid">
                <ReportInfoRow label="Date/Time of Occurrence:" value={row.dateTimeOccurrence} />
                <ReportInfoRow label="Place of Occurrence:" value={row.placeOfOccurrence} />
                <ReportInfoRow label="Date/Time of Detention:" value={row.dateTimeDetention} />
                <ReportInfoRow label="Place of Detention:" value={row.placeOfDetention} />
                <ReportInfoRow label="Directorate:" value={row.directorate} />
                <ReportInfoRow label="Where Deposited:" value={row.whereDeposited} />
                <ReportInfoRow label="Settlement Status:" value={row.settlementStatus} />
                <ReportInfoRow label="Reason for Detention:" value={row.reasonForDetention} />
              </div>
            </div>
          </div>

          {hasPerson(row.owner) && (
            <div className="report-section">
              <div className="section-title">2. Owner / Accused</div>
              <div className="box">
                <div className="info-grid">
                  <ReportInfoRow label="Name:" value={row.owner?.name} />
                  <ReportInfoRow label="CNIC:" value={row.owner?.cnic} />
                  <ReportInfoRow label="Contact:" value={row.owner?.contact} span2 />
                </div>
              </div>
            </div>
          )}

          {hasPerson(row.driver) && (
            <div className="report-section">
              <div className="section-title">{hasPerson(row.owner) ? "3" : "2"}. Driver</div>
              <div className="box">
                <div className="info-grid">
                  <ReportInfoRow label="Name:" value={row.driver?.name} />
                  <ReportInfoRow label="CNIC:" value={row.driver?.cnic} />
                  <ReportInfoRow label="Contact:" value={row.driver?.contact} span2 />
                </div>
              </div>
            </div>
          )}

          {(row.purposeOfDetention || row.briefFacts) && (
            <div className="report-section">
              <div className="section-title">
                {1 + (hasPerson(row.owner) ? 1 : 0) + (hasPerson(row.driver) ? 1 : 0) + 1}.{" "}
                {row.purposeOfDetention ? "Purpose of Detention" : "Memo Description"}
              </div>
              <div className="box narrative">{dash(row.purposeOfDetention || row.briefFacts)}</div>
            </div>
          )}
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
              <div className="section-title">Goods Information</div>
              <table className="goods-table">
                <thead>
                  <tr>
                    <th style={{ width: "52px" }}>QR</th>
                    <th>Description of Goods</th>
                    <th style={{ width: "44px" }}>Qty</th>
                    <th style={{ width: "42px" }}>Unit</th>
                    <th style={{ width: "78px" }}>Condition</th>
                    {showAssessable && <th style={{ width: "80px" }}>Assessable (PKR)</th>}
                    {showPctCode && <th style={{ width: "62px" }}>PCT</th>}
                    {showPerishable && <th style={{ width: "52px" }}>Perish.</th>}
                    {showIdentificationRef && <th style={{ width: "90px" }}>ID / Chassis</th>}
                    {showNotes && <th>Item Notes</th>}
                  </tr>
                </thead>
                <tbody>
                  {goodsItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.qrCodeNumber || item.id ? (
                          <>
                            <img
                              className="goods-qr"
                              src={getQrCodeUrl(getGoodsQrPayload(row.id, item), 48)}
                              alt={item.qrCodeNumber || item.id}
                            />
                            <div style={{ fontSize: 7.5, marginTop: 2, wordBreak: "break-all", lineHeight: 1.1 }}>
                              {item.qrCodeNumber || "—"}
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
                      {showAssessable && <td>{dash(item.assessableValuePkr)}</td>}
                      {showPctCode && <td>{dash(item.pctCode)}</td>}
                      {showPerishable && <td>{item.perishable ? "Yes" : "No"}</td>}
                      {showIdentificationRef && <td>{dash(item.identificationRef)}</td>}
                      {showNotes && <td>{dash(item.itemNotes)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {row.briefFacts && row.purposeOfDetention && (
            <div className="report-section">
              <div className="section-title">Memo Description</div>
              <div className="box narrative">{dash(row.briefFacts)}</div>
            </div>
          )}

          {hasAdditionalNotes && (
            <div className="report-section">
              <div className="section-title">Additional Notes &amp; Remarks</div>
              <div className="box">
                <div style={{ display: "grid", gap: 10 }}>
                  {row.seizingOfficerNotes && (
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 10, marginBottom: 2 }}>Seizing Officer Notes:</div>
                      <div className="narrative">{row.seizingOfficerNotes}</div>
                    </div>
                  )}
                  {row.examiningOfficerNotes && (
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 10, marginBottom: 2 }}>Examining Officer Notes:</div>
                      <div className="narrative">{row.examiningOfficerNotes}</div>
                    </div>
                  )}
                  {row.detentionNotes && (
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 10, marginBottom: 2 }}>Detention / Customs Notes:</div>
                      <div className="narrative">{row.detentionNotes}</div>
                    </div>
                  )}
                  {row.forwardingOfficerRemarks && (
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 10, marginBottom: 2 }}>Forwarding Officer Remarks:</div>
                      <div className="narrative">{row.forwardingOfficerRemarks}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="report-section">
            <div className="section-title">Certification &amp; Signatures</div>
            <div className="sign-grid">
              <ReportSignBox
                heading="Prepared by"
                name={row.createdBy || "ASO Portal"}
                extra={`Directorate: ${dash(row.directorate)}`}
                date={row.createdAt}
              />
              <ReportSignBox
                heading="Examining / Forwarding"
                name={row.updatedBy || row.receiptOfficer || ""}
                extra={`Status: ${dash(row.verificationStatus)}`}
                date={row.updatedAt}
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
