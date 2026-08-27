import { ROUTES } from "@/routes/config"
import { VmsListPage } from "@/components/vms/vms-list-page"

export default function ContractorPassesPage() {
  return (
    <VmsListPage
      title="Contractor Passes"
      description="Long-term visitor passes for contractors/vendors."
      storageKey="vms_contractor_passes_rows"
      breadcrumbs={[
        { label: "Home", href: ROUTES.DASHBOARD },
        { label: "Visitor Management System" },
        { label: "Vehicle & Contractor Management" },
        { label: "Contractor Passes" },
      ]}
      columns={[
        { key: "passId", label: "Pass ID" },
        { key: "company", label: "Company" },
        { key: "validity", label: "Validity" },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "passId", label: "Pass ID" },
        { key: "company", label: "Company" },
        { key: "validity", label: "Validity" },
        { key: "status", label: "Status" },
      ]}
      filterField="status"
      initialRows={[
        { passId: "CP-101", company: "Alpha Electric Co.", validity: "01 Mar 2026 - 31 May 2026", status: "Active" },
        { passId: "CP-145", company: "Pak Logistics", validity: "15 Feb 2026 - 15 Aug 2026", status: "Active" },
      ]}
    />
  )
}
