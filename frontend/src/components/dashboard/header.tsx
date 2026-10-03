import { memo, useCallback, useEffect, useState, startTransition } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Search, Bell, HelpCircle, User, LogOut, Menu, Wifi, WifiOff, Flame, CloudFog, Crosshair, Users, ShieldAlert, FileCheck2, Camera, MapPin, Clock3 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { clearAuth, getStoredUser, isAuthenticated, AUTH_USER_UPDATED_EVENT } from "@/lib/auth"
import { stopOfficerGpsTracking } from "@/lib/officer-gps-session"
import { queryClient } from "@/lib/query-client"
import { clearLegacyVmsLocalStorage } from "@/lib/vms-list-api"
import { getRoleDisplayLabel, normalizeRole } from "@/lib/role-access"
import { isGlobalAdmin } from "@/lib/location-access"
import { locationLabel } from "@/lib/locations"
import {
  canSeeAllCitiesCameras,
  canViewAllCitiesCameras,
  getCamerasWallLabel,
  setAllCitiesCamerasPreference,
} from "@/lib/all-cities-cameras"
import { listRemoteServers, type RemoteServerRecord } from "@/lib/ops-central-api"
import {
  ROUTES,
  getSeizureMgmtAssessmentDetailPath,
  getSeizureMgmtNoteSheetDetailPath,
  getSeizureMgmtRecoveryMemoDetailPath,
} from "@/routes/config"
import {
  fetchNoteSheetNotifications,
  markAllNoteSheetNotificationsRead,
  markNoteSheetNotificationRead,
  type NoteSheetNotificationItem,
} from "@/lib/seizure-management-api"
import { fetchDetectionEventsPage, type DetectionEvent } from "@/lib/cameras-api"
import { cn } from "@/lib/utils"
import { REALTIME_INVALIDATE_EVENT } from "@/lib/realtime-socket"
import { resolveMediaUrl } from "@/lib/cameras-api"

interface HeaderProps {
  onMenuClick?: () => void
}

const AI_ALERT_SEEN_KEY = "tekeye.header.ai-alert-seen.v1"

type HeaderNotification =
  | {
      kind: "approval"
      id: string
      title: string
      message: string
      isRead: boolean
      createdAt: string
      source: NoteSheetNotificationItem
    }
  | {
      kind: "ai_alert"
      id: string
      title: string
      message: string
      isRead: boolean
      createdAt: string
      detectionId: number
      className: string
      alertName: string
      cameraName: string
      zone: string
    }

function readSeenAiAlertIds(): Set<string> {
  try {
    const raw = localStorage.getItem(AI_ALERT_SEEN_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch {
    return new Set()
  }
}

function writeSeenAiAlertIds(ids: Set<string>) {
  try {
    localStorage.setItem(AI_ALERT_SEEN_KEY, JSON.stringify([...ids].slice(-200)))
  } catch {
    /* ignore */
  }
}

function approvalTitle(n: NoteSheetNotificationItem): string {
  const type = (n.type || n.hrefKind || "").toLowerCase()
  if (type.includes("assessment") || n.hrefKind === "assessment") {
    return "Assessment needs approval"
  }
  if (type.includes("recovery") || n.hrefKind === "recovery") {
    return "Recovery memo needs approval"
  }
  return "Note sheet needs approval"
}

function alertNameForClass(className: string): string {
  const cls = (className || "").toLowerCase()
  if (cls === "crowd") return "Crowd Alert"
  if (cls === "fire" || cls.includes("flame") || cls.includes("burning")) return "Fire Alert"
  if (cls === "smoke") return "Smoke Alert"
  if (
    cls === "weapon" ||
    cls.includes("weapon") ||
    cls === "gun" ||
    cls === "pistol" ||
    cls === "rifle" ||
    cls === "firearm" ||
    cls === "knife" ||
    cls === "knife_weapon"
  ) {
    return "Weapon Alert"
  }
  const pretty = (className || "").trim().replace(/[_-]+/g, " ")
  if (!pretty) return "Security Alert"
  return `${pretty.replace(/\b\w/g, (c) => c.toUpperCase())} Alert`
}

function alertSummaryForClass(className: string): string {
  const cls = (className || "").toLowerCase()
  if (cls === "crowd") return "Unusual crowd activity detected"
  if (cls === "fire" || cls.includes("flame") || cls.includes("burning")) {
    return "Possible fire detected on camera"
  }
  if (cls === "smoke") return "Smoke detected on camera"
  if (
    cls === "weapon" ||
    cls.includes("weapon") ||
    cls === "gun" ||
    cls === "pistol" ||
    cls === "rifle" ||
    cls === "firearm" ||
    cls === "knife" ||
    cls === "knife_weapon"
  ) {
    return "Possible weapon detected on camera"
  }
  return "AI security event detected"
}

function alertTone(className: string): {
  Icon: typeof Flame
  iconWrap: string
  iconColor: string
  badge: string
  badgeText: string
  accent: string
} {
  const cls = (className || "").toLowerCase()
  if (cls === "crowd") {
    return {
      Icon: Users,
      iconWrap: "bg-amber-50 border-amber-200",
      iconColor: "text-amber-700",
      badge: "bg-amber-100 text-amber-800",
      badgeText: "Crowd",
      accent: "border-l-amber-500",
    }
  }
  if (cls === "fire" || cls.includes("flame") || cls.includes("burning")) {
    return {
      Icon: Flame,
      iconWrap: "bg-orange-50 border-orange-200",
      iconColor: "text-orange-600",
      badge: "bg-orange-100 text-orange-800",
      badgeText: "Fire",
      accent: "border-l-orange-500",
    }
  }
  if (cls === "smoke") {
    return {
      Icon: CloudFog,
      iconWrap: "bg-slate-100 border-slate-200",
      iconColor: "text-slate-600",
      badge: "bg-slate-200 text-slate-700",
      badgeText: "Smoke",
      accent: "border-l-slate-500",
    }
  }
  if (
    cls === "weapon" ||
    cls.includes("weapon") ||
    cls === "gun" ||
    cls === "pistol" ||
    cls === "rifle" ||
    cls === "firearm" ||
    cls === "knife" ||
    cls === "knife_weapon"
  ) {
    return {
      Icon: Crosshair,
      iconWrap: "bg-red-50 border-red-200",
      iconColor: "text-red-600",
      badge: "bg-red-100 text-red-700",
      badgeText: "Weapon",
      accent: "border-l-red-500",
    }
  }
  return {
    Icon: ShieldAlert,
    iconWrap: "bg-rose-50 border-rose-200",
    iconColor: "text-rose-600",
    badge: "bg-rose-100 text-rose-700",
    badgeText: "Alert",
    accent: "border-l-rose-500",
  }
}

function formatRelativeTime(iso: string): string {
  const ts = new Date(iso).getTime()
  if (!Number.isFinite(ts)) return ""
  const diffSec = Math.round((Date.now() - ts) / 1000)
  if (diffSec < 45) return "Just now"
  if (diffSec < 3600) {
    const m = Math.max(1, Math.floor(diffSec / 60))
    return `${m} min ago`
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600)
    return `${h} hr${h === 1 ? "" : "s"} ago`
  }
  const d = Math.floor(diffSec / 86400)
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Header AI alerts: clear alert name + camera + zone (header UI only). */
function detectionToHeaderNotification(
  row: DetectionEvent,
  seen: Set<string>
): HeaderNotification {
  const id = `ai-${row.id}`
  const cameraName =
    row.camera_name ||
    row.name ||
    row.camera_code ||
    "Camera"
  const zone = (row.zone || "").trim() || "—"
  const alertName = alertNameForClass(row.class_name)
  return {
    kind: "ai_alert",
    id,
    title: alertName,
    message: alertSummaryForClass(row.class_name),
    isRead: seen.has(id),
    createdAt: row.created_at,
    detectionId: row.id,
    className: row.class_name,
    alertName,
    cameraName,
    zone,
  }
}

export const Header = memo(function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(() => getStoredUser())
  useEffect(() => {
    const sync = () => setUser(getStoredUser())
    window.addEventListener(AUTH_USER_UPDATED_EVENT, sync)
    return () => window.removeEventListener(AUTH_USER_UPDATED_EVENT, sync)
  }, [])
  const role = normalizeRole(user?.role)
  const showAllCitiesToggle = canViewAllCitiesCameras(user?.role)
  const camerasWallLabel = getCamerasWallLabel(user?.role, user?.location)
  const showAllCityServerChips = canSeeAllCitiesCameras(user?.role, user?.location)
  const [searchInput, setSearchInput] = useState("")
  const [notifications, setNotifications] = useState<HeaderNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [connectedServers, setConnectedServers] = useState<RemoteServerRecord[]>([])

  const allCitiesCameras = location.pathname === ROUTES.ALL_CITIES_CAMERAS

  const navigateAfterPaint = useCallback(
    (to: string, options?: { replace?: boolean }) => {
      // Defer soft navigation one frame so Chrome DevTools web-vitals (VMxx reportAllChanges)
      // does not race MJPEG teardown during All Cities toggle.
      requestAnimationFrame(() => {
        startTransition(() => {
          navigate(to, options)
        })
      })
    },
    [navigate],
  )

  const handleAllCitiesCameras = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        setAllCitiesCamerasPreference(true)
        navigateAfterPaint(ROUTES.ALL_CITIES_CAMERAS)
        return
      }
      setAllCitiesCamerasPreference(false)
      if (location.pathname === ROUTES.ALL_CITIES_CAMERAS) {
        navigateAfterPaint(
          role === "IT_SUPERADMIN" ? ROUTES.OPS_CENTRAL : ROUTES.DASHBOARD,
          { replace: true },
        )
      }
    },
    [location.pathname, navigateAfterPaint, role],
  )

  useEffect(() => {
    if (!showAllCitiesToggle || !isAuthenticated()) {
      setConnectedServers([])
      return
    }
    let cancelled = false
    const load = () => {
      listRemoteServers()
        .then((rows) => {
          if (!cancelled) setConnectedServers(rows.filter((s) => s.is_active))
        })
        .catch(() => {
          if (!cancelled) setConnectedServers([])
        })
    }
    load()
    const onRealtime = (e: Event) => {
      const domains = (e as CustomEvent<{ domains?: string[] }>).detail?.domains || []
      if (domains.some((d) => ["ops", "cameras"].includes(d))) load()
    }
    window.addEventListener(REALTIME_INVALIDATE_EVENT, onRealtime)
    return () => {
      cancelled = true
      window.removeEventListener(REALTIME_INVALIDATE_EVENT, onRealtime)
    }
  }, [showAllCitiesToggle])

  useEffect(() => {
    if (location.pathname === ROUTES.ALL_CITIES_CAMERAS) {
      setAllCitiesCamerasPreference(true)
    }
  }, [location.pathname])

  const loadNotifications = useCallback(() => {
    if (!isAuthenticated()) return
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return

    const seenAi = readSeenAiAlertIds()

    Promise.all([
      fetchNoteSheetNotifications().catch(() => ({
        unreadCount: 0,
        results: [] as NoteSheetNotificationItem[],
      })),
      fetchDetectionEventsPage({ is_alert: true, page: 1, page_size: 40 }).catch(() => ({
        results: [] as DetectionEvent[],
      })),
    ]).then(([seizureData, alertPage]) => {
      const approvalItems: HeaderNotification[] = (seizureData.results || []).map((n) => ({
        kind: "approval" as const,
        id: `approval-${n.id}`,
        title: approvalTitle(n),
        message: n.message,
        isRead: Boolean(n.isRead),
        createdAt: n.createdAt,
        source: n,
      }))

      const aiItems: HeaderNotification[] = (alertPage.results || []).map((row) =>
        detectionToHeaderNotification(row, seenAi)
      )

      const merged = [...approvalItems, ...aiItems].sort((a, b) => {
        const rank = (n: HeaderNotification) => {
          if (!n.isRead && n.kind === "approval") return 0
          if (!n.isRead) return 1
          return 2
        }
        const r = rank(a) - rank(b)
        if (r !== 0) return r
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
      setNotifications(merged)
      setUnreadCount(merged.filter((n) => !n.isRead).length)
    })
  }, [])

  useEffect(() => {
    loadNotifications()
    const onRealtime = (e: Event) => {
      const domains = (e as CustomEvent<{ domains?: string[] }>).detail?.domains || []
      if (
        domains.some((d) =>
          ["notifications", "seizure", "vms", "alerts", "detections", "cameras"].includes(d)
        )
      ) {
        if (document.visibilityState === "visible") loadNotifications()
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadNotifications()
    }
    window.addEventListener(REALTIME_INVALIDATE_EVENT, onRealtime)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener(REALTIME_INVALIDATE_EVENT, onRealtime)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [loadNotifications])

  const handleLogout = async () => {
    await stopOfficerGpsTracking({ endDuty: true })
    clearAuth()
    queryClient.clear()
    clearLegacyVmsLocalStorage()
    navigate(ROUTES.LOGIN, { replace: true })
  }

  const openNotification = async (n: HeaderNotification) => {
    if (n.kind === "ai_alert") {
      const seen = readSeenAiAlertIds()
      seen.add(n.id)
      writeSeenAiAlertIds(seen)
      setNotifOpen(false)
      loadNotifications()
      navigate(`${ROUTES.OBJECT_DETECTION}?alert=1&q=${encodeURIComponent(n.className || "")}`)
      return
    }

    try {
      if (!n.source.isRead) await markNoteSheetNotificationRead(n.source.id)
    } catch {
      /* ignore */
    }
    setNotifOpen(false)
    loadNotifications()
    const src = n.source
    if (src.hrefKind === "recovery" || src.recoveryMemoId) {
      if (src.recoveryMemoId) navigate(getSeizureMgmtRecoveryMemoDetailPath(src.recoveryMemoId))
      return
    }
    if (src.hrefKind === "assessment" || src.assessmentId) {
      if (src.assessmentId) navigate(getSeizureMgmtAssessmentDetailPath(src.assessmentId))
      return
    }
    if (src.noteSheetId) {
      navigate(getSeizureMgmtNoteSheetDetailPath(src.noteSheetId))
    }
  }

  const markAllRead = async () => {
    try {
      await markAllNoteSheetNotificationsRead()
    } catch {
      /* ignore */
    }
    const seenAi = readSeenAiAlertIds()
    for (const n of notifications) {
      if (n.kind === "ai_alert") seenAi.add(n.id)
    }
    writeSeenAiAlertIds(seenAi)
    loadNotifications()
  }

  const displayName = user?.full_name?.trim() || user?.username?.trim() || "User"
  const roleLabel = getRoleDisplayLabel(user?.role)
  const locationName = user?.location
    ? locationLabel(user.location)
    : isGlobalAdmin(user?.role)
      ? "All Locations"
      : ""
  const roleLine = locationName ? `${roleLabel} · ${locationName}` : roleLabel
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  const profileImageRaw = (user?.profile_image || "").trim()
  const profileImageSrc = profileImageRaw ? resolveMediaUrl(profileImageRaw) : ""

  return (
    <header className="fixed left-0 right-0 top-0 z-30 flex min-h-14 min-w-0 shrink-0 flex-wrap items-center gap-x-1.5 gap-y-1.5 border-b border-gray-100 bg-white px-2 py-2 sm:min-h-16 sm:gap-x-2 sm:px-3 sm:py-2 md:left-[240px] md:gap-x-2 lg:left-[280px] lg:px-4 xl:left-[333px] xl:flex-nowrap xl:gap-x-4 xl:px-8 xl:py-0">
      {/* Left: menu + search */}
      <div className="flex min-w-0 flex-1 basis-[min(100%,12rem)] items-center gap-1.5 sm:gap-2 md:max-w-[10rem] lg:max-w-[14rem] xl:max-w-[452px]">
        <button
          type="button"
          className="inline-flex shrink-0 rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center rounded-[10px] border border-gray-200 bg-white py-1.5 pl-2 pr-2 sm:py-2 sm:pl-3 md:pl-3 xl:pl-4 xl:pr-3.5">
          <Search className="h-4 w-4 shrink-0 text-gray-400 sm:h-5 sm:w-5" />
          <input
            type="text"
            placeholder="Search..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search visitors, pass IDs"
            className="ml-1.5 min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-[#4A5565] outline-none placeholder:text-gray-400 sm:ml-2 sm:text-[15px] xl:placeholder:opacity-100"
          />
        </div>
      </div>

      {/* Center: All Cities toggle + ML chips */}
      {showAllCitiesToggle && (
        <div className="order-3 flex w-full min-w-0 flex-col items-center justify-center gap-1 px-0 sm:order-none sm:w-auto sm:max-w-none sm:shrink-0 md:order-none md:mx-auto md:w-auto xl:px-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Switch
              id="all-cities-cameras"
              checked={allCitiesCameras}
              onCheckedChange={handleAllCitiesCameras}
              aria-label={camerasWallLabel}
              className="h-6 w-11 shrink-0 xl:h-7 xl:w-12 [&_[data-slot=switch-thumb]]:size-5 xl:[&_[data-slot=switch-thumb]]:size-6 [&_[data-slot=switch-thumb]]:data-[state=checked]:translate-x-[1.2rem] xl:[&_[data-slot=switch-thumb]]:data-[state=checked]:translate-x-[1.35rem]"
            />
            <span
              role="button"
              tabIndex={0}
              onClick={() => handleAllCitiesCameras(!allCitiesCameras)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  handleAllCitiesCameras(!allCitiesCameras)
                }
              }}
              className="cursor-pointer select-none text-xs font-semibold text-[#101727] sm:text-sm xl:text-base"
              title={camerasWallLabel}
            >
              <span className="hidden whitespace-nowrap xl:inline">{camerasWallLabel}</span>
              <span className="inline whitespace-nowrap xl:hidden">Cameras</span>
            </span>
          </div>
          {showAllCityServerChips && connectedServers.length > 0 && (
            <div className="hidden max-w-full flex-wrap items-center justify-center gap-1 lg:flex">
              {connectedServers.slice(0, 6).map((s) => {
                const health = (s.last_health || "").toLowerCase()
                const healthy =
                  health === "ok" ||
                  health === "online" ||
                  health === "healthy" ||
                  health === "up"
                return (
                  <span
                    key={s.id}
                    title={s.ml_base_url || s.base_url || s.name}
                    className={cn(
                      "inline-flex max-w-[5.5rem] items-center gap-0.5 truncate rounded-full border px-1.5 py-0.5 text-[10px] font-medium xl:max-w-[7.5rem]",
                      healthy
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-amber-200 bg-amber-50 text-amber-900",
                    )}
                  >
                    {healthy ? (
                      <Wifi className="h-2.5 w-2.5 shrink-0" />
                    ) : (
                      <WifiOff className="h-2.5 w-2.5 shrink-0" />
                    )}
                    <span className="truncate">{s.name}</span>
                  </span>
                )
              })}
              {connectedServers.length > 6 && (
                <span className="text-[10px] text-muted-foreground">
                  +{connectedServers.length - 6}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Right: notifications, help, profile */}
      <div className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-0.5 sm:gap-1">
        <div className="flex shrink-0 items-center gap-0.5">
          <DropdownMenu
            open={notifOpen}
            onOpenChange={(open) => {
              setNotifOpen(open)
              if (open) loadNotifications()
            }}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 sm:p-2"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
                {unreadCount > 0 && (
                  <span
                    className="absolute right-1 top-1 h-2 w-2 min-w-[0.5rem] rounded-full bg-red-500 ring-2 ring-white sm:right-1.5 sm:top-1.5"
                    aria-hidden
                  />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[min(400px,calc(100vw-1.25rem))] max-h-[min(480px,75vh)] overflow-y-auto border-gray-200 p-0 shadow-lg"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
                <div className="min-w-0">
                  <DropdownMenuLabel className="p-0 text-sm font-semibold text-[#101727]">
                    Notifications
                  </DropdownMenuLabel>
                  <p className="mt-0.5 text-[11px] text-[#697282]">
                    {unreadCount > 0
                      ? `${unreadCount} unread · tap an item to open`
                      : "You're all caught up"}
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-[#2563eb] hover:bg-blue-50"
                    onClick={() => void markAllRead()}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell className="mx-auto mb-2 h-8 w-8 text-gray-300" aria-hidden />
                  <p className="text-sm font-medium text-[#101727]">No notifications yet</p>
                  <p className="mt-1 text-xs text-[#697282]">
                    Security alerts and approvals will appear here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((n) => {
                    if (n.kind === "ai_alert") {
                      const { Icon, iconWrap, iconColor, badge, badgeText, accent } = alertTone(
                        n.className,
                      )
                      return (
                        <DropdownMenuItem
                          key={n.id}
                          className={cn(
                            "cursor-pointer items-start gap-3 rounded-none border-l-4 px-4 py-3.5 focus:bg-gray-50",
                            accent,
                            !n.isRead ? "bg-[#fffbfb]" : "bg-white",
                          )}
                          onClick={() => void openNotification(n)}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                              iconWrap,
                            )}
                            aria-hidden
                          >
                            <Icon className={cn("h-[18px] w-[18px]", iconColor)} />
                          </span>
                          <span className="min-w-0 flex-1 space-y-1.5">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={cn(
                                  "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                  badge,
                                )}
                              >
                                {badgeText}
                              </span>
                              {!n.isRead && (
                                <span className="inline-flex rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                  New
                                </span>
                              )}
                            </span>
                            <span className="block text-[13px] font-semibold leading-snug text-[#101727]">
                              {n.alertName}
                            </span>
                            <span className="block text-xs leading-snug text-[#4b5563]">
                              {n.message}
                            </span>
                            <span className="grid gap-1 pt-0.5 text-[11px] text-[#697282]">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <Camera className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                                <span className="shrink-0 font-medium text-[#4b5563]">Camera:</span>
                                <span className="truncate">{n.cameraName}</span>
                              </span>
                              <span className="flex min-w-0 items-center gap-1.5">
                                <MapPin className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                                <span className="shrink-0 font-medium text-[#4b5563]">Zone:</span>
                                <span className="truncate">{n.zone}</span>
                              </span>
                              {n.createdAt && (
                                <span className="flex items-center gap-1.5">
                                  <Clock3 className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                                  <span className="font-medium text-[#4b5563]">Time:</span>
                                  <span>{formatRelativeTime(n.createdAt)}</span>
                                </span>
                              )}
                            </span>
                          </span>
                        </DropdownMenuItem>
                      )
                    }

                    return (
                      <DropdownMenuItem
                        key={n.id}
                        className={cn(
                          "cursor-pointer items-start gap-3 rounded-none border-l-4 border-l-blue-500 px-4 py-3.5 focus:bg-gray-50",
                          !n.isRead ? "bg-[#f8fbff]" : "bg-white",
                        )}
                        onClick={() => void openNotification(n)}
                      >
                        <span
                          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50"
                          aria-hidden
                        >
                          <FileCheck2 className="h-[18px] w-[18px] text-blue-600" />
                        </span>
                        <span className="min-w-0 flex-1 space-y-1.5">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800">
                              Approval
                            </span>
                            {!n.isRead && (
                              <span className="inline-flex rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                New
                              </span>
                            )}
                          </span>
                          <span className="block text-[13px] font-semibold leading-snug text-[#101727]">
                            {n.title}
                          </span>
                          {n.message ? (
                            <span className="block line-clamp-2 text-xs leading-snug text-[#4b5563]">
                              {n.message}
                            </span>
                          ) : null}
                          {n.createdAt && (
                            <span className="flex items-center gap-1.5 pt-0.5 text-[11px] text-[#697282]">
                              <Clock3 className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                              <span className="font-medium text-[#4b5563]">Time:</span>
                              <span>{formatRelativeTime(n.createdAt)}</span>
                            </span>
                          )}
                        </span>
                      </DropdownMenuItem>
                    )
                  })}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            className="hidden rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 xl:inline-flex"
            aria-label="Help"
          >
            <HelpCircle className="h-6 w-6" />
          </button>
        </div>

        <div className="mx-0.5 h-6 w-px shrink-0 bg-gray-200 sm:mx-1.5 sm:h-8 xl:mx-2" aria-hidden />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex shrink-0 items-center gap-2 rounded-lg py-1 pl-0.5 text-left transition-colors hover:bg-gray-50 sm:pl-1 xl:gap-3 xl:pl-2 xl:py-1.5"
            >
              <div className="hidden min-w-0 flex-col items-start xl:flex">
                <span className="max-w-[12rem] truncate text-sm font-semibold text-[#101727]">
                  {displayName}
                </span>
                <span className="max-w-[14rem] truncate text-xs text-[#697282]" title={roleLine}>
                  {roleLine}
                </span>
              </div>
              <Avatar className="h-8 w-8 shrink-0 rounded-full border-2 border-gray-100 bg-gray-100 sm:h-9 sm:w-9 xl:h-10 xl:w-10">
                {profileImageSrc ? (
                  <AvatarImage src={profileImageSrc} alt={displayName} className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-gray-100 text-sm text-[#6B7280]">
                  {initials || <User className="h-5 w-5" />}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5 xl:hidden">
              <p className="truncate text-sm font-semibold text-[#101727]">{displayName}</p>
              <p className="truncate text-xs text-[#697282]">{roleLine}</p>
            </div>
            <DropdownMenuSeparator className="xl:hidden" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
})
