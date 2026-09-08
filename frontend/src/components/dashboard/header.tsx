import { memo, useCallback, useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Search, Bell, HelpCircle, User, LogOut, Menu, Wifi, WifiOff } from "lucide-react"
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
import { cn } from "@/lib/utils"

interface HeaderProps {
  onMenuClick?: () => void
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
  const [notifications, setNotifications] = useState<NoteSheetNotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [connectedServers, setConnectedServers] = useState<RemoteServerRecord[]>([])

  const allCitiesCameras = location.pathname === ROUTES.ALL_CITIES_CAMERAS

  const handleAllCitiesCameras = useCallback(
    (enabled: boolean) => {
      setAllCitiesCamerasPreference(enabled)
      if (enabled) {
        navigate(ROUTES.ALL_CITIES_CAMERAS)
      } else if (location.pathname === ROUTES.ALL_CITIES_CAMERAS) {
        navigate(role === "IT_SUPERADMIN" ? ROUTES.OPS_CENTRAL : ROUTES.DASHBOARD)
      }
    },
    [navigate, location.pathname, role],
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
    const id = window.setInterval(load, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
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
    fetchNoteSheetNotifications()
      .then((data) => {
        setNotifications(data.results || [])
        setUnreadCount(data.unreadCount || 0)
      })
      .catch(() => {
        setNotifications([])
        setUnreadCount(0)
      })
  }, [])

  useEffect(() => {
    loadNotifications()
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") loadNotifications()
    }, 60_000)
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadNotifications()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.clearInterval(id)
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

  const openNotification = async (n: NoteSheetNotificationItem) => {
    try {
      if (!n.isRead) await markNoteSheetNotificationRead(n.id)
    } catch {
      /* ignore */
    }
    setNotifOpen(false)
    loadNotifications()
    if (n.hrefKind === "recovery" || n.recoveryMemoId) {
      if (n.recoveryMemoId) navigate(getSeizureMgmtRecoveryMemoDetailPath(n.recoveryMemoId))
      return
    }
    if (n.hrefKind === "assessment" || n.assessmentId) {
      if (n.assessmentId) navigate(getSeizureMgmtAssessmentDetailPath(n.assessmentId))
      return
    }
    if (n.noteSheetId) {
      navigate(getSeizureMgmtNoteSheetDetailPath(n.noteSheetId))
    }
  }

  const markAllRead = async () => {
    try {
      await markAllNoteSheetNotificationsRead()
      loadNotifications()
    } catch {
      /* ignore */
    }
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

  return (
    <header className="fixed left-0 right-0 top-0 z-20 grid h-16 min-w-0 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-gray-100 bg-white px-2 sm:px-4 md:left-[333px] lg:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className="inline-flex rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center rounded-[10px] border border-gray-200 bg-white py-2 pl-2 pr-2 sm:pl-4 sm:pr-3.5 md:max-w-[452px]">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search visitors, pass IDs..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="text-[#4A5565] bg-transparent text-[15px] flex-1 min-w-0 py-1 border-0 outline-none placeholder:text-gray-400 ml-2"
          />
        </div>
      </div>

      <div className="flex max-w-[min(100%,28rem)] shrink-0 flex-col items-center justify-center gap-1 px-1 sm:px-2">
        {showAllCitiesToggle && (
          <>
            <div className="flex items-center gap-2.5">
              <Switch
                id="all-cities-cameras"
                checked={allCitiesCameras}
                onCheckedChange={handleAllCitiesCameras}
                aria-label={camerasWallLabel}
                className="h-7 w-12 shrink-0 [&_[data-slot=switch-thumb]]:size-6 [&_[data-slot=switch-thumb]]:data-[state=checked]:translate-x-[1.35rem]"
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
                className="cursor-pointer select-none whitespace-nowrap text-sm font-semibold text-[#101727] sm:text-base"
              >
                {camerasWallLabel}
              </span>
            </div>
            {showAllCityServerChips && connectedServers.length > 0 && (
              <div className="flex max-w-full flex-wrap items-center justify-center gap-1">
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
                        "inline-flex max-w-[7.5rem] items-center gap-0.5 truncate rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
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
          </>
        )}
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-2">
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
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
                className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span
                    className="absolute top-1.5 right-1.5 min-w-[0.5rem] h-2 w-2 bg-red-500 rounded-full ring-2 ring-white"
                    aria-hidden
                  />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[360px] max-h-[420px] overflow-y-auto p-0">
              <div className="flex items-center justify-between px-3 py-2">
                <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => void markAllRead()}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <p className="px-3 py-6 text-sm text-muted-foreground text-center">
                  No approval notifications
                </p>
              ) : (
                notifications.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className={`flex flex-col items-start gap-0.5 px-3 py-2.5 cursor-pointer ${
                      n.isRead ? "" : "bg-primary/5"
                    }`}
                    onClick={() => void openNotification(n)}
                  >
                    <span className="text-sm font-medium text-foreground line-clamp-1">{n.title}</span>
                    <span className="text-xs text-muted-foreground line-clamp-2">{n.message}</span>
                    {n.createdAt && (
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Help"
          >
            <HelpCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="mx-1 h-8 w-px shrink-0 bg-gray-200 sm:mx-2" aria-hidden />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex shrink-0 items-center gap-2 rounded-lg py-1.5 pl-1 text-left transition-colors hover:bg-gray-50 sm:gap-3 sm:pl-2"
            >
              <div className="hidden flex-col items-start sm:flex">
                <span className="text-[#101727] text-sm font-semibold">{displayName}</span>
                <span className="text-[#697282] text-xs">{roleLine}</span>
              </div>
              <Avatar className="h-10 w-10 rounded-full border-2 border-gray-100 shrink-0">
                <AvatarImage
                  src="https://randomuser.me/api/portraits/women/44.jpg"
                  alt={displayName}
                />
                <AvatarFallback className="bg-gray-200 text-[#6B7280] text-sm">
                  {initials || <User className="w-5 h-5" />}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive cursor-pointer"
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
