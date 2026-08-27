import React from "react"
import { ClipboardList, UserPlus, Upload, Camera, QrCode } from "lucide-react"

interface Module {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  title: string
  description: string
  actionLabel: string
  actionColor: string
}

export function RegistrationModules() {
  const modules: Module[] = [
    {
      icon: <ClipboardList className="h-5 w-5" />,
      iconBg: "bg-[#fee2e2]",
      iconColor: "text-[#ef4444]",
      title: "Pre-Registration",
      description: "Online visitor registration before arrival with visit purpose and department selection",
      actionLabel: "New Request",
      actionColor: "text-[#ef4444]",
    },
    {
      icon: <UserPlus className="h-5 w-5" />,
      iconBg: "bg-[#dbeafe]",
      iconColor: "text-[#3b82f6]",
      title: "Walk-In Registration",
      description: "On-site registration for receptionist or self-service Kiosk processing.",
      actionLabel: "Start Check-in",
      actionColor: "text-[#3b82f6]",
    },
    {
      icon: <Upload className="h-5 w-5" />,
      iconBg: "bg-[#f3e8ff]",
      iconColor: "text-[#a855f7]",
      title: "Document Upload",
      description: "Upload CNIC, Passport, Company ID, or custom profile related to visitors.",
      actionLabel: "Upload Files",
      actionColor: "text-[#a855f7]",
    },
    {
      icon: <Camera className="h-5 w-5" />,
      iconBg: "bg-[#fce7f3]",
      iconColor: "text-[#ec4899]",
      title: "Photo Capture",
      description: "Live photo capture for visitor identification and badge printing.",
      actionLabel: "Open Camera",
      actionColor: "text-[#ec4899]",
    },
    {
      icon: <QrCode className="h-5 w-5" />,
      iconBg: "bg-[#d1fae5]",
      iconColor: "text-[#10b981]",
      title: "QR Code Generation",
      description: "Auto-generate QR codes for fast check-in and verification.",
      actionLabel: "Generate QR Code",
      actionColor: "text-[#10b981]",
    },
  ]

  return (
    <div className="mt-6">
      <h2 className="text-base font-semibold text-foreground mb-4">Registration Modules</h2>
      <div className="grid grid-cols-3 gap-4">
        {modules.slice(0, 3).map((module, index) => (
          <ModuleCard key={index} module={module} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4 mt-4">
        {modules.slice(3, 5).map((module, index) => (
          <ModuleCard key={index} module={module} />
        ))}
      </div>
    </div>
  )
}

function ModuleCard({ module }: { module: Module }) {
  return (
    <div className="bg-background rounded-xl border border-border p-5">
      <div className={`w-10 h-10 rounded-lg ${module.iconBg} ${module.iconColor} flex items-center justify-center mb-3`}>
        {module.icon}
      </div>
      <h3 className="font-medium text-foreground mb-1">{module.title}</h3>
      <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{module.description}</p>
      <button className={`text-sm font-medium ${module.actionColor} hover:underline flex items-center gap-1`}>
        {module.actionLabel} <span>›</span>
      </button>
    </div>
  )
}
