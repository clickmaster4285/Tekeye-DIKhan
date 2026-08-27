import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { useToast } from "@/hooks/use-toast"
import { getStoredToken } from "@/lib/api"
import { ROUTES, getUserEditPath } from "@/routes/config"
import {
  canDeleteUser,
  deleteUser,
  fetchUserById,
  formatDateTime,
  formatUserDate,
  locationLabel,
  roleLabel,
} from "@/lib/users-api"

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1 min-w-0">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm text-foreground break-words">{value ?? "—"}</p>
    </div>
  )
}

function displayPhone(phone: string | undefined, cell?: string): string {
  const c = cell?.trim()
  if (c) return c
  if (!phone || phone === "0000000000") return "—"
  return phone
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const userId = id ? parseInt(id, 10) : NaN
  const hasAuth = Boolean(getStoredToken())
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ["users", userId],
    queryFn: () => fetchUserById(userId),
    enabled: hasAuth && Number.isInteger(userId),
  })

  const breadcrumbs = [
    { label: "Users & Roles", href: ROUTES.USER_ROLE_MANAGEMENT },
    { label: "User Details" },
  ]

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

  if (!hasAuth) {
    return (
      <ModulePageLayout
        title="User Details"
        description="Sign in as Admin or HR"
        breadcrumbs={breadcrumbs}
      >
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Sign in with an Admin or HR account to view users.
        </p>
        <Button variant="outline" asChild className="mt-4">
          <Link to={ROUTES.USER_ROLE_MANAGEMENT}>Back to Users</Link>
        </Button>
      </ModulePageLayout>
    )
  }

  if (isLoading) {
    return (
      <ModulePageLayout title="User Details" description="Loading…" breadcrumbs={breadcrumbs}>
        <p className="text-sm text-muted-foreground flex items-center gap-2 py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading user…
        </p>
      </ModulePageLayout>
    )
  }

  if (isError || !user) {
    return (
      <ModulePageLayout title="User Details" description="User not found" breadcrumbs={breadcrumbs}>
        <Button variant="outline" asChild>
          <Link to={ROUTES.USER_ROLE_MANAGEMENT}>Back to Users</Link>
        </Button>
      </ModulePageLayout>
    )
  }

  const deletable = canDeleteUser(user)

  return (
    <ModulePageLayout
      title={user.full_name?.trim() || user.username}
      description={`@${user.username} · ${roleLabel(user.role)}`}
      breadcrumbs={breadcrumbs}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground w-fit">
          <Link to={ROUTES.USER_ROLE_MANAGEMENT}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users & Roles
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={getUserEditPath(user.id)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
          {deletable ? (
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          ) : (
            <Button variant="outline" disabled title="Admin accounts cannot be deleted">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant={user.is_active ? "default" : "secondary"}>
          {user.is_active ? "Active" : "Inactive"}
        </Badge>
        <Badge variant="outline">{roleLabel(user.role)}</Badge>
        <Badge variant="outline">
          {user.role === "ADMIN" && !user.location
            ? "All Locations"
            : locationLabel(user.location)}
        </Badge>
        {(user.role === "ADMIN" || user.role === "LOCATION_ADMIN") && (
          <Badge variant="secondary">Protected account</Badge>
        )}
      </div>

      <div className="w-full space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Name, CNIC, and address</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <DetailRow label="Name" value={user.full_name?.trim() || "—"} />
            <DetailRow label="CNIC" value={user.cnic?.trim() || "—"} />
            <DetailRow label="Address" value={user.address?.trim() || "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <DetailRow label="Office Phone 1" value={user.office_phone_1?.trim() || "—"} />
            <DetailRow label="Office Phone 2" value={user.office_phone_2?.trim() || "—"} />
            <DetailRow label="Fax No" value={user.fax_no?.trim() || "—"} />
            <DetailRow label="Cell No" value={displayPhone(user.phone, user.cell_no)} />
            <DetailRow label="Email" value={user.email} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <DetailRow label="Designation" value={user.designation?.trim() || "—"} />
            <DetailRow label="Employee ID" value={user.employee_id?.trim() || "—"} />
            <DetailRow label="Posting Date" value={formatUserDate(user.posting_date)} />
            <DetailRow label="Effective Date" value={formatUserDate(user.effective_date)} />
            <DetailRow label="Collectorate" value={user.collectorate?.trim() || "—"} />
            <DetailRow label="Role in WeBOC" value={user.we_boc_role?.trim() || "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Access</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <DetailRow label="Username" value={user.username} />
            <DetailRow label="Role" value={roleLabel(user.role)} />
            <DetailRow label="Location" value={locationLabel(user.location)} />
            <DetailRow label="Status" value={user.is_active ? "Active" : "Inactive"} />
            <DetailRow label="Account created" value={formatDateTime(user.date_joined)} />
            <DetailRow label="Last login" value={formatDateTime(user.last_login)} />
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove access for{" "}
              <strong>{user.full_name?.trim() || user.username}</strong> ({user.username}).
              Admin accounts cannot be deleted.
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
    </ModulePageLayout>
  )
}
