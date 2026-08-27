import { ROUTES } from "@/routes/config"
import { VmsListPage } from "@/components/vms/vms-list-page"

export default function CargoDeliveryLogsPage() {
  return (
    <VmsListPage
      title="Cargo/Delivery Logs"
      description="Track goods or courier entries."
      storageKey="vms_cargo_delivery_logs_rows"
      breadcrumbs={[
        { label: "Home", href: ROUTES.DASHBOARD },
        { label: "Visitor Management System" },
        { label: "Vehicle & Contractor Management" },
        { label: "Cargo/Delivery Logs" },
      ]}
      columns={[
        { key: "logId", label: "Log ID" },
        { key: "type", label: "Type" },
        { key: "details", label: "Details" },
        { key: "time", label: "Time" },
      ]}
      formFields={[
        { key: "logId", label: "Log ID" },
        { key: "type", label: "Type (Courier/Goods)" },
        { key: "details", label: "Details" },
        { key: "time", label: "Time" },
      ]}
      filterField="type"
      initialRows={[
        { logId: "CD-9001", type: "Courier", details: "2 parcels received at Gate 3", time: "10:25 AM" },
        { logId: "CD-9012", type: "Goods", details: "Electrical spare parts delivered to Warehouse", time: "01:05 PM" },
      ]}
    />
  )
}
