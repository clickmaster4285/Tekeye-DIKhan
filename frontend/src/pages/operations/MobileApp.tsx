import { ModulePageLayout } from "@/components/dashboard/module-page-layout"

export default function MobileAppPage() {
  return (
    <ModulePageLayout
      title="Mobile App"
      description="iOS & Android feature specification."
      breadcrumbs={[{ label: "AI Analytics" }, { label: "Mobile App" }]}
    >
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-muted-foreground">
        Mobile App — iOS and Android feature specification. Content coming soon.
      </div>
    </ModulePageLayout>
  )
}
