import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Users, UserPlus, Building2, Mail, Search, Eye, Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
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
import {
  fetchEmployeesDirectory,
  deleteStaff,
  type StaffRecord,
} from "@/lib/staff-api"
import { StaffAvatar } from "@/components/hr/staff-avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROUTES, getEmployeeDetailPath } from "@/routes/config"
import { useToast } from "@/hooks/use-toast"
import { preloadHumanFaceModel } from "@/lib/human-face-validation"

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const
const DEFAULT_PAGE_SIZE = 20

export default function EmployeesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    preloadHumanFaceModel()
  }, [])
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value))
    setPage(1)
  }

  const {
    data: staff = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["staff", "directory"],
    queryFn: fetchEmployeesDirectory,
  })

  const error = queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null

  const handleViewEmployee = (employee: StaffRecord) => {
    navigate(getEmployeeDetailPath(employee.id))
  }

  const handleDeleteEmployee = async (id: number) => {
    if (!confirm("Are you sure you want to delete this employee?")) return
    try {
      await deleteStaff(id)
      toast({ title: "Employee deleted", description: "The record has been removed." })
      void queryClient.invalidateQueries({ queryKey: ["staff"] })
      void refetch()
    } catch (err) {
      toast({ 
        title: "Delete failed", 
        description: err instanceof Error ? err.message : "Failed to delete employee",
        variant: "destructive"
      })
    }
  }

  const filtered = useMemo(
    () =>
      staff.filter(
        (s) =>
          !search.trim() ||
          s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
          s.father_name?.toLowerCase().includes(search.toLowerCase()) ||
          (s.personal_number?.toString() || "").toLowerCase().includes(search.toLowerCase()) ||
          (s.user?.toString() || "").toLowerCase().includes(search.toLowerCase()) ||
          s.department?.toLowerCase().includes(search.toLowerCase()) ||
          s.designation?.toLowerCase().includes(search.toLowerCase()) ||
          s.cnic?.includes(search) ||
          s.phone?.includes(search) ||
          s.transferred_from?.toLowerCase().includes(search.toLowerCase()) ||
          s.transferred_to?.toLowerCase().includes(search.toLowerCase())
      ),
    [staff, search]
  )

  useEffect(() => {
    setPage(1)
  }, [search])

  const count = filtered.length
  const totalPages = Math.max(1, Math.ceil(count / pageSize))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pagedStaff = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  )

  const hasNext = page < totalPages
  const hasPrev = page > 1
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, count)

  return (
    <ModulePageLayout
      title="Employees"
      description="Staff directory for Collectorate of Customs (Enforcement), Peshawar."
      breadcrumbs={[{ label: "HR" }, { label: "Employees" }]}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Employees
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{staff.length}</div>
              <p className="text-xs text-muted-foreground mt-1">From API / saved staff</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Database records
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{staff.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Active staff records</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                On Leave Today
              </CardTitle>
              <Mail className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">—</div>
              <p className="text-xs text-muted-foreground mt-1">N/A</p>
            </CardContent>
          </Card>
        </div>

        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-xl font-semibold">Employee Directory</CardTitle>
              <CardDescription>
                Database staff ({staff.length} records)
              </CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search by name, father name, designation..."
                  className="w-full pl-9 sm:w-80"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                />
              </div>
              <Button 
                className="w-full bg-[#3b82f6] text-white hover:bg-[#2563eb] sm:w-auto"
                onClick={() => navigate(ROUTES.ADD_STAFF)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Staff
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="text-sm text-destructive mb-4">{error}</p>
            )}
            {loading ? (
              <p className="text-sm text-muted-foreground py-8">Loading staff…</p>
            ) : (
            <>
            <div className="w-full max-w-full overflow-x-auto rounded-md border pb-2">
              <Table className="min-w-[1600px]">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12 text-center">S.No.</TableHead>
                    <TableHead>Personal No.</TableHead>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Father&apos;s Name</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead className="text-center">BPS</TableHead>
                    <TableHead>CNIC</TableHead>
                    <TableHead>Mobile No.</TableHead>
                    <TableHead>Current place of Posting</TableHead>
                    <TableHead>Transferred From</TableHead>
                    <TableHead>Transferred To</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                        No staff found. Click "Add Staff" to create a new record.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedStaff.map((row, index) => {
                      const rowNumber = (page - 1) * pageSize + index + 1
                      return (
                      <TableRow 
                        key={row.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewEmployee(row)}
                      >
                        <TableCell className="text-center font-medium">
                          {rowNumber}
                        </TableCell>
                        <TableCell>{row.personal_number || row.user || row.employee_id || "—"}</TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                             <StaffAvatar
                                profileImage={row.profile_image}
                                fullName={row.full_name}
                                className="h-6 w-6"
                                fallbackClassName="text-[10px]"
                              />
                              <span className="truncate max-w-[150px]">{row.full_name || row.user}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate">{row.father_name || "—"}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{row.designation || "—"}</TableCell>
                        <TableCell className="text-center">{row.bps || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.cnic || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.phone || row.phone_primary || "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{row.current_posting || row.branch_location || "—"}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{row.transferred_from || "—"}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{row.transferred_to || "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-blue-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(getEmployeeDetailPath(row.id))
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-green-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/employees/${row.id}/edit`)
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-red-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteEmployee(row.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )})
                  )}
                </TableBody>
              </Table>
            </div>
            {count > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
                <div className="flex flex-wrap items-center gap-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {from}–{to} of {count}
                    {search.trim() ? ` (filtered from ${staff.length})` : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
                    <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                      <SelectTrigger className="w-[72px]" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!hasPrev}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={!hasNext}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            </>
            )}
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}