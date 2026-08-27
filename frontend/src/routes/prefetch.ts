/**
 * Prefetch lazy route chunks (e.g. on sidebar hover) so navigation skips Suspense wait.
 */
import { DASHBOARD_ROUTES } from "@/routes/route-list"
import { PAGE_LOADERS } from "@/routes/lazy-pages"

type PageKey = keyof typeof PAGE_LOADERS

const prefetchCache = new Map<string, Promise<unknown>>()

/** Exact path (with leading slash) → page key. Index route maps to "/". */
const PATH_TO_PAGE = new Map<string, PageKey>()

for (const route of DASHBOARD_ROUTES) {
  const page = route.page as PageKey
  if (!(page in PAGE_LOADERS)) continue
  if (route.index) {
    PATH_TO_PAGE.set("/", page)
    continue
  }
  if (!route.path) continue
  // Skip parameterized paths for exact map; matched separately below.
  if (route.path.includes(":")) continue
  PATH_TO_PAGE.set(`/${route.path}`, page)
}

const PARAM_ROUTES = DASHBOARD_ROUTES.filter(
  (r): r is { path: string; page: string } => Boolean(r.path && r.path.includes(":"))
).map((r) => ({
  page: r.page as PageKey,
  pattern: new RegExp(`^/${r.path.replace(/:[^/]+/g, "[^/]+")}$`),
}))

function resolvePageKey(href: string): PageKey | null {
  const path = (href.split("?")[0] || "/").replace(/\/+$/, "") || "/"
  const exact = PATH_TO_PAGE.get(path)
  if (exact) return exact
  for (const { page, pattern } of PARAM_ROUTES) {
    if (page in PAGE_LOADERS && pattern.test(path)) return page
  }
  return null
}

export function prefetchRoute(href: string): void {
  const page = resolvePageKey(href)
  if (!page) return
  if (prefetchCache.has(page)) return
  const loader = PAGE_LOADERS[page]
  prefetchCache.set(
    page,
    loader().catch(() => {
      prefetchCache.delete(page)
    })
  )
}

/** Prefetch page chunks during idle time so sidebar clicks skip the JS wait. */
export function prefetchHrefsIdle(hrefs: string[]): void {
  const unique = [...new Set(hrefs.filter(Boolean))]
  let i = 0
  const tick = () => {
    if (i >= unique.length) return
    prefetchRoute(unique[i++])
    if (i >= unique.length) return
    const ric = window.requestIdleCallback
    if (typeof ric === "function") {
      ric(tick, { timeout: 1500 })
    } else {
      window.setTimeout(tick, 120)
    }
  }
  tick()
}
