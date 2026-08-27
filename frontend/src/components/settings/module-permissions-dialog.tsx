import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { updateUser, type ApiUser } from "@/lib/users-api"
import { getSidebarModuleCatalog } from "@/routes/config"

type ModulePermissionsDialogProps = {
  user: ApiUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (user: ApiUser) => void
}

export function ModulePermissionsDialog({
  user,
  open,
  onOpenChange,
  onSaved,
}: ModulePermissionsDialogProps) {
  const { toast } = useToast()
  const catalog = useMemo(() => getSidebarModuleCatalog(), [])
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !user) return
    setSelected(Array.isArray(user.allowed_modules) ? [...user.allowed_modules] : [])
  }, [open, user])

  const isSuperAdmin = user?.role === "ADMIN"

  const toggle = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const selectAll = () => setSelected(catalog.map((m) => m.key))
  const clearAll = () => setSelected([])

  const save = async () => {
    if (!user || isSuperAdmin) return
    setSaving(true)
    try {
      const updated = await updateUser(user.id, { allowed_modules: selected })
      toast({
        title: "Permissions saved",
        description:
          selected.length === 0
            ? "Using role default modules."
            : `${selected.length} module(s) granted.`,
      })
      onSaved?.(updated)
      onOpenChange(false)
    } catch (e) {
      toast({
        title: "Could not save permissions",
        description: e instanceof Error ? e.message : "Request failed",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Module permissions</DialogTitle>
          <DialogDescription>
            {user
              ? `Choose sidebar modules for ${user.full_name?.trim() || user.username}.`
              : "Select a user."}
            {" "}
            Only checked modules appear in that user&apos;s sidebar. Super Admin always has all
            modules. Empty selection uses the role&apos;s default menu (or Dashboard only if the
            role has no template). Custom grants override the role until cleared.
          </DialogDescription>
        </DialogHeader>

        {isSuperAdmin ? (
          <p className="text-sm text-muted-foreground py-4">
            Super Admin has full access to every sidebar module automatically. Permissions cannot be
            restricted.
          </p>
        ) : (
          <>
            <div className="flex gap-2 mb-3">
              <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                Select all
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={clearAll}>
                Clear (role defaults)
              </Button>
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              {catalog.map((mod) => {
                const checked = selected.includes(mod.key)
                return (
                  <label
                    key={mod.key}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(mod.key)}
                      aria-label={mod.label}
                    />
                    <span className="text-sm font-medium">{mod.label}</span>
                  </label>
                )
              })}
            </div>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          {!isSuperAdmin && (
            <Button type="button" onClick={() => void save()} disabled={saving || !user}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save permissions"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
