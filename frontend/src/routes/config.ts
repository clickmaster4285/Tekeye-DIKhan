/**
 * Central route paths. Use these for all navigation (Link, useNavigate, redirects)
 * so URLs are defined in one place.
 */
export const ROUTES = {
  // Auth
  LOGIN: "/login",

  // Dashboard (home)
  DASHBOARD: "/",

  // Registration (VMS)
  PRE_REGISTRATION: "/pre-registration",
  WALK_IN_REGISTRATION: "/walk-in-registration",
  VISITOR_DETAIL: "/visitors/:id",
  STREAMED_UPLOAD: "/streamed-upload",
  PHOTO_CAPTURE: "/photo-capture",
  QR_CODE_GENERATION: "/qr-code-generation",
  APPOINTMENT_SCHEDULING: "/appointment-scheduling",
  TIME_SLOT_BOOKING: "/time-slot-booking",
  HOST_SELECTION: "/host-selection",
  VISIT_PURPOSE: "/visit-purpose",
  CALENDAR_VIEW: "/calendar-view",
  VISITOR_MANAGEMENT_OVERVIEW: "/visitor-management",
  // VMS other modules
  SECURITY_SCREENING: "/security-screening",
  WATCHLIST_SCREENING: "/watchlist-screening",
  BLACKLIST_MANAGEMENT: "/blacklist-management",
  FLAGGED_VISITOR_ALERTS: "/flagged-visitor-alerts",
  ACCESS_CONTROL: "/access-control",
  ZONE_RESTRICTIONS: "/zone-restrictions",
  GATE_INTEGRATION: "/gate-integration",
  ESCORT_REQUIREMENT: "/escort-requirement",
  HOST_DEPARTMENT_DASHBOARD: "/host-department-dashboard",
  VISITOR_NOTIFICATIONS: "/visitor-notifications",
  UPCOMING_VISITS: "/upcoming-visits",
  VISITOR_HISTORY: "/visitor-history",
  GUARD_RECEPTION_PANEL: "/guard-reception-panel",
  VEHICLE_CONTRACTOR_MANAGEMENT: "/vehicle-contractor-management",
  VEHICLE_REGISTRATION: "/vehicle-registration",
  VEHICLE_TRACKING: "/vehicle-tracking",
  CONTRACTOR_PASSES: "/contractor-passes",
  CARGO_DELIVERY_LOGS: "/cargo-delivery-logs",

  // Armory
  ARMORY: "/armory",

  // Warehouse
  WAREHOUSE_SETUP: "/warehouse-setup",
  ZONE_LOCATION_MANAGEMENT: "/zone-location-management",
  STORAGE_ALLOCATION: "/storage-allocation",
  INVENTORY_TRACKING: "/inventory-tracking",
  STOCK_RECONCILIATION: "/stock-reconciliation",
  RELEASE_INVENTORY: "/release-inventory",
  MEMO_DISTRIBUTION: "/memo-distribution",
  DESTRUCTION: "/destruction",
  /** Detail view path; use getDestructionDetailPath(id). */
  DESTRUCTION_DETAIL: "/destruction/:id",
  HS_CODES_FILE: "/hs-codes-file",
  // Inventory Management (sidebar sub-items)
  GOODS_RECEIPT: "/goods-receipt",
  STOCK_MANAGEMENT: "/stock-management",
  CYCLE_COUNTING: "/cycle-counting-audit",
  INVENTORY_VALUATION: "/inventory-valuation",

  // Cameras & monitoring
  CAMERA_INTEGRATION: "/camera-integration",
  OPERATIONS_DASHBOARD: "/operations-dashboard",
  ANALYTICS_DASHBOARD: "/analytics-dashboard",
  LIVE_CAMERA_GRID: "/analytics/live-camera-grid",
  VEHICLE_DETECTION: "/analytics/vehicle-detection",
  AI_MODELS: "/analytics/ai-models",
  AI_ZONES: "/analytics/zones",
  AI_RULES: "/analytics/rules",
  AI_TRAINING: "/analytics/training",
  LIVE_MONITORING: "/live-monitoring",
  CAMERA_MANAGEMENT: "/camera-management",
  CAMERA_MANAGEMENT_VIEW: "/camera-management/:id",
  ANALYTICS_CAMERA_MANAGEMENT: "/analytics/camera-management",
  ANALYTICS_CAMERA_MANAGEMENT_VIEW: "/analytics/camera-management/:id",
  OBJECT_DETECTION: "/object-detection",
  OBJECT_TRACKING: "/object-tracking",
  OBJECT_TRACKING_DETAIL: "/object-tracking/:uuid",
  /** Super Admin only — remote location servers + live detection streams */
  OPS_CENTRAL: "/ops-central",
  PERSON_JOURNEY: "/person-journey",
  PERSON_JOURNEY_DETAIL: "/person-journey/:uuid",
  GPS_TRACKING: "/gps-tracking",
  ANPR_SETTINGS: "/anpr-settings",
  ANPR_VEHICLE_TRACKING: "/anpr-vehicle-tracking",
  VEHICLE_JOURNEY: "/vehicle-journey",
  VEHICLE_JOURNEY_DETAIL: "/vehicle-journey/:plateKey",
  /** Vehicle detection log (car/truck/bus/etc.). Legacy path kept for bookmarks. */
  NUMBER_PLATE_DETECTION: "/vehicle-detection",
  NUMBER_PLATE_DETECTION_LEGACY: "/number-plate-detection",
  ANOMALY_DETECTION: "/anomaly-detection",

  // Detentions
  DEPOSIT_ACCOUNT_REGISTER: "/deposit-account-register",
  /** Detail view path; use getDepositAccountRegisterDetailPath(id). */
  DEPOSIT_ACCOUNT_REGISTER_DETAIL: "/deposit-account-register/:id",
  DETENTION_MEMO: "/seizure-management/detention-memo",
  DETENTION_MEMO_CREATE: "/seizure-management/detention-memo/create",
  /** Warehouse Management copy of the same detention memo pages. */
  WAREHOUSE_DETENTION_MEMO: "/detention-memo",
  WAREHOUSE_DETENTION_MEMO_CREATE: "/detention-memo/create",
  /** Legacy alias of WAREHOUSE_DETENTION_MEMO (QR / bookmarks). */
  DETENTION_MEMO_LEGACY: "/detention-memo",
  SEIZED_INVENTORY: "/seized-inventory",
  // Seizures & cases
  NEW_SEIZURE_ENTRY: "/new-seizure-entry",
  JCP_TOLL_PLAZA_ENTRY: "/jcp-toll-plaza-entry",
  GOODS_RECEIPT_HANDOVER: "/goods-receipt-handover",
  AI_ITEM_CATALOGING: "/ai-item-cataloging",
  SEIZURE_REGISTER: "/seizure-register",
  FIR_REGISTRATION: "/fir-registration",
  CASE_FILE_CREATION: "/case-file-creation",
  COURT_PROCEEDINGS: "/court-proceedings",
  LEGAL_DOCUMENTS: "/legal-documents",
  CASE_STATUS_TRACKING: "/case-status-tracking",

  // Seizure Management
  SEIZURE_MANAGEMENT: "/seizure-management",
  SEIZURE_MGMT_NOTE_SHEET: "/seizure-management/note-sheet",
  SEIZURE_MGMT_NOTE_SHEET_CREATE: "/seizure-management/note-sheet/create",
  SEIZURE_MGMT_NOTE_SHEET_EDIT: "/seizure-management/note-sheet/:id/edit",
  SEIZURE_MGMT_NOTE_SHEET_DETAIL: "/seizure-management/note-sheet/:id",
  SEIZURE_MGMT_ASSESSMENT: "/seizure-management/assessment",
  SEIZURE_MGMT_ASSESSMENT_CREATE: "/seizure-management/assessment/create",
  SEIZURE_MGMT_ASSESSMENT_EDIT: "/seizure-management/assessment/:id/edit",
  SEIZURE_MGMT_ASSESSMENT_DETAIL: "/seizure-management/assessment/:id",
  SEIZURE_MGMT_DETENTION_REPORTING: "/seizure-management/detention-reporting",
  SEIZURE_MGMT_RECOVERY_MEMO: "/seizure-management/recovery-memo",
  SEIZURE_MGMT_RECOVERY_MEMO_CREATE: "/seizure-management/recovery-memo/create",
  SEIZURE_MGMT_RECOVERY_MEMO_DETAIL: "/seizure-management/recovery-memo/:id",
  SEIZURE_MGMT_RECOVERY_REPORTING: "/seizure-management/recovery-reporting",
  SEIZURE_MGMT_SEIZURE_REPORT: "/seizure-management/seizure-report",
  SEIZURE_MGMT_SEIZURE_REPORT_CREATE: "/seizure-management/seizure-report/create",
  SEIZURE_MGMT_SEIZURE_REPORT_DETAIL: "/seizure-management/seizure-report/:id",
  SEIZURE_MGMT_REPORTS: "/seizure-management/reports",

  // Transfers
  INTER_COLLECTORATE_TRANSFER: "/inter-collectorate-transfer",
  INTERNAL_MOVEMENT: "/internal-movement",
  HANDOVER_REQUESTS: "/handover-requests",
  DOUBLE_AUTHENTICATION: "/double-authentication",
  TRANSFER_TRACKING: "/transfer-tracking",

  // Inventory
  PERISHABLE_REGISTER: "/perishable-register",
  EXPIRY_TRACKING: "/expiry-tracking",
  PRIORITY_DISPOSAL_QUEUE: "/priority-disposal-queue",
  DESTRUCTION_ORDERS: "/destruction-orders",
  LOT_CREATION: "/lot-creation",
  ITEM_VALUATION: "/item-valuation",

  // Auction
  ASO_PORTAL_SYNC: "/aso-portal-sync",
  BIDDING_MANAGEMENT: "/bidding-management",
  SALE_COMPLETION: "/sale-completion",
  REVENUE_REPORTS: "/revenue-reports",

  // Reports & analytics
  REPORTS: "/reports",
  STANDARD_REPORTS: "/reports/standard",
  CUSTOM_REPORT_BUILDER: "/reports/custom-builder",
  EXPORT_CENTER: "/reports/export-center",
  PREDICTIVE_INSIGHTS: "/predictive-insights",
  DATA_VISUALIZATION: "/data-visualization",

  // WMS Integration
  WEBOC_SYNC: "/integrations/weboc-sync",
  API_LOGS: "/integrations/api-logs",

  // WMS User Management
  USER_ACCOUNTS: "/settings/user-accounts",
  ROLES_PERMISSIONS: "/settings/roles-permissions",
  ACTIVITY_LOGS: "/settings/activity-logs",

  // HR
  EMPLOYEES: "/employees",
  ADD_STAFF: "/employees/add",
  RECRUITMENT: "/recruitment",
  VISITOR_EDIT: "/visitors/:id/edit",
  /** Path for employee detail; use getEmployeeDetailPath(id) for links */
  EMPLOYEE_DETAIL: "/employees/:id",
  ATTENDANCE: "/attendance",
  FACE_ENROLLMENT: "/attendance/enrollment",
  ATTENDANCE_MONITOR: "/attendance/monitor",
  ATTENDANCE_DASHBOARD: "/attendance/dashboard",
  ATTENDANCE_REPORTS: "/attendance/reports",
  LEAVE_MANAGEMENT: "/leave-management",
  PAYROLL: "/payroll",

  // Settings
  GENERAL_SETTINGS: "/general-settings",
  USER_ROLE_MANAGEMENT: "/user-role-management",
  ADD_USER: "/settings/users/add",
  USER_DETAIL: "/settings/users/:id",
  EDIT_USER: "/settings/users/:id/edit",
  INTEGRATIONS: "/integrations",
  NOTIFICATIONS: "/notifications",
  SECURITY_ACCESS: "/security-access",
  LOGS: "/settings/logs",

  // Additional modules (from full module spec)
  TABLE_OF_CONTENTS: "/table-of-contents",
  PLAYBACK_SEARCH: "/playback-search",
  THERMAL_IMAGING: "/thermal-imaging",
  ALERTS_NOTIFICATIONS: "/alerts-notifications",
  INCIDENT_CREATION: "/incident-management",
  INCIDENT_MANAGEMENT: "/incident-management",
  AI_INCIDENT_MANAGEMENT: "/ai-incident-management",
  PEOPLE_DATABASE: "/people-database",
  /** Person detail page for People Database */
  PEOPLE_DATABASE_DETAIL: "/people-database/:id",
  VEHICLE_DATABASE: "/vehicle-database",
  VEHICLE_DATABASE_DETAIL: "/vehicle-database/:id",
  MOBILE_APP: "/mobile-app",
  DATABASE_TABLES: "/database-tables",

  AI_MONITORING: "/ai-detection-alerts",
  AI_ALERTS_DASHBOARD: "/ai-thermal-alerts",
  AI_ALERTS_HISTORY: "/ai-zone-alerts",
  AI_ALERTS_CONFIGURATION: "/system-alerts",

  // Fallback
  NOT_FOUND: "/404",
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]

/** Build path to employee detail page */
export function getEmployeeDetailPath(id: number): string {
  return `/employees/${id}`
}

/** Person journey lookup by PQR code */
export function getPersonJourneyPath(qrCode?: string): string {
  if (qrCode?.trim()) {
    return `${ROUTES.PERSON_JOURNEY}?qr=${encodeURIComponent(qrCode.trim())}`
  }
  return ROUTES.PERSON_JOURNEY
}

export function getObjectTrackingDetailPath(uuid: string): string {
  return `/object-tracking/${encodeURIComponent(uuid)}`
}

export function getVehicleJourneyPath(plateKey?: string): string {
  const key = (plateKey || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase()
  if (!key) return ROUTES.VEHICLE_JOURNEY
  return `/vehicle-journey/${encodeURIComponent(key)}`
}

/** Build path to user detail page */
export function getUserDetailPath(id: number): string {
  return `/settings/users/${id}`
}

/** Build path to edit user page */
export function getUserEditPath(id: number): string {
  return `/settings/users/${id}/edit`
}

export function getVehicleDatabaseDetailPath(id: string): string {
  return `/vehicle-database/${encodeURIComponent(id)}`
}

/** Build path to Inventory Management detail pages */
export function getGoodsReceiptDetailPath(id: string): string {
  return `${ROUTES.GOODS_RECEIPT}/${encodeURIComponent(id)}`
}
export function getStockManagementDetailPath(id: string): string {
  return `${ROUTES.STOCK_MANAGEMENT}/${encodeURIComponent(id)}`
}
export function getCycleCountingDetailPath(id: string): string {
  return `${ROUTES.CYCLE_COUNTING}/${encodeURIComponent(id)}`
}
export function getInventoryValuationDetailPath(id: string): string {
  return `${ROUTES.INVENTORY_VALUATION}/${encodeURIComponent(id)}`
}
export function isWarehouseDetentionMemoPath(pathname: string): boolean {
  const path = (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/"
  return (
    path === ROUTES.WAREHOUSE_DETENTION_MEMO ||
    path.startsWith(`${ROUTES.WAREHOUSE_DETENTION_MEMO}/`)
  )
}

export function getDetentionMemoListPath(pathname?: string): string {
  if (pathname && isWarehouseDetentionMemoPath(pathname)) {
    return ROUTES.WAREHOUSE_DETENTION_MEMO
  }
  return ROUTES.DETENTION_MEMO
}

export function getDetentionMemoCreatePath(pathname?: string): string {
  return `${getDetentionMemoListPath(pathname)}/create`
}

export function getDetentionMemoDetailPath(id: string, pathname?: string): string {
  return `${getDetentionMemoListPath(pathname)}/${encodeURIComponent(id)}`
}

export function getDetentionMemoSectionCrumb(pathname: string): { label: string; href: string } {
  if (isWarehouseDetentionMemoPath(pathname)) {
    return { label: "Warehouse Management", href: ROUTES.OPERATIONS_DASHBOARD }
  }
  return { label: "Seizure Management", href: ROUTES.SEIZURE_MANAGEMENT }
}
export function getDepositAccountRegisterDetailPath(id: string): string {
  return `${ROUTES.DEPOSIT_ACCOUNT_REGISTER}/${encodeURIComponent(id)}`
}
export function getDestructionDetailPath(id: string): string {
  return `${ROUTES.DESTRUCTION}/${encodeURIComponent(id)}`
}
export function getSeizedInventoryDetailPath(id: string): string {
  return `${ROUTES.SEIZED_INVENTORY}/${encodeURIComponent(id)}`
}
export function getSeizureMgmtRecoveryMemoDetailPath(id: string): string {
  return `${ROUTES.SEIZURE_MGMT_RECOVERY_MEMO}/${encodeURIComponent(id)}`
}
export function getSeizureMgmtSeizureReportDetailPath(id: string): string {
  return `${ROUTES.SEIZURE_MGMT_SEIZURE_REPORT}/${encodeURIComponent(id)}`
}
export function getSeizureMgmtNoteSheetDetailPath(id: string): string {
  return `${ROUTES.SEIZURE_MGMT_NOTE_SHEET}/${encodeURIComponent(id)}`
}
export function getSeizureMgmtNoteSheetEditPath(id: string): string {
  return `${ROUTES.SEIZURE_MGMT_NOTE_SHEET}/${encodeURIComponent(id)}/edit`
}
export function getSeizureMgmtAssessmentDetailPath(id: string): string {
  return `${ROUTES.SEIZURE_MGMT_ASSESSMENT}/${encodeURIComponent(id)}`
}
export function getSeizureMgmtAssessmentEditPath(id: string): string {
  return `${ROUTES.SEIZURE_MGMT_ASSESSMENT}/${encodeURIComponent(id)}/edit`
}
export function getActivityLogDetailPath(id: number | string): string {
  return `${ROUTES.LOGS}/${encodeURIComponent(String(id))}`
}

/** Returns true if pathname is the login route */
export function isLoginRoute(pathname: string): boolean {
  return pathname === ROUTES.LOGIN
}

/** Returns true if pathname is the dashboard (root) */
export function isDashboardRoute(pathname: string): boolean {
  return pathname === ROUTES.DASHBOARD
}

/** URL for the shared visitor detail page (used by both Walk-In and Pre-Registration). */
export function getVisitorDetailPath(id: number | string): string {
  return `/visitors/${id}`
}

export function getVisitorEditPath(id: number | string): string {
  return `/visitors/${id}/edit`
}

/** Build path to People Database person detail page */
export function getPeopleDatabaseDetailPath(id: number | string): string {
  return `/people-database/${encodeURIComponent(String(id))}`
}

/** Nav item for sidebar (leaf) */
export interface NavItem {
  label: string
  href: RoutePath
}

/** Nav group for sidebar (with children; children can be items or nested groups). Optional overviewHref: when user clicks the group, navigate here and expand. */
export interface NavGroup {
  label: string
  children: (NavItem | NavGroup)[]
  overviewHref?: RoutePath
}

/**
 * All nav items in order; split into sections by NAV_SECTIONS.
 * Top-level order matches the admin sidebar screenshot:
 * Dashboard | Visitor…Auction | AI Monitoring | System Configuration
 */
const ALL_NAV_ITEMS: (NavItem | NavGroup)[] = [
  { label: "Dashboard", href: ROUTES.DASHBOARD },
  {
    label: "Visitor Management",
    overviewHref: ROUTES.VISITOR_MANAGEMENT_OVERVIEW,
    children: [
      {
        label: "Visitor Registration",
        children: [
          { label: "Pre-Registration", href: ROUTES.PRE_REGISTRATION },
          { label: "Walk-In Registration", href: ROUTES.WALK_IN_REGISTRATION },
          { label: "Calendar View", href: ROUTES.CALENDAR_VIEW },
        ],
      },
      {
        label: "Security & Screening",
        children: [
          { label: "Watchlist Screening", href: ROUTES.WATCHLIST_SCREENING },
          { label: "Blacklist Management", href: ROUTES.BLACKLIST_MANAGEMENT },
          { label: "Flagged Visitor Alerts", href: ROUTES.FLAGGED_VISITOR_ALERTS },
        ],
      },
      {
        label: "Access Control",
        children: [
          { label: "Zone Restrictions", href: ROUTES.ZONE_RESTRICTIONS },
          { label: "Gate Integration", href: ROUTES.GATE_INTEGRATION },
          { label: "Escort Requirement", href: ROUTES.ESCORT_REQUIREMENT },
        ],
      },
      {
        label: "Host & Department",
        children: [
          { label: "Visitor Notifications", href: ROUTES.VISITOR_NOTIFICATIONS },
          { label: "Upcoming Visits", href: ROUTES.UPCOMING_VISITS },
          { label: "Visitor History", href: ROUTES.VISITOR_HISTORY },
        ],
      },
      { label: "Guard & Reception Panel", href: ROUTES.GUARD_RECEPTION_PANEL },
      {
        label: "Vehicle & Contractor",
        children: [
          { label: "Vehicle Registration", href: ROUTES.VEHICLE_REGISTRATION },
          { label: "Vehicle Tracking", href: ROUTES.VEHICLE_TRACKING },
          { label: "Contractor Passes", href: ROUTES.CONTRACTOR_PASSES },
          { label: "Cargo/Delivery Logs", href: ROUTES.CARGO_DELIVERY_LOGS },
        ],
      },
    ],
  },
  {
    label: "Warehouse Management",
    overviewHref: ROUTES.OPERATIONS_DASHBOARD,
    children: [
      { label: "Dashboard", href: ROUTES.OPERATIONS_DASHBOARD },
      {
        label: "Detentions",
        children: [{ label: "Detention Memo", href: ROUTES.WAREHOUSE_DETENTION_MEMO }],
      },
      {
        label: "Deposit Account",
        children: [
          { label: "Deposit Account Register", href: ROUTES.DEPOSIT_ACCOUNT_REGISTER },
        ],
      },
      {
        label: "Seizure & Receipt",
        children: [
          { label: "New Seizure Entry", href: ROUTES.NEW_SEIZURE_ENTRY },
          { label: "Goods Receipt & Handover", href: ROUTES.GOODS_RECEIPT_HANDOVER },
          { label: "AI Item Cataloging", href: ROUTES.AI_ITEM_CATALOGING },
          { label: "QR Code Generation", href: ROUTES.QR_CODE_GENERATION },
          { label: "Seizure Register", href: ROUTES.SEIZURE_REGISTER },
        ],
      },
      { label: "Destruction", href: ROUTES.DESTRUCTION },
      {
        label: "Warehouse",
        children: [
          { label: "Warehouse Setup", href: ROUTES.WAREHOUSE_SETUP },
          { label: "Zone & Location", href: ROUTES.ZONE_LOCATION_MANAGEMENT },
          { label: "Storage Allocation", href: ROUTES.STORAGE_ALLOCATION },
          { label: "Stock Reconciliation", href: ROUTES.STOCK_RECONCILIATION },
          { label: "Release Inventory", href: ROUTES.RELEASE_INVENTORY },
          { label: "Camera Integration", href: ROUTES.CAMERA_INTEGRATION },
        ],
      },
      {
        label: "Inventory Management",
        children: [
          { label: "Goods Receipt", href: ROUTES.GOODS_RECEIPT },
          { label: "Stock Management", href: ROUTES.STOCK_MANAGEMENT },
          { label: "Cycle Counting & Audit", href: ROUTES.CYCLE_COUNTING },
          { label: "Inventory Valuation", href: ROUTES.INVENTORY_VALUATION },
        ],
      },
      {
        label: "Transfers & Handover",
        children: [
          { label: "Inter-Collectorate Transfer", href: ROUTES.INTER_COLLECTORATE_TRANSFER },
          { label: "Internal Movement", href: ROUTES.INTERNAL_MOVEMENT },
          { label: "Handover Requests", href: ROUTES.HANDOVER_REQUESTS },
          { label: "Double Authentication", href: ROUTES.DOUBLE_AUTHENTICATION },
          { label: "Transfer Tracking", href: ROUTES.TRANSFER_TRACKING },
        ],
      },
      {
        label: "Perishable Management",
        children: [
          { label: "Perishable Register", href: ROUTES.PERISHABLE_REGISTER },
          { label: "Expiry Tracking", href: ROUTES.EXPIRY_TRACKING },
          { label: "Priority Disposal Queue", href: ROUTES.PRIORITY_DISPOSAL_QUEUE },
          { label: "Destruction Orders", href: ROUTES.DESTRUCTION_ORDERS },
          { label: "Lot Creation", href: ROUTES.LOT_CREATION },
          { label: "Item Valuation", href: ROUTES.ITEM_VALUATION },
        ],
      },
      {
        label: "Download Reports",
        children: [
          { label: "Standard Reports", href: ROUTES.STANDARD_REPORTS },
          { label: "Custom Report Builder", href: ROUTES.CUSTOM_REPORT_BUILDER },
          { label: "Export Center", href: ROUTES.EXPORT_CENTER },
        ],
      },
      { label: "HS Codes file", href: ROUTES.HS_CODES_FILE },
    ],
  },
  {
    label: "Seizure Management",
    overviewHref: ROUTES.SEIZURE_MANAGEMENT,
    children: [
      { label: "Dashboard", href: ROUTES.SEIZURE_MANAGEMENT },
      { label: "Note Sheet", href: ROUTES.SEIZURE_MGMT_NOTE_SHEET },
      {
        label: "Detention",
        children: [
          { label: "New Detention Memo", href: ROUTES.DETENTION_MEMO },
          { label: "Assessment", href: ROUTES.SEIZURE_MGMT_ASSESSMENT },
          { label: "Reporting", href: ROUTES.SEIZURE_MGMT_DETENTION_REPORTING },
        ],
      },
      {
        label: "Recovery Memo",
        children: [
          { label: "Create Recovery Memo", href: ROUTES.SEIZURE_MGMT_RECOVERY_MEMO },
          { label: "Reporting", href: ROUTES.SEIZURE_MGMT_RECOVERY_REPORTING },
        ],
      },
      {
        label: "Seizure Report",
        children: [
          { label: "Create Seizure Report", href: ROUTES.SEIZURE_MGMT_SEIZURE_REPORT },
        ],
      },
      { label: "Reports", href: ROUTES.SEIZURE_MGMT_REPORTS },
    ],
  },
  {
    label: "Human Resource",
    children: [
      { label: "Employees", href: ROUTES.EMPLOYEES },
      { label: "Face Enrollment", href: ROUTES.FACE_ENROLLMENT },
      { label: "Attendance Monitor", href: ROUTES.ATTENDANCE_MONITOR },
      { label: "Attendance Dashboard", href: ROUTES.ATTENDANCE_DASHBOARD },
      { label: "Attendance", href: ROUTES.ATTENDANCE },
      { label: "Attendance Reports", href: ROUTES.ATTENDANCE_REPORTS },
      { label: "Leave", href: ROUTES.LEAVE_MANAGEMENT },
      { label: "Payroll", href: ROUTES.PAYROLL },
      { label: "Recruitment", href: ROUTES.RECRUITMENT },
    ],
  },
  {
    label: "Armory",
    children: [{ label: "Armory Dashboard", href: ROUTES.ARMORY }],
  },
  {
    label: "Litigation Management",
    children: [
      {
        label: "Cases",
        children: [
          { label: "FIR Registration", href: ROUTES.FIR_REGISTRATION },
          { label: "Case File Creation", href: ROUTES.CASE_FILE_CREATION },
          { label: "Court Proceedings", href: ROUTES.COURT_PROCEEDINGS },
          { label: "Legal Documents", href: ROUTES.LEGAL_DOCUMENTS },
          { label: "Case Status Tracking", href: ROUTES.CASE_STATUS_TRACKING },
        ],
      },
    ],
  },
  {
    label: "Auction Management",
    children: [
      { label: "ASO Portal Sync", href: ROUTES.ASO_PORTAL_SYNC },
      { label: "Bidding Management", href: ROUTES.BIDDING_MANAGEMENT },
      { label: "Sale Completion", href: ROUTES.SALE_COMPLETION },
      { label: "Revenue Reports", href: ROUTES.REVENUE_REPORTS },
    ],
  },
  {
    label: "AI Monitoring & Analytics",
    children: [
      { label: "Dashboard", href: ROUTES.ANALYTICS_DASHBOARD },
      { label: "AI Models", href: ROUTES.AI_MODELS },
      {
        label: "AI Computer Vision",
        children: [
          { label: "Cameras", href: ROUTES.CAMERA_MANAGEMENT },
          { label: "Object Detection", href: ROUTES.OBJECT_DETECTION },
          { label: "Object Tracking", href: ROUTES.OBJECT_TRACKING },
          { label: "Person Journey", href: ROUTES.PERSON_JOURNEY },
          { label: "GPS Tracking", href: ROUTES.GPS_TRACKING },
          { label: "ANPR Settings", href: ROUTES.ANPR_SETTINGS },
          { label: "Number Plate Tracking", href: ROUTES.ANPR_VEHICLE_TRACKING },
          { label: "Vehicle Journey", href: ROUTES.VEHICLE_JOURNEY },
          { label: "Vehicle Detection", href: ROUTES.NUMBER_PLATE_DETECTION },
          { label: "Anomaly Detection", href: ROUTES.ANOMALY_DETECTION },
        ],
      },
      {
        label: "AI JCP/Toll Operations",
        children: [{ label: "Plaza Entry (ANPR)", href: ROUTES.JCP_TOLL_PLAZA_ENTRY }],
      },
      {
        label: "AI Surveillance & Monitoring",
        children: [
          { label: "Live View", href: ROUTES.LIVE_CAMERA_GRID },
          { label: "LPR/ANPR", href: ROUTES.JCP_TOLL_PLAZA_ENTRY },
          { label: "Playback & Search", href: ROUTES.PLAYBACK_SEARCH },
          { label: "Thermal Imaging", href: ROUTES.THERMAL_IMAGING },
        ],
      },
      {
        label: "AI Rules & Configuration",
        children: [
          { label: "Zones", href: ROUTES.AI_ZONES },
          { label: "Rules", href: ROUTES.AI_RULES },
          { label: "Training", href: ROUTES.AI_TRAINING },
        ],
      },
      {
        label: "AI Incident Management",
        children: [
          { label: "AI Incident Management", href: ROUTES.AI_INCIDENT_MANAGEMENT },
          { label: "Incident Creation", href: ROUTES.INCIDENT_CREATION },
        ],
      },
      {
        label: "AI Databases",
        children: [
          { label: "People Database", href: ROUTES.PEOPLE_DATABASE },
          { label: "Vehicle Database", href: ROUTES.VEHICLE_DATABASE },
          { label: "Vehicle Detection", href: ROUTES.VEHICLE_DETECTION },
          { label: "Database Tables", href: ROUTES.DATABASE_TABLES },
        ],
      },
      {
        label: "AI Monitoring & Alerts",
        children: [
          { label: "Alerts & Notifications", href: ROUTES.ALERTS_NOTIFICATIONS },
          { label: "AI Detection Alerts", href: ROUTES.AI_MONITORING },
          { label: "Thermal Alerts", href: ROUTES.AI_ALERTS_DASHBOARD },
          { label: "Zone Alerts", href: ROUTES.AI_ALERTS_HISTORY },
          { label: "System Alerts", href: ROUTES.AI_ALERTS_CONFIGURATION },
        ],
      },
      {
        label: "AI Analytics & Insights",
        children: [
          { label: "Reports & Analytics", href: ROUTES.REPORTS },
          { label: "Predictive Insights", href: ROUTES.PREDICTIVE_INSIGHTS },
          { label: "Data Visualization", href: ROUTES.DATA_VISUALIZATION },
        ],
      },
    ],
  },
  {
    label: "System Configuration",
    children: [
      { label: "General Settings", href: ROUTES.GENERAL_SETTINGS },
      { label: "Roles & Permissions", href: ROUTES.USER_ROLE_MANAGEMENT },
      { label: "Integrations", href: ROUTES.INTEGRATIONS },
      { label: "Notifications", href: ROUTES.NOTIFICATIONS },
      { label: "Security & Access", href: ROUTES.SECURITY_ACCESS },
      { label: "Logs", href: ROUTES.LOGS },
    ],
  },
]

/** Sidebar navigation sections: each has a title and list of groups or items */
export const NAV_SECTIONS: { title: string; items: (NavItem | NavGroup)[] }[] = [
  { title: "Main Menu", items: ALL_NAV_ITEMS.slice(0, 1) },
  { title: "Management System", items: ALL_NAV_ITEMS.slice(1, 8) },
  { title: "Reports and Monitoring", items: ALL_NAV_ITEMS.slice(8, 9) },
  { title: "System", items: ALL_NAV_ITEMS.slice(9, 10) },
]

export type NavSection = { title: string; items: (NavItem | NavGroup)[] }

const VISITOR_MANAGEMENT_NAV = ALL_NAV_ITEMS[1] as NavGroup
const WAREHOUSE_MANAGEMENT_NAV = ALL_NAV_ITEMS[2] as NavGroup
const SEIZURE_MANAGEMENT_NAV = ALL_NAV_ITEMS[3] as NavGroup
const HUMAN_RESOURCE_NAV = ALL_NAV_ITEMS[4] as NavGroup
const AUCTION_MANAGEMENT_NAV = ALL_NAV_ITEMS[7] as NavGroup

const VEHICLE_MANAGEMENT_NAV: NavGroup = {
  label: "Vehicle Management",
  children: [
    { label: "Vehicle Registration", href: ROUTES.VEHICLE_REGISTRATION },
    { label: "Vehicle Tracking", href: ROUTES.VEHICLE_TRACKING },
    { label: "Contractor Passes", href: ROUTES.CONTRACTOR_PASSES },
    { label: "Cargo/Delivery Logs", href: ROUTES.CARGO_DELIVERY_LOGS },
  ],
}

const INCIDENT_MANAGEMENT_NAV: NavGroup = {
  label: "Incident Management",
  children: [
    { label: "AI Incident Management", href: ROUTES.AI_INCIDENT_MANAGEMENT },
    { label: "Incident Creation", href: ROUTES.INCIDENT_CREATION },
  ],
}

const VISITOR_OVERVIEW_NAV: NavItem = {
  label: "Visitor Management Overview",
  href: ROUTES.VISITOR_MANAGEMENT_OVERVIEW,
}

const WAREHOUSE_SUPERINTENDENT_WAREHOUSE_NAV: NavGroup = {
  label: "Warehouse Management",
  children: [
    { label: "Dashboard", href: ROUTES.OPERATIONS_DASHBOARD },
    { label: "Goods Receipt", href: ROUTES.GOODS_RECEIPT },
    { label: "Deposit Account Register", href: ROUTES.DEPOSIT_ACCOUNT_REGISTER },
    { label: "Seizure Register", href: ROUTES.SEIZURE_REGISTER },
    { label: "Examination", href: ROUTES.WAREHOUSE_DETENTION_MEMO },
    { label: "Inventory Valuation", href: ROUTES.INVENTORY_VALUATION },
    { label: "Item Valuation", href: ROUTES.ITEM_VALUATION },
    { label: "Stock Management", href: ROUTES.STOCK_MANAGEMENT },
    { label: "Bin Management", href: ROUTES.STORAGE_ALLOCATION },
  ],
}

const WAREHOUSE_IN_CHARGE_WAREHOUSE_NAV: NavGroup = {
  label: "Warehouse Management",
  children: [
    { label: "Dashboard", href: ROUTES.OPERATIONS_DASHBOARD },
    { label: "Goods Receipt", href: ROUTES.GOODS_RECEIPT },
    { label: "Deposit Account Register", href: ROUTES.DEPOSIT_ACCOUNT_REGISTER },
    { label: "Stock Management", href: ROUTES.STOCK_MANAGEMENT },
    { label: "Bin Management", href: ROUTES.STORAGE_ALLOCATION },
  ],
}

const EXAMINATION_OFFICER_WAREHOUSE_NAV: NavGroup = {
  label: "Warehouse Management",
  children: [
    { label: "Dashboard", href: ROUTES.OPERATIONS_DASHBOARD },
    { label: "Detention Memo", href: ROUTES.WAREHOUSE_DETENTION_MEMO },
    { label: "Seizure Register", href: ROUTES.SEIZURE_REGISTER },
    { label: "Inventory Valuation", href: ROUTES.INVENTORY_VALUATION },
    { label: "Item Valuation", href: ROUTES.ITEM_VALUATION },
    { label: "Stock Management", href: ROUTES.STOCK_MANAGEMENT },
  ],
}

const STOCK_CONTROLLER_WAREHOUSE_NAV: NavGroup = {
  label: "Warehouse Management",
  children: [
    { label: "Dashboard", href: ROUTES.OPERATIONS_DASHBOARD },
    { label: "Deposit Account Register", href: ROUTES.DEPOSIT_ACCOUNT_REGISTER },
    { label: "Stock Management", href: ROUTES.STOCK_MANAGEMENT },
    { label: "Bin Management", href: ROUTES.STORAGE_ALLOCATION },
  ],
}

const AUDITOR_WAREHOUSE_NAV: NavGroup = {
  label: "Warehouse Management",
  children: [
    { label: "Dashboard", href: ROUTES.OPERATIONS_DASHBOARD },
    { label: "Goods Receipt", href: ROUTES.GOODS_RECEIPT },
    { label: "Deposit Account Register", href: ROUTES.DEPOSIT_ACCOUNT_REGISTER },
    { label: "Seizure Register", href: ROUTES.SEIZURE_REGISTER },
    { label: "Examination", href: ROUTES.WAREHOUSE_DETENTION_MEMO },
    { label: "Inventory Valuation", href: ROUTES.INVENTORY_VALUATION },
    { label: "Item Valuation", href: ROUTES.ITEM_VALUATION },
    { label: "Stock Management", href: ROUTES.STOCK_MANAGEMENT },
    { label: "Bin Management", href: ROUTES.STORAGE_ALLOCATION },
  ],
}

/** Role-scoped sidebar: one module only. */
export const RECEPTIONIST_NAV_SECTIONS: NavSection[] = [
  { title: "Visitor Management", items: [VISITOR_MANAGEMENT_NAV] },
]

export const WAREHOUSE_OFFICER_NAV_SECTIONS: NavSection[] = [
  { title: "Warehouse Management", items: [WAREHOUSE_MANAGEMENT_NAV] },
  { title: "Seizure Management", items: [SEIZURE_MANAGEMENT_NAV] },
]

export const WAREHOUSE_SUPERINTENDENT_NAV_SECTIONS: NavSection[] = [
  { title: "Visitor Management", items: [VISITOR_OVERVIEW_NAV] },
  { title: "Warehouse Management", items: [WAREHOUSE_SUPERINTENDENT_WAREHOUSE_NAV] },
  { title: "Seizure Management", items: [SEIZURE_MANAGEMENT_NAV] },
  { title: "Vehicle Management", items: [VEHICLE_MANAGEMENT_NAV] },
  { title: "Incident Management", items: [INCIDENT_MANAGEMENT_NAV] },
  { title: "Auction Management", items: [AUCTION_MANAGEMENT_NAV] },
  { title: "System", items: [{ label: "Logs", href: ROUTES.LOGS }] },
]

export const WAREHOUSE_IN_CHARGE_NAV_SECTIONS: NavSection[] = [
  { title: "Warehouse Management", items: [WAREHOUSE_IN_CHARGE_WAREHOUSE_NAV] },
  { title: "Vehicle Management", items: [VEHICLE_MANAGEMENT_NAV] },
  { title: "Incident Management", items: [INCIDENT_MANAGEMENT_NAV] },
]

export const EXAMINATION_OFFICER_NAV_SECTIONS: NavSection[] = [
  { title: "Warehouse Management", items: [EXAMINATION_OFFICER_WAREHOUSE_NAV] },
  { title: "Seizure Management", items: [SEIZURE_MANAGEMENT_NAV] },
]

export const STOCK_CONTROLLER_NAV_SECTIONS: NavSection[] = [
  { title: "Warehouse Management", items: [STOCK_CONTROLLER_WAREHOUSE_NAV] },
]

export const AUDITOR_NAV_SECTIONS: NavSection[] = [
  { title: "Visitor Management", items: [VISITOR_OVERVIEW_NAV] },
  { title: "Warehouse Management", items: [AUDITOR_WAREHOUSE_NAV] },
  { title: "Seizure Management", items: [SEIZURE_MANAGEMENT_NAV] },
  { title: "Vehicle Management", items: [VEHICLE_MANAGEMENT_NAV] },
  { title: "Incident Management", items: [INCIDENT_MANAGEMENT_NAV] },
  { title: "Auction Management", items: [AUCTION_MANAGEMENT_NAV] },
  { title: "System", items: [{ label: "Logs", href: ROUTES.LOGS }] },
]

export const PRAL_NAV_SECTIONS: NavSection[] = [
  { title: "Warehouse Management", items: [AUDITOR_WAREHOUSE_NAV] },
  { title: "Seizure Management", items: [SEIZURE_MANAGEMENT_NAV] },
  { title: "Auction Management", items: [AUCTION_MANAGEMENT_NAV] },
  { title: "System", items: [{ label: "Logs", href: ROUTES.LOGS }] },
]

export const IT_ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    title: "System Configuration",
    items: [
      { label: "Roles & Permissions", href: ROUTES.USER_ROLE_MANAGEMENT },
      { label: "Logs", href: ROUTES.LOGS },
    ],
  },
  {
    title: "Attendance",
    items: [
      { label: "Face Enrollment", href: ROUTES.FACE_ENROLLMENT },
      { label: "Attendance Monitor", href: ROUTES.ATTENDANCE_MONITOR },
      { label: "Attendance Dashboard", href: ROUTES.ATTENDANCE_DASHBOARD },
      { label: "Attendance", href: ROUTES.ATTENDANCE },
      { label: "Attendance Reports", href: ROUTES.ATTENDANCE_REPORTS },
    ],
  },
]

export const HR_NAV_SECTIONS: NavSection[] = [
  { title: "Human Resource", items: [HUMAN_RESOURCE_NAV] },
]

export const GUARD_NAV_SECTIONS: NavSection[] = [
  { title: "Visitor Management", items: [VISITOR_MANAGEMENT_NAV] },
  { title: "Vehicle Management", items: [VEHICLE_MANAGEMENT_NAV] },
  { title: "Incident Management", items: [{ label: "Incident Creation", href: ROUTES.INCIDENT_CREATION }] },
  { title: "GPS Tracking", items: [{ label: "GPS Tracking", href: ROUTES.GPS_TRACKING }] },
]

/** Shown when a non-admin has no custom grants and no role-default template. */
const EMPTY_NAV_SECTIONS: NavSection[] = []

export function getNavSectionsForRole(
  role: string | undefined | null,
  allowedModules?: string[] | null
): NavSection[] {
  const normalized = (role ?? "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase()

  // Super Admin — full sidebar, no Central Ops.
  if (normalized === "ADMIN") return NAV_SECTIONS

  if (
    normalized === "LOCATION_ADMIN" ||
    normalized === "OPERATION_MANAGER" ||
    normalized === "COLLECTOR" ||
    normalized === "DEPUTY_COLLECTOR" ||
    normalized === "ASSISTANT_COLLECTOR"
  ) {
    return NAV_SECTIONS
  }

  // IT Super Admin — Central Ops only.
  if (normalized === "IT_SUPERADMIN") {
    return [
      {
        title: "Central Ops",
        items: [
          { label: "Central Ops", href: ROUTES.OPS_CENTRAL },
        ],
      },
    ]
  }

  // Custom grants: only show modules Super Admin explicitly allowed (no main Dashboard).
  const modules = (allowedModules ?? []).map((m) => m.trim()).filter(Boolean)
  if (modules.length > 0) {
    return filterNavSectionsByModules(NAV_SECTIONS, modules)
  }

  // No custom grants → role default template. Never fall through to the full sidebar.
  if (normalized === "GUARD") return GUARD_NAV_SECTIONS
  if (normalized === "RECEPTIONIST") return RECEPTIONIST_NAV_SECTIONS
  if (normalized === "WAREHOUSE_OFFICER") return WAREHOUSE_OFFICER_NAV_SECTIONS
  if (normalized === "WAREHOUSE_SUPERINTENDENT") return WAREHOUSE_SUPERINTENDENT_NAV_SECTIONS
  if (normalized === "WAREHOUSE_IN_CHARGE") return WAREHOUSE_IN_CHARGE_NAV_SECTIONS
  if (normalized === "EXAMINATION_OFFICER") return EXAMINATION_OFFICER_NAV_SECTIONS
  if (normalized === "STOCK_CONTROLLER") return STOCK_CONTROLLER_NAV_SECTIONS
  if (normalized === "AUDITOR") return AUDITOR_NAV_SECTIONS
  if (normalized === "PRAL") return PRAL_NAV_SECTIONS
  if (normalized === "IT_ADMIN") return IT_ADMIN_NAV_SECTIONS
  if (normalized === "HR") return HR_NAV_SECTIONS
  return EMPTY_NAV_SECTIONS
}

/** Top-level sidebar modules Super Admin can grant (excludes Dashboard). Live from ALL_NAV_ITEMS. */
export function getSidebarModuleCatalog(): { key: string; label: string }[] {
  return ALL_NAV_ITEMS.filter((item) => {
    if ("href" in item && item.href === ROUTES.DASHBOARD) return false
    return true
  }).map((item) => ({ key: item.label, label: item.label }))
}

function filterNavSectionsByModules(
  sections: NavSection[],
  allowedModules: string[]
): NavSection[] {
  const allowed = new Set(allowedModules)
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        // Never inject the main `/` Dashboard for non-admin grants.
        if ("href" in item && !("children" in item) && item.href === ROUTES.DASHBOARD) {
          return false
        }
        return allowed.has(item.label)
      }),
    }))
    .filter((section) => section.items.length > 0)
}

/** Resolve which top-level module owns a pathname (null for dashboard / unknown). */
export function getModuleLabelForPath(
  pathname: string,
  sections: NavSection[] = NAV_SECTIONS
): string | null {
  const path = (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/"
  if (path === "/" || path === "") return null

  const PREFIX_MODULES: [string, string][] = [
    ["/visitors", "Visitor Management"],
    ["/settings/users", "System Configuration"],
    ["/settings/logs", "System Configuration"],
    ["/employees", "Human Resource"],
    ["/recruitment", "Human Resource"],
  ]
  for (const [prefix, label] of PREFIX_MODULES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return label
  }

  function pathMatchesHref(href: string): boolean {
    if (href === path) return true
    if (href.includes(":")) {
      const pattern = new RegExp(`^${href.replace(/:[^/]+/g, "[^/]+")}$`)
      return pattern.test(path)
    }
    return path.startsWith(`${href}/`)
  }

  function groupOwnsPath(group: NavGroup): boolean {
    if (group.overviewHref && pathMatchesHref(group.overviewHref)) return true
    for (const child of group.children) {
      if ("children" in child) {
        if (groupOwnsPath(child)) return true
      } else if (pathMatchesHref(child.href)) {
        return true
      }
    }
    return false
  }

  for (const section of sections) {
    for (const item of section.items) {
      if ("children" in item) {
        if (groupOwnsPath(item as NavGroup)) return item.label
      } else if (pathMatchesHref(item.href)) {
        return item.label === "Dashboard" ? null : item.label
      }
    }
  }
  return null
}

/** All leaf nav items (label + href) from the full nav tree, for favorites etc. */
export function getAllNavItems(): { label: string; href: RoutePath }[] {
  const out: { label: string; href: RoutePath }[] = []
  function walk(nodes: (NavItem | NavGroup)[]) {
    for (const node of nodes) {
      if ("href" in node) out.push({ label: node.label, href: node.href })
      else walk(node.children)
    }
  }
  for (const section of NAV_SECTIONS) walk(section.items)
  return out
}

/** Map pathname to parent menu label (for sidebar expand state). Returns null for top-level items like Dashboard. */
export function getParentMenuForPath(pathname: string): string | null {
  const ancestors = getAncestorMenusForPath(pathname)
  return ancestors.length > 0 ? ancestors[0]! : null
}

/** All group labels that contain this path (top to leaf), for expanding nested sidebar. Includes groups with matching overviewHref. */
export function getAncestorMenusForPath(
  pathname: string,
  sections: NavSection[] = NAV_SECTIONS
): string[] {
  function findInGroup(group: NavGroup, parents: string[]): string[] | null {
    if (group.overviewHref === pathname) return [...parents, group.label]
    for (const child of group.children) {
      if ("href" in child) {
        if (child.href === pathname) return [...parents, group.label]
      } else {
        const found = findInGroup(child, [...parents, group.label])
        if (found) return found
      }
    }
    return null
  }
  for (const section of sections) {
    for (const item of section.items) {
      if ("children" in item) {
        const found = findInGroup(item as NavGroup, [])
        if (found) return found
      }
    }
  }
  return []
}