import { ROUTES } from "@/routes/config"
import { VmsListPage } from "@/components/vms/vms-list-page"

export default function VisitorHistoryPage() {
  return (
    <VmsListPage
      title="Visitor History"
      description="Host can view past visitor records."
      storageKey="vms_visitor_history_rows"
      breadcrumbs={[
        { label: "Home", href: ROUTES.DASHBOARD },
        { label: "Visitor Management System" },
        { label: "Host & Department Dashboard" },
        { label: "Visitor History" },
      ]}
      columns={[
        { key: "visitor", label: "Visitor" },
        { key: "date", label: "Date" },
        { key: "purpose", label: "Purpose" },
        { key: "host", label: "Host" },
      ]}
      formFields={[
        { key: "visitor", label: "Visitor Name" },
        { key: "date", label: "Date" },
        { key: "purpose", label: "Purpose" },
        { key: "host", label: "Host" },
      ]}
      filterField="purpose"
      initialRows={[
        { visitor: "Hamza Khan", date: "2026-01-08", purpose: "Interview", host: "Usman Tariq" },
        { visitor: "Sara Iqbal", date: "2026-01-14", purpose: "Official Meeting", host: "Hira Qureshi" },
        { visitor: "Robert Kim", date: "2026-01-21", purpose: "Vendor Review", host: "Bilal Saeed" },
      ]}
    />
  )
}
