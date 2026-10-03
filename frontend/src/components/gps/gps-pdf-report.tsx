import type { CSSProperties, RefObject } from "react"
import { CUSTOMS_LOGO_SRC } from "@/lib/brand"
import { resolveLocationName } from "@/lib/gps-geofences"
import type { GpsHistoryPoint, GpsOfficer, GpsReportPeriod } from "@/lib/gps-tracking-api"
import { resolveStaffProfileImageUrl } from "@/lib/staff-api"
import {
  formatClock,
  formatClockWithSeconds,
  formatReportDate,
  gpsPeriodLabel,
  mapsLinkForCoords,
  trailDistanceKm,
} from "@/lib/gps-utils"

const NAVY = "#0f2744"
const GOLD = "#b8860b"
const MUTED = "#5b6b7c"
const LINE = "#d8dee6"
const SOFT = "#f4f7fb"
const ROW_ALT = "#f8fafc"
const MOVING = "#166534"
const MOVING_BG = "#dcfce7"
const STILL = "#475569"
const STILL_BG = "#f1f5f9"
const ROWS_FIRST_PAGE = 16
const ROWS_NEXT_PAGE = 26

function absoluteAssetUrl(path: string): string {
  if (typeof window === "undefined") return path
  if (path.startsWith("http") || path.startsWith("data:")) return path
  return `${window.location.origin}${path.startsWith("/") ? "" : "/"}${path}`
}

function chunkRows<T>(rows: T[], firstSize: number, nextSize: number): T[][] {
  if (rows.length === 0) return [[]]
  const pages: T[][] = []
  pages.push(rows.slice(0, firstSize))
  let i = firstSize
  while (i < rows.length) {
    pages.push(rows.slice(i, i + nextSize))
    i += nextSize
  }
  return pages
}

function formatPointDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return "—"
  }
}

function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

function statusBadge(status: string | null | undefined): { label: string; color: string; bg: string } {
  const raw = (status || "").trim()
  const low = raw.toLowerCase()
  if (low.includes("mov")) return { label: raw || "Moving", color: MOVING, bg: MOVING_BG }
  if (low.includes("station") || low.includes("still")) {
    return { label: raw || "Stationary", color: STILL, bg: STILL_BG }
  }
  return { label: raw || "—", color: MUTED, bg: SOFT }
}

type GpsPdfReportProps = {
  officer: GpsOfficer | null
  points: GpsHistoryPoint[]
  period: GpsReportPeriod
  anchorDate: string
  totalCount?: number
  sampled?: boolean
  locationNames?: Record<string, string>
  reportRef: RefObject<HTMLDivElement | null>
}

export function GpsPdfReport({
  officer,
  points,
  period,
  anchorDate,
  totalCount,
  sampled,
  locationNames,
  reportRef,
}: GpsPdfReportProps) {
  const name = officer?.name ?? "—"
  const first = points[0]
  const last = points[points.length - 1]
  const distanceKm = trailDistanceKm(points)
  const showDateCol = period !== "day"
  const pages = chunkRows(points, ROWS_FIRST_PAGE, ROWS_NEXT_PAGE)
  const generatedAt = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
  const logoSrc = absoluteAssetUrl(CUSTOMS_LOGO_SRC)
  const photoSrc = resolveStaffProfileImageUrl(officer?.profileImage)
  const periodText = gpsPeriodLabel(period, anchorDate)
  const shownLabel =
    sampled && totalCount != null && totalCount > points.length
      ? `${points.length} of ${totalCount} points`
      : `${points.length} shown`

  const thStyle: CSSProperties = {
    textAlign: "left",
    fontSize: "8px",
    fontFamily: "Arial, Helvetica, sans-serif",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#fff",
    background: NAVY,
    borderBottom: `1px solid ${NAVY}`,
    padding: "3.2mm 2mm",
    fontWeight: 700,
  }
  const tdStyle: CSSProperties = {
    fontSize: "9px",
    fontFamily: "Arial, Helvetica, sans-serif",
    borderBottom: `1px solid ${LINE}`,
    padding: "2.6mm 2mm",
    verticalAlign: "middle",
    color: "#1a2332",
  }

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
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
      aria-hidden
    >
      {pages.map((pageRows, pageIndex) => (
        <div
          key={`gps-pdf-${pageIndex}`}
          className="gps-pdf-page"
          data-pdf-page="1"
          style={{
            width: "210mm",
            height: "297mm",
            padding: 0,
            margin: 0,
            boxSizing: "border-box",
            background: "#fff",
            overflow: "hidden",
            position: "relative",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              background: NAVY,
              color: "#fff",
              padding: "7mm 11mm 6mm",
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
              <div style={{ display: "flex", alignItems: "center", gap: "11px", minWidth: 0 }}>
                <div
                  style={{
                    width: "14mm",
                    height: "14mm",
                    background: "#fff",
                    borderRadius: "2px",
                    padding: "1.5mm",
                    boxSizing: "border-box",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={logoSrc}
                    alt="CIIS"
                    crossOrigin="anonymous"
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "10px",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: GOLD,
                      fontWeight: 700,
                    }}
                  >
                    Customs · TekEye
                  </p>
                  <h1
                    style={{
                      margin: "2px 0 0",
                      fontSize: "17px",
                      fontWeight: 700,
                      letterSpacing: "0.01em",
                      lineHeight: 1.25,
                    }}
                  >
                    Staff GPS Location Report
                  </h1>
                  <p style={{ margin: "3px 0 0", fontSize: "10px", color: "#d7e2f0" }}>
                    {name} · {periodText}
                  </p>
                </div>
              </div>
              <div
                style={{
                  textAlign: "right",
                  fontSize: "9px",
                  color: "#c5d4e8",
                  lineHeight: 1.55,
                  flexShrink: 0,
                }}
              >
                <div>
                  Page {pageIndex + 1} of {pages.length}
                </div>
                <div>Generated {generatedAt}</div>
              </div>
            </div>
            <div style={{ marginTop: "6px", height: "2.5px", background: GOLD, width: "42px" }} />
          </div>

          <div
            style={{
              flex: 1,
              padding: "7mm 11mm 9mm",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            {pageIndex === 0 ? (
              <div
                style={{
                  display: "flex",
                  gap: "6mm",
                  marginBottom: "5mm",
                  padding: "3.5mm",
                  background: SOFT,
                  border: `1px solid ${LINE}`,
                  borderRadius: "2px",
                }}
              >
                <div
                  style={{
                    width: "24mm",
                    height: "24mm",
                    borderRadius: "2px",
                    overflow: "hidden",
                    background: "#fff",
                    border: `1px solid ${LINE}`,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {photoSrc ? (
                    <img
                      src={photoSrc}
                      alt=""
                      crossOrigin="anonymous"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span style={{ fontSize: "13px", color: MUTED, fontWeight: 700 }}>
                      {(name || "?").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0, fontSize: "10px" }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: NAVY }}>{name}</p>
                  <p style={{ margin: "2px 0 0", color: MUTED }}>
                    Employee ID: {officer?.employeeId || "—"}
                    {officer?.location ? ` · ${officer.location}` : ""}
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "3px 10px",
                      marginTop: "6px",
                    }}
                  >
                    <div>
                      <div style={{ color: MUTED, fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Period
                      </div>
                      <div style={{ fontWeight: 600 }}>{periodText}</div>
                    </div>
                    <div>
                      <div style={{ color: MUTED, fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        GPS points
                      </div>
                      <div style={{ fontWeight: 600 }}>{shownLabel}</div>
                    </div>
                    <div>
                      <div style={{ color: MUTED, fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Distance
                      </div>
                      <div style={{ fontWeight: 600 }}>{distanceKm.toFixed(2)} km</div>
                    </div>
                    <div>
                      <div style={{ color: MUTED, fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        First fix
                      </div>
                      <div style={{ fontWeight: 600 }}>{formatClock(first?.recordedAt)}</div>
                    </div>
                    <div>
                      <div style={{ color: MUTED, fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Last fix
                      </div>
                      <div style={{ fontWeight: 600 }}>{formatClock(last?.recordedAt)}</div>
                    </div>
                    <div>
                      <div style={{ color: MUTED, fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Tracking window
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        {first && last
                          ? `${formatClock(first.recordedAt)} – ${formatClock(last.recordedAt)}`
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ margin: "0 0 3.5mm", fontSize: "10px", color: MUTED }}>
                Continued — {name} · {periodText}
              </p>
            )}

            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                {showDateCol ? <col style={{ width: "14%" }} /> : null}
                <col style={{ width: showDateCol ? "12%" : "14%" }} />
                <col style={{ width: showDateCol ? "42%" : "48%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "11%" }} />
              </colgroup>
              <thead>
                <tr>
                  {showDateCol ? <th style={thStyle}>Date</th> : null}
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Location</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Map</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Acc.</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showDateCol ? 6 : 5}
                      style={{ ...tdStyle, textAlign: "center", color: MUTED, padding: "12mm 4px" }}
                    >
                      No GPS records for this period.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((point, idx) => {
                    const place = resolveLocationName(point.latitude, point.longitude, locationNames, {
                      pointLocationName: point.locationName,
                    })
                    const mapUrl =
                      point.mapsUrl || mapsLinkForCoords(point.latitude, point.longitude)
                    const badge = statusBadge(point.status)
                    const rowBg = idx % 2 === 1 ? ROW_ALT : "#fff"
                    return (
                      <tr key={`${point.recordedAt}-${idx}`} style={{ background: rowBg }}>
                        {showDateCol ? (
                          <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                            {formatPointDate(point.recordedAt)}
                          </td>
                        ) : null}
                        <td style={{ ...tdStyle, fontWeight: 700, whiteSpace: "nowrap", fontSize: "8.5px" }}>
                          {formatClockWithSeconds(point.recordedAt)}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, lineHeight: 1.35 }}>{place}</div>
                          <div style={{ marginTop: "1px", fontSize: "7.5px", color: MUTED, fontWeight: 400 }}>
                            {formatCoords(point.latitude, point.longitude)}
                          </div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          {mapUrl ? (
                            <a
                              href={mapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-block",
                                padding: "1.2mm 2.2mm",
                                borderRadius: "2px",
                                background: "#eff6ff",
                                border: "1px solid #bfdbfe",
                                color: "#1d4ed8",
                                fontSize: "8px",
                                fontWeight: 700,
                                textDecoration: "none",
                                letterSpacing: "0.02em",
                                whiteSpace: "nowrap",
                              }}
                            >
                              View map
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center", whiteSpace: "nowrap" }}>
                          {point.accuracy != null ? `${Math.round(point.accuracy)} m` : "—"}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "1mm 2mm",
                              borderRadius: "2px",
                              background: badge.bg,
                              color: badge.color,
                              fontSize: "7.5px",
                              fontWeight: 700,
                              letterSpacing: "0.02em",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>

            {pageIndex === pages.length - 1 && points.length > 0 ? (
              <div
                style={{
                  marginTop: "auto",
                  paddingTop: "4mm",
                  borderTop: `1px solid ${LINE}`,
                  fontSize: "9px",
                  color: MUTED,
                  lineHeight: 1.45,
                }}
              >
                <strong style={{ color: NAVY }}>Summary</strong> — {name}; {shownLabel}; distance{" "}
                {distanceKm.toFixed(2)} km; first{" "}
                {formatReportDate(first?.recordedAt?.slice(0, 10) || anchorDate)}{" "}
                {formatClock(first?.recordedAt)}; last {formatClock(last?.recordedAt)}. Map buttons open
                Google Maps at the recorded coordinates.
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

export async function downloadGpsPdf(element: HTMLElement, filename: string): Promise<void> {
  const pageNodes = Array.from(element.querySelectorAll<HTMLElement>(".gps-pdf-page"))
  if (pageNodes.length === 0) throw new Error("No GPS pages to export")

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
        a{color:inherit;}
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

      const pageRect = clone.getBoundingClientRect()
      const linkRects = Array.from(clone.querySelectorAll<HTMLAnchorElement>("a[href]")).map((a) => {
        const r = a.getBoundingClientRect()
        return {
          url: a.href,
          x: r.left - pageRect.left,
          y: r.top - pageRect.top,
          w: r.width,
          h: r.height,
        }
      })

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: clone.offsetWidth,
        height: clone.offsetHeight,
        windowWidth: Math.ceil(clone.offsetWidth),
        windowHeight: Math.ceil(clone.offsetHeight),
      })

      const imgData = canvas.toDataURL("image/jpeg", 0.96)
      if (i > 0) pdf.addPage()
      pdf.addImage(imgData, "JPEG", 0, 0, pageW, pageH, undefined, "FAST")

      const sx = pageW / Math.max(1, clone.offsetWidth)
      const sy = pageH / Math.max(1, clone.offsetHeight)
      for (const link of linkRects) {
        if (!link.url || link.w < 1 || link.h < 1) continue
        pdf.link(link.x * sx, link.y * sy, link.w * sx, link.h * sy, { url: link.url })
      }
    }

    pdf.save(filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`)
  } finally {
    iframe.remove()
  }
}
