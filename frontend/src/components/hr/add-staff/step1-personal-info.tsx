import { Camera, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { UploadValue } from "@/components/hr/add-staff/step2-documents-upload"
import { CameraCapture } from "@/components/camera-capture"
import { useFormik } from "formik"
import * as Yup from "yup"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import ReactSelect from "react-select"
import makeAnimated from "react-select/animated"

const animatedComponents = makeAnimated()

type EmployeeCategory = "new" | "existing"

export type AddStaffStep1Form = {
  personal_number?: string
  full_name?: string
  father_name?: string
  gender?: string
  cnic?: string
  date_of_birth?: string
  phone?: string
  email?: string
  qualification?: string[] | string
  address?: string
  bps?: string
  department?: string
  designation?: string
  role?: string
  employment_type?: string
  joining_date?: string
  current_posting?: string
  transferred_from?: string
  transferred_to?: string
  collector_name?: string
  emergency_contact?: string
  emergency_contact_name?: string
  emergency_contact_relationship?: string
  emergency_contact_phone?: string
  emergency_contact_address?: string
}

// Comprehensive qualification options organized by categories
const qualificationOptions = [
  {
    label: "Bachelor Levels (14-16 Years)",
    options: [
      { value: "B.A", label: "B.A" },
      { value: "BA", label: "BA" },
      { value: "BA/B.Ed", label: "BA/B.Ed" },
      { value: "BA Pol Sc", label: "BA Pol Sc" },
      { value: "BA (Law & Political Science)", label: "BA (Law & Political Science)" },
      { value: "BBA", label: "BBA" },
      { value: "B.Com", label: "B.Com" },
      { value: "BCS", label: "BCS" },
      { value: "BSC", label: "BSC" },
      { value: "BSc", label: "BSc" },
      { value: "B.Sc", label: "B.Sc" },
      { value: "BS", label: "BS" },
      { value: "BSC (Hons) Agriculture", label: "BSC (Hons) Agriculture" },
      { value: "BS (Hons) Biotechnology", label: "BS (Hons) Biotechnology" },
      { value: "BS Botany", label: "BS Botany" },
      { value: "BS Chemistry", label: "BS Chemistry" },
      { value: "BS Civil Engineering", label: "BS Civil Engineering" },
      { value: "BS Computer Engineering", label: "BS Computer Engineering" },
      { value: "BS Computer Science", label: "BS Computer Science" },
      { value: "BS computer Sc", label: "BS computer Sc" },
      { value: "BS Economics", label: "BS Economics" },
      { value: "BS Electrical Engineering", label: "BS Electrical Engineering" },
      { value: "BS Electrical Power Engineering", label: "BS Electrical Power Engineering" },
      { value: "BS Engineering", label: "BS Engineering" },
      { value: "BS English", label: "BS English" },
      { value: "BS Geology", label: "BS Geology" },
      { value: "BS in Mechanical Engineering and Technology", label: "BS in Mechanical Engineering and Technology" },
      { value: "BS (Microbiology)", label: "BS (Microbiology)" },
      { value: "BS Physics", label: "BS Physics" },
      { value: "BS (Socialogy)", label: "BS (Socialogy)" },
      { value: "BS Software Engineering", label: "BS Software Engineering" },
      { value: "BS (Tele)", label: "BS (Tele)" },
      { value: "BS Zoology", label: "BS Zoology" },
      { value: "B-Tech", label: "B-Tech" },
    ]
  },
  {
    label: "Master Levels (16+ Years)",
    options: [
      { value: "M.A", label: "M.A" },
      { value: "MA", label: "MA" },
      { value: "MA Arabic", label: "MA Arabic" },
      { value: "MA Economics", label: "MA Economics" },
      { value: "MA English", label: "MA English" },
      { value: "MA HPE", label: "MA HPE" },
      { value: "MA History", label: "MA History" },
      { value: "MA IR", label: "MA IR" },
      { value: "MA Islamiat", label: "MA Islamiat" },
      { value: "MA Islamiyat", label: "MA Islamiyat" },
      { value: "MA Pashto", label: "MA Pashto" },
      { value: "MA Political Science", label: "MA Political Science" },
      { value: "MA Pol Science", label: "MA Pol Science" },
      { value: "MA Urdu", label: "MA Urdu" },
      { value: "MBA", label: "MBA" },
      { value: "M.Com", label: "M.Com" },
      { value: "MSc", label: "MSc" },
      { value: "MSC", label: "MSC" },
      { value: "M.Sc", label: "M.Sc" },
      { value: "MSc Applied Economics", label: "MSc Applied Economics" },
      { value: "MSC Botany", label: "MSC Botany" },
      { value: "MSC Chemistry", label: "MSC Chemistry" },
      { value: "MSC Computer Science", label: "MSC Computer Science" },
      { value: "MSC Economics", label: "MSC Economics" },
      { value: "MSc Economics", label: "MSc Economics" },
      { value: "MSC Mathematics", label: "MSC Mathematics" },
      { value: "M.Phil", label: "M.Phil" },
      { value: "M.Phil (Pol; Sc)", label: "M.Phil (Pol; Sc)" },
      { value: "MS", label: "MS" },
      { value: "MS Computer Science", label: "MS Computer Science" },
      { value: "MS Economics", label: "MS Economics" },
      { value: "LLM", label: "LLM" },
    ]
  },
  {
    label: "Professional & Integrated Degrees",
    options: [
      { value: "DAE", label: "DAE" },
      { value: "D.Com", label: "D.Com" },
      { value: "DIT", label: "DIT" },
      { value: "LLB", label: "LLB" },
      { value: "MBA Accounting & Finance", label: "MBA Accounting & Finance" },
    ]
  },
  {
    label: "Higher Secondary / Intermediate (12 Years)",
    options: [
      { value: "FA", label: "FA" },
      { value: "F.A", label: "F.A" },
      { value: "FSC", label: "FSC" },
      { value: "FSc", label: "FSc" },
      { value: "F.Sc", label: "F.Sc" },
      { value: "Intermediate", label: "Intermediate" },
    ]
  },
  {
    label: "Secondary / Matric (10 Years)",
    options: [
      { value: "SSC", label: "SSC" },
      { value: "Matric", label: "Matric" },
    ]
  },
  {
    label: "Below Secondary",
    options: [
      { value: "Middle", label: "Middle" },
      { value: "Primary", label: "Primary" },
      { value: "U/Matric", label: "U/Matric" },
      { value: "NIL", label: "NIL" },
    ]
  },
  {
    label: "Religious Education",
    options: [
      { value: "Dars-e-Nizami", label: "Dars-e-Nizami" },
      { value: "FA & Darse Nizami (Alia-2-BA)", label: "FA & Darse Nizami (Alia-2-BA)" },
      { value: "SSC & Dars nizami", label: "SSC & Dars nizami" },
    ]
  }
]

// Designation options (single select)
const designationOptions = [
  { value: "Collector", label: "Collector" },
  { value: "Additional Collector", label: "Additional Collector" },
  { value: "Deputy Collector", label: "Deputy Collector" },
  { value: "Assistant Collector", label: "Assistant Collector" },
  { value: "Accounts Officer", label: "Accounts Officer" },
  { value: "Superintendent", label: "Superintendent" },
  { value: "Inspector", label: "Inspector" },
  { value: "Office Superintendent", label: "Office Superintendent" },
  { value: "Preventive Officer", label: "Preventive Officer" },
  { value: "Appraising Officer", label: "Appraising Officer" },
  { value: "Inspector OPS", label: "Inspector OPS" },
  { value: "APS", label: "APS" },
  { value: "DEO (Data Entry Operator)", label: "DEO (Data Entry Operator)" },
  { value: "Steno Typist", label: "Steno Typist" },
  { value: "UDC (Upper Division Clerk)", label: "UDC (Upper Division Clerk)" },
  { value: "LDC (Lower Division Clerk)", label: "LDC (Lower Division Clerk)" },
  { value: "LDC OPS", label: "LDC OPS" },
  { value: "Wireless Operator", label: "Wireless Operator" },
  { value: "Sepoy", label: "Sepoy" },
  { value: "Havaldar", label: "Havaldar" },
  { value: "Lady Sepoy", label: "Lady Sepoy" },
  { value: "Driver", label: "Driver" },
  { value: "Lady Searcher", label: "Lady Searcher" },
  { value: "Chowkidar", label: "Chowkidar" },
  { value: "Mali (Labor)", label: "Mali (Labor)" },
  { value: "Naib Qasid", label: "Naib Qasid" },
  { value: "Sanitary Worker", label: "Sanitary Worker" },
  { value: "Water Carrier", label: "Water Carrier" },
]

// Collectorate options (single select)
const collectorateOptions = [
  {
    value: "Collectorate of Customs (Enforcement), Peshawar",
    label: "Collectorate of Customs (Enforcement), Peshawar",
  },
]

// Current Place of Posting options from the provided data
const currentPostingOptions = [
  { value: "Collector", label: "Collector" },
  { value: "Addiitional Collector (HQ)", label: "Addiitional Collector (HQ)" },
  { value: "DC ASD, Peshawar/Kohat & Bannu", label: "DC ASD, Peshawar/Kohat & Bannu" },
  { value: "AC ASD, Hazara", label: "AC ASD, Hazara" },
  { value: "AC (HQ-I)", label: "AC (HQ-I)" },
  { value: "AC ASD, Nowshera & Mardan", label: "AC ASD, Nowshera & Mardan" },
  { value: "AC ASD, D.I. Khan-I & II", label: "AC ASD, D.I. Khan-I & II" },
  { value: "AC (HQ-II)", label: "AC (HQ-II)" },
  { value: "Chief Accounts Officer", label: "Chief Accounts Officer" },
  { value: "Representative of Collectorate at High Court", label: "Representative of Collectorate at High Court" },
  { value: "HQ: Technical Branch, ASD, Nowshera", label: "HQ: Technical Branch, ASD, Nowshera" },
  { value: "ASD, Hazara", label: "ASD, Hazara" },
  { value: "ASD, D.I. Khan", label: "ASD, D.I. Khan" },
  { value: "ASD, D.I. Khan-I/II", label: "ASD, D.I. Khan-I/II" },
  { value: "SWH, Peshawar (HQ)", label: "SWH, Peshawar (HQ)" },
  { value: "Central Enforcement Cell/ASD, Peshawar & HQ: Auction Cell, Refund (w.e. from 06.11.2025)", label: "Central Enforcement Cell/ASD, Peshawar & HQ: Auction Cell, Refund (w.e. from 06.11.2025)" },
  { value: "HQ: Refund/Recovery/BG Cell, Project and Reward Cell", label: "HQ: Refund/Recovery/BG Cell, Project and Reward Cell" },
  { value: "ASD, Kohat", label: "ASD, Kohat" },
  { value: "ASD, Mardan & HQ: I&P", label: "ASD, Mardan & HQ: I&P" },
  { value: "ASD, D.I. Khan-I", label: "ASD, D.I. Khan-I" },
  { value: "HQ: Monitoring Cell", label: "HQ: Monitoring Cell" },
  { value: "PSS (Home Department)", label: "PSS (Home Department)" },
  { value: "DES, Swabi (on attachment)", label: "DES, Swabi (on attachment)" },
  { value: "I&SCS & DR CAT Double Bench", label: "I&SCS & DR CAT Double Bench" },
  { value: "ASD, Mardan", label: "ASD, Mardan" },
  { value: "ASD, Peshawar", label: "ASD, Peshawar" },
  { value: "JCP M1 Peshawar", label: "JCP M1 Peshawar" },
  { value: "Anti-Smuggling Division, Hazara", label: "Anti-Smuggling Division, Hazara" },
  { value: "ASD, D.I. Khan-I (CCP Chashma)", label: "ASD, D.I. Khan-I (CCP Chashma)" },
  { value: "ASD, Peshawar (Auction Cell in addition) w.e. from 04.02.2026", label: "ASD, Peshawar (Auction Cell in addition) w.e. from 04.02.2026" },
  { value: "ASD, D.I. Khan-II", label: "ASD, D.I. Khan-II" },
  { value: "ASD, Peshawar ( in adttion HQ: Law/Legal Branch and Central Armory)", label: "ASD, Peshawar ( in adttion HQ: Law/Legal Branch and Central Armory)" },
  { value: "HQ: Audit (Internal/External) FTO Cell and HQ: CPF", label: "HQ: Audit (Internal/External) FTO Cell and HQ: CPF" },
  { value: "HQ: I&P/Refund/Project/Monitoring of Clearance of DP w.e. from 06.05.2025,", label: "HQ: I&P/Refund/Project/Monitoring of Clearance of DP w.e. from 06.05.2025," },
  { value: "HQ: Pension Cell/Refund", label: "HQ: Pension Cell/Refund" },
  { value: "ASD, Mardan (SWH Mardan in addition) w.e. from 04/02/2026", label: "ASD, Mardan (SWH Mardan in addition) w.e. from 04/02/2026" },
  { value: "ASD, Mardan (CCP Shergarh)", label: "ASD, Mardan (CCP Shergarh)" },
  { value: "S.W.H-A,B,C,D,E,F & G and (JCP Michani)", label: "S.W.H-A,B,C,D,E,F & G and (JCP Michani)" },
  { value: "HQ: General Branch & QRF in additional to her own duties w.e. from 04/09/2025", label: "HQ: General Branch & QRF in additional to her own duties w.e. from 04/09/2025" },
  { value: "I&SCS & DR CAT Single Bench", label: "I&SCS & DR CAT Single Bench" },
  { value: "HQ: Assessment Cell", label: "HQ: Assessment Cell" },
  { value: "Anti-Smuggling Division, Peshawar /I&I SWH, Peshawar (Vehicle) w.e. from 04/09/2025", label: "Anti-Smuggling Division, Peshawar /I&I SWH, Peshawar (Vehicle) w.e. from 04/09/2025" },
  { value: "ASD, Peshawar and DR at PHC", label: "ASD, Peshawar and DR at PHC" },
  { value: "DR Coordinator at Customs Appellate Tribunal, Peshawar", label: "DR Coordinator at Customs Appellate Tribunal, Peshawar" },
  { value: "Anti-Smuggling Division Office, Kohat", label: "Anti-Smuggling Division Office, Kohat" },
  { value: "ASD, Nowshera (JCP Kund) (FATA/PATA Escorting) in addition w.e. from 04/02/2026)", label: "ASD, Nowshera (JCP Kund) (FATA/PATA Escorting) in addition w.e. from 04/02/2026)" },
  { value: "HQ: State Warehouse E (Vehicles)", label: "HQ: State Warehouse E (Vehicles)" },
  { value: "ASD, Kohat (DR for South) w.e. from 04/02/2026", label: "ASD, Kohat (DR for South) w.e. from 04/02/2026" },
  { value: "HQ: HRD & Confidential Branch", label: "HQ: HRD & Confidential Branch" },
  { value: "HQ R&S", label: "HQ R&S" },
  { value: "ASD, Nowshera (JCP Kund)", label: "ASD, Nowshera (JCP Kund)" },
  { value: "HQ: Project Branch", label: "HQ: Project Branch" },
  { value: "ASD, Peshawar (Phase-3 Chowk and University Road upto Karkhano)", label: "ASD, Peshawar (Phase-3 Chowk and University Road upto Karkhano)" },
  { value: "ASD, Peshawar (AS Operations on GT Road, Peshawar upto Nowshera)", label: "ASD, Peshawar (AS Operations on GT Road, Peshawar upto Nowshera)" },
  { value: "SWH-I&I Building/Admn Branch", label: "SWH-I&I Building/Admn Branch" },
  { value: "HQ: BG & Recovery Cell", label: "HQ: BG & Recovery Cell" },
  { value: "ASD, Nowshera", label: "ASD, Nowshera" },
  { value: "HQ: Collector Office", label: "HQ: Collector Office" },
  { value: "HQ: CHO & Caretaker Mess", label: "HQ: CHO & Caretaker Mess" },
  { value: "HQ: Law/legal Branch/FTO/ASD, Peshawar in addition w.e. from 07/08/2025", label: "HQ: Law/legal Branch/FTO/ASD, Peshawar in addition w.e. from 07/08/2025" },
  { value: "PA to ADC HQ", label: "PA to ADC HQ" },
  { value: "on attchment with Adjudication/Appeals Office", label: "on attchment with Adjudication/Appeals Office" },
  { value: "HQ: General Branch", label: "HQ: General Branch" },
  { value: "Anti-Smuggling Division Kohat", label: "Anti-Smuggling Division Kohat" },
  { value: "HQ: Accounts Branch, Budget, Treasury & Medical cases", label: "HQ: Accounts Branch, Budget, Treasury & Medical cases" },
  { value: "HQ: Recovery/BG Cell", label: "HQ: Recovery/BG Cell" },
  { value: "HQ: Dispatch Branch and Technical Branch", label: "HQ: Dispatch Branch and Technical Branch" },
  { value: "HQ: Adjudication/Collector's Appeals Office", label: "HQ: Adjudication/Collector's Appeals Office" },
  { value: "HQ: Auction Cell", label: "HQ: Auction Cell" },
  { value: "Anti-Smuggling Division, D.I. Khan-I/II", label: "Anti-Smuggling Division, D.I. Khan-I/II" },
  { value: "HQ: DR office", label: "HQ: DR office" },
  { value: "HQ: Monitoring Cell, Reward Cell, Project and CPF", label: "HQ: Monitoring Cell, Reward Cell, Project and CPF" },
  { value: "HQ: FTO Cell and Reward Cell/Pension Cell in addition w.e. 29.01.2025", label: "HQ: FTO Cell and Reward Cell/Pension Cell in addition w.e. 29.01.2025" },
  { value: "PA to AC HQ-II", label: "PA to AC HQ-II" },
  { value: "HQ: Pension Cell", label: "HQ: Pension Cell" },
  { value: "ASU Abbottabad", label: "ASU Abbottabad" },
  { value: "HQ: Pay Branch", label: "HQ: Pay Branch" },
  { value: "HQ: Internal/External Audit", label: "HQ: Internal/External Audit" },
  { value: "HQ: Office (Admn Pool)", label: "HQ: Office (Admn Pool)" },
  { value: "HQ: Pay Branch (South Division)", label: "HQ: Pay Branch (South Division)" },
  { value: "Anti-Smuggling Division, Peshawar", label: "Anti-Smuggling Division, Peshawar" },
  { value: "HQ: Statistics Branch also attached with Collector Appeal vide order dated 14.10.2024", label: "HQ: Statistics Branch also attached with Collector Appeal vide order dated 14.10.2024" },
  { value: "HQ: I&P Branch", label: "HQ: I&P Branch" },
  { value: "HQ: BG Cel", label: "HQ: BG Cel" },
  { value: "HQ: Law/Legal and DR Branch", label: "HQ: Law/Legal and DR Branch" },
  { value: "HQ: Technical Branch", label: "HQ: Technical Branch" },
  { value: "HQ: Accounts Branch/Control Room I&SCS in addition w.e. from 28/04/2025 and ASD, Peshawar in addition w.e. from 18.09.2025", label: "HQ: Accounts Branch/Control Room I&SCS in addition w.e. from 28/04/2025 and ASD, Peshawar in addition w.e. from 18.09.2025" },
  { value: "On attachment with Dte: of DNFBPs", label: "On attachment with Dte: of DNFBPs" },
  { value: "ASD, Bannu", label: "ASD, Bannu" },
  { value: "ASD, D.I. Khan-I in addition to his own duties (HQ:)", label: "ASD, D.I. Khan-I in addition to his own duties (HQ:)" },
  { value: "ASD, D.I. Khan-II in addition to his own duties (HQ:)", label: "ASD, D.I. Khan-II in addition to his own duties (HQ:)" },
  { value: "ASD, Mardan (Court Duty)", label: "ASD, Mardan (Court Duty)" },
  { value: "ASD, Peshawar in addition (HQ:)", label: "ASD, Peshawar in addition (HQ:)" },
  { value: "Attachement with I&I for a period of three months", label: "Attachement with I&I for a period of three months" },
  { value: "Attachment with I&I for a period of three months", label: "Attachment with I&I for a period of three months" },
  { value: "Collector Office", label: "Collector Office" },
  { value: "DC (HQ) Office/ASD, Peshawar in addition", label: "DC (HQ) Office/ASD, Peshawar in addition" },
  { value: "DC ASD, Pehsawar, Office (HQ)", label: "DC ASD, Pehsawar, Office (HQ)" },
  { value: "DC ASD, Peshawar Office (HQ)", label: "DC ASD, Peshawar Office (HQ)" },
  { value: "DC ASD, Peshawar Office", label: "DC ASD, Peshawar Office" },
  { value: "DC D.I. Khan Divisional Office", label: "DC D.I. Khan Divisional Office" },
  { value: "DES Swabi", label: "DES Swabi" },
  { value: "DNFBPs On attachment", label: "DNFBPs On attachment" },
  { value: "Dte: of Law & Prosecution (HQ)", label: "Dte: of Law & Prosecution (HQ)" },
  { value: "HQ: Accounts Branch", label: "HQ: Accounts Branch" },
  { value: "HQ: ADC Office", label: "HQ: ADC Office" },
  { value: "HQ: Adjudication office", label: "HQ: Adjudication office" },
  { value: "HQ: Admn Pool", label: "HQ: Admn Pool" },
  { value: "HQ: CPF/Project", label: "HQ: CPF/Project" },
  { value: "HQ: DC Office", label: "HQ: DC Office" },
  { value: "HQ: Director Valuation office", label: "HQ: Director Valuation office" },
  { value: "HQ: DR Office", label: "HQ: DR Office" },
  { value: "HQ: HRD Branch", label: "HQ: HRD Branch" },
  { value: "HQ: I&P Branch", label: "HQ: I&P Branch" },
  { value: "HQ: Internal & External Audit Branchs", label: "HQ: Internal & External Audit Branchs" },
  { value: "HQ: Law/Legal Branch", label: "HQ: Law/Legal Branch" },
  { value: "HQ: office", label: "HQ: office" },
  { value: "HQ: Receipt & Dispatch Section", label: "HQ: Receipt & Dispatch Section" },
  { value: "I&SCS", label: "I&SCS" },
  { value: "JCP M1, Peshawar", label: "JCP M1, Peshawar" },
  { value: "JCP M1, Peshawar in addition to his own duties (HQ:)", label: "JCP M1, Peshawar in addition to his own duties (HQ:)" },
  { value: "JCP Michini", label: "JCP Michini" },
  { value: "JCP Michini in addition (HQ:)", label: "JCP Michini in addition (HQ:)" },
  { value: "Naib Court at Jamrud Court", label: "Naib Court at Jamrud Court" },
  { value: "QRF, Peshawar", label: "QRF, Peshawar" },
  { value: "QRF, Peshawar in addition to his own duties", label: "QRF, Peshawar in addition to his own duties" },
  { value: "QRF, Peshazwar", label: "QRF, Peshazwar" },
  { value: "QRF, Peshhawar", label: "QRF, Peshhawar" },
  { value: "SWHs, Peshawar", label: "SWHs, Peshawar" },
  { value: "Special Judge Customs", label: "Special Judge Customs" },
  { value: "ASD, Peshawar (STF)", label: "ASD, Peshawar (STF)" },
  { value: "Collector's Office", label: "Collector's Office" },
  { value: "Anti-Smuggling Division, Nowshera", label: "Anti-Smuggling Division, Nowshera" },
  { value: "Attached with Member Customs", label: "Attached with Member Customs" },
  { value: "HQ Office", label: "HQ Office" },
  { value: "HQ: Incharge Malis", label: "HQ: Incharge Malis" },
  { value: "ASU Central", label: "ASU Central" },
  { value: "AC-I HQ: Office", label: "AC-I HQ: Office" },
  { value: "Custom House, Peshawar", label: "Custom House, Peshawar" },
]

// Flatten options for React Select while preserving group structure
const flattenOptions = () => {
  const allOptions: { value: string; label: string }[] = []
  qualificationOptions.forEach(group => {
    group.options.forEach(option => {
      allOptions.push(option)
    })
  })
  // Remove duplicates
  return Array.from(new Map(allOptions.map(item => [item.value, item])).values())
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function AddStaffStep1PersonalInfo({
  employeeCategory: _employeeCategory,
  onEmployeeCategoryChange: _onEmployeeCategoryChange,
  form,
  updateForm,
  staffPhotos,
  cameraOpen,
  onOpenCamera,
  onCaptureFromCamera,
  onCloseCamera,
  onUploadPhotoClick,
  onRemovePhoto,
  onCancel,
  onReset,
  onSaveAndContinue,
  onSaveToDraft,
  roleOptions,
  departmentOptions,
  employmentTypeOptions,
  bpsOptions,
  qualificationOptions: _qualificationOptions,
}: {
  employeeCategory: EmployeeCategory
  onEmployeeCategoryChange: (value: EmployeeCategory) => void
  form: AddStaffStep1Form
  updateForm: (patch: Partial<AddStaffStep1Form>) => void
  staffPhotos: UploadValue[]
  cameraOpen?: boolean
  onOpenCamera: () => void
  onCaptureFromCamera?: (file: File) => void
  onCloseCamera?: () => void
  onUploadPhotoClick: () => void
  onRemovePhoto: (index: number) => void
  onCancel: () => void
  onReset: () => void
  onSaveAndContinue: () => void
  onSaveToDraft?: () => void
  roleOptions: { value: string; label: string }[]
  departmentOptions: { value: string; label: string }[]
  employmentTypeOptions: { value: string; label: string }[]
  bpsOptions: { value: string; label: string }[]
  qualificationOptions?: { value: string; label: string }[]
}) {
  const maxPhotos = 5
  const filled = staffPhotos.slice(0, maxPhotos)
  const emptySlots = Math.max(0, maxPhotos - filled.length)
  const menuPortalTarget = typeof document !== "undefined" ? document.body : null
  
  // Use provided options or our categorized ones
  const qualificationOptionsList = _qualificationOptions?.length 
    ? _qualificationOptions 
    : flattenOptions()

  // Parse initial qualification values
  const getInitialQualificationValues = () => {
    if (!form.qualification) return []
    if (Array.isArray(form.qualification)) {
      return form.qualification.map(q => {
        const found = qualificationOptionsList.find(opt => opt.value === q)
        return found || { value: q, label: q }
      })
    }
    // Handle string case (for backward compatibility)
    if (typeof form.qualification === 'string' && form.qualification) {
      const found = qualificationOptionsList.find(opt => opt.value === form.qualification)
      return found ? [found] : [{ value: form.qualification, label: form.qualification }]
    }
    return []
  }

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      personal_number: form.personal_number ?? "",
      full_name: form.full_name ?? "",
      gender: form.gender ?? "",
      cnic: form.cnic ?? "",
      date_of_birth: form.date_of_birth ?? "",
      phone: form.phone ?? "",
      address: form.address ?? "",
      department: form.department ?? "",
      designation: form.designation ?? "",
      role: form.role ?? "",
      joining_date: form.joining_date ?? "",
      emergency_contact_name: form.emergency_contact_name ?? "",
      emergency_contact_relationship: form.emergency_contact_relationship ?? "",
      emergency_contact_phone: form.emergency_contact_phone ?? form.emergency_contact ?? "",
      emergency_contact_address: form.emergency_contact_address ?? "",
      qualification: getInitialQualificationValues(),
      current_posting: form.current_posting ? 
        currentPostingOptions.find(opt => opt.value === form.current_posting) || 
        { value: form.current_posting, label: form.current_posting } : null,
      transferred_from: form.transferred_from ? 
        currentPostingOptions.find(opt => opt.value === form.transferred_from) || 
        { value: form.transferred_from, label: form.transferred_from } : null,
      transferred_to: form.transferred_to ? 
        currentPostingOptions.find(opt => opt.value === form.transferred_to) || 
        { value: form.transferred_to, label: form.transferred_to } : null,
    },
    validationSchema: Yup.object({
      personal_number: Yup.string().trim().required("Personal number is required"),
      full_name: Yup.string().trim().required("Employee name is required"),
      gender: Yup.string().trim().required("Gender is required"),
      cnic: Yup.string().trim().required("CNIC is required"),
      phone: Yup.string().trim().required("Mobile number is required"),
      department: Yup.string().trim().required("Department is required"),
      designation: Yup.string().trim().required("Designation is required"),
      role: Yup.string().trim().required("Role is required"),
      date_of_birth: Yup.string().trim(),
      joining_date: Yup.string().trim(),
      address: Yup.string().trim(),
      emergency_contact_name: Yup.string().trim(),
      emergency_contact_relationship: Yup.string().trim(),
      emergency_contact_phone: Yup.string().trim(),
      emergency_contact_address: Yup.string().trim(),
      qualification: Yup.array().min(1, "At least one qualification is required"),
      current_posting: Yup.object().nullable(),
      transferred_from: Yup.object().nullable(),
      transferred_to: Yup.object().nullable(),
    }),
    onSubmit: () => {},
  })

  const handleSubmit = () => {
    const keys = Object.keys(formik.initialValues) as (keyof typeof formik.initialValues)[]
    const touched = keys.reduce((acc, k) => {
      acc[k] = true
      return acc
    }, {} as Record<string, boolean>)
    formik.setTouched(touched, true)
    formik.validateForm().then((errs) => {
      if (Object.keys(errs).length === 0 && onSaveAndContinue) onSaveAndContinue()
    })
  }

  // Handle qualification change
  const handleQualificationChange = (selectedOptions: any) => {
    const values = selectedOptions ? selectedOptions.map((opt: any) => opt.value) : []
    formik.setFieldValue("qualification", selectedOptions || [], true)
    updateForm({ qualification: values })
  }

  // Handle current posting change
  const handleCurrentPostingChange = (selectedOption: any) => {
    const value = selectedOption?.value ?? ""
    formik.setFieldValue("current_posting", selectedOption, true)
    updateForm({ current_posting: value })
  }

  // Handle transferred from change
  const handleTransferredFromChange = (selectedOption: any) => {
    const value = selectedOption?.value ?? ""
    formik.setFieldValue("transferred_from", selectedOption, true)
    updateForm({ transferred_from: value })
  }

  // Handle transferred to change
  const handleTransferredToChange = (selectedOption: any) => {
    const value = selectedOption?.value ?? ""
    formik.setFieldValue("transferred_to", selectedOption, true)
    updateForm({ transferred_to: value })
  }

  // Custom option renderer for React Select with categories
  const formatGroupLabel = (data: any) => (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-muted-foreground">{data.label}</span>
      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{data.options.length}</span>
    </div>
  )

  // Helper function to render label with asterisk for required fields
  const RequiredLabel = ({ children, required = true }: { children: React.ReactNode; required?: boolean }) => (
    <Label className="text-base text-foreground">
      {children}
      {required && <span className="text-destructive ml-1">*</span>}
    </Label>
  )

  // Reusable React Select styles
  const reactSelectStyles = {
    container: (base: any) => ({
      ...base,
      width: "100%",
    }),
    control: (base: any, state: any) => ({
      ...base,
      outline: "none !important",
      borderColor: state.isFocused || state.menuIsOpen
        ? "#bfdbfe"
        : "#e5e7eb",
      boxShadow: state.isFocused || state.menuIsOpen
        ? "0 0 0 2px rgba(191, 219, 254, 0.9)"
        : "none",
      "&:hover": {
        borderColor: "#bfdbfe",
      },
      "&:active": {
        borderColor: "#bfdbfe",
      },
      minHeight: "40px",
      height: "auto",
      backgroundColor: "#ffffff",
      borderRadius: "calc(var(--radius) - 2px)",
      transition: "border-color 120ms ease, box-shadow 120ms ease",
    }),
    valueContainer: (base: any) => ({
      ...base,
      padding: "2px 12px",
      minHeight: "38px",
      alignItems: "center",
    }),
    input: (base: any) => ({
      ...base,
      margin: 0,
      padding: 0,
      color: "hsl(var(--foreground))",
      fontSize: "14px",
      outline: "none !important",
      boxShadow: "none !important",
      border: 0,
    }),
    indicatorsContainer: (base: any) => ({
      ...base,
      minHeight: "38px",
    }),
    clearIndicator: (base: any) => ({
      ...base,
      padding: 6,
      color: "#9ca3af",
      "&:hover": { color: "#4b5563" },
    }),
    dropdownIndicator: (base: any) => ({
      ...base,
      padding: 6,
      color: "#9ca3af",
      "&:hover": { color: "#4b5563" },
    }),
    menuPortal: (base: any) => ({
      ...base,
      zIndex: 9999,
    }),
    menu: (base: any) => ({
      ...base,
      zIndex: 50,
      backgroundColor: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: "var(--radius)",
      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    }),
    menuList: (base: any) => ({
      ...base,
      padding: "4px",
      maxHeight: 260,
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isSelected
        ? "#3b82f6"
        : state.isFocused
          ? "#f3f4f6"
          : "transparent",
      color: state.isSelected ? "#ffffff" : "hsl(var(--foreground))",
      fontSize: "14px",
      padding: "8px 12px",
      cursor: "pointer",
      "&:active": {
        backgroundColor: state.isSelected ? "#3b82f6" : "#e5e7eb",
      },
    }),
    placeholder: (base: any) => ({
      ...base,
      color: "#9ca3af",
      fontSize: "14px",
    }),
    singleValue: (base: any) => ({
      ...base,
      color: "hsl(var(--foreground))",
      fontSize: "14px",
    }),
    multiValue: (base: any) => ({
      ...base,
      backgroundColor: "#f3f4f6",
      borderRadius: "calc(var(--radius) - 2px)",
      margin: "2px 4px 2px 0",
    }),
    multiValueLabel: (base: any) => ({
      ...base,
      color: "hsl(var(--foreground))",
      fontSize: "13px",
      padding: "2px 6px",
    }),
    multiValueRemove: (base: any) => ({
      ...base,
      color: "#9ca3af",
      borderRadius: "0 calc(var(--radius) - 2px) calc(var(--radius) - 2px) 0",
      "&:hover": {
        backgroundColor: "#ef4444",
        color: "#ffffff",
      },
    }),
    groupHeading: (base: any) => ({
      ...base,
      fontSize: "0.85rem",
      fontWeight: 600,
      color: "hsl(var(--muted-foreground))",
      backgroundColor: "hsl(var(--muted) / 0.35)",
      padding: "8px 12px",
      margin: 0,
      borderBottom: "1px solid hsl(var(--border))",
    }),
  }

  return (
    <div className="space-y-8">
      {/* Personal Details */}
      <div className="space-y-4">
        <Label className="text-[22px] font-bold text-foreground">Personal Details</Label>

        {/* Photograph Upload */}
        <div className="space-y-2">
          <Label className="text-base font-medium text-foreground">Photograph Upload</Label>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* Capture/Upload Box */}
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-muted/20 py-6 px-3 transition-colors min-w-0 shrink-0",
                "border-muted-foreground/30 hover:border-primary/40 hover:bg-muted/30 w-[280px]"
              )}
            >
              {cameraOpen && onCaptureFromCamera ? (
                <div className="w-full">
                  <CameraCapture
                    title="Capture staff photo"
                    description="Capture a photo to add into staff images."
                    onCapture={(file) => onCaptureFromCamera(file)}
                    onCancel={onCloseCamera}
                  />
                </div>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Camera className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground text-center">
                    Upload a Staff Photograph
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    Image size: Max 2MB, Format JPG/PNG. Up to 5 images for recognition.
                  </p>
                  <div className="flex flex-col gap-2 w-full">
                    <Button
                      type="button"
                      onClick={onOpenCamera}
                      disabled={filled.length >= maxPhotos}
                      className="rounded-md bg-[#3366FF] hover:bg-[#2952CC] px-4 py-2 text-sm font-semibold text-white w-full"
                    >
                      Capture from camera
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onUploadPhotoClick}
                      disabled={filled.length >= maxPhotos}
                      className="w-full"
                    >
                      Upload Photo
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Captured Images Grid */}
            <div className="flex flex-col gap-3 min-w-0 flex-1">
              <p className="text-sm font-medium text-muted-foreground">Captured images</p>
              <div className="overflow-x-auto overflow-y-hidden pb-2">
                <div className="grid grid-cols-5 gap-3 min-w-[calc(12rem*5+0.75rem*4)] w-max">
                  {filled.map((img, idx) => (
                    <div key={idx} className="relative h-[14.5rem] w-48 shrink-0">
                      {img.previewUrl ? (
                        <>
                          <img
                            src={img.previewUrl}
                            alt={`Staff ${idx + 1}`}
                            className="h-full w-full rounded-md border border-border object-contain bg-muted"
                            decoding="async"
                          />
                          {img.validating && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/35">
                              <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
                              <span className="sr-only">Checking face…</span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => onRemovePhoto(idx)}
                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow"
                            aria-label="Remove photo"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <div className="h-full w-full rounded-md border-2 border-dashed border-muted-foreground/40 bg-white flex items-center justify-center">
                          <span className="text-sm text-muted-foreground">{idx + 1}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {Array.from({ length: emptySlots }).map((_, i) => {
                    const slotNumber = filled.length + i + 1
                    return (
                      <div
                        key={`empty-${slotNumber}`}
                        className="relative h-[14.5rem] w-48 shrink-0 rounded-md border-2 border-dashed border-muted-foreground/40 bg-white flex items-center justify-center"
                      >
                        <span className="text-sm text-muted-foreground">{slotNumber}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{filled.length} / {maxPhotos} images</p>
            </div>
          </div>
        </div>

        {/* Personal Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <RequiredLabel>Employee Name</RequiredLabel>
            <Input
              placeholder="e.g. Mohammad Ali Hassan"
              name="full_name"
              value={formik.values.full_name}
              onChange={(e) => {
                formik.handleChange(e)
                updateForm({ full_name: e.target.value })
              }}
              onBlur={formik.handleBlur}
              className={cn(
                "h-10 text-base bg-background border-border",
                formik.touched.full_name && formik.errors.full_name ? "border-destructive" : ""
              )}
            />
            {formik.touched.full_name && formik.errors.full_name ? (
              <p className="text-sm text-destructive">{formik.errors.full_name}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Saved as employee full name</p>
            )}
          </div>

          <div className="space-y-2">
            <RequiredLabel>Personal Number</RequiredLabel>
            <Input
              placeholder="e.g. 12345"
              name="personal_number"
              value={formik.values.personal_number}
              onChange={(e) => {
                formik.handleChange(e)
                updateForm({ personal_number: e.target.value })
              }}
              onBlur={formik.handleBlur}
              className={cn(
                "h-10 text-base bg-background border-border",
                formik.touched.personal_number && formik.errors.personal_number ? "border-destructive" : ""
              )}
            />
            {formik.touched.personal_number && formik.errors.personal_number ? (
              <p className="text-sm text-destructive">{formik.errors.personal_number}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Saved in personal_number column</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-base text-foreground">Father&apos;s Name</Label>
            <Input
              placeholder="e.g. Ahmed Hassan"
              value={form.father_name || ""}
              onChange={(e) => updateForm({ father_name: e.target.value })}
              className="h-10 text-base bg-background border-border"
            />
          </div>

          <div className="space-y-2">
            <RequiredLabel>Gender</RequiredLabel>
            <Select
              value={formik.values.gender || undefined}
              onValueChange={(value) => {
                formik.setFieldValue("gender", value, true)
                updateForm({ gender: value })
              }}
              onOpenChange={(open) => {
                if (!open) formik.setFieldTouched("gender", true, true)
              }}
            >
              <SelectTrigger
                className={cn(
                  "w-full h-10 bg-background border-border",
                  formik.touched.gender && formik.errors.gender ? "border-destructive" : ""
                )}
              >
                <SelectValue placeholder="Male/Female/Other" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {formik.touched.gender && formik.errors.gender ? (
              <p className="text-sm text-destructive">{formik.errors.gender}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <RequiredLabel>CNIC Number</RequiredLabel>
            <Input
              placeholder="00000-0000000-0"
              name="cnic"
              value={formik.values.cnic}
              onChange={(e) => {
                formik.handleChange(e)
                updateForm({ cnic: e.target.value })
              }}
              onBlur={formik.handleBlur}
              className={cn(
                "h-10 text-base bg-background border-border",
                formik.touched.cnic && formik.errors.cnic ? "border-destructive" : ""
              )}
            />
            {formik.touched.cnic && formik.errors.cnic ? (
              <p className="text-sm text-destructive">{formik.errors.cnic}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label className="text-base text-foreground">Date of Birth</Label>
            <Input
              type="date"
              name="date_of_birth"
              value={formik.values.date_of_birth}
              onChange={(e) => {
                formik.handleChange(e)
                updateForm({ date_of_birth: e.target.value })
              }}
              onBlur={formik.handleBlur}
              className={cn(
                "h-10 text-base bg-background border-border",
                formik.touched.date_of_birth && formik.errors.date_of_birth ? "border-destructive" : ""
              )}
            />
            {formik.touched.date_of_birth && formik.errors.date_of_birth ? (
              <p className="text-sm text-destructive">{formik.errors.date_of_birth}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <RequiredLabel>Mobile Number</RequiredLabel>
            <Input
              placeholder="0000-0000000"
              name="phone"
              value={formik.values.phone}
              onChange={(e) => {
                formik.handleChange(e)
                updateForm({ phone: e.target.value })
              }}
              onBlur={formik.handleBlur}
              className={cn(
                "h-10 text-base bg-background border-border",
                formik.touched.phone && formik.errors.phone ? "border-destructive" : ""
              )}
            />
            {formik.touched.phone && formik.errors.phone ? (
              <p className="text-sm text-destructive">{formik.errors.phone}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label className="text-base text-foreground">Email Address</Label>
            <Input
              type="email"
              placeholder="emailaddress@email.com"
              value={form.email || ""}
              onChange={(e) => updateForm({ email: e.target.value })}
              className="h-10 text-base bg-background border-border"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <RequiredLabel>Qualification</RequiredLabel>
            <div className="space-y-1">
              <ReactSelect
                components={animatedComponents}
                isMulti
                name="qualification"
                options={qualificationOptions}
                value={formik.values.qualification}
                onChange={handleQualificationChange}
                onBlur={() => formik.setFieldTouched("qualification", true, true)}
                placeholder="Search or select qualifications..."
                menuPortalTarget={menuPortalTarget ?? undefined}
                menuPosition={menuPortalTarget ? "fixed" : "absolute"}
                className={cn(
                  "react-select-container",
                  formik.touched.qualification && formik.errors.qualification ? "react-select-error" : ""
                )}
                classNamePrefix="react-select"
                formatGroupLabel={formatGroupLabel}
                isClearable={false}
                noOptionsMessage={() => "No matching qualifications found"}
                styles={reactSelectStyles}
              />
              {formik.touched.qualification && formik.errors.qualification ? (
                <p className="text-sm text-destructive">{formik.errors.qualification as string}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Select multiple qualifications from categories</p>
              )}
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <RequiredLabel required={false}>Residential Address</RequiredLabel>
            <Textarea
              placeholder="e.g. House #, Street Name, City"
              name="address"
              value={formik.values.address}
              onChange={(e) => {
                formik.handleChange(e)
                updateForm({ address: e.target.value })
              }}
              onBlur={formik.handleBlur}
              className={cn(
                "min-h-20 text-base bg-background border-border resize-none",
                formik.touched.address && formik.errors.address ? "border-destructive" : ""
              )}
            />
            {formik.touched.address && formik.errors.address ? (
              <p className="text-sm text-destructive">{formik.errors.address}</p>
            ) : (
              <p className="text-sm text-muted-foreground">(Employee Address)</p>
            )}
          </div>
        </div>
      </div>

      {/* Employment Information */}
      <div className="space-y-4">
        <Label className="text-[22px] font-bold text-foreground">Employment Information</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-base text-foreground">BPS</Label>
            <Select value={form.bps || undefined} onValueChange={(value) => updateForm({ bps: value })}>
              <SelectTrigger className="w-full h-10 bg-background border-border">
                <SelectValue placeholder="Select BPS" />
              </SelectTrigger>
              <SelectContent>
                {bpsOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <RequiredLabel>Department</RequiredLabel>
            <Select
              value={formik.values.department || undefined}
              onValueChange={(value) => {
                formik.setFieldValue("department", value, true)
                updateForm({ department: value })
              }}
              onOpenChange={(open) => {
                if (!open) formik.setFieldTouched("department", true, true)
              }}
            >
              <SelectTrigger
                className={cn(
                  "w-full h-10 bg-background border-border",
                  formik.touched.department && formik.errors.department ? "border-destructive" : ""
                )}
              >
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departmentOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formik.touched.department && formik.errors.department ? (
              <p className="text-sm text-destructive">{formik.errors.department}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <RequiredLabel>Designation</RequiredLabel>
            <ReactSelect
              name="designation"
              isMulti={false}
              options={designationOptions}
              value={
                designationOptions.find((opt) => opt.value === formik.values.designation) ?? null
              }
              onChange={(opt) => {
                const value = (opt as { value: string } | null)?.value ?? ""
                formik.setFieldValue("designation", value, true)
                updateForm({ designation: value })
              }}
              onBlur={() => formik.setFieldTouched("designation", true, true)}
              placeholder="Select designation"
              menuPortalTarget={menuPortalTarget ?? undefined}
              menuPosition={menuPortalTarget ? "fixed" : "absolute"}
              className={cn(
                "react-select-container",
                formik.touched.designation && formik.errors.designation ? "react-select-error" : ""
              )}
              classNamePrefix="react-select"
              isClearable={true}
              noOptionsMessage={() => "No matching designation found"}
              styles={reactSelectStyles}
            />
            {formik.touched.designation && formik.errors.designation ? (
              <p className="text-sm text-destructive">{formik.errors.designation}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <RequiredLabel>Role</RequiredLabel>
            <Select
              value={formik.values.role || ""}
              onValueChange={(value) => {
                formik.setFieldValue("role", value, true)
                updateForm({ role: value })
              }}
              onOpenChange={(open) => {
                if (!open) formik.setFieldTouched("role", true, true)
              }}
            >
              <SelectTrigger
                className={cn(
                  "w-full h-10 bg-background border-border",
                  formik.touched.role && formik.errors.role ? "border-destructive" : ""
                )}
              >
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formik.touched.role && formik.errors.role ? (
              <p className="text-sm text-destructive">{formik.errors.role}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label className="text-base text-foreground">Employment Type</Label>
            <Select
              value={form.employment_type || undefined}
              onValueChange={(value) => updateForm({ employment_type: value })}
            >
              <SelectTrigger className="w-full h-10 bg-background border-border">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {employmentTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-base text-foreground">Joining Date</Label>
            <Input
              type="date"
              name="joining_date"
              value={formik.values.joining_date}
              onChange={(e) => {
                formik.handleChange(e)
                updateForm({ joining_date: e.target.value })
              }}
              onBlur={formik.handleBlur}
              className={cn(
                "h-10 text-base bg-background border-border",
                formik.touched.joining_date && formik.errors.joining_date ? "border-destructive" : ""
              )}
            />
            {formik.touched.joining_date && formik.errors.joining_date ? (
              <p className="text-sm text-destructive">{formik.errors.joining_date}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label className="text-base text-foreground">Current Place of Posting</Label>
            <ReactSelect
              name="current_posting"
              isMulti={false}
              options={currentPostingOptions}
              value={formik.values.current_posting}
              onChange={handleCurrentPostingChange}
              onBlur={() => formik.setFieldTouched("current_posting", true, true)}
              placeholder="Search or select current posting..."
              menuPortalTarget={menuPortalTarget ?? undefined}
              menuPosition={menuPortalTarget ? "fixed" : "absolute"}
              className={cn(
                "react-select-container",
                formik.touched.current_posting && formik.errors.current_posting ? "react-select-error" : ""
              )}
              classNamePrefix="react-select"
              isClearable={true}
              noOptionsMessage={() => "No matching posting found"}
              styles={reactSelectStyles}
            />
            {formik.touched.current_posting && formik.errors.current_posting ? (
              <p className="text-sm text-destructive">{formik.errors.current_posting as string}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Select current place of posting</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-base text-foreground">Transferred From</Label>
            <ReactSelect
              name="transferred_from"
              isMulti={false}
              options={currentPostingOptions}
              value={formik.values.transferred_from}
              onChange={handleTransferredFromChange}
              onBlur={() => formik.setFieldTouched("transferred_from", true, true)}
              placeholder="Search or select transferred from..."
              menuPortalTarget={menuPortalTarget ?? undefined}
              menuPosition={menuPortalTarget ? "fixed" : "absolute"}
              className={cn(
                "react-select-container",
                formik.touched.transferred_from && formik.errors.transferred_from ? "react-select-error" : ""
              )}
              classNamePrefix="react-select"
              isClearable={true}
              noOptionsMessage={() => "No matching posting found"}
              styles={reactSelectStyles}
            />
            {formik.touched.transferred_from && formik.errors.transferred_from ? (
              <p className="text-sm text-destructive">{formik.errors.transferred_from as string}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Select previous posting location</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-base text-foreground">Transferred To</Label>
            <ReactSelect
              name="transferred_to"
              isMulti={false}
              options={currentPostingOptions}
              value={formik.values.transferred_to}
              onChange={handleTransferredToChange}
              onBlur={() => formik.setFieldTouched("transferred_to", true, true)}
              placeholder="Search or select transferred to..."
              menuPortalTarget={menuPortalTarget ?? undefined}
              menuPosition={menuPortalTarget ? "fixed" : "absolute"}
              className={cn(
                "react-select-container",
                formik.touched.transferred_to && formik.errors.transferred_to ? "react-select-error" : ""
              )}
              classNamePrefix="react-select"
              isClearable={true}
              noOptionsMessage={() => "No matching posting found"}
              styles={reactSelectStyles}
            />
            {formik.touched.transferred_to && formik.errors.transferred_to ? (
              <p className="text-sm text-destructive">{formik.errors.transferred_to as string}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Select new posting location</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-base text-foreground">Name of Collectorate</Label>
            <Select
              value={form.collector_name || undefined}
              onValueChange={(value) => updateForm({ collector_name: value })}
            >
              <SelectTrigger className="w-full h-10 bg-background border-border">
                <SelectValue placeholder="Select collectorate" />
              </SelectTrigger>
              <SelectContent>
                {collectorateOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Emergency Contact */}
      <div className="space-y-4">
        <Label className="text-[22px] font-bold text-foreground">Emergency Contact</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <RequiredLabel required={false}>Name</RequiredLabel>
            <Input
              placeholder="e.g. Ali Raza"
              name="emergency_contact_name"
              value={formik.values.emergency_contact_name}
              onChange={(e) => {
                formik.handleChange(e)
                updateForm({ emergency_contact_name: e.target.value })
              }}
              onBlur={formik.handleBlur}
              className={cn(
                "h-10 text-base bg-background border-border",
                formik.touched.emergency_contact_name && formik.errors.emergency_contact_name ? "border-destructive" : ""
              )}
            />
            {formik.touched.emergency_contact_name && formik.errors.emergency_contact_name ? (
              <p className="text-sm text-destructive">{formik.errors.emergency_contact_name}</p>
            ) : (
              <p className="text-sm text-muted-foreground">(Emergency Contact Person)</p>
            )}
          </div>

          <div className="space-y-2">
            <RequiredLabel required={false}>Relationship</RequiredLabel>
            <Input
              placeholder="e.g. Brother, Spouse"
              name="emergency_contact_relationship"
              value={formik.values.emergency_contact_relationship}
              onChange={(e) => {
                formik.handleChange(e)
                updateForm({ emergency_contact_relationship: e.target.value })
              }}
              onBlur={formik.handleBlur}
              className={cn(
                "h-10 text-base bg-background border-border",
                formik.touched.emergency_contact_relationship && formik.errors.emergency_contact_relationship ? "border-destructive" : ""
              )}
            />
            {formik.touched.emergency_contact_relationship && formik.errors.emergency_contact_relationship ? (
              <p className="text-sm text-destructive">{formik.errors.emergency_contact_relationship}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <RequiredLabel required={false}>Phone</RequiredLabel>
            <Input
              placeholder="0000-0000000"
              name="emergency_contact_phone"
              value={formik.values.emergency_contact_phone}
              onChange={(e) => {
                formik.handleChange(e)
                updateForm({ emergency_contact_phone: e.target.value, emergency_contact: e.target.value })
              }}
              onBlur={formik.handleBlur}
              className={cn(
                "h-10 text-base bg-background border-border",
                formik.touched.emergency_contact_phone && formik.errors.emergency_contact_phone ? "border-destructive" : ""
              )}
            />
            {formik.touched.emergency_contact_phone && formik.errors.emergency_contact_phone ? (
              <p className="text-sm text-destructive">{formik.errors.emergency_contact_phone}</p>
            ) : (
              <p className="text-sm text-muted-foreground">(Emergency Contact Number)</p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <RequiredLabel required={false}>Address</RequiredLabel>
            <Textarea
              placeholder="Emergency contact address"
              name="emergency_contact_address"
              value={formik.values.emergency_contact_address}
              onChange={(e) => {
                formik.handleChange(e)
                updateForm({ emergency_contact_address: e.target.value })
              }}
              onBlur={formik.handleBlur}
              className={cn(
                "min-h-20 text-base bg-background border-border resize-none",
                formik.touched.emergency_contact_address && formik.errors.emergency_contact_address ? "border-destructive" : ""
              )}
            />
            {formik.touched.emergency_contact_address && formik.errors.emergency_contact_address ? (
              <p className="text-sm text-destructive">{formik.errors.emergency_contact_address}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="rounded-md border border-[#CCCCCC] bg-white px-4 py-2.5 text-base font-normal text-[#3366CC] transition-colors hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onReset}
            className="rounded-md border border-[#CCCCCC] bg-white px-4 py-2.5 text-base font-normal text-[#3366CC] transition-colors hover:bg-gray-50"
          >
            Reset Form
          </Button>
          {onSaveToDraft && (
            <Button
              type="button"
              variant="outline"
              onClick={onSaveToDraft}
              className="rounded-md border border-[#CCCCCC] bg-white px-4 py-2.5 text-base font-normal text-[#3366CC] transition-colors hover:bg-gray-50"
            >
              Save to draft
            </Button>
          )}
        </div>
        <Button
          type="button"
          onClick={handleSubmit}
          className="shrink-0 rounded-md bg-[#3366FF] px-5 py-2.5 text-base font-normal text-white transition-colors hover:bg-[#2952CC]"
        >
          Save & Continue
        </Button>
      </div>
    </div>
  )
}