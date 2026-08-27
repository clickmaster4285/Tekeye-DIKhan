import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"

export type AddStaffStep3Form = {
  has_login?: boolean
  login_username?: string
  password?: string
}

export function AddStaffStep3LoginAccess({
  form,
  updateForm,
  onCancel,
  onReset,
  onPrevious,
  onFinish,
  submitting,
  mode = "create",
  hasExistingLogin = false,
}: {
  form: AddStaffStep3Form
  updateForm: (patch: Partial<AddStaffStep3Form>) => void
  onCancel: () => void
  onReset: () => void
  onPrevious: () => void
  onFinish: () => void
  submitting: boolean
  mode?: "create" | "edit"
  hasExistingLogin?: boolean
}) {
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({})

  const validateForm = (): boolean => {
    if (!form.has_login) {
      return true
    }

    const newErrors: { username?: string; password?: string } = {}

    if (!form.login_username?.trim()) {
      newErrors.username = "Username is required"
    }

    if (!form.password?.trim()) {
      if (!(mode === "edit" && hasExistingLogin)) {
        newErrors.password = "Password is required"
      }
    } else if (form.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFinish = () => {
    if (validateForm()) {
      onFinish()
    }
  }

  return (
    <div className="space-y-8">
      <Label className="text-[22px] font-bold text-foreground">Login Access</Label>

      <div className="space-y-3 border-t border-border pt-6">
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-6 transition-colors hover:border-primary/40 hover:bg-muted/30">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-medium text-foreground">Give this employee login access?</p>
              <p className="text-sm text-muted-foreground">
                {mode === "edit" && hasExistingLogin
                  ? "Leave password blank to keep the current password. Enter a new one only to change it."
                  : "If enabled, they can sign in using provided credentials. Username and password are required."}
              </p>
            </div>
            <Switch
              checked={Boolean(form.has_login)}
              onCheckedChange={(checked) => {
                updateForm({ has_login: checked })
                setErrors({})
              }}
              className="data-[state=checked]:bg-[#3366FF]"
            />
          </div>

          {form.has_login ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="space-y-2">
                <Label className="text-base text-foreground">
                  Login Username
                  {form.has_login && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Input
                  placeholder="e.g. ahsan.khan"
                  value={form.login_username || ""}
                  onChange={(e) => {
                    updateForm({ login_username: e.target.value })
                    if (errors.username) {
                      setErrors({ ...errors, username: undefined })
                    }
                  }}
                  className={`h-10 text-base bg-background border-border ${errors.username ? "border-destructive" : ""}`}
                />
                {errors.username ? (
                  <p className="text-sm text-destructive">{errors.username}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">(Username for system login)</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-base text-foreground">
                  Password
                  {form.has_login && !(mode === "edit" && hasExistingLogin) && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </Label>
                <Input
                  type="password"
                  placeholder={mode === "edit" && hasExistingLogin ? "Leave blank to keep current" : "Enter password"}
                  value={form.password || ""}
                  onChange={(e) => {
                    updateForm({ password: e.target.value })
                    if (errors.password) {
                      setErrors({ ...errors, password: undefined })
                    }
                  }}
                  className={`h-10 text-base bg-background border-border ${errors.password ? "border-destructive" : ""}`}
                />
                {errors.password ? (
                  <p className="text-sm text-destructive">{errors.password}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">(Minimum 8 characters)</p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted-foreground bg-white/50 p-3 rounded-md border border-border">
              {mode === "edit"
                ? "This employee will be saved without login access changes."
                : "This employee will be created without login access."}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons matching the previous design */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 border-t border-border">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[#CCCCCC] bg-white px-4 py-2.5 text-base font-normal text-[#3366CC] transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onReset()
              setErrors({})
            }}
            className="rounded-md border border-[#CCCCCC] bg-white px-4 py-2.5 text-base font-normal text-[#3366CC] transition-colors hover:bg-gray-50"
          >
            Reset Form
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPrevious}
            className="rounded-md bg-[#3366FF] px-4 py-2.5 text-base font-normal text-white transition-colors hover:bg-[#2952CC]"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={handleFinish}
            disabled={submitting}
            className="shrink-0 rounded-md bg-[#3366FF] px-5 py-2.5 text-base font-normal text-white transition-colors hover:bg-[#2952CC] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? mode === "edit"
                ? "Saving…"
                : "Adding Staff..."
              : mode === "edit"
                ? "Save changes"
                : "Add Staff"}
          </button>
        </div>
      </div>
    </div>
  )
}