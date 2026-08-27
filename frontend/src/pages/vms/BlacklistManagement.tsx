import { ROUTES } from "@/routes/config"
import { VmsListPage } from "@/components/vms/vms-list-page"

/** VMS route alias — same data as registration blacklist (database). */
export default function BlacklistManagement() {
  return (
    <VmsListPage
      title="Blacklist Management"
      description="Add or restrict visitors permanently or temporarily."
      storageKey="vms_blacklist_management_rows"
      breadcrumbs={[
        { label: "Home", href: ROUTES.DASHBOARD },
        { label: "Visitor Management System" },
        { label: "Blacklist Management" },
      ]}
      columns={[
        { key: "name", label: "Name" },
        { key: "phone", label: "Phone" },
        { key: "document_type", label: "Document Type" },
        { key: "document", label: "Document No." },
        { key: "restriction", label: "Restriction" },
        { key: "reason", label: "Reason" },
      ]}
      formFields={[
        { key: "name", label: "Name" },
        { key: "phone", label: "Phone" },
        { key: "document_type", label: "Document Type" },
        { key: "document", label: "Document No." },
        { key: "restriction", label: "Restriction" },
        { key: "reason", label: "Reason" },
      ]}
      initialRows={[]}
    />
  )
}
