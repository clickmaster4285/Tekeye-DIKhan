import { ROUTES } from "@/routes/config"
import { VmsListPage } from "@/components/vms/vms-list-page"

export default function BlacklistManagementPage() {
  return (
    <VmsListPage
      title="Blacklist Management"
      description="Add or restrict visitors permanently or temporarily."
      storageKey="vms_blacklist_management_rows"
      breadcrumbs={[
        { label: "Home", href: ROUTES.DASHBOARD },
        { label: "Visitor Management System" },
        { label: "Security & Screening" },
        { label: "Blacklist Management" },
      ]}

      columns={[
        { key: "id", label: "ID" },

        {
          key: "profile_image",
          label: "Profile Image",
          render: (row: any) => (
            <img
              src={row.profile_image || "/images/default-user.png"}
              alt={row.name}
              className="h-10 w-10 rounded-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = "/images/default-user.png"
              }}
            />
          ),
        },

        {
          key: "name",
          label: "Visitor Name",
          render: (row: any) => (
            <div className="font-semibold">{row.name}</div>
          ),
        },

        { key: "phone", label: "Phone" },

        // ✅ DOCUMENT TYPE BADGE
        {
          key: "document_type",
          label: "Document Type",
          render: (row: any) => {
            const isPassport = row.document_type === "Passport"

            return (
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  isPassport
                    ? "bg-purple-100 text-purple-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {row.document_type}
              </span>
            )
          },
        },

        {
          key: "document",
          label: "ID Document",
          render: (row: any) => (
            <span className="font-mono text-sm">{row.document}</span>
          ),
        },

        // ✅ RESTRICTION BADGE
        {
          key: "restriction",
          label: "Restriction Type",
          render: (row: any) => (
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                row.restriction === "Permanent"
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {row.restriction}
            </span>
          ),
        },

        {
          key: "duration",
          label: "Duration",
          render: (row: any) => (
            <span
              className={
                row.duration === "N/A" ? "text-muted-foreground" : ""
              }
            >
              {row.duration}
            </span>
          ),
        },

        {
          key: "reason",
          label: "Violation",
          render: (row: any) => (
            <div
              className="max-w-xs truncate"
              title={row.reason}
            >
              {row.reason}
            </div>
          ),
        },

        { key: "blacklisted_date", label: "Blacklisted Date" },

        {
          key: "expiry_date",
          label: "Expiry Date",
          render: (row: any) => {
            const isExpired =
              row.expiry_date &&
              row.expiry_date !== "—" &&
              new Date(row.expiry_date) < new Date()

            return (
              <span className={isExpired ? "text-amber-600 font-medium" : ""}>
                {row.expiry_date || "—"}
              </span>
            )
          },
        },

        {
          key: "blacklisted_by",
          label: "Blacklisted By",
          render: (row: any) => (
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                row.blacklisted_by === "AI"
                  ? "bg-red-200 text-red-800"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {row.blacklisted_by}
            </span>
          ),
        },
      ]}

      // ✅ IMPROVED FORM FIELDS (Dropdowns instead of free text)
      formFields={[
        { key: "name", label: "Visitor Name", placeholder: "Full name" },
        { key: "email", label: "Email", placeholder: "visitor@example.com" },
        { key: "phone", label: "Phone", placeholder: "+92-300-1234567" },

        {
          key: "document_type",
          label: "Document Type",
          type: "select",
          options: ["CNIC", "Passport"],
        },

        {
          key: "document",
          label: "ID Document Number",
          placeholder: "Enter CNIC or Passport number",
        },

        {
          key: "restriction",
          label: "Restriction Type",
          type: "select",
          options: ["Permanent", "Temporary"],
        },

        {
          key: "duration",
          label: "Duration",
          placeholder: "e.g., 7 days, 30 days, N/A",
        },

        {
          key: "reason",
          label: "Reason",
          placeholder: "Reason for blacklisting",
        },

        {
          key: "expiry_date",
          label: "Expiry Date",
          type: "date",
        },

        {
          key: "blacklisted_by",
          label: "Blacklisted By",
          type: "select",
          options: ["AI", "Manual"],
        },
      ]}

      filterField="restriction"

      initialRows={[
        {
          id: 1,
          profile_image: "https://randomuser.me/api/portraits/men/31.jpg",
          name: "Imran Yousaf",
          email: "imran.yousaf@example.com",
          phone: "+92-300-1112233",
          document_type: "CNIC",
          document: "35202-7654321-1",
          restriction: "Permanent",
          duration: "N/A",
          reason: "Security violation - attempted unauthorized access to server room",
          blacklisted_date: "2026-02-15",
          expiry_date: "—",
          blacklisted_by: "AI",
        },
        {
          id: 2,
          profile_image: "https://randomuser.me/api/portraits/women/45.jpg",
          name: "Samina Irfan",
          email: "samina.irfan@example.com",
          phone: "+92-321-4445566",
          document_type: "CNIC",
          document: "35201-1234987-2",
          restriction: "Temporary",
          duration: "7 days",
          reason: "Invalid documents - provided expired CNIC",
          blacklisted_date: "2026-03-01",
          expiry_date: "2026-03-08",
          blacklisted_by: "Manual",
        },
        {
          id: 3,
          profile_image: "https://randomuser.me/api/portraits/men/50.jpg",
          name: "Robert Kim",
          email: "robert.kim@example.com",
          phone: "+82-10-9876-5432",
          document_type: "Passport",
          document: "M12345678",
          restriction: "Temporary",
          duration: "30 days",
          reason: "Unauthorized area access - entered restricted laboratory",
          blacklisted_date: "2026-02-20",
          expiry_date: "2026-03-22",
          blacklisted_by: "AI",
        },
        // ✅ New entries
        {
          id: 4,
          profile_image: "https://randomuser.me/api/portraits/women/60.jpg",
          name: "Ayesha Khan",
          email: "ayesha.khan@example.com",
          phone: "+92-300-5566778",
          document_type: "Passport",
          document: "P98765432",
          restriction: "Permanent",
          duration: "N/A",
          reason: "Multiple security violations at main gate",
          blacklisted_date: "2026-03-02",
          expiry_date: "—",
          blacklisted_by: "Manual",
        },
        {
          id: 5,
          profile_image: "https://randomuser.me/api/portraits/men/65.jpg",
          name: "Ali Raza",
          email: "ali.raza@example.com",
          phone: "+92-321-7788990",
          document_type: "CNIC",
          document: "35203-8765432-0",
          restriction: "Temporary",
          duration: "14 days",
          reason: "Attempted unauthorized access to server room",
          blacklisted_date: "2026-03-03",
          expiry_date: "2026-03-17",
          blacklisted_by: "AI",
        },
        {
          id: 6,
          profile_image: "https://randomuser.me/api/portraits/women/70.jpg",
          name: "Sadia Malik",
          email: "sadia.malik@example.com",
          phone: "+92-333-1122334",
          document_type: "CNIC",
          document: "35204-1234567-8",
          restriction: "Permanent",
          duration: "N/A",
          reason: "Banned due to repeated policy violations",
          blacklisted_date: "2026-03-01",
          expiry_date: "—",
          blacklisted_by: "AI",
        },
        {
          id: 7,
          profile_image: "https://randomuser.me/api/portraits/men/75.jpg",
          name: "Hamza Sheikh",
          email: "hamza.sheikh@example.com",
          phone: "+92-334-2233445",
          document_type: "Passport",
          document: "P54321678",
          restriction: "Temporary",
          duration: "21 days",
          reason: "Unauthorized visit to restricted laboratory",
          blacklisted_date: "2026-03-04",
          expiry_date: "2026-03-25",
          blacklisted_by: "Manual",
        },
      ]}
    />
  )
}