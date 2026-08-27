import type { CSSProperties, RefObject } from "react"
import type { AttendanceRecord } from "@/lib/attendance-api"
import { resolveMediaUrl } from "@/lib/cameras-api"
import { resolveStaffProfileImageUrl, type StaffRecord } from "@/lib/staff-api"

export type AttendancePeriod = "day" | "week" | "month"

export type AttendancePersonPage = {
  key: string
  name: string
  fatherName: string
  phone: string
  designation: string
  employeeId: string
  department: string
  imageUrl: string | null
  rows: {
    date: string
    checkIn: string
    checkOut: string
    workingTime: string
  }[]
  totalWorkingLabel: string
}

export function formatAttendanceTime(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  } catch {
    return "—"
  }
}

export function formatWorkingTime(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return "—"
  const start = new Date(checkIn).getTime()
  const end = new Date(checkOut).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "—"
  return minutesToLabel(Math.round((end - start) / 60_000))
}

function minutesToLabel(totalMinutes: number): string {
  if (totalMinutes <= 0) return "—"
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes}m`
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`
}

function parseWorkingMinutes(label: string): number {
  if (!label || label === "—") return 0
  const h = label.match(/(\d+)\s*h/)
  const m = label.match(/(\d+)\s*m/)
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0)
}

/** Monday-start ISO week range for a YYYY-MM-DD date. */
export function getWeekRange(dateStr: string): { start: string; end: string } {
  const d = new Date(`${dateStr}T12:00:00`)
  const day = d.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const start = new Date(d)
  start.setDate(d.getDate() + diffToMon)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const iso = (x: Date) => x.toISOString().slice(0, 10)
  return { start: iso(start), end: iso(end) }
}

export function getMonthRange(dateStr: string): { start: string; end: string } {
  const [y, m] = dateStr.split("-").map(Number)
  const start = `${y}-${String(m).padStart(2, "0")}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  return { start, end }
}

export function filterAttendanceByPeriod(
  records: AttendanceRecord[],
  period: AttendancePeriod,
  anchorDate: string
): AttendanceRecord[] {
  if (!anchorDate) return records
  if (period === "day") return records.filter((r) => r.date === anchorDate)
  if (period === "week") {
    const { start, end } = getWeekRange(anchorDate)
    return records.filter((r) => r.date >= start && r.date <= end)
  }
  const { start, end } = getMonthRange(anchorDate)
  return records.filter((r) => r.date >= start && r.date <= end)
}

export function periodLabel(period: AttendancePeriod, anchorDate: string): string {
  if (period === "day") return `Daily report — ${anchorDate}`
  if (period === "week") {
    const { start, end } = getWeekRange(anchorDate)
    return `Weekly report — ${start} to ${end}`
  }
  const { start, end } = getMonthRange(anchorDate)
  return `Monthly report — ${start.slice(0, 7)}`
}

function findStaffForRecord(record: AttendanceRecord, staffList: StaffRecord[]): StaffRecord | undefined {
  if (record.staff != null) {
    const byStaff = staffList.find((s) => s.id === record.staff)
    if (byStaff) return byStaff
  }
  if (record.user != null) {
    return staffList.find((s) => {
      const uid = s.user_id ?? s.user
      return uid != null && Number(uid) === Number(record.user)
    })
  }
  return undefined
}

export function attendancePersonKey(record: AttendanceRecord): string {
  if (record.staff != null) return `staff-${record.staff}`
  if (record.user != null) return `user-${record.user}`
  return `record-${record.id}`
}

function personKey(record: AttendanceRecord): string {
  return attendancePersonKey(record)
}

function personName(record: AttendanceRecord, staff?: StaffRecord): string {
  return (
    staff?.full_name?.trim() ||
    record.staff_name?.trim() ||
    record.username?.trim() ||
    "Unknown"
  )
}

function personImageUrl(record: AttendanceRecord, staff?: StaffRecord): string | null {
  if (staff) {
    const gallery = staff.staff_photo_urls?.filter(Boolean) ?? []
    if (gallery[0]) return gallery[0]
    const profile = resolveStaffProfileImageUrl(staff.profile_image)
    if (profile) return profile
  }
  if (record.image) return resolveMediaUrl(record.image)
  return null
}

/** Group filtered attendance into one page per person (same layout for day/week/month). */
export function buildAttendancePdfPages(
  records: AttendanceRecord[],
  staffList: StaffRecord[]
): AttendancePersonPage[] {
  const map = new Map<string, AttendancePersonPage>()

  const sorted = [...records].sort((a, b) => {
    const nameA = personName(a, findStaffForRecord(a, staffList)).toLowerCase()
    const nameB = personName(b, findStaffForRecord(b, staffList)).toLowerCase()
    if (nameA !== nameB) return nameA.localeCompare(nameB)
    return a.date.localeCompare(b.date)
  })

  for (const record of sorted) {
    const staff = findStaffForRecord(record, staffList)
    const key = personKey(record)
    let page = map.get(key)
    if (!page) {
      page = {
        key,
        name: personName(record, staff),
        fatherName: staff?.father_name?.trim() || "—",
        phone:
          staff?.phone_primary?.trim() ||
          staff?.phone?.trim() ||
          staff?.phone_alternate?.trim() ||
          "—",
        designation: staff?.designation?.trim() || "—",
        employeeId: staff?.employee_id?.trim() || staff?.personal_number?.trim() || "—",
        department: staff?.department?.trim() || "—",
        imageUrl: personImageUrl(record, staff),
        rows: [],
        totalWorkingLabel: "—",
      }
      map.set(key, page)
    } else if (!page.imageUrl) {
      page.imageUrl = personImageUrl(record, staff)
    }
    page.rows.push({
      date: record.date,
      checkIn: formatAttendanceTime(record.check_in),
      checkOut: formatAttendanceTime(record.check_out),
      workingTime: formatWorkingTime(record.check_in, record.check_out),
    })
  }

  for (const page of map.values()) {
    const total = page.rows.reduce((sum, row) => sum + parseWorkingMinutes(row.workingTime), 0)
    page.totalWorkingLabel = total > 0 ? minutesToLabel(total) : "—"
  }

  return Array.from(map.values())
}

type AttendancePdfReportProps = {
  pages: AttendancePersonPage[]
  period: AttendancePeriod
  anchorDate: string
  reportRef: RefObject<HTMLDivElement | null>
}

const NAVY = "#0f2744"
const NAVY_MID = "#1a3a5c"
const GOLD = "#b8860b"
const MUTED = "#5b6b7c"
const LINE = "#d8dee6"
const SOFT = "#f4f7fb"
const TEKEYE_LOGO_SRC = "/pakistan-customs-logo.png"

function absoluteAssetUrl(path: string): string {
  if (typeof window === "undefined") return path
  if (path.startsWith("http") || path.startsWith("data:")) return path
  return `${window.location.origin}${path.startsWith("/") ? "" : "/"}${path}`
}

export function AttendancePdfReport({
  pages,
  period,
  anchorDate,
  reportRef,
}: AttendancePdfReportProps) {
  const generatedAt = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
  const logoSrc = absoluteAssetUrl(TEKEYE_LOGO_SRC)

  return (
    <div
      ref={reportRef}
      style={{
        position: "fixed",
        left: "-10000px",
        top: 0,
        width: "210mm",
        background: "#fff",
        color: "#142033",
        fontFamily: "Georgia, 'Times New Roman', Times, serif",
      }}
      aria-hidden
    >
      {pages.map((page, pageIndex) => (
        <div
          key={page.key}
          className="att-pdf-page"
          data-pdf-page="1"
          style={{
            width: "210mm",
            height: "297mm",
            padding: "0",
            margin: "0",
            boxSizing: "border-box",
            background: "#fff",
            overflow: "hidden",
            position: "relative",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Top brand bar */}
          <div
            style={{
              background: NAVY,
              color: "#fff",
              padding: "8mm 12mm 7mm",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                <div
                  style={{
                    width: "16mm",
                    height: "16mm",
                    background: "#fff",
                    borderRadius: "3px",
                    padding: "2mm",
                    boxSizing: "border-box",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={logoSrc}
                    alt="TekEye"
                    crossOrigin="anonymous"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "11px",
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: GOLD,
                      fontFamily: "Arial, Helvetica, sans-serif",
                      fontWeight: 700,
                    }}
                  >
                    TekEye
                  </p>
                  <h1
                    style={{
                      margin: "3px 0 0",
                      fontSize: "20px",
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                      lineHeight: 1.2,
                    }}
                  >
                    Attendance Record
                  </h1>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "10px",
                      color: "#d7e2f0",
                      fontFamily: "Arial, Helvetica, sans-serif",
                    }}
                  >
                    Human Resources · {periodLabel(period, anchorDate)}
                  </p>
                </div>
              </div>
              <div
                style={{
                  textAlign: "right",
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontSize: "10px",
                  color: "#c5d4e8",
                  lineHeight: 1.5,
                  flexShrink: 0,
                }}
              >
                <div>Page {pageIndex + 1} of {pages.length}</div>
                <div>Generated {generatedAt}</div>
              </div>
            </div>
            <div
              style={{
                marginTop: "7px",
                height: "3px",
                background: GOLD,
                width: "48px",
              }}
            />
          </div>

          {/* Body */}
          <div
            style={{
              flex: 1,
              padding: "8mm 12mm 10mm",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "10mm",
                alignItems: "stretch",
                flex: 1,
                minHeight: 0,
              }}
            >
              {/* Left: details */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  paddingLeft: "1px",
                }}
              >
                <div
                  style={{
                    background: SOFT,
                    padding: "5mm 5mm 4mm",
                    marginBottom: "5mm",
                    boxSizing: "border-box",
                    // inset shadow keeps all 4 sides visible in html2canvas (1px border often clips left)
                    boxShadow: `inset 0 0 0 1.5px ${LINE}`,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "9px",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: MUTED,
                      fontFamily: "Arial, Helvetica, sans-serif",
                    }}
                  >
                    Employee
                  </p>
                  <p
                    style={{
                      margin: "3px 0 0",
                      fontSize: "18px",
                      fontWeight: 700,
                      color: NAVY,
                      lineHeight: 1.25,
                    }}
                  >
                    {page.name}
                  </p>
                  <div
                    style={{
                      marginTop: "8px",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "6px 12px",
                      fontFamily: "Arial, Helvetica, sans-serif",
                      fontSize: "10px",
                    }}
                  >
                    <MetaItem label="Employee ID" value={page.employeeId} />
                    <MetaItem label="Designation" value={page.designation} />
                    <MetaItem label="Department" value={page.department} />
                    <MetaItem label="Days recorded" value={String(page.rows.length)} />
                    <MetaItem label="Father name" value={page.fatherName} />
                    <MetaItem label="Phone number" value={page.phone} />
                  </div>
                </div>

                <p
                  style={{
                    margin: "0 0 6px",
                    fontSize: "10px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: NAVY_MID,
                    fontFamily: "Arial, Helvetica, sans-serif",
                    fontWeight: 700,
                  }}
                >
                  Attendance log
                </p>

                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "10.5px",
                    fontFamily: "Arial, Helvetica, sans-serif",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>Check-in</th>
                      <th style={thStyle}>Check-out</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Working time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.rows.map((row, i) => (
                      <tr
                        key={`${page.key}-${row.date}-${row.checkIn}-${i}`}
                        style={{ background: i % 2 === 0 ? "#fff" : SOFT }}
                      >
                        <td style={tdStyle}>{row.date}</td>
                        <td style={tdStyle}>{row.checkIn}</td>
                        <td style={tdStyle}>{row.checkOut}</td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                          {row.workingTime}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: "5mm",
                    borderTop: `2px solid ${NAVY}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontFamily: "Arial, Helvetica, sans-serif",
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: MUTED,
                      fontWeight: 700,
                    }}
                  >
                    Total working time
                  </span>
                  <span style={{ fontSize: "16px", fontWeight: 700, color: NAVY }}>
                    {page.totalWorkingLabel}
                  </span>
                </div>
              </div>

              {/* Right: photo */}
              <div
                style={{
                  width: "58mm",
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    background: "#fff",
                    padding: "3mm",
                    display: "flex",
                    flexDirection: "column",
                    boxSizing: "border-box",
                    boxShadow: `inset 0 0 0 1.5px ${LINE}`,
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 3mm",
                      fontSize: "9px",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: MUTED,
                      fontFamily: "Arial, Helvetica, sans-serif",
                      textAlign: "center",
                    }}
                  >
                    Employee photograph
                  </p>
                  <div
                    style={{
                      width: "52mm",
                      height: "52mm",
                      background: SOFT,
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto",
                      boxSizing: "border-box",
                      boxShadow: `inset 0 0 0 1.5px ${LINE}`,
                    }}
                  >
                    {page.imageUrl ? (
                      <img
                        src={page.imageUrl}
                        alt={page.name}
                        crossOrigin="anonymous"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          textAlign: "center",
                          fontFamily: "Arial, Helvetica, sans-serif",
                          color: "#9aa8b8",
                          padding: "12px",
                        }}
                      >
                        <div
                          style={{
                            width: "48px",
                            height: "48px",
                            margin: "0 auto 8px",
                            borderRadius: "50%",
                            border: "2px solid #c5d0dc",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "18px",
                            color: "#a0aec0",
                          }}
                        >
                          {page.name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: "10px" }}>No photograph on file</span>
                      </div>
                    )}
                  </div>
                  <p
                    style={{
                      margin: "3mm 0 0",
                      fontSize: "9px",
                      color: MUTED,
                      textAlign: "center",
                      fontFamily: "Arial, Helvetica, sans-serif",
                      lineHeight: 1.35,
                    }}
                  >
                    Official staff profile image
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              flexShrink: 0,
              borderTop: `1px solid ${LINE}`,
              padding: "3.5mm 12mm",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontFamily: "Arial, Helvetica, sans-serif",
              fontSize: "8.5px",
              color: MUTED,
              background: SOFT,
            }}
          >
            <span>Confidential — for HR / management use only</span>
            <span style={{ color: NAVY, fontWeight: 600 }}>
              {page.name} · {periodLabel(period, anchorDate)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: MUTED, fontSize: "8.5px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ marginTop: "1px", color: "#142033", fontWeight: 600, fontSize: "11px" }}>
        {value}
      </div>
    </div>
  )
}

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "7px 8px",
  borderBottom: `2px solid ${NAVY}`,
  fontWeight: 700,
  color: NAVY,
  background: SOFT,
  fontSize: "9px",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
}

const tdStyle: CSSProperties = {
  padding: "7px 8px",
  borderBottom: `1px solid ${LINE}`,
  color: "#1a2433",
}

/** html2canvas cannot parse modern CSS (oklch) from the app theme. */
function stripThemeStylesFromClone(clonedDoc: Document) {
  clonedDoc.querySelectorAll("style, link[rel='stylesheet']").forEach((el) => el.remove())
  const wipeVars = (el: HTMLElement | null) => {
    if (!el) return
    el.removeAttribute("class")
    el.style.cssText = "background:#ffffff;color:#111111;margin:0;padding:0;"
  }
  wipeVars(clonedDoc.documentElement)
  wipeVars(clonedDoc.body)
}

/**
 * Build PDF one A4 page at a time to avoid blank trailing pages
 * that css/legacy page-break modes often create.
 */
export async function downloadAttendancePdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const pageNodes = Array.from(
    element.querySelectorAll<HTMLElement>(".att-pdf-page")
  )
  if (pageNodes.length === 0) throw new Error("No attendance pages to export")

  const iframe = document.createElement("iframe")
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;"
  document.body.appendChild(iframe)

  try {
    const idoc = iframe.contentDocument
    if (!idoc) throw new Error("Could not create PDF render frame")

    idoc.open()
    idoc.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        html,body{margin:0;padding:0;background:#fff;color:#111;}
        *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      </style></head><body></body></html>`
    )
    idoc.close()

    const html2canvas = (await import("html2canvas")).default
    const { jsPDF } = await import("jspdf")
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()

    for (let i = 0; i < pageNodes.length; i++) {
      idoc.body.innerHTML = pageNodes[i].outerHTML
      const clone = idoc.body.firstElementChild as HTMLElement
      clone.style.margin = "0"
      clone.style.position = "static"

      const images = Array.from(clone.querySelectorAll("img"))
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve()
                return
              }
              img.onload = () => resolve()
              img.onerror = () => resolve()
            })
        )
      )
      await new Promise((r) => setTimeout(r, 60))

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: clone.offsetWidth,
        height: clone.offsetHeight,
        windowWidth: Math.ceil(clone.offsetWidth),
        windowHeight: Math.ceil(clone.offsetHeight),
        onclone: (clonedDoc) => {
          stripThemeStylesFromClone(clonedDoc)
        },
      })

      const imgData = canvas.toDataURL("image/jpeg", 0.96)
      if (i > 0) pdf.addPage()
      // Fit exactly to one A4 page — no leftover blank page
      pdf.addImage(imgData, "JPEG", 0, 0, pageW, pageH, undefined, "FAST")
    }

    pdf.save(filename)
  } finally {
    iframe.remove()
  }
}
