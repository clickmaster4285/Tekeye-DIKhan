/**
 * Warehouse Module Spec – Fields & Flows (guide for Customs Warehouse Management)
 * Align UI forms, tables, and flows with this spec. Sidebar structure remains unchanged.
 */

// ============== SEIZURE MANAGEMENT (1.1) ==============

export const SEIZURE_REGISTRATION_FLOW = [
  "Seizure Event → Officer Arrival → Authority Verification → Legal Document Check",
  "Subject Identification → Rights Information → Witness Arrangement → Physical Seizure",
  "Photo/Video Documentation (AI) → Item Counting → Evidence Tagging → Seizure Notice Issue",
  "Acknowledgment → Transportation Arrangement → Secure Storage → Chain of Custody",
  "System Registration → Case File Creation → Notifications → Investigation Assignment",
] as const

export type SeizureRegistrationForm = {
  seizureReferenceNumber: string
  caseNumber: string
  incidentNumber: string
  seizureDate: string
  seizureTime: string
  seizureLocation: string
  gpsCoordinates: string
  locationType: string
  jurisdiction: string
  customsOfficeCode: string
  seizureAuthorityType: string
  legalBasisForSeizure: string
  courtOrderNumber: string
  primaryAgency: string
  leadOfficerName: string
  leadOfficerBadgeId: string
  subjectType: string
  subjectName: string
  subjectIdPassport: string
  subjectAddress: string
  subjectContact: string
  seizureType: string
  seizureCategory: string
  discoveryMethod: string
  totalNumberOfItems: string
  totalGrossWeight: string
  totalEstimatedValue: string
  currency: string
  temporaryStorageLocation: string
  custodianName: string
  description: string
  status: string
}

export const SEIZURE_FORM_FIELDS = [
  { key: "seizureReferenceNumber", label: "Seizure Reference Number", required: true },
  { key: "caseNumber", label: "Case Number" },
  { key: "incidentNumber", label: "Incident Number" },
  { key: "seizureDate", label: "Seizure Date", type: "date" },
  { key: "seizureTime", label: "Seizure Time", type: "time" },
  { key: "seizureLocation", label: "Seizure Location / Address", required: true },
  { key: "gpsCoordinates", label: "GPS Coordinates" },
  { key: "locationType", label: "Location Type", options: ["Port", "Airport", "Land Border", "Warehouse", "Premises", "Vehicle", "Other"] },
  { key: "jurisdiction", label: "Jurisdiction" },
  { key: "customsOfficeCode", label: "Customs Office / Station Code" },
  { key: "seizureAuthorityType", label: "Seizure Authority Type" },
  { key: "legalBasisForSeizure", label: "Legal Basis for Seizure" },
  { key: "courtOrderNumber", label: "Court Order Number (if applicable)" },
  { key: "primaryAgency", label: "Primary Agency" },
  { key: "leadOfficerName", label: "Lead Officer Name" },
  { key: "leadOfficerBadgeId", label: "Lead Officer Badge/ID" },
  { key: "subjectType", label: "Subject Type", options: ["Individual", "Company", "Unknown"] },
  { key: "subjectName", label: "Subject Name / Company Name" },
  { key: "subjectIdPassport", label: "Subject ID/Passport/Registration" },
  { key: "subjectAddress", label: "Subject Address" },
  { key: "subjectContact", label: "Subject Contact" },
  { key: "seizureType", label: "Seizure Type", options: ["Contraband", "Prohibited Goods", "Smuggled Goods", "Undeclared Goods", "Counterfeit", "Tax Evasion", "Other"] },
  { key: "seizureCategory", label: "Seizure Category", options: ["Import", "Export", "Transit", "Domestic"] },
  { key: "discoveryMethod", label: "Discovery Method", options: ["X-ray", "Physical Examination", "K9 Unit", "Intelligence", "Random Check", "Tip-off", "Surveillance"] },
  { key: "totalNumberOfItems", label: "Total Number of Items" },
  { key: "totalGrossWeight", label: "Total Gross Weight (kg)" },
  { key: "totalEstimatedValue", label: "Total Estimated Value" },
  { key: "currency", label: "Currency" },
  { key: "temporaryStorageLocation", label: "Temporary Storage Location" },
  { key: "custodianName", label: "Custodian Name" },
  { key: "description", label: "Description / Remarks" },
  { key: "status", label: "Status", options: ["Registered", "Under Investigation", "Pending Court", "Concluded"] },
] as const

// ============== RECEIPT MANAGEMENT (2.1) ==============

export const STANDARD_RECEIPT_FLOW = [
  "ASN Received → Appointment Scheduled → Supplier Arrival → Gate Entry → Security Check",
  "Bay Assignment → Unloading → Physical Count → Inspection → Quality Check",
  "Acceptance Decision → Documentation → Put-away Assignment → Inventory Update",
  "Supplier Notification → Accounts Notification → Receipt Closure",
] as const

export type ReceiptRegistrationForm = {
  receiptNumber: string
  receiptType: string
  receiptDate: string
  receiptTime: string
  expectedReceiptDate: string
  actualReceiptDate: string
  receiptStatus: string
  priority: string
  supplierId: string
  supplierName: string
  supplierContact: string
  purchaseOrderNumber: string
  invoiceNumber: string
  invoiceDate: string
  billOfLadingNumber: string
  containerNumber: string
  sealNumber: string
  carrierName: string
  vehicleRegistration: string
  driverName: string
  driverLicense: string
  gateEntryNumber: string
  gateEntryDateTime: string
  numberOfLineItems: string
  totalPackages: string
  totalGrossWeight: string
  totalVolume: string
  declaredValue: string
  currency: string
  unloadingBayNumber: string
  unloadingStartTime: string
  unloadingEndTime: string
  inspectionRequired: string
  inspectorName: string
  physicalCountDone: string
  sealIntact: string
  acceptanceStatus: string
  acceptedBy: string
  acceptanceDateTime: string
  storageZoneAssigned: string
  putAwayRequired: string
  quarantineRequired: string
  receiptValue: string
  remarks: string
}

export const RECEIPT_FORM_FIELDS = [
  { key: "receiptNumber", label: "Receipt Number (Auto-generated)", required: true },
  { key: "receiptType", label: "Receipt Type", options: ["Purchase", "Import", "Return", "Transfer", "Sample", "Consignment", "Bonded"] },
  { key: "receiptDate", label: "Receipt Date", type: "date", required: true },
  { key: "receiptTime", label: "Receipt Time", type: "time" },
  { key: "expectedReceiptDate", label: "Expected Receipt Date (from ASN)" },
  { key: "actualReceiptDate", label: "Actual Receipt Date" },
  { key: "receiptStatus", label: "Receipt Status", options: ["Scheduled", "In Progress", "Completed", "Cancelled", "On Hold"] },
  { key: "priority", label: "Priority", options: ["Standard", "Urgent", "Express"] },
  { key: "supplierId", label: "Supplier ID" },
  { key: "supplierName", label: "Supplier Name", required: true },
  { key: "supplierContact", label: "Supplier Contact Person" },
  { key: "purchaseOrderNumber", label: "Purchase Order Number" },
  { key: "invoiceNumber", label: "Invoice Number" },
  { key: "invoiceDate", label: "Invoice Date" },
  { key: "billOfLadingNumber", label: "Bill of Lading / Airway Bill Number" },
  { key: "containerNumber", label: "Container Number(s)" },
  { key: "sealNumber", label: "Seal Number(s)" },
  { key: "carrierName", label: "Carrier Name" },
  { key: "vehicleRegistration", label: "Vehicle Registration Number" },
  { key: "driverName", label: "Driver Name" },
  { key: "driverLicense", label: "Driver License Number" },
  { key: "gateEntryNumber", label: "Gate Entry Number" },
  { key: "gateEntryDateTime", label: "Gate Entry Date/Time" },
  { key: "numberOfLineItems", label: "Number of Line Items" },
  { key: "totalPackages", label: "Total Packages/Cartons" },
  { key: "totalGrossWeight", label: "Total Gross Weight (kg)" },
  { key: "totalVolume", label: "Total Volume (CBM)" },
  { key: "declaredValue", label: "Declared Value" },
  { key: "currency", label: "Currency" },
  { key: "unloadingBayNumber", label: "Unloading Bay Number" },
  { key: "unloadingStartTime", label: "Unloading Start Time" },
  { key: "unloadingEndTime", label: "Unloading End Time" },
  { key: "inspectionRequired", label: "Inspection Required", options: ["Yes", "No"] },
  { key: "inspectorName", label: "Inspector Name" },
  { key: "physicalCountDone", label: "Physical Count Done", options: ["Yes", "No"] },
  { key: "sealIntact", label: "Seal Intact", options: ["Yes", "No"] },
  { key: "acceptanceStatus", label: "Acceptance Status", options: ["Fully Accepted", "Partially Accepted", "Rejected", "Conditional"] },
  { key: "acceptedBy", label: "Accepted By" },
  { key: "acceptanceDateTime", label: "Acceptance Date/Time" },
  { key: "storageZoneAssigned", label: "Storage Zone Assigned" },
  { key: "putAwayRequired", label: "Put-away Required", options: ["Yes", "No"] },
  { key: "quarantineRequired", label: "Quarantine Required", options: ["Yes", "No"] },
  { key: "receiptValue", label: "Receipt Value (Total)" },
  { key: "remarks", label: "Remarks" },
] as const

// ============== WAREHOUSE MASTER (1.2) ==============

export const CREATE_WAREHOUSE_FLOW = [
  "Create Warehouse → Define Zones → Assign Storage Locations → Map Cameras → Activate",
] as const

export type WarehouseMasterForm = {
  warehouseId: string
  warehouseName: string
  locationAddress: string
  totalAreaSqFt: string
  totalAreaSqM: string
  zoneId: string
  zoneName: string
  zoneType: string
  storageCapacity: string
  currentOccupancy: string
  temperatureRange: string
  humidityRange: string
  securityLevel: string
  rackId: string
  binId: string
  coordinatesXYZ: string
  cameraIdsCoveringZone: string
  accessPoints: string
  fireSafetyEquipment: string
  status: string
}

export const WAREHOUSE_MASTER_FIELDS = [
  { key: "warehouseId", label: "Warehouse ID" },
  { key: "warehouseName", label: "Warehouse Name", required: true },
  { key: "locationAddress", label: "Location / Address", required: true },
  { key: "totalAreaSqFt", label: "Total Area (sq ft)" },
  { key: "totalAreaSqM", label: "Total Area (sq m)" },
  { key: "zoneId", label: "Zone ID" },
  { key: "zoneName", label: "Zone Name" },
  { key: "zoneType", label: "Zone Type", options: ["Bonded", "Non-bonded", "Quarantine", "Inspection", "Dispatch"] },
  { key: "storageCapacity", label: "Storage Capacity" },
  { key: "currentOccupancy", label: "Current Occupancy" },
  { key: "temperatureRange", label: "Temperature Range" },
  { key: "humidityRange", label: "Humidity Range" },
  { key: "securityLevel", label: "Security Level" },
  { key: "rackId", label: "Rack ID" },
  { key: "binId", label: "Bin ID" },
  { key: "coordinatesXYZ", label: "Coordinates (X, Y, Z)" },
  { key: "cameraIdsCoveringZone", label: "Camera IDs Covering Zone" },
  { key: "accessPoints", label: "Access Points" },
  { key: "fireSafetyEquipment", label: "Fire Safety Equipment" },
  { key: "status", label: "Status", options: ["Active", "Inactive", "Maintenance"] },
] as const

// Table columns for list views (spec-aligned)
export const SEIZURE_TABLE_COLUMNS = [
  "Seizure Reference",
  "Case Number",
  "Seizure Date",
  "Seizure Time",
  "Location",
  "Location Type",
  "Primary Agency",
  "Subject Name",
  "Seizure Type",
  "Total Items",
  "Estimated Value",
  "Status",
  "Actions",
] as const

export const RECEIPT_TABLE_COLUMNS = [
  "Receipt Number",
  "Receipt Type",
  "Receipt Date",
  "Supplier Name",
  "PO Number",
  "Invoice Number",
  "Gate Entry",
  "Packages",
  "Acceptance Status",
  "Status",
  "Actions",
] as const

export const WAREHOUSE_TABLE_COLUMNS = [
  "Warehouse ID",
  "Warehouse Name",
  "Location",
  "Total Area",
  "Zone",
  "Storage Capacity",
  "Current Occupancy",
  "Status",
  "Actions",
] as const
