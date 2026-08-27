import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { resolveStaffProfileImageUrl, staffInitials } from "@/lib/staff-api"

type StaffAvatarProps = {
  profileImage?: string | null
  fullName?: string | null
  className?: string
  fallbackClassName?: string
}

export function StaffAvatar({
  profileImage,
  fullName,
  className,
  fallbackClassName,
}: StaffAvatarProps) {
  const src = resolveStaffProfileImageUrl(profileImage)
  const initials = staffInitials(fullName)

  return (
    <Avatar className={cn(className)}>
      {src ? <AvatarImage src={src} alt="" className="object-cover" /> : null}
      <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
    </Avatar>
  )
}
