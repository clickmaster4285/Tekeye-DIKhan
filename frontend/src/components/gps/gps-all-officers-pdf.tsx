import type { CSSProperties, RefObject } from "react"
import { CUSTOMS_LOGO_SRC } from "@/lib/brand"
import { resolveLocationName } from "@/lib/gps-geofences"
import type { GpsOfficer, GpsReportPeriod } from "@/lib/gps-tracking-api"
import { formatReportDate, gpsPeriodLabel, mapsLinkForCoords, timeAgo } from "@/lib/gps-utils"
import { locationLabel } from "@/lib/locations"

const NAVY = "#0f2744"
const GOLD = "#b8860b"
const MUTED = "#5b6b7c"
const LINE = "#d8dee6"
const SOFT = "#f4f7fb"
const ROWS_PER_PAGE = 22

function absoluteAssetUrl(path: string): string {
  if (typeof window === "undefined") return path
  if (path.startsWith("http") || path.startsWith("data:")) return path
  return `${window.location.origin}${path.startsWith("/") ? "" : "/"}${path}`
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  if (rows.length === 0) return [[]]
  const pages: T[][] = []
  for (let i = 0; i < rows.length; i += size) pages.push(rows.slice(i, i + size))
  return pages
}

type GpsAllOfficersPdfReportProps = {
  officers: GpsOfficer[]
  period: GpsReportPeriod
  anchorDate: string
  locationNames?: Record<string, string>
  reportRef: RefObject<HTMLDivElement | null>
}

export function GpsAllOfficersPdfReport({
  officers,
  period,
  anchorDate,
  locationNames,
  reportRef,
}: GpsAllOfficersPdfReportProps) {
  const sorted = [...officers].sort((a, b) => {
    const rank = (s: string) => (s === "live" ? 0 : s === "stale" ? 1 : 2)
    return rank(a.status) - rank(b.status) || a.name.localeCompare(b.name)
  })
  const pages = chunkRows(sorted, ROWS_PER_PAGE)
  const periodText = gpsPeriodLabel(period, anchorDate)
  const generatedAt = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
  const withFix = sorted.filter(
    (o) =>
      typeof o.latitude === "number" &&
      typeof o.longitude === "number" &&
      !(o.latitude === 0 && o.longitude === 0)
  ).length

  const thStyle: CSSProperties = {
    textAlign: "left",
    padding: "2.2mm 1.5mm",
    borderBottom: `1px solid ${LINE}`,
    fontSize: "8px",
    fontWeight: 700,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    fontFamily: "Arial, Helvetica, sans-serif",
    background: SOFT,
  }
  const tdStyle: CSSProperties = {
    padding: "2mm 1.5mm",
    borderBottom: `1px solid ${LINE}`,
    fontSize: "9px",
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#1a2332",
    verticalAlign: "top",
  }

  return (
    <div
      ref={reportRef}
      aria-hidden
      style={{
        position: "fixed",
        left: "-10000px",
        top: 0,
        width: "210mm",
        pointerEvents: "none",
        opacity: 0,
      }}
    >
      {pages.map((pageRows, pageIndex) => (
        <div
          key={`all-gps-page-${pageIndex}`}
          className="gps-pdf-page"
          style={{
            width: "210mm",
            minHeight: "297mm",
            padding: "12mm 12mm 14mm",
            background: "#fff",
            color: "#111",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4mm",
              borderBottom: `2px solid ${NAVY}`,
              paddingBottom: "3mm",
              marginBottom: "4mm",
            }}
          >
            <img
              src={absoluteAssetUrl(CUSTOMS_LOGO_SRC)}
              alt=""
              style={{ width: "14mm", height: "14mm", objectFit: "contain" }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: GOLD,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Customs · TekEye
              </p>
              <h1
                style={{
                  margin: "1mm 0 0",
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontSize: "16px",
                  fontWeight: 700,
                  color: NAVY,
                }}
              >
                All Staff GPS Report
              </h1>
              <p
                style={{
                  margin: "1mm 0 0",
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontSize: "10px",
                  color: MUTED,
                }}
              >
                {periodText} · {sorted.length} staff · {withFix} with GPS fix · Generated {generatedAt}
              </p>
            </div>
            <div style={{ textAlign: "right", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "9px", color: MUTED }}>
              Page {pageIndex + 1}/{pages.length}
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Staff</th>
                <th style={thStyle}>Station</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Location</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Map</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Acc.</th>
                <th style={thStyle}>Last fix</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: MUTED, padding: "12mm 4px" }}>
                    No staff with GPS data.
                  </td>
                </tr>
              ) : (
                pageRows.map((officer, idx) => {
                  const rowNum = pageIndex * ROWS_PER_PAGE + idx + 1
                  const hasFix =
                    typeof officer.latitude === "number" &&
                    typeof officer.longitude === "number" &&
                    !(officer.latitude === 0 && officer.longitude === 0)
                  const place = hasFix
                    ? resolveLocationName(officer.latitude!, officer.longitude!, locationNames)
                    : "—"
                  const mapUrl = hasFix
                    ? mapsLinkForCoords(officer.latitude!, officer.longitude!)
                    : ""
                  const rowBg = idx % 2 === 1 ? "#f8fafc" : "#fff"
                  return (
                    <tr key={officer.userId} style={{ background: rowBg }}>
                      <td style={tdStyle}>{rowNum}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>
                        {officer.name}
                        <div style={{ fontWeight: 400, color: MUTED, fontSize: "8px" }}>
                          {officer.employeeId || `CM-${String(officer.userId).padStart(4, "0")}`}
                        </div>
                      </td>
                      <td style={tdStyle}>{locationLabel(officer.location)}</td>
                      <td style={tdStyle}>
                        {officer.onDuty ? "On duty" : "Off duty"} · {officer.status}
                      </td>
                      <td style={{ ...tdStyle, maxWidth: "48mm" }}>
                        <div style={{ fontWeight: 600, lineHeight: 1.35 }}>{place}</div>
                        {hasFix ? (
                          <div style={{ marginTop: "1px", fontSize: "7.5px", color: MUTED }}>
                            {officer.latitude!.toFixed(5)}, {officer.longitude!.toFixed(5)}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {mapUrl ? (
                          <a
                            href={mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-block",
                              padding: "1.1mm 2mm",
                              borderRadius: "2px",
                              background: "#eff6ff",
                              border: "1px solid #bfdbfe",
                              color: "#1d4ed8",
                              fontSize: "8px",
                              fontWeight: 700,
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            View map
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {officer.accuracy != null ? `${Math.round(officer.accuracy)} m` : "—"}
                      </td>
                      <td style={tdStyle}>{officer.recordedAt ? timeAgo(officer.recordedAt) : "—"}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          {pageIndex === pages.length - 1 ? (
            <div
              style={{
                marginTop: "auto",
                paddingTop: "5mm",
                borderTop: `1px solid ${LINE}`,
                fontFamily: "Arial, Helvetica, sans-serif",
                fontSize: "9px",
                color: MUTED,
              }}
            >
              Report date {formatReportDate(anchorDate)}. Live GPS snapshot for all listed staff.
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
