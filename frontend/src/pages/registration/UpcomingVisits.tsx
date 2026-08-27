import { ROUTES } from "@/routes/config"
import { VmsListPage } from "@/components/vms/vms-list-page"

export default function UpcomingVisitsPage() {
  return (
    <VmsListPage
      title="Upcoming Visits"
      description="View scheduled and pending visits."
      storageKey="vms_upcoming_visits_rows"
      breadcrumbs={[
        { label: "Home", href: ROUTES.DASHBOARD },
        { label: "Visitor Management System" },
        { label: "Host & Department Dashboard" },
        { label: "Upcoming Visits" },
      ]}
      columns={[
        { key: "visitor", label: "Visitor" },
        { key: "time", label: "Time" },
        { key: "purpose", label: "Purpose" },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "visitor", label: "Visitor Name" },
        { key: "time", label: "Time" },
        { key: "purpose", label: "Purpose" },
        { key: "status", label: "Status" },
      ]}
      filterField="status"
      initialRows={[
        { visitor: "Fatima Noor", time: "10:30 AM", purpose: "Meeting", status: "Scheduled" },
        { visitor: "John Lee", time: "01:15 PM", purpose: "Vendor delivery", status: "Pending Approval" },
        { visitor: "Ayesha Malik", time: "03:00 PM", purpose: "Interview", status: "Scheduled" },
      ]}
    />
  )
}
