import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { ROUTES } from "@/routes/config"
import { CameraManagementContent } from "./CameraManagement"

/** Camera Integration uses the same dynamic DB-backed UI as Camera Management. */
export default function CameraIntegrationPage() {
  return (
    <ModulePageLayout
      title="Camera Integration"
      description="Connect CCTV cameras — all data stored in the database."
      breadcrumbs={[{ label: "WMS" }, { label: "Camera Integration" }]}
    >
      <CameraManagementContent viewBasePath={ROUTES.CAMERA_INTEGRATION} />
    </ModulePageLayout>
  )
}
