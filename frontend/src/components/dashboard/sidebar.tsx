import { memo, useEffect, useState, useCallback, useMemo } from "react"
import { useLocation, useNavigate, Link, NavLink } from "react-router-dom"
import { ChevronDown, ChevronRight, Star, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { AUTH_USER_UPDATED_EVENT, getStoredUser } from "@/lib/auth"
import { getNavSectionsForRole, getAncestorMenusForPath, type NavGroup } from "@/routes/config"
import { prefetchRoute } from "@/routes/prefetch"
import { getNodeKey, hasActiveDescendant, isNavGroup, type SidebarNode } from "@/components/dashboard/sidebar.helpers"
import { renderMenuIcon } from "@/components/dashboard/sidebar.icons"

function onPrefetchHref(href: string) {
  prefetchRoute(href)
}

const FAVORITES_KEY = "tekeye-sidebar-favorites"

export type FavoriteItem = { href: string; label: string }

function loadFavorites(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is FavoriteItem => x && typeof x.href === "string" && typeof x.label === "string")
  } catch {
    return []
  }
}

function saveFavorites(items: FavoriteItem[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(items))
}

type SidebarChildrenProps = {
  nodes: SidebarNode[]
  pathname: string
  expandedItems: string[]
  onToggle: (label: string) => void
  childLinkClass: (href: string) => string
  depth: number
  isFavorite: (href: string) => boolean
  onToggleFavorite: (href: string, label: string) => void
}

function SidebarChildren({
  nodes,
  pathname,
  expandedItems,
  onToggle,
  childLinkClass,
  depth,
  isFavorite,
  onToggleFavorite,
}: SidebarChildrenProps) {
  return (
    <>
      {nodes.map((node) => {
        if (!isNavGroup(node)) {
          const fav = isFavorite(node.href)
          return (
            <div
              key={getNodeKey(node)}
              className={cn(
                "group/link flex items-center gap-1 rounded-none",
                pathname === node.href && "bg-[#EBF2FF]",
                "hover:bg-[#F3F7FF]"
              )}
            >
              <Link
                to={node.href}
                onMouseEnter={() => onPrefetchHref(node.href)}
                onFocus={() => onPrefetchHref(node.href)}
                className={cn("flex-1 min-w-0 flex items-center rounded-none", childLinkClass(node.href), depth > 1 && "pl-2")}
              >
                <span className="truncate">{node.label}</span>
              </Link>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onToggleFavorite(node.href, node.label)
                }}
                className={cn(
                  "shrink-0 p-1 rounded opacity-0 group-hover/link:opacity-100 focus:opacity-100 transition-opacity",
                  fav ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"
                )}
                aria-label={fav ? "Remove from favorites" : "Add to favorites"}
                title={fav ? "Remove from favorites" : "Add to favorites"}
              >
                <Star size={12} className={fav ? "fill-current" : undefined} />
              </button>
            </div>
          )
        }

        const label = node.label
        const isExpanded = expandedItems.includes(label)
        const isActive = hasActiveDescendant(node, pathname)

        return (
          <div key={getNodeKey(node)}>
            <div className={cn(isActive && "bg-[#F3F7FF] rounded-none")}>
              <button
                type="button"
                onClick={() => onToggle(label)}
                aria-expanded={isExpanded}
                className={cn(
                  "w-full flex items-center justify-between px-2 py-1.5 rounded-none transition-all duration-200 border border-transparent border-l-0",
                  isActive
                    ? "sidebar-nested-module-selected"
                    : "text-[14px] text-muted-foreground hover:text-[#155DFC] hover:bg-[#F5F8FF]"
                )}
              >
                <span className="flex items-center whitespace-nowrap text-left pl-1">{label}</span>
                {isExpanded ? <ChevronDown size={16} aria-hidden className={isActive ? "text-[#155DFC]" : undefined} /> : <ChevronRight size={16} aria-hidden className={isActive ? "text-[#155DFC]" : undefined} />}
              </button>
            </div>
            {isExpanded && (
              <div className="ml-5 mt-0.5 space-y-0.5 border-l-2 border-[#C1D9F8] pl-2 overflow-visible">
                <SidebarChildren
                  nodes={node.children}
                  pathname={pathname}
                  expandedItems={expandedItems}
                  onToggle={onToggle}
                  childLinkClass={childLinkClass}
                  depth={depth + 1}
                  isFavorite={isFavorite}
                  onToggleFavorite={onToggleFavorite}
                />
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

interface SidebarProps {
  mobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
}

export const Sidebar = memo(function Sidebar({ mobileOpen = false, onMobileOpenChange }: SidebarProps) {
  const pathname = useLocation().pathname
  const navigate = useNavigate()
  const [authTick, setAuthTick] = useState(0)
  useEffect(() => {
    const onUserUpdated = () => setAuthTick((n) => n + 1)
    window.addEventListener(AUTH_USER_UPDATED_EVENT, onUserUpdated)
    return () => window.removeEventListener(AUTH_USER_UPDATED_EVENT, onUserUpdated)
  }, [])

  const storedUser = getStoredUser()
  const role = storedUser?.role
  const modulesKey = (storedUser?.allowed_modules ?? []).join("\0")
  const navSections = useMemo(
    () => getNavSectionsForRole(role, storedUser?.allowed_modules),
    [role, modulesKey, authTick]
  )
  const [expandedItems, setExpandedItems] = useState<string[]>(() =>
    getAncestorMenusForPath(pathname, getNavSectionsForRole(role, storedUser?.allowed_modules))
  )
  const [favorites, setFavorites] = useState<FavoriteItem[]>(loadFavorites)

  useEffect(() => {
    const ancestors = getAncestorMenusForPath(pathname, navSections)
    setExpandedItems((prev) => {
      const missing = ancestors.filter((label) => !prev.includes(label))
      return missing.length === 0 ? prev : [...prev, ...missing]
    })
  }, [pathname, navSections])

  useEffect(() => {
    onMobileOpenChange?.(false)
  }, [pathname, onMobileOpenChange])

  useEffect(() => {
    saveFavorites(favorites)
  }, [favorites])

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    )
  }

  const isExpanded = (label: string) => expandedItems.includes(label)

  const isFavorite = useCallback((href: string) => favorites.some((f) => f.href === href), [favorites])
  const onToggleFavorite = useCallback((href: string, label: string) => {
    setFavorites((prev) => {
      const has = prev.some((f) => f.href === href)
      if (has) return prev.filter((f) => f.href !== href)
      return [...prev, { href, label }]
    })
  }, [])

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 border border-transparent bg-transparent",
      isActive ? "text-[#2860C8] font-medium" : "text-[#4B5563] hover:text-[#2860C8]"
    )

  const childLinkClass = (href: string) =>
    cn(
      "flex items-center px-3 py-1.5 text-[14px] rounded-none transition-all duration-200 border border-transparent border-l-0",
      pathname === href
        ? "sidebar-submenu-active"
        : "text-[#4B5563] hover:text-[#155DFC] bg-transparent"
    )

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/40 transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => onMobileOpenChange?.(false)}
        aria-hidden
      />
      <aside
        className={cn(
          "sidebar-font fixed inset-y-0 left-0 z-40 h-screen w-[280px] border-r border-[#E5E7EB] bg-[#FFFFFF] flex flex-col shrink-0 pt-[15px] pr-[3px] pl-[15px] transition-transform md:z-30 md:w-[333px] md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:flex"
        )}
      >
      <div className="pb-4 border-b border-[#E5E7EB] shrink-0">
        <div className="flex items-center gap-2">
          <img
            src="/pakistan-customs-logo.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 object-contain"
            decoding="async"
          />
          <span className="sidebar-app-name">TekEye</span>
          <button
            type="button"
            className="ml-auto inline-flex rounded-md p-1 text-muted-foreground hover:bg-muted md:hidden"
            onClick={() => onMobileOpenChange?.(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto py-3 px-1" aria-label="Main">
        {favorites.length > 0 && (
          <div className="mb-3">
            <div className="sidebar-section-heading px-3 py-2">
              Favorites
            </div>
            <div className="space-y-1">
              {favorites.map((fav) => {
                const active = pathname === fav.href
                return (
                  <div
                    key={fav.href}
                    className={cn(
                      "group/link flex items-center gap-1 rounded-xl transition-all",
                      active && "sidebar-active-gradient",
                      "hover:bg-[#D2DCF5]/80"
                    )}
                  >
                    <Link
                      to={fav.href}
                      onMouseEnter={() => onPrefetchHref(fav.href)}
                      onFocus={() => onPrefetchHref(fav.href)}
                      className={cn(
                        "flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm border-0 transition-all bg-transparent",
                        active ? "text-[#2860C8] font-medium" : "text-[#4B5563] hover:text-[#2860C8]"
                      )}
                    >
                      <span className="w-6 shrink-0 flex items-center justify-start" aria-hidden>
                        {renderMenuIcon(fav.label, 18, "shrink-0")}
                      </span>
                      <span className="truncate whitespace-nowrap">{fav.label}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        onToggleFavorite(fav.href, fav.label)
                      }}
                      className="shrink-0 p-1 rounded text-amber-500 opacity-0 group-hover/link:opacity-100 focus:opacity-100 hover:bg-amber-500/10"
                      aria-label="Remove from favorites"
                      title="Remove from favorites"
                    >
                      <Star size={14} className="fill-current" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {navSections.map((section) => (
          <div key={section.title} className="mb-3">
            {section.title && (
              <div className="sidebar-section-heading px-3 py-2">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              if (!isNavGroup(item)) {
                const fav = isFavorite(item.href)
                const isLinkActive = pathname === item.href
                return (
                  <div
                    key={getNodeKey(item)}
                    className={cn(
                      "group/link flex items-center gap-1 rounded-xl transition-all",
                      isLinkActive && "sidebar-active-gradient",
                      "hover:bg-[#D2DCF5]/80"
                    )}
                  >
                    <NavLink
                      to={item.href}
                      onMouseEnter={() => onPrefetchHref(item.href)}
                      onFocus={() => onPrefetchHref(item.href)}
                      className={({ isActive }) => cn("flex-1 min-w-0 flex items-center gap-3 border-0", linkClass({ isActive }))}
                      end={item.href === "/"}
                    >
                      <span className="w-6 shrink-0 flex items-center justify-start" aria-hidden>
                        {renderMenuIcon(item.label, 18, "shrink-0")}
                      </span>
                      <span className="whitespace-nowrap truncate">{item.label}</span>
                    </NavLink>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onToggleFavorite(item.href, item.label)
                      }}
                      className={cn(
                        "shrink-0 p-1 rounded opacity-0 group-hover/link:opacity-100 focus:opacity-100 transition-opacity",
                        fav ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"
                      )}
                      aria-label={fav ? "Remove from favorites" : "Add to favorites"}
                      title={fav ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Star size={14} className={fav ? "fill-current" : undefined} />
                    </button>
                  </div>
                )
              }

              const group = item as NavGroup
              const label = group.label
              const isActive = hasActiveDescendant(group, pathname)

              return (
                <div key={getNodeKey(group)}>
                  <button
                    type="button"
                    onMouseEnter={() => {
                      if (group.overviewHref) onPrefetchHref(group.overviewHref)
                    }}
                    onClick={() => {
                      if (group.overviewHref) navigate(group.overviewHref)
                      toggleExpand(label)
                    }}
                    aria-expanded={isExpanded(label)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200",
                      isActive
                        ? "sidebar-active-gradient sidebar-main-module-selected"
                        : "text-sm text-[#4B5563] hover:text-[#2860C8] hover:bg-[#D2DCF5]/80"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 shrink-0 flex items-center justify-start" aria-hidden>
                        {renderMenuIcon(label, 16, isActive ? "shrink-0 text-[#155DFC]" : "shrink-0 text-[#6B7280]")}
                      </span>
                      <span className="whitespace-nowrap text-left">{label}</span>
                    </div>
                    {isExpanded(label) ? (
                      <ChevronDown size={16} aria-hidden className={isActive ? "text-[#155DFC]" : "text-[#6B7280]"} />
                    ) : (
                      <ChevronRight size={16} aria-hidden className={isActive ? "text-[#155DFC]" : "text-[#6B7280]"} />
                    )}
                  </button>
                  {isExpanded(label) && (
                    <div className="ml-6 mt-1.5 space-y-1 border-l-2 border-[#C1D9F8] pl-2 overflow-visible">
                      <SidebarChildren
                        nodes={group.children}
                        pathname={pathname}
                        expandedItems={expandedItems}
                        onToggle={toggleExpand}
                        childLinkClass={childLinkClass}
                        depth={1}
                        isFavorite={isFavorite}
                        onToggleFavorite={onToggleFavorite}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-[#E5E7EB] shrink-0">
        <p className="text-sm leading-4 text-[#6B7280] font-normal">
          © 2026 v1.0 Powered by <span className="underline">TekEye.</span>
        </p>
      </div>
    </aside>
    </>
  )
})