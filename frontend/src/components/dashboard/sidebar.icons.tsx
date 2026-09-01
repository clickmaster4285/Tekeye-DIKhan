import React from "react"
import {
  ArrowRightLeft,
  BarChart3,
  Bell,
  Brain,
  Building2,
  CalendarClock,
  CalendarDays,
  Camera,
  Circle,
  ClipboardList,
  Cog,
  Database,
  FileText,
  FolderOpen,
  Gavel,
  GraduationCap,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Lock,
  MapPin,
  Monitor,
  Package,
  Play,
  Scale,
  ScanFace,
  Search,
  Server,
  Shield,
  ShieldCheck,
  Smartphone,
  Thermometer,
  Trash2,
  Truck,
  User,
  UserCheck,
  UserCog,
  Users,
  Wallet,
} from "lucide-react"

export type SidebarIconComponent = React.ComponentType<{ size?: number; className?: string }>

const PRIMARY_MENU_ICONS: Record<string, SidebarIconComponent> = {
  Dashboard: LayoutDashboard,
  "Visitor Management": ClipboardList,
  "Visitor Management System": UserCheck,
  "Visitor Registration": ClipboardList,
  "Warehouse Management": Package,
  "Warehouse Management System": Package,
  "Seizure Management": FileText,
  Armory: ShieldCheck,
  "Litigation Management": Scale,
  "Auction Management": Gavel,
  "AI Monitoring & Analytics": Camera,
  "AI Analytics": Brain,
  "AI Analytics System": Brain,
  "Human Resource": Users,
  "Human Resource Management": Users,
  "Human Resource Management System": Users,
  "System Configuration": Cog,
  "Central Ops": Server,
  "GPS Tracking": MapPin,
}

const EXPLICIT_SUBMENU_ICONS: Record<string, SidebarIconComponent> = {
  "Pre-Registration": ClipboardList,
  "Walk-In Registration": UserCheck,
  "Calendar View": CalendarDays,
  "Security & Screening": Shield,
  "Watchlist Screening": Shield,
  "Blacklist Management": Lock,
  "Flagged Visitor Alerts": Bell,
  "Access Control": Lock,
  "Zone Restrictions": Building2,
  "Gate Integration": Lock,
  "Escort Requirement": UserCheck,
  "Host & Department Dashboard": Building2,
  "Visitor Notifications": Bell,
  "Upcoming Visits": CalendarDays,
  "Visitor History": ClipboardList,
  "Guard & Reception Panel": User,
  "Vehicle & Contractor Management": Truck,
  "Vehicle Registration": Truck,
  "Contractor Passes": UserCheck,
  "Cargo/Delivery Logs": ClipboardList,
  // Warehouse Management System submenus
  "Seizure & Receipt": FileText,
  // "Warehouse Management": Package,
  "Case Management": Scale,
  Cases: Scale,
  "Armory Dashboard": ShieldCheck,
  "Transfers & Handover": ArrowRightLeft,
  "Perishable Management": Package,
  "Perishable Register": Package,
  "Expiry Tracking": CalendarClock,
  "Priority Disposal Queue": ListOrdered,
  "Destruction Orders": Trash2,
  "Lot Creation": Package,
  "Item Valuation": Wallet,
  "Auction Management": Gavel,
  "Computer Vision": Camera,
  "Vehicle Detection": Truck,
  "AI Models": Brain,
  "Zones": LayoutGrid,
  "Rules": ListChecks,
  "Training": GraduationCap,
  "Integration": Cog,
  "Reports": BarChart3,
  "User Management": Users,
  Employees: Users,
  Attendance: UserCheck,
  "Face Enrollment": ScanFace,
  "Attendance Monitor": Monitor,
  "Attendance Dashboard": LayoutDashboard,
  "Attendance Reports": BarChart3,
  Notifications: Bell,
  // Table of Contents & AI Analytics sub-modules
  "Table of Contents": List,
  "Live View": Monitor,
  "Playback & Search": Play,
  "Find in Video": Search,
  "Thermal Imaging": Thermometer,
  "Camera Management": Camera,
  "Person Journey": MapPin,
  "GPS Tracking": MapPin,
  "Alerts & Notifications": Bell,
  "Incident Management": FolderOpen,
  "People Database": Users,
  "Vehicle Database": Truck,
  "Reports & Analytics": BarChart3,
  Configuration: Cog,
  Administration: UserCog,
  "Mobile App": Smartphone,
  "Integrations & API": Link2,
  "Roles & Permissions": Shield,
  "Database Tables": Database,
  Logs: FileText,
}

function resolveIconByKeyword(label: string): SidebarIconComponent {
  const key = label.toLowerCase()
  if (key.includes("calendar")) return CalendarDays
  if (key.includes("security") || key.includes("screening")) return Shield
  if (key.includes("access") || key.includes("authentication")) return Lock
  if (key.includes("host") || key.includes("reception") || key.includes("user")) return User
  if (key.includes("vehicle") || key.includes("contractor")) return Truck
  if (key.includes("camera") || key.includes("anpr") || key.includes("monitoring") || key.includes("detection")) return Camera
  if (key.includes("report") || key.includes("analytics") || key.includes("dashboard") || key.includes("insights")) return BarChart3
  if (key.includes("settings") || key.includes("configuration")) return Cog
  if (key.includes("notification")) return Bell
  if (key.includes("transfer") || key.includes("movement") || key.includes("handover")) return ArrowRightLeft
  if (key.includes("seizure") || key.includes("receipt")) return FileText
  if (key.includes("court") || key.includes("legal") || key.includes("fir") || key.includes("case")) return Scale
  if (key.includes("auction") || key.includes("bidding") || key.includes("sale")) return Gavel
  if (key.includes("document")) return FileText
  if (
    key.includes("warehouse") ||
    key.includes("inventory") ||
    key.includes("stock") ||
    key.includes("storage") ||
    key.includes("lot") ||
    key.includes("perishable")
  ) {
    return Package
  }
  if (key.includes("expiry") || key.includes("expiration")) return CalendarClock
  if (key.includes("disposal") || key.includes("priority queue")) return ListOrdered
  if (key.includes("destruction")) return Trash2
  if (key.includes("valuation") || key.includes("value")) return Wallet
  if (key.includes("registration") || key.includes("visit") || key.includes("purpose")) return ClipboardList
  return Circle
}

export function renderMenuIcon(
  label: string,
  size = 14,
  className = "shrink-0 opacity-80"
): React.ReactNode {
  const Icon =
    EXPLICIT_SUBMENU_ICONS[label] ??
    PRIMARY_MENU_ICONS[label] ??
    resolveIconByKeyword(label)
  return <Icon size={size} className={className} />
}
