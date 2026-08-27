import { ROUTES } from "@/routes/config"
import { VmsListPage } from "@/components/vms/vms-list-page"

export default function EscortRequirement() {
  return (
    <VmsListPage
      title="Escort Requirement"
      description="Configure escort rules by zone and visit type."
      storageKey="vms_escort_requirement_rows"
      breadcrumbs={[
        { label: "Home", href: ROUTES.DASHBOARD },
        { label: "Visitor Management System" },
        { label: "Escort Requirement" },
      ]}
      columns={[
        { key: "zone", label: "Zone" },
        { key: "escort", label: "Escort" },
        { key: "assignedTo", label: "Assigned To" },
      ]}
      formFields={[
        { key: "zone", label: "Zone" },
        { key: "escort", label: "Escort Required" },
        { key: "assignedTo", label: "Assigned To" },
      ]}
      initialRows={[]}
    />
  )
}
