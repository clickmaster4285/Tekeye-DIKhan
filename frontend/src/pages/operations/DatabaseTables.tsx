import { ModulePageLayout } from "@/components/dashboard/module-page-layout"

export default function DatabaseTablesPage() {
  return (
    <ModulePageLayout
      title="Database Tables"
      description="Key database tables & field reference."
      breadcrumbs={[{ label: "AI Analytics" }, { label: "Database Tables" }]}
    >
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-muted-foreground">
        Database Tables — key database tables and field reference. Content coming soon.
      </div>
    </ModulePageLayout>
  )
}
