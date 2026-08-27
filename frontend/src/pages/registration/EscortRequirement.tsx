import { ROUTES } from "@/routes/config"
import { VmsListPage } from "@/components/vms/vms-list-page"

export default function EscortRequirementPage() {
  return (
    <VmsListPage
      title="Escort Requirement"
      description="Mandatory escort assignment for sensitive zones."
      storageKey="vms_escort_requirement_rows"
      breadcrumbs={[
        { label: "Home", href: ROUTES.DASHBOARD },
        { label: "Visitor Management System" },
        { label: "Access Control" },
        { label: "Escort Requirement" },
      ]}
      columns={[
        { key: "zone", label: "Sensitive Zone" },
        { key: "escort", label: "Escort Requirement" },
        { key: "assignedTo", label: "Assigned To" },
      ]}
      formFields={[
        { key: "zone", label: "Sensitive Zone" },
        { key: "escort", label: "Escort Requirement" },
        { key: "assignedTo", label: "Assigned To" },
      ]}
      filterField="escort"
      initialRows={[
        { zone: "Server Room", escort: "Required", assignedTo: "IT Admin (Usman Tariq)" },
        { zone: "Evidence Storage", escort: "Required", assignedTo: "Security Officer (Bilal Saeed)" },
        { zone: "Customs Vault", escort: "Dual Approval", assignedTo: "Supervisor + Security Lead" },
      ]}
    />
  )
}
