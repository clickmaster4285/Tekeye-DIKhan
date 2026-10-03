import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Users, Shield, UserPlus, Loader2, Eye, Pencil, Trash2, KeyRound, Copy, Check } from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { ModulePermissionsDialog } from "@/components/settings/module-permissions-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { getStoredToken } from "@/lib/api"
import { getStoredUser } from "@/lib/auth"
import { isGlobalAdmin } from "@/lib/location-access"
import {
  canDeleteUser,
  deleteUser,
  fetchUsers,
  locationLabel,
  roleLabel,
  type ApiUser,
} from "@/lib/users-api"
import { DEFAULT_STAFF_LOGIN_PASSWORD } from "@/lib/staff-api"
import { ROUTES, getUserDetailPath, getUserEditPath } from "@/routes/config"

export default function UserRoleManagementPage() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<ApiUser | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [permissionsUser, setPermissionsUser] = useState<ApiUser | null>(null)
  const [rolePickRole, setRolePickRole] = useState<string | null>(null)
  const [copiedPassword, setCopiedPassword] = useState(false)

  const copyDefaultPassword = async () => {
    try {
      await navigator.clipboard.writeText(DEFAULT_STAFF_LOGIN_PASSWORD)
      setCopiedPassword(true)
      window.setTimeout(() => setCopiedPassword(false), 1500)
    } catch {
      /* ignore */
    }
  }

  const hasAuth = Boolean(getStoredToken())
  const canManageModules = isGlobalAdmin(getStoredUser()?.role)

  const {
    data: users = [],
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ["users", "list"],
    queryFn: fetchUsers,
    enabled: hasAuth,
  })

  const openAddForm = () => {
    if (!hasAuth) {
      toast({
        title: "Sign in required",
        description: "Log in as Admin or HR to create users in the database.",
        variant: "destructive",
      })
      return
    }
    navigate(ROUTES.ADD_USER)
  }

  const openEditForm = (user: ApiUser) => {
    if (!hasAuth) {
      toast({
        title: "Sign in required",
        description: "Log in as Admin or HR to edit users.",
        variant: "destructive",
      })
      return
    }
    navigate(getUserEditPath(user.id))
  }

  const openView = (user: ApiUser) => {
    if (!hasAuth) return
    navigate(getUserDetailPath(user.id))
  }

  const openPermissions = (user: ApiUser) => {
    if (!canManageModules) {
      toast({
        title: "Super Admin only",
        description: "Only Super Admin can assign module permissions.",
        variant: "destructive",
      })
      return
    }
    setPermissionsUser(user)
  }

  const confirmDelete = async () => {
    if (!deleteTarget || !canDeleteUser(deleteTarget)) return
    setDeleting(true)
    try {
      await deleteUser(deleteTarget.id)
      await queryClient.invalidateQueries({ queryKey: ["users"] })
      toast({ title: "User deleted", description: deleteTarget.username })
      setDeleteTarget(null)
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Could not delete user",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      u.username.toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.full_name || "").toLowerCase().includes(q) ||
      roleLabel(u.role).toLowerCase().includes(q)
    )
  })

  const rolePickUsers = rolePickRole ? users.filter((u) => u.role === rolePickRole) : []

  return (
    <ModulePageLayout
      title="User & Role Management"
      description="Manage accounts, roles, and Super Admin module permissions."
    >
      <div className="space-y-6">
        {loadError && (
          <p className="text-sm text-destructive">
            {loadError instanceof Error ? loadError.message : "Failed to load users"}
          </p>
        )}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-[#3b82f6]" />
                Users &amp; Roles
              </CardTitle>
              <CardDescription>
                Create users, assign roles
                {canManageModules
                  ? ", and grant sidebar modules per user. Super Admin always has every module."
                  : "."}
              </CardDescription>
            </div>
            <Button type="button" className="bg-[#3b82f6] hover:bg-[#2563eb]" onClick={openAddForm}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add user
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="users">
              <TabsList>
                <TabsTrigger value="users">
                  <Users className="h-4 w-4 mr-1.5" />
                  Users
                </TabsTrigger>
                <TabsTrigger value="roles">
                  <Shield className="h-4 w-4 mr-1.5" />
                  Roles
                </TabsTrigger>
              </TabsList>
              <TabsContent value="users" className="mt-6">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Input
                    placeholder="Search users..."
                    className="w-full sm:w-64"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <KeyRound className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="text-slate-600">Default password</span>
                    <code className="rounded bg-white px-2 py-0.5 font-mono text-sm font-semibold tracking-wider text-slate-900 ring-1 ring-slate-200">
                      {DEFAULT_STAFF_LOGIN_PASSWORD}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copyDefaultPassword()}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-white hover:text-slate-800"
                      title="Copy default password"
                      aria-label="Copy default password"
                    >
                      {copiedPassword ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground py-8 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading users…
                  </p>
                ) : (
                  <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                    <Table className="w-auto min-w-full [&_th]:px-2 [&_th]:py-2 [&_td]:px-2 [&_td]:py-1.5">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[1%] whitespace-nowrap">Name</TableHead>
                          <TableHead className="w-[1%] whitespace-nowrap">Username</TableHead>
                          <TableHead className="w-[1%] whitespace-nowrap">Password</TableHead>
                          <TableHead className="w-[1%] whitespace-nowrap">Email</TableHead>
                          <TableHead className="w-[1%] whitespace-nowrap">Role</TableHead>
                          <TableHead className="w-[1%] whitespace-nowrap">Location</TableHead>
                          <TableHead className="w-[1%] whitespace-nowrap">Modules</TableHead>
                          <TableHead className="w-[1%] whitespace-nowrap">Status</TableHead>
                          <TableHead className="w-[1%] whitespace-nowrap text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                              {hasAuth ? "No users found." : "Sign in to see users."}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredUsers.map((row: ApiUser) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium whitespace-nowrap">
                                {row.full_name?.trim() || "—"}
                              </TableCell>
                              <TableCell className="whitespace-nowrap font-mono text-sm">{row.username}</TableCell>
                              <TableCell className="whitespace-nowrap">
                                {row.role === "ADMIN" || row.role === "IT_SUPERADMIN" ? (
                                  <span className="text-muted-foreground text-sm">—</span>
                                ) : (
                                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-medium tracking-wider text-slate-800">
                                    {DEFAULT_STAFF_LOGIN_PASSWORD}
                                  </code>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground whitespace-nowrap">{row.email}</TableCell>
                              <TableCell className="whitespace-nowrap">
                                <Badge variant="outline">{roleLabel(row.role)}</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground whitespace-nowrap">
                                {locationLabel(row.location)}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                                {row.role === "ADMIN" || row.role === "IT_SUPERADMIN"
                                  ? "All (auto)"
                                  : (row.allowed_modules?.length ?? 0) > 0
                                    ? `${row.allowed_modules!.length} custom`
                                    : "Role default"}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <Badge variant={row.is_active ? "default" : "secondary"}>
                                  {row.is_active ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex justify-end gap-0.5 flex-nowrap">
                            {canManageModules && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-[#3b82f6]"
                                onClick={() => openPermissions(row)}
                                title="Permissions"
                                aria-label="Permissions"
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-[#3b82f6]"
                              onClick={() => openView(row)}
                              title="View"
                              aria-label="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-[#3b82f6]"
                              onClick={() => openEditForm(row)}
                              title="Edit"
                              aria-label="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {canDeleteUser(row) ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(row)}
                                title="Delete"
                                aria-label="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled
                                title="Admin accounts cannot be deleted"
                                aria-label="Delete disabled"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="roles" className="mt-6">
                <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                  <Table className="min-w-[760px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Role Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Users</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { name: "Super Admin", desc: "Full system access — all collectorates", role: "ADMIN" },
                        { name: "IT Super Admin", desc: "Central Ops only — remote servers and live cameras", role: "IT_SUPERADMIN" },
                        { name: "Location Administrator", desc: "Full access for one collectorate site", role: "LOCATION_ADMIN" },
                        { name: "Operation Manager", desc: "Operations oversight", role: "OPERATION_MANAGER" },
                        { name: "Inspector", desc: "Inspection and field ops", role: "INSPECTOR" },
                        { name: "Collector", desc: "Collectorate level access", role: "COLLECTOR" },
                        { name: "Deputy Collector", desc: "Deputy collectorate duties", role: "DEPUTY_COLLECTOR" },
                        { name: "Assistant Collector", desc: "Assistant collectorate duties", role: "ASSISTANT_COLLECTOR" },
                        { name: "Receptionist", desc: "Reception and front desk", role: "RECEPTIONIST" },
                        { name: "Guard", desc: "Gate check-in and reception panel only", role: "GUARD" },
                        { name: "Human Resource", desc: "HR module and personnel", role: "HR" },
                        { name: "Warehouse Officer", desc: "Warehouse and inventory", role: "WAREHOUSE_OFFICER" },
                        { name: "Detection Officer", desc: "Detection and enforcement", role: "DETECTION_OFFICER" },
                        { name: "FIR Officer", desc: "FIR registration and records", role: "FIR_OFFICER" },
                        { name: "Investigation Officer", desc: "Case investigation workflow", role: "INVESTIGATION_OFFICER" },
                        { name: "Seizing Officer", desc: "Seizure and custody operations", role: "SEIZING_OFFICER" },
                        { name: "PRAL", desc: "ASO portal, auction, and seizure data", role: "PRAL" },
                      ].map((row) => (
                        <TableRow key={row.role}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-muted-foreground">{row.desc}</TableCell>
                          <TableCell>
                            {users.filter((u) => u.role === row.role).length}
                          </TableCell>
                          <TableCell className="text-right">
                            {canManageModules && row.role !== "ADMIN" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[#3b82f6]"
                                onClick={() => setRolePickRole(row.role)}
                              >
                                Permissions
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" disabled title="Super Admin has all modules">
                                Permissions
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <ModulePermissionsDialog
        user={permissionsUser}
        open={Boolean(permissionsUser)}
        onOpenChange={(open) => {
          if (!open) setPermissionsUser(null)
        }}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ["users"] })
        }}
      />

      <Dialog open={Boolean(rolePickRole)} onOpenChange={(open) => !open && setRolePickRole(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select user</DialogTitle>
            <DialogDescription>
              Choose a {rolePickRole ? roleLabel(rolePickRole) : ""} user to edit module permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {rolePickUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No users with this role.</p>
            ) : (
              rolePickUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setRolePickRole(null)
                    openPermissions(u)
                  }}
                >
                  <span className="font-medium">{u.full_name?.trim() || u.username}</span>
                  <span className="text-muted-foreground">{u.username}</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove access for{" "}
              <strong>{deleteTarget?.full_name?.trim() || deleteTarget?.username}</strong>? Admin
              accounts cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
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
