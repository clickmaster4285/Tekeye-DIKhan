import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Eye, EyeOff, Loader2, Trash2 } from "lucide-react"
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
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { getStoredToken } from "@/lib/api"
import { getStoredUser } from "@/lib/auth"
import {
  getUserLocationFilter,
  isLocationAdmin,
  rolesAvailableToLocationAdmin,
} from "@/lib/location-access"
import { ROUTES, getUserDetailPath } from "@/routes/config"
import {
  COLLECTORATE_OPTIONS,
  WEBOC_ROLE_OPTIONS,
  ROLE_OPTIONS,
  LOCATION_OPTIONS,
  canDeleteUser,
  createUser,
  deleteUser,
  updateUser,
  fetchUserById,
} from "@/lib/users-api"

type FormState = {
  username: string
  password: string
  full_name: string
  cnic: string
  office_phone_1: string
  office_phone_2: string
  fax_no: string
  cell_no: string
  email: string
  address: string
  designation: string
  employee_id: string
  posting_date: string
  role: string
  location: string
  collectorate: string
  effective_date: string
  we_boc_role: string
  is_active: boolean
}

const emptyForm: FormState = {
  username: "",
  password: "",
  full_name: "",
  cnic: "",
  office_phone_1: "",
  office_phone_2: "",
  fax_no: "",
  cell_no: "",
  email: "",
  address: "",
  designation: "",
  employee_id: "",
  posting_date: "",
  role: "RECEPTIONIST",
  location: "",
  collectorate: "",
  effective_date: "",
  we_boc_role: "",
  is_active: true,
}

function displayPhone(phone: string | undefined): string {
  if (!phone || phone === "0000000000") return ""
  return phone
}

function resolveLocation(code: string | undefined, role: string): string {
  if (role === "ADMIN") return ""
  if (!code) return "PESHAWAR"
  if (LOCATION_OPTIONS.some((o) => o.value === code)) return code
  return "PESHAWAR"
}

function resolveRole(role: string | undefined): string {
  const r = (role ?? "").trim().toUpperCase()
  if (ROLE_OPTIONS.some((o) => o.value === r)) return r
  return r || "RECEPTIONIST"
}

export default function UserFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const userId = id ? parseInt(id, 10) : NaN
  const isEditing = Number.isInteger(userId)
  const hasAuth = Boolean(getStoredToken())
  const actor = getStoredUser()
  const actorIsLocationAdmin = isLocationAdmin(actor?.role)
  const locationLocked = actorIsLocationAdmin

  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const availableRoles = useMemo(() => {
    if (actorIsLocationAdmin) {
      const allowed = new Set(rolesAvailableToLocationAdmin())
      return ROLE_OPTIONS.filter((r) => allowed.has(r.value))
    }
    return ROLE_OPTIONS
  }, [actorIsLocationAdmin])

  const showLocationField = form.role !== "ADMIN"
  const locationRequired = form.role !== "ADMIN"

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ["users", userId],
    queryFn: () => fetchUserById(userId),
    enabled: isEditing && hasAuth,
  })

  useEffect(() => {
    if (actorIsLocationAdmin && actor?.location) {
      setForm((p) => ({ ...p, location: actor.location! }))
    }
  }, [actorIsLocationAdmin, actor?.location])

  useEffect(() => {
    if (!user) return
    const role = resolveRole(user.role)
    setForm({
      username: user.username,
      password: "",
      full_name: user.full_name ?? "",
      cnic: user.cnic ?? "",
      office_phone_1: user.office_phone_1 ?? "",
      office_phone_2: user.office_phone_2 ?? "",
      fax_no: user.fax_no ?? "",
      cell_no: user.cell_no ?? displayPhone(user.phone),
      email: user.email,
      address: user.address ?? "",
      designation: user.designation ?? "",
      employee_id: user.employee_id ?? "",
      posting_date: user.posting_date ?? "",
      role,
      location: resolveLocation(user.location, role),
      collectorate: user.collectorate ?? "",
      effective_date: user.effective_date ?? "",
      we_boc_role: user.we_boc_role ?? "",
      is_active: user.is_active,
    })
  }, [user])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((p) => ({ ...p, [key]: value }))
  }

  const handleDelete = async () => {
    if (!user || !canDeleteUser(user)) return
    setDeleting(true)
    try {
      await deleteUser(user.id)
      await queryClient.invalidateQueries({ queryKey: ["users"] })
      toast({ title: "User deleted" })
      navigate(ROUTES.USER_ROLE_MANAGEMENT)
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  const onSave = async () => {
    if (!hasAuth) {
      toast({
        title: "Sign in required",
        description: "Log in as Admin or HR to manage users.",
        variant: "destructive",
      })
      return
    }
    if (!form.full_name.trim()) {
      toast({ title: "Name required", variant: "destructive" })
      return
    }
    if (!form.email.trim()) {
      toast({ title: "Email required", variant: "destructive" })
      return
    }
    if (locationRequired && !form.location) {
      toast({ title: "Location required", variant: "destructive" })
      return
    }
    if (!isEditing) {
      if (!form.username.trim()) {
        toast({ title: "Username required", variant: "destructive" })
        return
      }
      if (form.password.length < 6) {
        toast({ title: "Password must be at least 6 characters", variant: "destructive" })
        return
      }
    } else if (form.password && form.password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const profile = {
        full_name: form.full_name.trim(),
        cnic: form.cnic.trim(),
        office_phone_1: form.office_phone_1.trim(),
        office_phone_2: form.office_phone_2.trim(),
        fax_no: form.fax_no.trim(),
        cell_no: form.cell_no.trim(),
        address: form.address.trim(),
        designation: form.designation.trim(),
        employee_id: form.employee_id.trim(),
        posting_date: form.posting_date || null,
        collectorate: form.collectorate.trim(),
        effective_date: form.effective_date || null,
        we_boc_role: form.we_boc_role.trim(),
      }

      if (isEditing) {
        const roleChanged = Boolean(user && user.role !== form.role)
        await updateUser(userId, {
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password || undefined,
          role: form.role,
          location: form.role === "ADMIN" ? "" : form.location,
          phone: form.cell_no.trim() || undefined,
          is_active: form.is_active,
          // Role change drops custom module grants so the role's default sidebar applies.
          ...(roleChanged ? { allowed_modules: [] } : {}),
          ...profile,
        })
        toast({ title: "User updated" })
        await queryClient.invalidateQueries({ queryKey: ["users"] })
        navigate(getUserDetailPath(userId))
        return
      } else {
        await createUser({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          location: form.role === "ADMIN" ? "" : form.location,
          phone: form.cell_no.trim() || undefined,
          ...profile,
        })
        toast({ title: "User created" })
      }
      await queryClient.invalidateQueries({ queryKey: ["users"] })
      if (!isEditing) navigate(ROUTES.USER_ROLE_MANAGEMENT)
    } catch (e) {
      toast({
        title: isEditing ? "Update failed" : "Create failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const breadcrumbs = [
    { label: "Users & Roles", href: ROUTES.USER_ROLE_MANAGEMENT },
    { label: isEditing ? "Edit User" : "Add User" },
  ]

  if (!hasAuth) {
    return (
      <ModulePageLayout
        title="User Account"
        description="Sign in as Admin or HR"
        breadcrumbs={breadcrumbs}
      >
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Sign in with an Admin or HR account to add or edit users.
        </p>
        <Button variant="outline" asChild className="mt-4">
          <Link to={ROUTES.USER_ROLE_MANAGEMENT}>Back to Users</Link>
        </Button>
      </ModulePageLayout>
    )
  }

  if (isEditing && isLoading) {
    return (
      <ModulePageLayout title="Edit User" description="Loading…" breadcrumbs={breadcrumbs}>
        <p className="text-sm text-muted-foreground flex items-center gap-2 py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading user…
        </p>
      </ModulePageLayout>
    )
  }

  if (isEditing && (isError || !user)) {
    return (
      <ModulePageLayout title="Edit User" description="User not found" breadcrumbs={breadcrumbs}>
        <Button variant="outline" asChild>
          <Link to={ROUTES.USER_ROLE_MANAGEMENT}>Back to Users</Link>
        </Button>
      </ModulePageLayout>
    )
  }

  return (
    <ModulePageLayout
      title={isEditing ? "Edit User" : "Add User"}
      description={
        isEditing
          ? "Update account and profile details. Leave password blank to keep the current password."
          : "Create a login account with profile details stored in the database."
      }
      breadcrumbs={breadcrumbs}
    >
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <Link to={ROUTES.USER_ROLE_MANAGEMENT}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users & Roles
          </Link>
        </Button>
      </div>

      <form
        key={user?.id ?? "new-user"}
        className="w-full space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          void onSave()
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Name, CNIC, and address</CardDescription>
          </CardHeader>
          <CardContent className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="space-y-2 sm:col-span-2 lg:col-span-2 xl:col-span-2">
              <Label htmlFor="user-name">Name *</Label>
              <Input
                id="user-name"
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-cnic">CNIC</Label>
              <Input
                id="user-cnic"
                value={form.cnic}
                onChange={(e) => set("cnic", e.target.value)}
                placeholder="e.g. 35202-1234567-1"
              />
            </div>
            <div className="space-y-2 col-span-full">
              <Label htmlFor="user-address">Address</Label>
              <Textarea
                id="user-address"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Residential / office address"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
            <CardDescription>Office phones, fax, mobile, and email</CardDescription>
          </CardHeader>
          <CardContent className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="office-phone-1">Office Phone 1</Label>
              <Input
                id="office-phone-1"
                type="tel"
                value={form.office_phone_1}
                onChange={(e) => set("office_phone_1", e.target.value)}
                placeholder="e.g. 091-1234567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="office-phone-2">Office Phone 2</Label>
              <Input
                id="office-phone-2"
                type="tel"
                value={form.office_phone_2}
                onChange={(e) => set("office_phone_2", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-fax">Fax No</Label>
              <Input
                id="user-fax"
                type="tel"
                value={form.fax_no}
                onChange={(e) => set("fax_no", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-cell">Cell No</Label>
              <Input
                id="user-cell"
                type="tel"
                value={form.cell_no}
                onChange={(e) => set("cell_no", e.target.value)}
                placeholder="e.g. 0300-1234567"
              />
            </div>
            <div className="space-y-2 col-span-full">
              <Label htmlFor="user-email">Email *</Label>
              <Input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="e.g. john@customs.gov.pk"
                autoComplete="email"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employment</CardTitle>
            <CardDescription>Designation, employee ID, and posting dates</CardDescription>
          </CardHeader>
          <CardContent className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="user-designation">Designation</Label>
              <Input
                id="user-designation"
                value={form.designation}
                onChange={(e) => set("designation", e.target.value)}
                placeholder="e.g. Inspector"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-employee-id">Employee ID</Label>
              <Input
                id="user-employee-id"
                value={form.employee_id}
                onChange={(e) => set("employee_id", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-posting-date">Posting Date</Label>
              <Input
                id="user-posting-date"
                type="date"
                value={form.posting_date}
                onChange={(e) => set("posting_date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-effective-date">Effective Date</Label>
              <Input
                id="user-effective-date"
                type="date"
                value={form.effective_date}
                onChange={(e) => set("effective_date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Collectorate</Label>
              <Select value={form.collectorate || undefined} onValueChange={(v) => set("collectorate", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select collectorate" />
                </SelectTrigger>
                <SelectContent>
                  {form.collectorate &&
                    !COLLECTORATE_OPTIONS.some((c) => c.value === form.collectorate) && (
                      <SelectItem value={form.collectorate}>{form.collectorate}</SelectItem>
                    )}
                  {COLLECTORATE_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role in WeBOC</Label>
              <Select value={form.we_boc_role || undefined} onValueChange={(v) => set("we_boc_role", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select WeBOC role" />
                </SelectTrigger>
                <SelectContent>
                  {form.we_boc_role &&
                    !WEBOC_ROLE_OPTIONS.some((r) => r.value === form.we_boc_role) && (
                      <SelectItem value={form.we_boc_role}>{form.we_boc_role}</SelectItem>
                    )}
                  {WEBOC_ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Access</CardTitle>
            <CardDescription>Login credentials, application role, and location</CardDescription>
          </CardHeader>
          <CardContent className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="user-username">Username *</Label>
              <Input
                id="user-username"
                value={form.username}
                onChange={(e) => set("username", e.target.value)}
                placeholder="e.g. john.doe"
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">
                {isEditing ? "New password" : "Password *"}
              </Label>
              <div className="relative">
                <Input
                  id="user-password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder={isEditing ? "Leave blank to keep current" : "At least 6 characters"}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => {
                  set("role", v)
                  if (v === "ADMIN") {
                    set("location", "")
                  } else if (!form.location) {
                    set("location", actor?.location || "PESHAWAR")
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {form.role && !availableRoles.some((r) => r.value === form.role) && (
                    <SelectItem value={form.role}>{form.role}</SelectItem>
                  )}
                  {availableRoles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showLocationField && (
            <div className="space-y-2">
              <Label>Location {locationRequired ? "*" : ""}</Label>
              <Select
                value={form.location}
                onValueChange={(v) => set("location", v)}
                disabled={locationLocked}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_OPTIONS.map((loc) => (
                    <SelectItem key={loc.value} value={loc.value}>
                      {loc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {locationLocked && (
                <p className="text-xs text-muted-foreground">
                  Users are created for your assigned location only.
                </p>
              )}
            </div>
            )}
            {isEditing && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.is_active ? "active" : "inactive"}
                  onValueChange={(v) => set("is_active", v === "active")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between pb-8">
          {isEditing && user && canDeleteUser(user) ? (
            <Button
              type="button"
              variant="destructive"
              disabled={saving || deleting}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete User
            </Button>
          ) : (
            <div />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" asChild disabled={saving}>
            <Link to={isEditing && user ? getUserDetailPath(user.id) : ROUTES.USER_ROLE_MANAGEMENT}>
              Cancel
            </Link>
          </Button>
          <Button type="submit" className="bg-[#3b82f6] text-white hover:bg-[#2563eb]" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : isEditing ? (
              "Update User"
            ) : (
              "Save User"
            )}
          </Button>
          </div>
        </div>
      </form>

      {isEditing && user && (
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete user?</AlertDialogTitle>
              <AlertDialogDescription>
                Remove access for <strong>{form.full_name || user.username}</strong>? Admin accounts
                cannot be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleting}
                onClick={(e) => {
                  e.preventDefault()
                  void handleDelete()
                }}
              >
                {deleting ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </ModulePageLayout>
  )
}
