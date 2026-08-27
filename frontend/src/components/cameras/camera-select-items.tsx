import { SelectItem } from "@/components/ui/select"
import type { CameraRecord } from "@/lib/cameras-api"
import { cameraSourceLabel } from "@/lib/cameras-api"

type CameraSelectItemsProps = {
  cameras: CameraRecord[]
  loading?: boolean
  valueAs?: "id" | "code"
}

export function CameraSelectItems({
  cameras,
  loading,
  valueAs = "id",
}: CameraSelectItemsProps) {
  if (loading) {
    return <SelectItem value="_loading" disabled>Loading cameras…</SelectItem>
  }
  if (cameras.length === 0) {
    return (
      <SelectItem value="_empty" disabled>
        No cameras — add them in Camera Management
      </SelectItem>
    )
  }
  return (
    <>
      {cameras.map((cam) => (
        <SelectItem
          key={cam.id}
          value={valueAs === "code" ? cam.code : String(cam.id)}
        >
          {cam.name} · {cameraSourceLabel(cam)}
        </SelectItem>
      ))}
    </>
  )
}
