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

function PersonPhoto({ src, alt }: { src?: string | null; alt: string }) {
  if (!src?.trim()) return null
  return (
    <img
      src={src}
      alt={alt}
      style={{
        width: 72,
        height: 72,
        objectFit: "cover",
        border: "1px solid #d1d5db",
        borderRadius: 4,
        background: "#fff",
      }}
    />
  )
}

function NoteBlock({ heading, value }: { heading: string; value?: string | null }) {
  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: 10, marginBottom: 2 }}>{heading}</div>
      <div className="narrative">{dash(value)}</div>
    </div>
  )
}

export default function DetentionMemoReportPrint({
  row,
  qrPayload,
  qrNumber,
  autoSavePdf = false,
  embedded = false,
}: DetentionMemoReportPrintProps) {
  const goodsItems = row.goodsItems ?? []
  const attachments = row.mediaAttachments ?? []
  const auditLog = row.auditLog ?? []
  const goodsImages = goodsItems.flatMap((item) =>
    (item.images || []).map((url) => ({ url, label: item.qrCodeNumber || item.description || item.id }))
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
        { label: "No.", value: dash(sheetNo) },
        { label: "FIR", value: dash(row.firNumber) },
        { label: "Office", value: dash(row.directorate) },
        { label: "Case", value: dash(row.caseNo) },
        { label: "Status", value: dash(row.verificationStatus || row.settlementStatus) },
        { label: "Date", value: dash(row.dateTimeDetention || row.dateTimeOccurrence) },
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
              <ReportInfoRow label="FIR Number:" value={row.firNumber} />
              <ReportInfoRow label="Detention Type:" value={row.detentionType} />
              <ReportInfoRow label="Directorate:" value={row.directorate} />
              <ReportInfoRow label="Disposition:" value={row.dispositionStatus} />
              <ReportInfoRow label="Settlement:" value={row.settlementStatus} />
              <ReportInfoRow label="Verification:" value={row.verificationStatus} />
              <ReportInfoRow label="Memo QR No.:" value={row.memoQrCodeNumber || number} />
              <ReportInfoRow label="Created By:" value={row.createdBy} />
              <ReportInfoRow label="Created Date:" value={row.createdAt} />
              <ReportInfoRow label="Updated By:" value={row.updatedBy} />
              <ReportInfoRow label="Updated Date:" value={row.updatedAt} />
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
                <ReportInfoRow label="Location of Detention:" value={row.locationOfDetention} />
                <ReportInfoRow label="Goods Detained At:" value={row.whereDeposited} />
                <ReportInfoRow label="GD Number:" value={row.gdNumber} />
                <ReportInfoRow label="GD Number 2:" value={row.gdNumber2} />
                <ReportInfoRow label="Search / Chassis No.:" value={row.searchChassisNumber} />
                <ReportInfoRow label="Receipt Officer:" value={row.receiptOfficer} />
                <ReportInfoRow label="Reason for Detention:" value={row.reasonForDetention} span2 />
              </div>
            </div>
          </div>

          <div className="report-section">
            <div className="section-title">2. Owner / Accused</div>
            <div className="box">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: row.owner?.picture ? "1fr 72px" : "1fr",
                  gap: 10,
                  alignItems: "start",
                }}
              >
                <div className="info-grid">
                  <ReportInfoRow label="Name:" value={row.owner?.name} />
                  <ReportInfoRow label="CNIC:" value={row.owner?.cnic} />
                  <ReportInfoRow label="Contact:" value={row.owner?.contact} span2 />
                </div>
                <PersonPhoto src={row.owner?.picture} alt="Owner" />
              </div>
            </div>
          </div>

          <div className="report-section">
            <div className="section-title">3. Driver</div>
            <div className="box">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: row.driver?.picture ? "1fr 72px" : "1fr",
                  gap: 10,
                  alignItems: "start",
                }}
              >
                <div className="info-grid">
                  <ReportInfoRow label="Name:" value={row.driver?.name} />
                  <ReportInfoRow label="CNIC:" value={row.driver?.cnic} />
                  <ReportInfoRow label="Contact:" value={row.driver?.contact} span2 />
                </div>
                <PersonPhoto src={row.driver?.picture} alt="Driver" />
              </div>
            </div>
          </div>

          <div className="report-section">
            <div className="section-title">4. Purpose of Detention</div>
            <div className="box narrative">{dash(row.purposeOfDetention)}</div>
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
            <div className="section-title">5. Brief Facts / Memo Description</div>
            <div className="box narrative">{dash(row.briefFacts)}</div>
          </div>

          <div className="report-section">
            <div className="section-title">6. Goods Information</div>
            <table className="goods-table">
              <thead>
                <tr>
                  <th style={{ width: "48px" }}>QR</th>
                  <th>Description of Goods</th>
                  <th style={{ width: "40px" }}>Qty</th>
                  <th style={{ width: "40px" }}>Unit</th>
                  <th style={{ width: "70px" }}>Condition</th>
                  <th style={{ width: "72px" }}>Assessable (PKR)</th>
                  <th style={{ width: "56px" }}>PCT</th>
                  <th style={{ width: "48px" }}>Perish.</th>
                  <th style={{ width: "78px" }}>ID / Chassis</th>
                  <th>Item Notes</th>
                </tr>
              </thead>
              <tbody>
                {goodsItems.length === 0 ? (
                  <tr>
                    <td colSpan={10}>No goods recorded.</td>
                  </tr>
                ) : (
                  goodsItems.map((item) => (
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
                              {item.qrCodeNumber || item.id || "—"}
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
                      <td>{dash(item.assessableValuePkr)}</td>
                      <td>{dash(item.pctCode)}</td>
                      <td>{item.perishable ? "Yes" : "No"}</td>
                      <td>{dash(item.identificationRef)}</td>
                      <td>{dash(item.itemNotes)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {goodsImages.length > 0 && (
            <div className="report-section">
              <div className="section-title">Goods Photographs</div>
              <div className="box" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {goodsImages.map((img, idx) => (
                  <div key={`${img.url}-${idx}`} style={{ width: 72, textAlign: "center" }}>
                    <img
                      src={img.url}
                      alt={img.label}
                      style={{
                        width: 72,
                        height: 72,
                        objectFit: "cover",
                        border: "1px solid #d1d5db",
                        borderRadius: 4,
                        background: "#fff",
                      }}
                    />
                    <div style={{ fontSize: 7, marginTop: 2, wordBreak: "break-all", lineHeight: 1.1 }}>
                      {dash(img.label)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="report-section">
            <div className="section-title">7. Additional Notes &amp; Remarks</div>
            <div className="box">
              <div style={{ display: "grid", gap: 8 }}>
                <NoteBlock heading="Seizing Officer Notes:" value={row.seizingOfficerNotes} />
                <NoteBlock heading="Examining Officer Notes:" value={row.examiningOfficerNotes} />
                <NoteBlock heading="Detention / Customs Notes:" value={row.detentionNotes} />
                <NoteBlock heading="Forwarding Officer Remarks:" value={row.forwardingOfficerRemarks} />
              </div>
            </div>
          </div>

          <div className="report-section">
            <div className="section-title">8. Attached Documents &amp; Videos</div>
            <div className="box">
              {attachments.length === 0 ? (
                <div className="narrative">None</div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {attachments.map((att) => (
                    <div key={att.id} style={{ fontSize: 9.5, wordBreak: "break-all" }}>
                      <strong>{att.kind === "video" ? "Video" : "Document"}:</strong>{" "}
                      {att.originalFilename || "Attachment"}
                      {att.url ? ` — ${att.url}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {auditLog.length > 0 && (
            <div className="report-section">
              <div className="section-title">9. Audit Log</div>
              <div className="box">
                <div style={{ display: "grid", gap: 6 }}>
                  {auditLog.map((entry) => (
                    <div key={entry.id} style={{ fontSize: 9.5 }}>
                      <strong>{entry.actionLabel || entry.action}</strong>
                      {entry.performedBy ? ` · ${entry.performedBy}` : ""}
                      {entry.createdAt ? ` · ${formatDate(entry.createdAt)}` : ""}
                      {entry.message ? (
                        <div className="narrative" style={{ fontSize: 9 }}>
                          {entry.message}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="report-section">
            <div className="section-title">{auditLog.length > 0 ? "10" : "9"}. Certification &amp; Signatures</div>
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
                extra={`Status: ${dash(row.verificationStatus)} · Receipt: ${dash(row.receiptOfficer)}`}
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
