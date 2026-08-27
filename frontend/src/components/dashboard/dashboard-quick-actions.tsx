"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Link } from "react-router-dom"
import { ROUTES } from "@/routes/config"
import { FilePlus, Camera, Lock, Activity, Maximize2 } from "lucide-react"

export function DashboardQuickActions() {
  const [lockdownOpen, setLockdownOpen] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" className="gap-2" asChild>
        <Link to={ROUTES.INCIDENT_MANAGEMENT}>
          <FilePlus className="h-4 w-4" />
          Create Incident
        </Link>
      </Button>
      <Button variant="outline" size="sm" className="gap-2">
        <Camera className="h-4 w-4" />
        Export Snapshot
      </Button>
      <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={() => setLockdownOpen(true)}>
        <Lock className="h-4 w-4" />
        Emergency Lockdown
      </Button>
      <Button variant="outline" size="sm" className="gap-2" asChild>
        <Link to={ROUTES.GENERAL_SETTINGS}>
          <Activity className="h-4 w-4" />
          System Health
        </Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => document.documentElement.requestFullscreen?.()}
      >
        <Maximize2 className="h-4 w-4" />
        Full Screen
      </Button>
      <AlertDialog open={lockdownOpen} onOpenChange={setLockdownOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emergency Lockdown</AlertDialogTitle>
            <AlertDialogDescription>
              This will trigger a facility lockdown. All access points will be secured. This action requires confirmation. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirm Lockdown
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
