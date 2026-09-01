/**
 * Lazy-loaded page components. One entry per screen.
 * Page names must match the "page" field in route-list.ts.
 * PAGE_LOADERS are used for hover/focus prefetch before navigation.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from "react"

type PageLoader = () => Promise<{ default: ComponentType<unknown> }>

export const PAGE_LOADERS = {
  NotFound: () => import("@/pages/NotFound").then((m) => ({ default: m.NotFound })),
  Login: () => import("@/pages/auth/login").then((m) => ({ default: m.default })),
  Dashboard: () => import("@/pages/dashboard/Dashboard").then((m) => ({ default: m.Dashboard })),
  VisitorManagementOverview: () => import("@/pages/vms/VisitorManagementOverview").then((m) => ({ default: m.VisitorManagementOverview })),
  PreRegistration: () => import("@/pages/registration/PreRegistration").then((m) => ({ default: m.default })),
  WalkInRegistration: () => import("@/pages/registration/WalkInRegistration").then((m) => ({ default: m.default })),
  VisitorDetail: () => import("@/pages/registration/VisitorDetail").then((m) => ({ default: m.default })),
  VisitorEdit: () => import("@/pages/registration/VisitorEdit").then((m) => ({ default: m.default })),
  StreamedUpload: () => import("@/pages/registration/StreamedUpload").then((m) => ({ default: m.default })),
  PhotoCapture: () => import("@/pages/registration/PhotoCapture").then((m) => ({ default: m.default })),
  QRCodeGeneration: () => import("@/pages/registration/QRCodeGeneration").then((m) => ({ default: m.default })),
  AppointmentScheduling: () => import("@/pages/registration/AppointmentScheduling").then((m) => ({ default: m.default })),
  TimeSlotBooking: () => import("@/pages/registration/TimeSlotBooking").then((m) => ({ default: m.default })),
  HostSelection: () => import("@/pages/registration/HostSelection").then((m) => ({ default: m.default })),
  VisitPurpose: () => import("@/pages/registration/VisitPurpose").then((m) => ({ default: m.default })),
  CalendarView: () => import("@/pages/registration/CalendarView").then((m) => ({ default: m.default })),
  SecurityScreening: () => import("@/pages/registration/SecurityScreening").then((m) => ({ default: m.default })),
  WatchlistScreening: () => import("@/pages/registration/WatchlistScreening").then((m) => ({ default: m.default })),
  BlacklistManagement: () => import("@/pages/registration/BlacklistManagement").then((m) => ({ default: m.default })),
  FlaggedVisitorAlerts: () => import("@/pages/registration/FlaggedVisitorAlerts").then((m) => ({ default: m.default })),
  AccessControl: () => import("@/pages/registration/AccessControl").then((m) => ({ default: m.default })),
  ZoneRestrictions: () => import("@/pages/registration/ZoneRestrictions").then((m) => ({ default: m.default })),
  GateIntegration: () => import("@/pages/registration/GateIntegration").then((m) => ({ default: m.default })),
  EscortRequirement: () => import("@/pages/registration/EscortRequirement").then((m) => ({ default: m.default })),
  HostDepartmentDashboard: () => import("@/pages/registration/HostDepartmentDashboard").then((m) => ({ default: m.default })),
  VisitorNotifications: () => import("@/pages/registration/VisitorNotifications").then((m) => ({ default: m.default })),
  UpcomingVisits: () => import("@/pages/registration/UpcomingVisits").then((m) => ({ default: m.default })),
  VisitorHistory: () => import("@/pages/registration/VisitorHistory").then((m) => ({ default: m.default })),
  GuardReceptionPanel: () => import("@/pages/registration/GuardReceptionPanel").then((m) => ({ default: m.default })),
  VehicleContractorManagement: () => import("@/pages/registration/VehicleContractorManagement").then((m) => ({ default: m.default })),
  VehicleRegistration: () => import("@/pages/registration/VehicleRegistration").then((m) => ({ default: m.default })),
  VehicleTracking: () => import("@/pages/registration/VehicleTracking").then((m) => ({ default: m.default })),
  ContractorPasses: () => import("@/pages/registration/ContractorPasses").then((m) => ({ default: m.default })),
  CargoDeliveryLogs: () => import("@/pages/registration/CargoDeliveryLogs").then((m) => ({ default: m.default })),
  Armory: () => import("@/pages/armory/Armory").then((m) => ({ default: m.default })),
  WarehouseSetup: () => import("@/pages/warehouse/WarehouseSetup").then((m) => ({ default: m.default })),
  ZoneLocationManagement: () => import("@/pages/warehouse/ZoneLocationManagement").then((m) => ({ default: m.default })),
  StorageAllocation: () => import("@/pages/warehouse/StorageAllocation").then((m) => ({ default: m.default })),
  InventoryTracking: () => import("@/pages/warehouse/InventoryTracking").then((m) => ({ default: m.default })),
  StockReconciliation: () => import("@/pages/warehouse/StockReconciliation").then((m) => ({ default: m.default })),
  ReleaseInventory: () => import("@/pages/warehouse/ReleaseInventory").then((m) => ({ default: m.default })),
  MemoDistribution: () => import("@/pages/warehouse/MemoDistribution").then((m) => ({ default: m.default })),
  DestructionRecordDetail: () =>
    import("@/pages/warehouse/DestructionRecordDetail").then((m) => ({ default: m.default })),
  HSCodesFile: () => import("@/pages/warehouse/HSCodesFile").then((m) => ({ default: m.default })),
  DepositAccountRegister: () => import("@/pages/warehouse/DepositAccountRegister").then((m) => ({ default: m.default })),
  DepositAccountRegisterDetail: () =>
    import("@/pages/warehouse/DepositAccountRegisterDetail").then((m) => ({ default: m.default })),
  DetentionMemo: () => import("@/pages/detentions/DetentionMemo").then((m) => ({ default: m.default })),
  DetentionMemoCreate: () => import("@/pages/detentions/DetentionMemoCreate").then((m) => ({ default: m.default })),
  DetentionMemoDetail: () => import("@/pages/detentions/DetentionMemoDetail").then((m) => ({ default: m.default })),
  SeizedInventory: () => import("@/pages/detentions/SeizedInventory").then((m) => ({ default: m.default })),
  SeizedInventoryDetail: () => import("@/pages/detentions/SeizedInventoryDetail").then((m) => ({ default: m.default })),
  GoodsReceipt: () => import("@/pages/inventory/GoodsReceipt").then((m) => ({ default: m.default })),
  GoodsReceiptDetail: () => import("@/pages/inventory/GoodsReceiptDetail").then((m) => ({ default: m.default })),
  StockManagement: () => import("@/pages/inventory/StockManagement").then((m) => ({ default: m.default })),
  StockManagementDetail: () => import("@/pages/inventory/StockManagementDetail").then((m) => ({ default: m.default })),
  CycleCountingAudit: () => import("@/pages/inventory/CycleCountingAudit").then((m) => ({ default: m.default })),
  CycleCountingAuditDetail: () => import("@/pages/inventory/CycleCountingAuditDetail").then((m) => ({ default: m.default })),
  InventoryValuation: () => import("@/pages/inventory/InventoryValuation").then((m) => ({ default: m.default })),
  InventoryValuationDetail: () => import("@/pages/inventory/InventoryValuationDetail").then((m) => ({ default: m.default })),
  CameraIntegration: () => import("@/pages/cameras/CameraIntegration").then((m) => ({ default: m.default })),
  OperationsDashboard: () => import("@/pages/operations/OperationsDashboard").then((m) => ({ default: m.default })),
  AnalyticsDashboard: () => import("@/pages/operations/AnalyticsDashboard").then((m) => ({ default: m.default })),
  LiveCameraGrid: () => import("@/pages/operations/LiveCameraGrid").then((m) => ({ default: m.default })),
  OpsCentral: () => import("@/pages/operations/OpsCentral").then((m) => ({ default: m.default })),
  VehicleDetection: () => import("@/pages/operations/VehicleDetection").then((m) => ({ default: m.default })),
  AiModels: () => import("@/pages/operations/AiModels").then((m) => ({ default: m.default })),
  AiZones: () => import("@/pages/operations/AiZones").then((m) => ({ default: m.default })),
  AiRules: () => import("@/pages/operations/AiRules").then((m) => ({ default: m.default })),
  AiTraining: () => import("@/pages/operations/AiTraining").then((m) => ({ default: m.default })),
  LiveMonitoring: () => import("@/pages/cameras/LiveMonitoring").then((m) => ({ default: m.default })),
  NewSeizureEntry: () => import("@/pages/seizures/NewSeizureEntry").then((m) => ({ default: m.default })),
  JcpTollPlazaEntry: () => import("@/pages/seizures/JcpTollPlazaEntry").then((m) => ({ default: m.default })),
  GoodsReceiptHandover: () => import("@/pages/seizures/GoodsReceiptHandover").then((m) => ({ default: m.default })),
  AiItemCataloging: () => import("@/pages/seizures/AiItemCataloging").then((m) => ({ default: m.default })),
  SeizureRegister: () => import("@/pages/seizures/SeizureRegister").then((m) => ({ default: m.default })),
  FirRegistration: () => import("@/pages/seizures/FirRegistration").then((m) => ({ default: m.default })),
  CaseFileCreation: () => import("@/pages/seizures/CaseFileCreation").then((m) => ({ default: m.default })),
  CourtProceedings: () => import("@/pages/seizures/CourtProceedings").then((m) => ({ default: m.default })),
  LegalDocuments: () => import("@/pages/seizures/LegalDocuments").then((m) => ({ default: m.default })),
  CaseStatusTracking: () => import("@/pages/seizures/CaseStatusTracking").then((m) => ({ default: m.default })),
  SeizureManagementDashboard: () =>
    import("@/pages/seizure-management/SeizureManagementDashboard").then((m) => ({ default: m.default })),
  SeizureMgmtNoteSheet: () =>
    import("@/pages/seizure-management/NoteSheet").then((m) => ({ default: m.default })),
  SeizureMgmtNoteSheetCreate: () =>
    import("@/pages/seizure-management/NoteSheetCreate").then((m) => ({ default: m.default })),
  SeizureMgmtNoteSheetEdit: () =>
    import("@/pages/seizure-management/NoteSheetCreate").then((m) => ({ default: m.default })),
  SeizureMgmtNoteSheetDetail: () =>
    import("@/pages/seizure-management/NoteSheetDetail").then((m) => ({ default: m.default })),
  SeizureMgmtAssessment: () =>
    import("@/pages/seizure-management/DetentionAssessment").then((m) => ({ default: m.default })),
  SeizureMgmtAssessmentCreate: () =>
    import("@/pages/seizure-management/AssessmentCreate").then((m) => ({ default: m.default })),
  SeizureMgmtAssessmentEdit: () =>
    import("@/pages/seizure-management/AssessmentCreate").then((m) => ({ default: m.default })),
  SeizureMgmtAssessmentDetail: () =>
    import("@/pages/seizure-management/AssessmentDetail").then((m) => ({ default: m.default })),
  SeizureMgmtDetentionReporting: () =>
    import("@/pages/seizure-management/DetentionReporting").then((m) => ({ default: m.default })),
  SeizureMgmtRecoveryMemo: () =>
    import("@/pages/seizure-management/RecoveryMemo").then((m) => ({ default: m.default })),
  SeizureMgmtRecoveryMemoCreate: () =>
    import("@/pages/seizure-management/RecoveryMemoCreate").then((m) => ({ default: m.default })),
  SeizureMgmtRecoveryMemoDetail: () =>
    import("@/pages/seizure-management/RecoveryMemoDetail").then((m) => ({ default: m.default })),
  SeizureMgmtRecoveryReporting: () =>
    import("@/pages/seizure-management/RecoveryReporting").then((m) => ({ default: m.default })),
  SeizureMgmtSeizureReport: () =>
    import("@/pages/seizure-management/SeizureReport").then((m) => ({ default: m.default })),
  SeizureMgmtSeizureReportCreate: () =>
    import("@/pages/seizure-management/SeizureReportCreate").then((m) => ({ default: m.default })),
  SeizureMgmtSeizureReportDetail: () =>
    import("@/pages/seizure-management/SeizureReportDetail").then((m) => ({ default: m.default })),
  SeizureMgmtReports: () =>
    import("@/pages/seizure-management/SeizureManagementReports").then((m) => ({ default: m.default })),
  InterCollectorateTransfer: () => import("@/pages/transfers/InterCollectorateTransfer").then((m) => ({ default: m.default })),
  InternalMovement: () => import("@/pages/transfers/InternalMovement").then((m) => ({ default: m.default })),
  HandoverRequests: () => import("@/pages/transfers/HandoverRequests").then((m) => ({ default: m.default })),
  DoubleAuthentication: () => import("@/pages/transfers/DoubleAuthentication").then((m) => ({ default: m.default })),
  TransferTracking: () => import("@/pages/transfers/TransferTracking").then((m) => ({ default: m.default })),
  PerishableRegister: () => import("@/pages/inventory/PerishableRegister").then((m) => ({ default: m.default })),
  ExpiryTracking: () => import("@/pages/inventory/ExpiryTracking").then((m) => ({ default: m.default })),
  PriorityDisposalQueue: () => import("@/pages/inventory/PriorityDisposalQueue").then((m) => ({ default: m.default })),
  DestructionOrders: () => import("@/pages/inventory/DestructionOrders").then((m) => ({ default: m.default })),
  LotCreation: () => import("@/pages/inventory/LotCreation").then((m) => ({ default: m.default })),
  ItemValuation: () => import("@/pages/inventory/ItemValuation").then((m) => ({ default: m.default })),
  AsoPortalSync: () => import("@/pages/auction/AsoPortalSync").then((m) => ({ default: m.default })),
  BiddingManagement: () => import("@/pages/auction/BiddingManagement").then((m) => ({ default: m.default })),
  SaleCompletion: () => import("@/pages/auction/SaleCompletion").then((m) => ({ default: m.default })),
  RevenueReports: () => import("@/pages/auction/RevenueReports").then((m) => ({ default: m.default })),
  CameraManagement: () => import("@/pages/cameras/CameraManagement").then((m) => ({ default: m.default })),
  CameraManagementView: () => import("@/pages/cameras/CameraManagementView").then((m) => ({ default: m.default })),
  CameraIntegrationView: () =>
    import("@/pages/cameras/CameraManagementView").then((m) => ({
      default: m.CameraIntegrationViewPage,
    })),
  AnalyticsCameraManagement: () => import("@/pages/cameras/AnalyticsCameraManagement").then((m) => ({ default: m.default })),
  AnalyticsCameraManagementView: () =>
    import("@/pages/cameras/CameraManagementView").then((m) => ({
      default: m.AnalyticsCameraManagementViewPage,
    })),
  ObjectDetection: () => import("@/pages/cameras/ObjectDetection").then((m) => ({ default: m.default })),
  ObjectTracking: () => import("@/pages/operations/ObjectTracking").then((m) => ({ default: m.default })),
  ObjectTrackingDetail: () =>
    import("@/pages/operations/ObjectTrackingDetail").then((m) => ({ default: m.default })),
  PersonJourney: () => import("@/pages/operations/PersonJourney").then((m) => ({ default: m.default })),
  PersonJourneyDetail: () =>
    import("@/pages/operations/PersonJourneyDetail").then((m) => ({ default: m.default })),
  GpsTracking: () => import("@/pages/operations/GpsTracking").then((m) => ({ default: m.default })),
  VideoRecovery: () =>
    import("@/pages/video-recovery/VideoRecovery").then((m) => ({ default: m.default })),
  AnprSettings: () => import("@/pages/cameras/AnprSettings").then((m) => ({ default: m.default })),
  AnprVehicleTracking: () =>
    import("@/pages/cameras/VehicleTracking").then((m) => ({ default: m.default })),
  VehicleJourney: () => import("@/pages/cameras/VehicleJourney").then((m) => ({ default: m.default })),
  VehicleJourneyDetail: () =>
    import("@/pages/cameras/VehicleJourneyDetail").then((m) => ({ default: m.default })),
  NumberPlateDetection: () =>
    import("@/pages/cameras/NumberPlateDetection").then((m) => ({ default: m.default })),
  AnomalyDetection: () => import("@/pages/cameras/AnomalyDetection").then((m) => ({ default: m.default })),
  Reports: () => import("@/pages/reports/Reports").then((m) => ({ default: m.default })),
  PredictiveInsights: () => import("@/pages/reports/PredictiveInsights").then((m) => ({ default: m.default })),
  DataVisualization: () => import("@/pages/reports/DataVisualization").then((m) => ({ default: m.default })),
  Employees: () => import("@/pages/hr/Employees").then((m) => ({ default: m.default })),
  Recruitment: () => import("@/pages/hr/Recruitment").then((m) => ({ default: m.default })),
  AddStaff: () => import("@/pages/hr/AddStaff").then((m) => ({ default: m.default })),
  EmployeeDetail: () => import("@/pages/hr/EmployeeDetail").then((m) => ({ default: m.default })),
  EmployeeEdit: () => import("@/pages/hr/EmployeeEdit").then((m) => ({ default: m.default })),
  Attendance: () => import("@/pages/hr/Attendance").then((m) => ({ default: m.default })),
  FaceEnrollment: () => import("@/pages/hr/FaceEnrollment").then((m) => ({ default: m.default })),
  AttendanceMonitor: () => import("@/pages/hr/AttendanceMonitor").then((m) => ({ default: m.default })),
  AttendanceDashboard: () => import("@/pages/hr/AttendanceDashboard").then((m) => ({ default: m.default })),
  AttendanceReports: () => import("@/pages/hr/AttendanceReports").then((m) => ({ default: m.default })),
  LeaveManagement: () => import("@/pages/hr/LeaveManagement").then((m) => ({ default: m.default })),
  Payroll: () => import("@/pages/hr/Payroll").then((m) => ({ default: m.default })),
  GeneralSettings: () => import("@/pages/settings/GeneralSettings").then((m) => ({ default: m.default })),
  UserRoleManagement: () => import("@/pages/settings/UserRoleManagement").then((m) => ({ default: m.default })),
  UserForm: () => import("@/pages/settings/UserFormPage").then((m) => ({ default: m.default })),
  UserDetail: () => import("@/pages/settings/UserDetailPage").then((m) => ({ default: m.default })),
  Integrations: () => import("@/pages/settings/Integrations").then((m) => ({ default: m.default })),
  Notifications: () => import("@/pages/settings/Notifications").then((m) => ({ default: m.default })),
  SecurityAccess: () => import("@/pages/settings/SecurityAccess").then((m) => ({ default: m.default })),
  ActivityLogs: () => import("@/pages/settings/ActivityLogs").then((m) => ({ default: m.default })),
  ActivityLogDetail: () => import("@/pages/settings/ActivityLogDetail").then((m) => ({ default: m.default })),
  TableOfContents: () => import("@/pages/TableOfContents").then((m) => ({ default: m.default })),
  PlaybackSearch: () => import("@/pages/operations/PlaybackSearch").then((m) => ({ default: m.default })),
  ThermalImaging: () => import("@/pages/operations/ThermalImaging").then((m) => ({ default: m.default })),
  AlertsNotifications: () => import("@/pages/operations/AlertsNotifications").then((m) => ({ default: m.default })),
  IncidentManagement: () => import("@/pages/operations/IncidentManagement").then((m) => ({ default: m.default })),
  AIIncidentManagement: () => import("@/pages/operations/AIIncidentManagement").then((m) => ({ default: m.default })),
  ThermalAlerts: () => import("@/pages/operations/ThermalAlerts").then((m) => ({ default: m.default })),
  AIDetectionAlerts: () => import("@/pages/operations/AIDetectionAlerts").then((m) => ({ default: m.default })),
  ZoneAlerts: () => import("@/pages/operations/ZoneAlerts").then((m) => ({ default: m.default })),
  SystemAlerts: () => import("@/pages/operations/SystemAlerts").then((m) => ({ default: m.default })),
  PeopleDatabase: () => import("@/pages/operations/PeopleDatabase").then((m) => ({ default: m.default })),
  PeopleDatabaseDetail: () => import("@/pages/operations/PeopleDatabaseDetail").then((m) => ({ default: m.default })),
  VehicleDatabase: () => import("@/pages/operations/VehicleDatabase").then((m) => ({ default: m.default })),
  MobileApp: () => import("@/pages/operations/MobileApp").then((m) => ({ default: m.default })),
  DatabaseTables: () => import("@/pages/operations/DatabaseTables").then((m) => ({ default: m.default })),
  VehicleDatabaseDetail: () => import("@/pages/operations/VehicleDatabaseDetail").then((m) => ({ default: m.default })),
} as const satisfies Record<string, PageLoader>

function toLazyPages<T extends Record<string, PageLoader>>(loaders: T) {
  const pages = {} as { [K in keyof T]: LazyExoticComponent<ComponentType<unknown>> }
  for (const key of Object.keys(loaders) as (keyof T)[]) {
    pages[key] = lazy(loaders[key])
  }
  return pages
}

export const PAGES = toLazyPages(PAGE_LOADERS)
