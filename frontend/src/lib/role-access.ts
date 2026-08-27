import { ROUTES, getModuleLabelForPath } from "@/routes/config"

const SEIZURE_MGMT_EXACT_PATHS = [
  ROUTES.SEIZURE_MANAGEMENT,
  ROUTES.SEIZURE_MGMT_NOTE_SHEET,
  ROUTES.SEIZURE_MGMT_NOTE_SHEET_CREATE,
  ROUTES.SEIZURE_MGMT_ASSESSMENT,
  ROUTES.SEIZURE_MGMT_DETENTION_REPORTING,
  ROUTES.SEIZURE_MGMT_RECOVERY_MEMO,
  ROUTES.SEIZURE_MGMT_RECOVERY_MEMO_CREATE,
  ROUTES.SEIZURE_MGMT_RECOVERY_REPORTING,
  ROUTES.SEIZURE_MGMT_SEIZURE_REPORT,
  ROUTES.SEIZURE_MGMT_SEIZURE_REPORT_CREATE,
  ROUTES.SEIZURE_MGMT_REPORTS,
] as const

const SEIZURE_MGMT_PATH_PATTERN = /^\/seizure-management(\/.*)?$/

export type RestrictedRole =
  | "RECEPTIONIST"
  | "GUARD"
  | "WAREHOUSE_OFFICER"
  | "WAREHOUSE_SUPERINTENDENT"
  | "WAREHOUSE_IN_CHARGE"
  | "EXAMINATION_OFFICER"
  | "STOCK_CONTROLLER"
  | "IT_ADMIN"
  | "AUDITOR"
  | "PRAL"
  | "HR"

export function normalizeRole(role: string | undefined | null): string {
  return (role ?? "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase()
}

export function getRestrictedRole(role: string | undefined | null): RestrictedRole | null {
  const normalized = normalizeRole(role)
  if (
    normalized === "RECEPTIONIST" ||
    normalized === "GUARD" ||
    normalized === "WAREHOUSE_OFFICER" ||
    normalized === "WAREHOUSE_SUPERINTENDENT" ||
    normalized === "WAREHOUSE_IN_CHARGE" ||
    normalized === "EXAMINATION_OFFICER" ||
    normalized === "STOCK_CONTROLLER" ||
    normalized === "IT_ADMIN" ||
    normalized === "AUDITOR" ||
    normalized === "PRAL" ||
    normalized === "HR"
  ) {
    return normalized as RestrictedRole
  }
  return null
}

export function isReceptionistRole(role: string | undefined | null): boolean {
  return normalizeRole(role) === "RECEPTIONIST"
}

export function isGuardRole(role: string | undefined | null): boolean {
  return normalizeRole(role) === "GUARD"
}

export function isWarehouseOfficerRole(role: string | undefined | null): boolean {
  return normalizeRole(role) === "WAREHOUSE_OFFICER"
}

export function isHrRole(role: string | undefined | null): boolean {
  return normalizeRole(role) === "HR"
}

/** Collectorate officers — full app nav, location-scoped in APIs. Not Super Admin. */
const SITE_FULL_ACCESS_ROLES = new Set([
  "LOCATION_ADMIN",
  "OPERATION_MANAGER",
  "COLLECTOR",
  "DEPUTY_COLLECTOR",
  "ASSISTANT_COLLECTOR",
])

export function isSiteFullAccessRole(role: string | undefined | null): boolean {
  return SITE_FULL_ACCESS_ROLES.has(normalizeRole(role))
}

type PathRule = { exact: string[]; patterns: RegExp[] }

const ROLE_PATH_RULES: Record<RestrictedRole, PathRule> = {
  GUARD: {
    exact: [
      ROUTES.DASHBOARD,
      // Visitor management pages (full access)
      ROUTES.VISITOR_MANAGEMENT_OVERVIEW,
      ROUTES.PRE_REGISTRATION,
      ROUTES.WALK_IN_REGISTRATION,
      ROUTES.STREAMED_UPLOAD,
      ROUTES.PHOTO_CAPTURE,
      ROUTES.QR_CODE_GENERATION,
      ROUTES.APPOINTMENT_SCHEDULING,
      ROUTES.TIME_SLOT_BOOKING,
      ROUTES.HOST_SELECTION,
      ROUTES.VISIT_PURPOSE,
      ROUTES.CALENDAR_VIEW,
      ROUTES.SECURITY_SCREENING,
      ROUTES.WATCHLIST_SCREENING,
      ROUTES.BLACKLIST_MANAGEMENT,
      ROUTES.FLAGGED_VISITOR_ALERTS,
      ROUTES.ACCESS_CONTROL,
      ROUTES.ZONE_RESTRICTIONS,
      ROUTES.GATE_INTEGRATION,
      ROUTES.ESCORT_REQUIREMENT,
      ROUTES.HOST_DEPARTMENT_DASHBOARD,
      ROUTES.VISITOR_NOTIFICATIONS,
      ROUTES.UPCOMING_VISITS,
      ROUTES.VISITOR_HISTORY,
      ROUTES.VEHICLE_CONTRACTOR_MANAGEMENT,
      ROUTES.VEHICLE_REGISTRATION,
      ROUTES.VEHICLE_TRACKING,
      ROUTES.CONTRACTOR_PASSES,
      ROUTES.CARGO_DELIVERY_LOGS,
      ROUTES.VISITOR_MANAGEMENT_OVERVIEW,
      ROUTES.VEHICLE_REGISTRATION,
      ROUTES.VEHICLE_TRACKING,
      ROUTES.CONTRACTOR_PASSES,
      ROUTES.CARGO_DELIVERY_LOGS,
      ROUTES.INCIDENT_CREATION,
      ROUTES.GUARD_RECEPTION_PANEL,
    ],
    // allow any visitors path (list, filters, details, sub-pages)
    patterns: [/^\/visitors(\/.*)?$/],
  },
  RECEPTIONIST: {
    exact: [
      ROUTES.VISITOR_MANAGEMENT_OVERVIEW,
      ROUTES.PRE_REGISTRATION,
      ROUTES.WALK_IN_REGISTRATION,
      ROUTES.STREAMED_UPLOAD,
      ROUTES.PHOTO_CAPTURE,
      ROUTES.QR_CODE_GENERATION,
      ROUTES.APPOINTMENT_SCHEDULING,
      ROUTES.TIME_SLOT_BOOKING,
      ROUTES.HOST_SELECTION,
      ROUTES.VISIT_PURPOSE,
      ROUTES.CALENDAR_VIEW,
      ROUTES.SECURITY_SCREENING,
      ROUTES.WATCHLIST_SCREENING,
      ROUTES.BLACKLIST_MANAGEMENT,
      ROUTES.FLAGGED_VISITOR_ALERTS,
      ROUTES.ACCESS_CONTROL,
      ROUTES.ZONE_RESTRICTIONS,
      ROUTES.GATE_INTEGRATION,
      ROUTES.ESCORT_REQUIREMENT,
      ROUTES.HOST_DEPARTMENT_DASHBOARD,
      ROUTES.VISITOR_NOTIFICATIONS,
      ROUTES.UPCOMING_VISITS,
      ROUTES.VISITOR_HISTORY,
      ROUTES.GUARD_RECEPTION_PANEL,
      ROUTES.VEHICLE_CONTRACTOR_MANAGEMENT,
      ROUTES.VEHICLE_REGISTRATION,
      ROUTES.VEHICLE_TRACKING,
      ROUTES.CONTRACTOR_PASSES,
      ROUTES.CARGO_DELIVERY_LOGS,
    ],
    patterns: [/^\/visitors\/[^/]+$/],
  },
  WAREHOUSE_OFFICER: {
    exact: [
      ROUTES.DASHBOARD,
      ROUTES.OPERATIONS_DASHBOARD,
      ROUTES.DETENTION_MEMO,
      ROUTES.WAREHOUSE_DETENTION_MEMO,
      ROUTES.DEPOSIT_ACCOUNT_REGISTER,
      ROUTES.NEW_SEIZURE_ENTRY,
      ROUTES.GOODS_RECEIPT_HANDOVER,
      ROUTES.AI_ITEM_CATALOGING,
      ROUTES.SEIZURE_REGISTER,
      ROUTES.WAREHOUSE_SETUP,
      ROUTES.ZONE_LOCATION_MANAGEMENT,
      ROUTES.STORAGE_ALLOCATION,
      ROUTES.INVENTORY_TRACKING,
      ROUTES.STOCK_RECONCILIATION,
      ROUTES.RELEASE_INVENTORY,
      ROUTES.MEMO_DISTRIBUTION,
      ROUTES.DESTRUCTION,
      ROUTES.CAMERA_INTEGRATION,
      ROUTES.GOODS_RECEIPT,
      ROUTES.STOCK_MANAGEMENT,
      ROUTES.CYCLE_COUNTING,
      ROUTES.INVENTORY_VALUATION,
      ROUTES.INTER_COLLECTORATE_TRANSFER,
      ROUTES.INTERNAL_MOVEMENT,
      ROUTES.HANDOVER_REQUESTS,
      ROUTES.DOUBLE_AUTHENTICATION,
      ROUTES.TRANSFER_TRACKING,
      ROUTES.PERISHABLE_REGISTER,
      ROUTES.EXPIRY_TRACKING,
      ROUTES.PRIORITY_DISPOSAL_QUEUE,
      ROUTES.DESTRUCTION_ORDERS,
      ROUTES.LOT_CREATION,
      ROUTES.ITEM_VALUATION,
      ROUTES.STANDARD_REPORTS,
      ROUTES.CUSTOM_REPORT_BUILDER,
      ROUTES.EXPORT_CENTER,
      ROUTES.HS_CODES_FILE,
      ROUTES.SEIZED_INVENTORY,
      ...SEIZURE_MGMT_EXACT_PATHS,
    ],
    patterns: [
      /^\/deposit-account-register\/[^/]+$/,
      /^\/detention-memo\/create$/,
      /^\/detention-memo\/[^/]+$/,
      /^\/seizure-management\/detention-memo\/create$/,
      /^\/seizure-management\/detention-memo\/[^/]+$/,
      /^\/seized-inventory\/[^/]+$/,
      /^\/goods-receipt\/[^/]+$/,
      /^\/stock-management\/[^/]+$/,
      /^\/cycle-counting-audit\/[^/]+$/,
      /^\/inventory-valuation\/[^/]+$/,
      /^\/destruction\/[^/]+$/,
      SEIZURE_MGMT_PATH_PATTERN,
    ],
  },
  WAREHOUSE_IN_CHARGE: {
    exact: [
      ROUTES.DASHBOARD,
      ROUTES.OPERATIONS_DASHBOARD,
      ROUTES.GOODS_RECEIPT,
      ROUTES.DEPOSIT_ACCOUNT_REGISTER,
      ROUTES.STOCK_MANAGEMENT,
      ROUTES.CYCLE_COUNTING,
      ROUTES.STORAGE_ALLOCATION,
      ROUTES.INVENTORY_TRACKING,
      ROUTES.STOCK_RECONCILIATION,
      ROUTES.HANDOVER_REQUESTS,
      ROUTES.INTER_COLLECTORATE_TRANSFER,
      ROUTES.INTERNAL_MOVEMENT,
      // Incident management access
      ROUTES.INCIDENT_MANAGEMENT,
      ROUTES.AI_INCIDENT_MANAGEMENT,
      ROUTES.INCIDENT_CREATION,
      // Vehicle management (view-only)
      ROUTES.VEHICLE_CONTRACTOR_MANAGEMENT,
      ROUTES.VEHICLE_REGISTRATION,
      ROUTES.VEHICLE_TRACKING,
      ROUTES.CONTRACTOR_PASSES,
      ROUTES.CARGO_DELIVERY_LOGS,
      ROUTES.VEHICLE_DATABASE,
    ],
    patterns: [
      /^\/goods-receipt\/[^/]+$/,
      /^\/stock-management\/[^/]+$/,
      /^\/cycle-counting-audit\/[^/]+$/,
      /^\/deposit-account-register\/[^/]+$/,
      // allow incident management subpaths
      /^\/incident-management(\/.*)?$/,
      /^\/ai-incident-management(\/.*)?$/,
      // allow vehicle database details
      /^\/vehicle-database(\/.*)?$/,
    ],
  },
  EXAMINATION_OFFICER: {
    exact: [
      ROUTES.DASHBOARD,
      ROUTES.OPERATIONS_DASHBOARD,
      ROUTES.DETENTION_MEMO,
      ROUTES.WAREHOUSE_DETENTION_MEMO,
      ROUTES.SEIZURE_REGISTER,
      ROUTES.INVENTORY_VALUATION,
      ROUTES.ITEM_VALUATION,
      ROUTES.STOCK_MANAGEMENT,
      ...SEIZURE_MGMT_EXACT_PATHS,
    ],
    patterns: [
      /^\/detention-memo\/[^/]+$/,
      /^\/seizure-management\/detention-memo\/[^/]+$/,
      /^\/seized-inventory\/[^/]+$/,
      /^\/goods-receipt\/[^/]+$/,
      /^\/inventory-valuation\/[^/]+$/,
      SEIZURE_MGMT_PATH_PATTERN,
    ],
  },
  STOCK_CONTROLLER: {
    exact: [
      ROUTES.DASHBOARD,
      ROUTES.OPERATIONS_DASHBOARD,
      ROUTES.DEPOSIT_ACCOUNT_REGISTER,
      ROUTES.STOCK_MANAGEMENT,
      ROUTES.CYCLE_COUNTING,
      ROUTES.STORAGE_ALLOCATION,
      ROUTES.STOCK_RECONCILIATION,
    ],
    patterns: [
      /^\/deposit-account-register\/[^/]+$/,
      /^\/stock-management\/[^/]+$/,
      /^\/cycle-counting-audit\/[^/]+$/,
    ],
  },
  WAREHOUSE_SUPERINTENDENT: {
    exact: [
      ROUTES.DASHBOARD,
      ROUTES.OPERATIONS_DASHBOARD,
      ROUTES.DETENTION_MEMO,
      ROUTES.WAREHOUSE_DETENTION_MEMO,
      ROUTES.DEPOSIT_ACCOUNT_REGISTER,
      ROUTES.NEW_SEIZURE_ENTRY,
      ROUTES.GOODS_RECEIPT_HANDOVER,
      ROUTES.AI_ITEM_CATALOGING,
      ROUTES.SEIZURE_REGISTER,
      ROUTES.WAREHOUSE_SETUP,
      ROUTES.ZONE_LOCATION_MANAGEMENT,
      ROUTES.STORAGE_ALLOCATION,
      ROUTES.INVENTORY_TRACKING,
      ROUTES.STOCK_RECONCILIATION,
      ROUTES.RELEASE_INVENTORY,
      ROUTES.MEMO_DISTRIBUTION,
      ROUTES.DESTRUCTION,
      ROUTES.CAMERA_INTEGRATION,
      ROUTES.GOODS_RECEIPT,
      ROUTES.STOCK_MANAGEMENT,
      ROUTES.CYCLE_COUNTING,
      ROUTES.INVENTORY_VALUATION,
      ROUTES.INTER_COLLECTORATE_TRANSFER,
      ROUTES.INTERNAL_MOVEMENT,
      ROUTES.HANDOVER_REQUESTS,
      ROUTES.DOUBLE_AUTHENTICATION,
      ROUTES.TRANSFER_TRACKING,
      ROUTES.PERISHABLE_REGISTER,
      ROUTES.EXPIRY_TRACKING,
      ROUTES.PRIORITY_DISPOSAL_QUEUE,
      ROUTES.DESTRUCTION_ORDERS,
      ROUTES.LOT_CREATION,
      ROUTES.ITEM_VALUATION,
      ROUTES.STANDARD_REPORTS,
      ROUTES.CUSTOM_REPORT_BUILDER,
      ROUTES.EXPORT_CENTER,
      ROUTES.HS_CODES_FILE,
      ROUTES.SEIZED_INVENTORY,
      ROUTES.ASO_PORTAL_SYNC,
      ROUTES.BIDDING_MANAGEMENT,
      ROUTES.SALE_COMPLETION,
      ROUTES.REVENUE_REPORTS,
      ROUTES.AI_INCIDENT_MANAGEMENT,
      ROUTES.INCIDENT_CREATION,
      ROUTES.LOGS,
      ROUTES.ACTIVITY_LOGS,
      ROUTES.VISITOR_MANAGEMENT_OVERVIEW,
      ROUTES.VEHICLE_REGISTRATION,
      ROUTES.VEHICLE_TRACKING,
      ROUTES.CONTRACTOR_PASSES,
      ROUTES.CARGO_DELIVERY_LOGS,
      ...SEIZURE_MGMT_EXACT_PATHS,
    ],
    patterns: [
      /^\/deposit-account-register\/[^/]+$/,
      /^\/detention-memo\/create$/,
      /^\/detention-memo\/[^/]+$/,
      /^\/seizure-management\/detention-memo\/create$/,
      /^\/seizure-management\/detention-memo\/[^/]+$/,
      /^\/seized-inventory\/[^/]+$/,
      /^\/goods-receipt\/[^/]+$/,
      /^\/stock-management\/[^/]+$/,
      /^\/cycle-counting-audit\/[^/]+$/,
      /^\/inventory-valuation\/[^/]+$/,
      /^\/visitors\/[^/]+$/,
      /^\/destruction\/[^/]+$/,
      SEIZURE_MGMT_PATH_PATTERN,
    ],
  },
  IT_ADMIN: {
    exact: [
      ROUTES.DASHBOARD,
      ROUTES.USER_ROLE_MANAGEMENT,
      ROUTES.USER_ACCOUNTS,
      ROUTES.ADD_USER,
      ROUTES.USER_DETAIL,
      ROUTES.EDIT_USER,
      ROUTES.LOGS,
      ROUTES.ACTIVITY_LOGS,
      // Attendance APIs use IsAdminOrHR (includes IT_ADMIN)
      ROUTES.ATTENDANCE,
      ROUTES.FACE_ENROLLMENT,
      ROUTES.ATTENDANCE_MONITOR,
      ROUTES.ATTENDANCE_DASHBOARD,
      ROUTES.ATTENDANCE_REPORTS,
    ],
    patterns: [
      /^\/settings\/users\/[^/]+$/,
      /^\/settings\/users\/[^/]+\/edit$/,
    ],
  },
  AUDITOR: {
    exact: [
      ROUTES.DASHBOARD,
      ROUTES.VISITOR_MANAGEMENT_OVERVIEW,
      ROUTES.GUARD_RECEPTION_PANEL,
      ROUTES.VEHICLE_REGISTRATION,
      ROUTES.VEHICLE_TRACKING,
      ROUTES.CONTRACTOR_PASSES,
      ROUTES.CARGO_DELIVERY_LOGS,
      ROUTES.OPERATIONS_DASHBOARD,
      ROUTES.DETENTION_MEMO,
      ROUTES.WAREHOUSE_DETENTION_MEMO,
      ROUTES.SEIZURE_REGISTER,
      ROUTES.GOODS_RECEIPT,
      ROUTES.INVENTORY_VALUATION,
      ROUTES.ITEM_VALUATION,
      ROUTES.STOCK_MANAGEMENT,
      ROUTES.CYCLE_COUNTING,
      ROUTES.STORAGE_ALLOCATION,
      ROUTES.INVENTORY_TRACKING,
      ROUTES.STOCK_RECONCILIATION,
      ROUTES.ASO_PORTAL_SYNC,
      ROUTES.BIDDING_MANAGEMENT,
      ROUTES.SALE_COMPLETION,
      ROUTES.REVENUE_REPORTS,
      ROUTES.AI_INCIDENT_MANAGEMENT,
      ROUTES.INCIDENT_CREATION,
      ROUTES.LOGS,
      ROUTES.ACTIVITY_LOGS,
      ...SEIZURE_MGMT_EXACT_PATHS,
    ],
    patterns: [
      /^\/detention-memo\/[^/]+$/,
      /^\/seizure-management\/detention-memo\/[^/]+$/,
      /^\/seized-inventory\/[^/]+$/,
      /^\/goods-receipt\/[^/]+$/,
      /^\/stock-management\/[^/]+$/,
      /^\/cycle-counting-audit\/[^/]+$/,
      /^\/inventory-valuation\/[^/]+$/,
      /^\/visitors\/[^/]+$/,
      SEIZURE_MGMT_PATH_PATTERN,
    ],
  },
  PRAL: {
    exact: [
      ROUTES.OPERATIONS_DASHBOARD,
      ROUTES.DETENTION_MEMO,
      ROUTES.WAREHOUSE_DETENTION_MEMO,
      ROUTES.SEIZURE_REGISTER,
      ROUTES.GOODS_RECEIPT,
      ROUTES.INVENTORY_VALUATION,
      ROUTES.ITEM_VALUATION,
      ROUTES.STOCK_MANAGEMENT,
      ROUTES.ASO_PORTAL_SYNC,
      ROUTES.BIDDING_MANAGEMENT,
      ROUTES.SALE_COMPLETION,
      ROUTES.REVENUE_REPORTS,
      ROUTES.LOGS,
      ROUTES.ACTIVITY_LOGS,
      ...SEIZURE_MGMT_EXACT_PATHS,
    ],
    patterns: [
      /^\/detention-memo\/[^/]+$/,
      /^\/seizure-management\/detention-memo\/[^/]+$/,
      /^\/seized-inventory\/[^/]+$/,
      /^\/goods-receipt\/[^/]+$/,
      /^\/stock-management\/[^/]+$/,
      /^\/inventory-valuation\/[^/]+$/,
      SEIZURE_MGMT_PATH_PATTERN,
    ],
  },
  HR: {
    exact: [
      ROUTES.EMPLOYEES,
      ROUTES.ADD_STAFF,
      ROUTES.ATTENDANCE,
      ROUTES.FACE_ENROLLMENT,
      ROUTES.ATTENDANCE_MONITOR,
      ROUTES.ATTENDANCE_DASHBOARD,
      ROUTES.ATTENDANCE_REPORTS,
      ROUTES.LEAVE_MANAGEMENT,
      ROUTES.PAYROLL,
      ROUTES.RECRUITMENT,
    ],
    patterns: [/^\/employees\/[^/]+$/, /^\/employees\/[^/]+\/edit$/],
  },
}

const ROLE_PATH_SETS: Record<RestrictedRole, Set<string>> = Object.fromEntries(
  Object.entries(ROLE_PATH_RULES).map(([role, rule]) => [role, new Set(rule.exact)])
) as Record<RestrictedRole, Set<string>>

function normalizePathname(pathname: string): string {
  return pathname.split("?")[0].replace(/\/$/, "") || "/"
}

export function isPathAllowedForRestrictedRole(
  pathname: string,
  restrictedRole: RestrictedRole
): boolean {
  const path = normalizePathname(pathname)
  const patterns = ROLE_PATH_RULES[restrictedRole].patterns
  if (ROLE_PATH_SETS[restrictedRole].has(path)) return true
  return patterns.some((pattern) => pattern.test(path))
}

/** Full-access roles (admin) may open any route; module grants or restricted roles limit access. */
export function isPathAllowedForRole(
  pathname: string,
  role: string | undefined | null,
  allowedModules?: string[] | null
): boolean {
  const normalized = normalizeRole(role)
  if (normalized === "ADMIN") return true
  if (normalized === "IT_SUPERADMIN") {
    const path = normalizePathname(pathname)
    return (
      path === ROUTES.OPS_CENTRAL ||
      path.startsWith(`${ROUTES.OPS_CENTRAL}/`)
    )
  }

  const path = normalizePathname(pathname)
  const modules = (allowedModules ?? []).map((m) => m.trim()).filter(Boolean)
  const restricted = getRestrictedRole(role)

  if (isSiteFullAccessRole(role)) {
    if (path === ROUTES.OPS_CENTRAL || path.startsWith(`${ROUTES.OPS_CENTRAL}/`)) return false
    return true
  }

  // Main `/` dashboard: Super Admin only (handled above). Restricted / granted users
  // go to their module home. Unconfigured users (no template, no grants) may use `/`
  // until Super Admin assigns modules.
  if (path === "/" || path === "") {
    return !restricted && modules.length === 0
  }

  if (modules.length > 0) {
    const moduleLabel = getModuleLabelForPath(pathname)
    if (!moduleLabel) return false
    return modules.includes(moduleLabel)
  }

  // No custom grants and no role template → only `/` (handled above).
  if (!restricted) return false
  return isPathAllowedForRestrictedRole(pathname, restricted)
}

/** @deprecated Use isPathAllowedForRole */
export function isReceptionistAllowedPath(pathname: string): boolean {
  return isPathAllowedForRestrictedRole(pathname, "RECEPTIONIST")
}

/** Landing route for a top-level sidebar module grant. */
const MODULE_HOME_BY_LABEL: Record<string, string> = {
  "Visitor Management": ROUTES.VISITOR_MANAGEMENT_OVERVIEW,
  "Warehouse Management": ROUTES.OPERATIONS_DASHBOARD,
  "Seizure Management": ROUTES.SEIZURE_MANAGEMENT,
  "Human Resource": ROUTES.EMPLOYEES,
  "Armory": ROUTES.ARMORY,
  "Litigation Management": ROUTES.FIR_REGISTRATION,
  "Auction Management": ROUTES.ASO_PORTAL_SYNC,
  "AI Monitoring & Analytics": ROUTES.ANALYTICS_DASHBOARD,
  "System Configuration": ROUTES.USER_ROLE_MANAGEMENT,
}

/** Role / grant home — never the main `/` dashboard except for Super Admin. */
export function getHomeRouteForRole(
  role: string | undefined | null,
  allowedModules?: string[] | null
): string {
  const normalized = normalizeRole(role)
  if (normalized === "ADMIN") return ROUTES.DASHBOARD
  if (normalized === "IT_SUPERADMIN") return ROUTES.OPS_CENTRAL
  if (isSiteFullAccessRole(role)) return ROUTES.DASHBOARD

  const modules = (allowedModules ?? []).map((m) => m.trim()).filter(Boolean)
  if (modules.length > 0) {
    for (const label of modules) {
      const home = MODULE_HOME_BY_LABEL[label]
      if (home) return home
    }
  }

  const restricted = getRestrictedRole(role)
  if (restricted === "RECEPTIONIST" || restricted === "GUARD") {
    return ROUTES.VISITOR_MANAGEMENT_OVERVIEW
  }
  if (
    restricted === "WAREHOUSE_OFFICER" ||
    restricted === "WAREHOUSE_SUPERINTENDENT" ||
    restricted === "WAREHOUSE_IN_CHARGE" ||
    restricted === "EXAMINATION_OFFICER" ||
    restricted === "STOCK_CONTROLLER" ||
    restricted === "AUDITOR"
  ) {
    return ROUTES.OPERATIONS_DASHBOARD
  }
  if (restricted === "IT_ADMIN") return ROUTES.ATTENDANCE_DASHBOARD
  if (restricted === "HR") return ROUTES.EMPLOYEES
  if (restricted === "PRAL") return ROUTES.ASO_PORTAL_SYNC

  // Unconfigured role with no grants — temporary until modules are assigned.
  return ROUTES.DASHBOARD
}

/** Dashboard index path; restricted roles cannot access it and are sent to their module home. */
export function isDashboardHomePath(pathname: string): boolean {
  const path = pathname.split("?")[0].replace(/\/$/, "") || "/"
  return path === "" || path === "/"
}

export function getRoleDisplayLabel(role: string | undefined | null): string {
  const normalized = normalizeRole(role)
  if (normalized === "RECEPTIONIST") return "Receptionist"
  if (normalized === "GUARD") return "Guard"
  if (normalized === "WAREHOUSE_OFFICER") return "Warehouse Officer"
  if (normalized === "WAREHOUSE_SUPERINTENDENT") return "Warehouse Superintendent"
  if (normalized === "WAREHOUSE_IN_CHARGE") return "Warehouse In-Charge"
  if (normalized === "EXAMINATION_OFFICER") return "Examination Officer"
  if (normalized === "STOCK_CONTROLLER") return "Stock Controller"
  if (normalized === "ADMIN") return "Super Admin"
  if (normalized === "IT_SUPERADMIN") return "IT Super Admin"
  if (normalized === "IT_ADMIN") return "IT Administrator"
  if (normalized === "LOCATION_ADMIN") return "Location Administrator"
  if (normalized === "HR") return "Human Resource"
  if (normalized === "AUDITOR") return "Auditor"
  if (normalized === "PRAL") return "PRAL"
  if (!normalized) return "User"
  return normalized
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ")
}

/** Returns true when the role should only have view/list access for vehicle-management modules. */
export function isViewOnlyForVehicleModule(role: string | undefined | null): boolean {
  return getRestrictedRole(role) === "WAREHOUSE_IN_CHARGE"
}
