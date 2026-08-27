/**
 * Case & FIR spec – fields for FIR Registration and Case Management.
 * Use for forms, tables, and validation.
 */

// ============== FIR REGISTRATION ==============

export type FirStatus =
  | "Registered"
  | "Under Investigation"
  | "Challan Filed"
  | "In Court"
  | "Closed"

export interface FirRegistrationForm {
  // FIR identification
  firNumber: string
  registrationDate: string
  registrationTime: string
  customsOfficeStation: string
  stationCode: string
  districtRegion: string

  // Complainant / Informant
  complainantName: string
  complainantFatherName: string
  complainantCnic: string
  complainantAddress: string
  complainantContact: string
  complainantEmail: string

  // Accused
  accusedName: string
  accusedFatherName: string
  accusedCnic: string
  accusedAddress: string
  accusedUnknown: string // Yes/No
  accusedNationality: string
  accusedOccupation: string

  // Occurrence
  dateOfOccurrence: string
  timeOfOccurrence: string
  placeOfOccurrence: string
  placeDetails: string
  descriptionOfOffence: string
  sectionOfLaw: string
  sectionDetails: string

  // Property (if any)
  propertyInvolved: string
  propertyDescription: string
  propertyValue: string
  currency: string

  // Witnesses
  witness1Name: string
  witness1Address: string
  witness1Contact: string
  witness2Name: string
  witness2Address: string
  witness2Contact: string

  // Investigation
  investigationOfficerName: string
  investigationOfficerBadgeId: string
  investigationOfficerContact: string
  seizureReference: string
  seizureId: string
  caseNumber: string

  // Status & remarks
  status: FirStatus
  remarks: string
}

export const FIR_TABLE_COLUMNS = [
  "FIR No",
  "Reg. Date",
  "Station",
  "Complainant",
  "Accused",
  "Place of Occurrence",
  "Section",
  "Investigation Officer",
  "Seizure Ref",
  "Status",
  "Actions",
] as const

// ============== CASE MANAGEMENT ==============

export type CaseType = "Criminal" | "Civil" | "Administrative"
export type CaseCategory = "Smuggling" | "Tax Evasion" | "Contraband" | "Counterfeit" | "Other"
export type CasePriority = "Low" | "Medium" | "High" | "Critical"
export type CaseStatus = "Investigation" | "Prosecution" | "In Court" | "Appeal" | "Concluded" | "Closed"

export interface CaseFileForm {
  caseId: string
  caseNumber: string
  firReference: string
  seizureId: string
  caseType: CaseType
  caseCategory: CaseCategory
  casePriority: CasePriority
  caseStatus: CaseStatus
  caseOpeningDate: string
  caseClosureDate: string
  leadInvestigatorName: string
  leadInvestigatorBadgeId: string
  accusedName: string
  accusedId: string
  primaryCharge: string
  chargeLegalReference: string
  courtName: string
  courtType: string
  courtCaseNumber: string
  judgeName: string
  nextHearingDate: string
  prosecutorName: string
  prosecutorContact: string
  defenseCounselName: string
  remarks: string
}

export const CASE_TABLE_COLUMNS = [
  "Case ID",
  "Case Number",
  "FIR Ref",
  "Seizure ID",
  "Type",
  "Category",
  "Priority",
  "Status",
  "Accused",
  "Primary Charge",
  "Court",
  "Next Hearing",
  "Actions",
] as const

export const CUSTOMS_STATIONS = [
  "Kohat",
  "Mardan",
  // "Custom Peshawar",
  // "Nowshera",
  // "Customs Faisalabad",
  "Yarik",
  "DI Khan",
  "SWH Ratta Kulachi",
  "Peshawar",
  // "Customs Quetta",
  "Nowshera",
] as const
