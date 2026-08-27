// Session key for Pakistan Customs auth (client-side only)
export const AUTH_SESSION_KEY = "pakistan_customs_auth";
const AUTH_TOKEN_KEY = "pakistan_customs_token";
const AUTH_USER_KEY = "pakistan_customs_user";

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
  /** Top-level sidebar modules; empty = role defaults. ADMIN ignores this. */
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

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(AUTH_SESSION_KEY) === "true";
}

export function clearAuth() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
    window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
    window.sessionStorage.removeItem(AUTH_USER_KEY);
  }
}
