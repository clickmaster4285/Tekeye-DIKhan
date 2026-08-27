import { ROUTES } from "@/routes/config"
import { VmsListPage } from "@/components/vms/vms-list-page"

export default function VisitorNotificationsPage() {
  return (
    <VmsListPage
      title="Visitor Notifications"
      description="Host receives arrival notifications."
      storageKey="vms_visitor_notifications_rows"
      breadcrumbs={[
        { label: "Home", href: ROUTES.DASHBOARD },
        { label: "Visitor Management System" },
        { label: "Host & Department Dashboard" },
        { label: "Visitor Notifications" },
      ]}
      columns={[
        { key: "message", label: "Notification" },
        { key: "host", label: "Host" },
        { key: "time", label: "Time" },
      ]}
      formFields={[
        { key: "message", label: "Notification Message" },
        { key: "host", label: "Host" },
        { key: "time", label: "Time" },
      ]}
      filterField="host"
      initialRows={[
        { message: "Ali Hassan has arrived at Gate 1", host: "Syed Muhammad Ali", time: "09:15 AM" },
        { message: "Sara Iqbal check-in completed", host: "Hira Qureshi", time: "11:40 AM" },
      ]}
    />
  )
}
