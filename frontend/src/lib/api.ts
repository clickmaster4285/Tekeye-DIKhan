/**
 * Shared API base URL and auth header helper for backend (Django) API calls.
 * Set VITE_API_BASE_URL in frontend/.env before `npm run build`.
 * Empty value = same-origin (/api/...) when nginx proxies to Django.
 *
 * If the build still has http://HOST:8000 baked in but the app is opened via
 * https://HOST (nginx), we force same-origin to avoid mixed content + CORS.
 */
function resolveApiBaseUrl(): string {
  const raw = import.meta.env?.VITE_API_BASE_URL
  let base =
    raw !== undefined && raw !== null ? String(raw).trim().replace(/\/$/, "") : ""

  if (typeof window === "undefined" || !base) return base

  try {
    const api = new URL(base, window.location.origin)
    const sameHost = api.hostname === window.location.hostname
    if (!sameHost) return base

    const pagePort = window.location.port || (window.location.protocol === "https:" ? "443" : "80")
    const apiPort = api.port || (api.protocol === "https:" ? "443" : "80")
    const pageIsHttps = window.location.protocol === "https:"
    const apiIsHttp = api.protocol === "http:"
    const apiIsDirectDjango = apiPort === "8000"
    const pageViaNginxOrVite = pagePort !== "8000"

    // Built with :8000 but served through nginx / Vite (80/443/3000) → use relative /api
    if (apiIsDirectDjango && pageViaNginxOrVite) return ""

    // HTTPS page must not call HTTP API on the same host (mixed content)
    if (pageIsHttps && apiIsHttp) return ""
  } catch {
    /* keep baked base */
  }

  return base
}

export const API_BASE_URL = resolveApiBaseUrl()

const AUTH_TOKEN_KEY = "pakistan_customs_token"

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null
  return window.sessionStorage.getItem(AUTH_TOKEN_KEY)
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (token) {
    headers["Authorization"] = `Token ${token}`
  }
  return headers
}

export function getAuthHeadersFormData(): Record<string, string> {
  const token = getStoredToken()
  const headers: Record<string, string> = {}
  if (token) {
    headers["Authorization"] = `Token ${token}`
  }
  return headers
}
