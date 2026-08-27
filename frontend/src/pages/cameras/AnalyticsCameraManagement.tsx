import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { ROUTES } from "@/routes/config"
import { CameraManagementContent } from "./CameraManagement"

export default function AnalyticsCameraManagementPage() {
  return (
    <ModulePageLayout
      title="Camera Management"
      description="Connect CCTV cameras and manage them in one place."
      breadcrumbs={[{ label: "AI Analytics" }, { label: "Camera Management" }]}
    >
      <CameraManagementContent viewBasePath={ROUTES.ANALYTICS_CAMERA_MANAGEMENT} />
    </ModulePageLayout>
  )
}
