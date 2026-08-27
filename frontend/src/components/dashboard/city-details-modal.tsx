import {
  Activity,
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  Database,
  Layers,
  List,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import type { ComponentProps } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

type CameraTypeDetail = {
  name: string
  count: number
  description: string
}

export type CityDetails = {
  city: string
  status: "Online" | "Critical" | "Attention"
  visitors: number
  vehicles: number
  cases: number
  alerts: number
  cameraCount: number
  activeCameras: number
  offlineCameras: number
  coverageZones: number
  storageUsed: string
  uptime: string
  lastUpdate: string
  cameraTypes: CameraTypeDetail[]
  /** 30 values: "on" | "warn" | "off" */
  uptimeHistory?: Array<"on" | "warn" | "off">
}

type CityDetailsModalProps = {
  open: boolean
  onOpenChange: ComponentProps<typeof Dialog>["onOpenChange"]
  details: CityDetails | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<CityDetails["status"], string> = {
  Online:    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Critical:  "bg-red-50    text-red-700     border border-red-200",
  Attention: "bg-amber-50  text-amber-700   border border-amber-200",
}

const UPTIME_SEG: Record<"on" | "warn" | "off", string> = {
  on:   "bg-emerald-400",
  warn: "bg-amber-400",
  off:  "bg-slate-300",
}

const fmt = (n: number) => n.toLocaleString()

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-slate-400">
        {icon}
        {label}
      </p>
      <p className="font-mono text-[22px] font-medium leading-none tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] text-slate-400">{sub}</p>
    </div>
  )
}

function SysRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-b-0 last:pb-0 first:pt-0">
      <span className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon}
        {label}
      </span>
      <span className="font-mono text-xs font-medium text-slate-900">{value}</span>
    </div>
  )
}

function UptimeBar({ history }: { history: Array<"on" | "warn" | "off"> }) {
  return (
    <div
      className="mt-3.5 flex gap-0.5"
      role="img"
      aria-label="Uptime history — last 30 days"
    >
      {history.map((seg, i) => (
        <div
          key={i}
          className={`h-[3px] flex-1 rounded-full ${UPTIME_SEG[seg]}`}
        />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const DEFAULT_UPTIME: Array<"on" | "warn" | "off"> = [
  "on","on","on","on","on","on","on","warn","on","on",
  "on","on","on","on","on","on","on","on","on","on",
  "on","on","on","on","on","on","on","on","on","on",
]

export function CityDetailsModal({ open, onOpenChange, details }: CityDetailsModalProps) {
  if (!details) return null

  const history = details.uptimeHistory ?? DEFAULT_UPTIME

  const opsStats = [
    { label: "Visitors",    value: fmt(details.visitors) },
    { label: "Vehicles",    value: fmt(details.vehicles) },
    { label: "Goods cases", value: fmt(details.cases)    },
    { label: "Alerts",      value: fmt(details.alerts)   },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[min(98vw,680px)] max-w-[680px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl shadow-slate-900/10"
        /* hide the default shadcn close button — we render our own in the footer */
        showCloseButton={false}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-7 py-6">
          <div className="flex items-start gap-3.5">
            <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl border border-slate-100 bg-slate-50 text-slate-500">
              <Building2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="font-[Sora,sans-serif] text-[17px] font-semibold leading-snug tracking-tight text-slate-900">
                {details.city}
              </h2>
              <p className="mt-0.5 text-[12px] text-slate-400">
                Site status, camera health &amp; incident summary
              </p>
            </div>
          </div>

          <span
            className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium ${STATUS_STYLES[details.status]}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
            {details.status}
          </span>
        </header>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5 px-7 py-6">

          {/* Metric cards */}
          <div className="grid grid-cols-4 gap-2.5">
            <MetricCard
              icon={<Camera className="h-3 w-3" />}
              label="Total"
              value={String(details.cameraCount)}
              sub="cameras"
            />
            <MetricCard
              icon={<CheckCircle2 className="h-3 w-3" />}
              label="Active"
              value={String(details.activeCameras)}
              sub="online"
            />
            <MetricCard
              icon={<AlertTriangle className="h-3 w-3" />}
              label="Offline"
              value={String(details.offlineCameras)}
              sub="cameras"
            />
            <MetricCard
              icon={<Layers className="h-3 w-3" />}
              label="Zones"
              value={String(details.coverageZones)}
              sub="coverage"
            />
          </div>

          {/* Two-column panel row */}
          <div className="grid grid-cols-2 gap-4">

            {/* Camera type breakdown */}
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="mb-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-slate-400">
                <List className="h-3 w-3" />
                Camera type breakdown
              </p>
              <div>
                {details.cameraTypes.map((type) => (
                  <div
                    key={type.name}
                    className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-b-0 last:pb-0 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-slate-800">{type.name}</p>
                      <p className="text-[11px] text-slate-400">{type.description}</p>
                    </div>
                    <span className="flex-shrink-0 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 font-mono text-[13px] font-medium text-slate-800">
                      {type.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* System & site health */}
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="mb-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-slate-400">
                <ShieldCheck className="h-3 w-3" />
                System &amp; site health
              </p>
              <div>
                <SysRow
                  icon={<Camera className="h-3 w-3" />}
                  label="Cameras online"
                  value={`${details.activeCameras}/${details.cameraCount}`}
                />
                <SysRow
                  icon={<Database className="h-3 w-3" />}
                  label="Storage used"
                  value={details.storageUsed}
                />
                <SysRow
                  icon={<Activity className="h-3 w-3" />}
                  label="Site uptime"
                  value={details.uptime}
                />
                <SysRow
                  icon={<Clock className="h-3 w-3" />}
                  label="Last update"
                  value={details.lastUpdate}
                />
              </div>
              <UptimeBar history={history} />
            </div>
          </div>

          {/* Operational snapshot bar */}
          <div className="grid grid-cols-4 divide-x divide-slate-100 rounded-xl border border-slate-100 bg-slate-50">
            {opsStats.map(({ label, value }) => (
              <div key={label} className="px-4 py-4 text-center">
                <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.1em] text-slate-400">
                  {label}
                </p>
                <p className="font-mono text-[18px] font-medium leading-none tracking-tight text-slate-900">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <footer className="flex items-center justify-between border-t border-slate-100 px-7 py-4">
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <RefreshCw className="h-3 w-3" />
            Updated {details.lastUpdate} · Auto-refresh on
          </p>
          <button
            onClick={() => onOpenChange?.(false)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            <X className="h-3.5 w-3.5" />
            Close
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}