// Session key for Pakistan Customs auth (client-side only)
export const AUTH_SESSION_KEY = "pakistan_customs_auth";
const AUTH_TOKEN_KEY = "pakistan_customs_token";
const AUTH_USER_KEY = "pakistan_customs_user";
/** Same-origin cookie so /media/ images and new-tab links work without an Authorization header. */
export const AUTH_TOKEN_COOKIE = "tekeye_auth_token";

function authCookieSuffix(): string {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  return `; Path=/; SameSite=Lax${secure}`;
}

function setAuthTokenCookie(token: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_TOKEN_COOKIE}=${encodeURIComponent(token)}${authCookieSuffix()}`;
}

function clearAuthTokenCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_TOKEN_COOKIE}=; Max-Age=0${authCookieSuffix()}`;
}

/** Keep the media cookie in sync with sessionStorage (covers already-logged-in tabs). */
export function syncAuthCookieFromSession() {
  if (typeof window === "undefined") return;
  const token = window.sessionStorage.getItem(AUTH_TOKEN_KEY);
  if (token) setAuthTokenCookie(token);
  else clearAuthTokenCookie();
}

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  role: string;
  phone: string;
  location?: string;
  full_name?: string;
  designation?: string;
  employee_id?: string;
  cell_no?: string;
  office_phone_1?: string;
  office_phone_2?: string;
  collectorate?: string;
  department?: string;
  is_active?: boolean;
  /** Linked staff photo (/media/...) when available. */
  profile_image?: string | null;
  /** Top-level sidebar modules; empty = no module access. ADMIN ignores this. */
  allowed_modules?: string[];
};

export function setAuthenticated() {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(AUTH_SESSION_KEY, "true");
  }
}

/** Call after successful login API response. Stores token and user, marks session authenticated. */
export function setAuthenticatedWithToken(token: string, user: AuthUser) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  window.sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  window.sessionStorage.setItem(AUTH_SESSION_KEY, "true");
  setAuthTokenCookie(token);
  window.dispatchEvent(new CustomEvent("tekeye-auth-changed"));
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/** Merge fields into the stored session user (e.g. after /users/me/ refresh). */
export function updateStoredUser(partial: Partial<AuthUser>): AuthUser | null {
  if (typeof window === "undefined") return null;
  const current = getStoredUser();
  if (!current) return null;
  const next = { ...current, ...partial };
  window.sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(AUTH_USER_UPDATED_EVENT));
  return next;
}

export const AUTH_USER_UPDATED_EVENT = "tekeye-auth-user-updated";
export const AUTH_SESSION_EXPIRED_EVENT = "tekeye-auth-session-expired";

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(AUTH_SESSION_KEY) === "true";
}

export function clearAuth() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
    window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
    window.sessionStorage.removeItem(AUTH_USER_KEY);
    clearAuthTokenCookie();
    window.dispatchEvent(new CustomEvent("tekeye-auth-changed"));
  }
}

/** Clear session after a 401. Listeners drop React Query cache. */
export function handleSessionExpired() {
  if (typeof window === "undefined") return;
  if (!isAuthenticated()) return;
  clearAuth();
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
  if (!window.location.pathname.startsWith("/login")) {
    const next = `${window.location.pathname}${window.location.search}`;
    const loginUrl =
      next && next !== "/"
        ? `/login?next=${encodeURIComponent(next)}`
        : "/login";
    window.location.assign(loginUrl);
  }
}

if (typeof window !== "undefined") {
  syncAuthCookieFromSession();
}

/**
 * Normalize a `next` query value to a same-origin path+search.
 * Rejects open redirects (other origins, protocol-relative, etc.).
 */
function normalizeSameOriginPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;
  try {
    if (/^https?:\/\//i.test(value)) {
      const parsed = new URL(value);
      if (typeof window !== "undefined" && parsed.origin !== window.location.origin) return null;
      value = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return null;
  }
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || /:\/\//.test(value)) return null;
  return value;
}

/** Only same-origin /media/... paths (blocks open redirects). */
export function getSafeMediaNext(raw: string | null | undefined): string | null {
  const value = normalizeSameOriginPath(raw);
  if (!value) return null;
  if (!value.startsWith("/media/")) return null;
  return value;
}

/** Full navigation so the browser requests the file from Django (not a React route). */
export function goToSafeMediaNext(raw: string | null | undefined): boolean {
  const path = getSafeMediaNext(raw);
  if (!path || typeof window === "undefined") return false;
  window.location.replace(path);
  return true;
}

/**
 * Safe in-app path for post-login redirect (QR scan → detail, deep links, etc.).
 * Strips print-only flags so scanned memo QRs open the interactive detail page.
 */
export function getSafeAppNext(raw: string | null | undefined): string | null {
  const value = normalizeSameOriginPath(raw);
  if (!value) return null;
  if (value === "/login" || value.startsWith("/login?")) return null;
  if (value.startsWith("/media/")) return null;

  try {
    const url = new URL(value, "http://local.invalid");
    url.searchParams.delete("print");
    url.searchParams.delete("autoprint");
    url.searchParams.delete("savepdf");
    const search = url.searchParams.toString();
    return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
  } catch {
    return value;
  }
}

/**
 * Prefer media file next, else in-app SPA next.
 * Pass react-router `navigate` for app paths; falls back to location.replace.
 */
export function goToSafeNext(
  raw: string | null | undefined,
  navigate?: (to: string, opts?: { replace?: boolean }) => void
): boolean {
  if (goToSafeMediaNext(raw)) return true;
  const path = getSafeAppNext(raw);
  if (!path) return false;
  if (navigate) {
    navigate(path, { replace: true });
    return true;
  }
  if (typeof window === "undefined") return false;
  window.location.replace(path);
  return true;
}
