import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LOCATION_OPTIONS, inferLocationCode } from "@/lib/locations"
import { Copy, Eye, EyeOff, KeyRound, UserRound, Check } from "lucide-react"
import { DEFAULT_STAFF_LOGIN_PASSWORD } from "@/lib/staff-api"

export type AddStaffStep3Form = {
  has_login?: boolean
  login_username?: string
  password?: string
  role?: string
  location?: string
  current_posting?: string
  branch_location?: string
  city?: string
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
  generatedLoginId,
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
  generatedLoginId?: string
}) {
  const [errors, setErrors] = useState<{ password?: string; location?: string }>({})
  const [showPassword, setShowPassword] = useState(true)
  const [copied, setCopied] = useState<"user" | "pass" | null>(null)
  const inferredLocation =
    form.location || inferLocationCode(form.branch_location, form.current_posting, form.city)
  const needsLocation = Boolean(form.has_login) && form.role !== "ADMIN" && !inferredLocation
  const displayUsername =
    hasExistingLogin
      ? form.login_username || ""
      : generatedLoginId || form.login_username || ""

  const validateForm = (): boolean => {
    if (!form.has_login) {
      return true
    }

    const newErrors: { password?: string; location?: string } = {}

    if (!form.password?.trim()) {
      if (!(mode === "edit" && hasExistingLogin)) {
        newErrors.password = "Password is required"
      }
    } else if (form.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters"
    }

    if (needsLocation && !(mode === "edit" && hasExistingLogin)) {
      newErrors.location = "Location is required because this employee has no posting location yet"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFinish = () => {
    if (validateForm()) {
      onFinish()
    }
  }

  async function copyValue(kind: "user" | "pass", value: string) {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-8">
      <Label className="text-[22px] font-bold text-foreground">Login Access</Label>

      <div className="space-y-3 border-t border-border pt-6">
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-6 transition-colors">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-medium text-foreground">Give this employee login access?</p>
              <p className="text-sm text-muted-foreground">
                {mode === "edit" && hasExistingLogin
                  ? "Leave password blank to keep the current password. Enter a new one only to change it."
                  : "Username is built from the full name (lowercase with dots). Default password is shown so you can share it."}
              </p>
            </div>
            <Switch
              checked={Boolean(form.has_login)}
              onCheckedChange={(checked) => {
                updateForm({
                  has_login: checked,
                  ...(checked && !(mode === "edit" && hasExistingLogin) && !form.password
                    ? { password: DEFAULT_STAFF_LOGIN_PASSWORD }
                    : {}),
                })
                setErrors({})
              }}
              className="data-[state=checked]:bg-[#3366FF]"
            />
          </div>

          {form.has_login ? (
            <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-300">Login credentials</p>
                <p className="mt-0.5 text-sm text-slate-200">
                  Share these details with the employee after saving.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-base text-foreground">
                    <UserRound className="h-3.5 w-3.5" />
                    Username
                  </Label>
                  <div className="relative">
                    <Input
                      readOnly
                      value={displayUsername || "Generated from full name on save"}
                      className="h-11 border-slate-200 bg-slate-50 pr-10 font-mono text-sm tracking-wide"
                    />
                    {displayUsername ? (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        onClick={() => void copyValue("user", displayUsername)}
                        title="Copy username"
                      >
                        {copied === "user" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      </button>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    From full name — e.g. Umar Farooq → <span className="font-mono">umar.farooq</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-base text-foreground">
                    <KeyRound className="h-3.5 w-3.5" />
                    Password
                    {form.has_login && !(mode === "edit" && hasExistingLogin) && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={
                        mode === "edit" && hasExistingLogin
                          ? "Leave blank to keep current"
                          : DEFAULT_STAFF_LOGIN_PASSWORD
                      }
                      value={form.password || ""}
                      onChange={(e) => {
                        updateForm({ password: e.target.value })
                        if (errors.password) {
                          setErrors({ ...errors, password: undefined })
                        }
                      }}
                      className={`h-11 border-slate-200 bg-white pr-20 font-mono text-sm tracking-widest ${errors.password ? "border-destructive" : ""}`}
                    />
                    <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                      <button
                        type="button"
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        onClick={() => setShowPassword((v) => !v)}
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      {form.password ? (
                        <button
                          type="button"
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          onClick={() => void copyValue("pass", form.password || "")}
                          title="Copy password"
                        >
                          {copied === "pass" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {errors.password ? (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {mode === "edit" && hasExistingLogin
                        ? "Leave blank to keep the current password."
                        : (
                          <>
                            Default temporary password is{" "}
                            <span className="font-mono font-medium text-slate-700">{DEFAULT_STAFF_LOGIN_PASSWORD}</span>
                            {" "}(visible so you can share it).
                          </>
                        )}
                    </p>
                  )}
                </div>

                {form.role ? (
                  <p className="text-sm text-muted-foreground md:col-span-2">
                    Role from employee: {form.role.replace(/_/g, " ")}
                  </p>
                ) : null}
                {!needsLocation && inferredLocation && form.role !== "ADMIN" ? (
                  <p className="text-sm text-muted-foreground md:col-span-2">
                    Location from employee: {inferredLocation.replace(/_/g, " ")}
                  </p>
                ) : null}
                {needsLocation ? (
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-base text-foreground">
                      Location <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={form.location || ""}
                      onValueChange={(value) => {
                        updateForm({ location: value })
                        if (errors.location) setErrors({ ...errors, location: undefined })
                      }}
                    >
                      <SelectTrigger className={errors.location ? "border-destructive" : ""}>
                        <SelectValue placeholder="Select office location" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCATION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.location ? (
                      <p className="text-sm text-destructive">{errors.location}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Required because this employee does not have a posting location yet.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-border bg-white/50 p-3 text-sm text-muted-foreground">
              {mode === "edit"
                ? "This employee will be saved without login access changes."
                : "This employee will be created without login access."}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
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
            className="shrink-0 rounded-md bg-[#3366FF] px-5 py-2.5 text-base font-normal text-white transition-colors hover:bg-[#2952CC] disabled:cursor-not-allowed disabled:opacity-50"
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
