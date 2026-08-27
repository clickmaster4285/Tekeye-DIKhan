import { getStoredUser } from "@/lib/auth";
import { normalizeRole } from "@/lib/role-access";

/** Global super administrator — manages all collectorates. */
const GLOBAL_ADMIN_ROLES = new Set(["ADMIN"]);

/** Regional/collectorate officers who may view all sites (operational, not admin). */
const REGIONAL_VIEW_ROLES = new Set([
  "OPERATION_MANAGER",
  "INSPECTOR",
  "COLLECTOR",
  "DEPUTY_COLLECTOR",
  "ASSISTANT_COLLECTOR",
]);

export function isGlobalAdmin(role: string | undefined | null): boolean {
  const normalized = normalizeRole(role);
  return Boolean(normalized && GLOBAL_ADMIN_ROLES.has(normalized));
}

export function isLocationAdmin(role: string | undefined | null): boolean {
  return normalizeRole(role) === "LOCATION_ADMIN";
}

export function canSeeAllLocations(role: string | undefined | null): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  return GLOBAL_ADMIN_ROLES.has(normalized) || REGIONAL_VIEW_ROLES.has(normalized);
}

/** Returns the user's location code when listings should be scoped; null = no filter. */
export function getUserLocationFilter(): string | null {
  const user = getStoredUser();
  if (!user) return null;
  if (canSeeAllLocations(user.role)) return null;
  if (user.location) return user.location;
  return null;
}

export function filterByUserLocation<T extends { location?: string }>(items: T[]): T[] {
  const loc = getUserLocationFilter();
  if (!loc) return items;
  const normalizedLoc = loc.trim().toUpperCase();
  return items.filter((item) => {
    const itemLoc = (item.location ?? "").trim().toUpperCase();
    return !itemLoc || itemLoc === normalizedLoc;
  });
}

/** Roles a location administrator may assign when creating users. */
export function rolesAvailableToLocationAdmin(): string[] {
  return [
    "OPERATION_MANAGER",
    "INSPECTOR",
    "COLLECTOR",
    "DEPUTY_COLLECTOR",
    "ASSISTANT_COLLECTOR",
    "RECEPTIONIST",
    "GUARD",
    "HR",
    "WAREHOUSE_OFFICER",
    "WAREHOUSE_SUPERINTENDENT",
    "WAREHOUSE_IN_CHARGE",
    "EXAMINATION_OFFICER",
    "STOCK_CONTROLLER",
    "IT_ADMIN",
    "AUDITOR",
    "PRAL",
    "DETECTION_OFFICER",
    "FIR_OFFICER",
    "INVESTIGATION_OFFICER",
    "SEIZING_OFFICER",
  ];
}
